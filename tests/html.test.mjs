/*
  페이지의 '구조'를 검사합니다.
  지금 당장은 몰라도 됩니다. README의 "5단계"에서 다룹니다.
  실행법:  npm install jsdom  후  node tests/html.test.mjs

  이 검사가 만들어진 이유:
    주석 안에 주석을 또 넣는 실수 때문에 <head> 가 통째로 비어버렸고,
    그 안에 적어둔 아이콘 설정이 전부 무시되는 문제가 있었습니다.
    화면은 멀쩡해 보였기 때문에 원인을 찾는 데 한참 걸렸습니다.
    같은 일이 다시 생기면 이 검사가 바로 잡아냅니다.
*/
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const 뿌리 = path.join(import.meta.dirname, "..");
const 읽기 = (이름) => fs.readFileSync(path.join(뿌리, 이름), "utf8");

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

// ---- 1. 주석 안에 주석을 넣지 않았는가 ----
// HTML도 CSS도 주석 중첩을 지원하지 않습니다.
// 가장 먼저 나오는 닫는 표시에서 끝나버려, 나머지 글자가 화면에 노출됩니다.
const 주석중첩 = (글, 열기, 닫기) => {
  const i = 글.indexOf(열기);
  if (i < 0) return false;
  const 안쪽 = 글.slice(i + 열기.length, 글.indexOf(닫기, i + 열기.length));
  return 안쪽.includes(열기) || 안쪽.includes(닫기);
};
검사("index.html — 첫 주석에 중첩이 없는가", !주석중첩(읽기("index.html"), "<!--", "-->"));
검사("style.css  — 첫 주석에 중첩이 없는가", !주석중첩(읽기("style.css"), "/*", "*/"));
검사("app.js     — 첫 주석에 중첩이 없는가", !주석중첩(읽기("app.js"), "/*", "*/"));

// ---- 2. 브라우저가 해석했을 때 head가 제대로 만들어지는가 ----
const 문서 = new JSDOM(읽기("index.html")).window.document;

검사("<head> 가 비어 있지 않은가", 문서.head.children.length > 0, 문서.head.children.length);
검사("제목(title)이 head 안에 있는가", !!문서.head.querySelector("title"));
검사("스타일시트 연결이 head 안에 있는가", !!문서.head.querySelector('link[rel="stylesheet"]'));

// iOS는 홈 화면 아이콘을 head 에서만 찾습니다. body 에 있으면 없는 것으로 칩니다.
const 아이콘들 = [...문서.querySelectorAll('link[rel="apple-touch-icon"]')];
검사("홈 화면 아이콘이 3개 선언되어 있는가", 아이콘들.length === 3, 아이콘들.length);
검사("홈 화면 아이콘이 모두 head 안에 있는가",
  아이콘들.every((el) => 문서.head.contains(el)),
  아이콘들.map((el) => (문서.head.contains(el) ? "head" : "body")));
검사("일반 아이패드용 152 크기가 있는가",
  아이콘들.some((el) => el.getAttribute("sizes") === "152x152"));

// ---- 3. 화면 맨 앞에 엉뚱한 글자가 새어 나오지 않는가 ----
const 첫글자 = 문서.body.textContent.trim().slice(0, 40).replace(/\s+/g, " ");
검사("본문이 머리말부터 시작하는가 (깨진 글자가 없는가)",
  첫글자.startsWith("Psychiatry Daily Digest"), 첫글자);

// ---- 4. 연결한 파일이 실제로 존재하는가 ----
// 경로를 잘못 적으면 화면에서는 조용히 무시되기 때문에 눈으로는 알기 어렵습니다.
const 걸린주소 = [
  ...문서.querySelectorAll("link[href]"),
].map((el) => el.getAttribute("href")).filter((h) => !h.startsWith("http"));
const 스크립트 = [...문서.querySelectorAll("script[src]")].map((el) => el.getAttribute("src"));

for (const 주소 of [...걸린주소, ...스크립트]) {
  const 파일 = 주소.split("?")[0];   // ?v=2 같은 버전 표시는 떼고 확인합니다
  검사(`연결된 파일이 실제로 있는가 — ${주소}`, fs.existsSync(path.join(뿌리, 파일)));
}

