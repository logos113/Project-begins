"""
아침 브리핑 앱의 아이콘을 만드는 프로그램입니다. (오르는 꺾은선 그래프)
파이썬만으로 PNG 그림을 직접 그립니다 — 설치할 것이 없습니다.

실행:  python3 tools/make_icons_stocks.py
색을 바꾸고 싶으면 아래 '색' 부분을 고치세요.
"""
import zlib, struct, os

배경색 = (0x14, 0x53, 0x2d)   # 짙은 초록 (앱 강조색과 같은 색)
선색   = (0xff, 0xff, 0xff)   # 흰 꺾은선
점색   = (0x86, 0xef, 0xac)   # 연초록 점
바닥색 = (0x4a, 0x7c, 0x59)   # 기준선


def 캔버스_만들기(크기):
    """배경색으로 가득 찬 그림판을 만듭니다. [세로][가로] = (r,g,b)"""
    return [[배경색 for _ in range(크기)] for _ in range(크기)]


def 네모(판, 왼, 위, 오른, 아래, 색):
    크기 = len(판)
    for y in range(max(0, 위), min(크기, 아래)):
        for x in range(max(0, 왼), min(크기, 오른)):
            판[y][x] = 색


def 선긋기(판, x1, y1, x2, y2, 색, 굵기):
    """
    두 점을 잇습니다. 긴 쪽을 기준으로 한 칸씩 나아가며 점을 찍습니다.
    (브레젠험 같은 정식 알고리즘 대신, 읽기 쉬운 쪽을 택했습니다)
    """
    걸음 = max(abs(x2 - x1), abs(y2 - y1))
    if 걸음 == 0:
        걸음 = 1
    반 = 굵기 // 2
    for i in range(걸음 + 1):
        t = i / 걸음
        x = round(x1 + (x2 - x1) * t)
        y = round(y1 + (y2 - y1) * t)
        네모(판, x - 반, y - 반, x - 반 + 굵기, y - 반 + 굵기, 색)


def 동그라미(판, 중심x, 중심y, 반지름, 색):
    크기 = len(판)
    for y in range(max(0, 중심y - 반지름), min(크기, 중심y + 반지름 + 1)):
        for x in range(max(0, 중심x - 반지름), min(크기, 중심x + 반지름 + 1)):
            if (x - 중심x) ** 2 + (y - 중심y) ** 2 <= 반지름 ** 2:
                판[y][x] = 색


def 아이콘_그리기(크기, 여백크게=False):
    """
    180 칸짜리 그림을 기준으로 그린 뒤 원하는 크기로 줄입니다.

    ※ 좌표(위치)와 길이(크기)는 계산식이 다릅니다.
       같은 식을 쓰면 여백을 줄일 때 선 굵기가 같이 망가집니다.
    """
    S = 크기
    축소 = 0.70 if 여백크게 else 1.0   # maskable 은 가장자리가 잘리므로 작게
    가운데 = 90.0
    위치 = lambda v: round((가운데 + (v - 가운데) * 축소) * S / 180.0)
    길이 = lambda v: max(1, round(v * 축소 * S / 180.0))

    판 = 캔버스_만들기(S)

    # 기준선 (그래프 바닥)
    네모(판, 위치(30), 위치(132), 위치(150), 위치(132) + 길이(3), 바닥색)

    # 오르는 꺾은선 — 내렸다 크게 오르는 모양
    꼭짓점 = [(38, 112), (68, 122), (96, 78), (122, 92), (146, 46)]
    굵기 = 길이(9)
    for i in range(len(꼭짓점) - 1):
        x1, y1 = 꼭짓점[i]
        x2, y2 = 꼭짓점[i + 1]
        선긋기(판, 위치(x1), 위치(y1), 위치(x2), 위치(y2), 선색, 굵기)

    # 마지막 점을 강조 — '오늘 여기까지 왔다'
    동그라미(판, 위치(146), 위치(46), 길이(13), 점색)

    return 판


def png로_저장(판, 파일이름):
    """
    PNG 파일을 직접 만듭니다.

    PNG 는 '덩어리(chunk)' 를 이어 붙인 모양입니다.
      IHDR  그림 크기 같은 머리말
      IDAT  실제 그림 (zlib 으로 압축)
      IEND  끝 표시
    각 덩어리 뒤에는 CRC(오류 검사용 숫자)가 붙습니다.
    """
    크기 = len(판)
    원본 = bytearray()
    for y in range(크기):
        원본.append(0)                      # 줄마다 맨 앞에 '필터 없음(0)'
        for x in range(크기):
            원본.extend(판[y][x])

    def 덩어리(종류, 내용):
        return (struct.pack(">I", len(내용)) + 종류 + 내용
                + struct.pack(">I", zlib.crc32(종류 + 내용) & 0xFFFFFFFF))

    머리말 = struct.pack(">IIBBBBB", 크기, 크기, 8, 2, 0, 0, 0)   # 8비트, 트루컬러
    파일 = (b"\x89PNG\r\n\x1a\n"
            + 덩어리(b"IHDR", 머리말)
            + 덩어리(b"IDAT", zlib.compress(bytes(원본), 9))
            + 덩어리(b"IEND", b""))

    os.makedirs(os.path.dirname(파일이름), exist_ok=True)
    with open(파일이름, "wb") as f:
        f.write(파일)
    print(f"  {파일이름}  ({len(파일):,} 바이트)")


여기 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
아이콘폴더 = os.path.join(여기, "stocks", "icons")

만들것 = [
    ("favicon-32.png", 32, False),
    ("apple-touch-icon-152.png", 152, False),
    ("apple-touch-icon-180.png", 180, False),
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-512-maskable.png", 512, True),   # 가장자리가 잘리므로 여백을 크게
]

print("아침 브리핑 아이콘을 만듭니다")
for 이름, 크기, 여백크게 in 만들것:
    png로_저장(아이콘_그리기(크기, 여백크게), os.path.join(아이콘폴더, 이름))
print("끝났습니다")
