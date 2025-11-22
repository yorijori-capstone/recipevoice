import { ConnectionStatus } from '../../types/voice';

interface StatusDisplayProps {
  connectionStatus: ConnectionStatus;
  isRecording: boolean;
}

export function StatusDisplay({ connectionStatus, isRecording }: StatusDisplayProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'danger';
      default: return 'secondary';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '연결됨';
      case 'connecting': return '연결 중...';
      case 'error': return '연결 실패';
      default: return '연결 안 됨';
    }
  };

  return (
    <div className="card mb-3 shadow-sm">
      <div className="card-body">
        <div className="row text-center">
          <div className="col-md-6 mb-3 mb-md-0">
            <h6 className="text-muted mb-2">
              <i className="bi bi-wifi"></i> 연결 상태
            </h6>
            <span className={`badge bg-${getStatusColor()} fs-6 px-3 py-2`}>
              {getStatusText()}
            </span>
          </div>
          <div className="col-md-6">
            <h6 className="text-muted mb-2">
              <i className="bi bi-mic"></i> 마이크 상태
            </h6>
            <span className={`badge ${isRecording ? 'bg-danger' : 'bg-secondary'} fs-6 px-3 py-2`}>
              {isRecording ? (
                <>
                  <span className="spinner-grow spinner-grow-sm me-2" role="status"></span>
                  듣고 있음
                </>
              ) : (
                '대기 중'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}