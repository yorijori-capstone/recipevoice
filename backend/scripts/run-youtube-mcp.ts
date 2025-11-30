/// <reference types="node" />
import 'dotenv/config';
import { spawn } from 'child_process';

const DEFAULT_LANG = 'ko';

if (!process.env.YOUTUBE_API_KEY) {
  console.error('[YouTube MCP] Missing YOUTUBE_API_KEY in environment (.env).');
  process.exit(1);
}

if (!process.env.YOUTUBE_TRANSCRIPT_LANG) {
  process.env.YOUTUBE_TRANSCRIPT_LANG = DEFAULT_LANG;
}

const useShell = process.platform === 'win32';
const npxCmd = 'npx';
const args = ['-y', 'zubeid-youtube-mcp-server'];

console.log(`[YouTube MCP] Launching with transcript lang=${process.env.YOUTUBE_TRANSCRIPT_LANG}`);
const child = spawn(npxCmd, args, {
  stdio: 'inherit',
  env: process.env,
  shell: useShell,
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('[YouTube MCP] Server stopped.');
  } else {
    console.error(`[YouTube MCP] Server exited with code ${code}.`);
    process.exit(code ?? 1);
  }
});

