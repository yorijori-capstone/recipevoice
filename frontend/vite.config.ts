import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,  // WebSocket 프록시
        timeout: 0,  // 🆕 타임아웃 무제한
        proxyTimeout: 0,  // 🆕 프록시 타임아웃 무제한
        configure: (proxy, options) => {
          // 🆕 WebSocket 타임아웃 설정
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            socket.setTimeout(0);  // 소켓 타임아웃 해제
          });
        }
      }
    }
  }
})