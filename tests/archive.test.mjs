/*
  첫 화면(Dr. Y's Archive)과 '아카이브로 돌아가는 줄' 을 실제 브라우저로 확인합니다.

  이 검사가 따로 있는 이유:
    돌아가는 줄은 '설치한 앱으로 열었을 때는 감춘다' 는 조건이 붙어 있습니다.
    설치한 앱은 자기 폴더까지가 '내 영역' 이라, 한 칸 위인 아카이브로 가면
    앱 창이 아니라 브라우저가 따로 열립니다. 갑자기 다른 창으로 튀면 당황스럽고,
    설치해서 쓰는 분에게는 홈 화면이 이미 아카이브 역할을 합니다.

    그런데 이 조건은 HTML 만 읽어서는 확인할 수 없습니다.
    브라우저가 "지금 어떤 모양으로 열려 있나(display-mode)" 를 알아야 하기 때문입니다.
    그래서 진짜 브라우저를 두 가지 모양으로 띄워서 확인합니다.
      - 보통 창       → 줄이 보여야 합니다
      - 앱 모양 창    → 줄이 감춰져야 합니다 (--app 으로 띄우면 그 상태가 됩니다)

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/archive.test.mjs

  아이패드에서는 실행할 수 없습니다. 확인이 필요하면 Claude에게 부탁하세요.
*/
import { chromium } from "playwright";
import http from "http"; import fs from "fs"; import path from "path"; import os from "os";

// CSS 파일을 직접 읽어볼 때 쓰는 저장소 경로
const 집폴더 = path.join(import.meta.dirname, "..");

const 뿌리 = path.join(import.meta.dirname, "..");
const 종류 = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
               ".json":"application/json", ".png":"image/png" };
const 서버 = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0]);
  if (u.endsWith("/")) u += "index.html";
  const p = path.join(뿌리, u);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": 종류[path.extname(p)] || "text/plain" });
  res.end(fs.readFileSync(p));
});
await new Promise((r) => 서버.listen(8776, r));
const 집 = "http://localhost:8776";

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

// 앱 폴더는 손으로 적지 않고 찾아옵니다. 앱을 새로 만들어도 이 검사를 고칠 필요가 없습니다.
const 앱들 = fs.readdirSync(뿌리, { withFileTypes: true })
  .filter((칸) => 칸.isDirectory() && !칸.name.startsWith(".") &&
                  fs.existsSync(path.join(뿌리, 칸.name, "manifest.json")))
  .map((칸) => 칸.name).sort();

const 실행파일 = process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {};
const browser = await chromium.launch(실행파일);

