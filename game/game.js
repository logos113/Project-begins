/*
  ============================================================
  점프! 로봇  -  game.js

  ★★★ 여기부터 아래 '설정' 부분의 숫자를 바꿔보세요 ★★★

  숫자 하나만 바꿔도 게임이 완전히 달라집니다.
  바꾼 뒤 저장하고 화면을 새로고침하면 바로 확인할 수 있어요.
  이상해지면 원래 숫자로 되돌리면 됩니다. 망가지지 않으니 마음껏 해보세요.
  ============================================================
*/

const 설정 = {

  // ===== 로봇의 움직임 =====
  점프_힘: 11,          // 클수록 높이 뜁니다      (한번 해보세요: 20)
  중력: 0.55,           // 클수록 빨리 떨어집니다   (한번 해보세요: 0.2 → 달나라!)
  두번_점프_가능: true,  // 공중에서 한 번 더 점프  (false 로 하면 한 번만)

  // ===== 게임 속도 =====
  시작_속도: 4.2,       // 처음 달리는 속도
  속도_증가: 0.00035,   // 클수록 빨리 어려워집니다 (0 으로 하면 계속 같은 속도)
  최대_속도: 11,        // 아무리 빨라져도 여기까지

  // ===== 장애물 =====
  장애물_최소간격: 300,  // 작을수록 촘촘하게 나옵니다 (어려워짐)
  장애물_최대간격: 540,
  높은장애물_확률: 0.25, // 0 이면 낮은 것만, 1 이면 높은 것만

  // ===== 코인 =====
  코인_나올확률: 0.6,   // 장애물 위에 코인이 뜰 확률
  코인_점수: 10,        // 코인 하나에 몇 점

  // ===== 색깔 (색상표는 구글에 'color picker' 검색) =====
  색: {
    로봇:      "#ffd166",   // 로봇 몸통 (노랑)
    로봇눈:    "#1b2a4a",
    장애물:    "#ef476f",   // 장애물 (빨강)
    코인:      "#ffd166",
    땅:        "#2a3f5f",
    땅선:      "#4d6a8f",
    하늘위:    "#1b2a4a",
    하늘아래:  "#3d5a80",
    별:        "#ffffff",
    산:        "#25395c",
  },
};

/* ============================================================
   ↑↑↑ 여기까지가 마음껏 바꿔도 되는 부분입니다 ↑↑↑

   아래는 게임을 실제로 움직이는 부분입니다.
   지금 다 이해하지 않아도 괜찮아요. 궁금해지면 그때 읽어보세요.
   ============================================================ */


/* ---------- 화면 준비 ----------
   canvas(캔버스)는 그림을 그리는 도화지입니다.
   ctx 는 그 도화지에 그림을 그리는 '붓' 이라고 생각하면 됩니다. */

const 캔버스 = document.getElementById("gameCanvas");
const 붓 = 캔버스.getContext("2d");

/*
  게임 안에서 쓰는 좌표는 실제 화면 크기와 다릅니다.

  ※ 여기서 '가로 길이를 일정하게 유지하는 것' 이 중요합니다.
     화면 높이를 기준으로 삼으면, 세로로 든 휴대폰에서 게임 가로가 아주 좁아져
     장애물이 나타나고 0.4초 만에 피해야 하는 상황이 됩니다. 사실상 못 합니다.
     그래서 가로를 먼저 정하고, 세로는 기기 비율에 맞춰 늘어나게 했습니다.
     이렇게 하면 어떤 기기에서든 '보고 나서 피할 시간' 이 비슷해집니다.
*/
const 세로화면_가로길이 = 360;   // 휴대폰을 세로로 들었을 때 (작을수록 크게 보입니다)
const 가로화면_가로길이 = 640;   // 가로로 눕혔을 때 (조금 더 넓게 보여줍니다)

let 화면폭 = 640;
let 기준높이 = 400;        // 기기 비율에 따라 달라집니다
let 배율 = 1;

const 땅높이 = 62;          // 화면 아래에서 땅까지의 높이
let 땅위치 = 기준높이 - 땅높이;

