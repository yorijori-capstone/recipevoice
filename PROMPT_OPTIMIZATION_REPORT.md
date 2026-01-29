# 프롬프트 차분 업데이트 최적화 완료 보고서

## 📊 작업 완료 (2024)

### 🎯 목표
OpenAI Realtime API 사용 시 불필요한 프롬프트 재전송을 줄여 API 사용량을 대폭 절감

---

## ✅ 구현 완료 사항

### 1. **Base Prompt 생성 메서드 추가** ✓
- **파일**: `backend/src/services/realtimeServiceV3.ts`
- **메서드**: `generateBasePrompt()`
- **내용**: 불변 레시피 정보 (메타데이터, 전체 단계 목록 간략, 지침)
- **예상 길이**: ~800 토큰 (기존 2550 토큰 대비 68% 감소)

```typescript
private generateBasePrompt(session: CookingSession): string {
  // 레시피 개요, 간략한 전체 단계 목록, 행동 지침만 포함
  // 상세한 현재 단계 정보는 제외 → 시스템 메시지로 별도 전송
}
```

---

### 2. **단계 컨텍스트 메시지 전송 메서드 추가** ✓
- **파일**: `backend/src/services/realtimeServiceV3.ts`
- **메서드**: `sendStepContextMessage()`, `formatTimerInfoDetailed()`
- **내용**: 단계 변경 시 현재 단계 정보를 `conversation.item.create`로 전송
- **예상 길이**: ~250 토큰 (기존 2550 토큰 대비 90% 감소)

```typescript
private async sendStepContextMessage(stepIndex: number): Promise<void> {
  // 현재 단계 상세 정보 (재료, 도구, 타이머, 팁 등)를 시스템 메시지로 전송
  const contextMessage = {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [{ type: 'text', text: '...' }]
    }
  };
  this.sendToOpenAI(contextMessage);
}
```

---

### 3. **WebSocket 연결 시 Base Prompt 전송** ✓
- **파일**: `backend/src/services/realtimeServiceV3.ts`
- **위치**: `connect()` 메서드의 `ws.on('open')` 핸들러
- **변경**: 
  - 최초 연결 시: Base Prompt 전송 + 현재 단계 컨텍스트 메시지
  - 재연결 시: Base Prompt 재전송 + 현재 단계 컨텍스트 메시지

```typescript
this.ws.on('open', async () => {
  if (!this.isBasePromptSent) {
    const basePrompt = this.generateBasePrompt(this.session);
    await this.sendSessionUpdate(basePrompt, true); // VAD 포함
    this.isBasePromptSent = true;
    await this.sendStepContextMessage(this.session.currentStepIndex);
  } else {
    // 재연결 시 Base Prompt 재전송
    const basePrompt = this.generateBasePrompt(this.session);
    await this.sendSessionUpdate(basePrompt, true);
    await this.sendStepContextMessage(this.session.currentStepIndex);
  }
  resolve();
});
```

---

### 4. **단계 변경 시 시스템 메시지로 컨텍스트 전송** ✓
- **파일**: `backend/src/services/realtimeServiceV3.ts`
- **위치**: `handleToolCall()` 메서드
- **변경**: 
  - ❌ 기존: `sendSessionUpdate(updatedPrompt)` (전체 프롬프트 2550 토큰 재전송)
  - ✅ 신규: `sendStepContextMessage()` (현재 단계만 250 토큰 전송)

```typescript
// ✅ 신규: 시스템 메시지로 현재 단계만 전송 (250 토큰, 91% 절감)
await this.sendStepContextMessage(result.current_step_index);
console.log('✅ Step context message sent for new step');
```

---

### 5. **타이머 상태 업데이트 시 세션 업데이트 제거** ✓
- **파일**: `backend/src/services/realtimeServiceV3.ts`
- **위치**: `updateTimerState()` 메서드
- **변경**: 
  - ❌ 기존: 타이머 상태 변경 시 전체 프롬프트 재전송
  - ✅ 신규: 세션 업데이트 완전 제거, 로그만 출력

```typescript
// ❌ 세션 업데이트 완전히 제거
// 타이머는 프론트엔드에서만 관리, AI는 타이머 정보를 step context에서만 확인
// 이로써 타이머 실행 중 불필요한 API 호출 제거 (약 60회/분 절감)

if (stateChanged) {
  console.log(`[RealtimeServiceV3] ✅ Timer state changed (isRunning: ${state.isRunning}, isCompleted: ${state.isCompleted}) - No session update needed`);
}
```

---

## 📊 예상 효과 (20단계 레시피 기준)

### 토큰 사용량 비교

| 항목 | 기존 | 최적화 후 | 절감률 |
|------|------|----------|--------|
| **연결 시** | 2,550 토큰 | 800 토큰 | **68%** |
| **단계 이동 (20회)** | 51,000 토큰 | 5,000 토큰 | **90%** |
| **타이머 상태 (10회)** | 25,500 토큰 | 0 토큰 | **100%** |
| **재연결 (2회)** | 5,100 토큰 | 1,600 토큰 | **69%** |
| **총 입력 토큰** | **84,150** | **7,400** | **91%** |

### 비용 절감 (GPT-4 Realtime API)
- **기존**: $8.4 (입력 토큰만)
- **최적화 후**: $0.74
- **절감**: **$7.66 (91%)**

### 응답 시간 개선
- 프롬프트 길이 감소로 API 처리 시간 단축
- 7단계, 14단계 응답 지연 문제 해결 가능

