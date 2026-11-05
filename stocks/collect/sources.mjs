/*
  ============================================================
  sources.mjs  =  어디서 가져올 것인가

  뉴스 출처와 시세 출처를 한곳에 모아둔 표입니다.
  새 출처를 넣고 싶으면 여기에 한 줄 더하면 됩니다.

  ※ 일부러 넉넉하게 넣어두었습니다.
     RSS 주소는 신문사가 예고 없이 바꾸거나 없애는 일이 흔합니다.
     한 곳이 죽어도 아침 브리핑이 비지 않도록 여러 곳을 겹쳐 둡니다.
     죽은 곳은 건너뛰고, 어디가 죽었는지는 브리핑 안에 적힙니다
     (data/오늘.json 의 '출처상태' 를 보세요).
  ============================================================
*/

/*
  뉴스 출처.

    이름   화면에 보일 이름
    갈래   "한국" · "미국" · "코인"  — 앱에서 이 갈래로 묶어 보여줍니다
    주소   RSS 주소
*/
export const 뉴스출처 = [
  // ---------- 한국 ----------
  { 이름: "연합뉴스 경제", 갈래: "한국", 주소: "https://www.yna.co.kr/rss/economy.xml" },
  { 이름: "연합뉴스 증시", 갈래: "한국", 주소: "https://www.yna.co.kr/rss/market.xml" },
  { 이름: "한국경제 증권", 갈래: "한국", 주소: "https://www.hankyung.com/feed/finance" },
  { 이름: "한국경제 경제", 갈래: "한국", 주소: "https://www.hankyung.com/feed/economy" },
  { 이름: "매일경제 증권", 갈래: "한국", 주소: "https://www.mk.co.kr/rss/50200011/" },
  { 이름: "매일경제 경제", 갈래: "한국", 주소: "https://www.mk.co.kr/rss/30100041/" },
  { 이름: "이데일리 증권", 갈래: "한국", 주소: "https://rss.edaily.co.kr/stock_news.xml" },
  { 이름: "머니투데이 증권", 갈래: "한국", 주소: "https://rss.mt.co.kr/mt_news_stock.xml" },

  // ---------- 미국 ----------
  { 이름: "CNBC 마켓", 갈래: "미국", 주소: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258" },
  { 이름: "CNBC 주요뉴스", 갈래: "미국", 주소: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" },
  { 이름: "MarketWatch", 갈래: "미국", 주소: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { 이름: "MarketWatch 시황", 갈래: "미국", 주소: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse" },
  { 이름: "Yahoo Finance", 갈래: "미국", 주소: "https://finance.yahoo.com/news/rssindex" },
  { 이름: "Investing 경제지표", 갈래: "미국", 주소: "https://www.investing.com/rss/news_25.rss" },

  // ---------- 코인 ----------
  { 이름: "CoinDesk", 갈래: "코인", 주소: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { 이름: "Cointelegraph", 갈래: "코인", 주소: "https://cointelegraph.com/rss" },
  { 이름: "Decrypt", 갈래: "코인", 주소: "https://decrypt.co/feed" },
  { 이름: "The Block", 갈래: "코인", 주소: "https://www.theblock.co/rss.xml" },
  { 이름: "코인데스크 코리아", 갈래: "코인", 주소: "https://www.coindeskkorea.com/rss/allArticle.xml" },
];

/*
  시세 — 지수·환율.

  Stooq 라는 곳이 CSV 한 줄로 내어줍니다. 열쇠(API key)가 필요 없고 가볍습니다.
    https://stooq.com/q/l/?s=^spx&f=sd2t2ohlcv&h&e=csv
  돌아오는 것:
    Symbol,Date,Time,Open,High,Low,Close,Volume
    ^SPX,2026-11-04,22:00:00,5800.1,5820.3,5790.0,5812.4,0

  ※ 한국 지수는 Stooq 에서 잘 안 나올 때가 있어, 야후에서 한 번 더 시도합니다
     (prices.mjs 의 '두 번 시도하기' 참고).
*/
export const 지수들 = [
  { 이름: "코스피",   stooq: "^kospi", yahoo: "^KS11",  단위: "", 갈래: "한국" },
  { 이름: "코스닥",   stooq: "^kosdaq", yahoo: "^KQ11", 단위: "", 갈래: "한국" },
  { 이름: "S&P 500",  stooq: "^spx",   yahoo: "^GSPC",  단위: "", 갈래: "미국" },
  { 이름: "나스닥",   stooq: "^ndq",   yahoo: "^IXIC",  단위: "", 갈래: "미국" },
  { 이름: "원/달러",  stooq: "usdkrw", yahoo: "KRW=X",  단위: "원", 갈래: "환율" },
];

/*
  시세 — 코인.

  CoinGecko 는 열쇠 없이도 쓸 수 있습니다(1분에 몇 번까지로 제한).
  하루 한 번 부르는 우리에게는 넉넉합니다.
*/
export const 코인들 = [
  { 이름: "비트코인", id: "bitcoin" },
  { 이름: "이더리움", id: "ethereum" },
  { 이름: "리플",     id: "ripple" },
  { 이름: "솔라나",   id: "solana" },
];
