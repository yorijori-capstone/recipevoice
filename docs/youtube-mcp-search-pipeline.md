## YouTube MCP 기반 검색·스크립트 파이프라인

### 1. MCP 서버 개요
- 패키지: `zubeid-youtube-mcp-server` (`package.json`에 의존성 추가).  
- 제공 기능 요약 (`c:/Users/Adminstrator/Desktop/README.md` 기준):
  - `videos.searchVideos`, `videos.getVideo` : 제목, 설명, duration, 채널, 통계 획득.
  - `transcripts.getTranscript` : 다국어 자막(타임스탬프 포함) 조회.
  - 채널·플레이리스트 관련 도구는 추후 확장용으로 남겨둠.
- 필수 환경 변수
  - `YOUTUBE_API_KEY` (YouTube Data API v3 키) – `.env` 에 정의 후 npm 스크립트 실행 시 자동 로드.
  - `YOUTUBE_TRANSCRIPT_LANG` (선택) – 기본 `'en'`, 우리 시스템에서는 `'ko'`를 기본값으로 오버라이드.

### 2. 실행 전략
1. `backend` 디렉터리에서 `npm install zubeid-youtube-mcp-server`.  
2. `scripts/run-youtube-mcp.ts`가 `dotenv`를 로드하고 `npx -y zubeid-youtube-mcp-server`를 실행하도록 구성했으며, `package.json`에는 `npm run youtube:mcp` 스크립트를 추가한다.  
3. 루트 `.env` (또는 `backend/.env`) 예시
   ```
   YOUTUBE_API_KEY=AIza...
   YOUTUBE_TRANSCRIPT_LANG=ko
   ```
4. 서버 기동: `cd backend && npm run youtube:mcp`.

### 3. 검색 API 명세 (프론트 버튼 → 백엔드)
| 항목 | 내용 |
| --- | --- |
| HTTP | `GET /api/youtube/search?query=김치찌개&limit=5` |
| 요청 검증 | `query` 최소 2자, `limit` 1~10 |
| 내부 동작 | MCP `videos.searchVideos` 호출, `maxResults=limit`, 기본 정렬 relevance |
| 응답 | `[{ videoId, title, channelTitle, duration, thumbnailUrl, publishedAt, descriptionSnippet }]` |
| 오류 | `400 INVALID_QUERY`, `500 MCP_UNAVAILABLE`, `429 YOUTUBE_QUOTA_EXCEEDED` |

검색 결과는 이후 프론트에서 모달/리스트로 노출하고 선택된 `videoId` 를 POST API에 전달한다.

### 4. 선택 영상 Import + RecipeCleaner 흐름
| 단계 | 설명 |
| --- | --- |
| 1 | `POST /api/youtube/import` body: `{ "videoId": "dQw4w9WgXcQ", "language": "ko", "searchQuery": "김치찌개 만드는 법" }` (`language` 미지정 시 `ko`). |
| 2 | MCP `videos.getVideo`로 메타데이터 확보 (`title`, `channelTitle`, `duration`, `statistics`, `thumbnails`, `publishedAt`). |
| 3 | MCP `transcripts.getTranscript` 호출, 실패 시 `SCRIPT_NOT_FOUND` 반환. |
| 4 | `recipe_id = recipe_yt_<videoId>` 규칙 적용 → `recipes` 테이블에 `raw_data` upsert. raw 구조:  |
|   | ```json |
|   | { |
|   |   "videoId": "...", |
|   |   "title": "...", |
|   |   "description": "...", |
|   |   "channelTitle": "...", |
|   |   "channelId": "...", |
|   |   "duration": "PT10M13S", |
|   |   "publishedAt": "...", |
|   |   "thumbnails": [{ "quality": "high", "url": "https://..." }], |
|   |   "language": "ko", |
|   |   "transcript": [{ "start": 0, "duration": 4.2, "text": "..." }], |
|   |   "statistics": { "viewCount": "...", "likeCount": "..." }, |
|   |   "searchQuery": "김치찌개 만드는 법", |
|   |   "retrievedAt": "2025-11-24T12:00:00Z", |
|   |   "source": "youtube-mcp-server" |
|   | } |
|   | ``` |
| 5 | 동일 `recipe_yt_*` 가 이미 존재하면 raw_data 업데이트 후 `cleaned_recipes` 재작성 여부를 옵션으로 설정 (초기 버전은 덮어쓰기). |
| 6 | `RecipeCleaner.cleanAndPlanRecipe` 호출 → `cleaned_recipes`, `cleaned_steps`, `ingredients` 저장. 실패 시 전체 트랜잭션 롤백. |

