import { pool } from '../db/pool.js';
import { RecipeCleaner } from './recipeCleaner.js';
import { YoutubeVideoService } from './youtubeVideoService.js';
import { getYoutubeScrapClient } from '../mcp/youtube-scrap-client.js';
import { YoutubeRecipeParser } from './youtubeRecipeParser.js';

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
}

export interface YoutubeTranscriptSegment {
  text: string;
  duration: number;
  offset: number;
}

export interface YoutubeImportRequest {
  videoId: string;
  language?: string;
  searchQuery?: string;
}

export interface YoutubeImportResponse {
  recipeId: string;
  cleanedRecipeId: number;
  title: string;
}

export class YoutubeImportError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string
  ) {
    super(message || code);
  }
}

const DEFAULT_SERVINGS = '2';
const DEFAULT_COOK_TIME = '30분';
const DEFAULT_DIFFICULTY = 'medium';
const LANGUAGE_FALLBACK = 'ko';
const RECIPE_PREFIX = 'recipe_yt_';

export class YoutubeImportService {
  private videoService: YoutubeVideoService;
  private recipeCleaner: RecipeCleaner;
  private recipeParser: YoutubeRecipeParser;

  constructor() {
    this.assertEnv();
    this.videoService = new YoutubeVideoService();
    this.recipeCleaner = new RecipeCleaner(
      process.env.OPENAI_API_KEY || ''
    );
    this.recipeParser = new YoutubeRecipeParser();
  }

  /**
   * Search YouTube videos via the MCP server internals.
   */
  async searchVideos(
    query: string,
    limit = 5,
    captionFilter = true
  ): Promise<YoutubeSearchResult[]> {
    if (!query || query.trim().length < 2) {
      throw new YoutubeImportError(
        'INVALID_QUERY',
        400,
        '검색어는 최소 2자 이상이어야 합니다.'
      );
    }

    try {
      const items = await this.videoService.searchVideos({
        query: query.trim(),
        maxResults: Math.min(Math.max(limit, 1), 10),
        videoCaptionFilter: captionFilter,
      });

      return (items || [])
        .map((item: any) => {
          const snippet = item.snippet || {};
          const thumbnails = snippet.thumbnails || {};
          const thumbnailUrl =
            thumbnails.high?.url ||
            thumbnails.medium?.url ||
            thumbnails.default?.url ||
            null;

          return {
            videoId: item.id?.videoId || '',
            title: snippet.title || '제목 없음',
            description: snippet.description || '',
            thumbnailUrl,
            channelTitle: snippet.channelTitle || '알 수 없는 채널',
            channelId: snippet.channelId || '',
            publishedAt: snippet.publishedAt || '',
          } as YoutubeSearchResult;
        })
        .filter((video) => !!video.videoId);
    } catch (error: any) {
      console.error('[YouTube Service] searchVideos failed:', error);
      throw new YoutubeImportError(
        'YOUTUBE_SEARCH_FAILED',
        502,
        error.message || 'YouTube 검색에 실패했습니다.'
      );
    }
  }

