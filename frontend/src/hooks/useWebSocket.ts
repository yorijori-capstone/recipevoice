import { useState, useCallback, useRef } from 'react';

interface Transcript {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface UseWebSocketOptions {
  onUserTranscription?: (text: string) => void;
  onAssistantTranscript?: (text: string) => void;
  onFunctionCall?: (name: string, callId: string, args: any) => void;
  onError?: (error: string) => void;
  // V2 events
  onLangChainResponse?: (result: any) => void;
  onStepChanged?: (data: any) => void;
  onSessionStateUpdated?: (data: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentTranscriptRef = useRef<string>('');

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

  const connect = useCallback((sessionId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('⚠️ [useWebSocket] Already connected - skipping connect()');
      return;
    }

    console.log(`🔌 [useWebSocket] connect() called with sessionId: ${sessionId}`);
    setStatus('connecting');
    const wsUrl = 'ws://localhost:3001';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [useWebSocket] Connected to backend WebSocket');
      setStatus('connected');
      setIsConnected(true);
      setError(null);

      // Initialize session with context
      if (sessionId) {
        ws.send(JSON.stringify({
          type: 'init_session',
          sessionId
        }));
        console.log(`📤 [useWebSocket] Sent init_session with sessionId: ${sessionId}`);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'user_transcription':
            const userText = data.transcript;
            setTranscripts(prev => [...prev, {
              role: 'user',
              text: userText,
              timestamp: new Date()
            }]);
            // Call callback if provided
            if (options.onUserTranscription) {
              options.onUserTranscription(userText);
            }
            break;

          case 'assistant_transcript_delta':
            currentTranscriptRef.current += data.delta;
            // Call callback with accumulated text
            if (options.onAssistantTranscript) {
              options.onAssistantTranscript(currentTranscriptRef.current);
            }
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

          case 'vad_mode_changed':
            console.log(`✅ VAD mode changed to: ${data.mode}`);
            break;

          case 'function_call':
            console.log(`🔧 [useWebSocket] Function call: ${data.name}`);
            if (options.onFunctionCall) {
              options.onFunctionCall(data.name, data.call_id, data.arguments);
            }
            break;

          case 'error':
            console.error('Error from server:', data.error);
            setError(data.error);
            if (options.onError) {
              options.onError(data.error);
            }
            break;

          case 'langchain_response':
            console.log('🧠 [useWebSocket] LangChain response:', data.result);
            if (options.onLangChainResponse) {
              options.onLangChainResponse(data.result);
            }
            break;

          case 'step_changed':
            console.log('🔄 [useWebSocket] Step changed:', data);
            if (options.onStepChanged) {
              options.onStepChanged(data);
            }
            break;

          case 'session_state_updated':
            console.log('📊 [useWebSocket] Session state updated:', data);
            if (options.onSessionStateUpdated) {
              options.onSessionStateUpdated(data);
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
        setError('Failed to parse message from server');
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setStatus('disconnected');
      setIsConnected(false);
      const errorMsg = 'WebSocket connection error';
      setError(errorMsg);
      if (options.onError) {
        options.onError(errorMsg);
      }
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from backend');
      setStatus('disconnected');
      setIsConnected(false);
    };

    // Audio context setup
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
  }, [options, playAudioQueue]);

  const disconnect = useCallback(() => {
    console.log('🔌 [useWebSocket] disconnect() called');
    if (wsRef.current) {
      console.log(`🔌 [useWebSocket] Closing WebSocket (readyState: ${wsRef.current.readyState})`);
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus('disconnected');
    setIsConnected(false);
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
      console.log('📤 Start streaming requested');
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_streaming' }));
      console.log('📤 Stop streaming requested');
    }
  }, []);

  const setVadMode = useCallback((vadMode: 'server_vad' | 'none') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_vad_mode',
        mode: vadMode
      }));
      console.log(`📤 VAD mode change requested: ${vadMode}`);
    } else {
      console.warn('⚠️ Cannot set VAD mode: WebSocket not connected');
    }
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_text',
        text
      }));
      console.log(`📤 [useWebSocket] Sending text message: ${text}`);
    } else {
      console.warn('⚠️ Cannot send text: WebSocket not connected');
    }
  }, []);

  return {
    status,
    transcripts,
    isConnected,
    error,
    connect,
    disconnect,
    sendAudioChunk,
    startStreaming,
    stopStreaming,
    setVadMode,
    sendTextMessage
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
