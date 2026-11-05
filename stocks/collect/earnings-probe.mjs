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
  // 1차에서 타임아웃이었습니다. 느린 것일 수 있어 넉넉히 기다려 봅니다.
  { 이름: "나스닥 실적캘린더(재시도)",
    주소: `https://api.nasdaq.com/api/calendar/earnings?date=${내일}`,
    json: true, 기다림: 40000 },

  // 무료로 실적 일정을 보여주는 곳으로 알려진 데들
  { 이름: "stockanalysis 실적",
    주소: "https://stockanalysis.com/markets/earnings/", json: false },
  { 이름: "야후 실적 캘린더(화면)",
    주소: `https://finance.yahoo.com/calendar/earnings?day=${내일}`, json: false },

  // 키가 필요한지 확인만 — 필요하다고 하면 그 자체가 답입니다
  { 이름: "Finnhub (키 없이)",
    주소: `https://finnhub.io/api/v1/calendar/earnings?from=${내일}&to=${내일}`, json: true },
  { 이름: "DART 한국공시 (키 없이)",
    주소: "https://opendart.fss.or.kr/api/list.json?bgn_de=20261105&end_de=20261112",
    json: true },
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