### 5. 오류/트랜잭션 전략
- `recipes`, `ingredients`, `cleaned_*` INSERT/UPDATE는 단일 트랜잭션에서 실행.  
- Transcript 부재 → HTTP 404 `TRANSCRIPT_UNAVAILABLE`.  
- YouTube API 제한 → HTTP 429 `YOUTUBE_QUOTA_EXCEEDED`.  
- Unexpected MCP 오류 → HTTP 502 `MCP_BRIDGE_FAILED` (MCP 로그 확인 안내).

### 6. 사용자 흐름 요약
1. **브라우저 버튼 클릭** → 검색어 입력.  
2. **백엔드** `GET /api/youtube/search` → 상위 N개의 영상 JSON 반환.  
3. **사용자 선택** → `POST /api/youtube/import` 로 videoId 전달.  
4. **백엔드** MCP 연동 → transcript 확보, raw_data 적재, RecipeCleaner 실행.  
5. **프론트** 선택 완료 후 `recipeId` 반환 받아 기존 레시피 상세/세션 화면으로 이동.

이 문서는 추후 구현 시 명세 기준으로 사용하며, README 및 시스템 문서에도 핵심 흐름을 요약해 반영한다.

### 7. 부록 – MCP 서버 비교 및 등록

| 항목 | `zubeid-youtube-mcp-server` | `Kyungpyo-Kim/youtube_transcript_mcp` |
| --- | --- | --- |
| 기능 | 검색, 영상/채널/플레이리스트 메타, 다국어 transcript | Transcript 조회 + 사용 가능 언어 목록 |
| 실행 | Node 패키지 (npx 혹은 npm script) | Python 가상환경 + MCP SDK |
| 필수 ENV | `YOUTUBE_API_KEY`, `YOUTUBE_TRANSCRIPT_LANG`(선택) | `YOUTUBE_TRANSCRIPT_LANG`(선택), API 키 불필요 |
| 장점 | 검색부터 transcript까지 One-stop, metadata 풍부 | 경량, transcript 전용이므로 발빠른 스크립트 |
| 활용 | 기본 수집 파이프라인 | transcript 품질 비교/백업 용도 |

동시에 두 서버를 등록해야 할 경우 Claude Desktop 설정 예시는 다음과 같다:

```json
{
  "mcpServers": {
    "youtube-full": {
      "command": "npx",
      "args": ["-y", "zubeid-youtube-mcp-server"],
      "env": {
        "YOUTUBE_API_KEY": "${env:YOUTUBE_API_KEY}",
        "YOUTUBE_TRANSCRIPT_LANG": "${env:YOUTUBE_TRANSCRIPT_LANG}"
      }
    },
    "youtube-transcript-lite": {
      "command": "python",
      "args": ["path/to/youtube_transcript_mcp_server.py"],
      "env": {
        "YOUTUBE_TRANSCRIPT_LANG": "ko"
      }
    }
  }
}
```

백엔드 오케스트레이터는 `backend/src/services/youtubeImportService.ts` (신규)에서 MCP 호출과 DB 트랜잭션을 담당하고, `backend/src/routes/youtubeSearch.ts`, `backend/src/routes/youtubeImport.ts` (가칭) 에서 API를 노출하도록 설계한다.

