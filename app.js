/*
  ============================================================
  app.js  =  이 웹페이지의 "두뇌"
  ------------------------------------------------------------
  JavaScript(줄여서 JS)는 "무엇을 할지"를 적는 언어입니다.

  꼭 알아야 할 기본 3가지:

   1) const 이름 = 값;      -> 값에 이름을 붙여 저장 (상자에 이름표 붙이기)
   2) function 이름() { }   -> 여러 줄의 일을 하나로 묶어 이름을 붙인 것
                               이름()  이라고 부르면 그 안이 실행됩니다.
   3) // 이렇게 시작하는 줄은 주석이며 실행되지 않습니다.

  이 파일이 하는 일을 순서대로 적으면:
      (1) PubMed에 "이런 조건의 논문 찾아줘" 하고 물어본다
      (2) 받아온 논문 번호 목록에서 오늘 보여줄 3편을 고른다
      (3) 그 3편의 제목/저자/초록을 다시 받아온다
      (4) 화면에 카드로 그린다
  ============================================================
*/


/* ==========================================================
   [1] 설정값 — 나중에 바꾸고 싶으면 여기만 고치면 됩니다
   ========================================================== */

// 한 번에 보여줄 논문 편수
const 보여줄_편수 = 3;

// PubMed API의 기본 주소
const PUBMED_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/*
  신뢰할 만한 학술지 목록입니다.
  [] 로 감싸고 쉼표로 구분한 것을 "배열(목록)"이라고 부릅니다.

  이름은 PubMed가 쓰는 공식 약어입니다.
  학술지를 추가하고 싶으면 PubMed에서 논문 하나를 열어
  저널 약어를 확인한 뒤 아래에 한 줄 추가하시면 됩니다.
*/
const 정신의학_학술지 = [
  "Lancet Psychiatry",              // The Lancet Psychiatry
  "JAMA Psychiatry",
  "Am J Psychiatry",                // American Journal of Psychiatry
  "World Psychiatry",
  "Mol Psychiatry",                 // Molecular Psychiatry
  "Biol Psychiatry",                // Biological Psychiatry
  "Psychol Med",                    // Psychological Medicine
  "Schizophr Bull",                 // Schizophrenia Bulletin
  "Neuropsychopharmacology",
  "Br J Psychiatry",                // British Journal of Psychiatry
  "Transl Psychiatry",              // Translational Psychiatry
  "JAMA Netw Open",                 // JAMA Network Open
  "J Am Acad Child Adolesc Psychiatry",
  "Am J Geriatr Psychiatry",
  "Bipolar Disord",
  "J Affect Disord",                // Journal of Affective Disorders
  "Addiction",
  "Sleep",
  "Nat Ment Health",                // Nature Mental Health
];

/*
  종합 의학 학술지입니다.
  이곳에는 정신의학 외 논문도 많으므로,
  나중에 "정신건강 관련 주제"라는 조건을 함께 걸어줍니다.
*/
const 종합의학_학술지 = [
  "N Engl J Med",   // New England Journal of Medicine
  "Lancet",
  "JAMA",
  "BMJ",
  "Ann Intern Med",
];

// 종합 의학 학술지에서 정신건강 논문만 걸러내기 위한 단어들
const 정신건강_키워드 = [
  "mental health", "psychiatr*", "depress*", "anxiety", "schizophren*",
  "bipolar", "suicid*", "dementia", "cognitive impairment", "substance use",
  "alcohol use disorder", "opioid use disorder", "ADHD", "autism",
  "insomnia", "PTSD", "psychotherapy", "antidepressant", "antipsychotic",
];

