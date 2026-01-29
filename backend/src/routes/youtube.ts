import express from 'express';
import {
  YoutubeImportService,
  YoutubeImportError,
} from '../services/youtubeImportService.js';

const router = express.Router();

// Lazy initialization to ensure environment variables are loaded
let youtubeService: YoutubeImportService | null = null;

function getYoutubeService(): YoutubeImportService {
  if (!youtubeService) {
    youtubeService = new YoutubeImportService();
  }
  return youtubeService;
}

/**
 * GET /api/youtube/search?query=<keyword>&limit=5&captionFilter=true
 */
router.get('/search', async (req, res) => {
  console.log('[YouTube API] /search endpoint hit with query:', req.query);
  try {
    const query = (req.query.query as string) || (req.query.q as string) || '';
    const limit = parseInt((req.query.limit as string) || '5', 10);
    const captionFilter = req.query.captionFilter === 'true';
    console.log('[YouTube API] Calling searchVideos with:', { query, limit, captionFilter });
    const results = await getYoutubeService().searchVideos(query, limit, captionFilter);
    console.log('[YouTube API] Search successful, found', results.length, 'videos');

    res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    if (error instanceof YoutubeImportError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error('[YouTube API] search error:', error);
    res.status(500).json({
      success: false,
      code: 'UNKNOWN_ERROR',
      message: 'YouTube 검색 중 알 수 없는 오류가 발생했습니다.',
    });
  }
});

/**
 * POST /api/youtube/import
 * {
 *   "videoId": "abc",
 *   "language": "ko",
 *   "searchQuery": "샘플"
 * }
 */
router.post('/import', async (req, res) => {
  console.log('[YouTube API] /import endpoint hit with body:', req.body);
  try {
    const { videoId, language, searchQuery } = req.body || {};
    console.log('[YouTube API] Importing video:', { videoId, language, searchQuery });
    const result = await getYoutubeService().importVideo({
      videoId,
      language,
      searchQuery,
    });
    console.log('[YouTube API] Import successful:', result);

    res.json({
      success: true,
      recipeId: result.recipeId,
      cleanedRecipeId: result.cleanedRecipeId,
      title: result.title,
    });
  } catch (error: any) {
    if (error instanceof YoutubeImportError) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error('[YouTube API] import error:', error);
    res.status(500).json({
      success: false,
      code: 'UNKNOWN_ERROR',
      message: 'YouTube 영상을 가져오는 중 오류가 발생했습니다.',
    });
  }
});

export default router;

