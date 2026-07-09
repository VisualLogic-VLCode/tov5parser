# Findings & Decisions

## Requirements
- 4.x 案例 JSON → 5.x 案例 JSON 的转换接口，独立项目 + 独立 lambda 部署
- 只做 v4→v5，不做一步到 VL（5.x→vl 仍走 vlparser 的 legacyToVLang）
- 部署模式与流程仿 vlparser（S3 中转、版本+别名、API Gateway），但用独立的 AWS 中国区账号
- 调用方为其他程序，通过 HTTP 调用；后续要支持 v3→v5（项目因此命名 tov5parser）
- 大 JSON 超 Lambda 6MB 限制时走 S3 中转

## Research Findings

### 转换核心（源自 VxEditor41）
- `ConvertV4ToV5` 在 4.1 编辑器中共 ~5900 行，绝大部分纯 JSON 转换逻辑；
  编辑器环境依赖仅 9 处、四类：纯常量（拷贝）、运行时索引（从输入 JSON 重建）、
  组件映射数据（复用资产）、可删除项（widgetStore/debugger）
- 输入 v4 JSON 结构：`{ case, stage, server }` 三棵树，stage/server 上挂 classes（小模块）；
  事件块需重放 dealInitBlock 的 parentBid/rootBid/nodeId 标注（幂等实现）
- `isServerRootNode` 原查 widget map 标志，改为建索引时按所在树记录归属，摆脱映射依赖
- `ntype`（案例类型）在平台案例记录里、不在案例 JSON 中 → 参数传入 + stage 根类型前缀
  （ih5-/iwx-/canvas-）推断兜底
- formulaCode/MapCreator.js 是 vlparser utils/MapCreator.js 的同源阉割版 → 直接用 vlparser 完整版
- 转换过程同步（exec 无 await）→ env 用模块级活动环境安全

### 组件映射资产
- ivxMap.txt 顶层六键：VxWidgetMap / VxJaLoc / VxJaMap / VxExLoc / VxSfMap / VxLangLocalVer
- **VxJaMap（后台）是扁平结构** `{path, props, methods}`，无 map 包装；
  VxWidgetMap（前台）是 `{map:{propsMap,eventsMap,methods}}` —— 消费代码严格对应两种形态
- VxJaMap 179 个组件，覆盖 dbService 查找的 data-db/dbView/dbo/postgres 等 v4 节点类型；
  方法名按去 `_stage` 后缀查（dbInsert_stage → dbInsert）
- legacyIvxMap.txt（13MB）系从 5.x 旧编辑器 dump（legacyIvxMapCreator.js 先例），
  只含被过滤的 legacy 组件；基础组件方法定义靠 base VxWidgetMap + overlay
- **风险**：4.1 编辑器的方法参数定义（paramsAsObj/errorCb/params 默认值）可能与 5.x dump 有出入；
  备选方案：在 4.1 编辑器加临时代码 dump `widgets` + `window.VxJaMap` 成新资产

### AWS 中国区
- 中国区（aws-cn）与全球区完全独立：凭证不通用、ARN 前缀 arn:aws-cn、
  端点 .amazonaws.com.cn、控制台 amazonaws.cn、只有北京/宁夏两区域
- **权限探测法**：AccessDenied（名字不在授权范围）vs NoSuchBucket/NotFound（有权限但资源不存在）
  的差异可以在读不到 IAM 策略时反推授权边界
- 管理员按 `vl-case-json-converter*` 前缀授权；**函数名 vl-case-json-converter（无 -prod 后缀）**
- Lambda nodejs20 运行时内置 @aws-sdk v3 → S3 SDK 放 devDependencies、动态 import，
  部署 zip 保持 1.6MB
- Lambda 同步调用请求/响应各限 6MB → 预签名 URL 模式（调用方零 AWS 凭证依赖）
- 部署包 1.6MB 直传完全可行；S3 中转对小包是可选项（--bucket '' 切换）

## Decisions
| 决策 | 选择 | 理由 |
|---|---|---|
| 组件映射来源 | 复用 legacyIvxMap + ivxMap，不新 dump | 用户拍板；先跑通，出入风险留验证阶段兜底 |
| 代码归属 | 整体迁移自包含（vlparser 完全移除） | 用户拍板；迭代不等 vlparser 发版；同源文件手动同步（README 对照表） |
| 一步到 VL 接口 | 不做 | 用户拍板；避免依赖 convertLegacyCaseJsonToVLangProject |
| HTTP 暴露 | API Gateway（否掉 Function URL） | 用户拍板；与 vlparser 同模式；曾加的 x-api-token 校验已删 |
| 部署账号 | AWS 中国区 587849590304 / cn-northwest-1 宁夏 | 管理员分配（曾建议英文服被否） |
| 大 JSON | 预签名 URL 三步 + 内联超限自动落桶兜底 | 调用方纯 HTTP；向后兼容 |
| 静态可变状态 | ConvertV4ToV5.classId 等收进 env 活动环境 | lambda 并发安全 |
| git 历史 | 按里程碑拆 5 个提交（含中间版本构造） | 无法还原未留存的中间态；废案（Function URL 等）不入历史 |

## Issues & Blockers
- [ ] 未用真实 4.x 案例验证（最大不确定性，见组件映射风险）
- [ ] Access Key 曾在会话输出显示过一次，待管理员轮换
- [x] 建桶权限缺失 → 管理员代建（resolved）
- [x] 命名范围不明 → 探测法确定（resolved）

## Resources
- 线上端点：https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/
- 4.1 编辑器源（同步上游）：/Users/lianghuang/Desktop/ivx_repos/VxEditor41
- vlparser（基建同源 + 下游 legacyToVLang）：/Users/lianghuang/Desktop/ivx_repos/vlparser
- 凭证材料：vl-case-json-converter-aws-cn-access/（gitignored，仅本机）
- 运维手册：docs/aws-ops-runbook.md
