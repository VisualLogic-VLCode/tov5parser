# Task Plan: tov5parser — 旧版本案例 JSON → 5.x 转换服务

## Goal
将 VisualLogic 旧版本（4.x，规划中含 3.x）案例 JSON 转换为 5.x 案例 JSON，
以自包含独立项目 + AWS Lambda 服务的形态供平台程序通过 HTTP 调用。

## Current Phase
Phase 33（记录自动转换无法解决的架构兼容问题）— complete

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
- [x] 提交当前工作区中的本轮全部修改
- [x] 推送当前 `main` 分支并验证远程状态
- **Status:** complete

### Phase 7: Lambda 重新部署（2026-07-21）
- [x] 确认仓库、目标账号/区域、函数名和 `prod` 别名
- [x] 运行测试、重新生成并校验部署包
- [x] 发布新 Lambda 版本并切换 `prod` 别名
- [x] 冒烟验证别名实际执行新版本，并记录回滚版本
- **Status:** complete

### Phase 8: workspace-my 真实案例转换与错误分析（2026-07-22）
- [x] 使用 `ntype=1` 和 `--diag` 重新转换 `localCases/v4/workspace-my/app.json`
- [x] 将扁平输出归位到 `localCases/v5/workspace-my/`，保留紧凑 JSON
- [x] 校验 v5 JSON 可解析、体积与顶层结构
- [x] 按 outcome / phase / message / 公式特征统计并归类错误
- [x] 输出 `app.convert-errors.analysis.md`，映射到可共同修复的转换函数
- [x] 运行必要的结构审计，确认是否存在报告外的转换残留
- **Status:** complete

### Phase 9: workspace-my 文本识别修复（2026-07-22）
- [x] 为 Formula `url` 参数增加裸协议 URL 的窄范围文本识别
- [x] 为条件 `value2` 增加基于 operator 与 v4 `str` token 的纯文本识别
- [x] 覆盖裸 URL、URL 公式、英文短语、域名、真实条件公式的回归测试
- [x] 运行全量测试并检查代码差异
- [x] 重新转换 `workspace-my`，更新 v5 产物与诊断报告
- [x] 复核 dropped / invalid jsfn / unresolved jsfn / v4 引用残留
- [x] 更新错误分析报告与修复后指标
- **Status:** complete

### Phase 10: frp-pad 环境变量条件转换（2026-07-22）
- [x] 提取 `bid=cthg4tka3j500003t8gg` 的 v4 源条件与当前 v5 AST
- [x] 定位 `_appEnv` receiver/参数丢失的转换根因
- [x] 实施最小修复并补回归测试
- [x] 重跑 `frp-pad`，核验目标条件与全量测试
- **Status:** complete

### Phase 10.1: 收窄 frp-pad 条件修复（2026-07-22）
- [x] 撤销 `ih5-system → sobj/base` receiver 改写
- [x] 仅保留 `$refsComp` 方法 AST 承接修复
- [x] 更新回归断言并重跑真实案例
- **Status:** complete

### Phase 11: frp-pad v4/v5 运行时表格缺失诊断（2026-07-22）
- [x] 对比 Chrome 中 v4/v5 当前页面的可访问 DOM，确认缺失范围
- [x] 用表头文本定位 v4/v5 案例 JSON 中的节点及共同父级
- [x] 核对字段可见性、列宽配置对象及初始化逻辑
- [x] 核对条件（三元）表达式的 v4 源码与 v5 AST 语义
- [x] 给出根因、影响范围及转换函数修复建议
- **Status:** complete

### Phase 12: 修复三元表达式嵌套回调转换（2026-07-23）
- [x] 让 full-js 模式下三元表达式各分支复用函数子树保护逻辑
- [x] 新增 `condition ? value : array.map(item => {...})` 回归测试
- [x] 运行定向测试与项目全量测试
- [x] 重新转换 frp-pad，核验 6 个“量体部门”绑定并保持紧凑 JSON
- [x] 检查最终差异并更新任务记录
- **Status:** complete

