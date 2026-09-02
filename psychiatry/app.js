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
  학술지 등급표 — 1등급(보통)부터 5등급(최상위)까지

  왜 IF(Impact Factor) 숫자를 그대로 쓰지 않나요?
    IF는 Clarivate 라는 회사의 유료 데이터라서 무료로 가져올 수 없고,
    수치를 그대로 옮겨 적는 것도 라이선스 문제가 있습니다.
    PubMed 역시 IF 정보를 주지 않습니다.
    그래서 학술지의 대략적인 위상을 등급으로 나누어 직접 적어두었습니다.

  ※ 이 등급은 절대적인 기준이 아닙니다.
     전공자이신 선생님의 판단이 더 정확할 수 있으니 자유롭게 고치세요.
     숫자를 올리면 그 학술지 논문이 더 자주 보이고, 내리면 덜 보입니다.
     목록에 없는 학술지는 자동으로 1등급이 됩니다.
*/
const 학술지_등급 = {
  // 5등급 — 종합의학 최상위 및 정신의학 최고 권위지
  "N Engl J Med": 5,
  "Lancet": 5,
  "JAMA": 5,
  "BMJ": 5,
  "Ann Intern Med": 5,
  "World Psychiatry": 5,

  // 4등급 — 정신의학 최상위
  "Lancet Psychiatry": 4,
  "JAMA Psychiatry": 4,
  "Am J Psychiatry": 4,
  "Mol Psychiatry": 4,
  "Nat Ment Health": 4,

  // 3등급 — 상위
  "Biol Psychiatry": 3,
  "Br J Psychiatry": 3,
  "Neuropsychopharmacology": 3,
  "JAMA Netw Open": 3,
  "Schizophr Bull": 3,

  // 2등급 — 중상위
  "Psychol Med": 2,
  "Transl Psychiatry": 2,
  "J Am Acad Child Adolesc Psychiatry": 2,
  "Addiction": 2,
  "Sleep": 2,
  "Bipolar Disord": 2,
  "Am J Geriatr Psychiatry": 2,

  // 1등급 — 그 외 (여기 없는 학술지는 모두 1등급)
  "J Affect Disord": 1,
};

// 등급표에서 등급을 꺼냅니다. 목록에 없으면 1등급입니다.
function 학술지_등급_가져오기(이름) {
  return 학술지_등급[이름] || 1;
}

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
const 우선순위_선택창 = document.getElementById("rankSelect");
const 새로고침_버튼   = document.getElementById("refreshBtn");
const 북마크_버튼     = document.getElementById("bookmarkBtn");

/*
  "다른 논문 보기"를 누른 횟수를 세는 상자입니다.
  const 는 값을 바꿀 수 없지만, let 은 나중에 바꿀 수 있습니다.
*/
let 넘긴_횟수 = 0;

// 지금 화면에 무엇을 보여주고 있는지 — "오늘" 또는 "북마크"
let 보기모드 = "오늘";

// 지금 화면에 떠 있는 논문들. 저장 버튼을 눌렀을 때 정보를 찾기 위해 보관합니다.
let 현재_논문들 = [];


/* ==========================================================
   [2-2] 저장한 논문(북마크) 다루기
   ------------------------------------------------------------
   localStorage = 브라우저가 제공하는 작은 저장 공간입니다.
   이 기기의 이 브라우저에만 저장되며, 창을 닫아도 남아 있습니다.
   서버로 전송되지 않으므로 다른 사람은 볼 수 없습니다.

   주의: 사생활 보호 모드이거나 브라우저 설정에 따라 저장이 막힐 수 있어서,
   읽고 쓰는 모든 곳을 try/catch 로 감싸야 합니다. 그렇지 않으면
   저장이 막힌 순간 페이지 전체가 멈춥니다.
   ========================================================== */

const 북마크_보관함_이름 = "psychiatry-digest-bookmarks";

// 저장해둔 논문 목록을 불러옵니다. 문제가 생기면 빈 목록을 돌려줍니다.
function 북마크_불러오기() {
  try {
    const 글 = localStorage.getItem(북마크_보관함_이름);
    const 목록 = 글 ? JSON.parse(글) : [];
    return Array.isArray(목록) ? 목록 : [];
  } catch {
    return [];
  }
}

// 목록을 저장합니다. 성공하면 true 를 돌려줍니다.
function 북마크_저장하기(목록) {
  try {
    localStorage.setItem(북마크_보관함_이름, JSON.stringify(목록));
    return true;
  } catch {
    return false;
  }
}

