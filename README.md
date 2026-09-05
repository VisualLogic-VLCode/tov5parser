# tov5parser

将 VisualLogic **旧版本案例 JSON** 转换为 **5.x 案例 JSON**。
当前已实现 **4.x → 5.x**（模块 `v4ToV5/`，lambda action `convertV4ToV5`）；
规划中：**3.x → 5.x**（届时新增平级模块 `v3ToV5/` 与 action `convertV3ToV5`）。

4.x 转换核心 `ConvertV4ToV5` 移植自 4.1 编辑器（VxEditor41
`src/utils/convertV4ToV5`），编辑器环境依赖由 `v4ToV5/env.js`
基于输入 JSON 与运行时组件映射重建。

产出的 5.x JSON 可继续交给 vlparser 的 `convertLegacyCaseJsonToVLangProject`
（或其 lambda 的 `legacyToVLang` action）转为 VLang 工程；本项目自身不依赖 vlparser。

## 库用法

```js
import { convertV4CaseJsonToV5CaseJson, loadRuntimeMaps } from '@visuallogic-vlcode/tov5parser';

loadRuntimeMaps(); // Node 环境：把包内 ivxMap.txt / legacyIvxMap.txt 载入 global（幂等）
const v5CaseJson = convertV4CaseJsonToV5CaseJson({
  v4CaseJson, // 4.1 编辑器 saveDealCase 产物：{ case, stage, server }
  ntype,      // 可选：4.x 平台案例记录的案例类型；缺省从 stage 根节点类型推断
});
```

需要获取结构化转换诊断时，使用详细接口；旧接口保持兼容：

```js
import {
  convertV4CaseJsonToV5CaseJsonDetailed,
  loadRuntimeMaps,
} from '@visuallogic-vlcode/tov5parser';

loadRuntimeMaps();
const { v5CaseJson, diagnostics } =
  convertV4CaseJsonToV5CaseJsonDetailed({ v4CaseJson, ntype });
```

`diagnostics` 是 `schemaVersion: 1` 的有界报告：

- `summary.droppedTotal`：公式降级为无值 AST，存在逻辑丢失，需要归因；
- `summary.customExprTotal`：公式保留为 `jsfn` 自定义表达式兜底，不单独等同于转换错误；
- `summary.truncated/categoryTruncated/phaseTruncated`：报告是否因安全上限而截断；
- `records`：按节点、事件块、属性、源码、阶段和错误分组后的定位信息。

详细接口只管理一次同步转换的诊断生命周期，不接收用户 token，也不改变转换规则。

