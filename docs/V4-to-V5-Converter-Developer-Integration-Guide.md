# iVX V4 → V5 转换器开发嵌入指南

本文面向需要把 iVX V4→V5 JSON 转换能力嵌入自己系统的开发者，说明独立 Converter 的安装、调用、诊断处理和版本升级方式。

## 1. 当前发布基线

| 项目 | 值 |
|---|---|
| Converter 版本 | `1.2.11` |
| npm 包名 | `@visuallogic-vlcode/tov5parser` |
| Node.js | `>=18` |
| 模块格式 | ES Module |
| 许可证状态 | `UNLICENSED` |
| Release | <https://github.com/VisualLogic-VLCode/tov5parser/releases/tag/v1.2.11> |
| Release 包 | <https://github.com/VisualLogic-VLCode/tov5parser/releases/download/v1.2.11/tov5parser-1.2.11.tgz> |
| Release 包 SHA-256 | `25cd12b3a28757706ed93cd2006a6aaf41ea312e0217d2224a6809f87685936a` |
| 签名稳定通道 | <https://raw.githubusercontent.com/VisualLogic-VLCode/tov5parser/release-channel/converter-stable.json> |

发布包是可独立安装的 npm tarball，已包含转换代码、组件映射和运行依赖。

## 2. 授权边界

本仓库当前标记为 `UNLICENSED`。仓库公开、Release 可下载，不代表自动授予第三方使用、修改、嵌入或再分发权利。

- 组织内部或已获得单独授权的开发者，可以按授权范围使用 Release 包。
- 外部开发者在嵌入或再分发前，应先取得维护者提供的书面授权或专有许可证。
- 接入方不得仅因为仓库公开就推定获得开源许可证。

如果需要面向不特定第三方长期分发，应先由维护者确定正式许可证，再发布新的明确版本。

## 3. 推荐接入方式：Node.js 包

### 3.1 固定版本安装

建议始终安装不可变 Release，不要直接依赖 `main` 分支：

```bash
npm install --save-exact \
  https://github.com/VisualLogic-VLCode/tov5parser/releases/download/v1.2.11/tov5parser-1.2.11.tgz
```

安装后，应用通过包名导入，不要引用 `node_modules` 内部文件：

```js
import {
  loadRuntimeMaps,
  convertV4CaseJsonToV5CaseJsonDetailed,
} from '@visuallogic-vlcode/tov5parser';
```

### 3.2 推荐调用方式

```js
import {
  loadRuntimeMaps,
  convertV4CaseJsonToV5CaseJsonDetailed,
} from '@visuallogic-vlcode/tov5parser';

// Node.js 环境需要先加载包内组件映射；该操作是幂等的。
loadRuntimeMaps();

export function convertCase(v4CaseJson, ntype) {
  const { v5CaseJson, diagnostics } =
    convertV4CaseJsonToV5CaseJsonDetailed({
      v4CaseJson,
      ntype,
    });

  return { v5CaseJson, diagnostics };
}
```

输入字段：

- `v4CaseJson`：V4.1 编辑器 `saveDealCase` 产出的完整案例 JSON，通常包含 `case`、`stage` 和 `server`。
- `ntype`：可选。平台记录的案例类型；未提供时，Converter 尝试从 `stage` 根节点类型推断。

输出字段：

- `v5CaseJson`：转换后的 V5 案例 JSON。
- `diagnostics`：本次转换的有界结构化诊断报告。

转换接口是同步接口。调用方应自行处理输入读取、异常捕获、超时隔离、日志脱敏和结果持久化。

### 3.3 兼容的简化接口

如果旧系统暂时不消费诊断，也可以使用：

```js
import {
  loadRuntimeMaps,
  convertV4CaseJsonToV5CaseJson,
} from '@visuallogic-vlcode/tov5parser';

loadRuntimeMaps();

const v5CaseJson = convertV4CaseJsonToV5CaseJson({
  v4CaseJson,
  ntype,
});
```

新系统应优先使用 `convertV4CaseJsonToV5CaseJsonDetailed`，避免丢失诊断信息。

## 4. 如何处理诊断

`diagnostics` 当前使用 `schemaVersion: 1`，主要字段包括：