  /**
   * Import a YouTube video and trigger RecipeCleaner.
   */
  async importVideo(
    request: YoutubeImportRequest
  ): Promise<YoutubeImportResponse> {
    const videoId = request.videoId?.trim();
    if (!videoId) {
      throw new YoutubeImportError(
        'MISSING_VIDEO_ID',
        400,
        'videoId가 필요합니다.'
      );
    }

    const recipeId = `${RECIPE_PREFIX}${videoId}`;

    try {
      // First, get basic video info from YouTube Data API
      const videoInfo = await this.videoService.searchVideos({
        query: videoId,
        maxResults: 1,
      });

      let title = 'Unknown Title';
      let channelTitle = 'YouTube Creator';

      if (videoInfo && videoInfo.length > 0) {
        const snippet = videoInfo[0].snippet || {};
        title = snippet.title || title;
        channelTitle = snippet.channelTitle || channelTitle;
      }

      // Get top comments to extract recipe ingredients
      console.log('[YouTube Service] Fetching top comments for ingredient info...');
      const comments = await this.videoService.getTopComments(videoId, 5);
      let ingredientsFromComments = '';
      let firstCommentText = '';

      if (comments && comments.length > 0) {
        // Store first comment (often pinned with full recipe)
        firstCommentText = comments[0]?.snippet?.topLevelComment?.snippet?.textDisplay || '';

        // Look for comments that might contain ingredients (often in pinned/top comments)
        for (const comment of comments) {
          const commentText = comment.snippet?.topLevelComment?.snippet?.textDisplay || '';
          // Check if comment contains ingredient-like patterns (quantities, food items)
          if (this.looksLikeIngredientList(commentText)) {
            ingredientsFromComments = commentText;
            console.log('[YouTube Service] Found ingredient information in comments');
            break;
          }
        }
      }

      // Use youtube-scrap-mcp to get complete video content including transcript
      console.log('[YouTube Service] Using youtube-scrap-mcp to fetch video content...');
      const youtubeScrapClient = await getYoutubeScrapClient();
      const videoContent = await youtubeScrapClient.getVideoContent(videoId);

      console.log('[YouTube Service] Successfully fetched video content from youtube-scrap-mcp');

      // Use API title if scrap-mcp failed to get it
      if (videoContent.title === 'Unknown Title' || !videoContent.title) {
        videoContent.title = title;
      }
      if (videoContent.channelTitle === 'YouTube Creator' || !videoContent.channelTitle) {
        videoContent.channelTitle = channelTitle;
      }

      // Build raw data from youtube-scrap-mcp result
      const rawData = {
        videoId: videoContent.videoId,
        title: videoContent.title,
        description: videoContent.description,
        channelTitle: videoContent.channelTitle,
        channelId: videoContent.channelId,
        duration: videoContent.duration,
        publishedAt: videoContent.publishedAt,
        thumbnails: videoContent.thumbnails,
        language: request.language || LANGUAGE_FALLBACK,
        transcript: videoContent.transcript,
        statistics: videoContent.statistics,
        searchQuery: request.searchQuery || null,
        retrievedAt: new Date().toISOString(),
        source: 'youtube-scrap-mcp',
        ingredientsFromComments: ingredientsFromComments || null,
      };

      // Create a video object for saveRecipe compatibility
      const video = {
        id: videoContent.videoId,
        snippet: {
          title: videoContent.title,
          channelTitle: videoContent.channelTitle,
          defaultAudioLanguage: request.language || 'ko',
        },
        contentDetails: {
          duration: videoContent.duration,
        },
      };

      await this.saveRecipe(recipeId, rawData, video);

      // 🎯 NEW LOGIC: Try parsing recipe from description/comments first
      console.log('[YouTube Service] Attempting to parse structured recipe...');

      let parsedRecipe = null;

      // Priority 1: Try parsing from first comment (often pinned with full recipe)
      if (firstCommentText) {
        parsedRecipe = this.recipeParser.parseRecipe(firstCommentText, 'comment');
        if (parsedRecipe) {
          console.log('✅ [YouTube Service] Successfully parsed recipe from comment!');
        }
      }

      // Priority 2: Try parsing from description if comment parsing failed
      if (!parsedRecipe && videoContent.description) {
        parsedRecipe = this.recipeParser.parseRecipe(videoContent.description, 'description');
        if (parsedRecipe) {
          console.log('✅ [YouTube Service] Successfully parsed recipe from description!');
        }
      }

      let cleaned;

      if (parsedRecipe) {
        // Use parsed recipe directly (no OpenAI processing)
        parsedRecipe.title = title; // Use YouTube video title
        cleaned = await this.saveParsedRecipe(recipeId, parsedRecipe);
        console.log(`💰 [YouTube Service] Saved recipe without OpenAI processing (cost saved!)`);
      } else {
        // Fallback: Use OpenAI to process raw data
        console.log('⚠️ [YouTube Service] Could not parse structured recipe, falling back to OpenAI...');
        cleaned = await this.recipeCleaner.cleanAndPlanRecipe(recipeId);
      }

      return {
        recipeId,
        cleanedRecipeId: cleaned.id,
        title: cleaned.title,
      };
    } catch (error: any) {
      if (error instanceof YoutubeImportError) {
        throw error;
      }

      console.error('[YouTube Service] importVideo failed:', error);

      if (typeof error?.message === 'string') {
        if (error.message.toLowerCase().includes('transcript')) {
          throw new YoutubeImportError(
            'TRANSCRIPT_UNAVAILABLE',
            404,
            '해당 영상의 자막을 가져올 수 없습니다.'
          );
        }
        if (error.message.toLowerCase().includes('quota')) {
          throw new YoutubeImportError(
            'YOUTUBE_QUOTA_EXCEEDED',
            429,
            'YouTube API 사용량이 초과되었습니다.'
          );
        }
      }

      throw new YoutubeImportError(
        'IMPORT_FAILED',
        500,
        'YouTube 영상을 불러오는데 실패했습니다.'
      );
    }
  }

