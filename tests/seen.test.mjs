/*
  '이미 본 논문 제외' 기능을 실제 브라우저로 확인하는 검사입니다.

  이 기능은 눈으로는 확인하기 어렵습니다. 어제 본 논문이 오늘 안 나오는지 보려면
  하루를 기다려야 하니까요. 그래서 저장된 기록의 날짜를 어제로 바꿔치기해서
  '하루가 지난 상황'을 만들어 확인합니다.

  가장 중요한 것은 세 번째 검사입니다 —
  "같은 날 다시 열면 같은 3편이 나오는가".
  본 것을 무조건 빼버리면 페이지를 새로고침할 때마다 논문이 바뀌어
  '오늘의 논문' 이라는 말이 무색해집니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/seen.test.mjs

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
await new Promise((r) => 서버.listen(8767, r));

/*
  가짜 PubMed.
  학술지를 넉넉히 두어야 '학술지가 겹치지 않게' 규칙이 걸리지 않습니다.
  후보를 적게 만드는 상황도 검사해야 하므로 개수를 바꿀 수 있게 해 둡니다.
*/
const 저널들 = ["Lancet Psychiatry","JAMA Psychiatry","Am J Psychiatry","World Psychiatry",
                "Mol Psychiatry","Biol Psychiatry","Psychol Med","Schizophr Bull",
                "Sleep","Addiction","J Affect Disord","Transl Psychiatry"];
const 전체후보 = Array.from({ length: 60 }, (_, i) => ({
  pmid: String(41000000 + i), 저널: 저널들[i % 저널들.length] }));
let 후보수 = 전체후보.length;               // 검사 중에 바꿉니다

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.route("**/eutils.ncbi.nlm.nih.gov/**", async (route) => {
  const u = route.request().url();
  const 후보 = 전체후보.slice(0, 후보수);
  if (u.includes("esearch")) return route.fulfill({ contentType:"application/json",
    body: JSON.stringify({ esearchresult: { idlist: 후보.map((p) => p.pmid) } }) });
  if (u.includes("esummary")) {
    const result = {};
    for (const p of 후보) result[p.pmid] = { uid: p.pmid, source: p.저널 };
    return route.fulfill({ contentType:"application/json", body: JSON.stringify({ result }) });
  }
  const ids = decodeURIComponent(u.match(/id=([^&]+)/)[1]).split(",");
  const xml = `<?xml version="1.0"?><PubmedArticleSet>${ids.map((id) => {
    const p = 전체후보.find((칸) => 칸.pmid === id) || 전체후보[0];
    return `<PubmedArticle><MedlineCitation><PMID>${id}</PMID><Article>
      <Journal><ISOAbbreviation>${p.저널}</ISOAbbreviation>
        <JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue></Journal>
      <ArticleTitle>Study number ${id}</ArticleTitle>
      <Abstract><AbstractText>Background here. Methods here. In conclusion, finding ${id} holds.</AbstractText></Abstract>
      <AuthorList><Author><LastName>Kim</LastName><Initials>S</Initials></Author></AuthorList>
    </Article></MedlineCitation></PubmedArticle>`; }).join("")}</PubmedArticleSet>`;
  return route.fulfill({ contentType:"text/xml", body: xml });
});

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건?"✅":"❌"} ${이름}${조건?"":"\n     실제값: "+JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

const 주소 = "http://localhost:8767/psychiatry/";
const 열기 = async () => {
  await page.goto(주소, { waitUntil: "networkidle" });
  await page.waitForSelector(".paper");
};
// 지금 화면에 떠 있는 논문 번호들
const 화면번호 = () => page.locator("[data-save]").evaluateAll(
  (칸들) => 칸들.map((칸) => 칸.dataset.save).sort());
const 기록읽기 = () => page.evaluate(
  () => JSON.parse(localStorage.getItem("psychiatry-digest-seen") || "{}"));

/* ---------- 1. 처음 열었을 때 ---------- */
await page.goto(주소);
await page.evaluate(() => localStorage.clear());
await 열기();

const 첫번째 = await 화면번호();
검사("논문 3편이 나오는가", 첫번째.length === 3, 첫번째);

const 기록1 = await 기록읽기();
검사("화면에 뜬 3편이 '본 것'으로 기록되는가",
  Object.keys(기록1).length === 3 && 첫번째.every((id) => 기록1[id]), 기록1);

const 오늘 = new Date().toISOString().slice(0, 10);
검사("기록에 오늘 날짜가 함께 적히는가",
  Object.values(기록1).every((날짜) => 날짜 === 오늘), 기록1);

/* ---------- 2. 같은 날 다시 열기 (가장 중요) ---------- */
await 열기();
const 다시열기 = await 화면번호();
검사("같은 날 다시 열면 같은 3편이 나오는가",
  JSON.stringify(다시열기) === JSON.stringify(첫번째), [첫번째, 다시열기]);

/* ---------- 3. '다른 논문 보기' ---------- */
await page.locator("#refreshBtn").click();
/*
  ※ 여기서 "목록이 바뀌었나" 만 기다리면 안 됩니다.
     버튼을 누르면 새 논문을 받아오기 전에 화면을 잠깐 비우는데,
     그 빈 순간도 '바뀐 것'이라 통과해 버립니다.
     실제로 그 탓에 아래 검사가 빈 목록으로 헛통과한 적이 있습니다.
     그래서 "3편이 새로 찼고, 그 3편이 아까 것과 다르다" 까지 기다립니다.
*/
await page.waitForFunction((옛것) => {
  const 지금 = [...document.querySelectorAll("[data-save]")].map((칸) => 칸.dataset.save);
  return 지금.length === 3 && 지금.every((id) => !옛것.includes(id));
}, 첫번째, { timeout: 15000 });
const 넘긴것 = await 화면번호();
검사("'다른 논문 보기' 뒤에도 3편이 채워지는가", 넘긴것.length === 3, 넘긴것);
검사("'다른 논문 보기'를 누르면 방금 본 것과 겹치지 않는가",
  넘긴것.every((id) => !첫번째.includes(id)), [첫번째, 넘긴것]);

const 기록2 = await 기록읽기();
검사("넘겨서 본 것도 기록에 쌓이는가", Object.keys(기록2).length === 6, Object.keys(기록2).length);

/* ---------- 4. 하루가 지난 상황 ---------- */
// 저장된 날짜를 어제로 바꿔 '하루 지난 상태'를 만듭니다
await page.evaluate(() => {
  const 이름 = "psychiatry-digest-seen";
  const 기록 = JSON.parse(localStorage.getItem(이름) || "{}");
  const 어제 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(기록)) 기록[k] = 어제;
  localStorage.setItem(이름, JSON.stringify(기록));
});
const 어제본것 = Object.keys(await 기록읽기());
await 열기();
const 다음날 = await 화면번호();
검사("다음 날에는 어제 본 논문이 나오지 않는가",
  다음날.every((id) => !어제본것.includes(id)), { 어제본것, 다음날 });