### Phase 13: 诊断 jsfn 在 5.x 编辑器中的部分显示（2026-07-23）
- [x] 核对截图表现与目标 jsfn 的 JSON/解析后换行形态
- [x] 检查 VxEditor41 对 jsfn 的导入、公式展示和保存逻辑
- [x] 判断换行是仅影响展示还是会造成公式语义/保存截断
- [x] 确认可安全改为 Astring 单行输出，并给出修复建议
- **Status:** complete

### Phase 14: full-js jsfn 单行输出兼容修复（2026-07-23）
- [x] 将 Astring full-js 输出改为无换行的单行代码
- [x] 更新回归测试，覆盖单行输出与原有执行语义
- [x] 运行定向测试和项目全量测试
- [x] 重新转换 frp-pad，核验全部 jsfn、6 个目标绑定和紧凑 JSON
- [x] 检查最终差异并更新任务记录
- **Status:** complete

### Phase 15: 重新下载并转换修正后的 frp-pad v4 案例（2026-07-23）
- [x] 按 `raw/中文服完整案例JSON导出.md` 调接口下载最新 v4 JSON
- [x] 核对案例元数据、结构及表头 `authData` 可见表达式已更新
- [x] 用当前转换器生成压缩 v5 JSON和诊断报告
- [x] 验证表头绑定、6 个正文公式、全部 jsfn与云端模块标记
- [x] 检查最终文件并更新任务记录
- **Status:** complete

### Phase 16: 款式信息文件请求卡住诊断（2026-07-23）
- [x] 在 Chrome 中分别复现 v4/v5 点击文件图标后的页面与网络差异
- [x] 从 DOM/案例 JSON 定位“款式信息”列图标节点 ID 及事件入口
- [x] 对比 v4/v5 JSON 中对应事件动作链、参数和服务引用
- [x] 定位“进入加载但未发请求”的首个语义分叉点
- [x] 给出根因、影响范围和转换函数修复建议
- **Status:** complete

### Phase 17: 无限动画 play 动作自动跳过（2026-07-23）
- [x] 核对真实阻塞动作、data-animate 引用及 infinite 属性
- [x] 转换时识别 `data-animate.play + props.infinite=true`
- [x] 将命中的 v5 动作 AST 标记为 `skip`
- [x] 补充无限/非无限动画回归测试
- [x] 运行全量测试并重转 frp-pad 验证目标 BID
- **Status:** complete

### Phase 18: “加载成功”提示不关闭诊断（2026-07-23）
- [x] 定位“加载成功”文本对应的动作块和提示动作组
- [x] 对比 V4/V5 从显示成功到关闭提示的完整动作链
- [x] 检查 infinite play 跳过后是否还有 async/await 阻塞点
- [x] 必要时复现 V5 运行时日志和界面状态
- [x] 给出根因、相关 BID 与修复建议
- **Status:** complete

### Phase 19: 延时变量方法后补充 UI 刷新让步动作（2026-07-23）
- [x] 确认 V4 延时字段、变量组件类型判定和 V5 动作插入位置
- [x] 在变量组件方法转换后追加随机 ln 的零时长 `delaysMethod` AST
- [x] 新增命中与非命中回归测试，验证动作顺序和 AST 精确结构
- [x] 运行定向测试、项目全量测试与差异检查
- [x] 重新转换 frp-pad，核验 `cv7jynaa3j50000btcag` 后新增动作及紧凑 JSON
- **Status:** complete

### Phase 20: 同步今日转换修复到 VxEditor41（2026-07-23）
- [x] 盘点 tov5parser 今日提交及 VxEditor41 已同步内容
- [x] 仅向 VxEditor41 转换目录同步仍缺失的逻辑
- [x] 适配 VxEditor41 代码结构并补充可运行回归验证
- [x] 检查 VxEditor41 差异，确保不触碰用户现有修改和不新增规划文档
- [x] 汇总同步范围与测试结果，等待用户确认是否提交
- **Status:** complete

### Phase 21: 对比外部 V5 JSON 的服务注册差异（2026-07-23）
- [x] 识别两个 JSON 的顶层结构、版本元数据和节点规模
- [x] 定位服务 `ceyjn3ca3j50000468k0` 在两份 JSON 中的定义位置与完整字段
- [x] 定位全部调用点，比较 runsvc AST、作用域和模块关系
- [x] 比较服务注册所依赖的父节点、server/class 结构及关键属性
- [x] 给出“外部 JSON 正常、当前 app.v5.json 服务不存在”的确定根因
- **Status:** complete

