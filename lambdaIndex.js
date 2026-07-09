// Lambda 入口：4.x 案例 JSON → 5.x 案例 JSON
//
// 事件协议与 vlparser-parser lambda 一致（API Gateway proxy 形态）：
//   POST body: { "action": "convertV4ToV5", "v4CaseJson": {...}, "ntype": 5 }
//   返回:      { statusCode: 200, body: '{"code":0,"message":"success","data":{...}}' }
//
// actions:
//   version         → { code:0, data:{ packageName, packageVersion } }
//   convertV4ToV5   → 传 v4CaseJson（内联，≤6MB）返回 { v5CaseJson }；
//                     传 v4CaseJsonS3Key（大 JSON 走 S3 通道）返回
//                     { v5CaseJsonS3Key, downloadUrl }
//   getTransferUrls → 大 JSON 通道第一步：返回预签名上传地址
//                     { uploadUrl, v4CaseJsonS3Key }
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { convertV4CaseJsonToV5CaseJson, loadRuntimeMaps } from './index.js';
import {
  PRESIGN_EXPIRES_SECONDS,
  makeTransferKeys,
  isTransferInKey,
  deriveOutKey,
  presignUpload,
  presignDownload,
  getJsonObject,
  putJsonObject,
} from './s3Transfer.js';

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

async function handleConvertV4ToV5({ body }) {
  // 大 JSON 通道：v4CaseJsonS3Key 从中转桶读入，结果写回桶并返回下载地址
  const s3Key = body?.v4CaseJsonS3Key;
  if (s3Key != null) {
    if (!isTransferInKey(s3Key)) {
      return {
        code: 10001,
        message: 'v4CaseJsonS3Key must be a key under transfer/in/',
      };
    }
    let v4CaseJsonFromS3;
    try {
      v4CaseJsonFromS3 = await getJsonObject(s3Key);
    } catch (error) {
      return {
        code: 10006,
        message: 'failed to read v4CaseJsonS3Key from transfer bucket',
        data: { errorMessage: error?.message || String(error) },
      };
    }
    if (!isPlainObject(v4CaseJsonFromS3)) {
      return {
        code: 10001,
        message: 'object at v4CaseJsonS3Key must be a JSON object',
      };
    }
    try {
      const v5CaseJson = convertV4CaseJsonToV5CaseJson({
        v4CaseJson: v4CaseJsonFromS3,
        ntype: body?.ntype,
      });
      const outKey = deriveOutKey(s3Key);
      await putJsonObject(outKey, v5CaseJson);
      const downloadUrl = await presignDownload(outKey);
      return {
        code: 0,
        message: 'success',
        data: {
          v5CaseJsonS3Key: outKey,
          downloadUrl,
          expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
        },
      };
    } catch (error) {
      return {
        code: 10003,
        message: 'v4 to v5 conversion failed',
        data: { errorMessage: error?.message || String(error) },
      };
    }
  }

  // 内联路径（≤6MB）
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

// 大 JSON 通道第一步：签发上传地址。
// 用法：PUT 大 JSON 到 uploadUrl → 调 convertV4ToV5 传回 v4CaseJsonS3Key。
async function handleGetTransferUrls() {
  try {
    const { inKey } = makeTransferKeys();
    const uploadUrl = await presignUpload(inKey);
    return {
      code: 0,
      message: 'success',
      data: {
        uploadUrl,
        v4CaseJsonS3Key: inKey,
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      },
    };
  } catch (error) {
    return {
      code: 10006,
      message: 's3 transfer channel unavailable',
      data: { errorMessage: error?.message || String(error) },
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
      output = await handleConvertV4ToV5({ body });
      break;
    }
    case 'getTransferUrls': {
      output = await handleGetTransferUrls();
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
    // 内联结果超限兜底：转换成功的结果落 S3 中转桶，改返回下载指针
    if (output?.code === 0 && output?.data?.v5CaseJson) {
      try {
        const { outKey } = makeTransferKeys();
        await putJsonObject(outKey, output.data.v5CaseJson);
        const downloadUrl = await presignDownload(outKey);
        responseBody = JSON.stringify({
          code: 0,
          message:
            'success (result too large for inline response; stored to transfer bucket)',
          data: {
            v5CaseJsonS3Key: outKey,
            downloadUrl,
            expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
            estimatedBytes: responseBytes,
          },
        });
      } catch (error) {
        responseBody = JSON.stringify({
          code: 10004,
          message: 'response too large for inline lambda response',
          data: {
            action,
            estimatedBytes: responseBytes,
            limitBytes: INLINE_RESPONSE_LIMIT_BYTES,
            s3FallbackError: error?.message || String(error),
          },
        });
      }
    } else {
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
  }

  return { statusCode: 200, headers: outHeaders, body: responseBody };
};
