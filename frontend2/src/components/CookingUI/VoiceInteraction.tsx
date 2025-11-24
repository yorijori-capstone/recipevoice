import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface VoiceInteractionProps {
  sessionId: string;
  currentStepIndex: number;
  plannedSteps: any[];
  onCommandDetected?: (command: string) => void;
  onStepAutoChanged?: (data: any) => void;  // V3: Auto step change from MCP Tool
  onSessionStateUpdated?: (data: any) => void;  // V3: Session state sync
}

export interface VoiceInteractionRef {
  speakMessage: (message: string) => void;
  sendTimerState: (timerState: {
    isRunning: boolean;
    isCompleted: boolean;
    remainingTime: number;
    totalTime: number;
  }) => void;
}

export const VoiceInteraction = forwardRef<VoiceInteractionRef, VoiceInteractionProps>(({
  sessionId,
  currentStepIndex,
  plannedSteps,
  onCommandDetected,
  onStepAutoChanged,
  onSessionStateUpdated,
}, ref) => {
  const [voiceMode, setVoiceMode] = useState<'none' | 'auto'>('none');
  const [transcripts, setTranscripts] = useState<Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>>([]);

  const {
    isConnected,
    error: wsError,
    connect,
    disconnect,
    sendAudioChunk,
    setVadMode,
    sendTextMessage,
    sendTimerState,
  } = useWebSocket({
    onUserTranscription: (text) => {
      setTranscripts((prev) => [...prev, { role: 'user', text, timestamp: new Date() }]);

      // V3: Navigation commands are handled by MCP Tool (AI decides)
      // Only detect timer commands for local UI control
      const lowerText = text.toLowerCase();

      // Timer commands (사용자 음성 명령어로 직접 제어 - 로컬 UI)
      if (
        lowerText.includes('타이머 시작') ||
        lowerText.includes('타이머 시켜') ||
        lowerText.includes('타이머 설정') ||
        lowerText.includes('start timer')
      ) {
        onCommandDetected?.('start_timer');
      } else if (
        lowerText.includes('타이머 멈춰') ||
        lowerText.includes('타이머 정지') ||
        lowerText.includes('stop timer')
      ) {
        onCommandDetected?.('stop_timer');
      } else if (
        lowerText.includes('타이머 초기화') ||
        lowerText.includes('타이머 리셋') ||
        lowerText.includes('reset timer')
      ) {
        onCommandDetected?.('reset_timer');
      }
    },
    onFunctionCall: (name) => {
      console.log(`🔧 [VoiceInteraction] Function call: ${name}`);
      // AI가 자동으로 타이머 제어
      if (name === 'start_timer') {
        onCommandDetected?.('start_timer');
      } else if (name === 'stop_timer') {
        onCommandDetected?.('stop_timer');
      }
    },
    onAssistantTranscript: (text) => {
      setTranscripts((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex >= 0 && prev[lastIndex].role === 'assistant') {
          // Update existing assistant transcript
          const updated = [...prev];
          updated[lastIndex] = { role: 'assistant', text, timestamp: prev[lastIndex].timestamp };
          return updated;
        } else {
          // Add new assistant transcript
          return [...prev, { role: 'assistant', text, timestamp: new Date() }];
        }
      });
    },
    // V3 event handlers (MCP Tool Calling)
    onToolExecuted: ({ tool, result }) => {
      console.log('🔧 [VoiceInteraction] MCP Tool executed:', tool, result);

      // Handle navigation tools
      if (tool === 'navigate_next_step' || tool === 'navigate_previous_step' || tool === 'navigate_to_step') {
        console.log(`✨ [VoiceInteraction] Navigation tool executed: ${tool}`);
        onStepAutoChanged?.(result);
      }
      // Handle timer tools
      else if (tool === 'start_timer') {
        console.log('⏱️ [VoiceInteraction] Timer started via MCP');
        onCommandDetected?.('start_timer');
      } else if (tool === 'stop_timer') {
        console.log('⏱️ [VoiceInteraction] Timer stopped via MCP');
        onCommandDetected?.('stop_timer');
      }
    },
    onStepChanged: (data) => {
      console.log('🔄 [VoiceInteraction] Step changed event:', data);
      onStepAutoChanged?.(data);
    },
    onSessionStateUpdated: (data) => {
      console.log('📊 [VoiceInteraction] Session state updated:', data);
      onSessionStateUpdated?.(data);
    },
  });

  // Audio recorder hook
  const { isStreaming, startStreaming, stopStreaming } = useAudioRecorder((audioData) => {
    if (isConnected) {
      sendAudioChunk(audioData);
    }
  });

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    speakMessage: (message: string) => {
      console.log(`🔊 [VoiceInteraction] Speaking message: ${message}`);
      sendTextMessage(message);
      // Add to transcripts as assistant message
      setTranscripts((prev) => [...prev, {
        role: 'assistant',
        text: message,
        timestamp: new Date()
      }]);
    },
    sendTimerState: (timerState: {
      isRunning: boolean;
      isCompleted: boolean;
      remainingTime: number;
      totalTime: number;
    }) => {
      console.log(`⏱️ [VoiceInteraction] Sending timer state to backend:`, timerState);
      sendTimerState(timerState);
    }
  }), [sendTextMessage, sendTimerState]);

  // Connect on mount with sessionId (only once)
  useEffect(() => {
    console.log(`🔌 [VoiceInteraction] Mounting component with sessionId: ${sessionId}`);
    connect(sessionId);

    return () => {
      console.log('🔌 [VoiceInteraction] Cleanup function called - component unmounting');
      disconnect();
      if (isStreaming) {
        stopStreaming();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Update VAD mode when voice mode changes
  useEffect(() => {
    if (isConnected && voiceMode !== 'none') {
      const vadMode = voiceMode === 'auto' ? 'server_vad' : 'none';
      console.log(`🔧 Setting VAD mode to: ${vadMode} (voiceMode: ${voiceMode})`);
      setVadMode(vadMode);
    }
  }, [voiceMode, isConnected]);

  // Auto-start/stop audio streaming based on mode
  useEffect(() => {
    if (!isConnected) return;

    if (voiceMode === 'auto' && !isStreaming) {
      console.log('🎤 Auto mode activated - starting streaming');
      startStreaming();
    } else if (voiceMode === 'none' && isStreaming) {
      console.log('⏹️ Voice mode deactivated - stopping streaming');
      stopStreaming();
    }
  }, [isConnected, voiceMode]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0">🎙️ 음성 대화</h5>
          <span className={`badge ${isConnected ? 'bg-success' : 'bg-secondary'}`}>
            {isConnected ? '✅ 연결됨' : '⏳ 연결 중...'}
          </span>
        </div>

        {/* V3: Simple ON/OFF Toggle (Manual mode removed) */}
        <button
          type="button"
          className={`btn w-100 ${voiceMode === 'auto' ? 'btn-success' : 'btn-outline-primary'}`}
          onClick={() => setVoiceMode(voiceMode === 'auto' ? 'none' : 'auto')}
          disabled={!isConnected}
        >
          {voiceMode === 'auto' ? '🎤 음성 대화 ON' : '🔇 음성 대화 OFF'}
        </button>

        {voiceMode === 'none' && (
          <div className="alert alert-info mt-2 mb-0" style={{ fontSize: '0.9rem' }}>
            💡 버튼을 눌러 음성 대화를 시작하세요
          </div>
        )}
      </div>

      <div className="card-body">
        {/* Connection Error */}
        {wsError && (
          <div className="alert alert-danger">
            <strong>연결 오류:</strong> {wsError}
          </div>
        )}

        {/* Transcript Display */}
        <div
          className="border rounded p-3 mb-3"
          style={{
            height: '400px',
            overflowY: 'auto',
            backgroundColor: '#f8f9fa',
          }}
          ref={(el) => {
            if (el) {
              el.scrollTop = el.scrollHeight;
            }
          }}
        >
          {transcripts.length === 0 ? (
            <div className="text-center py-5">
              <div className="text-muted mb-3">
                {voiceMode === 'none'
                  ? '💬 음성 대화를 시작하려면 위 버튼을 눌러주세요'
                  : (
                    <div>
                      <div className="mb-2">🎤 말씀하시면 자동으로 인식됩니다</div>
                      <div className="alert alert-success py-2 px-3 d-inline-block">
                        <strong>👋 "안녕"</strong>이라고 인사해서 요리를 시작하세요!
                      </div>
                    </div>
                  )}
              </div>
              <small className="text-muted">대화 내역이 여기에 표시됩니다</small>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {transcripts.map((transcript, index) => (
                <div
                  key={index}
                  className={`d-flex ${transcript.role === 'user' ? 'justify-content-end' : 'justify-content-start'
                    }`}
                >
                  <div
                    className={`p-3 rounded shadow-sm ${transcript.role === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-white border'
                      }`}
                    style={{
                      maxWidth: '80%',
                      wordWrap: 'break-word'
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <strong className="text-uppercase" style={{ fontSize: '0.75rem' }}>
                        {transcript.role === 'user' ? '👤 사용자' : '🤖 AI 요리 가이드'}
                      </strong>
                      <small className="opacity-75" style={{ fontSize: '0.7rem' }}>
                        {transcript.timestamp.toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </small>
                    </div>
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                      {transcript.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto Mode Status */}
        {voiceMode === 'auto' && (
          <div className="text-center">
            <div className="text-success">
              <i className="bi bi-mic-fill fs-1"></i>
            </div>
            <div className="text-muted mt-2">
              자동 음성 감지 모드 활성화
              <br />
              <small>말씀하시면 자동으로 인식됩니다</small>
            </div>
          </div>
        )}

        {/* Current Step Context */}
        <div className="mt-3 p-2 bg-light rounded">
          <small className="text-muted">
            <strong>💡 현재 단계:</strong> {currentStepIndex + 1} / {plannedSteps.length}
          </small>
        </div>
      </div>
    </div>
  );
});
