/*
  ============================================================
  calendar-fetch.mjs  =  FOMC·금통위 일정 가져오기

  정찰(두 번)로 구조를 확인하고 나서 짠 파서입니다.
  추측으로 짜지 않았습니다 — 실제로 받아온 HTML 을 보고 맞췄습니다.

  ── 연준 FOMC ──────────────────────────────────────────────
    <h4><a id="42828">2026 FOMC Meetings</a></h4>
      <div class="fomc-meeting__month"><strong>January</strong></div>
      <div class="fomc-meeting__date">27-28</div>
      <div class="fomc-meeting__month"><strong>March</strong></div>
      <div class="fomc-meeting__date">17-18*</div>

    연도는 h4 제목에, 월과 날짜는 따로 떨어진 상자에 있습니다.
    "27-28" 은 이틀 회의라는 뜻이고, 결과는 **둘째 날** 에 나옵니다.
    별표(*)는 경제전망(점도표)을 함께 내는 회의입니다.

  ── 한국은행 금통위 ────────────────────────────────────────
    <h3>2026년</h3>
      <tr><th scope="row">01월 15일(목)</th> ...

    연도는 h3 에, 날짜는 표의 머리칸에 있습니다.
    이 페이지는 '올해' 것만 보여줍니다. 연말에 내년 일정이 올라오면
    그때부터 잡힙니다. 그 사이 빈 기간은 calendar.json 으로 메웁니다.

  ── 미국 CPI (BLS) ─────────────────────────────────────────
    403 으로 막혀 있습니다. 공개 캘린더 파일도 막혔습니다.
    위장해서 두드리지 않습니다 — '오지 마세요' 를 무시하는 일입니다.
    미국 CPI 발표일은 calendar.json 에 손으로 넣습니다.

  ※ 가져온 날짜에는 '어디서 가져왔는지' 와 원문 주소를 붙입니다.
     투자 일정은 틀리면 안 되니, 의심스러우면 바로 확인할 수 있어야 합니다.
  ============================================================
*/

const 기다리는_시간 = 20000;

/* 우리가 누구인지 밝힙니다. 브라우저인 척 위장하지 않습니다. */
const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
  "Accept": "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "ko,en;q=0.8",
};

async function 받아오기(주소) {
  const 답 = await fetch(주소, {
    headers: 머리말,
    signal: AbortSignal.timeout(기다리는_시간),
    redirect: "follow",
  });
  if (!답.ok) throw new Error(`응답 ${답.status}`);
  return 답.text();
}

const 영어달 = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function 날짜글자(해, 달, 일) {
  return `${해}-${String(달).padStart(2, "0")}-${String(일).padStart(2, "0")}`;
}

/*
  가져온 날짜가 말이 되는지 봅니다.

  긁어온 값은 언제든 이상해질 수 있습니다 — 사이트가 바뀌거나,
  내 정규식이 엉뚱한 곳을 집거나. 말이 안 되는 날짜를 그냥 내보내는 것이
  제일 나쁩니다. 걸러내고 몇 개를 버렸는지 기록합니다.
*/
function 말이되는_날짜인가(해, 달, 일, 올해) {
  if (!Number.isInteger(해) || !Number.isInteger(달) || !Number.isInteger(일)) return false;
  if (해 < 올해 - 1 || 해 > 올해 + 2) return false;     // 재작년이나 3년 뒤는 뭔가 잘못된 것
  if (달 < 1 || 달 > 12) return false;
  if (일 < 1 || 일 > 31) return false;
  // 2월 30일 같은 것을 거릅니다
  const 때 = new Date(Date.UTC(해, 달 - 1, 일, 12));
  return 때.getUTCMonth() === 달 - 1 && 때.getUTCDate() === 일;
}

/* ---------------------------------------------------------
   연준 FOMC
   --------------------------------------------------------- */
const FOMC_주소 = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

