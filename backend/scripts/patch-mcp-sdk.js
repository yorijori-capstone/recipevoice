import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

const shim = `'use strict';

function loadModule(primary, fallback) {
  try {
    return require(primary);
  } catch (err) {
    if (fallback) {
      return require(fallback);
    }
    throw err;
  }
}

const serverCore = loadModule('./server/index.js', '../server/index.js');
const serverHighLevel = loadModule('./server/mcp.js', '../server/mcp.js');
const serverStdio = loadModule('./server/stdio.js', '../server/stdio.js');
const client = loadModule('./client/index.js', '../client/index.js');

const combined = Object.assign({}, serverCore, serverHighLevel, client);

if (serverHighLevel && typeof serverHighLevel.McpServer === 'function') {
  const BaseMcpServer = serverHighLevel.McpServer;
  class LegacyMcpServer extends BaseMcpServer {
    addMethod(definition) {
      const { name, description = '', parameters, returns, handler } = definition;
      if (!name) {
        throw new Error('Tool definition requires a name');
      }
      const wrapResult = async (fn, args) => {
        try {
          const value = await fn(args);
          if (value && typeof value === 'object' && (value.content || value.isError)) {
            return value;
          }
          const text =
            typeof value === 'string' ? value : JSON.stringify(value ?? null);
          return {
            content: [{ type: 'text', text }],
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          };
        }
      };

      this.tool(
        name,
        {
          description,
          inputSchema: parameters,
          outputSchema: returns,
        },
        async (args) => wrapResult(handler, args ?? {})
      );
    }

    listen(options = {}) {
      const target = this.server && typeof this.server.connect === 'function'
        ? this.server
        : this;
      if (typeof target.connect !== 'function') {
        throw new Error('McpServer.listen requires a server.connect implementation.');
      }
      const Transport =
        (options && options.transport) ||
        (serverStdio && serverStdio.StdioServerTransport);
      if (!Transport) {
        throw new Error('StdioServerTransport not available in this SDK build.');
      }
      const transportInstance =
        typeof Transport === 'function'
          ? new Transport(options.stdin, options.stdout)
          : Transport;
      return target.connect(transportInstance);
    }
  }

  combined.McpServer = LegacyMcpServer;
  combined.__BaseMcpServer = BaseMcpServer;
}

module.exports = combined;
module.exports.default = combined;
`;

const ensureDir = (filePath) => {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const ensureShimAt = (sdkDir) => {
  const target = join(sdkDir, 'dist', 'cjs', 'index.js');
  ensureDir(target);
  writeFileSync(target, shim, 'utf8');
  console.log(`[patch-mcp-sdk] Patched ${target}`);
};

const collectSdkDirs = (nodeModulesPath) => {
  const result = [];
  if (!existsSync(nodeModulesPath)) return result;
  const entries = readdirSync(nodeModulesPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '@modelcontextprotocol') {
      const scopePath = join(nodeModulesPath, entry.name);
      const sdkPath = join(scopePath, 'sdk');
      if (existsSync(sdkPath)) {
        result.push(sdkPath);
      }
      // continue scanning nested node_modules under packages inside scope
      const scopeEntries = readdirSync(scopePath, { withFileTypes: true });
      scopeEntries.forEach((sub) => {
        if (sub.isDirectory()) {
          const nestedNM = join(scopePath, sub.name, 'node_modules');
          if (existsSync(nestedNM)) {
            result.push(...collectSdkDirs(nestedNM));
          }
        }
      });
      continue;
    }
    const nestedNodeModules = join(nodeModulesPath, entry.name, 'node_modules');
    if (existsSync(nestedNodeModules)) {
      result.push(...collectSdkDirs(nestedNodeModules));
    }
  }
  return result;
};

const rootNodeModules = resolve(process.cwd(), 'node_modules');
const sdkDirs = collectSdkDirs(rootNodeModules);

if (sdkDirs.length === 0) {
  console.warn('[patch-mcp-sdk] No @modelcontextprotocol/sdk directories found.');
  process.exit(0);
}

sdkDirs.forEach(ensureShimAt);

