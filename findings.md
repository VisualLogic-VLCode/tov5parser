# Findings & Decisions

## 2026-07-24 同步 VxEditor41 并提交推送

- 用户明确授权：将数字字面量 receiver 修复同步到 VxEditor41，并将 tov5parser、VxEditor41 两个仓库都提交并 push。
- VxEditor41 当前分支 `master`，已有用户修改 `.gitignore`、`src/stores/event.js` 和多个未跟踪组件目录；本轮只会暂存转换器对应文件，其他内容保持不动。
- tov5parser 当前分支 `main`，待提交为本轮转换器、回归测试及规划记录。
- VxEditor41 对应文件为 `src/utils/convertV4ToV5/formulaCode/ExprAstToString.js`，同步前该转换目录无未提交差异；仓库没有对应自动化测试文件，将用 ESLint、Babel 解析和最小运行重放验证。
- 修复已同步到 VxEditor41；定向 ESLint 和 Babel 解析通过。首次内存重放因该仓库默认 Babel 配置保留 ESM import 而无法由 CommonJS 包装器执行，下一次改用显式 CommonJS 模块转换。
- 显式 CommonJS 转换后的运行重放成功输出 `(1).toString()` 并通过 JavaScript 编译。
- VxEditor41 生产构建成功（webpack 33 条仓库既有 warnings、0 errors）；同步文件自身定向 ESLint 为 0 warnings/0 errors。
- 两个本地分支均与最新远程一致（ahead 0 / behind 0），无需合并。
- 待提交范围已核对：tov5parser 为转换器、回归测试和三份规划记录；VxEditor41 仅一个 `ExprAstToString.js`，用户其他修改不在范围内。


## 2026-07-24 修复 `(1).toString()` 非法输出

- 用户要求修复转换器把合法的 `(1).toString()` 输出成非法 `1.toString()` 的问题。
- 已知根因位于 `v4ToV5/formulaCode/ExprAstToString.js` 的 `MemberExpression` 打印逻辑：只给 `BinaryExpression` receiver 加括号，未处理数字 `Literal`。
- 本轮范围包括生产修复、最小回归测试、全量测试和案例 11023063 重转审计；不会未经确认创建 Git 提交。
- 最小修复已实施：`MemberExpression.object` 为数值 `Literal` 时统一输出括号，避免整数后的点号被当作小数语法。
- 回归测试直接覆盖 `jsep('(1).toString().padStart(2, "0")') → ExprAstToString`，修复前精确输出非法 `1.toString()`，修复后输出 `(1).toString()` 且可编译；定向测试 9/9 通过。
- 项目全量测试增至 45/45 通过，未发现其他转换路径回归。
- 案例 11023063 重转成功：v5 仍为紧凑 JSON，1,004/1,004 个 jsfn 全部可编译，参数数目不匹配 0，旧 `$refs/fParam/cbParams/_loop/$P_` 源语法残留 0。
- 目标公式已从非法 `$v1 + "." + 1.toString().padStart($v2, "0")` 修正为 `$v1 + "." + (1).toString().padStart($v2, "0")`；错误分析文档已同步更新。
- 新 v5 为 26,756,953 bytes，SHA-256 `a3c50f38863cf49fbd4d8fdbd1e807c3de0dea48a3a320ca853ec57a44dca45e`。
- `archive.runtime-tov5.zip` 已重建（1.9 MB），压缩包内确认包含本次 `isNumericLiteral` 修复。


## 2026-07-24 案例 11023063 获取与转换

- 用户要求从中文服接口获取 nid `11023063` 的 v4 案例，转换成 v5 JSON。
- 若转换产生诊断，交付目录与 `localCases/v5/frp-pad` 对齐：紧凑 `app.v5.json`、逐条 `app.convert-errors.json/.md`，并补充 `app.convert-errors.analysis.md` 做根因归类。
- 下载链路按 `raw/中文服完整案例JSON导出.md`：只读数据库查 `work_id/ntype/版本`，再调用编辑器 `/work/load/{workId}?nid={nid}` 解码完整 `stage/server/case`。
- 数据库确认：标题“frp-后台”，编辑器版本 4.1，`ntype=1`，`work_id=calcup52uhpcud8vv3h0-2496`，版本号 1016，已发布/已上架；发布链接码 `nL0DIwFE`。
- 编辑器加载接口下载和解码成功；源文件为紧凑 JSON，29,297,509 bytes，顶层完整包含 `case/server/stage`，根类型分别为 `ih5-case/data-server/ih5-stage`。
- 源树统计：前台 128 个节点、后台 638 个节点、case 根 1 个节点；stage/server 顶层均无 classes。
- 使用 `ntype=1 --diag` 转换成功，v5 紧凑 JSON 为 26,756,951 bytes；诊断 1,023 次、去重 999 条，全部是 `custom-expr-fallback`，dropped 为 0。
- 诊断主类为 `||` 372、full JavaScript 326、`&&` 129、unknown varType 51、flat 48、NewExpression 42、SpreadElement 19、toString 18，其余低频。
- 结构初审：767/767 个源节点 ID 均存在；5,051/5,051 个普通源动作 BID 均有 v5 `ln` 落点；1,004 个 jsfn 参数数全部匹配、旧 `$refs/fParam/cbParams/_loop/$P_` 源语法残留为 0。
- jsfn 语法审计发现 1 个不可编译表达式：`$v1 + "." + 1.toString().padStart($v2, "0")`。这是数值字面量后直接成员访问缺括号的转换结果，需在错误分析文档中明确标为转换器缺陷。
- 已生成 `app.convert-errors.analysis.md`：将 1,023 次诊断收敛为 6 个根因组，明确 1 个转换器缺陷和 2 个源案例已有的悬空服务引用。
- 最终校验：源/v5/诊断 JSON 均可解析，v5 为 26,756,951 bytes、0 换行的紧凑 JSON，`server.props.v2=1`；项目全量测试 44/44 通过，`git diff --check` 通过。
- v5 SHA-256：`16c8682226d73a993bdf3d7b9b48663de8a15907a04c592f8b0746dd690d3263`。


## Requirements
- 4.x 案例 JSON → 5.x 案例 JSON 的转换接口，独立项目 + 独立 lambda 部署
- 只做 v4→v5，不做一步到 VL（5.x→vl 仍走 vlparser 的 legacyToVLang）
- 部署模式与流程仿 vlparser（S3 中转、版本+别名、API Gateway），但用独立的 AWS 中国区账号
- 调用方为其他程序，通过 HTTP 调用；后续要支持 v3→v5（项目因此命名 tov5parser）
- 大 JSON 超 Lambda 6MB 限制时走 S3 中转
- 本轮目标：分析 `localCases/v5/frp-pad` 转换到 5.0 后的全部错误，按可共同修复的根因归类，并映射到具体转换函数
- 当前诊断目标：解释同一 frp-pad 页面在 v5 运行时为何缺失整组表头及部分正文列；先定位，不修改转换函数。

## Research Findings

### frp-pad v4/v5 运行时表格缺失（2026-07-22）

- Chrome 可访问树显示 v4 有完整表头（单据编号、公司名称、人数、件数、量体类型、量体部门、量体师等），v5 从“当前量体师”直接进入数据行，表头整组不可见。
- 早期按文本命中的 `cm1wxmya3j500009jgn0` 实为“未使用过滤表头”，其表格根 `cbxgwfha3j50000cnzfg` 静态 `visible=false`，不是当前页面使用的表格；此前对其冻结列和列宽的怀疑排除。
- 当前表格为 `cm1wxsqa3j500009jgng`：表头由模块实例 `cm1wys3a3j500009jjeg`（class `C_ch4bzpya3j50000ykwq0`）渲染，正文外层循环 `cm1wxsqa3j500009jhjg` 与表头模块都绑定 `量体过滤表头` `cm1x0qta3j500009jjxg`。
- `过滤表头配置` `cm5578da3j50000mm3kg` 在 v4/v5 中都完整保留了 `authTableType=21` 的 19 列；多处初始化 `find(i=>i.authTableType==21).columnShownData` 的 v5 AST 也正确，排除列配置丢失和初始化公式错误。
- `switchexp` 中的空 `=` 节点是 v5 三元表达式默认分支的标准 schema，不是条件错误。
- **正文确定根因**：显示用节点 `crnjam2a3j50000gp5kg` 的 v4 公式包含三元表达式分支中的块体箭头 `measureUserDepartment.map(item=>{...})`；v5 结果却是 `!$v1 ? "" : $v2`，而 `$v2` 的 `objArr_map` lambda 只返回空 `{op:'val'}`。同一表格共发现 6 个“量体部门”值绑定存在该空回调，因此正文内容被计算为空。
- 责任点为 `V4FormulaCodeConverter.walkCustomExprParsed()` 的 `ConditionalExpression` 分支：full-js 模式仍直接调用 `processParsedTree()`，未像 `BinaryExpression` 等分支一样通过 `walkOrReplaceCustomExpr()` 先判断 `containsFunctionExpression()`，导致嵌套块体回调被局部原生化并折叠为空。
- **表头直接条件**：class 内单元 `ch4bzxqa3j50000ykwxg` 的 visible 为 `show==1 && authData.find(...).read==1`；私有 `authData` `cpvn450a3j50000a0mxg` 初值为空，只会由公共方法“设置权限” `cpvn410a3j50000a0me0` 写入。案例中未找到父级对该方法的显式调用；v5 AST 本身未丢失 visible 或方法逻辑。因此 v5 表头全部隐藏与模块权限未初始化吻合，需在修复阶段验证 v4 云端模块的旧运行时隐式权限注入在 v5 中应如何承接，不能误改为列宽或普通条件转换问题。
- Chrome 接管 v5 运行页持续超时；未刷新页面，也未改写 sessionStorage。表头的运行时 `authData` 尚不能从浏览器内直接读取，因此权限注入结论标记为高概率、待修复验证；正文空回调是 JSON 级确定问题。