/*
  화면에서 "관심 분야"를 고르면 여기에 맞는 단어들이 조건에 추가됩니다.
  { 이름: 값, 이름: 값 } 형태를 "객체"라고 부르며, 사전(dictionary)처럼 씁니다.
*/
const 분야별_키워드 = {
  all:       [],   // 빈 목록 = 추가 조건 없음 = 전체
  mood:      ["depress*", "anxiety", "major depressive disorder", "antidepressant", "mood disorder"],
  psychosis: ["schizophren*", "psychosis", "psychotic", "antipsychotic", "clozapine"],
  bipolar:   ["bipolar", "mania", "manic", "lithium", "mood stabilizer"],
  child:     ["child*", "adolescen*", "ADHD", "autism", "youth", "pediatric"],
  geriatric: ["dementia", "Alzheimer*", "late-life", "older adults", "cognitive decline", "geriatric"],
  addiction: ["substance use", "addiction", "alcohol", "opioid", "smoking cessation", "cannabis"],
  sleep:     ["insomnia", "sleep", "circadian", "sleep disorder"],
  trauma:    ["PTSD", "posttraumatic", "trauma*", "EMDR"],
};


/* ==========================================================
   [2] 화면의 각 부분을 찾아 이름표 붙여두기
   ------------------------------------------------------------
   document.getElementById("이름") = HTML에서 id가 "이름"인 곳을 찾아오기
   미리 찾아 저장해두면 아래에서 계속 꺼내 쓸 수 있습니다.
   ========================================================== */

const 논문목록_자리  = document.getElementById("paperList");
const 상태메시지_자리 = document.getElementById("statusBox");
const 오늘날짜_자리   = document.getElementById("todayLabel");
const 분야_선택창     = document.getElementById("topicSelect");
const 기간_선택창     = document.getElementById("daysSelect");
const 새로고침_버튼   = document.getElementById("refreshBtn");

/*
  "다른 논문 보기"를 누른 횟수를 세는 상자입니다.
  const 는 값을 바꿀 수 없지만, let 은 나중에 바꿀 수 있습니다.
*/
let 넘긴_횟수 = 0;


/* ==========================================================
   [3] 작은 도우미 함수들
   ========================================================== */

// 상태 메시지를 화면에 보여줍니다. (두 번째 값이 true면 오류 스타일)
function 상태표시(글, 오류인가 = false) {
  상태메시지_자리.textContent = 글;
  상태메시지_자리.className = 오류인가 ? "status error" : "status";
  상태메시지_자리.hidden = false;   // hidden 을 false 로 하면 화면에 나타납니다
}

// 상태 메시지를 숨깁니다.
function 상태숨김() {
  상태메시지_자리.hidden = true;
}

/*
  글자를 숫자로 바꾸는 아주 단순한 계산입니다.
  "2026-08-30" 같은 날짜를 넣으면 항상 같은 숫자가 나옵니다.
  덕분에 "같은 날에는 같은 논문 3편"이 보이게 됩니다.
*/
function 글자를_숫자로(글) {
  let 값 = 0;
  for (let i = 0; i < 글.length; i++) {
    // charCodeAt(i) = i번째 글자의 고유 번호
    값 = (값 * 31 + 글.charCodeAt(i)) % 1000000007;
  }
  return 값;
}

// 오늘 날짜를 "2026-08-30" 형태의 글자로 만듭니다.
function 오늘_날짜글자() {
  const 오늘 = new Date();                         // 지금 시각을 가져오기
  const 년 = 오늘.getFullYear();
  const 월 = String(오늘.getMonth() + 1).padStart(2, "0"); // 月은 0부터 시작해서 +1
  const 일 = String(오늘.getDate()).padStart(2, "0");      // padStart = 한 자리면 앞에 0 붙이기
  return `${년}-${월}-${일}`;      // 백틱 ` ` 안에서 ${ } 를 쓰면 값을 끼워넣을 수 있습니다
}