function 화면크기_맞추기() {
  // devicePixelRatio = 화면이 얼마나 촘촘한지 (아이패드는 보통 2)
  // 이 값을 곱해줘야 그림이 또렷하게 나옵니다
  const 촘촘함 = Math.min(window.devicePixelRatio || 1, 3);
  const 실제폭 = window.innerWidth;
  const 실제높이 = window.innerHeight;

  캔버스.width = Math.round(실제폭 * 촘촘함);
  캔버스.height = Math.round(실제높이 * 촘촘함);

  // 가로를 먼저 정하고, 그 비율대로 세로를 계산합니다
  화면폭 = 실제폭 < 실제높이 ? 세로화면_가로길이 : 가로화면_가로길이;
  const 확대비 = 실제폭 / 화면폭;
  기준높이 = 실제높이 / 확대비;
  땅위치 = 기준높이 - 땅높이;

  // 앞으로 그리는 모든 것에 이 배율을 자동으로 적용합니다
  배율 = 확대비 * 촘촘함;
  붓.setTransform(배율, 0, 0, 배율, 0, 0);
  붓.imageSmoothingEnabled = false;
}

window.addEventListener("resize", () => {
  화면크기_맞추기();
  if (!진행중) { 로봇.y = 땅위치; 그리기(); }   // 게임 중이 아니면 배경을 다시 그립니다
});
화면크기_맞추기();


/* ---------- 게임에 필요한 값들 ---------- */

const 로봇 = {
  x: 78,
  y: 땅위치,
  폭: 30,
  높이: 34,
  세로속도: 0,
  점프한횟수: 0,
  달린거리: 0,      // 다리 움직임을 만들 때 씁니다
};

let 장애물들 = [];
let 코인들 = [];
let 반짝임들 = [];    // 코인을 먹었을 때 튀는 작은 조각들

let 속도 = 설정.시작_속도;
let 점수 = 0;
let 최고점수 = 0;
let 다음장애물까지 = 420;
let 진행중 = false;
let 지난시각 = 0;

// 배경에 쓸 별과 산을 미리 만들어 둡니다 (매번 새로 만들면 어지럽습니다)
/*
  별의 세로 위치는 '비율' 로 저장합니다 (0 = 맨 위, 1 = 땅).
  화면 비율은 기기마다 다른데, 고정된 숫자로 두면
  세로로 긴 화면에서 위쪽이 텅 비어 보이기 때문입니다.
*/
const 별들 = Array.from({ length: 70 }, () => ({
  x: Math.random() * 1200,
  y비율: Math.random() * 0.88,
  크기: Math.random() * 1.6 + 0.6,
  깜빡임: Math.random() * Math.PI * 2,
}));

// 달 — 하늘이 넓을 때 허전하지 않도록 하나 띄웁니다
const 달 = { x비율: 0.74, y비율: 0.16, 크기: 26 };
const 산들 = Array.from({ length: 14 }, (_, i) => ({
  x: i * 130 + Math.random() * 60,
  높이: 60 + Math.random() * 70,
  폭: 150 + Math.random() * 90,
}));


/* ---------- 화면의 글자들 ---------- */

const 점수_자리   = document.getElementById("score");
const 최고_자리   = document.getElementById("best");
const 덮개        = document.getElementById("overlay");
const 덮개제목    = document.getElementById("overlayTitle");
const 덮개설명    = document.getElementById("overlayText");
const 결과상자    = document.getElementById("resultBox");
const 최종점수    = document.getElementById("finalScore");
const 최종최고    = document.getElementById("finalBest");
const 신기록      = document.getElementById("newRecord");
const 시작버튼    = document.getElementById("startBtn");
const 소리버튼    = document.getElementById("soundBtn");


/* ---------- 최고 점수 저장 ----------
   localStorage = 브라우저 안의 작은 저장 공간입니다.
   게임을 껐다 켜도 최고 점수가 남아 있습니다. */

const 저장이름 = "jump-robot-best";

function 최고점수_불러오기() {
  try {
    return Number(localStorage.getItem(저장이름)) || 0;
  } catch {
    return 0;   // 저장 공간을 못 쓰는 경우에도 게임은 그냥 돌아갑니다
  }
}
function 최고점수_저장하기(점수) {
  try { localStorage.setItem(저장이름, String(점수)); } catch { /* 무시 */ }
}


/* ---------- 소리 ----------
   소리 파일 없이, 컴퓨터가 직접 '삐' 소리를 만들어 냅니다.
   주파수(Hz)가 높을수록 높은 소리입니다. */

