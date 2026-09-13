/*
  오프라인 동작과 '새 버전 알림' 을 실제 브라우저로 확인합니다.

  이 검사가 꼭 필요한 이유:
    서비스 워커는 잘못 만들면 아주 골치 아픕니다. 파일을 기기에 보관해 두는
    물건이라, 한 번 어긋나면 고쳐서 올려도 예전 화면이 계속 나옵니다.
    게다가 HTML 만 읽어서는 아무것도 알 수 없습니다 — 진짜 브라우저를 띄워
    인터넷을 끊어봐야 확인이 됩니다.

    만드는 동안 실제로 두 가지 문제가 나왔고, 둘 다 여기서 잡았습니다.
      (1) 앱을 처음 열 때마다 화면이 한 번 새로고침되던 것
      (2) '지금 받기' 를 눌러도 화면이 새로 그려지지 않던 것
    아래 검사는 그 두 가지를 그대로 지켜봅니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/offline.test.mjs

  아이패드에서는 실행할 수 없습니다. 확인이 필요하면 Claude에게 부탁하세요.
*/
import { chromium } from "playwright";
import http from "http"; import fs from "fs"; import path from "path";

const 뿌리 = path.join(import.meta.dirname, "..");
const 종류 = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
               ".json":"application/json", ".png":"image/png" };

/*
  sw.js 를 내줄 때 글자를 덧붙일 수 있게 해 둡니다.
  파일을 고쳐 올린 상황을 흉내 내기 위한 것입니다 —
  서비스 워커는 '파일의 글자가 달라졌는가' 로 새 버전을 알아채기 때문입니다.
*/
let 새버전_흉내 = 0;
const 서버 = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0]);
  if (u.endsWith("/")) u += "index.html";
  const p = path.join(뿌리, u);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  let 내용 = fs.readFileSync(p);
  if (u.endsWith("/sw.js") && 새버전_흉내) {
    내용 = Buffer.concat([내용, Buffer.from(`\n// 새 버전 ${새버전_흉내}\n`)]);
  }
  res.writeHead(200, {
    "Content-Type": 종류[path.extname(p)] || "text/plain",
    "Cache-Control": "no-cache",
  });
  res.end(내용);
});
await new Promise((r) => 서버.listen(8782, r));
const 집 = "http://localhost:8782";

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

// 앱 목록은 폴더에서 찾아옵니다. 앱을 새로 만들어도 이 검사를 고칠 필요가 없습니다.
const 앱들 = fs.readdirSync(뿌리, { withFileTypes: true })
  .filter((칸) => 칸.isDirectory() && !칸.name.startsWith(".") &&
                  fs.existsSync(path.join(뿌리, 칸.name, "manifest.json")))
  .map((칸) => 칸.name).sort();

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

/* 바깥 서비스는 부르지 않게 막아둡니다 */
const 가짜응답 = async (page) => {
  await page.route("**/api.mymemory.translated.net/**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ responseData: { translatedText: "옮긴 문장입니다." } }) }));
  await page.route("**/eutils.ncbi.nlm.nih.gov/**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ esearchresult: { idlist: [] } }) }));
};

// 서비스 워커가 이 화면을 담당하게 될 때까지 기다립니다
const 담당될때까지 = (page) => page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 80 && !navigator.serviceWorker.controller; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!navigator.serviceWorker.controller;
});

/* ==========================================================
   1. 앱마다 — 인터넷을 끊어도 열리는가
   ========================================================== */
console.log("\n[1] 인터넷 없이 열리는가");

for (const 앱 of 앱들) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 },
                                         serviceWorkers: "allow" });
  const page = await ctx.newPage();
  await 가짜응답(page);
  const 오류 = []; page.on("pageerror", (e) => 오류.push(e.message));

  await page.goto(`${집}/${앱}/`, { waitUntil: "load" });
  const 담당중 = await 담당될때까지(page);
  검사(`${앱} — 서비스 워커가 화면을 담당하는가`, 담당중);

  // 담당 영역이 자기 폴더로 묶여 있어야 합니다.
  // 저장소 맨 위에 두면 한 워커가 세 앱을 전부 담당하게 됩니다.
  const 영역 = await page.evaluate(async () =>
    (await navigator.serviceWorker.ready).scope);
  검사(`${앱} — 담당 영역이 자기 폴더인가`,
    영역 === `${집}/${앱}/`, 영역);

  const 담긴수 = await page.evaluate(async () => {
    const 이름들 = await caches.keys();
    let 합 = 0;
    for (const n of 이름들) 합 += (await (await caches.open(n)).keys()).length;
    return 합;
  });
  검사(`${앱} — 파일을 보관해 두었는가`, 담긴수 >= 8, 담긴수);

  // ---- 인터넷을 끊습니다 ----
  await ctx.setOffline(true);
  let 열렸나 = false, 제목 = "";
  try {
    await page.reload({ waitUntil: "load", timeout: 15000 });
    제목 = await page.title();
    열렸나 = true;
  } catch (오류2) { 제목 = "열지 못함: " + String(오류2.message).slice(0, 50); }
  검사(`${앱} — 인터넷을 끊고 새로고침해도 열리는가`, 열렸나, 제목);
  검사(`${앱} — 오프라인에서도 제목이 제대로 나오는가`, 열렸나 && 제목.length > 0, 제목);

  await ctx.setOffline(false);
  검사(`${앱} — 자바스크립트 오류가 없는가`, 오류.length === 0, 오류);
  await ctx.close();
}

