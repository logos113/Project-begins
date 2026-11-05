/*
  아침 브리핑 화면이 제대로 그려지는지 실제 브라우저로 확인합니다.

  실행:
    node tests/stocks-app.test.mjs

  ※ 진짜 data/latest.json 을 쓰지 않습니다.
     그 파일은 매일 아침 내용이 바뀝니다. 그걸로 검사하면 어제는
     통과하고 오늘은 실패하는, 무엇을 지켜주는지 알 수 없는 검사가 됩니다.
     그래서 '미리 짜둔 가짜 브리핑' 을 내어주고, 화면이 그걸 제대로
     그리는지만 봅니다.
*/

import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const 앱폴더 = path.join(import.meta.dirname, "..", "stocks");

/* ---------- 검사에 쓸 가짜 브리핑 ---------- */
const 어제 = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const 가짜브리핑 = {
  날짜: "2026-11-05",
  만든시각: 어제,
  시세: {
    지수: [
      { 이름: "코스피", 종가: 5451.82, 변동률: -3.49, 단위: "", 출처: "Yahoo" },
      { 이름: "S&P 500", 종가: 7688.62, 변동률: 1.58, 단위: "", 출처: "Yahoo" },
      { 이름: "원/달러", 종가: 1341.08, 변동률: 0, 단위: "원", 출처: "Yahoo" },
      // 변동률을 모르는 경우 (Stooq 로 가져왔을 때)
      { 이름: "코스닥", 종가: 684.42, 변동률: null, 단위: "", 출처: "Stooq" },
      // 말이 안 되게 커서 감춘 경우
      { 이름: "수상한지수", 종가: 100, 변동률: null, 수상한가: true, 단위: "", 출처: "Yahoo" },
    ],
    코인: [{ 이름: "비트코인", 달러: 80673, 원화: 108000000, 변동률: 5.03 }],
    못가져온것: [{ 이름: "나스닥", 까닭: "시간 초과" }],
  },
  일정: {
    오늘: [{ 날짜: "2026-11-05", 갈래: "한국", 이름: "오늘 일정", 설명: "설명",
             요일: "목", 남은날: 0, 오늘인가: true, 이번주인가: true, 출처: "규칙" }],
    이번주: [{ 날짜: "2026-11-06", 갈래: "미국", 이름: "미국 고용보고서", 설명: "밤 10시 30분",
               요일: "금", 남은날: 1, 오늘인가: false, 이번주인가: true, 출처: "규칙" }],
    다음주: [],
    다가오는_큰일정: [
      { 날짜: "2026-12-09", 갈래: "미국", 이름: "FOMC 결과 발표", 설명: "기준금리 결정",
        요일: "수", 남은날: 34, 오늘인가: false, 이번주인가: false,
        출처: "연준", 원문: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" },
      // 위 '이번주' 에 이미 나온 것 — 두 번 보이면 안 됩니다
      { 날짜: "2026-11-06", 갈래: "미국", 이름: "미국 고용보고서", 설명: "밤 10시 30분",
        요일: "금", 남은날: 1, 오늘인가: false, 이번주인가: true, 출처: "규칙" },
    ],
    등록일정_있나: false,
    공식출처상태: [
      { 이름: "FOMC (연준)", 성공: true, 개수: 25 },
      { 이름: "미국 CPI (BLS)", 성공: false, 개수: 0, 까닭: "BLS 가 막아두었습니다(403)" },
    ],
  },
  뉴스: {
    한국: [
      { 제목: "삼성전자, 3분기 영업이익 10조원", 주소: "https://example.com/1",
        때: 어제, 출처: "연합뉴스 경제", 갈래: "한국" },
      { 제목: "코스피 2,500 돌파", 주소: "https://example.com/2",
        때: 어제, 출처: "한국경제", 갈래: "한국" },
    ],
    미국: [
      { 제목: "Nvidia beats expectations", 주소: "https://example.com/3",
        때: 어제, 출처: "CNBC", 갈래: "미국" },
    ],
    코인: [
      { 제목: "Bitcoin tops $80,000", 주소: "https://example.com/4",
        때: 어제, 출처: "CoinDesk", 갈래: "코인" },
    ],
  },
  출처상태: [
    { 이름: "연합뉴스 경제", 성공: true, 개수: 120, 까닭: null },
    { 이름: "이데일리 증권", 성공: false, 개수: 0, 까닭: "fetch failed" },
  ],
};

/* ---------- 작은 웹서버 ---------- */
const 종류 = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
               ".json": "application/json", ".png": "image/png" };