需要集成 V4 → V5 JSON 转换，或继续将 V5 JSON 转为 VL 时，请参阅
[iVX V4 → V5 JSON → VL 开发集成指南](https://github.com/VisualLogic-VLCode/tov5parser/blob/main/docs/V4-to-V5-JSON-to-VL-Developer-Integration-Guide.md)。该指南说明两段转换的 Node.js 包调用方式、输入输出、DB 元数据准备和结果检查。

## Lambda

入口 `lambdaIndex.handler`，事件协议与 vlparser-parser lambda 一致（API Gateway proxy）：

```
POST body: { "action": "convertV4ToV5", "v4CaseJson": {...}, "ntype": 5 }
返回 body: { "code": 0, "message": "success", "data": { "v5CaseJson": {...} } }
```

actions：`version`、`convertV4ToV5`、`getTransferUrls`。
错误码：`10001` 参数错误、`10003` 转换失败、`10004` 响应超出 lambda 6MB 限制、
`10006` S3 中转通道异常。

### 大 JSON（S3 中转通道）

Lambda 同步调用请求/响应各限 6MB，超限的案例 JSON 走 S3 通道（三步，
调用方全程纯 HTTP，不需要 AWS 凭证）：

```bash
# 1. 签发上传地址（预签名 15 分钟有效）
curl -X POST <端点> -d '{"action":"getTransferUrls"}'
#    → { data: { uploadUrl, v4CaseJsonS3Key } }

# 2. PUT 上传大 JSON
curl -X PUT '<uploadUrl>' --data-binary @v4case.json

# 3. 转换（传 key 而非内联 JSON），结果同样落桶，返回预签名下载地址
curl -X POST <端点> -d '{"action":"convertV4ToV5","v4CaseJsonS3Key":"<key>","ntype":5}'
#    → { data: { v5CaseJsonS3Key, downloadUrl } }
curl '<downloadUrl>' -o v5case.json
```

中转数据在桶 `vl-case-json-converter` 的 `transfer/` 前缀下，由生命周期规则自动清理。
另有兜底：内联请求的转换结果若超 6MB，会自动落桶并返回 `downloadUrl`（而非报 10004）。

AWS 运维手册（凭证配置、查日志、回滚、一次性搭建命令记录、权限边界）见
[docs/aws-ops-runbook.md](docs/aws-ops-runbook.md)。

## 线上环境（2026-07-08 已部署）

- 分区/区域：AWS 中国区 `aws-cn` / `cn-northwest-1`（宁夏），账号 `587849590304`
- Lambda 函数：`vl-case-json-converter`（nodejs20.x / 2048MB / 120s），流量走 `prod` 别名
- 执行角色：`arn:aws-cn:iam::587849590304:role/vl-case-json-converter-lambda-role`
- API Gateway HTTP API：`vl-case-json-converter`（ApiId `ui9kfbjiwd`），集成指向 prod 别名
- **公网端点**：`https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/`
- 部署凭证：IAM 用户 `vl-case-json-converter-deployer`（仅 CLI），本机 profile
  `vl-case-json-converter-cn`，材料见 `vl-case-json-converter-aws-cn-access/`（已 gitignore）
- S3 桶：`vl-case-json-converter`（管理员创建）——`lambda-packages/` 放部署包、
  `transfer/in|out/` 大 JSON 中转（配生命周期自动过期）；执行角色已挂该桶读写
  内联策略 `s3-transfer-rw`
- 桶 CORS（2026-07-09 管理员配置）：`AllowedOrigins:*` / `AllowedMethods:PUT,GET` /
  `AllowedHeaders:*` / `MaxAgeSeconds:3600`——网页端 fetch 直连预签名地址（上传/下载）
  的预检与实际请求实测均放行，S3 通道对浏览器可用；部署账号无
  `s3:GetBucketCORS`/`PutBucketCORS` 权限，调整规则找管理员
- 资源命名范围：管理员按 `vl-case-json-converter*` 前缀授权（实测边界见
  [docs/aws-ops-runbook.md](docs/aws-ops-runbook.md) 第 3 节）

面向调用方的完整指引（curl 与网页 fetch、大 JSON 通道、错误码）见
[docs/api-calling-guide.md](docs/api-calling-guide.md)，可直接转发。调用示例：

V4/V5 底层执行语义不同、无法由转换器安全自动修复的问题见
[docs/manual-migration-issues.md](docs/manual-migration-issues.md)。

```bash
curl -X POST 'https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/' \
  -H 'Content-Type: application/json' \
  -d '{"action":"convertV4ToV5","v4CaseJson":{...},"ntype":5}'
```

请求与响应体上限 6MB（超限返回 code 10004）。端点绑定 prod 别名：
日常部署发布新版本并切别名后，端点不变、立即生效；回滚 = 把 prod 别名指回旧版本：

```bash
aws lambda update-alias --profile vl-case-json-converter-cn --region cn-northwest-1 \
  --function-name vl-case-json-converter --name prod --function-version <旧版本号>
```

## 本地调试（localServer）

与 vlparser 的 localServer 同模式：本地起 HTTP 服务包装 lambda handler，
不用部署即可用 curl/Postman 调试（端口取 3457，紧邻 vlparser 的 3456）：

```bash
node localServer.js          # http://localhost:3457
node localServer.js 8080     # 自定义端口

curl -X POST http://localhost:3457/ \
  -H 'Content-Type: application/json' \
  -d '{"action":"version"}'

curl -X POST http://localhost:3457/ \
  -H 'Content-Type: application/json' \
  -d @request.json            # {"action":"convertV4ToV5","v4CaseJson":{...},"ntype":5}
```

## 打包与部署

```bash
npm run package:runtime                # 只打包，产出 archive.runtime-tov5.zip
npm run deploy:lambda:prod -- --dry-run   # 打包 + 打印计划，不动 AWS
npm run deploy:lambda:prod -- --smoke     # 日常部署：zip 经 S3 中转→发版本→切 prod alias→冒烟
```

部署流程与 vlparser 同构（更新代码 → 发布版本 → 切 alias），差异是部署包小
（~1.6MB）直接上传、默认不走 S3 中转（传 `--bucket` 可切换 S3 模式）。
所有目标参数（函数名/区域/账号/profile）已写死在脚本 defaults，
均可用命令行参数覆盖（`--help`）。脚本会先校验凭证属于账号 587849590304
再动手，git 工作树需干净（或加 `--allow-dirty`）。

## 目录结构与同源关系

| 路径 | 说明 | 同源上游（同步时对照） |
|---|---|---|
| `v4ToV5/` | 转换核心（converter/env/utils/formulaCode） | VxEditor41 `src/utils/convertV4ToV5`（import 头与 env 委托为移植差异） |
| `utils/MapCreator.js` | 运行时组件映射读取/派生 | vlparser `utils/MapCreator.js`（整文件拷贝） |
| `legacyMaps/` | legacy 组件 overlay 基建与资产 | vlparser `legacyToVLang/legacyMaps/`（整文件拷贝） |
| `ivxMap.txt` | 5.x 运行时组件映射（VxWidgetMap/VxJaMap 等） | 基础快照来自 vlparser；`VxJaMap` 从 VxEditor41 线上 `locale.js` 同步 |

上游更新（尤其两份 map 资产与 MapCreator）需要手动同步拷贝。

当前 `ivxMap.txt.VxJaMap` 同步自线上编辑器实际引用的
`https://file3.ih5.cn/v35/locale/20260813145238/locale.js`
（`VxJaVer=20260813145234`）；同步时仅替换 `VxJaMap`，其余映射保持原快照。
