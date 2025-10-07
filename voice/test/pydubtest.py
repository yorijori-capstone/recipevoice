import os
from pydub import AudioSegment

# 1️⃣ 무음 1초 생성 (wav 포맷)
audio = AudioSegment.silent(duration=1000)  # 1초
output_file = "test_output.wav"
audio.export(output_file, format="wav")
print(f"✅ ffmpeg 정상 동작: {output_file} 생성됨")

# 2️⃣ 파일 삭제
if os.path.exists(output_file):
    os.remove(output_file)
    print(f"🗑️ {output_file} 파일 삭제 완료")
