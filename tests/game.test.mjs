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


/*
  3) 아무것도 안 하면 장애물에 부딪혀 끝나는가

  체력이 3칸이라 세 번 부딪혀야 끝납니다. 보통 7~8초쯤 걸립니다.

  ※ 성이 오지 않게 멀리 밀어둡니다.
     첫 성은 150점(약 8초)에 옵니다. 가만히 두면 죽는 시점과 거의 겹쳐서,
     운 나쁘면 죽기 직전에 성 앞에 멈춰 서 버립니다. 멈춰 선 동안에는
     게임이 얼어 있으니 13초를 기다려도 끝나지 않습니다.
     (실제로 세 번에 한 번꼴로 이 검사가 실패했습니다)
     성은 아래에서 따로 봅니다.
*/
await page.evaluate(() => { 다음성점수 = Infinity; });
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
   6-1) 속도는 스테이지 안에서 변하지 않는가
   ------------------------------------------------------------
   예전에는 시간이 흐를수록 계속 빨라졌습니다. 20초면 최고 속도에 닿을 만큼
   가팔랐습니다. 지금은 보스를 이겼을 때만 빨라집니다.

   '시간이 지나도 그대로인가' 는 눈으로는 알기 어렵습니다.
   빨라지는 코드를 실수로 되살려도 화면만 봐서는 잘 모릅니다.
   그래서 숫자를 직접 재둡니다.
   ========================================================== */
{
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await page.waitForTimeout(250);
  const 잰것 = () => page.evaluate(() => window.게임상태());

  const 처음 = await 잰것();
  검사("시작 속도가 설정값과 같은가",
    처음.속도 === (await page.evaluate(() => 설정.시작_속도)), 처음.속도);
  검사("처음에는 스테이지 1 인가", 처음.스테이지 === 1, 처음.스테이지);

  // 부딪혀 끝나지 않도록 장애물을 치우고 시간을 흘려봅니다
  await page.evaluate(() => {
    장애물들 = [];
    설정.장애물_최소간격 = 100000;
    설정.장애물_최대간격 = 100000;
    다음장애물까지 = 100000;
  });
  await page.waitForTimeout(6000);
  const 나중 = await 잰것();
  검사("6초가 지나도 속도가 그대로인가", 나중.속도 === 처음.속도, [처음.속도, 나중.속도]);
  검사("그동안 스테이지도 그대로인가", 나중.스테이지 === 1, 나중.스테이지);
  검사("그래도 점수는 올라가는가", 나중.점수 > 처음.점수, [처음.점수, 나중.점수]);
}


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
await page.evaluate(() => { 설정.보스_공격간격 = 45; 설정.보스_최소공격간격 = 20; });
await page.evaluate(() => window.보스시험());   // 미사일을 넉넉히 줘서 보스가 안 물러가게
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
   아이템은 세 가지(강화·무적·회복)가 비율대로 나오고, 먹으면 바로 효과가 납니다.
   보스는 아이템과 상관없이 정해진 점수를 넘길 때마다 저절로 찾아옵니다.

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
검사("처음에는 걸린 효과 표시가 안 보이는가", !(await page.locator("#buffBox").isVisible()));

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

/* --- 아이템 세 가지가 비율대로 나오는가 --- */
const 뽑은것 = await page.evaluate(() => {
  const 셈 = { 강화: 0, 무적: 0, 회복: 0 };
  for (let i = 0; i < 3000; i++) 셈[아이템_종류_뽑기()] += 1;
  return 셈;
});
검사("세 가지 아이템이 모두 나오는가",
  뽑은것.강화 > 0 && 뽑은것.무적 > 0 && 뽑은것.회복 > 0, 뽑은것);
검사("비율대로 나오는가 (강화 > 회복 > 무적)",
  뽑은것.강화 > 뽑은것.회복 && 뽑은것.회복 > 뽑은것.무적, 뽑은것);

/*
  --- 높은 아이템은 두 번 점프해야 닿는 자리인가 ---
  한 번 점프로 닿는다면 '두 번 점프' 라는 이름이 무색해지고,
  두 번으로도 못 닿으면 영영 먹을 수 없는 아이템이 됩니다.
  점프 높이를 계산해서 그 사이에 있는지 확인합니다.
*/
const 높이 = await page.evaluate(() => {
  const 한번 = (설정.점프_힘 ** 2) / (2 * 설정.중력);
  const 로봇중심 = 땅위치 - 로봇.높이 / 2;
  const 먹는거리 = 26;
  아이템들 = [];
  아이템_하나_만들기(화면폭, true);      // 높은 것 하나
  아이템_하나_만들기(화면폭, false);     // 보통 것 하나
  const [높은것, 보통것] = 아이템들;
  return {
    한번점프_닿는y: 로봇중심 - 한번 - 먹는거리,
    두번점프_닿는y: 로봇중심 - 한번 * 2 - 먹는거리,
    높은것y: 높은것.y,
    보통것y: 보통것.y,
  };
});
// 캔버스는 y 가 작을수록 위입니다
검사("보통 아이템은 한 번 점프로 닿는가",
  높이.보통것y > 높이.한번점프_닿는y, 높이);
검사("높은 아이템은 한 번 점프로는 못 닿는가",
  높이.높은것y < 높이.한번점프_닿는y, 높이);
검사("높은 아이템도 두 번 점프면 닿는가",
  높이.높은것y > 높이.두번점프_닿는y, 높이);

/*
  --- 세 가지 효과가 제대로 걸리는가 ---
  먹는 동작(달려가서 닿기)은 위에서 확인했으니, 여기서는 효과만 봅니다.
*/
await 새판();
await 장애물_치우기();
const 강화효과 = await page.evaluate(() => {
  강화남음 = 0;
  아이템_먹었을때({ x: 100, y: 100, 종류: "강화" });
  return { 강화남음: Math.round(강화남음), 설정값: 설정.강화_시간 };
});
검사("강화를 먹으면 강화 시간이 걸리는가",
  강화효과.강화남음 === 강화효과.설정값, 강화효과);
