/*
  ============================================================
  아침 브리핑 - app.js

  하는 일은 하나뿐입니다 — data/latest.json 을 읽어서 화면에 그립니다.

  남의 사이트를 직접 부르지 않습니다. 뉴스와 시세를 모으는 일은
  깃허브 일꾼이 매일 아침 대신 해두었습니다
  (.github/workflows/stocks-brief.yml → stocks/collect/build.mjs).

  그래서 이 파일에는 열쇠도, 비밀도 없습니다.
  ============================================================
*/

/* ---------- 화면에서 쓸 자리들 ---------- */
const 그곳 = (이름) => document.getElementById(이름);

const 때_자리      = 그곳("when");
const 불러오는중   = 그곳("loading");
const 문제_자리    = 그곳("trouble");
const 새로고침버튼 = 그곳("refreshBtn");

const 시세덩어리 = 그곳("priceBlock");
const 시세_자리  = 그곳("priceGrid");
const 시세메모   = 그곳("priceNote");

const 일정덩어리 = 그곳("scheduleBlock");
const 오늘상자 = 그곳("todayBox"); const 오늘_자리 = 그곳("todayList");
const 주간상자 = 그곳("weekBox");  const 주간_자리 = 그곳("weekList");
const 이후상자 = 그곳("laterBox"); const 이후_자리 = 그곳("laterList");
const 큰일정상자 = 그곳("bigBox"); const 큰일정_자리 = 그곳("bigList");
const 일정없음 = 그곳("schedEmpty");

const 관심_고치기버튼 = 그곳("watchToggle");
const 관심_고치는칸   = 그곳("watchEdit");
const 관심_넣는폼     = 그곳("watchForm");
const 관심_입력칸     = 그곳("watchInput");
const 관심_칩들       = 그곳("watchChips");
const 관심_뉴스자리   = 그곳("watchNews");
const 관심_없음       = 그곳("watchEmpty");

/*
  처음 안내 문구를 적어둡니다.

  아래에서 "등록한 종목 이야기는 오늘 뉴스에 없습니다" 로 덮어쓰는데,
  적어두지 않으면 종목을 다 지운 뒤에도 그 문구가 그대로 남습니다.
  등록한 게 하나도 없는데 "등록한 종목() 이야기는…" 이라고 뜨게 됩니다.
*/
const 관심_첫안내 = 관심_없음.textContent.trim();

const 뉴스덩어리 = 그곳("newsBlock");
const 뉴스탭들   = 그곳("newsTabs");
const 뉴스_자리  = 그곳("newsList");

const 아래덩어리 = 그곳("footBlock");
const 출처_자리  = 그곳("sourceBody");

/* ---------- 지금 들고 있는 것 ---------- */
let 브리핑 = null;
let 보는갈래 = "한국";

/* ==========================================================
   관심 종목

   이 브라우저에만 저장됩니다.

   ※ 저장소에 올리지 않는 이유 — 이 저장소는 공개입니다.
      어떤 종목을 보고 있는지는 남에게 알릴 일이 아닙니다.
      대신 일꾼은 뉴스를 넉넉히 모아두고, 고르는 일은 앱이 합니다.
   ========================================================== */
const 관심_열쇠 = "아침브리핑.관심종목";

function 관심종목_읽기() {
  try {
    const 적힌것 = localStorage.getItem(관심_열쇠);
    const 읽은것 = 적힌것 ? JSON.parse(적힌것) : [];
    return Array.isArray(읽은것) ? 읽은것.filter((ㅈ) => typeof ㅈ === "string") : [];
  } catch (오류) {
    /*
      사생활 보호 모드나 저장 공간이 막힌 기기에서는 여기서 넘어집니다.
      그래도 앱은 돌아가야 하므로 '등록한 것 없음' 으로 봅니다.
    */
    return [];
  }
}

function 관심종목_저장(목록) {
  try {
    localStorage.setItem(관심_열쇠, JSON.stringify(목록));
  } catch (오류) {
    /* 저장이 안 되어도 이번 판에서는 동작합니다. 조용히 넘어갑니다. */
  }
}

/* ==========================================================
   작은 도우미들
   ========================================================== */

/*
  ★ 글자는 반드시 textContent 로 넣습니다. innerHTML 을 쓰지 않습니다.

  뉴스 제목은 남의 사이트에서 가져온 글입니다. 거기 <script> 같은 것이
  섞여 있어도 textContent 로 넣으면 그냥 글자로 보일 뿐 실행되지 않습니다.
  innerHTML 로 넣으면 실행됩니다. 이 규칙 하나로 큰 구멍 하나가 막힙니다.
*/
function 만들기(태그, 반, 글) {
  const 것 = document.createElement(태그);
  if (반) 것.className = 반;
  if (글 !== undefined) 것.textContent = 글;
  return 것;
}

