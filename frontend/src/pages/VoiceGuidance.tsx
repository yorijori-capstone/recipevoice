import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

const stripMarkdown = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/(^|\n)[>*+-]\s+/g, ' ')
    .replace(/#+\s*/g, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const VoiceGuidance = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const splitIndex = result.indexOf(',');
          const base64 = splitIndex >= 0 ? result.slice(splitIndex + 1) : result;
          resolve(base64);
        } else {
          reject(new Error('Failed to read audio data.'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio data.'));
      reader.readAsDataURL(blob);
    });

  const sendVoiceCommand = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('Empty audio blob received.');
      return;
    }

    setIsLoading(true);
    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const response = await fetch('/api/recipes/voice/control/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recognize_command', audio_base64: audioBase64 }),
      });

      const data = await response.json();
      const recognizedText = data?.recognized_text || '음성 명령을 인식하지 못했습니다.';
      setChatHistory(prev => [...prev, { sender: 'user', text: recognizedText }]);

      if (!response.ok) {
        throw new Error(data?.error || '음성 명령 처리 중 오류가 발생했습니다.');
      }

      if (data.text) {
        setChatHistory(prev => [...prev, { sender: 'agent', text: data.text }]);
      } else if (data.error) {
        setChatHistory(prev => [...prev, { sender: 'agent', text: data.error }]);
      }
    } catch (error) {
      console.error('Voice command processing failed:', error);
      setChatHistory(prev => [...prev, { sender: 'agent', text: '음성 명령을 처리하지 못했습니다. 다시 시도해 주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Agent Communication ---
  const sendMessageToAgent = async (message: string) => {
    if (!message.trim()) return;

    const requestChatHistory = JSON.stringify([
      ...chatHistory,
      { sender: 'user', text: message },
    ]);

    setIsLoading(true);
    setChatHistory(prev => [...prev, { sender: 'user', text: message }]);

    try {
      const response = await fetch('/api/recipes/voice/agent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: message, chat_history: requestChatHistory }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      
      const data = await response.json();
      setChatHistory(prev => [...prev, { sender: 'agent', text: data.output }]);

    } catch (error) {
      console.error("Agent communication failed:", error);
      setChatHistory(prev => [...prev, { sender: 'agent', text: "죄송합니다, 오류가 발생했어요." }]);
    } finally {
      setIsLoading(false);
      setUserInput('');
    }
  };

  // --- Initial Greeting ---
  useEffect(() => {
    // Start the conversation by asking the agent to introduce itself and mention the recipe.
    sendMessageToAgent(`레시피 ID ${id} 요리를 시작하고 싶어. 먼저 인사하고, 이 레시피가 무엇인지 간단히 소개해줘.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // --- UI Effects ---
  useEffect(() => {
    // Scroll to the bottom of the chat container when new messages are added
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      console.warn('Speech Synthesis API is not available in this browser.');
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!synthRef.current || chatHistory.length === 0) return;
    const lastMessage = chatHistory[chatHistory.length - 1];
    if (lastMessage.sender !== 'agent') return;

    const plainText = stripMarkdown(lastMessage.text);
    if (!plainText) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'ko-KR';
    synthRef.current.speak(utterance);
  }, [chatHistory]);

  // --- STT (Voice Recording) ---
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
            if (event.data.size > 0) recordedChunksRef.current.push(event.data);
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            console.log("녹음된 오디오 크기:", audioBlob.size);
            stream.getTracks().forEach(track => track.stop());
            void sendVoiceCommand(audioBlob);
          };

          mediaRecorder.start();
          setIsRecording(true);
        })
        .catch(error => {
          console.error("Error accessing microphone:", error);
          alert("마이크에 접근할 수 없습니다.");
        });
    }
  };

  const handleTextInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageToAgent(userInput);
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h3>요리 대화</h3>
          <button className="btn btn-sm btn-outline-danger" onClick={() => navigate('/')}>
            안내 종료
          </button>
        </div>
        
        <div ref={chatContainerRef} className="card-body" style={{ height: '500px', overflowY: 'auto' }}>
          {chatHistory.map((msg, index) => (
            <div key={index} className={`mb-3 ${msg.sender === 'user' ? 'text-end' : 'text-start'}`}>
              <span className={`badge ${msg.sender === 'user' ? 'bg-primary' : 'bg-secondary'}`}>
                {msg.sender === 'user' ? '나' : '요리사'}
              </span>
              <div className={`p-2 rounded d-inline-block ${msg.sender === 'user' ? 'bg-light' : 'bg-light'}`} style={{ maxWidth: '80%' }}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <div className="text-center"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">...</span></div></div>}
        </div>

        <div className="card-footer">
          <form onSubmit={handleTextInputSubmit} className="d-flex gap-2">
            <input
              type="text"
              className="form-control"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isLoading ? "요리사가 응답하는 중..." : "메시지 입력..."}
              disabled={isLoading}
            />
            <button type="submit" className="btn btn-primary" disabled={isLoading}>전송</button>
            <button type="button" className={`btn ${isRecording ? 'btn-danger' : 'btn-info'}`} onClick={handleToggleRecording} disabled={isLoading}>
              {isRecording ? '녹음중지' : '음성'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
