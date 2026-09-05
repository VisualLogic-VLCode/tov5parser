# iVX V4 → V5 JSON → VL 开发集成指南

把一个 V4 案例转为 VL，只需要完成两段转换：

```text
原始 V4 JSON + ntype
        │ tov5parser
        ▼
     V5 JSON
        │ vlparser（Legacy 转换路径）
        ▼
     VL 文件集
```

| 阶段 | 调用哪个包 | 传入什么 | 得到什么 |
|---|---|---|---|
| V4 → V5 JSON | `@visuallogic-vlcode/tov5parser@1.2.11` | `v4CaseJson`、可选 `ntype` | `v5CaseJson`、`diagnostics` |
| V5 JSON → VL | `@visuallogic-vlcode/vlparser@1.0.42` | `legacyCaseJson: v5CaseJson`、可选 DB 元数据 | `files`、`reports`、`errRecordList` 等 |

**第一段的 `v5CaseJson`，就是第二段的 `legacyCaseJson`。无需先另存一个平台 V5 案例。** 两段之间可以用进程消息或 JSON 文件传递数据；如果输入已经是 V5 JSON，直接执行第二段。

本文只介绍 Node.js 包调用。两段示例分别运行在独立进程或 Worker 中，避免两个包的全局组件映射相互覆盖。整条链路建议使用 Node.js 20。

## 第一部分：V4 → V5 JSON

### 1.1 安装

```bash
npm install --save-exact \
  https://github.com/VisualLogic-VLCode/tov5parser/releases/download/v1.2.11/tov5parser-1.2.11.tgz
```