검사("강화가 걸리면 화면에 표시되는가", await page.locator("#buffBox").isVisible());
검사("표시에 '강화' 라고 나오는가",
  (await page.locator("#buffs").textContent()).includes("강화"),
  await page.locator("#buffs").textContent());

/* ----------------------------------------------------------
   강화는 보스전까지 품고 갑니다
   ------------------------------------------------------------
   미사일은 보스와 싸울 때만 쏠 수 있는데, 예전에는 강화 시간이
   달리는 동안에도 흘렀습니다. 그래서 길에서 주운 강화는 보스가
   오기도 전에 다 녹아서 쓸 일이 없었습니다.
   ---------------------------------------------------------- */
await page.evaluate(() => { 강화남음 = 설정.강화_시간; });
const 달리기전 = (await 상태()).강화남음;
await page.waitForTimeout(1500);
const 달린뒤강화 = (await 상태()).강화남음;
검사("달리는 동안에는 강화가 줄지 않는가", 달린뒤강화 === 달리기전,
  [달리기전, 달린뒤강화]);
검사("품고 있는 동안에는 '보관' 이라고 알려주는가",
  (await page.locator("#buffs").textContent()).includes("보관"),
  await page.locator("#buffs").textContent());

// 보스가 날아 들어오는 동안(등장)에도 아직 줄지 않아야 합니다
await page.evaluate(() => {
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
  window.보스시험();
});
const 등장때 = (await 상태()).강화남음;
검사("보스가 날아 들어오는 동안에도 줄지 않는가", 등장때 === 달리기전,
  [달리기전, 등장때]);

// 싸움이 시작되면 그때부터 흘러갑니다
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(100);
  if ((await 상태()).보스단계 === "싸움") break;
}
const 싸움시작 = (await 상태()).강화남음;
await page.waitForTimeout(1200);
const 싸운뒤 = (await 상태()).강화남음;
검사("보스와 싸우기 시작하면 강화가 흐르는가", 싸운뒤 < 싸움시작,
  [싸움시작, 싸운뒤]);
검사("싸울 때는 '보관' 글자가 사라지는가",
  !(await page.locator("#buffs").textContent()).includes("보관"),
  await page.locator("#buffs").textContent());

/* 길에서 주운 강화가 실제로 보스에게 통하는가 — 처음부터 끝까지 */
await 새판();
await 장애물_치우기();
const 끝까지 = await page.evaluate(async () => {
  강화남음 = 0;
  아이템_먹었을때({ x: 100, y: 100, 종류: "강화" });   // 달리는 중에 주움
  const 주운직후 = Math.round(강화남음);
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
  window.보스시험();
  보스.단계 = "싸움";
  미사일들 = []; 재장전남음 = 0;
  발사하기();
  return {
    주운직후,
    쏜위력: 미사일들[0] ? 미사일들[0].위력 : null,
    기본위력: 설정.무기들.기본.위력,
    배수: 설정.강화_배수,
  };
});
검사("길에서 주운 강화가 보스전까지 남아 있는가",
  끝까지.주운직후 === await page.evaluate(() => 설정.강화_시간), 끝까지);
검사("보스전에서 그 강화가 실제로 통하는가",
  끝까지.쏜위력 === 끝까지.기본위력 * 끝까지.배수, 끝까지);

const 무적효과 = await page.evaluate(() => {
  로봇.무적 = 0;
  아이템_먹었을때({ x: 100, y: 100, 종류: "무적" });
  return { 무적: Math.round(로봇.무적), 설정값: 설정.무적아이템_시간 };
});
검사("무적을 먹으면 무적이 걸리는가",
  무적효과.무적 === 무적효과.설정값, 무적효과);
검사("표시에 '무적' 이라고 나오는가",
  (await page.locator("#buffs").textContent()).includes("무적"),
  await page.locator("#buffs").textContent());

const 회복효과 = await page.evaluate(() => {
  로봇.체력 = 1; 하트_그리기();
  아이템_먹었을때({ x: 100, y: 100, 종류: "회복" });
  return 로봇.체력;
});
검사("회복을 먹으면 체력이 는가", 회복효과 === 2, 회복효과);
검사("하트 표시도 함께 느는가",
  (await page.locator("#hearts").textContent()) === "♥♥♡",
  await page.locator("#hearts").textContent());

// 체력이 가득일 때 먹으면 점수로 바꿔줘야 합니다 (아니면 먹어도 헛일입니다)
const 가득할때 = await page.evaluate(() => {
  로봇.체력 = 설정.로봇_체력; 하트_그리기();
  const 전 = 점수;
  아이템_먹었을때({ x: 100, y: 100, 종류: "회복" });
  return { 오른점수: Math.round(점수 - 전), 설정값: 설정.회복_가득할때_점수, 체력: 로봇.체력 };
});
검사("체력이 가득이면 회복 대신 점수를 주는가",
  가득할때.오른점수 === 가득할때.설정값, 가득할때);
검사("체력이 가득이면 그 이상 늘지 않는가",
  가득할때.체력 === 3, 가득할때.체력);

/* --- 미사일은 무한하되 채우는 시간이 있는가 --- */
await 새판();
await 장애물_치우기();
await page.evaluate(() => {
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
  window.보스시험();
  보스.단계 = "싸움"; 보스.x = 보스.목표x; 상태표시_갱신();
});
await page.waitForTimeout(200);
const 한발 = await page.evaluate(() => {
  const 전 = 미사일들.length; 발사하기();
  return { 나갔나: 미사일들.length > 전, 재장전: Math.round(재장전남음) };
});
검사("아이템 없이도 미사일을 쏠 수 있는가", 한발.나갔나, 한발);
검사("쏘면 채우는 시간이 생기는가", 한발.재장전 > 0, 한발);
const 바로또 = await page.evaluate(() => {
  const 전 = 미사일들.length; 발사하기();
  return 미사일들.length > 전;
});
검사("채우는 중에는 안 나가는가", !바로또);
await page.waitForTimeout(900);
const 기다린뒤 = await page.evaluate(() => {
  const 전 = 미사일들.length; 발사하기();
  return 미사일들.length > 전;
});
검사("다 채우면 다시 나가는가", 기다린뒤);

