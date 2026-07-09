# Task Plan: tov5parser — 旧版本案例 JSON → 5.x 转换服务

## Goal
将 VisualLogic 旧版本（4.x，规划中含 3.x）案例 JSON 转换为 5.x 案例 JSON，
以自包含独立项目 + AWS Lambda 服务的形态供平台程序通过 HTTP 调用。

## Current Phase
Phase 6（等待真实案例输入）

## Phases

### Phase 1: 调研与依赖抽离设计
- [x] 摸清 VxEditor41 `src/utils/convertV4ToV5` 模块结构与编辑器环境依赖（9 处，四类）
- [x] 设计 env.js 环境层：节点/事件块索引、前后台归属、伪对象类型、组件方法映射
- [x] 关键决策：组件映射复用 legacyIvxMap overlay + ivxMap VxJaMap；ntype 参数传入 + stage 根类型推断兜底
- **Status:** complete

### Phase 2: 移植与独立项目化
- [x] 移植进 vlparser 并全量测试通过（后按需求变更完整迁出，vlparser 已还原干净）
- [x] 独立项目 tov5parser：vendor MapCreator/legacyMaps/两份 map 资产，自包含零依赖 vlparser
- [x] 只保留 v4 JSON→v5 JSON 接口（`convertV4CaseJsonToV5CaseJson`），不做一步到 VL
- [x] 项目更名 v4tov5parser → tov5parser（为 v3ToV5 预留结构）
- [x] lambdaIndex.handler（vlparser 协议同构）+ localServer 本地调试（端口 3457）
- **Status:** complete

### Phase 3: AWS 部署（中国区）
- [x] 管理员开通专用 IAM 用户（vl-case-json-converter-deployer，仅 CLI），凭证配置与验证
- [x] 探测授权命名范围（`vl-case-json-converter*`），确定实际资源名
- [x] 建执行角色、创建函数（cn-northwest-1 / nodejs20.x / 2048MB / 120s）、版本 1 + prod 别名
- [x] API Gateway HTTP API 直连 prod 别名，公网端点 E2E 验证
- **Status:** complete

### Phase 4: S3 中转通道
- [x] 管理员建桶 vl-case-json-converter（transfer/ 前缀生命周期）；执行角色挂桶读写策略
- [x] 部署包改经 S3 中转（deploy 脚本默认，--bucket '' 可直传）
- [x] 大 JSON 预签名通道：getTransferUrls → PUT 上传 → convertV4ToV5 传 s3Key → 预签名 GET 下载
- [x] 内联结果超 6MB 自动落桶兜底；v1.1.0 / Lambda 版本 2 上线并 E2E 验证
- **Status:** complete

### Phase 5: 文档与版本管理
- [x] README（接口用法、大 JSON 通道、线上环境、本地调试、部署、同源对照表）
- [x] docs/aws-ops-runbook.md（凭证配置、日常运维、一次性搭建命令留档、权限边界）
- [x] git 历史按里程碑整理为多个提交（含 S3 前的中间版本构造），凭证目录 gitignore
- **Status:** complete

### Phase 6: 真实案例验证（当前）
- [ ] 取真实 4.x 案例 JSON（4.1 编辑器 saveDealCase 产物）走线上端点或 localServer 验证
- [ ] 核对转换结果：动作参数补全、paramsAsObj/errorCb、db 服务生成、公式转换
- [ ] 如发现组件方法定义出入 → 按 findings.md 的备选方案从 4.1 编辑器 dump 新资产
- **Status:** pending（等待真实案例输入）

### Phase 7: v3 → v5 转换（规划）
- [ ] 调研 v3 案例 JSON 结构与 3.x 编辑器转换逻辑来源
- [ ] 新增平级模块 `v3ToV5/` 与 lambda action `convertV3ToV5`（复用 env/映射基建）
- **Status:** pending

### Phase 8: 收尾事项
- [ ] 推送 GitHub 远程（github.com/VisualLogic-VLCode/tov5parser，package.json 已预设）
- [ ] Access Key 轮换（曾在会话输出中显示过一次，管理员重发后重新 aws configure）
- [ ] 调用方对接（把端点与协议交给平台侧，观察首批真实流量）
- **Status:** pending

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 控制台建桶 AccessDenied（s3:CreateBucket） | 1 | 判定为 IAM 用户权限不足，整理权限清单找管理员开通 |
| tov5parser-* 命名全部 AccessDenied | 1 | 用 AccessDenied vs NotFound 差异探测出授权范围为 vl-case-json-converter*，资源改名 |
| CreateBucket 任何名字均拒（含授权前缀） | 2 | 确认建桶权限根本未授；部署包改直传绕开，桶由管理员创建 |
| Chrome 扩展不可达，无法代操作控制台 | 1 | 改为手动操作指南；后因账号仅 CLI 访问全部转为命令行 |
| 脱敏脚本未盖住嵌套 JSON，SecretAccessKey 在输出中显示 | 1 | 如实告知用户，建议管理员轮换密钥（Phase 8 待办） |
| iam:GetRolePolicy 拒绝（写后读不回） | 1 | 接受：put-role-policy 成功即可，验证留到功能 E2E |
