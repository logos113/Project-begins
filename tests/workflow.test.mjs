/*
  깃허브 일꾼(.github/workflows/*.yml)이 '실행될 수 있는 모양' 인지 봅니다.

  실행:
    node tests/workflow.test.mjs

  왜 이런 검사가 필요한가

    깃허브 워크플로는 규칙에 어긋나면 **아무 일도 일어나지 않습니다.**
    빨간 표시도 안 뜨고, 기록도 안 남고, 그냥 조용합니다.
    실제로 job 이름을 '만들기' 라고 한국어로 적었다가 40분을 기다렸습니다.
    깃허브는 job 이름에 영문·숫자·하이픈·밑줄만 받습니다.

    이 저장소는 코드를 한국어로 짭니다. 그래서 '여기만은 영어' 인 자리를
    자꾸 잊게 됩니다. 셸 변수 이름이 그랬고, job 이름이 그랬습니다.
    사람이 기억하는 대신 검사가 잡게 합니다.

  ※ YAML 라이브러리를 쓰지 않습니다 (이 저장소의 규칙).
     줄 단위로 읽어서 필요한 것만 확인합니다.
*/

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const 여기 = path.dirname(new URL(import.meta.url).pathname);
const 일꾼폴더 = path.join(여기, "..", ".github", "workflows");

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패 += 1;
};

검사("워크플로 폴더가 있는가", existsSync(일꾼폴더), 일꾼폴더);

const 파일들 = existsSync(일꾼폴더)
  ? readdirSync(일꾼폴더).filter((ㅍ) => ㅍ.endsWith(".yml") || ㅍ.endsWith(".yaml"))
  : [];
검사("워크플로 파일이 하나 이상 있는가", 파일들.length > 0, 파일들);

/*
  'jobs:' 아래에 두 칸 들여써서 적은 이름들을 뽑아냅니다.

    jobs:
      build:          ← 이것
        runs-on: ...
        steps:
          - name: ... ← 이건 더 깊이 들어가 있으니 안 걸립니다
*/
function job이름_뽑기(글) {
  const 줄들 = 글.split("\n");
  const 이름들 = [];
  let jobs안인가 = false;

  for (const 줄 of 줄들) {
    if (/^jobs:\s*$/.test(줄)) { jobs안인가 = true; continue; }
    if (!jobs안인가) continue;

    // 들여쓰기가 없는 줄이 나오면 jobs 블록이 끝난 것입니다
    if (/^\S/.test(줄) && 줄.trim() !== "") break;

    // 주석과 빈 줄은 건너뜁니다
    if (/^\s*#/.test(줄) || 줄.trim() === "") continue;

    const 걸린것 = 줄.match(/^ {2}([^\s:#]+):\s*$/);
    if (걸린것) 이름들.push(걸린것[1]);
  }
  return 이름들;
}

const job규칙 = /^[A-Za-z_][A-Za-z0-9_-]*$/;

for (const 파일 of 파일들) {
  const 글 = readFileSync(path.join(일꾼폴더, 파일), "utf8");

  /* --- 기본 모양 --- */
  검사(`${파일} — name 이 있는가`, /^name:\s*\S/m.test(글));
  검사(`${파일} — on 이 있는가`, /^on:\s*$/m.test(글) || /^on:\s*\S/m.test(글));
  검사(`${파일} — jobs 가 있는가`, /^jobs:\s*$/m.test(글));

  /* --- ★ job 이름이 영문인가 (한국어면 조용히 안 돕니다) --- */
  const job이름들 = job이름_뽑기(글);
  검사(`${파일} — job 이름을 찾았는가`, job이름들.length > 0, job이름들);
  for (const 이름 of job이름들) {
    검사(`${파일} — job 이름 "${이름}" 이 영문·숫자인가`,
      job규칙.test(이름),
      { 이름, 왜: "깃허브는 영문·숫자·하이픈·밑줄만 받습니다. 한국어면 워크플로가 조용히 안 돕니다" });
  }

  /* --- 저장소에 결과를 올리는 일꾼이면 쓰기 권한이 있어야 합니다 --- */
  const 올리나 = /git\s+push/.test(글);
  if (올리나) {
    검사(`${파일} — 올리는 일꾼인데 contents: write 가 있는가`,
      /permissions:[\s\S]{0,200}?contents:\s*write/.test(글),
      "git push 를 하는데 쓰기 권한이 없으면 올리지 못합니다");
  }

  /* --- cron 모양이 맞는가 --- */
  const cron들 = [...글.matchAll(/cron:\s*["']([^"']+)["']/g)].map((ㄱ) => ㄱ[1]);
  for (const c of cron들) {
    검사(`${파일} — cron "${c}" 이 다섯 칸인가`,
      c.trim().split(/\s+/).length === 5, c);
  }

  /*
    결과를 올리는 일꾼이 '결과 폴더' 때문에 다시 깨어나면 끝없이 돕니다.
    push 로 깨어나는 일꾼은 paths 로 범위를 좁혀두어야 합니다.
  */
  if (올리나 && /^\s{2}push:/m.test(글)) {
    검사(`${파일} — push 로 도는데 paths 로 범위를 좁혔는가`,
      /paths:/.test(글),
      "범위를 안 좁히면 자기가 올린 결과를 보고 또 깨어납니다");
    검사(`${파일} — 결과 폴더(data)가 깨우는 범위에 없는가`,
      !/paths:[\s\S]{0,400}?stocks\/data/.test(글),
      "결과 폴더가 들어 있으면 끝없이 돕니다");
  }
}

console.log(실패 === 0
  ? "\n🎉 워크플로가 실행될 수 있는 모양입니다"
  : `\n⚠️ ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