/*
  받아온 목록에서 오늘 보여줄 3편을 고릅니다.
  날짜를 기준으로 고르므로 하루 동안은 새로고침해도 같은 논문이 나오고,
  다음 날이 되면 자동으로 다른 논문이 나옵니다.

  ※ 여기서 학술지가 겹치지 않게 하는 것이 중요합니다.
     PubMed는 최신순으로 목록을 주는데, 한 학술지가 새 호를 통째로 등록하면
     그 학술지 논문이 목록에 연달아 붙어 나옵니다.
     특히 J Affect Disord 처럼 발행량이 많은 학술지는 최신 목록의 절반 이상을
     차지하기도 합니다. 그래서 목록에서 연속으로 3편을 뽑으면
     매일 같은 학술지만 보이게 됩니다.
     아래처럼 "이미 고른 학술지는 건너뛰기"만 해줘도 훨씬 다양해집니다.

  넘겨받는 것은 { pmid, 학술지 } 모양의 목록입니다.
*/
function 오늘의_논문_고르기(요약목록) {
  const 시작점 = 글자를_숫자로(오늘_날짜글자()) + 넘긴_횟수 * 보여줄_편수;
  const 고른것 = [];
  const 이미쓴학술지 = new Set();   // Set = 중복을 허용하지 않는 목록

  // 1차 — 학술지가 겹치지 않는 것만 고릅니다
  for (let i = 0; i < 요약목록.length && 고른것.length < 보여줄_편수; i++) {
    // % 는 나머지 연산입니다. 목록 끝에 도달하면 다시 처음으로 돌아갑니다.
    const 논문 = 요약목록[(시작점 + i) % 요약목록.length];
    if (이미쓴학술지.has(논문.학술지)) continue;   // continue = 건너뛰고 다음으로
    고른것.push(논문);
    이미쓴학술지.add(논문.학술지);
  }

  // 2차 — 학술지 종류가 3개도 안 될 만큼 적으면, 남은 것으로 채웁니다
  for (let i = 0; i < 요약목록.length && 고른것.length < 보여줄_편수; i++) {
    const 논문 = 요약목록[(시작점 + i) % 요약목록.length];
    if (고른것.includes(논문)) continue;
    고른것.push(논문);
  }

  return 고른것;
}


/* ==========================================================
   [4] PubMed에 보낼 "검색어" 만들기
   ------------------------------------------------------------
   PubMed는 특별한 문법을 씁니다.
       "JAMA Psychiatry"[jour]      -> 이 학술지에 실린 논문
       depression[tiab]             -> 제목이나 초록에 이 단어가 있는 논문
       OR / AND / NOT               -> 또는 / 그리고 / 제외
       "last 30 days"[dp]           -> 최근 30일 내 발표
   ========================================================== */

function 검색어_만들기(분야, 기간일수) {
  // .map() = 목록의 각 항목을 정해진 모양으로 바꾸기
  // .join(" OR ") = 바뀐 항목들을 " OR " 로 이어붙이기
  const 정신의학저널_조건 = 정신의학_학술지
    .map((이름) => `"${이름}"[jour]`)
    .join(" OR ");

  const 종합저널_조건 = 종합의학_학술지
    .map((이름) => `"${이름}"[jour]`)
    .join(" OR ");

  const 정신건강주제_조건 = 정신건강_키워드
    .map((단어) => `${단어}[tiab]`)
    .join(" OR ");

  // 조건 1: 정신의학 전문 학술지에 실린 논문
  // 조건 2: 종합 의학 학술지에 실렸으면서 정신건강 주제인 논문
  let 검색어 =
    `((${정신의학저널_조건}) OR ((${종합저널_조건}) AND (${정신건강주제_조건})))`;

  // 사용자가 특정 분야를 골랐다면 그 조건을 추가로 AND 로 묶습니다
  const 분야단어들 = 분야별_키워드[분야] || [];
  if (분야단어들.length > 0) {
    const 분야조건 = 분야단어들.map((단어) => `${단어}[tiab]`).join(" OR ");
    검색어 += ` AND (${분야조건})`;
  }

  // 발표 시기 제한
  검색어 += ` AND ("last ${기간일수} days"[dp])`;

  // 초록이 있는 논문만 (요약을 보여줘야 하므로)
  검색어 += ` AND hasabstract`;

  // 사설·독자편지·뉴스 등은 연구 논문이 아니므로 제외
  검색어 += ` NOT (editorial[pt] OR comment[pt] OR letter[pt] OR news[pt] OR "retracted publication"[pt])`;

  return 검색어;
}