### frp-pad 错误报告概况（2026-07-21）
- 报告共记录 4,980 次错误，去重后 4,965 条；3,258 次降级为空值（逻辑丢失），1,722 次转为 custom expression（逻辑保留）
- 结构化报告字段：`message/phase/outcome/nodeId/nodeType/nodeName/bid/ln/prop/propKind/triggerName/actionName/blockType/scope/code/count`
- 高频原始报错：Expected comma 2,425；unknown varType 899；Unexpected `{` 528；不支持 `||` 413；不支持 `&&` 271；Unexpected backtick 115；Unexpected period 105；不支持 substring 82；callee undefined 37
- 报错明显集中在“v4 公式代码 → v5 公式 AST”链路，不是一般的节点/动作映射报错；需要进一步按代码语法特征归并根因，不能直接把 30 多个错误字符串当作 30 多类修复
- 样例显示 `Expected comma` 大量由箭头函数（find/filter/map）触发；`Unexpected period` 样例由数组展开语法 `[...new Set(...)]` 触发；`Unexpected {` 样例由对象字面量或 IIFE/函数体触发
- 公式入口 `convertEditorValue` 对每个事件参数/绑定调用 `V4FormulaCodeConverter.exec()`；`parseStr()` 先用 `jsep` 解析，再把 jsep AST 转成 v5 公式 AST
- 第一层失败（`jsep-parse`）目前只记录错误，随后仍对空对象 `{}` 执行 AST 转换，最终静默得到 `{op:'val'}`；因此所有 jsep 语法不支持均会直接丢逻辑
- 第二层失败（自定义转换器抛 `ParseError`）在 gateway 处通常会走 `processCustomExpr()`，保留为 jsfn；唯独顶层 `SpreadElement` 被明确继续抛出，随后在外层 `ast-convert` 被降为空值
- 当前分类报告把“解析器能力不足”和“v5 AST 转换器能力不足”混在一起；修复策略应优先按 `phase + syntax feature + outcome` 分类
- `V4FormulaCodeConverter` 源码已预留 `NewExpression/SpreadElement/TemplateLiteral` 识别，但主动标为不支持；同时实现了 `ExprAstToString` 对这些节点的反序列化，说明 custom-expression fallback 原本就具备承接这些语法的基础
- **关键根因线索**：独立项目当前 jsep 1.4.0 只注册了内置 `ternary` 插件；实测箭头函数、对象字面量、模板字符串、展开运算符、正则字面量全部解析失败，与 2,425/528/115/105/部分 Expected comma 的错误完全吻合
- jsep README 明确这些语法分别由官方 `arrow/object/template/spread/regex` 插件提供；当前 `package.json` 未声明任何 `@jsep-plugin/*` 包
- 上游 VxEditor41 同样依赖 jsep 1.4.0，但存在全局 `src/utils/jsepWrap/index.js`。需检查该封装是否在编辑器启动时向共享 jsep 单例注册插件；若是，说明独立移植遗漏了运行时初始化，而不是原转换器本身设计就不能处理箭头函数
- 当前报告 3,258 个丢失记录全部属于 `jsep-parse`；1,722 个保留记录全部属于 `custom-expr-fallback`。没有第三种混杂情况，修复路径非常清晰
- **已确认移植遗漏**：上游 `jsepWrap` 会向 jsep 全局单例注册 object（本地定制版）、arrow、regex、spread、new、template 六个插件，并添加 `exprStr` 源码区间 hook；独立项目既没移植 wrapper，也没注册插件
- `exprStr` hook 不是可选装饰：当前转换器多处用 `parsed.exprStr` 生成 custom expression 或错误信息。修复时应整体移植 wrapper 初始化，不能只零散注册插件
- 上游 object 插件是定制版，额外保存属性值原串 `valueRaw`；优先复用这份实现而不是直接换官方 object 包，以保持转换行为一致
- 用上游同款六插件重放原 3,258 个解析失败公式，并先执行现有 `$P_xxx:` 提示清理后：**2,739 条可重新解析，解析丢失可立即减少 84.1%**；仍有 519 条无法用 jsep 表达式语法表示
- 剩余 519 条组成：455 条含语句块的箭头函数/IIFE（jsep 只支持 expression，不支持 statement/function body）；41 条是 `.style`、`.replaceStyle`、`6px`、`4新路径` 等裸文本/残片；7 条赋值或复合赋值；3 条块箭头内赋值；1 条多余右括号；1 条空 code；其余同类少量残片
- 这说明第一轮修复可高收益、低风险地“恢复上游 jsepWrap”；第二轮需新增 parse-failure 的 jsfn/文本兜底策略，不能指望继续堆 jsep 插件解决语句级 JavaScript
- 完整案例内存重跑（恢复六插件）结果：诊断 4,980 → 3,382；`dropped` 3,258 → **519**；`custom-expr` 1,722 → 2,863。插件恢复会把大量“丢逻辑”转成“原生 AST 或 jsfn 保留”，不是简单隐藏报错
- 当前错误影响 1,710 个节点、3,254 个事件块；直接丢失影响 1,154 个节点。丢失集中于 `data-funcGroup`（1,881/3,258），其次 ih5-text 428、layoutrow 273、data-if 131、button 118
- 当前 3,258 个 dropped 的落点：动作参数 2,281、绑定 518、无属性/条件等 449、普通参数 10；其中 server 仅 25，stage 3,233
- 当前 1,722 个 custom-expression 全在 stage：动作参数 899、绑定 529、条件等 288、普通参数 6
- 519 条二次剩余精确拆分：390 条块体箭头函数（`x=>{...}`）、65 条 IIFE（`(function(){...})()`）、64 条非语句问题
- 64 条非语句问题中，大部分是应按字符串处理的 action `path`（`.style/.replaceStyle/...`）和 CSS 参数（`6px/10px/...`）；另有 7 条赋值/复合赋值表达式、1 条多余括号、1 条空 code。它们不应采用同一种修复
- 原始 parser 错误经 wrapper 可恢复明细：Expected comma 2,117；Unexpected `{` 434；Unexpected backtick 113；Unexpected period 45；Expected expression 相关 22；regex `/` 8。剩余原始错误中，Expected comma 308/Unexpected `{` 94/Unexpected period 60 主要都归入语句块
- 当前 899 条 `unknown varType` 中 **785 条公式含 `fParam<动作组id>.<字段>`**，是单一高价值根因；其余约 80 条 Date/全局符号等、25 条 `$refs` 复杂表达式、少量数组/Object/callback
- 抽查 `fParamcd1r6nja3j50000jw3qg`：目标确实存在，类型为 `data-funcGroup`，位于 class `C_cd1r49sa3j50000jw1e0`。因此 785 条不是源案例引用不存在，而更像独立 env 的 class 节点索引/活动 class 解析不一致
- 当前 `env.js` 将 class 子节点仅放入 `classNodeMaps[classId]`，不放主索引；`getNodeById` 优先活动 class 再主索引。需要与上游 `treeStores.getNodeById(nodeId, classId)` 的真实 fallback 行为逐项核对，特别是跨 class 引用与 classId 切换时机
- **fParam 根因已定位并复核修正**：frp-pad 的 stage/server 各有一份模块 class，二者共用同一个 `classId`，但包含不同的前台/后台子节点。当前 `createV4ConvertEnv()` 每遇到 class 都执行 `classNodeMaps[classId] = {}`，处理 server 时覆盖了先前的 stage class map
- 直接把活动 class 切到 `C_cd1r49sa3j50000jw1e0` 后查前台动作组 `cd1r6nja3j50000jw3qg` 为 undefined；该 classId 在 stage/server 各出现一次，确认是跨 scope 覆盖而非 class 嵌套漏扫
- 修复责任点明确为 `v4ToV5/env.js::createV4ConvertEnv`：相同 classId 的前后台节点应合并进同一 map，不可重置；修后预计至少消除/正确参数化 785 条 fParam fallback
- 上游 `getNodeFromMap` 在传 classId 时只查该 class map（不回退 main map）；当前 env 的 fallback 更宽松，但不是本案主因。应保留/核对这一差异，避免递归索引修复时顺带改变跨作用域语义
- “custom-expr = 逻辑保留”需要细分：抽查 `&&` 与 `substring` 产物，均正确把 `$refs` 改成 `$v1...` 并生成 jsfn args，确实可运行；但 fParam 产物是 `jsfn("fParam....")` 且 args 为空，引用未转换，不能视为可靠保留
- 因此报告 outcome 建议新增 `custom-expr-unresolved`：若 jsfn 源仍含 `$refs/fParam/cbParams/_loop` 等 v4 特有符号且未生成对应 args，应列为逻辑风险，而非与正常 jsfn 合并
- `substring/findIndex/flat/flatMap` 等在当前 sysutil map 中没有原生映射，走 jsfn 是合理设计，不必为了“清零诊断”强行加映射；`match` 有 RegExp.match 映射但调用形态/参数语义不同，也应优先保留 jsfn

