import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { StatusDisplay } from '../components/VoiceAgent/StatusDisplay';
import { TranscriptView } from '../components/VoiceAgent/TranscriptView';
import { ControlPanel } from '../components/VoiceAgent/ControlPanel';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

export default function VoiceTest() {
  const { 
    status, 
    transcripts, 
    sendAudioChunk, 
    startStreaming: wsStartStreaming,
    stopStreaming: wsStopStreaming,
    isConnected,
    setVADMode  // 🆕 추가
  } = useWebSocket();
  
  const { isStreaming, startStreaming, stopStreaming } = useAudioRecorder(
    (pcm16Base64: string) => sendAudioChunk(pcm16Base64)
  );

  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [pressStartTime, setPressStartTime] = useState<number | null>(null);

  // 🆕 모드 변경 시 서버에 알림
  useEffect(() => {
    if (isConnected) {
      const mode = isPushToTalk ? 'manual' : 'auto';
      setVADMode(mode);
      console.log(`🎤 Mode changed to: ${mode}`);
    }
  }, [isPushToTalk, isConnected, setVADMode]);

  const handleStart = () => {
    wsStartStreaming();
    startStreaming();
  };

  const handleStop = () => {
    wsStopStreaming();
    stopStreaming();
  };

  const handlePushStart = () => {
    if (!isPressing) {
      setIsPressing(true);
      setPressStartTime(Date.now()); // 🆕 시작 시간 기록
      wsStartStreaming();
      startStreaming();
      console.log('🎤 Push button pressed - recording started');
    }
  };

  const handlePushStop = () => {
    if (isPressing) {
      const recordingDuration = pressStartTime ? Date.now() - pressStartTime : 0;
      console.log(`⏱️ Recording duration: ${recordingDuration}ms`);
      
      // 🆕 최소 300ms 이상 녹음했는지 확인
      if (recordingDuration < 300) {
        console.warn('⚠️ Recording too short, minimum 300ms required');
        // 짧게 눌렀을 경우 경고 표시 (선택사항)
        alert('너무 짧게 녹음했습니다. 최소 0.3초 이상 버튼을 누르고 계세요.');
        setIsPressing(false);
        stopStreaming();
        wsStopStreaming();
        return;
      }
      
      setIsPressing(false);
      setPressStartTime(null);
      stopStreaming();
      wsStopStreaming();
      console.log('🛑 Push button released - audio sent');
    }
  };

  const handleModeChange = (pushToTalk: boolean) => {
    // 녹음 중이면 중지
    if (isStreaming) {
      handleStop();
    }
    setIsPushToTalk(pushToTalk);
  };

  return (
    <>
      <Navbar />
      <div className="container mb-5">
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-8">
            
            <div className="text-center mb-4">
              <h1 className="display-5 mb-2">🎤 음성 대화 테스트</h1>
              <p className="text-muted">AI와 실시간으로 대화해보세요</p>
            </div>

            {/* 모드 선택 */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="card-title mb-3">녹음 모드 선택</h5>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="recordingMode"
                    id="autoMode"
                    checked={!isPushToTalk}
                    onChange={() => handleModeChange(false)}
                  />
                  <label className="form-check-label" htmlFor="autoMode">
                    <strong>🤖 자동 모드 (VAD)</strong>
                    <br />
                    <small className="text-muted">
                      말을 시작하면 자동 녹음, 침묵 감지 시 자동 전송
                    </small>
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="recordingMode"
                    id="pushToTalkMode"
                    checked={isPushToTalk}
                    onChange={() => handleModeChange(true)}
                  />
                  <label className="form-check-label" htmlFor="pushToTalkMode">
                    <strong>🎤 수동 모드 (Push-to-Talk)</strong>
                    <br />
                    <small className="text-muted">
                      버튼을 누르고 있는 동안만 녹음 (배경 소음 차단)
                    </small>
                  </label>
                </div>
              </div>
            </div>

            {/* 사용법 안내 */}
            <div className="alert alert-info mb-4">
              <div className="d-flex align-items-start">
                <div className="me-2">💡</div>
                <div>
                  <strong>사용법:</strong>
                  <ul className="mb-0 mt-2">
                    {!isPushToTalk ? (
                      <>
                        <li>"Start Listening" 버튼을 클릭하세요</li>
                        <li>마이크에 대고 한국어로 말씀하세요</li>
                        <li>말을 멈추면 약 0.7초 후 AI가 자동으로 응답합니다</li>
                        <li>계속해서 대화할 수 있습니다</li>
                      </>
                    ) : (
                      <>
                        <li>"누르고 말하기" 버튼을 <strong>누르고 있는 동안</strong> 녹음됩니다</li>
                        <li>마이크에 대고 한국어로 말씀하세요</li>
                        <li>버튼을 떼면 즉시 AI에게 전송됩니다</li>
                        <li>배경 소음이 있는 환경에서 유용합니다</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <StatusDisplay 
              connectionStatus={status} 
              isRecording={isStreaming} 
            />

            {/* 컨트롤 패널 */}
            {!isPushToTalk ? (
              <ControlPanel
                isRecording={isStreaming}
                isConnected={isConnected}
                onStart={handleStart}
                onStop={handleStop}
              />
            ) : (
              <div className="card mb-4">
                <div className="card-body text-center">
                  <button
                    className={`btn btn-lg ${isPressing ? 'btn-danger' : 'btn-primary'}`}
                    onMouseDown={handlePushStart}
                    onMouseUp={handlePushStop}
                    onMouseLeave={handlePushStop}
                    onTouchStart={handlePushStart}
                    onTouchEnd={handlePushStop}
                    disabled={!isConnected}
                    style={{ minWidth: '200px', minHeight: '80px' }}
                  >
                    {isPressing ? (
                      <>
                        <span className="fs-3">🔴</span>
                        <br />
                        <strong>녹음 중...</strong>
                        <br />
                        <small>버튼을 떼면 전송</small>
                      </>
                    ) : (
                      <>
                        <span className="fs-3">🎤</span>
                        <br />
                        <strong>누르고 말하기</strong>
                        <br />
                        <small>클릭하고 유지</small>
                      </>
                    )}
                  </button>
                  
                  {isPressing && (
                    <div className="mt-3">
                      <div className="spinner-grow spinner-grow-sm text-danger me-2" role="status"></div>
                      <span className="text-danger fw-bold">녹음 중입니다...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <TranscriptView transcripts={transcripts} />

          </div>
        </div>
      </div>
    </>
  );
}