검사("제외한 편수를 화면에 알려주는가",
  (await page.locator("#todayLabel").textContent()).includes("제외"),
  await page.locator("#todayLabel").textContent());

/* ---------- 5. '다시 봐도 괜찮음' 으로 바꾸기 ---------- */
await page.selectOption("#seenSelect", "include");
await page.waitForSelector(".paper");
await page.waitForTimeout(300);
검사("'다시 봐도 괜찮음'을 고르면 제외 표시가 사라지는가",
  !(await page.locator("#todayLabel").textContent()).includes("제외"),
  await page.locator("#todayLabel").textContent());
await page.selectOption("#seenSelect", "exclude");
await page.waitForSelector(".paper");

/* ---------- 6. 후보가 모자랄 때 ---------- */
// 후보를 3편만 남기고, 그 3편을 모두 어제 본 것으로 만듭니다
후보수 = 3;
await page.evaluate(() => {
  const 어제 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const 기록 = {};
  for (let i = 0; i < 3; i++) 기록[String(41000000 + i)] = 어제;
  localStorage.setItem("psychiatry-digest-seen", JSON.stringify(기록));
});
await 열기();
검사("새 논문이 없으면 화면을 비우지 않고 본 것이라도 보여주는가",
  (await 화면번호()).length === 3, await 화면번호());
검사("그때 왜 그런지 안내하는가",
  (await page.locator("#statusBox").textContent()).includes("빼지 않고"),
  await page.locator("#statusBox").textContent());
후보수 = 전체후보.length;

/* ---------- 7. 기록 지우기 ---------- */
await 열기();
page.once("dialog", (대화) => 대화.accept());       // 확인 창을 눌러줍니다
검사("'본 기록 지우기' 단추가 보이는가", await page.locator("#forgetSeen").count() > 0);
await page.locator("#forgetSeen").click();
await page.waitForTimeout(800);
검사("지우면 기록이 비워지는가", Object.keys(await 기록읽기()).length === 3,
  await 기록읽기());   // 지운 뒤 새로 뽑은 3편만 남습니다

console.log(실패 === 0
  ? "\n🎉 이미 본 논문 제외 — 전체 정상"
  : `\n⚠️  ${실패}건 실패`);
await browser.close();
서버.close();
process.exit(실패 === 0 ? 0 : 1);
