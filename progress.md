# Progress Log

## Session: 2026-07-07

### Phase 1: 调研与依赖抽离设计
- **Status:** complete
- 摸清 VxEditor41 convertV4ToV5 模块（index 1444 行 + utils 4138 行 + formulaCode）
  与全部编辑器依赖；输出四类依赖清单与 env 抽离方案
- 用户决策：复用 legacyIvxMap / ntype 传参+推断 / 移植时顺手重构

### Phase 2（前半）: 移植进 vlparser（后迁出）
- **Status:** complete（成果后续迁出）
- 移植至 vlparser legacyToVLang/v4ToV5/，全仓 1590 测试通过
- 曾加 lambda action body.v4CaseJson 支持，按用户要求撤销

## Session: 2026-07-08

### Phase 2（后半）: 独立项目化
- **Status:** complete
- 需求变更：独立项目 + 独立 lambda。建 v4tov5parser（后更名 tov5parser），
  vendor MapCreator/legacyMaps/map 资产；vlparser 完全还原（1581 测试通过）
- lambdaIndex.handler + localServer(3457) + 打包/部署脚本；23~27 测试通过
- 解压部署 zip 模拟 lambda 调用验证通过

### Phase 3: AWS 部署
- **Status:** complete
- 曲折：Chrome 扩展不可达 → 手动指南；用户控制台建桶遇 s3:CreateBucket 拒绝 →
  整理权限清单 → 管理员开专用账号（仅 CLI）→ 全部转命令行
- 探测出授权命名 vl-case-json-converter*（函数名无 -prod）；建角色、创建函数
  （直传 zip 绕开无桶问题）、版本 1 + prod 别名、API Gateway、公网 E2E 通过
- 测试结果：version / convertV4ToV5（内联）均 code:0

### Phase 4: S3 中转通道
- **Status:** complete
- 管理员建桶前：执行角色预挂 s3-transfer-rw 内联策略（put 成功、GetRolePolicy 读不回）
- 桶就绪后：s3Transfer.js（预签名/读写/key 校验）+ getTransferUrls action +
  convertV4ToV5 支持 v4CaseJsonS3Key + 超限落桶兜底；部署脚本默认 S3 中转
- v1.1.0 / Lambda 版本 2 上线；E2E：签发→PUT→按 key 转换→GET 下载全通过
- 测试结果：27 pass / 0 fail

### Phase 5（前半）: git 历史
- **Status:** complete
- 按里程碑拆 5 个提交（第 3 个提交构造了无 S3 的中间版本还原演进）；
  凭证目录与 localCases 数据确认未入库
- 全局 CLAUDE.md 建立提交纪律（询问-确认-提交模式）

## Session: 2026-07-09

### Phase 5（后半）: 运维文档
- **Status:** complete
- 新增 docs/aws-ops-runbook.md（凭证配置/日常运维/一次性搭建命令留档/权限边界）
- 删除非权威的 deployer-iam-policy.json，权限知识并入 runbook 第 3 节
- 建立本套规划文档（task_plan / findings / progress）
- 当前 git：7 个提交，工作树干净（本套规划文档待提交）

## Test Results Summary
| 项 | 结果 |
|---|---|
| 单元/集成测试 | 27 pass / 0 fail |
| 部署包模拟 lambda 调用 | ✓ version + convertV4ToV5 |
| 线上内联转换 E2E | ✓ code:0 |
| 线上大 JSON S3 通道 E2E | ✓ 上传→转换→下载全链路 |
| 真实 4.x 案例 | 未验证（Phase 6） |

## Next Session TODO
1. 拿真实 4.x 案例 JSON 验证（Phase 6，最高优先）
2. 推送 GitHub 远程；密钥轮换后重新 aws configure
3. v3ToV5 调研启动时先看 3.x 编辑器有无现成转换逻辑

## Session: 2026-07-21

