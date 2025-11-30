# YouTube 레시피 파싱 로직

## 개요
YouTube에서 레시피를 가져올 때, OpenAI 가공을 최소화하고 원본 정보를 우선 사용하도록 개선

## 변경 이유
1. **비용 절감**: OpenAI API 호출 최소화
2. **속도 향상**: 원본 텍스트 파싱이 AI 처리보다 빠름
3. **정확도**: YouTube 크리에이터가 직접 작성한 레시피가 더 정확할 수 있음
4. **원본 보존**: 크리에이터의 의도가 담긴 원본 레시피 유지

## 새로운 파싱 전략 (우선순위 순)

### 1순위: 고정 댓글 (Pinned Comment)
- YouTube 요리 채널들은 보통 첫 번째 댓글에 레시피를 고정
- 재료와 조리법이 구조화되어 있음
- **검사 기준**:
  - 재료 표기 패턴 (g, ml, 큰술, 작은술, 개, 컵 등)
  - 단계별 조리법 패턴 (1., 2., - , • 등)
  - 최소 3개 이상의 재료 패턴 매칭

### 2순위: 영상 설명 (Description)
- 일부 채널은 설명란에 전체 레시피 작성
- 댓글과 동일한 패턴으로 검사

### 3순위: OpenAI 가공 (Fallback)
- 위 두 방법으로 레시피를 추출할 수 없을 때만 사용
- 자막 + 설명 + 댓글을 종합하여 AI가 레시피 생성
- 가장 비용이 높고 느리지만 가장 유연함

## 구현 세부사항

### 레시피 파싱 함수
```typescript
parseRecipeFromText(text: string): ParsedRecipe | null {
  // 1. 재료 섹션 추출
  // 2. 조리 단계 추출
  // 3. 구조화된 레시피 객체 반환
}
```

### 검증 기준
```typescript
interface ParsedRecipe {
  title: string;
  ingredients: Array<{
    name: string;
    amount: string;
    unit?: string;
  }>;
  steps: Array<{
    stepNumber: number;
    instruction: string;
    duration?: string;
  }>;
  servings?: string;
  cookTime?: string;
  source: 'comment' | 'description' | 'ai';
}
```

## 한국어 패턴 인식

### 재료 패턴
- `\d+g` - 100g
- `\d+ml` - 200ml
- `\d+큰술` - 2큰술
- `\d+작은술` - 1작은술
- `\d+개` - 3개
- `\d+컵` - 1컵
- `\d+T`, `\d+t` - 영문 표기

### 단계 구분 패턴
- `\d+\.` - 1. 2. 3.
- `-\s+` - - 항목
- `•\s+` - • 항목
- `\d+\)` - 1) 2) 3)
- `[재료]`, `[조리법]` 등의 섹션 헤더

### 섹션 키워드
- 재료: `재료`, `Ingredients`, `준비물`, `필요한 재료`
- 조리법: `조리법`, `만드는 법`, `Recipe`, `Steps`, `조리 순서`
- 팁: `팁`, `Tip`, `주의사항`, `참고`

## 예상 효과
- ⚡ **속도**: 평균 응답 시간 5-10초 → 1-2초
- 💰 **비용**: OpenAI API 호출 80% 감소
- ✅ **정확도**: 크리에이터 원본 레시피 사용으로 정확도 향상

## 테스트 케이스

### Case 1: 고정 댓글에 레시피 있음
- 입력: 첫 댓글에 재료 + 조리법
- 기대: 댓글 파싱 → DB 저장 (OpenAI 미사용)

### Case 2: 설명에 레시피 있음
- 입력: 설명란에 재료 + 조리법
- 기대: 설명 파싱 → DB 저장 (OpenAI 미사용)

### Case 3: 구조화된 레시피 없음
- 입력: 댓글/설명에 레시피 없음, 자막만 있음
- 기대: OpenAI 가공 → DB 저장

## 파일 변경 목록
- ✅ `backend/src/services/youtubeImportService.ts` - 파싱 로직 추가 완료
- ✅ `backend/src/services/youtubeRecipeParser.ts` - 새 파서 서비스 생성 완료
- ✅ `YOUTUBE_RECIPE_PARSING.md` - 문서 작성 완료

## 구현 상태: ✅ 완료 (2025-12-01)

### 변경 사항 요약
1. **YoutubeRecipeParser 클래스 생성** (`youtubeRecipeParser.ts`)
   - 한국어 레시피 패턴 인식 (재료, 조리법, 팁 등)
   - 재료 파싱: "양파 1개", "간장 2큰술" 등의 패턴 추출
   - 조리 단계 파싱: 번호 매기기, 시간 추출
   - 최소 2개 재료 + 2개 단계 검증

2. **YoutubeImportService 수정**
   - 첫 번째 댓글 저장 (고정 댓글 대부분 여기 위치)
   - 파싱 우선순위 적용:
     1. 첫 댓글 파싱 시도
     2. 실패시 설명 파싱 시도
     3. 모두 실패시 OpenAI 가공 (기존 로직)
   - `saveParsedRecipe()` 함수 추가: 파싱된 레시피를 직접 DB 저장

3. **로그 개선**
   - ✅ "Successfully parsed recipe from comment!" - 댓글 파싱 성공
   - ✅ "Successfully parsed recipe from description!" - 설명 파싱 성공
   - 💰 "Saved recipe without OpenAI processing (cost saved!)" - 비용 절감
   - ⚠️ "Could not parse structured recipe, falling back to OpenAI..." - OpenAI fallback

## 작동 플로우

```
YouTube 영상 가져오기 요청
    ↓
YouTube Data API로 영상 정보 + 댓글 가져오기
    ↓
youtube-scrap-mcp로 자막 가져오기 (선택)
    ↓
┌─────────────────────────────┐
│ 1️⃣ 첫 댓글에서 레시피 파싱  │
└─────────────────────────────┘
    ↓ (실패시)
┌─────────────────────────────┐
│ 2️⃣ 설명에서 레시피 파싱     │
└─────────────────────────────┘
    ↓ (실패시)
┌─────────────────────────────┐
│ 3️⃣ OpenAI로 레시피 가공     │
│    (자막 + 설명 + 댓글 종합) │
└─────────────────────────────┘
    ↓
cleaned_recipes 테이블에 저장
    ↓
완료!
```

## 테스트 방법
1. YouTube에서 레시피 검색 (예: "계란찜", "김치찌개")
2. "레시피로 가져오기" 클릭
3. 백엔드 로그 확인:
   - ✅ 표시 = 파싱 성공 (빠름, 저렴)
   - ⚠️ 표시 = OpenAI 사용 (느림, 비용 발생)

## 롤백 계획
기존 OpenAI 가공 로직은 유지하므로, 파싱 실패 시 자동으로 fallback됨

## 향후 개선 사항
- [ ] 영어 레시피 패턴 추가
- [ ] 중국어/일본어 레시피 지원
- [ ] 파싱 성공률 모니터링 및 패턴 개선
- [ ] 파싱된 레시피 vs OpenAI 레시피 품질 비교
