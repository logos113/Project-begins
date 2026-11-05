/*
  ============================================================
  prices.mjs  =  시세 가져오기 (지수 · 환율 · 코인)

  아침에 제일 먼저 보고 싶은 것은 "어제 뭐가 얼마나 움직였나" 입니다.
  코스피·코스닥·S&P500·나스닥·원달러환율, 그리고 코인 몇 개를 가져옵니다.

  ※ 값이 안 오면 그 줄만 빼고 나머지를 보여줍니다.
     시세 한 줄 때문에 브리핑 전체가 비면 안 됩니다.

  ※ 여기 숫자는 '참고용' 입니다.
     무료로 열어둔 곳에서 가져오는 값이라 거래소 공식 종가와
     몇 분 차이가 나거나, 휴장일에는 지난 값이 그대로 올 수 있습니다.
     매매 판단에 쓰실 값이라면 증권사 화면을 보셔야 합니다.
  ============================================================
*/

import { 지수들, 코인들 } from "./sources.mjs";

const 기다리는_시간 = 15000;
const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
};

async function 가져오기(주소, 받을것 = "text") {
  const 답 = await fetch(주소, {
    headers: 머리말,
    signal: AbortSignal.timeout(기다리는_시간),
    redirect: "follow",
  });
  if (!답.ok) throw new Error(`응답 ${답.status}`);
  return 받을것 === "json" ? 답.json() : 답.text();
}

/*
  Stooq 에서 한 종목을 읽습니다.

  돌아오는 CSV 는 머리줄 하나 + 값 한 줄입니다.
    Symbol,Date,Time,Open,High,Low,Close,Volume
    ^SPX,2026-11-04,22:00:00,5800.1,5820.3,5790.0,5812.4,0

  값이 없으면 Close 자리에 'N/D' 가 들어옵니다. 그건 없는 것으로 칩니다.
*/
async function stooq에서(심볼) {
  const 글 = await 가져오기(`https://stooq.com/q/l/?s=${encodeURIComponent(심볼)}&f=sd2t2ohlcv&h&e=csv`);
  const 줄들 = 글.trim().split("\n");
  if (줄들.length < 2) throw new Error("줄이 모자람");

  const 칸 = 줄들[1].split(",");
  const 종가 = Number(칸[6]);     // Close

  if (!Number.isFinite(종가) || 종가 === 0) throw new Error("값 없음(N/D)");

  return {
    종가,
    /*
      변동률은 비워둡니다.

      Stooq 의 이 주소는 '어제 종가' 를 주지 않습니다. 한 줄에 오는 것은
      그날의 시가·고가·저가·종가뿐입니다.
      처음에는 '시가 대비 종가' 를 변동률 자리에 넣었는데, 그건
      '어제보다 얼마나' 가 아니라 '오늘 장 중에 얼마나' 입니다.
      이름은 같아도 뜻이 다른 숫자를 슬쩍 끼워 넣는 것이라,
      차라리 비워두고 화면에 '—' 로 보이게 했습니다.

      Stooq 는 야후가 실패했을 때만 쓰는 예비입니다.
      그때는 '값은 보이고 변동률만 모름' 이 됩니다.
    */
    변동률: null,
    전날종가: null,
    수상한가: false,
    기준일: 칸[1] || null,
    출처: "Stooq",
  };
}

/*
  야후 파이낸스에서 한 종목을 읽습니다.

  이쪽은 전날 종가(chartPreviousClose)를 함께 주기 때문에
  '어제보다 얼마나' 를 제대로 계산할 수 있습니다. 그래서 이쪽을 먼저 씁니다.
*/
/*
  지수가 하루에 이만큼 넘게 움직였다고 나오면 뭔가 잘못 읽은 것입니다.

  역사적으로 코스피 하루 최대 낙폭이 -12% 정도입니다(2008년).
  15%가 넘으면 '진짜 폭락' 보다 '내가 잘못 계산했을' 확률이 훨씬 높습니다.
  그럴 때는 변동률을 비워서 안 보여줍니다 — 틀린 숫자를 자신 있게
  보여주는 것보다 "모름" 이 낫습니다.
*/
const 말이되는_변동폭 = 15;