/* 바깥 서비스는 부르지 않게 막아둡니다 (인터넷 사정에 결과가 흔들리지 않도록) */
const 가짜응답 = async (page) => {
  await page.route("**/api.mymemory.translated.net/**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ responseData: { translatedText: "옮긴 문장입니다." } }) }));
  await page.route("**/eutils.ncbi.nlm.nih.gov/**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ esearchresult: { idlist: [] } }) }));
};

/* ==========================================================
   1. 첫 화면 — 바로가기 아이콘을 누르면 그 앱으로 가는가
   ========================================================== */
console.log("\n[1] 첫 화면의 바로가기");

{
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await 가짜응답(page);
  await page.goto(`${집}/`, { waitUntil: "domcontentloaded" });

  const 아이콘수 = await page.locator(".dock a").count();
  검사(`바로가기 아이콘이 앱 수(${앱들.length})만큼 보이는가`, 아이콘수 === 앱들.length, 아이콘수);

  for (const 앱 of 앱들) {
    await page.goto(`${집}/`, { waitUntil: "domcontentloaded" });
    await page.locator(`.dock a[href="${앱}/"]`).click();
    await page.waitForLoadState("domcontentloaded");
    검사(`바로가기 ${앱} 을 누르면 그 앱으로 가는가`,
      page.url().includes(`/${앱}/`), page.url());
  }
  await page.close();
}

/* ==========================================================
   2. 보통 창에서 열면 돌아가는 줄이 보이고, 실제로 돌아가는가
   ========================================================== */
console.log("\n[2] 보통 브라우저 창에서");

for (const 앱 of 앱들) {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  await 가짜응답(page);
  await page.goto(`${집}/${앱}/`, { waitUntil: "domcontentloaded" });

  const 줄 = page.locator(".back-home a");
  검사(`${앱} — 돌아가는 줄이 보이는가`, await 줄.isVisible());
  검사(`${앱} — 한 칸 위(../)를 가리키는가`,
    (await 줄.getAttribute("href")) === "../", await 줄.getAttribute("href"));

  await 줄.click();
  await page.waitForLoadState("domcontentloaded");
  검사(`${앱} — 눌렀을 때 실제로 첫 화면으로 가는가`,
    (await page.title()).includes("Dr. Y's Archive"), await page.title());
  await page.close();
}

/* ==========================================================
   3. 설치한 앱으로 열면 감춰지는가
   ------------------------------------------------------------
   돌아가는 줄에는 "설치한 앱으로 열었을 때는 감춘다" 는 조건이 붙어 있습니다.
   설치한 앱은 자기 폴더까지가 '내 영역' 이라, 한 칸 위인 아카이브로 가면
   앱 창이 아니라 브라우저가 따로 열립니다. 갑자기 다른 창으로 튀면 당황스럽고,
   설치해서 쓰는 분에게는 홈 화면이 이미 아카이브 역할을 합니다.

   ⚠️ 이 부분만은 진짜 브라우저로 확인하지 못합니다. 솔직히 적어둡니다.

      예전에는 --app=주소 로 앱 창을 띄워서 봤습니다. 그런데 크로미움이
      1194 에서 1243 으로 올라가면서 그렇게 띄운 창이 잡히지 않습니다
      (about:blank 만 돌아옵니다). CDP 의 Emulation.setEmulatedMedia 로
      display-mode 를 흉내내는 것도 시도했지만 먹지 않았습니다 —
      셋 다 standalone:false 였습니다.

      그래서 두 가지로 나눠서 지킵니다.
        (1) 보통 브라우저에서 줄이 보이는가  → 진짜 브라우저로 확인
        (2) 앱 모양일 때 감추는 규칙이 있는가 → CSS 를 읽어서 확인

      (2)는 '규칙이 적혀 있다' 까지만 보증합니다. 그 규칙이 실제 아이폰에서
      먹는지는 못 봅니다. 그래도 규칙을 실수로 지우거나 선택자를 잘못 쓰면
      여기서 잡힙니다. 할 수 있는 만큼은 지키는 셈입니다.
   ========================================================== */
console.log("\n[3] 설치한 앱으로 열었을 때");

for (const 앱 of 앱들) {
  const css길 = path.join(집폴더, 앱, "style.css");
  if (!fs.existsSync(css길)) {
    검사(`${앱} — style.css 가 있는가`, false, css길);
    continue;
  }
  const css = fs.readFileSync(css길, "utf8");

  /*
    @media (display-mode: standalone) ... { ... } 덩어리를 찾습니다.
    중괄호 짝을 세어 덩어리 끝을 찾습니다 — 안쪽에도 중괄호가 있기 때문에
    단순히 첫 } 까지 자르면 안 됩니다.
  */
  const 시작 = css.search(/@media[^{]*display-mode:\s*standalone/);
  검사(`${앱} — 앱 모양일 때의 규칙이 있는가`, 시작 >= 0, 시작);
  if (시작 < 0) continue;

  let 깊이 = 0;
  let 끝 = -1;
  for (let k = css.indexOf("{", 시작); k < css.length; k += 1) {
    if (css[k] === "{") 깊이 += 1;
    else if (css[k] === "}") {
      깊이 -= 1;
      if (깊이 === 0) { 끝 = k; break; }
    }
  }
  const 덩어리 = 끝 > 0 ? css.slice(시작, 끝 + 1) : "";

  검사(`${앱} — 그 규칙이 돌아가는 줄을 가리키는가`,
    /\.back-home/.test(덩어리), 덩어리.slice(0, 160));
  검사(`${앱} — 그 규칙이 감추는 규칙인가`,
    /display:\s*none/.test(덩어리), 덩어리.slice(0, 160));
}

/*
  ★ 반대쪽은 진짜 브라우저로 봅니다.
     '감추는 규칙이 있다' 만 확인하면, 실수로 늘 감춰버려도 통과합니다.
     보통 브라우저로 열었을 때는 반드시 보여야 합니다.
*/
for (const 앱 of 앱들) {
  const page = await browser.newPage();
  try {
    await page.goto(`${집}/${앱}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".back-home", { state: "attached", timeout: 5000 });
    const 결과 = await page.evaluate(() => ({
      앱모양인가: matchMedia("(display-mode: standalone)").matches,
      보임: getComputedStyle(document.querySelector(".back-home")).display !== "none",
    }));
    검사(`${앱} — 보통 브라우저에서는 줄이 보이는가`, 결과.보임 && !결과.앱모양인가, 결과);
  } finally {
    await page.close();
  }
}

await browser.close();
서버.close();

if (실패 > 0) { console.log(`\n❌ ${실패}개 실패`); process.exit(1); }
console.log("\n🎉 첫 화면과 돌아가는 줄 — 전체 정상");