### Phase 6: frp-pad 真实案例错误分析
- **Status:** in progress
- 收到案例目录 `localCases/v5/frp-pad`，包含 `app.v5.json`、结构化错误报告与 Markdown 报告
- 工作区开始时无未提交代码改动；本轮先分析和归类，不直接修改转换函数
- 已读取结构化错误：4,980 次（去重 4,965），其中 3,258 次逻辑丢失、1,722 次 custom expression 保底
- 初步确认绝大部分来自公式解析/AST 转换能力不足；下一步对错误记录做交叉统计，并追踪 `formulaCode` 与 fallback 的调用链
- 已追踪公式调用链：jsep 解析失败会直接空值；转换器 ParseError 多数可转 jsfn；顶层展开运算符是被特殊排除的逻辑丢失点
- 发现独立项目只启用了 jsep 的 ternary 插件；错误高峰与缺失的 arrow/object/template/spread/regex 插件一一吻合，正在核对上游编辑器的 jsepWrap 初始化
- 已确认上游 wrapper 注册六类插件和 exprStr hook，独立移植遗漏了整套初始化；这是当前 3,258 个直接丢逻辑错误的首要根因
- 只读重放确认恢复 wrapper 后，现有 3,258 条解析丢失中 2,739 条（84.1%）可被解析；余 519 条集中在语句块 JS、裸文本残片与赋值表达式
- 完成错误落点统计与二次分类：519 条剩余 = 块箭头 390 + IIFE 65 + 文本/赋值/异常数据 64；已得到按节点类型、属性类型、前后台范围的分布
- 开始追踪 custom-expression 次级根因：899 条 unknown varType 中 785 条指向 fParam；抽查确认目标动作组存在于 class，聚焦 env 的 class 查找语义
- 已复现并定位 fParam 问题；进一步复核修正为：stage/server 共享 classId，server 建图时覆盖 stage class map。责任函数为 `createV4ConvertEnv`
- 抽查 v5 产物：正常 custom-expression（&&、substring）引用替换正确；fParam fallback 未生成 args，属于“表面保留、实际未解析”的风险，需要调整诊断分级
- 输出 `localCases/v5/frp-pad/app.convert-errors.analysis.md`：完整归类为 jsepWrap 移植遗漏、嵌套 class 漏索引、语句级 JS、文本/赋值/异常源数据四个主根因，并列出修复顺序
- 本轮仅分析与记录，未修改转换函数；内存重跑验证恢复 jsepWrap 后 dropped 由 3,258 降至 519
- stop hook 提醒 Phase 6 尚未完成；开始落实报告中的两个 P0 修复：jsepWrap 恢复与嵌套 class 索引
- 已核对现有测试与上游锁定依赖版本；将新增 jsep 插件解析测试和“stage/server 相同 classId 合并”索引测试
- 已移植 jsepWrap、上游定制 object 插件、六类语法初始化（object 为本地实现，其余 5 个为依赖）和 exprStr hook
- 已将 class map 从覆盖改为同 classId 合并，并新增跨 stage/server class 索引测试与插件解析测试
- 安装 5 个 `@jsep-plugin/*` 运行时包，依赖审计 0 漏洞
- 新增定向测试 9/9 通过；全量测试 28/28 通过
- 用 ntype=1 重新转换 frp-pad：诊断 4,980 → 2,477；dropped 3,258 → 519；jsfn 1,722 → 1,958；去重 4,965 → 2,309
- 新报告中 unknown varType 899 → 96，fParam 相关仅余 3；下一步处理 52 个具备明确参数上下文的文本误判
- 新增精确的 legacy 文本参数识别：`.field` path、CSS paddingRight、数字+中文 info；不对一般解析失败做字符串吞错
- 全量测试增至 29/29 通过；再次转换 frp-pad 后诊断 2,425、dropped 467、jsfn 1,958、去重 2,257
- 当前 467 个 dropped 精确组成：455 missing `}`（块体箭头/IIFE）+ 10 赋值语法 + 1 多余右括号 + 1 空 code 异常
- 新增 Acorn + Astring 完整表达式 fallback，扩展 custom walker 支持块/return/if/变量声明/赋值/函数等 ESTree 节点；undefined code 在入口按空值处理
- 定向测试覆盖块体箭头、IIFE、赋值与参数化 jsfn；全量测试 31/31 通过
- 最终 frp-pad 实测：dropped 467 → 1；唯一 dropped 是源公式多余右括号。产物含 2,469 个 jsfn，自动审计只发现 2 个残留 cbParams，二者均位于非 callback 分支，属于源案例上下文错误
- 交付前 jsfn 语法编译审计发现 77/2,469 不可编译，主要源码形态为 `{: , : }`；说明对象表达式 jsfn 序列化仍有缺陷，暂不判定公式修复完成
- 运行包已成功生成 `archive.runtime-tov5.zip`（1.9MB），后续需按正确路径检查新增依赖
- 追踪无效 jsfn：多数来自 jsep 对块体箭头“误解析但未抛错”，Acorn fallback 未被触发；调整为语句特征预路由后再重跑
- 预路由后再次转换：诊断 2,758，dropped 2，custom-expression 2,756；jsfn 共 2,647 条。
- jsfn 编译审计降至 9 条无效，另有 2 条未解析 legacy 标识。后两条均是非回调上下文引用 `cbParams` 的源案例问题。
- 两条 dropped 中，一条是源公式多余右括号；另一条是预路由规则误把字符串内 SQL 条件 `status = 1` 当成赋值，属于转换器回归，待修复。
- 当前全量测试 32/32 通过，但仍需把本次尾项加入回归测试。
- 修复尾项根因：完整 JS walker 的异常分支不再重复递归/二次变异 AST；对象返回箭头体补括号；`typeof` 预路由 Acorn；裸 `=` 不再预判；`session,key` 按 consoleLog info 文本恢复。
- 新增对象返回、`typeof`、SQL 字符串等回归覆盖；全量测试更新为 34/34 通过。下一步重跑 frp-pad 并重新执行 jsfn 编译/残留标识审计。
- frp-pad 重跑结果：2,572 条诊断，dropped 2，custom-expression 2,570；SQL 字符串误路由已消失。
- jsfn 编译审计：2,472 条中仍有 6 条无效，全部是含 callback 子树被折叠为 `$vN` 参数后，参数内部旧 custom printer 生成 `.includes(...)` 或 `map(i => )`；继续收紧 full-js walker 的替换边界。
- full-js walker 改为保留含 callback 的 JS 子树、只参数化内部 v4 引用；`info = typeof` 也按明确文本上下文恢复。全量测试 35/35 通过。
- 最终 frp-pad 公式结果：2,711 条诊断，dropped 1，custom-expression 2,710；2,576 个 jsfn 全部通过 JavaScript 编译审计。
- 唯一 dropped 是源 `visible` 公式多一个右括号；仅余 2 个 legacy 标识均为非回调分支直接引用 `cbParams.style/data` 的源案例上下文错误。转换器公式尾项已清零。
- 完成非公式结构审计：20,170/20,170 动作有 AST 落点；4,557 个 paramsAsObj 动作参数名缺失 0；302 次 runsvc 的 106 个唯一服务目标全部存在。
- 本案唯一后台 data-db 动作 `dbBatchUpdate` 参数、extra 和错误回调齐全；本案没有前台直调 data-db 的代理服务生成样本，未发现需要重新 dump 组件映射的证据。
- 最新 5.0 产物与诊断报告已放回 `localCases/v5/frp-pad/`；初始产物保留为 `app.before-fixes.*`。
- 重建 `archive.runtime-tov5.zip`（1.9 MB），确认 acorn、astring 和 5 个外部 jsep 插件均进入运行包；`git diff --check` 通过。
- **Phase 6 Status:** complete。本项目 Phase 7–8 为后续 backlog，不属于本次 frp-pad 请求。

### Phase 6.1: 云端小模块 `modEdtVer`
- **Status:** in progress
- 用户要求依据会话 `019f8417-e058-78d1-90c7-f36e699c0947` 判断：v4→v5 后是否需为云端小模块设置 `node.props.modEdtVer = 2`，并在判断为需要时修改转换器。
- 已确认当前工作区包含上一轮未提交的 frp-pad 转换修复；本轮将保留并在其上做最小增量修改。
- 首次仅凭 threadId 读取目标会话返回 invalid arguments；改为先从任务列表取得 hostId，不重复相同调用。
- 带 ID 查询的任务列表也不接受参数；下一步使用无过滤近期列表匹配目标任务。
- 无过滤列表已定位目标任务（cwd 为 VxEditor41，主题为“定位 v4 扩展组件判断依据”），但带正确 hostId 读取仍失败；按三次失败协议改查本机会话存档。
- 已从本机会话存档恢复目标会话结论：v5 案例 `extra.ver=2` 与云端小模块缺失的 `props.modEdtVer` 会被判为版本冲突；`widgetId` 上传组件没有注册组件的 v5 兜底。
- 初步判断需要补 `modEdtVer=2`，但修改前还要确认准确节点范围以及上游 v4→v5 是否已有同类赋值。
- 已复核 VxEditor41 判断代码：只有 isModDef 的云端 class 根会触发检查；云端身份字段位于 class 根。下一步统计 frp-pad 转换前后这两个字段及 `modEdtVer` 的实际分布。
- frp-pad 证实 55 个 class 中 53 个是 widgetId 云端小模块，当前 v5 产物 53 个全部缺少 modEdtVer；判断为必须修复。
- 决定仅对带 `props.widgetId` 或 `uis.registerID` 的 class 根写 `props.modEdtVer = 2`，不污染本地 class 和内部节点。
- 实施方案进一步收紧：只补缺失值，保留显式 `modEdtVer`（例如 3）；修改位于 classes 映射返回前，并新增 widgetId/registerID/local/已有版本四种断言。
- 已修改 `v4ToV5/converter.js`：stage/server class 根带 widgetId/registerID 且 modEdtVer 缺失时补 2。
- 新回归测试覆盖上传云端模块、注册云端模块、本地模块和显式版本 3；全量测试 36/36 通过。
- 真实 `frp-pad` 内存转换核验：共 55 个小模块，其中云端小模块 53 个；53/53 均补为 `modEdtVer=2`，缺失 0；2 个本地小模块均未误标。
- 已重新生成 `frp-pad` 的扁平 v5 产物并归位到案例目录。
- 已将新产物归位到 `localCases/v5/frp-pad/app.v5.json`；落盘审计结果为：55 个 class 根节点、53 个云端小模块全部为 `modEdtVer=2`、缺失 0，2 个本地小模块均未标记。
- 最终验证完成：全量测试 36/36 通过，`git diff --check` 通过；运行包 `archive.runtime-tov5.zip` 已重建并通过完整性检查。
- stop hook 将早期记录的 v3→v5、GitHub 推送和调用方对接等未来事项计为当前未完成阶段；这些事项不属于本次 `modEdtVer` 请求，也缺少用户对推送/部署等外部变更的授权，因此从当前执行阶段移至“未来工作”，本次任务保持完成。