// 강화 중에는 한 발이 두 배로 세야 합니다
const 강화탄 = await page.evaluate(() => {
  미사일들 = []; 재장전남음 = 0; 강화남음 = 600;
  발사하기();
  const 센것 = 미사일들[0] ? 미사일들[0].위력 : null;
  미사일들 = []; 재장전남음 = 0; 강화남음 = 0;
  발사하기();
  const 보통것 = 미사일들[0] ? 미사일들[0].위력 : null;
  return { 센것, 보통것, 배수: 설정.강화_배수, 기본위력: 설정.무기들.기본.위력 };
});
검사("강화 중에 쏜 미사일이 더 센가",
  강화탄.센것 === 강화탄.기본위력 * 강화탄.배수 && 강화탄.보통것 === 강화탄.기본위력,
  강화탄);

// --- 보스를 불러서 싸워 이기기 ---
await 새판();
await page.evaluate(() => window.보스시험());
const 부른직후 = await 상태();
검사("보스가 나타나는가", 부른직후.보스있나, 부른직후);
검사("보스는 오른쪽에서 날아 들어오는가 (등장 단계)",
  부른직후.보스단계 === "등장", 부른직후.보스단계);
검사("스테이지 1 보스 체력이 설정대로인가",
  부른직후.보스체력 === (await page.evaluate(() => 설정.보스_기본체력)),
  부른직후.보스체력);

await page.waitForTimeout(1600);
/*
  이 구간에서는 보스가 쏘지 않게 해 둡니다.
  '미사일이 보스에게 통하는가' 만 보려는 것인데, 보스탄에 맞아 게임이 끝나면
  검사가 될 때도 있고 안 될 때도 있는 물건이 되어버립니다.
  보스가 실제로 쏘는지는 바로 아래에서 따로 확인합니다.
*/
await page.evaluate(() => {
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
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

/*
  한 발이 날아가 닿는 데 1초쯤 걸립니다.
  기다리지 않고 연달아 쏘면 '몇 발로 잡았나' 를 잘못 세게 됩니다.

  ※ '보스가 사라졌나' 로 이겼는지 판단하면 안 됩니다.
     쓰러뜨려도 보스는 곧바로 없어지지 않고 화면 밖으로 날아 나갑니다.
     그동안에는 여전히 '보스가 있는' 상태입니다. 스테이지가 올랐는지로 봅니다.
     (이것 때문에 한 번 '안 죽는다' 고 잘못 짚었습니다)
*/
let 이겼나 = false, 쏜횟수 = 0;
for (let i = 0; i < 8; i++) {
  await 발사누르기();
  쏜횟수 += 1;
  await page.waitForTimeout(1400);
  const st = await 상태();
  if (!st.진행중) break;
  if (st.스테이지 > 1) { 이겼나 = true; break; }
}
검사("계속 쏘면 보스를 쓰러뜨릴 수 있는가", 이겼나);
/*
  미사일이 잘 따라가는지 봅니다. 똑바로만 날아가던 때는 명중률이 33% 라
  스테이지 1 보스도 잡기 어려웠습니다.

  '체력 + 1발' 안에 잡혀야 합니다. 빗나간 발이 한 발을 넘으면
  유도가 제대로 안 듣는다는 뜻입니다. (체력은 설정에서 읽어옵니다 —
  숫자를 바꿀 때마다 검사를 같이 고치지 않아도 되도록)
*/
const 스테이지1체력 = await page.evaluate(() => 설정.보스_기본체력);
검사(`미사일이 보스를 잘 따라가는가 (체력 ${스테이지1체력}을 ${스테이지1체력 + 1}발 안에)`,
  이겼나 && 쏜횟수 <= 스테이지1체력 + 1, { 쏜횟수, 스테이지1체력 });
if (이겼나) {
  await page.waitForTimeout(900);
  const 이긴뒤 = await 상태();
  검사("보스를 이기면 점수를 받는가", 이긴뒤.점수 > 200, 이긴뒤.점수);
  // 스테이지가 오르는 것은 '보스를 이겼을 때' 뿐입니다
  검사("보스를 이기면 스테이지가 오르는가", 이긴뒤.스테이지 === 2, 이긴뒤.스테이지);
  검사("스테이지가 오르면 속도가 빨라지는가",
    이긴뒤.속도 > 싸움중.속도, [싸움중.속도, 이긴뒤.속도]);
  const 기대속도 = await page.evaluate(() =>
    설정.시작_속도 + 설정.스테이지마다_빨라짐);
  검사("빨라진 만큼이 설정과 맞는가",
    Math.abs(이긴뒤.속도 - 기대속도) < 0.01, [이긴뒤.속도, 기대속도]);
  검사("보스를 이기면 다음 보스 차례가 밀리는가",
    이긴뒤.다음보스점수 > 300, 이긴뒤.다음보스점수);
}

/* ==========================================================
   보스 → 장애물 구간 → 보스 → ... 로 번갈아 가는가
   ------------------------------------------------------------
   실제로 하다 보면 1단계 보스를 잡은 뒤부터 보스만 계속 나왔습니다.

   원인은 문턱을 올리는 방식이었습니다. 보스가 나올 때 문턱에
   보스_나오는점수(300)를 더했는데, 격파 보상은 스테이지마다
   100점씩 커집니다.

     600점 → 2보스, 문턱 900.  격파 +300 → 900  (문턱에 딱 닿음)
     900점 → 3보스, 문턱 1200. 격파 +400 → 1300 (이미 넘어버림)

   그래서 3단계부터는 잡자마자 다음 보스가 나왔습니다.
   지금은 보상을 받은 '뒤' 의 점수에서 다시 셉니다.

   세 판을 내리 돌면서, 매번 보스 사이에 달리는 구간이
   실제로 들어가는지 봅니다.
   ========================================================== */
await 새판();
await page.evaluate(() => {
  다음보스점수 = 60;
  설정.보스_나오는점수 = 60;
  설정.보스_기본체력 = 1;         // 한 발에 잡히게 해서 검사를 짧게
  설정.보스_체력_증가 = 0;
  설정.보스_공격간격 = 100000;    // 보스탄에 맞아 끝나지 않게
  설정.보스_최소공격간격 = 100000;
  로봇.무적 = 1e9;                // 장애물에도 안 죽게
  /*
    성은 여기서 오지 않게 멀리 밀어둡니다.
    성 앞에 서면 게임이 멈춘 채 고르기를 기다리므로, 보스가 언제 오는지를
    재는 이 검사에서는 방해가 됩니다. 성은 아래에서 따로 봅니다.
  */
  설정.성_나오는_비율 = 99;
  다음성점수 = Infinity;
});

const 구간기록 = [];
for (let 단계 = 1; 단계 <= 3; 단계 += 1) {
  // 문턱 코앞까지 점수를 밀어 놓고, 보스가 '스스로' 오기를 기다립니다
  await page.evaluate(() => window.점수시험(다음보스점수 - 3));

  let 보스왔나 = false;
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(100);
    if ((await 상태()).보스단계 === "싸움") { 보스왔나 = true; break; }
  }
  검사(`${단계}단계 — 달리다 보면 보스가 찾아오는가`, 보스왔나);
  if (!보스왔나) break;

  // 한 발로 잡습니다
  let 잡았나 = false;
  for (let i = 0; i < 6 && !잡았나; i += 1) {
    await 발사누르기();
    for (let j = 0; j < 14; j += 1) {
      await page.waitForTimeout(100);
      if ((await 상태()).스테이지 > 단계) { 잡았나 = true; break; }
    }
  }
  검사(`${단계}단계 — 보스를 쓰러뜨렸는가`, 잡았나);
  if (!잡았나) break;

  // 보스가 화면 밖으로 나갈 때까지 기다립니다
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(100);
    if (!(await 상태()).보스있나) break;
  }

  const 나간직후 = await 상태();
  await page.waitForTimeout(1500);      // 1.5초쯤 달려봅니다
  const 달린뒤 = await 상태();

  구간기록.push({
    단계,
    남은점수: Math.round(나간직후.다음보스점수 - 나간직후.점수),
    보스없었나: !나간직후.보스있나 && !달린뒤.보스있나,
    장애물수: 달린뒤.장애물수,
  });
}

