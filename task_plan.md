# Task Plan: tov5parser — 旧版本案例 JSON → 5.x 转换服务

## Goal
将 VisualLogic 旧版本（4.x，规划中含 3.x）案例 JSON 转换为 5.x 案例 JSON，
以自包含独立项目 + AWS Lambda 服务的形态供平台程序通过 HTTP 调用。

## Current Phase
Phase 6.3（提交并推送本轮全部修改）

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

### Phase 6: 真实案例验证
- [x] 取得真实案例 `localCases/v5/frp-pad` 的转换产物与错误报告
- [x] 解析 `app.convert-errors.json/.md`，形成逐项错误清单
- [x] 将错误按症状、数据结构和转换阶段归类并统计
- [x] 追溯每一类错误到转换函数/映射资产，给出修复优先级与建议
- [x] 输出 `app.convert-errors.analysis.md`，记录根因、责任文件和回归标准
- [x] P0：移植 jsepWrap、六插件与 exprStr hook，并补解析回归测试
- [x] P0：合并相同 classId 的前后台 class 节点索引，并补跨 scope 回归测试
- [x] P1：按参数上下文恢复 52 个被误判为公式的文本值
- [x] 重新转换 frp-pad，核对 dropped/custom-expression/unknown-varType 改善量
- [x] 运行全量测试，确认普通 v4 案例无回归
- [x] P1：完善块体箭头/IIFE/赋值表达式的完整 JavaScript → jsfn fallback，并清零转换器生成的无效 jsfn
- [x] 核对公式转换：2,576 个 jsfn 全部可编译；仅余 1 条源语法错误和 2 条源上下文错误
- [x] 核对其他转换结果：动作落点、paramsAsObj 参数名、service 引用和本案后台 db 动作均通过结构审计
- [x] 本案未发现组件方法定义出入，无需从 4.1 编辑器重 dump 资产（前台直调 DB 分支本案无样本）
- **Status:** complete
- **本轮修复状态:** 公式转换 complete；dropped 3,258 → 1，转换器生成无效 jsfn 9 → 0

### Phase 6.1: 云端小模块编辑器兼容性
- [x] 读取会话 `019f8417-e058-78d1-90c7-f36e699c0947` 的原始发现与证据
- [x] 对照 v4/v5 小模块结构和当前 classes 转换路径，判断 `props.modEdtVer = 2` 的适用范围
- [x] 如确有必要，实施最小转换修改并补回归测试
- [x] 用真实/合成云端小模块验证，并运行全量测试
- **Status:** complete

### Phase 6.2: 压缩案例产物
- [x] 将本地转换命令生成的 `*.v5.json` 改为无缩进压缩 JSON
- [x] 重新生成并归位 `frp-pad/app.v5.json`
- [x] 验证产物可解析、无美化空白且功能测试通过
- **Status:** complete

### Phase 6.3: Git 提交与推送
- [x] 核对全部改动、远程地址和敏感信息
- [ ] 提交当前工作区中的本轮全部修改
- [ ] 推送当前 `main` 分支并验证远程状态
- **Status:** in_progress

## Future Work（不属于当前任务）
- v3 → v5：调研 3.x 数据结构并新增 `v3ToV5/` 转换入口。
- GitHub 推送、Access Key 轮换及调用方对接；涉及外部状态变更时另行取得用户授权。

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 控制台建桶 AccessDenied（s3:CreateBucket） | 1 | 判定为 IAM 用户权限不足，整理权限清单找管理员开通 |
| tov5parser-* 命名全部 AccessDenied | 1 | 用 AccessDenied vs NotFound 差异探测出授权范围为 vl-case-json-converter*，资源改名 |
| CreateBucket 任何名字均拒（含授权前缀） | 2 | 确认建桶权限根本未授；部署包改直传绕开，桶由管理员创建 |
| Chrome 扩展不可达，无法代操作控制台 | 1 | 改为手动操作指南；后因账号仅 CLI 访问全部转为命令行 |
| 脱敏脚本未盖住嵌套 JSON，SecretAccessKey 在输出中显示 | 1 | 如实告知用户，建议管理员轮换密钥（Phase 8 待办） |
| iam:GetRolePolicy 拒绝（写后读不回） | 1 | 接受：put-role-policy 成功即可，验证留到功能 E2E |
| 本机 Node 不支持 `--experimental-default-type=module` | 1 | 不改上游 package 类型；改用 CommonJS require 手动注册上游 jsep 插件做只读解析实验 |
| jsfn 语法审计发现 77 个不可编译表达式 | 1 | 已修复 jsep 误路由、对象箭头打印和 callback 子树折叠；最终 2,576/2,576 可编译 |
| 校验运行包时误用 `dist/tov5parser-lambda.zip` 路径 | 1 | 已重建并检查根目录 `archive.runtime-tov5.zip`，新增 7 个运行依赖全部存在 |
| 对象返回箭头测试通过完整 converter 时依赖未初始化的运行时 sysutil map | 2 | 将单测下沉到 `jsep → ExprAstToString`，直接覆盖本次打印器缺陷；完整链路由 frp-pad 重跑覆盖 |
| 直接读取会话 `019f8417...` 返回 invalid arguments | 1 | 先用任务列表解析该会话的 hostId，再按 threadId + hostId 读取 |
| 带 threadId 查询参数列任务同样返回 invalid arguments | 1 | 按桌面端说明改用无过滤的近期任务列表，再从结果匹配 ID |
| 已解析 hostId 后读取目标会话仍返回 invalid arguments | 1 | 三次 API 读取均失败，改为只读检索本机 Codex 会话存档，不再重试任务读取 API |