### Phase 6.2: 压缩案例产物
- 用户要求今后重新转换案例时，生成的 `app.v5.json` 必须使用压缩格式，不再美化。
- 已把本地批量转换命令的 v5 产物序列化改为 `JSON.stringify(v5CaseJson)`；诊断 JSON 仍保留美化格式，便于人工查看。
- 本地服务文档示例同步改为 `jq -c`，防止按文档导出的案例再次被格式化。
- 已用新规则重新转换并归位 `frp-pad/app.v5.json`；命令报告产物为 29,071.7 KB，相比此前约 187 MB 的美化文件显著缩小。
- 严格核验通过：产物 29,769,379 bytes，可正常解析，与 `JSON.stringify(JSON.parse(raw))` 完全一致，换行数为 0；53 个云端小模块的 `modEdtVer=2` 仍全部保留。
- 全量测试 36/36 通过，`git diff --check` 通过。Phase 6.2 complete。

### Phase 6.3: Git 提交与推送
- 用户已明确授权将上面累计修改全部提交并推送。
- 当前分支为 `main`；工作区包含公式转换、小模块索引与版本标记、压缩输出、测试及规划文档等累计改动。
- 仓库尚未配置 Git remote；下一步核对 `package.json` 中预设的 GitHub 地址和本机认证，再配置 `origin`。
- `package.json` 预设仓库为 `VisualLogic-VLCode/tov5parser`；GitHub CLI 已登录 `Liang-visuallogic` 且具备 `repo` 权限，17 个待提交文件的常见凭证模式扫描为 0。
- 预设仓库的 SSH `ls-remote` 返回 `Repository not found`；提交前继续确认仓库是否尚未创建或账号无权访问。
- GitHub API 确认目标仓库尚不存在；同组织的 `vlparser` 为 PRIVATE 且当前账号有 WRITE 权限。全部改动已暂存，准备创建本地提交。
- 已创建主提交 `68180ac`（修复 v4 转 v5 真实案例兼容问题）。
- 已在 `VisualLogic-VLCode` 下创建 PRIVATE 仓库 `tov5parser`，配置 `origin`，并成功把本地 `main` 推送为 `origin/main`。

## 2026-07-21 Lambda redeployment

- Started deployment audit: checked repository state and located deployment-related files.
- Confirmed the standard production deployment script and target resources; prepared Phase 7 tracking.
- Production dry-run passed: AWS identity matched, tests were 36/36, and packaging validation succeeded (1.9 MB).
- Recorded pre-deployment rollback point: `prod` → version `4`.
- Uploaded the rebuilt package through S3, published Lambda version `5`, switched `prod`, and passed the direct alias smoke test.
- Verified final alias/function state and the public API Gateway endpoint; Phase 7 is complete. Rollback remains version `4`.
## 2026-07-22 workspace-my 转换与错误分析

- 用户要求将 `localCases/v4/workspace-my` 用当前项目转换为 5.x JSON，并像 `frp-pad` 一样输出错误列表及根因归类。
- 已确认案例 README：编辑器版本 4.1，`ntype=1`；输入 `app.json` 为 26,000,842 bytes。
- 已确认现有 v5 目录只有 2026-07-09 的旧 `app.v5.json`；本轮先诊断和生成产物，不修改转换函数。
- 已以 `ntype=1 --diag` 转换成功，生成平铺产物 `localCases/v5/app.v5.json`（4,039.5 KB）和 JSON/Markdown 诊断报告。
- 初始诊断：301 次（去重 288）；dropped 2、custom-expression 299。控制台错误栈很大但不影响转换完成，后续以结构化报告分析。
- 已完成第一层统计：299 条为预期 jsfn fallback；两条 dropped 分别是 URL 文本误判（转换器缺口）和复杂 `lazyLoad` 公式括号不匹配（疑似源数据错误）。
- 已审计新产物 290 个 jsfn：289 个可编译，参数 arity 全匹配，v4 专有引用残留 0；发现 1 个空代码 jsfn，源自 `domain not registered` 文本误判，虽报告标为 custom-expression 实际不可运行。
- 已从源条件确认另一个语义错误：`www.ivx.cn` 是 include 操作的纯文本右值，却被生成零参数 jsfn；文本误判根因分别落在 action 参数和条件值转换入口。
- 已将紧凑 v5 产物和两份逐条诊断报告归位到 `localCases/v5/workspace-my/`；JSON 解析校验通过。
- 已输出 `app.convert-errors.analysis.md`：301 次诊断收敛为 297 次可靠 jsfn fallback、3 个转换器文本识别缺口、1 个源公式右括号错误。
- 结构审计：3,140/3,140 个源节点保留，2,263/2,263 个源动作有 v5 落点，3/3 个云端 class 根均带 `modEdtVer=2`。
- 项目全量测试 36/36 通过。本轮未修改转换函数、未提交 Git。
- **Phase 8 Status:** complete。

## 2026-07-22 workspace-my 文本识别修复

