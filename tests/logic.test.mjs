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
  <button id="refreshBtn"></button>
</body>`, { runScripts: "outside-only" });

global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.fetch = async () => { throw new Error("네트워크 차단됨(예상된 동작)"); };
global.console = console;

let code = fs.readFileSync("/home/user/Project-begins/app.js", "utf8");
code = code.replace("논문_불러오기();", "// 자동 실행은 테스트에서 생략");
// 검사할 함수들을 밖으로 꺼냅니다
code += "\nglobal.T = { 논문정보_정리, 검색어_만들기, 오늘의_논문_고르기, 카드_만들기, 안전한글자로, 학술지_순서_섞기, 섞기값, 학술지_등급_가져오기 };";
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

console.log(실패 === 0 ? "\n🎉 전체 통과 — 모든 검사 성공" : `\n⚠️  ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
