# vl-case-json-converter 接口调用指南

将 VisualLogic **4.x 案例 JSON** 转换为 **5.x 案例 JSON** 的线上接口。
本文面向接口调用方，自包含、可直接转发；命令行示例依赖 `curl` 与 `jq`。

- **端点**：`https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/`
  （AWS 中国区宁夏，无需任何 AWS 凭证）
- **协议**：一律 `POST /`，请求体为 JSON，用 `action` 字段区分操作；
  返回体统一为 `{ "code": 0, "message": "...", "data": {...} }`，`code: 0` 表示成功
- **输入**：4.x 案例 JSON 指 4.1 编辑器 saveDealCase 的产物（`{ case, stage, server }` 结构）
- **请求尺寸**：Lambda 同步调用存在 6MB 载荷限制，需为 API Gateway 事件包装预留空间。本文示例以完整请求 JSON（含 `action`、`v4CaseJson`、`ntype`）紧凑序列化后 **5,500,000 字节**作为建议分流阈值，达到阈值时走 S3 中转通道（见第 3 节）；这不是服务端的请求阈值常量。
- **响应尺寸**：当前实现的内联响应阈值为 **5.5 MiB（5,767,168 字节）**，按完整响应 JSON 的 UTF-8 字节数计算。超过阈值且转换成功时尝试 S3 兜底，成功后返回下载地址；小输入也可能产生需要下载的大结果。
- **诊断能力**：当前接口调用简化转换接口，不返回 `diagnostics`；`code: 0` 不能用来判断诊断是否为零。需要诊断审阅门禁时，应使用 Node.js Detailed 接口或自行封装服务，见[开发嵌入指南](V4-to-V5-JSON-to-VL-Developer-Integration-Guide.md#13-结果如何处理)。

## 1. 探活

```bash
API='https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/'

curl -s -X POST "$API" -H 'Content-Type: application/json' -d '{"action":"version"}'
# → {"code":0,"message":"ok","data":{"packageName":"@visuallogic-vlcode/tov5parser","packageVersion":"..."}}
```

## 2. 小请求：内联调用

先检查完整请求体积；下面的转换调用适用于请求小于建议分流阈值的情况。

```bash
# 包壳后量体积：< 5500000 字节走本节，否则走第 3 节
jq -nc --slurpfile c v4case.json '{action:"convertV4ToV5", v4CaseJson:$c[0]}' > request.json
wc -c < request.json

# 转换后先检查业务状态，再处理内联结果或下载地址
if curl -sS -f -X POST "$API" -H 'Content-Type: application/json' \
  --data-binary @request.json -o response.json; then
  if jq -e '.code == 0' response.json > /dev/null; then
    DOWNLOAD_URL=$(jq -r '.data.downloadUrl // empty' response.json)
    if [ -n "$DOWNLOAD_URL" ]; then
      curl -sS -f "$DOWNLOAD_URL" -o v5case.json
    else
      jq -e '.data.v5CaseJson' response.json > v5case.json
    fi
  else
    jq '{code, message}' response.json
  fi
fi
```

`ntype`（4.x 平台案例记录的案例类型）可选：包壳时加 `, ntype:5`；
不传则从 stage 根节点类型自动推断。

## 3. 大请求：S3 中转通道

完整请求达到建议分流阈值时使用本节，也可以主动让较小案例走此通道。三步纯 HTTP，预签名地址 15 分钟有效，中转文件由生命周期规则自动清理：

```bash
# ① 签发上传地址
RSP=$(curl -s -X POST "$API" -H 'Content-Type: application/json' -d '{"action":"getTransferUrls"}')
UPLOAD_URL=$(echo "$RSP" | jq -r '.data.uploadUrl')
S3KEY=$(echo "$RSP" | jq -r '.data.v4CaseJsonS3Key')

# ② PUT 上传（建议先紧凑化，体积可小数倍，上传更快）
jq -c . v4case.json > v4case.compact.json
curl -s -f -X PUT "$UPLOAD_URL" -H 'Content-Type: application/json' \
  --data-binary @v4case.compact.json && echo 上传成功

# ③ 转换（传 key 而非内联 JSON），再从预签名地址下载结果
RSP=$(curl -s -X POST "$API" -H 'Content-Type: application/json' \
  -d "{\"action\":\"convertV4ToV5\",\"v4CaseJsonS3Key\":\"$S3KEY\"}")
echo "$RSP" | jq -r '.code, .message'          # 预期 0 / success
curl -s -f "$(echo "$RSP" | jq -r '.data.downloadUrl')" -o v5case.json
```

下载到的文件就是 v5 案例 JSON 本体（顶层 `case`/`stage`/`server`），无外层包装，也不包含 `diagnostics`。

## 4. 网页（浏览器 fetch）调用

API 端点与 S3 桶的 CORS 均已配置并实测放行，两条路径都可在浏览器直接调用：

```js
const API = 'https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/';

const post = body => fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json());

// 小案例：内联
async function convertInline(v4CaseJson, ntype) {
  const rsp = await post({ action: 'convertV4ToV5', v4CaseJson, ntype });
  if (rsp.code !== 0) throw new Error(`${rsp.code}: ${rsp.message}`);
  // 完整响应超过 5.5 MiB 且 S3 兜底成功时，改返 downloadUrl
  if (rsp.data.downloadUrl) return fetch(rsp.data.downloadUrl).then(r => r.json());
  return rsp.data.v5CaseJson;
}

// 大案例：S3 中转
async function convertViaS3(v4CaseJson, ntype) {
  const t = await post({ action: 'getTransferUrls' });
  if (t.code !== 0) throw new Error(`${t.code}: ${t.message}`);

  const up = await fetch(t.data.uploadUrl, {
    method: 'PUT',
    body: JSON.stringify(v4CaseJson),
  });
  if (!up.ok) throw new Error(`上传失败: ${up.status}`);

  const rsp = await post({
    action: 'convertV4ToV5',
    v4CaseJsonS3Key: t.data.v4CaseJsonS3Key,
    ntype,
  });
  if (rsp.code !== 0) throw new Error(`${rsp.code}: ${rsp.message}`);
  return fetch(rsp.data.downloadUrl).then(r => r.json());
}

// 自动分流：按完整请求 JSON 的 UTF-8 字节数选路径
async function convertV4ToV5(v4CaseJson, ntype) {
  const request = { action: 'convertV4ToV5', v4CaseJson, ntype };
  const bytes = new Blob([JSON.stringify(request)]).size;
  return bytes < 5_500_000
    ? convertInline(v4CaseJson, ntype)
    : convertViaS3(v4CaseJson, ntype);
}
```

## 5. 响应约定与错误码

| code | 含义 |
|---|---|
| 0 | 成功 |
| 10001 | 参数错误（action 缺失/不支持、v4CaseJson 非对象等） |
| 10003 | 转换失败（详情在 `data.errorMessage`） |
| 10004 | 完整响应超过 5.5 MiB，且无法通过 S3 兜底交付结果 |
| 10006 | S3 中转通道异常 |

- 内联转换成功时结果在 `data.v5CaseJson`；若完整响应超过 5.5 MiB，会尝试写入 S3，
  成功后返回 `data.downloadUrl` 与 `data.expiresInSeconds`，按 URL 下载即可
- S3 通道转换成功时返回 `data.v5CaseJsonS3Key` 与 `data.downloadUrl`
- 两条转换路径均不返回 `diagnostics`
- `10004` 若含 `data.s3FallbackError`，表示已生成 V5 结果，但写入 S3 或生成下载地址失败；不能据此归因为转换失败。`data.estimatedBytes` 是原响应字节数，`data.limitBytes` 是内联响应阈值
- 预签名地址（上传/下载）有效期 15 分钟，过期重新签发
- 参考耗时：6MB 案例转换本身约 3~4 秒，大文件上传/下载时间取决于调用方带宽

## 6. 常见问题

- **PUT 上传返回 403**：预签名地址已过期（15 分钟），重新调 `getTransferUrls`
- **转换返回 10003**：输入不是合法的 4.x 案例 JSON——确认顶层是
  `{ case, stage, server }` 结构且来自 4.1 编辑器导出
- **小输入也返回下载地址**：转换后的完整响应超过了 5.5 MiB，必须按 `data.downloadUrl` 下载，不能只读取 `data.v5CaseJson`
- **本地 HTTP 返回 10004**：本地服务复用同一 Lambda handler，也受 5.5 MiB 内联响应阈值限制。若含 `data.s3FallbackError`，转换已成功但 S3 兜底不可用；可改用 Node.js 包直接转换，避免 HTTP 响应体积限制
- **浏览器报 CORS 错误**：确认请求方法与头部无超纲
  （S3 直连只放行 `PUT`/`GET`；API 端点放行 `Content-Type` 头）
