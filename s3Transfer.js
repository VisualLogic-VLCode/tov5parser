// S3 中转通道：超过 Lambda 6MB 同步限制的大 JSON 走这里。
//
// 布局（桶 vl-case-json-converter，transfer/ 前缀配有生命周期自动过期）：
//   transfer/in/<id>.v4.json   调用方经预签名 PUT 上传的待转换 JSON
//   transfer/out/<id>.v5.json  Lambda 写入的转换结果，经预签名 GET 下载
//
// SDK 依赖说明：AWS Lambda 的 Node.js 运行时内置 @aws-sdk/* v3，无需打包进
// 部署 zip（package-runtime 用 --omit=dev 剔除）；本地开发/localServer 场景
// 由 devDependencies 提供。因此这里用动态 import 懒加载，仅在真正走到
// S3 路径时才加载 SDK。
import { genXid } from './v4ToV5/env.js';

const TRANSFER_BUCKET = process.env.TRANSFER_BUCKET || 'vl-case-json-converter';
const TRANSFER_IN_PREFIX = 'transfer/in/';
const TRANSFER_OUT_PREFIX = 'transfer/out/';
const PRESIGN_EXPIRES_SECONDS = 900;

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import('@aws-sdk/client-s3'),
      import('@aws-sdk/s3-request-presigner'),
    ]).then(([clientS3, presigner]) => ({
      client: new clientS3.S3Client({
        region: process.env.AWS_REGION || 'cn-northwest-1',
      }),
      clientS3,
      presigner,
    }));
  }
  return sdkPromise;
}

function makeTransferKeys() {
  const id = `${Date.now()}-${genXid()}`;
  return {
    inKey: `${TRANSFER_IN_PREFIX}${id}.v4.json`,
    outKey: `${TRANSFER_OUT_PREFIX}${id}.v5.json`,
  };
}

// 只接受本通道生成的 in-key 形态，防止借接口读桶内任意对象
function isTransferInKey(key) {
  return (
    typeof key === 'string' &&
    key.startsWith(TRANSFER_IN_PREFIX) &&
    key.length > TRANSFER_IN_PREFIX.length &&
    !key.includes('..')
  );
}

function deriveOutKey(inKey) {
  const name = inKey.slice(TRANSFER_IN_PREFIX.length);
  const outName = name.endsWith('.v4.json')
    ? name.slice(0, -'.v4.json'.length) + '.v5.json'
    : `${name}.v5.json`;
  return TRANSFER_OUT_PREFIX + outName;
}

async function presignUpload(key) {
  const { client, clientS3, presigner } = await loadSdk();
  const cmd = new clientS3.PutObjectCommand({
    Bucket: TRANSFER_BUCKET,
    Key: key,
  });
  return presigner.getSignedUrl(client, cmd, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });
}

async function presignDownload(key) {
  const { client, clientS3, presigner } = await loadSdk();
  const cmd = new clientS3.GetObjectCommand({
    Bucket: TRANSFER_BUCKET,
    Key: key,
  });
  return presigner.getSignedUrl(client, cmd, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });
}

async function getJsonObject(key) {
  const { client, clientS3 } = await loadSdk();
  const rsp = await client.send(
    new clientS3.GetObjectCommand({ Bucket: TRANSFER_BUCKET, Key: key }),
  );
  const text = await rsp.Body.transformToString('utf8');
  return JSON.parse(text);
}

async function putJsonObject(key, value) {
  const { client, clientS3 } = await loadSdk();
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  await client.send(
    new clientS3.PutObjectCommand({
      Bucket: TRANSFER_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  );
}

export {
  TRANSFER_BUCKET,
  PRESIGN_EXPIRES_SECONDS,
  makeTransferKeys,
  isTransferInKey,
  deriveOutKey,
  presignUpload,
  presignDownload,
  getJsonObject,
  putJsonObject,
};