### Phase 22: 补齐 V5 后台服务编译态（2026-07-23）
- [x] 确认 V5 `ast2js` 的最小可复用边界、运行依赖和后台节点覆盖范围
- [x] 转换完成后编译 server 根及 server classes 事件 AST，写入 `events.list[0]._code`
- [x] 设置 `server.props.v2 = 1`，但不覆盖与本次无关的节点数据
- [x] 新增服务注册回归测试，验证目标服务能被运行时收集
- [x] 运行全量测试并重新生成压缩版 frp-pad `app.v5.json`
- [x] 核验 `ceyjn3ca3j50000468k0` 的 `_code`、服务计数和最终差异
- **Status:** complete

### Phase 23: 提交推送并同步 VxEditor41（2026-07-23）
- [x] 提交 tov5parser Phase 22 全部修改并推送 main
- [x] 盘点 VxEditor41 当前工作区及转换入口，隔离用户现有修改
- [x] 将后台 AST 编译态修复同步到 `src/utils/convertV4ToV5`
- [x] 运行 VxEditor41 定向语法/格式检查及可行的构建验证
- [x] 汇总 VxEditor41 修改范围，按仓库规则等待提交确认
- **Status:** complete

### Phase 24: 目标服务无返回值诊断（2026-07-23）
- [x] 精确对比两份 JSON 中目标 service、server-api、调用点及所属 class
- [x] 对目标事件 AST 与 `_code` 做结构和逐字符差异分析
- [x] 追踪 `$sys.afunc` 参数位及 data-service 返回路径的运行时约定
- [x] 排除服务注册覆盖、参数映射和返回动作丢失
- [x] 给出无返回值的确定根因与最小修复方向
- **Status:** complete

### Phase 25: 后台错误回调占位清理并同步 VxEditor41（2026-07-23）
- [x] 在 tov5parser 后台编译前按组件方法签名清理 V4 错误回调占位
- [x] 新增 server-api 与 data-db 回归测试，并保证合法 `_fakeCbInner` 路径不被误删
- [x] 运行定向/全量测试并重新生成紧凑 frp-pad `app.v5.json`
- [x] 将同一通用规则同步到 VxEditor41 转换函数，不新增规划文档
- [x] 完成 VxEditor41 定向检查和构建验证，汇总待提交文件
- **Status:** complete

### Phase 26: 提交并推送双仓库修复（2026-07-23）
- [x] 核对 tov5parser 与 VxEditor41 待提交范围
- [x] 提交并推送 tov5parser 当前修复
- [x] 仅提交并推送 VxEditor41 本次转换文件
- [x] 确认两个远程分支更新且用户其他修改未进入提交
- **Status:** complete

### Phase 27: 获取并转换案例 11023063（2026-07-24）
- [x] 从中文服只读数据库确认案例版本、`work_id`、`ntype` 和基本元数据
- [x] 调编辑器加载接口下载并解码完整 v4 案例 JSON，校验 `stage/server/case`
- [x] 用当前转换器和正确 `ntype` 生成紧凑 v5 JSON及诊断报告
- [x] 若有错误，按 `localCases/v5/frp-pad` 结构生成逐条错误文档与归类分析文档
- [x] 校验产物可解析、关键结构完整，并运行项目测试
- **Status:** complete

### Phase 28: 修复数字字面量成员访问序列化（2026-07-24）
- [x] 为 `(1).toString()` 的 custom-expression 输出增加最小回归测试
- [x] 修复 `ExprAstToString` 对数字 `Literal` receiver 的括号处理
- [x] 运行定向测试和项目全量测试
- [x] 重新转换案例 11023063，确认全部 `jsfn` 可编译并更新错误分析
- [x] 检查最终差异，等待用户确认是否创建 Git 提交
- **Status:** complete