---

## 🔍 주요 변경 사항 요약

### 기존 방식
```
연결 시: session.update (2550 토큰)
단계 이동: session.update (2550 토큰) → 20회 = 51,000 토큰
타이머 변경: session.update (2550 토큰) → 10회 = 25,500 토큰
총: 84,150 토큰
```

### 새 방식
```
연결 시: session.update (800 토큰, Base Prompt)
         + conversation.item.create (250 토큰, 현재 단계)
단계 이동: conversation.item.create (250 토큰) → 20회 = 5,000 토큰
타이머 변경: (업데이트 안 함) → 0회 = 0 토큰
총: 7,400 토큰 (91% 절감)
```

---

## 🛠️ 기술적 세부 사항

### Base Prompt의 구성
1. **레시피 개요** (~200 토큰)
   - 제목, 설명, 인분, 시간, 난이도
   - 주재료, 부재료 (간략)
   - 필요한 도구

2. **전체 단계 목록** (~300 토큰)
   - 단계 번호 + 설명만 (매우 간략)
   - 예: `1. 양파를 채썰어주세요`

3. **행동 지침** (~300 토큰)
   - 역할 정의
   - 네비게이션 지침
   - 타이머 관리 규칙
   - 대화 스타일 가이드

### Step Context Message의 구성
1. **현재 단계 정보** (~200 토큰)
   - Phase, Action, Description
   - Ingredients Needed, Tools Needed
   - Heat Level, Timer Info
   - Tip (있는 경우)

2. **특수 지침** (~50 토큰)
   - 타이머 필요 시 확인 요청 경고
   - 첫 단계인 경우 환영 메시지 안내

---

## ⚠️ 주의사항 및 테스트 필요 항목

### 1. conversation.item.create 사용 제한
- OpenAI Realtime API 문서에서 대화 히스토리 길이 제한 확인 필요
- 20단계 × 250 토큰 = 5,000 토큰 누적 (보통 문제없음)

### 2. Base Prompt만으로 충분한지 검증
- AI가 전체 레시피 컨텍스트를 이해하는지
- 이전 단계 참조 질문에 잘 대답하는지

### 3. 시스템 메시지 타이밍
- Step context message 전송 후 response.create 타이밍
- 100ms 지연이 적절한지 확인

---

## 🧪 테스트 시나리오

### 1. 기본 플로우
- [ ] 연결 시 Base Prompt 전송 확인
- [ ] 첫 단계 컨텍스트 메시지 전송 확인
- [ ] AI가 첫 단계 안내 정상 동작

### 2. 단계 이동
- [ ] "다음 단계"로 이동 시 컨텍스트 메시지 전송
- [ ] AI가 새 단계 설명 (침묵 없음)
- [ ] 이전 단계 질문에도 답변 가능

### 3. 타이머
- [ ] 타이머 필요 단계에서 확인 요청
- [ ] 타이머 실행 중 API 호출 감소 확인
- [ ] 타이머 완료 시 정상 안내

### 4. 재연결
- [ ] 재연결 시 Base Prompt 재전송
- [ ] 현재 단계 컨텍스트 복원
- [ ] 대화 이어서 진행 가능

### 5. 크로스 단계 질문
- [ ] "3단계는 뭐야?" → 답변 정확
- [ ] "전체 재료는?" → 답변 정확
- [ ] "다음 단계는?" → 답변 정확

---

## 📝 추가 최적화 제안 (미구현)

### 옵션 A: 대화 히스토리 정리
- 오래된 step context message 주기적으로 삭제
- 대화 히스토리 길이 제한 도달 방지

### 옵션 B: 캐싱 활용
- OpenAI의 Prompt Caching 기능 활용 (Beta)
- Base Prompt를 캐시하여 재연결 시 비용 절감

### 옵션 C: 단계 그룹화
- 유사한 단계들을 묶어 컨텍스트 전송 최적화
- 예: "야채 손질" 단계들은 한 번에 전송

---

## ✅ 완료 체크리스트

- [x] `generateBasePrompt()` 메서드 추가
- [x] `sendStepContextMessage()` 메서드 추가
- [x] `formatTimerInfoDetailed()` 메서드 추가
- [x] `connect()` 수정 - Base Prompt 전송
- [x] `handleToolCall()` 수정 - 시스템 메시지 전송
- [x] `updateTimerState()` 수정 - 세션 업데이트 제거
- [x] 린터 오류 없음 확인
- [ ] 실제 테스트 및 검증

---

## 🚀 다음 단계

1. **로컬 테스트**
   - 백엔드 재시작
   - 프론트엔드 접속
   - 레시피 선택 후 요리 모드 진입

2. **API 사용량 모니터링**
   - OpenAI 대시보드에서 토큰 사용량 확인
   - 기존 대비 90% 절감 여부 검증

3. **사용자 경험 확인**
   - 응답 속도 개선 여부
   - 7-14단계 지연 문제 해결 여부
   - AI 답변 품질 유지 여부

4. **추가 최적화 검토**
   - 필요 시 대화 히스토리 정리 로직 추가
   - Prompt Caching 도입 검토

---

## 📌 관련 파일

- `backend/src/services/realtimeServiceV3.ts` - 주요 변경 사항
- `API_USAGE_ANALYSIS.md` - 이전 분석 결과
- `PROMPT_OPTIMIZATION_REPORT.md` - 본 문서

---

**작성일**: 2024년
**작성자**: AI Agent
**버전**: 1.0