for (const ㄱ of 구간기록) {
  검사(`${ㄱ.단계}단계 뒤 — 보스가 바로 다시 나오지 않는가`, ㄱ.보스없었나, ㄱ);
  /*
    60점짜리 문턱이니 잡은 직후에는 55점 안팎이 남아 있어야 합니다.
    0 이하라면 이미 문턱을 넘었다는 뜻 — 보스가 곧장 또 옵니다.
  */
  검사(`${ㄱ.단계}단계 뒤 — 다음 보스까지 달릴 거리가 남는가`, ㄱ.남은점수 > 30, ㄱ);
  검사(`${ㄱ.단계}단계 뒤 — 장애물이 다시 나오는가`, ㄱ.장애물수 > 0, ㄱ);
}
검사("세 판을 내리 돌 수 있는가", 구간기록.length === 3, 구간기록.length);

/* ==========================================================
   성과 마법사 — 무기 업그레이드
   ------------------------------------------------------------
   보스와 보스 사이에 성이 다가오고, 로봇이 그 앞에 멈춰 서면
   마법사가 무기 몇 가지를 내어줍니다. 하나를 고르면 그 무기가 되고,
   한 번이라도 다치면 기본 미사일로 돌아옵니다.

   '다치면 잃는다' 가 이 기능의 핵심입니다. 그것만 확인하고 넘어가면
   안 되고, 멈추는 것 · 고르는 동안 게임이 정말 멈추는 것 ·
   고르고 나면 다시 달리는 것까지 봐야 합니다.
   ========================================================== */
const 성앞에서기 = async () => {
  await page.evaluate(() => { window.성시험(); });
  for (let i = 0; i < 60; i += 1) {
    await page.waitForTimeout(100);
    if ((await 상태()).고르는중) return true;
  }
  return false;
};

await 새판();
await 장애물_치우기();
const 성왔나 = await 성앞에서기();
검사("성 앞에 멈춰 서는가", 성왔나, await 상태());

const 성앞 = await 상태();
검사("마법사 화면이 뜨는가", 성앞.상점보이나, 성앞);
검사("고를 것이 여러 개 나오는가", 성앞.선택지수 >= 2, 성앞.선택지수);
검사("설정한 개수만큼 나오는가",
  성앞.선택지수 === await page.evaluate(() => 설정.고를_무기_개수), 성앞.선택지수);
검사("멈춰 선 동안에는 땅에 있는가", !성앞.공중에있나, 성앞);

/*
  고르는 동안에는 게임이 통째로 멈춰야 합니다.
  점수가 오르거나 장애물이 다가오면, 읽고 고르는 사이에 죽습니다.
*/
const 멈춤전 = await 상태();
await page.waitForTimeout(1200);
const 멈춤후 = await 상태();
검사("고르는 동안 점수가 오르지 않는가", 멈춤전.점수 === 멈춤후.점수,
  [멈춤전.점수, 멈춤후.점수]);
