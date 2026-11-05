/*
  ============================================================
  calendar-probe.mjs  =  일정 사이트 정찰 (2차)

  1차에서 알아낸 것
    FOMC    fomc-meeting__month / fomc-meeting__date 상자에 담김 (57개)
            날짜는 "March 17-18*" 꼴. 그런데 '몇 년도' 인지가 안 보임
    금통위  "01월 15일(목)" 꼴. 보도자료 파일명 (2601) 이 26년 1월을 가리킴
            역시 연도를 어디서 읽을지 불확실
    BLS     403 — 막힘

  2차에서 볼 것
    1) FOMC: fomc-meeting 덩어리의 HTML 원문과, 그 위에 붙은 연도 제목
    2) 금통위: 표 안쪽 HTML 원문과 연도 표시
    3) BLS: 다른 머리말로 다시, 그리고 캘린더(ics) 파일이 있는지

  ※ 추측으로 파서를 짜지 않으려고 두 번 나눠 갑니다.
     투자 일정은 틀리면 없느니만 못합니다.
  ============================================================
*/

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const 여기 = path.dirname(new URL(import.meta.url).pathname);
const 자료폴더 = path.join(여기, "..", "data");

/*
  우리가 누구인지 밝히는 머리말입니다.

  ※ 브라우저인 척 위장하지 않습니다.
     BLS 가 403 으로 막길래 평범한 크롬인 척하는 머리말로 다시
     두드려보려 했는데, 그건 "오지 마세요" 라는 그쪽 의사를
     무시하는 일입니다. 막은 곳은 막힌 대로 두고 다른 길을 찾습니다.
     (아래 BLS 항목은 '공개된 캘린더 파일이 따로 있는지' 만 봅니다)
*/
const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
  "Accept": "text/html,application/xhtml+xml,text/calendar,*/*",
  "Accept-Language": "ko,en;q=0.8",
};

async function 받아오기(주소, 쓸머리말 = 머리말) {
  const 답 = await fetch(주소, {
    headers: 쓸머리말,
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  return { 상태: 답.status, ok: 답.ok, 글: await 답.text(),
           종류: 답.headers.get("content-type") || null };
}

/*
  어떤 말이 들어간 HTML 덩어리를 통째로 떠옵니다.
  class 이름만 봐서는 안쪽이 어떻게 생겼는지 알 수 없습니다.
*/
function 덩어리_뜨기(html, 찾을말, 몇개 = 3, 길이 = 700) {
  const 나온것 = [];
  let 자리 = 0;
  while (나온것.length < 몇개) {
    const i = html.indexOf(찾을말, 자리);
    if (i < 0) break;
    const 앞 = Math.max(0, i - 200);
    나온것.push(html.slice(앞, i + 길이).replace(/\s+/g, " "));
    자리 = i + 길이;
  }
  return 나온것;
}

/* 연도(20xx)가 적힌 제목 줄들을 찾습니다 */
function 연도제목_찾기(html, 몇개 = 12) {
  const 나온것 = [];
  for (const 걸린것 of html.matchAll(/<(h[1-6]|caption|th|strong)[^>]*>([\s\S]{0,120}?)<\/\1>/gi)) {
    const 속 = 걸린것[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/20\d\d/.test(속) && 속.length < 90) {
      나온것.push(`<${걸린것[1]}> ${속}`);
      if (나온것.length >= 몇개) break;
    }
  }
  return 나온것;
}

const 할일 = [
  {
    이름: "FOMC — 덩어리와 연도 제목",
    주소: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    보기: (html) => ({
      연도제목: 연도제목_찾기(html),
      meeting덩어리: 덩어리_뜨기(html, 'fomc-meeting__month', 3, 600),
      panel덩어리: 덩어리_뜨기(html, 'panel-heading', 2, 500),
    }),
  },
  {
    이름: "한국은행 금통위 — 표 안쪽과 연도",
    주소: "https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755",
    보기: (html) => ({
      연도제목: 연도제목_찾기(html),
      표덩어리: 덩어리_뜨기(html, "<table", 2, 1400),
      // "01월 15일" 이 들어간 HTML 원문
      날짜덩어리: 덩어리_뜨기(html, "월 15일", 2, 500)
        .concat(덩어리_뜨기(html, "월 26일", 2, 500)),
      // 연도를 고르는 링크가 있는지 (있으면 내년 일정도 가져올 수 있습니다)
      연도링크: [...html.matchAll(/href=["']([^"']*(?:year|Year)[^"']*)["']/g)]
        .map((ㄱ) => ㄱ[1]).slice(0, 10),
    }),
  },
  /*
    BLS(미국 노동통계국)는 1차에서 403 으로 막혔습니다.
    위장해서 다시 두드리지 않습니다. 대신 '공개된 캘린더 파일' 이
    따로 있는지만 봅니다 — 있으면 그건 가져가라고 내어둔 것입니다.
    이것도 막히면 미국 CPI 발표일은 손으로 넣습니다(calendar.json).
  */
  {
    이름: "BLS 공개 캘린더(ics)",
    주소: "https://www.bls.gov/schedule/news_release/bls.ics",
    보기: (글) => ({ 앞머리: 글.slice(0, 600) }),
  },
];

const 결과 = [];
for (const 하나 of 할일) {
  try {
    const 받은것 = await 받아오기(하나.주소);
    결과.push({
      이름: 하나.이름,
      주소: 하나.주소,
      상태: 받은것.상태,
      성공: 받은것.ok,
      종류: 받은것.종류,
      길이: 받은것.글.length,
      ...(받은것.ok ? 하나.보기(받은것.글) : { 앞머리: 받은것.글.replace(/\s+/g, " ").slice(0, 300) }),
    });
    console.log(`${받은것.ok ? "[O]" : "[X]"} ${하나.이름} — 상태 ${받은것.상태}, ${받은것.글.length}바이트`);
  } catch (오류) {
    결과.push({ 이름: 하나.이름, 주소: 하나.주소, 성공: false, 까닭: String(오류.message).slice(0, 200) });
    console.log(`[X] ${하나.이름} — ${오류.message}`);
  }
}

await mkdir(자료폴더, { recursive: true });
await writeFile(
  path.join(자료폴더, "_probe.json"),
  JSON.stringify({ 다녀온시각: new Date().toISOString(), 차수: 2, 결과 }, null, 1),
  "utf8",
);
console.log("\nstocks/data/_probe.json 에 담았습니다");
