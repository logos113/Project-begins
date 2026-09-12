/*
  상단 '검색 조건' 줄이 화면 크기에 상관없이 가지런히 놓이는지 검사합니다.

  이 검사가 만들어진 이유:
    처음에는 flex(가로로 늘어놓고 넘치면 줄바꿈)로 만들었습니다.
    선택칸이 세 개일 때는 한 줄에 들어가서 문제가 없었는데,
    번역·이미 본 논문이 더해져 다섯 개가 되자 두 줄로 나뉘었고,
    flex 는 남는 공간을 "마지막 줄에 있는 것들끼리" 나눠 갖기 때문에
    아랫줄 칸만 유난히 넓어져 세로선이 어긋나 보였습니다.

    grid(격자)로 바꾸면 줄마다 칸 너비가 같아집니다.
    다만 이건 눈으로만 알 수 있는 문제라, 나중에 칸을 하나 더 넣었을 때
    또 어긋나도 아무도 모를 수 있습니다. 그래서 좌표를 직접 재둡니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/layout.test.mjs

  아이패드에서는 실행할 수 없습니다. 확인이 필요하면 Claude에게 부탁하세요.
*/
import { chromium } from "playwright";
import http from "http"; import fs from "fs"; import path from "path";

const 뿌리 = path.join(import.meta.dirname, "..");
const 종류 = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript",
               ".json":"application/json", ".png":"image/png" };
const 서버 = http.createServer((req, res) => {
  let u = req.url.split("?")[0];
  if (u.endsWith("/")) u += "index.html";
  const p = path.join(뿌리, u);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": 종류[path.extname(p)] || "text/plain" });
  res.end(fs.readFileSync(p));
});
await new Promise((r) => 서버.listen(8770, r));

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

/*
  화면 폭을 하나 정해서 열고, 상단 조건칸들의 위치를 재서 돌려줍니다.
  논문을 실제로 부를 필요는 없으므로 PubMed 는 빈 결과로 답하게 둡니다.
*/
async function 재보기(폭) {
  const page = await browser.newPage({ viewport: { width: 폭, height: 1000 } });
  await page.route("**/api.mymemory.translated.net/**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ responseData: { translatedText: "옮긴 문장입니다." } }) }));
  await page.route("**/eutils.ncbi.nlm.nih.gov/**", (route) =>
    route.fulfill({ contentType: "application/json",
      body: JSON.stringify({ esearchresult: { idlist: [] } }) }));
  await page.goto("http://localhost:8770/psychiatry/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".controls .control");

  const 잰것 = await page.evaluate(() => {
    const 상자 = document.querySelector(".controls");
    const 칸들 = [...상자.children].map((el) => {
      const r = el.getBoundingClientRect();
      // 각 칸의 '실제 입력 요소' — 선택칸이거나, 버튼 묶음이면 첫 버튼
      const 입력 = el.querySelector("select, button");
      const 라벨 = el.querySelector("label");
      return {
        이름: 라벨 ? 라벨.textContent.trim() : "버튼 묶음",
        왼쪽: Math.round(r.left), 오른쪽: Math.round(r.right), 폭: Math.round(r.width),
        윗선: Math.round(r.top),
        입력아랫선: 입력 ? Math.round(입력.getBoundingClientRect().bottom) : null,
        입력높이: 입력 ? Math.round(입력.getBoundingClientRect().height) : null,
        라벨잘림: 라벨 ? 라벨.scrollWidth > 라벨.clientWidth + 1 : false,
      };
    });
    return {
      칸들,
      // 선택칸 안의 글자가 칸 밖으로 밀려나지는 않는가
      글자잘림: [...상자.querySelectorAll("select")]
        .filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id),
      가로스크롤: document.documentElement.scrollWidth
                  > document.documentElement.clientWidth + 1,
    };
  });
  await page.close();
  return 잰것;
}

/*
  한 줄(=입력칸 아랫선이 같은 것들)끼리 묶습니다.
  라벨 길이가 달라도 아랫선은 같아야 하므로, 윗선이 아니라 아랫선으로 묶습니다.
*/
function 줄별로(칸들) {
  const 줄 = new Map();
  for (const 칸 of 칸들) {
    const 열쇠 = 칸.입력아랫선;
    if (!줄.has(열쇠)) 줄.set(열쇠, []);
    줄.get(열쇠).push(칸);
  }
  return [...줄.values()];
}

for (const 폭 of [1440, 1280, 1024, 820, 560, 390]) {
  console.log(`\n── 화면 폭 ${폭}px ──`);
  const { 칸들, 글자잘림, 가로스크롤 } = await 재보기(폭);

  검사(`  칸이 여섯 개 모두 있는가`, 칸들.length === 6, 칸들.length);
  검사(`  가로 스크롤이 생기지 않는가`, !가로스크롤);
  검사(`  선택칸 글자가 잘리지 않는가`, 글자잘림.length === 0, 글자잘림);
  검사(`  라벨이 두 줄로 접히지 않는가`,
       칸들.every((칸) => !칸.라벨잘림),
       칸들.filter((칸) => 칸.라벨잘림).map((칸) => 칸.이름));

  // 선택칸과 버튼의 높이가 같아야 아랫선이 딱 맞습니다
  const 높이들 = [...new Set(칸들.map((칸) => 칸.입력높이))];
  검사(`  선택칸과 버튼 높이가 모두 같은가`, 높이들.length === 1, 높이들);

  const 줄들 = 줄별로(칸들);
  검사(`  줄 수가 적당한가 (1~6줄)`, 줄들.length >= 1 && 줄들.length <= 6, 줄들.length);

  for (const [번호, 줄] of 줄들.entries()) {
    // 같은 줄의 칸들은 너비가 같아야 합니다 (flex 시절에 어긋났던 부분)
    const 폭들 = [...new Set(줄.map((칸) => 칸.폭))];
    검사(`  ${번호 + 1}번째 줄 — 칸 너비가 서로 같은가`, 폭들.length === 1, 폭들);
  }

  // 줄이 여러 개라면, 아랫줄의 칸들이 윗줄 칸들과 같은 세로선에 놓여야 합니다
  if (줄들.length >= 2) {
    const 기준 = 줄들[0].map((칸) => 칸.왼쪽);
    const 어긋난줄 = 줄들.slice(1).filter((줄) =>
      줄.some((칸, i) => i < 기준.length && 칸.왼쪽 !== 기준[i]));
    검사(`  아랫줄이 윗줄과 같은 세로선에 맞는가`, 어긋난줄.length === 0,
         어긋난줄.map((줄) => 줄.map((칸) => `${칸.이름}@${칸.왼쪽}`)));
  }

  // 맨 왼쪽·맨 오른쪽 끝이 본문 폭과 맞아야 화면이 삐뚤어 보이지 않습니다
  const 왼쪽끝 = Math.min(...칸들.map((칸) => 칸.왼쪽));
  const 오른쪽끝 = Math.max(...칸들.map((칸) => 칸.오른쪽));
  검사(`  모든 줄이 같은 왼쪽 끝에서 시작하는가`,
       줄들.every((줄) => Math.min(...줄.map((칸) => 칸.왼쪽)) === 왼쪽끝));
  검사(`  모든 줄이 같은 오른쪽 끝에서 끝나는가`,
       줄들.every((줄) => Math.max(...줄.map((칸) => 칸.오른쪽)) === 오른쪽끝));
}

await browser.close();
서버.close();

if (실패 > 0) { console.log(`\n❌ ${실패}개 실패`); process.exit(1); }
console.log("\n🎉 상단 조건칸 정렬 — 전체 정상");
