/*
  이 파일은 "테스트" 입니다 — 코드를 고친 뒤 망가진 곳이 없는지 자동으로 확인해 줍니다.
  지금 당장은 몰라도 됩니다. README의 "5단계"에서 다룹니다.
  실행법:  npm install jsdom  후  node tests/logic.test.mjs
*/
import { JSDOM } from "jsdom";
import fs from "fs";

// PubMed efetch 가 실제로 돌려주는 XML 과 같은 구조의 샘플
const 샘플XML = `<?xml version="1.0"?>
<PubmedArticleSet>
 <PubmedArticle>
  <MedlineCitation>
   <PMID Version="1">40123456</PMID>
   <Article>
    <Journal>
     <ISOAbbreviation>Lancet Psychiatry</ISOAbbreviation>
     <Title>The Lancet. Psychiatry</Title>
     <JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue>
    </Journal>
    <ArticleTitle>Ketamine vs ECT for treatment-resistant depression &lt;a randomised trial&gt;</ArticleTitle>
    <Abstract>
     <AbstractText Label="BACKGROUND">Treatment-resistant depression affects many patients.</AbstractText>
     <AbstractText Label="METHODS">We randomised 400 adults across 12 sites.</AbstractText>
     <AbstractText Label="FINDINGS">Response rates were 55% vs 41%.</AbstractText>
     <AbstractText Label="INTERPRETATION">Ketamine was non-inferior to ECT at 6 months.</AbstractText>
    </Abstract>
    <AuthorList>
     <Author><LastName>Kim</LastName><Initials>SY</Initials></Author>
     <Author><LastName>Park</LastName><Initials>JH</Initials></Author>
     <Author><LastName>Lee</LastName><Initials>M</Initials></Author>
     <Author><LastName>Choi</LastName><Initials>K</Initials></Author>
    </AuthorList>
   </Article>
   <CommentsCorrectionsList>
     <CommentsCorrections><PMID>99999999</PMID></CommentsCorrections>
   </CommentsCorrectionsList>
  </MedlineCitation>
  <PubmedData><ArticleIdList>
    <ArticleId IdType="pubmed">40123456</ArticleId>
    <ArticleId IdType="doi">10.1016/S2215-0366(26)00123-4</ArticleId>
  </ArticleIdList></PubmedData>
 </PubmedArticle>
</PubmedArticleSet>`;

// app.js 안의 함수들을 꺼내 쓰기 위해, 브라우저 환경을 흉내 낸 뒤 실행합니다
const dom = new JSDOM(`<!DOCTYPE html><body>
  <div id="paperList"></div><div id="statusBox"></div><p id="todayLabel"></p>
  <select id="topicSelect"><option value="all">전체</option></select>
  <select id="daysSelect"><option value="30">30</option></select>
  <select id="rankSelect"><option value="rank">권위</option><option value="even">골고루</option></select>
  <select id="seenSelect"><option value="exclude">빼기</option><option value="include">포함</option></select>
  <button id="refreshBtn"></button>
</body>`, { runScripts: "outside-only" });

global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.fetch = async () => { throw new Error("네트워크 차단됨(예상된 동작)"); };
// 브라우저의 저장 공간을 흉내 냅니다 (이미 본 논문 기록을 확인하는 데 씁니다)
const 가짜저장소 = new Map();
global.localStorage = {
  getItem: (k) => (가짜저장소.has(k) ? 가짜저장소.get(k) : null),
  setItem: (k, v) => 가짜저장소.set(k, String(v)),
  removeItem: (k) => 가짜저장소.delete(k),
  clear: () => 가짜저장소.clear(),
};
global.console = console;