### P0 修复实现约束（2026-07-21）
- 上游实际锁定插件版本：arrow 1.0.6、new 1.0.4、object 1.2.2、regex 1.0.4、spread 1.0.3、template 1.0.5；本项目应使用兼容范围并由 package-lock 固定
- 上游没有直接使用官方 object 插件，而是 81 行定制实现；修复需原样移植以保留 `valueRaw`
- 现有 env 单测只覆盖单侧 `stage.classes`，未覆盖 stage/server 共享 classId 的双树结构；新增跨 scope 同 classId fixture 可准确防回归
- object 采用本地上游定制实现，因此外部依赖实际新增 arrow/regex/spread/new/template 五个；object 能力仍作为 jsep 第六类插件注册
- 两个 P0 合并后的真实 frp-pad 结果优于单独恢复 wrapper 的预测：总诊断 2,477、dropped 519、jsfn 1,958；说明 class map 合并又消除了约 905 个 fallback/诊断
- 修复后 `unknown varType` 从 899 降到 96；含 fParam 的相关记录从基线 785+ 降到 3，验证 class map 合并命中主因
- 剩余 52 个确定文本值有稳定上下文：39 个 `path` 参数且为 `.field` 形态、10 个 setProps `paddingRight` CSS 单位、3 个 consoleLog `info` 数字+中文标签；可在动作参数转换层精确处理，不采用全局“解析失败即文本”
- 文本修复实测完全命中预期：dropped 519 → 467，52 条对应错误全部消失；剩余 dropped 不再含 `Variable names cannot start with a number`
- 完整 JavaScript fallback 后 dropped 467 → 1；块体箭头、IIFE 和赋值均转为参数化 jsfn，唯一 dropped 是 `visible` 绑定中多出的一个 `)`，Acorn 与 jsep 均确认源语法无效
- 全量扫描最终 2,469 个 jsfn：仅 2 个仍含 v4 专有引用，均为 `cbParams.style/data` 且所在事件祖先没有 status callback，属于源案例错误；其余 `$refs/fParam/_loop/param/$cur*` 全部已参数化
- 最终诊断总数升至 2,579 是因为原先每个 parser 丢失只记一次，现改为 jsfn 后会记录内部可预期 fallback；这不代表退化。质量指标应以 dropped/unresolved 为准
- jsfn 编译审计暴露 jsep arrow 插件的另一行为：部分 `item=>{ return {...} }` 没抛 parse error，而是被误解析为对象表达式，绕过 Acorn fallback，最终由旧打印器生成 `{: , : }`
- 语句级公式不能只在 jsep 抛错后兜底；应在解析前识别块体箭头/IIFE/赋值并优先路由 Acorn，避免“jsep 误解析但不报错”
- 另有 `consoleLog.info = "wy 量体部门"` 被 jsep 解析为 Compound 后打印为空；这是有明确 info 上下文的纯文本，应纳入精确文本规则
- 预路由后剩余 9 条无效 jsfn 已归并为四个具体原因：1 条对象表达式箭头体缺少括号；4 条 `.includes(...)` 与 2 条 `flat().map(i => )` 都是完整 JS 中嵌套节点又进入旧 custom-expression 流程并发生局部 AST 变异；2 条空 jsfn 分别是 `session,key` 文本标签和 jsep 未按一元运算识别的 `typeof` 表达式
- 上述对象返回、`.includes`、`flat().map`、`typeof` 原公式均合法；`session,key` 是 consoleLog 的 info 标签，应按精确动作参数上下文恢复为文本
- `shouldUseFullJsParser` 不能用裸 `=` 正则预判：它会把对象字符串中的 SQL `status = 1` 误判为赋值并造成 dropped。真正的裸赋值可让 jsep 先拒绝，再进入 Acorn catch fallback
- 首轮尾项修复重跑后，对象返回箭头和两个空 jsfn 已修复；剩余 6 条均不是整条 full-js 源码无效，而是 full-js walker 把带 callback 的 `filter/map` 子树转换成一个 `$vN` 原生 AST 参数，该参数内部又走旧 custom printer，留下 `.includes(...)` 或空 block-arrow body
- 因此 full-js walker 应保留所有含 Function/ArrowFunction 子树的 JavaScript 结构，只参数化其内部的 v4 引用叶子；不能把带 callback 的整个调用子树折叠为原生 AST 参数
- 最新 dropped 为 2：源公式多余右括号，以及 consoleLog `info = typeof`。后者是不能独立构成 JS 表达式的保留字文本，可在 info 上下文精确恢复
- 最终二次修复后：frp-pad 共有 2,576 个 jsfn，JavaScript 编译无效数为 0；dropped 只剩源公式多余右括号，legacy 标识只剩两条源案例中越界使用的 `cbParams.style/data`

### 非公式结构审计口径

- 动作结构：按 v4 action block 的 `bid` 对照 v5 AST 的 `ln`，检查普通动作是否都有落点；多对象动作允许 `bid` 落在新增 loop 容器。
- 对象参数：源 `action.paramsAsObj` 的非空参数应在 v5 method args 上保留同名 `key`；错误回调参数允许由组件契约补充。
- DB 前台调用：每个 v5 `runsvc.val` 必须能解析到一个 `data-service` 节点，服务内必须有实际 DB method；引用数、生成服务数和源前台 DB 动作数应能闭合。
- frp-pad 源中 `paramsAsObj` 动作很多（4,557），不能用“所有 method args 都有 key”的全局比例判断，需按 bid 做逐动作匹配。
- 实测结构审计：20,170/20,170 个源 action bid 均在 v5 找到 `ln` 落点；4,557 个 paramsAsObj 动作逐 bid 汇总 `key`/dict/return 字段后，非空参数名缺失数为 0
- 302 个 `runsvc` 出现对应 106 个唯一服务目标；把 `data-service` 与 `data-sharedService` 一并纳入后，106/106 均存在，先前只查 `data-service` 得到的 45 个“缺失”是假阳性
- frp-pad 只有 1 个后台 `data-db.dbBatchUpdate` 动作，转换结果包含条件、更新值、limit、extra 与错误回调；没有“前台直接调用 data-db → 新建代理 service”的样本，因此本案例不能单独覆盖 `genDbServiceList` 分支
- 本案未观察到组件方法契约参数缺失或 service 悬空引用，不触发重新从 4.1 编辑器 dump 映射资产的备选方案

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

### 云端小模块的编辑版本标记（会话 019f8417，2026-07-21）

- VxEditor41 的冲突提示判断位于 `checkModEdtVerConflict`：仅对云端扩展组件检查，云端身份是 `node.props.widgetId` 或 `node.uis.registerID`。
- 当前案例版本取 `JSON.parse(caseMap[当前案例].extra).ver`；`ver === 2` 代表 v5。组件版本取 `node.props.modEdtVer || null`，两者不相等即冲突。
- 因而 v4→v5 后若云端 class 定义仍缺少 `props.modEdtVer`，v5 案例会把它当作 v4 小模块并提示“v4版本扩展组件无法在v5中编辑”。
- 注册组件有特殊兜底：缺少 `modEdtVer` 时会强制按 v5（2）处理；但上传组件仅有 `widgetId` 时没有该兜底，所以转换器必须补标记。
- 初步结论：转换器应只对“云端小模块 class 根节点”补 `props.modEdtVer = 2`，不能给所有普通 class 或内部子节点无差别加字段；还需核对 class 根的 `isModDef/widgetId/registerID` 实际分布与上游转换实现。
- 复核源码：编辑器只在节点组件映射 `map.isModDef` 为真时调用版本冲突检查；实际数据身份仍以 class 根的 `props.widgetId` 或 `uis.registerID` 为准。
- `checkModEdtVerConflict` 另有 v5.1 兼容：案例版本 3 可编辑 `modEdtVer=2` 小模块；这不影响本项目目标 v5 的标记值应为 2。
- VxEditor41 的下载逻辑明确区分注册组件（写 `uis.registerID`）和上传小模块（写 `props.widgetId`），验证这两个字段位于 class 根而不是普通内部节点。
- frp-pad 实测：stage/server 合计 55 个 class 根，其中 53 个带 `props.widgetId`，转换前后均有 0 个 `modEdtVer`；所以当前产物会让这 53 个云端小模块全部命中 v5 编辑器的版本冲突。
- VxEditor41 原 `src/utils/convertV4ToV5` 没有任何 `modEdtVer` 赋值；该遗漏也存在于上游转换器，不代表当前独立移植应继续保留。
- 修改边界确定为 `stage.classes` 与 `server.classes` 的 class 根：当 `props.widgetId` 或 `uis.registerID` 存在时，输出强制标记 `props.modEdtVer = 2`。这是对“已被转换成 v5 结构”的结果声明；本地小模块不加字段。
- 为避免错误降级显式标记为 v5.1（3）或未来版本的模块，最终采用“仅在云端 class 根缺少 `modEdtVer` 时补 2”；已有非空标记原样保留。frp-pad 的 53 个目标都属于缺失场景。
- 最小落点是 `converter.exec()` 的 `node.classes.map`：`convertNode` 完成后、返回 class 根之前补标记，可同时覆盖 stage/server classes，又不会递归污染内部节点。

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
- [ ] 正在验证首个真实案例 `frp-pad`（最大不确定性，见组件映射风险）
- [ ] Access Key 曾在会话输出显示过一次，待管理员轮换
- [x] 建桶权限缺失 → 管理员代建（resolved）
- [x] 命名范围不明 → 探测法确定（resolved）

## Resources
- 线上端点：https://ui9kfbjiwd.execute-api.cn-northwest-1.amazonaws.com.cn/
- 4.1 编辑器源（同步上游）：/Users/lianghuang/Desktop/ivx_repos/VxEditor41
- vlparser（基建同源 + 下游 legacyToVLang）：/Users/lianghuang/Desktop/ivx_repos/vlparser
- 凭证材料：vl-case-json-converter-aws-cn-access/（gitignored，仅本机）
- 运维手册：docs/aws-ops-runbook.md

## 2026-07-21 Lambda redeployment intake

- Repository is on `main`, tracking `origin/main`, with no Git changes reported at intake.
- Existing deployment artifact `archive.runtime-tov5.zip` is present; deployment method and target function still need to be confirmed from repository docs/scripts.
- Confirmed deploy target: account `587849590304`, region `cn-northwest-1`, function `vl-case-json-converter`, alias `prod`, AWS profile `vl-case-json-converter-cn`.
- Repository deploy script stages the zip in `s3://vl-case-json-converter/lambda-packages/vl-case-json-converter/latest.zip`, updates `$LATEST`, publishes a numbered version, switches `prod`, then can invoke `{action:"version"}` and verify the executed version.
- Planning logs are the only current working-tree changes, so deployment must use `--allow-dirty`; source and runtime inputs still match committed `main`.
- Dry-run succeeded under AWS account `587849590304`: all 36 tests passed and a validated 1.9 MB runtime archive was rebuilt. No AWS resources were changed during the dry-run.
- Before deployment, `prod` pointed to Lambda version `4` (last modified 2026-07-09 10:21:29 UTC); version `4` is the immediate rollback target.
- Deployment succeeded from Git commit `165574b`: Lambda version `5` was published and `prod` was switched from version `4` to version `5`.
- Direct alias smoke invocation returned HTTP status 200, no function error, and `ExecutedVersion: 5`; the version action returned package `@visuallogic-vlcode/tov5parser` version `1.1.0`.
- Final AWS state: `prod` points only to version `5` (no weighted routing); version `5` is Active with LastUpdateStatus Successful and code SHA-256 `9VKApPpDo88aEbhc8bJKuCVCA4oKhf1kQbVIEi+qcss=`.
- Public API Gateway endpoint returned `{code:0,message:"ok"}` for the version action, confirming the external request path is healthy after deployment.
# workspace-my 错误分析（2026-07-22）

- 输入：`localCases/v4/workspace-my/app.json`，README 元数据指定 `ntype=1`。
- 目标：用当前转换器重新生成紧凑的 5.x JSON，并沿用 `frp-pad` 的诊断、根因归类与修复函数映射方式。
- 当前 `localCases/v5/workspace-my/app.v5.json` 是 2026-07-09 的旧产物（23,744,960 bytes），本轮会以新转换结果替换。
- 当前转换器重跑成功：紧凑 v5 产物 4,039.5 KB；诊断 301 次，去重 288 条，其中 dropped 2 次、custom-expression 299 次。
- 301 次诊断只有两个 phase：`custom-expr-fallback` 299 次（286 个去重位置）和 `jsep-parse` 2 次（2 个去重位置）。
- 两条 dropped 性质不同：
  - `fireFunc.url = https://pricing.ivx.cn/`：明显是 URL 文本被当成公式，属于转换器参数类型识别缺口；节点 `cqrmp7ga3j50000vmc70`，bid `cqs5a0ra3j500006y2y0`。
  - 图片节点 `cmw95g6a3j50000j8ad0` 的 `lazyLoad` bind：586 字符复杂条件末尾括号不匹配，初判为源公式语法错误，需进一步括号/解析核验。
