/*
  ============================================================
  earnings-probe.mjs  =  실적 발표 일정을 어디서 가져올까 (한 번 쓰고 지울 파일)

  풀어야 할 문제

    일꾼은 사용자의 관심 종목을 모릅니다. 브라우저에만 저장했기 때문입니다.
    (공개 저장소라 어떤 종목을 보는지 올리지 않기로 했습니다)
    그런데 실적 발표일을 가져오려면 어떤 기업인지 알아야 합니다.

  푸는 방법

    "그날 실적을 발표하는 기업 전체" 를 통째로 받아둡니다.
    그러면 일꾼은 누구 것인지 모른 채로 명단만 올려두고,
    앱이 그중에서 내 관심 종목을 골라내면 됩니다.
    개인 정보는 한 발짝도 밖으로 안 나갑니다.

  두드려볼 곳
    미국 — 나스닥 실적 캘린더, 야후 파이낸스
    한국 — 네이버 금융, 한국거래소

  ※ 위장하지 않습니다. 우리를 밝히는 머리말만 씁니다.
     막는 곳은 막힌 대로 두고 다른 길을 찾습니다.
  ============================================================
*/

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const 여기 = path.dirname(new URL(import.meta.url).pathname);
const 자료폴더 = path.join(여기, "..", "data");

const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "ko,en;q=0.8",
};

/* 내일 날짜 — 실적 발표는 보통 장 마감 뒤라 내일 것을 물어봅니다 */
const 내일 = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const 볼곳 = [
  /*
    야후 실적 캘린더 화면만 열렸습니다(1MB HTML).
    여기서 '그날 실적 발표하는 기업' 을 뽑아낼 수 있는지 봅니다.
    React 로 그리는 화면이라 데이터가 HTML 안에 JSON 으로 박혀 있을 수도,
    아니면 표로 그려져 있을 수도, 아니면 브라우저에서만 채워질 수도 있습니다.
  */
  { 이름: "야후 실적 캘린더", json: false, 기다림: 30000,
    주소: `https://finance.yahoo.com/calendar/earnings?day=${내일}` },
];

async function 두드리기(하나) {
  try {
    const 답 = await fetch(하나.주소, {
      headers: 머리말,
      signal: AbortSignal.timeout(하나.기다림 || 20000),
      redirect: "follow",
    });
    const 글 = await 답.text();
    const 한칸 = {
      이름: 하나.이름,
      주소: 하나.주소,
      상태: 답.status,
      성공: 답.ok,
      종류: 답.headers.get("content-type") || null,
      길이: 글.length,
    };

    if (답.ok && !하나.json) {
      /*
        종목 심볼이 HTML 안에 실제로 들어 있는지 봅니다.
        들어 있으면 긁어낼 수 있고, 없으면 브라우저에서만 채워지는
        화면이라 일꾼으로는 가져올 수 없습니다.
      */
      한칸.표개수 = (글.match(/<table/gi) || []).length;
      한칸.tr개수 = (글.match(/<tr[\s>]/gi) || []).length;
      // /quote/AAPL 같은 종목 링크
      const 종목링크 = [...글.matchAll(/\/quote\/([A-Z][A-Z.\-]{0,6})[\/?"]/g)]
        .map((ㄱ) => ㄱ[1]);
      한칸.종목링크수 = 종목링크.length;
      한칸.종목보기 = [...new Set(종목링크)].slice(0, 15);
      // 화면에 박아둔 JSON 덩어리가 있는지
      한칸.root앱있나 = /root\.App\.main|__NEXT_DATA__|application\/json/.test(글);
      // 'Earnings Date' 같은 글자 둘레
      const i = 글.search(/Earnings\s*(Date|Call)/i);
      한칸.실적글둘레 = i >= 0 ? 글.slice(Math.max(0, i - 150), i + 350).replace(/\s+/g, " ") : null;
    }

    if (답.ok && 하나.json) {
      try {
        const 알맹이 = JSON.parse(글);
        // 어떤 모양인지 보려고 열쇠 이름만 훑습니다 (값은 길어서 일부만)
        한칸.열쇠들 = Object.keys(알맹이 || {});
        한칸.앞머리 = JSON.stringify(알맹이).slice(0, 900);
      } catch (오류) {
        한칸.앞머리 = 글.slice(0, 300);
        한칸.json아님 = true;
      }
    } else {
      한칸.앞머리 = 글.replace(/\s+/g, " ").slice(0, 300);
    }
    return 한칸;
  } catch (오류) {
    return { 이름: 하나.이름, 주소: 하나.주소, 성공: false,
             까닭: String(오류.message).slice(0, 150) };
  }
}

const 결과 = [];
for (const 하나 of 볼곳) {
  const ㄱ = await 두드리기(하나);
  결과.push(ㄱ);
  console.log(`${ㄱ.성공 ? "[O]" : "[X]"} ${ㄱ.이름} — ${ㄱ.상태 ?? ㄱ.까닭}, ${ㄱ.길이 ?? 0}바이트`);
}

await mkdir(자료폴더, { recursive: true });
await writeFile(
  path.join(자료폴더, "_earn_probe.json"),
  JSON.stringify({ 다녀온시각: new Date().toISOString(), 물어본날: 내일, 결과 }, null, 1),
  "utf8",
);
console.log("\nstocks/data/_earn_probe.json 에 담았습니다");