// ---- 5. 아이콘 그림 파일이 올바른 PNG인가 ----
function png검사(이름) {
  const d = fs.readFileSync(path.join(뿌리, 이름));
  if (d.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return "PNG 서명 틀림";
  const 폭 = d.readUInt32BE(16), 높이 = d.readUInt32BE(20);
  if (폭 !== 높이) return `정사각형 아님 ${폭}x${높이}`;
  // 파일명에 적힌 크기와 실제 크기가 일치하는가
  const 적힌크기 = 이름.match(/(\d+)\.png$/)?.[1];
  if (적힌크기 && Number(적힌크기) !== 폭) return `파일명(${적힌크기})과 실제(${폭})가 다름`;
  // 압축을 풀어 픽셀 수가 맞는지까지 확인
  let idat = [], i = 8;
  while (i + 12 <= d.length) {
    const 길이 = d.readUInt32BE(i);
    if (d.subarray(i + 4, i + 8).toString() === "IDAT") idat.push(d.subarray(i + 8, i + 8 + 길이));
    i += 12 + 길이;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== 높이 * (폭 * 3 + 1)) return "픽셀 수가 맞지 않음";
  return null;
}

for (const 이름 of fs.readdirSync(path.join(뿌리, "icons"))) {
  const 문제 = png검사(path.join("icons", 이름));
  검사(`아이콘 그림이 올바른가 — ${이름}`, 문제 === null, 문제);
}

// ---- 6. 데스크탑 앱 설치 정보(manifest) 검사 ----
검사("manifest.json 이 head 안에서 연결되어 있는가",
  !!문서.head.querySelector('link[rel="manifest"]'));

const manifest = JSON.parse(fs.readFileSync(path.join(뿌리, "manifest.json"), "utf8"));
검사("앱 이름이 들어 있는가", !!manifest.name && !!manifest.short_name);
검사("시작 주소와 범위가 상대 경로인가 (하위 폴더 배포에 필요)",
  manifest.start_url === "./" && manifest.scope === "./", [manifest.start_url, manifest.scope]);
검사("창 모양이 앱처럼(standalone) 설정되어 있는가", manifest.display === "standalone", manifest.display);
검사("설치에 필요한 192·512 크기 아이콘이 모두 있는가",
  ["192x192", "512x512"].every((크기) => manifest.icons.some((아이콘) => 아이콘.sizes === 크기)),
  manifest.icons.map((아이콘) => 아이콘.sizes));
검사("둥글게 잘려도 괜찮은 maskable 아이콘이 있는가",
  manifest.icons.some((아이콘) => 아이콘.purpose === "maskable"));
for (const 아이콘 of manifest.icons) {
  검사(`manifest가 가리키는 파일이 실제로 있는가 — ${아이콘.src}`,
    fs.existsSync(path.join(뿌리, 아이콘.src)));
  const 문제 = png검사(아이콘.src);
  검사(`그 아이콘이 올바른 PNG인가 — ${아이콘.src.split("/").pop()}`, 문제 === null, 문제);
}

// ---- 7. 데스크탑 화면 규칙 검사 ----
const css = 읽기("style.css");
검사("넓은 화면용 규칙이 있는가", /@media \(min-width: 1180px\)/.test(css));
검사("넓은 화면에서 논문을 3열로 배치하는가",
  /grid-template-columns:\s*repeat\(3,\s*1fr\)/.test(css));
검사("마우스 있는 기기에서만 강조 효과가 적용되는가", /@media \(hover: hover\)/.test(css));
검사("좁은 화면(휴대폰)용 규칙도 그대로 남아 있는가", /@media \(max-width: 560px\)/.test(css));

// ---- 8. 화면 버전 표시 검사 ----
/*
  "고쳤는데 왜 그대로지?" 를 확인할 수 있게 하는 장치입니다.
  브라우저가 예전 파일을 계속 쓰고 있으면 이 숫자가 올라가지 않습니다.
*/
검사("꼬리말에 버전을 표시할 자리가 있는가", !!문서.getElementById("appVersion"));
const 스크립트태그 = 문서.querySelector('script[src*="app.js"]');
검사("app.js 를 부를 때 버전 번호가 붙어 있는가",
  /v=\d+/.test(스크립트태그?.getAttribute("src") || ""), 스크립트태그?.getAttribute("src"));
검사("style.css 에도 같은 버전 번호가 붙어 있는가",
  (문서.querySelector('link[href*="style.css"]')?.getAttribute("href") || "").match(/v=(\d+)/)?.[1] ===
  (스크립트태그?.getAttribute("src") || "").match(/v=(\d+)/)?.[1],
  [문서.querySelector('link[href*="style.css"]')?.getAttribute("href"), 스크립트태그?.getAttribute("src")]);

console.log(실패 === 0 ? "\n🎉 전체 통과 — 페이지 구조에 이상 없음" : `\n⚠️  ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