- custom-expression 主要原始类别：`&&` 83、`findIndex` 78、`||` 47、full-JS fallback 22、unknown varType 22、NewExpression 20、callee undefined 13；这些不能仅按“报错”判断，需继续审计 jsfn 可编译性和 v4 残留引用。
- v5 产物共 290 个 `jsfn`。用 `new Function(...params, return(expr))` 审计：289 个可编译，全部 290 个参数数目匹配，且 `$refs/fParam/cbParams/_loop/$P_` 残留为 0。
- 唯一不可编译 jsfn 为 `{op:'jsfn', val:[''], args:[]}`，来源诊断 `not support compound expression`，源 code 是未加引号的文本 `domain not registered`；节点 `cmpa0e9a3j50000ahc6g`，con bid `d1cjdz7a3j50000g9q80`。这说明当前诊断把它计作 custom-expression，但实际仍是逻辑丢失，应单列为 unresolved/invalid jsfn。
- `unknown varType` 22 次不再等同于 frp-pad 早期的 fParam 索引缺失：最终 jsfn 中没有任何 v4 专有标识残留。样本主要是 `window.location.*`、`window.open`、复杂组合公式的中间转换诊断，以及 `$sys.util...`，需按最终产物质量而非原始 message 判断。
- 零参数 jsfn 定向审计又发现 1 个“可编译但语义错误”的文本误判：条件 bid `cn6zb8na3j50000d2ja0` 使用 `include` 比较 `window.location.href` 与文本 `www.ivx.cn`；v4 `str` 明确由纯文本 token 组成，但 v5 右值变为 `jsfn('www.ivx.cn')`，运行时会把 `www` 当变量。
- 因此当前有效问题清单为：3 个转换器文本识别缺口（裸 URL action 参数、英文短语条件值、域名条件值）+ 1 个源公式括号错误。
- 文本条件的责任位置是 `v4ToV5/utils/con.js::genConObj()`：当前对 value1/value2 无差别调用 `convertEditorValue()`；需利用 operator/值侧及 v4 `str` token 判断纯文本。动作 URL 的责任位置是 `v4ToV5/utils/action.js::getLegacyFormulaTextValue()` / `convertActionParamValue()`，当前只覆盖 path、paddingRight、info。
- 空 jsfn 的形成位置是 `V4FormulaCodeConverter.processCustomExpr()`：jsep `Compound` fallback 经 `ExprAstToString` 打印为空串；诊断报告又将所有 `custom-expr-fallback` 一律标为“逻辑保留”，报告层也需要增加 jsfn 有效性/unresolved 分类。
- 结构审计通过：v4 3,140 个节点全部存在于 v5；2,263 个源动作全部有对应 v5 `ln` 落点；3 个云端 class 根全部为 `modEdtVer=2`。
- 新产物已归位：`app.v5.json` 4,136,489 bytes，SHA-256 `b35f7fdce7c14be79517e293883bef83fa488f231b25b1f82fc0e545fd198f0e`，0 行换行的紧凑 JSON，顶层 `stage/server/case`。
- 完整归类报告：`localCases/v5/workspace-my/app.convert-errors.analysis.md`。项目测试 36/36 通过。

### workspace-my 文本识别修复设计（2026-07-22）

- 动作参数已有集中窄规则 `getLegacyFormulaTextValue()`，可直接新增 `url` + 裸 `http/https/ftp` URL 规则；`window.open(...)`、引号字符串和拼接表达式不会匹配。
- 条件入口 `genConObj()` 当前对 value1/value2 完全同等调用 `convertEditorValue()`；本轮只在 value2 且 operator 允许文本比较时做窄规则，避免把 `window.location.href` 等 value1 公式当文本。
- v4 的 `str` 元数据对裸文本和某些手写 JS 都可能是 `type:'str'`，不能仅凭“全是 str token”判断；还需限定具体文本形态（英文短语、裸主机/域名）并排除数字/布尔/已加引号值。
- 回归测试可直接覆盖已导出的 `getLegacyFormulaTextValue()` 与 `genConObj()`；后者需创建最小转换 env 才能验证真实公式仍走参数化转换。
- 已实施：`action.js` 仅对 `url` 且匹配裸 `http/https/ftp://` 的 code 返回文本；带引号、函数调用、拼接表达式均不匹配。
- 已实施：`con.js` 新增 `getLegacyConditionTextValue()`，仅对允许文本比较的 operator、纯 `str` token、英文多词短语或 `www.` 主机名生效；value1 完全不改。
- 定向测试新增 1 组条件文本测试并扩充动作文本测试；11/11 通过。
- 全量测试增至 37/37 通过，`git diff --check` 通过。
- `workspace-my` 重跑：诊断 301→298、去重 288→285、dropped 2→1、custom-expression 299→297；三个转换器文本误判均从诊断中消失。
- 最终 v5 有 288 个 jsfn，288/288 可编译，arity mismatch 0，v4 标识残留 0；`domain not registered` 与 `www.ivx.cn` 均为普通 `{op:'val'}`，裸 URL 动作参数也正确保留为 `{op:'val', val:'https://pricing.ivx.cn/'}`。
- 唯一 dropped 仍是源 `lazyLoad` 末尾多余右括号，符合预期且不属于转换函数修复范围。
- 修复后产物已归位：4,136,472 bytes，SHA-256 `7f4b45f7368204b4ed0ebad3574f31021adbb316638a699ae066e60bd95678b2`；诊断 JSON/Markdown 与分析报告均已更新。
- 结构回归通过：3,140 个源节点缺失 0，全部源动作都有 v5 `ln` 落点，3 个云端 class 根版本标记完整。

## frp-pad 条件块 `cthg4tka3j500003t8gg`（2026-07-22）

- 待确认：v4 原公式、所在节点/事件上下文、当前 v5 条件 AST，以及 `cbx1ewka3j50000c35vg` 的节点类型。
- 预期 AST receiver 为 `{op:'ref', val:['sobj','base']}`，方法 `_appEnv` 带 `{op:'val',val:'appType'}` 参数；当前结果错误地把某普通变量节点作为 receiver 且丢失参数。
- v4 源条件位于 `stage.children[6].children[2]` 的事件树，公式为 `$refs.cbx1ewka3j50000c35vg.f__appEnv('appType') == "PC"`。
- `cbx1ewka3j50000c35vg` 是 stage 根下的 `ih5-system` 节点（名称“应用系统”），不是普通数据变量；v4 `str` token 也把它标为对象“应用系统”，属性链为“获取应用环境|环境 / 环境类型”。
- 当前 v5 switch 条件左值确实错误生成为 `ref ['var', systemNodeId] → method '_appEnv'`，且 method 没有 args；右值 `PC` 正确。
- 因此根因需同时解释两点：`ih5-system` 应映射到 `$sobj_base`，且旧方法 `f__appEnv('appType')` 的实参不能在成员链转换中丢失。
- `utils/formula.js::getCtx()` 不为一般 `$refs.<nodeId>` 返回节点类型；`V4FormulaCodeConverter.genRefsAST()` 的默认分支因此无条件生成 `ref ['var', nodeId]`。这直接解释了 `ih5-system` receiver 被当作普通 var。
- 转换器已有 `genConstSysPropertyAST()`，能生成正确的 `ref ['sobj','base']`，但它只处理 `$constSys`，没有覆盖旧案例里的实体 `ih5-system` 节点引用。
- `genRefsCompPropertyAST()` 与 `processMemberExpression(identity='callee')` 按设计会给 method 追加调用参数；当前产物却没有 `appType`，需用最小公式重放判断是旧产物、当前代码路径还是 method AST 引用未返回导致。
- 最小重放确认当前代码对 `$constSys.f__appEnv('appType')` 也会生成无 args 的 method，参数丢失不是旧产物。
- 参数根因：`processMemberExpression()` 在 `constSys`、`curObj` 和 `$refsComp` 分支生成/追加了 method AST，却没有把该 method AST 赋给局部 `propertyAST`；函数末尾 `appendFuncArgs({sysUtilFuncAST: propertyAST})` 因而收到 undefined。
- 对 `$refsComp` 分支，`genRefsCompPropertyAST()` 已返回刚追加的 field/method AST，只需保存返回值；对 constSys/curObj 可从已生成 get 链的末项取得，或拆出 base AST 后显式保存返回值。
- 最小修复设计：`utils/formula.getCtx()` 将与 `$sobj_base` 同类型的真实 system 节点标为 `constSys`；`genRefsAST()` 遇到该上下文时生成 sobj/base receiver。
- 同时重构 constSys/curObj 为“先生成 base comp AST，再显式保存 `genRefsCompPropertyAST()` 返回值”，并让 `$refsComp` 分支保存该返回值，确保统一的 `appendFuncArgs()` 能写入实参。
- 回归测试将用活动 env + `genConObj()` 直接转换目标形态的条件，精确断言 switch 条件左值为 sobj/base `_appEnv` 且 args 保留 `appType`。
- 首次测试失败不是实现路径问题：`isRefsCompMemberExpression()` 明确要求 `$refs` 组件 ID 长度为 20，测试临时 ID `system1` 不符合真实数据约束，导致错误走 sysutil fallback；真实 ID `cbx1ewka3j50000c35vg` 满足判型。
- 使用真实 20 位 ID 后，`genConObj()` 输出精确匹配预期：左值为 `var(get(ref sobj/base, method _appEnv(args:[val appType])))`，右值为 `val PC`；定向和全量测试均通过。
- 初版真实重转曾得到 receiver `['sobj','base']`；该 receiver 改写已按用户确认撤销，最终结果见下方“用户确认后的范围修正”。
- 新 `app.v5.json` 为 29,773,319 bytes、0 个换行的紧凑 JSON；53 个云端 class 根的 `modEdtVer=2` 全部保留。
- 最终回归为 38/38 tests passed，差异空白检查通过；Phase 10 已完成。
- 运行包 `archive.runtime-tov5.zip` 已重新生成并通过 `unzip -t`，可用于后续部署；本轮未执行部署。

### 用户确认后的范围修正

