/*
  ============================================================
  sw.js  =  서비스 워커 (오프라인 담당)
  ------------------------------------------------------------
  서비스 워커란 무엇인가

    페이지와 인터넷 사이에 서 있는 작은 중계원입니다.
    브라우저 안에 따로 살면서, 페이지가 파일을 요청할 때마다
    "이건 내가 갖고 있으니 인터넷에 안 가도 돼" 라고 답해 줍니다.

    그래서 한 번 열어본 뒤에는 비행기 모드에서도 앱이 열립니다.
    이 파일이 하는 일은 그 두 가지뿐입니다 —
      (1) 앱을 이루는 파일들을 기기에 보관해 두고
      (2) 요청이 오면 보관해 둔 것을 내어 줍니다.

  ※ 이 파일은 페이지와 '다른 곳'에서 돕니다.
     document 나 window 를 쓸 수 없고, 화면을 직접 건드릴 수도 없습니다.
     화면에 무언가 띄워야 하면 페이지에 쪽지를 보냅니다(postMessage).

  ※ 영역(scope) 주의 — 이 파일은 game/ 폴더 안에 있습니다.
     서비스 워커는 자기가 놓인 폴더와 그 아래만 담당합니다.
     저장소 맨 위에 두면 세 앱을 전부 한 워커가 담당하게 되어,
     예전에 manifest 로 겪었던 '영역이 겹치는' 문제가 똑같이 생깁니다.
     그래서 앱마다 자기 폴더에 하나씩 둡니다.
  ============================================================
*/

/*
  보관함 이름입니다. 뒤의 숫자를 올리면 예전 보관함을 통째로 버리고
  새로 담습니다. 파일을 크게 바꿨을 때 올려주세요.

  ※ 이 파일의 글자가 한 자라도 달라지면 브라우저가 '새 버전'으로 알아채고
     설치를 시작합니다. 그래서 숫자를 올리는 것만으로 갱신이 시작됩니다.
*/
const 보관함_이름 = "game-v6";

/*
  미리 받아 둘 파일 목록입니다. 이것만 있으면 인터넷 없이도 앱이 돌아갑니다.

  ※ 주소에 ?v=2 같은 꼬리표를 붙이지 않았습니다.
     꼬리표는 파일을 고칠 때마다 바뀌는데, 여기까지 같이 고치는 것을
     잊으면 앱이 통째로 안 열립니다. 대신 찾을 때 꼬리표를 무시하도록
     해 두었습니다 (아래 ignoreSearch).
*/
const 미리받을것 = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./icons/game-favicon-32.png",
  "./icons/game-icon-152.png",
  "./icons/game-icon-180.png",
  "./icons/game-icon-192.png",
  "./icons/game-icon-512.png",
  "./icons/game-icon-512-maskable.png",
];

/*
  [1] 설치 — 파일들을 받아 보관함에 담습니다.
  앱을 처음 열 때, 그리고 이 파일이 바뀔 때마다 한 번씩 일어납니다.
*/
self.addEventListener("install", (사건) => {
  사건.waitUntil((async () => {
    const 보관함 = await caches.open(보관함_이름);
    /*
      addAll 은 하나라도 실패하면 전부 실패합니다.
      아이콘 하나 때문에 앱 전체가 오프라인이 안 되면 곤란하므로
      하나씩 담고, 실패한 것은 넘어갑니다.
    */
    await Promise.all(미리받을것.map(async (주소) => {
      try {
        await 보관함.add(new Request(주소, { cache: "reload" }));
      } catch (오류) {
        console.warn("[sw] 못 받아둔 파일:", 주소);
      }
    }));
  })());
});

/*
  [2] 켜기 — 예전 보관함을 치웁니다.
  보관함_이름 이 바뀌면 옛것이 그대로 남아 자리만 차지합니다.
*/
self.addEventListener("activate", (사건) => {
  사건.waitUntil((async () => {
    const 이름들 = await caches.keys();
    await Promise.all(이름들
      .filter((이름) => 이름.startsWith("game-") && 이름 !== 보관함_이름)
      .map((이름) => caches.delete(이름)));
    // 이미 열려 있는 화면도 곧바로 이 워커가 담당하게 합니다
    await self.clients.claim();
  })());
});

/*
  [3] 요청 가로채기 — 실제로 오프라인을 만드는 부분입니다.

  두 가지 방식을 씁니다.

    페이지(HTML)      → 인터넷 먼저, 안 되면 보관함
    나머지(css·js·그림) → 보관함 먼저, 뒤에서 몰래 새것 받아 두기

  왜 다르게 하나:
    HTML 을 보관함 먼저로 하면, 고쳐서 올려도 예전 화면이 계속 나옵니다.
    "고쳤는데 왜 그대로지?" 하는 그 문제가 훨씬 지독해집니다.
    반대로 css·js 는 주소에 ?v= 꼬리표가 붙어 있어서, 고치면 주소가
    달라지고 보관함에 없으니 자동으로 새로 받아옵니다.
*/
self.addEventListener("fetch", (사건) => {
  const 요청 = 사건.request;

  // 받아오기(GET)만 다룹니다. 보내기는 그대로 흘려보냅니다.
  if (요청.method !== "GET") return;

  // 우리 사이트 것만 다룹니다. 바깥 주소는 손대지 않습니다.
  if (new URL(요청.url).origin !== self.location.origin) return;

  // 화면을 여는 요청인가 (주소창으로 들어오는 것)
  const 페이지요청 = 요청.mode === "navigate";

  사건.respondWith((async () => {
    const 보관함 = await caches.open(보관함_이름);

    if (페이지요청) {
      try {
        const 응답 = await fetch(요청);
        보관함.put("./index.html", 응답.clone());
        return 응답;
      } catch (오류) {
        // 인터넷이 없을 때 — 보관해 둔 화면을 내어 줍니다
        const 가진것 = await 보관함.match("./index.html", { ignoreSearch: true });
        if (가진것) return 가진것;
        throw 오류;
      }
    }

    // css·js·그림 — 보관함에 있으면 바로 주고, 뒤에서 새것을 받아 둡니다
    const 가진것 = await 보관함.match(요청, { ignoreSearch: true });
    if (가진것) {
      fetch(요청).then((응답) => {
        if (응답 && 응답.ok) 보관함.put(요청, 응답.clone());
      }).catch(() => {});     // 인터넷이 없으면 그냥 넘어갑니다
      return 가진것;
    }

    // 보관함에 없으면 받아오고, 받은 김에 담아 둡니다
    try {
      const 응답 = await fetch(요청);
      if (응답 && 응답.ok) 보관함.put(요청, 응답.clone());
      return 응답;
    } catch (오류) {
      // 꼬리표(?v=)가 달라 못 찾은 경우를 대비해 한 번 더 뒤져 봅니다
      const 비슷한것 = await 보관함.match(요청, { ignoreSearch: true });
      if (비슷한것) return 비슷한것;
      throw 오류;
    }
  })());
});

/*
  [4] 페이지가 보내는 쪽지 받기

  새 버전이 준비되어도 곧바로 갈아끼우지 않습니다.
  쓰는 도중에 파일이 바뀌면 화면이 어긋날 수 있기 때문입니다.
  화면에 '새 버전이 있습니다' 를 띄우고, 사용자가 누르면 그때
  이 쪽지가 와서 교대합니다.
*/
self.addEventListener("message", (사건) => {
  if (사건.data && 사건.data.하는일 === "지금교대") self.skipWaiting();
});
