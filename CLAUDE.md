# 项目说明（Claude Code）

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

## 转换器修复后的固定发布流程

每次修改本项目转换器以修复转换错误后，在修复和回归验证通过的前提下，**无需再次询问是否提交或发布**，自动完成以下流程：

1. 重转触发问题的真实案例并完成结构、公式参数和服务引用审计。
2. 只暂存本次任务相关文件，在 tov5parser 创建 Git 提交并推送当前分支；不得混入用户已有的无关修改。
3. 使用项目部署脚本发布生产 Lambda，运行完整测试和冒烟验证，将 `prod` 别名切换到新版本，并记录版本号与代码摘要。
4. 将同一转换器修复同步到 `../VxEditor41/src/utils/convertV4ToV5` 的对应实现，保留编辑器侧特有依赖和用户已有修改。
5. 完成 VxEditor41 的定向检查和可行的生产构建，只提交本次同步的转换器文件并推送当前分支。
6. 最终汇报两个仓库的提交哈希、远端同步状态和 Lambda 生产版本。

如果测试、构建、推送或部署失败，应停止后续发布步骤，保留现场并报告具体错误；禁止通过变基、强推或覆盖用户修改来绕过失败。
