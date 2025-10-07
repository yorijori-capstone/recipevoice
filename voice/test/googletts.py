# google tts api 설치 여부 확인
from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient()

synthesis_input = texttospeech.SynthesisInput(text = 'Hello, World!')

voice = texttospeech.VoiceSelectionParams(language_code = "en-US", ssml_gender = texttospeech.SsmlVoiceGender.NEUTRAL)

audio_config = texttospeech.AudioConfig(audio_encoding = texttospeech.AudioEncoding.MP3)

response = client.synthesize_speech(input=synthesis_input, voice = voice, audio_config=audio_config)

with open('output.mp3', 'wb') as out:
    out.write(response.audio_content)
    print('Audio content written to file "output.mp3"')