/* ==========================================================
   [5] PubMed에서 자료 받아오기
   ------------------------------------------------------------
   async / await 가 나옵니다.
   인터넷에서 자료를 받아오는 일은 시간이 걸리기 때문에,
   "기다렸다가 다음 줄로 넘어가라"는 표시가 await 이고,
   await 을 쓰려면 함수 앞에 async 를 붙여야 합니다.
   ========================================================== */

// (1단계) 조건에 맞는 논문 "번호(PMID)" 목록을 받아옵니다
async function 논문번호_받아오기(검색어) {
  // encodeURIComponent = 한글이나 공백, 따옴표가 주소에 안전하게 들어가도록 변환
  const 주소 =
    `${PUBMED_API}/esearch.fcgi` +
    `?db=pubmed` +                             // pubmed 데이터베이스에서
    `&term=${encodeURIComponent(검색어)}` +     // 이 조건으로
    `&retmax=120` +                            // 최대 120개까지 (후보가 넓어야 학술지가 다양해집니다)
    `&sort=pub_date` +                         // 최신순으로 정렬
    `&retmode=json` +                          // 결과를 JSON 형식으로
    `&tool=psychiatry-daily-digest`;           // 우리 도구 이름 (NCBI 권장 사항)

  const 응답 = await fetch(주소);              // fetch = 인터넷에서 가져오기
  if (!응답.ok) {
    throw new Error(`PubMed 검색 실패 (응답 코드 ${응답.status})`);
  }
  const 자료 = await 응답.json();              // 받아온 것을 JS가 다룰 수 있는 형태로 변환
  return 자료.esearchresult.idlist || [];      // 논문 번호 목록만 꺼내 돌려주기
}

/*
  (2단계) 후보 논문들의 "학술지 이름"만 가볍게 받아옵니다.

  왜 따로 받아올까요?
    어떤 학술지의 논문인지는 번호(PMID)만 봐서는 알 수 없습니다.
    그렇다고 120편의 초록을 전부 받아오면 무겁고 느립니다.
    esummary 는 제목·학술지·날짜 정도만 주는 가벼운 창구라
    120편을 한 번에 받아도 부담이 없습니다.
    여기서 학술지를 확인해 3편을 고른 뒤, 그 3편의 초록만 받아옵니다.
*/
async function 논문요약_받아오기(번호목록) {
  const 주소 =
    `${PUBMED_API}/esummary.fcgi` +
    `?db=pubmed` +
    `&id=${번호목록.join(",")}` +
    `&retmode=json` +
    `&tool=psychiatry-daily-digest`;

  const 응답 = await fetch(주소);
  if (!응답.ok) {
    throw new Error(`논문 목록 정보 가져오기 실패 (응답 코드 ${응답.status})`);
  }
  const 자료 = await 응답.json();

  // source 항목에 학술지 약어가 들어 있습니다
  return 번호목록
    .map((pmid) => ({ pmid, 학술지: 자료.result?.[pmid]?.source || "" }))
    .filter((논문) => 논문.학술지 !== "");   // 정보가 없는 것은 제외
}