/* ==========================================================
   2. 새 버전 알림 — 일본어 앱으로 대표 확인
   ------------------------------------------------------------
   세 앱이 똑같은 코드를 쓰므로 하나만 끝까지 확인합니다.
   (등록 자체가 되는지는 위에서 세 앱 모두 확인했습니다)
   ========================================================== */
console.log("\n[2] 새 버전 알림");

{
  새버전_흉내 = 0;
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 },
                                         serviceWorkers: "allow" });
  const page = await ctx.newPage();
  await 가짜응답(page);
  const 오류 = []; page.on("pageerror", (e) => 오류.push(e.message));

  await page.goto(`${집}/japanese/`, { waitUntil: "load" });
  await 담당될때까지(page);
  await page.waitForTimeout(500);

  /*
    맨 처음 설치했을 때는 알림이 뜨면 안 됩니다. 새 버전이 아니니까요.
    또한 이때 화면이 저절로 새로고침되어서도 안 됩니다.
    (처음에 그 증상이 있었습니다 — 앱을 열 때마다 한 번씩 깜빡였습니다)
  */
  검사("처음 설치할 때는 알림이 뜨지 않는가",
    (await page.locator(".sw-update").count()) === 0);

  const 카드수 = await page.locator(".phrase-card").count();
  검사("처음 설치 뒤에도 화면이 멀쩡한가", 카드수 === 3, 카드수);

  // ---- sw.js 가 바뀐 상황을 만듭니다 ----
  새버전_흉내 = 2;
  await page.evaluate(async () => {
    const 등록 = await navigator.serviceWorker.getRegistration();
    await 등록.update();
  });
  await page.waitForSelector(".sw-update", { timeout: 10000 }).catch(() => {});

  검사("새 버전이 올라오면 알림이 뜨는가",
    (await page.locator(".sw-update").count()) === 1);
  const 문구 = (await page.locator(".sw-update").innerText().catch(() => "")).replace(/\s+/g, " ");
  검사("알림에 '지금 받기' 단추가 있는가", 문구.includes("지금 받기"), 문구);

  // ---- 눌러봅니다 ----
  await page.locator(".sw-update-btn").click();
  await page.waitForLoadState("load");
  await page.waitForTimeout(1200);

  const 뒤 = await page.evaluate(async () => {
    const 등록 = await navigator.serviceWorker.getRegistration();
    return {
      알림있나: !!document.querySelector(".sw-update"),
      대기중: !!(등록 && 등록.waiting),
      담당: !!navigator.serviceWorker.controller,
    };
  });
  검사("'지금 받기' 를 누르면 화면이 새로 그려져 알림이 사라지는가", !뒤.알림있나, 뒤);
  검사("대기 중인 새 버전이 남아 있지 않은가", !뒤.대기중, 뒤);
  검사("교대 뒤에도 서비스 워커가 담당하는가", 뒤.담당, 뒤);
  검사("교대 뒤에도 화면이 멀쩡한가",
    (await page.locator(".phrase-card").count()) === 3);
  검사("전 과정에서 자바스크립트 오류가 없는가", 오류.length === 0, 오류);

  // ---- 닫기 단추 ----
  새버전_흉내 = 3;
  await page.evaluate(async () => {
    const 등록 = await navigator.serviceWorker.getRegistration();
    await 등록.update();
  });
  await page.waitForSelector(".sw-update", { timeout: 10000 }).catch(() => {});
  if (await page.locator(".sw-update").count()) {
    await page.locator(".sw-update-close").click();
    검사("✕ 를 누르면 알림이 닫히는가",
      (await page.locator(".sw-update").count()) === 0);
  } else {
    검사("두 번째 새 버전도 알림이 뜨는가", false, "알림이 뜨지 않았습니다");
  }

  await ctx.close();
}

await browser.close();
서버.close();

if (실패 > 0) { console.log(`\n❌ ${실패}개 실패`); process.exit(1); }
console.log("\n🎉 오프라인과 새 버전 알림 — 전체 정상");