const 서버 = http.createServer((요청, 답) => {
  const 길 = 요청.url.split("?")[0];

  // 브리핑만 가짜로 바꿔 내어줍니다
  if (길 === "/data/latest.json") {
    답.writeHead(200, { "Content-Type": "application/json" });
    return 답.end(JSON.stringify(가짜브리핑));
  }
  // 일부러 실패시키는 길 (못 불러왔을 때를 보려고)
  if (길 === "/data/깨진것.json") {
    답.writeHead(500);
    return 답.end();
  }

  const 자리 = path.join(앱폴더, 길 === "/" ? "index.html" : 길);
  if (!fs.existsSync(자리)) { 답.writeHead(404); return 답.end(); }
  답.writeHead(200, { "Content-Type": 종류[path.extname(자리)] || "text/plain" });
  답.end(fs.readFileSync(자리));
});
await new Promise((r) => 서버.listen(8811, r));

const 브라우저 = await chromium.launch();
const 오류들 = [];
let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패 += 1;
};

const 쪽 = await 브라우저.newPage({ viewport: { width: 390, height: 844 } });
쪽.on("pageerror", (오류) => 오류들.push(String(오류)));
쪽.on("console", (글) => { if (글.type() === "error") 오류들.push(글.text()); });

await 쪽.goto("http://localhost:8811/", { waitUntil: "networkidle" });
await 쪽.waitForTimeout(400);

/* ==========================================================
   1) 기본 — 제대로 그려졌는가
   ========================================================== */
검사("불러오는 중 안내가 사라지는가", await 쪽.locator("#loading").isHidden());
검사("못 불러왔다는 경고가 안 뜨는가", await 쪽.locator("#trouble").isHidden());
검사("날짜가 보이는가",
  (await 쪽.locator("#when").textContent()).includes("2026-11-05"),
  await 쪽.locator("#when").textContent());

/* ==========================================================
   2) 시세
   ========================================================== */
검사("시세 칸이 모두 그려지는가",
  await 쪽.locator(".price").count() === 6, await 쪽.locator(".price").count());

검사("천 단위에 쉼표가 들어가는가",
  (await 쪽.locator(".price").first().textContent()).includes("5,452")
    || (await 쪽.locator(".price").first().textContent()).includes("5,451"),
  await 쪽.locator(".price").first().textContent());

/*
  오르면 빨강, 내리면 파랑 (한국 증시 관습).
  색을 글자로 확인할 수 없으니 붙은 class 로 봅니다.
*/
검사("내린 것은 down 으로 표시되는가",
  await 쪽.locator(".price", { hasText: "코스피" }).locator(".move.down").count() === 1);
검사("오른 것은 up 으로 표시되는가",
  await 쪽.locator(".price", { hasText: "S&P" }).locator(".move.up").count() === 1);
검사("안 움직인 것은 flat 인가",
  await 쪽.locator(".price", { hasText: "원/달러" }).locator(".move.flat").count() === 1);

/* 변동률을 모를 때 0% 라고 하면 거짓말입니다 */
검사("변동률을 모르면 '—' 로 두는가",
  (await 쪽.locator(".price", { hasText: "코스닥" }).locator(".move").textContent()).includes("—"),
  await 쪽.locator(".price", { hasText: "코스닥" }).locator(".move").textContent());

