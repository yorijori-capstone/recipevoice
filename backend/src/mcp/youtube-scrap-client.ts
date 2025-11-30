/**
 * YouTube Scrap MCP Client
 * Connects to youtube-scrap-mcp server for video content extraction
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface VideoContent {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  duration: string | null;
  thumbnails: Array<{
    quality: string;
    url: string;
  }>;
  transcript: Array<{
    text: string;
    offset: number;
    duration: number;
  }>;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export class YoutubeScrapClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  /**
   * Initialize the YouTube Scrap MCP server
   */
  async initialize(): Promise<void> {
    console.log('[YouTube Scrap Client] Initializing youtube-scrap-mcp server...');

    try {
      // Windows compatibility
      const isWindows = process.platform === 'win32';
      let command: string;
      let args: string[];

      if (isWindows) {
        command = 'cmd.exe';
        args = ['/c', 'npx', '-y', 'youtube-scrap-mcp'];
      } else {
        command = 'npx';
        args = ['-y', 'youtube-scrap-mcp'];
      }

      this.transport = new StdioClientTransport({
        command,
        args,
        stderr: 'pipe',
      });

      this.client = new Client(
        {
          name: 'yorijori-youtube-scrap-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await this.client.connect(this.transport);
      console.log('[YouTube Scrap Client] Connected successfully');
    } catch (error) {
      console.error('[YouTube Scrap Client] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get video content including transcript
   */
  async getVideoContent(videoId: string): Promise<VideoContent> {
    if (!this.client) {
      throw new Error('YouTube Scrap client not initialized');
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[YouTube Scrap Client] Fetching content for video: ${videoUrl}`);

    try {
      // Call the MCP tool to get video content
      const result = await this.client.callTool({
        name: 'extract-youtube',
        arguments: {
          url: videoUrl,
          includeTitle: true,
          includeDescription: true,
          includeTranscript: true,
        },
      });

      const content = this.parseToolResult(result);
      content.videoId = videoId; // Set the videoId
      console.log(`[YouTube Scrap Client] Successfully fetched content for ${videoId}`);

      return content;
    } catch (error: any) {
      console.error(`[YouTube Scrap Client] Failed to get video content:`, error);
      throw new Error(`Failed to extract video content: ${error.message}`);
    }
  }

  /**
   * Parse MCP tool result - youtube-scrap-mcp returns markdown text
   */
  private parseToolResult(result: any): VideoContent {
    if (!result.content || result.content.length === 0) {
      throw new Error('Empty tool result');
    }

    const content = result.content[0];

    if (content.type === 'text') {
      // youtube-scrap-mcp returns markdown-formatted text
      // Parse it to extract structured data
      const text = content.text;

      // Check for actual errors only (not warnings)
      // ⚠️ warnings are okay (e.g., Whisper not installed but subtitles available)
      if (text.includes('❌')) {
        throw new Error('YouTube content extraction failed: ' + text);
      }

      // If response is just a warning about Whisper, return minimal data
      // The service will fall back to description + comments
      if (text.includes('⚠️') && text.includes('Whisper')) {
        console.log('[YouTube Scrap Client] Warning: No transcript available (Whisper not installed and no subtitles)');
        return {
          videoId: '',
          title: 'Unknown Title',
          description: '',
          channelTitle: 'YouTube Creator',
          channelId: '',
          publishedAt: new Date().toISOString(),
          duration: null,
          thumbnails: [],
          transcript: [], // Empty transcript - will use comments + description instead
        };
      }

      // Extract title (format: # Title)
      const titleMatch = text.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

      // Extract description (between ## Description and ## Transcript)
      const descMatch = text.match(/##\s+Description\s+([\s\S]*?)(?=##|$)/);
      const description = descMatch ? descMatch[1].trim() : '';

      // Extract transcript (after ## Transcript)
      const transcriptMatch = text.match(/##\s+Transcript\s+([\s\S]*?)$/);
      const transcriptText = transcriptMatch ? transcriptMatch[1].trim() : '';

      // Parse transcript into segments (rough estimation)
      const transcript = transcriptText ? [
        {
          text: transcriptText,
          offset: 0,
          duration: 0,
        }
      ] : [];

      return {
        videoId: '', // Will be set by caller
        title,
        description,
        channelTitle: 'YouTube Creator',
        channelId: '',
        publishedAt: new Date().toISOString(),
        duration: null,
        thumbnails: [],
        transcript,
      };
    }

    throw new Error(`Unsupported content type: ${content.type}`);
  }

  /**
   * Shutdown the MCP server
   */
  async shutdown(): Promise<void> {
    console.log('[YouTube Scrap Client] Shutting down...');

    try {
      if (this.client) {
        await this.client.close();
      }

      if (this.transport) {
        await this.transport.close();
      }

      console.log('[YouTube Scrap Client] Shut down successfully');
    } catch (error) {
      console.error('[YouTube Scrap Client] Error during shutdown:', error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let youtubeScrapClientInstance: YoutubeScrapClient | null = null;

export async function getYoutubeScrapClient(): Promise<YoutubeScrapClient> {
  if (!youtubeScrapClientInstance) {
    youtubeScrapClientInstance = new YoutubeScrapClient();
    await youtubeScrapClientInstance.initialize();
  }
  return youtubeScrapClientInstance;
}

export async function shutdownYoutubeScrapClient(): Promise<void> {
  if (youtubeScrapClientInstance) {
    await youtubeScrapClientInstance.shutdown();
    youtubeScrapClientInstance = null;
  }
}
