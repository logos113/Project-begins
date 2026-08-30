"""
홈 화면 아이콘 이미지를 만드는 프로그램입니다.

파이썬만으로 PNG 그림 파일을 직접 그립니다(외부 라이브러리 없음).
아이콘 디자인을 바꾸고 싶으면 아래 '색깔'과 '그리기' 부분을 고치면 됩니다.

실행:  python3 tools/make_icons.py
(아이패드에서는 실행할 수 없습니다. 필요하시면 Claude에게 부탁하세요.)
"""
import zlib, struct, os

# ---- 색깔 (원하는 색으로 바꿔보세요) ----
배경색   = (0x1c, 0x5d, 0x7a)   # 진한 청록
종이색   = (0xff, 0xff, 0xff)   # 흰색
글줄색   = (0x8f, 0xb6, 0xc7)   # 연한 청록
제목줄색 = (0x1c, 0x5d, 0x7a)   # 배경과 같은 진한 청록


def 아이콘_그리기(크기, 단순하게=False):
    """정사각형 아이콘 하나를 그려서 PNG 바이트로 돌려줍니다."""
    S = 크기
    # 모든 좌표를 '비율'로 계산해서 어떤 크기에도 같은 모양이 나오게 합니다
    비 = lambda v: v * S / 180.0

    종이_좌, 종이_상 = 비(38), 비(28)
    종이_우, 종이_하 = 비(142), 비(152)
    모서리 = 비(9)

    # 글줄 위치: (윗변, 오른쪽 끝) — 마지막 줄은 짧게 해서 문단처럼 보이게
    if 단순하게:   # 아주 작은 크기에서는 줄을 줄이고 굵게
        제목줄 = (비(44), 비(112), 비(12))
        글줄들 = [(비(70), 비(124), 비(12)), (비(94), 비(124), 비(12)), (비(118), 비(100), 비(12))]
    else:
        제목줄 = (비(42), 비(110), 비(9))
        글줄들 = [(비(60), 비(124), 비(8)), (비(80), 비(124), 비(8)),
                  (비(100), 비(124), 비(8)), (비(120), 비(100), 비(8))]
    글줄_좌 = 비(54)

    def 둥근사각형_안인가(x, y):
        if not (종이_좌 <= x <= 종이_우 and 종이_상 <= y <= 종이_하):
            return False
        # 네 모서리만 원으로 깎아냅니다
        가까운x = 종이_좌 + 모서리 if x < 종이_좌 + 모서리 else (종이_우 - 모서리 if x > 종이_우 - 모서리 else None)
        가까운y = 종이_상 + 모서리 if y < 종이_상 + 모서리 else (종이_하 - 모서리 if y > 종이_하 - 모서리 else None)
        if 가까운x is not None and 가까운y is not None:
            return (x - 가까운x) ** 2 + (y - 가까운y) ** 2 <= 모서리 ** 2
        return True

    줄들 = []
    for y in range(S):
        행 = bytearray([0])          # PNG는 각 줄 앞에 필터 바이트 1개가 붙습니다
        for x in range(S):
            색 = 배경색
            if 둥근사각형_안인가(x + 0.5, y + 0.5):
                색 = 종이색
                상, 우, 두께 = 제목줄
                if 상 <= y < 상 + 두께 and 글줄_좌 <= x < 우:
                    색 = 제목줄색
                for 상, 우, 두께 in 글줄들:
                    if 상 <= y < 상 + 두께 and 글줄_좌 <= x < 우:
                        색 = 글줄색
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
    폴더 = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(폴더, exist_ok=True)
    만들목록 = [
        ("apple-touch-icon-180.png", 180, False),   # 아이폰
        ("apple-touch-icon-167.png", 167, False),   # 아이패드 Pro
        ("apple-touch-icon-152.png", 152, False),   # 아이패드
        ("favicon-32.png", 32, True),               # 브라우저 탭
    ]
    for 이름, 크기, 단순 in 만들목록:
        자료 = 아이콘_그리기(크기, 단순)
        경로 = os.path.join(폴더, 이름)
        with open(경로, "wb") as f:
            f.write(자료)
        print(f"{이름:28s} {크기:>4}x{크기:<4} {len(자료):>6,} bytes")