검사("말이 안 되는 변동률은 '확인 필요' 로 두는가",
  (await 쪽.locator(".price", { hasText: "수상한지수" }).locator(".move").textContent()).includes("확인"),
  await 쪽.locator(".price", { hasText: "수상한지수" }).locator(".move").textContent());

/* 못 가져온 것을 숨기면 왜 비었는지 알 수 없습니다 */
검사("못 가져온 시세를 알려주는가",
  (await 쪽.locator("#priceNote").textContent()).includes("나스닥"),
  await 쪽.locator("#priceNote").textContent());

/* ==========================================================
   3) 일정
   ========================================================== */
검사("오늘 일정이 보이는가", await 쪽.locator("#todayBox").isVisible());
검사("오늘은 '오늘' 이라고 쓰는가",
  (await 쪽.locator("#todayList .when-chip").first().textContent()).trim() === "오늘",
  await 쪽.locator("#todayList .when-chip").first().textContent());
검사("내일은 '내일' 이라고 쓰는가",
  (await 쪽.locator("#weekList .when-chip").first().textContent()).trim() === "내일",
  await 쪽.locator("#weekList .when-chip").first().textContent());

/* 긁어온 일정은 원문으로 갈 수 있어야 합니다 */
const 원문링크 = 쪽.locator("#bigList a");
검사("긁어온 일정에 원문 링크가 붙는가", await 원문링크.count() >= 1, await 원문링크.count());
검사("원문 링크가 연준을 가리키는가",
  (await 원문링크.first().getAttribute("href")).includes("federalreserve.gov"),
  await 원문링크.first().getAttribute("href"));
검사("원문 링크는 새 창으로 여는가",
  await 원문링크.first().getAttribute("target") === "_blank");
/* target=_blank 에는 rel=noopener 가 있어야 합니다 (연 창이 원래 창을 건드리지 못하게) */
검사("새 창 링크에 noopener 가 붙는가",
  (await 원문링크.first().getAttribute("rel") || "").includes("noopener"),
  await 원문링크.first().getAttribute("rel"));

/* 같은 일정이 두 번 보이면 지저분합니다 */
const 고용보고서수 = await 쪽.locator(".sched li", { hasText: "미국 고용보고서" }).count();
검사("위에 나온 일정이 '다음 FOMC' 에 또 나오지 않는가",
  고용보고서수 === 1, 고용보고서수);

/* ==========================================================
   4) 뉴스
   ========================================================== */
검사("뉴스가 그려지는가", await 쪽.locator("#newsList li").count() === 2,
  await 쪽.locator("#newsList li").count());

await 쪽.click('.tab[data-갈래="코인"]');
await 쪽.waitForTimeout(150);
검사("탭을 누르면 갈래가 바뀌는가",
  (await 쪽.locator("#newsList").textContent()).includes("Bitcoin"),
  await 쪽.locator("#newsList").textContent());
검사("누른 탭에 표시가 켜지는가",
  (await 쪽.locator(".tab.on").textContent()).trim() === "코인",
  await 쪽.locator(".tab.on").textContent());
검사("탭에 aria-selected 가 따라가는가",
  await 쪽.locator('.tab[data-갈래="코인"]').getAttribute("aria-selected") === "true");
await 쪽.click('.tab[data-갈래="한국"]');
await 쪽.waitForTimeout(150);

/* ==========================================================
   5) 관심 종목
   ========================================================== */
검사("처음에는 '등록한 종목이 없다' 고 안내하는가",
  (await 쪽.locator("#watchEmpty").textContent()).includes("아직 등록한 종목이 없습니다"),
  await 쪽.locator("#watchEmpty").textContent());

await 쪽.click("#watchToggle");
await 쪽.fill("#watchInput", "삼성전자");
await 쪽.press("#watchInput", "Enter");
await 쪽.waitForTimeout(200);

검사("등록하면 칩이 생기는가",
  (await 쪽.locator("#watchChips li").first().textContent()).includes("삼성전자"),
  await 쪽.locator("#watchChips li").allTextContents());