- 用户确认进行下一步；本轮将修复归类报告定位的 3 个纯文本误判，补回归测试并重跑真实案例。
- 已恢复上一阶段上下文并确认工作区只有 `findings.md`、`progress.md`、`task_plan.md` 的分析记录改动；尚未修改转换代码。
- 已确定最小落点：动作 URL 规则放在 `getLegacyFormulaTextValue()`；条件文本规则放在 `genConObj()` 的 value2 转换前，且不能只凭 `str` token 粗判。
- 已修改 `v4ToV5/utils/action.js`、`v4ToV5/utils/con.js` 和 `v4ToV5/v4ToV5.test.js`，覆盖三个目标文本值及公式反例。
- 定向测试 `node --test v4ToV5/v4ToV5.test.js` 11/11 通过。
- 全量测试 37/37 通过，代码差异空白检查通过。
- 已重跑 `workspace-my`：诊断 298，dropped 1，custom-expression 297，去重 285；转换器造成的三个文本问题清零。
- 产物 jsfn 审计：288/288 可编译，无参数不匹配，无 `$refs/fParam/cbParams/_loop/$P_` 残留；三项目标 AST 均为正确文本值。
- 已归位修复后的紧凑 v5 产物与两份逐条诊断报告，并更新 `app.convert-errors.analysis.md` 的修复前后对比。
- 最终结构回归通过，`git diff --check` 通过；本轮未提交 Git，等待用户确认是否创建提交。
- **Phase 9 Status:** complete。

## 2026-07-22 frp-pad 环境变量条件修复

- 用户报告条件块 `cthg4tka3j500003t8gg` 被错误转换为普通变量 `cbx1ewka3j50000c35vg._appEnv`，正确语义应为系统基础对象 `_appEnv('appType')`。
- 会话恢复确认工作区已有未提交的 Phase 9 文本识别修复；本轮保留这些改动并做增量修复。
- 已提取目标数据：源公式为 `$refs.<ih5-system>.f__appEnv('appType')`，当前转换错误地按普通 var receiver 输出并丢失 `appType` 参数；目标 v5 switch 条件位置已确认。
- 已定位 receiver 根因：通用 `$refs` 路径不查询节点类型，`genRefsAST()` 默认总是生成普通 var；接下来重放公式，独立确认参数丢失行为。
- 最小公式重放确认参数稳定丢失；代码审计定位为 `propertyAST` 未承接 `genRefsCompPropertyAST()` 返回值，导致统一的 `appendFuncArgs()` 无目标。
- 已确定最小实现与回归路径：system 节点上下文映射 + propertyAST 承接修复，并用 `genConObj()` 覆盖用户给出的完整条件结构。
- 首版定向测试 11/12：失败由测试夹具的 7 位组件 ID 引起；转换器按 v4 结构只把 20 位 `$refs` ID 识别为组件属性链。夹具已改用真实案例 ID，准备重试。
- 修正夹具后定向测试 12/12 通过；全量测试增至 38/38 通过。
- 实现已同时修复 system receiver 与 method 参数承接；下一步重跑真实 `frp-pad` 并读取目标 switch 条件。
- 已用新转换器重跑 `frp-pad` 并将紧凑产物归位到 `localCases/v5/frp-pad/app.v5.json`（约 29,075.5 KB）；转换成功，控制台仍有既有公式 fallback 日志。
- 初版曾从真实产物得到 `sobj/base._appEnv('appType')`；该 receiver 改写随后按用户确认撤销，不能作为最终结论。
- 真实产物保持压缩格式（0 个换行）；53/53 个云端小模块仍带 `modEdtVer=2`，本轮修复未影响此前兼容性处理。
- 最终全量测试 38/38 通过，`git diff --check` 通过。
- 已重建 `archive.runtime-tov5.zip`（1.9 MB），压缩包逐项完整性检查通过，修复后的转换代码已进入运行制品。
- **Phase 10 Status:** complete。

## 2026-07-22 frp-pad 条件修复范围调整

- 用户确认原 `ih5-system` receiver 处理正确，不应改写为 `sobj/base`；本轮撤销该映射，只保留 `$refsComp` 分支承接 method AST 的修复。
- 回归预期调整为 `ref ['var', systemNodeId] → method _appEnv(args:[val appType])`。
- 定向测试 12/12、全量测试 38/38 通过。
- 已重跑真实 `frp-pad`；目标条件逐字段匹配原 receiver + 完整方法参数，右值仍为 `PC`。
- 最终 `app.v5.json` 为 29,772,875 bytes、0 个换行，保持压缩格式。
- **Phase 10.1 Status:** complete。

## 2026-07-22 frp-pad v4/v5 运行时表格缺失诊断

- Chrome 对比确认：v5 的表头整组不可见，正文中“量体部门/量体师”等连续字段也不可见；其余正文列仍能显示，因此不是整张表未加载。
- 更正早期定位：`cm1wxmya3j500009jgn0` 名为“未使用过滤表头”，根节点静态隐藏，不是当前表格；其冻结列/列宽不是本次根因。
- 当前表格定位到 `cm1wxsqa3j500009jgng`，表头模块实例为 `cm1wys3a3j500009jjeg`，正文和表头共同消费 `量体过滤表头` `cm1x0qta3j500009jjxg`。
- 核对 `过滤表头配置` `cm5578da3j50000mm3kg`：v4/v5 都保留 19 列，初始化 `find(...).columnShownData` 的 AST 正确；三元 `switchexp` 的空 `=` 是默认分支 schema，均排除。
- 找到 JSON 级确定的正文根因：6 个“量体部门”值绑定的块体 `map(item=>{...})` 回调在 full-js fallback 的三元分支中被折叠成 `lambda return {op:'val'}`，导致该列内容为空。
- 责任代码收敛到 `V4FormulaCodeConverter.walkCustomExprParsed()` 的 `ConditionalExpression`：应在 full-js 模式复用 `walkOrReplaceCustomExpr()`，避免带函数子树被提前部分转换。
- 表头单元 visible 依赖 class 私有 `authData`；该数组初值为空，只由公共方法“设置权限”写入，而父级没有显式调用。visible AST 和方法 AST 均保留，表头消失高概率是 v4 云端模块的隐式权限注入未在 v5 承接，修复前需做运行时验证。
- Chrome 接管 v5 运行页持续超时；未刷新页面、未改 sessionStorage。正文根因已确定，表头权限状态结论保留一次浏览器内验证项。
- **Phase 11 Status:** complete（诊断完成，未修改转换程序）。

## 2026-07-23 三元表达式嵌套回调修复