该包包含转换代码、映射和运行依赖，要求 Node.js `>=18`。[发布版本为 v1.2.11](https://github.com/VisualLogic-VLCode/tov5parser/releases/tag/v1.2.11)，tarball SHA-256：

```text
25cd12b3a28757706ed93cd2006a6aaf41ea312e0217d2224a6809f87685936a
```

### 1.2 调用：传 V4 JSON，取 V5 JSON

```js
import {
  loadRuntimeMaps,
  convertV4CaseJsonToV5CaseJsonDetailed,
} from '@visuallogic-vlcode/tov5parser';

loadRuntimeMaps(); // 进程启动时加载包内映射，重复调用安全。

export function v4ToV5(v4CaseJson, ntype) {
  const { v5CaseJson, diagnostics } =
    convertV4CaseJsonToV5CaseJsonDetailed({ v4CaseJson, ntype });

  return { v5CaseJson, diagnostics };
}
```

| 字段 | 含义 |
|---|---|
| 输入 `v4CaseJson` | V4.1 编辑器 `saveDealCase` 导出的完整 JSON，通常包含 `case`、`stage`、`server` |
| 输入 `ntype` | 平台记录中的案例类型；可省略，由 Converter 从 `stage` 根节点推断 |
| 输出 `v5CaseJson` | 完整的 V5 案例 JSON，作为第二段输入 |
| 输出 `diagnostics` | 第一段转换诊断，单独保存和审阅 |

这是**同步调用**。原 V4 的 `nid` 由调用方自己保留，Converter 不接收 `nid`，也不会生成新的平台案例 `nid`。

### 1.3 结果如何处理

把 **`v5CaseJson` 对象本身**交给第二段；不要传整个 `{ v5CaseJson, diagnostics }` 包装对象或文件路径。

第一段诊断使用 `schemaVersion: 1`：

- `summary.droppedTotal > 0`：需要审阅。它统计逻辑丢失或迁移失败，包括公式降级和 `function-local-init` 初始化迁移失败，不全是无值 AST。
- `summary.truncated`、`summary.categoryTruncated`、`summary.phaseTruncated`：任一为 `true`，说明报告被截断，需要审阅。
- `summary.customExprTotal`：自定义表达式兜底数量，不单独等于转换错误。

用 `records` 中的 `phase/errorType/message` 定位问题；`function-local-init` 记录还应保留 `eventName`、`affectedNodeIds` 和 `lifecycleDetails`。第二段成功不能清除第一段未解决的诊断。

独立包接收完整的 V4 案例 JSON，返回 V5 案例 JSON 和转换诊断。它不连接 iVX 平台，也不负责案例获取、用户鉴权、输入版本识别、结果保存或运行时业务验证；这些外围能力由接入系统自行提供。

## 第二部分：V5 JSON → VL

本指南使用 `vlparser` 的 **Legacy 转换路径**，不用额外传 `mode: 'legacy'`。接口名中的 `legacyCaseJson` 指旧编辑器 Case JSON，输入仍然是第一段产出的 V5 JSON；输出可能保留 `Legacy*` 组件和兼容脚本。

### 2.1 安装

在用户级 `.npmrc` 中配置 GitHub Packages：

```ini
@visuallogic-vlcode:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

通过安全环境注入有 `read:packages` 及包访问权限的 token，然后安装：

```bash
npm install --save-exact @visuallogic-vlcode/vlparser@1.0.42
```

[该版本已发布](https://github.com/VisualLogic-VLCode/vlparser/actions/runs/33942594999)，对应 [v1.0.42 标签](https://github.com/VisualLogic-VLCode/vlparser/tree/v1.0.42)，源码提交 `21b5a6e95d32b10a69e104df407bed5c62e45497`，声明的 VL 版本为 `4.4.4`。建议 Node.js 20；运行依赖由 npm 安装。不要提交 token。

### 2.2 调用：传 V5 JSON，取 VL 文件集

**无 DB，或已有完整 DB 元数据时，用这个本地接口。**

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { convertLegacyCaseJsonToVLangProject } =
  require('@visuallogic-vlcode/vlparser/runtime'); // 自动加载包内映射。

export async function v5ToVl(v5CaseJson, metadata = {}) {
  const result = await convertLegacyCaseJsonToVLangProject({
    legacyCaseJson: v5CaseJson, // 就是第一段返回的 v5CaseJson。
    options: {
      ...metadata,             // 无 DB 时省略；有 DB 时见下表。
      diagnosticsMode: 'summary',
      variableNamePolicy: 'ascii',
    },
  });

  return result;
}
```

这是**异步调用**，需要 `await`。runtime 入口使用 CommonJS；上面的 `createRequire` 让 ES Module 应用可以调用它。

| 输入 | 传什么 |
|---|---|
| `v5CaseJson` | 第一段返回的 V5 JSON 对象，包含案例实际需要的 `case/stage/server` 内容 |
| `metadata.dbInfoMap` | 有 DB 时提供完整表元数据，包含真实表 ID、字段、索引和关系等；不是表名列表 |
| `metadata.legacyLeagueDbInfoMap` | 涉及联表视图时，按稳定视图 ID 提供视图定义，并在 `dbInfoMap` 中提供底层表元数据 |
| `metadata.backendCaseJson` | 前后端分属不同案例时，提供对应的后端 V5 JSON，并准备其 DB 元数据；不会自动读取同组其他案例 |

例如 `dbInfoMap` 中的一张表示意如下，必须替换为实际引用的表及其完整定义：

```json
{
  "dbInfoMap": {
    "orders": {
      "name": "Orders",
      "cols": [{ "name": "title", "kind": "text" }],
      "indexes": [],
      "tableRelations": []
    }
  }
}
```

本地接口不按 `nid` 查询平台，DB 元数据要显式传入 `options`。示例使用有摘要报告的 `summary` 模式；排查问题可改用 `full`。`ascii` 用于兼容尚未确认支持 Unicode 变量名的下游，确认编辑器/解析器版本一致后可改用默认的 `preserve-valid-unicode`。

### 2.3 有 DB 时，先准备元数据

**已导出完整 DB 元数据时，直接传给 2.2 节的 `metadata`，转换不需要 `nid` 或平台登录态。**

如果尚未导出，接入系统应先在有读取权限的环境中，按**原 V4 案例的 `nid`**取得 CaseInfo 和所引用 DB 的字段、索引、关系及视图定义，整理为 `dbInfoMap/legacyLeagueDbInfoMap` 后再调用转换器。

| 情况 | 调用前需要准备什么 |
|---|---|
| 无 DB | V5 JSON 即可 |
| 有完整 DB 元数据 | V5 JSON + 元数据对象 |
| 缺少 DB 元数据 | 保留原 V4 `nid`，由接入系统读取并导出元数据后，再按上一行调用 |

原案例可以仍是 V4，**不需要创建平台 V5 案例**。原 `nid` 用于准备资源元数据；第二段接收的 `legacyCaseJson` 仍是第一段返回的 V5 JSON。

本指南中的 `convertLegacyCaseJsonToVLangProject` 不会仅凭 `nid` 自动查询 DB。需确保元数据来自实际引用的原资源，并与 V5 JSON 的 `dbId`、作用域对应；仅有前端 `nid` 也不会自动取得独立后端案例的资源。

### 2.4 返回的数据是什么

| 字段 | 用途 |
|---|---|
| `result.files` | 相对路径 → 内容字符串，交付的 VL 文件集 |
| `result.reports` | 迁移摘要和报告，用于检查状态及未解决问题 |
| `result.errRecordList` | 构建诊断，用于定位错误和警告 |

`files` 是**一个多文件项目**，可能包含 `Apps/*.vx`、`Sections/*.sc`、`ExtComponents/*.cp`、`Services/*.vs`、`Database/*.vdb` 等。按实际返回的相对路径保存，不能只拿首页文件。

例如 `result.files` 的结构如下（内容为示意，文件名以实际输出为准）：

```json
{
  "Apps/Main.vx": "这里是该文件的 VL 源码字符串",
  "Database/Db.vdb": "这里是数据库定义的 VL 源码字符串",
  "Config/vl.profile.json": "这里是配置文件的 JSON 文本字符串"
}
```

必须保留 `Config/vl.profile.json`、`Config/legacy.module-vl.json` 和 `LegacyScripts/*.vjs`；`Process/*` 是审计报告，可单独归档。`.vdb` 是数据库定义文本，生成它不等于已经创建目标数据库或完成数据迁移。输出写入磁盘时应限定根目录，拒绝越界路径。

### 2.5 至少检查什么

1. 第一段：保存并处理 `diagnostics`，规则见 1.3 节。
2. 第二段：读取 `reports.migrationSummary.projectFileReadinessStatus`，应为 `ready`，同时审阅 `errRecordList`。`full` 模式的摘要位于 `reports.conversionManifest.migrationSummary`；字段缺失不能当作通过。
3. 含 DB：确认输入元数据覆盖所有引用的表和视图，再核对 `.vdb` 的字段、索引和关系。生成了文件不代表数据库定义完整。
4. 最终 VL 文件集再做一次导入检查，并由目标环境验证业务行为。

在第二段进程中，可使用同一个 runtime 包进行**不部署**的导入检查：

```js
const { AgentsProcessor } = require('@visuallogic-vlcode/vlparser/runtime');
const projectFiles = Object.fromEntries(
  Object.entries(result.files).filter(([name]) => !name.startsWith('Process/')),
);
const checked = await AgentsProcessor.tryParsePjtFile({
  VLangMap: projectFiles,
  lintMode: 'legacy',
  dbEngine: 'pg', // MySQL 案例使用 mysql。
});
// 检查 checked.errList、checked.summary 和 checked.fatalParseFailed。
```

转换就绪、可导入和业务验收是不同结论。`roundTripReady` 也只表示表达式可经 VL 重建为等价 CaseJson AST。

### 2.6 交付注意事项

- 固定两个包及下游编辑器版本，保存 lockfile、诊断和脱敏验收样例，不直接跟踪 `main/latest`。第一段发布包见 1.1 节，第二段发布记录见 2.1 节。
- 调用方负责输入读取、异常处理、结果保存，以及大案例的内存和执行时限。案例 JSON、业务源码和敏感元数据不应写入普通日志。
- `tov5parser` 标记为 `UNLICENSED`，外部使用需取得适用授权；`vlparser` 包元数据为 `ISC`，分别核对交付许可。

本指南核对日期为 2026-09-05。第二段接口依据 [v1.0.42 包入口](https://github.com/VisualLogic-VLCode/vlparser/blob/v1.0.42/index.js) 和 [CaseJson → VL 转换实现](https://github.com/VisualLogic-VLCode/vlparser/blob/v1.0.42/legacyToVLang/LegacyProjectConverter.js)。
