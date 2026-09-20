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
// 체력이 3칸이라 세 번 부딪혀야 끝납니다. 보통 7~8초쯤 걸립니다.
await page.waitForTimeout(13000);
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

/* ==========================================================
   6-2) 로봇의 체력
   ------------------------------------------------------------
   예전에는 한 번만 부딪혀도 끝났습니다. 보스가 쏘는 것까지 한 방이면
   너무 야박해서 체력 세 칸을 두었습니다.

   맞은 뒤에는 잠깐 무적이 됩니다. 이게 없으면 장애물 하나에 몸이 겹쳐 있는
   몇 장면 동안 세 칸이 순식간에 사라집니다. 그래서 무적도 함께 확인합니다.
   ========================================================== */
const 새판 = async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await page.waitForTimeout(250);
};
const 상태 = () => page.evaluate(() => window.게임상태());
const 장애물_치우기 = () => page.evaluate(() => {
  장애물들 = [];
  설정.장애물_최소간격 = 100000;
  설정.장애물_최대간격 = 100000;
  다음장애물까지 = 100000;
});

await 새판();
검사("시작하면 체력이 세 칸인가", (await 상태()).로봇체력 === 3, await 상태());
검사("화면에 하트가 세 개 나오는가",
  (await page.locator("#hearts").textContent()) === "♥♥♥",
  await page.locator("#hearts").textContent());

await 장애물_치우기();
const 한대맞은뒤 = await page.evaluate(() => {
  로봇_맞음();
  return { 체력: 로봇.체력, 무적: 로봇.무적 > 0 };
});
검사("한 번 맞으면 체력이 한 칸 줄어드는가", 한대맞은뒤.체력 === 2, 한대맞은뒤);
검사("맞으면 잠깐 무적이 되는가", 한대맞은뒤.무적, 한대맞은뒤);
검사("하트 표시도 함께 줄어드는가",
  (await page.locator("#hearts").textContent()) === "♥♥♡",
  await page.locator("#hearts").textContent());

// 무적인 동안 여러 번 때려도 더 깎이면 안 됩니다
const 무적중 = await page.evaluate(() => {
  for (let i = 0; i < 5; i++) 로봇_맞음();
  return 로봇.체력;
});
검사("무적인 동안에는 더 맞지 않는가", 무적중 === 2, 무적중);

// 무적이 풀린 뒤에는 다시 맞아야 합니다
await page.evaluate(() => { 로봇.무적 = 0; });
const 두대째 = await page.evaluate(() => { 로봇_맞음(); return 로봇.체력; });
검사("무적이 풀리면 다시 맞는가", 두대째 === 1, 두대째);

// 세 번째에 끝나야 합니다
await page.evaluate(() => { 로봇.무적 = 0; });
await page.evaluate(() => { 로봇_맞음(); });
await page.waitForTimeout(200);
const 끝난뒤 = await 상태();
검사("세 번 맞으면 게임이 끝나는가", !끝난뒤.진행중 && 끝난뒤.로봇체력 === 0, 끝난뒤);
검사("끝나면 결과 화면이 나오는가", await page.locator("#overlay").isVisible());

// 다시 시작하면 체력이 돌아와야 합니다
await page.locator("#startBtn").click();
await page.waitForTimeout(250);
검사("다시 시작하면 체력이 세 칸으로 돌아오는가", (await 상태()).로봇체력 === 3, await 상태());
검사("하트 표시도 되돌아오는가",
  (await page.locator("#hearts").textContent()) === "♥♥♥");

// 보스가 쏘는 것도 한 발에 한 칸이어야 합니다
await 새판();
await 장애물_치우기();
await page.evaluate(() => { 설정.보스_공격간격 = 45; });
await page.evaluate(() => window.보스시험(9));   // 미사일을 넉넉히 줘서 보스가 안 물러가게
let 보스탄에_맞음 = false;
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(80);
  const st = await 상태();
  if (st.로봇체력 === 2) { 보스탄에_맞음 = true; break; }
  if (!st.진행중) break;
}
검사("보스가 쏜 것에 맞으면 한 칸만 줄어드는가", 보스탄에_맞음, await 상태());


/* ==========================================================
   7) 아이템과 보스
   ------------------------------------------------------------
   달리다가 파란 아이템을 모으면 미사일이 되고,
   정해진 점수를 넘길 때 미사일이 넉넉하면 보스가 찾아옵니다.

   실제로 점수 300 을 넘길 때까지 기다리면 검사 한 번에 몇 분이 걸립니다.
   그래서 game.js 가 열어둔 보스시험() 으로 바로 불러서 확인합니다.
   '스스로 나타나는지' 는 아래 마지막 항목에서 문턱을 낮춰 따로 봅니다.
   ========================================================== */
const 발사누르기 = () => page.evaluate(() =>
  document.getElementById("fireBtn").dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true })));

await 새판();

// --- 평소에는 보스 관련 화면이 안 보여야 합니다 ---
검사("처음에는 발사 버튼이 안 보이는가", !(await page.locator("#fireBtn").isVisible()));
검사("처음에는 미사일 개수가 안 보이는가", !(await page.locator("#ammoBox").isVisible()));