let code = fs.readFileSync(new URL("../psychiatry/app.js", import.meta.url), "utf8");
code = code.replace("논문_불러오기();", "// 자동 실행은 테스트에서 생략");
// 검사할 함수들을 밖으로 꺼냅니다
code += "\nglobal.T = { 논문정보_정리, 검색어_만들기, 오늘의_논문_고르기, 카드_만들기, 안전한글자로, 학술지_순서_섞기, 섞기값, 학술지_등급_가져오기,"
      + " 본논문_불러오기, 본논문_저장하기, 본논문_기록하기, 본논문_정리, 오래된_날짜인가, 안_본_논문만, 오늘_날짜글자, 본논문_최대개수,"
      + " 구독_불러오기, 구독_저장하기, 구독_추가하기, 구독_지우기, 구독값_다듬기, 구독검색어_만들기, 구독_최대_개수,"
      + " 쓸만한_번역인가, 번역_최대_글자 };";
new Function(code)();

const T = global.T;
let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

// ---- 1. XML 파싱 검사 ----
const 문서 = new DOMParser().parseFromString(샘플XML, "text/xml");
const p = T.논문정보_정리(문서.querySelector("PubmedArticle"));

검사("PMID를 올바르게 뽑는가 (참고문헌 PMID 99999999 를 잘못 집지 않는가)", p.pmid === "40123456", p.pmid);
검사("학술지 약어를 뽑는가", p.학술지 === "Lancet Psychiatry", p.학술지);
검사("제목을 뽑는가", p.제목.includes("Ketamine vs ECT"), p.제목);
검사("저자 4명 중 3명 + et al. 로 줄이는가", p.저자표기 === "Kim SY, Park JH, Lee M, et al.", p.저자표기);
검사("발표일을 뽑는가", p.발표일 === "2026. Aug", p.발표일);

/*
  같은 논문에 ArticleDate(온라인 공개일)와 PubDate(호 배정일)가 함께 있으면
  실제로 읽을 수 있게 된 날인 ArticleDate 를 써야 합니다.
  PubDate 는 미래 날짜인 경우가 많습니다.
*/
const 두날짜XML = `<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation>
  <PMID>40999999</PMID><Article>
    <Journal><ISOAbbreviation>J Affect Disord</ISOAbbreviation>
      <JournalIssue><PubDate><Year>2026</Year><Month>Dec</Month></PubDate></JournalIssue></Journal>
    <ArticleTitle>Test</ArticleTitle>
    <Abstract><AbstractText>Only one sentence here.</AbstractText></Abstract>
    <ArticleDate DateType="Electronic"><Year>2026</Year><Month>08</Month><Day>21</Day></ArticleDate>
  </Article></MedlineCitation></PubmedArticle></PubmedArticleSet>`;
const 두날짜 = T.논문정보_정리(
  new DOMParser().parseFromString(두날짜XML, "text/xml").querySelector("PubmedArticle"));
검사("온라인 공개일(ArticleDate)을 호 배정일(PubDate)보다 우선하는가",
  두날짜.발표일 === "2026. Aug", 두날짜.발표일);
검사("초록 4문단을 모두 뽑는가", p.초록문단들.length === 4, p.초록문단들.length);
검사("핵심 결론으로 INTERPRETATION 문단을 고르는가", p.핵심 === "Ketamine was non-inferior to ECT at 6 months.", p.핵심);
검사("DOI를 뽑는가", p.doi === "10.1016/S2215-0366(26)00123-4", p.doi);

// ---- 2. 보안 검사: 제목의 <> 기호가 태그로 해석되지 않는가 ----
const 카드 = T.카드_만들기(p);
검사("제목의 꺾쇠 기호를 안전하게 변환하는가", 카드.includes("&lt;a randomised trial&gt;"), 카드.match(/<h2>.*<\/h2>/)?.[0]);
검사("악성 스크립트 삽입이 막히는가",
  !T.안전한글자로('<script>alert(1)</script>').includes("<script"), T.안전한글자로('<script>alert(1)</script>'));