- `summary.droppedTotal`：无法安全转换、降级为无值 AST 的逻辑数量。大于 `0` 时不能直接宣称转换完全正确。
- `summary.customExprTotal`：保留为 `jsfn` 自定义表达式兜底的数量。它是需要关注的风险，不单独等同于 Converter 缺陷。
- `summary.truncated`、`categoryTruncated`、`phaseTruncated`：诊断是否因安全上限被截断。
- `records`：按节点、事件块、属性、源码、阶段和错误分组的定位记录。

建议接入方至少实现以下规则：

1. 保存 Converter 版本和诊断摘要，便于问题复现。
2. `droppedTotal > 0` 或诊断被截断时，将结果标记为“需要审阅”。
3. 不把任意 warning 自动判定为 Converter 缺陷。
4. 不在普通日志中输出完整案例 JSON、业务公式或敏感字段。

Converter 诊断只描述转换过程，不替代完整的 V5 结构验证和运行时业务验证。

## 5. 功能边界

独立包接收完整的 V4 案例 JSON，返回 V5 案例 JSON 和转换诊断。它不连接 iVX 平台，也不负责案例获取、用户鉴权、输入版本识别、结果保存或运行时业务验证；这些外围能力由接入系统自行提供。

## 6. 浏览器前端嵌入

当前公开入口是 Node.js 入口，`loadRuntimeMaps()` 使用 `node:fs`、`node:path` 和 `node:url` 读取包内映射，因此不能承诺直接在浏览器中运行。

前端项目不应通过复制 `v4ToV5/` 源文件的方式长期集成，否则容易与正式 Converter 版本分叉。需要浏览器内转换时，建议由维护者单独提供：

- 明确的 `browser` export；
- 预打包的 ESM/browser bundle；
- 映射数据注入接口；
- 与 Node 版本一致的测试和版本号。

在正式 browser entry 发布前，浏览器系统可以通过自己的后端调用 Node.js 包，或使用受控 HTTP 服务。

## 7. 非 Node.js 系统：HTTP/Lambda

对于 Java、Go、Python 或纯浏览器系统，可以调用现有 HTTP/Lambda 协议，而不是嵌入 npm 包。接口支持：

- `version`；
- `convertV4ToV5`；
- `getTransferUrls`，用于超过同步请求/响应体限制的大 JSON。

具体调用方式见 [API 调用指南](api-calling-guide.md)。

采用远程 API 时，案例 JSON 会离开调用方进程。接入方必须先确认数据安全、网络边界、访问控制和日志策略符合自身要求。若案例不得离开本地环境，应使用 Node.js 包本地转换。

## 8. 版本升级策略

生产系统应固定精确 Converter 版本：

1. 订阅 GitHub Release 或检查签名稳定通道。
2. 发现新版本后，先阅读 Release 说明。
3. 在测试环境更新到新的不可变 `.tgz` 地址。
4. 使用固定的 V4 回归案例集比较 V5 JSON、诊断摘要和关键运行时行为。
5. 验收通过后再更新生产依赖和 lockfile。

不要直接安装 GitHub `main` 分支，也不要在生产环境无条件自动跟随 `latest`。稳定通道使用 Ed25519 签名；如果接入方要实现自动更新，必须同时实现签名、公钥、SHA-256 和兼容范围校验，不能只解析其中的 `latest` 字段。

## 9. 交付给开发者的材料

维护者向接入方交付时，建议一次提供：

1. 本文档；
2. 精确 Release 页面和 `.tgz` 下载地址；
3. `.tgz` 的 SHA-256；
4. 允许使用、修改和再分发的书面授权范围；
5. 一份已脱敏的 V4 输入与预期 V5/diagnostics 示例；
6. 问题反馈模板，至少包含 Converter 版本、输入版本判断、诊断摘要和最小复现。

接入方完成以下检查后，才能视为嵌入验收通过：

- 使用 Node.js 18 或更高版本；
- 通过正式包名导入公开 API；
- 在转换前成功调用 `loadRuntimeMaps()`；
- 固定精确版本并提交 lockfile；
- 能同时保存或处理 `v5CaseJson` 与 `diagnostics`；
- 对 dropped/truncated 诊断设置人工审阅门禁；
- 没有在日志中泄露完整案例数据；
- 已获得与实际使用方式匹配的授权。
