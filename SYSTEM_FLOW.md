## 시스템 플로우 (V3 + YouTube MCP)

### 1. 검색/생성 분기
| 단계 | 검색 기반 플로우 | AI 생성 플로우 |
| --- | --- | --- |
| 1 | 사용자가 프론트에서 검색 버튼을 클릭하고 키워드를 입력 | 사용자가 “새 레시피 생성” 버튼을 클릭 |
| 2 | 백엔드 `GET /api/youtube/search`가 MCP `videos.searchVideos` 호출 → 상위 N개 결과 반환 | 백엔드 `/api/recipes/generate`가 `RecipeCreator`를 호출해 초안을 생성 |
| 3 | 사용자가 영상 하나를 선택 → `POST /api/youtube/import` | AI가 만든 planning 결과를 그대로 사용 |
| 4 | MCP `videos.getVideo` + `transcripts.getTranscript` → `recipe_yt_<videoId>` raw_data 저장 | `RecipeCleaner.saveCleanedRecipe`가 raw/cleaned 테이블 모두 갱신 |
| 5 | RecipeCleaner가 transcript를 구조화 → `cleaned_recipes`, `cleaned_steps`, `ingredients` 생성 | 동일하게 클리닝 완료 후 DB 반영 |
| 6 | Cooking Session 서비스가 `cleaned_recipe_id`를 참조해 세션 생성/복구 | 동일 |

### 2. YouTube MCP 상세 흐름
1. **MCP 서버 실행** : `cd backend && npm run youtube:mcp`  
2. **검색 API** : Backend → MCP → YouTube Data API → 영상 메타/thumbnail URL/설명 일부 반환  
3. **선택된 영상 Import** : `recipe_id = recipe_yt_<videoId>` 규칙으로 기존 수집본과 중복 방지  
4. **raw_data 필드**  
   ```json
   {
     "videoId": "dQw4w9WgXcQ",
     "title": "김치찌개 맛있게 끓이는 법",
     "description": "...",
     "channelTitle": "요리조리TV",
     "channelId": "UC123",
     "duration": "PT12M30S",
     "publishedAt": "2025-11-10T05:00:00Z",
     "thumbnails": [{ "quality": "high", "url": "https://..." }],
     "language": "ko",
     "transcript": [{ "start": 0, "duration": 3.5, "text": "먼저 냄비에..." }],
     "statistics": { "viewCount": "120394", "likeCount": "5312" },
     "searchQuery": "김치찌개",
     "retrievedAt": "2025-11-24T03:00:00Z",
     "source": "youtube-mcp-server"
   }
   ```
5. **클리닝 및 세션 연계** : `RecipeCleaner.cleanAndPlanRecipe`가 opening/closing remark를 생성하고, CookingAgentV3에서 `cleaned_recipe_id` 기반으로 세션을 시작/복구한다.

### 3. 오류 처리
- **TRANSCRIPT_UNAVAILABLE (404)** : 영상에 자막 없음 → 사용자에게 다른 영상 선택 안내.
- **YOUTUBE_QUOTA_EXCEEDED (429)** : YouTube API 제한 → 관리자에게 API 키 추가 안내.
- **MCP_BRIDGE_FAILED (502)** : MCP 서버 미동작 → `npm run youtube:mcp` 로그 확인.

### 4. 참고 문서
- `docs/youtube-mcp-search-pipeline.md`
- `backend/scripts/run-youtube-mcp.ts`