- `ih5-system` 保持原有普通组件引用 `ref ['var', nodeId]`，不转换为 `sobj/base`。
- 本问题的有效根因仅为 `$refsComp` 分支没有保存 `genRefsCompPropertyAST()` 返回的 method AST，导致 `appendFuncArgs()` 无法把 `appType` 写入 method。
- 最小代码差异应只保留 `$refsComp` 分支的 `propertyAST = ...` 赋值；system 类型识别、constSys 重构和 `genRefsAST()` 特判均撤销。
- 最终真实结果为 `ref ['var','cbx1ewka3j50000c35vg'] → method '_appEnv'(args:[val 'appType'])`，比较右值为 `val 'PC'`；逐字段断言通过。
- 定向测试 12/12、全量测试 38/38 通过；最终产物 29,772,875 bytes、0 个换行。

## frp-pad 三元表达式嵌套回调（2026-07-23）

- 已确认 6 个“量体部门”绑定都使用 `条件 ? "" : items.map(item => {...}).join("、")`，转换后块级回调被折叠为返回空值。
- 根因是 `walkCustomExprParsed()` 的 `ConditionalExpression` 分支直接执行 `processParsedTree()`，绕过 full-js 模式下 `walkOrReplaceCustomExpr()` 对含函数子树的保护。
- 最小修复应让三元表达式的 test/consequent/alternate 三个子节点统一进入 `walkOrReplaceCustomExpr()`；该函数在普通模式继续沿用原有替换行为，在 full-js 模式则保留回调结构并只参数化外部 v4 引用。
- 修复后 6 个目标绑定都生成 `!$v1 ? "" : $v2.map(item => {...}).join("、")`，回调内的 if/else、局部变量、嵌套 map/find 与 return 均保留。
- 每个目标 jsfn 有 7 个与 `$v1` 至 `$v7` 对应的 AST 参数，6/6 均通过 JavaScript 编译；不再出现 `lambda return {op:'val'}` 的空回调。
- 全案例审计结果为 2,589 个 jsfn 全部可编译且 arity 一致，说明本次修复没有引入其他 full-js 语法回归。

## jsfn 在 5.x 编辑器中的部分显示（2026-07-23）

- 截图中公式块已正确识别三元条件、两个 `measureUserDepartment` 引用和 `.map(item => {` 开头，说明 jsfn 至少被读入并解析到了回调起始位置。
- 当前 jsfn 在 JSON 文本中使用合法的 `\\n` 转义；`JSON.parse()` 后这些转义会还原为实际换行。需要确认 5.x 公式可视化是否只支持单行 jsfn，或其解析器是否把换行当作结束边界。
- 目标 jsfn 解析后长 270 字符，包含 7 个 LF、共 8 行；第一行恰好是 `!$v1 ? "" : $v2.map(item => {`，与截图停止显示的位置完全一致。
- JSON 文件本身没有格式化换行，jsfn 内部换行在磁盘上是合法的 `\\n` 转义；问题若由换行触发，发生在 JSON 解析后的编辑器公式处理层，不是 `app.v5.json` 压缩格式失效。
- VxEditor41 的 `customExprPropcessor.toToken()` 会把 jsfn 代码交给 `stringToBlocks()`；后者创建 CodeMirror 后只调用 `getLineTokens(0)`，明确丢弃第 2 行及以后内容。这与截图完全吻合，已可确认换行是直接原因。
- 运行代码生成器 `ast2js.js` 直接对完整 `val[0]` 创建函数，不会按行截断；因此未经过公式编辑器回写时，运行时仍可执行完整多行 jsfn。
- 公式块的反向转换 `customExprPropcessor.toAST()` 会从展示 token 重新拼接 `val[0]`。一旦该字段经编辑器重新写回，后续行存在被永久截掉的风险，不能只当作视觉问题。
- Astring 支持 `{ indent: '', lineEnd: ' ' }`，可把同一 ESTree 安全生成无换行单行代码；最小样本生成后可编译并保持返回值，适合作为转换器兼容修复方向。

### 单行输出修复决策

- 用户已确认实施转换器修复。
- 采用 Astring 原生选项 `{ indent: '', lineEnd: ' ' }`，由 AST 生成器负责语法间隔；不对生成结果做 `replace(/\\n/g, ...)`，避免破坏字符串、模板文本或其他合法内容。
- 回归测试除执行结果外必须断言 full-js 生成的 `val[0]` 不含 `\\r`/`\\n`。
- 已实施：`processFullJsExpression()` 使用 `generate(parsed, { indent: '', lineEnd: ' ' })`；Astring 负责保留语法所需空格。
- 定向与全量测试分别 8/8、39/39 通过；块箭头、IIFE、赋值、对象返回和嵌套三元均保持可执行。
- frp-pad 实测 2,589/2,589 个 jsfn 都是单行且可编译，说明不仅目标 6 处，整个案例都满足 VxEditor41 的第 0 行 tokenizer 限制。

## frp-pad 表头 v4 源表达式修正（2026-07-23）

- 用户确认表头缺失的运行时根因：`authData` 为空时，v4 的 `authData.find().read` 抛错后会忽略可见条件；v5 转换语义相当于 `authData.find()?.read === 1`，结果为 false，导致单元格隐藏。
- 用户已直接修正 v4 源表达式。本轮不修改转换函数，目标是重新下载最新 v4 JSON并转换，确认新表达式已进入产物。
- `raw/中文服完整案例JSON导出.md` 指定完整链路为：只读数据库查询 nid `11064050` 的当前 `work_id` → `GET https://editor.ivx.cn/work/load/{workId}?nid=11064050` → 按 VxEditor41 的 PBKDF2/AES-GCM/Deflate Raw 逻辑解码。
- 下载必须使用平台 cookie 文件且不得输出 cookie；响应必须是 `application/octet-stream`，解码结果顶层必须严格包含 `case/server/stage`。
- 文档示例中的 work_id 是历史值，用户刚修改 v4 后必须重新查询当前记录，不能复用旧 work_id。
- 当前只读数据库元数据：nid `11064050`、ntype `1`、编辑器 `4.1`、work_id `cbt1eskpeu4lef3h2330-2920`、link `wt5RnwSK`、version `745`。本地 README 记录的是 `-2919`，说明源文件确已更新。
- 本机没有 mysql CLI 和预装 pymysql；已将 `pymysql` 临时安装到 `/tmp/tov5parser-pymysql`，通过现有只读隧道完成查询，没有修改项目依赖。
- `/work/load/cbt1eskpeu4lef3h2330-2920?nid=11064050` 下载成功：HTTP 200、`application/octet-stream`、3,314,404 bytes、2 个压缩分段；解码后临时 JSON 为 41,697,293 bytes，顶层和三种根节点类型均正确。
- 新旧 v4 都是紧凑 JSON、节点对象数同为 31,106；新源 SHA-256 为 `e64600e781f7635154deeaed22c7240b9f7dbb8af1c28a88d0bceb4099c0caf6`，与旧源不同。包含 `authData` 的字符串从 12 增至 13，需继续精确定位新增表达式。
- 修正精确落在 class 13 的表头“单元”节点 `ch4bzxqa3j50000ykwxg` 的 `binds.visible`：旧式为 `show==1 && authData.find(...).read==1`，新式为 `show==1 && (authData.length===0 || authData.find(...).read==1)`。
- 新表达式的 `_code`、`code` 与 `str` token 三者一致；新增的第 2 个 authData token 正是 `length===0` 前置条件，确认下载内容包含用户刚完成的源修复。
- 新 v5 表头 `visible` 生成单行 jsfn：`$v1 == 1 && ($v2 === 0 || $v3 == 1)`；其中 `$v2` 是 authData.length，`$v3` 是 find(...).read，空数组时由 `$v2 === 0` 明确返回可见。
- 转换后完整案例仍有 2,589 个 jsfn，换行 0、编译错误 0、参数数目不匹配 0；6 个“量体部门”正文绑定继续完整，53/53 个云端 class 根仍带 `modEdtVer=2`。
- 新 v5 产物 29,870,462 bytes、0 个文件换行、SHA-256 `8a2c8e981b8a52239112ac407774d54e98102914fa36740c2ce6b861729a2b14`；诊断 dropped 仍为 0。
- 表头可见 jsfn 的行为验证：`show=1,length=0,read=undefined → true`；`show=1,length=1,read=1 → true`；`show=1,length=1,read=0 → false`；`show=0,length=0 → false`。新源修复在 v5 中语义正确。

## 款式信息文件请求卡住（2026-07-23）

- 现象：点击“款式信息”列的文件图标后，v4 正常发起请求服务并显示弹窗；v5 进入持续加载状态，Network 中没有对应请求。
- 节点与入口：图片节点 `cm1wxsqa3j500009jj8g`（`ih5-image`，名称“款式信息”），tap 事件根 `cm21x4ma3j5000036wrg`。
- 外层链路完整：动作 `cv89gr3a3j500009qve0` 设置当前订单变量 `cctfkr7a3j50000qvsc0`，条件 `cv89k44a3j500009qw80` 通过后，动作 `cv89k44a3j500009qw8g` 调用模块实例 `cv891cna3j500009qnw0` 的公开动作组 `cv7jynaa3j50000bt49g`“获取款式信息”。v5 保留了这条链和参数。
- 运行时证据：v4 点击后输出“获取款式信息→显示提示语→加载中→当前订单→款式信息→款式信息处理…”，并依次请求服务 `cv7kgfsa3j50000gyk40`、`cv7nrb1a3j5000042f50`、`cv7kgfsa3j50000gykdg`；v5 只输出“获取款式信息→显示提示语→加载中”，本次点击没有产生任何新请求。
- “获取款式信息”内的首个动作 `cv7jynaa3j50000bt4b0` 调用“显示提示语”。v4 生成的调用显式传入 `undefined` callback，因此显示 loading 后立即继续设置当前订单；v5 将同一动作生成 `op: let`，等待 `fireFuncGroup` 的返回值。
- “显示提示语”动作组 `cv7jynaa3j50000btce0` 没有 outParams；加载分支只执行 showLoading，没有 funcResult。故 v5 的 `let` 永远无法完成，后续设置当前订单、整理款式列表和请求服务都不会执行。
- 根因：v4 动作实例的 `action.callback: true` 表示该动作“支持回调”，并不表示当前实例“挂载了回调”。实际回调由 `children` 中的 status block 表示。`v4ToV5/converter.js` 当前仅检查 `action.callback` 就生成 `let`，把原本 fire-and-forget 的调用错误转换成了等待调用。
- 建议修复：使用 `action.callback && block.children?.some(child => child?.type === 'status')`（或等价判断）决定是否生成 `let`；没有 status child 时保留直接 `get` 调用。回归测试需同时覆盖“支持回调但未挂 status”“实际挂载 status”两类动作，并重转 frp-pad 验证三个请求与弹窗恢复。
- 影响面：本案例共有 4,190 个 `action.callback=true` 动作，其中 2,752 个没有 status child，包含 2,327 个 fireFuncGroup 调用。它们是潜在同类风险点；是否可见卡死还取决于被调用动作是否会产生返回。
- 先前怀疑的 `$valid_Null` 不是本问题根因；其 v5 local-ref 表达符合编辑器现有表示。

