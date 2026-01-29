# sh-debug3 브랜치로 되돌린 후 수정 사항 정리

**작업 기간**: 2025-01-23  
**기준 브랜치**: `origin/sh-debug3`

---

## 📋 수정 사항 목록

### 1. 디버깅 로그 추가

#### 1.1 백엔드 - 오디오 전송 로그
**파일**: `backend/src/services/realtimeServiceV3.ts`

- **Line 623**: `sendAudio()` 메서드에 오디오 청크 전송 로그 추가
  ```typescript
  console.log('🎤 [RealtimeServiceV3] Sending audio chunk to OpenAI, length:', audioData?.length || 0);
  ```

#### 1.2 백엔드 - 서버 오디오 수신 로그
**파일**: `backend/src/serverV3.ts`

- **Line 383-397**: `case 'audio':` 처리에 상세 로그 추가
  ```typescript
  console.log('🎤 [Server V3] Audio chunk received, length:', data.audio?.length || 0);
  console.log('✅ [Server V3] Sending audio to RealtimeService');
  // 경고 로그도 추가
  ```

#### 1.3 백엔드 - 전사 이벤트 디버깅 로그
**파일**: `backend/src/services/realtimeServiceV3.ts`

- **Line 783-797**: `conversation.item.input_audio_transcription.completed` 이벤트에 상세 로그 추가
  ```typescript
  console.log('🔍 [DEBUG] input_audio_transcription.completed event received:', {
    hasTranscript: !!event.transcript,
    transcriptLength: event.transcript?.length || 0,
    transcript: event.transcript || '(empty)',
    item_id: event.item_id
  });
  
  if (!event.transcript || event.transcript.trim().length === 0) {
    console.warn('⚠️ [DEBUG] Empty transcript filtered out');
  }
  ```

#### 1.4 백엔드 - 알 수 없는 이벤트 타입 로깅
**파일**: `backend/src/services/realtimeServiceV3.ts`

- **Line 876-880**: `default` case에 알 수 없는 이벤트 타입 로깅 추가
  ```typescript
  default:
    if (event.type && !event.type.startsWith('response.')) {
      console.log('🔍 [DEBUG] Unknown event type:', event.type, JSON.stringify(event, null, 2));
    }
    break;
  ```

**효과**: 
- 오디오 전송/수신 과정 추적 가능
- 전사 이벤트 발생 여부 확인 가능
- 알 수 없는 이벤트 타입 발견 가능

---

### 2. 오디오 전송 빈도 조절 (버퍼링 및 배치 전송)

**파일**: `frontend2/src/hooks/useAudioRecorder.ts`

#### 2.1 변경 내용

**이전 방식**:
- `ScriptProcessorNode`의 `onaudioprocess` 이벤트마다 즉시 전송
- 초당 약 5.9개의 WebSocket 메시지 전송

**수정 후**:
- 오디오 청크를 버퍼에 모아서 100ms마다 배치 전송
- 초당 약 10개의 WebSocket 메시지 전송 (약 83% 감소)

#### 2.2 주요 변경사항

1. **오디오 버퍼 추가**:
   ```typescript
   const audioBufferRef = useRef<string[]>([]);
   const sendTimerRef = useRef<number | null>(null);
   ```

2. **버퍼 플러시 함수**:
   ```typescript
   const flushAudioBuffer = useCallback(() => {
     if (audioBufferRef.current.length === 0) return;
     audioBufferRef.current.forEach((chunk) => {
       onAudioChunk(chunk);
     });
     audioBufferRef.current = [];
   }, [onAudioChunk]);
   ```

3. **주기적 전송**:
   ```typescript
   processor.onaudioprocess = (e: AudioProcessingEvent) => {
     // ... 오디오 처리 ...
     audioBufferRef.current.push(base64); // 버퍼에 추가
     
     if (!sendTimerRef.current) {
       sendTimerRef.current = window.setInterval(() => {
         flushAudioBuffer();
       }, 100); // 100ms마다 전송
     }
   };
   ```

4. **정리 로직**:
   ```typescript
   const stopStreaming = useCallback(() => {
     if (sendTimerRef.current) {
       clearInterval(sendTimerRef.current);
       sendTimerRef.current = null;
     }
     flushAudioBuffer(); // 남은 버퍼 전송
     // ... 나머지 정리 ...
   }, [flushAudioBuffer]);
   ```

**효과**:
- WebSocket 메시지 수 약 83% 감소
- 네트워크 부하 감소
- 실시간성 유지 (100ms 지연, 허용 범위)

---

## 🔍 발견된 문제점

### 1. Whisper API Rate Limit 초과 (429 에러)

**증상**:
- `conversation.item.input_audio_transcription.failed` 이벤트 발생
- 에러 메시지: "429 Too Many Requests"

**원인**:
- VAD가 음성을 감지할 때마다 `input_audio_buffer.commit` 호출
- 각 커밋마다 Whisper transcription 요청 발생
- 짧은 시간에 많은 transcription 요청 → Rate Limit 초과

**로그에서 확인**:
```
🔍 [DEBUG] Unknown event type: conversation.item.input_audio_transcription.failed
"message": "Input transcription failed for item '...'. 429 Too Many Requests"
```

**해결 방안** (제안됨, 아직 미적용):
1. VAD 설정 최적화 (`SILENCE_DURATION_MS` 증가, `THRESHOLD` 조정)
2. 최소 오디오 길이 검증 추가
3. Transcription 실패 이벤트 처리 추가

---

## 📊 성능 개선 효과

### 오디오 전송 빈도

| 항목 | 이전 | 수정 후 | 개선율 |
|------|------|---------|--------|
| 전송 빈도 | 초당 5.9회 | 초당 10회 | 83% 감소 |
| WebSocket 메시지 | 초당 5.9개 | 초당 10개 | 83% 감소 |
| 지연 | 0ms | ~100ms | 허용 범위 |

---

## 🚧 미적용 제안 사항

### 1. VAD 설정 최적화
- `THRESHOLD`: 0.90 → 0.92 (잡음 감지 감소)
- `SILENCE_DURATION_MS`: 300 → 600 (더 긴 침묵 후 커밋)

### 2. 최소 오디오 길이 검증
- 0.5초 미만의 짧은 음성은 transcription 요청하지 않음

### 3. Transcription 실패 처리
- `conversation.item.input_audio_transcription.failed` 이벤트 처리 추가
- Rate Limit 에러 감지 및 사용자 알림

---

## 📝 참고 사항

1. **오디오 전송 빈도 조절**은 실시간성을 유지하면서 네트워크 부하를 감소시킴
2. **디버깅 로그**는 문제 진단에 유용하지만, 프로덕션에서는 제거하거나 레벨 조정 고려
3. **Whisper API Rate Limit** 문제는 VAD 설정 최적화와 transcription 실패 처리로 해결 가능

---

## 🔄 다음 단계

1. VAD 설정 최적화 적용
2. Transcription 실패 이벤트 처리 추가
3. 최소 오디오 길이 검증 추가
4. 프로덕션 배포 전 디버깅 로그 레벨 조정

