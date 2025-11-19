import { WebSocketMessage } from '../types/voice';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ Backend connected');
        this.audioContext = new AudioContext({ sampleRate: 24000 });
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'audio') {
            this.playAudioChunk(message.data.audio);
          }
          
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(message.data);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
      };
    });
  }

  private async playAudioChunk(base64Audio: string) {
    if (!this.audioContext) return;

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = this.audioContext.createBuffer(
        1,
        bytes.length / 2,
        24000
      );

      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(bytes.buffer);

      for (let i = 0; i < channelData.length; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        channelData[i] = int16 / 32768.0;
      }

      this.audioQueue.push(audioBuffer);
      
      if (!this.isPlaying) {
        this.playQueue();
      }

    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  private async playQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;
    
    const source = this.audioContext!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext!.destination);
    
    source.onended = () => {
      this.playQueue();
    };

    source.start();
  }

  on(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  // PCM16 Base64를 직접 전송
  sendAudioChunk(pcm16Base64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio_chunk',
        data: pcm16Base64  // 이미 PCM16 Base64
      }));
    }
  }

  startStreaming() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'start_streaming'
      }));
    }
  }

  stopStreaming() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'stop_streaming'
      }));
    }
  }

  disconnect() {
    this.audioContext?.close();
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}