### Phase 29: 同步 VxEditor41 并提交推送双仓库（2026-07-24）
- [x] 核对 VxEditor41 转换器对应文件与现有用户改动边界
- [x] 同步数字 Literal receiver 括号修复并完成定向验证
- [x] 核对 tov5parser 和 VxEditor41 的待提交文件
- [x] 分别创建 Git 提交，确保 VxEditor41 不包含用户其他修改
- [x] 推送两个仓库当前分支并验证远程状态
- **Status:** complete

### Phase 30: 量体部门单元格高度差异诊断（2026-07-24）
- [x] 在 Chrome 中复现并定位 V4/V5 的目标表格、行和“量体部门”单元格
- [x] 对比目标 DOM 层级、实际尺寸、计算样式和内容溢出状态
- [x] 从 DOM 节点 ID 回查 V4/V5 JSON 的布局、文本和表格属性
- [x] 区分转换数据错误、组件属性差异与 V5 运行时布局差异
- [x] 给出确定根因、相关节点 ID 与修复建议
- **Status:** complete

### Phase 31: 按共用组件链重新诊断量体部门行高（2026-07-24）
- [x] 撤销“V5 使用 `src/v5` 组件”的错误前提，确认线上 V4/V5 实际共用组件入口
- [x] 对比 V4/V5 目标测高行收到的 props、事件参数和行高列表变化
- [x] 检查 V5 AST 执行、循环作用域及变量更新是否改变行高事件语义
- [x] 用既有真实 DOM 现象、线上 work 与播放器调度源码交叉验证首个分叉点
- [x] 给出修正后的确定根因与最小修复位置
- **Status:** complete

### Phase 32: 剔除禁用 heightChange 后重查文本测高链（2026-07-24）
- [x] 确认 `crqff6ma3j50000a6dw0.events.enable=false` 在 V4/V5 与编译期的实际效果
- [x] 找到可见分支 `d0dcr...`，只保留两个启用文本的 `initialize/valueChange` 测高链
- [x] 对比 `_boundHeight`、延时和 `cvrgkvfa3j50000vq3tg` 调用的 V4/V5执行语义
- [x] 锁定有效链的首个分叉点，修正根因与修复建议
- **Status:** complete