검사("고르는 동안 로봇이 제자리에 있는가", 멈춤전.로봇y === 멈춤후.로봇y,
  [멈춤전.로봇y, 멈춤후.로봇y]);
검사("고르는 동안 눌러도 점프하지 않는가", await page.evaluate(() => {
  const 전 = 로봇.y;
  점프하기();
  return 로봇.y === 전 && 로봇.세로속도 === 0;
}));

// 기본 미사일은 어느 업그레이드보다 약해서 후보에 넣지 않습니다
검사("고를 것에 '기본' 은 없는가", await page.evaluate(() =>
  [...document.querySelectorAll(".weapon-card")].every((카드) => 카드.dataset.무기 !== "기본")));

// --- 골라 보기 ---
const 고른이름 = await page.evaluate(() =>
  document.querySelector(".weapon-card").dataset.무기);
await page.locator(".weapon-card").first().click();
await page.waitForTimeout(250);
const 고른뒤 = await 상태();
검사("고르면 그 무기로 바뀌는가", 고른뒤.무기 === 고른이름, [고른이름, 고른뒤.무기]);
검사("고르면 마법사 화면이 닫히는가", !고른뒤.상점보이나, 고른뒤);
검사("고른 무기가 기본보다 센가", 고른뒤.무기위력 >= 1 && 고른뒤.무기 !== "기본", 고른뒤);
검사("고르면 화면 위에 무기가 보이는가",
  (await page.locator("#buffs").textContent()).includes(고른이름),
  await page.locator("#buffs").textContent());

// 고르고 나면 성이 지나가고 다시 달립니다
for (let i = 0; i < 60; i += 1) {
  await page.waitForTimeout(100);
  if (!(await 상태()).성있나) break;
}
const 지나간뒤 = await 상태();
검사("성이 지나가는가", !지나간뒤.성있나, 지나간뒤);
await page.waitForTimeout(800);
검사("성이 지나가면 다시 점수가 오르는가",
  (await 상태()).점수 > 지나간뒤.점수, [지나간뒤.점수, (await 상태()).점수]);

/*
  ★ 이 기능의 핵심 — 한 번이라도 다치면 무기를 잃습니다.
    장애물에 닿든 보스탄에 맞든 똑같습니다.
*/
const 다친뒤 = await page.evaluate(() => {
  const 맞기전 = 무기;
  로봇.무적 = 0;
  로봇_맞음();
  return { 맞기전, 맞은뒤: 무기, 체력: 로봇.체력 };
});
검사("다치기 전에는 업그레이드 무기를 들고 있었는가", 다친뒤.맞기전 !== "기본", 다친뒤);
검사("한 번 다치면 무기가 기본으로 돌아오는가", 다친뒤.맞은뒤 === "기본", 다친뒤);
검사("무기를 잃어도 체력은 한 칸만 주는가", 다친뒤.체력 === 2, 다친뒤);
/*
  ※ 버프상자 자체는 사라지지 않습니다. 맞은 직후에는 잠깐 무적이라
     "무적 2초" 가 대신 들어가 있기 때문입니다.
     사라져야 하는 것은 '무기 이름' 쪽입니다.
*/
검사("무기를 잃으면 화면 위 무기 표시도 사라지는가",
  !(await page.locator("#buffs").textContent()).includes(고른이름),
  await page.locator("#buffs").textContent());

// 깜빡이는 동안(무적)에는 다치지 않으니 무기도 지킵니다
const 무적일때 = await page.evaluate(() => {
  window.무기시험("폭탄");
  로봇.무적 = 60;
  로봇_맞음();
  return { 무기, 체력: 로봇.체력 };
});
검사("깜빡이는 동안에는 무기를 잃지 않는가", 무적일때.무기 === "폭탄", 무적일때);

/*
  무기마다 위력과 채우는 시간이 다른가.
  표(설정.무기들)에 적힌 대로 실제로 나가는지 봅니다.
*/
/*
  ※ 미사일은 보스와 싸울 때만 나갑니다.
     그래서 보스를 부르고, 날아 들어오는 것을 기다리지 않고
     곧바로 '싸움' 단계로 바꿔 놓은 뒤에 재봅니다.
*/
const 무기별 = await page.evaluate(() => {
  window.보스시험();
  보스.단계 = "싸움";
  const 잰것 = [];
  for (const 이름 of Object.keys(설정.무기들)) {
    window.무기시험(이름);
    미사일들 = []; 재장전남음 = 0; 강화남음 = 0;
    발사하기();
    잰것.push({
      이름,
      발수: 미사일들.length,
      위력: 미사일들[0] ? 미사일들[0].위력 : null,
      재장전: Math.round(재장전남음),
      적힌발수: 설정.무기들[이름].발수,
      적힌위력: 설정.무기들[이름].위력,
      적힌재장전: 설정.무기들[이름].재장전,
    });
  }
  window.무기시험("기본");
  return 잰것;
});
for (const ㅁ of 무기별) {
  검사(`${ㅁ.이름} — 적힌 발수대로 나가는가`, ㅁ.발수 === ㅁ.적힌발수, ㅁ);
  검사(`${ㅁ.이름} — 적힌 위력대로 나가는가`, ㅁ.위력 === ㅁ.적힌위력, ㅁ);
  검사(`${ㅁ.이름} — 적힌 대로 채우는가`, ㅁ.재장전 === ㅁ.적힌재장전, ㅁ);
}
검사("흩어쏘기는 한 번에 여러 발이 나가는가",
  무기별.find((ㅁ) => ㅁ.이름 === "흩어쏘기").발수 === 3, 무기별);