/* 숫자에 천 단위 쉼표를 넣습니다 */
function 숫자꾸미기(값) {
  if (값 === null || 값 === undefined || !Number.isFinite(Number(값))) return "—";
  const ㅅ = Number(값);
  // 1 미만인 코인은 소수점을 더 보여줘야 뜻이 있습니다 (예: 0.00031)
  const 자리 = Math.abs(ㅅ) >= 1000 ? 0 : (Math.abs(ㅅ) >= 1 ? 2 : 5);
  return ㅅ.toLocaleString("ko-KR", { minimumFractionDigits: 자리, maximumFractionDigits: 자리 });
}

/*
  오름·내림 표시를 만듭니다.
  한국 증시 관습대로 오르면 빨강, 내리면 파랑입니다.
  (미국은 반대로 쓰지만, 보는 사람이 한국 분이라 한국 쪽을 따릅니다)
*/
function 변동_칩(변동률, 수상한가) {
  if (수상한가) {
    const 칩 = 만들기("span", "move unknown", "확인 필요");
    칩.title = "하루에 15% 넘게 움직인 것으로 나와, 잘못 읽었을 가능성이 커서 감췄습니다";
    return 칩;
  }
  if (변동률 === null || 변동률 === undefined) {
    const 칩 = 만들기("span", "move unknown", "—");
    칩.title = "직전 거래일 종가를 알 수 없어 변동률을 내지 못했습니다";
    return 칩;
  }
  const ㅂ = Number(변동률);
  const 결 = ㅂ > 0 ? "up" : (ㅂ < 0 ? "down" : "flat");
  const 화살 = ㅂ > 0 ? "▲" : (ㅂ < 0 ? "▼" : "―");
  return 만들기("span", `move ${결}`, `${화살} ${Math.abs(ㅂ).toFixed(2)}%`);
}

