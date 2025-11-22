interface ControlPanelProps {
  isRecording: boolean;
  isConnected: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function ControlPanel({ isRecording, isConnected, onStart, onStop }: ControlPanelProps) {
  return (
    <div className="card mb-4">
      <div className="card-body text-center">
        {!isRecording ? (
          <button 
            className="btn btn-success btn-lg"
            onClick={onStart}
            disabled={!isConnected}
          >
            🎙️ Start Listening
          </button>
        ) : (
          <button 
            className="btn btn-danger btn-lg"
            onClick={onStop}
          >
            ⏹️ Stop Listening
          </button>
        )}
        <p className="mt-3 text-muted">
          {isRecording ? '🟢 말씀하시면 자동으로 응답합니다...' : '버튼을 눌러 시작하세요'}
        </p>
      </div>
    </div>
  );
}