### Phase 33: 记录自动转换无法解决的架构兼容问题（2026-07-24）
- [x] 明确问题分类边界和转换器不能安全推断的原因
- [x] 新增专项文档并记录 frp-pad 行高时序问题及全部相关 BID
- [x] 给出 V4 业务逻辑改造方案和验收条件
- [x] 在 README 增加文档入口
- **Status:** complete

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
| `workspace-my` 转换时控制台输出约 10 万 token 的 ParseError 栈 | 1 | 转换本身成功；后续直接读取结构化诊断 JSON 做完整统计，不依赖截断的控制台输出 |
| system 条件首版测试落入 sysutil/jsfn fallback | 1 | 测试夹具使用了非 20 位伪节点 ID，而旧公式判型严格要求组件 ID 长度为 20；改用真实案例 ID 后重试，生产实现不变 |
| 同步更新三份规划文件时补丁上下文格式错误 | 1 | 拆分为标准多文件 patch 后成功，不重复原补丁 |
| 用临时日志抑制 frp-pad 大量既有转换日志时命令被安全策略拒绝 | 1 | 不再删除临时文件；改为直接运行转换并限制返回输出 |
| 查询最新 work_id 时本机没有 `mysql` CLI | 1 | SSH 隧道正常；改用交接包支持的 Python `pymysql` 只读连接查询 |
| Python 查询缺少 `pymysql` 模块 | 1 | 不重复安装尝试；先查找本机现有 MariaDB/MySQL CLI 或 Node 数据库驱动 |
| 同时读取两个大型运行页 DOM 快照超时并重置浏览器控制会话 | 1 | 重新连接 Chrome，改为逐页、定向 DOM 读取，不再并行拉取完整快照 |
| v4 页面遍历全部 DOM 搜索“款式信息”仍超时 | 2 | 停止浏览器宽范围搜索；先从本地 v4/v5 JSON定位精确节点 ID，再按 ID回到页面定向读取 |
| Chrome 开发日志按页过滤读取仍超时 | 3 | 改用隔离诊断浏览器，预置 sessionStorage，并只监听本次点击产生的控制台日志和请求 |
| 隔离复现首次点击时初始化遮罩尚未消失 | 1 | 以页面输出“加载成功”为就绪信号，再点击文件图标 |
| frp-pad 内存重转输出大量既有公式 fallback 日志 | 1 | 限制工具输出，只读取转换完成后的目标 AST；目标 BID 验证不依赖日志内容 |
| 扫描“加载成功”参数的 Node 单行脚本混用 `&&` 与 `??` 导致语法错误 | 1 | 改用显式三元表达式提取参数值，不重复原写法 |
| Chrome 对 V5 大型运行页执行全 DOM 文本过滤超时并重置控制会话 | 1 | 不重复全 DOM 过滤；读取 Chrome 故障排查说明后改用更窄定位或隔离运行复现 |
| Chrome 对精确“加载成功”文本 locator 读取仍超时 | 2 | 停止本轮 Chrome DOM 读取，改从 V5 AST 与运行时方法实现定位，不再消耗页面控制连接 |
| zsh 展开不存在的 `test*`/`tests*` 路径导致检索命令中止 | 1 | 不重复使用 shell glob；先用 `rg --files` 定位测试目录，再对明确路径检索 |
| 扫描 frp-pad 时假定源文件名为 `app.v4.json`，实际路径不存在 | 1 | 不重复猜文件名；先列出案例目录中的真实文件，再用明确路径扫描 |
| VxEditor41 定向 ESLint 报 `timeArg` 数组换行的 Prettier warning | 1 | 无语义错误；按仓库格式把单元素 `args` 改为单行后重新检查 |
| 用 BSD `sed 1i` 给 vendored ast2js 加文件头时报语法错误 | 1 | 不再使用平台相关的插入语法；由补丁生成逻辑直接拼接注释 |
| VxEditor41 新编译模块首次 ESLint 有 1 条函数参数换行 warning | 1 | 按仓库 Prettier 规则改为单行解构参数，不使用自动修复以免扩大差异 |
| Chrome 读取最新 V5 页开发日志两次均超时 | 2 | 首次宽日志、第二次按服务 ID 窄过滤仍超时；停止页面日志读取，不再重复，改以 JSON/编译器/运行时规范证据定因 |
| zsh 展开不存在的 `test*` 路径导致检索命令中止 | 1 | 不重复使用未引用 glob；改为先用 `rg --files` 确认测试文件路径，再检索明确文件 |
| Python 元数据查询读不到 shell 中未导出的 `MYSQL_HOST` | 1 | 环境文件仅赋值未 export；下次用 `set -a` 加载后再执行只读查询 |
| 转换包装命令给 zsh 只读变量 `status` 赋值 | 1 | 转换子命令已先执行；不重复转换，改为检查日志和产物，并使用其他变量名保存退出码 |
| 诊断汇总的一次性 Node 表达式括号拼写错误 | 1 | 产物移动已成功；改用分步语句重跑只读统计，不重复文件操作 |
| 数字 receiver 首版测试通过完整 converter 时缺少运行时 sysutil map | 1 | 按现有测试分层改测 `jsep → ExprAstToString`；完整链路由真实案例重转覆盖 |
| VxEditor41 Babel 默认输出保留 ES module import，CommonJS 内存重放失败 | 1 | 不重复默认转换；改为显式追加 modules-commonjs 插件后执行重放，构建单独记录退出状态 |
| Chrome 按横坐标扫描全部正文 `.text_inner` 导致读取超时并重置控制会话 | 1 | 不重复宽范围 DOM 扫描；先从本地 JSON 锁定正文节点 ID，再按精确 class 在页面读取 |
| Chrome 重新 claim 已打开的 V5 预览页连续超时 | 2 | 扩展轻量 openTabs 正常，页面接管卡住；停止重复 claim，尝试复用 browser session 中已有受控 tab，否则转为 JSON 与运行时代码静态定因 |
| Chrome 已受控 V5 页的定向开发日志读取仍超时 | 1 | 停止页面读取；用案例中的完整行高事件链与 V4/V5 布局生命周期实现交叉定因 |