/* "2026-11-05T01:52:21Z" → "11월 5일 오전 10:52" */
function 시각_읽기좋게(글) {
  if (!글) return "";
  const 때 = new Date(글);
  if (Number.isNaN(때.getTime())) return "";
  return 때.toLocaleString("ko-KR", {
    month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/* 기사가 얼마나 지난 것인지 — "3시간 전" */
function 얼마나_지났나(글) {
  if (!글) return "";
  const 지난밀리초 = Date.now() - new Date(글).getTime();
  if (!Number.isFinite(지난밀리초) || 지난밀리초 < 0) return "";
  const 분 = Math.floor(지난밀리초 / 60000);
  if (분 < 1) return "방금";
  if (분 < 60) return `${분}분 전`;
  const 시 = Math.floor(분 / 60);
  if (시 < 24) return `${시}시간 전`;
  return `${Math.floor(시 / 24)}일 전`;
}

/* ==========================================================
   그리기
   ========================================================== */

function 시세_그리기(시세) {
  시세_자리.replaceChildren();

  const 전부 = [
    ...(시세.지수 || []).map((ㅈ) => ({
      이름: ㅈ.이름,
      값: 숫자꾸미기(ㅈ.종가) + (ㅈ.단위 || ""),
      변동률: ㅈ.변동률,
      수상한가: ㅈ.수상한가,
    })),
    ...(시세.코인 || []).map((ㅋ) => ({
      이름: ㅋ.이름,
      값: "$" + 숫자꾸미기(ㅋ.달러),
      변동률: ㅋ.변동률,
      수상한가: false,
    })),
  ];

  if (전부.length === 0) {
    시세덩어리.hidden = true;
    return;
  }

  for (const ㅎ of 전부) {
    const 칸 = 만들기("div", "price");
    칸.append(
      만들기("div", "name", ㅎ.이름),
      만들기("div", "value", ㅎ.값),
      변동_칩(ㅎ.변동률, ㅎ.수상한가),
    );
    시세_자리.append(칸);
  }

  // 못 가져온 것이 있으면 조용히 알려줍니다 (숨기면 왜 비었는지 알 수 없습니다)
  const 못가져온것 = 시세.못가져온것 || [];
  if (못가져온것.length) {
    시세메모.textContent = `못 가져온 것: ${못가져온것.map((ㅁ) => ㅁ.이름).join(", ")}`;
    시세메모.hidden = false;
  } else {
    시세메모.hidden = true;
  }

  시세덩어리.hidden = false;
}

/* 일정 한 줄 */
function 일정_한줄(ㅇ) {
  const 줄 = document.createElement("li");

  const 언제 = ㅇ.남은날 === 0 ? "오늘"
    : ㅇ.남은날 === 1 ? "내일"
    : `${ㅇ.날짜.slice(5).replace("-", "/")}(${ㅇ.요일})`;
  줄.append(만들기("span", `when-chip${ㅇ.남은날 === 0 ? " today" : ""}`, 언제));

  const 속 = 만들기("span", "what");
  속.append(만들기("strong", null, ㅇ.이름));
  if (ㅇ.설명) 속.append(만들기("span", "why", ㅇ.설명));

  /*
    어디서 가져온 일정인지 밝힙니다.
    긁어온 날짜는 틀릴 수 있으니 원문으로 바로 갈 수 있어야 합니다.
  */
  if (ㅇ.출처 && ㅇ.출처 !== "규칙" && ㅇ.출처 !== "등록") {
    const 꼬리 = 만들기("span", "from");
    if (ㅇ.원문) {
      const 링크 = 만들기("a", null, `${ㅇ.출처} 공식 일정 ↗`);
      링크.href = ㅇ.원문;
      링크.target = "_blank";
      링크.rel = "noopener noreferrer";
      꼬리.append(링크);
    } else {
      꼬리.textContent = ㅇ.출처;
    }
    속.append(꼬리);
  }
  줄.append(속);

  줄.append(만들기("span", `tag ${ㅇ.갈래 || "기타"}`, ㅇ.갈래 || "기타"));
  return 줄;
}

function 일정_그리기(일정) {
  const 채우기 = (상자, 자리, 목록) => {
    자리.replaceChildren();
    if (!목록 ||목록.length === 0) { 상자.hidden = true; return 0; }
    for (const ㅇ of 목록) 자리.append(일정_한줄(ㅇ));
    상자.hidden = false;
    return 목록.length;
  };

  const 센것 =
    채우기(오늘상자, 오늘_자리, 일정.오늘) +
    채우기(주간상자, 주간_자리, 일정.이번주) +
    채우기(이후상자, 이후_자리, 일정.다음주);

  /*
    '다음 FOMC 는 언제인가' 는 2주 밖이어도 보고 싶은 것이라 따로 담습니다.
    위에 이미 나온 것은 빼고 보여줍니다 — 같은 줄이 두 번 나오면 지저분합니다.
  */
  const 이미본것 = new Set([...(일정.오늘 || []), ...(일정.이번주 || []), ...(일정.다음주 || [])]
    .map((ㅇ) => `${ㅇ.날짜}|${ㅇ.이름}`));
  const 큰것 = (일정.다가오는_큰일정 || []).filter((ㅇ) => !이미본것.has(`${ㅇ.날짜}|${ㅇ.이름}`));
  채우기(큰일정상자, 큰일정_자리, 큰것);

  일정없음.hidden = 센것 > 0 || 큰것.length > 0;
  일정덩어리.hidden = false;
}

/* 뉴스 한 줄 */
function 뉴스_한줄(기사, 걸린이름) {
  const 줄 = document.createElement("li");
  const 링크 = document.createElement("a");
  링크.href = 기사.주소 || "#";
  링크.target = "_blank";
  링크.rel = "noopener noreferrer";

  if (걸린이름) 링크.append(만들기("span", "hit", 걸린이름));
  // 제목은 남의 글입니다. textContent 로만 넣습니다.
  링크.append(document.createTextNode(기사.제목));

  const 지난것 = 얼마나_지났나(기사.때);
  링크.append(만들기("span", "meta", 기사.출처 + (지난것 ? ` · ${지난것}` : "")));

  줄.append(링크);
  return 줄;
}

function 뉴스_그리기() {
  뉴스_자리.replaceChildren();
  const 기사들 = (브리핑?.뉴스 || {})[보는갈래] || [];

  if (기사들.length === 0) {
    const 줄 = document.createElement("li");
    줄.append(만들기("p", "empty-say", "이 갈래에서 가져온 기사가 없습니다."));
    뉴스_자리.append(줄);
  } else {
    for (const 기사 of 기사들) 뉴스_자리.append(뉴스_한줄(기사));
  }

  for (const 탭 of 뉴스탭들.querySelectorAll(".tab")) {
    const 켜짐 = 탭.dataset.갈래 === 보는갈래;
    탭.classList.toggle("on", 켜짐);
    탭.setAttribute("aria-selected", 켜짐 ? "true" : "false");
  }
  뉴스덩어리.hidden = false;
}

/*
  관심 종목 — 모아온 뉴스 전부에서 등록한 이름이 제목에 든 것을 고릅니다.

  일꾼은 어떤 종목을 보는지 모릅니다. 고르는 일은 여기서 합니다.
*/
function 관심_그리기() {
  const 종목들 = 관심종목_읽기();

  관심_칩들.replaceChildren();
  for (const 종목 of 종목들) {
    const 칩 = document.createElement("li");
    칩.append(document.createTextNode(종목));
    const 지우개 = 만들기("button", null, "×");
    지우개.type = "button";
    지우개.setAttribute("aria-label", `${종목} 빼기`);
    지우개.addEventListener("click", () => {
      관심종목_저장(관심종목_읽기().filter((ㅈ) => ㅈ !== 종목));
      관심_그리기();
    });
    칩.append(지우개);
    관심_칩들.append(칩);
  }

  관심_뉴스자리.replaceChildren();

  if (종목들.length === 0) {
    관심_없음.textContent = 관심_첫안내;   // 덮어썼던 것을 되돌립니다
    관심_없음.hidden = false;
    return;
  }

  const 모든기사 = Object.values(브리핑?.뉴스 || {}).flat();
  const 걸린것 = [];
  for (const 기사 of 모든기사) {
    const 제목 = (기사.제목 || "").toLowerCase();
    const 맞은이름 = 종목들.find((ㅈ) => 제목.includes(ㅈ.toLowerCase()));
    if (맞은이름) 걸린것.push({ 기사, 맞은이름 });
  }

  if (걸린것.length === 0) {
    관심_없음.textContent = `등록한 종목(${종목들.join(", ")}) 이야기는 오늘 뉴스에 없습니다.`;
    관심_없음.hidden = false;
    return;
  }

  관심_없음.hidden = true;
  for (const { 기사, 맞은이름 } of 걸린것.slice(0, 15)) {
    관심_뉴스자리.append(뉴스_한줄(기사, 맞은이름));
  }
}

/* 맨 아래 — 어디서 가져왔나 */
function 출처_그리기() {
  출처_자리.replaceChildren();

  const 상태들 = 브리핑?.출처상태 || [];
  const 된곳 = 상태들.filter((ㅅ) => ㅅ.성공);
  const 안된곳 = 상태들.filter((ㅅ) => !ㅅ.성공);

  출처_자리.append(만들기("h4", null, "뉴스"));
  출처_자리.append(만들기("div", "ok",
    `${된곳.length}곳에서 가져왔습니다 — ${된곳.map((ㅅ) => ㅅ.이름).join(", ") || "없음"}`));
  if (안된곳.length) {
    출처_자리.append(만들기("div", "bad",
      `못 가져온 곳: ${안된곳.map((ㅅ) => `${ㅅ.이름}(${ㅅ.까닭})`).join(", ")}`));
  }

  const 공식 = 브리핑?.일정?.공식출처상태 || [];
  if (공식.length) {
    출처_자리.append(만들기("h4", null, "일정"));
    for (const ㅅ of 공식) {
      출처_자리.append(만들기("div", ㅅ.성공 ? "ok" : "bad",
        `${ㅅ.성공 ? "○" : "×"} ${ㅅ.이름}: ${ㅅ.개수}개${ㅅ.까닭 ? ` — ${ㅅ.까닭}` : ""}`));
    }
    출처_자리.append(만들기("div", "ok",
      "고용보고서·옵션만기 같은 것은 달력으로 계산합니다 (긁어오지 않습니다)"));
  }

  아래덩어리.hidden = false;
}

/* ==========================================================
   불러오기
   ========================================================== */
async function 브리핑_불러오기() {
  새로고침버튼.classList.add("spinning");
  문제_자리.hidden = true;

  try {
    /*
      ?t= 를 붙여 매번 다른 주소로 만듭니다.
      안 그러면 브라우저가 어제 받아둔 것을 그대로 내어주어,
      새로고침을 눌러도 어제 브리핑이 계속 보입니다.
    */
    const 답 = await fetch(`data/latest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!답.ok) throw new Error(`자료를 받지 못했습니다 (${답.status})`);
    브리핑 = await 답.json();

    불러오는중.hidden = true;
    때_자리.textContent = `${브리핑.날짜} · ${시각_읽기좋게(브리핑.만든시각)} 기준`;

    시세_그리기(브리핑.시세 || {});
    일정_그리기(브리핑.일정 || {});
    관심_그리기();
    뉴스_그리기();
    출처_그리기();
  } catch (오류) {
    불러오는중.hidden = true;
    문제_자리.replaceChildren();
    문제_자리.append(만들기("strong", null, "오늘 자료를 불러오지 못했습니다"));
    문제_자리.append(만들기("span", null,
      브리핑
        ? "인터넷이 없어 마지막으로 본 내용을 그대로 두었습니다."
        : "인터넷 연결을 확인하고 위쪽 ↻ 를 눌러보세요. "
          + "아침 자료는 보통 6~8시 사이에 올라옵니다."));
    문제_자리.hidden = false;
  } finally {
    새로고침버튼.classList.remove("spinning");
  }
}

/* ==========================================================
   버튼과 입력 받기
   ========================================================== */
새로고침버튼.addEventListener("click", 브리핑_불러오기);

뉴스탭들.addEventListener("click", (사건) => {
  const 탭 = 사건.target.closest(".tab");
  if (!탭) return;
  보는갈래 = 탭.dataset.갈래;
  뉴스_그리기();
});

관심_고치기버튼.addEventListener("click", () => {
  const 열려있나 = !관심_고치는칸.hidden;
  관심_고치는칸.hidden = 열려있나;
  관심_고치기버튼.textContent = 열려있나 ? "고치기" : "닫기";
  관심_고치기버튼.setAttribute("aria-expanded", 열려있나 ? "false" : "true");
  if (!열려있나) 관심_입력칸.focus();
});

관심_넣는폼.addEventListener("submit", (사건) => {
  사건.preventDefault();
  const 넣은것 = 관심_입력칸.value.trim();
  if (!넣은것) return;

  const 지금목록 = 관심종목_읽기();
  // 같은 것을 두 번 넣지 않게 합니다 (대소문자는 같은 것으로 봅니다)
  if (!지금목록.some((ㅈ) => ㅈ.toLowerCase() === 넣은것.toLowerCase())) {
    지금목록.push(넣은것);
    관심종목_저장(지금목록);
  }
  관심_입력칸.value = "";
  관심_그리기();
});

/* 첫 그림 */
관심_그리기();
브리핑_불러오기();

/* ==========================================================
   오프라인 준비와 새 버전 알림

   한 번 열어본 뒤로는 인터넷 없이도 앱이 열립니다.
   새 버전이 올라와도 곧바로 갈아끼우지 않고 물어봅니다 —
   보고 있는 도중에 파일이 바뀌면 화면이 어긋납니다.
   ========================================================== */
if ("serviceWorker" in navigator) {
  // 처음부터 담당이 있었는지 기억해 둡니다 (아래 controllerchange 에서 씁니다)
  const 처음부터_담당있었나 = !!navigator.serviceWorker.controller;
  let 교대를_요청했나 = false;

  window.addEventListener("load", async () => {
    try {
      const 등록 = await navigator.serviceWorker.register("sw.js");

      const 새것_알리기 = (새일꾼) => {
        if (!새일꾼) return;
        const 줄 = document.createElement("div");
        줄.className = "sw-update";
        줄.append(만들기("span", null, "새 버전이 있습니다"));

        const 받기 = 만들기("button", "sw-update-btn", "지금 받기");
        받기.type = "button";
        받기.addEventListener("click", () => {
          교대를_요청했나 = true;
          새일꾼.postMessage({ 하는일: "지금교대" });
          줄.remove();
        });

        const 닫기 = 만들기("button", "sw-update-close", "✕");
        닫기.type = "button";
        닫기.setAttribute("aria-label", "닫기");
        닫기.addEventListener("click", () => 줄.remove());

        줄.append(받기, 닫기);
        document.body.append(줄);
      };

      if (등록.waiting) 새것_알리기(등록.waiting);
      등록.addEventListener("updatefound", () => {
        const 새일꾼 = 등록.installing;
        if (!새일꾼) return;
        새일꾼.addEventListener("statechange", () => {
          if (새일꾼.state === "installed" && navigator.serviceWorker.controller) {
            새것_알리기(새일꾼);
          }
        });
      });
    } catch (오류) {
      /* 서비스 워커가 없어도 앱은 그냥 돕니다. 조용히 넘어갑니다. */
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    /*
      ※ 두 가지를 모두 봐야 합니다.

         처음 방문에도 clients.claim() 때문에 이 사건이 한 번 일어납니다.
         그때 새로고침하면 멀쩡한 첫 화면이 깜빡입니다.
         반대로 사용자가 '지금 받기' 를 눌렀을 때는 반드시 새로고침해야
         새 파일이 보입니다. 그래서 '내가 요청했을 때만' 새로고침합니다.
    */
    if (처음부터_담당있었나 && 교대를_요청했나) window.location.reload();
  });
}
