/**
 * 本地 HTTP 服务器 — 包装 lambdaIndex.handler 以便在本地 Node 环境运行 tov5parser
 *
 * 使用方式：
 *   node localServer.js [port]
 *   默认端口 3457
 *
 * 端口规范（toolchain 唯一真源: VLCode-Lite-agent-os/src/utils/port-conventions.js · 镜像
 *   /Users/ivx/Documents/Guides/Port_Convention_Guide.md）: VL Parser 固定 3456，
 *   tov5parser 取相邻 3457（不在已占用区间：3200-3209 · 4300 · 4310-4319 ·
 *   4610-4699 · 4000-4010 · 8092）。固定端口、不静默 fallback、互不冲突。
 *
 * 调用方式与线上 Lambda 完全一致（无需 cookie，转换是纯计算）：
 *   POST http://localhost:3457/
 *   Body: { "action":"convertV4ToV5", "v4CaseJson":{...}, "ntype":5 }
 */
import http from 'http';
import { handler } from './lambdaIndex.js';

const PORT = parseInt(process.argv[2] || '3457', 10);

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie, Authorization',
    });
    res.end();
    return;
  }

  // 只处理 POST
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 405, message: 'Method not allowed' }));
    return;
  }

  // 读取请求体
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  // 构造 Lambda event
  const event = {
    headers: {
      origin: req.headers.origin || '',
      'content-type': req.headers['content-type'] || 'application/json',
    },
    body,
  };

  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    const lambdaResult = await handler(event, {});
    const { statusCode, headers: rspHeaders, body: rspBody } = lambdaResult;

    // 确保 CORS
    const outHeaders = {
      ...rspHeaders,
      'Access-Control-Allow-Origin': '*',
    };

    res.writeHead(statusCode || 200, outHeaders);
    res.end(rspBody);
  } catch (err) {
    console.error('Lambda handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`tov5parser local server running at http://localhost:${PORT}`);
  console.log(`Usage: POST http://localhost:${PORT}/`);
  console.log(`  Body: {"action":"convertV4ToV5","v4CaseJson":{...},"ntype":5}`);
});
