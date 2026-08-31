/*
  '전체 흐름' 검사입니다.
  가짜 PubMed 서버를 만들어 두고, 페이지가 열렸을 때와 똑같은 순서로
  검색 → 학술지 확인 → 초록 받기 → 화면 그리기 까지 끝까지 돌려봅니다.

  실행법:  npm install jsdom  후  node tests/flow.test.mjs
  (아이패드에서는 실행할 수 없습니다. 필요하시면 Claude에게 부탁하세요.)

  이 검사가 만들어진 이유:
    부분별 검사는 모두 통과하는데 실제로 열어보면 같은 학술지만 나오는 일이 있었습니다.
    조각조각 확인하는 것만으로는 부족하고, 처음부터 끝까지 이어서 돌려봐야
    "화면에 실제로 무엇이 뜨는가"를 확인할 수 있습니다.
*/
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";

const 뿌리 = path.join(import.meta.dirname, "..");

// 실제 PubMed 목록처럼 한 학술지가 절반 이상을 덩어리로 차지하게 만듭니다
const 저널분포 = [
  ...Array(47).fill("J Affect Disord"),
  ...Array(20).fill("Transl Psychiatry"),
  ...Array(14).fill("Psychol Med"),
  ...Array(12).fill("Sleep"),
  ...Array(9).fill("Mol Psychiatry"),
  ...Array(8).fill("Lancet Psychiatry"),
  ...Array(6).fill("JAMA Psychiatry"),
  ...Array(4).fill("Schizophr Bull"),
];
const 전체 = 저널분포.map((저널, i) => ({ pmid: String(40000000 + i), 저널 }));

const 호출기록 = [];
global.fetch = async (주소) => {
  호출기록.push(주소.split("/").pop().split("?")[0]);

  if (주소.includes("esearch")) {
    const retmax = Number(주소.match(/retmax=(\d+)/)?.[1] ?? 0);
    return { ok: true, json: async () => ({
      esearchresult: { idlist: 전체.slice(0, retmax).map((논문) => 논문.pmid) } }) };
  }
  if (주소.includes("esummary")) {
    const ids = decodeURIComponent(주소.match(/id=([^&]+)/)[1]).split(",");
    const result = {};
    for (const id of ids) {
      const 논문 = 전체.find((p) => p.pmid === id);
      if (논문) result[id] = { uid: id, source: 논문.저널, title: "제목" };
    }
    return { ok: true, json: async () => ({ result }) };
  }
  const ids = decodeURIComponent(주소.match(/id=([^&]+)/)[1]).split(",");
  const xml = `<?xml version="1.0"?><PubmedArticleSet>${ids.map((id) => {
    const 논문 = 전체.find((p) => p.pmid === id);
    return `<PubmedArticle><MedlineCitation><PMID>${id}</PMID><Article>
      <Journal><ISOAbbreviation>${논문.저널}</ISOAbbreviation>
        <JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue></Journal>
      <ArticleTitle>Sample title ${id}</ArticleTitle>
      <Abstract><AbstractText Label="CONCLUSIONS">Conclusion text.</AbstractText></Abstract>
      <AuthorList><Author><LastName>Kim</LastName><Initials>S</Initials></Author></AuthorList>
    </Article></MedlineCitation></PubmedArticle>`;
  }).join("")}</PubmedArticleSet>`;
  return { ok: true, text: async () => xml };
};

const dom = new JSDOM(fs.readFileSync(path.join(뿌리, "index.html"), "utf8"));
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;

let 코드 = fs.readFileSync(path.join(뿌리, "app.js"), "utf8");
코드 += "\nglobal.__불러오기 = 논문_불러오기;";
new Function(코드)();
await new Promise((r) => setTimeout(r, 60));
await global.__불러오기();

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

const 카드들 = [...document.querySelectorAll(".paper")];
const 저널들 = 카드들.map((c) => c.querySelector(".journal").textContent.trim());

검사("PubMed의 세 창구를 순서대로 호출하는가",
  JSON.stringify([...new Set(호출기록)]) ===
  JSON.stringify(["esearch.fcgi", "esummary.fcgi", "efetch.fcgi"]), [...new Set(호출기록)]);
검사("논문 카드가 3장 그려지는가", 카드들.length === 3, 카드들.length);
검사("서로 다른 3개 학술지에서 한 편씩 나오는가", new Set(저널들).size === 3, 저널들);
검사("한 학술지가 목록의 절반을 차지해도 독점하지 않는가",
  저널들.filter((j) => j === "J Affect Disord").length <= 1, 저널들);
검사("각 카드에 제목이 들어 있는가",
  카드들.every((c) => c.querySelector("h2")?.textContent.trim().length > 0));
검사("각 카드에 핵심 결론이 들어 있는가",
  카드들.every((c) => c.querySelector(".takeaway p")?.textContent.includes("Conclusion")));
검사("각 카드에 PubMed 링크가 있는가",
  카드들.every((c) => c.querySelector('a[href*="pubmed.ncbi.nlm.nih.gov"]')));
검사("상태 문구에 학술지 종류 수가 표시되는가",
  /\d+개 학술지의 \d+편 중/.test(document.getElementById("todayLabel").textContent),
  document.getElementById("todayLabel").textContent);
검사("오류 메시지가 떠 있지 않은가", document.getElementById("statusBox").hidden);

console.log("\n  화면에 뜬 3편의 학술지:");
저널들.forEach((j, i) => console.log(`     ${i + 1}. ${j}`));

console.log(실패 === 0 ? "\n🎉 전체 통과 — 처음부터 끝까지 정상 동작" : `\n⚠️  ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