export function FOMC_파싱(html, 올해 = new Date().getUTCFullYear()) {
  const 일정 = [];
  let 버린개수 = 0;

  /*
    연도 제목이 나오는 자리를 모두 찾아, 제목과 제목 사이를
    그 해의 구간으로 봅니다. 한 페이지에 2021~2027년이 함께 있습니다.
  */
  const 제목들 = [...html.matchAll(/<h4[^>]*>(?:\s*<a[^>]*>)?\s*(20\d\d)\s+FOMC\s+Meetings/gi)];
  if (제목들.length === 0) return { 일정: [], 버린개수: 0, 까닭: "연도 제목을 못 찾았습니다" };

  for (let i = 0; i < 제목들.length; i += 1) {
    const 해 = Number(제목들[i][1]);
    const 시작 = 제목들[i].index;
    const 끝 = i + 1 < 제목들.length ? 제목들[i + 1].index : html.length;
    const 구간 = html.slice(시작, 끝);

    // 월과 날짜는 따로 떨어진 상자에 있습니다. 순서대로 짝지웁니다.
    const 달들 = [...구간.matchAll(/fomc-meeting__month[^>]*>\s*(?:<strong>)?\s*([A-Za-z]+)/gi)]
      .map((ㄱ) => ㄱ[1].toLowerCase());
    const 날들 = [...구간.matchAll(/fomc-meeting__date[^>]*>\s*([^<]+?)\s*</gi)]
      .map((ㄱ) => ㄱ[1]);

    // 개수가 안 맞으면 짝이 어긋난 것입니다. 통째로 버립니다.
    if (달들.length !== 날들.length) {
      버린개수 += Math.max(달들.length, 날들.length);
      continue;
    }

    for (let k = 0; k < 달들.length; k += 1) {
      const 달 = 영어달[달들[k]];
      const 날글 = 날들[k];
      if (!달) { 버린개수 += 1; continue; }

      /*
        "27-28" 은 이틀 회의, 결과는 둘째 날에 나옵니다.
        "28" 처럼 하루만 적힌 것도 있습니다.
        끝에 붙은 별표(*)는 경제전망을 함께 내는 회의라는 표시입니다.
      */
      const 전망도내나 = 날글.includes("*");
      const 숫자들 = (날글.match(/\d{1,2}/g) || []).map(Number);
      if (숫자들.length === 0) { 버린개수 += 1; continue; }
      const 발표일 = 숫자들[숫자들.length - 1];

      /*
        월을 넘기는 회의가 있습니다 — "April 28-29" 처럼 같은 달이면
        문제없지만, 드물게 "January 31 - February 1" 같은 꼴이 나옵니다.
        그런 경우 날짜가 작아지므로(31 → 1) 달을 하나 올려줍니다.
      */
      let 쓸달 = 달;
      let 쓸해 = 해;
      if (숫자들.length > 1 && 발표일 < 숫자들[0]) {
        쓸달 = 달 + 1;
        if (쓸달 > 12) { 쓸달 = 1; 쓸해 += 1; }
      }

      if (!말이되는_날짜인가(쓸해, 쓸달, 발표일, 올해)) { 버린개수 += 1; continue; }

      일정.push({
        날짜: 날짜글자(쓸해, 쓸달, 발표일),
        갈래: "미국",
        이름: "FOMC 결과 발표",
        설명: 전망도내나
          ? "기준금리 결정 + 경제전망(점도표). 한국시간 다음날 새벽"
          : "기준금리 결정. 한국시간 다음날 새벽",
        출처: "연준",
        원문: FOMC_주소,
      });
    }
  }

  return { 일정, 버린개수, 까닭: null };
}