async function yahoo에서(심볼) {
  /*
    meta 의 '전날 종가' 를 믿지 않고, 실제 종가 배열에서 직접 셉니다.

    왜 이렇게 하나 — 재보고 알았습니다.
      regularMarketPreviousClose  →  null (이 주소는 안 줍니다)
      previousClose               →  null (역시 안 줍니다)
      chartPreviousClose          →  '요청한 기간이 시작되기 직전' 의 종가

    쓸 수 있는 것이 chartPreviousClose 뿐인데, 이건 기간을 며칠로
    달라고 했느냐에 따라 값이 달라집니다. 처음에 5일치를 달라고 했더니
    코스피가 하루에 -8.95% 떨어진 것으로 나왔습니다(= 5일치 변동).

    대신 종가 배열의 마지막 둘을 비교하면 '직전 거래일 대비' 가
    정확히 나옵니다. 휴장일이 끼어도 상관없습니다 — 값이 없는 날은
    아예 배열에 null 로 들어오고, 그걸 빼고 세기 때문입니다.
    그래서 기간은 넉넉히 10일을 달라고 합니다.
  */
  const 답 = await 가져오기(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(심볼)}?interval=1d&range=10d`,
    "json",
  );
  const 알맹이 = 답?.chart?.result?.[0];
  if (!알맹이) throw new Error("모양이 다름");

  const 때들 = 알맹이.timestamp || [];
  const 종가들 = 알맹이.indicators?.quote?.[0]?.close || [];

  /*
    값이 있는 날만 (날짜, 종가) 로 추려냅니다.
    휴장일은 close 가 null 로 들어오므로 여기서 빠집니다.
  */
  const 거래일 = [];
  for (let i = 0; i < 종가들.length; i += 1) {
    const ㄱ = Number(종가들[i]);
    if (Number.isFinite(ㄱ) && ㄱ !== 0) {
      거래일.push({
        날: 때들[i] ? new Date(때들[i] * 1000).toISOString().slice(0, 10) : null,
        종가: ㄱ,
      });
    }
  }
  if (거래일.length === 0) throw new Error("값 없음");

  /*
    마지막 두 칸을 그대로 씁니다. 그게 전부입니다.

    ※ 처음에는 meta 의 '지금 값' 을 섞어서, '지금 값과 같은 칸은 건너뛴다'
       는 규칙을 넣었습니다. 그랬더니 모든 지수가 +0% 로 나왔습니다 —
       meta 값과 배열 마지막이 아주 조금 달라서 건너뛰지 않았고,
       결국 '오늘 값을 어제 값으로' 삼아 비교한 셈이 됐습니다.
       영리하게 굴다 틀렸습니다. 배열만 보는 쪽이 단순하고 맞습니다.
       야후는 장중에도 일봉 배열의 마지막 칸을 갱신해 줍니다.
  */
  const 마지막 = 거래일[거래일.length - 1];
  const 직전칸 = 거래일.length >= 2 ? 거래일[거래일.length - 2] : null;

  const 종가 = 마지막.종가;
  const 직전 = 직전칸 ? 직전칸.종가 : null;

  let 변동률 = (직전 && 직전 !== 0)
    ? Number((((종가 - 직전) / 직전) * 100).toFixed(2))
    : null;

  // 말이 안 되게 크면 잘못 읽은 것으로 보고 안 보여줍니다
  let 수상한가 = false;
  if (변동률 !== null && Math.abs(변동률) > 말이되는_변동폭) {
    수상한가 = true;
    변동률 = null;
  }

  return {
    종가,
    변동률,
    전날종가: 직전,
    수상한가,
    기준일: 마지막.날,
    출처: "Yahoo",
    거래일수: 거래일.length,
    /* ※ 확인용. 맞는지 재보고 나면 뺍니다. */
    _원본: {
      마지막세칸: 거래일.slice(-3),
      meta_지금값: 알맹이.meta?.regularMarketPrice ?? null,
      meta_때: 알맹이.meta?.regularMarketTime
        ? new Date(알맹이.meta.regularMarketTime * 1000).toISOString()
        : null,
    },
  };
}

/*
  지수와 환율을 모읍니다.

  한 곳이 실패하면 다른 곳으로 한 번 더 시도합니다.
  야후를 먼저 보는 것은 '어제 대비' 를 제대로 주기 때문이고,
  Stooq 를 뒤에 두는 것은 가볍고 잘 안 죽기 때문입니다.
*/
export async function 지수_모으기() {
  const 결과 = [];
  const 못가져온것 = [];

  await Promise.all(지수들.map(async (지수) => {
    let 값 = null;
    let 까닭들 = [];

    for (const [어디, 하기] of [["Yahoo", () => yahoo에서(지수.yahoo)],
                                 ["Stooq", () => stooq에서(지수.stooq)]]) {
      try {
        값 = await 하기();
        break;
      } catch (오류) {
        까닭들.push(`${어디}: ${오류.message}`);
      }
    }

    if (값) {
      결과.push({ 이름: 지수.이름, 갈래: 지수.갈래, 단위: 지수.단위, ...값 });
    } else {
      못가져온것.push({ 이름: 지수.이름, 까닭: 까닭들.join(" / ").slice(0, 120) });
    }
  }));

  // 표에 적은 차례대로 보이도록 다시 줄 세웁니다 (동시에 받아와 순서가 섞입니다)
  결과.sort((ㄱ, ㄴ) =>
    지수들.findIndex((ㅈ) => ㅈ.이름 === ㄱ.이름) - 지수들.findIndex((ㅈ) => ㅈ.이름 === ㄴ.이름));

  return { 값들: 결과, 못가져온것 };
}

/*
  코인 시세를 모읍니다.

  CoinGecko 는 여러 종목을 한 번에 물어볼 수 있어서 한 번만 부릅니다.
  달러와 원화를 같이 받아옵니다.
*/
export async function 코인_모으기() {
  const 아이디들 = 코인들.map((ㅋ) => ㅋ.id).join(",");
  const 주소 = "https://api.coingecko.com/api/v3/simple/price"
    + `?ids=${아이디들}&vs_currencies=usd,krw&include_24hr_change=true`;

  try {
    const 답 = await 가져오기(주소, "json");
    const 값들 = [];

    for (const 코인 of 코인들) {
      const 알맹이 = 답[코인.id];
      if (!알맹이) continue;
      값들.push({
        이름: 코인.이름,
        달러: 알맹이.usd ?? null,
        원화: 알맹이.krw ?? null,
        변동률: Number.isFinite(알맹이.usd_24h_change)
          ? Number(알맹이.usd_24h_change.toFixed(2))
          : null,
      });
    }

    return { 값들, 못가져온것: [] };
  } catch (오류) {
    return {
      값들: [],
      못가져온것: [{ 이름: "코인 시세 전체", 까닭: String(오류.message).slice(0, 120) }],
    };
  }
}
