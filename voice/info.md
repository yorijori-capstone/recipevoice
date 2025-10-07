### API

1. TTS (키보드로 반응)
   구글 TTS STT API 사용
   [g](http://googletts.py/)oogletts.py TTS API -> 환경변수 설정
   https://doa-oh.tistory.com/171
2. SST 다음 단계
   구글 STT API 사용
   발급받기 https://brunch.co.kr/@stopyeonee/16
   환경변수 설정 추가로 필요 X (기존 키 사용)

### Git

poetry add google-cloud-texttospeech pydub sounddevice soundfile google-cloud-speech

“ffmpeg 설치하기”

https://angelplayer.tistory.com/351

- TEST - API / 패키지 기능 확인용

  - simpleaudiotest.py
    - sounddevice 동작하는지
    - 필요 package: sounddevice
    - poetry add
  - [pydubtest.py](http://pydubtest.py) - ffmpeg 설치 확인
  - googletts.py : google tts api 확인
  - googlestt.py : google stt api 확인
  - stt_mic_test.py

- TTS - keyboard로 TTS 기능 확인
  - recipe_data.py: LLM 출력 예시
  - tts_player.py: google tts api로 출력
  - keyboard_listener: 일단 마이크 이용 STT 대신 keyboard로 tts 기능 확인해보기
  - main_tts.py → 이걸 실행하면 되요 poetry run python voice/TTS/main_tts.py
- STT_TTS
  - 추가 예정