/*
  퍼져 나가는지 — 세 발의 방향이 서로 달라야 합니다.
  같은 방향으로 세 발이 겹쳐 나가면 부챗살이 아닙니다.
*/
검사("흩어쏘기 세 발이 서로 다른 방향인가", await page.evaluate(() => {
  if (!보스) { window.보스시험(); }
  보스.단계 = "싸움";
  window.무기시험("흩어쏘기");
  미사일들 = []; 재장전남음 = 0;
  발사하기();
  const 각들 = 미사일들.map((ㅁ) => Math.atan2(ㅁ.vy, ㅁ.vx));
  window.무기시험("기본");
  return new Set(각들.map((ㄱ) => ㄱ.toFixed(3))).size === 3;
}));

/*
  성과 보스가 겹치면 안 됩니다 — 화면이 어수선하고, 멈춰 선 채로
  보스탄을 맞게 됩니다. 보스를 불러놓고 '성이 올 때가 되었다' 고
  해둔 다음, 정말 안 오는지 봅니다.
*/
await 새판();
await 장애물_치우기();
await page.evaluate(() => {
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
  window.보스시험();
  다음성점수 = 0;          // 당장 올 때가 되었다고 해둡니다
});
await page.waitForTimeout(1500);
const 보스중 = await 상태();
검사("보스와 싸우는 동안에는 성이 오지 않는가",
  보스중.보스있나 && !보스중.성있나, 보스중);

/*
  실제 순서대로 — 보스를 잡으면 다음 보스까지 가는 길 한가운데에
  성이 오는가.

  위의 '보스 주기' 검사에서는 성을 멀리 밀어두고 봤기 때문에,
  성이 정말 보스와 보스 사이에 끼어드는지는 여기서 확인합니다.
*/
await 새판();
await 장애물_치우기();
await page.evaluate(() => {
  설정.보스_나오는점수 = 60;
  설정.보스_기본체력 = 1;
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
  로봇.무적 = 1e9;
  다음보스점수 = 60;
  다음성점수 = Infinity;        // 첫 보스까지는 성 없이 갑니다
});
// 첫 보스를 불러 잡습니다
await page.evaluate(() => { window.점수시험(58); });
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(100);
  if ((await 상태()).보스단계 === "싸움") break;
}
for (let i = 0; i < 8 && (await 상태()).스테이지 === 1; i += 1) {
  await 발사누르기();
  await page.waitForTimeout(400);
}
const 잡은뒤 = await 상태();
검사("(준비) 첫 보스를 잡았는가", 잡은뒤.스테이지 === 2, 잡은뒤);
검사("보스를 잡으면 다음 성 자리가 정해지는가",
  Number.isFinite(잡은뒤.다음성점수) && 잡은뒤.다음성점수 > 잡은뒤.점수, 잡은뒤);
검사("성은 다음 보스보다 먼저 오는가",
  잡은뒤.다음성점수 < 잡은뒤.다음보스점수,
  [잡은뒤.다음성점수, 잡은뒤.다음보스점수]);

/*
  달리다 보면 성이 먼저 나와야 합니다.

  ※ 먼저 '쓰러뜨린 보스가 화면 밖으로 다 나갈 때까지' 기다려야 합니다.
     퇴장하는 동안에도 보스있나 는 참이라서, 곧바로 재면
     방금 잡은 그 보스를 '먼저 온 것' 으로 세어버립니다.
*/
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(100);
  if (!(await 상태()).보스있나) break;
}
let 먼저온것 = null;
for (let i = 0; i < 90; i += 1) {
  await page.waitForTimeout(100);
  const st = await 상태();
  if (st.성있나) { 먼저온것 = "성"; break; }
  if (st.보스있나) { 먼저온것 = "보스"; break; }
  if (!st.진행중) break;
}
검사("보스를 잡고 달리면 성이 먼저 나오는가", 먼저온것 === "성", 먼저온것);

// --- 보스는 실제로 공격하는가 ---
await 새판();
await page.evaluate(() => { 설정.보스_공격간격 = 30; 설정.보스_최소공격간격 = 20; });   // 자주 쏘게 해서 빨리 확인
await page.evaluate(() => window.보스시험());
await page.waitForTimeout(2600);
const 쏘는중 = await 상태();
검사("보스가 공격을 쏘는가", 쏘는중.보스탄수 > 0 || !쏘는중.진행중, 쏘는중);

/* --- 점수만 넘기면 아이템 없이도 보스가 오는가 ---
   예전에는 아이템을 모아야 보스가 나왔습니다. 안 모으면 영영 안 나와서
   스테이지도 오르지 않았습니다. 지금은 반드시 찾아옵니다. */
await 새판();
await 장애물_치우기();
await page.evaluate(() => {
  설정.보스_나오는점수 = 80;
  다음보스점수 = 80;
  설정.보스_공격간격 = 100000; 설정.보스_최소공격간격 = 100000;
});
let 저절로왔나 = false;
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(120);
  const st = await 상태();
  if (st.보스있나) { 저절로왔나 = true; break; }
  if (!st.진행중) break;
}
검사("아이템을 하나도 안 먹어도 점수를 넘기면 보스가 오는가", 저절로왔나, await 상태());
// 날아 들어오는 동안(등장)에는 아직 안 나옵니다. 싸움 단계가 되어야 나옵니다.
await page.waitForTimeout(1800);
검사("보스가 자리를 잡으면 발사 버튼이 나오는가",
  await page.locator("#fireBtn").isVisible(), await 상태());