// (3단계) 고른 논문의 제목·저자·초록 등 상세 정보를 받아옵니다
async function 논문상세_받아오기(번호목록) {
  const 주소 =
    `${PUBMED_API}/efetch.fcgi` +
    `?db=pubmed` +
    `&id=${번호목록.join(",")}` +   // 번호들을 쉼표로 이어붙임: "123,456,789"
    `&retmode=xml` +               // 초록 전문은 XML 형식으로만 제공됩니다
    `&tool=psychiatry-daily-digest`;

  const 응답 = await fetch(주소);
  if (!응답.ok) {
    throw new Error(`논문 상세 정보 가져오기 실패 (응답 코드 ${응답.status})`);
  }
  const xml글자 = await 응답.text();

  // 받아온 XML 글자를 프로그램이 뒤져볼 수 있는 형태로 바꿉니다
  const 문서 = new DOMParser().parseFromString(xml글자, "text/xml");

  // querySelectorAll = 조건에 맞는 것을 전부 찾기 -> Array.from 으로 다루기 쉬운 목록으로 변환
  return Array.from(문서.querySelectorAll("PubmedArticle")).map(논문정보_정리);
}


/* ==========================================================
   [6] XML에서 필요한 내용만 뽑아 정리하기
   ========================================================== */

function 논문정보_정리(논문) {
  // 작은 도우미: 태그를 찾아 그 안의 글자를 꺼내되, 없으면 빈 글자를 돌려줍니다
  const 글자꺼내기 = (선택자) => 논문.querySelector(선택자)?.textContent?.trim() || "";

  const pmid   = 글자꺼내기("MedlineCitation > PMID");
  const 제목   = 글자꺼내기("ArticleTitle");
  const 학술지 = 글자꺼내기("Journal ISOAbbreviation") || 글자꺼내기("Journal Title");

  // --- 저자 정리: 3명까지만 쓰고 나머지는 "et al." 로 줄입니다 ---
  const 저자들 = Array.from(논문.querySelectorAll("AuthorList > Author"))
    .map((저자) => {
      const 성   = 저자.querySelector("LastName")?.textContent || "";
      const 이니셜 = 저자.querySelector("Initials")?.textContent || "";
      return 성 ? `${성} ${이니셜}`.trim() : "";
    })
    .filter((이름) => 이름 !== "");   // filter = 조건에 맞는 것만 남기기 (빈 이름 제거)

  const 저자표기 =
    저자들.length === 0 ? "저자 정보 없음"
    : 저자들.length <= 3 ? 저자들.join(", ")
    : `${저자들.slice(0, 3).join(", ")}, et al.`;

  // --- 발표일 ---
  const 연 = 글자꺼내기("PubDate Year") || 글자꺼내기("ArticleDate Year");
  const 월 = 글자꺼내기("PubDate Month") || 글자꺼내기("ArticleDate Month");
  const 발표일 = [연, 월].filter(Boolean).join(". ") || "발표일 미상";

  // --- 초록: 여러 문단으로 나뉘어 있고 각 문단에 Label(배경/방법/결과/결론)이 붙기도 합니다 ---
  const 초록문단들 = Array.from(논문.querySelectorAll("Abstract > AbstractText")).map((문단) => ({
    label: 문단.getAttribute("Label") || "",   // getAttribute = 태그의 속성값 읽기
    text:  문단.textContent.trim(),
  }));

  // --- 핵심 결론 뽑아내기 ---
  // 결론에 해당하는 Label 을 먼저 찾고, 없으면 마지막 문단을 씁니다.
  const 결론라벨 = ["CONCLUSION", "CONCLUSIONS", "INTERPRETATION",
                    "CONCLUSIONS AND RELEVANCE", "DISCUSSION"];
  const 결론문단 =
    초록문단들.find((문단) => 결론라벨.includes(문단.label.toUpperCase())) ||
    초록문단들[초록문단들.length - 1];

  let 핵심 = 결론문단 ? 결론문단.text : "";
  // 결론이 너무 길면 앞부분만 잘라 보여줍니다
  if (핵심.length > 420) 핵심 = 핵심.slice(0, 420).trim() + "…";

  // --- DOI (논문의 고유 주소) ---
  const doi =
    논문.querySelector('ArticleId[IdType="doi"]')?.textContent?.trim() ||
    논문.querySelector('ELocationID[EIdType="doi"]')?.textContent?.trim() ||
    "";

  // 정리한 내용을 하나의 객체로 묶어 돌려줍니다
  return { pmid, 제목, 학술지, 저자표기, 발표일, 초록문단들, 핵심, doi };
}


