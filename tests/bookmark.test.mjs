/*
  저장(북마크) 기능을 실제 브라우저로 조작해보는 검사입니다.
  버튼을 누르고, 저장 목록을 열고, 새로고침까지 해본 뒤 결과를 확인합니다.

  앞의 세 검사(logic/html/flow)는 코드를 흉내 내서 확인하는 것이고,
  이 검사는 진짜 브라우저를 띄워 사람이 하듯 클릭해봅니다.
  버튼이 실제로 눌리는지, 저장한 것이 새로고침 후에도 남는지는
  이렇게 해봐야 알 수 있습니다.

  실행법:
    npm install playwright
    npx playwright install chromium
    node tests/bookmark.test.mjs

  아이패드에서는 실행할 수 없습니다. 확인이 필요하면 Claude에게 부탁하세요.
*/
import { chromium } from "playwright";
import http from "http"; import fs from "fs"; import path from "path";
const 뿌리 = path.join(import.meta.dirname, "..");
const 종류 = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".png":"image/png" };
const 서버 = http.createServer((req,res) => {
  let u = req.url.split("?")[0];
  if (u.endsWith("/")) u += "index.html";        // 폴더 주소는 그 안의 index.html 로
  const p = path.join(뿌리, u);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": 종류[path.extname(p)] || "text/plain" });
  res.end(fs.readFileSync(p));
});
await new Promise(r => 서버.listen(8766, r));

const 논문 = [
  { 저널:"Lancet Psychiatry", 제목:"Digital cognitive behavioural therapy versus treatment as usual for major depressive disorder",
    결론:"In conclusion, digital CBT was non-inferior to face-to-face therapy at 12 months and cost substantially less per treated patient." },
  { 저널:"JAMA Psychiatry", 제목:"Early antipsychotic dose reduction and long-term functional outcomes in first-episode psychosis",
    결론:"Guided dose reduction after remission was associated with higher rates of functional recovery at 7 years." },
  { 저널:"World Psychiatry", 제목:"Global burden of untreated anxiety disorders in low- and middle-income countries",
    결론:"Fewer than one in ten people with anxiety disorders in low-income settings receive minimally adequate treatment." },
];
const 후보 = [...논문.map((p,i)=>({pmid:String(40111000+i), 저널:p.저널})),
  ...Array.from({length:117},(_,i)=>({pmid:String(40222000+i), 저널:["J Affect Disord","Sleep","Psychol Med"][i%3]}))];