- 用户要求先修复已确认的三元表达式嵌套回调问题。
- 修复范围限定在 full-js walker 的 `ConditionalExpression` 分支；目标是复用已有函数子树保护逻辑，不改变普通三元表达式转换。
- 将用最小回归测试和 frp-pad 中 6 个“量体部门”绑定做双重验证。
- 已修改 `V4FormulaCodeConverter`：三元表达式的 test/consequent/alternate 统一进入 `walkOrReplaceCustomExpr()`，full-js 模式因此不再提前折叠包含函数的分支。
- 新增回归测试，既检查生成代码保留块级 `map` 回调，也实际执行转换后的 jsfn，结果为 `A、B`。
- 定向测试 8/8、项目全量测试 39/39 通过；`git diff --check` 通过。
- 已重新转换 frp-pad 并归位紧凑产物；6/6 个“量体部门”绑定均保留完整回调且可编译。
- 真实产物共 2,589 个 jsfn，2,589/2,589 可编译，参数数目不匹配为 0；诊断 dropped 为 0。
- 新 `app.v5.json` 为 29,877,108 bytes，0 个换行，SHA-256 `c3e36a9a7baa0d4c1324cbaef0027e48dd749f28ed69240c7e73cef6414f6551`。
- **Phase 12 Status:** complete。

## 2026-07-23 jsfn 部分显示诊断

- 用户重新导入 `app.v5.json` 后，公式编辑区域只显示到 `.map(item => {` 附近，怀疑 jsfn 中的换行造成截断。
- 截图确认这是 5.x 编辑器里的单行公式可视化区域；当前尚不能仅凭截图判断是视觉隐藏、解析截断还是重新保存时的数据丢失。
- 下一步直接检查目标 JSON 的字符串形态和 VxEditor41 的 jsfn 展示/导入代码。
- 已确认截图显示内容与 jsfn 第一行逐字吻合，换行是首要嫌疑；继续追踪编辑器 `jsfn → ASTToBlocks` 与代码生成路径，判断是否会丢失后续行。
- 已定位编辑器根因：自定义表达式 tokenizer 只读取 CodeMirror 第 0 行；运行路径保留完整代码，但编辑器回写可能将公式截断为第一行。
- 已验证转换器使用的 Astring 可以直接生成单行等价代码，无需不安全地用正则删除换行。
- 本轮按用户问题完成诊断，未继续修改转换逻辑；建议下一步让 full-js fallback 使用 Astring 单行输出并重新转换案例。
- **Phase 13 Status:** complete。

## 2026-07-23 V5 后台服务编译态修复

- 用户确认实施 Phase 21 的诊断结论。
- 修复目标：转换产物直接包含 V5 后台运行时可注册的服务代码，而不仅有服务 AST。
- 已恢复跨会话记录并确认：当前项目依赖包含 Acorn/Astring，但没有直接的 V5 `ast2js` 实现。
- 已确认 VxEditor5 `ast2js.js` 自包含、无外部 import，适合按现有 vendor 模式纳入项目；vlparser 版本较旧，不作为来源。
- 已确认需编译 `server` 根与每个 `server.classes` 子树；转换入口将增加统一输出后处理。
- 现场编译目标服务成功，主体代码与正常 JSON 一致；发现正常产物还包含服务入参类型检查包装，来源是 V5 编辑器事件保存逻辑。
- 已确认外部产物只编译当前用到的两个 server class，但官方模块预处理会遍历全部 server classes；转换程序将完整编译，避免漏掉动态使用的模块。
- 已确认默认 strict 入参包装规则；实现将匹配 V5 保存行为，并按后台根的 `paramLooseMode` 支持 loose 模式。
- 下一步增加编译器 vendor 文件与后处理模块，随后补测试。
- 首次生成 vendor 补丁时使用了 GNU 风格 `sed 1i`，在 macOS BSD sed 下失败且未产生文件；已记录，改由补丁生成逻辑直接拼接文件头。
- 已将 VxEditor5 当前 `ast2js` 作为自包含 vendor 文件纳入转换项目。
- 新增 `serverAstCompiler.js`：设置 `server.props.v2=1`，编译 server 根及全部 server classes，清理 fake callback，写事件 `_code`，并补 strict/loose 入参处理与 funcGroup `_code`。
- 转换入口已在结构转换完成后执行后台编译。
- 新增两项回归覆盖：class 中服务可注册、loose funcGroup 参数转换。
- 初次完整测试 43/43 通过；合成 class service 的 `_code` 包含入参检查与 `let serviceResult = "ok"`。
- 已确认 frp-pad v4 源文件为 `localCases/v4/frp-pad/app.json`，生成脚本输出紧凑 JSON。
- 已用最新 v4 源重新转换 frp-pad：诊断 2,722 条，全部为既有 jsfn 兜底，dropped 为 0。
- 后台编译结果为 AST 80、`_code` 80、service 80/80；所有生成代码通过语法编译检查。
- 目标服务 `ceyjn3ca3j50000468k0` 已有 1,008 字符 `_code`；`server.props.v2=1`。
- 已将生成文件归位到 `localCases/v5/frp-pad/`，`app.v5.json` 为 29,972,400 bytes、0 换行。
- 交付前复核 V5 保存包装发现 transaction 专用处理尚未纳入；正在补齐数据库 ID 收集，避免新后台编译阶段对其他案例造成事务语义回归。
- 进一步确认 transaction DB ID 依赖当前工作区身份上下文，转换接口无法可靠重建；本轮不猜测该数据，维持 VLangModProcessor 的通用编译边界。目标 data-service 修复不受影响。
- 最终全量测试 43/43 通过；`git diff --check` 通过。
- Lambda 运行包重建成功（1.9 MB），确认包含 `v4ToV5/ast2js.js` 与 `serverAstCompiler.js`；vendor 内容与 VxEditor5 源一致。
- 最终目标服务核验：`_code` 为字符串、长度 1,008，包含入参检查和 `sendServerApiRequest`；新 JSON SHA-256 为 `2b90d9db0cc09f80800dab79a0ee0cc446e99c7c01907ed543c2f4b42307176d`。
- **Phase 22 Status:** complete。

## 2026-07-23 提交推送并同步 VxEditor41

