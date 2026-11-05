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
  const 연값 = Number(칸[3]);     // Open
  const 종가 = Number(칸[6]);     // Close

  if (!Number.isFinite(종가) || 종가 === 0) throw new Error("값 없음(N/D)");

  return {
    종가,
    // 전날 종가를 따로 안 주므로, 그날 시가 대비 움직임으로 대신합니다
    변동률: Number.isFinite(연값) && 연값 !== 0
      ? Number((((종가 - 연값) / 연값) * 100).toFixed(2))
      : null,
    기준일: 칸[1] || null,
    출처: "Stooq",
  };
}

/*
  야후 파이낸스에서 한 종목을 읽습니다.

  이쪽은 전날 종가(chartPreviousClose)를 함께 주기 때문에
  '어제보다 얼마나' 를 제대로 계산할 수 있습니다. 그래서 이쪽을 먼저 씁니다.
*/
async function yahoo에서(심볼) {
  /*
    range 를 2d 로 둡니다.

    처음에 5d 로 두었더니 코스피가 하루에 -8.95% 떨어진 것으로 나왔습니다.
    야후가 주는 chartPreviousClose 는 '어제 종가' 가 아니라
    '요청한 기간이 시작되기 직전의 종가' 입니다. 5일치를 달라고 했으니
    5일 전과 비교한 값이 나온 것입니다.

    그래서 두 가지를 함께 고쳤습니다.
      - 기간을 2d 로 줄이고
      - regularMarketPreviousClose(진짜 '어제 종가')를 먼저 봅니다
  */
  const 답 = await 가져오기(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(심볼)}?interval=1d&range=2d`,
    "json",
  );
  const 알맹이 = 답?.chart?.result?.[0]?.meta;
  if (!알맹이) throw new Error("모양이 다름");

  const 종가 = Number(알맹이.regularMarketPrice);
  if (!Number.isFinite(종가)) throw new Error("값 없음");

  // 앞에 적은 것부터 씁니다. 뒤로 갈수록 '어제' 에서 멀어집니다.
  const 전날후보 = [
    알맹이.regularMarketPreviousClose,
    알맹이.previousClose,
    알맹이.chartPreviousClose,
  ];
  const 전날 = Number(전날후보.find((ㄱ) => Number.isFinite(Number(ㄱ)) && Number(ㄱ) !== 0));

  const 변동률 = Number.isFinite(전날) && 전날 !== 0
    ? Number((((종가 - 전날) / 전날) * 100).toFixed(2))
    : null;

  return {
    종가,
    변동률,
    전날종가: Number.isFinite(전날) ? 전날 : null,
    기준일: 알맹이.regularMarketTime
      ? new Date(알맹이.regularMarketTime * 1000).toISOString().slice(0, 10)
      : null,
    출처: "Yahoo",
    /*
      ※ 확인용. 야후가 주는 세 가지 '전날 값' 을 그대로 적어둡니다.
         어느 것이 진짜 어제 종가인지 재보려고 넣었습니다.
         확인이 끝나면 뺍니다.
    */
    _원본: {
      regularMarketPreviousClose: 알맹이.regularMarketPreviousClose ?? null,
      previousClose: 알맹이.previousClose ?? null,
      chartPreviousClose: 알맹이.chartPreviousClose ?? null,
      regularMarketPrice: 알맹이.regularMarketPrice ?? null,
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