let 오디오 = null;
let 소리켬 = true;

function 소리내기(시작음, 끝음, 길이, 종류 = "square") {
  if (!소리켬) return;
  try {
    if (!오디오) 오디오 = new (window.AudioContext || window.webkitAudioContext)();
    const 지금 = 오디오.currentTime;

    const 발진기 = 오디오.createOscillator();   // 소리를 만드는 부분
    const 볼륨 = 오디오.createGain();           // 소리 크기를 조절하는 부분

    발진기.type = 종류;
    발진기.frequency.setValueAtTime(시작음, 지금);
    발진기.frequency.exponentialRampToValueAtTime(Math.max(끝음, 1), 지금 + 길이);

    볼륨.gain.setValueAtTime(0.16, 지금);
    볼륨.gain.exponentialRampToValueAtTime(0.001, 지금 + 길이);   // 서서히 작아지게

    발진기.connect(볼륨).connect(오디오.destination);
    발진기.start(지금);
    발진기.stop(지금 + 길이);
  } catch { /* 소리가 안 나도 게임은 계속됩니다 */ }
}

const 점프소리   = () => 소리내기(420, 780, 0.12);
const 두번점프   = () => 소리내기(560, 980, 0.12);
const 코인소리   = () => 소리내기(880, 1400, 0.14, "triangle");
const 부딪힘소리 = () => 소리내기(220, 60, 0.34, "sawtooth");


/* ---------- 게임 시작 / 끝 ---------- */

function 게임_시작() {
  장애물들 = [];
  코인들 = [];
  반짝임들 = [];
  속도 = 설정.시작_속도;
  점수 = 0;
  다음장애물까지 = 화면폭 * 0.9;   // 시작하자마자 부딪히지 않게 여유를 둡니다

  로봇.y = 땅위치;
  로봇.세로속도 = 0;
  로봇.점프한횟수 = 0;
  로봇.달린거리 = 0;

  진행중 = true;
  덮개.classList.add("hidden");
  점수_자리.textContent = "0";

  지난시각 = performance.now();
  requestAnimationFrame(한장면_그리기);
}

function 게임_끝() {
  진행중 = false;
  부딪힘소리();

  const 딴점수 = Math.floor(점수);
  const 신기록인가 = 딴점수 > 최고점수;
  if (신기록인가) {
    최고점수 = 딴점수;
    최고점수_저장하기(최고점수);
    최고_자리.textContent = 최고점수;
  }

  덮개제목.textContent = 신기록인가 ? "신기록!" : "아쉬워요";
  덮개설명.textContent = 신기록인가
    ? "지금까지 중에 제일 멀리 갔어요!"
    : "다시 하면 더 잘할 수 있어요";
  최종점수.textContent = 딴점수;
  최종최고.textContent = 최고점수;
  신기록.hidden = !신기록인가;
  결과상자.hidden = false;
  시작버튼.textContent = "다시 하기";
  덮개.classList.remove("hidden");
}


/* ---------- 점프 ---------- */

function 점프하기() {
  if (!진행중) return;

  const 땅에있나 = 로봇.y >= 땅위치 - 0.5;
  const 최대점프횟수 = 설정.두번_점프_가능 ? 2 : 1;

  if (로봇.점프한횟수 < 최대점프횟수) {
    로봇.세로속도 = -설정.점프_힘;
    로봇.점프한횟수 += 1;
    if (로봇.점프한횟수 === 1) 점프소리();
    else 두번점프();
  }
}


/* ---------- 장애물과 코인 만들기 ---------- */

function 장애물_하나_만들기() {
  const 높은가 = Math.random() < 설정.높은장애물_확률;
  const 높이 = 높은가 ? 46 + Math.random() * 16 : 26 + Math.random() * 12;
  const 폭 = 높은가 ? 20 : 16 + Math.random() * 12;

  장애물들.push({ x: 화면폭 + 40, 폭, 높이, 지나감: false });

  // 장애물 위쪽에 코인을 띄웁니다. 점프해서 먹으라는 뜻이죠.
  if (Math.random() < 설정.코인_나올확률) {
    코인들.push({
      x: 화면폭 + 40 + 폭 / 2,
      y: 땅위치 - 높이 - 42 - Math.random() * 30,
      먹힘: false,
      회전: 0,
    });
  }

  다음장애물까지 = 설정.장애물_최소간격 +
    Math.random() * (설정.장애물_최대간격 - 설정.장애물_최소간격);
}