// ---- 3. 검색어 생성 검사 ----
const q전체 = T.검색어_만들기("all");
검사("검색어에 학술지 조건이 들어가는가", q전체.includes('"JAMA Psychiatry"[jour]'));
/*
  기간 조건은 검색어가 아니라 요청 파라미터(datetype=edat, reldate)로 넘깁니다.
  [dp](발행일)는 저널 호 배정일이라 미래 날짜가 붙는 경우가 많아,
  그것으로 정렬하면 미래 날짜를 크게 붙이는 학술지가 목록을 독차지합니다.
*/
검사("검색어에 발행일 기준 기간 조건이 들어있지 않은가", !q전체.includes("[dp]"), q전체.slice(-140));
검사("검색어에 초록 필수 조건이 들어가는가", q전체.includes("hasabstract"));

/*
  종합 의학 학술지(NEJM·Lancet·JAMA·BMJ·Ann Intern Med)는 정신의학과 무관한
  논문이 훨씬 많으므로, 정신건강 주제인지를 '제목'에서만 확인해야 합니다.

  초록까지 보면([tiab]) 단어 하나만 스쳐도 통과합니다.
  실제로 NEJM 의 스타틴 임상시험이 올라온 적이 있는데, 일차 결과가
  '치매·장애 없는 생존' 이라 초록에 dementia 가 들어 있었을 뿐
  내용은 심혈관 예방 연구였습니다.
*/
검사("종합 학술지 조건을 제목에서만 확인하는가",
  q전체.includes("dementia[ti]") && !q전체.includes("dementia[tiab]"),
  q전체.match(/dementia\[\w+\]/g));
검사("정신건강 키워드가 모두 제목 조건으로 들어가는가",
  (q전체.match(/\[tiab\]/g) || []).length === 0, q전체.match(/\w+\[tiab\]/g));
검사("사설/독자편지를 제외하는가", q전체.includes("NOT (editorial[pt]"));
검사("'전체' 선택 시 분야 조건이 붙지 않는가", !q전체.includes("[tiab]) AND ("), q전체.slice(-120));

const q수면 = T.검색어_만들기("sleep");
검사("'수면' 선택 시 관련 조건이 추가되는가", q수면.includes("insomnia[tiab]"));

// ---- 4. 매일 3편 선정 로직 검사 ----
const 만들기 = (학술지들) => 학술지들.map((j, i) => ({ pmid: "id" + i, 학술지: j }));

// 학술지가 골고루 섞인 평범한 목록
const 보통목록 = 만들기(
  Array.from({ length: 60 }, (_, i) => ["A지", "B지", "C지", "D지", "E지"][i % 5])
);
const 첫번째 = T.오늘의_논문_고르기(보통목록);
const 두번째 = T.오늘의_논문_고르기(보통목록);
검사("정확히 3편을 고르는가", 첫번째.length === 3, 첫번째);
검사("같은 날 다시 열면 같은 3편이 나오는가",
  JSON.stringify(첫번째) === JSON.stringify(두번째), [첫번째, 두번째]);
검사("고른 3편에 중복이 없는가", new Set(첫번째.map((p) => p.pmid)).size === 3, 첫번째);

/*
  가장 중요한 검사입니다.
  실제 PubMed 목록은 발행량이 많은 학술지(예: J Affect Disord)가
  절반 이상을 차지하고, 같은 학술지가 목록에 덩어리로 붙어 나옵니다.
  예전 방식은 목록에서 연속 3개를 뽑았기 때문에 매일 같은 학술지만 보였습니다.
*/
const 편중목록 = 만들기([
  ...Array(35).fill("J Affect Disord"),      // 한 학술지가 목록의 절반 이상
  ...Array(12).fill("Transl Psychiatry"),
  ...Array(6).fill("Sleep"),
  ...Array(4).fill("Mol Psychiatry"),
  ...Array(3).fill("JAMA Netw Open"),
]);
const 편중결과 = T.오늘의_논문_고르기(편중목록);
검사("한 학술지가 목록의 절반을 차지해도 서로 다른 학술지를 고르는가",
  new Set(편중결과.map((p) => p.학술지)).size === 3,
  편중결과.map((p) => p.학술지));

