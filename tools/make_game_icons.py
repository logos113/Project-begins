"""
점프 게임의 아이콘을 만드는 프로그램입니다. (로봇 모양)
파이썬만으로 PNG 그림을 직접 그립니다.

실행:  python3 tools/make_game_icons.py
색을 바꾸고 싶으면 아래 '색' 부분을 고치세요.
"""
import zlib, struct, os

배경색   = (0x1b, 0x2a, 0x4a)   # 남색
로봇색   = (0xff, 0xd1, 0x66)   # 노랑
눈색     = (0x1b, 0x2a, 0x4a)


def 아이콘_그리기(크기, 여백크게=False):
    S = 크기
    축소 = 0.72 if 여백크게 else 1.0
    가운데 = 90.0
    # 좌표(위치)와 길이(크기)는 계산식이 다릅니다 — 같이 쓰면 두께가 망가집니다
    위치 = lambda v: round((가운데 + (v - 가운데) * 축소) * S / 180.0)
    길이 = lambda v: max(1, round(v * 축소 * S / 180.0))

    # 로봇 부위들: (왼쪽, 위, 오른쪽, 아래, 색)
    부위들 = [
        (위치(56), 위치(58), 위치(124), 위치(122), 로봇색),   # 몸통
        (위치(64), 위치(126), 위치(80), 위치(146), 로봇색),   # 왼쪽 다리
        (위치(100), 위치(126), 위치(116), 위치(146), 로봇색),  # 오른쪽 다리
        (위치(86), 위치(38), 위치(94), 위치(58), 로봇색),      # 안테나 기둥
        (위치(80), 위치(26), 위치(100), 위치(44), 로봇색),     # 안테나 머리
        (위치(96), 위치(78), 위치(114), 위치(94), 눈색),       # 눈
    ]

    줄들 = []
    for y in range(S):
        행 = bytearray([0])          # PNG는 각 줄 앞에 필터 바이트가 붙습니다
        for x in range(S):
            색 = 배경색
            for 좌, 상, 우, 하, 부위색 in 부위들:
                if 좌 <= x < 우 and 상 <= y < 하:
                    색 = 부위색
            행 += bytes(색)
        줄들.append(bytes(행))

    def 청크(종류, 자료):
        return (struct.pack(">I", len(자료)) + 종류 + 자료
                + struct.pack(">I", zlib.crc32(종류 + 자료) & 0xffffffff))

    return (b"\x89PNG\r\n\x1a\n"
            + 청크(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 2, 0, 0, 0))
            + 청크(b"IDAT", zlib.compress(b"".join(줄들), 9))
            + 청크(b"IEND", b""))


if __name__ == "__main__":
    폴더 = os.path.join(os.path.dirname(__file__), "..", "game", "icons")
    os.makedirs(폴더, exist_ok=True)
    만들목록 = [
        ("game-icon-180.png", 180, False),
        ("game-icon-152.png", 152, False),
        ("game-favicon-32.png", 32, False),
        ("game-icon-192.png", 192, False),
        ("game-icon-512.png", 512, False),
        ("game-icon-512-maskable.png", 512, True),
    ]
    for 이름, 크기, 여백 in 만들목록:
        with open(os.path.join(폴더, 이름), "wb") as f:
            자료 = 아이콘_그리기(크기, 여백)
            f.write(자료)
        print(f"{이름:30s} {크기:>4}x{크기:<4} {len(자료):>6,} bytes")