- 用户要求提交并推送 tov5parser 当前修复，然后同步至 VxEditor41 的转换函数。
- 已核对 tov5parser 当前分支 `main`、远程 `origin`，差异检查通过；待提交范围为 Phase 22 代码、测试和规划记录。
- 同步阶段将保留 VxEditor41 现有用户修改，不新增规划文档；完成后按仓库规则等待用户确认是否提交 VxEditor41。
- tov5parser 已提交并推送：`8859dea`，远程 `origin/main` 已更新。
- 已核对 VxEditor41：分支 `master`，用户现有 `.gitignore`、`src/stores/event.js` 和未跟踪组件目录保持隔离；编辑器已有可复用的 `src/utils/ast2js.js`。
- 已确认 VxEditor41 原生后台保存逻辑与 tov5parser 的 timer/入参包装一致；transaction 依赖编辑器上下文且会在正式保存时覆盖处理。
- 同步方案确定：新增转换目录内的 `serverAstCompiler.js`，并在 `ConvertV4ToV5.exec()` 返回前调用，不修改 `generalAst` 或用户文件。
- 已向 VxEditor41 新增 `serverAstCompiler.js` 并接入转换入口；目前本轮只涉及转换目录内 2 个文件。
- 首次定向 ESLint 为 0 errors、1 条 Prettier 换行 warning；已手动按仓库格式收敛，避免自动修复其他内容。
- 修正后定向 ESLint 0 errors/0 warnings，`git diff --check` 通过，`npm run build` 成功。
- VxEditor41 最终仅有本轮转换文件 `index.js` 与新增 `serverAstCompiler.js`；用户原有修改和未跟踪目录未触碰，仓库根无规划文档。
- 按项目规则，VxEditor41 同步修改尚未提交，等待用户确认。
- **Phase 23 Status:** complete。

## 2026-07-23 目标服务无返回值诊断

- 用户反馈最新 `app.v5.json` 中服务 `ceyjn3ca3j50000468k0` 已可调用，但没有返回值，要求与 `case_12225413.json` 对比。
- 本轮只读诊断，不修改转换程序；优先核对 service/server-api/caller 结构、AST、编译代码和运行时参数位。
- 第一轮精确对比确认：service/API/caller/返回 AST 一致；当前 `_code` 唯一实质差异是 `sendServerApiRequest` 被编译成 7 个方法参数，正常文件只有 6 个。
- 根因方向收敛到后台编译前缺少编辑器原生 `saveCaseDealFakeAst()` 的完整回调占位清理；下一步核对方法签名和 `$sys.afunc` 运行时行为。
- 组件映射已确认该方法只有 6 个业务参数并标记 `errorCb:true`；第 7 个 `undefined` 是遗留错误回调占位，正常编辑器保存会显式 pop。
- Rust 本地运行时规范同样要求 6 参数，但其适配器会忽略更后的参数；因此当前结论是“缺少回调占位清理为唯一且高度可疑差异”，下一步继续查实际运行时或做等价 A/B 证明。
- Chrome 找到最新 V5 页 `hpUBU5Pm`，但宽日志与服务 ID 窄日志两次均超时；按不重复失败原则停止页面日志路径。
- 已完成内存 A/B：按 V5 编辑器规则移除目标 AST 末尾错误回调占位后，用当前编译器重编译，所得 998 字符 `_code` 与正常外部 JSON 逐字一致。
- 当前后台 AST 共检出 76 个同类占位（75 个 server-api、1 个 data-db）；根因应以通用方法签名归一化修复，不能只特判目标服务。
- 已排除服务注册、参数映射、返回动作和调用端丢失；本轮只读诊断完成，未修改转换程序。
- **Phase 24 Status:** complete。

## 2026-07-23 后台错误回调占位清理并同步 VxEditor41

- 用户确认实施修复，并同步到 VxEditor41。
- 本轮将把 V5 编辑器 `saveCaseDealFakeAst()` 的方法签名归一化子集移植到两个仓库的 `serverAstCompiler`，不对目标服务做 BID 特判。
- tov5parser 负责保留计划记录、增加回归测试并重转紧凑案例；VxEditor41 只修改转换目录内代码，不新增 `findings.md`、`progress.md`、`task_plan.md`。
- 初次检索 tov5parser 测试路径使用了未引用的 `test*` glob，被 zsh 因无匹配而中止；已记录，后续改用明确文件路径。
- 两个仓库当前分支分别为 `main`、`master`；VxEditor41 已有用户的 `.gitignore`、`src/stores/event.js` 和未跟踪组件目录，本轮保持不动。
- 已在两个仓库的 `serverAstCompiler` 增加通用归一化：解析 `get(ref, method)` 的目标节点和 Java 方法定义，剔除 `IvxContext/props/parentProps` 后计算业务参数数，仅对 `errorCb` 方法的超长末参执行一次移除。
- 归一化先于原有 `_fakeCbInner` 清理执行；若末项本身是 `_fakeCbInner`，新规则不弹出，由原有 pass 继续处理。
- tov5parser 已增加纯 AST 回归，覆盖 `server-api.sendServerApiRequest`、`data-db.dbBatchUpdate` 和 V5 fake callback 保留路径；VxEditor41 同步相同实现且没有新增规划文档。
- tov5parser 定向测试 17/17、全量测试 44/44 通过，两个仓库 `git diff --check` 均通过。
- 已用最新 V4 源重新生成单行压缩 `localCases/v5/frp-pad/app.v5.json`：29,971,640 bytes、0 换行、SHA-256 `9dc2196a6dfb623c1affc20dad727f9eec76d7a2c04ab29bbee17420cc421e73`。
- 目标服务 `_code` 长 998，与正常 `case_12225413.json` 逐字一致；80 个后台代码全部可编译，75 个 server-api 和 1 个 data-db 调用的最终参数数量全部正确。
- VxEditor41 定向 ESLint 0 errors/0 warnings，production webpack build 成功（33 条其他文件既有 warning）；本轮只修改 `src/utils/convertV4ToV5/serverAstCompiler.js`，未触碰用户已有修改，也未新增规划文档。
- 按仓库规则尚未创建 Git 提交，等待用户确认。
- **Phase 25 Status:** complete。

## 2026-07-23 提交并推送双仓库修复

- 用户确认将 tov5parser 与 VxEditor41 的本次修复全部提交并推送。
- tov5parser 提交范围为转换编译器、回归测试和计划记录；VxEditor41 仅提交 `src/utils/convertV4ToV5/serverAstCompiler.js`，继续隔离用户已有修改和未跟踪目录。
- tov5parser 已提交并推送：`cf51e74 fix: normalize server error callback arguments`，`origin/main` 更新成功。
- VxEditor41 已提交并推送：`8e1180c22 fix: normalize server error callback arguments`，`origin/master` 更新成功。
- VxEditor41 的 `.gitignore`、`src/stores/event.js` 和未跟踪组件目录仍仅留在本地，未进入提交。
- **Phase 26 Status:** complete。

## 2026-07-23 full-js jsfn 单行输出修复

