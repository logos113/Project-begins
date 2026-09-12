/*
  '저자 · 키워드 구독' 을 실제 브라우저로 확인하는 검사입니다.

  구독은 평소 검색과 별개로 한 번 더 검색을 돌립니다.
  그래서 두 검색이 제대로 나뉘어 나가는지, 구독 논문이 앞자리를 차지하되
  전부를 차지하지는 않는지, 그리고 구독 검색이 실패해도 오늘의 논문은
  그대로 나오는지를 봐야 합니다. 마지막 것이 특히 중요합니다 —
  구독 하나 잘못 넣었다고 화면이 비면 안 되니까요.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/subscribe.test.mjs

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
await new Promise((r) => 서버.listen(8769, r));

const 저널들 = ["Lancet Psychiatry","JAMA Psychiatry","Am J Psychiatry","World Psychiatry",
                "Mol Psychiatry","Biol Psychiatry","Psychol Med","Sleep"];
// 평소 후보 (43xxxxxx) 와 구독으로만 잡히는 논문 (49xxxxxx) 을 나눠 둡니다
const 평소후보 = Array.from({ length: 40 }, (_, i) => ({
  pmid: String(43000000 + i), 저널: 저널들[i % 저널들.length] }));
const 구독후보 = Array.from({ length: 5 }, (_, i) => ({
  pmid: String(49000000 + i), 저널: "Transl Psychiatry" }));

let 구독검색어 = null;        // 구독 검색으로 나간 검색어를 붙잡아 둡니다
let 구독검색_실패시킬까 = false;

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.route("**/eutils.ncbi.nlm.nih.gov/**", async (route) => {
  const u = route.request().url();
  const 검색어 = decodeURIComponent((u.match(/term=([^&]+)/) || [])[1] || "");
  // 평소 검색에는 학술지 조건([jour])이 들어갑니다. 없으면 구독 검색입니다.
  const 구독검색인가 = 검색어 && !검색어.includes("[jour]");

  if (u.includes("esearch")) {
    if (구독검색인가) {
      구독검색어 = 검색어;
      if (구독검색_실패시킬까) return route.fulfill({ status: 500, body: "서버 오류" });
      return route.fulfill({ contentType:"application/json",
        body: JSON.stringify({ esearchresult: { idlist: 구독후보.map((p) => p.pmid) } }) });
    }
    return route.fulfill({ contentType:"application/json",
      body: JSON.stringify({ esearchresult: { idlist: 평소후보.map((p) => p.pmid) } }) });
  }

  const 전체 = [...평소후보, ...구독후보];
  if (u.includes("esummary")) {
    const ids = decodeURIComponent(u.match(/id=([^&]+)/)[1]).split(",");
    const result = {};
    for (const id of ids) {
      const p = 전체.find((칸) => 칸.pmid === id);
      if (p) result[id] = { uid: id, source: p.저널 };
    }
    return route.fulfill({ contentType:"application/json", body: JSON.stringify({ result }) });
  }

  const ids = decodeURIComponent(u.match(/id=([^&]+)/)[1]).split(",");
  const xml = `<?xml version="1.0"?><PubmedArticleSet>${ids.map((id) => {
    const p = 전체.find((칸) => 칸.pmid === id) || 평소후보[0];
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

const 주소 = "http://localhost:8769/psychiatry/";
const 열기 = async () => {
  await page.goto(주소, { waitUntil: "networkidle" });
  await page.waitForSelector(".paper");
};
const 화면번호 = () => page.locator("[data-save]").evaluateAll(
  (칸들) => 칸들.map((칸) => 칸.dataset.save));
const 구독배지수 = () => page.locator(".sub-badge").count();

// 구독을 추가하고 화면이 다시 그려질 때까지 기다립니다
const 구독추가 = async (종류, 값) => {
  await page.selectOption("#subsKind", 종류);
  await page.fill("#subsInput", 값);
  await page.locator("#subsForm button[type=submit]").click();
  await page.waitForTimeout(600);
};

/* ---------- 1. 구독이 없을 때 ---------- */
await page.goto(주소);
await page.evaluate(() => localStorage.clear());
await 열기();

검사("구독이 없으면 평소대로 3편이 나오는가", (await 화면번호()).length === 3);
검사("구독이 없으면 구독 배지가 없는가", (await 구독배지수()) === 0);
검사("구독이 없으면 구독 검색을 돌리지 않는가", 구독검색어 === null, 구독검색어);
검사("접힌 줄에 안내가 보이는가",
  (await page.locator("#subsSummary").textContent()).includes("구독"));

