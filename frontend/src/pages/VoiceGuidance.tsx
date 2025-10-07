
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Helper to play base64 encoded audio
const playAudio = (base64String: string, audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
  if (audioRef.current) {
    audioRef.current.pause();
  }
  const audio = new Audio(`data:audio/mpeg;base64,${base64String}`);
  audioRef.current = audio;
  audio.play();
  return audio;
};

export const VoiceGuidance = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [isPlanning, setIsPlanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const handleToggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          recordedChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const base64String = reader.result?.toString().split(',')[1];
              if (base64String) {
                sendVoiceAction('recognize_command', { audio_base64: base64String });
              }
            };
            stream.getTracks().forEach(track => track.stop()); // Stop microphone access
          };

          mediaRecorder.start();
          setIsRecording(true);
        })
        .catch(error => console.error("Error accessing microphone:", error));
    }
  };

  const sendVoiceAction = async (action: string, payload: object = {}) => {
    if (action !== 'start') setIsLoading(true);

    if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
    }

    try {
      const response = await fetch('/api/recipes/voice/control/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      
      if (action === 'stop') {
        navigate('/');
        return;
      }

      const data = await response.json();
      // Assuming the backend returns the full script and current index
      setSteps(data.steps || []);
      setCurrentStepIndex(data.current_step_index || 0);

      if (data.audio_base64) {
        const audio = playAudio(data.audio_base64, audioRef);
        setIsPlaying(true);
        audio.onended = () => {
          setIsPlaying(false);
          if ((action === 'start' || action === 'next') && currentStepIndex < steps.length - 1) {
            sendVoiceAction('next');
          }
        };
      }
    } catch (error) {
      console.error("Voice control action failed:", error);
      setSteps(["오류가 발생했습니다. 잠시 후 다시 시도해주세요."]);
      setCurrentStepIndex(0);
    } finally {
      setIsLoading(false);
      if (action === 'start') setIsPlanning(false);
    }
  };

  useEffect(() => {
    sendVoiceAction('start', { recipe_id: id });
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePlayPause = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      sendVoiceAction('repeat');
    }
  };

  if (isPlanning) {
    return (
        <div className="d-flex justify-content-center align-items-center" style={{height: "100vh"}}>
            <div className="text-center">
                <h2>음성 안내를 준비 중입니다...</h2>
                <div className="spinner-border mt-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="card text-center">
        <div className="card-header"><h3>레시피 안내</h3></div>
        <div className="card-body" style={{ minHeight: '200px' }}>
          {steps.map((step, index) => (
            <p 
              key={index} 
              className={`card-text fs-4 ${index === currentStepIndex ? 'p-3 rounded' : ''}`}
              style={{ backgroundColor: index === currentStepIndex ? 'yellow' : 'transparent' }}
            >
              {step}
            </p>
          ))}
        </div>
        <div className="card-footer d-flex justify-content-center align-items-center gap-3">
          <button className="btn btn-secondary" onClick={() => sendVoiceAction('prev')} disabled={isLoading}>이전</button>
          <button className="btn btn-primary btn-lg" onClick={handlePlayPause} disabled={isLoading || !audioRef.current}>
            {isPlaying ? '⏸️ 멈춤' : '▶️ 재생'}
          </button>
          <button className={`btn btn-lg ${isRecording ? 'btn-danger' : 'btn-info'}`} onClick={handleToggleRecording} disabled={isLoading}>
            {isRecording ? '🛑 녹음 중지' : '🎤 음성 명령'}
          </button>
          <button className="btn btn-secondary" onClick={() => sendVoiceAction('next')} disabled={isLoading}>다음</button>
        </div>
        <div className="card-footer">
          <button className="btn btn-danger" onClick={() => sendVoiceAction('stop')}>레시피 음성 안내 종료하기</button>
        </div>
      </div>
    </div>
  );
};