## 无限动画 play 的真实阻塞点（2026-07-23）

- 用户复核确认真实阻塞动作是 `cv7jynaa3j50000btc9g`，而不是前序“显示提示语”动作。
- 该动作调用 `data-animate` 节点 `cv7jynaa3j50000btc40`（“顺时针旋转”）的 `play` 方法；节点属性为 `props.infinite=true`。
- V4 运行时使用回调模型，不会因此阻断外层动作链；V5 动作转为 `op: let` 后采用 async/await 等待 play 完成，而 infinite 动画不会结束，因此后续动作永久等待。
- 这是案例开发层面的不兼容用法：动画已配置自动无限循环时，不应再通过动作调用 play。迁移策略为识别 `data-animate.play` 且目标节点 `props.infinite===true`，保留动作 AST 但自动设置 `skip=true`。
- 实现后有限动画的 `play` 仍保持正常 `op: let` 且不设置 skip；无限动画的 `play` 保留 AST 供编辑器查看，但以 `skip:true` 阻止运行时等待。
- frp-pad 实际转换确认 `cv7jynaa3j50000btc9g` 结果为 `{"op":"let", ... ,"skip":true}`，其方法引用仍准确指向 `cv7jynaa3j50000btc40.play`。
- frp-pad 全量共有 22 个 `data-animate.play`，其中 11 个指向 `props.infinite=true` 的动画（10 个启用、1 个原本已禁用）；本次规则会统一覆盖这 11 个动作，另外 11 个非 infinite 动画动作保持原语义。
- 最新生成的 `app.v5.json` 为紧凑单行 JSON，11/11 个 infinite animate play 均已标记 `skip:true`，没有缺失或漏标。

## “加载成功”提示不关闭（2026-07-23）

- `FRP_PAD_量体款式` 的自定义 toast 动作组为 `cv7jynaa3j50000btc6g`（“显示toast”）。它先把显示变量 `cv7jynaa3j50000btc60` 设为 true；成功类型 1 应在动作 `cv7jynaa3j50000btcag` 延时 1.5 秒后将其设为 false。
- 该动作组中 loading 类型 3 才会进入 infinite animate play `cv7jynaa3j50000btc9g`；成功类型 1 不经过该分支，因此成功提示不关闭还需要单独检查延时块 `cv7jynaa3j50000btcag` 的 V5 AST。
- 上层通用动作组 `cv7jynaa3j50000btce0`（“显示提示语”）在“系统弹窗”路径调用系统 `hideLoading + showToast`，在另一条路径调用自定义动作组 `cv7jynaa3j50000btc6g`。需先定位“加载成功”实际走的是哪条路径。
- 款式信息链路中的多个“加载成功”调用（如首单款式信息 `cv7pndda3j5000042vwg`）传入类型 1，`系统弹窗` 留空，因此实际进入自定义 toast 动作组。
- V5 的成功分支条件已转换为 `belongTo(param, [1])`；命中后先执行一个 `delaysMethod(1.5)` 的 `op:let`，再执行 `cv7jynaa3j50000btcag` 将显示变量设为 false。动作树没有丢失，当前最可疑点转为延时 `let` 是否能完成，或成功类型在运行时是否未命中 `[1]`。
- `genActionDelay` 与 VxEditor41/VxEditor5 上游实现一致：生成 `sobj/base.delaysMethod({time:1.5})` 的 `op:let`。组件映射将该方法声明为 callback/noResult；widgets 实现会在 `time * 1000` 后调用 `cb('finished', {})`，理论上能够完成等待。
- 因此不能简单归因于“延时节点丢失”或 `delaysMethod` 本身没有回调；下一步需检查 V5 AST 到运行码时，对 callback/noResult 方法的 Promise 包装是否返回可等待值。
- VxEditor5 `ast2js` 对 `op:let` 的参数以 flag=1 下钻；普通组件方法会由 `$sys.afunc(...)` 调用，但 `sobj` 分支当前除 `genToken` 外固定生成 `$sys.func(...)`。因此 `sobj/base.delaysMethod` 不会走通用的异步组件调用路径。
- 这使延时动作的执行语义依赖 `$sys.func` 对 callback 方法的特殊处理；需要进一步确认生成代码/运行时是否会真正等待回调。该差异是当前最强的转换/编译层嫌疑。
- `belongTo` 运行时实现是 `Array.indexOf(v1) >= 0`，V5 条件参数顺序 `[param, [1]]` 正确；调用者传入的类型值在 AST 中也是数值 1。成功分支条件转换不是根因。
- 被关闭的显示状态 `cv7jynaa3j50000btc60` 是普通 `data-bool`，初值 false；成功提示先 `setTrue`、延时后 `setFalse`，变量类型和目标引用均正确。
- 用 VxEditor5 `ast2js` 将目标事件生成代码后，成功分支确实包含 `delaysMethod({time:1.5})`，下一行就是 `cv7jynaa3j50000btc60.setFalse()`；目标关闭动作没有被 skip，也没有被转换器遗漏。
- 但 `ast2js` 主要用于服务/模块代码生成，前台运行页可能直接解释 AST，不能仅凭其把 `sobj/base` 生成为 `server-sys-serverSys` 就断定前台根因。
- 本地 VLPreviewer 的 player/previewParser bundle 已压缩且不保留 `afunc`、`delaysMethod`、`op_belongTo` 标识，无法通过静态字符串检索确认前台 AST 解释器路径。
- 自定义 toast 容器 `cv7jynaa3j50000btbz0` 的 visible 绑定在 V5 中正确引用 `cv7jynaa3j50000btc60.value`；不是显示属性绑定到了错误变量。
- 成功调用参数已确认是数值 `1`，`belongTo(1, [1])` 能命中；成功分支中的关闭动作 `cv7jynaa3j50000btcag` 也存在、未 skip，故首个可能中断点唯一收敛到它前面的自动延时 AST。
- 当前成品中的延时行 ID 为 `d9gwmdh60k47gd9fn92g`（转换时随机生成，不是稳定 BID），来源是 V4 关闭动作的 `delay: 1.5`；其结构为 `op:"let"` 等待 `sobj/base.delaysMethod({time:1.5})`，下一行才是 `cv7jynaa3j50000btc60.setFalse()`。
- V5 widgets 的 `delaysMethod` 仍是回调式实现：`setTimeout(... cb('finished', {}), time * 1000)`；map 也把它声明成 `callback/noResult`。转换器却把这类延时输出成 V5 async/await 链中的 `op:"let"`，运行时若没有正确把该 system callback 桥接成可完成的 Promise，动作链就停在延时处。
- 运行现象与该执行点完全一致：提示先成功显示，1.5 秒后没有执行 `setFalse`；而成功类型不会进入已经 skip 的 infinite animation 分支。因此本问题与 `cv7jynaa3j50000btc9g` 无关，是 V4 回调式延时迁移到 V5 await 语义后的独立兼容问题。
- 修复方向应放在 `genActionDelay()`：让转换后的延时使用 V5 能正常 resolve 的原生异步等待表示，或为 `sobj/base.delaysMethod` 补齐可靠的 Promise 桥接；不应删除 `cv7jynaa3j50000btcag`，也不应调整成功条件。

### 用户运行时复核后的根因修正

- 用户已在运行时确认：前置 `delaysMethod(1.5)` 正常完成，`cv7jynaa3j50000btcag` 也确实执行，变量值成功变为 false；此前“延时阻塞导致 setFalse 未执行”的判断撤销。
- 实际故障是延时后的变量组件方法虽然改变了数据，绑定该变量的组件 UI 没有重新渲染，属于 V4 回调架构迁移到 V5 运行时后的刷新时机兼容问题。
- 指定迁移规则：当 V4 变量组件的方法调用本身带延时，V5 保留原延时和变量方法后，再追加一个新的 `op:"let"` system `delaysMethod` 动作；方法参数只保留 `{op:"val", key:"time"}`，不设置 `val`，以零时长让出一次执行时机。
- 新动作的 `ln` 必须由 `genXid()` 生成，`val[0]` 为 `${ln}Rtn`、`val[1]` 为 `JsonVal`；规则不能扩展到无延时变量方法或非变量组件方法。
- 当前转换器统一在 `converter.js` 的动作结果数组上处理 `block.delay`：先生成原动作 AST，再通过 `result.unshift(genActionDelay(block.delay))` 把原延时放到动作前。新刷新让步动作应插入到同一结果数组末尾，才能保证顺序为“原延时 → 变量方法 → 零时长让步”。
- 现有回归测试集中在 `v4ToV5/v4ToV5.test.js`；无限动画规则已有完整动作夹具，可复用其运行时 map/env 初始化方式增加延时变量方法测试。
- 运行时 map 中的基础变量组件至少包括 `data-var`（字符串变量）、`data-num`（数值变量）、`data-bool`（布尔变量）、`data-arr`（一维数组）和 `data-arr-2d`（二维数组）；新判定应使用明确白名单，避免用宽泛 `data-*` 前缀误命中服务、动画、数据库等数据组件。
- frp-pad 源案例中目标动作 `cv7jynaa3j50000btcag` 确认为 `data-bool` 节点 `cv7jynaa3j50000btc60` 的 `setFalse`，V4 `delay=1.5`。全案例共有 222 个带延时动作，其中变量候选还出现 `data-obj-arr`、`data-obj-1d`、`data-obj-json`，说明变量白名单需要覆盖对象/JSON 变量而不只四种基础标量。
- runtime map 的组件语义确认变量白名单应为 8 类：`data-var`、`data-num`、`data-bool`、`data-arr`、`data-arr-2d`、`data-obj-arr`、`data-obj-1d`、`data-obj-json`。`data-event` 是自定义事件、`data-funcGroup` 是动作组，均不得命中。
- 为精确得到用户给出的无 `val` 参数 AST，`genActionDelay()` 可在 `time === undefined` 时只生成 `{key:'time', op:'val'}`；原有带数值延时仍显式生成 `val: block.delay`。刷新让步动作应直接插在变量方法 `_block` 后、回调 switch 块前。
- 实现采用模块级 `VARIABLE_COMPONENT_TYPES` 明确白名单，并只对 `block.enable !== false && !!block.delay` 的变量方法追加让步动作；无延时变量方法、普通 UI 组件和禁用动作不会新增可执行刷新让步。
- 定向回归 14/14 通过；精确验证输出顺序为 `[原延时, delayed-bool-method, 无值延时, 非变量原延时, delayed-text-method, 无延时变量方法]`，新增动作的返回局部变量与随机 ln 一致。
- 项目全量测试 41/41 通过，`git diff --check` 通过。
- `convert-local-cases.mjs` 会把所有 V5 产物写成无缩进紧凑 JSON，但其常规目标布局面向 `localCases/v4` 根下文件；frp-pad 位于子目录，需要直接调用同一转换库生成到既有 `localCases/v5/frp-pad/app.v5.json`，避免误写根目录。
- frp-pad 已重新生成：29,884,854 bytes、文件换行 0。新产物共有 64 个无 `time.val` 的刷新让步动作，与源案例中 64 个启用的带延时变量方法数量一致。
- 目标 `cv7jynaa3j50000btcag` 的相邻顺序已精确核验：前一行为原 `delaysMethod(time=1.5)`，当前行为 `setFalse` 的 `op:"get"`，后一行为随机 ln `d9gxppt60k4c091ewwy0` 的 `op:"let"`；其 `time` 参数只有 `key:"time", op:"val"`，没有 `val` 字段。