검사("등록한 이름이 든 뉴스를 골라주는가",
  (await 쪽.locator("#watchNews").textContent()).includes("삼성전자"),
  await 쪽.locator("#watchNews").textContent());
검사("골라낸 뉴스에 어떤 이름이 걸렸는지 표시하는가",
  (await 쪽.locator("#watchNews .hit").first().textContent()).includes("삼성전자"),
  await 쪽.locator("#watchNews .hit").first().textContent());
검사("뉴스를 찾았으면 '없다' 는 안내는 숨는가",
  await 쪽.locator("#watchEmpty").isHidden());

/* 없는 종목을 넣으면 '없다' 고 해야 합니다 */
await 쪽.fill("#watchInput", "없는회사이름");
await 쪽.press("#watchInput", "Enter");
await 쪽.waitForTimeout(200);
await 쪽.evaluate(() => {
  localStorage.setItem("아침브리핑.관심종목", JSON.stringify(["없는회사이름"]));
});
await 쪽.reload({ waitUntil: "networkidle" });
await 쪽.waitForTimeout(400);
검사("찾은 뉴스가 없으면 그렇다고 알려주는가",
  (await 쪽.locator("#watchEmpty").textContent()).includes("없습니다")
    && await 쪽.locator("#watchEmpty").isVisible(),
  await 쪽.locator("#watchEmpty").textContent());

/*
  ★ 안내 문구를 덮어쓴 뒤 종목을 다 지우면 원래 문구로 돌아와야 합니다.
     한때 "등록한 종목() 이야기는 오늘 뉴스에 없습니다" 가 그대로 남았습니다.
     등록한 게 하나도 없는데 그렇게 말하면 말이 안 됩니다.
*/
await 쪽.click("#watchToggle");
await 쪽.click("#watchChips button");
await 쪽.waitForTimeout(200);
검사("종목을 다 지우면 첫 안내로 돌아오는가",
  (await 쪽.locator("#watchEmpty").textContent()).includes("아직 등록한 종목이 없습니다"),
  await 쪽.locator("#watchEmpty").textContent());

/* 같은 종목을 두 번 넣어도 하나만 남아야 합니다 */
await 쪽.fill("#watchInput", "삼성전자");
await 쪽.press("#watchInput", "Enter");
await 쪽.fill("#watchInput", "삼성전자");
await 쪽.press("#watchInput", "Enter");
await 쪽.waitForTimeout(200);
검사("같은 종목을 두 번 넣어도 하나만 남는가",
  await 쪽.locator("#watchChips li").count() === 1,
  await 쪽.locator("#watchChips li").allTextContents());

/* 새로고침해도 남아 있어야 합니다 */
await 쪽.reload({ waitUntil: "networkidle" });
await 쪽.waitForTimeout(400);
검사("새로고침해도 관심 종목이 남아 있는가",
  (await 쪽.locator("#watchChips li").first().textContent()).includes("삼성전자"),
  await 쪽.locator("#watchChips li").allTextContents());

/* ==========================================================
   6) 안전 — 남의 글을 그대로 믿지 않는가
   ------------------------------------------------------------
   뉴스 제목은 남의 사이트에서 온 글입니다. 거기 <script> 가 섞여 있어도
   글자로만 보여야 합니다. innerHTML 로 넣으면 실행됩니다.
   ========================================================== */
const 수상한쪽 = await 브라우저.newPage({ viewport: { width: 390, height: 844 } });
let 수상한것이_돌았나 = false;
수상한쪽.on("dialog", async (창) => { 수상한것이_돌았나 = true; await 창.dismiss(); });
await 수상한쪽.route("**/data/latest.json*", (길) => 길.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    ...가짜브리핑,
    뉴스: {
      한국: [{ 제목: '<img src=x onerror="alert(1)">나쁜 제목<script>alert(2)</script>',
               주소: "https://example.com/x", 때: 어제, 출처: "어딘가", 갈래: "한국" }],
      미국: [], 코인: [],
    },
  }),
}));
await 수상한쪽.goto("http://localhost:8811/", { waitUntil: "networkidle" });
await 수상한쪽.waitForTimeout(500);

