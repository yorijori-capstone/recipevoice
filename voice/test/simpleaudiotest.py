import sounddevice as sd
import soundfile as sf

file_path = r"C:\빅종설\test\Free_Test_Data_500KB_WAV.wav"  # ✅ Raw string으로 수정
data, samplerate = sf.read(file_path, dtype="float32")      # 파일 읽기
sd.play(data, samplerate)
sd.wait()
print("done")
