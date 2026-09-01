/*
  '핵심 결론'을 초록에서 제대로 뽑아내는지 확인하는 검사입니다.
  실행법:  npm install jsdom  후  node tests/conclusion.test.mjs

  왜 따로 두었나요?
    초록의 생김새가 학술지마다 제각각이라 여기서 가장 많은 문제가 생겼습니다.
    실제로 화면에서 발견된 사례를 그대로 옮겨 담아, 같은 문제가 다시 생기면
    바로 잡히도록 했습니다.
*/
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";

const 뿌리 = path.join(import.meta.dirname, "..");
const dom = new JSDOM(fs.readFileSync(path.join(뿌리, "index.html"), "utf8"));
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.fetch = async () => { throw new Error("이 검사에서는 인터넷을 쓰지 않습니다"); };

let 코드 = fs.readFileSync(path.join(뿌리, "app.js"), "utf8").replace(/\n논문_불러오기\(\);\s*$/, "");
코드 += "\nglobal.T = { 핵심결론_뽑기, 문장으로_나누기, 논문정보_정리, 결론으로_쓸만한가, 자리표시자_지우기 };";
new Function(코드)();
const T = global.T;

let 실패 = 0;
const 검사 = (이름, 조건, 실제) => {
  console.log(`${조건 ? "✅" : "❌"} ${이름}${조건 ? "" : "\n     실제값: " + JSON.stringify(실제)}`);
  if (!조건) 실패++;
};

console.log("[ 초록 형태별 결론 추출 ]\n");
const 사례 = [
  {
    이름: "① 항목이 나뉜 초록 (CONCLUSIONS 라벨)",
    문단: [
      { label: "BACKGROUND", text: "Major depressive disorder affects over 280 million people worldwide and remains a leading cause of disability." },
      { label: "METHODS", text: "We randomised 412 adults to digital CBT or treatment as usual across 14 centres in three countries." },
      { label: "RESULTS", text: "Response rates were 54.3% versus 41.1% at 12 weeks (OR 1.71, 95% CI 1.14-2.56, p=0.009)." },
      { label: "CONCLUSIONS", text: "Digital CBT was non-inferior to face-to-face therapy at 12 months and cost substantially less per treated patient." },
    ],
    기대: "Digital CBT was non-inferior",
  },
  {
    이름: "② 한 덩어리 초록 + 'In conclusion' 있음  ← 예전에 실패하던 경우",
    문단: [{ label: "", text:
      "Depression and sleep disturbance frequently co-occur, yet their temporal relationship remains unclear. " +
      "We followed 1,842 community-dwelling adults for 5 years using actigraphy and structured interviews. " +
      "Participants were assessed at baseline, 2 years, and 5 years by trained raters. " +
      "Baseline insomnia predicted incident depression (HR 1.62, 95% CI 1.31-2.01), whereas baseline depression did not predict incident insomnia. " +
      "Effect sizes were larger in women and in those under 40 years of age. " +
      "In conclusion, insomnia appears to precede rather than follow depressive episodes, supporting early sleep intervention as a preventive strategy." },
    ],
    기대: "insomnia appears to precede",
  },
  {
    이름: "③ 한 덩어리 초록 + 표시어 없음 → 마지막 문장들",
    문단: [{ label: "", text:
      "Antipsychotic dose reduction after remission in first-episode psychosis remains controversial. " +
      "This 7-year follow-up examined functional outcomes in 128 patients randomised to guided reduction or maintenance. " +
      "Assessments included the Social Functioning Scale and symptom ratings by blinded raters. " +
      "Functional recovery was achieved by 40.4% in the reduction group versus 17.6% in the maintenance group. " +
      "Relapse rates did not differ significantly between groups over the full follow-up period." },
    ],
    기대: "Functional recovery",
  },
  {
    이름: "④ 약어가 섞인 초록 (et al., e.g., Fig. 등)",
    문단: [{ label: "", text:
      "Previous work by Smith et al. reported inconsistent findings on ketamine dosing. " +
      "We compared three regimens (e.g., 0.5 mg/kg vs. 1.0 mg/kg) in 96 patients with treatment-resistant depression. " +
      "Response was measured with the MADRS at 24 h and 7 days. " +
      "Higher doses produced larger acute effects but more dissociation. " +
      "Taken together, our results support 0.5 mg/kg as the optimal balance of efficacy and tolerability." }],
    기대: "0.5 mg/kg as the optimal balance",
  },
  {
    이름: "⑤ INTERPRETATION 라벨 (Lancet 계열)",
    문단: [
      { label: "BACKGROUND", text: "Task-shifting has been proposed to address the mental health treatment gap." },
      { label: "FINDINGS", text: "Coverage increased from 8% to 34% over the study period." },
      { label: "INTERPRETATION", text: "Lay counsellor delivery can substantially expand access without compromising outcomes in low-resource settings." },
    ],
    기대: "Lay counsellor delivery",
  },
];