검사("제목에 섞인 수상한 것이 실행되지 않는가", !수상한것이_돌았나);
검사("수상한 제목도 글자로는 보이는가",
  (await 수상한쪽.locator("#newsList").textContent()).includes("나쁜 제목"),
  await 수상한쪽.locator("#newsList").textContent());
검사("수상한 것이 태그로 들어가지 않았는가",
  await 수상한쪽.locator("#newsList img").count() === 0,
  await 수상한쪽.locator("#newsList img").count());
await 수상한쪽.close();

/* ==========================================================
   7) 자료를 못 불러왔을 때
   ========================================================== */
const 못불러온쪽 = await 브라우저.newPage({ viewport: { width: 390, height: 844 } });
await 못불러온쪽.route("**/data/latest.json*", (길) => 길.fulfill({ status: 500, body: "" }));
await 못불러온쪽.goto("http://localhost:8811/", { waitUntil: "networkidle" });
await 못불러온쪽.waitForTimeout(400);
검사("자료를 못 불러오면 그렇다고 알려주는가",
  await 못불러온쪽.locator("#trouble").isVisible());
검사("못 불러왔을 때 무엇을 하라고 일러주는가",
  (await 못불러온쪽.locator("#trouble").textContent()).includes("↻"),
  await 못불러온쪽.locator("#trouble").textContent());
검사("못 불러와도 화면이 깨지지 않는가",
  await 못불러온쪽.locator("#loading").isHidden());
await 못불러온쪽.close();

/* ==========================================================
   8) 화면 크기별로 넘치지 않는가
   ========================================================== */
for (const [이름, 폭, 높이] of [["좁은 휴대폰", 360, 740], ["휴대폰", 390, 844], ["넓은 화면", 1024, 800]]) {
  const 큰쪽 = await 브라우저.newPage({ viewport: { width: 폭, height: 높이 } });
  await 큰쪽.goto("http://localhost:8811/", { waitUntil: "networkidle" });
  await 큰쪽.waitForTimeout(400);
  const 잰것 = await 큰쪽.evaluate(() => ({
    문서폭: document.documentElement.scrollWidth,
    화면폭: window.innerWidth,
  }));
  검사(`${이름} — 가로로 넘치지 않는가`, 잰것.문서폭 <= 잰것.화면폭 + 1, 잰것);
  await 큰쪽.close();
}

/* ==========================================================
   9) 맨 아래 — 출처와 당부
   ========================================================== */
검사("어디서 가져왔는지 밝히는가",
  (await 쪽.locator("#sourceBody").textContent()).includes("연합뉴스"),
  (await 쪽.locator("#sourceBody").textContent()).slice(0, 80));
검사("못 가져온 곳도 밝히는가",
  (await 쪽.locator("#sourceBody").textContent()).includes("이데일리"),
  (await 쪽.locator("#sourceBody").textContent()).slice(0, 200));
검사("BLS 가 막혔다는 것도 알려주는가",
  (await 쪽.locator("#sourceBody").textContent()).includes("BLS"),
  (await 쪽.locator("#sourceBody").textContent()).slice(0, 300));
검사("투자 판단은 본인 몫이라고 일러두는가",
  (await 쪽.locator(".caution").textContent()).includes("조언이 아니"),
  await 쪽.locator(".caution").textContent());

검사("화면 내내 자바스크립트 오류가 없는가", 오류들.length === 0, 오류들.slice(0, 3));

console.log(실패 === 0
  ? "\n🎉 아침 브리핑 화면이 정상 동작합니다"
  : `\n⚠️ ${실패}건 실패`);

await 브라우저.close();
서버.close();
process.exit(실패 === 0 ? 0 : 1);
