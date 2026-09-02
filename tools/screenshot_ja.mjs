/*
  일본어 회화 앱(japanese/)을 화면 크기별로 열어 스크린샷을 찍는 도구입니다.
  인터넷이 필요 없는 앱이라 가짜 데이터를 넣을 것도 없습니다. 그냥 열어서 찍습니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tools/screenshot_ja.mjs

  아이패드에서는 실행할 수 없습니다. 화면 확인이 필요하면 Claude에게 부탁하세요.
  결과 파일: ja-desktop-1440.png / ja-ipad-1024.png / ja-phone-390.png / ja-quiz-390.png
*/
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

// --- 프로젝트 폴더를 그대로 내어주는 작은 서버 ---
// 파일을 그냥 열면(file://) 브라우저가 막는 기능이 있어서, 짧게 서버를 띄웁니다.
const 뿌리 = path.join(import.meta.dirname, "..");
const 종류 = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
               ".json": "application/json", ".png": "image/png" };
const 서버 = http.createServer((req, res) => {
  let 주소 = decodeURIComponent(req.url.split("?")[0]);
  if (주소.endsWith("/")) 주소 += "index.html";
  const 경로 = path.join(뿌리, 주소);
  if (!fs.existsSync(경로) || fs.statSync(경로).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": 종류[path.extname(경로)] || "text/plain" });
  res.end(fs.readFileSync(경로));
});
await new Promise((r) => 서버.listen(8766, r));

// 브라우저 경로를 직접 지정해야 하는 환경이면 PW_CHROME 환경변수로 넘길 수 있습니다
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

const 화면들 = [
  { 이름: "ja-desktop-1440", 폭: 1440, 높이: 1000 },
  { 이름: "ja-ipad-1024",    폭: 1024, 높이: 1200 },
  { 이름: "ja-phone-390",    폭: 390,  높이: 1400 },
];

for (const 화면 of 화면들) {
  const page = await browser.newPage({ viewport: { width: 화면.폭, height: 화면.높이 } });
  await page.goto("http://127.0.0.1:8766/japanese/index.html");
  await page.waitForSelector(".phrase-card");
  // 첫 카드는 답을 펼쳐 두어야 어떻게 보이는지 확인할 수 있습니다
  await page.locator('[data-act="reveal"]').first().click();
  await page.screenshot({ path: `${화면.이름}.png`, fullPage: true });
  console.log(`${화면.이름}.png 저장`);
  await page.close();
}

// 퀴즈 화면도 한 장 남깁니다
const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
await page.goto("http://127.0.0.1:8766/japanese/index.html");
await page.waitForSelector(".phrase-card");
// '외웠어요' 버튼은 답을 펼쳐야 보입니다. 먼저 펼친 뒤 누릅니다.
await page.locator('[data-act="reveal"]').first().click();
await page.locator('[data-act="learned"]').first().click();   // 복습 대상 하나 만들기
await page.locator("#quizBtn").click();
await page.waitForSelector(".quiz-option");
await page.locator(".quiz-option").first().click();
await page.screenshot({ path: "ja-quiz-390.png", fullPage: true });
console.log("ja-quiz-390.png 저장");

await browser.close();
서버.close();