/* ---------- 2. 저자 등록 ---------- */
await page.locator("#subsBox summary").click();
await 구독추가("author", "Kim SY");

검사("등록한 저자가 목록에 보이는가",
  (await page.locator(".subs-item .subs-value").allTextContents()).includes("Kim SY"),
  await page.locator(".subs-item .subs-value").allTextContents());
검사("접힌 줄에 개수가 표시되는가",
  (await page.locator("#subsSummary").textContent()).includes("1개"),
  await page.locator("#subsSummary").textContent());
검사("저자는 [au] 조건으로 검색하는가",
  구독검색어 && 구독검색어.includes("Kim SY[au]"), 구독검색어);
검사("구독 검색에는 학술지 제한을 걸지 않는가",
  구독검색어 && !구독검색어.includes("[jour]"), 구독검색어);
검사("구독 검색에도 초록 있는 논문 조건이 붙는가",
  구독검색어 && 구독검색어.includes("hasabstract"), 구독검색어);

/* ---------- 3. 구독 논문이 앞자리를 차지하는가 ---------- */
const 번호들 = await 화면번호();
검사("여전히 3편인가", 번호들.length === 3, 번호들);
검사("구독으로 찾은 논문이 앞에 오는가",
  번호들.slice(0, 2).every((id) => id.startsWith("49")), 번호들);
검사("구독 논문은 최대 2편까지만 (나머지는 평소 논문)",
  번호들.filter((id) => id.startsWith("49")).length === 2, 번호들);
검사("구독으로 나온 논문에 배지가 붙는가", (await 구독배지수()) === 2, await 구독배지수());
검사("날짜 줄에 구독 편수를 알려주는가",
  (await page.locator("#todayLabel").textContent()).includes("구독 2편"),
  await page.locator("#todayLabel").textContent());

/* ---------- 4. 키워드 등록과 잘못된 입력 ---------- */
await 구독추가("keyword", "ketamine");
검사("키워드는 [tiab] 조건으로 검색하는가",
  구독검색어 && 구독검색어.includes("ketamine[tiab]"), 구독검색어);
검사("여러 개를 등록하면 OR 로 묶는가",
  구독검색어 && 구독검색어.includes(" OR "), 구독검색어);

await 구독추가("keyword", "ketamine");
검사("같은 것을 두 번 등록하면 막는가",
  (await page.locator(".subs-item").count()) === 2 &&
  (await page.locator("#statusBox").textContent()).includes("이미 등록"),
  await page.locator("#statusBox").textContent());

// 대괄호나 따옴표가 섞이면 PubMed 검색어 문법이 깨집니다
await 구독추가("author", 'Park  J"[au]');
검사("검색어를 깨뜨리는 기호는 걸러내는가",
  (await page.locator(".subs-item .subs-value").allTextContents()).includes("Park J au"),
  await page.locator(".subs-item .subs-value").allTextContents());

await 구독추가("keyword", "   ");
검사("빈 내용은 등록하지 않는가",
  (await page.locator(".subs-item").count()) === 3 &&
  (await page.locator("#statusBox").textContent()).includes("입력"),
  await page.locator("#statusBox").textContent());

/* ---------- 5. 구독 검색이 실패해도 오늘의 논문은 나오는가 ---------- */
구독검색_실패시킬까 = true;
await 열기();
검사("구독 검색이 실패해도 논문 3편은 나오는가", (await 화면번호()).length === 3);
검사("그때는 구독 배지가 없는가", (await 구독배지수()) === 0);
구독검색_실패시킬까 = false;

/* ---------- 6. 지우기 ---------- */
await 열기();
await page.locator("#subsBox summary").click();
const 지우기전 = await page.locator(".subs-item").count();
await page.locator(".subs-del").first().click();
await page.waitForTimeout(600);
검사("지우면 목록에서 빠지는가",
  (await page.locator(".subs-item").count()) === 지우기전 - 1);

// 전부 지우면 구독이 없던 상태로 돌아가야 합니다
await page.evaluate(() => localStorage.removeItem("psychiatry-digest-subscriptions"));
await 열기();
검사("모두 지우면 구독 배지가 사라지는가", (await 구독배지수()) === 0);
검사("모두 지우면 안내 문구가 돌아오는가",
  (await page.locator(".subs-empty").count()) === 1);

console.log(실패 === 0
  ? "\n🎉 저자·키워드 구독 — 전체 정상"
  : `\n⚠️  ${실패}건 실패`);
await browser.close();
서버.close();
process.exit(실패 === 0 ? 0 : 1);
