export interface TranscriptItem {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'audio' | 'transcript' | 'recipe' | 'status';
  data: any;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';