// --- 아이템이 길에 나타나는가 ---
// 확률을 1 로 두면 장애물이 나올 때마다 아이템이 함께 떠야 합니다
await page.evaluate(() => {
  설정.아이템_나올확률 = 1;
  설정.장애물_최소간격 = 200;
  설정.장애물_최대간격 = 220;
});
/*
  시작 직후에는 일부러 장애물이 없습니다 (화면폭의 0.9 만큼 여유를 둡니다).
  그래서 첫 장애물이 나오기까지 2초쯤 걸리고, 아이템은 그것과 함께 뜹니다.
*/
let 아이템떴나 = false;
for (let i = 0; i < 40 && !아이템떴나; i++) {
  await page.waitForTimeout(150);
  아이템떴나 = (await 상태()).아이템수 > 0;
}
검사("확률을 1 로 두면 길에 아이템이 뜨는가", 아이템떴나, await 상태());

/*
  --- 아이템을 먹으면 미사일이 늘어나는가 ---
  점프해서 먹기를 기다리면 장애물에 부딪혀 검사가 들쭉날쭉합니다.
  먹는 동작만 확인하면 되므로, 로봇 키 높이에 아이템을 하나 직접 놓아
  달려가다 자연스럽게 닿게 합니다.
*/
await 새판();
const 먹기전 = (await 상태()).가진미사일;
await page.evaluate(() => {
  장애물들 = [];                       // 이미 나와 있던 것을 치웁니다
  /*
    간격만 늘려서는 모자랍니다. 다음 장애물까지 세고 있던 값이 그대로 남아
    한 개가 더 나오고, 그것에 부딪혀 검사가 엉뚱하게 실패합니다.
    (실제로 그래서 한 번 헤맸습니다) 세고 있던 값도 같이 밀어둡니다.
  */
  설정.장애물_최소간격 = 100000;
  설정.장애물_최대간격 = 100000;
  다음장애물까지 = 100000;
  아이템들.push({ x: 화면폭 * 0.7, y: 땅위치 - 17, 먹힘: false, 흔들림: 0 });
});
await page.waitForTimeout(2500);
const 먹은뒤 = await 상태();
검사("아이템을 먹으면 미사일이 늘어나는가",
  먹은뒤.가진미사일 === 먹기전 + 1, [먹기전, 먹은뒤.가진미사일]);
검사("미사일을 모으면 화면에 개수가 나오는가", await page.locator("#ammoBox").isVisible());
검사("화면의 미사일 개수가 실제와 같은가",
  Number(await page.locator("#ammo").textContent()) === 먹은뒤.가진미사일);

// --- 보스를 불러서 싸워 이기기 ---
await 새판();
await page.evaluate(() => window.보스시험(6));
const 부른직후 = await 상태();
검사("보스가 나타나는가", 부른직후.보스있나, 부른직후);
검사("보스는 오른쪽에서 날아 들어오는가 (등장 단계)",
  부른직후.보스단계 === "등장", 부른직후.보스단계);
검사("보스 체력이 설정대로인가", 부른직후.보스체력 === 3, 부른직후.보스체력);

await page.waitForTimeout(1600);
/*
  이 구간에서는 보스가 쏘지 않게 해 둡니다.
  '미사일이 보스에게 통하는가' 만 보려는 것인데, 보스탄에 맞아 게임이 끝나면
  검사가 될 때도 있고 안 될 때도 있는 물건이 되어버립니다.
  보스가 실제로 쏘는지는 바로 아래에서 따로 확인합니다.
*/
await page.evaluate(() => {
  설정.보스_공격간격 = 100000;
  // 간격만 늘리면 부족합니다. 보스가 등장하자마자 쏴둔 탄 하나가 이미 날아오고
  // 있어서, 그것에 맞아 검사가 될 때도 있고 안 될 때도 있었습니다.
  보스탄들 = [];
  보스.공격까지 = 100000;
});
const 싸움중 = await 상태();
검사("잠시 뒤 싸움 단계로 넘어가는가", 싸움중.보스단계 === "싸움", 싸움중.보스단계);
검사("싸울 때 발사 버튼이 나타나는가", await page.locator("#fireBtn").isVisible());
검사("보스와 싸우는 동안에는 새 장애물이 안 나오는가",
  (await page.evaluate(() => {
    const 전 = window.게임상태().장애물수;
    return new Promise((r) => setTimeout(() => r(window.게임상태().장애물수 <= 전), 1200));
  })));

// 쏘면 미사일이 줄고, 맞히면 체력이 깎여야 합니다
const 쏘기전 = await 상태();
await 발사누르기();
await page.waitForTimeout(80);
검사("발사하면 미사일이 하나 줄어드는가",
  (await 상태()).가진미사일 === 쏘기전.가진미사일 - 1, await 상태());

