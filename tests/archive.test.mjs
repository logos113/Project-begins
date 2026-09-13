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
   --app=주소 로 띄우면 브라우저 UI 없이 열리고,
   홈 화면에 설치한 앱과 같은 상태(display-mode: standalone)가 됩니다.
   ========================================================== */
console.log("\n[3] 설치한 앱으로 열었을 때");

for (const 앱 of 앱들) {
  const 임시방 = fs.mkdtempSync(path.join(os.tmpdir(), "pw-app-"));
  const ctx = await chromium.launchPersistentContext(임시방, {
    ...실행파일,
    headless: true,
    args: [`--app=${집}/${앱}/`],
  });
  try {
    // 창이 뜨고 페이지가 그려질 때까지 잠깐 기다립니다
    let page = null;
    for (let i = 0; i < 40 && !page; i++) {
      page = ctx.pages().find((p) => p.url().includes(`/${앱}/`)) || null;
      if (!page) await new Promise((r) => setTimeout(r, 100));
    }
    if (!page) { 검사(`${앱} — 앱 모양 창이 열렸는가`, false, ctx.pages().map((p) => p.url())); continue; }
    await page.waitForSelector(".back-home", { state: "attached", timeout: 5000 });

    const 결과 = await page.evaluate(() => ({
      앱모양인가: matchMedia("(display-mode: standalone)").matches,
      보임: getComputedStyle(document.querySelector(".back-home")).display !== "none",
    }));
    검사(`${앱} — 앱 모양(standalone)으로 열렸는가`, 결과.앱모양인가, 결과);
    검사(`${앱} — 돌아가는 줄이 감춰지는가`, !결과.보임, 결과);
  } finally {
    await ctx.close();
    fs.rmSync(임시방, { recursive: true, force: true });
  }
}

await browser.close();
서버.close();

if (실패 > 0) { console.log(`\n❌ ${실패}개 실패`); process.exit(1); }
console.log("\n🎉 첫 화면과 돌아가는 줄 — 전체 정상");