// 시작 위치를 바꿔가며 200번 돌려도 항상 학술지가 겹치지 않아야 합니다
let 겹친횟수 = 0;
for (let n = 0; n < 200; n++) {
  const 자른곳 = n % 편중목록.length;
  const 돌린목록 = [...편중목록.slice(자른곳), ...편중목록.slice(0, 자른곳)];
  const 결과 = T.오늘의_논문_고르기(돌린목록);
  if (new Set(결과.map((p) => p.학술지)).size < 3) 겹친횟수++;
}
검사("어느 날짜에 뽑아도 학술지가 겹치지 않는가 (200회 시도)", 겹친횟수 === 0, `${겹친횟수}회 겹침`);

// 학술지 종류 자체가 부족하면, 중복을 허용해서라도 3편을 채웁니다
const 부족결과 = T.오늘의_논문_고르기(만들기(["A지", "A지", "B지", "B지", "A지"]));
검사("학술지가 2종뿐이면 중복을 허용해서라도 3편을 채우는가",
  부족결과.length === 3 && new Set(부족결과.map((p) => p.pmid)).size === 3,
  부족결과);

// 논문 자체가 2편뿐이면 2편만 보여줍니다 (같은 논문을 두 번 보여주지 않음)
const 부족 = T.오늘의_논문_고르기(만들기(["A지", "B지"]));
검사("논문이 2편뿐이면 중복 없이 2편만 보여주는가",
  부족.length === 2 && new Set(부족.map((p) => p.pmid)).size === 2, 부족);

// ---- 5. 여러 날에 걸친 다양성 검사 (가장 중요) ----
/*
  실제 상황을 그대로 재현합니다.
  J Affect Disord 가 120편 중 절반 이상을 차지하고,
  Lancet Psychiatry · JAMA Psychiatry 처럼 권위 높은 학술지는 편수가 적습니다.
  발행량이 적다고 계속 밀려나면 안 됩니다.
*/
const 실제분포 = 만들기([
  ...Array(62).fill("J Affect Disord"),
  ...Array(18).fill("Transl Psychiatry"),
  ...Array(12).fill("Psychol Med"),
  ...Array(9).fill("Sleep"),
  ...Array(7).fill("Mol Psychiatry"),
  ...Array(5).fill("Lancet Psychiatry"),
  ...Array(4).fill("JAMA Psychiatry"),
  ...Array(3).fill("World Psychiatry"),
]);

// 날짜를 바꿔가며 30일치를 뽑아봅니다
const 원래Date = Date;
const 날짜별결과 = [];
for (let 일 = 1; 일 <= 30; 일++) {
  const 그날 = `2026-09-${String(일).padStart(2, "0")}T09:00:00Z`;
  global.Date = class extends 원래Date {
    constructor(...인자) { super(...(인자.length ? 인자 : [그날])); }
  };
  날짜별결과.push(T.오늘의_논문_고르기(실제분포).map((p) => p.학술지));
}
global.Date = 원래Date;

const 매일_세종류 = 날짜별결과.every((하루) => new Set(하루).size === 3);
검사("30일 내내 매일 서로 다른 3개 학술지가 나오는가", 매일_세종류,
  날짜별결과.find((하루) => new Set(하루).size < 3));

const 등장횟수 = {};
날짜별결과.flat().forEach((j) => { 등장횟수[j] = (등장횟수[j] || 0) + 1; });
const 등장한학술지수 = Object.keys(등장횟수).length;
검사("30일 동안 여러 학술지가 골고루 등장하는가 (6종 이상)",
  등장한학술지수 >= 6, 등장횟수);

const 최다등장 = Math.max(...Object.values(등장횟수));
검사("한 학술지가 30일을 독점하지 않는가 (25일 이하)",
  최다등장 <= 25, `최다 등장 ${최다등장}일 / 30일`);

검사("편수가 적은 최상위 학술지도 등장하는가 (Lancet Psychiatry)",
  (등장횟수["Lancet Psychiatry"] || 0) > 0, 등장횟수);