/* ==========================================================
   7-1) 스테이지가 오를수록 보스가 세지는가
   ------------------------------------------------------------
   체력이 늘고, 더 자주·더 빠르게 쏘고, 몸집도 커져야 합니다.
   숫자가 실제로 올라가는지, 그리고 아무리 올라가도 상한을 넘지 않는지를 봅니다.
   (상한이 없으면 열 스테이지쯤 가서 보스가 화면을 다 가립니다)
   ========================================================== */
{
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await page.waitForTimeout(200);

  const 스테이지_재기 = (단계) => page.evaluate((단계) => {
    스테이지 = 단계;
    const 치장 = 보스_치장();
    return {
      속도: 스테이지_속도(),
      체력: 이번보스_체력(),
      간격: 이번보스_공격간격(),
      탄속도: 이번보스탄_속도(),
      점수: 이번보스_점수(),
      폭: 치장.폭,
      뿔: 치장.뿔개수,
      눈: 치장.눈개수,
      빛: 치장.빛나나,
    };
  }, 단계);

  const 표 = [];
  for (let 단계 = 1; 단계 <= 8; 단계++) 표.push(await 스테이지_재기(단계));
  const [일, 이, 삼, , 오] = 표;

  검사("스테이지가 오르면 보스 체력이 는다", 이.체력 > 일.체력, [일.체력, 이.체력]);
  검사("스테이지가 오르면 더 자주 쏜다", 이.간격 < 일.간격, [일.간격, 이.간격]);
  검사("스테이지가 오르면 쏘는 것이 더 빠르다", 이.탄속도 > 일.탄속도, [일.탄속도, 이.탄속도]);
  검사("스테이지가 오르면 보상도 는다", 이.점수 > 일.점수, [일.점수, 이.점수]);
  검사("스테이지가 오르면 몸집이 커진다", 이.폭 > 일.폭, [일.폭, 이.폭]);
  검사("스테이지가 오르면 뿔이 늘어난다", 이.뿔 > 일.뿔, [일.뿔, 이.뿔]);
  검사("높은 스테이지에서는 눈이 늘어난다", 오.눈 > 일.눈, [일.눈, 오.눈]);
  검사("스테이지 3부터 빛이 감돈다", !일.빛 && 삼.빛, [일.빛, 삼.빛]);

  // 상한 — 끝없이 세지면 이길 수 없는 게임이 됩니다
  const 마지막 = 표[표.length - 1];
  const 상한 = await page.evaluate(() => ({
    체력: 설정.보스_최대체력, 속도: 설정.최대_속도, 간격: 설정.보스_최소공격간격,
  }));
  검사("체력은 상한을 넘지 않는다", 마지막.체력 <= 상한.체력, [마지막.체력, 상한.체력]);
  검사("속도는 상한을 넘지 않는다", 마지막.속도 <= 상한.속도, [마지막.속도, 상한.속도]);
  검사("공격간격은 하한 아래로 안 내려간다",
    마지막.간격 >= 상한.간격, [마지막.간격, 상한.간격]);
  검사("몸집도 어느 선에서 멈춘다", 표[7].폭 === 표[6].폭, [표[6].폭, 표[7].폭]);

  /*
    몸집이 커져도 오른쪽 아래 발사 버튼 뒤에 숨으면 안 됩니다.
    예전에 한 번 겪은 일이라, 커진 보스로 다시 확인합니다.
  */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await page.waitForTimeout(200);
  for (const 단계 of [1, 3, 6]) {
    const 겹치나 = await page.evaluate((단계) => {
      스테이지 = 단계; 보스 = null;
      장애물들 = []; 다음장애물까지 = 100000;
      보스_부르기();
      보스.단계 = "싸움"; 보스.x = 보스.목표x;
      상태표시_갱신();
      const 범위 = 보스_높이범위(보스.높이 / 2);
      const 버튼 = document.getElementById("fireBtn").getBoundingClientRect();
      const 배율 = 캔버스.getBoundingClientRect().width / 화면폭;
      const ㅂ = { 왼: 버튼.left / 배율, 오: 버튼.right / 배율, 위: 버튼.top / 배율 };
      // 보스가 가장 아래로 내려왔을 때를 기준으로 봅니다
      const ㅂㅅ = { 왼: 보스.x - 보스.폭 / 2, 오: 보스.x + 보스.폭 / 2,
                     아래: 범위.낮게 + 보스.높이 / 2 + 7 };
      return ㅂㅅ.왼 < ㅂ.오 && ㅂㅅ.오 > ㅂ.왼 && ㅂㅅ.아래 > ㅂ.위;
    }, 단계);
    검사(`스테이지 ${단계} 보스가 발사 버튼을 가리지 않는가`, !겹치나);
  }
  await page.setViewportSize({ width: 844, height: 390 });
}