function 북마크에_있나(pmid) {
  return 북마크_불러오기().some((논문) => 논문.pmid === pmid);
}

// 화면 위쪽 버튼의 글자를 지금 상황에 맞게 바꿉니다
function 북마크_버튼_갱신() {
  if (!북마크_버튼) return;
  if (보기모드 === "북마크") {
    북마크_버튼.textContent = "오늘의 논문 보기";
    북마크_버튼.classList.add("active");
  } else {
    const 개수 = 북마크_불러오기().length;
    북마크_버튼.textContent = 개수 > 0 ? `저장한 논문 ${개수}` : "저장한 논문";
    북마크_버튼.classList.remove("active");
  }
}

/*
  저장 버튼을 눌렀을 때: 이미 저장돼 있으면 빼고, 없으면 넣습니다.
  돌려주는 값은 저장된 상태인지 여부입니다.
*/
function 북마크_넣고빼기(논문) {
  const 목록 = 북마크_불러오기();
  const 자리 = 목록.findIndex((항목) => 항목.pmid === 논문.pmid);

  if (자리 >= 0) {
    목록.splice(자리, 1);              // splice = 해당 위치의 항목을 빼내기
    북마크_저장하기(목록);
    북마크_버튼_갱신();
    return false;
  }

  // 화면에 다시 그릴 때 필요한 정보만 골라 저장합니다 (초록 전문은 용량이 커서 제외)
  목록.unshift({
    pmid: 논문.pmid,
    제목: 논문.제목,
    학술지: 논문.학술지,
    저자표기: 논문.저자표기,
    발표일: 논문.발표일,
    핵심: 논문.핵심,
    핵심출처: 논문.핵심출처,
    doi: 논문.doi,
    저장일: 오늘_날짜글자(),
  });
  const 됐나 = 북마크_저장하기(목록);
  북마크_버튼_갱신();
  if (!됐나) {
    상태표시("저장 공간을 쓸 수 없습니다. 브라우저의 사생활 보호 모드에서는 저장이 안 됩니다.", true);
  }
  return 됐나;
}


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
  학술지 목록을 날짜에 따라 뒤섞습니다.

  왜 필요할까요?
    그냥 목록 순서대로 고르면, 논문을 많이 내는 학술지가 목록 앞쪽을 차지해
    매일 1번 자리에 같은 학술지가 나옵니다.
    반대로 Lancet Psychiatry 나 JAMA Psychiatry 처럼 권위는 높지만
    발행 편수가 적은 학술지는 계속 뒤로 밀립니다.

  그래서 학술지마다 점수를 매겨 정렬하되, 그 점수가 날짜에 따라 달라지게 합니다.
  같은 날에는 항상 같은 순서가 나오고, 날이 바뀌면 순서도 바뀝니다.
  발행량과 무관하게 모든 학술지가 공평하게 앞자리에 올 기회를 갖습니다.

  ※ 점수를 만들 때 "이름 + 날짜" 처럼 이어붙이면 안 됩니다.
     그러면 모든 학술지에 같은 값이 더해질 뿐이라 순서가 그대로 유지되어,
     날짜가 바뀌어도 늘 같은 학술지만 뽑히게 됩니다. (실제로 그런 실수가 있었습니다)
     더하기가 아니라 곱하기로 섞어야 순서가 제대로 흐트러집니다.
*/
/*
  학술지 이름과 날짜를 섞어 0 이상 1 미만의 값을 만듭니다.
  제비뽑기에서 "뽑은 수"에 해당합니다.

  ※ 여기서 계산 방식이 중요합니다.
     날짜가 하루 넘어가면 "2026-09-01" -> "2026-09-02" 처럼 글자 하나만 바뀌어,
     단순한 계산으로는 결과값도 조금밖에 변하지 않습니다.
     그러면 어떤 학술지는 1년 내내 낮은 값만 나와 거의 보이지 않게 됩니다.
     (실제로 Lancet Psychiatry 가 다른 학술지의 1/4 밖에 안 나오는 문제가 있었습니다)

     아래는 FNV-1a 라는, 널리 쓰이는 해시 방식입니다.
     글자 하나만 달라져도 결과가 완전히 달라지도록 설계되어 있습니다.
     365일치로 확인한 결과 모든 학술지가 고르게 등장합니다.
*/
function 섞기값(이름, 시드) {
  const 글 = 시드 + "#" + 이름;      // 날짜를 앞에 두어야 이후 계산 전체가 달라집니다
  let h = 2166136261;
  for (let i = 0; i < 글.length; i++) {
    h ^= 글.charCodeAt(i);           // ^ 는 비트를 뒤집어 섞는 연산입니다
    h = Math.imul(h, 16777619);      // Math.imul = 큰 수를 정확히 곱하는 함수
  }
  // 마지막으로 비트를 한 번 더 흩뜨려 고르게 만듭니다
  h ^= h >>> 16; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;     // 0 이상 1 미만
}