  private assertEnv() {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new YoutubeImportError(
        'YOUTUBE_API_MISSING',
        500,
        'YOUTUBE_API_KEY가 설정되어 있지 않습니다.'
      );
    }
  }

  private async saveRecipe(
    recipeId: string,
    rawData: any,
    video: any
  ): Promise<void> {
    const snippet = video.snippet || {};
    const sourceUrl = `https://www.youtube.com/watch?v=${video.id}`;
    const title = snippet.title || '제목 미상';
    const copyright = snippet.channelTitle
      ? `Recipe by ${snippet.channelTitle}`
      : 'Recipe by YouTube Creator';
    const servings = snippet.defaultAudioLanguage === 'ko' ? '2' : DEFAULT_SERVINGS;
    const cookTime = this.formatCookTime(video.contentDetails?.duration);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO recipes (
          recipe_id, source_url, title, servings, cook_time, difficulty, copyright, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (recipe_id) DO UPDATE SET
          source_url = EXCLUDED.source_url,
          title = EXCLUDED.title,
          servings = EXCLUDED.servings,
          cook_time = EXCLUDED.cook_time,
          difficulty = EXCLUDED.difficulty,
          copyright = EXCLUDED.copyright,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()`,
        [
          recipeId,
          sourceUrl,
          title,
          servings,
          cookTime,
          DEFAULT_DIFFICULTY,
          copyright,
          JSON.stringify(rawData),
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private formatCookTime(isoDuration?: string | null) {
    if (!isoDuration) {
      return DEFAULT_COOK_TIME;
    }

    const match = isoDuration.match(
      /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i
    );
    if (!match) {
      return DEFAULT_COOK_TIME;
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    const totalMinutes = Math.max(
      1,
      Math.round(hours * 60 + minutes + seconds / 60)
    );
    return `${totalMinutes}분`;
  }

  /**
   * Check if text looks like an ingredient list
   * Common patterns: quantities (g, ml, 큰술, 작은술), ingredient names
   */
  private looksLikeIngredientList(text: string): boolean {
    if (!text || text.length < 20) {
      return false;
    }

    // Korean ingredient patterns
    const koreanIngredientPatterns = [
      /\d+g/i,           // 100g
      /\d+ml/i,          // 200ml
      /\d+큰술/,         // 2큰술
      /\d+작은술/,       // 1작은술
      /\d+개/,           // 3개
      /\d+컵/,           // 1컵
      /\d+T/i,           // 2T (tablespoon)
      /\d+t/i,           // 1t (teaspoon)
      /\[.*\]/,          // [재료], [분량] etc
    ];

    // Count how many patterns match
    let matchCount = 0;
    for (const pattern of koreanIngredientPatterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }

    // If 3+ patterns match, likely an ingredient list
    return matchCount >= 3;
  }

  /**
   * Save parsed recipe directly to cleaned_recipes table (no OpenAI processing)
   */
  private async saveParsedRecipe(recipeId: string, parsedRecipe: any): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Format ingredients as markdown list
      const ingredientsList = parsedRecipe.ingredients
        .map((ing: any) => {
          const unit = ing.unit || '';
          return `- ${ing.name} ${ing.amount}${unit}`;
        })
        .join('\n');

      // Format steps as numbered list with duration if available
      const stepsList = parsedRecipe.steps
        .map((step: any) => {
          const duration = step.duration ? ` (${step.duration})` : '';
          return `${step.stepNumber}. ${step.instruction}${duration}`;
        })
        .join('\n\n');

      // Format tips if available
      const tipsList = parsedRecipe.tips && parsedRecipe.tips.length > 0
        ? '\n\n## 팁\n' + parsedRecipe.tips.map((tip: string) => `- ${tip}`).join('\n')
        : '';

      // Combine into full recipe text
      const fullRecipe = `## 재료\n${ingredientsList}\n\n## 조리법\n${stepsList}${tipsList}`;

      // Insert into cleaned_recipes
      const result = await client.query(
        `INSERT INTO cleaned_recipes (
          recipe_id, title, servings, cook_time, difficulty,
          ingredients, steps, tips, full_recipe,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id, title`,
        [
          recipeId,
          parsedRecipe.title,
          parsedRecipe.servings || DEFAULT_SERVINGS,
          parsedRecipe.cookTime || DEFAULT_COOK_TIME,
          DEFAULT_DIFFICULTY,
          JSON.stringify(parsedRecipe.ingredients),
          JSON.stringify(parsedRecipe.steps),
          parsedRecipe.tips && parsedRecipe.tips.length > 0
            ? JSON.stringify(parsedRecipe.tips)
            : null,
          fullRecipe,
        ]
      );

      await client.query('COMMIT');

      console.log(`✅ [YouTube Service] Saved parsed recipe to cleaned_recipes (ID: ${result.rows[0].id})`);

      return {
        id: result.rows[0].id,
        title: result.rows[0].title,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[YouTube Service] Failed to save parsed recipe:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

