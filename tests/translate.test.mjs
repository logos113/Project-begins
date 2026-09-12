/*
  핵심 결론의 한국어 번역을 실제 브라우저로 확인하는 검사입니다.

  이 기능에서 가장 조심할 것은 두 가지입니다.

  (1) 영문 원문이 언제나 남아 있어야 합니다.
      기계 번역은 의학 용어를 곧잘 틀리는데, 번역만 남으면 그것을 그대로 믿게 됩니다.
  (2) 무료 번역 서비스는 하루 한도를 넘겨도 오류를 내지 않고,
      번역문 자리에 "MYMEMORY WARNING: ..." 같은 안내문을 담아 보냅니다.
      그대로 화면에 넣으면 그게 번역인 줄 알게 됩니다.

  바깥 번역 서버에 기대지 않도록 가짜로 답하게 해 두고 확인합니다.
  (이 저장소가 도는 환경에서는 바깥 접속이 막혀 있기도 합니다)

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/translate.test.mjs
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
await new Promise((r) => 서버.listen(8771, r));

const 결론문장 = "In conclusion, ketamine was non-inferior to ECT at six months.";
const 옮긴문장 = "결론적으로 케타민은 6개월 시점에서 ECT에 열등하지 않았다.";

const 저널들 = ["Lancet Psychiatry","JAMA Psychiatry","Am J Psychiatry","Mol Psychiatry"];
const 후보 = Array.from({ length: 20 }, (_, i) => ({
  pmid: String(44000000 + i), 저널: 저널들[i % 저널들.length] }));

// 번역 요청이 어떻게 나갔는지 붙잡아 둡니다
let 번역요청들 = [];
let 번역_행동 = "정상";        // 정상 | 실패 | 한도초과

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.route("**/api.mymemory.translated.net/**", (route) => {
  번역요청들.push(route.request().url());
  if (번역_행동 === "실패") return route.fulfill({ status: 500, body: "서버 오류" });
  if (번역_행동 === "한도초과") {
    // 실제로 한도를 넘기면 오류가 아니라 이런 안내문이 번역문 자리에 담겨 옵니다
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({
      responseData: { translatedText:
        "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY." } }) });
  }
  return route.fulfill({ contentType: "application/json", body: JSON.stringify({
    responseData: { translatedText: 옮긴문장 } }) });
});

await page.route("**/eutils.ncbi.nlm.nih.gov/**", (route) => {
  const u = route.request().url();
  if (u.includes("esearch")) return route.fulfill({ contentType:"application/json",
    body: JSON.stringify({ esearchresult: { idlist: 후보.map((p) => p.pmid) } }) });
  if (u.includes("esummary")) {
    const result = {};
    for (const p of 후보) result[p.pmid] = { uid: p.pmid, source: p.저널 };
    return route.fulfill({ contentType:"application/json", body: JSON.stringify({ result }) });
  }
  const ids = decodeURIComponent(u.match(/id=([^&]+)/)[1]).split(",");
  const xml = `<?xml version="1.0"?><PubmedArticleSet>${ids.map((id) => {
    const p = 후보.find((칸) => 칸.pmid === id) || 후보[0];
    return `<PubmedArticle><MedlineCitation><PMID>${id}</PMID><Article>
      <Journal><ISOAbbreviation>${p.저널}</ISOAbbreviation>
        <JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue></Journal>
      <ArticleTitle>Ketamine versus ECT</ArticleTitle>
      <Abstract><AbstractText>Background here. Methods here. ${결론문장}</AbstractText></Abstract>
      <AuthorList><Author><LastName>Kim</LastName><Initials>S</Initials></Author></AuthorList>
    </Article></MedlineCitation></PubmedArticle>`; }).join("")}</PubmedArticleSet>`;
  return route.fulfill({ contentType:"text/xml", body: xml });
});

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건?"✅":"❌"} ${이름}${조건?"":"\n     실제값: "+JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

const 주소 = "http://localhost:8771/psychiatry/";
const 열기 = async () => {
  await page.goto(주소, { waitUntil: "networkidle" });
  await page.waitForSelector(".paper");
  await page.waitForTimeout(500);        // 번역은 카드를 그린 뒤에 채워집니다
};

/* ---------- 1. 번역이 붙는가 ---------- */
await page.goto(주소, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
/*
  ※ 여기서 바로 세기 시작하면 안 됩니다.
     방금 연 페이지에서 나간 번역 요청이 아직 오는 중이라 함께 세어집니다.
     실제로 그 탓에 "3번" 이어야 할 것이 4번으로 나왔습니다.
*/
await page.waitForTimeout(800);
번역요청들 = [];
await 열기();

검사("번역이 결론 아래에 붙는가",
  (await page.locator(".takeaway-ko:visible").count()) === 3,
  await page.locator(".takeaway-ko").count());
검사("옮긴 문장이 그대로 들어가는가",
  (await page.locator(".ko-text").first().textContent()).trim() === 옮긴문장,
  await page.locator(".ko-text").first().textContent());
검사("'기계 번역' 이라고 표시하는가",
  (await page.locator(".ko-label").first().textContent()).includes("기계 번역"));

// 가장 중요한 검사입니다 — 원문을 치우면 안 됩니다
검사("영문 원문이 그대로 남아 있는가",
  (await page.locator(".takeaway > p").first().textContent()).includes("non-inferior"),
  await page.locator(".takeaway > p").first().textContent());

/* ---------- 2. 어떻게 요청했는가 ---------- */
const 첫요청 = 번역요청들[0] || "";
검사("영어에서 한국어로 요청하는가", 첫요청.includes("langpair=en%7Cko"), 첫요청);
검사("결론 원문을 실어 보내는가", decodeURIComponent(첫요청).includes("non-inferior"), 첫요청);
// 메일 주소를 비워두었으므로 아무것도 보내지 않아야 합니다
검사("메일 주소를 비워두면 보내지 않는가", !첫요청.includes("de="), 첫요청);
검사("논문 3편이면 3번만 요청하는가", 번역요청들.length === 3, 번역요청들.length);

/* ---------- 3. 한 번 받아온 것은 다시 받지 않는가 ---------- */
번역요청들 = [];
await 열기();
검사("같은 논문을 다시 열면 번역을 또 받아오지 않는가",
  번역요청들.length === 0, 번역요청들.length);
검사("그래도 번역은 그대로 보이는가",
  (await page.locator(".takeaway-ko:visible").count()) === 3);

/* ---------- 4. 번역이 실패해도 논문은 나오는가 ---------- */
await page.evaluate(() => localStorage.clear());
번역_행동 = "실패";
번역요청들 = [];
await 열기();
검사("번역 서버가 죽어도 논문 3편은 그대로 나오는가",
  (await page.locator(".paper").count()) === 3);
검사("그때 번역 자리는 비어 있는가",
  (await page.locator(".takeaway-ko:visible").count()) === 0);
검사("영문 결론은 여전히 보이는가",
  (await page.locator(".takeaway > p").first().textContent()).includes("non-inferior"));

/* ---------- 5. 한도를 넘겼을 때 ---------- */
await page.evaluate(() => localStorage.clear());
번역_행동 = "한도초과";
await 열기();
검사("한도 초과 안내문을 번역으로 착각하지 않는가",
  (await page.locator(".takeaway-ko:visible").count()) === 0 &&
  !(await page.locator(".takeaway").first().textContent()).includes("MYMEMORY"),
  await page.locator(".takeaway").first().textContent());
번역_행동 = "정상";

/* ---------- 6. 꺼두기 ---------- */
await page.evaluate(() => localStorage.clear());
await 열기();
검사("켜두면 번역이 보이는가", (await page.locator(".takeaway-ko:visible").count()) === 3);

번역요청들 = [];
await page.selectOption("#transSelect", "off");
await page.waitForTimeout(400);
검사("'원문만' 으로 바꾸면 번역이 사라지는가",
  (await page.locator(".takeaway-ko").count()) === 0,
  await page.locator(".takeaway-ko").count());
검사("꺼두면 번역을 받아오지 않는가", 번역요청들.length === 0, 번역요청들.length);
검사("꺼도 영문 결론은 그대로인가",
  (await page.locator(".takeaway > p").first().textContent()).includes("non-inferior"));

await page.selectOption("#transSelect", "on");
await page.waitForTimeout(500);
검사("다시 켜면 번역이 돌아오는가",
  (await page.locator(".takeaway-ko:visible").count()) === 3);

console.log(실패 === 0
  ? "\n🎉 결론 번역 — 전체 정상"
  : `\n⚠️  ${실패}건 실패`);
await browser.close();
서버.close();
process.exit(실패 === 0 ? 0 : 1);