/* ==========================================================
   [7] 화면에 그리기
   ========================================================== */

/*
  주의! 논문 제목이나 초록에는 < > & 같은 기호가 들어있을 수 있습니다.
  이걸 그대로 화면에 넣으면 HTML 태그로 잘못 해석되어 화면이 깨집니다.
  그래서 안전한 글자로 바꿔주는 과정이 꼭 필요합니다.
*/
function 안전한글자로(글) {
  return String(글)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// 논문 하나를 카드 모양 HTML 글자로 만듭니다
function 카드_만들기(논문) {
  // 초록 전문을 문단별로 조립합니다
  const 초록HTML = 논문.초록문단들
    .map((문단) => {
      const 제목줄 = 문단.label ? `<h4>${안전한글자로(문단.label)}</h4>` : "";
      return `${제목줄}<p>${안전한글자로(문단.text)}</p>`;
    })
    .join("");

  // DOI가 있을 때만 링크 버튼을 만듭니다 (없으면 빈 글자)
  const doi버튼 = 논문.doi
    ? `<a class="btn-small" href="https://doi.org/${안전한글자로(논문.doi)}"
          target="_blank" rel="noopener">출판사 원문</a>`
    : "";

  return `
    <article class="paper">
      <div class="paper-meta">
        <span class="journal">${안전한글자로(논문.학술지)}</span>
        <span>${안전한글자로(논문.발표일)}</span>
        <span>· PMID ${안전한글자로(논문.pmid)}</span>
      </div>

      <h2>${안전한글자로(논문.제목)}</h2>
      <p class="authors">${안전한글자로(논문.저자표기)}</p>

      <div class="takeaway">
        <span class="takeaway-label">핵심 결론</span>
        <p>${안전한글자로(논문.핵심 || "초록에서 결론 문단을 찾지 못했습니다. 아래에서 전문을 확인해 주세요.")}</p>
      </div>

      <details class="abstract">
        <summary>초록 전문 보기</summary>
        <div class="abstract-body">${초록HTML}</div>
      </details>

      <div class="paper-actions">
        <a class="btn-small" href="https://pubmed.ncbi.nlm.nih.gov/${안전한글자로(논문.pmid)}/"
           target="_blank" rel="noopener">PubMed에서 보기</a>
        ${doi버튼}
        <button class="btn-small" type="button" data-copy="${안전한글자로(논문.pmid)}">
          인용 정보 복사
        </button>
      </div>
    </article>
  `;
}


/* ==========================================================
   [8] 전체를 순서대로 실행하는 함수
   ========================================================== */

async function 논문_불러오기() {
  새로고침_버튼.disabled = true;              // 불러오는 동안 버튼 잠그기 (중복 클릭 방지)
  논문목록_자리.innerHTML = "";               // 이전 결과 지우기
  상태표시("PubMed에서 논문을 찾는 중입니다…");

  // try / catch = "일단 해보고, 문제가 생기면 catch 쪽으로 넘어가라"
  try {
    const 분야   = 분야_선택창.value;          // .value = 선택창에서 고른 값
    const 기간   = 기간_선택창.value;
    const 검색어 = 검색어_만들기(분야, 기간);

    const 번호목록 = await 논문번호_받아오기(검색어);

    if (번호목록.length === 0) {
      상태표시("조건에 맞는 논문이 없습니다. 기간을 늘리거나 분야를 '전체'로 바꿔보세요.", true);
      return;   // return = 여기서 함수를 끝내기
    }

    // 학술지 이름을 먼저 확인한 뒤, 학술지가 겹치지 않게 3편을 고릅니다
    const 요약목록 = await 논문요약_받아오기(번호목록);
    const 오늘의논문 = 오늘의_논문_고르기(요약목록);
    const 논문들 = await 논문상세_받아오기(오늘의논문.map((논문) => 논문.pmid));

    // .map() 으로 각 논문을 카드 HTML로 바꾼 뒤 .join("") 으로 이어붙여 한 번에 넣습니다
    논문목록_자리.innerHTML = 논문들.map(카드_만들기).join("");

    상태숨김();
    const 학술지수 = new Set(요약목록.map((논문) => 논문.학술지)).size;
    오늘날짜_자리.textContent =
      `${오늘_날짜글자()} 기준 · ${학술지수}개 학술지의 ${번호목록.length}편 중 ` +
      `${논문들.length}편 선정 (학술지가 겹치지 않게)`;

  } catch (오류) {
    // 무슨 문제가 생겼는지 콘솔(개발자 도구)에도 남겨둡니다
    console.error(오류);
    상태표시(
      `논문을 불러오지 못했습니다.\n\n` +
      `확인해 보실 점:\n` +
      `1. 인터넷 연결이 되어 있는지\n` +
      `2. 잠시 후 다시 시도 (PubMed가 일시적으로 혼잡할 수 있습니다)\n` +
      `3. 회사·병원 내부망이라면 외부 접속이 차단되었을 수 있습니다\n\n` +
      `기술적 오류 내용: ${오류.message}`,
      true
    );
  } finally {
    // finally = 성공하든 실패하든 마지막에 반드시 실행
    새로고침_버튼.disabled = false;   // 버튼 다시 풀기
  }
}


/* ==========================================================
   [9] 사용자 동작에 반응하기
   ------------------------------------------------------------
   addEventListener("동작", 할일) = "이 동작이 일어나면 이 일을 해라"
   ========================================================== */

// "다른 논문 보기" 버튼을 누르면 -> 다음 3편을 보여줍니다
새로고침_버튼.addEventListener("click", () => {
  넘긴_횟수 = 넘긴_횟수 + 1;
  논문_불러오기();
});

// 분야나 기간을 바꾸면 -> 처음부터 다시 불러옵니다
분야_선택창.addEventListener("change", () => {
  넘긴_횟수 = 0;
  논문_불러오기();
});
기간_선택창.addEventListener("change", () => {
  넘긴_횟수 = 0;
  논문_불러오기();
});

/*
  "인용 정보 복사" 버튼 처리.
  카드는 나중에 만들어지므로 버튼에 직접 연결할 수 없습니다.
  그래서 목록 전체에 한 번만 연결해두고, 클릭된 것이 복사 버튼인지 확인합니다.
*/
논문목록_자리.addEventListener("click", async (사건) => {
  const 버튼 = 사건.target.closest("[data-copy]");  // closest = 클릭 지점에서 위로 올라가며 찾기
  if (!버튼) return;                                 // 복사 버튼이 아니면 아무것도 안 함

  const 카드 = 버튼.closest(".paper");
  const 인용문 =
    `${카드.querySelector("h2").textContent.trim()}\n` +
    `${카드.querySelector(".authors").textContent.trim()}\n` +
    `${카드.querySelector(".journal").textContent.trim()}\n` +
    `https://pubmed.ncbi.nlm.nih.gov/${버튼.dataset.copy}/`;

  try {
    await navigator.clipboard.writeText(인용문);   // 클립보드에 복사
    const 원래글자 = 버튼.textContent;
    버튼.textContent = "복사됨 ✓";
    // setTimeout(할일, 밀리초) = 정해진 시간 뒤에 실행
    setTimeout(() => { 버튼.textContent = 원래글자; }, 1500);
  } catch {
    버튼.textContent = "복사 실패";
  }
});


/* ==========================================================
   [10] 페이지가 열리면 바로 한 번 실행
   ========================================================== */
논문_불러오기();