/* ---------- 부딪혔는지 확인 ----------
   두 사각형이 겹치는지 보는 계산입니다.
   여유(3픽셀)를 조금 둬서 아슬아슬하게 스쳐도 봐줍니다. */

function 겹치나(a, b) {
  const 여유 = 3;
  return a.x + 여유 < b.x + b.폭 &&
         a.x + a.폭 - 여유 > b.x &&
         a.y + 여유 < b.y + b.높이 &&
         a.y + a.높이 - 여유 > b.y;
}


/* ---------- 게임의 심장: 한 장면씩 그리기 ----------
   requestAnimationFrame = 브라우저에게 "다음 화면 그릴 때 나를 불러줘" 하는 것.
   보통 1초에 60번 불립니다.

   dt(델타타임)를 쓰는 이유:
     기기마다 화면 갱신 속도가 다릅니다(60번, 120번...).
     그냥 더하면 빠른 기기에서 게임이 두 배로 빨라집니다.
     그래서 '지난 화면에서 얼마나 시간이 흘렀는지'를 곱해줍니다.
*/

function 한장면_그리기(지금) {
  if (!진행중) return;

  let dt = (지금 - 지난시각) / 16.67;      // 60번/초 를 1 로 봤을 때의 배율
  dt = Math.min(dt, 3);                    // 잠깐 멈췄다 돌아와도 확 튀지 않게
  지난시각 = 지금;

  // --- 속도와 점수 올리기 ---
  속도 = Math.min(속도 + 설정.속도_증가 * dt * 16.67, 설정.최대_속도);
  점수 += 속도 * dt * 0.08;
  점수_자리.textContent = Math.floor(점수);

  // --- 로봇 움직이기 ---
  로봇.세로속도 += 설정.중력 * dt;
  로봇.y += 로봇.세로속도 * dt;
  if (로봇.y >= 땅위치) {          // 땅에 닿으면 멈춤
    로봇.y = 땅위치;
    로봇.세로속도 = 0;
    로봇.점프한횟수 = 0;
  }
  로봇.달린거리 += 속도 * dt;

  // --- 장애물 만들고 옮기기 ---
  다음장애물까지 -= 속도 * dt;
  if (다음장애물까지 <= 0) 장애물_하나_만들기();

  for (const 장애물 of 장애물들) 장애물.x -= 속도 * dt;
  장애물들 = 장애물들.filter((장애물) => 장애물.x + 장애물.폭 > -20);

  for (const 코인 of 코인들) {
    코인.x -= 속도 * dt;
    코인.회전 += 0.12 * dt;
  }
  코인들 = 코인들.filter((코인) => 코인.x > -20 && !코인.먹힘);

  // --- 부딪혔는지 확인 ---
  const 로봇상자 = { x: 로봇.x, y: 로봇.y - 로봇.높이, 폭: 로봇.폭, 높이: 로봇.높이 };
  for (const 장애물 of 장애물들) {
    const 장애물상자 = {
      x: 장애물.x, y: 땅위치 - 장애물.높이, 폭: 장애물.폭, 높이: 장애물.높이,
    };
    if (겹치나(로봇상자, 장애물상자)) { 게임_끝(); return; }
  }

  // --- 코인 먹기 ---
  for (const 코인 of 코인들) {
    const 거리 = Math.hypot(코인.x - (로봇.x + 로봇.폭 / 2),
                            코인.y - (로봇.y - 로봇.높이 / 2));
    if (거리 < 24) {
      코인.먹힘 = true;
      점수 += 설정.코인_점수;
      코인소리();
      // 반짝이는 조각을 여덟 개 흩뿌립니다
      for (let i = 0; i < 8; i++) {
        반짝임들.push({
          x: 코인.x, y: 코인.y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5 - 1.5,
          목숨: 1,
        });
      }
    }
  }

  for (const 조각 of 반짝임들) {
    조각.x += 조각.vx * dt - 속도 * dt;
    조각.y += 조각.vy * dt;
    조각.vy += 0.25 * dt;
    조각.목숨 -= 0.035 * dt;
  }
  반짝임들 = 반짝임들.filter((조각) => 조각.목숨 > 0);

  그리기();
  requestAnimationFrame(한장면_그리기);
}


