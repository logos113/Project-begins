/*
  ============================================================
  build.mjs  =  아침 브리핑 한 장 만들기

  깃허브 일꾼이 매일 아침 이 파일을 실행합니다. 하는 일은 셋입니다.

    1) 뉴스·시세·일정을 모은다
    2) 하나의 JSON 으로 합친다
    3) stocks/data/ 에 써 둔다

  앱(브라우저)은 그 JSON 만 읽습니다. 남의 사이트를 직접 부르지 않습니다.
  그래서 열쇠가 새어나갈 일이 없고, 브라우저가 막는 문제(CORS)도 없고,
  비행기 모드에서도 어제 것이 보입니다.

  실행:  node stocks/collect/build.mjs
  ============================================================
*/

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { 뉴스출처 } from "./sources.mjs";
import { rss_여러곳_읽기 } from "./rss.mjs";
import { 갈래별_정리 } from "./news.mjs";
import { 지수_모으기, 코인_모으기 } from "./prices.mjs";
import { 일정_모으기, 한국날짜 } from "./schedule.mjs";

const 여기 = path.dirname(new URL(import.meta.url).pathname);
const 앱폴더 = path.join(여기, "..");
const 자료폴더 = path.join(앱폴더, "data");

/*
  갈래마다 몇 개까지 보여줄지. 너무 많으면 아침에 읽기 싫어집니다.
  기사를 추리는 일(오래된 것·겹치는 것 빼기)은 news.mjs 가 합니다.
*/
const 갈래당_기사수 = 12;

/* calendar.json 을 읽습니다. 없으면 빈 목록 — 지어내지 않습니다. */
async function 등록일정_읽기() {
  const 자리 = path.join(앱폴더, "calendar.json");
  if (!existsSync(자리)) return { 일정: [], 메모: "calendar.json 이 없습니다" };
  try {
    const 읽은것 = JSON.parse(await readFile(자리, "utf8"));
    const 일정 = Array.isArray(읽은것) ? 읽은것 : (읽은것.일정 || []);
    return { 일정, 메모: null };
  } catch (오류) {
    return { 일정: [], 메모: `calendar.json 을 읽지 못했습니다: ${오류.message}` };
  }
}

async function 만들기() {
  const 지금 = Date.now();
  const 오늘 = 한국날짜();
  console.log(`[브리핑] ${오늘} 자료를 모읍니다`);

  /* --- 동시에 모읍니다. 하나씩 하면 그만큼 오래 걸립니다 --- */
  const [뉴스결과, 지수결과, 코인결과, 등록된것] = await Promise.all([
    rss_여러곳_읽기(뉴스출처),
    지수_모으기(),
    코인_모으기(),
    등록일정_읽기(),
  ]);

  /* --- 뉴스 정리 (오래된 것·겹치는 것 빼기는 news.mjs 가 합니다) --- */
  const 뉴스 = 갈래별_정리(뉴스결과, 지금, 갈래당_기사수);

  /*
    어디서 가져왔고 어디가 실패했는지 남깁니다.

    이게 있어야 "요즘 한국 뉴스가 안 뜨네?" 할 때 원인을 찾을 수 있습니다.
    앱 맨 아래에도 조용히 보여줍니다.
  */
  const 출처상태 = 뉴스결과.map((하나) => ({
    이름: 하나.출처,
    성공: 하나.성공,
    개수: 하나.기사.length,
    까닭: 하나.까닭 || null,
  }));

  /* --- 일정 --- */
  const 일정 = 일정_모으기(오늘, 등록된것.일정, 14);

  /* --- 한 장으로 합치기 --- */
  const 브리핑 = {
    날짜: 오늘,
    만든시각: new Date().toISOString(),
    시세: {
      지수: 지수결과.값들,
      코인: 코인결과.값들,
      못가져온것: [...지수결과.못가져온것, ...코인결과.못가져온것],
    },
    일정: {
      오늘: 일정.filter((ㅇ) => ㅇ.오늘인가),
      이번주: 일정.filter((ㅇ) => ㅇ.이번주인가 && !ㅇ.오늘인가),
      다음주: 일정.filter((ㅇ) => !ㅇ.이번주인가),
      // calendar.json 이 비었으면 앱이 "직접 넣어주세요" 라고 안내할 수 있게 알려줍니다
      등록일정_있나: 등록된것.일정.length > 0,
      메모: 등록된것.메모,
    },
    뉴스,
    출처상태,
  };

  /* --- 써 두기 --- */
  await mkdir(자료폴더, { recursive: true });
  // 앱이 늘 읽는 자리 (파일 이름이 안 바뀌어야 앱이 찾을 수 있습니다)
  await writeFile(path.join(자료폴더, "latest.json"), JSON.stringify(브리핑, null, 1), "utf8");
  // 날짜별로도 남겨둡니다 — 나중에 지난 브리핑을 돌아볼 수 있게
  await writeFile(path.join(자료폴더, `${오늘}.json`), JSON.stringify(브리핑, null, 1), "utf8");

  /* --- 사람이 보라고 찍는 요약 (일꾼 기록에 남습니다) --- */
  const 된곳 = 출처상태.filter((ㅅ) => ㅅ.성공);
  const 안된곳 = 출처상태.filter((ㅅ) => !ㅅ.성공);
  console.log(`[뉴스] 출처 ${된곳.length}/${출처상태.length} 곳 성공`);
  console.log(`       한국 ${뉴스.한국.length} · 미국 ${뉴스.미국.length} · 코인 ${뉴스.코인.length} 건`);
  if (안된곳.length) {
    console.log("[뉴스] 실패한 곳:");
    for (const ㅅ of 안된곳) console.log(`       - ${ㅅ.이름}: ${ㅅ.까닭}`);
  }
  console.log(`[시세] 지수 ${지수결과.값들.length}개 · 코인 ${코인결과.값들.length}개`);
  for (const ㅁ of 브리핑.시세.못가져온것) console.log(`       - 못 가져옴: ${ㅁ.이름} (${ㅁ.까닭})`);
  console.log(`[일정] 오늘 ${브리핑.일정.오늘.length} · 이번주 ${브리핑.일정.이번주.length} · 다음주 ${브리핑.일정.다음주.length}`);
  if (!브리핑.일정.등록일정_있나) {
    console.log("       (FOMC·금통위 같은 일정은 calendar.json 에 넣어야 나옵니다)");
  }

  /*
    아무것도 못 가져왔으면 일꾼을 실패로 끝냅니다.
    그래야 깃허브가 빨간 표시를 내주고, 뭔가 잘못된 걸 알 수 있습니다.
    (조용히 빈 브리핑이 올라가는 것이 제일 나쁩니다)
  */
  const 아무것도없나 = 된곳.length === 0
    && 지수결과.값들.length === 0
    && 코인결과.값들.length === 0;
  if (아무것도없나) {
    console.error("[실패] 뉴스도 시세도 하나도 가져오지 못했습니다");
    process.exitCode = 1;
  }
}

만들기().catch((오류) => {
  console.error("[실패]", 오류);
  process.exitCode = 1;
});
