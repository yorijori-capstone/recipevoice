# Known Issues (알려진 이슈)

이 문서는 현재 알려진 낮은 우선순위 이슈들을 문서화합니다. 향후 개선 시 참고하세요.

---

## 1. useWebSocket options 참조 문제

**파일**: `frontend2/src/hooks/useWebSocket.ts`

**설명**: `options` 객체가 매 렌더링마다 새로 생성되면 `connect` 함수가 재생성될 수 있습니다.

**영향**: 불필요한 재연결 가능성 (현재는 명시적으로 `connect`를 호출해야 하므로 실제 영향은 적음)

**해결 방안**:
- options의 개별 콜백들을 의존성으로 사용
- 또는 부모 컴포넌트에서 `useMemo`로 options 객체 감싸기

```typescript
// 예시
const options = useMemo(() => ({
  onUserTranscription: handleTranscription,
  // ...
}), [handleTranscription]);
```

---

## 2. ProgressBar status 타입 불일치

**파일**: 
- `frontend2/src/components/CookingUI/ProgressBar.tsx`
- `frontend2/src/hooks/useCookingSessionV3.ts`

**설명**: `ProgressBar`는 `'planning'` 상태를 지원하지만, `CookingSessionV3` 인터페이스에는 해당 상태가 없습니다.

**영향**: TypeScript 타입 불일치 (런타임에는 영향 없음)

**해결 방안**:
```typescript
// CookingSessionV3 인터페이스에 planning 추가
status: 'planning' | 'active' | 'paused' | 'completed' | 'error';

// 또는 ProgressBar에서 planning 상태 제거
status: 'active' | 'paused' | 'completed' | 'error';
```

---

## 3. 에러 처리 UX 개선

**파일**: 여러 컴포넌트

**설명**: 현재 `alert()`를 사용하여 에러를 표시합니다.

**영향**: 사용자 경험 저하, 모바일에서 네이티브 alert이 어색함

**해결 방안**:
- 토스트 라이브러리 도입 (예: react-toastify)
- 커스텀 에러 모달 컴포넌트 구현

---

## 4. 음성 대화 버튼 텍스트 UX

**파일**: `frontend2/src/components/CookingUI/VoiceInteraction.tsx`

**설명**: 버튼이 "클릭 시 동작"을 표시하지만, 현재 상태를 표시하는 것이 더 직관적일 수 있습니다.

**현재**:
- 활성화 상태 → "음성 대화 OFF" 표시
- 비활성화 상태 → "음성 대화 ON" 표시

**대안 1** (현재 상태 표시):
- 활성화 상태 → "🎤 음성 대화 중..."
- 비활성화 상태 → "🔇 음성 대화 꺼짐"

**대안 2** (토글 스위치 사용):
- 토글 스위치 UI로 변경하여 직관성 향상

---

## 5. ScriptProcessorNode deprecated

**파일**: `frontend2/src/hooks/useAudioRecorder.ts`

**설명**: `ScriptProcessorNode`는 Web Audio API에서 deprecated되었습니다.

**영향**: 향후 브라우저 지원 중단 가능성

**해결 방안**: `AudioWorklet`으로 마이그레이션

```typescript
// AudioWorklet 사용 예시
const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
```

**참고**: AudioWorklet은 별도의 worklet 파일이 필요하며, 구현이 더 복잡합니다.

---

## 6. 검색 디바운스 미적용

**파일**: `frontend2/src/pages/DashboardV3.tsx`

**설명**: 검색창에서 타이핑할 때마다 검색이 실행되지 않고 버튼 클릭/엔터로만 실행됩니다. 하지만 실시간 검색 기능 추가 시 디바운스가 필요합니다.

**해결 방안**:
```typescript
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
);

// cleanup
useEffect(() => {
  return () => debouncedSearch.cancel();
}, [debouncedSearch]);
```

---

## 7. 다중 사용자 지원 시 아키텍처 변경 필요

**파일**: `backend/src/serverV3.ts`, `backend/src/services/cookingServiceV3.ts`

**설명**: 현재 `RealtimeServiceV3`가 싱글톤으로 구현되어 있어, 여러 사용자가 동시에 접속하면 세션이 공유됩니다.

**영향**: 다중 사용자 동시 접속 시 충돌 발생

**해결 방안** (다중 사용자 지원 필요 시):
1. 클라이언트별로 별도의 RealtimeService 인스턴스 생성
2. 세션 ID 기반으로 OpenAI Realtime API 연결 격리
3. Connection Pool 패턴 적용

```typescript
// 예시: 클라이언트별 인스턴스 관리
class RealtimeConnectionManager {
  private connections: Map<string, RealtimeServiceV3> = new Map();
  
  getConnection(sessionId: string): RealtimeServiceV3 {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new RealtimeServiceV3(config));
    }
    return this.connections.get(sessionId)!;
  }
  
  removeConnection(sessionId: string): void {
    const conn = this.connections.get(sessionId);
    if (conn) {
      conn.disconnect();
      this.connections.delete(sessionId);
    }
  }
}
```

---

## 우선순위 참고

| 이슈 | 복잡도 | 영향도 | 권장 시기 |
|------|--------|--------|----------|
| #1 useWebSocket options | 낮음 | 낮음 | 리팩토링 시 |
| #2 ProgressBar 타입 | 낮음 | 없음 | 타입 정리 시 |
| #3 에러 처리 UX | 중간 | 중간 | UX 개선 시 |
| #4 버튼 텍스트 UX | 낮음 | 낮음 | UX 개선 시 |
| #5 AudioWorklet | 높음 | 낮음 | 브라우저 지원 중단 시 |
| #6 검색 디바운스 | 낮음 | 낮음 | 실시간 검색 추가 시 |
| #7 다중 사용자 | 높음 | 높음 | 다중 사용자 지원 필요 시 |

