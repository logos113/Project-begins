/*
  ============================================================
  cpi-probe.mjs  =  미국 CPI 발표일을 어디서 가져올까 (한 번 쓰고 지울 파일)

  BLS 의 cpi.htm 한 장이 403 으로 막혔다고 '손으로 넣으세요' 로
  결론지었는데, 성급했습니다. CPI 발표일은 공개 정보라 내놓는 곳이
  여럿입니다. 여러 문을 두드려보고 되는 곳을 씁니다.

  ※ 막은 문을 위장해서 뚫지 않습니다.
     BLS 가 cpi.htm 에 "오지 마세요" 라고 했으면 그건 그대로 둡니다.
     여기서 BLS 를 다시 부르는 것은 그쪽이 '배포하라고 내어둔'
     RSS 피드와 연간 일정 페이지입니다. 우회가 아니라 다른 문입니다.
     우리를 밝히는 머리말만 씁니다.
  ============================================================
*/

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const 여기 = path.dirname(new URL(import.meta.url).pathname);
const 자료폴더 = path.join(여기, "..", "data");

const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
  "Accept": "text/html,application/xhtml+xml,application/rss+xml,application/json,*/*",
  "Accept-Language": "en,ko;q=0.8",
};

const 볼곳 = [
  // --- BLS 가 배포하라고 내어둔 문들 ---
  { 이름: "BLS 소식 RSS", 주소: "https://www.bls.gov/feed/bls_latest.rss" },
  { 이름: "BLS CPI RSS", 주소: "https://www.bls.gov/feed/cpi.rss" },
  { 이름: "BLS 2026 일정", 주소: "https://www.bls.gov/schedule/2026/02_sched.htm" },
  { 이름: "BLS 일정 메인", 주소: "https://www.bls.gov/schedule/" },

  // --- 이미 RSS 로 접근에 성공한 도메인 ---
  { 이름: "Investing 경제캘린더", 주소: "https://www.investing.com/economic-calendar/" },

  // --- 널리 쓰이는 경제 캘린더 ---
  { 이름: "Trading Economics", 주소: "https://tradingeconomics.com/united-states/calendar" },
  { 이름: "FXStreet 캘린더", 주소: "https://www.fxstreet.com/economic-calendar" },

  // --- 세인트루이스 연준(FRED). 키 없이 되는지 봅니다 ---
  // release_id=10 이 소비자물가지수(CPI)입니다
  { 이름: "FRED 발표일(키 없이)",
    주소: "https://api.stlouisfed.org/fred/release/dates?release_id=10&file_type=json" },
  { 이름: "FRED 공개 캘린더 페이지",
    주소: "https://fred.stlouisfed.org/releases/calendar" },
];

/* 꺾쇠를 걷어내고 글자만 */
function 글자만(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* 'CPI' 나 'Consumer Price' 둘레를 떠옵니다 — 날짜가 함께 적혀 있는지 보려고 */
function CPI둘레_뜨기(글, 몇개 = 6) {
  const 나온것 = [];
  for (const 걸린것 of 글.matchAll(/(CPI|Consumer Price Index)/gi)) {
    const 앞 = Math.max(0, 걸린것.index - 110);
    const 조각 = 글.slice(앞, 걸린것.index + 150);
    // 날짜처럼 보이는 것이 같이 있는 조각만 (그래야 쓸모가 있습니다)
    if (/\d{1,2}[/-]\d{1,2}|20\d\d|January|February|March|April|May|June|July|August|September|October|November|December|Jan |Feb |Mar |Apr |Jun |Jul |Aug |Sep |Oct |Nov |Dec /i.test(조각)) {
      나온것.push(조각);
      if (나온것.length >= 몇개) break;
    }
  }
  return 나온것;
}

const 결과 = [];
for (const 하나 of 볼곳) {
  try {
    const 답 = await fetch(하나.주소, {
      headers: 머리말,
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const 글 = await 답.text();
    const 종류 = 답.headers.get("content-type") || "";

    const 한칸 = {
      이름: 하나.이름,
      주소: 하나.주소,
      상태: 답.status,
      성공: 답.ok,
      종류,
      길이: 글.length,
    };

    if (답.ok) {
      if (종류.includes("json")) {
        한칸.앞머리 = 글.slice(0, 500);
      } else {
        const 맨글 = 글자만(글);
        한칸.CPI둘레 = CPI둘레_뜨기(맨글);
        한칸.앞머리 = 맨글.slice(0, 250);
      }
    } else {
      한칸.앞머리 = 글.replace(/\s+/g, " ").slice(0, 200);
    }

    결과.push(한칸);
    console.log(`${답.ok ? "[O]" : "[X]"} ${하나.이름} — ${답.status}, ${글.length}바이트`
      + (한칸.CPI둘레 ? `, CPI조각 ${한칸.CPI둘레.length}개` : ""));
  } catch (오류) {
    결과.push({ 이름: 하나.이름, 주소: 하나.주소, 성공: false, 까닭: String(오류.message).slice(0, 150) });
    console.log(`[X] ${하나.이름} — ${오류.message}`);
  }
}

await mkdir(자료폴더, { recursive: true });
await writeFile(
  path.join(자료폴더, "_cpi_probe.json"),
  JSON.stringify({ 다녀온시각: new Date().toISOString(), 결과 }, null, 1),
  "utf8",
);
console.log("\nstocks/data/_cpi_probe.json 에 담았습니다");