- 用户确认按诊断建议继续修复。
- 本轮将只调整 full-js fallback 的 Astring 输出选项，不用正则改写代码文本；目标是兼容 VxEditor41 单行 tokenizer，同时保持 JavaScript 语义。
- 已修改生成选项并更新回归断言；定向测试 8/8、全量测试 39/39 通过。
- 首次尝试通过临时日志文件抑制真实案例的大量既有诊断输出，被命令安全策略拒绝；转换尚未执行，改用直接命令继续。
- 已重新转换 frp-pad 并归位新产物；诊断仍为 2,722 条 jsfn fallback、dropped 0，说明输出格式调整未改变 fallback 分类。
- 全案例共有 2,589 个 jsfn，含换行 0、不可编译 0、参数数目不匹配 0。
- 6/6 个“量体部门”绑定均为完整单行 `map(item => {...}).join("、")`，回调内容与 7 个参数均保留。
- 新 `app.v5.json` 为 29,870,203 bytes，文件换行 0，SHA-256 `6875abefa6af31aaac6fbfa54b307ac1ade4c4e297e71414c21318d7176d1a1e`。
- **Phase 14 Status:** complete。

## 2026-07-23 重新下载并转换修正后的 frp-pad

- 用户已在 v4 案例中修正表头可见条件：旧表达式在 `authData` 为空时依赖异常被忽略，v5 的可选链语义则返回 false；现在需要重新获取源案例并转换。
- 本轮将按 `raw/` 内部文档调用中文服接口，覆盖本地 v4/v5 案例产物，并做表头与正文定向审计。
- 已完整读取导出文档，确认必须先查询当前 work_id，再调用只读 `/work/load` 二进制接口并校验三个顶层分段。
- 中文服 SSH 隧道已在本机 `127.0.0.1:13306` 可用；首次用 mysql CLI 查询失败，因为本机未安装该命令，改用 Python 只读客户端。
- Python 路径也缺少 `pymysql`；下一步优先复用本机已有数据库客户端/Node 驱动，避免无必要安装全局依赖。
- 本机未发现其他数据库客户端，已把 pymysql 临时安装到 `/tmp` 后完成只读查询；最新 work_id 为 `cbt1eskpeu4lef3h2330-2920`，较本地旧源的 `-2919` 更新。
- 最新二进制案例下载与解码成功，完整性检查通过；新旧节点数一致，authData 相关字符串增加 1 条，正在定位用户修正的具体表达式。
- 已确认目标表头节点的新可见条件增加 `authData.length===0 || ...`，源修复命中且 token 元数据完整；可以安全覆盖本地 v4 输入并开始转换。
- 已覆盖本地 v4、更新案例 README，并重新生成/归位压缩 v5 与诊断报告。
- 定向审计通过：表头 visible AST 包含空数组放行分支；6 个正文目标健康；全部 2,589 个 jsfn 单行且可编译；53 个云端模块标记完整。
- 表头 jsfn 四组语义用例全部通过：空 authData 时可见；有权限时可见；无权限时隐藏；行本身 show=0 时隐藏。
- 项目全量测试 39/39 通过；Phase 15 完成。
- **Phase 15 Status:** complete。

## 2026-07-23 款式信息文件请求卡住诊断

- 用户报告“款式信息”列文件图标：v4 会发起请求服务并显示弹窗，v5 进入加载状态后不发请求。
- 本轮先诊断不修改转换程序；将复现运行时差异，并从节点 ID 回查事件动作链。
- 如需刷新 Chrome 页面，将在刷新后立即恢复用户提供的 sessionStorage 会话值。
- Chrome 已识别并接管两个目标运行页；首次并行读取两个大型 DOM 快照超时，后续改为逐页定向读取，页面未刷新。
- v4 页面即使单页遍历全部元素仍超时；已停止宽范围浏览器检索，先用案例 JSON定位“款式信息”节点和事件 ID，再回到页面做精确读取。
- 定位到图片节点 `cm1wxsqa3j500009jj8g`（名称“款式信息”），点击事件入口 `cm21x4ma3j5000036wrg`；外层动作会设置当前订单，再调用模块实例 `cv891cna3j500009qnw0` 的公开动作组 `cv7jynaa3j50000bt49g`“获取款式信息”。
- v4/v5 的节点、外层事件链、当前订单参数以及三个后端服务引用均存在；服务转换或注册不是首个故障点。
- 隔离运行复现：v4 点击后依次输出“获取款式信息→显示提示语→加载中→当前订单→款式信息…”并发出三个服务请求；v5 只输出到“加载中”，新增请求为 0。
- 首个语义分叉为动作 `cv7jynaa3j50000bt4b0`：v4 以 `undefined` 回调调用“显示提示语”并立即执行下一动作，v5 却生成 `op: let` 等待该动作组返回；而“加载中”分支只有 showLoading，没有输出参数和 funcResult，因此动作链永久停住。
- 根因位于 `v4ToV5/converter.js`：转换器仅依据 `action.callback` 能力标记生成 `let`，没有判断该动作实例是否真的挂载 status 回调子块。修复应以实际存在 `type: status` 的 child 为准；无 status child 时生成直接 `get` 调用。
- frp-pad 中有 4,190 个 `action.callback=true` 动作，其中 2,752 个没有 status child（2,327 个为 fireFuncGroup）；这是潜在同类语义风险，但并不代表每一处都会出现可见卡死。
- 本轮仅完成诊断，没有修改转换程序。
- **Phase 16 Status:** complete。

## 2026-07-23 无限动画 play 动作自动跳过

- 用户复核确认真实阻塞 BID 为 `cv7jynaa3j50000btc9g`：调用 `data-animate` 节点 `cv7jynaa3j50000btc40` 的 `play` 方法；该节点 `props.infinite=true`。
- V5 将带回调的 play 转为 `op: let` 后会等待动画完成，而无限动画不会完成；按案例迁移规则，这类动作需在转换后自动标记 `skip`。
- `v4ToV5/converter.js` 已在动作转换阶段解析目标节点：仅当节点类型为 `data-animate`、方法为 `play` 且 `props.infinite===true` 时设置动作 AST `skip=true`；同一标记也传递给可能存在的回调子块。
- 新增回归测试同时覆盖无限动画和有限动画：二者均保留 `op: let`，只有无限动画 play 被跳过。
- 定向测试 13/13、项目全量测试 40/40 通过，`git diff --check` 通过。
- frp-pad 内存重转验证：`cv7jynaa3j50000btc9g` 输出为 `op:"let"` 且 `skip:true`，目标对象仍为 `cv7jynaa3j50000btc40.play`。
- 全量静态扫描 frp-pad：共有 22 个 `data-animate.play` 动作，其中 11 个目标节点 `props.infinite=true`；除当前 BID 外还有 10 个同类动作（9 个启用、1 个原本已禁用），均会被本次规则自动标记 skip。其余 11 个非 infinite play 不受影响。
- 已按用户要求用最新 v4 源重新生成紧凑格式 `localCases/v5/frp-pad/app.v5.json`：29,870,582 bytes、0 个换行，SHA-256 `c8fffcd4b278c6b163c6e32548ff4661a1d7acf9400f187959b6c9ad582af45f`。
- 成品核验：源案例 11 个 infinite animate play BID 在 v5 中全部存在且全部 `skip:true`；目标 `cv7jynaa3j50000btc9g` 为 `op:"let"`、方法 `play`、`skip:true`。
- 无限动画 play 修复及测试已提交并推送：`35e58a7 fix: skip infinite animation play actions`。
- **Phase 17 Status:** complete。

