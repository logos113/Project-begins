/*
  ============================================================
  calendar-probe.mjs  =  일정 사이트 정찰 (한 번 쓰고 지울 파일)

  FOMC·금통위·CPI 일정을 긁어오려는데, 저(Claude)는 이 사이트들에
  접근할 수 없습니다. 세션의 네트워크가 막혀 있습니다.
  구조를 모르는 채로 파서를 짜면 '그럴듯하게 틀린 날짜' 가 나옵니다.
  투자 일정에서 그건 없느니만 못합니다.

  그래서 일꾼에게 먼저 다녀오라고 시킵니다.
    1) 페이지를 열어서
    2) 날짜가 있을 법한 부분만 떠서
    3) stocks/data/_probe.json 에 담아 올립니다

  그걸 보고 진짜 파서를 짭니다. 짜고 나면 이 파일은 지웁니다.

  ※ 페이지 전체를 올리지 않습니다. 저장소가 쓸데없이 커집니다.
     꼬리표가 될 만한 조각만 추려 담습니다.
  ============================================================
*/

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const 여기 = path.dirname(new URL(import.meta.url).pathname);
const 자료폴더 = path.join(여기, "..", "data");

const 볼곳 = [
  {
    이름: "FOMC (연준)",
    주소: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    찾을말: ["fomc", "meeting", "2026", "2027"],
  },
  {
    이름: "미국 CPI 발표일 (BLS)",
    주소: "https://www.bls.gov/schedule/news_release/cpi.htm",
    찾을말: ["cpi", "consumer price", "2026", "2027"],
  },
  {
    이름: "BLS 전체 발표일정",
    주소: "https://www.bls.gov/schedule/2026/home.htm",
    찾을말: ["schedule", "2026", "release"],
  },
  {
    이름: "한국은행 금통위",
    주소: "https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755",
    찾을말: ["금통위", "통화정책", "회의", "2026"],
  },
  {
    이름: "한국은행 금통위(영문)",
    주소: "https://www.bok.or.kr/eng/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=400069",
    찾을말: ["monetary policy", "meeting", "2026"],
  },
];

const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
  "Accept": "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "ko,en;q=0.8",
};

/* 꺾쇠를 걷어내고 글자만 남깁니다 (구조를 볼 때는 이쪽이 읽기 쉽습니다) */
function 글자만(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  날짜처럼 생긴 것 주변을 떠옵니다.
  어떤 모양으로 적혀 있는지 봐야 파서를 짤 수 있습니다.
*/
function 날짜조각_뜨기(글, 몇개 = 12) {
  const 본것 = [];
  const 모양들 = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(\s*[-–]\s*\d{1,2})?,?\s*20\d\d/gi,
    /\b20\d\d[-./]\d{1,2}[-./]\d{1,2}\b/g,
    /\d{1,2}월\s*\d{1,2}일/g,
    /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(\s*[-–]\s*\d{1,2})?\b/gi,
  ];
  for (const 모양 of 모양들) {
    for (const 걸린것 of 글.matchAll(모양)) {
      const 앞 = Math.max(0, 걸린것.index - 60);
      본것.push({
        걸린글: 걸린것[0],
        둘레: 글.slice(앞, 걸린것.index + 걸린것[0].length + 60),
      });
      if (본것.length >= 몇개) return 본것;
    }
  }
  return 본것;
}

/* class 이름을 세어봅니다 — 어떤 상자에 담겨 있는지 짐작하는 데 씁니다 */
function 클래스_세기(html, 찾을말, 몇개 = 20) {
  const 셈 = new Map();
  for (const 걸린것 of html.matchAll(/class=["']([^"']+)["']/g)) {
    for (const 이름 of 걸린것[1].split(/\s+/)) {
      if (!이름) continue;
      const 낮춘 = 이름.toLowerCase();
      // 찾는 말이 들어간 클래스만 — 전부 세면 수백 개라 못 봅니다
      if (찾을말.some((ㅁ) => 낮춘.includes(ㅁ.toLowerCase().split(" ")[0]))) {
        셈.set(이름, (셈.get(이름) || 0) + 1);
      }
    }
  }
  return [...셈.entries()].sort((ㄱ, ㄴ) => ㄴ[1] - ㄱ[1]).slice(0, 몇개)
    .map(([이름, 수]) => `${이름} (${수}번)`);
}

async function 정찰(하나) {
  const 시작 = Date.now();
  try {
    const 답 = await fetch(하나.주소, {
      headers: 머리말,
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const html = await 답.text();
    const 글 = 글자만(html);

    return {
      이름: 하나.이름,
      주소: 하나.주소,
      성공: 답.ok,
      상태: 답.status,
      걸린시간: Date.now() - 시작,
      내용종류: 답.headers.get("content-type") || null,
      html길이: html.length,
      글자길이: 글.length,
      // 어떤 틀에 담겨 있나
      쓸만한_클래스: 클래스_세기(html, 하나.찾을말),
      // 표로 되어 있나
      표개수: (html.match(/<table/gi) || []).length,
      // 날짜가 어떤 모양으로 적혀 있나 — 이게 제일 중요합니다
      날짜조각: 날짜조각_뜨기(글),
      // 글 앞부분 — 제대로 된 페이지인지, 막힌 페이지인지 구별용
      글_앞머리: 글.slice(0, 400),
    };
  } catch (오류) {
    return {
      이름: 하나.이름,
      주소: 하나.주소,
      성공: false,
      까닭: String(오류.name === "TimeoutError" ? "시간 초과" : 오류.message).slice(0, 200),
    };
  }
}

const 결과 = await Promise.all(볼곳.map(정찰));

await mkdir(자료폴더, { recursive: true });
await writeFile(
  path.join(자료폴더, "_probe.json"),
  JSON.stringify({ 다녀온시각: new Date().toISOString(), 결과 }, null, 1),
  "utf8",
);

console.log("=== 정찰 결과 ===");
for (const ㄱ of 결과) {
  if (!ㄱ.성공) {
    console.log(`[X] ${ㄱ.이름} — ${ㄱ.까닭 || "상태 " + ㄱ.상태}`);
    continue;
  }
  console.log(`[O] ${ㄱ.이름} — ${ㄱ.html길이}바이트, 표 ${ㄱ.표개수}개, 날짜조각 ${ㄱ.날짜조각.length}개`);
}
console.log("\n자세한 것은 stocks/data/_probe.json 에 담았습니다");