for (const s of 사례) {
  const r = T.핵심결론_뽑기(s.문단);
  const 통과 = r.글.includes(s.기대);
  if (!통과) 실패++;
  console.log(`${통과 ? "✅" : "❌"} ${s.이름}`);
  console.log(`     출처: ${r.출처}`);
  console.log(`     결과: ${r.글.slice(0, 110)}${r.글.length > 110 ? "…" : ""}`);
  if (!통과) console.log(`     ⚠️ 기대한 내용("${s.기대}")이 없습니다`);
  console.log();
}

// 문장 분리가 약어에서 잘못 끊기지 않는지
const 문장 = T.문장으로_나누기("Smith et al. reported this. We used 0.5 mg/kg vs. 1.0 mg/kg. Results were clear.");
console.log(`문장 분리 확인 (약어 포함): ${문장.length}개로 나뉨`);
문장.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));


console.log("\n[ 실제 화면에서 발견된 문제 사례 ]\n");
// --- 사례 A: Annals of Internal Medicine (ACP Journal Club) 형식 ---
// 초록 끝에 편집자 평가 별점표가 붙습니다. 별 기호는 [Formula: see text] 로 들어옵니다.
const acp = [{ label: "", text:
  "Rose M, et al. Semaglutide for alcohol use disorder and obesity. N Engl J Med. 2026. " +
  "In adults with alcohol use disorder and comorbid obesity, weekly subcutaneous semaglutide " +
  "reduced the number of heavy drinking days over 26 weeks compared with placebo. " +
  "Adverse events were mostly gastrointestinal and led to discontinuation in 6% of participants. " +
  "GIM/FP/GP: [Formula: see text] Public Health: [Formula: see text]." }];
const a = T.핵심결론_뽑기(acp);
검사("A. 편집자 평가표를 결론으로 잡지 않는가",
  !a.글.includes("GIM/FP/GP") && !a.글.includes("Formula"), a.글);
검사("A. 대신 실제 결과 문장을 가져오는가",
  a.글.includes("reduced the number of heavy drinking days") || a.글.includes("Adverse events"), a.글);

// --- 사례 B: 초록이 아예 없는 논문 (JAMA 짧은 리뷰 등) ---
const 초록없음XML = `<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation>
  <PMID>42616548</PMID><Article>
  <Journal><ISOAbbreviation>JAMA</ISOAbbreviation>
    <JournalIssue><PubDate><Year>2026</Year><Month>Aug</Month></PubDate></JournalIssue></Journal>
  <ArticleTitle>Medications for Alcohol Use Disorder.</ArticleTitle>
  <AuthorList><Author><LastName>Holt</LastName><Initials>SR</Initials></Author></AuthorList>
  </Article></MedlineCitation></PubmedArticle></PubmedArticleSet>`;
const b = T.논문정보_정리(new DOMParser().parseFromString(초록없음XML,"text/xml").querySelector("PubmedArticle"));
검사("B. 초록이 없으면 빈 값을 돌려주는가", b.핵심 === "" && b.초록문단들.length === 0, [b.핵심, b.초록문단들.length]);

// --- 사례 C: 출판사 초록이 OtherAbstract 에만 있는 경우 ---
const otherXML = `<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation>
  <PMID>1</PMID><Article><Journal><ISOAbbreviation>JAMA</ISOAbbreviation></Journal>
  <ArticleTitle>T</ArticleTitle></Article>
  <OtherAbstract Type="Publisher"><AbstractText>Background here first. Methods here second. In conclusion, naltrexone reduced relapse rates substantially in this population.</AbstractText></OtherAbstract>
  </MedlineCitation></PubmedArticle></PubmedArticleSet>`;
const c = T.논문정보_정리(new DOMParser().parseFromString(otherXML,"text/xml").querySelector("PubmedArticle"));
검사("C. OtherAbstract 에 있는 초록도 읽어오는가", c.초록문단들.length === 1, c.초록문단들.length);
검사("C. 그 초록에서도 결론을 찾는가", c.핵심.includes("naltrexone reduced relapse"), c.핵심);

// --- 사례 D: 자리표시자 정리 ---
검사("D. [Formula: see text] 를 지우는가",
  T.자리표시자_지우기("Effect size was [Formula: see text] in the trial.") === "Effect size was in the trial.",
  T.자리표시자_지우기("Effect size was [Formula: see text] in the trial."));

// --- 사례 E: 정상 결론은 그대로 통과 ---
검사("E. 정상적인 결론 문장은 쓸만한 것으로 판단하는가",
  T.결론으로_쓸만한가("Findings underscore the heterogeneity of bipolar disorder and the influence of comorbid anxiety."));
검사("E. 평가표 같은 조각은 걸러내는가",
  !T.결론으로_쓸만한가("GIM/FP/GP: [Formula: see text] Public Health: [Formula: see text]."));


console.log(실패 === 0 ? "\n🎉 모든 사례에서 결론을 올바르게 찾았습니다" : `\n⚠️ ${실패}건 실패`);
process.exit(실패 === 0 ? 0 : 1);
