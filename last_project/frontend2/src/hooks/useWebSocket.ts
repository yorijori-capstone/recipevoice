import { useState, useEffect, useCallback, useRef } from 'react';

interface Transcript {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export function useWebSocket() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentTranscriptRef = useRef<string>('');

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 🔧 직접 Backend 포트로 연결
    const wsUrl = 'ws://localhost:3001';
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Connected to backend WebSocket');
      setStatus('connected');
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'user_transcription':
            setTranscripts(prev => [...prev, {
              role: 'user',
              text: data.transcript,
              timestamp: new Date()
            }]);
            break;

          case 'assistant_transcript_delta':
            currentTranscriptRef.current += data.delta;
            break;

          case 'assistant_transcript_done':
            if (currentTranscriptRef.current) {
              setTranscripts(prev => [...prev, {
                role: 'assistant',
                text: currentTranscriptRef.current,
                timestamp: new Date()
              }]);
              currentTranscriptRef.current = '';
            }
            break;

          case 'audio_delta':
            const audioData = base64ToFloat32Array(data.audio);
            audioQueueRef.current.push(audioData);
            if (!isPlayingRef.current) {
              playAudioQueue();
            }
            break;

          // 🆕 VAD 모드 변경 확인
          case 'vad_mode_changed':
            console.log(`✅ VAD mode changed to: ${data.mode}`);
            break;

          case 'error':
            console.error('Error from server:', data.error);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('disconnected');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from backend');
      setStatus('disconnected');
      setIsConnected(false);
    };

    // Audio context setup
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

    return () => {
      ws.close();
      audioContextRef.current?.close();
    };
  }, []);

  const playAudioQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;
    const audioContext = audioContextRef.current;

    const audioBuffer = audioContext.createBuffer(1, audioData.length, 24000);
    audioBuffer.getChannelData(0).set(audioData);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      playAudioQueue();
    };

    source.start();
  }, []);

  const sendAudioChunk = useCallback((audioData: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio',
        audio: audioData
      }));
    }
  }, []);

  const startStreaming = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_streaming' }));
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_streaming' }));
    }
  }, []);

  // 🆕 VAD 모드 변경 함수
  const setVADMode = useCallback((mode: 'auto' | 'manual') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_vad_mode',
        mode
      }));
      console.log(`📤 VAD mode change requested: ${mode}`);
    }
  }, []);

  return {
    status,
    transcripts,
    isConnected,
    sendAudioChunk,
    startStreaming,
    stopStreaming,
    setVADMode  // 🆕 추가
  };
}

function base64ToFloat32Array(base64: string): Float32Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);

  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }

  return float32Array;
}