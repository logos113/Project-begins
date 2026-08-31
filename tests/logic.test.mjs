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
  <button id="refreshBtn"></button>
</body>`, { runScripts: "outside-only" });

global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.fetch = async () => { throw new Error("네트워크 차단됨(예상된 동작)"); };
global.console = console;

let code = fs.readFileSync("/home/user/Project-begins/app.js", "utf8");
code = code.replace("논문_불러오기();", "// 자동 실행은 테스트에서 생략");
// 검사할 함수들을 밖으로 꺼냅니다
code += "\nglobal.T = { 논문정보_정리, 검색어_만들기, 오늘의_논문_고르기, 카드_만들기, 안전한글자로 };";
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
검사("초록 4문단을 모두 뽑는가", p.초록문단들.length === 4, p.초록문단들.length);
검사("핵심 결론으로 INTERPRETATION 문단을 고르는가", p.핵심 === "Ketamine was non-inferior to ECT at 6 months.", p.핵심);
검사("DOI를 뽑는가", p.doi === "10.1016/S2215-0366(26)00123-4", p.doi);

// ---- 2. 보안 검사: 제목의 <> 기호가 태그로 해석되지 않는가 ----
const 카드 = T.카드_만들기(p);
검사("제목의 꺾쇠 기호를 안전하게 변환하는가", 카드.includes("&lt;a randomised trial&gt;"), 카드.match(/<h2>.*<\/h2>/)?.[0]);
검사("악성 스크립트 삽입이 막히는가",
  !T.안전한글자로('<script>alert(1)</script>').includes("<script"), T.안전한글자로('<script>alert(1)</script>'));

// ---- 3. 검색어 생성 검사 ----
const q전체 = T.검색어_만들기("all", 30);
검사("검색어에 학술지 조건이 들어가는가", q전체.includes('"JAMA Psychiatry"[jour]'));
검사("검색어에 기간 조건이 들어가는가", q전체.includes('"last 30 days"[dp]'));
검사("검색어에 초록 필수 조건이 들어가는가", q전체.includes("hasabstract"));
검사("사설/독자편지를 제외하는가", q전체.includes("NOT (editorial[pt]"));
검사("'전체' 선택 시 분야 조건이 붙지 않는가", !q전체.includes("[tiab]) AND ("), q전체.slice(-120));

const q수면 = T.검색어_만들기("sleep", 7);
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

console.log(실패 === 0 ? "\n🎉 전체 통과 — 모든 검사 성공" : `\n⚠️  ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
