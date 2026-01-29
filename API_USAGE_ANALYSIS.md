# API 사용량 원인 분석

## 🔍 주요 원인

### 1. ⚠️ **타이머 상태 업데이트마다 세션 업데이트 호출** (가장 큰 문제)

**위치**: `backend/src/services/realtimeServiceV3.ts:100-118`

```typescript
public updateTimerState(state: {...}): void {
  this.timerState = state;
  // 🚨 문제: 타이머 상태가 변경될 때마다 (1초마다) sendSessionUpdate 호출
  const updatedPrompt = this.generateSystemPrompt(session);
  this.sendSessionUpdate(updatedPrompt, false);
}
```

**영향**:
- 타이머가 실행 중일 때 **1초마다** `session.update` API 호출
- 각 호출마다 전체 시스템 프롬프트 재전송 (수천 토큰)
- 예: 2분 타이머 = 120번의 불필요한 API 호출

**해결 방안**:
- 타이머 상태는 프롬프트에 포함하지 않고, 별도로 관리
- 또는 타이머 상태 업데이트를 **throttle** (예: 10초마다 한 번만)
- 또는 타이머가 완료되었을 때만 업데이트

---

### 2. **오디오 청크 전송** (정상이지만 빈도 높음)

**위치**: `frontend2/src/hooks/useAudioRecorder.ts:33-44`

```typescript
processor.onaudioprocess = (e: AudioProcessingEvent) => {
  // 4096 샘플마다 호출
  // 24kHz 샘플레이트 → 약 170ms마다 호출
  onAudioChunk(base64); // sendAudio 호출
};
```

**영향**:
- 초당 약 6번의 `input_audio_buffer.append` 호출
- 이는 정상적인 동작이지만, 타이머 실행 중에도 계속 전송됨

**해결 방안**:
- 타이머 실행 중에는 오디오 입력을 일시 중지하거나
- VAD가 음성이 감지되지 않으면 전송 중단

---

### 3. **프롬프트 길이** (이미 최적화됨)

**현재 상태**:
- 전체 단계를 포함하면 프롬프트가 매우 길어짐
- 이미 최적화 적용: 현재 단계 주변만 상세 표시

**추가 최적화 가능**:
- 7단계, 14단계에서 contextWindow를 더 줄이기 (이미 제안됨)

---

### 4. **중복 response.create 호출** (수정됨)

**이전 문제**:
- `navigate_` 툴 실행 후 `response.create`가 중복 호출될 수 있었음

**현재 상태**:
- ✅ 수정 완료: `navigate_` 툴의 경우 `return`으로 중복 방지

---

## 📊 예상 API 사용량

### 현재 (타이머 실행 중):
- **session.update**: 1초마다 (타이머 실행 중) = **60회/분**
- **input_audio_buffer.append**: 약 6회/초 = **360회/분**
- **response.create**: 사용자 입력/툴 실행 시 = **변동**

### 최적화 후 (타이머 상태 업데이트 제거):
- **session.update**: 단계 변경/연결 시만 = **1-2회/분**
- **input_audio_buffer.append**: 약 6회/초 = **360회/분** (변경 없음)
- **response.create**: 사용자 입력/툴 실행 시 = **변동**

**예상 절감량**: 약 **58-59회/분** (타이머 실행 중)

---

## 🎯 권장 수정 사항

### 우선순위 1: 타이머 상태 업데이트 최적화

**옵션 A**: 타이머 상태를 프롬프트에서 제거
- 타이머는 프론트엔드에서만 관리
- AI는 타이머 시작/중지만 제어

**옵션 B**: Throttle 적용
- 타이머 상태 업데이트를 10초마다 한 번만

**옵션 C**: 타이머 완료 시에만 업데이트
- 타이머가 시작/중지/완료될 때만 업데이트

### 우선순위 2: 오디오 입력 최적화
- VAD가 음성을 감지하지 못하면 오디오 전송 중단
- 타이머 실행 중에는 오디오 입력 일시 중지 (선택사항)

---

## 📝 참고

- OpenAI Realtime API는 **입력 토큰**과 **출력 토큰** 모두 과금됨
- `session.update`는 전체 프롬프트를 재전송하므로 입력 토큰이 많음
- `input_audio_buffer.append`는 오디오 데이터만 전송 (토큰 과금 없음, 대역폭만 사용)