/*
  한 발이 날아가 닿는 데 1초쯤 걸립니다.
  기다리지 않고 연달아 쏘면 '몇 발로 잡았나' 를 잘못 세게 됩니다.
*/
let 이겼나 = false, 쏜횟수 = 0;
for (let i = 0; i < 8; i++) {
  await 발사누르기();
  쏜횟수 += 1;
  await page.waitForTimeout(1400);
  const st = await 상태();
  if (!st.진행중) break;
  if (!st.보스있나 || st.보스체력 === 0) { 이겼나 = true; break; }
}
검사("계속 쏘면 보스를 쓰러뜨릴 수 있는가", 이겼나);
/*
  미사일이 잘 따라가는지 봅니다. 똑바로만 날아가던 때는 명중률이 33% 라
  아이템 3개를 모아도 이길 수가 없었습니다.
*/
검사("미사일이 보스를 잘 따라가는가 (체력 3을 4발 안에)",
  이겼나 && 쏜횟수 <= 4, 쏜횟수);
if (이겼나) {
  await page.waitForTimeout(900);
  const 이긴뒤 = await 상태();
  검사("보스를 이기면 점수를 받는가", 이긴뒤.점수 > 200, 이긴뒤.점수);
  검사("보스를 이기면 미사일이 비워지는가", 이긴뒤.가진미사일 === 0, 이긴뒤.가진미사일);
  검사("보스를 이기면 다음 보스 점수가 밀리는가",
    이긴뒤.다음보스점수 === 600, 이긴뒤.다음보스점수);
}

// --- 보스는 실제로 공격하는가 ---
await 새판();
await page.evaluate(() => { 설정.보스_공격간격 = 30; });   // 자주 쏘게 해서 빨리 확인
await page.evaluate(() => window.보스시험(6));
await page.waitForTimeout(2600);
const 쏘는중 = await 상태();
검사("보스가 공격을 쏘는가", 쏘는중.보스탄수 > 0 || !쏘는중.진행중, 쏘는중);

// --- 미사일이 떨어지면 보스가 물러가는가 ---
// 이게 없으면 이길 방법이 없는 채로 계속 피하기만 해야 합니다.
await 새판();
await page.evaluate(() => {
  설정.보스_공격간격 = 100000;        // 이 검사에서는 쏘지 않게 해서 죽지 않게 합니다
  설정.보스_기다려주는시간 = 60;      // 1초만 기다렸다 물러가도록
});
await page.evaluate(() => window.보스시험(0));   // 미사일 0개로 보스만 불러냄
await page.waitForTimeout(1400);
검사("보스가 아직 있는가 (물러가기 전)", (await 상태()).보스있나 !== null);
await page.waitForTimeout(2500);
const 물러간뒤 = await 상태();
검사("미사일이 없으면 보스가 스스로 물러가는가",
  !물러간뒤.보스있나 && 물러간뒤.진행중, 물러간뒤);
검사("보스가 물러가면 발사 버튼도 사라지는가", !(await page.locator("#fireBtn").isVisible()));

// --- 아이템이 모자라면 보스가 그냥 지나가는가 ---
await 새판();
await page.evaluate(() => { 설정.보스_나오는점수 = 20; 다음보스점수 = 20; });
await page.waitForTimeout(2200);
const 지나감 = await 상태();
검사("아이템이 모자라면 보스가 나오지 않는가", !지나감.보스있나, 지나감);
검사("그래도 다음 보스 차례는 예약되는가", 지나감.다음보스점수 > 20, 지나감.다음보스점수);

// --- 조건이 갖춰지면 스스로 나타나는가 ---
await 새판();
await page.evaluate(() => {
  장애물들 = [];
  // 부딪혀 죽는 일이 없게 합니다. 세고 있던 값까지 밀어야 한 개도 안 나옵니다.
  설정.장애물_최소간격 = 100000;
  설정.장애물_최대간격 = 100000;
  다음장애물까지 = 100000;
  /*
    점수는 1초에 20점쯤 오릅니다. 문턱을 너무 높게 잡으면 검사가 몇 분씩 걸립니다.
    아이템 세 개를 다 먹는 데 2초쯤 걸리므로, 그보다 넉넉히 뒤인 150점으로 둡니다.
  */
  설정.보스_나오는점수 = 150;
  설정.보스_필요_아이템 = 3;
  다음보스점수 = 150;
  // 로봇 키 높이에 아이템 세 개를 나란히 놓아, 달려가며 차례로 먹게 합니다
  for (let i = 0; i < 3; i++) {
    아이템들.push({ x: 화면폭 * 0.6 + i * 110, y: 땅위치 - 17, 먹힘: false, 흔들림: 0 });
  }
});
let 스스로나옴 = false, 다모았나 = false;
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(120);
  const st = await 상태();
  if (st.가진미사일 >= 3) 다모았나 = true;
  if (st.보스있나) { 스스로나옴 = true; break; }
  if (!st.진행중) break;
}
검사("아이템 세 개를 모두 먹는가", 다모았나);
검사("아이템을 모으고 점수를 넘기면 보스가 스스로 나타나는가", 스스로나옴);

검사("게임 내내 자바스크립트 오류가 없는가", 오류들.length === 0, 오류들.slice(0,3));

console.log(실패===0 ? "\n🎉 게임이 정상 동작합니다" : `\n⚠️ ${실패}건 실패`);
await browser.close(); 서버.close();
process.exit(실패===0?0:1);
