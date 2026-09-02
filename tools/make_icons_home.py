"""
첫 화면(앱 고르기 페이지)의 아이콘을 만드는 프로그램입니다.

논문 앱(tools/make_icons.py)·일본어 앱(tools/make_icons_ja.py)과 같은 방식으로
파이썬만으로 PNG를 직접 그립니다(외부 라이브러리 없음).

그림은 두 앱의 색을 반씩 나눠 담은 사각형입니다.
왼쪽 청록 = 논문 앱, 오른쪽 붉은색 = 일본어 앱.
'여기서 둘 중 하나를 고른다'는 뜻이 한눈에 보이도록 했습니다.

실행:  python3 tools/make_icons_home.py
"""
import zlib, struct, os

# ---- 색깔 (각 앱의 강조색과 같은 값입니다) ----
논문색     = (0x1c, 0x5d, 0x7a)   # psychiatry/style.css 의 --accent
일본어색   = (0xb0, 0x3a, 0x2e)   # japanese/style.css 의 --accent
가운데선색 = (0xff, 0xff, 0xff)   # 두 색을 갈라놓는 흰 선


def 아이콘_그리기(크기):
    """정사각형 아이콘 하나를 그려서 PNG 바이트로 돌려줍니다."""
    S = 크기
    # 180 기준의 비율로 계산해서 어떤 크기에도 같은 모양이 나오게 합니다.
    비율 = lambda v: round(v * S / 180.0)
    선_좌, 선_우 = 비율(86), 비율(94)     # 가운데 흰 선의 좌우 위치

    줄들 = []
    for y in range(S):
        행 = bytearray([0])          # PNG는 각 줄 앞에 필터 바이트 1개가 붙습니다
        for x in range(S):
            if 선_좌 <= x < 선_우:
                색 = 가운데선색
            else:
                색 = 논문색 if x < 선_좌 else 일본어색
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
    뿌리 = os.path.join(os.path.dirname(__file__), "..")
    os.makedirs(os.path.join(뿌리, "icons"), exist_ok=True)
    만들목록 = [
        ("icons/favicon-32.png", 32),              # 브라우저 탭
        ("icons/apple-touch-icon-180.png", 180),   # 홈 화면에 추가했을 때
        # 아래 셋은 iOS 가 link 태그 없이도 관례적으로 찾아보는 이름입니다.
        # 예전 주소를 기억하고 있는 기기에서도 빈 아이콘이 나오지 않도록 함께 둡니다.
        ("apple-touch-icon.png", 180),
        ("apple-touch-icon-precomposed.png", 180),
        ("icon.png", 180),
    ]
    for 이름, 크기 in 만들목록:
        자료 = 아이콘_그리기(크기)
        with open(os.path.join(뿌리, 이름), "wb") as f:
            f.write(자료)
        print(f"{이름:36s} {크기:>4}x{크기:<4} {len(자료):>6,} bytes")