// 같은 날 여러 번 호출해도 순서가 바뀌지 않아야 합니다
const 순서1 = T.학술지_순서_섞기(["가지", "나지", "다지", "라지"], 12345);
const 순서2 = T.학술지_순서_섞기(["가지", "나지", "다지", "라지"], 12345);
const 순서3 = T.학술지_순서_섞기(["가지", "나지", "다지", "라지"], 99999);
검사("같은 날에는 학술지 순서가 항상 같은가",
  JSON.stringify(순서1) === JSON.stringify(순서2), [순서1, 순서2]);
검사("날이 바뀌면 학술지 순서도 바뀌는가",
  JSON.stringify(순서1) !== JSON.stringify(순서3), [순서1, 순서3]);

console.log("\n  [참고] 30일 동안 학술지별 등장 횟수");
Object.entries(등장횟수).sort((가, 나) => 나[1] - 가[1])
  .forEach(([j, n]) => console.log(`     ${j.padEnd(20)} ${String(n).padStart(2)}일 ${"█".repeat(n)}`));

// ---- 6. 학술지 등급 우선순위 검사 ----
검사("등급표에서 등급을 올바르게 읽는가",
  T.학술지_등급_가져오기("JAMA") === 5 && T.학술지_등급_가져오기("Lancet Psychiatry") === 4,
  [T.학술지_등급_가져오기("JAMA"), T.학술지_등급_가져오기("Lancet Psychiatry")]);
검사("등급표에 없는 학술지는 1등급으로 처리하는가",
  T.학술지_등급_가져오기("듣도 보도 못한 학술지") === 1);

/*
  섞기값이 고르게 퍼지는지 확인합니다.
  날짜가 하루 넘어가면 글자 하나만 바뀌는데, 계산이 약하면
  어떤 학술지는 1년 내내 낮은 값만 나와 거의 보이지 않게 됩니다.
  (실제로 그런 문제가 있었습니다)
*/
const 학술지11 = ["J Affect Disord", "Transl Psychiatry", "Psychol Med", "Sleep",
  "Mol Psychiatry", "Biol Psychiatry", "Lancet Psychiatry", "JAMA Psychiatry",
  "Am J Psychiatry", "World Psychiatry", "JAMA"];

