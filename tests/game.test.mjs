/*
  게임이 제대로 도는지 진짜 브라우저로 확인하는 검사입니다.
  버튼을 누르고, 점프하고, 부딪혀서 끝나는 것까지 사람이 하듯 해봅니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/game.test.mjs

  아이패드에서는 실행할 수 없습니다. 확인이 필요하면 Claude 에게 부탁하세요.
*/
import { chromium } from "playwright";
import http from "http"; import fs from "fs"; import path from "path";
const 뿌리 = path.join(import.meta.dirname, "..", "game");
const 종류 = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".png":"image/png" };
const 서버 = http.createServer((req,res) => {
  const u = req.url.split("?")[0];
  const p = path.join(뿌리, u === "/" ? "index.html" : u);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": 종류[path.extname(p)] || "text/plain" });
  res.end(fs.readFileSync(p));
});
await new Promise(r => 서버.listen(8770, r));

// 브라우저 경로를 직접 지정해야 하는 환경이면 PW_CHROME 환경변수로 넘길 수 있습니다
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport:{width:844,height:390}, deviceScaleFactor:2 });

const 오류들 = [];
page.on("pageerror", (e) => 오류들.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") 오류들.push(m.text()); });

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건?"✅":"❌"} ${이름}${조건?"":"\n     실제값: "+JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

await page.goto("http://localhost:8770/", { waitUntil:"networkidle" });
await page.waitForTimeout(300);

// 1) 시작 화면
검사("시작 화면이 보이는가", await page.locator("#overlay").isVisible());
검사("제목이 나오는가", (await page.locator("#overlayTitle").textContent()).includes("점프"));
검사("자바스크립트 오류가 없는가", 오류들.length === 0, 오류들);


// 2) 게임 시작
await page.locator("#startBtn").click();
await page.waitForTimeout(1500);
검사("시작하면 시작 화면이 사라지는가", !(await page.locator("#overlay").isVisible()));
const 점수1 = Number(await page.locator("#score").textContent());
검사("시간이 지나면 점수가 올라가는가", 점수1 > 0, 점수1);


// 3) 아무것도 안 하면 장애물에 부딪혀 끝나는가
await page.waitForTimeout(9000);
const 끝났나 = await page.locator("#overlay").isVisible();
검사("점프하지 않으면 부딪혀서 게임이 끝나는가", 끝났나);
if (끝났나) {
  const 최종 = Number(await page.locator("#finalScore").textContent());
  검사("게임오버 화면에 점수가 나오는가", 최종 > 0, 최종);
  검사("버튼이 '다시 하기'로 바뀌는가",
    (await page.locator("#startBtn").textContent()).includes("다시"));

}

// 4) 최고 점수가 저장되는가
const 최고1 = Number(await page.locator("#best").textContent());
검사("최고 점수가 기록되는가", 최고1 > 0, 최고1);
await page.reload({ waitUntil:"networkidle" });
await page.waitForTimeout(300);
검사("새로고침해도 최고 점수가 남아 있는가",
  Number(await page.locator("#best").textContent()) === 최고1,
  await page.locator("#best").textContent());

// 5) 점프가 실제로 작동하는가
/*
  "계속 탭하면 더 오래 버틴다" 로 확인하려 했더니 결과가 들쭉날쭉했습니다.
  장애물 위치가 매번 무작위라 운이 크게 작용하기 때문입니다.
  그래서 로봇이 실제로 공중에 뜨는지를 직접 확인합니다.
*/
await page.locator("#startBtn").click();
await page.waitForTimeout(400);

const 땅에서 = await page.evaluate(() => window.게임상태());
검사("점프하기 전에는 로봇이 땅에 있는가", !땅에서.공중에있나, 땅에서);

await page.mouse.click(600, 200);          // 한 번 탭 = 점프
await page.waitForTimeout(120);
const 한번점프 = await page.evaluate(() => window.게임상태());
검사("한 번 탭하면 로봇이 공중에 뜨는가", 한번점프.공중에있나, 한번점프);
검사("점프하면 땅보다 위로 올라가는가", 한번점프.로봇y < 땅에서.로봇y,
  { 전: 땅에서.로봇y, 후: 한번점프.로봇y });

await page.mouse.click(600, 200);          // 공중에서 한 번 더 = 두 번 점프
await page.waitForTimeout(80);
const 두번점프 = await page.evaluate(() => window.게임상태());
검사("공중에서 한 번 더 누르면 두 번 점프가 되는가", 두번점프.점프한횟수 === 2, 두번점프);

// 세 번째는 무시되어야 합니다 (무한 점프 방지)
await page.mouse.click(600, 200);
await page.waitForTimeout(60);
const 세번째 = await page.evaluate(() => window.게임상태());
검사("세 번째 탭은 무시되는가 (무한 점프 방지)", 세번째.점프한횟수 <= 2, 세번째);

// 6) 화면 폭이 기기와 상관없이 일정하게 유지되는가
const 가로폭 = (await page.evaluate(() => window.게임상태())).화면폭;
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
const 세로폭 = (await page.evaluate(() => window.게임상태())).화면폭;
검사("가로 화면에서 게임 폭이 충분히 넓은가 (500 이상)", 가로폭 >= 500, 가로폭);
검사("세로 화면에서도 피할 시간이 있을 만큼 넓은가 (300 이상)", 세로폭 >= 300, 세로폭);
await page.setViewportSize({ width: 844, height: 390 });

검사("게임 내내 자바스크립트 오류가 없는가", 오류들.length === 0, 오류들.slice(0,3));

console.log(실패===0 ? "\n🎉 게임이 정상 동작합니다" : `\n⚠️ ${실패}건 실패`);
await browser.close(); 서버.close();
process.exit(실패===0?0:1);
