# Agent 说明

## 本地接口转换：案例 JSON 过大时的处理方式

本地接口转换（`node localServer.js` → POST `http://localhost:3457/`，走 `lambdaIndex.handler`，与线上一致）有一个响应体积限制：handler 模拟线上 Lambda 的 **5.5MB 内联响应上限**（`lambdaIndex.js` 中 `INLINE_RESPONSE_LIMIT_BYTES`，写死、无本地绕过开关）。转出的 v5 JSON 超限时，handler 会尝试把结果落 S3 中转桶改返回下载链接，但本地通常没有 AWS 凭证，S3 兜底失败，最终接口返回：

```json
{ "code": 10004, "message": "response too large for inline lambda response", "data": { "s3FallbackError": "Could not load credentials from any providers", ... } }
```

注意此时**转换本身是成功的**（能走到 S3 兜底分支说明 `code 0` 且已产出 v5CaseJson），只是结果传不出来。

**遇到 code 10004 时，改用方式二直接调库转换**（同一个 `convertV4CaseJsonToV5CaseJson`，转换逻辑与接口完全一致，只是没有传输限制）：

```bash
npm run convert:local -- <相对 localCases/v4 的路径> --ntype <案例类型>
# 例：npm run convert:local -- frp-pad/app.json --ntype 1
```

两点注意：

- `ntype` 从案例目录的 README.md 元数据表里取（如 `| ntype | 1 |`）；不传时脚本从 stage 根节点推断。
- 输入是子目录案例（如 `frp-pad/app.json`）时，输出会平铺到 `localCases/v5/app.v5.json`（只取 basename），需要手动挪到惯例位置 `localCases/v5/<案例名>/app.v5.json`。

另外：这个体量的案例即使调线上接口也不会内联返回，只会走 S3 中转桶返回 `downloadUrl`。