/* ---------- 화면에 그리기 ---------- */

function 그리기() {
  const 색 = 설정.색;

  // 하늘 (위에서 아래로 색이 변하는 그라데이션)
  const 하늘 = 붓.createLinearGradient(0, 0, 0, 기준높이);
  하늘.addColorStop(0, 색.하늘위);
  하늘.addColorStop(1, 색.하늘아래);
  붓.fillStyle = 하늘;
  붓.fillRect(0, 0, 화면폭, 기준높이);

  // 달 — 아주 멀리 있으니 흐르지 않고 제자리에 떠 있습니다
  const 달x = 화면폭 * 달.x비율;
  const 달y = 땅위치 * 달.y비율;
  붓.globalAlpha = 0.92;
  붓.fillStyle = "#fdf6e3";
  붓.beginPath();
  붓.arc(달x, 달y, 달.크기, 0, Math.PI * 2);
  붓.fill();
  // 하늘색 원을 살짝 겹쳐 덮으면 초승달 모양이 됩니다
  붓.fillStyle = 색.하늘위;
  붓.beginPath();
  붓.arc(달x + 달.크기 * 0.42, 달y - 달.크기 * 0.22, 달.크기 * 0.95, 0, Math.PI * 2);
  붓.fill();
  붓.globalAlpha = 1;

  // 별 (아주 천천히 흐르고, 반짝입니다)
  붓.fillStyle = 색.별;
  for (const 별 of 별들) {
    const x = ((별.x - 로봇.달린거리 * 0.06) % 1200 + 1200) % 1200;
    if (x > 화면폭 + 5) continue;
    붓.globalAlpha = 0.35 + Math.sin(로봇.달린거리 * 0.02 + 별.깜빡임) * 0.3;
    붓.fillRect(x, 별.y비율 * 땅위치, 별.크기, 별.크기);
  }
  붓.globalAlpha = 1;

  // 산 (별보다 조금 빨리 흘러서 멀리 있는 느낌을 줍니다)
  붓.fillStyle = 색.산;
  for (const 산 of 산들) {
    const x = ((산.x - 로봇.달린거리 * 0.18) % 1900 + 1900) % 1900;
    if (x > 화면폭 + 산.폭) continue;
    붓.beginPath();
    붓.moveTo(x, 땅위치);
    붓.lineTo(x + 산.폭 / 2, 땅위치 - 산.높이);
    붓.lineTo(x + 산.폭, 땅위치);
    붓.closePath();
    붓.fill();
  }

  // 땅
  붓.fillStyle = 색.땅;
  붓.fillRect(0, 땅위치, 화면폭, 땅높이);
  붓.fillStyle = 색.땅선;
  붓.fillRect(0, 땅위치, 화면폭, 2);

  // 땅 위의 무늬 (흘러가서 달리는 느낌을 줍니다)
  붓.fillStyle = 색.땅선;
  붓.globalAlpha = 0.5;
  for (let i = 0; i < 20; i++) {
    const x = ((i * 90 - 로봇.달린거리) % 1800 + 1800) % 1800;
    if (x < 화면폭 + 30) 붓.fillRect(x, 땅위치 + 18, 26, 2);
  }
  붓.globalAlpha = 1;

  // 장애물
  붓.fillStyle = 색.장애물;
  for (const 장애물 of 장애물들) {
    const y = 땅위치 - 장애물.높이;
    붓.fillRect(장애물.x, y, 장애물.폭, 장애물.높이);
    // 위쪽에 뾰족한 삼각형을 얹어 위험해 보이게
    붓.beginPath();
    붓.moveTo(장애물.x, y);
    붓.lineTo(장애물.x + 장애물.폭 / 2, y - 9);
    붓.lineTo(장애물.x + 장애물.폭, y);
    붓.closePath();
    붓.fill();
  }

  // 코인 (돌아가는 것처럼 보이게 가로 폭을 바꿉니다)
  for (const 코인 of 코인들) {
    const 납작함 = Math.abs(Math.cos(코인.회전));
    붓.fillStyle = 설정.색.코인;
    붓.beginPath();
    붓.ellipse(코인.x, 코인.y, 9 * 납작함 + 1.5, 9, 0, 0, Math.PI * 2);
    붓.fill();
  }

  // 코인을 먹었을 때 튀는 조각들
  for (const 조각 of 반짝임들) {
    붓.globalAlpha = Math.max(조각.목숨, 0);
    붓.fillStyle = 설정.색.코인;
    붓.fillRect(조각.x - 2, 조각.y - 2, 4, 4);
  }
  붓.globalAlpha = 1;

  로봇_그리기();
}

