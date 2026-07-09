// Lambda 入口：4.x 案例 JSON → 5.x 案例 JSON
//
// 事件协议与 vlparser-parser lambda 一致（API Gateway proxy 形态）：
//   POST body: { "action": "convertV4ToV5", "v4CaseJson": {...}, "ntype": 5 }
//   返回:      { statusCode: 200, body: '{"code":0,"message":"success","data":{...}}' }
//
// actions:
//   version       → { code:0, data:{ packageName, packageVersion } }
//   convertV4ToV5 → { code:0, data:{ v5CaseJson } }
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { convertV4CaseJsonToV5CaseJson, loadRuntimeMaps } from './index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// 冷启动时载入组件映射（ivxMap.txt / legacyIvxMap.txt → global）
loadRuntimeMaps();

const VERSION_INFO = (() => {
  const info = { packageName: '@visuallogic-vlcode/tov5parser' };
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, './package.json'), 'utf8'),
    );
    if (pkg?.name) info.packageName = pkg.name;
    info.packageVersion = String(pkg?.version || '');
  } catch {}
  return info;
})();

// lambda 同步响应上限 6MB，留出包装余量
const INLINE_RESPONSE_LIMIT_BYTES = 5.5 * 1024 * 1024;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function handleConvertV4ToV5({ body }) {
  const v4CaseJson = body?.v4CaseJson;
  if (!isPlainObject(v4CaseJson)) {
    return {
      code: 10001,
      message: 'v4CaseJson must be a non-null object',
    };
  }
  try {
    const v5CaseJson = convertV4CaseJsonToV5CaseJson({
      v4CaseJson,
      ntype: body?.ntype,
    });
    return {
      code: 0,
      message: 'success',
      data: { v5CaseJson },
    };
  } catch (error) {
    return {
      code: 10003,
      message: 'v4 to v5 conversion failed',
      data: {
        errorMessage: error?.message || String(error),
      },
    };
  }
}

export const handler = async (event) => {
  const { headers } = event || {};
  const { origin } = headers || {};

  let body = {};
  try {
    body = JSON.parse(event.body);
  } catch (e) {}
  // 兼容直接 invoke（无 API Gateway 包装）的事件形态
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    if (isPlainObject(event) && event.action) body = event;
  }
  const { action } = body || {};

  let output;
  switch (action) {
    case 'version': {
      output = { code: 0, message: 'ok', data: { ...VERSION_INFO } };
      break;
    }
    case 'convertV4ToV5': {
      output = handleConvertV4ToV5({ body });
      break;
    }
    default: {
      output = {
        code: 10001,
        message: !action ? 'action is empty' : `action ${action} not support`,
      };
      break;
    }
  }

  const outHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': true,
  };
  if (!origin) delete outHeaders['Access-Control-Allow-Credentials'];

  let responseBody = JSON.stringify(output);
  const responseBytes = Buffer.byteLength(responseBody, 'utf8');
  if (responseBytes > INLINE_RESPONSE_LIMIT_BYTES) {
    responseBody = JSON.stringify({
      code: 10004,
      message: 'response too large for inline lambda response',
      data: {
        action,
        estimatedBytes: responseBytes,
        limitBytes: INLINE_RESPONSE_LIMIT_BYTES,
      },
    });
  }

  return { statusCode: 200, headers: outHeaders, body: responseBody };
};