// 브라우저 경로를 직접 지정해야 하는 환경이면 PW_CHROME 환경변수로 넘길 수 있습니다
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport:{width:1440,height:1000}, deviceScaleFactor:2 });
await page.route("**/eutils.ncbi.nlm.nih.gov/**", async (route) => {
  const u = route.request().url();
  if (u.includes("esearch")) return route.fulfill({ contentType:"application/json",
    body: JSON.stringify({ esearchresult:{ idlist: 후보.map(p=>p.pmid) } }) });
  if (u.includes("esummary")) {
    const result = {}; for (const p of 후보) result[p.pmid] = { uid:p.pmid, source:p.저널 };
    return route.fulfill({ contentType:"application/json", body: JSON.stringify({ result }) });
  }
  const ids = decodeURIComponent(u.match(/id=([^&]+)/)[1]).split(",");
  const xml = `<?xml version="1.0"?><PubmedArticleSet>${ids.map((id,i)=>{
    const p = 논문[i % 논문.length];
    return `<PubmedArticle><MedlineCitation><PMID>${id}</PMID><Article>
      <Journal><ISOAbbreviation>${p.저널}</ISOAbbreviation><JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue></Journal>
      <ArticleTitle>${p.제목}</ArticleTitle>
      <Abstract><AbstractText>Background sentence one here. Methods sentence two here. Results sentence three here. ${p.결론}</AbstractText></Abstract>
      <AuthorList><Author><LastName>Kim</LastName><Initials>S</Initials></Author></AuthorList>
    </Article></MedlineCitation></PubmedArticle>`; }).join("")}</PubmedArticleSet>`;
  return route.fulfill({ contentType:"text/xml", body: xml });
});

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건?"✅":"❌"} ${이름}${조건?"":"\n     실제값: "+JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

await page.goto("http://localhost:8766/psychiatry/", { waitUntil:"networkidle" });
await page.waitForSelector(".paper");

// 1) 핵심 결론이 도입부가 아니라 결론인가
const 첫결론 = await page.locator(".takeaway p").first().textContent();
검사("핵심 결론에 결론 문장이 나오는가 (도입부가 아님)",
  첫결론.includes("In conclusion") || 첫결론.includes("non-inferior"), 첫결론.slice(0,80));
const 출처 = await page.locator(".takeaway-source").first().textContent().catch(()=>"(없음)");
검사("결론을 어디서 찾았는지 표시되는가", 출처.trim().length > 0, 출처);

// 2) 저장
검사("처음엔 저장 버튼이 '☆ 저장' 인가",
  (await page.locator(".btn-save").first().textContent()).includes("☆"), 
  await page.locator(".btn-save").first().textContent());
await page.locator(".btn-save").first().click();
await page.waitForTimeout(150);
검사("누르면 '★ 저장됨' 으로 바뀌는가",
  (await page.locator(".btn-save").first().textContent()).includes("★ 저장됨"));
검사("위쪽 버튼에 개수가 표시되는가",
  (await page.locator("#bookmarkBtn").textContent()).includes("1"),
  await page.locator("#bookmarkBtn").textContent());

// 3) 두 번째도 저장
await page.locator(".btn-save").nth(1).click();
await page.waitForTimeout(150);
검사("두 편을 저장하면 개수가 2가 되는가",
  (await page.locator("#bookmarkBtn").textContent()).includes("2"));

// 4) 저장 목록 보기
await page.locator("#bookmarkBtn").click();
await page.waitForTimeout(200);
검사("저장 목록에 2편이 보이는가", await page.locator(".paper").count() === 2,
  await page.locator(".paper").count());
검사("저장한 날짜가 표시되는가", await page.locator(".saved-on").count() === 2);
검사("버튼 글자가 '오늘의 논문 보기' 로 바뀌는가",
  (await page.locator("#bookmarkBtn").textContent()).includes("오늘의 논문"));
// 필요하면 화면을 남길 수 있습니다: await page.screenshot({ path:"bookmark-list.png" });

// 5) 새로고침해도 남아 있는가 (진짜 저장되었는지)
await page.reload({ waitUntil:"networkidle" });
await page.waitForSelector(".paper");
검사("새로고침하면 오늘의 논문으로 돌아오는가",
  !(await page.locator("#bookmarkBtn").textContent()).includes("오늘의 논문"));
검사("새로고침 후에도 저장 기록이 남아 있는가",
  (await page.locator("#bookmarkBtn").textContent()).includes("2"),
  await page.locator("#bookmarkBtn").textContent());
검사("이미 저장한 논문은 '★ 저장됨' 으로 표시되는가",
  (await page.locator(".btn-save").first().textContent()).includes("★"));

// 6) 저장 해제
await page.locator("#bookmarkBtn").click();
await page.waitForTimeout(200);
await page.locator(".btn-save").first().click();
await page.waitForTimeout(200);
검사("저장 목록에서 해제하면 카드가 사라지는가", await page.locator(".paper").count() === 1,
  await page.locator(".paper").count());
검사("개수도 함께 줄어드는가",
  (await page.locator("#todayLabel").textContent()).includes("1편"),
  await page.locator("#todayLabel").textContent());

// 7) 모두 지우면 안내 문구
await page.locator(".btn-save").first().click();
await page.waitForTimeout(200);
검사("모두 지우면 안내 문구가 나오는가",
  (await page.locator("#statusBox").textContent()).includes("아직 저장한 논문이 없습니다"),
  await page.locator("#statusBox").textContent());


console.log(실패===0 ? "\n🎉 북마크 기능 전체 정상" : `\n⚠️ ${실패}건 실패`);
await browser.close(); 서버.close();
process.exit(실패===0?0:1);
