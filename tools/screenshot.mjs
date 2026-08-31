/*
  화면 크기별로 페이지를 열어 스크린샷을 찍는 도구입니다.
  진짜 PubMed 대신 가짜 응답을 돌려주므로 인터넷 없이도 확인할 수 있습니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tools/screenshot.mjs

  아이패드에서는 실행할 수 없습니다. 화면 확인이 필요하면 Claude에게 부탁하세요.
  결과 파일: desktop-1440.png / desktop-1280.png / ipad-1024.png / phone-390.png
*/
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

// --- 프로젝트 폴더를 그대로 서빙하는 작은 서버 ---
const 뿌리 = "/home/user/Project-begins";
const 종류 = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
               ".json": "application/json", ".png": "image/png" };
const 서버 = http.createServer((req, res) => {
  const 경로 = path.join(뿌리, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : req.url.split("?")[0]);
  if (!fs.existsSync(경로)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": 종류[path.extname(경로)] || "text/plain" });
  res.end(fs.readFileSync(경로));
});
await new Promise((r) => 서버.listen(8765, r));

// --- 가짜 PubMed 응답 (실제와 같은 형식) ---
const 논문들 = [
  { pmid: "40111001", 저널: "Lancet Psychiatry",
    제목: "Digital cognitive behavioural therapy versus treatment as usual for adults with major depressive disorder: a multicentre randomised controlled trial",
    저자: [["Andersson","G"],["Carlbring","P"],["Titov","N"],["Kim","S"]],
    결론: "Digital CBT was non-inferior to face-to-face therapy at 12 months, with substantially lower cost per treated patient. These findings support wider implementation in stepped-care pathways." },
  { pmid: "40111002", 저널: "JAMA Psychiatry",
    제목: "Association of early antipsychotic dose reduction with long-term functional outcomes in first-episode psychosis",
    저자: [["Wunderink","L"],["Nieboer","R"],["Park","J"]],
    결론: "Guided dose reduction after remission was associated with higher rates of functional recovery at 7 years without a significant increase in severe relapse." },
  { pmid: "40111003", 저널: "World Psychiatry",
    제목: "Global burden of untreated anxiety disorders and the treatment gap in low- and middle-income countries",
    저자: [["Patel","V"],["Chisholm","D"],["Lee","M"],["Choi","H"]],
    결론: "Fewer than one in ten people with anxiety disorders in low-income settings receive minimally adequate treatment. Task-shifting interventions could close a substantial part of this gap." },
];
const 후보 = [...논문들, ...Array.from({ length: 117 }, (_, i) => ({
  pmid: String(40222000 + i), 저널: ["J Affect Disord","Transl Psychiatry","Psychol Med","Sleep"][i % 4] }))];

// 브라우저 경로를 직접 지정해야 하는 환경이면 PW_CHROME 환경변수로 넘길 수 있습니다
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const 찍기 = async (이름, 폭, 높이) => {
  const page = await browser.newPage({ viewport: { width: 폭, height: 높이 }, deviceScaleFactor: 2 });
  await page.route("**/eutils.ncbi.nlm.nih.gov/**", async (route) => {
    const u = route.request().url();
    if (u.includes("esearch")) {
      return route.fulfill({ contentType: "application/json",
        body: JSON.stringify({ esearchresult: { idlist: 후보.map((p) => p.pmid) } }) });
    }
    if (u.includes("esummary")) {
      const result = {};
      for (const p of 후보) result[p.pmid] = { uid: p.pmid, source: p.저널 };
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ result }) });
    }
    const ids = decodeURIComponent(u.match(/id=([^&]+)/)[1]).split(",");
    const xml = `<?xml version="1.0"?><PubmedArticleSet>${ids.map((id, i) => {
      const p = 논문들[i % 논문들.length];
      return `<PubmedArticle><MedlineCitation><PMID>${id}</PMID><Article>
        <Journal><ISOAbbreviation>${p.저널}</ISOAbbreviation>
          <JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue></Journal>
        <ArticleTitle>${p.제목}</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Background text for illustration.</AbstractText>
          <AbstractText Label="METHODS">Methods text for illustration.</AbstractText>
          <AbstractText Label="CONCLUSIONS">${p.결론}</AbstractText>
        </Abstract>
        <AuthorList>${p.저자.map(([l, i2]) =>
          `<Author><LastName>${l}</LastName><Initials>${i2}</Initials></Author>`).join("")}</AuthorList>
      </Article></MedlineCitation>
      <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1016/example</ArticleId></ArticleIdList></PubmedData>
      </PubmedArticle>`;
    }).join("")}</PubmedArticleSet>`;
    return route.fulfill({ contentType: "text/xml", body: xml });
  });
  await page.goto("http://localhost:8765/", { waitUntil: "networkidle" });
  await page.waitForSelector(".paper", { timeout: 8000 });
  await page.screenshot({ path: `${이름}.png`, fullPage: false });
  const 열수 = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".paper-list")).gridTemplateColumns.split(" ").length);
  console.log(`  ${이름.padEnd(16)} ${폭}x${높이}  →  논문 배치: ${열수}열`);
  await page.close();
};

console.log("화면 크기별 확인:");
await 찍기("desktop-1440", 1440, 900);
await 찍기("desktop-1280", 1280, 800);
await 찍기("ipad-1024", 1024, 768);
await 찍기("phone-390", 390, 844);
await browser.close();
서버.close();