## 同步今日转换修复到 VxEditor41（2026-07-23）

- tov5parser 今日共有 3 个功能提交：`2004c01`（三元嵌套回调 + full-js 单行 jsfn）、`35e58a7`（跳过 infinite data-animate play）、`e19833e`（延时变量方法后补 UI 刷新让步）。
- VxEditor41 转换目录当前工作区干净；仓库其他位置存在用户的 `.gitignore`、`src/stores/event.js` 修改和多批未跟踪组件目录，必须保持不动。
- VxEditor41 最近的 `3572003d4`、`76aef28a1` 已同步更早的文本、方法参数及真实案例公式修复，但特征检索未发现今天 3 个提交的关键实现；当前只命中原有 `genActionDelay(time)`。
- 精确源码核对确认 VxEditor41 缺少全部 3 项：full-js 仍为 `generate(parsed)` 且 `ConditionalExpression` 仍直接 `processParsedTree()`；动作转换仍只按 `block.enable` 设置 skip；延时结果仍是 `[_block, ...cbList]`，且 `genActionDelay` 总是写入 `val: time`。
- VxEditor41 与 tov5parser 的对应文件为：`formulaCode/V4FormulaCodeConverter.js`、转换入口 `index.js`（对应 `converter.js`）和 `utils/action.js`。今天的生产代码改动可按这 3 个文件逐块移植，不需要复制 Node 专用 env 或 tov5parser 测试框架。
- VxEditor41 没有转换器单测目录或 test script，不能直接复制 `node:test` 文件；但依赖中已有相同版本 `acorn@8.17.0`、`astring@1.9.0`，并且本地 `node_modules`、ESLint/Babel/webpack 配置齐全，可用定向 ESLint、Babel 编译检查和项目 build 做适配验证。
- 三文件移植差异与 tov5parser 功能提交一致，`git diff --check` 通过；首次定向 ESLint 为 0 errors，仅 `utils/action.js` 的单元素数组换行触发 1 条 Prettier warning，需要按 VxEditor41 格式收紧为单行。
- 格式调整后，3 个目标文件定向 ESLint 为 0 errors/0 warnings，Babel `parseSync` 全部通过。
- VxEditor41 正式生产构建成功：webpack compiled with 33 warnings，耗时约 65.6 秒。警告均来自仓库其他既有文件/未跟踪组件（Sass deprecation、旧 Prettier、缺失 export 等），目标 3 个转换文件没有构建告警。

## 外部 V5 JSON 与当前 app.v5.json 的服务差异（2026-07-23）