/* ==========================================================
   7-2) 멈추고 이어서 하기
   ------------------------------------------------------------
   게임이 시작되면 화면을 가득 채우기 때문에, 예전에는 죽기 전까지
   빠져나올 방법이 없었습니다. 그만두려면 일부러 부딪혀야 했습니다.

   멈춘 동안 시간이 흐르면 안 되고, 이어서 할 때 로봇이 튀어도 안 됩니다.
   한 장면에 흐른 시간(dt)을 '지난번에 그린 시각' 으로 재기 때문에,
   시계를 다시 맞춰주지 않으면 멈춰 있던 시간이 한꺼번에 흘러
   로봇과 장애물이 화면 끝까지 날아갑니다. 그 부분도 함께 봅니다.
   ========================================================== */
{
  await page.reload({ waitUntil: "networkidle" });
  검사("시작 전에는 멈춤 버튼이 안 보이는가", !(await page.locator("#pauseBtn").isVisible()));

  await page.locator("#startBtn").click();
  await page.waitForTimeout(600);
  검사("게임 중에는 멈춤 버튼이 보이는가", await page.locator("#pauseBtn").isVisible());

  await page.locator("#pauseBtn").click();
  await page.waitForTimeout(250);
  const 멈춘뒤 = await 상태();
  검사("멈춤을 누르면 게임이 멈추는가", !멈춘뒤.진행중 && 멈춘뒤.멈춤중, 멈춘뒤);
  검사("멈추면 화면이 뜨는가", await page.locator("#overlay").isVisible());
  검사("멈춤 화면 제목이 '잠깐 멈췄어요' 인가",
    (await page.locator("#overlayTitle").textContent()).includes("멈췄"),
    await page.locator("#overlayTitle").textContent());
  검사("멈추면 '이어서 하기' 로 바뀌는가",
    (await page.locator("#startBtn").textContent()).includes("이어서"),
    await page.locator("#startBtn").textContent());
  검사("'그만두기' 가 나타나는가", await page.locator("#quitBtn").isVisible());
  검사("멈춤 화면에서 아카이브로 갈 수 있는가", await page.locator(".back-home a").isVisible());
  검사("멈추면 멈춤 버튼은 감춰지는가", !(await page.locator("#pauseBtn").isVisible()));

  // 멈춘 동안에는 시간이 흐르면 안 됩니다
  await page.waitForTimeout(1800);
  const 기다린뒤 = await 상태();
  검사("멈춘 동안에는 점수가 오르지 않는가",
    기다린뒤.점수 === 멈춘뒤.점수, [멈춘뒤.점수, 기다린뒤.점수]);

  // 이어서 하기
  await page.locator("#startBtn").click();
  await page.waitForTimeout(400);
  const 이어서 = await 상태();
  검사("'이어서 하기' 를 누르면 다시 달리는가", 이어서.진행중 && !이어서.멈춤중, 이어서);
  검사("이어서 하면 점수가 이어지는가",
    이어서.점수 >= 기다린뒤.점수 && 이어서.점수 < 기다린뒤.점수 + 40,
    [기다린뒤.점수, 이어서.점수]);
  /*
    멈춰 있던 시간이 한꺼번에 흐르면 로봇이 땅속이나 화면 밖으로 튑니다.
    땅 위에 얌전히 있는지로 확인합니다.
  */
  검사("이어서 해도 로봇이 튀지 않는가",
    이어서.로봇y > 0 && 이어서.로봇y <= 이어서.땅위치 + 1, 이어서);
  검사("이어서 하면 멈춤 버튼이 다시 나오는가", await page.locator("#pauseBtn").isVisible());

  // 멈춘 뒤 그만두기
  await page.locator("#pauseBtn").click();
  await page.waitForTimeout(200);
  await page.locator("#quitBtn").click();
  await page.waitForTimeout(300);
  const 그만둠 = await 상태();
  검사("'그만두기' 를 누르면 판이 끝나는가", !그만둠.진행중 && !그만둠.멈춤중, 그만둠);
  검사("그만두면 결과가 나오는가", await page.locator("#resultBox").isVisible());
  검사("그만둬도 점수가 남는가",
    Number(await page.locator("#finalScore").textContent()) > 0,
    await page.locator("#finalScore").textContent());
  검사("그만두면 '다시 하기' 로 바뀌는가",
    (await page.locator("#startBtn").textContent()).includes("다시"),
    await page.locator("#startBtn").textContent());
  검사("그만두면 '그만두기' 단추는 사라지는가", !(await page.locator("#quitBtn").isVisible()));
  검사("그만두면 멈춤 버튼도 사라지는가", !(await page.locator("#pauseBtn").isVisible()));
}


/* ==========================================================
   8) 결과 화면이 낮은 화면에서도 잘리지 않는가
   ------------------------------------------------------------
   휴대폰을 가로로 눕히면 높이가 390px 밖에 안 됩니다.
   결과 화면에 줄이 하나씩 늘 때마다(체력 안내, 스테이지 안내...)
   위아래가 잘릴 위험이 커집니다. 실제로 스테이지 안내를 넣자
   제목과 '다시 하기' 가 화면 밖으로 밀려났습니다.

   가운데 정렬(align-items: center)로 맞추면 내용이 화면보다 클 때
   위쪽이 잘려 나가고 스크롤해도 볼 수 없습니다. 그래서 잘리는지,
   그리고 다시 시작할 수 있는지를 봅니다.
   ========================================================== */
for (const [이름, 폭, 높이] of [["가로로 눕힌 휴대폰", 844, 390], ["아주 낮은 화면", 844, 320]]) {
  await page.setViewportSize({ width: 폭, height: 높이 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#startBtn").click();
  await page.waitForTimeout(200);
  // 스테이지를 올려 결과 화면에 줄이 가장 많이 나오는 상황을 만듭니다
  await page.evaluate(() => {
    스테이지 = 3; 속도 = 스테이지_속도();
    로봇.체력 = 1; 로봇.무적 = 0; 로봇_맞음();
  });
  await page.waitForTimeout(250);

  const 잰것 = await page.evaluate(() => {
    const 덮개 = document.getElementById("overlay");
    const 칸 = document.querySelector(".panel");
    const 단추 = document.getElementById("startBtn");
    const ㅋ = 칸.getBoundingClientRect();
    const ㄷ = 단추.getBoundingClientRect();
    return {
      위잘림: ㅋ.top < -1,
      다시하기_다보이나: ㄷ.top >= 0 && ㄷ.bottom <= innerHeight,
      넘치면_스크롤되나: 덮개.scrollHeight <= 덮개.clientHeight ||
                        getComputedStyle(덮개).overflowY === "auto",
    };
  });
  검사(`${이름} — 결과 화면 위쪽이 잘리지 않는가`, !잰것.위잘림, 잰것);
  검사(`${이름} — '다시 하기' 를 누를 수 있는가`, 잰것.다시하기_다보이나, 잰것);
  검사(`${이름} — 넘치면 스크롤할 수 있는가`, 잰것.넘치면_스크롤되나, 잰것);
}
await page.setViewportSize({ width: 844, height: 390 });

검사("게임 내내 자바스크립트 오류가 없는가", 오류들.length === 0, 오류들.slice(0,3));

console.log(실패===0 ? "\n🎉 게임이 정상 동작합니다" : `\n⚠️ ${실패}건 실패`);
await browser.close(); 서버.close();
process.exit(실패===0?0:1);
