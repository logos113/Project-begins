/*
  ============================================================
  rss.mjs  =  RSS 읽어오기

  RSS 란 무엇인가

    신문사나 블로그가 "새 글이 나왔습니다" 하고 내놓는 목록입니다.
    사람이 보라고 만든 것이 아니라 기계가 읽으라고 만든 것이라서,
    생긴 것은 이렇게 꺾쇠가 잔뜩 붙은 모양입니다.

      <item>
        <title>삼성전자, 3분기 실적 발표</title>
        <link>https://...</link>
        <pubDate>Wed, 05 Nov 2026 06:00:00 +0900</pubDate>
      </item>

    이 파일은 그 꺾쇠들을 벗겨내고 { 제목, 주소, 시각 } 으로 바꿔줍니다.

  ※ 라이브러리를 쓰지 않습니다.
     이 저장소의 규칙입니다 — 내려받아 설치하는 것 없이, 열면 바로 돕니다.
     RSS 는 생김새가 단순해서 직접 벗겨내도 충분합니다.

  ※ 이 파일은 '깃허브 일꾼' 안에서만 돕니다. 브라우저에서는 돌지 않습니다.
     브라우저가 남의 사이트를 직접 읽으려 하면 거의 다 막힙니다(CORS).
     그래서 일꾼이 대신 읽어서 우리 저장소에 JSON 으로 놓아두고,
     앱은 그 JSON 만 읽습니다.
  ============================================================
*/

/*
  한 번 부르는 데 너무 오래 끌지 않게 합니다.
  뉴스 출처 하나가 느리다고 아침 브리핑 전체가 늦어지면 안 됩니다.
*/
const 기다리는_시간 = 15000;   // 15초

/*
  사람이 쓰는 브라우저인 척합니다.
  이걸 안 붙이면 아예 안 내어주는 사이트가 제법 있습니다.
*/
const 머리말 = {
  "User-Agent": "Mozilla/5.0 (compatible; DrY-Archive-Brief/1.0; +https://logos113.github.io/Project-begins/)",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
};

/*
  꺾쇠 안에 든 글을 꺼냅니다.

  RSS 에는 두 가지 모양이 섞여 나옵니다.
    <title>그냥 글자</title>
    <title><![CDATA[꺾쇠가 들어가도 괜찮은 글자]]></title>
  CDATA 는 "이 안은 그대로 읽어주세요" 라는 표시입니다. 둘 다 받습니다.
*/
function 태그_속_글(덩어리, 태그) {
  const 찾기 = new RegExp(`<${태그}[^>]*>([\\s\\S]*?)</${태그}>`, "i");
  const 걸린것 = 덩어리.match(찾기);
  if (!걸린것) return "";
  return 글_다듬기(걸린것[1]);
}

/*
  &amp; 같은 '피한 글자' 를 원래 글자로 돌리고, 남은 꺾쇠를 떼어냅니다.

  RSS 안에서는 & 와 < 를 그대로 쓸 수 없어서 &amp; &lt; 처럼 바꿔 적습니다.
  그대로 두면 화면에 "삼성전자&amp;LG" 처럼 보입니다.
*/
function 글_다듬기(글) {
  return 글
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")   // CDATA 껍질 벗기기
    .replace(/<[^>]+>/g, " ")                        // 본문에 섞인 꺾쇠 제거
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, 번호) => String.fromCharCode(Number(번호)))
    .replace(/&amp;/g, "&")                          // & 는 맨 마지막에 (안 그러면 &amp;lt; 가 깨집니다)
    .replace(/\s+/g, " ")
    .trim();
}

/*
  날짜 글자를 통일된 모양으로 바꿉니다.

  RSS 마다 적는 법이 다릅니다.
    Wed, 05 Nov 2026 06:00:00 +0900
    2026-11-05T06:00:00+09:00
  읽을 수 없는 모양이면 null 을 돌려주고, 쓰는 쪽에서 '시각 모름' 으로 다룹니다.
*/
function 시각_읽기(글) {
  if (!글) return null;
  const 때 = new Date(글);
  return Number.isNaN(때.getTime()) ? null : 때.toISOString();
}

/*
  RSS 한 곳을 읽어서 기사 목록으로 돌려줍니다.

  실패해도 던지지 않습니다 — { 성공: false, 까닭 } 을 돌려줍니다.
  출처 하나가 죽었다고 아침 브리핑이 통째로 안 나오면 안 되기 때문입니다.
  어디가 실패했는지는 브리핑 안에 적어두고, 나중에 고칩니다.
*/
export async function rss_읽기(출처) {
  const 시작 = Date.now();
  try {
    const 멈추개 = AbortSignal.timeout(기다리는_시간);
    const 답 = await fetch(출처.주소, { headers: 머리말, signal: 멈추개, redirect: "follow" });

    if (!답.ok) {
      return { 출처: 출처.이름, 성공: false, 까닭: `응답 ${답.status}`, 기사: [] };
    }

    const 글 = await 답.text();

    /*
      RSS 2.0 은 <item>, Atom 은 <entry> 를 씁니다. 둘 다 받습니다.
      [\s\S] 는 '줄바꿈 포함 아무 글자' 라는 뜻입니다 (. 은 줄바꿈을 못 넘습니다).
    */
    const 덩어리들 = 글.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) || [];

    const 기사 = [];
    for (const 덩어리 of 덩어리들) {
      const 제목 = 태그_속_글(덩어리, "title");
      if (!제목) continue;

      /*
        주소는 두 모양이 있습니다.
          <link>https://...</link>                     (RSS)
          <link rel="alternate" href="https://..."/>   (Atom)
      */
      let 주소 = 태그_속_글(덩어리, "link");
      if (!주소) {
        const 아톰 = 덩어리.match(/<link[^>]*href=["']([^"']+)["']/i);
        주소 = 아톰 ? 아톰[1] : "";
      }

      const 때 = 시각_읽기(
        태그_속_글(덩어리, "pubDate") ||
        태그_속_글(덩어리, "published") ||
        태그_속_글(덩어리, "updated") ||
        태그_속_글(덩어리, "dc:date"),
      );

      기사.push({
        제목,
        주소,
        때,
        출처: 출처.이름,
        갈래: 출처.갈래,          // "한국" · "미국" · "코인"
      });
    }

    return {
      출처: 출처.이름,
      성공: true,
      걸린시간: Date.now() - 시작,
      기사,
    };
  } catch (오류) {
    /*
      여기로 오는 경우
        - 주소가 아예 없어졌을 때
        - 15초 안에 답이 안 왔을 때 (AbortSignal.timeout)
        - 인터넷이 막혔을 때
    */
    return {
      출처: 출처.이름,
      성공: false,
      까닭: String(오류.name === "TimeoutError" ? "시간 초과" : 오류.message).slice(0, 120),
      기사: [],
    };
  }
}

/*
  여러 곳을 한꺼번에 읽습니다.

  하나씩 차례로 읽으면 출처가 10곳일 때 10배 오래 걸립니다.
  Promise.all 로 동시에 보내면 가장 느린 한 곳만큼만 걸립니다.
*/
export async function rss_여러곳_읽기(출처들) {
  return Promise.all(출처들.map(rss_읽기));
}

export { 글_다듬기, 시각_읽기 };