- 两份文件都是完整 `{case, stage, server}` JSON；外部文件约 26.69 MB，当前转换产物约 29.88 MB。
- 服务 `ceyjn3ca3j50000468k0` 在两份 JSON 中都只定义一次，位置相同：`server.classes[7].children[4]`，类型均为 `data-service`、名称均为 `getStyleList`，输入/输出参数、AST、所属后台模块类均存在。
- 所属后台模块类也一致：`cd4bs1ca3j50000cc7fg`（FRP_选择弹窗_款式），`classId=C_cd4bs1ca3j50000cc7g0`、`widgetId=15185`、`isModServer=true`、`modEdtVer=2`；不是服务定义被转换器丢失或模块标记缺失。
- 调用 AST 在两份文件中均为 `op:'runsvc', val:'ceyjn3ca3j50000468k0'`，4 个参数结构一致；外部位于 `stage.classes[14]`，当前位于 `stage.classes[15]`，只是类数组顺序发生变化，调用所属节点 ID 仍是同一个 `ceyjmesa3j50000467fg`。
- 首个关键差异：外部 JSON 的服务事件 `ceyjn3ca3j50000468kg` 同时含 `ast` 和 998 字符的 `_code`；当前 app.v5.json 只有 `ast`，没有 `_code`。
- 第二个关键差异：外部 JSON 的 server 根 `props.v2=1`，当前 app.v5.json 的 server 根没有 `v2`。需要继续从 V5 编译/运行时代码确认服务注册依赖的是 `_code`、`v2`，还是二者组合。
- 本地 V5 后台产物构建代码 `vlparser/vl-local-artifact.mjs::collectServicesAndVars()` 明确只在 `node.events.list[0]._code` 是字符串时，才把 `data-service` 写入 services 注册表；仅有 AST 的服务不会注册。该文件还会在 compiled code/service 数量为 0 时直接报 `compiled data-service _code is empty`。
- V5 编辑器的 `eventView/genCode/genCode.js` 会把事件编译结果 `_code` 写回函数/动作组等节点；正常外部 JSON 已经过这一步，而直接转换产物只完成 V4 event tree → V5 AST，没有完成 server AST → 可执行 `_code` 编译。
- 因此 `_code` 缺失已经足以解释“节点存在但运行时服务不存在”；`server.props.v2=1` 仍需确认是编译模式标识还是独立注册条件，但不是唯一必要差异。
- VxEditor5 `tree.dealServer()` 在新版通用事件模式保存案例时统一写入 `server.props.v2=1`；这是“已由 V5 编辑器保存/编译”的版本标志。NodeCreator 创建的新后台根也默认带 `v2:1`。
- `serviceMissingError` 的另一来源是 VLang 项目解析阶段按服务名查不到 backend service node，但本案例两份 JSON 的 service node 都存在；结合实际差异，当前问题更符合后端服务注册表因缺 `_code` 未收录，而不是前端 AST 未绑定 service ID。
- 全量统计进一步确认：两份 JSON 都有 80 个 `data-service` 且 80/80 都有 AST；外部正常文件已有 20 个服务带事件 `_code`，当前 app.v5.json 为 0/80。目标 `getStyleList` 正属于外部已编译的 20 个之一。
- 外部仍有 60 个未编译 service，说明编辑器不会无条件编译所有云端模块，只会编译当前案例实际纳入后台的模块/服务；但目标模块被纳入并生成 `_code`，当前转换产物对任何服务都没有执行编译阶段。
- 当前 app.v5.json 保留了 799 个 V4 动作组的旧 `props._code`，外部编辑器保存后只保留/重建其中 354 个；这也证明外部文件不是单纯字段补丁，而是经过 V5 保存时的代码生成和清理流程。
- 目标前后台模块类的 `classId/widgetId/modEdtVer/isModServer/serverMap/provides/dbMap` 均一致；目标服务 AST 除转换时生成的匿名 block ln 不同外，结构一致。模块关联和服务业务 AST 可排除。
- `v2` 在本地字段说明中定义为“服务端版本/模式标记”，V5 编辑器保存通用事件案例时写入；它本身不是服务 ID 映射。结合 `_code` 统计，实际失效链条是：直接转换文件没有 V5 server 编译标记/产物 → 发布路径未把目标 AST 编译进 services 表 → `runsvc` 按 ID 查询时显示服务不存在。
- 两份 JSON 的结构规模完全一致：均为 11,607 个节点、11,581 个唯一 ID、stage 13 个直属节点/35 个 class、server 82 个直属节点/20 个 class；节点 ID 集合无任何增删。stage class 仅数组顺序不同，server class 集合和顺序都一致。
- 按实际服务注册规则模拟：外部 JSON 可注册 20 个服务，目标 ID 存在且代码长 998；当前 app.v5.json 可注册 0 个服务，目标 ID 不存在。这是“服务不存在”的直接、可重复证据。
- `VLangModProcessor.preProcessImportedCaseJson()` 在正常导入流程中会调用 `processModServerInsClassAst()`，后者遍历 server classes 并用 `ast2js` 把 event AST 写成 `_code`。外部 JSON 显然经过该流程；当前转换器只生成 AST，没有执行这一步。
- 若要让转换产物本身可直接作为最终 V5 运行/发布态，转换程序需要在输出前编译 server class AST 为 `_code`，并补 `server.props.v2=1`；仅复制服务节点或改 `runsvc.val` 都无法解决。
- Phase 22 开始时确认 tov5parser 自身尚无 `ast2js` 或等价 V5 后台编译器依赖；不能只设置 `server.props.v2=1`，需要把可部署的最小编译实现纳入转换链。
- VxEditor5 的 `src/utils/ast2js.js` 是 1,344 行的自包含 ESM 文件，没有 import；可作为独立转换项目的运行时代码生成器复用。vlparser 内另有较旧的 1,065 行版本，两者已存在差异，本次应以 VxEditor5 当前实现为准。
- VLangModProcessor 的实际编译范围包括 `server.classes` 与 `server` 根两个入口；每个入口独立建立子树 node map，深度遍历所有带 AST 的事件，并把生成结果写入事件 `_code`。`data-funcGroup` 还会同步写 `node.props._code`。
- 当前 `v4ToV5/index.js` 在 `converter.exec()` 后立即返回，尚无输出后处理阶段；后台编译适合放在这里，且必须在 active env/组件映射仍有效时完成。
- 用当前 frp-pad 目标服务 AST 实测 VxEditor5 `ast2js` 可成功生成 732 字符代码，主体调用与外部正常 JSON 一致；说明 AST 本身可编译。
- 生成代码与外部 `_code` 尚有两点差异：外部前置了服务入参类型检查（约 266 字符）；当前 VxEditor5/旧 vlparser `ast2js` 对 server-api 调用末尾多一个 `undefined` 参数。前者来自 VxEditor5 `stores/funcs/generalAst.js` 的事件代码包装，不属于纯 `ast2js`。
- 因此最终修复不能只机械调用 `ast2js`；还需要复用服务事件保存时的入参检查包装规则。多出的可选参数是当前编译器版本差异，不影响“服务是否注册”，但应以当前 V5 编译器输出为准。
- V5 编辑器保存后台事件时会先深拷贝 AST、清理 fake callback，再调用 `ast2js`；随后按 `node.props.inParams` 添加 strict 类型检查（默认）或按后台根 `paramLooseMode` 做入参类型转换。`data-funcGroup` 使用 `fParam<id>`，普通 service 使用 `param`。
- 外部正常 JSON 的 20 个 `_code` 全部位于当前实际使用的两个 server class（“FRP_选择弹窗_款式”3 个、“FRP_PAD_量体款式”11 个等合计 20）；其余 60 个 class service 仍只有 AST。这说明“只要运行时会用到的 class 已编译即可”，但转换器无法可靠预测所有动态模块使用路径，因此完整编译全部 `server.classes` 更稳妥，也与 `VLangModProcessor.processModServerInsClassAst()` 的正式行为一致。
- vl-local-artifact 的 service 收集函数只遍历传入 server 的 children，不自动遍历 `server.classes`；其上游先把实际后台模块组合进 backend server。编辑器运行当前案例则直接依赖 class 中的 `_code`，目标服务恰处在已实例化 class。
- 新编译器对合成 class service 已生成 V5 strict 入参检查与主体代码，并写入字符串 `_code`；项目既有转换测试在接入后保持通过。
- 本地批量转换脚本已固定使用 `JSON.stringify(v5CaseJson)`，因此重新生成的 `app.v5.json` 会继续保持单行压缩格式。
- 真实 frp-pad 全量转换成功：server 范围共有 80 个带 AST 的事件、80 个 data-service；修复后 80/80 均生成字符串 `_code`，且 80 份代码全部通过 `new Function` 语法校验。
- 目标服务 `ceyjn3ca3j50000468k0` 的 `_code` 长 1,008 字符，包含与正常外部 JSON 相同的 `_checkInParamsTypeError` 前缀和服务主体；相对外部 998 字符仅是当前 V5 ast2js 的可选参数位差异。
- 新产物 `server.props.v2=1`、JSON 换行数为 0，大小 29,972,400 bytes。
- V5 保存后处理除入参检查外还对 `callTimerService` 和 `callTransaction` 做专用包装。当前实现已覆盖 timer；transaction 需要从 AST 中收集实际数据库组件 ID 后生成 `txBegin/txCommit` 包装，不能简单省略，否则未来转换含事务组件的案例会得到已注册但语义不完整的 `_code`。
- transaction 的正式 DB ID 计算依赖案例 nid/uid/gid/eid、数据库 scope 和编辑器 widget 元数据；独立转换接口目前只接收 case JSON/ntype，不保证具备完整工作区身份上下文。盲目复刻会产生错误前缀。
- 因此本轮不扩展 transaction 编译语义；应保持与 VLangModProcessor 的通用 AST 编译一致，仅添加目标服务所必需且可由节点自身完整确定的入参包装。timer 包装同样只依赖事件名，可安全保留。
- tov5parser Phase 22 已提交并推送：`8859dea fix: compile v5 server service code`，本地 `main` 与 `origin/main` 一致。
- VxEditor41 当前分支为 `master`；已有用户修改为 `.gitignore`、`src/stores/event.js` 及多组未跟踪组件目录，本轮必须仅触碰 `src/utils/convertV4ToV5/`。
- VxEditor41 已有 `src/utils/ast2js.js`（1,008 行），其内部直接从 `generalAst` 获取 Java 组件映射；同步时无需复制 tov5parser 的 vendor 编译器，只需添加后处理模块并复用编辑器现有 `ast2js`。
- VxEditor41 的 `generalAst.saveNodeDealAstEvents()` 已包含 timer、transaction、strict/loose 入参包装，但这些内部函数未导出；转换后的案例正常进入编辑器保存流程时会再次生成并覆盖 `_code`。
- 同步模块将复用 `src/utils/ast2js.js`，在转换返回前生成可立即注册的 `_code`；覆盖 fake callback、timer、strict/loose 入参和 funcGroup props。transaction 的最终 DB ID 包装仍由编辑器原生保存流程在获得完整工作区上下文后处理。
- VxEditor41 最终同步仅新增 `src/utils/convertV4ToV5/serverAstCompiler.js` 并修改同目录 `index.js` 两处（import + 返回前调用）；未修改用户现有文件，也未新增三篇规划文档。
- VxEditor41 两文件定向 ESLint 0 errors/0 warnings，`git diff --check` 通过，production webpack build 成功。
- 最新两份 JSON 的目标 service 节点、props、outParams、server-api 节点和调用者语义均一致；service AST 仅随机 block `ln` 不同，排除返回动作或服务参数结构丢失。
- 两份 `_code` 的唯一实质差异位于 `$sys.afunc(...sendServerApiRequest...)`：外部正常文件在 `undefined,0,undefined,undefined` 后结束，最新转换产物多保留了第 7 个方法参数 `undefined`。
- 目标 AST 本身在两份 JSON 中都含 7 个 method args；外部文件经过编辑器 `saveCaseDealFakeAst()` 后再编译，该流程会根据组件方法的 `errorCb`/参数定义移除多余回调占位。当前新增编译器只删除 `_fakeCbInner` alambda，没有执行完整的后台 fake-callback 归一化，因此把多余 `undefined` 编入 `_code`。
- 运行组件映射确认 `server-api.sendServerApiRequest` 的公开业务参数恰为 6 个：headers、body、reqUrl、timeout、method、reqType；另有 `errorCb: true` 元数据。AST 第 7 项不是业务参数，而是 V4 回调模型遗留的错误回调占位。
- VxEditor41 原生保存逻辑会读取同一方法定义：去掉 ctx/props 后若 AST 参数数大于 6，且末项不是 `_fakeCbInner`，就 `methArgs.pop()`。当前 compiler 缺少的正是这一步。
- 因而正常 `_code` 的 6 参数调用是正确签名，最新 `_code` 的 7 参数调用不是无害格式差异；多余尾参会把后台异步 API 调用留在错误的回调调用形态，`$sys.afunc` 无法按正常 Promise/结果路径得到 `Rtn.result`，随后 paramResult 只能读到空值。
- vl-backend-rs 文档与测试把线上 parser 的规范 saved-JS 明确定义为 6 个 server-api 位置参数，且字节级测试使用的正是外部正常文件形态。其 Rust 适配器只读取前 5 个有效槽位（第 6 个本来就是 `_unused`），因此在 Rust 本地兼容运行时里第 7 个也可能被忽略；不能仅凭 Rust 实现证明线上云端一定因多参失效。
- 但用户当前运行环境表现与两份 JSON 的唯一代码差异吻合；仍需定位实际云端/预览运行时的 `$sys.afunc` 参数处理，或用将当前 `_code` 临时替换为外部代码的 A/B 验证，把“高度可疑”提升为确定根因。
- Chrome 已定位用户当前最新 V5 运行页 `https://giupre.h5app.com/play/hpUBU5Pm`，但开发日志读取即使按目标服务 ID 窄过滤仍超时，未取得新的运行时日志；按两次失败停止该路径。
- 已完成等价 A/B 验证：在内存中对当前目标服务 AST 按 V5 编辑器规则移除末尾旧错误回调占位，再使用同一 `ast2js` 和同一入参检查前缀重新编译，结果与 `case_12225413.json` 中正常 `_code` **逐字一致**，两者均为 998 字符。
- 该验证排除了服务节点、所属 class、server-api 配置、调用端 `runsvc`、入参/出参声明、返回动作和编译器主体版本等其他差异；确定根因就是当前 `serverAstCompiler` 在编译前漏做方法签名驱动的 error-callback 占位清理。
- 全量只读扫描当前后台 AST，发现 76 个同类待清理占位：75 个 `server-api.sendServerApiRequest`、1 个 `data-db.dbBatchUpdate`。修复不应只针对目标 BID，而应移植 `saveCaseDealFakeAst()` 的通用方法参数归一化规则。
- 最小修复方向：编译每个后台事件的深拷贝 AST 前，根据组件映射定位方法定义，剔除 `IvxContext/props/parentProps` 后计算业务参数数；当方法声明 `errorCb`、实际参数超长且末项不是 `_fakeCbInner` 时移除末项，再执行现有 `_fakeCbInner` 清理和 `ast2js` 编译。
- 修复已在 tov5parser 和 VxEditor41 的 `serverAstCompiler` 同步实现：通过 `ref` 的节点 ID 取得组件类型，再从 Java map 查找方法；只有方法声明 `errorCb` 且实参数量超过清理后的业务参数数时才弹出末参。
- 该实现不修改案例中的原始 event AST，只归一化编译前的深拷贝，因此编辑器仍可查看完整迁移 AST；生成 `_code` 使用 V5 规范参数形态。
- 回归覆盖 `server-api.sendServerApiRequest`（6 个业务参数）、`data-db.dbBatchUpdate`（4 个业务参数），并验证 `_fakeCbInner` 末项不会被新归一化提前弹出。
- frp-pad 重转后目标服务 `ceyjn3ca3j50000468k0` 的 `_code` 为 998 字符，与 `/Users/lianghuang/Downloads/case_12225413.json` 中正常代码逐字一致。
- 新产物的 80 个后台 `_code` 全部通过 JavaScript 语法校验；Acorn 统计 75 个 `sendServerApiRequest` 调用均为 10 个 `$sys.afunc` 总参数（4 个框架参数 + 6 个业务参数），1 个 `dbBatchUpdate` 为 8 个总参数（4 + 4），错误数量均为 0。
- 新 `app.v5.json` 为 29,971,640 bytes、0 个换行，SHA-256 `9dc2196a6dfb623c1affc20dad727f9eec76d7a2c04ab29bbee17420cc421e73`。
- VxEditor41 定向 ESLint 0 errors/0 warnings、`git diff --check` 通过、production webpack build 成功；build 的 33 条 warning 均来自仓库其他既有或用户未跟踪文件，目标转换文件没有告警。