// 실제와 같은 조건 — 365일 연속
const 하루씩시드 = [];
for (let d = 0; d < 365; d++) {
  const t = new Date(2026, 0, 1 + d);
  하루씩시드.push(
    `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
      .split("").reduce((값, 글자) => (값 * 31 + 글자.charCodeAt(0)) % 1000000007, 0));
}

const 등장 = (등급반영) => {
  const 횟수 = Object.fromEntries(학술지11.map((n) => [n, 0]));
  for (const 시드 of 하루씩시드) {
    T.학술지_순서_섞기(학술지11, 시드, 등급반영).slice(0, 3).forEach((n) => 횟수[n]++);
  }
  return 횟수;
};

// 기대값 99.5회, ±3σ = 74~125회
const 골고루횟수 = Object.values(등장(false));
검사("등급을 반영하지 않으면 365일 동안 모든 학술지가 고르게 나오는가 (74~125회)",
  Math.min(...골고루횟수) >= 74 && Math.max(...골고루횟수) <= 125,
  `최소 ${Math.min(...골고루횟수)}회 / 최대 ${Math.max(...골고루횟수)}회`);

const 권위횟수 = 등장(true);
const 등급별 = {};
for (const [이름, 수] of Object.entries(권위횟수)) {
  const 등급 = T.학술지_등급_가져오기(이름);
  등급별[등급] = (등급별[등급] || 0) + 수;
}
검사("등급을 반영하면 5등급이 1등급보다 훨씬 자주 나오는가",
  (등급별[5] || 0) > (등급별[1] || 0) * 3, 등급별);
검사("등급을 반영해도 1등급 학술지가 완전히 사라지지는 않는가",
  (등급별[1] || 0) > 0, 등급별);
검사("등급이 높을수록 자주 나오는 순서가 지켜지는가",
  권위횟수["JAMA"] > 권위횟수["Psychol Med"] &&
  권위횟수["Psychol Med"] > 권위횟수["J Affect Disord"],
  { JAMA: 권위횟수["JAMA"], "Psychol Med": 권위횟수["Psychol Med"],
    "J Affect Disord": 권위횟수["J Affect Disord"] });

console.log("\n  [참고] 365일 · 등급 반영 시 학술지별 등장 횟수");
Object.entries(권위횟수).sort((가, 나) => 나[1] - 가[1]).forEach(([n, v]) =>
  console.log(`     ${String(T.학술지_등급_가져오기(n))}급  ${n.padEnd(20)} ${String(v).padStart(3)}회`));


/* ==========================================================
   이미 본 논문 기록
   ------------------------------------------------------------
   브라우저로 눌러보는 검사(tests/seen.test.mjs)는 '어제 본 것이 오늘 안 나오는가'
   같은 흐름을 확인합니다. 여기서는 그것으로 확인하기 어려운 것을 봅니다 —
   기록이 무한정 쌓이지 않게 정리되는지.
   ========================================================== */
console.log("\n---- 이미 본 논문 기록 ----");

const 날짜글자 = (며칠전) =>
  new Date(Date.now() - 며칠전 * 86400000).toISOString().slice(0, 10);

검사("오늘 날짜는 오래된 것이 아닌가", !T.오래된_날짜인가(날짜글자(0), 400));
검사("399일 전은 아직 남겨두는가", !T.오래된_날짜인가(날짜글자(399), 400));
검사("401일 전은 오래된 것으로 보는가", T.오래된_날짜인가(날짜글자(401), 400));
// 날짜 칸이 깨져 있으면 버려야 합니다. 남겨두면 영영 사라지지 않습니다.
검사("이상한 값은 버리는가", T.오래된_날짜인가("어제", 400) && T.오래된_날짜인가(undefined, 400));

const 섞인기록 = { "1": 날짜글자(0), "2": 날짜글자(500), "3": 날짜글자(10) };
const 정리됨 = T.본논문_정리(섞인기록);
검사("오래된 기록만 골라 버리는가",
  Object.keys(정리됨).sort().join() === "1,3", Object.keys(정리됨));

// 상한을 넘으면 최근에 본 것부터 남겨야 합니다
const 많은기록 = {};
for (let i = 0; i < T.본논문_최대개수 + 50; i++) 많은기록[String(i)] = 날짜글자(i % 300);
const 줄인것 = T.본논문_정리(많은기록);
검사("기록이 상한을 넘지 않게 줄이는가",
  Object.keys(줄인것).length === T.본논문_최대개수, Object.keys(줄인것).length);

/* 후보에서 빼는 규칙 */
localStorage.clear();
const 후보목록 = [
  { pmid: "100", 학술지: "A" }, { pmid: "200", 학술지: "B" },
  { pmid: "300", 학술지: "C" }, { pmid: "400", 학술지: "D" },
  { pmid: "500", 학술지: "E" }, { pmid: "600", 학술지: "F" },
];
T.본논문_저장하기({ "100": 날짜글자(1), "200": T.오늘_날짜글자() });
const 걸러진 = T.안_본_논문만(후보목록);
검사("어제 본 논문은 후보에서 빠지는가",
  !걸러진.목록.some((논문) => 논문.pmid === "100"), 걸러진.목록.map((칸) => 칸.pmid));
검사("오늘 본 논문은 남겨두는가 (같은 날 같은 3편이 나와야 하므로)",
  걸러진.목록.some((논문) => 논문.pmid === "200"), 걸러진.목록.map((칸) => 칸.pmid));
검사("뺀 편수를 알려주는가", 걸러진.제외수 === 1, 걸러진.제외수);

// 빼고 나면 3편이 안 될 때는 빼지 않아야 합니다
localStorage.clear();
T.본논문_저장하기({ "100": 날짜글자(1), "200": 날짜글자(1), "300": 날짜글자(1), "400": 날짜글자(1) });
const 모자랄때 = T.안_본_논문만(후보목록);
검사("빼면 3편이 안 될 때는 빼지 않는가",
  모자랄때.목록.length === 후보목록.length && 모자랄때.모자랐나 === true,
  [모자랄때.목록.length, 모자랄때.모자랐나]);

// 저장 공간이 막힌 기기에서도 멈추지 않아야 합니다
const 원래 = global.localStorage;
global.localStorage = { getItem() { throw new Error("막힘"); },
                        setItem() { throw new Error("막힘"); } };
검사("저장이 막힌 기기에서도 빈 기록으로 넘어가는가",
  JSON.stringify(T.본논문_불러오기()) === "{}");
검사("저장이 막혀도 오류를 던지지 않는가", T.본논문_저장하기({ "1": "2026-01-01" }) === false);
global.localStorage = 원래;
localStorage.clear();


/* ==========================================================
   저자 · 키워드 구독
   ------------------------------------------------------------
   브라우저로 눌러보는 검사(tests/subscribe.test.mjs)는 화면 흐름을 봅니다.
   여기서는 PubMed 로 나갈 검색어가 제대로 조립되는지를 자세히 봅니다.
   검색어 문법이 깨지면 검색 자체가 실패하는데, 화면에는 그냥
   "논문을 불러오지 못했습니다" 라고만 나와 원인을 알기 어렵습니다.
   ========================================================== */
console.log("\n---- 저자 · 키워드 구독 ----");

localStorage.clear();

검사("저자는 [au] 로 조립되는가",
  T.구독검색어_만들기([{ 종류: "author", 값: "Kim SY" }]).includes("Kim SY[au]"),
  T.구독검색어_만들기([{ 종류: "author", 값: "Kim SY" }]));
검사("키워드는 [tiab] 로 조립되는가",
  T.구독검색어_만들기([{ 종류: "keyword", 값: "ketamine" }]).includes("ketamine[tiab]"));
검사("여러 개는 OR 로 묶는가",
  T.구독검색어_만들기([{ 종류: "author", 값: "Kim SY" },
                      { 종류: "keyword", 값: "ketamine" }])
    .includes("Kim SY[au] OR ketamine[tiab]"));
검사("빈 목록이면 검색어를 만들지 않는가", T.구독검색어_만들기([]) === "");
검사("사설·편집자 글은 구독 검색에서도 빼는가",
  T.구독검색어_만들기([{ 종류: "author", 값: "Kim" }]).includes("editorial[pt]"));

/*
  사용자가 적은 글이 그대로 검색어에 들어가면 문법이 깨집니다.
  예를 들어 "Kim [au]" 라고 적으면 대괄호가 두 번 들어가 검색이 실패합니다.
*/
검사("대괄호를 걸러내는가", !T.구독값_다듬기("Kim SY[au]").includes("["),
  T.구독값_다듬기("Kim SY[au]"));
검사("따옴표를 걸러내는가", !T.구독값_다듬기('"ketamine"').includes('"'),
  T.구독값_다듬기('"ketamine"'));
검사("괄호를 걸러내는가", !T.구독값_다듬기("(Kim OR Park)").includes("("),
  T.구독값_다듬기("(Kim OR Park)"));
검사("앞뒤 공백과 겹친 공백을 정리하는가",
  T.구독값_다듬기("  Kim   SY  ") === "Kim SY", T.구독값_다듬기("  Kim   SY  "));
검사("지나치게 긴 입력은 잘라내는가", T.구독값_다듬기("가".repeat(200)).length === 60);
검사("빈 값이나 이상한 값도 안전하게 다루는가",
  T.구독값_다듬기(null) === "" && T.구독값_다듬기(undefined) === "");

/* 등록 규칙 */
localStorage.clear();
검사("등록이 되는가", T.구독_추가하기("author", "Kim SY").됐나 === true);
검사("같은 것을 두 번 등록하면 막는가",
  T.구독_추가하기("author", "Kim SY").됐나 === false);
검사("대소문자만 다른 것도 같은 것으로 보는가",
  T.구독_추가하기("author", "kim sy").됐나 === false);
검사("종류가 다르면 따로 등록되는가",
  T.구독_추가하기("keyword", "Kim SY").됐나 === true);
검사("빈 내용은 등록하지 않는가", T.구독_추가하기("keyword", "   ").됐나 === false);

localStorage.clear();
for (let i = 0; i < T.구독_최대_개수; i++) T.구독_추가하기("keyword", `단어${i}`);
검사("정해둔 개수를 넘겨 등록하지 않는가",
  T.구독_추가하기("keyword", "하나더").됐나 === false &&
  T.구독_불러오기().length === T.구독_최대_개수,
  T.구독_불러오기().length);

/* 지우기 */
localStorage.clear();
T.구독_추가하기("author", "Kim SY");
T.구독_추가하기("keyword", "ketamine");
T.구독_지우기("author", "Kim SY");
검사("지우면 그 항목만 빠지는가",
  T.구독_불러오기().length === 1 && T.구독_불러오기()[0].값 === "ketamine",
  T.구독_불러오기());

/* 저장된 내용이 망가져 있어도 멈추지 않아야 합니다 */
localStorage.setItem("psychiatry-digest-subscriptions", "이건 JSON 이 아닙니다");
검사("저장된 내용이 깨져 있어도 빈 목록으로 넘어가는가",
  Array.isArray(T.구독_불러오기()) && T.구독_불러오기().length === 0);
localStorage.setItem("psychiatry-digest-subscriptions",
  JSON.stringify([{ 종류: "author" }, null, { 종류: "author", 값: "Kim" }]));
검사("모양이 어긋난 칸은 걸러내는가", T.구독_불러오기().length === 1,
  T.구독_불러오기());
localStorage.clear();


/* ==========================================================
   결론 번역
   ------------------------------------------------------------
   무료 번역 서비스는 하루 한도를 넘겨도 오류를 내지 않고,
   번역문 자리에 안내문을 담아 보냅니다. 그것을 걸러내지 못하면
   화면에 "MYMEMORY WARNING: ..." 이 번역인 것처럼 뜹니다.
   ========================================================== */
console.log("\n---- 결론 번역 ----");

const 원문 = "Ketamine was non-inferior to ECT.";
검사("제대로 옮긴 문장은 받아들이는가",
  T.쓸만한_번역인가("케타민은 ECT에 열등하지 않았다.", 원문) === true);
검사("한도 초과 안내문은 걸러내는가",
  T.쓸만한_번역인가("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.", 원문) === false);
검사("글자 수 초과 안내문도 걸러내는가",
  T.쓸만한_번역인가("QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS", 원문) === false);
검사("잘못된 메일 주소 안내도 걸러내는가",
  T.쓸만한_번역인가("INVALID EMAIL PROVIDED", 원문) === false);
검사("원문을 그대로 돌려준 것은 번역으로 보지 않는가",
  T.쓸만한_번역인가(원문, 원문) === false);
검사("대소문자만 다른 것도 원문 그대로로 보는가",
  T.쓸만한_번역인가(원문.toUpperCase(), 원문) === false);
검사("빈 값과 이상한 값은 걸러내는가",
  T.쓸만한_번역인가("", 원문) === false &&
  T.쓸만한_번역인가("   ", 원문) === false &&
  T.쓸만한_번역인가(null, 원문) === false &&
  T.쓸만한_번역인가(undefined, 원문) === false);
검사("보낼 글자 수에 상한이 있는가", T.번역_최대_글자 > 0 && T.번역_최대_글자 <= 1000,
  T.번역_최대_글자);

console.log(실패 === 0 ? "\n🎉 전체 통과 — 모든 검사 성공" : `\n⚠️  ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