export async function FOMC_가져오기() {
  try {
    const html = await 받아오기(FOMC_주소);
    const 결과 = FOMC_파싱(html);
    /*
      FOMC 는 한 해에 여덟 번 모입니다. 페이지에 여러 해가 함께 있으니
      스무 개는 넘게 나와야 정상입니다. 서넛뿐이면 뭔가 잘못 읽은 것입니다.
    */
    if (결과.일정.length < 8) {
      return { 일정: [], 성공: false, 까닭: `읽어낸 것이 ${결과.일정.length}개뿐 — 구조가 바뀐 듯합니다` };
    }
    return { ...결과, 성공: true };
  } catch (오류) {
    return { 일정: [], 성공: false, 까닭: String(오류.message).slice(0, 150) };
  }
}

/* ---------------------------------------------------------
   한국은행 금융통화위원회
   --------------------------------------------------------- */
const 금통위_주소 =
  "https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755";

export function 금통위_파싱(html, 올해 = new Date().getUTCFullYear()) {
  // 연도는 페이지 제목에 한 번 나옵니다 — <h3> 2026년
  const 해걸림 = html.match(/<h3[^>]*>\s*(20\d\d)\s*년/);
  if (!해걸림) return { 일정: [], 버린개수: 0, 까닭: "연도를 못 찾았습니다" };
  const 해 = Number(해걸림[1]);

  const 일정 = [];
  let 버린개수 = 0;

  // <th scope="row">01월 15일(목)</th>
  for (const 걸린것 of html.matchAll(/<th[^>]*scope=["']row["'][^>]*>\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    const 달 = Number(걸린것[1]);
    const 일 = Number(걸린것[2]);
    if (!말이되는_날짜인가(해, 달, 일, 올해)) { 버린개수 += 1; continue; }

    일정.push({
      날짜: 날짜글자(해, 달, 일),
      갈래: "한국",
      이름: "금통위 (기준금리 결정)",
      설명: "한국은행 통화정책방향 결정회의. 오전 중 발표",
      출처: "한국은행",
      원문: 금통위_주소,
    });
  }

  return { 일정, 버린개수, 까닭: null };
}

export async function 금통위_가져오기() {
  try {
    const html = await 받아오기(금통위_주소);
    const 결과 = 금통위_파싱(html);
    /*
      금통위 통화정책방향 결정회의는 한 해에 여덟 번입니다.
      네 개도 안 나오면 잘못 읽은 것으로 봅니다.
    */
    if (결과.일정.length < 4) {
      return { 일정: [], 성공: false, 까닭: `읽어낸 것이 ${결과.일정.length}개뿐 — 구조가 바뀐 듯합니다` };
    }
    return { ...결과, 성공: true };
  } catch (오류) {
    return { 일정: [], 성공: false, 까닭: String(오류.message).slice(0, 150) };
  }
}

/* ---------------------------------------------------------
   둘 다 가져오기
   --------------------------------------------------------- */
export async function 공식일정_가져오기() {
  const [fomc, 금통위] = await Promise.all([FOMC_가져오기(), 금통위_가져오기()]);

  // 같은 날 같은 일정이 두 번 들어가지 않게 합니다
  const 본것 = new Set();
  const 모은것 = [];
  for (const ㅇ of [...fomc.일정, ...금통위.일정]) {
    const 열쇠 = `${ㅇ.날짜}|${ㅇ.이름}`;
    if (본것.has(열쇠)) continue;
    본것.add(열쇠);
    모은것.push(ㅇ);
  }

  return {
    일정: 모은것,
    상태: [
      { 이름: "FOMC (연준)", 성공: fomc.성공, 개수: fomc.일정.length, 버린개수: fomc.버린개수 ?? 0, 까닭: fomc.까닭 || null },
      { 이름: "금통위 (한국은행)", 성공: 금통위.성공, 개수: 금통위.일정.length, 버린개수: 금통위.버린개수 ?? 0, 까닭: 금통위.까닭 || null },
      {
        이름: "미국 CPI (BLS)",
        성공: false,
        개수: 0,
        까닭: "BLS 가 막아두었습니다(403). 위장해서 들어가지 않습니다 — calendar.json 에 손으로 넣어주세요",
      },
    ],
  };
}

export { 말이되는_날짜인가, FOMC_주소, 금통위_주소 };
