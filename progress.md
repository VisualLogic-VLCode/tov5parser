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
