/**
 * YouTube Video Service
 * Simple wrapper around YouTube Data API v3 for video search
 */

import { google } from 'googleapis';

export class YoutubeVideoService {
  private youtube: any;

  constructor() {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set.');
    }
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    });
  }

  /**
   * Search for videos on YouTube
   */
  async searchVideos({ query, maxResults = 10, videoCaptionFilter = false }: { query: string; maxResults?: number; videoCaptionFilter?: boolean }) {
    try {
      const searchParams: any = {
        part: ['snippet'],
        q: query,
        maxResults,
        type: ['video'],
      };

      // Add caption filter if requested
      if (videoCaptionFilter) {
        searchParams.videoCaption = 'closedCaption';
      }

      const response = await this.youtube.search.list(searchParams);
      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to search videos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get top comments from a video
   * Retrieves the first pinned comment or top comments
   */
  async getTopComments(videoId: string, maxResults = 5): Promise<any[]> {
    try {
      const response = await this.youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        maxResults,
        order: 'relevance', // Get most relevant comments first
        textFormat: 'plainText',
      });

      return response.data.items || [];
    } catch (error) {
      console.error(`Failed to get comments for video ${videoId}:`, error);
      // Don't throw, just return empty array - comments might be disabled
      return [];
    }
  }
}