function 학술지_순서_섞기(학술지들, 시드, 등급반영 = true) {
  return [...학술지들]
    .map((이름) => {
      const 뽑은수 = 섞기값(이름, 시드);

      /*
        등급을 반영합니다.
        제비를 등급 수만큼 넣는 것과 같은 효과를 내는 계산입니다.
        5등급은 1등급보다 앞자리에 올 확률이 훨씬 높아지지만,
        어디까지나 확률이라 낮은 등급도 이따금 앞에 옵니다. 다양성이 유지됩니다.
      */
      const 등급 = 등급반영 ? 학술지_등급_가져오기(이름) : 1;
      return { 이름, 점수: Math.pow(뽑은수, 1 / 등급) };
    })
    .sort((가, 나) => 나.점수 - 가.점수)      // 점수가 큰 것부터
    .map((항목) => 항목.이름);
}

/*
  오늘 보여줄 3편을 고릅니다.
  날짜를 기준으로 고르므로 하루 동안은 새로고침해도 같은 논문이 나오고,
  다음 날이 되면 자동으로 다른 논문이 나옵니다.

  ※ 서로 다른 3개 학술지에서 한 편씩 뽑는 것이 핵심입니다.
     PubMed는 최신순으로 목록을 주는데, 한 학술지가 새 호를 통째로 등록하면
     그 학술지 논문이 목록에 덩어리로 붙어 나옵니다.
     특히 J Affect Disord 처럼 발행량이 많은 학술지는 최신 목록의 절반 이상을
     차지하기도 합니다. 목록 순서대로 뽑으면 매일 같은 학술지만 보이게 됩니다.

  넘겨받는 것은 { pmid, 학술지 } 모양의 목록입니다.
*/
function 오늘의_논문_고르기(요약목록) {
  const 시드 = 글자를_숫자로(오늘_날짜글자()) + 넘긴_횟수 * 보여줄_편수;

  // 1) 학술지별로 논문을 묶습니다.
  //    Map = 이름표를 붙여 값을 보관하는 상자입니다. 여기서는 학술지명 -> 논문 목록
  const 학술지별 = new Map();
  for (const 논문 of 요약목록) {
    if (!학술지별.has(논문.학술지)) 학술지별.set(논문.학술지, []);
    학술지별.get(논문.학술지).push(논문);
  }

  // 2) 학술지 순서를 날짜에 따라 섞습니다 (발행량 많은 곳이 늘 1등이 되지 않도록)
  //    화면에서 "골고루 보기"를 고르면 등급을 반영하지 않습니다.
  const 등급반영 = 우선순위_선택창 ? 우선순위_선택창.value === "rank" : true;
  const 섞인학술지 = 학술지_순서_섞기([...학술지별.keys()], 시드, 등급반영);

  // 3) 앞에서부터 학술지를 하나씩 골라, 그 학술지 안에서 논문 한 편을 뽑습니다
  const 고른것 = [];
  for (const 학술지 of 섞인학술지) {
    if (고른것.length >= 보여줄_편수) break;
    const 그학술지_논문들 = 학술지별.get(학술지);
    고른것.push(그학술지_논문들[(시드 + 고른것.length) % 그학술지_논문들.length]);
  }

  // 4) 학술지 종류가 3개도 안 될 만큼 적으면, 남은 논문으로 채웁니다
  for (let i = 0; i < 요약목록.length && 고른것.length < 보여줄_편수; i++) {
    const 논문 = 요약목록[(시드 + i) % 요약목록.length];
    if (고른것.includes(논문)) continue;
    고른것.push(논문);
  }

  return 고른것;
}


/*
  마침표로 끝나지만 문장이 끝난 것이 아닌 표현들입니다.
  논문 초록에 자주 나오므로 걸러주지 않으면 문장이 엉뚱하게 잘립니다.
  마지막의 \b[A-Z]\. 는 "J. Smith" 같은 이름 이니셜을 뜻합니다.
*/
const 약어_끝 =
  /(\b(et al|vs|cf|e\.g|i\.e|etc|Fig|Ref|Eq|Dr|Prof|No|approx|ca|Inc|Ltd|St|Mr|Ms|Mrs|Jr|Sr)|\b[A-Z])\.$/i;

