import { useEffect, useRef } from 'react';
import { TranscriptItem } from '../../types/voice';

interface TranscriptViewProps {
  transcripts: TranscriptItem[];
}

export function TranscriptView({ transcripts }: TranscriptViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 추가될 때마다 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="card">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">💬 대화 내역</h5>
      </div>
      <div 
        className="card-body" 
        style={{ 
          maxHeight: '500px', 
          overflowY: 'auto',
          backgroundColor: '#f8f9fa'
        }}
      >
        {transcripts.length === 0 ? (
          <div className="text-center text-muted py-5">
            <p className="mb-0">아직 대화가 없습니다.</p>
            <small>"Start Listening"을 눌러 대화를 시작하세요.</small>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {transcripts.map((item, idx) => (
              <div 
                key={idx} 
                className={`d-flex ${item.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div 
                  className={`${
                    item.role === 'user' 
                      ? 'bg-primary text-white' 
                      : 'bg-white border'
                  } rounded-3 p-3 shadow-sm`}
                  style={{ 
                    maxWidth: '75%',
                    wordBreak: 'break-word'
                  }}
                >
                  <div className="d-flex align-items-center mb-2">
                    <span className="me-2">
                      {item.role === 'user' ? '👤' : '🤖'}
                    </span>
                    <strong>
                      {item.role === 'user' ? '나' : 'AI 어시스턴트'}
                    </strong>
                    <small 
                      className={`ms-auto ${
                        item.role === 'user' ? 'text-white-50' : 'text-muted'
                      }`}
                    >
                      {formatTime(item.timestamp)}
                    </small>
                  </div>
                  <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {transcripts.length > 0 && (
        <div className="card-footer text-muted text-center">
          <small>총 {transcripts.length}개의 메시지</small>
        </div>
      )}
    </div>
  );
}