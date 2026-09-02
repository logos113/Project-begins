"""
일본어 회화 앱(japanese/)의 홈 화면 아이콘을 만드는 프로그램입니다.

논문 앱의 tools/make_icons.py 와 같은 방식입니다.
파이썬만으로 PNG 그림 파일을 직접 그립니다(외부 라이브러리 없음).
그림은 붉은 바탕에 흰색 도리이(신사 입구의 문)입니다.

실행:  python3 tools/make_icons_ja.py
(아이패드에서는 실행할 수 없습니다. 필요하시면 Claude에게 부탁하세요.)
"""
import zlib, struct, os

# ---- 색깔 (원하는 색으로 바꿔보세요) ----
배경색 = (0xb0, 0x3a, 0x2e)   # 도리이의 붉은색 — style.css 의 --accent 와 같은 값
문색   = (0xff, 0xff, 0xff)   # 흰색


def 아이콘_그리기(크기, 단순하게=False, 여백크게=False):
    """정사각형 아이콘 하나를 그려서 PNG 바이트로 돌려줍니다.

    여백크게=True 는 'maskable' 아이콘용입니다.
    안드로이드·크롬은 아이콘을 원형이나 둥근 사각형으로 잘라내기 때문에,
    가장자리가 잘려도 그림이 온전하도록 안쪽으로 작게 그립니다.
    """
    S = 크기
    # 모든 좌표를 180 기준의 '비율'로 계산해서 어떤 크기에도 같은 모양이 나오게 합니다.
    # round() 로 정수 픽셀에 맞춰 두는 것이 중요합니다.
    # 소수점을 그대로 두면 획마다 두께가 1픽셀씩 달라져 지저분해집니다.
    축소 = 0.72 if 여백크게 else 1.0
    가운데 = 90.0
    위치 = lambda v: round((가운데 + (v - 가운데) * 축소) * S / 180.0)

    if 단순하게:
        # 아주 작은 크기(32px)에서는 가로대를 굵게, 획 수를 줄여야 형태가 보입니다
        칸들 = [
            (26, 40, 154, 58),     # 위 가로대 (笠木)
            (44, 70, 136, 86),     # 아래 가로대 (貫)
            (52, 40, 74, 152),     # 왼쪽 기둥
            (106, 40, 128, 152),   # 오른쪽 기둥
        ]
    else:
        칸들 = [
            (24, 38, 156, 54),     # 위 가로대 (笠木) — 기둥보다 넓게 내밀어야 도리이처럼 보입니다
            (34, 60, 146, 72),     # 그 아래 받침대 (島木)
            (42, 88, 138, 100),    # 두 번째 가로대 (貫)
            (84, 72, 96, 88),      # 두 가로대 사이의 짧은 기둥 (額束)
            (54, 38, 72, 152),     # 왼쪽 기둥
            (108, 38, 126, 152),   # 오른쪽 기둥
        ]

    칸들 = [(위치(x1), 위치(y1), 위치(x2), 위치(y2)) for x1, y1, x2, y2 in 칸들]

    줄들 = []
    for y in range(S):
        행 = bytearray([0])          # PNG는 각 줄 앞에 필터 바이트 1개가 붙습니다
        for x in range(S):
            색 = 배경색
            for x1, y1, x2, y2 in 칸들:
                if x1 <= x < x2 and y1 <= y < y2:
                    색 = 문색
                    break
            행 += bytes(색)
        줄들.append(bytes(행))

    def 청크(종류, 자료):
        return (struct.pack(">I", len(자료)) + 종류 + 자료
                + struct.pack(">I", zlib.crc32(종류 + 자료) & 0xffffffff))

    return (b"\x89PNG\r\n\x1a\n"
            + 청크(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 2, 0, 0, 0))   # 8비트 RGB
            + 청크(b"IDAT", zlib.compress(b"".join(줄들), 9))
            + 청크(b"IEND", b""))


if __name__ == "__main__":
    폴더 = os.path.join(os.path.dirname(__file__), "..", "japanese", "icons")
    os.makedirs(폴더, exist_ok=True)
    만들목록 = [
        ("apple-touch-icon-180.png", 180, False, False),   # 아이폰
        ("apple-touch-icon-167.png", 167, False, False),   # 아이패드 Pro
        ("apple-touch-icon-152.png", 152, False, False),   # 아이패드
        ("favicon-32.png", 32, True, False),               # 브라우저 탭
        ("icon-192.png", 192, False, False),               # 데스크탑 앱 설치용
        ("icon-512.png", 512, False, False),               # 데스크탑 앱 설치용(고해상도)
        ("icon-512-maskable.png", 512, False, True),       # 둥글게 잘려도 괜찮은 판
    ]
    for 이름, 크기, 단순, 여백 in 만들목록:
        자료 = 아이콘_그리기(크기, 단순, 여백)
        경로 = os.path.join(폴더, 이름)
        with open(경로, "wb") as f:
            f.write(자료)
        print(f"{이름:28s} {크기:>4}x{크기:<4} {len(자료):>6,} bytes")