/*
  영어 글을 문장 단위로 나눕니다.

  단순히 마침표로 자르면 "et al." "vs." "Fig. 2" 같은 약어에서 잘못 끊깁니다.
  그래서 두 가지 조건을 함께 봅니다.
    (1) 마침표 다음에 공백이 오고, 그 다음이 대문자나 숫자일 것
    (2) 마침표 앞이 위에 적어둔 약어가 아닐 것
*/
function 문장으로_나누기(글) {
  const 문장들 = [];
  let 시작 = 0;
  for (let i = 0; i < 글.length; i++) {
    if (!".!?".includes(글[i])) continue;

    const 조각 = 글.slice(시작, i + 1).trim();
    // 약어로 끝나면 아직 문장이 끝나지 않은 것입니다
    if (글[i] === "." && 약어_끝.test(조각)) continue;

    const 뒤 = 글.slice(i + 1);
    const 문장끝인가 = /^\s+["'(\[]?[A-Z0-9]/.test(뒤) || i === 글.length - 1;
    if (!문장끝인가) continue;

    if (조각) 문장들.push(조각);
    시작 = i + 1;
  }
  const 남은것 = 글.slice(시작).trim();
  if (남은것) 문장들.push(남은것);
  return 문장들;
}

// 문장들을 앞에서부터 담되, 정해진 길이를 넘지 않게 합니다 (문장 중간에서 자르지 않기 위해서)
function 길이맞춰_잇기(문장들, 최대길이) {
  const 담은것 = [];
  let 길이 = 0;
  for (const 문장 of 문장들) {
    if (담은것.length > 0 && 길이 + 문장.length > 최대길이) break;
    담은것.push(문장);
    길이 += 문장.length + 1;
  }
  return 담은것.join(" ");
}

/*
  PubMed 초록에는 수식이나 기호가 [Formula: see text] 같은 자리표시자로 바뀌어 들어옵니다.
  화면에 그대로 두면 읽기만 어지러우므로 지웁니다.
*/
function 자리표시자_지우기(글) {
  return String(글)
    .replace(/\[(Formula|Image|Figure|See figure|Table): see text\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/*
  결론으로 쓸 만한 문장인지 판단합니다.

  왜 필요한가요?
    초록 맨 끝에 결론이 아닌 것이 붙는 학술지가 있습니다.
    예를 들어 Annals of Internal Medicine 의 ACP Journal Club 은
    편집자 평가 별점표를 끝에 붙이는데, PubMed 에서는 이렇게 보입니다.
        "GIM/FP/GP: [Formula: see text] Public Health: [Formula: see text]"
    단순히 "마지막 문장"을 가져오면 이런 것이 결론으로 잡힙니다.
    실제 문장이라면 소문자 단어가 여럿 들어 있다는 점을 이용해 걸러냅니다.
*/
function 결론으로_쓸만한가(문장) {
  const 정리 = 자리표시자_지우기(문장);
  if (정리.length < 40) return false;
  const 소문자단어 = 정리.match(/\b[a-z]{3,}\b/g) || [];
  return 소문자단어.length >= 4;
}

/*
  초록 본문 안에서 "여기부터 결론"임을 알려주는 표현들입니다.
  라벨이 없는 한 덩어리 초록에서 결론을 찾아내는 데 씁니다.
*/
const 결론_시작표현 = [
  /\bin conclusions?\b/i,
  /\bconclusions?\s*[:.\-–—]/i,
  /\bin summary\b/i,
  /\btaken together\b/i,
  /\bcollectively\b/i,
  /\boverall,/i,
  /\bthese (findings|results|data|observations)\s+(suggest|indicate|highlight|support|demonstrate|provide|underscore)/i,
  /\bour (findings|results|data)\s+(suggest|indicate|highlight|support|demonstrate|provide|underscore)/i,
  /\bthis (study|trial|analysis|review)\s+(suggests|indicates|demonstrates|provides|highlights|supports)/i,
  /\bthe (findings|results)\s+(suggest|indicate|highlight|support)/i,
];

/*
  초록에서 '핵심 결론'을 뽑아냅니다.
  돌려주는 것: { 글, 출처 }  — 출처는 어떻게 찾았는지를 화면에 알려주기 위한 것입니다.

  왜 이렇게 복잡한가요?
    초록에는 두 가지 형태가 있습니다.
      (1) BACKGROUND / METHODS / CONCLUSIONS 처럼 항목이 나뉜 것
      (2) 항목 구분 없이 한 덩어리로 이어진 것  ← 이런 저널이 많습니다
    (2)의 경우 "마지막 문단"을 쓰면 초록 전체가 잡히고,
    앞에서부터 잘라내면 결론이 아니라 도입부가 나옵니다.
    실제로 그런 문제가 있었습니다.
*/
function 핵심결론_뽑기(초록문단들) {
  const 최대길이 = 420;
  if (초록문단들.length === 0) return { 글: "", 출처: "" };

  // (1) 항목이 나뉜 초록 — 결론에 해당하는 항목을 찾습니다.
  //     확실한 것부터 순서대로 찾습니다.
  const 라벨_우선순위 = [
    (라벨) => /CONCLUSION|INTERPRETATION/.test(라벨),
    (라벨) => /IMPLICATION|SIGNIFICANCE|SUMMARY/.test(라벨),
    (라벨) => /DISCUSSION/.test(라벨),
  ];
  for (const 조건 of 라벨_우선순위) {
    const 찾은것 = 초록문단들.find((문단) => 문단.label && 조건(문단.label.toUpperCase()));
    if (찾은것) {
      const 정리 = 자리표시자_지우기(찾은것.text);
      return {
        글: 길이맞춰_잇기(문장으로_나누기(정리), 최대길이) || 정리.slice(0, 최대길이),
        출처: 찾은것.label,
      };
    }
  }

  // (2) 한 덩어리 초록 — 전체를 이어붙인 뒤 결론 부분을 찾습니다.
  const 전체 = 자리표시자_지우기(초록문단들.map((문단) => 문단.text).join(" "));
  const 문장들 = 문장으로_나누기(전체);

  // (2-a) "In conclusion" 같은 표현이 나오는 문장부터 끝까지
  for (let i = 0; i < 문장들.length; i++) {
    if (!결론_시작표현.some((표현) => 표현.test(문장들[i]))) continue;
    // 결론이 초록 맨 앞에 있을 리는 없으므로, 앞쪽 1/3 구간의 것은 무시합니다
    if (i < Math.floor(문장들.length / 3)) continue;
    const 담을것 = 문장들.slice(i).filter(결론으로_쓸만한가);
    if (담을것.length > 0) {
      return { 글: 길이맞춰_잇기(담을것, 최대길이), 출처: "본문에서 찾음" };
    }
  }

  /*
    (2-b) 표현을 못 찾으면 마지막 문장들을 씁니다. 결론은 대개 끝에 있습니다.
    단, 편집자 평가표처럼 결론이 아닌 꼬리표는 건너뜁니다.
  */
  const 쓸만한문장들 = 문장들.filter(결론으로_쓸만한가);
  if (쓸만한문장들.length === 0) return { 글: "", 출처: "" };

  const 뒤에서부터 = [];
  let 길이 = 0;
  for (let i = 쓸만한문장들.length - 1; i >= 0; i--) {
    if (뒤에서부터.length > 0 && 길이 + 쓸만한문장들[i].length > 최대길이) break;
    뒤에서부터.unshift(쓸만한문장들[i]);
    길이 += 쓸만한문장들[i].length + 1;
    if (뒤에서부터.length >= 2) break;      // 결론은 보통 마지막 한두 문장입니다
  }
  return { 글: 뒤에서부터.join(" "), 출처: "초록 마지막 부분" };
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

function 검색어_만들기(분야) {
  // .map() = 목록의 각 항목을 정해진 모양으로 바꾸기
  // .join(" OR ") = 바뀐 항목들을 " OR " 로 이어붙이기
  const 정신의학저널_조건 = 정신의학_학술지
    .map((이름) => `"${이름}"[jour]`)
    .join(" OR ");

  const 종합저널_조건 = 종합의학_학술지
    .map((이름) => `"${이름}"[jour]`)
    .join(" OR ");

  /*
    종합 의학 학술지에는 정신의학과 무관한 논문이 훨씬 많습니다.
    그래서 정신건강 주제인지를 따로 확인하는데, 이 조건을 '제목'에서만 봅니다.

    ※ 예전에는 초록까지 함께 봤습니다([tiab]). 그랬더니 정신의학 논문이 아닌데도
       초록 어딘가에 단어 하나만 스치면 통과했습니다.
       실제로 NEJM 의 스타틴(atorvastatin) 임상시험이 올라왔는데,
       일차 결과가 '치매·장애 없는 생존'이라 초록에 dementia 가 들어 있었을 뿐
       내용은 심혈관 예방 연구였습니다.

       종합지에 실리는 정신건강 논문은 거의 언제나 제목에 그 주제가 드러납니다.
       그래서 제목([ti])만 보도록 좁혔습니다. 정신의학 전문지 18곳은
       이 조건과 무관하게 그대로 들어오므로 후보가 크게 줄지 않습니다.
  */
  const 정신건강주제_조건 = 정신건강_키워드
    .map((단어) => `${단어}[ti]`)
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

  // 기간 조건은 여기에 넣지 않습니다.
  // [dp](발행일)는 저널 호 배정일이라 미래 날짜가 붙는 경우가 많아,
  // 아래 논문번호_받아오기() 에서 'PubMed 등록일' 기준으로 따로 지정합니다.

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
/*
  ※ 여기서 '최근'의 기준이 중요합니다.

  PubMed 에는 날짜가 두 가지 있습니다.
    발행일(publication date) — 저널 호에 배정된 날짜. **미래 날짜인 경우가 많습니다.**
                               월간지는 온라인 공개 후 몇 달 뒤 호에 배정되기 때문입니다.
    등록일(Entrez date)      — PubMed 에 실제로 올라온 날짜.

  발행일로 정렬하면 미래 날짜를 크게 붙이는 학술지가 목록 위쪽을 독차지합니다.
  실제로 그 탓에 120편이 단 두 학술지에서만 나온 적이 있습니다.
  그래서 datetype=edat 으로 등록일 기준을 쓰고, 정렬은 기본값(최근 등록순)에 맡깁니다.
*/
async function 논문번호_받아오기(검색어, 기간일수) {
  // encodeURIComponent = 한글이나 공백, 따옴표가 주소에 안전하게 들어가도록 변환
  const 주소 =
    `${PUBMED_API}/esearch.fcgi` +
    `?db=pubmed` +                             // pubmed 데이터베이스에서
    `&term=${encodeURIComponent(검색어)}` +     // 이 조건으로
    `&retmax=120` +                            // 최대 120개까지 (후보가 넓어야 학술지가 다양해집니다)
    `&datetype=edat` +                         // 날짜 기준: PubMed 등록일
    `&reldate=${기간일수}` +                    // 최근 며칠 이내
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
  // ArticleDate 는 '온라인에 공개된 날', PubDate 는 '저널 호에 배정된 날' 입니다.
  // 후자는 미래 날짜인 경우가 많아, 실제 공개일인 ArticleDate 를 먼저 씁니다.
  const 연 = 글자꺼내기("ArticleDate Year") || 글자꺼내기("PubDate Year");
  let 월 = 글자꺼내기("ArticleDate Month") || 글자꺼내기("PubDate Month");

  // ArticleDate 의 월은 "11" 같은 숫자, PubDate 는 "Nov" 같은 글자입니다.
  // 보기 좋게 글자 형태로 통일합니다.
  const 월이름 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (/^\d+$/.test(월)) 월 = 월이름[Number(월) - 1] || 월;

  const 발표일 = [연, 월].filter(Boolean).join(". ") || "발표일 미상";

  // --- 초록: 여러 문단으로 나뉘어 있고 각 문단에 Label(배경/방법/결과/결론)이 붙기도 합니다 ---
  /*
    초록은 보통 <Abstract> 안에 있지만, 출판사가 따로 제공한 초록이
    <OtherAbstract> 에만 들어 있는 경우가 있습니다. 그때도 읽어옵니다.
  */
  let 초록노드들 = Array.from(논문.querySelectorAll("Abstract > AbstractText"));
  if (초록노드들.length === 0) {
    초록노드들 = Array.from(논문.querySelectorAll("OtherAbstract > AbstractText"));
  }
  const 초록문단들 = 초록노드들.map((문단) => ({
    label: 문단.getAttribute("Label") || "",   // getAttribute = 태그의 속성값 읽기
    text:  자리표시자_지우기(문단.textContent),
  })).filter((문단) => 문단.text !== "");

  // --- 핵심 결론 뽑아내기 ---
  const 결론 = 핵심결론_뽑기(초록문단들);
  const 핵심 = 결론.글;
  const 핵심출처 = 결론.출처;

  // --- DOI (논문의 고유 주소) ---
  const doi =
    논문.querySelector('ArticleId[IdType="doi"]')?.textContent?.trim() ||
    논문.querySelector('ELocationID[EIdType="doi"]')?.textContent?.trim() ||
    "";

  // 정리한 내용을 하나의 객체로 묶어 돌려줍니다
  return { pmid, 제목, 학술지, 저자표기, 발표일, 초록문단들, 핵심, 핵심출처, doi };
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
  // 학술지 등급에 따라 배지 모양을 달리해 한눈에 구분되게 합니다
  const 등급 = 학술지_등급_가져오기(논문.학술지);
  // 초록 전문을 문단별로 조립합니다.
  // 저장해둔 논문에는 초록 전문이 없으므로(용량 절약) 그때는 이 부분을 생략합니다.
  const 초록있나 = Array.isArray(논문.초록문단들) && 논문.초록문단들.length > 0;
  const 초록블록 = !초록있나 ? "" : `
      <details class="abstract">
        <summary>초록 전문 보기</summary>
        <div class="abstract-body">${논문.초록문단들
          .map((문단) => {
            const 제목줄 = 문단.label ? `<h4>${안전한글자로(문단.label)}</h4>` : "";
            return `${제목줄}<p>${안전한글자로(문단.text)}</p>`;
          })
          .join("")}</div>
      </details>`;

  // 이미 저장한 논문인지 확인해 버튼 모양을 정합니다
  const 저장됨 = 북마크에_있나(논문.pmid);
  const 저장버튼 = `<button class="btn-small btn-save${저장됨 ? " saved" : ""}" type="button"
      data-save="${안전한글자로(논문.pmid)}">${저장됨 ? "★ 저장됨" : "☆ 저장"}</button>`;

  // 저장한 날짜 (북마크 목록에서만 표시)
  const 저장일표시 = 논문.저장일
    ? `<span class="saved-on">${안전한글자로(논문.저장일)} 저장</span>` : "";

  // DOI가 있을 때만 링크 버튼을 만듭니다 (없으면 빈 글자)
  const doi버튼 = 논문.doi
    ? `<a class="btn-small" href="https://doi.org/${안전한글자로(논문.doi)}"
          target="_blank" rel="noopener">출판사 원문</a>`
    : "";

  return `
    <article class="paper">
      <div class="paper-meta">
        <span class="journal tier-${등급}">${안전한글자로(논문.학술지)}</span>
        ${등급 >= 4 ? '<span class="tier-note">최상위</span>' : ""}
        <span>${안전한글자로(논문.발표일)}</span>
        <span>· PMID ${안전한글자로(논문.pmid)}</span>
        ${저장일표시}
      </div>

      <h2>${안전한글자로(논문.제목)}</h2>
      <p class="authors">${안전한글자로(논문.저자표기)}</p>

      <div class="takeaway">
        <span class="takeaway-label">핵심 결론${
          논문.핵심출처 ? ` <span class="takeaway-source">${안전한글자로(논문.핵심출처)}</span>` : ""
        }</span>
        <p>${안전한글자로(
          논문.핵심 ||
          (초록있나
            ? "초록에서 결론 부분을 자동으로 찾지 못했습니다. 아래에서 전문을 확인해 주세요."
            : "이 논문은 PubMed에 초록이 등록되어 있지 않습니다. 아래 PubMed 링크에서 확인해 주세요.")
        )}</p>
      </div>

      ${초록블록}

      <div class="paper-actions">
        ${저장버튼}
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
   [7-2] 저장한 논문 목록 보여주기
   ========================================================== */

function 북마크_보여주기() {
  보기모드 = "북마크";
  넘긴_횟수 = 0;
  북마크_버튼_갱신();

  const 목록 = 북마크_불러오기();
  현재_논문들 = 목록;
  논문목록_자리.innerHTML = "";

  if (목록.length === 0) {
    오늘날짜_자리.textContent = "";
    상태표시("아직 저장한 논문이 없습니다.\n논문 카드 아래의 '☆ 저장' 버튼을 누르면 여기에 모입니다.");
    return;
  }

  상태숨김();
  논문목록_자리.innerHTML = 목록.map(카드_만들기).join("");
  오늘날짜_자리.textContent =
    `저장한 논문 ${목록.length}편 · 최근에 저장한 것부터 보여드립니다`;
}


/* ==========================================================
   [8] 전체를 순서대로 실행하는 함수
   ========================================================== */

async function 논문_불러오기() {
  보기모드 = "오늘";
  북마크_버튼_갱신();
  새로고침_버튼.disabled = true;              // 불러오는 동안 버튼 잠그기 (중복 클릭 방지)
  논문목록_자리.innerHTML = "";               // 이전 결과 지우기
  상태표시("PubMed에서 논문을 찾는 중입니다…");

  // try / catch = "일단 해보고, 문제가 생기면 catch 쪽으로 넘어가라"
  try {
    const 분야   = 분야_선택창.value;          // .value = 선택창에서 고른 값
    const 기간   = 기간_선택창.value;
    const 검색어 = 검색어_만들기(분야);

    const 번호목록 = await 논문번호_받아오기(검색어, 기간);

    if (번호목록.length === 0) {
      상태표시("조건에 맞는 논문이 없습니다. 기간을 늘리거나 분야를 '전체'로 바꿔보세요.", true);
      return;   // return = 여기서 함수를 끝내기
    }

    // 학술지 이름을 먼저 확인한 뒤, 학술지가 겹치지 않게 3편을 고릅니다
    const 요약목록 = await 논문요약_받아오기(번호목록);
    const 오늘의논문 = 오늘의_논문_고르기(요약목록);
    const 논문들 = await 논문상세_받아오기(오늘의논문.map((논문) => 논문.pmid));

    // .map() 으로 각 논문을 카드 HTML로 바꾼 뒤 .join("") 으로 이어붙여 한 번에 넣습니다
    현재_논문들 = 논문들;                    // 저장 버튼이 정보를 찾을 수 있도록 보관
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

// "저장한 논문" 버튼 -> 저장 목록과 오늘의 논문을 오갑니다
if (북마크_버튼) {
  북마크_버튼.addEventListener("click", () => {
    if (보기모드 === "북마크") {
      넘긴_횟수 = 0;
      논문_불러오기();          // 이 안에서 보기모드가 "오늘"로 돌아갑니다
    } else {
      북마크_보여주기();
    }
  });
}

// 분야나 기간을 바꾸면 -> 처음부터 다시 불러옵니다
분야_선택창.addEventListener("change", () => {
  넘긴_횟수 = 0;
  논문_불러오기();
});
기간_선택창.addEventListener("change", () => {
  넘긴_횟수 = 0;
  논문_불러오기();
});
if (우선순위_선택창) {
  우선순위_선택창.addEventListener("change", () => {
    넘긴_횟수 = 0;
    논문_불러오기();
  });
}

/*
  "인용 정보 복사" 버튼 처리.
  카드는 나중에 만들어지므로 버튼에 직접 연결할 수 없습니다.
  그래서 목록 전체에 한 번만 연결해두고, 클릭된 것이 복사 버튼인지 확인합니다.
*/
논문목록_자리.addEventListener("click", (사건) => {
  const 저장버튼 = 사건.target.closest("[data-save]");
  if (!저장버튼) return;

  const pmid = 저장버튼.dataset.save;
  const 논문 = 현재_논문들.find((항목) =>항목.pmid === pmid);
  if (!논문) return;

  const 저장됨 = 북마크_넣고빼기(논문);
  저장버튼.textContent = 저장됨 ? "★ 저장됨" : "☆ 저장";
  저장버튼.classList.toggle("saved", 저장됨);

  // 저장 목록을 보고 있는 중에 해제했다면, 그 카드를 화면에서 바로 치웁니다
  if (보기모드 === "북마크" && !저장됨) {
    const 카드 = 저장버튼.closest(".paper");
    if (카드) 카드.remove();
    현재_논문들 = 북마크_불러오기();
    if (현재_논문들.length === 0) 북마크_보여주기();
    else 오늘날짜_자리.textContent =
      `저장한 논문 ${현재_논문들.length}편 · 최근에 저장한 것부터 보여드립니다`;
  }
});

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

/*
  지금 보고 있는 화면이 최신인지 알 수 있도록 버전을 표시합니다.

  index.html 에서 이 파일을 <script src="app.js?v=6"> 처럼 불러오는데,
  그 뒤에 붙은 숫자를 스스로 읽어옵니다.
  코드를 크게 고칠 때 그 숫자만 올리면 화면 표시도 함께 바뀝니다.

  브라우저가 예전 파일을 계속 쓰고 있으면 이 숫자가 올라가지 않으므로,
  "고쳤는데 왜 그대로지?" 싶을 때 여기를 확인하면 됩니다.
*/
function 버전_표시() {
  const 자리 = document.getElementById("appVersion");
  if (!자리) return;
  // 이 페이지가 불러온 script 태그 중 app.js 를 찾습니다
  const 내파일 = document.querySelector('script[src*="app.js"]');
  const 숫자 = 내파일 && 내파일.getAttribute("src").match(/v=(\d+)/);
  자리.textContent = 숫자 ? `v${숫자[1]}` : "표시 없음";
}

버전_표시();
북마크_버튼_갱신();
논문_불러오기();