function 로봇_그리기() {
  const 색 = 설정.색;
  const x = 로봇.x;
  const y = 로봇.y - 로봇.높이;      // 캔버스는 위가 0 이라, 발 위치에서 키를 뺍니다
  const 땅에있나 = 로봇.y >= 땅위치 - 0.5;

  // 다리 — 땅에 있을 때만 번갈아 움직여 달리는 것처럼 보이게
  붓.fillStyle = 색.로봇;
  const 다리흔들림 = 땅에있나 ? Math.sin(로봇.달린거리 * 0.35) * 5 : 3;
  붓.fillRect(x + 5, 로봇.y - 9, 6, 9 + 다리흔들림 * 0.5);
  붓.fillRect(x + 18, 로봇.y - 9, 6, 9 - 다리흔들림 * 0.5);

  // 몸통
  붓.fillRect(x, y, 로봇.폭, 로봇.높이 - 8);

  // 눈 (점프 중에는 살짝 위를 봅니다)
  붓.fillStyle = 색.로봇눈;
  const 눈높이 = 땅에있나 ? y + 10 : y + 8;
  붓.fillRect(x + 17, 눈높이, 7, 6);

  // 안테나
  붓.fillStyle = 색.로봇;
  붓.fillRect(x + 13, y - 7, 3, 7);
  붓.beginPath();
  붓.arc(x + 14.5, y - 9, 3, 0, Math.PI * 2);
  붓.fill();
}


/* ---------- 손가락·마우스·키보드 받기 ---------- */

function 눌렀을때(사건) {
  // 소리 버튼이나 시작 버튼을 누른 것이면 점프하지 않습니다
  if (사건.target.closest("button")) return;
  사건.preventDefault();
  if (진행중) 점프하기();
}

캔버스.addEventListener("pointerdown", 눌렀을때);
덮개.addEventListener("pointerdown", (사건) => { 사건.preventDefault(); });

window.addEventListener("keydown", (사건) => {
  if (사건.code === "Space" ||사건.code === "ArrowUp") {
    사건.preventDefault();
    if (진행중) 점프하기();
    else if (!덮개.classList.contains("hidden")) 게임_시작();
  }
});

시작버튼.addEventListener("click", () => 게임_시작());

소리버튼.addEventListener("click", () => {
  소리켬 = !소리켬;
  소리버튼.textContent = 소리켬 ? "🔊" : "🔇";
  소리버튼.classList.toggle("muted", !소리켬);
  if (소리켬) 코인소리();     // 켰을 때 잘 되는지 소리로 알려줍니다
});


/* ---------- 게임 속을 들여다보는 창 ----------
   게임이 지금 어떤 상태인지 밖에서 확인할 수 있게 열어둡니다.
   게임 동작에는 아무 영향이 없습니다.

   브라우저에서 F12(개발자 도구)를 열고 아래처럼 입력해보세요.
       게임상태()
   로봇이 지금 어디 있는지, 속도가 얼마인지 숫자로 볼 수 있습니다. */
window.게임상태 = () => ({
  진행중,
  점수: Math.floor(점수),
  속도: Number(속도.toFixed(2)),
  로봇y: Math.round(로봇.y),
  땅위치: Math.round(땅위치),
  공중에있나: 로봇.y < 땅위치 - 1,
  점프한횟수: 로봇.점프한횟수,
  장애물수: 장애물들.length,
  화면폭: Math.round(화면폭),
});


/* ---------- 시작할 때 한 번 실행 ---------- */

최고점수 = 최고점수_불러오기();
최고_자리.textContent = 최고점수;
그리기();      // 시작 화면 뒤에도 배경이 보이도록 한 번 그려둡니다