## 2026-07-23 “加载成功”提示不关闭诊断

- 用户确认重新转换后款式信息弹窗已能打开，但“加载成功”提示持续显示、没有自动关闭。
- 本轮先诊断不修改代码；重点追踪成功提示动作之后的延时、动画和隐藏动作，以及 V5 `let` 等待语义。
- 工作区存在用户对 `.gitignore` 的未提交修改，本轮保持不动。
- 已定位成功提示链：`cv7jynaa3j50000btc6g` 设置显示状态后，成功分支应延时 1.5 秒执行 `cv7jynaa3j50000btcag`，把 `cv7jynaa3j50000btc60` 设为 false。
- 成功类型参数、分支条件、关闭动作和 visible 绑定均正确；成功分支也不会执行 infinite animation play，排除此前 `cv7jynaa3j50000btc9g` 修复的影响。
- 首个失败点收敛到关闭动作前由转换器生成的延时 `op:let`：当前成品行 ID `d9gwmdh60k47gd9fn92g` 等待回调式 `sobj/base.delaysMethod(1.5)`；V5 await 执行链未承接其完成回调，导致下一行 setFalse 不执行。
- 已给出修复边界：调整 `genActionDelay()` 的 V5 异步等待表示或 runtime Promise 桥接，不修改成功条件与关闭动作。本轮诊断未修改项目代码。
- **Phase 18 Status:** complete。

## 2026-07-23 延时变量方法后补充 UI 刷新让步动作

- 用户运行时确认前置延时与 `setFalse` 都已成功执行；真实问题是变量值改变后，绑定组件 UI 没有重新渲染。
- 本轮修正此前诊断，并按用户给定 AST 实现：V4 中带延时的变量组件方法转为 V5 后，在该方法动作后追加零时长 `delaysMethod` 的 `op:let`。
- 工作区中用户的 `.gitignore` 修改继续保持不动；本轮将修改转换代码、测试和重新生成的案例产物，但不会未经确认创建 Git 提交。
- 已修改转换器：增加 8 类变量组件白名单；命中带延时且启用的变量方法时，在原方法 AST 后、回调 AST 前追加 `genActionDelay()`。
- `genActionDelay()` 现在仅在传入具体时间时写入 `timeArg.val`；无参调用精确生成用户要求的 `{key:'time', op:'val'}` 零时长参数。
- 已新增回归测试，同时覆盖：带延时布尔变量命中、带延时普通 UI 组件不命中、无延时变量不命中，并精确断言新增 AST 的随机 ln 关联返回变量和无 `val` 的 time 参数。
- 定向测试 `node --test v4ToV5/v4ToV5.test.js` 已通过：14/14。
- 项目全量测试通过：41/41；`git diff --check` 通过。
- 已用最新 V4 源重新生成紧凑 `localCases/v5/frp-pad/app.v5.json`：29,884,854 bytes、0 个换行。
- 成品验证通过：64 个带延时变量方法均新增零时长让步；目标 `cv7jynaa3j50000btcag` 后紧邻新动作 `d9gxppt60k4c091ewwy0`，AST 与用户给定结构一致且 time 参数无 `val`。
- 最终差异检查确认只修改转换器、转换工具函数、回归测试和规划记录；用户已有 `.gitignore` 修改未触碰。本轮未创建 Git 提交。
- **Phase 19 Status:** complete。

## 2026-07-23 同步今日转换修复到 VxEditor41

- 用户要求把今天在 tov5parser 修复的全部 V4→V5 转换问题同步到 VxEditor41。
- VxEditor41 当前存在用户未提交修改和大量未跟踪组件目录；本轮只修改 `src/utils/convertV4ToV5/` 内必要文件，不触碰其他内容。
- 按用户既有要求，不在 VxEditor41 新增 `findings.md`、`progress.md`、`task_plan.md`；计划记录仅保留在 tov5parser。
- 已确认 VxEditor41 缺少今日 3 项修复，并移植到对应 3 个生产文件：full-js 三元回调与单行输出、infinite 动画 play 自动 skip、延时变量方法后的零时长刷新让步。
- 未向 VxEditor41 添加测试文件或任何规划文档；其他脏工作区内容保持不动。
- 三文件差异检查通过；首次定向 ESLint 为 0 errors、1 条纯格式 warning，已按仓库 Prettier 规则调整单元素 `args` 数组。
- 调整后定向 ESLint 0 errors/0 warnings，3 个文件 Babel 语法解析全部通过。
- `npm run build` 成功完成；webpack 只有仓库其他文件的 33 条既有 warning，未出现本次转换文件错误。
- 最终 VxEditor41 状态核验：本次只新增 3 个转换文件修改；原有 `.gitignore`、`src/stores/event.js` 和未跟踪组件目录均保持原状；仓库根目录没有规划文档。
- 本轮未创建 Git 提交，按仓库规则等待用户确认后再提交。
- **Phase 20 Status:** complete。

## 2026-07-23 外部 V5 JSON 服务注册差异诊断

- 用户提供 `/Users/lianghuang/Downloads/case_12225413.json`，要求与当前 `localCases/v5/frp-pad/app.v5.json` 对比。
- 目标是解释服务 `ceyjn3ca3j50000468k0` 为什么在外部 JSON 中可正常调用，而当前转换产物运行时报“服务不存在”。
- 本轮只做只读结构分析，不修改 JSON 或转换程序。
- 已确认服务定义、所属模块、调用 AST、参数和全部节点 ID 均未丢失；两份 JSON 节点规模与 ID 集合完全一致。
- 关键差异为外部文件经过 V5 server 编译：目标服务事件带 998 字符 `_code`，server 根带 `v2=1`；当前转换产物的 80 个服务只有 AST，`_code` 数量为 0，server 根也无 v2。
- 按运行时注册规则验证：外部可注册 20 个服务并包含目标，当前可注册 0 个服务，不包含目标；根因已确定。
- 建议后续修复转换器：输出前对 server classes 执行 AST→`_code` 编译，并补齐 V5 server 模式标记。本轮未实施代码修改。
- **Phase 21 Status:** complete。
