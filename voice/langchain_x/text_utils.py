# text_utils.py
import re

def normalize_text(text: str) -> str:
    """
    음성 인식 결과를 정규화:
    - 불필요한 조사/어미/감탄사 제거
    - 문장부호 제거
    - 소문자 변환 및 공백 정리
    """
    text = text.lower().strip()
    text = re.sub(r"[?.!,]", "", text)

    # 불필요한 조사/어미 제거
    text = re.sub(r"(을|를|이|가|은|는|에|로|에서|의|과|와|한테|에게)$", "", text)
    text = re.sub(r"(했어요|해요|해줘|줘|지|죠|했지|였지|야|요|다)$", "", text)

    # 감탄사/접두사 제거
    text = re.sub(r"^(어|아|야|이봐|저기|그|그래|고마워|아니|음|어머|자|자자)\s*", "", text)

    # 공백 정리
    text = re.sub(r"\s+", " ", text).strip()

    return text
