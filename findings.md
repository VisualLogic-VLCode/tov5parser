# Findings & Decisions

## Phase 142：Converter 1.2.3 Release

- 指定会话与当前仓库均确认：Workflow 使用签名 stable 通道安装受管 Converter；Lambda 36 和 VxEditor41 提交不会更新该运行时。当前 stable `latest=1.2.2`，不可变 v1.2.2 固定在修复之前，因此必须发布新版本 1.2.3，不能替换旧资产或重用旧标签。
- 当前 Workflow 0.6.1 声明兼容 Converter `>=1.2.0 <2.0.0`，Knowledge Runtime 声明兼容 `>=1.2.1 <2.0.0`；1.2.3 无需联动发布 Workflow 或 Knowledge。
- 已存在 Job/Review 的 Converter pin 不会被更新；受管更新只改变活动 Converter，供后续新转换或显式刷新流程使用。
- 本轮用户明确确认发布，授权包括必要的版本提交、推送、签名 Release、stable 通道更新和本机受管更新验收；不授权运行案例迁移、Save As 或平台写入。
- Converter 的签名准备/发布器由独立 Workflow 仓库维护：prepare 从指定 Converter packageDir 执行 `npm pack`、继承上一版 raw payload、生成 Ed25519 envelope 与发布计划；publisher 强制源仓干净且 HEAD 与计划一致，并在公开仓库、不可变 Release、无 bypass 的分支/标签保护通过后，按 Draft→资产核验→公开 Release→最后更新 stable 的顺序执行。
- 由于 tov5parser 根目录保留用户未跟踪文档，正式 prepare/publish 应从 1.2.3 提交建立 detached 干净 worktree，确保计划的 `source.dirty=false` 且不移动、删除或暂存用户文件。
- 首轮发布预检通过：tov5parser `main/origin=0/0`，远端 tag 与 GitHub Release `v1.2.3` 均不存在；仓库 PUBLIC、immutable Releases enabled，两套 branch/tag ruleset active，签名私钥存在且 mode 0600。
- 当前 stable 历史为 latest 1.2.2、minimum 1.2.0、versions 1.2.0/1.2.1/1.2.2、revoked 空；Workflow 仓库已有上一版 raw payload，可用于 1.2.3 继承历史。
- Workflow 维护仓当前有用户修改 `test/basic-validator.test.js`，本轮不得暂存或改写；Release 相关脚本和依赖文件无 diff，可只作为发布工具读取执行。
- v1.2.2 基线复验通过：Latest/Release 均 immutable、非 draft、非 prerelease，资产为 tgz + signed manifest，tag 与 targetCommitish 均精确指向 `5572415`。1.2.3 可安全以前一 raw payload 追加版本描述符。
- 1.2.3 完整测试 102/102、0 fail；production npm audit 0 vulnerabilities。npm dry-run 为 164 files、1,787,580 bytes（unpacked 29,338,734），必需入口/Map/README/package 完整；`node_modules` 是 package.json 明确要求的 9 个 bundled runtime dependencies，不是意外开发依赖。
- dry-run 文件清单仅含预期 9 个 runtime bundle，无 AWS 开发依赖、无 localCases/release-out/archive/凭证/secret/用户 VxServer 文档；`npm ci --ignore-scripts --dry-run` 与 `git diff --check` 均通过。版本 diff 精确只有 package/package-lock 的三处 1.2.2→1.2.3。

## Phase 141：提交、Lambda 发布与编辑器同步

- tov5parser 当前 `main` 与 `origin/main` 同步，基线提交为 `ceb8b8a`；发布入口是 `npm run deploy:lambda:prod -- --smoke`，脚本负责测试、打包、发布版本、切换 `prod` 别名和冒烟。
- 本轮提交必须排除用户未跟踪的 `VxServer-saveAs-same-gid-group-db-fix.md`；产品改动是公式转换器和回归测试，三份规划记录用于发布审计。
- 用户明确授权两仓提交推送及 Lambda 更新，因此无需再次请求 Git 提交确认；仍须在提交前刷新远端并验证无远端分叉，禁止变基和历史重写。
- VxEditor41 位于 `/Users/lianghuang/Desktop/ivx_repos/VxEditor41`，当前 `master` 与 `origin/master` 同步，基线 `c5595597d`；目标转换器文件无本地改动。仓库已有 `.gitignore`、`src/stores/event.js` 和多组未跟踪 UI 目录，必须全部保留且排除提交。
- 编辑器侧同样存在忽略 `genObjectPropertyAST` 返回值的默认分支，适合同步同一 `MemberExprReceiver` 保义修复；仓库只有生产 `build` 脚本，没有项目级 test/lint script，验证需使用目标文件解析/ESLint与生产构建。
- Lambda 部署脚本在更新函数后等待状态稳定，再发布不可变版本、清空别名附加权重并把 `prod` 指向新版本；`--smoke` 会以 `action:version` 调用别名并强校验 `ExecutedVersion`。由于仓库保留用户未跟踪文档，发布需使用 `--allow-dirty`，但运行包构建仍只取白名单运行文件，并用已提交 HEAD 写版本描述。
- 生产 Lambda 已从提交 `86498e9` 发布为版本 36，代码摘要 `37GbY0oQ/T8yPczUtNgi2PltURS/JW5Hu9NqVlnVH1o=`；`prod` 已切到 36。别名直调返回 StatusCode 200、ExecutedVersion 36、FunctionError null、业务 code 0，包版本仍为 1.2.2。
- 发布归档位于 `s3://vl-case-json-converter/lambda-packages/vl-case-json-converter/archive-86498e9-20260814T063336Z.zip`；部署内完整测试再次为 102/102、0 fail。
- Lambda 独立 read-back 再次确认别名无额外路由权重，版本 36 为 Active/Successful，描述精确关联 `86498e9`，运行参数仍为 nodejs20.x / 2048 MB / 120 s。
- VxEditor41 目标文件 ESLint 0 warning，生产 webpack 构建 exit 0；构建报告 33 类仓库既有 warning，均来自其他文件/旧依赖或用户未跟踪 UI 代码，目标转换器没有新增 warning。
- VxEditor41 修复提交为 `c97326655 fix: preserve member access after value fallbacks`，已推送到 `origin/master`；提交精确只有 `src/utils/convertV4ToV5/formulaCode/V4FormulaCodeConverter.js`，既有 tracked/untracked 用户改动均未暂存。

## Phase 140：逻辑表达式后成员访问丢失

- V4 公式 `((row || {}).customerCompany || {}).name` 在 Converter 1.2.2 中被转换为只含 `row || {}` 的 `switchexp`；`.customerCompany` 与 `.name` 被静默丢弃，运行时因此显示整条 row 对象。
- 根因位于 `processMemberExpression` 默认分支：`genObjectPropertyAST` 只接受可由 `isGetAST` 识别的接收者；逻辑表达式产生的 `switchexp` 不满足条件，函数直接返回，而调用方没有触发 custom-expression fallback 或其他保义路径。
- 修复采用现有公式网关的保义路径：属性无法安全追加时抛出 `MemberExprReceiver`，让完整表达式进入 custom-expression/jsfn fallback；不再静默输出被截断的结构化 AST。
- 回归覆盖独立成员链和生产形态三元表达式；正常公司名、发票号分支与 null 接收者语义均正确。公式模块定向测试和项目全量测试通过，全量为 102/102、0 fail。
- 本轮用户明确要求绕过 V4→V5 工作流，直接修复转换器；不修改案例或平台数据。

## callback paramFunc 通用修复

- 全案审计确认新增元数据未改变组件、事件、事件块、data-if、jsfn、持久化代码或 cType 不变量；V4 root 通过 eventId 保留，所有非 root BID 均有 V5 ln。
- 真实案例验证符合用户手工 AST：BID `cjk76jaa3j50000sdws0` 和 `cjhwqm6a3j500007z6kg` 都同时具备 `paramFunc/transValue`，且旧 block shape、`$SF_obj_translateData` 残留和相关诊断全部为 0。该修复只增加编辑器可逆元数据，不改变 `val/args` 运行语义。
- 实现严格复用编辑器序列化规则：去掉 `$SF_` 前缀得到 `val`，默认 `_blockType:'paramFunc'`，仅当展示名与 `val` 不同才写 `_alias`。普通 callback field 与 singleParam 分支不变，legacySysutilMap 也未扩大。
- 失败回归使用真实组件/动作契约而非案例 ID：修复前 chooseAddress 完整 AST只在 sysutil 元数据处失败，uploadFiles 同类断言因首个 deepEqual 已中止尚未执行；修复后必须两者同时通过。
- 修复边界已授权：从 callback param 契约读取 `name/func`，同时生成名称键和函数键；命中 func 时输出正式 V5 `sysutil + _blockType:paramFunc + 条件性_alias`。legacy sysutil 表仅保留无动作契约时的运行兜底。

## 第 43 例手工 AST 与转换 AST 元数据核对

- 最终修复方案：① 在 Node 版 `utils/MapCreator.js` 与 VxEditor41 的 `formulaCode/MapCreator.js` 中保留 callback param 的 `func`，按 `name` 和 `func` 双键索引同一 info；② 两仓 `getStageCompActionRtnPropAST` 的 func 分支生成正式 V5 `{op:'sysutil',val,_blockType:'paramFunc',_alias}`；③ 保留 legacy sysutil 表作为无 action contract 时的执行兜底，不向其中硬编码 alias；④ 回归覆盖 `chooseAddress/transValue` 与 `uploadFiles/objData`，并验证 ast2js 语义不变和真实案例目标 BID 与手工 AST一致。
- 全量数据没有发现同一组件动作内同一 `func` 对应多个 `name`，所以 `rtnPropLocMap[name]` 与 `rtnPropLocMap[func]` 双索引在当前资产上无歧义；仍应在单测中断言两个键指向同一契约信息。
- 组件契约中存在 579 个 callback func 落点、16 种唯一 display/function 配对，表明应修“组件动作返回参数契约→V5 paramFunc AST”的通用链路。若只在 `legacySysutilMap.$SF_obj_translateData` 写 `_alias:'transValue'`，会漏掉其余配对，并可能把脱离 callback 上下文的普通 sysutil 误标成 paramFunc。
- `genStageCompActionMap` 与 `getStageCompActionRtnPropAST` 必须成对修改：前者保存并双键索引 `{name,nameEN,func}`；后者把 contract 记录转换成真正的 V5 sysutil AST。只做前者会暴露后者现存的旧 block shape，产生含 `type/name/val` 而没有 `op` 的无效节点。
- 用 `loadRuntimeMaps()` 实测 `ih5-wechat$chooseAddress` 证明当前 map 生成结果只认识显示名 `transValue`，而 V4 公式保存的是函数名 `$SF_obj_translateData`。这不是案例数据异常，而是 `genStageCompActionMap` 丢弃 `func` 后造成的系统性不可逆映射。
- ast2js 的 sysutil 编译只基于 `op/val/args`，不读取 `_blockType/_alias`，故两份 AST 的运行代码完全等价；不能把当前结果称为运行错误，但它不是编辑器手工开发的规范、可逆 AST。
- 现有 `$SF_obj_translateData` 回归仅验证普通参数对象上的结构化 sysutil和执行结果，缺少 actionResult/组件方法契约，因此即使 `_blockType` 错成 `sysutil` 仍会通过。应新增契约驱动的 callback paramFunc 回归，而不是只修改现有运行语义断言。
- 推荐修复不应把 `transValue` 硬编码进全局 legacy sysutil 映射。应让 `genStageCompActionMap` 保留 callback param 的 `{name,nameEN,func}`，同时按 `name` 和 `func` 建索引；然后让 `getStageCompActionRtnPropAST` 根据该契约直接生成 `{op:'sysutil',val:去掉$SF_的func,_blockType:'paramFunc',_alias:name}`。这样别名来自具体组件动作元数据，同类 `objData/$SF_sys_multiObjListToObjArr` 也能统一正确转换。
- 当前 `getSysutilInfoFromFuncName` 返回完整映射对象，但 `genSysutilMethodAST` 仅解构 `name`，其返回值固定 `_blockType:'sysutil'`。因此缺口不是 AST 调用解析失败，而是生成器没有表达“同一个 sysutil 函数在当前 V4 公式中属于 callback paramFunc 且显示别名为 transValue”的元数据。
- VxEditor41-widgets 的 `chooseAddress` callback map 是权威契约：显示名 `transValue`，实际函数 `$SF_obj_translateData`。VxEditor41 `blockProcessor` 对 `type:'paramFunc'` 正向写为 `{op:'sysutil', val:'obj_translateData', _blockType:'paramFunc', _alias:'transValue'}`，反向又用这两个字段恢复参数函数块；这解释了手工 AST 的精确来源。
- 已确认运行结构和引用完全相同，差异不是 ref/field/get/var 或调用语义，而只在 sysutil 节点 UI 元数据：转换器 `{op:'sysutil',val:'obj_translateData',_blockType:'sysutil'}`；手工编辑器 `{op:'sysutil',val:'obj_translateData',_blockType:'paramFunc',_alias:'transValue'}`。因此当前产物编译执行语义应正确，但编辑器里的参数函数识别、别名显示或再次编辑体验可能不一致。
- 待核对重点：用户手工 AST 的 sysutil 节点含 `_blockType:'paramFunc'`、`_alias:'transValue'`，外层 get 含 `_blockType:'$cbParams'`、`_ver:1`，field 含 `_uiSkip:true`。需要从真实转换产物确认转换器是否只保留了运行语义却遗漏编辑器重开/渲染所需元数据。

## clothing 第 43 例：移动选款H5（nid 11271414）

- Phase 124 已完整发布：tov5parser `9c5e6ae`、生产 Lambda 版本 31（`prod`、冒烟成功）和 VxEditor41 `26a9b0421` 三端一致。修复后真实案例两个落点均为正式 `obj_translateData` sysutil AST，最终 `$SF_obj_translateData` 残留 0；第 44 例未启动。
- Phase 124 实现边界：现有 `legacySysutilMap` 已为同类 callback-only 工具 `$SF_sys_multiObjListToObjArr` 提供 `{name:'$SF_...'}`，对应测试同时断言结构化 `op:sysutil`、无 jsfn 残留、ast2js 输出 `$sys.util...` 和运行语义。`$SF_obj_translateData` 应沿用该通路，新增 `{name:'$SF_obj_translateData'}`，不能改 full-JS 字符串或按 BID 特判。
- 最小修复验证成立：新增 legacy 条目后 `genSysutilMethodAST` 自动生成 `op:'sysutil', val:'obj_translateData'`，ast2js 输出 `$sys.util.obj_translateData(receiver)`；mapping 对象会保留原键并补翻译键，无 mapping 时返回原对象。无需新增 fallback 字符串归一化或改动运行时。
- 真实重转闭环：两个目标 BID 都从 `jsfn("$v1.$SF_obj_translateData()")` 变为 callback result 的正式 get 链，尾节点为 `{op:'sysutil',val:'obj_translateData'}`，且各自 jsfn 数为 0。全案 `$SF_obj_translateData` 残留和相关诊断均为 0；最终 jsfn 64→62、诊断 66→64，dropped 保持 0。
- 源目录 C locale 排序为第 43/51 例，文件名 `移动选款H5_11271414_温晓华.json`；相邻第 42 例为用料组合预设，第 44 例为花名册。
- 本例开始前 V4/V5 目标目录均不存在；按用户要求保留此前全部案例，且未经再次授权不启动第 44 例。
- 数据库唯一记录：`extra.ver=null`、`verDetail=null`、两表 `edt_ver=4.1`，只能初筛为 V4.1 候选；ntype 1、version 101、work_id `chvvkjslc7li32pn6v20-696`、标题 `移动端选款H5`、当前作者温晓华、短链 `DCjLYgVr`。必须下载最新 `/work/load` 实物扫描事件 AST 后最终判版。
- 当前 work 完整 JSON 为 2,595,216 bytes、SHA-256 `cbd1e360...2bb8`；241 个事件容器含 244 个事件，244/244 全部为旧 tree、event AST 0、Formula 1,118，全案 `ast/op/ln/cType` 键均为 0，最终确认 V4.1。源清单正文与当前 work 不同，转换必须使用下载实物。
- 当前转换器以 `ntype=1 --diag` 转换 1/1 成功，生成约 1,858.9 KB V5；66 条诊断全部进入 jsfn/custom-expression 兜底，dropped 0、去重 66。控制台 ParseError 主要涉及字符串方法、正则、getNormal/getChildMeshes/findIndex、TemplateLiteral 等，必须审计最终 jsfn、动作/条件/服务、3D 回调引用与模块结构后才能判断是否有真实转换错误。
- 全案结构主链闭合：组件 1,088→1,088（唯一 ID 1,087→1,087）、事件 244→244 且全部有 AST；972 个 action 中 19 个禁用动作均保留 `skip:true`，2 个未落 ln 的 action 是 V4 原生 `action:null` 空占位。99 个 data-if 全部生成正式 `props.conditionVal.ast`，31 个 fireService 目标一致，后台 service 的 AST/_code、模块、函数、cType 和引用来源均通过；52 个非空 `_code` 语法正确，项目测试 91/91。
- 唯一确定性转换器错误是两处启用动作仍生成 `jsfn("$v1.$SF_obj_translateData()")`：`cjk76jaa3j50000sdws0`（微信 chooseAddress 回调结果写入地址变量）和 `cjhwqm6a3j500007z6kg`（同回调结果 consoleLog）。普通对象没有该 V4 原型方法，运行时会 TypeError。
- V4 同事件 `_code` 已给出权威目标：`$sys.util.obj_translateData(cbParams)`；VxEditor41 `ast2js` 会把 `{op:'sysutil',val:'obj_translateData'}` 正确编译为该调用，VxEditor41-widgets 也导出 `obj_translateData(result)`。根因是 `$SF_obj_translateData` 只登记在微信 callback 元数据，未进入通用 sysutil map，也未列入转换器的 `legacySysutilMap`，结构化试探失败后被 fallback 原样保留。

## clothing 第 42 例：用料组合预设（nid 11079651）

- 源目录 C locale 排序为第 42/51 例，文件名 `用料组合预设_11079651_温晓华.json`；相邻第 41 例为用料组合详情，第 43 例为移动选款H5。
- 本例开始前 V4/V5 目标目录均不存在；按用户要求保留此前全部案例，且未经再次授权不启动第 43 例。
- 数据库唯一记录：`extra.ver=null`、`verDetail=null`、两表 `edt_ver=4.1`，只能初筛为 V4.1 候选；ntype 1、version 33、work_id `ccfv2tterj4vif1ckb5g-256`、标题 `FRP_用料组合预设`、当前作者李小燚、短链 `X67zDn90`。源文件名作者温晓华与当前作者不同，必须下载最新 `/work/load` 实物扫描事件 AST 后最终判版。
- 当前 work 完整 JSON 为 7,464,591 bytes、SHA-256 `13fc85f6...843e`；491 个事件容器含 605 个事件，605/605 全部为旧 tree、event AST 0、Formula 7,397，全案 `ast/op/ln/cType` 键均为 0，最终确认 V4.1。源清单正文与当前 work 不同，转换必须使用下载实物。
- 当前转换器以 `ntype=1 --diag` 转换 1/1 成功，生成约 5,250.4 KB V5；65 条诊断全部进入 jsfn/custom-expression 兜底，dropped 0、去重 65。控制台 ParseError 主要涉及 findIndex、NewExpression、Spread、unknown global、callee、`in` 与 TemplateLiteral，必须审计最终 jsfn、动作/条件/服务与引用后才能判断是否有真实转换错误。
- V5 实物为 5,376,444 bytes、SHA-256 `88c82c15...16ff`；诊断 JSON/Markdown 分别为 44,519/18,069 bytes。组件选择器以带 `field` 的真实节点为准，V4/V5 初步均为 2,654 个；事件仍保存在同节点 `events.list` 中，V4 root `tree.bid` 对应 V5 `eventId`，可按该映射做全量审计。
- 首轮全案审计主链通过：节点 2,654→2,654、事件 605→605、动作 3,060 全部按 BID→ln 映射；65 个 jsfn（36 种代码）和 172 段持久化 `_code` 均无语法、参数、占位符或旧运行时标识问题，338 个 cType 均为既有类型。待闭合项为两个未独立映射 status、两个无正式 condition AST 的 data-if、8 个条件空 val、12 个引用来源判定，以及 fireService 检查器没有识别 V5 的直接 `runsvc/runsrv` op 形态。
- 两个未落 ln 的 status 是同一上传事件的 `uploading` / `beforeUpload` 包装，子动作均已映射；属于已知包装折叠。两个无 condition AST 的 data-if 在 V4 原本就是 `_code/code` 均为空，并正确保留兼容 `binds.value={op:'val'}`。8 个条件空 val 中 4 个对应 V4 列表内明确的 `undefined`，另 4 个是三元 `switchexp` 的默认比较哨兵；均非 dropped。`$valid_Null` 两处仍是上例已验证的规范 typeIsNot 结构。
- V5 服务调用不是 `method:runsvc`，而是在对应 action ln 下生成 `let(args:[{op:'runsvc',val:<服务ID>}])`；首轮 service 假阳性来自检查器形态假设错误，需改为直接识别 `op=runsvc/runsrv` 并比较 `val`。
- 修正服务检查器后 89/89 个 fireService 目标完全匹配，21 个后台 data-service 均有 AST 与 `_code`，server.v2=1；模块/函数/共享服务计数与 V4 一致。109 个 skip 中 105 个对应禁用动作，另 4 个是启用的 animate.play，需再核对目标 infinite 属性。首轮“新增 12 个悬空引用”比较只从 V4 `$refs.*` 文本取来源，遗漏 Formula `nodeId`、动作 `object` 等引用形态；12 个 ID 在 V4/V5 都没有 id/bid/ln 定义，不能据此判为转换新增，需按全量字符串引用来源复核。
- 4 个启用 play 的目标均是 V4/V5 保持 `props.infinite=true` 的 data-animate，skip 符合无限动画规则；其余 105 个 skip 与 105 个禁用动作一一对应。V5 的 29 个未解析 var ref 全部能在 V4 `$refs`、Formula `nodeId` 或 action `object` 来源中找到，新增悬空引用为 0；其中首轮多出的 12 个精确来自 V4 action.object 并原样保留，不是转换器制造。
- data-if 根分布为 `=` 177、`!=` 18、sysop 54、`>` 11、or 19、and 33，另 2 个是已确认 V4 原生空条件；所有非空根均为有效 V5 op。3 个 V4 空 action 均保留对应 ln 占位，没有动作 BID 丢失。
- 65 条诊断落点为 actionParam 40、bind 19、条件块 6，全部位于 stage；对应 blockType 为 action 40、con 6、无 block 19。完整项目回归 91/91 通过，至此没有待解释审计缺口，可按第 41 例模板生成单例报告。

## clothing 第 41 例：用料组合详情（nid 11134755）

- 源目录 C locale 排序为第 41/51 例，文件名 `用料组合详情_11134755_温晓华.json`；第 42 例是 `用料组合预设_11079651_温晓华.json`。
- 本例开始前 V4/V5 目标目录均不存在；按用户要求保留此前全部案例，且未经再次授权不启动第 42 例。
- 数据库唯一记录：`extra.ver=null`、`verDetail=null`、两表 `edt_ver=4.1`，是 V4.1 候选；ntype 1、version 34、work_id `cduvkt9f0jnb793upkrg-415`、标题 `FRP_用料组合详情页`、当前作者罗安琪、短链 `cxmqo8A9`。必须用最新 `/work/load` 实物最终判版。
- 当前 work 完整 JSON 为 4,649,566 bytes、SHA-256 `38a3bafd...742d`；379 个事件全部为旧 tree、event AST 0、Formula 3,435，且 `ast/op/ln/cType` 均为 0，最终确认 V4.1。源清单正文与当前 work 不同，转换必须使用下载实物。
- 转换生成 3,498,182-byte V5（SHA-256 `4bb2e6b5...bdb8`）；49 条诊断全部是 customExpr/jsfn，dropped 0。高频类别包含 findIndex/callee/full-JS/unknown varType/native filter，必须在最终 AST 中验证参数、占位符、语法和旧运行时标识符后才能定性。
- 首轮结构审计除节点选择器假差异外均闭合；节点选择器必须排除带 `bid` 的 V4 事件块和无 `field` 的工作流图元。
- data-if `cre9wxba3j50000nq420`、`crmwv4ca3j50000g6f50` 使用 V4 `notMatch $valid_Null`。V5 根为 `sysop/typeIsNot`，但右参数是 `ref(local, \"$valid_Null\")`；需对照转换器和 V5 执行契约判断，不能仅凭空 val 哨兵判错。
- 代码与编辑器均确认 `$valid_Null` 是 typeIs/typeIsNot 的专用条件值，不是普通字符串；现有测试只断言“不是普通 val”，尚未证明当前带双引号的 local ref 正确。
- VxEditor41 VLang `isValidNull()` 精确要求 `get(ref(['local','\"$valid_Null\"']))`，并将 `typeIsNot` 编译为双重布尔转换；当前 V5 AST 正是该规范形态。三个 data-if 的空 val 均位于 switchexp 默认分支哨兵，可排除转换错误。
- 修正审计选择器后组件 1,637→1,637、事件 379→379、动作 1,826→1,826，所有事件块、服务目标、后台代码、模块、cType 与引用来源闭合。目前未发现转换器错误，但仍需检查 49 条诊断落点与完整项目回归后定论。
- 49 条诊断与最终 49 个 jsfn 一一闭合；32 种代码均可编译且参数/占位符完整。unknown varType 仅涉及 `window.line` 和 `Date.now()` 这类合法 JS 全局，没有发现转换器新增自由变量或逻辑丢失。

## clothing 第 40 例：生产设置（nid 11385575）结构审计

- V4 当前工作 JSON 共 536 个节点、130 棵事件树；转换后节点和事件数量一致，所有事件均有 V5 AST。
- 块映射完整：130 root、647 action、187 con、10 loop、3 group 全部映射。66 个 status 中仅 2 个 `uploadPic/uploading` 包装状态未生成独立 AST 节点，但其子动作均已映射，符合包装状态折叠规则。
- 45 个 `data-if` 全部生成有效 AST；14 个自定义表达式回退为 `jsfn`，0 个表达式被丢弃，全部通过语法、参数和占位符检查。
- 28 个服务调用目标完全一致；未发现本例触发新的转换器缺陷。
- 诊断总数/去重数均为 14：13 条是不支持结构化 `findIndex`，1 条是不支持结构化 `toString`；全部进入可执行 jsfn，0 dropped。落点为 12 个节点 bind、2 个动作参数。
- 最终 V5 为 895,612 bytes、SHA-256 `ebf4cd73bb4b9bbc2f33d913743dc7d2ede84e2fc4034e766eb84ec37a0d3e46`；项目完整测试 91/91 通过。

## 2026-07-31 提交、Lambda 部署与 VxEditor41 同步

- 用户已明确授权两个仓库的提交和推送，以及生产 Lambda 更新。
- tov5parser 当前 `main` 起始点为 `9d0e91c`，无关未跟踪文档 `VxServer-saveAs-same-gid-group-db-fix.md` 不进入提交。
- 本次需要同步的生产逻辑限定为 `reason` 多单词纯文本识别，以及 legacy 文本在 `paramsAsObj` 动作中保留参数键名；VxEditor41 需按其现有转换器结构做等价最小改动。
- 两个仓库获取远端后均无 ahead/behind；tov5parser 提交前完整测试 55/55 通过且差异格式检查通过。
- tov5parser 修复提交为 `6591019a4698c56a91246550d4f6e6bfb5b70afb`，已推送到 `origin/main`。
- 生产 Lambda 由版本 7 更新至版本 8；版本 8 状态 Active/Successful，代码摘要 `efipXIWsIApfRh2bwyR0aaiPkrF5rkPKB4Dh7EgN87k=`，`prod` 100% 指向版本 8，别名冒烟成功。
- 部署包以 1,957,934 bytes 留档在 `s3://vl-case-json-converter/lambda-packages/vl-case-json-converter/archive-6591019-20260731T095110Z.zip`；如需回滚，上一稳定版本为 7。
- VxEditor41 对应源文件在同步前无未提交差异；本次只需修改 `src/utils/convertV4ToV5/utils/action.js`，其他用户改动不进入提交。
- VxEditor41 定向验证覆盖：`reason="db error"` 命中文本、真实公式反例不命中、`paramsAsObj` 输出保留 `key:"reason"`；生产构建 0 error、33 类既有 warning。
- VxEditor41 同步提交为 `5d900d5739f4147f16d2ae5cb5b5ff9980e2b3a6`，已推送 `origin/master`，提交只含一个转换器源文件。
- 最终状态：两个代码提交均已在远端，Lambda `prod` 指向版本 8；Phase 69 完成，批量案例流程仍按用户要求暂停在 3/51。

## 2026-07-31 修复 reason 文本 Formula 生成空 jsfn

- 用户授权修复第三例发现的转换器错误；精确复核后确认是 `reason` 中未加引号的 `db error` 文本被转为不可编译的空 `jsfn`。
- 修复范围仅包含 `reason` 纯文本 Formula 的窄范围识别、回归测试、第三例重转审计；不同时修复源案例的悬空服务引用。
- 当前已跟踪改动只有三份规划文档，无其他未提交代码差异；无关未跟踪文档 `VxServer-saveAs-same-gid-group-db-fix.md` 继续保持不动。
- `v4ToV5/utils/formula.js::convertEditorValue()` 本身已对 `value.code === ''/null/undefined` 返回 `{op:'val'}`，因此空 `jsfn` 不是该入口直接遗漏。
- 问题发生在 `paramResult` 的 `paramsAsObj` 动作参数链路；需继续检查 `convertActionParamValue()` 是否在 `convertEditorValue()` 返回后将空 `val` 重新包成 `jsfn`。
- `convertActionParamValue()` 对 Formula 直接调用 `convertEditorValue()`，之后只在 `paramsAsObj` 时增加 `key`，未显式包装为 `jsfn`。
- `compileV5ServerAst()` 编译后台事件时使用 AST 深拷贝，不会改写原 AST；空 `jsfn` 应在进入后台编译之前已形成。
- 下一步核对 `isEmptyParamValue()` 判断、实际返回 AST 键序和转换前参数是否存在不可见字符。
- 精确键序复核纠正了早期定位：`data` 参数的空 Formula 已正确生成 `{op:'val', key:'data'}`；不可编译的空 `jsfn` 实际属于前一个 `reason` 参数。
- V4 `reason` 为 `Formula { code: "db error", str: [{type:'str',obj:'db'}, {type:'str',obj:' '}, {type:'str',obj:'error'}] }`，本质是未加引号的英文文本短语。
- `getLegacyFormulaTextValue()` 已对 `info` 参数的同类多单词文本做窄范围识别；最小修复应将 `reason` 纳入同一规则，仍不吞掉 `param.reason` 等真实公式。
- 已新增失败回归断言：`reason: "db error"` 应识别为文本，`reason: 'param.reason || "db error"'` 必须保持真实公式路径。
- 修复前定向测试精确失败：实际值 `undefined`，预期 `db error`；反例尚未执行到。
- 将 `reason` 限定为“两个以上单词、仅含字母/数字/下划线/连字号”的文本短语后，定向 helper 测试通过，`param.reason || "db error"` 反例仍返回 `undefined`。
- 为避免只测 helper，还应增加一个完整 V4 服务 `paramResult` 转换断言，覆盖 `paramsAsObj` 的真实 AST 路径。
- 完整服务返回回归首次运行发现第二个相关问题：`getLegacyFormulaTextValue()` 命中后在 `convertActionParamValue()` 中提前返回，绕过了函数尾部的 `paramsAsObj` 键名赋值。
- 当前实际 AST 为 `{op:'val', val:'db error'}`，少 `key:'reason'`；最小修复需让 legacy 文本提前返回时同样保留 `paramsAsObj` 的参数名。
- 最终修复包含两个紧密相关的最小变更：仅对 `reason` 的纯多单词短语返回文本；legacy 文本提前返回时若 `paramsAsObj=true` 则保留 `key:param.name`。
- 定向测试 2/2 通过：完整服务返回 AST 为 `{op:'val', val:'db error', key:'reason'}` 和 `{op:'val', key:'data'}`；真实公式反例不被文本规则吞掉。
- 项目全量测试由 54 增至 55，55/55 通过。
- 修复后重转第三例成功：诊断 654 → 653，去重 628 → 627，`not support compound expression` 1 → 0，`dropped` 仍为 0。
- 目标返回动作 `cpwc0z3a3j5000038te0` 现为 `reason={op:'val',val:'db error',key:'reason'}`、`data={op:'val',key:'data'}`，键名和值均正确。
- 全案例 `jsfn` 由 637 降为 636，636/636 全部可编译，参数数不匹配 0，旧式引用残留 0。
- 新 V5 为 6,135,297 bytes，SHA-256 `454f099b9821f0babfa0d18fa01eb0e98f095da3b89e05704d90674e8ec0911a`，保持紧凑 JSON 与 `server.props.v2=1`。
- `git diff --check` 通过；最终代码差异仅为 `v4ToV5/utils/action.js` 和 `v4ToV5/v4ToV5.test.js`，未触碰无关未跟踪文档。

## 2026-07-31 clothing 全案例逐例转换

- 源目录 `/Users/lianghuang/Desktop/ivx_repos/clothing/04_原始项目JSON代码` 共发现 51 个 `.json` 文件，文件名格式均可提取数字 nid。
- 第四例为 `frp后台1_11023063_熊.json`（nid `11023063`）。该 nid 已有历史目录 `frp-后台`，但按本轮规则仍会重新查询和下载，并保存到独立的 `frp后台1_11023063_熊` 目录，避免覆盖历史证据。
- 第四例最新数据库记录：标题 `frp-后台`、作者熊维祥、V4.1、`ntype=1`、版本 1018、`work_id=calcup52uhpcud8vv3h0-2508`；相较 2026-07-30 历史记录 `...-2503` 已更新，应重新下载而非复制历史 JSON。
- 第四例最新 V4 完整 JSON 为 29,286,576 bytes，SHA-256 `f5cef2601f54536cd92e8ceeca45d120223ffdd32927d45f810651e19a10234c`，0 换行紧凑格式，三根结构完整。
- 第四例转换器运行成功，诊断 1,028 次、去重 1,004 条，全部以 `custom-expr-fallback/jsfn` 保留，空值降级 0；需要继续判断这些 `jsfn` 是否都可编译以及是否存在源引用问题。
- 历史版本 1017 的同 nid 报告记录 1,008 个可编译 `jsfn` 和两个源案例悬空服务 `d3r5bcna3j50000075d0`、`d2qayvka3j500007z9qg`；版本 1018 的诊断比其多 1 次，需核对增量及悬空目标是否变化。
- 第四例最终 V5 为 26,802,535 bytes，SHA-256 `35a268d8b3854ba3213210bc5f6b9946d89c89877c6c5b60949a2a7eba1d77e6`，0 换行紧凑格式，`server.props.v2=1`。
- 结构与公式审计全部通过：770/770 节点、9,531/9,531 非根事件块、1,009/1,009 可编译 `jsfn`，参数形状不匹配 0，旧版引用残留 0。
- 版本增量已闭环：新增的 `param.formData.materialConfig||param.formData.data` 被转为 `$v1 || $v2`；修改后的块体 map 公式也生成可编译单行 `jsfn`，未发现转换器错误。
- 两个源悬空服务保持不变：`d3r5bcna3j50000075d0` 的“补部门”调用启用；`d2qayvka3j500007z9qg` 的“test”调用已禁用并转为 `skip:true`。
- 第四例最终文件和目录保留检查通过；批量进度为 4/51，下一例按稳定排序是 `frp后台2_11260689_熊.json`。
- 2026-08-03 用户确认继续；第五例为 `frp后台2_11260689_熊.json`（nid `11260689`），将重新查询该 nid 自身版本，不从相邻的 `11023063` 推断。
- 第五例数据库记录：标题 `frp-后台2.0`、作者熊维祥、V4.1、`ntype=1`、版本 1268、`work_id=chmqnnn5alif72t1eq9g-2917`；符合进入下载与转换流程的条件。
- 第五例最新 V4 JSON 为 12,071,999 bytes，SHA-256 `ce197e276ab00d4bc994a1823e177c454e62fbf837c0aa34d49e5220fa565acc`，0 换行紧凑格式，三根结构完整。
- 第五例转换成功，诊断 1,208 次、去重 1,164 条，全部进入 `custom-expr-fallback/jsfn`，逻辑降级 0；仍需对最终 `jsfn` 和引用完整性做独立审计。
- 第五例发现确定的转换器错误：服务 `customerSetRoster` 的动作 `cj1faqja3j500002ahy0`，V4 公式 `(cbResult.length ? cbResult[0].name - 0 + 1 : 1).toString().padStart(3,"0")` 被转成 `$v1 ? $v2 - 0 + 1 : 1.toString().padStart(3,"0")`，无法编译且三元整体的成员调用语义丢失。
- 根因为 `ExprAstToString.visit(MemberExpression)` 未将 `ConditionalExpression` 对象括起来；此前数字 Literal 修复只能处理 `(1).toString()` 直接 receiver，无法覆盖 `(condition ? x : 1).toString()`。正确输出应为 `($v1 ? $v2 - 0 + 1 : 1).toString().padStart(3,"0")`。
- V4 全量 AST 扫描还命中两处重复的 `(i.afterSaleType===-4 ? ["后整理"] : ["缝制","后整理"]).every(...)`；需检查它们最终是否由 full-JavaScript 路径正确保留括号，避免仅以“可编译”判断语义安全。
- 实际影响不止两处动作参数：同一公式还各自在前置条件中出现一次。最终共有 4 个可编译但语义错误的 `jsfn`，对应 BID `d0e213ca3j500002qsbg/qsc0` 与 `d2tm3p6a3j500008s83g/s840`；加上编号公式，本例共有 5 个受同一括号缺失根因影响的输出。
- 对全 V4 JSON 的所有 `code` 表达式执行 jsep AST 扫描后，ConditionalExpression receiver 总数正好为 5，说明该根因在本例的影响范围已完整收敛。
- 第五例最终审计：636/636 节点、9,040/9,040 非根事件块保留；1,172 个 `jsfn` 参数形状全部匹配，旧式引用残留 0，语法编译为 1,171/1,172；7 次服务调用的 7 个唯一目标全部存在。
- 第五例 V5 为 9,573,950 bytes，SHA-256 `be2528c6cc41601a346260bd82847df9c4b8a3685bc17c546aec477c577983bc`，0 换行紧凑格式，`server.props.v2=1`；项目测试 55/55 通过。
- 本轮只记录缺陷，没有修改转换器。第 5/51 例已完成并等待审阅；下一例为 `pda扫码_11328085_吴坤.json`。
- 2026-08-03 用户授权修复第五例的 5 处同根错误；最小修复范围限定为 `ExprAstToString` 对 `ConditionalExpression` member receiver 的括号序列化及其回归测试。
- 既有 `numeric literal receivers stay valid` 回归直接构造 jsep AST 并检查生成代码及 `new Function` 编译；新测试将沿用该层级，分别覆盖 `(condition ? value : 1).toString()` 与 `!(condition ? a : b).every(...)` 的精确括号和运行语义。
- 两个新增测试在修改生产代码前精确失败，证明不需要改 UnaryExpression 或 CallExpression；只要 MemberExpression 把 ConditionalExpression receiver 包在括号中，两条外层语法会同时恢复正确结合关系。
- 最小实现仅扩展既有 receiver 括号条件，不改变 ConditionalExpression 自身打印、调用参数、unary 或其他表达式的通用优先级逻辑。
- 修复后定向测试 3/3、项目全量测试 57/57 通过；未触碰组件映射、转换结构或后台编译逻辑，下一步以真实第 5 例重转确认全部 5 个落点。
- 真实案例重转后的诊断总量和分类入口保持不变（1,208/1,164，dropped 0）；需要从生成的 `jsfn` 精确验证 5 个目标均恢复，不能用诊断数变化代替正确性检查。
- 目标复核结果：`($v1 ? $v2 - 0 + 1 : 1).toString().padStart(...)` 恰好 1 处，`!($v1 === -4 ? ... : ...).every(...)` 恰好 4 处；两类旧错误文本均不存在。
- 全量审计由修复前 1,171/1,172 可编译提升为 1,172/1,172；其他结构指标保持为 636/636 节点、9,040/9,040 非根事件块、7/7 服务目标，说明修复没有扩大结构影响面。
- 修复后 V5 相比初次产物仅增加 20 bytes，最终 SHA-256 为 `8589e68c9bf5d7f42cf76778e7773c6798d0536e5339d17e718c7c11a724811b`；对应 5 对括号的增加与目标影响范围吻合。
- Phase 70 已完成。代码改动只有 `ExprAstToString.js` 和 `jsepWrap.test.js`；规划文档为既有长期任务记录，无关未跟踪文档继续保持不动。
- 2026-08-03 用户授权本轮双仓库提交推送与生产 Lambda 部署；VxEditor41 只需同步 `src/utils/convertV4ToV5/formulaCode/ExprAstToString.js` 的等价一行类型扩展，不纳入该仓库已有用户改动。
- 两个远端在本轮提交前均未移动：tov5parser 起点 `c4c7cd2`、VxEditor41 起点 `5d900d573`，ahead/behind 均为 0/0；可以直接提交推送，无需历史协调。
- tov5parser 修复提交为 `484f7ed96110e38a0d299f53e6688d8e19d5282f`，已推送 `origin/main`。
- Lambda 部署基线为生产版本 8（`prod` 100% 指向 8），代码摘要 `efipXIWsIApfRh2bwyR0aaiPkrF5rkPKB4Dh7EgN87k=`；部署脚本会发布新不可变版本、清空附加权重并做别名冒烟。
- Lambda 新版本为 9，发布代码摘要 `D7C64I3uMQgx9nfZTXgKBZkEXdikLB75WmaH23Lm+fI=`；`prod` 冒烟已确认实际执行版本 9，上一稳定版本 8 保留作回滚。
- VxEditor41 目标文件与 tov5parser 在修复前具有相同基线 hunk；同步后的差异精确一致，仓库无本地测试文件，需用 ESLint/Babel 行为重放和生产构建验证。
- VxEditor41 使用 Babel 7，默认 preset-env 配置 `modules:false`；本地验证可在内存转换时改用 CommonJS module 插件，不修改项目配置或生成文件。
- VxEditor41 验证闭环为目标 ESLint、Babel/CommonJS 内存重放、webpack production build；三者均通过，构建结果只有既有 warning，没有本次修复错误。
- VxEditor41 同步提交为 `7cd5ce999be59cdd65c1b1ec23de0532db442b28`，提交只含 `src/utils/convertV4ToV5/formulaCode/ExprAstToString.js`，已推送 `origin/master`；用户其他工作区内容保持原状。
- Phase 71 最终状态：tov5parser 修复 `484f7ed96110e38a0d299f53e6688d8e19d5282f` 已推送并上线 Lambda 版本 9；VxEditor41 同步 `7cd5ce999be59cdd65c1b1ec23de0532db442b28` 已推送。下一步只需继续 Phase 67 的第 6 个案例。
- 2026-08-03 第 6 例为 `pda扫码_11328085_吴坤.json`，nid `11328085`；仍按数据库元数据 → 只读 `/work/load` → 本地转换 → 全量审计的既定链路处理。
- 第 6 例开始时只读 SSH 隧道仍在本机 13306 端口监听，原隔离 PyMySQL 目录 `/tmp/tov5parser-pymysql.Qk4B1b` 存在，无需改项目依赖。
- 第 6 例数据库记录：标题“移动端PDA服装H5”、作者王洋（源清单文件标注吴坤）、V4.1、`ntype=1`、版本 54、`work_id=cjjicv1t40ok967083cg-259`、链接码 `hPs5UP5B`，已发布且已上架。
- 第 6 例 `/work/load` 返回两个加密压缩分段并成功解码；V4 完整 JSON 为 2,016,076 bytes、0 换行，SHA-256 `2d906a8f8e985d58c5e705d014c698b2b993b8e3d790b530727f98e0bf3b9265`。
- 第 6 例转换成功，初始诊断为 221 次/180 条去重，全部为 custom-expression fallback，空值降级 0；诊断日志高频可见 `&&`、`||`、SpreadElement、TemplateLiteral，需以最终 jsfn 编译和语义审计判断质量。
- 第 6 例初审质量：1,185 个节点全保留、207 个 jsfn 全部可编译且无参数/旧引用问题、5 个唯一服务目标全部存在。
- `cpqqg60a3j50000bq7jg` 的 11 个“缺失”是假阳性：它们是数据对象 `props.structureName` 内的数据库结构描述 BID，不是事件块，均没有 `type`；事件落点审计必须限定 `typeof type === 'string'`。
- 正确事件口径为 961 个唯一非根事件块，961/961 保留。可解析 V4 公式的打印器结构扫描没有命中 `UnaryExpression(Binary/Conditional)` 或低优先级 CallExpression callee。
- 自由变量审计 attempt 1 失败原因是 tov5parser 不依赖 `eslint-scope`；这是审计工具缺失，不是转换错误，不应为此污染项目依赖。
- 替代审计复用 VxEditor41 已安装模块成功：207 个 jsfn 中有 13 个“代码含 `$vN` 但自身没有 val 形参/args”的异常形状，普通 compile 审计无法发现，因为 `new Function` 编译允许未声明的自由变量。
- 13 项来源是复杂数组 filter 回调中的逻辑 fallback；外层已有 V5 lambda，但其局部参数名为随机 `item_*`，与 `$vN` 不同，因此不能直接假设 `$vN` 会由外层闭包提供。
- V5 `ast2js` 对 `jsfn` 的实现明确生成 `new Function(val.slice(1), 'return '+val[0])(...args)`；无形参/无 args 的 13 项会在读取 `$v1` 时抛 ReferenceError，被 catch 转成 undefined。这把“异常形状”提升为确定的转换器逻辑丢失。
- 责任范围在 custom-expression 对嵌套 callback 的上下文传播/局部 fallback：不是 ExprAstToString 语法问题，也不是源公式错误；源回调中的 `x.field` 都是合法局部引用。
- 13 个错误落点精确为：`cpxf6vka3j500005g6d0` 4 个、`cpxf6vka3j500005g6e0` 2 个、`cpy4h3wa3j50000bvxw0` 4 个、`cpy4h3wa3j50000bvxx0` 2 个、`cpwtrd1a3j50000ks1zg` 1 个。前四组均是活跃 data-if 值绑定；最后一组事件/动作启用，但函数组在全树中没有调用引用。
- 最小复现证明触发条件是“外层不支持的逻辑表达式 + 比较式内含带逻辑条件的数组 callback”：`walkOrReplaceCustomExpr()` 先试探转换整个比较式，过程中内层 `processCustomExpr()` 原地把 callback AST 改为 `$vN`；比较式不是单一 get，临时结果被丢弃，随后递归在丢失旧上下文的已变异 AST 上再次生成 jsfn。
- 因此修复方向应避免试探转换污染原 AST，或在递归重用时保留/搬运第一次替换上下文；不能只为 `$vN` 补全随机形参，也不能归因于源案例回调。
- “外层 jsfn 参数正常”不代表整体公式正确：外层只正确接收两个 `filter(...).length` 结果，错误发生在更早执行的 `filter` 谓词。内层 `jsfn` 实际构造为无形参 `new Function` 并直接读取 `$vN`，运行时 catch 后返回 undefined，所以每个 filter 都退化为全量过滤。
- 四个活跃 data-if 的业务后果可具体化：两个“未完成装箱”公式的左右 filter 长度均退化为 0，等式组合会错误趋向 true；两个“有前置未完成”公式的 filter 长度均为 0，`> 0` 组合会错误为 false。
- `cpxf6vka3j500005g6d0.binds.value` 精确包含 5 个 jsfn：外层 jsfn 为 `val=["$v1 == $v2 && $v3 == $v4", "$v1", "$v2", "$v3", "$v4"]`、`args.length=4`，完全正常；四个外层 args 各自包含一个 filter lambda，其回调内 jsfn 才是 `val.length=1/args.length=0` 的错误项。
- 后续描述必须明确“内层 filter 谓词 jsfn”，不能笼统称“节点 jsfn args 为空”，否则检查者查看首个外层 jsfn 会得到相反印象。
- Data-if 新线索：`convertV4ToV5/index.js` 对 `props.conditionVal` 做专门的 `convertIfCons()` 并包装成 `{ast}`，然后才运行通用 `convertBinds()`；目标 V4 本身同时带 `binds.value`，所以 V5 两份条件表达式是独立转换生成，不是同一个对象的别名。
- VxEditor41 的 V5 条件属性 UI、加载引用初始化和保存 fake-AST 处理均专门识别 `node.props.conditionVal.ast`。当前证据倾向它是 V5 data-if 的权威条件字段，但在播放器执行链查清前暂不下最终结论，也不能继续把 `binds.value` 内层错误直接等同为实际运行错误。
- VxEditor5 同样把 `props.conditionVal.ast` 当作 data-if 专用 AST 字段。旧 `stageProxy` bundle 则只识别旧 `props.condition` 字符串再生成 value binding，并统一处理 `binds`；它属于旧播放链证据，不能替代 V5 general-AST / vlparser 的权威执行路径。
- vlparser `treeToVLang/helpers/NodePropsProcessor.js::processDataIf` 与 `DataIfProcessor.dataIfNodeToPropsCode` 明确只序列化 `props.conditionVal.ast`。VLang 反向解析也把条件从 `binds.conditionVal` 搬到该 props 字段。这是当前 V5/VLang 链的决定性证据：data-if 实际条件不是 `binds.value`。
- 由此必须重新分级此前发现的 13 个空参数内层 jsfn：至少四个 data-if 的 `binds.value` 中 12 个若不被其他链路消费，应视为冗余遗留字段中的坏 AST，而不是运行时缺陷；最后一个事件动作内的 jsfn 仍需单独保留原结论。
- `cpxf6vka3j500005g6d0.props.conditionVal.ast` 根结构为 `and(=(filterA.length, filterB.length), =(filterC.length, filterD.length))`，与 V4 两组 condition rows 一致。四个 filter lambda 内 jsfn 均完整声明 `$vN` 且 args 数匹配（9/9、8/8、9/9、8/8）。当前证据支持用户判断：正式 conditionVal AST 没有此前的参数上下文缺陷。
- 整棵 condition AST 的本地 ast2js 辅助打印因 mock `getNodeByIdFunc` 无法覆盖所有上下文引用而抛 `invalid node`；不能把该 harness 失败解释成产物无效，也不应重复同样调用。
- 目标 conditionVal 四个 jsfn 的 args 逐项与 V4 源字段吻合：局部 item 的包材码/人员 ID/状态，以及两个 for item 引用都存在且顺序对应 `$vN`；组合根 `and` 下两条 `=` 也与源条件行一致。
- 生产 legacyToVLang 最终经 `CaseJsonMapProjectBuilder` 调用同一个 `TreeToVLang.asyncParse()`，所以 DataIfProcessor 的字段选择不是旁支工具行为，而是 V5→VL 正式转换链行为。
- 当前应纠正案例判定：data-if 的 12 个坏内层 jsfn 仅存在于冗余 `binds.value`，正式 `props.conditionVal.ast` 正确；实际仍可能有效的转换器错误暂只剩函数组事件动作里的 1 个，且该函数组无调用引用。
- 完整案例真实 TreeToVLang 验证为 6 files / 0 errors；`cpxf6vka3j500005g6d0` 的 VL 条件是完整可读的四段 filter 比较，数据源、回调字段与 `_item0/_item1` 全部正确。此端到端结果最终确认 `binds.value` 不参与 data-if 正式输出。
- 四个目标 data-if 的正式 AST 全部通过：conditionVal 的 jsfn 参数错误为 0；冗余 binds.value 对应为 4/2/4/2 个错误。全案例 139 个 data-if 均带重复 `binds.value`，而所有 conditionVal jsfn 的参数审计失败总数为 0。
- VxEditor41 general-AST 编辑逻辑专门维护 `props.conditionVal.ast`，同时通用代码仍会遍历 binds 做引用/保存处理；这说明冗余 bind 会造成噪声和潜在维护风险，但不改变已验证的 V5→VL data-if 条件选择。
- 最终纠正：对本项目规定的 V5→VL 消费链，data-if 的 `binds.value` 不需要且应删除，权威表达式是 `props.conditionVal.ast`。目标节点正式 AST 和真实 VL 输出均正确；此前 12 项 data-if 运行错误为误报。
- 用户要求逐例执行并人工审阅：数据库确认版本；仅 V4 案例下载最新完整 JSON并转换；汇报后暂停。
- 2026-07-31 用户更新保留策略：不再删除已经测试、转换的案例；所有案例的 V4/V5 数据和报告累计保留在 `localCases/v4/clothing` 与 `localCases/v5/clothing`。
- 处理顺序采用完整文件名的稳定排序；首例为 `FRP导航栏_11020398_温晓华.json`，nid `11020398`。
- 工作区开始时只有一份无关未跟踪文件 `VxServer-saveAs-same-gid-group-db-fix.md`，本轮不触碰。
- 项目已有权威链路文档 `raw/中文服完整案例JSON导出.md`：只读查询 `vxshow.node_vx_data/node_vx` 获取 `work_id`、`ntype` 和版本信号，再调用 `GET https://editor.ivx.cn/work/load/{workId}?nid={nid}` 解码完整 `{case,server,stage}`。
- 版本口径：`edt_ver=4.0` 为 V4.0；`edt_ver=4.1` 且 `extra.verDetail` 为空为 V4.1；`verDetail=5.0/5.1` 为 V5；3.x 通常为 `edt_ver=3.5`。
- 本地转换入口为 `npm run convert:local -- <case> --ntype <n>`，支持紧凑 V5 输出与诊断文件。
- 中文服只读 SSH 隧道已在本机 `127.0.0.1:13306` 监听，无需重复启动。
- 本机无 MySQL CLI，系统 Python 也未安装 `pymysql`；沿用项目既有做法，在临时目录安装驱动后执行只读查询，不改项目依赖。
- 首例 nid `11020398` 查询结果：数据库标题 `FRP`，`data_edt_ver=node_edt_ver=4.1`，`verDetail` 为空，因此确认为 V4.1；`ntype=1`，当前作品版本号 64，`work_id=cajv67pl9ispg1dl0n6g-155`。
- `localCases/v4/clothing` 和 `localCases/v5/clothing` 已有历史案例 `frp-pad`、`frp-后台`，合计约 275 MB；它们不是本轮“上一案例”，不会在首例处理时擅自删除。本轮新增目录将使用源文件名（去掉 `.json`）以保持 nid 可追踪。
- 首例最新 V4 完整 JSON 下载成功：紧凑文件 1,285,427 bytes，SHA-256 `d38873190783ceaea0f0fda31ebe8c5e3f49bd7ff8548e44a92ea58dbfbc6297`，顶层完整包含 `case/server/stage`，根类型为 `ih5-case/data-server/ih5-stage`。
- 转换器已成功生成 V5：约 849.9 KB；诊断共 42 条、去重 42 条，全部进入 `jsfn` 自定义表达式兜底，`dropped=0`。控制台堆栈是可恢复的公式转换诊断，不代表整例转换失败；仍需做产物结构与 `jsfn` 编译审计。
- 42 条诊断分类：`findIndex` 21、逻辑或 `||` 12、逻辑与 `&&` 5、模板字符串 4；全部阶段均为 `custom-expr-fallback`。
- 初步产物审计：V4/V5 均为紧凑、可解析的完整三根 JSON；474/474 个节点 ID 保留；V5 为 870,278 bytes，SHA-256 `c2bc45e017096f6a38e7f70bfbf9d833d9625bc07e5b1b6cc692fac2ec44e321`，`server.props.v2=1`。
- 42/42 个 `jsfn` 均可编译、参数数匹配、无 `$refs/fParam/cbParams/_loop/$P_` 旧式引用残留。
- 首版动作审计把所有带 `bid` 的事件树块都当作动作，得到 108 个无同名 `ln`；该口径包含条件/控制块，不能据此判为动作丢失。下一步按真实动作块类型重新分类，避免误报。
- 重新分类后确认：107 个无同名 `ln` 的项全部是事件 `root` 块，根块本就不映射为 V5 动作行；其余 807/807 个非根事件块全部保留落点，不存在动作/条件/循环/状态块直接丢失。
- 项目全量测试 54/54 通过。
- 已在 V4 案例目录保存来源与数据库元数据 README，在 V5 案例目录保存转换结论 `conversion-report.md`。
- 用户已审阅首例并确认开始下一案例；第二例为 `PAD 量体_11064050_吴坤.json`（nid `11064050`），首例目录保留。
- 第二例数据库元数据：当前标题 `FRP-PAD`，`data_edt_ver=node_edt_ver=4.1`、`verDetail` 为空，确认为 V4.1；`ntype=1`，版本号 745，`work_id=cbt1eskpeu4lef3h2330-2921`，数据库当前作者刘土明。
- 第二例最新完整 V4 JSON 下载成功：紧凑文件 41,697,291 bytes，SHA-256 `6f447cbb17457d0b5f194129f5d7d8e164d23f02156eb57657f64095764deb5a`；顶层完整包含 `case/server/stage`，根类型为 `ih5-case/data-server/ih5-stage`。
- 第二例转换成功：V5 紧凑文件 30,192,242 bytes，SHA-256 `05f90837e1ee93f9682613998aab4f3463a7288a16696876aa04594297be9334`，`server.props.v2=1`。
- 诊断 2,722 次、去重 2,372 条，全部为 `custom-expr-fallback`，`dropped=0`。主要分类：`&&` 661、`||` 568、完整 JavaScript 557、unknown varType 319、模板字符串 126、match 126、findIndex 103、substring 82、SpreadElement 58。
- 结构审计通过：11,581/11,581 节点 ID 保留，28,041/28,041 个非根事件块有 V5 `ln` 落点。
- V5 含 2,589 个 `jsfn`：全部可编译、参数数全部匹配；发现 2 个旧式 `cbParams` 残留（`cbParams.style`、`cbParams.data`），需回查源上下文判断是否为源案例悬空引用。
- 首版服务审计只把 `type=data-service` 当作服务定义，得到 45 个“未解析”目标；该口径遗漏其他可调用服务类型，暂不作为服务缺失结论，需按节点 ID/服务注册规则重新核对。
- 服务目标复核完成：302 次 `runsvc` 涉及 106 个唯一目标，61 个为 `data-service`、45 个为 `data-sharedService`；106/106 都存在对应节点，服务目标缺失 0。
- 两个 `cbParams` 残留均来自 V4 源数据本身：动作分别位于普通 `data-funcGroup` 事件的条件/分组内，不在任何返回回调动作子树中，却直接引用“返回结果”的 `cbParams.style/data`。这是源案例悬空上下文引用，转换器用 `jsfn` 原样保留，未新增该问题。
- 项目全量测试 54/54 通过。
- 已为第二例写入 V4 来源 README 和 V5 `conversion-report.md`，报告包含两处源案例问题的精确节点/动作 BID。
- 用户已审阅第二例并确认继续；第三例为 `aps后台_11437420_吴坤.json`（nid `11437420`），前两例保留。
- 第三例数据库元数据：标题 `aps后台`、作者吴坤，`data_edt_ver=node_edt_ver=4.1`、`verDetail` 为空，确认为 V4.1；`ntype=1`、版本号 572、`work_id=cmac7tvmvgdh8t6hob7g-1029`。
- 第三例最新完整 V4 JSON 下载成功：紧凑文件 7,613,197 bytes，SHA-256 `13e68cb0a082e0a7fb503832c0aaa6a260a68cbf7253537e0be67a78bbee3a91`；顶层完整包含 `case/server/stage`，根类型为 `ih5-case/data-server/ih5-stage`。
- 第三例初次转换：V5 紧凑文件 6,135,382 bytes，SHA-256 `fd96b28f3df4a3cf3af7fbed71781c6a5dfe4e4361d565b5c4939fd439b14960`，`server.props.v2=1`。
- 初次诊断 654 次、去重 628 条，全部为 `custom-expr-fallback`，`dropped=0`。主要分类：`||` 431、unknown varType 82、完整 JavaScript 58、`&&` 42、`flat` 24。
- 结构审计通过：1,042/1,042 节点 ID 保留，5,300/5,300 个非根事件块保留落点。
- V5 含 637 个 `jsfn`，参数数全部匹配、无旧式引用残留；发现 1 个空字符串 `jsfn` 无法编译，需回查诊断与 V4 源位置。
- 服务审计初见 9 个唯一 `runsvc` 目标中 2 个无同 ID 节点，需核对是 V4 源案例已有悬空引用，还是转换丢失。
- 空 `jsfn` 已定位到后台服务 `cpw768sa3j50000371s0`（`getPackageTaskList获取装箱列表`）的返回动作 `cpwc0z3a3j5000038te0`，参数 `reason`。
- V4 源 `reason` 是未加引号的纯文本 `Formula { code: "db error", ... }`；转换器初次将其生成空 `jsfn`。`data` 的空 Formula 实际始终正确转为普通空 `val`。
- 两个无定义服务目标在 V4 源树中同样没有对应节点，因此不是转换器删除服务定义。
- `csykyxva3j500007q9ng` 的调用动作 `cx66absa3j50000n142g` 在 V4 中 `enable=false`，V5 正确保留为 `skip:true`，不会执行。
- `ck50xtqa3j50000eamgg` 由函数组 `cpabnyfa3j50000memq0`（获取category）的动作 `cpabnyfa3j50000memxg` 启用调用，但 V4/V5 均无该服务节点；这是源案例已有的活跃悬空服务引用，V5 运行到该分支时可能报“服务不存在”。
- 初次检查时项目全量测试 54/54 通过，但当时测试集未覆盖 `reason` 纯文本的完整服务返回场景。
- 第三例 V5 `conversion-report.md` 已在修复后更新为新产物结论。

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
- tov5parser 已创建并推送代码提交 `4c68e4f`（`main`）；VxEditor41 已创建并推送代码提交 `c0f215cbe`（`master`）。
- VxEditor41 提交只含 `src/utils/convertV4ToV5/formulaCode/ExprAstToString.js`；用户的 `.gitignore`、`src/stores/event.js` 和未跟踪组件目录均未进入提交。


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

## 2026-07-24 量体部门单元格高度差异

> 修正：本节后半基于 `VxEditor41-widgets/src/v5` 是线上 V5 组件实现的前提。用户确认该目录已废弃，V4/V5 共用 `src/components` 组件，因此关于 V5 layout 缺少 `ResizeObserver` 的根因判断无效。节点和案例行高事件链事实仍保留，根因在 Phase 31 重新定位。

## 2026-07-24 按共用组件链重新诊断

- `VxEditor5-widgets/src/components/ih5/core/rel/layoutRow/layoutRow.jsx` 与 4.x 对应实现一致；实际差异应位于播放器包装层、事件执行或变量依赖更新，不是两套 layout 组件。
- 实际 V5 播放器仍把共用 React 组件包装在运行时控制组件中。包装组件的 `shouldComponentUpdate()` 由运行时 `_up` 标志控制，组件 props 和循环项何时重新计算由 `player.js` 的依赖系统决定。
- 案例除测高布局行 `crqff6ma3j50000a6dw0.heightChange` 外，还有更直接的文本测高链：`crnjam2a3j50000gp5kg.valueChange` → 延时 0.1 秒 → 读取文本 `_boundHeight` → 再延时 0.1 秒 → 调用 `cvrgkvfa3j50000vq3tg` 更新行高。
- V5 转换结果完整保留了上述 `valueChange` AST、两次 `delaysMethod(0.1)` 和 `_boundHeight` 调用；因此不能只检查 layout 的 `heightChange`。
- Chrome 已成功连接 V5 页，但按全 DOM 文本扫描定位节点超时并导致浏览器执行会话重置。该方法对大案例不适用，后续改用已知 `.ih5-rel-text` / `.text_inner` CSS 类做窄范围读取。
- 线上 V4 “量体部门”文本节点的两个 `valueChange` 动作本身都带 `delay: 0.1`：`cvrhqfna3j50000vqf80`（日志）与 `cvrgnxqa3j50000vq4zg`（调用“行高更新”动作组）。所以 V5 AST 中的两次 `delaysMethod(0.1)` 是源案例延时语义的正常承接，不是转换器重复插入。
- V4 “行高更新”动作组会依次更新局部行高列表、计算最大值并回写全局 `ctmch3ca3j50000k5p6g`；继续寻找 V5 首个未触发或未传播更新的位置。
- 将直接转换产物与 `/Users/lianghuang/Downloads/case_12225413.json`（经 V5 编辑器保存）做语义差异比较，目标链路除随机 `ln/Rtn` 外，唯一稳定差异是编辑器把 `objArr_find` 规范化为 `arr_find`。
- 共用运行时 `sysFunc.js` 中 `objArr_find(value, fn)` 与 `arr_find(value, fn)` 实现完全相同，均直接执行 `value.find(fn)`；因此该差异不改变查找结果，尚不能解释行高不更新，需继续核查依赖收集或事件触发。
- `player-shared.js` 的 AST 编译器对 `sysutil` 是通用处理：统一生成 `$sys.util.<name>(...)`，没有针对 `objArr_find/arr_find` 的特殊依赖逻辑；`switchexp` 的四参数形式也确认是条件/值对序列，先前看到的空 `=` 是 else 条件占位，不是三元转换错误。
- 运行时 `Mi.fini` 会在动作结束后读取变更依赖并更新根/子引用；下一步需检查文本 `initialize/valueChange` 是否以当前循环实例触发，以及 `_boundHeight` 引用是否命中该实例。
- 共用组件确认：文本继承 `Ih5Base`，在 `componentDidMount` 触发 `onInitialize`；布局行在自身 mounted 时先测量并触发 `onHeightChange`，随后触发 `onInitialize`。React 子组件 mounted 先于父布局行，因此文本初始化测高与布局行首次测高的时序本身存在竞争，但两版本组件代码一致。
- V5 播放器把节点事件 props 绑定到当前编译 scope，并通过控制包装 `fi`/`Mi.fini` 传播依赖；尚未发现 V5 特有的 initialize 丢失。需要进一步检查共用组件中 `isV5` 分支、实际 DOM 尺寸和事件执行结果。
- 共用 `Ih5Base` 在 `config.current.ver===2` 时会增加 `processAdaptiveWH` 样式，因此同一套组件仍可能按版本分支；目标空高度会得到 `height: fit-content`，但该值本身应当允许内容撑开，不足以解释整行仍锁在 52。
- 更关键的调度差异位于 V5 播放器包装：`fi.shouldComponentUpdate(nextProps)` 只返回当前编译节点的 `_up` 标记。子文本绑定独立更新时，测高父布局行没有直接数据依赖，父包装不会更新，因而共用 `BaseLayout.componentDidUpdate()->getWH()` 不会被再次调用。V4 的宽更新路径会更广泛地触发组件树更新，案例依赖了这项隐式副作用。
- 本轮 Chrome 重新连接成功，但接管单个既有 V5 标签仍在 30 秒超时并重置会话；此前同类宽扫描/接管已多次失败，按不重复失败原则停止此浏览器路径。
- 默认行高初始化动作组 `crqfse5a3j50000a6en0` 会在量体列表请求/同步后，为新数据先写入 `行高=52` 和 `行高列表`，再 push 到全局 `ctmch3ca3j50000k5p6g`；V4/V5 均保留三处调用。
- 因此完整时序更明确：默认 52 行高列表建立后表格渲染；测高文本/布局行再回写真实高度。V5 若子文本更新不触发父测高行二次 update，便会长期停留在默认 52，这与页面现象吻合。
- 修正后的根因：不是两套组件差异，也不是目标公式/事件 AST 丢失；是同一套 React 组件在两套播放器调度中的更新粒度不同。V5 只更新依赖命中的子节点，测高父行 `crqff6ma3j50000a6dw0` 没有对文本值的直接依赖，故其 `BaseLayout.componentDidUpdate()->getWH()` 不再被子文本变化带动；默认 52 无法被后续真实高度覆盖。
- 最小修复位置应在 V5 播放器/编译调度或案例转换的显式依赖补偿层，而不是废弃的 `src/v5` 组件目录。运行时方案是让受控布局父行在子树提交后重新测高；转换兼容方案则需把这类“子文本 `_boundHeight` 驱动父行高度”的隐式 V4 关系转为显式更新触发，不能简单改成 `height:auto`，否则会破坏整行等高。

## 2026-07-24 剔除禁用 heightChange 后重查文本测高链

- 用户指出 `crqff6ma3j50000a6dw0.events.enable=false`；因此上一轮把该节点 `heightChange` 当作有效补偿入口是错误的，必须从执行链中剔除。
- `crqff...` 还位于 `cm1wxsqa3j500009jhk0`（`visible:false`）旧数据分支；当前可见分支的对应父行是 `d0dcr6ra3j5000080qtg`，其事件总开关同样为 false，所以两个父行的 `heightChange` 都必须从有效链中删除。
- 当前可见分支真正启用的自动测高入口是文本 `d0dcr6ra3j5000080r1g`（量体部门）与 `d0dcr6ra3j5000080rj0`（量体师）的 `initialize/valueChange`；两者读取自身 `_boundHeight()` 后调用 `cvrgkvfa3j50000vq3tg` 回写行高。
- 本地 V4/V5 精确核对：`crqff...events.enable=false`，文本 `crnjam...events.enable=true`，行高更新动作组 `cvrgkv...events.enable=true`；禁用判断无歧义。
- V4 生成代码揭示延时语义：同级带 `delay:0.1` 的动作分别用独立 `setTimeout(...,100)` 调度。`valueChange` 的日志与 `fireFuncGroup` 都在约 100ms 并发执行；当前 V5 AST 则是 `await delay(0.1) → 日志 → await delay(0.1) → fireFuncGroup`，实际调用被累计到约 200ms。`initialize` 只有第二个动作延时，V4/V5 都约 100ms 调用。
- `delaysMethod` 会稳定回调；`cvrgkv...` 内两个 `arrUpdate` 也无论匹配成功/失败都会调用回调，因此现有 `op:let` 不会因为无匹配而永久阻塞。问题更可能是延时后的测量值/作用域或调用时序，而不是 callback 不返回。
- 转换器当前确实对每个 `block.delay` 执行 `result.unshift(genActionDelay())`，所以同级动作被强制串行累计；这与 V4 独立 `setTimeout` 语义不等价，是确定的转换时序差异。
- `_boundHeight()` 本身共用且只返回 `ReactDOM.findDOMNode(this).getBoundingClientRect().height`，不存在 V4/V5 数值类型分支；行高初始数组结构也未发现转换差异。
- 通过只读数据库取得线上 V5 `nid=12225473` 的 `work_id=d9h1jjbc1t2c73ch029g-1`，再按 raw 文档从 `/work/load` 解码出编辑器实际 JSON；它与本地最新 `app.v5.json` 在上述可见文本事件、动作组和全局行高数组上没有动作、参数或绑定缺失。
- 编辑器实际 JSON 与本地产物在有效链上的唯一非随机差异是 `objArr_find → arr_find`；共享 `sysFunc.js` 中两者都直接执行 `value.find(fn)`，不是高度不更新的语义差异。
- V5 player 对 `callFuncGroup` 的 async 包装会在函数体完成后执行 `$cbParam(true, result)`；因此“行高动作组没有显式返回动作，所以调用永不结束”的假设也可排除。
- 目前唯一已证实但尚未闭环到 UI 症状的转换差异，是同级延时动作被串行累计。由于 `initialize` 仍会在约 100ms 执行同一行高动作组，必须继续通过实际运行值区分“文本事件未触发/实例作用域失效”与“行高数据已写但绑定未刷新”，不能再用禁用的父布局事件解释。

### 最终运行时闭环

- 用独立 Playwright 预置同一 `sessionStorage.session`，分别加载线上 V4/V5，并捕获案例自身日志；两页当前都成功取得 4 行相同数据。
- V5 中两个启用文本的 `initialize/valueChange` 确实执行，`_boundHeight()` 实测返回 49；但每次进入 `cvrgkvfa3j50000vq3tg` 时，“量体行高列表”日志都是 `[]`，所以按数据 ID 的 `arrUpdate` 匹配不到任何记录。
- V5 随后才输出“进入行高处理”，由 `crqfse5a3j50000a6en0` 创建 4 条默认高度 52 的记录；此后文本值没有再次变化，已错过的测高不会重放，最终行高停在 52。
- V4 的顺序相反：先输出“进入行高处理”并建立 4 条记录，随后文本 `valueChange` 才以 49（内容更长时会大于 52）调用行高更新；此时 `arrUpdate` 有可匹配行，能够正常写回最大高度。
- 首个分叉发生在列表加载动作组 `ccnwpq2a3j50000pe3yg`：设置主列表后调用 `crn0n2wa3j50000ag9tg` 获取详细信息，再调用 `crqfse5a3j50000a6en0` 初始化行高。
- `crn0n2...` 的 V4 回调树在 `crn16z3a3j50000agang` 返回后，同级发起 4 个独立详细信息动作组；它们各自只有空 status 占位，V4 不等待它们完成，外层很快继续初始化行高。
- 转成 V5 后，这 4 个动作因为组件方法声明了 `action.callback=true`，全部生成 `op:"let"` 并被串行 `await`；外层必须等用户、部门、公司、角色四个请求依次完成才初始化行高。文本初始化的 0.1 秒计时先到，因而在空数组上执行测高更新。
- 因此最终根因不是禁用的 `heightChange`，也不是 `_boundHeight`、循环 scope 或 UI 刷新丢失，而是转换器把“具备回调能力但回调分支为空、V4 不承接返回值”的动作强制改成了 V5 阻塞式 `await`，改变了外层执行时序。
- 转换器修复应区分“方法支持 callback”和“该动作实例实际消费 callback”：空 status 占位且返回值未被后续公式引用时，不应生成阻塞式 `let/await`；只有存在有效回调动作或确实引用 `${bid}Rtn` 时才等待。

- V4/V5 的“量体部门”表头节点 `ch4bzxqa3j50000ykwz0` DOM 尺寸与计算样式一致，列宽和表头模块不是差异来源。
- 当前表格正文的主要“量体部门”文本节点为 `cm21jqja3j5000036m3g`、`crnjam2a3j50000gp5kg`，另一套同构表格使用 `d0dcr6ra3j5000080r10/r1g` 等节点。文本属性均为宽 100%、空高度、12px 字号、15px 行高（fontSize 12 + lineHeight 3），V4/V5 保持一致。
- 案例的实际自适应方案不是让 52px 单元格直接按文本撑开，而是用自动高度布局行 `crqff6ma3j50000a6dw0`（另一套为 `d0dcr6ra3j5000080qtg`）测量内容高度。
- 该布局行的 `heightChange` 事件读取 `param.currentHeight`，并通过 `arrUpdate` 写入 `ctmch3ca3j50000k5p6g`（“量体行高列表”）。`crqfgtka3j50000a6e50`（“行高”）再按当前数据 ID 读取记录中的行高，找不到时回退 52；14 个正文单元格的 `height` 都绑定这个值。
- `crqfse5a3j50000a6en0`（“行高处理”）会先为数据行补齐默认 52 的记录，随后依赖测高行的 `heightChange` 把大于当前值的高度回写。上述节点、公式和事件动作在 V5 中均已转换且语义完整。
- V5 runtime 的 `src/v5/components/layout/baseLayout.web.ext.ts` 没有观察元素内容尺寸变化：只在 window resize、layout 自身 `updated()` 和 mounted 时读取 `offsetHeight`。文本值、条件节点或循环子项稍后完成渲染时，只会更新子组件，不保证测高布局行本身进入 `updated()`，因此新增换行没有触发第二次 `heightChange`。
- V4 的 `src/components/ih5/base/baseLayout/baseLayout.jsx` 会在 React `componentDidUpdate()` 中调用 `getWH()`；案例实际依赖了旧架构中祖先随子树更新而重测的副作用。V5 独立组件更新后失去这项隐式行为。
- 因此故障链是：量体部门文本变长并换行 → 测高行 DOM 实际内容高度变化但 V5 未重测 → `heightChange` 不触发 → 量体行高列表仍为 52 → 所有列继续使用 52px，视觉上内容溢出。
- 正确修复点在 V5 layout runtime：在 mounted 后对 `webCom` 使用 `ResizeObserver`，回调中复用 `_updateWidthHeight()`，在卸载时 disconnect；保留现有去重比较即可避免事件循环。转换器不应把案例中的 52px 或 height 绑定改写为 auto，否则会破坏整行所有列等高的业务设计。

## 2026-07-27 量体部门弹窗树回调参数承接异常

- 当前线上 V5 预览为 `192cX76o`；与 V4 `wt5RnwSK@10000590` 独立加载后，两侧“选择部门”树的初始状态一致，排除初始化展开状态和部门数据差异。
- 活跃小模块为 `chpq97ca3j50000y9370`（`FRP_选择弹窗_部门_多选`），已设置 `modEdtVer:2`。树节点 `chpq9t7a3j50000jzpp0` 的行模板是 `chpq9t7a3j50000jzppg`。
- 树展开动作 BID 为 `chpq9t7a3j50000jzq00`，收起动作 BID 为 `chpq9t7a3j50000jzq20`；二者依赖 V4 树特殊引用 `v1` 作为 `openNode/closeNode` 的 index。
- 转换器按既有协议将 V4 `v0/v1/v2` 转为 V5 `arg0/arg1/arg2`。但 V5 小模块实例的生成模板没有把这些引用正确绑定到共享 TreeFor 回调提供的 `[currentLevel,index,openType]`。
- 运行时证据：共享组件对顶层传入 `currentLevel=0,index=0`，对“工程部”传入 `currentLevel=1,index=15`；V4 行缩进为 `6px/24px`，V5 却为 `60px/618px`。
- 交互证据：V4 展开“工程部”后出现“老厂工程部/新厂工程部”，开放节点包含 index 0 和 15；V5 强制点击同一加号后仍只有 index 0，深层节点没有打开。
- 因此 `arg0` 的错误使深层控件移出弹窗，`arg1` 的错误使展开/收起动作不能操作正确节点。首个错误发生在行模板绑定和动作参数求值阶段，早于树组件状态变更。
- 根因边界：部门服务、层级数据、共享树组件和 `modEdtVer` 均正常；问题位于转换后的树特殊参数引用与 V5 小模块 template/clone scope 运行时解析之间。不能通过修改部门数据、调整固定 padding 或简单偏移 arg 序号解决。
- 优先修复 V5 运行时对模块实例内 `ref:["argN", forContainerId]` 的 clone-aware 作用域绑定；若必须由转换器兼容，应先明确运行时可稳定承接的树回调引用结构，并为 `data-module-defs` 内的 v0/v1/v2 增加回归测试。

## 2026-07-28 Phase 34 定位复核

- 用户修改 `chpq97ca3j50000y9370/chpq9t7a3j50000jzppg` 的静态左内边距后预览无变化，因此重新从 V5 `192cX76o` 的实际 DOM 反查。
- 表格中的点击入口不是量体部门文本，而是单元格右侧放大镜（约 `x=798,y=173`）；点击后出现的树行 DOM class 明确包含 `chpq9t7a3j50000jzppg`。
- 该行的 React props 同时显示 `customClass=chpq9t7a3j50000jzppg`、`__events=chpq9t7a3j50000jzppg,tap`，上层模块实例 `modId=chpvc70a3j50000byak0`，`classId=C_chpq97ca3j50000y937g`。
- 本地 JSON 对应模块定义节点正是 `stage.classes.11`、ID `chpq97ca3j50000y9370`、名称 `FRP_选择弹窗_部门_多选`，因此 Phase 34 的模块与行定位正确。
- 用户的改动未体现在预览，是因为 `props.paddingLeft` 只是静态默认值；该行还有启用的 `binds.paddingLeft=(6+当前层级*18)+'px'`。V5 运行时优先计算绑定并把结果写回 props，覆盖静态左内边距。
- 运行时顶层 TreeItem 仍明确为 `currentLevel=0,index=0`，但行的最终 `paddingLeft=60px`；这继续支持树回调 `arg0` 承接异常的原判断，而不是模块误定位。

## 2026-07-28 删除缩进绑定后的运行结果

- 最新 V5 `192cX76o` 已加载用户修改：顶层“乔治白总公司”行的 DOM `padding-left` 从 60px 变为 6px，说明预览没有继续使用旧缓存，目标模块和行均正确。
- 展开顶层后，所有 `level=1` 子部门的行也都是固定 6px；正确结果应为 24px。因此当前视觉仍不正确，是固定值无法区分树层级，不是修改未生效。
- 该实验进一步隔离出两项问题：动态缩进必须恢复“6 + 层级×18”，而展开/收起还需独立验证 `v1/arg1` 节点序号。
- 继续实测后，“工程部”能够正常展开出“老厂工程部/新厂工程部”，再次点击减号也能正常收起；因此 `arg1`、`openNode/closeNode` 和相关动作 BID 均正常。Phase 34 关于 `arg1` 承接失败的判断撤销。
- 原公式是 `(6+$refs.v0_chpq9t7a3j50000jzpp0*18)+'px'`。转换结果错误地把内部数值加法拍平为 `concat(6, arg0*18, "px")`。
- V5 的 `concat` 通过数组 `join('')` 执行。因此顶层 `arg0=0` 得到 `"6"+"0"+"px" = "60px"`，一级 `arg0=1` 得到 `"6"+"18"+"px" = "618px"`。这些值反而证明 `arg0/currentLevel` 正确。
- 根因位于 `V4FormulaCodeConverter.genStringConcatAST()`：处理外层字符串拼接时，对左右子树传入 `identity:"stringConcat"`，从而强制把左侧本应保持的数值 `+` 也转成并拍平到 concat。
- 正确 AST 应保留两层语义：外层 `concat([ plus(6, multiply(arg0,18)), "px" ])`。转换器只能拍平真正的字符串拼接子树，不能拍平不含字符串字面量的数值加法子树。

## 2026-07-28 字符串拼接转换修复

- `genStringConcatAST()` 不再给每个子树强制传入 `identity:"stringConcat"`；子树先按自身语义转换，只有结果本身已经是 concat 时才拍平。
- 该最小改动使 `(6+level*18)+'px'` 保留内部 `op:'+'`，同时 `'prefix-'+value+'-suffix'` 仍保持一个扁平 concat。
- 回归测试先确认旧实现以 3 个 concat 参数失败，再在修复后通过；定向测试 11/11、项目全量测试 47/47 通过。
- frp-pad 重转后的目标绑定精确为 `concat([ +(6, *(arg0,18)), "px" ])`，不再生成 `concat([6, *(arg0,18), "px"])`。
- 新 `localCases/v5/frp-pad/app.v5.json` 为 29,973,020 bytes、0 换行，SHA-256 `c773a2fc2d069ef99467836e40ef8ab1892f5826f349f96c6cb9b65f40340e96`。

## 2026-07-28 选择部门弹窗首次加载列表滞后

- 最新 V5 预览 `hmdKxyBj` 的全新隔离页中：约 0.75 秒弹窗出现，约 1.75 秒显示“加载成功”但树根节点仍为空，约 3.75 秒才显示“乔治白总公司”等部门。该结论只描述全新隔离实例，不能推断用户现有标签页最终一定恢复。
- 对照 V4 `wt5RnwSK@10000590`：约 1.75 秒显示“加载成功”时，部门树已经同时出现。两版本使用相同接口和完整数据。
- 小模块为 `chpq97ca3j50000y9370`（`FRP_选择弹窗_部门_多选`），初始化动作组为 `chpq9t7a3j50000jzqyg`，部门服务为 `chpq9nya3j50000jzp50`。服务实际返回 HTTP 200、`isSuccess:true` 和完整 `department` 数组，排除服务不存在、返回字段丢失及树绑定永久失效。
- 成功分支先调用 `chpqsw7a3j50000jzy00`（toast），再调用 `chpqsw7a3j50000jzy0g`（初始化数据处理）。toast 动作组 `chpq9t7a3j50000jzrcg` 的成功分支包含 `delaysMethod(1.5)`，用于延时隐藏提示。
- V4 源动作 `chpqsw7a3j50000jzy00` 虽声明 `action.callback=true`，但 `children=[]`，没有 status 回调承接；V4 因而发起 toast 后立即执行同级的数据处理动作。`chpqsw7a3j50000jzy0g` 有 status child，才需要等待其结果。
- 当前转换器只检查 `action.callback`，把两者都转成 `op:"let"`。因此 V5 会等待 toast 动作组连同 1.5 秒延时完整结束，再开始整理和赋值部门数据，造成“加载成功但内容为空”的首开窗口。
- 最小修复方向：动作具备 callback 能力但实例没有有效 status child、后续也不消费返回值时，应转换为非阻塞 `get`；仅存在有效回调承接或返回值依赖时才生成 `let/await`。这与此前发现的“callback 能力不等于实例实际消费 callback”属于同一类转换语义问题。

### 持续空白实例的反证

- 用户反馈 3.75 秒后仍为空后，直接读取其当前 Chrome 页：弹窗可见，文本只有“选择部门/选择/已选/确定”，`.chpq9t7a3j50000jzppg` 可见树行数量为 0，成功 toast 已不可见。该实例确实不是单纯等待不足。
- 随后用同一 session、同一 V5 地址对四条表格数据分别创建全新页面并首次点击，四条都在 8 秒内显示完整根部门，控制台没有 page error；重复快速点击同一行也能正常显示。
- 因而目前存在两层问题：转换后的 toast await 确定造成约 1.5 秒额外空白；用户当前标签页另有一次性调用异常或状态提交失败，导致空白持续。后者不是仅凭静态 AST 就能等同于前者。
- V5 成功分支在设置 `部门数据` 后还会处理“已选部门”，外层模块调用结束后才进入后续房间登记。若后半段 await 不返回，V5 的动作完成/依赖刷新阶段不会走完，使已经写入变量的数据也不能提交到树 UI。

### 第二个错误等待：生成 path

- `部门数据.setValue` 之后立即调用 `cs3bb9xa3j50000e7fr0`，目标动作组 `cs3b1dxa3j50000e7b5g` 名称为“生成path”。
- V4 源动作 `cs3bb9xa3j50000e7fr0` 与成功 toast 一样：`action.callback=true`，但 `children=[]`，没有完成/status 子块。V4 不等待它，后面的已选状态更新和模块结束可以立即继续。
- V5 转换结果却是 `op:"let"`。而“生成path”内部会遍历已选部门，并等待递归动作组 `cs3b1dxa3j50000e7bb0` 返回；所以外层初始化是否结束，被错误地绑定到了这条本来应后台并行的 path 计算上。
- 修正：V5 动作组即使没有显式返回动作，也会在函数体执行结束时自动完成回调；`op:"let"` 不等于永久不返回。不能仅凭 V4 `children=[]` 就把本次永久空白归因于 callback。
- 展开 `生成path` 及 `单部门path` 后，没有服务、延时、动画或递归自调用；内部只有同步条件、数组读写和显式 return。已选部门更新所用 `arrUpdate` 在共享实现中也会在命中和未命中两条分支都调用 callback。
- 用 5 个已选部门的订单、切换“全部”后立即点击等更重输入仍可正常输出 path、登记房间并显示树。因此当前证据不支持“生成 path 必然阻塞”的结论。
- 当前永久空白实例需要按运行日志继续二分：若没有输出 `===The value of path===`，说明当前订单数据使同步 path 逻辑异常；若已输出 `path` 和“创建加入房间”但树仍为空，则动作已经完成，问题转为 V5 当前模块实例的依赖更新/重渲染未提交。
- 用户授权任意点一行后，隔离页实测 `D.043847`：模块完整输出 `path` 和“创建加入房间3513”，树行由 0 变为 9。`D.043886` 的 5 个已选部门也完整结束并显示树。
- 因此现有转换产物中没有可稳定复现的内部阻塞；用户旧 Chrome 标签的永久空白属于该运行实例的一次性异常状态。已对该标签发出 reload，若刷新后任意行恢复正常，则可确认不是静态转换缺陷；若刷新后仍空，必须从该刷新后实例抓运行日志，不能再用旧实例或隔离页推断。

## 2026-07-28 首开空白、二次打开正常的最终根因

- 用户确认刷新后任意量体部门单元格第一次打开仍为空，关闭后第二次打开立即显示；这排除了旧标签一次性卡死。
- 独立 Playwright 对同一模块完成首开与二开对照：第一次打开请求 `chpq9nya3j50000jzp50` 一次；关闭后第二次打开，请求累计仍为一次，说明第二次没有重新请求部门服务。
- 第二次能直接显示 9 条根部门，只可能来自模块内部第一次已经写入的 `chpq9t7a3j50000jzrbg`（“部门数据”）。因此第一次并非服务失败、callback 不回或 path 阻塞，数据已经进入模块。
- 模块在打开弹窗后才异步请求部门，并通过 BID `chpqsw7a3j50000jzy1g` 调用 `部门数据.setValue`。此时 tree-for `chpq9t7a3j50000jzpp0` 已以空数组挂载；用户当前 Chrome 中该变量变化没有可靠驱动 tree-for 重求 `binds.value`。
- 关闭并再次打开会触发弹窗 show/render；树绑定重新求值时读到第一次保留的非空部门数组，因此立即显示，且无需再次请求服务。
- 修正后的根因是 V5 异步变量更新到已挂载小模块 UI 的刷新缺失，不是动作组 callback 或内部逻辑阻塞。
- 最小转换兼容方案：在 `chpqsw7a3j50000jzy1g` 的变量 `setValue` 之后增加一次独立的 `delaysMethod` 动作边界，沿用项目已有“变量组件延时方法后补刷新延时”的兼容思路，促使变量依赖先提交并驱动 tree-for 重渲染。不要改 `生成path`、`arrUpdate` 或通用动作组返回规则。

## 2026-07-28 “全部”第二页空部门行精确复现

- 独立 Playwright 预置 session 后打开 V5 `hmdKxyBj`，顶部“全部”加载为 1901 条、191 页；分页 DOM 可直接点击数字 `2`。
- 第二页第一行订单号为 `D.043882`，人数/件数均为 `0`，量体部门文本区域为空，但搜索图标正常存在；图标资源为 `3f226ed23a46a8e097df839eda861208_1375.svg`，位置约 `x=792,y=165.5`。
- 该行与用户描述完全一致，后续首次/二次打开对照均固定使用 `D.043882`，不再用有已选部门的普通行代替。
- 首次打开 `D.043882` 后等待 10 秒，弹窗始终只有“选择部门/选择/已选/确定”，可见树行 `.chpq9t7a3j50000jzppg` 为 0；这次稳定复现了用户所见，并非等待时间不足。
- 部门服务仅请求 1 次，`chpq9nya3j50000jzp50` 返回 HTTP 200、`isSuccess:true` 和完整 `department` 数组；服务数据没有缺失。
- 业务日志确认当前订单 `数据ID=3543 / invoiceCode=D.043882 / measureUserDepartment=null`，“已选量体部门”为 `[]`；之后仍输出“创建加入房间3543”“登记成功”“创建成功”，说明动作组完整结束，没有 callback 或内部阻塞。
- 空选择分支没有输出 `path`，与 V4 逻辑中 `已选部门.length===0` 时跳过“生成 path”和后续选中项 `arrUpdate` 一致。
- 关闭后第二次打开同一行，部门服务请求总数仍为 1，但树立即显示 9 个根部门。由此确认第一次已把部门数组写入模块变量，只是首次挂载的 tree-for 没有在这次 `setValue` 后刷新；二次 show/render 读取到了缓存数据。
- 同一版本的非空部门对照 `D.043886 / 数据ID=3546`：首次打开同样只请求部门服务 1 次，但“已选量体部门”有 5 项，随后输出 5 项 `path`，并在第一次打开就显示 9 个根部门。
- 转换后的初始化 AST 与 V4 源代码都显示：`chpqsw7a3j50000jzy1g` 执行 `部门数据.setValue` 后，只有 `已选部门.length>0` 才会调用“生成 path”，并循环执行 `chpvtt3a3j50000k065g` 对同一个“部门数据”变量做 `arrUpdate(status=1)`；空部门行完全跳过这段。
- `objArr.arrUpdate()` 命中时会克隆当前数组并再次 `_sys.set(node,id,'value',_arr)`；这正是非空行相对空行多出的同变量二次写入。它补触发了 tree-for 依赖刷新，所以非空行首次打开正常。
- V4 对同一个 `D.043882` 进行全新加载、“全部”→第二页→首次打开，5 秒内直接显示相同的 9 个根部门；服务同样只请求 1 次、已选部门同样为 `[]`。因此差异不是业务数据或条件分支，而是 V5 对异步 `objArr.setValue` 的 UI 依赖提交行为。
- 转换器已有“带 V4 延时的变量方法后插入零时长 `delaysMethod`”兼容逻辑，但本动作没有 `block.delay`，所以 `chpqsw7a3j50000jzy1g` 后没有刷新边界。
- 本案例最小修复点是给该异步回调内的 `data-obj-arr.setValue` 补一次零时长 `delaysMethod`，让 tree-for 在后续空选择条件结束前消费新值；不能依赖 `arrUpdate` 偶然补刷新。
- 通用规则不能粗暴扩展为“所有 status 回调内变量方法都加延时”：frp-pad 有 2,874 个此类动作，其中 569 个是 `data-obj-arr.setValue`。更稳妥的转换条件应至少限定为：异步回调中的数据变量写方法，且该变量直接被可见循环/树组件属性绑定；本案变量明确通过 `_cited.props` 绑定 `ih5-tree-for chpq9t7a3j50000jzpp0`。实施前需补合成回归，验证空选择路径和非空路径都只产生一次必要让步。

## 2026-07-28 Phase 44 实现边界

- 转换遍历当前没有显式父块参数，但 `convertActionCb()` 是所有 V4 status 子树的统一入口；可在转换该子树期间维护同步的 callback depth，而不改动所有条件/循环/分组方法签名。
- 目标动作 `chpqsw7a3j50000jzy1g` 位于两层 status 回调内，方法为 `data-obj-arr.setValue`，目标变量 `_cited.props` 直接包含 `ih5-tree-for chpq9t7a3j50000jzpp0` 和 `data-for chpqf54a3j50000jztfg`。
- 初版把 `ih5-tree-for/data-for/ih5-grid-for` 都纳入集合渲染组件；真实重转后发现会给 223 个原本无延时的 `setValue` 新增让步，范围过大。
- 当前运行证据只确认 `ih5-tree-for` 的首挂载刷新缺失，因此最终规则收窄为直接绑定 `ih5-tree-for` 的异步 `setValue`；普通 `data-for`、`ih5-grid-for` 和 `arrUpdate` 均不改变时序。
- 实现采用转换器实例级 `asyncCallbackDepth`：进入 `convertActionCb()` 的 status 子树时加一，`finally` 中恢复，既能覆盖嵌套回调，也不会把异步上下文泄漏到后续兄弟动作。
- 插入条件最终固定为：动作启用、当前处于异步回调、方法名为 `setValue`、目标属于变量组件类型，并且目标变量 `_cited.props` 至少直接引用一个 `ih5-tree-for`。已有 V4 `block.delay` 的兼容规则保持原样。
- frp-pad 最终命中 35 个动作。目标 BID `chpqsw7a3j50000jzy1g` 后生成一次零时长 `delaysMethod`，而对照 `chpvtt3a3j50000k065g` 的 `arrUpdate` 不命中，符合空部门行与非空部门行的差异证据。
- 重转产物保持压缩格式，目标 AST、影响数量和全部 2,589 个 jsfn 均通过审计；项目全量测试 48/48 通过。

## 2026-07-28 Phase 45 待验证假设

- `asyncCallbackDepth` 是转换器用于限定影响面的代理条件；它来自目标 BID 的结构特征，并非已经从 V5 运行时证明的必要条件。
- 至少需要区分三种可能根因：状态写入保留了数组引用导致订阅比较不触发、tree-for 只在某个批处理/动作完成边界更新、以及模块首次挂载时订阅建立晚于异步赋值。
- `arrUpdate` 会克隆数组后再次 `_sys.set`，它能补刷新既可能因为新引用，也可能因为第二次写入落在订阅建立后的时刻；必须从运行时代码判定，不能仅由页面现象推导。
- 本机存在独立运行时仓库 `/Users/lianghuang/Desktop/ivx_repos/VxWidgets-player`；其 `sys2.js` 同时包含 React 包装组件和 `_sys.set(self,id,name,value)`，`sys2_core.js` 包含 `setupProps/rctUpdate`，是当前最直接的 V5 状态与渲染链候选源码。
- 初步定位到旧 `sys.js` 也有一套 `set(node,id,name,value)` 和引用目标 `forceUpdate()`；需要结合预览页实际入口判断 V5 使用 `sys2` 还是旧 `sys`，不能混用两套机制下结论。
- 当前 V5 预览 `hmdKxyBj` 的 HTML 实际加载 `//file3.ih5.cn/v35/v41player/20230911190146/player.js` 与 `//file3.ih5.cn/v35/widgets/20260714182742/widgets.js`；后续需从这两个精确版本核对，而不是假设本机仓库 HEAD 就是线上版本。
- 本机 `sys2_core.js` 的状态链已显示：`setVar()` 调用 `changeProp()` 立即重算依赖并用 `markDirty()` 删除 React 元素缓存；真正调用 `setState()` 的是 `evFini()`。`sys2.fini()`、`asyncEnd()` 都能进入 `evFini()`，所以问题焦点是结束/提交边界是否在正确模块实例上执行，而不只是数组引用比较。
- 已下载线上精确构建：player 1,591,667 bytes，widgets 12,759,919 bytes。widgets 注册表确认 `data-obj-arr` 方法模块 ID 为 `75181`，`ih5-tree-for` React 组件索引为 198；`delaysMethod` 也位于同一线上 widgets 包。
- 线上 widgets 是单行压缩且尾部无 source map 注释，需要按 webpack 模块边界提取目标模块；不能靠普通行号检索理解实现。
- 线上 `data-obj-arr` 模块 75181 已精确提取：`setValue` 先用 klona 深拷贝传入值，再调用公共 `dataVar_setPathValue(e,t,r,clonedValue,path)`；因此目标写入不是简单复用服务返回数组引用。
- 同模块的 `arrUpdate` 也先克隆当前数组，命中后再 `e.set(...,'value', clonedArray)`；它与 `setValue` 的主要差异不是“一个新引用、一个旧引用”，数组引用比较假设基本排除。
- 线上 `delaysMethod` 明确是 `setTimeout(callback, 1000 * time)`；当 time 缺失/≤0 时仍进入 `setTimeout(...,0)`，它提供的是新的宏任务与异步完成回调，而不是某个树组件专用刷新 API。
- 线上压缩运行时代码可与本机 `dartIvx2.js + v6core.js` 逐段对应；当前 V5 React 模块实际走的是这套 `Sn`/V6 runtime，不是最初看的 `sys2_core` 版本。后续结论以 V6 链为准。
- V6 `setVar()` 会立即执行 `changeProp()` 和 `markDirty()`，并返回根节点是否已失去元素缓存；`sys.set()` 只调用 `setVar()`，自身不提交 React 更新。
- V6 `sys.fini()` 才读取 `changed()` 结果并对模块根执行 `setState()`，同时更新模板/外部 ref；`callx/funcx` 的 flag bit 2 可在调用下一动作前先 `fini`。因此“写值”和“UI 提交”在架构上确实分离。
- 这套 V6 runtime 的 `asyncStart` 是空函数，文件末尾把 `asyncEnd` 指向 `fini`；异步结束可成为刷新边界，但“位于异步回调内”本身并不是 `setValue` 是否标脏的必要条件。
- 线上 V6 `sys.callx/funcx` 的 flag 语义已确认：bit 1 表示等待 callback，bit 2 表示在开始该调用前先 `fini`；`checkAsync()` 直接从组件编译映射的 `as[method]` 读取该数值。
- 同步组件方法会编译成普通 `$sys.func/$sys.call`，连续写值只累积 dirty；异步方法会编译成 `await $sys.funcx/callx(...)`。因此在 `setValue` 后插入 `delaysMethod`，真正产生刷新的机制很可能是 delay 的异步 flag 在调用前执行一次 `fini`，而不是 setTimeout 回调本身。
- 旧 V4 callback 代码会在每个 callback 开头 `asyncStart`、结尾 `asyncEnd/fini`；V5 AST 编译后改由 async method flags 和事件函数尾部 `fini` 控制提交。两种架构的刷新边界并不等价。
- `ivxMap.txt` 中编辑器方法元数据不是直接保存编译器的 `as` 表，而是 `map.methods` 的数组式定义；需要从方法 callback/async 元数据或线上组件编译 map 还原 `setValue` 与 `delaysMethod` 的最终 flag。
- `genmap.js` 给出了精确规则：method 有 `callback` 则 `as |= 1`，有 `preSync` 则 `as |= 2`。本案 `setValue` 无 callback/preSync，flag=0；`delaysMethod` 有 callback、无 preSync，flag=1。
- V6 `funcx(flag=1)` 启动异步方法后，如果 callback 没有同步发生，会立即调用 `f.fini()` 再等待 Promise；因此零延时动作的刷新效果发生在 `setTimeout` 启动之后、timeout 回调之前。它确实是在强制提交此前 `setValue` 累积的 dirty。
- 这也证明 `asyncCallbackDepth` 不是运行时刷新条件：任何执行路径中，只要同步 `setValue` 后在事件尾 `fini` 前需要 UI 立即可见，都可能受同类提交时机影响。
- V6 `markDirty()` 会清除当前节点到根/模板边界的 `el` 缓存；`changed()` 以根 `el` 是否为空决定模块 `setState`，并返回模板局部更新 key。说明变量绑定依赖被重算后，只要随后对正确模块执行 `fini`，tree-for 理论上应刷新。
- 因此“异步 callback 导致 setValue 不标脏”可以排除；更精确的问题是目标路径中 dirty 在何时、由哪个 `$self` 对应的模块实例消费，以及事件尾是否实际执行到 `fini`。
- 目标 `setValue` 位于云端小模块 `chpq97ca3j50000y9370 / FRP_选择弹窗_部门_多选` 的动作组 `chpq9t7a3j50000jzqyg / 初始化` 内；转换后的 AST 中它处在服务/数据处理的嵌套 `let` 成功分支。
- 当前兼容动作精确插在目标 `setValue` 与“已选部门是否为空”的 switch 之间；空部门路径由此在直接结束分支前新增一次 `let delaysMethod`，非空路径原本还会继续执行 `arrUpdate`。
- 节点 `props._code/code` 仍是 V4 旧代码文本，V5 运行依赖 `events.list[].ast` 在线编译；判断运行时行为必须以 AST 编译结果为准，不能用该旧文本推演。
- V5 AST 语义中 `op:'get'` 调用方法时 flags=0，目标 `setValue` 因而是同步 `$sys.func`；`op:'let'` 会以 flags=1 编译其方法调用，新增 delay 因而成为异步等待调用。这个差异与运行时 `func/funcx` 的提交边界完全吻合。
- 仓库中的通用 `ast2js.js` 输出 `$sys.func/$sys.afunc`，但线上 player 的 `ivxCvt` 会进一步/独立生成 `$sys.funcx/callx`；要得到预览页的精确代码，应调用实际 `ivxCvt`，不能只看编辑器辅助生成器。
- 本机 `ivxCvt.js` 可在 Node 中直接 `require`，导出 `convert(src, widgetsMapJson, paramJson, isApp)`；`wpLoader.js` 是调用示例。可以用与线上同源编译器生成目标模块代码，不需要继续猜测压缩产物。
- `ivxCvt.convert` 的 `src` 是 `*.ivx.vue` 文本，另需构建目录里的 `libs/widgets.json` 与 `src/case.json`；当前独立 `VxWidgets-player` 检出不含这两个生成资产，不能直接用 app.v5.json 调该 API。
- 项目本身未安装 Playwright，但 Codex workspace dependency bundle 提供浏览器自动化包；可用其 Node/package 路径启动独立 Chromium，抓取预览页实际返回的 app/module 资源。
- 以本机 Chrome 作为 Playwright executable 后，V5 预览可正常加载。对所有 text/json/js/octet-stream 响应扫描三个目标 ID 均未命中，说明线上运行负载可能已把节点 ID编译/映射、压缩或通过未扫描的传输形式加载，不能仅靠原始响应字符串定位。
- 预览 HTML 明确给出 work 资源：`//file3.ih5.cn/v35/works/d9k1ngjc1t2c73ch039g-sticky?1785207872`，`vxConfig.ver=2`。该资源为 2,127,456-byte 二进制数据，直接字符串扫描无目标 ID，需通过 player 的解码路径或页面内存读取。
- `widgets.js` 通过内部 `he.run(Uint8Array)` 解码 work 二进制并挂载 React；公开的 `window.VxLoadTree` 只接收已解码文本，不直接暴露解码结果。
- 目标小模块弹窗根组件有稳定 DOM class `chpq9t7a3j50000jzpb0`，可从该元素的 React fiber 向上找到模块实例、`_rc` 与 `_sf`，直接读取内存中的编译函数。
- 初始页面中目标 class 数量为 0，说明选择部门模块/弹窗是点击时才挂载，不是单纯 `display:none`；必须先按业务路径打开弹窗再读取 fiber。
- 最新线上 `hmdKxyBj` 按“全部 → 第二页 → D.043882 首行搜索”首次打开已能显示 10 个根节点；React fiber 内同时读到“部门数据”变量、tree-for 绑定值和 tree-for 实际 value 均为同一个 539 项数组，说明当前线上负载已包含/等效于刷新兼容，数据引用与树展开本身无异常。
- V5 普通 AST 事件编译器会把事件体包在 async 函数中，并在函数末尾执行 `$sys.fini($self)`；所以普通同步 `setValue` 会先标脏，随后在事件结束时可靠提交 React 更新。
- 小模块动作组 `callFuncGroup` 是例外：编译器生成的 `$code().then(...callback...)` 没有尾部 `fini`；模块 `modCall()` 只在启动动作组后立即执行一次 `sys.fini(c)`。因此动作组在第一个 await 之前的同步写入会被这次立即 fini 消费，而 await/服务 callback 恢复后的写入发生在这次 fini 之后，动作组完成时又没有第二次 fini，于是出现“变量已变、UI 未提交”。
- 零时长 `delaysMethod` 的 flag=1。`funcx()` 启动它并发现 callback 未同步返回时，会立刻执行 `f.fini()`，正好消费此前 `setValue` 留下的 dirty；是否等待 0ms 不是关键。
- frp-pad 中直接绑定 tree-for 的 `setValue` 共 48 个：13 个不在 status callback 内，35 个在 callback 内。13 个同步写入没有该类刷新缺失，符合“启动后的立即 fini/普通事件尾 fini 可提交”的运行时机制。
- 当前 35 个兼容命中中，31 个属于 `data-funcGroup`，4 个属于普通 `ih5-input` 的 input/blur 事件。后 4 个普通事件本来就有事件尾 `fini`，从运行时根因看属于过度插入。
- 最终判断：不应把规则扩大为所有 `setValue`，也不应移除“异步 callback”限制；更准确的条件应继续限定“异步边界之后”，并进一步限定为小模块/动作组 `callFuncGroup` 这类缺少完成态 `fini` 的执行上下文。长期根治点应是运行时在动作组 Promise 完成后对对应模块再执行一次 `fini`；转换器的 delay 只是旧案例兼容。

## 2026-07-28 Player 修复后撤销转换兼容

- 用户确认 `VxWidgets-player/dartIvx2.js` 的动作组完成态 `fini` 问题已经修复并完成编译，要求同时移除两类转换器临时兼容，并同步 VxEditor41。
- 第一类是 Phase 44 新增的异步 status callback + tree-for 直绑变量 `setValue` 后补零时长 `delaysMethod`。
- 第二类是更早已有的 `block.delay` + 变量组件方法执行后再补一次零时长 `delaysMethod`；它同样是在旧 Player 缺少合适提交边界时强制消费 dirty。
- 当前本机 `VxWidgets-player/main` 检出的 `dartIvx2.js::modCall()` 仍是旧实现且仓库 clean，说明用户所述修复编译不在该本地检出中；本轮按用户确认的新 Player 作为目标运行时执行转换器清理。
- 清理成立的部署前提是使用新转换产物的预览和正式运行页均加载修复后的 Player；旧 Player 不再受转换器 delay 保护。
- tov5parser 的两类补偿都集中在 `v4ToV5/converter.js::convertAction()`：`addDelayedVariableRefresh` 处理带 V4 `block.delay` 的变量方法，`addAsyncTreeRefresh` 处理异步 callback 内 tree-for 直绑变量 `setValue`；两者都在动作后调用无参数 `genActionDelay()`。
- `block.delay` 自身转换成动作前的 `genActionDelay(block.delay)` 是原始业务延时语义，不属于刷新补偿，必须保留。
- VxEditor41 当前只包含更早的 `addDelayedVariableRefresh` 兼容，位于 `src/utils/convertV4ToV5/index.js`；尚未包含 Phase 44 的 `asyncCallbackDepth/addAsyncTreeRefresh`，因此无需在 VxEditor41 撤销不存在的 tree-for 代码。
- tov5parser 有两段对应回归：`delayed variable methods yield once after updating bindings` 和 `async tree-bound variable setValue yields after updating bindings`。清理后应把前者改为验证“仅保留前置业务延时”，把后者改为验证“callback 内不再插入系统 delay”，避免只删除测试而失去新行为约束。
- VxEditor41 的目标文件定向 ESLint 通过，production webpack 也成功；构建报告的 33 条 warning 来自仓库其他既有/未跟踪代码，与本次转换器清理无关。
- 使用当前转换器在内存中重转真实 frp-pad 后，`delaysMethod` 总数从现有产物的 321 降为 222；所有 99 个缺少 `time` 值的刷新补偿 delay 均已消失，而有明确时间值的原始业务延时保留。
- 99 个被移除的无参数 delay 包含 Phase 44 的 35 个异步 tree-for 补偿，以及更早规则生成的 64 个延时变量方法补偿。
- 目标 BID `chpqsw7a3j50000jzy1g` 在旧产物后接无参数 `delaysMethod`，当前转换结果后直接进入原始 `switch`，证明目标临时兼容已撤销。

## 2026-07-28 日期选择器缺少时间面板

- 待验证路径：V5 `JGTvx7MG` → “量体师委派”单元格图标 → 弹窗“开始-完成日期”单元格日历图标。
- 对照 V4 地址沿用 `wt5RnwSK@10000590`；重点区分日期组件的 `showTime/timePicker/format` 等属性转换缺失与运行时组件渲染差异。
## 日期范围选择器缺少时间面板（2026-07-28）

- V5 `JGTvx7MG` 中已确认目标入口是表格“量体师委派”列的图标，不是“款式信息”列图标。
- “量体师委派”弹窗内目标字段标题为“开始-完成日期”，日历触发图标资源为 `1818c9215ea79f1a8e600c851f64f2c2_1095.svg`。
- 待确认：V4/V5 日期选择器渲染 DOM 差异、时间面板相关 props，以及转换后 JSON 是否丢失或误映射相关属性。
- V4 `.iwx-time-picker.date-picker-tab`：根高度 278px，`.picker_wrap` 高度 192px，三个 `.weui-picker__bd` 均为 182px。
- V5 同一结构：根高度 96px，`.picker_wrap` 高度 10px，三个 `.weui-picker__bd` 均为 0px；日期滚轮 DOM 实际存在，只是被压缩/裁切。
- 唯一直接样式差异：V4 根节点无 `height` 内联样式，V5 根节点为 `height: fit-content`。
- V4/V5 日期组件的 64 个基础 React props 除日期数据外一致，均有 `height: ""`、`visibleItemCount: 11`、`itemHeight: 34`、`btnHeight: 36`、`tabHeight: 50`。因此不是 props 中时间配置丢失，而是 V5 对空高度应用了内容自适应尺寸模式。
- 目标节点：`ccpjtcha3j50000c5f50`，名称“量体委托日期”，类型 `ih5-date-picker-tab`。
- V4/V5 加载同一 player `20230911190146/player.js` 和同一 widgets `20260728173119/widgets.js`，排除组件版本不一致。
- 公共 CSS `.iwx-time-picker.weui-picker` 提供 `height: 278px`。V4 空高度不生成内联高度，CSS 正常生效；V5 版本化尺寸逻辑为同一个空高度生成 `height: fit-content`，其内联优先级覆盖公共 CSS，导致 flex 滚轮区塌陷。
- 现场验证：仅将 V5 根 DOM 高度设为 `278px`，布局立即变为根 278px、`.picker_wrap` 192px、`.weui-picker__bd` 182px，与 V4 完全一致。
- 转换层可兼容的方向：对无显式高度的 `ih5-date-picker-tab` 写入 V4 实际固定高度 `278px`；同时审计同族 `ih5-date-time-picker-tab`、`ih5-time-picker-tab`。更根本的运行时修复是让这类内置固定高度选择器在高度为空时不输出 `fit-content`，继续使用组件 CSS 默认高度。

## VxEditor41-widgets 源码核对（2026-07-28）

- `src/components/ih5/base/base/base.jsx` 明确导入 `isV5`、`processAdaptiveWH`。
- `src/utils/adaptiveWH.js` 中 `isV5()` 以 `config.current.ver === 2` 判断 V5；空高度且不纵向拉伸时，适配逻辑会输出 `height: fit-content`。
- 待继续核对：`base.jsx` 仅在 V5 调用该适配逻辑的精确位置、日期选择器继承链，以及公共 CSS/默认 props 为什么在 V4 保留、在 V5 被内联样式覆盖。
- 日期组件源码为 `src/components/ih5/extra/rel/timePickerGroup/datePickerTab/datePickerTab.jsx`，继承链是 `Ih5RelDatePickerTab → BasePicker → Ih5Base`；render 的根节点直接使用 `style={this.getStyle()}`。
- `Ih5Base.adaptiveWHStyle` 在 `isV5()` 为 true 时才调用 `processAdaptiveWH`，之后 `baseStyle` 把结果合并进最终样式。
- `processAdaptiveWH` 默认 `sizeMode='fit'`：空高度先变成 `auto`，`adaptWH` 再在未纵向撑开时返回 `{height:'fit-content'}`。
- `isV5()` 的判断为 `config.current.ver === 2`；预览页 V5 的 `vxConfig.ver=2`，V4 不满足，所以同一组件构建会进入不同基础样式分支。
- 日期组件声明 `defaultProps.height='260px'`，但 frp-pad 节点未保存 height，运行时包装层给组件显式传入 `height: ""`。React 的 defaultProps 只补 `undefined`，不会覆盖空字符串，因此 260px 未生效。
- 两条类样式同时存在：`.date-picker-tab {height:260px}` 与特异性更高的 `.iwx-time-picker.weui-picker {height:278px}`。V4 无内联高度时后者生效；V5 的内联 `fit-content` 优先级最高。
- Git 历史：`129e9e555` 引入 V5 通用空宽高“包裹/撑开”逻辑；`3742ebd19` 的提交说明就是“处理自动添加 fit-content 样式覆盖 classname 的样式表中的样式问题”，新增 `sizeMode`，但仅 nativeHTML 显式传 `sizeMode:'auto'`，通用基础组件没有把 `this.props.sizeMode` 下传，Picker Tab 也未设置该模式。
- 因此根因是 V5 通用自适应尺寸规则误伤依赖 class 固定高度的旧 Picker，不是 V4/V5 加载了不同日期组件。
- Picker Group 逐个核对后，受同一机制影响的是四类根节点使用 `style={this.getStyle()}` 的组件：`ih5-date-picker-tab`、`ih5-date-time-picker-tab`、`ih5-time-picker-tab`、`ih5-month-picker-tab`。cascade/city/cols/radio Picker 使用 `wrapStyle()`，不合并 `adaptiveWHStyle`。
- 推荐窄修：`Ih5Base.adaptiveWHStyle` 读取并传递 `sizeMode`；上述四类 Picker Tab 设置 `sizeMode:'auto'`。这样仅在 height 为空时不生成内联值，显式高度与撑开配置仍按现有逻辑工作。
## 2026-07-28：日期类选择器组件侧尺寸修复结论

- `Ih5Base.adaptiveWHStyle` 原先未把组件内部的 `sizeMode` 传给 `processAdaptiveWH`，因此选择器无法选择已有的 `auto` 模式。
- 日期/时间选择器公共基类增加 `sizeMode: 'auto'` 后，空高度不再生成内联 `height: fit-content`，组件原有 CSS 固定高度可以正常生效。
- `sizeMode` 未加入任何 `*.map.json`，因此不会出现在属性面板，也不会成为案例 JSON 中的编辑器属性。
- 生产构建与目标文件 ESLint 均通过；用户原有 `iconButton.jsx` 修改保持不变。

## 2026-07-28：VxEditor5-widgets 同步核对

- `VxEditor5-widgets` 的 `Ih5Base.adaptiveWHStyle` 与 Picker 公共基类在本次修改前和 `VxEditor41-widgets` 对应代码一致，可直接同步相同的两处最小改动。
- 两个仓库均使用 `master` 分支并配置各自 GitHub `origin`。
- `VxEditor5-widgets` 工作区干净；`VxEditor41-widgets` 另有用户现存的 `iconButton.jsx` 修改，必须排除在本次暂存和提交之外。
- 两仓库的 Picker 映射文件均无需修改，`sizeMode` 保持内部 React 默认属性。
- 提交前 fetch 发现 `VxEditor41-widgets/master` 与远端一致；`VxEditor5-widgets/master` 落后 `origin/master` 7 个提交。按仓库安全规则不能 rebase，需要先检查这 7 个提交是否触碰目标文件，再用 merge 方式同步。
- `VxEditor5-widgets` 的 7 个远端提交只修改 `locale.js`、backendSecurity 和 ucClient，未触碰本次两个目标文件；已在保留工作区改动的情况下通过 `--ff-only` 快进到最新远端。
- 快进后目标 ESLint、差异检查和生产构建再次通过，当前与远端 ahead/behind 为 0/0。

## 2026-07-29：选择人员确认无效诊断

- 旧 V5 地址 `JGTvx7MG` 当前返回 404，不能继续作为复现目标。
- 本机 Chrome 当前打开的有效页面为：V5 `https://giupre.h5app.com/play/VdtnQAjZ`，V4 `https://giupre.h5app.com/play/wt5RnwSK@10000590`。
- 直接用 AppleScript 列标签先遇到语法错误，修正后又被 macOS Apple Events 权限拒绝；已停止该路径，改用只读 Chrome 标签列表取得当前地址。
- 后续交互仍使用隔离 Playwright，并在页面初始化时写入用户指定的 sessionStorage，避免刷新时被判断为未登录。
- V5 `VdtnQAjZ` 已正常加载，案例 nid 为 `12226286`，首屏显示 4 行数据，初始化服务均返回成功。
- “量体师委派”表头中心位于 x≈1300；每行对应文件图标位于 x≈1295，首行 y≈166.5。x≈1175 的同图标属于“款式信息”，需避免点错。
- 本轮可直接使用首行 `D.043847` 复现，不必切页。
- 点击首行委派图标后，V5 正常打开“量体师委派”弹窗；当前行已有两名量体师，弹窗内“+新增”唯一，位置约 x=1078/y=536。
- 委派弹窗本身的打开链路正常，故障范围已缩小到“+新增”后的选择人员模块或其确定动作。
- 点击 V5 “+新增”后，确实触发了“获取量体师列表”服务，服务成功返回 13 条人员数据，控制台变量“量体师列表”也更新为 13 项。
- 但隔离复现中等待约 3.7 秒后仍只存在原“量体师委派”一个固定弹窗，尚未出现第二层选择人员弹窗；说明“+新增”的动作链在服务成功后还有一个未抵达的步骤，或 UI 提交与用户浏览器现场存在时序差异。
- 该服务请求 `_sid=ccp00r3a3j50000peb70`，过滤条件是量体部门 `730697178`；请求本身不是阻塞点。
- “+新增”文本位于量体师委派弹窗内一个可点击 layout-row；点击事件绑定在该行组件的 `onTap`，不是文本节点自身的独立事件。
- React fiber 显示当前外层页面的 VL 模块名为“弹窗”，但转换后的 DOM class 不再携带源节点 ID；需要从 fiber 的 `data-vl-id/__events/$uses` 或本地 JSON 文本反查源节点。
- 本地 V4/V5 JSON 已定位“+新增”父节点：`ce6tndxa3j50000z730g`，名称“新增行”；其唯一动作 BID 为 `ce6tpnaa3j50000z733g`。
- 该动作在 V4/V5 中语义一致，只是向变量 `ccp1mrva3j50000pefvg`（“量体师委派”）当前行的 `connect` 数组追加 `{department:null,userIds:[]}`；它本来就不负责打开选择人员弹窗。
- 点击后 UI 已正确新增一条空白委派行。新行“量体师”列是一个空的 `ih5-select`（约 x=964–1224/y=452–483）；下一步应点击这个空选择框继续复现，而不是把“+新增”动作误判为失败。
- 新空行的普通下拉框因 department 为空显示 `No Data`，它不是用户所说的“选择人员”弹窗。
- 关闭该下拉后，点击已有量体师行右侧搜索图标（首行约 x=1210/y=495）成功打开第二层“选择人员”弹窗；弹窗 z-index=10，列出 13 名人员并有“确定”按钮。
- 用户所述故障路径应对应这个搜索图标/选择人员弹窗，而不是 `ce6tndx...` 的“+新增行”动作。
- V5 选择人员弹窗中“新FRP-王工”唯一；整行是可点击 layout-row，右侧用图片模拟勾选框，未选图标资源为 `6eb70d0a689e0af5d42cdb2bc50d1014_1106.svg`，不是原生 checkbox。
- 将选择“新FRP-王工”作为无副作用的本地弹窗状态测试对象，再点击“确定”观察是否回填/关闭。
- V5 勾选“新FRP-王工”成功，右侧图标从未选 `6eb70d...svg` 切换为已选 `f96551...svg`，说明人员行点击和选择变量写入正常。
- 点击“确定”后故障稳定复现：1.8 秒后选择人员弹窗仍存在，没有回填/关闭，也没有发起任何新请求或抛出 pageerror。
- 确定事件已经触发，控制台依次输出“量体师确定”“已选列表=[Object,Object]”“connetTemp=[Object,Object]”，随后没有后续日志。首个停点位于 `connetTemp` 成功更新之后、关闭弹窗之前；不是按钮点击失效，也不是勾选值丢失。
- 日志反查到动作组节点 `chze6kja3j500008jr60`，名称“量体师确认”，位于弹窗节点 `chze6kaa3j500008jpdg`（“量体师选择”）中。
- V4 旧代码显示 `connetTemp.consoleData()` 后下一步就是 BID `chze6kja3j500008jrj0`：把重组后的 `connect` 写回“量体师委派”变量；随后还会更新 `measureDepartment/measureUserIds`、重建量体师选项并执行 `chze6kja3j500008jrrg setFalse` 关闭弹窗。
- 当前 V5 从未输出后面的“求量体师选项”，所以首个可疑动作已经精确缩小到 `chze6kja3j500008jrj0`，或其写入参数公式求值。
- 一次直接 `rg` 搜索压缩 JSON 导致整行约 18MB 输出，已停止该方式；后续统一用 JSON 递归脚本只输出命中路径与精确 AST。
- `chze6kja3j500008jrj0` 的 V5 AST 表面结构完整：`setOneValue(index, 'connect', [...sliceBefore, ...connetTemp, ...sliceAfter])`；三个 spread 参数均有对应 AST，未出现空 `op:'val'`。
- 该动作的两个 slice 被转换为 `arr_sliceV2(start,end?)`，定位索引来自变量 `ce6vc2ga3j50000z786g` 的“序号1/序号2”。下一步需读取运行时三个输入值，判断是数据/索引异常、`arr_sliceV2` 运行语义问题，还是动作 Promise 状态未完成。
- 动作组更后方另发现一处既有可疑转换：BID `chze6kja3j500008jrn0` 的 `reduce((pre,cur)=>{...})` 回调在 V5 AST 内返回空值。但当前执行尚未到达“求量体师选项”，所以它不是本次首个阻塞点，需避免提前归因。
- 已从选择人员弹窗 React fiber 找到 V5 运行根实例；其 `_rc` 运行数据容器存在 `r/m/t` 三个分区，组件映射 `_cm` 也包含本案所有云端小模块。
- 根实例不直接暴露 `_sf/_fm`；运行变量和模块实例需继续从 `_rc.r/_rc.m/_rc.t` 定向读取，不能假设旧字段名。
- 对照本地 `v6core.js`：运行变量实际保存在运行树节点 `p` 中，key 形如 `${nodeId}_value`；`getVar()` 会从当前运行节点向所属 scope 定位。可沿 `_rc.r.c` 递归查找目标 key，不需要调用或修改运行时。
- `setVar()` 只做依赖重算和 dirty 标记；这再次说明本次没有“求量体师选项”日志时，动作链是在 UI 提交之前就已中断。
- 运行值证明 `chze6kja3j500008jrj0` 实际已经成功：定位值为 `{序号1:0, 序号2:0}`，`connetTemp` 为“谭工+王工”两项，写回后的 `connect` 已变为 4 项并包含王工。
- 因此首个停点需后移到下一动作 `chze6kja3j500008jrjg`（更新 `measureDepartment`）或其后的 `jrk0`（更新 `measureUserIds`）。
- `measureDepartment` 运行值仍为 `[730697178]`，与新计算结果相同，无法单凭值判断 `jrjg` 是否执行；但 `measureUserIds` 仍只有原“谭工+吴工”，未包含王工，确定 `jrk0` 尚未成功完成。
- `jrjg/jrk0` 都依赖 `connect.reduce((pre,cur)=>pre.concat(...),[])`；当前 V5 AST 的 reduce lambda 外观为 `val:['item','index']`，函数体却引用 `local 'acc'`，需核对转换器/运行时对 reduce 累加参数的约定。
- 精确提取确认 `jrjg` 和 `jrk0` 均为同一错误形态：`arr_reduce` 的 lambda `val` 只有 `['item','index']`，但 return AST 从 `ref ['local','acc']` 开始调用 `arr_concat`。
- 若编译器仅按 lambda `val` 声明局部参数，则 `acc` 未定义会在 `jrjg` 求值时报错，完全吻合“connect 已写回、measureUserIds 未更新、后续 console 不执行”的运行证据。
- 初次检索误用了不存在的 `test/、vendor/` 路径；实际测试文件是 `v4ToV5/v4ToV5.test.js`，映射资产是根目录 `ivxMap.txt` 和 `legacyMaps/legacyIvxMap.txt`。
- `arr_reduce` 定义位于 `ivxMap.txt` 的 `$SF_arr_reduce` 映射，转换器源码不直接硬编码该字符串；下一步需核对映射参数顺序和公式转换器生成 lambda 的通用参数规则。
- 根因已由 map、转换器与运行函数三方闭环：
  - `ivxMap.txt::$SF_arr_reduce.params[0].inParams` 正确声明 `acc,item,index`；
  - `processArrowFunctionExpression()` 虽用 map 把源 `pre/cur` 引用映射为 `acc/item`，最终 lambda 的 `val` 却硬编码成 `['item','index']`；
  - `VxEditor41-widgets::arr_reduce()` 直接调用原生 `array.reduce(fn, initVal)`，实际会按 `(acc,item,index,array)` 传参。
- 因此当前编译出的函数形如 `function(item,index){ return acc.concat(item.department) }`：`acc` 未声明，第一次 reduce 迭代即抛 `ReferenceError`；动作组 Promise 中断，后续 `measureUserIds`、`setFalse` 全部不执行。
- 该缺陷不是案例业务阻塞或 Player fini 问题，而是 V4→V5 公式转换器对 reduce 回调参数声明的通用错误；上游 VxEditor41 转换器存在相同硬编码。
- V4 对照页已加载同一首行 `D.043847`，量体师委派弹窗正常打开；数据内容与 V5 对应，便于执行同一人员选择确认链。
- V4 中同一已有量体师行的搜索图标位于约 x=1205/y=490；点击后打开的“选择人员”弹窗尺寸、人员列表和确定按钮与 V5 一致。
- V4 同样勾选“新FRP-王工”后点击确定，选择人员弹窗在 1.8 秒内关闭，委派列表立即新增“新FRP开发1 : 新FRP-王工”。
- V4 日志在 connetTemp 后继续输出“求量体师选项”、量体师委派/选项/userInfoArray，完整走过后续动作；没有新网络请求。这与 V5 在 connetTemp 后停止形成精确对照。
- 因为两边数据、操作与服务返回一致，已排除业务数据异常；差异完全落在转换后的 reduce AST。
- 选择人员弹窗节点为 `chze6kaa3j500008jpdg`，确定按钮节点为 `chze6kja3j500008jq4g`；确定事件调用动作组 `chze6kja3j500008jr60`（“量体师确认”）。
- V5 中点击确定和选中人员均有效：`connetTemp` 已写入王工，动作 `chze6kja3j500008jrj0` 也已把连接数据写回；动作链在后续两个 reduce 动作 `chze6kja3j500008jrjg` / `chze6kja3j500008jrk0` 处中断，因此最终关闭弹窗的 `setFalse` 没有执行。
- V4 源公式分别为 `connect.reduce((pre,cur)=>pre.concat(cur.department),[])` 和 `connect.reduce((pre,cur)=>pre.concat(cur.userIds),[])`。V5 AST 的回调正文把 `pre/cur` 正确映射成 `acc/item`，但 lambda 的 `val` 被转换器硬编码成 `['item','index']`，遗漏 `acc` 声明。
- `ast2js` 按 lambda `val` 生成函数形参，实际得到的代码等价于 `function(item,index){ return acc.concat(...) }`；首次 reduce 迭代引用未声明的 `acc` 后，动作组 Promise 被拒绝，后续 `measureUserIds`、选项重算和关闭弹窗动作都不会执行。
- 根因位于 `v4ToV5/formulaCode/V4FormulaCodeConverter.js::processArrowFunctionExpression()`：回调引用翻译已使用方法映射中的 `inParams`，返回的 lambda 形参却仍固定为 `item,index`。`arr_reduce` 的方法映射和运行时实现都明确要求 `acc,item,index`。
- VxEditor41 内置转换器的对应文件存在相同硬编码，修复时应同步。最新 frp-pad 产物共有 79 个 `arr_reduce`，其中 57 个缺失 `acc`，涉及 42 个 BID、31 个节点，属于通用转换缺陷。
- 本轮只读诊断，没有修改转换生产代码。**Phase 51 Status: complete。**

## 2026-07-29：reduce 回调形参转换修复

- `processArrowFunctionExpression()` 现在从 `sysutilInfo.params[0].inParams` 生成 lambda 的 `val`，并让回调正文中的源参数映射复用同一份 `inParams`；仅在映射缺失时回退到原 `item,index`。
- 该实现不是 reduce 名称特判：`arr_reduce` 自然生成 `acc,item,index`，`map/find/filter` 等普通数组回调继续按各自映射生成 `item,index`。
- 回归测试不仅检查 AST，还经 `ast2js` 编译并用原生 `reduce` 语义执行，确认两个 department 值能累加成 `[1,2]`。
- frp-pad 重转后 79 个 `arr_reduce` 中有 57 个正文引用 `acc`，这 57 个 lambda 均已声明 `acc`；遗漏数由 57 降为 0。
- 目标动作 `chze6kja3j500008jrjg` 与 `chze6kja3j500008jrk0` 均生成 `val:['acc','item','index']`，解决确定动作组在首个 reduce 处中断的问题。
- 新产物全部 2,589 个 jsfn 均能通过 JavaScript 编译；紧凑 JSON 约束保持不变。
- 本轮只修复 tov5parser，VxEditor41 中同位置的旧硬编码尚未同步。**Phase 52 Status: complete。**

## 2026-07-29：最新 frp-pad V4 下载与重转

- 中文服只读元数据确认最新 `work_id` 为 `cbt1eskpeu4lef3h2330-2921`，案例仍为 V4.1、`ntype=1`。
- 用户更新文档指定的 Cookie 后，`/work/load/{workId}?nid=11064050` 成功返回 3,314,392-byte 二进制；解码得到两个分段和完整 `case/server/stage`。
- 最新 V4 紧凑 JSON 为 41,697,291 bytes，SHA-256 `6f447cbb17457d0b5f194129f5d7d8e164d23f02156eb57657f64095764deb5a`。
- 最新 V5 紧凑 JSON 为 29,959,160 bytes、0 个换行，SHA-256 `490c6fe106aabed34887a8baa7ae6238ef97e287487c3230c035b58d22d02fea`。
- 转换诊断仍为 2,722 次 jsfn 兜底、2,372 条去重记录、0 条空值降级，与上一份产物指标一致。
- 79 个 `arr_reduce` 中 57 个使用 `acc`，缺少 `acc` 声明的数量为 0；目标 BID `chze6kja3j500008jrjg` / `chze6kja3j500008jrk0` 均声明 `acc,item,index`。
- 2,589 个 jsfn 全部通过 JavaScript 编译审计。**Phase 53 Status: complete。**

## 2026-07-29：reduce 修复后的选择人员列表回归

- “量体师选择”弹窗节点为 `chze6kaa3j500008jpdg`，列表变量为 `chze6kja3j500008jq70`，获取列表动作组为 `chze6kja3j500008jqb0`。
- 打开弹窗后的数据处理链中，动作 `cqbb8paa3j50000p0zt0` 会执行 `量体师列表.reduce((total,cur)=>total.concat(cur.roleList),[])`；这是打开链路中首个受上一轮 lambda 参数修改影响的 reduce。
- 最新 V5 将这个源代码只有两个形参的回调扩展成了 `val:['acc','item','index']`。虽然仓库内 `ast2js` 可把它编译成合法原生 JavaScript，但回归恰好从这次“按映射声明全部形参”的修改后出现，需要继续核对实际 Player 编译器是否要求 lambda 形参数量与源回调一致。
- 隔离预览复现证明三形参不是故障：`cqbb8paa3j50000p0zt0` 已正确算出 7 个角色 ID，服务也正常返回 2 个量体角色；列表是在随后的 `cqbc6hja3j50000p122g` 被过滤为空。
- 该动作的 V4 公式为 `users.filter(i => !!roles.find(j => i.roleList.includes(j.id)))`。当前 V5 把外层 `i` 和内层 `j` 都映射成 `local item`，实际执行等价于在内层访问 `j.roleList.includes(j.id)`，因此全部返回假。
- V5 编辑器自行创建函数型系统块时会为系统块生成 `_blockId`，并把回调参数命名为 `item_<blockId>`、`index_<blockId>`；converter 未生成 `_blockId`，才导致嵌套回调局部变量重名。
- 旧 reduce 错误会提前中断动作组，保留此前已写入的 13 人原始列表；reduce 修复后动作链继续执行，才暴露出后续嵌套回调作用域缺陷。因此不能回退 reduce 修复，应补齐 V5 的 `_blockId` 作用域规则。
- 转换器现已按 V5 编辑器原生规则为每个函数型系统块生成 `_blockId`，lambda 声明和正文引用均使用同一后缀；reduce 同时保留 `acc_<blockId>`。
- 重转产物共有 2,424 个函数型系统块和 2,424 个 lambda，全部带匹配的块 ID 后缀；回调作用域审计没有发现未声明的 `acc/item/index` 引用。
- 目标动作的外层 `objArr_filter` 与内层 `objArr_find` 已生成不同块 ID；内层正文同时正确引用外层人员 `item_<filterId>` 与内层角色 `item_<findId>`。
- 79 个 reduce 中 57 个正文使用累加器，57 个均声明对应的 `acc_<blockId>`；2,589 个 jsfn 全部可编译。
- 新 `app.v5.json` 为紧凑单行 JSON，30,204,305 bytes，SHA-256 `5334e4c07393e148c9957fd05f5405650e08c4df9039e7892f15d9d0416d38bf`。

## 2026-07-29：新增量体师后责任量体师下拉无数据

- 最新 V5 已复现：打开首行 `D.043847` 的“量体师委派”弹窗后点击“+新增”，表格出现一条空白量体师行；右上角“责任量体师”仍只显示原始 userId `0559655439-1344896399`，没有显示姓名。
- 运行日志显示异常在点击“+新增”之前已经存在：初始化读到 `责任量体师ID=0559655439-1344896399`，但两次输出的“量体师选项”均为 `[]`。
- 同一时段 `userInfoArray` 已有 4 个当前订单相关人员；获取量体师列表并完成角色过滤后，完整人员缓存也有数据。因此不是人员服务无返回，而是“量体师选项”的计算/写入链路没有产出。
- 点击“+新增”后“量体师委派”仍为一条业务行，界面额外出现一条空白编辑行；下一步确认责任量体师下拉组件绑定的具体变量和选项计算动作。
- 右上角责任量体师选择组件 ID 为 `cby9x8da3j50000db710`。它使用 `dataMode=objectArray`、`listID=userId`、`listName=name`：
  - `objectArrayList` 绑定变量 `ccpnp0ga3j50000c5peg`（“量体师选项”，默认空数组且自身无属性绑定）；
  - `selectValue` 绑定 `ccpnhsqa3j50000c5p40`（“责任量体师ID”）；
- 已进一步定位到选项初始化动作 `ceckgb1a3j500000z14g`：V5 AST 会从委派数组 `ccp1mrva3j50000pefvg` 汇总每行的 `measureUserIds`，再写入“量体师选项”变量 `ccpnp0ga3j50000c5peg`。
- 该动作的 V5 `arr_reduce` 回调体异常，只剩一个无值的 `return`；因此无法累计 `measureUserIds`。紧随其后的 `ceckgb1a3j500000z150` 输出空选项，`ceckgb1a3j500000z16g` 原本用于按 `userInfoArray` 回填姓名的循环也不会执行。
- 这与运行时现象一致：人员服务和 `userInfoArray` 均已有数据，但责任量体师选项在姓名回填前就已经为空。下一步核对该 BID 的 V4 原公式和所属事件，并用 V4 运行时确认正确选项结果。
- 对比 `/Users/lianghuang/Downloads/case_12225413.json` 与最新 `app.v5.json` 后确认，两者在动作 `ceckgb1a3j500000z14g` 上都已是 V5 AST，且都存在同一个空 `reduce` 回调；该下载文件不能作为 V4 原公式来源。
- 最新转换只是给 `arr_reduce` 增加了 `_blockId` 并修正回调参数名（`acc/item/index`），但回调块仍是 `return undefined`，所以之前针对嵌套回调的修复并没有补回本动作丢失的回调函数体。
- 错误报告已给出 V4 原公式。动作 `ceckgb1a3j500000z14g` 的完整代码是：
  `[...]reduce((pre,cur)=>{if(!!cur.measureUserIds)pre=pre.concat(cur.measureUserIds);return pre},[])...`
  也就是回调块本应把每行 `measureUserIds` 累加到 `pre` 并返回 `pre`；V5 AST 将整段 `{ if...; return pre }` 丢成了空返回。
- 该记录的转换阶段是 `custom-expr-fallback`（“full JavaScript expression fallback”），说明不是运行时 `reduce` 或数据问题，而是转换器在处理带块体箭头函数的混合表达式时，虽然进入了完整 JS 兜底路径，仍然把可结构化的 `reduce` 子表达式错误转换成空回调。
- 动作所属节点为小模块实例 `cdf85dda3j50000w883g`，类型 `data-module-instance`，模块名 `FRP_选择弹窗_部门_new`；事件触发标识为 `cd1x281a3j50000jwyng`。
- 转换器入口 `processFullJsExpression()` 会先用完整 ESTree 解析整段公式，再由 `walkCustomExprParsed()` 把 V4 `$refs` 子树抽成 `jsfn` 参数。
- 当前遍历器只在 `walkOrReplaceCustomExpr()` 和部分 `MemberExpression` 场景检查 `containsFunctionExpression()`。本公式从 `ArrayExpression → SpreadElement → NewExpression` 递归后，进入 `CallExpression/NewExpression` 的参数遍历；这里仅判断参数本身是否为 `ArrowFunctionExpression`，没有判断参数子树是否“包含”箭头函数。
- 因此 `new Set(...)` 的参数——整个 `reduce(blockCallback, [])` 调用——被提前交给 `processParsedTree()` 结构化为 `$v2`。该结构化过程调用旧的 `processArrowFunctionExpression()`；它只按“表达式体”处理箭头函数，把 `BlockStatement` 交给普通 AST 转换后得到空值，最终生成 `return undefined`。外层完整 JS 生成器随后无法恢复 `reduce` 的函数体。
- 代码核对确认 `processArrowFunctionExpression()` 固定把 `body` 转成单个 `return [rtnAst]`，并没有 `BlockStatement` 分支；而 `processParsedTree()` 对未知 `BlockStatement` 默认返回 `{op:'val'}`。这正是当前空返回 AST 的直接生成路径。
- 该动作不是责任量体师下拉组件自身事件，而是数据小模块实例 `cdf85dda3j50000w883g` 对模块事件 `cd1x281a3j50000jwyng` 的响应。实例绑定类 `C_cd1wmz3a3j50000jwv8g`，模块名 `FRP_选择弹窗_部门_new`，事件 AST 位于 `stage.children[5].children[36].events.list[0]`。
- 类定义显示 `cd1x281a3j50000jwyng` 的事件名称是“选择部门”。同一事件里还有多条类似的去重汇总公式，其中表达式体 `reduce((pre,cur)=>pre.concat(...),[])` 可保留；带 `{ if...; return pre }` 块体的 `ceckgb1a3j500000z14g` 才会丢回调体，进一步证明故障条件是“full-JS + spread/new Set + 块体回调”的组合，而不是所有 `reduce`。
- 继续全局核对后确认，`ceckgb1a3j500000z14g` 是同类问题的一个后续触发点，但**弹窗首次打开时的直接故障动作**是：
  - `ccpnpcsa3j50000c5pn0`（节点“点击框”的 tap）；
  - 同一单元格另一点击入口 `cep0rtva3j500007pyk0`（节点“量体师委派”的 tap）。
- 这两条动作原本把当前行 `measureUserDetail.data` 中每项的 `measureUserIds` 转成 `{userId}` 并去重，然后写入 `ccpnp0ga3j50000c5peg`。最新 V5 中两条动作的 `arr_reduce` 回调同样都只剩空 `return`，所以弹窗一打开“量体师选项”就已被写成 `[]`；点击“+新增”不是致因，只是让问题更明显。
- 相同模板的另外两处入口 `cm21x2wa3j5000036w9g`、`d0dcr6ra3j5000080s80` 也存在同样空回调，说明这是可批量影响其他列表/页面入口的转换缺陷，修复不应只按一个 BID 特判。
- 两个直接入口的后续动作链一致：先写 `ccpnp0ga...`，再用该数组调用人员查询/回填结果，随后遍历为每项补 `name`，最后显示弹窗。由于第一步已经得到空数组，后面的查询、回填和循环都会合法完成但仍为空，这解释了为何没有明显报错、弹窗却只显示责任人原始 ID。
- 转换器的最小通用修复点应在 `walkCustomExprParsed()` 的 `CallExpression/NewExpression` 参数分支：完整 JS 模式下，只要参数子树 `containsFunctionExpression(item)`，就必须保留为 JS 子树并递归参数化外部引用，不能先调用旧结构化转换。还应为这类 `new Set(reduce(blockArrow))` 公式增加回归测试。
- 已按上述通用入口完成修复。新增回归确认输出仍是单行 `jsfn`，外部数据被参数化为 `$v1`，`reduce((pre,cur)=>{...;return pre},[])` 和外层 `map` 块体均完整保留；执行结果正确得到去重后的 `{userId}` 数组。
- 重转后两个首次打开入口的公式均已变为：
  `...new Set($v2.reduce((pre, cur) => { var temp=...; ...; return [...pre, ...temp.measureUserIds]; }, []))`
  不再出现空 lambda。
- 选择部门后的 `ceckgb1a3j500000z14g` 和确认后的 `chze6kja3j500008jrn0` 也完整保留 `if (!!cur.measureUserIds) ...; return pre;`，同模板入口同步恢复。

## 2026-07-29：最近公式修复同步 VxEditor41

- tov5parser 累计修复提交为 `acd4ed2`，已推送 `origin/main`。
- VxEditor41 同步范围仅为 `src/utils/convertV4ToV5/formulaCode/V4FormulaCodeConverter.js`，提交 `0dc5cd863` 已推送 `origin/master`。
- VxEditor41 验证：目标文件 ESLint 0 warning/0 error，webpack 生产构建成功；仓库原有 warning 与用户未提交内容未作修改。

## 2026-07-29：最新 tov5parser 生产 Lambda 部署

- 生产目标沿用项目固定配置：账号 `587849590304`、宁夏 `cn-northwest-1`、函数 `vl-case-json-converter`、别名 `prod`。
- 部署脚本流程为：AWS 身份校验 → 测试 → 重建运行包 → 上传 S3 → 更新 `$LATEST` → 等待成功 → 发布版本 → 切换 `prod` → 可选版本冒烟。
- 部署前 `prod` 版本为 `5`，代码摘要 `9VKApPpDo88aEbhc8bJKuCVCA4oKhf1kQbVIEi+qcss=`，可作为回滚目标。
- 最新代码包摘要为 `R+UAtPoTTeUEVMrBemRlzAxxWg5qDty859jHgzWO/YQ=`，已发布 Lambda 版本 `6` 并切换 `prod`。
- 版本 `6` 冒烟调用返回成功，实际执行版本与别名目标一致，无 FunctionError。
- 最终远端状态：版本 `6` 为 Active/Successful，描述 `tov5parser 2edbfdd callback semantics fixes`；`prod` 无 weighted routing，全部流量进入版本 `6`。

## 2026-07-30：11023063 案例目录与重抓

- 案例名称确定为 `frp-后台`，来源同时由现有 README 和 V4 JSON 的 `case.uis.name` 交叉确认。
- 源标识为 nid `11023063`、workId `calcup52uhpcud8vv3h0-2502`；下载应走中文服编辑器只读 `/work/load/{workId}?nid={nid}` 完整案例链路。
- README 中的 workId 只能视为上一次下载记录；重新下载前需通过只读数据库查询 nid `11023063` 的当前 work_id。
- 2026-07-30 只读查询得到当前 workId `calcup52uhpcud8vv3h0-2503`，相比本地记录 `…-2502` 已更新；案例名称仍为 `frp-后台`。
- `/work/load/...-2503` 下载解码成功，新 V4 完整包含 `case/server/stage`，案例根名称仍为 `frp-后台`；新旧 JSON 摘要不同，确认不是重复抓取旧文件。

## 2026-07-29：重新获取并转换案例 11023063

- 用户确认案例 11023063 的 V4 数据已更新，要求重新获取完整 V4 JSON、转换为 V5，并检查转换过程错误。
- 当前本地 V4/V5 文件均为 2026-07-24 产物；本轮将重新查询数据库确认最新 `work_id`/版本，不能复用旧元数据。
- 仓库当前代码 HEAD 为 `2edbfdd`，与 `origin/main` 一致；现有三份规划文档含另一轮 7 月 29 日未提交记录，本轮会保留并在其后追加记录。
- 最新数据库元数据：版本从 1016 更新到 1017，`work_id` 从 `calcup52uhpcud8vv3h0-2496` 更新为 `calcup52uhpcud8vv3h0-2502`；编辑器仍为 4.1，`ntype=1`。
- 最新 V4 下载和解码成功：顶层完整包含 `case/server/stage`，前台节点 128、后台节点 641、case 根 1；紧凑 JSON 29,273,170 bytes。
- 新 V4 SHA-256 为 `1c4f3d2cdaf690fd9dfde2838ceab345fba8b4b0be296da1c34ca0fc6a2ef5a0`，与旧文件 `a2d8a3e5...` 不同；后台节点比旧版增加 3 个。
- 最新转换成功：V5 为紧凑 JSON、26,785,443 bytes，SHA-256 `50a4d8d7d524694342fc49d2fc6bc502df1e7a4cd78d58da1e481b2a50941aa5`。
- 诊断从 1,023 增至 1,027（去重 1,003），dropped 仍为 0；变化仅为 `||` +3、full JavaScript fallback +2、unknown varType -1。
- 最新产物含 1,008 个 jsfn，1,008/1,008 全部可编译；参数数目不匹配 0，旧 `$refs/fParam/cbParams/_loop/$P_` 源语法残留 0。
- 结构审计通过：770/770 源节点保留、5,079/5,079 普通动作有 V5 `ln` 落点。
- 29 次 runsvc 涉及 22 个唯一目标，仍有 `d2qayvka3j500007z9qg`、`d3r5bcna3j50000075d0` 两个源案例已有悬空目标；不是本轮转换新增。
- `app.convert-errors.analysis.md` 已更新到版本 1017 的诊断数、jsfn/节点/动作审计和前后变化。
- 项目全量测试 52/52 通过；最终 V4/V5/诊断 JSON 可解析，V5 为 0 换行紧凑 JSON，`server.props.v2=1`，目标 `(1).toString()` jsfn 仍正确。
- 本轮开始前数据库隧道已在运行，因此完成后保持原状态，没有终止其他任务可能复用的隧道。

## 2026-07-29：诊断 `/work/saveAs` 另存为 V5 报错

- 用户提供 dev.ivx.cn 对 `POST /work/saveAs?nid=11023063&newVer=2` 的完整 curl，要求定位接口所在项目（重点核对 VxServer）并查明该案例另存时报错原因。
- 本轮只做诊断，不修改服务端或转换器代码；附件中的 Cookie/鉴权信息不在输出中回显。
- curl 没有显式 `-X`，但 `--data-raw` 会使 curl 默认使用 POST；附件携带约 5.2 MB `application/octet-stream` 二进制 body，查询参数只有 `nid=11023063&newVer=2`。附件没有附带 HTTP 响应状态或响应正文。
- `/work/saveAs` 是写接口，直接重放可能创建新案例或改变线上状态；本轮不重放，优先从本地服务实现、请求解码和数据库约束定位。
- 附件文本包含 888,094 个 `U+FFFD` 替换字符，说明复制出来的二进制 body 已不可逆损坏；它不能用于重放或判断浏览器原始上传是否可解码，但这不是编辑器原请求失败的证据。
- 前端实现位于 `VxEditor41`：`caseApi.js` 声明 `/work/saveAs`，`tree.js` 以 POST、`application/octet-stream` 调用；V4→V5 入口在 `FileIntro.jsx` 转换后追加 `newVer=2`。
- 实际后端项目是 `VxServer` 的 `stable` 分支。公开 `/work/saveAs` 由生成的 `vxstack` 映射到 `/ih5/resource/saveAsWork`；`resource/resapp.SaveAsWork` 上传 `work/work_server` 后调用 `editor.Work.CopyAs`，后者在 `copyWorkToUid` 中复制元数据、配置和数据库。
- 当前登录 uid 为 `10000590`；只读库确认其是 gid `25391` 的组拥有者，也是 nid `11023063` 的 developer，因此 `checkAuth`、`CopyAs` 权限和“仅组拥有者可另存到同组”检查都会通过。原案例也没有 `instance` 复制限制。
- 当前案例函数元数据有 140 个数据库定义：126 个组级 `data-db`、14 个案例级 `data-league-db`；转换后的 V5 保持相同数量、scope、dbId 和类型，没有由转换器新增数据库定义或改变 scope。
- Chrome 当前错误框保留了服务端真实错误：`数据库操作失败，错误码：1054，详情： Unknown column 'styleOrigin' in 'field list'。` 因而首个失败点已确定为 VxServer 的数据库复制，不是转换器 JS 编译、鉴权、二进制解码或 OSS 上传。
- `copyWorkToUid` 对 Save As 传 `copyData=true`，`copyTable` 先 `CREATE TABLE IF NOT EXISTS`，随后 `CopyRecords2` 按源表返回的完整列名执行 `REPLACE INTO`。若目标同名表是旧结构，建表不会补列，插入源数据时就会触发 1054 缺列。
- 本案例在同一 gid 内由组拥有者另存，但原 work uid 是 `10006977`、新 uid 是 `10000590`。`getNeedCopyTables` 只有在“owner 相同且表名相同”时才跳过复制；因此 126 个物理表名不变的 `g25391_*` 组库仍被当成跨用户复制，目标库选择 `10000590` 的 `user_20190401`。
- 源函数 DB 列表的第 0 项就是 `g25391_ccg4m68bl5op4abqfplg`，其 canonical 源库为 `user_20190701`，列元数据已包含 `styleOrigin`；另有 6 张组表也包含该列。结合 CopyRecords2 的 SQL 形态，最早失败候选即这张第 0 项表：目标库中已有旧版同名表但缺少 `styleOrigin`。
- 根因是 VxServer 组级数据库 Save As 的复制/结构同步逻辑：同 gid 的 `g` scope 表不应因 work uid 改变而复制到另一个用户分片；即使必须复制，也应在写数据前对齐目标表结构，而不能只使用 `CREATE TABLE IF NOT EXISTS`。
- 前端还会放大问题：`FileIntro.jsx` 在检查 HTTP status 前直接 `JSON.parse(response)`，非 JSON 错误会抛异常；非 200 分支仍是 TODO。这会隐藏部分网关错误，但本次真实后端 1054 已从现存错误框取得。

## 2026-08-11：V4→V5 工作流设计补充证据

- 既有 `/work/saveAs` 服务端链路会复制 work 元数据、配置和数据库，且其权限检查与目标 gid/用户身份强相关；因此工作流不能绕过平台服务直接写数据库，也不能把“能读取参与案例”等同于“能在原组中另存”。
- 既有真实案例已证明：即使转换结果正确，Save As 仍可能因平台数据库复制问题失败。工作流的问题归属至少要分为 `CONVERTER`、`SOURCE`、`PLATFORM`、`AUTHORIZATION`、`UNKNOWN`，不能把所有保存失败都记为转换器错误。
- 之前为定位接口做过一次过宽的项目搜索，输出被规划文档噪声截断；后续只使用精确文件和路由范围检索，避免遗漏关键实现。
- VxServer 的 `/work/saveAs` 先经过 `checkAuth`，要求当前用户对源 nid 的成员类型不高于 `developer`，随后 `Work.CopyAs` 再次校验成员身份；这证实“参与者身份”至少可能具备读取/编辑权限，但最终能否另存仍受组规则约束。
- `copyWorkToUid` 在普通 Save As 时会强制 `req.Gid=oldWorkInfo.Gid`。若源案例在组内且当前 uid 不是组拥有者，默认拒绝“另存到当前组”；代码仅为特定 admin enterprise 场景留了例外。因此一般组内 developer 即使能加载源案例，也未必能用自己的身份完成 V5 Save As。
- 一次 VxServer 全局检索误扫到打包后的 `apps/huawei/static/core/player.js`，导致输出达到约 1.3M tokens 并被截断；真实目标文件仍成功定位。后续检索严格限制到 `resource/`、`editor/` 与指定源码文件。
- `/work/load` 的 `checkAuthLoad` 与写接口权限并不相同：公开无密码案例或若干平台管理员可以绕过成员检查，普通用户则需通过成员类型检查；所以“load 成功”更不能直接推出“saveAs 成功”。
- 当前资源服务的最低登录判断只检查请求上下文解析出的 uid/sandbox uid，具体身份来自平台 Cookie/网关上下文；代码检索没有显示标准 Bearer token 被资源服务直接消费。工作流 API 应在平台认证边界验证调用者 token，再换成短期内部委派身份，不能把任意 token 原样转发给转换器 Lambda。
- 本轮一次精确检索仍附带了不存在的 `VxServer/middleware` 目录，`rg` 对该路径报 ENOENT，但其余真实目录结果完整；后续不再使用该路径。
- 网关证据进一步确认：浏览器登录凭证名为 `ih5bearer`，网关校验 JWT、在线 sid 和最长时效后才注入内部 `X-Uid/X-Sid`；资源服务本身信任的是网关清洗后注入的内部头。工作流若接收“token”，应明确它是平台登录 JWT，并复用网关验证，绝不能允许客户端自行提交 `X-Uid`。
- `gateway/gwhdr/token.go` 明确同时支持 `Authorization: Bearer <ih5bearer JWT>` 与同名 Cookie；因此“调用者只传自己的 token”在认证层可行。最佳实现是让新工作流入口继续走现有网关，网关完成 JWT/sid 校验并注入 uid，工作流内部以用户 context 调平台服务；不是把 Bearer token交给转换器。
- `vx-json-evolution-claude` 的权威判版规则可直接复用：平台元数据 `extra.ver == 2` 即 5.x；5.0/5.1 再由 `ntype` 区分，`verDetail` 仅审计。只有 work 文件时再用实体结构判定。转换器只支持新代 4.x work；旧代 4.x 必须返回 `UNSUPPORTED_V4_FORMAT` 或先进入独立的格式归一化步骤，不能直接硬转。
- 第二次跨仓版本检索误扫到 VxEditor41 的打包静态 JS，输出约 3.9M tokens 并被截断；所需权威文档与源码命中已在截断前返回。后续只读取已知文档与源文件，不再跨整个编辑器执行宽泛 JS 检索。
- 当前 Lambda 的公开动作只有 `version`、`convertV4ToV5`、`getTransferUrls`；转换动作只接受内联 V4 JSON或 S3 key并返回 V5 JSON/S3 key。它没有判版、用户权限、获取 work、诊断报告、验证或 Save As，所以不应把现有 Lambda 直接扩成持有用户凭证的全能入口，而应由外层编排服务组合这些能力。
- 本轮先后误用了仓库根下 `convertDiag.js` 和 `v4ToV5/convertDiag.js`，实际文件位于 `v4ToV5/utils/convertDiag.js`；两次命令都只对错误路径报错，其余源码读取完整，未修改文件。
- 诊断文件实际由 `scripts/convert-local-cases.mjs --diag` 生成：转换器内部只有默认关闭的进程内记录采集器 `v4ToV5/utils/convertDiag.js`。现有 Lambda 未启用也未返回这些记录。工作流需要把诊断采集变成转换 Worker 的正式结构化返回，而不是依赖本地 `.json/.md` 文件。
- 当前诊断只直接区分 `dropped` 与 `custom-expr/jsfn fallback`；它是“需检查的证据”，不是完整正确性判定。大量 jsfn fallback 可以语义正确，转换成功也可能没有抛错却生成错误 AST。工作流必须增加独立验证器和归因器，不能用 `code=0` 或 `convert-errors` 数量直接判定成功/失败。

### 推荐总体架构

- 新增平台内 `CaseMigration` 编排服务，入口继续走 VxServer gateway；客户端只在 `Authorization: Bearer <ih5bearer>` 中传自己的 token，请求体只含 `sourceNid` 与可选 `gid`。网关验签、校验在线 sid并注入 uid；原始 token 不落库、不进入 S3、不传给转换器或 AI。
- 编排器采用持久状态机（AWS Step Functions Standard、Temporal 或平台等价实现）并只在状态中传 S3 artifact key/摘要，不传大 JSON。Job 元数据落平台数据库，输入/输出/诊断落加密对象存储并设置 TTL。
- 转换 Worker 固定到不可变 Lambda version/代码 SHA，只做 `V4 JSON → V5 JSON + raw diagnostics + manifest`；判版、权限、加载、验证、AI、Save As 均由外层组件负责。
- 平台 Case Adapter 以网关确认的 acting uid 调用 `Work.Get/load/CopyAs/save/config` 内部服务。异步场景保存 acting uid + 限域 job capability，并在最终写入前再次校验源权限和目标权限；不得使用无审计的全权 service account绕过组权限。
- 最终写入不建议直接复刻前端的多步公开接口链，而应新增一个幂等、尽量原子的 `MigrateSaveAsV5` 后端命令：统一复制元数据/资源/数据库、设置 `extra.ver=2`、迁移默认 config、替换 old nid→new nid且保留 `modDbId` 例外、写最终 work并返回 newNid/workId。若对象存储与数据库不能同事务，则先创建隐藏 draft，失败时补偿/标记失败，避免用户看到半成品。

### 状态机与门禁

- 状态建议：`RECEIVED → AUTHORIZED → SOURCE_RESOLVED → VERSION_CLASSIFIED → SOURCE_LOADED → SOURCE_BASELINED → CONVERTED → VALIDATED → ISSUES_CLASSIFIED → [AI_REPAIRED → REVALIDATED] → READY_TO_SAVE → SAVED → POST_SAVE_VERIFIED → SUCCEEDED`。
- `extra.ver==2` 直接终止为 `SKIPPED_ALREADY_V5`；V3/范围外为 `SKIPPED_OUT_OF_SCOPE`；元数据/实体结构冲突为 `VERSION_AMBIGUOUS`；旧代且未被当前转换器支持的 4.x 为 `UNSUPPORTED_V4_FORMAT`，不得强转。
- 保存前重新读取 source workId/hash；若源案例转换期间被修改，返回/自动重启一次 `SOURCE_CHANGED`，不能把旧快照静默另存为最新副本。
- 保存强门禁：存在 `CONVERTER` blocker、未知高风险问题、AI 修复未通过确定性复验时，一律不创建 V5。保存后必须以同一 acting uid 重新 load 新案例，核对 `extra.ver=2`、newNid 重写规则、work 可读性和结构摘要后才算成功。

### 验证与问题归因

- 转换前先做 V4 source baseline；转换后做独立 V5 validators：顶层/节点/事件保留，启用动作与 `ln` 落点，data-if/绑定 AST，jsfn 语法/参数/自由变量，`_code` 可编译性，cType/paramFunc，服务目标与数据库操作语义，新增悬空 ref，后台事件，以及按规则允许的新服务节点增量。
- 归因必须比较 V4 baseline 与 V5 输出：V4 有明确合法语义、V5 丢失/变形且可稳定复现，才标记 `CONVERTER`；V4 自身已有非法自由变量/悬空引用且 V5 只是保留，标记 `SOURCE`；load/save/DB/OSS/config/nid 重写失败标记 `PLATFORM`；权限单列 `AUTHORIZATION`；证据不足为 `UNKNOWN`。
- 每个转换器问题输出证据包：source hash/workId、converter version、nodeId/BID/JSON path、V4 token/code/_code、错误 V5 AST/code、违反的不变量、最小复现和严重级别。只入缺陷队列/报告，不调用代码修改、提交或部署流程。
- AI 只处理已排除 `CONVERTER/AUTHORIZATION` 的可修复 source 问题，输出受限 JSON Patch、理由与置信度；Patch 经过路径白名单、敏感字段禁改、变更预算和全部 validators 重跑。权限、平台故障走确定性错误/重试；业务语义有歧义或低置信度 source 问题进入 `NEEDS_REVIEW`，不能为追求全自动而猜测。
- AI 不读取用户 token；案例 JSON 先做 secret/连接信息脱敏，尽量只发送问题切片、相邻上下文和对应规格。每次补丁保存 before/after、模型版本、prompt版本与验证结果，最多循环 1–2 次。

### 权限与参与案例

- 权限至少拆成 `canReadMetadata`、`canLoadWork`、`canSaveAsSource`、`canCreateAtTarget` 四项预检；`gid` 只是来源/目标完整性断言，必须与服务端解析到的 source gid 一致，不能被视为授权。
- 非组个人案例：当前 `CopyAs` 允许具有 developer 成员身份的参与者另存到自己的 uid，预期可用，但仍要真实预检。
- 组案例：组拥有者可以按现有规则另存回同组；普通 developer 通常能 load，却被 `copyWorkToUid` 拒绝另存回同组。若产品要求所有参与者都能转换，必须明确新增一种授权：组拥有者授予 `migrate/create-copy` 权限，或允许创建个人 V5 副本并正确复制/重绑组数据库。不得由工作流服务账号偷偷越权代存。
- 第一版建议保持现有权限语义：非组 owner 返回 `TARGET_PERMISSION_DENIED`，明确说明“可读取但不能在原组创建”。在业务确认个人副本的数据库、资源与协作语义后，再实现第二种目标策略。

### API、数据与幂等

- `POST /api/v1/case-migrations`：header 为 Bearer token + `Idempotency-Key`，body 为 `{sourceNid, gid?}`，返回 `{jobId,status}`；`GET /api/v1/case-migrations/{jobId}` 返回进度、结论、newNid和报告，必要时提供 SSE/webhook。
- Job 至少记录 `actingUid/sourceNid/resolvedGid/sourceWorkId/sourceHash/sourceVersion/targetPolicy/converterVersion/validatorVersion/status/newNid/issueSummary/artifactKeys/timestamps`，永不记录 token。
- 幂等键由 acting uid、sourceNid、sourceWorkId/hash、target policy、目标版本和 converter version组成；同一快照重复提交返回原 job/原 newNid。Save 命令另带单次 reservationId，防止网络重试创建多个 V5。
- 终态至少包含 `SUCCEEDED`、`SKIPPED_ALREADY_V5`、`SKIPPED_OUT_OF_SCOPE`、`VERSION_AMBIGUOUS`、`UNSUPPORTED_V4_FORMAT`、`TARGET_PERMISSION_DENIED`、`BLOCKED_CONVERTER_DEFECT`、`NEEDS_REVIEW`、`PLATFORM_FAILED`；所有终态都应给机器错误码和面向用户的中文说明。

### 分阶段落地

- Phase A：先定 API/状态/权限矩阵和原子 Save As 契约，尤其先决定组内非 owner 的目标策略。
- Phase B（无 AI MVP）：完成网关入口、持久 job、权威判版、用户态 load、固定版本转换+结构化诊断、确定性验证、问题归因、强门禁与原子保存；用现有 51 个 clothing 案例做黄金回归，并补组 owner/developer/只读成员集成测试。
- Phase C：加入受控 AI source repair、脱敏、Patch policy和重验证；先 shadow 运行，只报告拟修复，积累准确率后才允许自动应用低风险类别。
- Phase D：完善 blocked job 在新转换器版本发布后的受控重跑、可观测性、配额/并发、告警、artifact TTL、审计与 post-save cleanup。

## 2026-07-29：修复 VxServer 同 gid 组级表误复制

- 用户确认先修复判断逻辑：old/new work 位于同一个 gid 时，`g` scope 数据库应复用现有组表，不因 work uid 不同而进入复制。
- 本轮只修改 VxServer/stable 的相关实现和测试；完成验证后不提交，等待用户确认。
- 现有 `TestGetNeedCopyTables` 已覆盖 gid `4 → 44` 时组表必须复制，但没有覆盖 gid 相同、uid 不同的复用场景。
- 最小修复应位于 `getNeedCopyTables` 生成 old/new 物理表名之后、查询目标用户分片之前：当 `newDb.Scope == "g"` 且 old/new gid 相同时直接跳过复制，同时仍将原数据库定义保留在 `newDbs`。
- 已实现为“物理表名相同，并且 owner 相同或属于同 gid 组表”时跳过。这样不同 gid 的组表仍进入复制，`n/u/e` scope 的既有逻辑不变。
- 新回归测试使用 old uid `1`、new uid `11`、old/new gid 均为 `4`，断言复制表清单为空且 `newDbs` 原样保留。
- `gofmt`、`git diff --check` 和四场景条件矩阵检查通过：同 gid 组表复用、不同 gid 组表复制、不同 nid 案例表复制、同 owner 用户表复用。
- 完整 Go 定向测试无法在当前 checkout 编译：`go.mod` 将内部模块 replace 到被 `.gitignore` 排除且本机不存在的 `./edtgo`、`./extgo`。未伪造或拉取内部依赖；新增测试留给具备完整构建依赖的环境执行。
- 最终 VxServer 差异仅为 `editor/work/work_copy.go` 和 `editor/work/work_copyi_test.go`，没有 go.mod/go.sum 或其他生成文件变化。
- VxServer 修复已提交为 `f743f740`（`fix: reuse group tables within same work group`）并推送到 `origin/stable`；提交只包含上述实现与测试两个文件。
  - `optionList` 另绑定委派数组中 `measureUserIds` 的扁平去重结果。
- V4 与当前 V5 的上述组件绑定结构一致；V5 不是把对象数组绑定丢失，而是被绑定的 `ccpnp0ga...` 运行值没有被填充。
- 弹窗内另有变量 `cdgbn0ca3j50000sv610`（同名“量体师选项”），其值属性用委派数据和 `userInfoArray` 计算 `{id,name}`；但右上角组件并不绑定这个变量。需要继续查 `ccpnp0ga...` 应由哪个动作写入，以及 V4 为何能得到数据。
- 2026-07-30：案例 `nid=11023063` 的真实名称为 `frp-后台`。本地案例目录已统一为 `localCases/v4/frp-后台` 和 `localCases/v5/frp-后台`；数字目录 `11023063` 已移除。
- 2026-07-30：`scripts/convert-local-cases.mjs` 原先只扫描 `localCases/v4` 根目录并把输出扁平化到 V5 根目录。现改为递归扫描并保留相对目录，因此 `frp-后台/app.json` 会稳定生成 `frp-后台/app.v5.json`。
- 2026-07-30：最新 V4 work 为 `calcup52uhpcud8vv3h0-2503`。重新转换的 V5 主文件为紧凑单行 JSON，大小 26,789,501 字节，SHA-256 为 `d72c764949bd10a3c65a5bbfcb30ec9d4790f01f197fa9a8b64b2b897a0b438b`。
- 2026-07-30：服装业务案例统一归档到 `localCases/<v4|v5>/clothing/<案例名>`。当前分类包含 `frp-pad` 和 `frp-后台`，V4/V5 层级完全一致；递归转换脚本会保留 `clothing/<案例名>` 两级相对路径。

## 2026-07-30：frp-后台 V5 导出数据减少

- 用户提供的文件顺序与文件体量一致：`exported.xlsx`（V4）约 28 KB，`exported (1).xlsx`（V5）约 7.1 KB。
- 两份文件均只有 `Sheet1`，字段完全一致，都是 `code`、`oldCode`。
- V4 共 1239 条数据；V5 只有 50 条，相差 1189 条。V5 的前 21 条 `code` 为 `D.041655` 至 `D.041680` 附近且 `oldCode` 为空，之后才出现 V4 首条 `D.041733 / XS202602120020`。
- artifact-tool 可完整读取两份表；初次视觉渲染失败是因为 V4 表高约 24820 px，限制渲染范围到前 40 行后正常，不影响数据读取。
- 精确集合关系：两份导出共有 30 条，且两列值完全一致；V5 独有 20 条（全部 `oldCode=null`）；V4 独有 1209 条，从 `D.041763` 开始。因此 V5 不是随机漏行，而是旧数据查询被截断在 30 条。
- “新旧导出”按钮 ID `d3t514ma3j50000bj4rg`，调用同名云端服务 `d3t54esa3j50000bj4v0`。该服务的旧数据逻辑为：`dbCount(oldCode != null)` → `dbSelect(range 1..统计结果, cols code/oldCode)` → 返回对象数组。
- V5 服务 AST 中 `dbCount` 行 `d3t55yza3j50000bj52g` 返回类型为 `IvxResult<Long>`；但 `dbSelect` 的 limit 直接转换为 `d3t55yza3j50000bj52gRtn - 0`，没有从返回包装中读取实际 count。若运行时对无效 limit 使用默认分页大小 30，正好解释 Excel 中只有前 30 条旧数据。
- V4 生成代码明确使用 `parseFloat(cbParams) - 0`，其中 dbCount 回调的 `cbParams` 是计数数值；V5 生成代码则是 `d3t55yza...Rtn - 0`。同一 V5 AST 把该局部变量声明为 `IvxResult<Long>`，因此这里应读取其实际结果字段而不是直接做数值运算。
- 转换路径位于 `V4FormulaCodeConverter.genActionResultAST()`：当前只有 `varCompScope === 'stage'` 且动作映射为 `singleParam` 时才追加 `result` 索引；该案例的 `dbCount` 位于 server 服务事件中，因此 server 单返回值没有解包，随后被 `convertDbRange()` 原样用于 limit。
- 第二个确定分叉位于 `CON_OP_MAP`：映射包含旧键 `notE -> neq`，但该案例的 26 个数据库条件使用 `notEqual`。导出服务中的 dbCount、dbSelect 两个 `oldCode != null` 条件因此都生成 `{op: undefined, col: "oldCode", val: null}`。
- VxServer 的 `newWhere()` 对未知/空 `op` 返回 `nil`，所以 `oldCode != null` 被整条忽略；`PlayerDBManager.Select()` 在 limit 为 0/无效时设为 `DefaultSelectRows=50`。
- 两个错误叠加后的实际行为是“无筛选取全表前 50 条”。表中前 20 条恰好 `oldCode=null`，接下来的 30 条正好是 V4 导出的前 30 条，因此与 V5 Excel 的 20+30 构成逐条吻合。
- V4 正确逻辑是：筛选 `oldCode != null`，先 count 得到 1239，再用该数值作为 dbSelect 范围上限，最终导出全部 1239 条。

## 2026-07-30：数据库条件与后台单值回调转换修复

- `CON_OP_MAP` 同时保留旧键 `notE`，并补充案例实际使用的 `notEqual: 'neq'`；两种 V4 表达都能稳定生成 V5 数据库操作符 `neq`。
- 后台动作中的裸 `cbParams` 不能直接按 V5 局部变量使用。转换器现在复用 V4 组件动作映射里的 `singleParam` 元数据；只有明确为单返回值的动作才追加 `result` 访问，普通对象结果动作保持原结构。
- 新增回归测试先在旧实现上分别失败，修复后定向测试 35/35、项目完整测试 54/54 通过。
- 重转 `clothing/frp-后台` 后，目标服务 `d3t54esa3j50000bj4v0` 的 `dbCount` 与 `dbSelect` 条件均为 `oldCode / neq / null`。
- `dbSelect` 的 limit AST 已读取 `d3t55yza3j50000bj52gRtn["result"]`，编译代码不再把 `IvxResult<Long>` 包装对象直接参与减法。
- 当前 V4 中 `notE` 条件 31 处、`notEqual` 条件 26 处；新 V5 共生成 57 个 `neq`，与两类来源总数一致。
- 新 `app.v5.json` 为 26,794,575 bytes、0 个换行，SHA-256 为 `7ebac0bf004a2307739cb2871796800f37e528416c9ab36a8037b10c06667be3`。

## 2026-07-30：数据库查询语义修复部署

- tov5parser 修复提交为 `8d052db0b4fce8c4807b3d09d3376ab0c888def3`，已推送到 `origin/main`。
- 生产 Lambda `vl-case-json-converter` 已从版本 6 更新到版本 7，区域 `cn-northwest-1`，账号 `587849590304`。
- 版本 7 描述为 `tov5parser 8d052db database query semantics`，代码摘要为 `rjHsGctWvxb6ltWHJJWVymes+XJZSFS9rac/s1ipXP0=`。
- 部署前重新执行完整测试 54/54 通过；`prod` 冒烟调用返回 200，实际执行版本为 7，无 FunctionError。
- 独立复核确认版本 7 为 Active/Successful，`prod` 仅指向版本 7，没有加权分流。
- VxEditor41 已同步相同两处逻辑，提交为 `30182b4ea3c5d75bccb2d2f482a44966f7c40181`，已推送到 `origin/master`。
- VxEditor41 两个目标文件 ESLint 为 0 error/0 warning；生产构建成功，输出仅包含仓库既有的 Sass/Prettier/导出告警。
- VxEditor41 提交严格只包含 `V4FormulaCodeConverter.js` 和转换器 `utils/const.js`，未包含仓库中原有的 `.gitignore`、`src/stores/event.js` 或未跟踪组件目录。

## 2026-08-03：复核 V5 data-if 的编辑器、widgets 与保存链

- 用户要求把 VxEditor41 与 VxEditor41-widgets 一并纳入判断，并确认保存 V5 案例时是否存在 `binds.value`；本轮只读核查，不修改转换器或两个外部项目。
- VxEditor41-widgets 的 `src/components/data/if/if.js` 运行组件只执行 `props.value && props.children ? props.children : null`，因此 widgets 渲染层最终需要一个名为 `value` 的运行时 prop；其 map 中供编辑的声明字段仍是 `conditionVal`。
- VxEditor41 的旧 `genPropsCode()` 对 data-if 调用 `markConditionProps()`，后者把数组形式的 `props.conditionVal` 编译后写入 `node.binds.value`。这说明传统树播放器通过 value bind 向 widgets 的 `props.value` 供值。
- VxEditor41 `saveCaseData()` 递归 `saveNode()`，而 `saveNode()` 会调用 `saveNodeExtraInfo()` → `genPropsCode()`；表面上保存路径仍会尝试生成 `binds.value`。但 V5 的 `props.conditionVal` 是 `{ast}` 而不是旧数组，必须继续确认 V5 是否改走 VLang 保存分支，以及该函数对 V5 对象实际会写出什么。
- 同一保存/加载逻辑又对 data-if 的 `props.conditionVal.ast` 单独调用 general-AST 初始化和保存处理，属性面板仅在 V5 + `uis.astCon` 时启用 AST 条件编辑器；这确认 V5 编辑态的条件源仍是 `props.conditionVal.ast`，但尚不能据此断言运行时完全不使用派生的 `binds.value`。
- VxEditor41 的正常 V5 手动保存没有改走另一套入口：`stores/tree.js::onSaveDealCase()` 对所有版本先调用同一个 `saveCaseData()`，只在之后为 V5 追加 dbView 条件处理；最终 `onSaveCaseData()` 原样编码提交返回的树。
- `saveNode()` 在处理 V5 data-if 时先单独保存 `props.conditionVal.ast`，随后仍无版本判断地执行 `saveNodeExtraInfo()` → `genPropsCode()` → `markConditionProps()`。因此保存 JSON 中会有 `props.conditionVal.ast`，也会被写入一个 `binds.value`。
- 关键兼容缺口：`markConditionProps()` 只会编译旧数组形态的 `props.conditionVal`；V5 值是 `{ast}`，没有 `length`，所以其条件数组为空、生成代码为空，并把保存副本的 `binds.value` 覆盖为 `{_code:'', code:''}`（若存在 `binds.conditionVal` 则还会合并该对象）。这不是正式 V5 条件的第二份有效表示。
- V5 属性面板 `PropItemConditionAST` 只通过普通 props 更新把 `{ast}` 写回 `props.conditionVal`；`onChangeNodeProps()` 仅更新该 props 与引用信息，没有同步 `binds.value`。
- VxEditor41 内置旧 stageProxy 播放器不解析 `props.conditionVal.ast`：它对 data-if 只识别旧 `props.condition`，之后统一从 `node.binds[*]._code/code` 注册运行绑定。结合 widgets 的 `if.js` 只判断 `props.value`，可确认旧树播放器确实依赖有效的 value bind；而正式 V5/VLang 编译链会从 `props.conditionVal.ast` 另行生成运行时 `conditionVal/value`，不依赖树 JSON 中冗余的 `binds.value`。
- VxEditor41 的公共保存入口没有为 V5 绕过旧条件编译：`onSaveDealCase()` 对 V5 仍先执行 `saveCaseData()`；递归到 data-if 后先保存 `props.conditionVal.ast`，再无版本判断地执行 `saveNodeExtraInfo()` → `genPropsCode()` → `markConditionProps()`。
- 因为 V5 `conditionVal` 是 `{ast}` 而非数组，`markConditionProps()` 的 `conditionValue.length` 为 `undefined`，最终会把保存副本的 `binds.value` 写成空字符串编译结果 `{_code:'', code:''}`。若导入 JSON 原有 general-AST `binds.value`，保存时也会被这个空旧式 bind 覆盖。
- vlparser 映射把 data-if 的正式 V5 属性 `conditionVal` 输出为 VL 属性 `conditions`，不是直接输出为 `value`。因此“树 JSON 的正式条件字段”“VL 条件属性”和“widgets 最终收到的布尔 value”是三个阶段，不能只凭 widgets 的 `props.value` 反推保存 JSON 必须有有效 `binds.value`。
- 修正此前过度结论：不能笼统说“V5 data-if 所有路径都不用 `binds.value`”。更准确地说，V5 编辑源与 Tree→VLang 编译不消费它；旧 stageProxy 路径需要可执行的字符串 value bind，但当前 V5 保存流程实际只生成空壳，且不理解转换器产生的 general-AST value bind。
- 本轮检索曾误用不存在的 `/vlparser/treeToVLang/ivxMap.txt` 与 tov5parser `v4ToV5/assets` 路径；权威映射实际位于 `/Users/lianghuang/Desktop/ivx_repos/vlparser/ivxMap.txt`。另一次宽泛检索误扫 `VxEditor41-widgets/dist` 的单行大 bundle 并造成输出截断；后续已限定到 `src` 与明确源码文件。
- `stageProxy.js` 内嵌 `convertCode()` 的实现已直接核对：返回值只有 `{_code: transformedString}`；当输入是空串时就是 `{_code:''}`。`markConditionProps()` 再合并自己的 `code:''`，所以 V5 保存结果的空 bind 形状可由源码确定，不是对运行时行为的猜测。
- VxEditor41 内嵌的 VLang 转换代码也与外部 vlparser 一致：正向只解构 `conditionVal.ast` 后按映射名输出，反向则把解析所得 bind 移到 `props.conditionVal={ast:...}`，生成节点时不保留普通条件 bind。
- `saveCaseData()` 会先用 `cpJsonNode()` 克隆案例根，再对该保存副本递归执行 `saveNode()`，所以空 `binds.value` 会进入提交 JSON，但不会立即改写编辑器内存中的原节点；下一次重新加载保存结果时才会成为加载数据的一部分。
- 旧 stageProxy 的 bind 遍历对对象值只取 `m._code || m.code`，取不到字符串就不注册绑定。因此转换器 general-AST 形态的 `{op:...}` `binds.value` 不会被它执行；V5 保存产生的空 `_code/code` 同样不会注册。这进一步说明当前保存出来的空 bind 既不是正式 V5 条件，也不能给旧 widgets 提供有效布尔值。
- 当前目标 `cpxf6vka3j500005g6d0` 的实物再次核对：`props.conditionVal` 只有 `ast`，根操作是 `and`；`binds.value` 只有 `op/args`，没有 `_code/code`。所以它会被 V5 Tree→VLang 正确消费，同时会被旧 stageProxy 的字符串 bind 遍历忽略；若经当前 VxEditor41 保存，后者会被空旧式 bind 替换。

## 2026-08-03：转换器 data-if value bind 的目标契约

- 用户要求只修复 tov5parser，不处理 VxEditor41 保存逻辑；需要在“删除 value bind”和“生成空 `_code/code` 壳”之间确定目标结构。
- VxEditor41 内嵌 VLang→Tree 的 `parsedToDataIfNode()` 只传入 `props.conditionVal={ast:...}`；通用 `genNode()` 把未传的 `binds` 初始化为 `{}`。这说明原生 V5 反向生成契约是空 binds，而不是 `{value:{_code:'',code:''}}`。
- 空 `_code/code` 在旧 stageProxy 中取值后仍是假值，不会注册 value 绑定；V5 Tree→VLang 又完全不读取普通 data-if binds。因此空 value 壳没有运行兼容价值，只会复制 VxEditor41 旧保存代码的副作用。
- 转换器的正确最小修复是：data-if 专用生成 `props.conditionVal.ast` 后，不再转换/保留 V4 的旧 `binds.value`；同一节点的其他 bind 必须继续走通用转换，节点 `binds` 对象本身保持存在。
- 当前第 6 例 V4 目标节点确实同时含旧数组 `props.conditionVal` 和字符串 `_code/code` `binds.value`，两者表达同一条件；因此删除 value 只移除重复派生数据，不损失唯一条件源。
- 修复后第 6 例共有 139 个 data-if，139/139 保留 `props.conditionVal.ast`，`binds.value` 为 0；本例这些 data-if 没有其他 bind，所以各自 `binds` 为 `{}`。目标 `cpxf6vka3j500005g6d0` 的正式根操作仍是 `and`。
- 新产物共有 136 个 jsfn，136/136 语法可编译且形参/实参数量匹配。原来冗余 data-if binds 中的 12 个坏 jsfn 已随重复字段消失；只剩未引用函数组 `cpwtrd1a3j50000ks1zg` 中既知的 1 个 `$v1/$v2` 自由变量 jsfn。
- 诊断由 221 降到 138（去重 180→129），全部 138 条仍为 custom-expression fallback、dropped 0；data-if value bind 诊断为 0。正式 conditionVal 的转换仍发生在专用路径，不会写入通用 bind 诊断。
- 修复后 V5 为 1,541,940 bytes，SHA-256 `472d29baa769338b6c79335418122f9ade9c859900474789e82a2c4b28341bf9`。

## 2026-08-03：clothing 第 7 例 `产品调校中心_11283496_温晓华`

- 源目录排序第 7/51，nid `11283496`；数据库当前标题为“FRP_产品调校中心”，作者刘土明（源文件名标注温晓华）。
- 当前元数据：`data_edt_ver=node_edt_ver=4.1`、`verDetail=null`，确认为 V4.1；`ntype=1`、版本 277、`work_id=cic0rcfl557ut9e0ea40-552`、gid 25391，已发布且已上架。
- 应按该最新 work_id 下载完整案例，不能复用源目录中的清单 JSON或历史 work_id。
- 最新完整 V4 已下载：16,903,495 bytes，SHA-256 `e057e7157321785add87e2bae50e78f74083fd9bd207bea9abc821ce787569fe`；顶层完整包含 `case/server/stage`。
- 当前转换器成功生成 11,593,947 bytes 的紧凑 V5，SHA-256 `4d48ebce31af9400bb112171ef608761cb5cf9f084035434047801f719073ec7`，诊断 752 次/730 条去重、`dropped=0`。
- 初审 739 个 `jsfn` 均可编译，但 9 个使用 `$vN` 而形参数组为空；这些不属于普通 args/params 数量不匹配，需结合源公式与可达性单独判断。
- 375 个 data-if 中 373 个已有正式 `props.conditionVal.ast`，2 个保留兼容 `binds.value`；需确认源节点是否本就缺正式条件字段。
- 严格按三根的 `children/classes` 递归后，V4/V5 均为 5,849 个组件节点，节点 ID 100% 保留；10,779 个非根事件块也全部有 V5 `ln` 落点。
- 两个特殊 data-if 在 V4 中均没有正式条件，只含空 `binds.value` 占位；V5 保留空 `{op:'val'}` 兼容字段正确，其余 373 个正式 data-if 均无冗余 value bind。
- 9 个缺参 `jsfn` 属于真实转换错误而非审计误报：它们的 `val[0]` 使用 `$v1`～`$v3`，自身 `args=[]`。8 个位于可达逻辑，1 个位于源案例已禁用动作。
- 错误集中在自定义表达式内部嵌套 `find/filter` 回调：外层 `jsfn` 参数正常，内层回调再次降级为 `jsfn` 时参数未随之带入。受影响节点为 `cktkmjja3j50000nkr1g`、`cm0jj30a3j500009d1ng`、`cm0nphaa3j500009dgm0`、`cs64jy3a3j50000n1ny0`、`cr6cewva3j50000qh7xg`。
- 唯一缺失服务目标 `ccrnnwfa3j500001ftm0` 在 V4 中也无定义，但启用函数组仍调用它；这是源案例已有问题。唯一旧式 `cbParams.data` 残留在两层禁用条件内，也是源数据遗留且 V5 不可达。
- 全量测试 58/58 通过；本例报告结论是“成功生成，但有 9 个嵌套 jsfn 缺参转换错误，修复重转前不作为最终可用产物”。

## 2026-08-03：嵌套回调 `jsfn` 参数丢失修复

- 用户已授权修改转换器；目标不是补写案例 JSON，而是让任意嵌套 `find/filter/map` custom expression 都携带自身需要的 `args`。
- 当前可疑边界位于 `V4FormulaCodeConverter.walkCustomExprParsed()` / `walkOrReplaceCustomExpr()`：外层 custom-expression 的 context 与 `processParsedTree()` 内部再次创建的 custom-expression context 没有稳定合并，需用最小公式验证实际变异顺序后再决定修法。
- 单体复现证明错误与完整案例环境无关；`$refs` 默认识别即可触发。所有坏节点都满足：外层不支持的 `&&/||` 进入 custom expression，遍历到 `find/filter/map` 时先结构化箭头回调，回调体又因 `&&/||` 以 `gateway:true` 创建内层 custom expression，随后同一解析子树继续被外层 walker 使用。
- 外层 jsfn 自身的 args 正常；内层 jsfn 代码保留 `$vN` 但 args 被清空，说明修复必须维持内层 custom expression 的代码与参数 AST 原子性，不能只在最终 JSON 上补参数数量。
- 根因已由运行跟踪确定：`processCustomExpr()` 的 walker 通过 `genReplacement()` 原地修改传入的 jsep/acorn AST；外层 walker 的 Unary/Call 等试探路径会重复结构化同一回调，后续调用看到的是已经参数化、却不再含参数来源的树。
- 最小通用修复方向：`processCustomExpr()` 先深拷贝解析子树，再只在副本上做参数化和打印。拷贝必须保留 `RegExp` Literal，不能使用会把正则降成空对象的 JSON 序列化。
- 仅避免 AST 变异可以补回 9 个 `$vN` args，但不足以保证块体回调语义：`external.keys.includes(i.index)` 被整体抽成外层 jsfn 参数，导致 `i.index` 离开 `map(i => ...)` 作用域并变为 `jsfn("i.index")`。
- 完整 JavaScript walker 还需收集函数参数和局部声明名；候选子树只要依赖这些名字，就不能整体结构化为外层参数，而应继续递归、只替换其中的外部引用。
- `walkOrReplaceCustomExpr` 的局部变量保护有效修复 `keys.includes(i.index)`，输出已变为 `$v2.includes(i.index)`；但 `UnaryExpression` 自己直接调用 `processParsedTree(argument)`，因此两个 `!!find(...)` 仍绕过保护。
- 该保护不能只放在一个入口：所有 full-js 模式下“先结构化、失败再递归”的直接入口都应共享同一判断，避免 Unary/Call/Member/数组或模板分支再次把含局部变量的子树移出词法作用域。
- 完整修复包含两层：custom-expression 在保留 RegExp 的 AST 副本上参数化；full-js walker 收集箭头/函数参数、变量声明和 catch 参数，并统一保护依赖这些局部名的子树。
- 修复后块体真实形态不再生成任何内层 jsfn：外部 `items/keys/filters` 成为外层参数，`i/j` 及其比较仍在原 JavaScript 回调作用域内。
- 修复后真实案例 729 个 jsfn 的 `$vN`/args、val 参数名/args 与语法全部通过，但词法自由变量分析发现两个未覆盖的解构回调：
  - `cr6cewva3j50000qh7xg` / `d3aec9ha3j5000036yb0`：`Object.entries(...).map(([key,value]) => `${key}${value}`)`；生成的模板 jsfn 看不到 key/value。
  - `cr6cewva3j50000qh22g` / `cznnpaha3j500000e49g`：`.map(({title,code}) => ({name:title,code}))`；生成的对象 jsfn 看不到 title/code。
- jsep arrow 插件把这两种参数分别表示成 `ArrayExpression` 与 `ObjectExpression`；当前 `processArrowFunctionExpression()` 只通过 `param.name` 识别普通 Identifier，因此解构绑定不会进入 callback context。
- 最稳妥的兼容方式是把带非 Identifier 参数的整个箭头函数降级为一个返回函数值的 jsfn，而不是尝试把任意嵌构模式映射到 V5 固定的 item/index lambda schema。
- 该方案已由实际执行验证：jsfn 代码保留完整 `([key,value]) => ...` / `({title,code}) => ...`，运行后返回的回调函数能正确解构输入并生成预期值。
- 真实案例还有第三种解构 `({}, index) => ...`，同一通用检测自动覆盖，无需案例特判。
- 最终自由变量审计只剩 `$curPathValue`（V5 路径更新约定）和禁用源分支 `cbParams.data`；排除这两类后，转换器生成的 callback-local 悬空引用为 0。
- 原 9 个 `$vN` 缺参节点全部清零；此外两个方案块体公式中原先隐藏的 `jsfn("i.index")` 也消失，说明修复同时恢复了完整词法作用域，而非只补齐 args 数组。
- Phase 74 最终结论：转换器错误已修复；第 7 例可判定转换成功。剩余活跃悬空服务和禁用分支 `cbParams.data` 均来自 V4 源案例，不属于本轮转换器缺陷。

## 2026-08-04：clothing 第 8 例 `人员管理与组织架构_11020409_温晓华`

- `LC_ALL=C` 文件名排序再次确认该文件为源目录第 8/51 例；下一例是 `任务中心_11411754_温晓华.json`。
- 中文服只读数据库 SSH 隧道仍在 `127.0.0.1:13306` 监听；本例 V4/V5 目标目录均尚不存在，不会覆盖已有案例数据。
- 当前机器没有旧文档所述 AWS profile 与 mysql CLI；可复用的已验证只读交接包实际位于 `/Users/lianghuang/Desktop/case-json-migrator/raw/lianghuang-cn-db-20260630`，查询应通过隔离 PyMySQL 读取其中 env 配置。
- 只读查询结果：`data_edt_ver=node_edt_ver=4.1`、`ver_detail=null`，因此是 V4.1；`ntype=1`、版本 329、最新 `work_id=cajvb9pl9ispg1dl0nf0-861`、gid 25391。
- 当前数据库标题“人员管理与组织架构”、作者王洋（文件名标注温晓华），作品已发布且已上架；必须按该 work_id 下载，不能复用源目录中的清单 JSON。
- 最新完整 V4 已下载：HTTP 二进制 988,572 bytes、解码后紧凑 JSON 14,263,945 bytes，SHA-256 `c476a6ec90c7676afe8508cdf97faa87d5b9e35b15430519b8fd5b3fc70d3846`；顶层完整包含 `case/server/stage`。
- 当前转换器已生成 11,260,700 bytes 的紧凑 V5，SHA-256 `33c62f3199b11c9135454db8c9c3f3f1143ca05e10653e09b35d02cd8a99c07d`，`server.props.v2=1`；诊断 248 次/245 条去重、`dropped=0`。
- 结构初审：V4 4,858 个组件节点全部保留，V5 多 2 个 ID 待分类；7,248 个非根事件块全部保留。245 个 jsfn 语法和参数完整性均通过。
- 仍需定性的唯一公式疑点是 4 个自由 `fParamcf4zq1ca3j50000cmes0` jsfn；它们集中在同一 stage class 事件中，需判断该参数是否来自缺失/错误的源回调上下文。
- V4 实物已显示上述 4 个公式全部原样含错误前缀；所属启用函数组自身正常参数前缀是 `fParamcf4zjzva3j50000cmang`，高度指向源案例遗留的错误/已删除参数引用，而非转换器改写。
- 全树精确搜索进一步确认 `cf4zq1ca3j50000cmes0` 完全无定义；源函数组只接受 `value/name` 并使用另一正确前缀，所以这 4 条是确定的 V4 源问题。
- 唯一保留 value bind 的 data-if 是源空条件占位，兼容转换正确。
- V5 比 V4 多出的两个严格组件节点是由两条启用的前台数据库动作生成的授权代理服务，run svc 目标、源 BID 和后台 AST 均对应，属于预期转换。
- 自由变量扩展审计还发现畸形 `item == item.logName == $v1` 和裸 `否` 各 1 条；需要分别回查源公式 typo 与文本参数识别。
- 畸形 `item` 来自 V4 源公式 `.find(item==item.logName==...)` 本身遗漏 `=>`；所在动作在 V4 已禁用，V5 也为 `skip:true`。这属于源数据问题且当前不可达。
- 裸 `否` 位于启用函数组“获取部门列表”节点 `cbnj58na3j50000tghf0`、动作 BID `cbtvgj2a3j50000svgp0`、参数“是否成功”。V4 `str` tokens 明确把空格和“否”记录为文本，V4 `_code` 也编译为 `("否")`；V5 生成的 `jsfn` code 却是裸 `否`、args 为空。
- 中文 `否` 在 JavaScript 中是合法标识符，因此 245/245 语法编译通过并不能发现此语义错误；启用分支执行时会把它当未定义变量并触发 `ReferenceError`。
- 直接责任边界是 `v4ToV5/utils/action.js::getLegacyFormulaTextValue()`：旧 Formula 文本识别仅覆盖少量参数语义/格式，没有利用本参数明确的纯文本 `str` tokens。应先补窄范围回归和转换规则，再重转本例。
- 本例最终审计：V4 4,858 个节点全部保留，V5 预期新增 2 个授权代理服务；7,248/7,248 个事件块保留；245 个 jsfn 的语法和参数完整；588 个 data-if 中唯一 value bind 是源空占位；109 次服务调用的 41 个目标全部存在；项目测试 61/61 通过。
- 第 8 例当前结论：产物已生成，但有 1 处明确且可达的转换器错误；另有 4 个错误 fParam 引用和 1 个禁用的畸形 find，均为 V4 源案例已有问题。

## 2026-08-04：中文文本 Formula 修复与固定发布规则

- 当前项目已有且仅有 `AGENT.md`、`CLAUDE.md` 两份相关规则文件；用户指定的长期自动发布规则应同时写入这两份文件。
- 动作参数的纯文本恢复集中在 `getLegacyFormulaTextValue()`，而调用点位于通用 `convertActionParamValue()`，因此修复可覆盖函数组参数，不必对“是否成功”或特定节点硬编码。
- 回归必须同时覆盖：`value.str` 全为文本 token 且 code 为合法中文标识符时恢复字符串；含变量/公式 token 的值继续进入公式转换；既有 path/CSS/info/reason/url 规则保持不变。
- 本例纯 str Formula 参数数量很大（2,341 个），其中有 `1`、`true`、对象字面量、`materialCategoryId` 等合法公式；因此不能用“所有 token 都是 str”作为唯一文本判据。
- “是否…”参数配合严格值 `是|否` 是可证明的窄语义边界；再校验 token 拼接等于原 code，可排除混有变量 token 或 tokenizer 信息不完整的情况。
- 修复后的真实 AST 直接把“是否成功”的值写成 `{op:'val', val:'否'}`，不再生成 jsfn；本例全树没有任何 code 为裸“是/否”的 jsfn。
- 诊断次数和 jsfn 数量均恰好减少 1（248→247、245→244），与唯一已确认错误闭合，没有造成其它公式批量改写。
- 完整重转审计没有结构回归：4,858 个源节点全部保留、7,248 个非根事件块全部有落点、244 个 jsfn 的语法与参数完整、41 个服务目标全部存在。
- 生产 Lambda 版本 12 已包含提交 `25ab607`，代码摘要 `cBW3QzuHFJmJE/r7OIWtDEYGjD5kiKeNuqPMvxZGYuE=`，`prod` 已无权重地切换至该版本并通过版本接口冒烟。
- VxEditor41 同步提交为 `1700c5de17f654e2dae7cb6c2db35a698ded697a`；目标文件 lint 与全仓生产构建均通过，用户既有工作区修改未被纳入提交。
- Phase 76 最终发布闭环：tov5parser `25ab607efc3b29fbc90ec2c0078b6024044b4adf`、Lambda 版本 12、VxEditor41 `1700c5de17f654e2dae7cb6c2db35a698ded697a`。

## 2026-08-04：clothing 第 9 例 `任务中心_11411754_温晓华`

- 源目录排序第 9/51，nid `11411754`；下一例为 `任务中心导出资料_11899135_温晓华.json`。
- 数据库交接包和 SSH 隧道均可继续复用；查询和下载只使用只读链路，不调用保存、发布或上架接口。
- 只读查询结果：V4.1、`ntype=1`、版本 1231、`work_id=clmj6n8r4j9t2qbtsgh0-4030`、gid 25391；标题和当前作者均与源文件一致，发布链接码 `SP6Zp2PB`。
- 最新 V4 完整文件已下载：25,287,379 bytes，SHA-256 `c19f5a2c06eb3cb575fc35143b42e7d24cddadd7ca2bcc795cc9ab4710e2c46c`；顶层三棵树与根类型完整。
- 初次转换诊断为 976 次/840 条去重，`dropped=2`、jsfn fallback 974；与前几例不同，本例存在真实空值降级，需优先审计这两项。
- 两条 dropped 共享根因和落点：setProps 的 `width=100%`、`height=100%` 被当公式解析失败；需判断它们是否是明确 CSS 文本及动作是否启用。
- 目标 setProps 和 tap root 均启用，V4 token 明确是 CSS 文本，V5 两值为空；因此 2 个 dropped 是同一转换器缺陷造成的两处实际逻辑丢失。
- 节点和事件结构完整，但初审另有 1 个空 jsfn 与 4 个缺失服务目标，需要区分转换器问题和 V4 源悬空引用。
- 空 jsfn 的源公式是启用 pushMulVal 动作中的三个逗号分隔取值；诊断 outcome 虽标 custom-expr，但输出 code 为空，实际不可执行，是明确的第二类转换器问题。
- 4 个缺失服务目标均在 V4 就无定义；V4 本身保留启用和禁用 fireService 引用，V5 只是原样转换为 runsvc，属于源案例悬空引用。
- 两个特殊 data-if 均为源空条件占位，V5 的兼容 value bind 不是错误。
- 872 个 `jsfn` 的词法自由变量扩展审计还列出一批裸调用：`sortAndUniqueData`、`toNew`、`processPackageMaterials_1/2`、`isToShow`、`formatData`、`checkMember`、`getElementHeight`。跨 tov5parser、VxEditor41、VxEditor41-widgets、VxEditor5-widgets 的非案例源码精确检索未找到这些名称的全局运行时定义；因此它们不能在未核对 V4 sysutil/custom function 来源前直接判为合法全局。
- `$curJsonPathValue` 共 19 处，形态接近 V5 路径更新回调约定，需与编译器/运行时契约核对后再从异常名单排除；`cbParams.data` 是前例已知的禁用源分支遗留。
- 上述裸函数已通过 V4/V5 实物闭环：class 内有 9 个 `data-func` 节点定义这些函数并赋给 `window`，转换后节点与代码均保留，因此裸调用由案例自己的全局函数承接，属于合法结构。
- `$curJsonPathValue`/`$curPathValue` 则相反：V4 `genCodeUtils.dealCode()` 会为 `setPathValue/setOneValue/setRowColsValue` 等动作把占位符替换成目标变量当前路径值；V5 `ast2js` 的 `jsfn` 仅给 `new Function` 注入 `val[1..]` 对应的显式参数，没有这两个隐式变量。原样残留会返回 `undefined`，不是合法 V5 约定。
- 本例公式出现次数为：18 个 `setPathValue` 的 `$curJsonPathValue`、11 个 `setOneValue` 与 3 个 `setRowColsValue` 的 `$curPathValue`，另有 1 个 `setCusPathValue`。最终沿完整动作祖先链复核为 29 处严格可达、4 处位于禁用动作或禁用祖先下；此前“32 个可达”的统计忽略了 3 个禁用祖先和 1 个禁用动作，现已纠正。转换器统一修复全部 33 处。
- `保存失败` 位于禁用 fireFuncGroup 动作，V4 原 Formula 本就没有引号；`z.hep` 位于禁用循环下的禁用动作且源树没有 `z` 形参。二者均为源数据已有且不可达的问题。
- 修复后真实产物的 `dropped` 为 0；33 个 legacy 当前路径公式逐 BID、目标变量及路径 AST 审计全部通过，原 Compound 空 `jsfn` 已变为带 3 个参数的 `$v1, $v2, $v3`，两个 CSS `100%` 已恢复为字面量。
- 最终 V5 有 865 个 `jsfn`，865/865 可编译且参数完整；唯一节点 7,731/7,731、非根事件块 12,357/12,357 保留。4 个缺失服务目标继续确认为 V4 源悬空引用。
- `setCusPathValue` 的动态路径不能按 `.` 简单切分，否则 `['a.b']` 会被拆错；最终实现保留 V4 的动态属性访问语义，并在无效路径时返回 `undefined`。带点键名回归和真实禁用样本均已验证。
- Phase 77 发布闭环：tov5parser `9bd16be2bb131f41cd5b4c61b9f4a56a58da697f`；生产 Lambda 版本 13、CodeSha256 `2ZnblJHjuedolaWBIedioeSZGh/k/bkPE+xMvw+zacE=`；VxEditor41 `93d6ee722220e1f8205613aedaf0cbd80cd71153`。两个远端均无分叉。

## 2026-08-04：clothing 第 10 例 `任务中心导出资料_11899135_温晓华`

- 源目录排序第 10/51，nid `11899135`；下一例为 `内外包材包装方式_11073549_温晓华.json`。
- 只读数据库结果：V4.1、`ntype=1`、作品版本 162、`work_id=cvll1i0vs0lgmk54omr0-426`、gid 25391；标题和作者与源文件一致，发布链接码 `pxRLcgwH`。
- 最新完整 V4 已从编辑器 `/work/load` 下载并解码：2,512,761 bytes、SHA-256 `fe9f0d1ddbc102cc1daa08d98691ae4a273c39216604f9a2108de93c5a63297f`；顶层三棵树和根类型完整。
- 初次转换 `dropped=0`，23 条诊断全部生成可编译 jsfn。312 个节点、723 个非根事件块和全部服务目标均完整；V4 的 16 处当前路径占位符在 V5 中已全部解析，无残留。
- 23 个 jsfn 的源码、参数和自由标识符审计通过：所有 fallback 都只依赖 `$vN` 显式参数与标准 JavaScript 内建对象，没有案例自定义裸全局或 legacy 引用残留。
- 当前路径专项实际为 8 个启用 setOneValue 公式（`code/_code` 使原始字符串出现 16 次）；8/8 的目标变量与 index 路径 AST 均正确。
- V4/V5 节点类型分布完全一致，无 Legacy 类型；项目 63/63 测试通过。本例最终判定为转换成功，未发现转换器错误或源案例悬空服务引用。
# 2026-08-04：clothing 第 11 例 `内外包材包装方式_11073549_温晓华`

- 源目录排序为第 11/51 例，nid `11073549`；下一例为 `分类设置_11020389_温晓华.json`，本例汇报前不启动。
- 中文服只读数据库当前记录：V4.1、版本 `24`、`ntype=1`、`work_id=cc8s34qfmpllnjbhfucg-114`、gid `25391`，已发布且已上线，短链 `gz7OrREU`。
- 数据库当前标题/作者为 `FRP_内外包材包装方式` / `朱芮`，源文件名标注为 `内外包材包装方式` / `温晓华`。这是来源元数据差异，不是查询或转换错误；案例目录仍采用源文件名，报告同时记录两者。
- `/work/load` 最新数据成功解码为完整三段式 V4 JSON：HTTP 二进制 427,836 bytes，解码后紧凑 JSON 5,455,302 bytes，SHA-256 `f50d9947d32c347f47a6e4463e276197f3538bff1b474855235df38944d2b6fc`。
- 首次转换成功，诊断为 96 条去重公式记录（空值降级 7、完整 JavaScript `jsfn` 兜底 89）。日志出现不支持逻辑运算和 `hasOwnProperty` 的旧 AST ParseError，但这些本身不等于转换错误，需以兜底后的 V5 AST 是否完整、可编译且作用域正确为准。
- 产物 `app.v5.json` 为 3,662,844 bytes、0 换行、SHA-256 `831b783e19b9f20eecc3fa59bcaec09b780db18a87643b84d5cf5fc84eca7e3e`。
- 诊断类别详细分布：`not support &&` 36、`not support Literal` 正则类合计 22、`not support ||` 12、`Unexpected )` 7、`$SF_sys_multiObjListToObjArr` 6、`hasOwnProperty` 3、完整 JavaScript表达式 fallback 2、`unknown varType: undefined` 7。只有后 7 条落入 dropped，必须逐条回查源参数与目标 AST；其余 89 条均已进入 jsfn 兜底，仍需编译与作用域审计。
- dropped 实际对应 7 个 `bgColor` 绑定，而不是此前第一条自定义表达式记录中的提示文字。7 条 V4 `code` 都在嵌套三元表达式末尾多出 `)`，V5 因而落成空 `{op:"val"}`；然而对应 V4 `_code` 均为没有该多余括号的有效表达式。就 V4 运行语义仍可从 `_code` 恢复这一点看，当前“只因编辑态 code 失效便丢弃绑定”的行为应归为转换器兼容缺陷，而非不可恢复的源案例错误。
- 真实组件节点口径（对象同时有 `id/type/props`）下，V4/V5 均为 1,922，节点 ID 完全一致；泛型递归会把 V4 事件根误算成节点，不能使用。
- `runsvc` 共 90 次、25 个唯一目标；24 个目标均存在，唯一缺失的 `cjzmmjta3j500001xrv0` 在 V4/V5 真实节点中都不存在，倾向源数据悬空引用。
- V5 `server.props.v2=1`，12 个 `data-service` 均有编译 `_code`。`data-sharedService` 和 `server-api` 的编译态字段结构不同，不能用 `events.list[0]._code` 一刀切判断。
- 212 个 `data-if` 中，210 个具备 `props.conditionVal`；2 个没有源条件且只保留空 `binds.value={op:"val"}`。这与前面已确认的 V5 conditionVal 主路径一致，需再核对两个空节点在 V4 是否同样无条件。
- 当前路径：V4 有 `$curPathValue` 公式且 V5 字符串中已消失；V5 的 `$curObj` 仅见于转换后的标准 AST `_blockType`，不是占位符残留。
- 重要审计纠偏：V5 `jsfn` 代码存于 `val[0]`，参数存在 `args`；首次把 `val` 当字符串的脚本结论无效。首个真实 `jsfn` 样本却是裸中文 `选中数据审核字段有误`，可能会在运行时被当变量而非提示文本，需按 7 条 `unknown varType` 诊断逐项核对。
- 正确按 `val[0]` 与 `$v1..$vN ← args` 复核后，89 个 `jsfn` 均可编译、均非空、均无缺参；但这不足以证明运行安全，因为 JavaScript 把连续中文视为合法标识符。
- ESLint scope 自由变量审计锁定 7 个错误 `jsfn`：六个 `选中数据审核字段有误`、一个 `选中数据状态字段有误`。对应诊断均为 `unknown varType: undefined`，位置是 `fireFuncGroup` 的 `toast` 参数；应保留成字符串字面量，而不是零参数函数表达式。涉及 BID：`cdxf52ma3j50000x5dx0`、`cdxjqgpa3j50000x5nng`、`cdy7gsva3j500007bzv0`、`cdy8t0ga3j500007c4dg`、`cdxftf1a3j50000x5hj0`、`cdysv64a3j50000sr0t0`、`cdyxw30a3j50000sr2hg`。
- 6 个 `jsfn` 仍含 V4 方法名 `$SF_sys_multiObjListToObjArr()`；实现位于 `VxEditor41-widgets/src/utils/sysFunc.js`，组件 map 中也作为 V4 公式方法注册。需要继续确认 V5 `jsfn` 执行值是否带该原型方法；若没有，这将是第 3 类转换器残留。
- 已确认 V5 `src/utils/ast2js.js` 的 `jsfn` 只执行 `new Function(val[1..], 'return '+val[0])(...args)`，不会装饰参数值；全仓也没有把 `$SF_sys_multiObjListToObjArr` 挂到对象原型的实现。因此 6 个 `jsfn` 中的对象式伪方法必然运行时报错，是明确的第 3 类转换器缺陷。
- `sys_multiObjListToObjArr(value)` 的真实语义：遍历 value 中的数组字段，取最大长度，按索引生成对象数组。正确修复需提供同等语义，而非把调用当作无操作。
- `jsfn` 真实运行约定是 `val[1..]` 提供参数名、`args` 提供实参；本例 89 条参数长度和 `$vN` 顺序全部一致，全部可编译。
- 当前路径专项通过：BID `cd81m1ga3j50000hbex0` 的 V4 `'%'+$curPathValue+'%'` 被转换为从目标 `cd81j1ga3j50000hbdzg` 当前行（local `cd81jxba3j50000hbecg`）读取 `内容填写` 后两侧拼 `%`，没有错误退化为目标整体 value。
- 两个空 data-if（`ctne2mta3j500004ttx0`、`cmqsrcha3j50000f3mx0`）在 V4 就无 condition，只保留兼容空 bind；V5 `{op:"val"}` 等价，不是转换问题。
- 唯一缺失服务目标 `cjzmmjta3j500001xrv0` 在 V4 只有调用、没有定义，V5 未新增或删掉定义，属于源数据悬空引用。调用 BID 为 `cwcvpmja3j50000tnv4g`。
- server 编译态完整：`props.v2=1`，12 个后台 `data-service` 的 12 个事件均有 `_code`，无漏编译。
- BID 差集由 549 个 root 容器和 4 个 status 包装组成；4 个 status 都启用，option 分别为两组 `uploading` / `beforeUpload`，每个内部是“上传中...”提示动作。子动作已保留，但需检查包装语义是否被保留。
- 实现侧确认 status 通过 `convertActionCb` 处理；`dealSpecialCbs` 对 `$sobj_file` 的 `beforeUpload` / `uploading` 有显式分支，会构造文件上传回调而非无条件执行。仍需用本例 AST 做最终落点核对。
- 本例落盘 AST 证明两组 file status 均正确：`uploadPics`/`uploadVideos` 的 method args 包含 `beforeUploadCb` 与 `uploadingCb`，四个回调子动作 BID 都在对应 lambda 内，参数值完整。
- V4 `stageProxy` 与事件代码生成均采用 `_code || code`；7 个 bgColor 的 `_code` 有效，所以 V4 运行语义正常。转换器只尝试无效 `code` 后置空，构成确定的兼容缺陷。
- 项目测试 63/63 通过；V5 产物可解析且为严格紧凑 JSON，最终 hash `831b783e19b9f20eecc3fa59bcaec09b780db18a87643b84d5cf5fc84eca7e3e`。
- jsfn 原始代码残留总计 `$SF_*` 9 次，已解释的 multiObj 伪方法为 6 次；尚有 3 次必须继续定位，避免仅凭前一版 regex 报告误判为已清零。
- `$SF_*` 最终复核：是 6 个问题 jsfn 中合计 9 次同名调用，没有其他 `$SF_*` 类型。第 11 例最终为 3 类转换器错误：有效 `_code` 未回退（7 bind）、中文 toast 被当 jsfn 标识符（7 参数）、multiObj 伪方法残留（6 公式/9 调用）；另有源悬空服务 1 个。
- 完整结论已写入 V5 案例目录 `conversion-report.md`，下一步只等用户审阅；不自动修复或启动第 12 例。

## 2026-08-04：第 11 例三类转换器错误修复授权

- 用户已明确要求“修复”，范围为第 11 例报告确认的 3 类错误；源案例悬空服务保持报告结论，不由转换器自动补造。
- `AGENT.md`/`CLAUDE.md` 要求修复验证后自动执行 tov5parser 提交推送、Lambda 部署、VxEditor41 同步提交推送，无需再次询问。
- VxEditor41 工作区已有大量与本任务无关的用户修改；只允许同步转换器对应文件并精确暂存。
- `convertEditorValue` 当前逻辑：对象公式只检查/解析 `value.code`；`_code` 完全未参与转换。这解释了有效 V4 运行码仍被 dropped。
- `getLegacyFormulaTextValue` 是动作参数文本兼容的正确扩展点。已有规则严格按参数名及形态收窄，但未覆盖 `toast`；本例 7 条 code 前有空格，且应结合 `str` token 判断，而不能只看“中文可作标识符”。
- `genSysutilMethodAST` 依赖 MapCreator sysutil map；未知 `$SF_sys_multiObjListToObjArr` 会主动抛 ParseError，随后 full-js fallback 把伪方法保留下来。应优先补标准 sysutil AST 映射，前提是确认 V5 运行时真实函数名与语义。
- V5 runtime 已确认支持 `$sys.util.sys_multiObjListToObjArr(value)`：`ast2js` 会把 sysutil AST 编译成该调用，而 player 将整个 `sysFunc` 模块作为 util 注入。最小修复是补 legacy funcName → 同名 sysutil AST 映射。
- 第 3 类不应在 `jsfn` 文本层做字符串替换；结构化 sysutil AST能同时正确承接 receiver 和循环/动作参数，且与运行时真实函数对齐。
- 裸调用公共转换 API 不会自动装入 CLI 使用的 runtime map，不能用来探测真实 `_code`；必须复用 `load-runtime-maps` 流程或测试 helper，避免把环境初始化错误误判为公式解析结果。
- 加载 runtime map 后的真实探测表明：`_code` 可被 full parser 接受，但输出 jsfn 保留 `$sys.util.getSelf/objArr_rowItem`。由于 V5 jsfn 的 `new Function` 无词法闭包，`$sys` 不可用；因此 `_code` 不能直接作为通用 fallback。
- 安全方向是只修复 editor code 中可机械证明的多余尾部右括号，并以 `_code` 存在为兼容信号；这样仍让原有 V4 伪语法转换器负责 refs/sysutil/循环变量映射。
- 7 个真实 toast 参数的 token 形态完全一致：`code` 为一个前导空格加中文提示，`str` 是两个纯 `str` token（空格、中文正文），拼接后严格等于 `code`；因此可在 `name === 'toast'` 下利用“全纯文本 token + 拼接一致 + 中文正文”作窄兼容判断。
- `V4FormulaCodeConverter.parseStr()` 已经按“jsep 失败 → full JS 失败 → 空 val”内部吞掉解析错误，所以公式入口无法通过捕获异常判断是否重试；尾括号修复必须在调用转换器前完成，或让转换器暴露成功状态。
- sysutil 生成的唯一拦截点是 `getSysutilInfoFromFuncName()`；这里补一项明确的 legacy 兼容映射即可让对象方法链生成 `op:'sysutil', val:'sys_multiObjListToObjArr'`，并避免进入危险的 jsfn 文本替换。
- 7 个 bgColor 的 editor `code` 都只多出最后一个 `)`；token 数组也把这个最后字符记录成独立 `type:'str', obj:')'`，而不是 `type:'bracket'`。这提供了比单纯括号计数更强的修复证据：只在 `_code` 非空、最后非空 token 是纯文本 `)`、且从 `code` 删除同一个尾字符后能够用 V4 parser 成功转换时才采用候选。
- 对照公式内部的正常闭合括号 token 都标为 `type:'bracket'`；因此最后这个 `str` 右括号可认定为历史编辑器误录字符，不需要从 `_code` 反编译回 editor 语法。
- 首次实现的真实门禁失败原因已精确定位：真实 editor code 含 `$P_row:` 参数提示，裸 `jsep(candidate)` 会在字符 60 报 `Expected comma`；正式 `parseStr()` 在解析前会先执行 `replaceSFParamPrompt()` 删除 `$P_*:`。因此候选可解析性检查必须复用同一预处理，不能在原始 editor code 上直接调用 jsep。
- 真实 `_code` 本身经 Acorn 完整解析为 262/262 字符，运行码有效性门禁没有问题；唯一未命中项是候选漏做 V4 参数提示预处理。
- 最终尾括号兼容实现复用 `V4FormulaCodeConverter.replaceSFParamPrompt()` 后再用 jsep 校验候选；真实 7 个公式均只删除 1 个尾字符，生成嵌套 `switchexp`，而无 `_code` 或尾 token 为 `bracket` 的反例仍降级，不会被误修复。
- 最终真实重转诊断从 96 降到 76，恰好移除 7 个 `Unexpected )`、7 个 `unknown varType` 与 6 个不支持 multiObj sysutil 的诊断；`dropped` 从 7 降为 0。
- 结构化 multiObj 在 6 个目标公式中产生 9 次 sysutil 调用，与源公式调用次数一致；`ast2js` 实际执行回归证明运行链路调用 `$sys.util.sys_multiObjListToObjArr` 后能正确 map 出字段值。
- 第 11 例修复后 V5 为 3,673,452 bytes，SHA-256 `574466a82d52a094df4e102c6b29123132a2d339543fb923bcfcaa89fac81168`；76 个 jsfn 语法/参数完整，节点 1,922/1,922，data-if、服务、后台编译与上传回调审计均无回归。

## 2026-08-04：clothing 第 12 例 `分类设置_11020389_温晓华`

- 源目录稳定排序第 12/51，nid `11020389`；下一例为 `加工方案_11391428_温晓华.json`，本例汇报/修复完成前不启动。
- 只读数据库唯一命中：标题“服装—分类设置”、V4.1、`ntype=1`、版本 `258`、`work_id=cajv259l9ispg1dl0n3g-1463`、gid `25391`，`verDetail=null`；源文件标注作者温晓华，数据库 uid 账号为 `staff238@ih5.cn`，不据邮箱推断姓名。
- 最新 `/work/load` 返回 1,273,040-byte 二进制、2 个压缩分段；解码 V4 为严格紧凑 JSON，16,052,833 bytes、SHA-256 `e51e450d3b21939ba458e408499adf1a5b5529eba4a3f4b3c01ec8e40f96ad04`，三棵树与根类型完整。
- `ntype=1 --diag` 转换退出 1、0/1 成功；直接原因是 `convertBlockCons` 对首条启用条件 `flag:'or'` 创建空 OR 分组，随后 `genConObj(undefined)` 解构崩溃。普通 `&&`/`||` ParseError 是此前可诊断 fallback，不是中止原因。
- V4 精确存在 2 个该形态且字段完整的条件块：BID `cmjezgpa3j50000rsdm0`（规格为空 OR approveStatus 属于 `[2,3]`）与 BID `cfqfjv3a3j50000a2erg`（值属于 style/template/process/processGroup/measureBody）。这是转换器未兼容组首 OR 标志，不是源字段缺失。
- V4 基线为 4,914 个真实组件节点、7,746 个非 root 事件块、1,678 个条件块/1,889 条启用条件、32 个 data-service、251 个 data-if；首条 OR 形态仅上述 2 块。
- 转换失败后没有 `app.v5.json` 或诊断半成品；V5 目录只保存 `conversion-report.md`。必须修复并重转后再执行节点、事件、jsfn、data-if、服务与测试全审计。
- 首条 OR 分组、嵌套绝对 URL、full-js 零参 `$SF_getSelf()`、上传 callback 缺占位四项均已做通用窄修复。项目全量 69/69；真实 V5 10,236,002 bytes，SHA-256 `797c5a51fbf11fc6e98361f1f301df55a4fc2cff6db0b6ff0a1467b71881c9b8`。
- 修复后 766 个 jsfn 全部非空、可编译、参数完整且 `$SF_*` 为 0；10 个 uploading status（8 uploadPic、2 uploadFile）10/10 生成 alambda 并保留全部子动作。事件差集只剩按设计折叠的 status 容器。
- 两个首 OR 条件最终分别为 2/5 分支、无空分支；`cnmv4ah...` 的 uploadUrl 精确保留，旁边 `param.fileUrl` 仍为参数 AST；251 个 data-if 全走 `conditionVal.ast` 且无 `binds.value`，32 个 data-service 编译态完整。
- 最终诊断 810/662、dropped 1：节点 `cc3fba5a3j50000z09f0` 的 editor code 多右括号但 `_code` 又完全没有 sort，二者业务语义冲突，转换器不能选边。裸 `a/c` 公式和 3 个缺失服务目标也在 V4 中原样存在，均列为源案例问题。

## 2026-08-04：clothing 第 13 例 `加工方案_11391428_温晓华`

- 源目录稳定排序第 13/51，nid `11391428`；下一例将在本例汇报并经用户确认后才开始。
- 只读数据库唯一命中：标题 `FRP_款式_加工方案`、作者罗安琪（账号 `staff96@ih5.cn`）、V4.1、`ntype=1`、版本 251、`work_id=cl8rtss728sptj9bfm30-520`、gid 25391、eid 10000586，`verDetail=null`；源文件名标注作者温晓华，报告需同时保留来源与数据库当前元数据。
- 最新编辑器 `/work/load` 返回 747,464-byte 二进制和 2 个压缩分段；解码为完整紧凑 V4 JSON 8,878,621 bytes、SHA-256 `34a60030e47b5d60a8a2218c1d1dac6f0db56ea9a9695ecb9e62631d7e2b66eb`，顶层 `case/server/stage` 与根类型完整。

## 2026-08-04：clothing 第 13 例审计续记

- 案例：`加工方案_11391428_温晓华`（nid `11391428`），数据库确认 `edt_ver=4.1`。
- 转换命令成功生成 V5；初步诊断指标为 total 107、jsfn fallback 106、dropped 1。
- `dropped` 尚未分类为源案例问题或转换器问题；需结合 V4 原公式和 V5 落点完成判定。
- 唯一 dropped 的精确落点：`cpx1pf1a3j500009dc60` / `fireService` / `session`。V4 `code` 为 `6a939b74c7b83df984bb4ae9be230a18`，且 `str` 是两个 `type=str` 文本片段；当前 V5 生成了缺失 `val` 的参数节点，实际服务入参已经丢失。
- 责任路径为 `v4ToV5/utils/action.js#getLegacyFormulaTextValue`：已有纯文本 token 证据逻辑，但白名单未覆盖 `session` 十六进制令牌。由于该值不是合法 JavaScript 标识符、又有完整纯文本 token 证据，应作为转换器漏判纳入修复候选。
- 本例将按既有 clothing 报告口径审计，不把 106 条 `jsfn` fallback 本身当作错误；只有实际落空、不可编译、缺参、旧运行符号或源/V5 结构差异才计入问题。
- 结构结果：严格组件 3,304/3,304，唯一 ID 3,292/3,292，节点差集 0；V4 非 root 事件块 4,480 个，BID 缺失 0。
- 实际 V5 `jsfn` 共 106 个：空代码 0、编译失败 0、形参/实参数量不一致 0、`$vN` 缺参 0、旧引用残留 0、自由变量异常 0。
- data-if 236 个；235 个正式条件完整。`cx22keda3j500001y4tg` 在 V4 的 `props.condition=null` 且旧 value bind 为空 `_code/code`，所以 V5 仅保留空兼容 bind，不是条件丢失。
- 悬空服务目标（均在 V4 已缺失）：`cc6rwy3a3j500003shvg` 1 次可达；`cd6g7t7a3j50000aa3tg` 3 次中 1 次可达、2 次位于禁用祖先下；`cd6g7t7a3j50000aa3z0` 2 次中 1 次可达、1 次自身禁用。
- 可达悬空调用分别位于函数组“获取款式样板相关”“过滤方案筛选”“接收过滤方案”；V5 保留相同 runsvc，禁用父动作 `cdkj1vfa3j5000001hzg` 正确转为 `skip:true`。
- 上传动作 `ccswm582ntpg000kxda0` 及 3 个 uploaded 子动作全部保留；52 个服务 `_code` 均非空且语法可解析。项目测试 69/69 通过。
- 本例最终结论：转换文件生成成功，但 `session` 业务值明确丢失，当前转换不通过；等待用户审阅并决定修复。下一例为 `包装等级预设_11370983_温晓华.json`，本轮不启动。
- 用户已授权修复。最小规则候选：仅当动作参数名为 `session`、V4 `str` 全部为纯文本且逐字拼接等于 `code`、并且值严格匹配 32 位十六进制字符串时恢复为普通字符串；真实公式仍走公式转换，避免扩大文本吞错范围。
- VxEditor41 工作区在同步前已有大量用户修改，均不属于本任务；后续精确核对 `src/utils/convertV4ToV5` 的目标文件并只暂存该文件，禁止混入现有修改。
- 最终实现规则为 `name === 'session' && hasPureTextTokenEvidence && /^[0-9a-f]{32}$/iu`；这会保留大小写十六进制 token，同时拒绝缺 token、其他参数名与一般 JavaScript 公式。定向和全量测试均通过。
- 真实重转验证闭环：目标 `session` 普通值完整，dropped 清零；其余结构指标与修复前完全一致。新 V5 为 6,666,301 bytes、SHA-256 `1ce9f60b39076d6921b538f05c3b30ca78dfa30df8e165a35b908498f899d489`。
- Lambda 生产版本 16 已承载提交 `3e7f0e2` 的修复，代码摘要 `qLu1kM+jdcZs+JILCXRWXknYlBLMlatWZrnO7JvJV4o=`，`prod` 冒烟通过。
- VxEditor41 同步只涉及 `src/utils/convertV4ToV5/utils/action.js`；定向静态检查无告警，完整构建 0 error。33 个 webpack warning 均来自仓库其他既有/用户修改文件，与本次 7 行转换器同步无关。
- VxEditor41 同步提交为 `70bc972c19fc87ea1ad5e7f875cff27d60157428`，已推送且与远端无分叉；用户工作区既有修改未混入。
- 最终发布闭环：tov5parser `3e7f0e2ce32a184968034d2eb6c6fe23b36a0b19`、Lambda prod 版本 16、VxEditor41 `70bc972c19fc87ea1ad5e7f875cff27d60157428`；第 13 例修复通过并等待用户继续指令。

## 2026-08-04：legacy Formula 字符串识别架构复核

- 当前 `getLegacyFormulaTextValue`、条件右值兼容和 `ObjJsonMultiPaths` 嵌套 URL 分别维护窄规则；`session`、是否文本、toast、path/CSS、info/reason、URL 等确实属于模式枚举，用户对长期扩展性的担忧成立。
- 不能直接用“全部 token 为 `str`”作为统一字符串规则：扫描当前 15 个已保存 V4 案例得到 40,956 个全 str-token 动作 Formula，其中带引号字符串 15,031、数字 12,014、关键字 2,397、普通标识符 3,574、其他可解析形态 7,745、无效 JS 仅 195；同一表示同时承载字面量和真实公式。
- 仅用 JavaScript 能否解析也不能消歧：中文“否”等可成为合法标识符，解析失败又可能是真正的源公式错误，不能一概吞成文本。
- 推荐统一抽象为 `resolveLegacyValue(context) -> literal | formula | unknown`：优先语义 token 与参数/服务/函数组类型契约，其次标准字面量解析，最后才使用 URL/CSS/十六进制等高置信形态；未知情况保留诊断。DB 成功条件“是/否 → boolean”属于 API 语义迁移，仍需独立适配。
- 当前虽取得部分 `paramType`，但字符串兼容入口没有使用它，且自定义服务、函数组和 paramsAsObj 的契约并不完整；真正重构需先统一参数契约采集，不应只合并成更大的正则。
- 参数契约的作用是把判断问题从“值长得像什么”提升为“接收方要求什么”：同一 `code:'否'` 在 String、Boolean、Number、JsonVal 上需要不同处理。组件方法来自组件映射，服务与函数组来自案例内动态定义，因此三类契约都需收集。
- 契约不是万能答案：Formula/JsonVal 仍可能过宽，缺失契约也必须回到 token/字面量/unknown 路径；DB 成功状态“是/否 → boolean”仍是独立的 V4→V5 API 语义适配。
- `_code` 适合作为交叉证据而不是主判断源：15 个已保存 V4 案例共有 246,505 个带 `code` 的对象，只有 37,643 个带非空 `_code`（约 15.3%）；80,103 个具备“纯 str tokens 且拼接严格等于 code”的对象中，仅 297 个有非空 `_code`（约 0.37%）。第 13 例丢失的 `session` 实物也只有 `code + str`，没有 `_code`。
- 更稳健的统一判断应先把 `code`/`_code` 解析为 AST 并按形态分类：显式引号字符串、数字、布尔、null 等可直接定型；成员访问、调用、运算及已知 V4 引用可判公式；裸 Identifier 必须进入当前作用域符号解析，不能因为语法合法就认定为变量，也不能因为未解析到符号就自动认定为字符串。
- `_code` 与 `code` 同向时可提高置信度；两者冲突时必须降为 unknown/诊断。此前真实案例存在 editor `code` 包含 sort、运行 `_code` 丢失 sort 的语义冲突，证明不能无条件以 `_code` 覆盖 `code`。
- 推荐证据顺序修正为：原参数非 Formula 的结构类型 → code/_code AST 形态 → V4 语义 token → 当前作用域符号表 → 接收方契约/默认值软证据 → 高置信内容形态 → unknown。这样 URL、十六进制 session 等通常可以由通用证据组合识别，正则只保留极少兜底。
- 与用户进一步确认后调整主输入顺序：`code` 是普遍存在的主要判断源，`_code` 因覆盖不足只交叉验证。明确引号字符串/数字/布尔可由 code AST 直接定型；引用、调用和能在作用域中解析的 Identifier 判公式；裸 Identifier 未解析或 code 解析失败时，再依靠 `str` 是否含 obj/cbParams 等语义 token、纯文本拼接一致性及契约决定 literal/formula/unknown。解析失败本身不能推出字符串，否则会掩盖真实损坏公式。

## 2026-08-04：事件级最终 code/_code 能否反推参数类型

- 第 13 例目标 tap 事件路径 `$.stage.children[1].children[8].events.list[0]` 同时具有 518 字符 `code` 与 523 字符 `_code`；二者都包含目标调用 `$sys.invoke('cdeafmya3j50000jexx0', ...)`。
- 虽然动作参数自己的 `session.value` 只有无引号 `code:'6a939b...' + str tokens`，事件级最终代码却明确生成 `'session':("6a939b74c7b83df984bb4ae9be230a18")`。同一对象中的 `auth` 保持 `(6)`，`formData/formId/innerCode` 保持 `$refs...`，说明事件生成器已经把文本、数字与引用区分开，事件代码可作为强语义回证。
- 该事件的 `code/_code` 只在回调 detail 上不同：editor code 保留 `cbParams.$SF_getSelf()`，runtime `_code` 改写为 `$sys.util.getSelf(cbParams)`；目标 session 在两者中完全一致。因此本例使用任一个事件字段都能确认 session 是字符串。
- 15 个已保存 V4 案例共有 13,360 个 stage/server 事件，其中 13,068 个同时具有非空 `code` 和 `_code`，覆盖率约 97.8%；没有只存在其中一个字段的事件。stage 为 11,709/11,918，server 为 1,359/1,442；其余 292 个无最终代码，需继续确认是否只是空事件。事件级代码的覆盖率远高于参数对象自己的 `_code`。
- 13,068 个双字段事件中 7,668 个 `code === _code`，5,400 个存在运行态重写；这说明二者可互证，但 `_code` 仍可能包含 V4 运行时规范化，不能简单视为原 editor code 的同义字段。
- VxEditor4 的保存源码 `src/store/modules/event.js#saveNodeEvent` 明确在保存时对每个启用事件调用 `saveDealSpec(v.tree)`，再把返回的 `item.code`（含条件与行号处理）写入事件 `v.code`；因此事件级 code 是从同一事件树重新编译得到的最终执行逻辑，不是用户随手维护的独立文本字段。
- V4 保存代码还会为函数组、假事件和普通事件分别处理，且仅在生成结果非空时写入 code；这解释了无代码事件可能是空/禁用/未生成事件。下一步需读取公式 token 与动作参数的生成路径，确认字符串引号是由通用 token 编译器产生，以及事件级表达式如何稳定回映到具体 action param。
- 动作生成路径确认：VxEditor4 `event.js` 在处理 `Formula/FormulaColor` 参数时调用 `formulaValue(v.value, info)` 得到最终参数表达式；原生 `Text/String` 参数则直接 `JSON.stringify(v.value)`。因此事件级 session 的双引号不是事件字符串搜索偶然匹配，而是 V4 参数编译函数的输出。
- 公式编译函数定义位于 `VxEditor4/src/store/modules/event/eventFuncs.js:2706`；需继续读取它如何根据 token 序列生成普通文本与对象引用，以确认能否直接在转换器中复用相同判定而无需反解析整段事件代码。
- `formulaValue(input, info)` 实际按 token 顺序生成两套结果：每个 `str` token 都先经过 `formulaStr(v.value)`，每个 `obj` token 则走对象/当前值/循环变量等结构化分支；开启 V4.1 代码生成时并行累积 `formulaCode`。所以事件代码中的类型结论源自参数局部 token 编译，理论上可直接复刻 `formulaStr + token` 规则，不必先解析整段事件代码。
- VxEditor4 的 `formulaStr` 是现成的通用启发式：非数字、非逗号且没有运算符号的文本（或 MIME 专有名词）用 `JSON.stringify` 变成字符串；`true/false/null/undefined/$any` 保留特殊语义；`param/System/ids/Math` 开头、含运算符的表达式继续按公式；完整 URL 另行字符串化。它能统一解释 session、中文提示、普通英文文本和 URL，不依赖参数名枚举。
- 但 VxEditor4 旧源码的 `formulaValue` 输入是 `{type,value}` token 数组，而下载的 V4.1 参数保存形态是 `{code,str:[{type,obj}]}`；且 session 保存为相邻 `"6" + "a..."` 两个 str token，若机械逐 token 套旧 `formulaStr` 会得到非法拼接，和事件最终整体字符串不一致。必须继续检查 VxEditor41 的 V4.1 事件编译路径或其 token 归并步骤，不能直接照搬旧函数。
- VxEditor41 已找到对应 V4.1 实现：`src/utils/genCodeExtract.js#formulaValue(originValue, info, conType)` 先调用 `decodeFormulaCode(originValue, info)` 把整个 `{code,str}` 公式解码成一段 code，再对完整 code 调用 `formulaStr(code, conType)`，最后按需要加括号。它不是逐 token 调 `formulaStr`，所以 session 的相邻 `"6" + "a..."` 会先合并为完整十六进制串，再整体 JSON.stringify，和保存的事件代码完全吻合。
- VxEditor41 的 `src/stores/funcs/codeUtils/formulaStr.js` 也保留同一通用规则，并新增 V4.1 内部变量白名单（`$refs/cbParams/$curValue/$curPathValue/...`）、带空格 URL、百分比等兼容。由此可确认：V4.1 自身已经有“decodeFormulaCode → formulaStr”的统一判定器，优先复用它比反解析事件最终代码或继续枚举参数名更合理。
- `decodeFormulaCode` 的具体链路是：字符串原样、null 转空串、对象交给 `getFormulaCode(originValue)`；随后有 block/info 时再执行 `dealCode`，把 `$curUser/$curPathValue` 等上下文占位符转换为事件运行表达式。因此“字符串还是公式”的基础判定主要可由 `getFormulaCode + formulaStr` 复现，`dealCode` 属于后续上下文语义转换，不必混入字面量分类器。
- VxEditor41 同时存在保存用 `genCodeExtract.js` 和事件视图用 `genCodeUtils.js` 两份等价的 `decodeFormulaCode/formulaValue` 实现，说明该链路是 V4.1 的正式生成规则而非遗留备份。
- `genCodeExtract.js#getFormulaCode(codeItem)` 对普通公式对象直接返回 `codeItem.code`；因此 V4.1 的核心判定实际就是 `dealCode(code, context) → formulaStr(完整 code)`。第 13 例无需依赖事件字符串反解析：直接把同源 formulaStr 应用于参数 code，就会把无运算符、非数字的十六进制串 JSON.stringify 为字符串。
- VxEditor41 `savePage.js#genNodeEventCode` 会为前台节点从结构化 block 重新调用 `genCodeExtract.genCode` 写入 `event.code`，再调用 `convertCode(event.code)` 写入 `_code`；后台节点有注释“暂时不需要重新生成 code”。所以事件代码可作为强回证，但前后台新鲜度并不完全相同。
- 直接从整段事件代码反推参数仍有结构性成本：存储代码不包含 BID，嵌套条件、循环、回调和同一方法重复调用会使“某个字符串属于哪个 action param”的映射复杂；既然生成器的局部规则可直接复用，反解析事件应只用于转换后审计/交叉校验，而非主转换路径。
- 292 个无最终 code/_code 的事件并不全是空事件：254 个含动作，244 个含 `enable !== false` 的动作；总计 800 个动作块、743 个动作自身启用。141 个事件根整体禁用、38 个无 children，其余还包括函数组/特殊/未生成等形态。因此任何“只依赖 event.code”的转换都会留下真实覆盖盲区。
- 结论：事件级 code/_code 可以且应该用于高置信回证与回归审计；真正的通用转换判断应直接复用它的生成规则 `formulaStr(value.code, conType)`，再由现有结构化转换器处理 refs/调用/条件。这样既获得 V4.1 官方类型语义，也保留 BID/参数位置，并覆盖禁用或无最终事件代码的动作。

## Phase 81 实施设计

- 当前所有普通公式最终汇入 `utils/formula.js#convertEditorValue`，而动作文本枚举在 `utils/action.js#getLegacyFormulaTextValue`、条件英文文本在 `utils/con.js#getLegacyConditionTextValue`、嵌套 URL 在 `actionParamConvert.js#getLegacyMultiPathTextValue`。将同源分类放进 `convertEditorValue` 可以统一覆盖普通动作、条件、嵌套对象值和属性绑定，避免三处分叉。
- V4.1 `formulaStr` 能通用覆盖现有 session、toast、info/reason、CSS 尺寸、绝对 URL、中文/英文裸文本；`path='.style'` 因含点号会被官方 formulaStr 当表达式，仍需保留为特定 API/PathString 兼容。数据库成功“是/否 → boolean”也是 V4→V5 API 语义迁移，不能被普通字符串分类替代。
- 统一层只需回答“V4.1 是否把完整 code 编译为字符串”，无需把 V4 的 `replaceMathOp` 输出拿来替代现有 AST 转换。判断为字符串时直接生成 `{op:'val', val:原 code 对应文本}`；数字、布尔、null、refs、调用、运算和显式引号字符串继续进入现有 parser。
- 现有动作单测包含故意要求裸 `message`、非 session 十六进制返回 undefined 的旧窄规则断言；按 V4.1 官方 formulaStr，两者都应是字符串，需要升级为统一语义断言，并增加 `cbParams/$refs/param/System/Math`、运算符、损坏表达式等反例。
- 基线完整测试为 69/69。控制台 ParseError 均是既有 fallback 回归输出，无失败。
- V4.1 条件特殊值共 15 个 `$valid_*`，现有转换器 `getCtx` 已识别同一集合。公共分类器需接受 `conditionValue` 上下文，在条件右值上把这些 sentinel 保持为公式；普通上下文继续忠实于 V4.1 formulaStr。
- VxEditor41 strict URL regex 接受带协议/协议相对、localhost、IPv4、Unicode 域名、端口和路径；实现统一分类时应移植等价的只读匹配，不引入新依赖。带普通空格的 URL 按 V4.1 行为先去除空格再保存为字符串。
- VxEditor41 的转换器对应 `utils/formula.js` 与 tov5parser 结构高度一致，公共分类实现可在验证后做等价同步；编辑器侧使用绝对 alias 和无分号风格，不能机械覆盖整个文件。

## Phase 81 影响面审计结论

- 不能用“已保存的旧 V5 产物 vs 新 V5”直接归因本轮：15 份旧产物来自不同历史版本，会混入 data-if、当前路径、回调等前轮修复。权威影响口径改为固定 Git `HEAD=2bc990d` 与当前工作树分别转同一 V4。
- 15 例精确基线对比排除随机 XID/生成类型名后，共 17 个叶子差异，实际是 11 个 Formula 值：8 个旧规则曾错误 `trim`的前导空格被恢复，3 个无参 `jsfn` 被正确改为普通字符串（其中 PAD 同源案例重复 2 处）。
- 所有启用动作的改变都可在 V4 事件 `code/_code` 中看到对应带引号字符串，并且前/后空格与 Formula `code` 一致；唯一无事件回证的 ` 保存失败` 来自 `enable:false` 动作，经同源 `formulaStr` 本地规则仍明确为字符串。
- 第 13 例在本轮前已由 session 窄规则得到正确 AST，因此切换为通用规则后语义差异为 0；该结果证明本轮是“用官方统一语义替代专例”，没有改变已修复的 session 结果。

## Phase 81 发布结论

- tov5parser 统一分类实现已以提交 `4177d62` 推送；完整测试 70/70 通过。生产 Lambda 已发布版本 17，`prod` 冒烟成功。
- VxEditor41 已同步同一规则并以提交 `1c5b35ebd` 推送；完整生产构建 0 error，既有 warning 不属于本轮转换器改动。
- 本轮把分散的 session、提示语、条件文本、URL 等识别收敛为 V4.1 官方 `formulaStr(code)` 同源规则；只保留 `.style` 路径与数据库成功状态布尔迁移这类真正的 API 语义适配。

## 2026-08-05：clothing 第 14 例 `包装等级预设_11370983_温晓华`

- 源目录按字节序共 51 个 JSON；`包装等级预设_11370983_温晓华.json` 确为第 14 个，前一例是 `加工方案_11391428_温晓华.json`，下一例是 `各单列表_11277016_叶育科.json`。
- nid 从文件名提取为 `11370983`。本项目 `localCases/v4/clothing` 与 `localCases/v5/clothing` 当前均没有该案例目录或文件，不存在旧缓存需要覆盖。
- 已重新定位中文服只读数据库交接包与现成导出脚本；本例仍沿用已验证的参数化只读查询和编辑器 `/work/load` 完整二进制解码口径，不使用源目录中的旧 JSON 作为转换输入。
- 中文服只读隧道 `127.0.0.1:13306` 正在监听；隔离 PyMySQL 可正常连接 `vxshow`。参数化查询固定 `d.nid=11370983`，唯一命中 1 行。
- 数据库确认本例为 V4.1：`data_edt_ver=node_edt_ver=4.1`、`verDetail=null`；`ntype=1`、版本 33、最新 `work_id=ckp2sj0sd9i7dpjiuerg-86`、gid 25391、eid 10000586。
- 当前标题 `FRP_包装等级预设`，数据库作者罗安琪（账号 `staff96@ih5.cn`，uid 10000588），源文件名标注作者温晓华；两者需分别记录。作品未删除，data/node 均已发布且已上架，链接码 `RG0JIklr`。
- 最新完整 V4 下载当前受鉴权阻塞：本地中文服 Cookie 返回 HTTP 203；应用内浏览器无法完成同源导航；Chrome 扩展可枚举现有 `dev.ivx.cn` 标签，但两次均无法在 30 秒内认领。不得改用源目录旧 JSON 冒充最新版本；必须等待用户刷新 Cookie 或建立可接管的 `editor.ivx.cn` 登录页。
- 下载失败发生在创建案例目录之前；第 14 例本地没有 V4/V5 产物或半成品，前 13 例数据均未删除或改动。
- 用户更新的有效 Cookie 位于 `/Users/lianghuang/Documents/docs/auth/.platform_cookie`，204 bytes、权限 `0600`、修改时间 2026-08-05 10:41:36 +0800；旧 `SecretRoot.local.env` 变量未同步。下载器只在内存读取该文件且没有输出内容。
- 最新 `/work/load` 请求成功：HTTP 200、`application/octet-stream`、505,936 bytes；解码为 2 个压缩分段和 6,148,595-byte 紧凑 JSON，SHA-256 `92ad0bc3ffc3055804f30c10fae4814f2429e0bd4b91e08d60dfbb76309ac651`。
- 解码结果顶层完整包含 `case/server/stage`，根类型分别为 `ih5-case/data-server/ih5-stage`；`app.json` 权限 `0600`，可以进入 `ntype=1` 转换。
- 当前转换器对第 14 例转换成功：V5 `app.v5.json` 4,276,540 bytes、SHA-256 `05962c14922b697a3ae8818a3c316fa0151a167d4f5858d1c20f2cca77b93789`。
- 结构化诊断共 55 条且去重仍为 55：全部是 `custom-expr-fallback`，`dropped=0`。主要类别为 `&&` 21、`||` 14、unknown varType 6、正则 Literal 6、hasOwnProperty 3，其余 full-js 2、findIndex/callee 各 1。
- 55 条 fallback 是否真正安全仍需以最终 V5 `jsfn` 的静态语法、args/占位符和 legacy 符号审计为准；不能仅凭 dropped=0 判定通过。
- 第 14/51 例 `包装等级预设_11370983_温晓华`（nid `11370983`）为数据库当前 V4.1、ntype 1、作品版本 33；最新完整 V4 已从中文服 `/work/load` 成功下载，解码后 6,148,595 bytes，SHA-256 `92ad0bc3ffc3055804f30c10fae4814f2429e0bd4b91e08d60dfbb76309ac651`。
- 第 14 例转换成功生成 4,276,540-byte 紧凑 V5，诊断 55 条且 `dropped=0`；但 `dropped=0` 不能替代最终 AST 审计。
- 第 14 例 V4/V5 组件均为 2,311 个（唯一 ID 2,302），缺失/新增均为 0；9 个重复 ID 来自 V4 且 V5 原样保留。2,805 个 V4 动作块的启用 BID 全部存在对应 V5 `ln`；595 个未映射 BID 全是事件 root 容器。
- 第 14 例 55 个 `jsfn` 均可解析，参数数组和 `$vN` 占位均闭合；其中 4 个仍含自由变量 `fParamcf4zq1ca3j50000cmes0`，分别位于启用动作 `cf4zqsqa3j50000cmg4g`、`cf4zq1ca3j50000cmf2g` 的两项 `arrUpdate.updates`。
- `cf4zq1ca3j50000cmes0` 在完整 V4 中不是组件 ID、事件 BID 或引用目标。受影响 Formula 的 `str` token 明确为 `{type:'param', obj:'value|name', extra:{type:'funcGroupParam'}}`，所在当前函数组 `cf4zjzva3j50000cmang` 也声明 `inParams=['value','name']`；因此可按 token 类型 + 当前函数组契约恢复，不需要把任意未知标识符猜成参数。
- 第 14 例 224 个 data-if 中，223 个源正式条件全部转成 `props.conditionVal.ast` 且无 `binds.value`；唯一 `cmqsrcha3j50000f3mx0` 是 V4 源空条件和空 bind 占位，V5 `{op:'val'}` 符合已确认兼容兜底，不是条件丢失。
- 第 14 例 22/22 个 data-service 均有可解析 `_code`；V4/V5 服务调用均为 103 次且目标完整。32 位 session `54aae5de50ba316f9b1e4e59322bb81e` 正确转成字符串值；1 个 uploadPic 及其 status/3 个子动作均保留。
- 第 14 例项目全量测试 70/70 通过；案例报告已生成，当前结论为“转换产物有 4 处同类运行错误，等待用户确认修复”，第 15 例未启动。
- Phase 82 最小复现确认：同一当前函数组 `group1` 内，`fParamgroup1.value` 正确生成 `ref:['param','value']`；把 code 前缀改成不存在的 `fParamstale.value`，即使 Formula token 明确是 `funcGroupParam/value`，当前仍报 `unknown varType` 并回退为无参 `jsfn("fParamstale.value")`。修复应只扩展 `getCtx` 的旧前缀解析兜底，不改正常参数 AST 结构。
- Phase 82 修复规则已实现于 `utils/formula.js`：原后缀 ID 能解析为函数组时保持旧逻辑；只有后缀 ID 无效、当前事件所有者是函数组、Formula token 明确给出 `funcGroupParam`、引用成员同时命中 token 名与当前 `inParams`，且该旧标识符没有成员访问以外用途时才恢复为 `varType:'param'`。
- Phase 82 回归同时覆盖反例：正常 `fParam<当前ID>` 不依赖 token 仍保持原 AST；缺少 funcGroupParam token，或 token 参数名不在当前 `inParams` 中时，未知旧前缀仍保留 fallback，不被猜成当前参数。定向测试 1/1 通过。
- Phase 82 完整项目测试已从 70 增至 71，结果 71/71 通过。真实重转第 14 例后诊断 55→51，减少的正好是 4 条旧 fParam `unknown varType`；`dropped` 仍为 0。
- 两个目标 BID 重转后各包含 1 个 `ref:['param','value']` 和 1 个 `ref:['param','name']`，旧 `fParamcf4zq1ca3j50000cmes0` jsfn 残留均为 0。全案例 `jsfn` 55→51，51/51 的语法、参数、占位符、自由变量和 legacy 可执行标识符审计全部通过。
- 最终代码再次重转后 V5 为 4,276,816 bytes、SHA-256 `19ec125d195cc70c85b1966c5d2c6846635d087ab4481c1521793ec3a0ff6c43`；诊断 JSON 33,352 bytes / `08f0b662b42039783f06071642410176d026a50813d72ded9393567022d4ce75`，诊断 Markdown 13,709 bytes / `0ee4af260e2552701230caa7b63a0af42e01782d99f0da09fafd3195c0905f3f`。两次成功重转 V5 的哈希差异来自既有随机 ln/XID，体积与语义审计一致。
- Phase 82 发布闭环完成：tov5parser `4aa0a26a9e4071fb35e56d34f770c7cd10dd1e40` 已推送；Lambda `prod` 指向版本 18，CodeSha256 `En3ggJjZJ/58UDKAka/yHawbWEEiswS6K/ZERfDB4jU=`，状态 Active/Successful 且冒烟业务 code 0；VxEditor41 `e32b73c71f5a8c936fb7773a5e46bcb1cafc7081` 已推送，生产构建成功。
- VxEditor41 只同步 `src/utils/convertV4ToV5/utils/formula.js`。其 `.gitignore`、`src/stores/event.js` 和多个新增界面目录仍保持用户原状态，未暂存、未提交；tov5parser 的无关未跟踪 `VxServer-saveAs-same-gid-group-db-fix.md` 同样未触碰。

## 2026-08-05：clothing 第 15 例 `各单列表_11277016_叶育科`

- 源目录按字节序共 51 个 JSON；第 15 个确为 `各单列表_11277016_叶育科.json`，nid `11277016`。前一例是 `包装等级预设_11370983_温晓华.json`，下一例是 `合同打印_11769634_叶育科.json`。
- 用户已解除第 14 例人工审阅门禁。第 15 例仍按“数据库版本 → 最新完整 V4 → 转换 → 静态审计 → 单例汇报”的顺序执行；此前案例全部保留，第 16 例不会提前启动。
- 中文服只读数据库参数化查询 `d.nid=11277016` 唯一命中 1 行：标题 `APS产单列表`、当前作者叶育科、uid 10187685、eid 10000586、gid 25391；V4.1、`ntype=1`、版本 368、`work_id=ci4j83h9b9knrnsao23g-408`，正式/预览链接码 `PQTOENfs`，data/node 均已发布并上架。
- 最新 `/work/load` 获取成功：HTTP 200、`application/octet-stream`、3,277,528 bytes；解码为 2 个分段和 40,393,710-byte 紧凑 JSON，SHA-256 `d4ff197e57593b66e7beffd2385e1afa078da8fe81270e00ba3aa5edfb638140`。顶层完整包含 `case/server/stage`，根类型分别为 `ih5-case/data-server/ih5-stage`。
- 当前转换器已成功输出 33,435,343-byte V5，SHA-256 `fd3be0aff1d297ab23366f6eaaca19e4ee6e1e85ed27f584972037a96e23f5b1`。诊断原始 1,285、去重 1,161、dropped 0；控制台 ParseError 是自定义表达式转 jsfn 的预期候选日志，最终结论以产物静态审计为准。
- 诊断高频原因是逻辑或 400、模板字符串 261、逻辑与 256、findIndex 93；其次为 SpreadElement 40、完整 JavaScript 37、flat 32、unknown varType 31。诊断仅说明结构化解析转入 fallback，不等同于 1,161 个运行错误；需检查 V5 最终 jsfn 的 code/args 和自由变量。
- 初步结构核对：V4/V5 组件 8,980/8,980，唯一 ID 8,959/8,959；根类型一致且 V5 `server.props.v2=1`。V4 事件树规模很大（action 9,846、con 2,820、root 2,195、status 1,199、loop 571 等），V5 共有 1,198 个实际 jsfn，需以专用脚本做计数而非展开对象。
- 第一轮实际产物审计已确认：9,485 个启用 action 的 BID 全有 V5 `ln`；1,198 个 jsfn 均可解析，形参/实参数与 `$vN` 边界全部闭合，未发现 `$refs/fParam/cbParams/param/$curPathValue/$SF_getSelf` 残留。56 个自由变量候选需进一步区分运行时提供的 `$curRowValue`/`numberPrecision` 与潜在真正自由变量。
- data-if 校准后：609 个节点中 604 个源正式条件全部生成 `props.conditionVal.ast`，5 个源空条件对应 5 个 V5 `binds.value` 兼容占位。服务调用 229/229；两个被调用目标 `cd6g7t7a3j50000aa3tg`、`cdeaf4wa3j50000jexv0` 在 V4/V5 严格组件树均不存在，共 3 次，倾向于源案例悬空引用，仍需定位源 action 回证。
- 最值得关注的 jsfn 候选是函数组“加工方案_初始化”、BID `d7b1aasa3j50000znc6g` 下的无参 `jsfn("key")`；其 V4 原式位于嵌套 `every(key => ... item[key])`。若 V5 回调作用域没有显式注入 key，这会是转换器错误。`$curRowValue` 9 处与 `numberPrecision` 8 处需先从实际 V5 运行时判定是否为合法上下文全局。
- V5 `ast2js` 的 jsfn 使用 `new Function` 且只注入 `val.slice(1)` 对应实参，无法闭包捕获任何外层局部变量。故 `jsfn("key")/args=[]` 与 9 个 `jsfn("$curRowValue.buttonText")/args=[]` 会读取未声明变量；numberPrecision 是否可用则取决于页面全局，可用 V4 最终事件代码及案例资源继续回证。
- 源案例组件 `stage.classes[0]...props.code` 明确定义 `window.numberPrecision`，V4 最终事件代码也有 4 个事件直接调用它；V5 jsfn 的 `new Function` 可以访问页面全局，因此 numberPrecision 不是转换错误。
- V4 最终事件 code 对 `$curRowValue` 的计数为 0，三组按钮动作均已替换为目标二维/对象数组的 `p_value[i].buttonText`；V5 中 9 个 `$curRowValue.buttonText` 无参 jsfn 与 V4 正式语义不一致，涉及 BID `cpn4rxka3j50000qp500`、`cppwajja3j50000bqc50`、`cpn4wpta3j50000qp6vg`。
- 五个空 data-if 节点源值都是 `{_code:'',code:''}`，V5 兼容输出 `{op:'val'}`；604 个正式条件则全部使用 `props.conditionVal.ast` 且无 binds.value，data-if 转换正确。
- 3 个服务调用的 2 个目标在 V4 源组件树已经悬空（`cd6g7t7a3j50000aa3tg`、`cdeaf4wa3j50000jexv0`），V5 保留同一目标，不属于转换器造成的丢失。
- 自由变量扫描中的其他名字均有案例自定义全局定义并在 V5 保留：`processPackageMaterials_1/2/_item`、`sortAndUniqueData`、`isToShow`、`formatData`、`checkMember`、`getElementHeight`。因此最终转换器错误仅为 `$curRowValue` 9 处和嵌套回调参数 `key` 1 处，共 10 个无参 jsfn、4 个启用 action。
- 唯一未映射的非 root 事件块是 uploadPics 的 `beforeUpload` status 包装；父动作与唯一子动作 BID 均有 V5 AST，子动作位于父动作回调中，属于容器不单独分配 ln，不是上传回调丢失。
- 第 15 例报告已落盘。转换器错误最终口径：当前行占位符未按动作上下文替换（3 个 BID、9 个 jsfn）+ custom-expression fallback 未保留嵌套回调 `key` 作用域（1 个 BID、1 个 jsfn）；其余诊断均已审计或回证为安全 fallback/源问题。
- 用户已授权修复上述两类错误。实现必须是通用规则：当前行值应复刻 V4.1 事件生成器按动作参数/目标数组/row 的语义；回调参数应在任意嵌套 custom-expression fallback 中保持自身词法作用域，不能针对 `key` 名字打补丁。
- 当前路径修复已有可复用架构：`convertEditorValue` 接受动作/参数上下文，`formula.js` 根据 action 与 param 构造目标值 AST。`$curRowValue` 应在同一层新增“当前行”语义，而不是进入普通 parser 后再针对输出字符串清理。
- custom-expression 普通 fallback 的 context 只有 `num/vList/jsFnArgs`；full-JS fallback 额外带 `fullJsMode/localNames`，并通过 `shouldWalkFullJsSubtree` 避免把含局部参数的回调子树拆散。普通 fallback 未复用这套局部名保护，是 `key` 被拆成独立 jsfn 的结构性差异。
- `$curPathValue` 的当前实现已具备准确的 Formula 位置解析：`setRowColsValue.colValue[*].value` 能拿到动作 row 和当前 col。当前行值的 V4 正式语义只需要目标值 AST + row AST；当前路径则是目标值 AST + row + col，二者可以共享定位/路径拼装基础设施。
- 对普通 custom fallback 增加 `fullJsMode/localNames` 比针对 `key` 加 getCtx 更通用：它同时保护 item/index/key 等任意层回调局部名，并沿用已有 full-JS walker 对外部 refs 的 `$vN` 参数化。
- `$curRowValue` 不能简单等同 `$curPathValue`：对 `setRowColsValue`，前者读取目标值的 row，后者读取 row+col；对 `setMultiValue` 亦是 row 与 row+col 的差异。回归必须明确断言 current-row 不带当前 col。
- current-row resolver 可以完全留在 `formula.js`：识别 token → 取 event action/target → 用现有 `findFormulaLocation` 确认参数位置 → 生成目标 value+row AST。actionParamConvert 不需要了解占位符。
## 2026-08-05 第 15 例：修复依据补充

- 受影响的三个动作目标节点 `cp544q22ntpg000yxjrg`、`cppwajja3j50000bqbp0`、`cp5af7c2ntpg000yygy0` 的类型均为 `data-obj-arr`。
- 因此 `$curRowValue.buttonText` 的 V5 AST 应以动作目标 `p_value` 为根，只拼接当前行索引和 `buttonText`，而不是保留 `$curRowValue`，也不是拼接 `setRowColsValue` 的目标列。
- VxEditor41 的 V4 生成逻辑已提供 `nodeIsArr2d` / `nodeIsObjArr` 类型判断，可作为转换器兼容 V4 语义的正式依据。
- `genCodeExtract.js` 中这两个判断不是硬编码节点名，而是读取 V4 `widgetMap[nodeType].map.isArr2d/isObjArr` 元数据；转换器侧需要用案例环境中可获得的节点类型/映射表达同一语义。
- 现有“legacy current-path”测试已经覆盖 `data-obj-arr + setRowColsValue + $curPathValue`，适合在同一动作中增加 `$curRowValue` 回归，并明确校验它只取当前行、不误拼目标列。
- 现有表达式测试已有 `assertJsfnArgumentsComplete`，可直接加入本例 `filter(...every(key => ... item[key]))` 的精确回归。
- VxEditor41 的节点判断最终均来自 widget 元数据：`map.isArr2d` 与 `map.isObjArr`，不是靠内容字面量枚举。
- 转换器已有的 `genLegacyCurrentValueCtx` 可以复用目标值 AST 和参数位置定位；新增 `row` 模式只需选择“当前行”路径，成员 `.buttonText` 仍交给通用公式 AST 转换。
- 普通 `processCustomExpr` 当前 context 只有 `num/vList/jsFnArgs`，而 full-JS context 还带 `fullJsMode/localNames`；这正是内层 `key` 被拆成无参 jsfn 的实现差异。
- 修改前定向回归结果：
  - 当前行用例断言目标 `obj-arr-var` 时失败，实际仍为 `{"op":"jsfn","val":["$curRowValue.buttonText"],"args":[]}`；
  - 嵌套回调用例明确发现 `jsfn.val[0] === "key"` 且 `args=[]`。
- 修复后当前行测试确认 AST 指向目标 `obj-arr-var.value[2].buttonText`，且没有误带动作目标列 `enabled`。
- 修复后嵌套回调 AST 可执行并正确筛出同时满足两个 department 字段的记录，不再产生独立无参 `jsfn("key")`。
- 完整测试 72/72 通过，说明为普通 custom expression 启用局部作用域保护未破坏现有结构化公式、full-JS、data-if、服务或动作转换回归。
- 真实重转后的 3 个目标 `setRowColsValue` BID 均生成 `目标.value[row].buttonText` AST；9 个 `$curRowValue` jsfn 清零。
- `d7b1aasa3j50000znc6g` 现在生成单个参数化 jsfn：内层 `every((key) => ... item[key])` 保持在同一代码作用域，外部 service/item 值分别作为 `$v1/$v2` 注入。
- 完整自由变量扫描仅剩 `numberPrecision`、`processPackageMaterials_1/2/_item`、`sortAndUniqueData`、`isToShow`、`formatData`、`checkMember`、`getElementHeight`，与修复前已回证的案例页面全局集合完全一致。
- 结构审计与修复前基线完全对齐：组件/唯一 ID、事件块、启用动作落点、data-if、服务定义和服务调用均无丢失或新增。
- current-row 的行定位最终直接复刻 V4 `genFormulaInfoPath` 使用动作参数位置的规则，不枚举 `row/rowNum/rowIdx` 名称；动作名、节点类型和 Formula 所在形状仍严格限定合法上下文。
- Phase 83 tov5parser 代码提交为 `80eb0df`。部署 clean-tree 检查只因既存无关未跟踪文档失败，不是代码/测试失败；不能为了部署删除、移动或提交用户文件。
- Phase 83 Lambda 发布闭环已通过：生产版本 19 与 `prod` 一致，CodeSha256 `AAiYLrkbsL/8LyE/sjF+GC6fJUZWlnWAah3QUDuOb/E=`，版本接口冒烟成功。
- VxEditor41 同步只需两个实现文件；该仓库没有对应自动测试文件。两文件定向 ESLint 0 问题且生产构建完成，用户已有界面/store 工作树改动未被覆盖。
- Phase 83 发布闭环完成：tov5parser `80eb0df518fd253993dd6e9f75e06d7f7ec94128`、VxEditor41 `6465d5f395be71b47fba15309ea65cfd0c96877b` 均与远端分支对齐；Lambda `prod` 指向 Active/Successful 的版本 19。

## 2026-08-05：clothing 第 16 例 `合同打印_11769634_叶育科`

- 源目录按字节序共 51 个 JSON；第 16 个是 `合同打印_11769634_叶育科.json`，nid `11769634`。第 15 例审阅门禁已由用户明确解除；第 17 例仍受门禁约束。
- 中文服只读隧道仍监听 `127.0.0.1:13306`；交接 env 位于 `/Users/lianghuang/Desktop/case-json-migrator/raw/lianghuang-cn-db-20260630/lianghuang_ro.mysql.env`，只读连接前置具备。
- 交接 README 明确该账号只读（SELECT、SHOW VIEW）且中文服目标库包含 `vxshow`；本轮可安全通过参数化单条 SELECT 恢复既有元数据查询。
- 参数化查询 `d.nid=11769634` 唯一命中：标题 `FRP合同打印`、当前作者叶育科，V4.1、`ntype=1`、版本 51、`work_id=csku1hsrf4hq141sk900-60`、gid 25391；data/node 均发布并上架，正式/预览链接码 `Ywbvp9ti`。
## 2026-08-05：V4 完整案例下载包格式（案例 16）

- 权威实现位于 `VxEditor41/src/components/stageProxy.js`。
- 加密包布局：前 8 字节为 salt，随后 12 字节为 IV，从第 20 字节起为 AES-GCM 密文及 128-bit tag。
- 密钥由固定密码 `Iyoh3ci0Keuchei6`、salt 和 1000 次 PBKDF2 派生。
- 解密后的前 10 个 32-bit word 是段信息：最低位表示该槽存在，其余位右移一位后为对应段字节长度；压缩正文从 `4 * 段数` 字节处开始。
- 每段以 raw deflate 解压并按 UTF-8 解析；第一段为 stage，第二段为 server。若 `server.case` 存在，应提升为顶层 `case` 并从 server 删除。
- 该格式允许直接获取完整的 `case/server/stage`，比原始清单 JSON 更适合转换与完整性审计。
- 本例线上完整包已按该权威实现成功解码：HTTP 200、219,768-byte 二进制，2 个解压段（2,096,408/42,351 bytes），最终 `app.json` 2,138,779 bytes，SHA-256 `7381a743a467e82961aa45441d929ca96398688ac21eec72f94a6066869e414f`。
- 解码结果顶层完整包含 `case/server/stage`，已连同数据库元数据保存于 V4 clothing 案例目录；未删除此前任何案例数据。
- 当前转换器已成功输出 1,826,566-byte V5，SHA-256 `6286b4172d958546ab184f33f69d249d1e0821ce3c61904e2de638d620f250ab`。
- 诊断原始/去重均为 81，dropped 0，全部进入 custom-expression fallback；控制台 ParseError 是结构化解析回退记录，不能直接判为运行错误，必须审计最终 jsfn 语法、参数闭合与源事件语义。
- 第 15 例报告提供了已校准的审计口径，可复用于本例；特别是 data-if 必须区分正式 `conditionVal.ast` 与源空条件的 `binds.value={op:'val'}`，事件容器也不能因没有独立 `ln` 就直接判为丢失。
- 本例严格组件树 V4 初算为 477 个且 ID 全唯一；组件事件仍含 V4 最终 `code/_code`，因此可用最终代码判断 callback/参数在 V4.1 中的真实替换结果。
- 第一轮审计未发现结构或事件映射丢失：477/477 组件、263/263 启用 action BID、16/16 正式 data-if、6/6 共享服务、8/8 服务调用全部对应。
- 81 个 jsfn 的语法、参数、占位符和 legacy 标识符检查全部通过。唯一自由变量候选为页面表达式中的 `NP`（9 处）；在判定结论前必须确认源案例是否定义/加载该全局。
- 本例不存在启用的图片上传动作，也不存在源悬空服务 target。
- `NP` 不是未声明变量：源案例的 `numberPrecision` 数据函数明确执行 `window.NP={strip,plus,minus,times,...}`，这段 4,366-byte 代码在 V5 原样保留，故 9 处 NP 引用均可访问页面全局。
- 6 个服务组件均为共享服务引用，V4/V5 props 契约一致；本例没有本地 `data-service` 事件函数体可做 `_code` 编译检查。
- 诊断中的少数高风险语法已逐项定位最终 AST：解构回调、spread、new Array、flat、typeof 与 some/lambda 均保持源语义和局部参数作用域，未发现 silent fallback 丢失。
- 所有启用非 root 事件块 354/354 均映射到 V5 `ln`；事件映射结论从“启用 action 完整”扩展为“启用容器与动作全部完整”。
- 项目完整回归测试 72/72 通过。结合产物静态审计，本例没有发现需要修改转换器的错误。
- 第 16 例报告已落盘，最终口径为“转换通过、无转换器错误”。历史案例全部保留；流程停在人工审阅门禁，未开始第 17 例。

## 2026-08-05：clothing 第 17 例 `合并分床小工具_12105173_熊`

- 源目录按 UTF-8 字节序共 51 个 JSON；第 17 个是 `合并分床小工具_12105173_熊.json`，nid `12105173`。用户已解除第 16 例人工审阅门禁，第 18 例仍受门禁约束。
- 中文服只读隧道与权限为 `0600` 的平台 Cookie 均可用；历史案例必须全部保留。
- 第 17 例数据库连接已验证可用；首次元数据 SQL 仅因 `users.user_name` 列名假设错误而失败，后续需以只读 schema 为准，不复用该字段名。
- 只读 schema 表明当前中文服表字段为 `users.id/email/real_name/eid`、`node_vx_data.is_published/is_launch`，版本和 work_id 位于 `node_vx`；校正后的参数化查询唯一命中。
- 数据库记录：标题 `合并分床小工具`、作者熊维祥、uid 10006977、eid 10000586、gid 0；V4.1、`ntype=1`、版本 1、`work_id=d6kjcv8u82nbomjipp60-6`、短链 `EwYln0hD`。data/node 均未发布、未上架且未删除。
- `/work/load` 获取成功：HTTP 200、15,336-byte 二进制，2 个解压段（23,072/82,959 bytes），最终紧凑 V4 为 106,051 bytes，SHA-256 `02a025ca5b509f31efd3719b465f216be0f1efb5ef1427c656fcde04c7257c9e`。
- 解码结果顶层 `case/server/stage` 与根类型完整，已保存本例 V4 产物和来源元数据；历史案例全部保留。
- 当前转换器输出 106,055-byte V5，SHA-256 `0043033e6fdcd649f05b2cd8f160d61b3bbd4a9c1b1dafe8fbfc763583256068`；诊断 total/unique/dropped/customExpr 全为 0。
- 本例是极小的 WebView 壳案例：严格组件仅 5 个（case/server/stage/system/web-view），无事件、无 AST、无 jsfn、无 data-if、无服务或上传动作。
- 完整对象递归深比较只有一处差异：`case.uis.name` 增加 `_5.0` 后缀；其余 106KB 数据逐项一致。该差异需回证为转换器设计行为。
- `_5.0` 后缀由 `converter.js` 显式追加，并有两处项目回归断言，属于预期转换行为。故完整对象深比较未发现异常差异。
- 项目测试 72/72 通过；本例没有事件、公式、data-if、服务或上传等可转换结构，最终未发现转换器错误。
- 第 17 例报告已落盘，最终口径为“转换通过、无转换器错误”。流程回到人工审阅门禁，未开始第 18 例。

## 2026-08-05：clothing 第 18 例 `基础资料预设_11261416_温晓华`

- 源目录按 UTF-8 字节序共 51 个 JSON；第 18 个是 `基础资料预设_11261416_温晓华.json`，nid `11261416`。用户已解除第 17 例门禁，第 19 例仍受门禁约束。
- 中文服只读隧道和平台 Cookie 可用；目标目录在本轮开始前不存在，历史案例需全部保留。
- 参数化数据库查询唯一命中：标题 `FRP_基础资料预设wy`、当前作者罗安琪，V4.1、`ntype=1`、版本 74、`work_id=chnbetuissce2avmaa9g-667`、gid 25391，短链 `xfWLQsBh`；data/node 均已发布并上架。源文件名作者温晓华与数据库当前作者不同，README 需同时记录。
- `/work/load` 获取成功：HTTP 200、367,876-byte 二进制，2 个解压段（4,598,389/121,649 bytes），最终紧凑 V4 4,720,058 bytes，SHA-256 `36f706617682646cf618db7d75e85cee6d14009e1a4d19634132f109f6140668`；三根完整。
- 当前转换器输出 2,928,749-byte V5，SHA-256 `7fb5eebf7ac34d7012c2340c9de383c4a8c08f537cc09f07c70da3abef1cfe4e`。诊断原始 176、去重 174、dropped 0，全部进入 custom-expression fallback；高频为逻辑与/或和 findIndex。
- 结构与事件完整：1,727/1,727 组件、源重复 ID 原样保留、1,905/1,905 启用 action、3,128/3,128 启用非 root 事件块均对应；176 个 jsfn 的语法、参数、占位符、legacy 与自由变量检查全部通过。
- data-if 70/70 正确；V4 34 个 fireService 与 V5 34 个 runsvc 在 14 个 target 上分布完全一致。6 个本地服务均有 AST，`_code` 位于首个 event 条目，需按该路径完成编译检查。
- 6 个本地服务 `_code` 均非空且函数体语法通过；全部 14 个服务 target 在 V4 源组件树存在。
- 唯一尚未定性的风险是 4 个服务 jsfn 保留自由 `$serverSys`。V5 `_code` 用 `new Function` 执行 jsfn，普通词法闭包无法传入 `$serverSys`；只有运行时把它暴露为全局时才安全，需查 V5 实际执行环境。
- 风险已定性为转换器错误：V5 `ast2js` 的 jsfn 只显式注入 `$vN`，编辑器公式假对象又明确要求 `$serverSys → $sobj_serverSys`。V4 最终 `_code` 正确使用 `$sobj_serverSys`，V5 4 个 jsfn 却保留 `$serverSys`。
- 4 个受影响动作分属 `submitBasicInfo`、`editBasicInfo` 两个本地服务；由于 `new Function` 的 ReferenceError 被 catch 吞掉，Object.assign 的补充对象整体变为 undefined，`updator` 与 `updateTime` 均无法写入。
- 受影响 BID 为 `d9es8082ntpg000znxv0`、`d9es9952ntpg000znyp0`（submitBasicInfo）以及 `d9eqk1w2ntpg000zntm0`、`d9esvhp2ntpg000zp330`（editBasicInfo）。这是同一类公式运行时对象规范化缺陷，不应针对具体 BID 修补。
- 其余 fallback 已逐项审计，未发现第二类转换错误；项目完整测试 72/72 通过。诊断中的 176 条 custom-expression fallback 只有上述 4 条被定性为运行错误，dropped 仍为 0。
- 第 18 例报告已落盘，最终口径为“转换完成但发现 1 类转换器错误，影响 4 个服务动作”；历史案例全部保留，未启动第 19 例。

## 2026-08-05：第 18 例 `$serverSys` 修复依据

- 用户已授权修复；目标是通用规范化 V4 公式中的服务系统假对象，不能针对两个服务名或四个 BID 特判。
- 发布边界由项目 `AGENT.md`/`CLAUDE.md` 固定：真实案例验证通过后自动提交推送 tov5parser、部署生产 Lambda、等价同步并提交推送 VxEditor41。
- 修复前基线是 4 个 `unknown varType: undefined` 诊断对应的 jsfn 保留 `$serverSys`；V4 最终 `_code` 的正式语义为 `$sobj_serverSys`。回归应直接覆盖 custom-expression fallback 内对象字面量调用服务系统方法的场景。
- 源码现状：`env.js`、`utils/const.js`、`utils/formula.js` 与测试都只声明 `$sobj_serverSys`；`V4FormulaCodeConverter` 没有 `$serverSys` 别名。普通结构化解析无法识别该 V4 标识符，转入 jsfn 后仍以原名输出。
- 统一修复优先考虑“标识符引用别名化”，不能简单对源字符串做全局替换，否则可能改变 `"$serverSys"` 字符串、对象非计算属性键或成员属性名等非引用位置。
- `processParsedTree` 的实际失败链：未知 `$serverSys` → `unknownVarType` → gateway `processCustomExpr`；custom walker 会递归该 MemberExpression，但 Identifier 默认分支为空，因此原标识符被 `ExprAstToString`/`astring` 原样写入 jsfn。
- 应在 JSEP AST 和 ESTree AST 的共同前置层做引用级规范化。排除规则：非计算 `MemberExpression.property` 与非计算 `Property.key` 不属于变量引用；字符串/正则本来是 Literal，也不会被改写。对象 shorthand 的 value 仍需规范化并由生成器展开为静态键 + 规范化 value。
- 修复前回归输出为 `$v1 && {label: "$serverSys", $serverSys: $serverSys.f__sysTime("ymdhms"), property: $v2}`：字符串和对象静态键已可作为不应变化的对照，服务对象引用仍错误；合法 `fParamgroup.obj.$serverSys` 被整体参数化为 `$v2`，不能用它观察静态成员名边界。
- 实现采用 `LEGACY_RUNTIME_IDENTIFIER_ALIASES` + AST walker，而非源码字符串替换。walker 在 alias 前收集局部声明，存在同名局部时保守跳过；静态成员名/对象键/label 也跳过。对象 shorthand 的 value 若被别名化会取消 shorthand，保留旧键名和新 value 的正确语义。
- JSEP 与 Acorn ESTree 均先深拷贝再规范化，避免 shorthand 的 key/value 共享节点时修改 value 连带污染静态 key；RegExp 由现有 `cloneParsedTree` 保真复制。
- 定向测试 25/25、项目完整测试 73/73 通过。下一阶段必须以第 18 例真实 V4 重转验证 4 个 runtime jsfn 和服务 `_code` 中的自由 `$serverSys` 均清零，同时确认诊断、结构与服务分布基线未漂移。
- 真实重转成功且诊断计数保持 176/174/dropped 0。`unknown varType` 仍会被记录，因为 `$sobj_serverSys.f__sysTime` 本身没有结构化 V5 AST 表达，预期继续走 jsfn；正确性判据是 jsfn 中保留可运行的 `$sobj_serverSys`，而不是强求该诊断类别清零。
- 审计结构校准：严格组件递归只沿三根的 `children/classes`；V4 事件以组件事件树中的 `bid` 标识，V5 映射落在 AST 节点 `ln`，因此受影响动作应按 V5 `ln` 定位并检查其子树 jsfn，服务最终代码则从本地服务首事件 `_code` 独立扫描。
- 修复后四个精确落点均为 `$sobj_serverSys.f__sysTime('ymdhms')`，且 jsfn 仍只有正确的 `$v1` 用户值参数；这证明别名化只改运行时系统对象，没有改变业务实参或 Object.assign 结构。
- V4 `fireService.object` 与 V5 `runsvc.val` 是服务 target 的同义字段，可按频次 Map 直接比较；本例两边仍各 34 个调用。
- 完整审计确认运行态修复闭合：jsfn 和 6 个本地服务 `_code` 中 `$serverSys` 都为 0，`$sobj_serverSys` 都为 4；四个受影响 BID 每个只有一个映射和一个 canonical jsfn。
- V5 文件由 2,928,749 增至 2,928,789 bytes，净增 40 bytes。旧/新标识符长度差 5 字节，四处在 AST `jsfn.val[0]` 与服务编译 `_code` 各存一份，4×2×5=40，文件变化与预期精确吻合。
- 其他所有基线计数、ID/类型分布、事件 ln、data-if、服务 target 与诊断文件哈希均保持一致，未发现修复外漂移。
- 案例报告已切换为修复后口径。诊断文件没有变化是预期结果：结构化转换仍会记录 fallback 原因，但运行 jsfn 已 canonicalize；报告必须区分“使用 fallback”与“fallback 生成不可运行代码”。
- tov5parser 修复已在 `main` 形成提交 `6b49b0c221654cc0dadcc427708ca6182ac1773d` 并推送；后续 Lambda 必须从该已提交版本构建，不能从额外未提交代码打包。
- 部署脚本的 `--allow-dirty` 只关闭 Git 状态门禁，不改变 `shortHead`、运行时白名单或 AWS 身份校验。当前未提交内容只有规划文档和不相关未跟踪文档，均不在 Lambda 运行时包白名单；可安全从 HEAD `6b49b0c` 发布。
- Lambda 版本 20 已由提交 `6b49b0c` 发布，CodeSha256 `S5quTBb6SJjGhoX9D5eiV9tDBHNeCvmtfxYB05RU5VY=`；`prod` 冒烟实际执行版本 20 并返回业务 code 0。仍需独立读取 alias/version 状态，确认 Active/Successful 与无加权路由后再勾选部署阶段。
- 独立复核已闭合 Lambda 阶段：prod=20、RoutingConfig null、State Active、LastUpdateStatus Successful、摘要和提交描述一致。下一步只同步 VxEditor41 的等价转换器实现，不修改编辑器侧其他文件。
- VxEditor41 的目标文件未被用户修改，核心 AST helper/parseStr/processFullJsExpression 与 tov5parser 同源；安全同步范围只有 `src/utils/convertV4ToV5/formulaCode/V4FormulaCodeConverter.js`。该仓其他 dirty UI/store 内容必须留在工作树且不进入提交。
- VxEditor41 同步实现通过目标 ESLint（0/0）及生产 webpack 构建。构建仍有 33 个既有 warning，与此前同步基线一致；本次目标文件没有新增 lint warning。
- VxEditor41 暂存范围已确认只有 `src/utils/convertV4ToV5/formulaCode/V4FormulaCodeConverter.js`；其他工作树内容不会进入同步提交。
- VxEditor41 同步提交为 `ca0caa89200dc59843ed17af0a8c03c61553ad70`，已推送 `origin/master` 且无分叉；需在最终复核中再次确认提交存在远端、用户工作树改动仍在。
- Phase 87 发布闭环完成：tov5parser `6b49b0c221654cc0dadcc427708ca6182ac1773d`、Lambda 版本 20、VxEditor41 `ca0caa89200dc59843ed17af0a8c03c61553ad70`。两个远端均无分叉，Lambda Active/Successful，用户无关工作树内容均保留。

## 2026-08-05：重新核对 `$sobj_serverSys` V5 AST

- 用户指出修复后仍不正确。该质疑成立：V4 最终代码出现 `$sobj_serverSys` 只能证明外层服务函数使用该变量名，不能自动证明 V5 jsfn 的 `new Function` 可以访问外层局部变量。
- Phase 87 的审计只检查了 jsfn 语法、名称替换和服务 `_code` 可编译；`new Function` 编译成功不会检测执行时自由变量是否存在，因此“审计通过”并未覆盖真正的运行时 ReferenceError。
- 当前诊断需要回答两个独立问题：`$sobj_serverSys` 在服务外层是什么绑定；V5 jsfn 是否应把系统时间表达为结构化 AST，或作为显式 `$vN` 参数传入，而不是保留自由标识符。
- 当前四个落点的 AST 形如 `jsfn.val=["{updator: $v1, updateTime: $sobj_serverSys.f__sysTime('ymdhms')}", "$v1"]`，args 只有当前用户表达式。V5 `ast2js` 据此构造独立的 `new Function("$v1", ...)`，没有传入后台系统对象。
- 在与产物相同的调用方式下直接执行，确定抛出 `ReferenceError: $sobj_serverSys is not defined`。这不是潜在风险，而是当前产物的实际运行错误；此前仅做语法编译的审计无法发现它。
- V5 正式后台系统引用不是 `ref ['var','$sobj_serverSys']`，更不是 jsfn 内的自由文本，而是 `ref.val=['sobj','serverSys']`。`ast2js.checkIsSobj` 只认 `ref` scope 为 `sobj`，随后把方法调用编译为 `$sys.func('server-sys-serverSys',$self,'',method,...)`。
- `serverSys.map.json` 的正式方法名是 `_sysTime`；V4 的属性名 `f__sysTime` 经既有 `genRefsCompPropertyAST` 规则去掉两字符 `f_` 前缀，正好得到 `_sysTime`。参数 `ymdhms` 是 map 中的合法时间格式选项。
- 正确的时间 AST 为 `{op:'var',args:[{op:'get',args:[{op:'ref',val:['sobj','serverSys']},{op:'method',val:'_sysTime',args:[{op:'val',val:'ymdhms'}]}],_blockType:'$refs'}]}`。用项目 `ast2js` 实测生成 `$sys.func('server-sys-serverSys',$self,'','_sysTime',"ymdhms")`。
- 由于外层源表达式是 `Object.assign(param.formData,{updator:...,updateTime:...})`，规范转换不应把整个对象降级为 jsfn；应生成交替 key/value 的结构化 `dict`，其中 `updator` 保留组件 value AST，`updateTime` 使用上述 sobj 方法 AST。
- 当前案例已有三个后台系统 `setLog` AST 使用 `ref ['sobj','serverSys']`，而全部本地 V5 产物都没有把 `_sysTime` 作为后台 sobj 的样本；schema 与代码生成器仍已足以确定正式形态。Phase 87 的转换结果及“已修复”报告结论需要在后续获授权修复时纠正。
- 修复应落在公式上下文与成员方法结构化路径，而不是 alias 字符串层：把规范化后的 `$sobj_serverSys` 识别为专用 `serverSys` varType，生成 `ref ['sobj','serverSys']` receiver，再复用 `genRefsCompPropertyAST` 将 `f__sysTime` 转为 `_sysTime` 并附加实参。这样 Object.assign 的对象参数可完整转换为 dict。
- full-JS/custom-expression 路径无需保留后台对象自由变量：其 `walkOrReplaceCustomExpr` 会尝试把独立的系统时间 CallExpression 整体结构化并替换成显式 `$vN` 参数；因此同一 receiver 规则也能覆盖必须保留 jsfn 的外围 JavaScript。
- 实现验证确认上述两条路径都成立：真实 Object.assign 形态完全不再生成 jsfn；逻辑表达式或块体回调等外围 fallback 中，时间调用单独成为 jsfn args 的结构化 AST。局部声明同名 `$serverSys` 会被既有 scope guard 排除，不会被误识别为系统对象。
- 真实案例重转提供了数量级闭环：原 4 条 unknown-varType 正是四个后台时间对象；结构化修复后诊断 176→172、去重 174→170，四个目标均不再含 jsfn，其他 jsfn 与结构基线不变。
- 最终服务代码不依赖 V4 外层 `$sobj_serverSys` 名称：两个服务各生成两次 `$sys.func('server-sys-serverSys',$self,'','_sysTime',"ymdhms")`，对应服务代码中 free serverSys 和 new Function 都为 0。
- 诊断中的 unknown varType 已随四个系统时间公式一起清零；剩余 172 条全部是其他既有 fallback 类别（`&&` 91、`||` 44、findIndex 13、模板字符串 7、正则及除法 receiver/full-JS 等）。
- 生产 Lambda 21 已从正确结构化实现提交 `6b0ce5d` 发布并由 `prod` 无权重指向；这替换了 Phase 87 的错误版本 20，摘要为 `jx2d/R7C8RHqzxZXda0Av6xJcRles4OLijjrCFooWiY=`。
- VxEditor41 与独立转换器在本次三个落点保持同构，编辑器侧只保留原有 jsep/MapCreator/genXid 依赖差异；生产构建和目标 lint 均通过，不需要修改其他编辑器文件。
- Phase 89 最终闭环证明正确判据必须同时覆盖 schema 与执行作用域：AST 中出现规范名字并不足够；只有 `sobj` receiver 经 ast2js 生成 `$sys.func`，或作为显式 jsfn 参数注入，才能保证后台系统方法在 V5 运行时可用。
- 后台动作参数的 `type` 与 `cType` 语义不同：`type` 来自目标方法参数契约，`cType` 是编辑器 `TypeChecker` 从当前表达式推导的实际类型；后台代码生成会比较两者决定是否执行 `toStr`/`toLong`/`toVal` 等转换。
- VxEditor41 的 `BaseFormulaEditor` 会把后台类型推导结果作为 `cType` 传给动作参数组件，后者仅在结果非空时写入 `ast.cType`；因此 `cType` 不是每个节点或每个后台参数的必填字段，无法推导或走特殊编辑器路径时可以缺失。
- tov5parser 的通用动作参数入口目前只根据方法映射写 `result.type = paramType`，没有运行与编辑器等价的统一实际类型推导；`cType` 仅由服务入参、请求信息、字符串拼接等部分公式生成器附带，导致转换产物覆盖不一致。
- 原生 V5 样本中的后台系统时间参数保存为 `{op:'val',val:'ymd',cType:'String'}`，而第 18 例当前 `_sysTime` 参数为 `{op:'val',val:'ymdhms'}`。由于该嵌套参数没有 `type`，当前 JS 生成器不会依据 `cType` 转型，运行代码仍正确；若追求编辑器原生 AST 保真，应以后实现通用实际类型推导，不能简单令 `cType = type`。
- Phase 90 对原生 V5 后台 DB AST 的进一步抽样显示：DbCons/DbOrders/DbCols 等专用编辑器生成的 list/dict 参数通常只有目标 `type`，容器元素也普遍没有 `cType`；这与 `BaseFormulaEditor` 的行为不同。因此修复必须限定在 V4 Formula/FormulaColor/FormulaJson 参数，不可对所有后台参数递归补类型。
- 编辑器 `BlocksToAST` 在后台只对整个公式根节点运行一次 `TypeChecker`；另在解析 method/sysutil 参数时分别推导各实参类型。对象值、列表项和 jsfn 显式参数不是自动标注边界。转换器应采用同样两类边界：动作公式根节点 + 嵌套 method/sysutil 实参。
- Phase 90 用修复前 HEAD 与当前代码分别重转第 18 例后，`cType` 数从 210 增至 259：净增 49、删除 0、改值 0；新增全部在 server，分布 String 23、JsonObj 12、long 10、JsonArr 4，stage/case 均为 0。
- 两次转换的修复前产物字节数同为 Phase 89 的 2,929,297，但 SHA 不同，说明转换器的新生成 xid 本身非确定；因此“去掉 cType 后 JSON 直接全等”仍会被随机行 ID 干扰。结构等价审计需要把 V4 不存在的新生成 ID 按出现顺序规范化后再比较。
- 扩展规范化到 `item_<xid>`、`index_<xid>`、`<xid>Rtn` 等嵌入式生成 ID 后，再去除 `cType` 与由 AST 派生的 `_code`，修复前/后 JSON 完全结构全等；两边新生成 ID token 数均为 1091。
- 114 个 `_code` 节点仅有 2 个发生变化，均为 cType 驱动的预期代码生成：后台更新服务去掉 2 个目标/实际都为 JsonArr 时的冗余 `toArray`，后台 API 路径字符串去掉 1 个冗余 `toString`；其他转换包装计数不变。
- 当前真实案例 114/114 个 `_code` 均可由 `new Function` 完成语法编译。对规范化代码做语法检查时 `<GEN:n>` 占位符曾造成 1 个假阳性，已改为对原始当前 `_code` 检查并全部通过。
- Phase 90 发布闭环完成：tov5parser `b6c142e7408df204acdfdc613d2bbe59b3b4f703`、生产 Lambda 版本 22（CodeSha256 `RDQG6QXgzxLvtwwi6T3O/Ss3akNKF9Kz4P5wNni5zLg=`）、VxEditor41 `e26fec397e9e24ae3c34465d5d960692ed3bc137`。双仓远端无分叉，Lambda `prod` 无加权路由且版本 Active/Successful。
- VxEditor41 同步仍只需动作参数转换入口；编辑器自身 `TypeChecker` 无需修改。目标文件定向 ESLint 通过，生产构建的 33 个 warning 均为仓库既有问题，不来自本轮转换器同步。

## 2026-08-05：clothing 第 19 例

- 源目录按 UTF-8 字节序仍为 51 个 JSON；第 19 个精确匹配 `审批流_11145234_温晓华.json`，nid `11145234`。前一例是基础资料预设，下一例是 `审批流编辑_11047921_熊.json`。
- 用户已明确解除第 18 例人工审阅门禁；本轮只处理第 19 例并保留历史案例，完成后不自动启动第 20 例。
- 中文服 SSH 隧道、只读数据库 env 和平台 Cookie 当前均可用；两份凭据文件权限均为 `0600`，检查过程没有输出秘密值。第 19 例对应的本地 V4/V5 目录在开始前均不存在。
- 旧中文导出文档在当前 `case-json-migrator` 文件树中已不存在；仓库仍保留 `scripts/export_case_json.py` 和导出 findings。只读交接 README 明确当前账号只允许 SELECT/SHOW VIEW，覆盖 `vxshow` 等中文服数据库。
- 当前导出 findings 重新确认版本判定规则：V4 看 `node_vx_data.edt_ver`/`node_vx.edt_ver`，而 V5 的 edt_ver 仍可能是 4.1，必须结合 `node_vx.extra.verDetail` 区分。管理端 `exportCaseJson` 可作为备选，但本逐例测试既有权威口径仍是先查当前 `work_id`，再读取 `/work/load/{workId}` 的完整三根 JSON。
- 第 19 例 schema 已只读复核：作品版本字段为 `node_vx.version`，当前 work 为 `node_vx.work_id`，短链字段为两表的 `link`，作者表字段为 `users.real_name`；可沿用第 18 例的校正后查询，不再尝试不存在的 `user_name`。
- 第 19 例是 V4.1（两表 edt_ver 4.1 且 verDetail null），不是 V5；其 `ntype=23`，转换时必须显式传 23，不能沿用此前多数案例的 ntype 1。最新 work_id 为 `ce9agstk75oqp7ead4m0-662`。
- VxEditor41 当前 bundle 仍包含 `/work/load` 的权威解码实现：PBKDF2 → AES-GCM → 分段长度头 → pako `inflateRaw`，并把第二段中的 `server.case` 提升为顶层 `case`。第 19 例可复用已安装的 `sjcl`/`pako`，完整解码并校验后再原子写入目标目录。
- 第 19 例本地 Cookie 对 `/work/load` 已返回 203；由于写入发生在解码校验之后，本次没有留下目标目录或文件。下一条安全路径是利用 Chrome 现有登录会话，而不是继续尝试同一缓存 Cookie。
- 浏览器恢复检查确认外部 Chrome 扩展已连接，同时应用内浏览器也可用。应用内浏览器已在首次导航超时；下一步按技能规则改用外部 Chrome 的现有标签/登录态，并在首次交互前读取其完整文档。
- 外部 Chrome 已连接且存在多个 `dev.ivx.cn` 工作台/编辑器标签，说明有可复用的平台会话。将认领最近的编辑器标签，在该已登录页面内对目标 `/work/load` 发起只读 GET；不读取浏览器 Cookie、localStorage 或密码存储。
- 外部 Chrome 的标签认领本身持续超时，最小路径也未能执行页面内 fetch。结合应用内浏览器超时与本地 Cookie 203，当前可靠恢复方式是让用户刷新 `.platform_cookie`；第 19 例目标目录和转换产物仍未创建。
- 2026-08-06 用户刷新后的 `.platform_cookie` 修改时间和权限已验证；这是明确的外部状态变化，可以重新执行原 `/work/load` 下载器，旧 203 不计为本次重复失败。
- Cookie 刷新后复查数据库，work_id 与昨日查询完全一致，仍是 `ce9agstk75oqp7ead4m0-662`；因此后续下载不会遗漏跨日新版本。
- 第 19 例完整 V4 下载已闭合：二进制 110,780 bytes、两段解压后组合成 1,341,559-byte 紧凑 JSON，三根类型正确。后续转换必须使用 `--ntype 23 --diag`。
- 当前转换器已成功生成第 19 例 V5，产物 994,034 bytes；诊断的 30 条记录没有 dropped，全部保留为 `customExpr/jsfn`。分类为逻辑 `&&` 18、逻辑 `||` 8、系统工具 `match` 2、完整 JavaScript 表达式 2。
- 两条 `not support sysutil method match` 的原表达式分别从 `cbParams.$SF_getSelf().reason` 和 `fParamcxyft68a3j50000knmsg.reason` 做正则 `.match(/'([^']+)'/)[0]` 后拼接提示语。是否有错必须检查最终 jsfn 的参数声明、实参 AST 和 `_code`，不能仅依据诊断标题下结论。
- `.match` 最终 AST 已验证：审批流转动作 BID `crwzv2wa3j50000a6p2g` 的 jsfn 为 `[$v1.match(...), $v1]`，实参是回调结果 `reason`；报错处理 BID `cxyfv5ma3j50000knncg` 的 jsfn 声明 `$v1/$v2`，实参分别是函数组参数 `reason/operation`。两处 args 均非空且一一对应，诊断属于保留语义的安全兜底。
- 全树事件/公式初审没有发现转换丢失：自启 action 628 个、自启非 root 块 936 个，全部 BID 都在 V5；30 个 jsfn 结构与语法通过，67 个 `_code` 语法通过，7 个 data-if 均使用 `props.conditionVal.ast` 且没有 `binds.value`。
- V4/V5 服务调用均为 29 个，target 频次相同且目标存在；23 个 `data-service` 均有事件 AST。V5 共 211 个 `cType`（server 159、stage 52），没有上传动作或悬空 V5 var ref。
- V4 中另有 50 个带 `id/type` 的事件图编辑元数据（`root` 9、`status` 7、`con` 14、`action` 20），V5 AST 按设计不保留它们；实际组件比较必须过滤这些事件图类型，不能把 400/350 原始对象数误报为组件丢失。
- 过滤事件图节点后，组件数量为 V4/V5 350/350、唯一 ID 319/319，ID 出现次数与 type 分布都无差异；未发现组件丢失或新增。
- 三个表面不存在于组件 ID 集的 `$refs.I_/i_` 名称都属于 V4 data-for 当前行/当前索引占位符，不是悬空组件：`I_cehxfp6a3j500006d3xg` 和 `I_cehxfp6a3j500006d420` 转为 `ref ["item", forId]`，小写 `i_cehxfp6a3j500006d420` 转为 `ref ["index", forId]`；相关两个 data-for 均存在。
- 30 条诊断与最终 30 个 jsfn 一一对应；每个目标恰有 1 个 jsfn。两条 full-JS filter/map 的参数数量、实参数量均为 2；两条 match 的最终生成代码和 AST 均保留原正则与拼接语义。
- 23 个本地 data-service 全都有 `events.list[0].ast` 和非空 `_code`，代码全部可语法编译；29 个 runsvc 调用的 23 个 target 频次逐项与 V4 fireService 相同。
- 项目测试 75/75 通过。当前没有证据表明第 19 例存在转换器错误；30 条诊断是可运行的 jsfn 兜底，不是 dropped。
- 第 19 例最终结论：转换成功，无需修复转换器。报告已保存到 V5 案例目录；后续必须等待用户审阅并明确“继续”后才能启动第 20 例。

## 2026-08-06：clothing 第 20 例

- 用户已明确解除第 19 例人工审阅门禁；当前目标为 `审批流编辑_11047921_熊.json`，文件名提取 nid `11047921`。本轮只处理该例并保留历史产物，汇报后不自动启动第 21 例。
- UTF-8 字节序复核确认该文件是 51 个 JSON 中的第 20 个；第 21 个为 `小线预设库_11312950_温晓华.json`。只读数据库隧道、0600 env 和刷新后的 0600 Cookie 均可用；本例本地目标目录开始前不存在。
- 权威导出 findings 重新确认版本判断：V4 看两表 `edt_ver`，V5 即使 edt_ver 仍为 4.1 也会在 `node_vx.extra.verDetail` 标记 5.x；当前 work_id 来自 `node_vx`。后续查询只输出业务字段，不输出任何连接凭据。
- nid `11047921` 是 V4.1：两表 edt_ver 4.1 且 verDetail null；ntype 1、版本 32、work_id `cbahd5mnmi9ilme76bn0-106`。数据库标题 `frp-流程编辑`，短链 `UgfZvscS`，域名/路径为 `giuseppe.ivx.cn/play/UgfZvscS`，data/node 均未删除且已上架。
- 当前数据库作者为熊维祥（uid 10006977，eid 10000586）。第 20 例可复用 VxEditor41 `stageProxy` 的权威 `/work/load` 解码算法，与第 19 例相同；只在下载、解密、三根校验都成功后创建目标目录。
- 第 20 例 V4 下载闭合：刷新后的 Cookie 返回 HTTP 200；二进制 134,072 bytes，2 段解压后组合成 1,088,337-byte 紧凑 JSON。三根为 `ih5-case/data-server/ih5-stage`，后续转换必须显式使用 `--ntype 1 --diag`。
- 当前转换器成功生成第 20 例 V5，64 条诊断全部进入 customExpr/jsfn，dropped 0。除逻辑与/或外，本例包含 `window.innerHeight/outerWidth/line/midPoint`、`Math.max(...arr)`、`new Array(...).fill`、模板字符串、findIndex、hasOwnProperty、Math.random().toString 等需结合最终 jsfn 逐项验证的复杂表达式。
- 结构初审通过事件、公式语法和 data-if：自启 action 294、自启非 root 块 411，全部 BID 保留；64 个 jsfn 与 20 个 `_code` 均语法有效；35 个 data-if 均只有 conditionVal.ast、无 binds.value。
- 两个缺失的 `group` ID 位于 V4 `events.list[].tree`，是事件编辑器 group 图节点而非组件，V5 不保留属预期。实际组件应过滤 root/status/con/action/group 后比较。
- 共享服务 `cbh47r7.../cbhsg8.../cbkmct...` 在 V4 本来就没有 events AST/_code，V5 元数据逐字段保留；只有本地 data-service 才需做代码编译审计。
- 两个 V5 var ref 目标 `cbcfqxfa3j50000mpcx0`、`ccrmzhya3j50000xdfrg` 在 V4/V5 组件树中都不存在，尚需从源 bind 和模块上下文判断是源陈旧引用还是错误生成，暂不下结论。
- 上述两个缺失 ID 均在 V4 原始 bind 的 code/_code/Formula token/_cite 中明确存在，而源组件树没有定义；V5 保持同一引用语义。这是源案例的陈旧绑定，不是转换器丢组件或生成错误，报告应单列源问题。
- 最后一条 `some(i => i.from===start && i.to===to)` 诊断没有丢失：V5 父 switch 使用正式 `and` 组合，some 回调 jsfn 声明 `$v1..$v4` 且 4 个实参分别对应 item.from、start、item.to、to。
- `window.midPoint` 的同一 setProps 动作已精确核查：field x 为 `[0]`，field y 为 `[1]`；粗粒度按 BID 收集第一个 jsfn 会产生假象，必须按 field/参数定位。
- Math.random 并未作为 jsfn 自由全局丢失：V5 使用 `ref ["js","Math"]` 的 `random` 方法求值，再将数值作为 `$vN` 传入外层行对象 jsfn 做 base-32 转换。
- 本例复杂 jsfn 已做样例运行：window 尺寸/全局临时量、hasOwnProperty、findIndex、spread max、new Array.fill、模板字符串、块体 map 和数字 toString 均返回预期；这批诊断属于语法能力兜底，不是语义丢失。
- 第 20 例最终完整性数字：组件 467/467（唯一 466/466）、自启 action 294/294、自启非 root 411/411、jsfn 64、_code 20、data-if 35/35、服务调用 5/5、本地/共享服务 2/3、item/index ref 162 且全部有效、上传 0。
- 唯一引用告警是源 V4 已存在的两个陈旧组件绑定；转换器没有新增悬空目标。项目测试 75/75 通过，因此当前结论是“转换成功、无转换器错误，附带 2 个源数据问题”。
- 第 20 例报告已保存到 V5 案例目录，最终结论不需要修复转换器；后续必须等待用户审阅并明确“继续”后才能启动第 21 例。

## 2026-08-06：clothing 第 21 例

- 用户已明确解除第 20 例人工审阅门禁；当前目标为 `小线预设库_11312950_温晓华.json`，文件名提取 nid `11312950`。本轮只处理该例并保留历史产物，汇报后不自动启动第 22 例。
- 第 21 例确认为 V4.1，ntype 1、版本 69、当前 work_id `cj5kl9i6qucc06pnocbg-175`。数据库标题 `FRP_小线预设库`、作者罗安琪，源文件名作者温晓华；域名/路径为 `giuseppe.ivx.cn/play/6bdifJSG`。
- 第 21 例 V4 下载闭合：二进制 536,520 bytes，2 段解压后组合为 6,585,716-byte 紧凑 JSON，三根类型正确。转换必须显式使用 `--ntype 1 --diag`。
- 第 21 例 V5 转换成功：4,578,185 bytes，SHA-256 `a58d23e18c937733a2c9f1bef32b7aec5686820085513a05e75a4d1efe75caa6`；诊断 JSON 56,791 bytes，SHA-256 `58fb07323bee5873b08b6d33613c94b06fa7bc31613e0a081fad24a9bf04c243`。诊断 86 条、dropped 0，主要为 `&&` 32、`||` 12、正则字面量 29、hasOwnProperty/findIndex 6，以及少量模板字符串、完整 JavaScript 表达式和 `$sys.util.math_ceil` 未识别，需结合最终 AST 逐项审计，不能仅凭诊断文本判错。
- V4/V5 三根的 ID 与类型已初步复核一致：stage `cc8w34wa3j50000t7c00`、server `cc8w34wa3j50000t7c0g`、case `cc8w34wa3j50000t7c10`。本例 AST 节点使用 `op:"jsfn"` 而不是 `type:"jsfn"`，后续审计按 op 收集；全 JSON 中出现的 `$sys` 文本还混有源 code/_code，不能据此判定最终 jsfn 存在自由变量。
- 按 `op:"jsfn"` 精确收集得到 86 个节点，与诊断数一致；其中 2 个最终 jsfn 的表达式本身仍含 `$sys.util.math_ceil(...)`，但 `val` 只声明 `$v1/$v2`、`args` 也只有两个业务值。VxEditor41 的 `ast2js.js` 已定位到 jsfn 使用 `new Function` 的生成分支；需继续读取该分支上下文，确认 `$sys` 是否另有运行时注入后再定性。
- `$sys.util.math_ceil` 已确认是转换器错误：VxEditor41 `ast2js.js` 的 jsfn 分支实际执行 `new Function("$v1,$v2", "return ...")`，没有传入 `$sys`；`new Function` 也不捕获外层词法作用域，ReferenceError 会被 catch 吞掉并返回 undefined。受影响两处均来自同一分页 Ceil 公式：文本节点 `cdfhzsfa3j500001pqw0` 的 `binds.value`（应显示“共N页，跳转至”），以及输入节点 `cdfhzsfa3j500001pqwg` 的 blur 条件 BID `ce0xq0wa3j50000853h0` 的上界判断。应转换成正式 `sysutil: math_ceil` AST，或至少在 jsfn 中改为可执行的 `Math.ceil`；当前结果会使显示值/条件失败。
- 第一轮全结构审计：把 V4 事件图元数据 `root/status/con/action/group/loop/comment` 排除后，V4/V5 都是 2,259 个组件、2,251 个唯一 ID，ID 多重集和类型分布完全一致；5,080 个 V4 事件块中，2,806/2,806 个自启 action、4,329/4,329 个自启非 root 块、2,536/2,536 个实际启用 action 均有 V5 `ln`。86 个 jsfn 除上述 2 个 `$sys` 自由变量外，空代码、语法、参数/实参数量、`$vN` 越界均无问题；137 个非空 `_code` 全部可语法编译。
- data-if 为 217/217；其中仅 `ctne2mta3j500004ttx0` 没有 `conditionVal.ast` 且保留 `binds.value`，需回看源节点确认是否本来就是兼容/空条件。服务调用 101/101，本地服务 21/21、共享服务 19/19；首轮 target 对比因误把字符串 `runsvc.val` 当数组取第一个字符而无效，必须以完整 `val` 重算。V5 有 9 个唯一悬空 var ID（15 次引用），全部不在 V4 组件集合，仍需逐个回证源 code/str；item/index 引用目标除 data-for 外也包含提供循环上下文的 draggable 行/列，不能仅按 `data-for` 类型误报。V4 唯一 uploadPic BID `ctmzz54a3j500007yq40` 在 V5 有同 `ln` 动作，未丢失。
- 复核后，data-if `ctne2mta3j500004ttx0` 的源 V4 本来就是 `props.condition=null` 且兼容空 bind `{_code:"",code:""}`；V5 忠实保留为 `binds.value:{op:"val"}`，不是本例转换错误。其余 216 个 data-if 都有正式 `props.conditionVal.ast`。101 个服务调用按完整字符串 `runsvc.val` 重算后 target 次数完全一致。984 个 item/index ref 的 54 个唯一目标全部存在；除 data-for 外的目标是 `ih5-tree-for`、`ih5-draggable-col/row` 等实际循环上下文提供者，没有悬空目标。
- 尝试输出 9 个悬空 var ID 的逐项源路径时，内联只读审计脚本少了闭合花括号而语法失败，未修改任何产物；下一步修正脚本后重跑。
- 修正后逐项回证完成：V5 的 9 个唯一悬空 var ID（15 次）均在源 V4 的 action object、bind/condition code 及对应 str.nodeId 中原样出现，同时均不在 V4 组件集合。ID 为 `ch499npa3j50000ejhbg`、`chdhj8sa3j50000j53b0`、`ctmzz54a3j500007yqy0`、`ccsbxzq2ntpg000gr2n0`、`cep1kfxa3j500008f530`、`cep1kfxa3j500008f77g`、`cd2hwkj2ntpg000fame0`、`cf2fv8xa3j50000apea0`、`ch4bzxqa3j50000ykya0`；全部是源案例陈旧绑定/动作目标，不是转换器新增悬空引用。
- 19 个 `data-sharedService` 的 V4/V5 全字段逐项一致；21 个本地 `data-service` 均有 AST、各有 1 份非空 `_code` 且语法通过。V5 后台/前台参数 AST 共 339 个 `cType`：stage 207、server 132；String 245、JsonArr 1、JsonVal 73、boolean 20。
- 诊断 JSON 自带统计确认 total/unique/customExpr 均为 86、dropped 0。最终 jsfn 特征包括逻辑 && 36、|| 12、正则类 24、hasOwnProperty/findIndex 各 3、可选链 2、块体箭头 2、模板字符串 1；除两处 math_ceil 的 `$sys` 外均无自由 `$` 标识符、语法或参数问题。诊断 Markdown 22,659 bytes，SHA-256 `0e53c4eb3ed53c1197ab7076548cf5a7d75bc4aa0c7a87c23c144d37ee683882`。
- 项目完整测试 75/75 通过、fail 0；输出中的 ParseError/parse error 是测试刻意触发 fallback 的覆盖日志，不影响 TAP 结果。现有测试并未覆盖 `$sys.util.math_ceil` 在 jsfn 中成为未注入自由变量的本例缺陷。
- 正确 AST 形态检索时，直接对单行压缩的历史 V5 JSON 使用 `rg` 导致命中整行并产生过大只读输出，未修改文件。编辑器 `mathInfo.js` 明确注册了 `math_ceil`；还需读取 `ast2js.js` 的 `sysutil` 分支和现有结构化实例，精确写入报告中的期望形态。
- 正确形态已确认：当前转换器的 `genMathMethodAST` 会把前台 `Math.ceil(x)` 生成 `op:"var" -> op:"get"(_blockType:"$sysUtil") -> ref:["js","Math"] -> method:"ceil"(args:[x])`；后台则使用 `["java","JsMath"]`。本例两处都位于 stage，修复时应把旧 `$sys.util.math_ceil(x)` 识别为前台 `Math.ceil(x)` 等价调用并生成上述正式 AST，而不是保留到 jsfn。`ast2js` 对正式 get/method AST 会在外层运行环境生成 Math 调用，不会落入隔离的 `new Function` 自由变量问题。
- 第 21 例 `conversion-report.md` 已生成并复核：V4/V5/诊断 JSON 均可重新解析，报告 6,726 bytes；`git diff --check` 通过。报告明确标注“产物生成成功但审计失败”，列出 1 类/2 处转换器错误、正确 AST 方向、其余完整性数据及 9 个源陈旧引用。用户无关未跟踪文档未读取、未修改、未暂存。

## 2026-08-06：第 21 例 math_ceil 修复

- 用户已明确授权修复；项目 `AGENT.md` / `CLAUDE.md` 的固定流程要求回归通过后无需再次询问，自动完成 tov5parser 提交推送、Lambda 部署冒烟、VxEditor41 同步提交推送。
- tov5parser 当前 main 跟踪 origin/main；仅 planning 文件有本任务修改，另有用户无关未跟踪 `VxServer-saveAs-same-gid-group-db-fix.md`，继续严格排除。VxEditor41 当前 master 跟踪 origin/master，但已有用户修改 `.gitignore`、`src/stores/event.js` 及多个未跟踪视图目录；转换器目录当前未显示修改，后续只编辑/暂存 `src/utils/convertV4ToV5` 内本次同步文件，不触碰或纳入其他改动。
- Lambda 固定脚本为 `npm run deploy:lambda:prod -- --run-tests --smoke`，默认要求 Git 工作树干净并核验中国区账号 `587849590304`、区域 `cn-northwest-1`、函数 `vl-case-json-converter`、别名 `prod`。
- 公式转换入口会先分别用 jsep 或 Acorn 解析，再统一调用 `normalizeLegacyRuntimeIdentifiers`；该层当前只做 `$serverSys -> $sobj_serverSys` 的语义别名归一化，适合扩展旧 `$sys.util.math_*` 调用规范化。现有 `genMathMethodAST` 已能按 scope 把标准 `Math.<method>(...)` 生成 stage 的 `["js","Math"]` 或 server 的 `["java","JsMath"]` 正式 AST，因此无需在 jsfn 特判或注入 `$sys`。
- 回归测试应覆盖 stage 与 server 两种 scope，并验证无 jsfn、ref 分别是 js Math / java JsMath、method 为 `ceil`、生成代码不含 `new Function` 或自由 `$sys`；同时验证完整 JS fallback 内嵌旧 math 调用也被归一化，避免只修 jsep 主路径。
- 真实 V4 数据中 `$sys.util.math_*` 并非只有 ceil：当前本地/源案例扫描得到 ceil 229、abs 150、floor 102、round 25、random 14、min/max 各 6；编辑器 mathInfo 还定义更多标准 Math 方法。因此修复应基于“旧 math_ 前缀 + 标准 Math 方法白名单”的统一规则，而不是枚举当前案例值。
- 直接验证现有 `Math.ceil(5/2)` 路径确认正式 AST：stage 为 `ref:["js","Math"]`，server 为 `ref:["java","JsMath"]`，两者都是 `method:"ceil"` 且参数保留 `/` AST。`v4ToV5/utils/formula.js` 的 getCtx 已根据 nodeInServer 返回 stageMath/serverMath。
- 新增回归测试的失败基线符合预期：stage 旧 Ceil 得到 `{op:"jsfn", val:["$sys.util.math_ceil(5 / 2)"], args:[]}`，full-JS 代码仍为 `$v1.map(... $sys.util.math_floor(item) ...)`；两项均失败。局部 `$sys` 遮蔽用例也已加入，修复不得误改用户自定义同名局部对象。
- 已实现统一归一化：识别未被局部变量遮蔽的 `$sys.util.math_<method>` 成员链，去掉 `math_` 前缀，并用 `typeof Math[method] === "function"` 验证它确属标准 Math 方法后改写为 `Math.<method>`。这不是枚举 ceil 或当前字符串值，自动覆盖 V4 可生成的标准 Math 函数，同时不碰未知 `math_*` 和用户局部 `$sys`。
- 定向回归从 0/2 转为 2/2：stage Ceil 和 server Abs 均生成正式前后台 Math AST；full-JS 的 Floor 变为可执行 `Math.floor`，局部 `$sys` 用例保持原样。
- 完整测试增至 77/77 通过、fail 0。重转第 21 例成功，V5 约 4,471.1 KB；诊断 total/unique/customExpr 从 86 降为 84、dropped 仍为 0，减少的两条正是原 math_ceil `unknown varType: undefined`，与受影响位置数吻合。
- 重转精确审计：目标文本 `cdfhzsfa3j500001pqw0` 与页码输入 `cdfhzsfa3j500001pqwg` 均已生成 `get($sysUtil) -> ref:["js","Math"] -> method:"ceil" -> /(总条数,每页条数)`；全案例共 4 个正式前台 Ceil AST。84 个 jsfn 无任何结构、语法、参数或自由 `$` 问题，137 个 `_code` 可编译；组件 2,259/2,259、服务 101/101、循环 ref 984 个、上传及 9 个源陈旧 ID 均保持闭合。
- 修复后 V5 4,578,401 bytes，SHA-256 `43c34b8e4971711e2ae676e5c1cb16ffe8d443cb88d7d1c372f4d50eb4b067dd`；诊断 JSON 55,574 bytes / `cfff346acc71dbbd96fddfe987d7fe6200515202637c11184abcde1d3a288db1`，Markdown 22,147 bytes / `2bc51b75fdce1796681610e6fd7a1e91a19798763c30b3e0e1d5f7ddd0d22522`。
- `invalid node` 根因已澄清：本项目 `v4ToV5/ast2js.js` 文件头明确是 standalone V5 backend compiler，只支持 `ref` scope `java`，不支持 stage 的 `js` scope；因此不能用它执行前台 AST。用 server 的 `java/JsMath.abs(-3)` 重试后生成 `Math.abs(-(3))` 并实际执行得到 3。前台继续按编辑器既有 `js/Math` 正式 AST 做结构验证。
- 永久回归已补强：除直接 stage/server 调用外，还覆盖本例“字符串拼接中嵌套 Ceil”不得降级 jsfn，并把 server AST 编译为 `Math.abs(-(3))` 实际执行得到 3。补强后定向 2/2、完整 77/77 再次通过。
- tov5parser 修复已精确提交为 `d03e501e1e888708be60b0be2b20e7c02270915c`（`fix: normalize legacy runtime math formulas`）并推送 `origin/main`；提交只含转换器、回归测试和三份规划记录，无关未跟踪文档未暂存。
- 生产 Lambda 部署成功：部署内置 77/77 测试通过，运行包约 1.9 MB，S3 历史归档 `s3://vl-case-json-converter/lambda-packages/vl-case-json-converter/archive-d03e501-20260806T034845Z.zip`。发布版本 23，CodeSha256 `wqGi5MxxILd3otPWUEodK4FQjEbblJbZMoFWTaCpCXI=`；prod 已切换至 23，冒烟 StatusCode 200、ExecutedVersion 23、FunctionError null、业务 code 0。
- Phase 94 完成：VxEditor41 仅同步了通用 `$sys.util.math_* → Math.*` 归一化，提交 `23297061cb11c1e6e1cd709223a63768bc5189a7` 已推送；生产 Webpack 构建成功，33 组 warning 均来自仓库既有代码。
- 最终发布状态：tov5parser `d03e501e1e888708be60b0be2b20e7c02270915c` 与 `origin/main` 一致，VxEditor41 `23297061cb11c1e6e1cd709223a63768bc5189a7` 与 `origin/master` 一致；Lambda `prod` 指向版本 23，状态 Active/Successful，CodeSha256 `wqGi5MxxILd3otPWUEodK4FQjEbblJbZMoFWTaCpCXI=`。
- 当前检查点仍是第 21 例人工审阅：本轮修复、双仓发布与云端部署均闭环，不启动第 22 例。
- 2026-08-06：用户明确回复“继续”，第 21 例审阅门禁解除。当前目标为 clothing 第 22/51 例 `工厂信息_11276461_温晓华.json`，文件名 nid `11276461`；本轮保留全部历史数据，只处理这一例并在汇报后暂停。
- 第 22 例排序已复核：51 个源 JSON 中位于第 22，前一例为 `小线预设库_11312950_温晓华.json`，下一例为 `工序库_11276212_温晓华.json`。本例 V4/V5 目录开始前均不存在。
- 凭据状态首次检查用了两个已失效的猜测路径（项目根 `.platform_cookie`、旧 case-json-migrator 根 `.env`），命令未找到文件且没有输出内容；下一步通过文件名定位实际路径，只检查权限与修改时间，不读取秘密值。
- 实际凭据路径已从既有记录恢复：Cookie `/Users/lianghuang/Documents/docs/auth/.platform_cookie`，只读数据库 env `/Users/lianghuang/Desktop/case-json-migrator/raw/lianghuang-cn-db-20260630/lianghuang_ro.mysql.env`。首次 `find` 只覆盖 Desktop，因而不会命中 Documents 下 Cookie；不是凭据被删除。
- 第 22 例数据库查询前置可用：两份凭据均为 0600，Cookie 204 bytes；SSH 隧道进程监听 `127.0.0.1:13306`。当前没有残留 PyMySQL 模块，需按既有安全路径安装到新 `/tmp` 目录。
- 安全校准：变量名检索错误包含了实际 env，导致秘密值进入本地工具输出。已停止文本式凭据检索；数据库连接程序直接在内存解析固定键，不打印配置，查询结果只输出 nid/版本/ntype/work_id 等业务字段。
- 第 22 例只读查询唯一命中：V4.1（两表 edt_ver 4.1、verDetail null），ntype 1、版本 235、work_id `ci43oesqlql8k4fski00-348`；标题 `APS工厂信息`、当前作者温晓华、gid 25391、短链 `Fd0E1Lsh`，可进入 `/work/load` 下载。
- VxEditor41 的权威 `load` 实现仍可复用：`/work/load/{workId}?nid={nid}` 二进制经 PBKDF2/AES-GCM、长度头和 inflateRaw 解成 stage/server 两段，再从 `server.case` 恢复 case。下载器必须在内存完成 HTTP 类型、分段、JSON 与三根类型校验后才落盘。
- 第 22 例完整 V4 下载成功：HTTP 200、加密二进制 317,628 bytes，2 段解压为 3,431,915 / 26,687 bytes；组合 JSON 3,458,622 bytes，SHA-256 `4a244e5bbcc86c63269a0de8b0c15b3e70e96ae6ee63b2a696e95690620a8b29`。三根为 `ih5-case/data-server/ih5-stage`，可用 `--ntype 1 --diag` 转换。
- 第 22 例 V5 转换成功：2,298,287 bytes，SHA-256 `10466adebac01d252ce7e440f625f010632f5f91456f95ac0785264dd176e209`；诊断 total/unique/customExpr 180、dropped 0。诊断 JSON 顶层记录键是 `records`，不是通用摘要脚本尝试的 `errors/items/diagnostics`，后续按 `records` 做分类和最终 AST 对照。
- 第 22 例 180 条 fallback 分类：逻辑 `||` 59、`&&` 45、NewExpression 21、eval 19、full-JS 13、hasOwnProperty 6、substring 5、unknown varType 4、赋值解析 3、callee/SpreadElement 各 2、toString 1。仅凭诊断不能判错，重点是 eval/new Date/赋值/spread 的最终 jsfn 参数化与运行语义。
- 最终 AST 收集到 180 个 jsfn，与诊断数一致；V5 有 41 个 data-if、1 个 `data-service`、10 个 `data-sharedService`。V4 事件树共 2007 块，其中 root 225；下一步按 BID→ln 和动作有效性口径核对，而不是直接比较总数 2007 与所有 ln 2222。
- 第 22 例组件/事件结构初审：组件 901/901（唯一 900/900），ID/type 多重集一致；1252 个 action 全保留。两个无独立 ln 的非 root status 都是禁用上传动作的 `uploading` 回调包装，V5 alambda 保留其全部子 BID 并随父动作 skip，不是事件丢失。
- 180 个 jsfn 全部语法可编译、声明参数与 args 一致、无 `$vN` 越界；Acorn 语义扫描确认自由 `$` 标识符为 0。早先正则命中的四个 `$any` 都位于字符串字面量 `'$any'`，是假阳性。V5 的 71 个非空 `_code` 也全部可编译。
- 服务调用 17/17，11 个 target 的逐 target 次数完全一致；1 个本地、10 个共享服务数量一致且共享服务全字段一致。41/41 个 data-if 均有正式 conditionVal.ast；307 个 item/index ref 和全部 var ref 均有有效目标。4 个上传动作按 BID 保留，禁用状态也映射到父行 skip。
- 本地服务 `getDataMap` 确有 block AST 和 1,145 字符 `_code`；全案 71 份 `_code` 均可编译。三个禁用 fireService 的 skip 位于带源 BID 的外层 let，而非内层 runsvc，因此早先 `runsvc.skip=0` 不能用于判断禁用语义。
- 代表性 jsfn 首轮运行脚本因一个逻辑样本用了不存在的精确短代码而在汇总前退出；属于审计夹具匹配错误，不是转换器错误。改用特征匹配并逐项报告缺失/运行结果。
- 动作 enable/skip 映射完整：1236 个实际动作中 1128 个启用动作均未误标 skip，108 个禁用动作全部在同 BID V5 行上 `skip:true`；缺失 0。
- 13 组高风险 fallback 实际运行全部得到预期结果：eval（直接、过滤聚合、空串兜底）、new Date、Spread+Set、对象赋值、块体 map、hasOwnProperty、substring、混合逻辑和图表 option 字符串。180 个 jsfn 的结构/编译检查与这些代表运行共同通过。
- cType 共 109：stage String 101；server JsonVal 4、boolean 2、String 2。第二个脚本用过窄路径寻找本地服务 code 得到 0，仍是审计脚本路径假设错误；服务节点的实际 `_code` 已精确确认是 1145 字符且属于全案 71 份可编译代码之一。
- 本地服务最终精确核查：`getDataMap`（id `cd1wyvva3j50000jwx1g`）有 1 个事件，AST 为 block，`_code` 1,145 字符且可编译。项目完整测试 77/77、fail 0。
- 综合结构、引用、编译和代表运行结果，本例当前结论是“转换成功，未发现转换器错误”；180 条诊断均有可执行 jsfn 承接，不是 dropped。下一步只需生成并复核单例报告。
- 第 22 例 `conversion-report.md` 已生成并复核（5,413 bytes）；V4/V5/诊断 JSON 均可重新解析，哈希与报告一致，`git diff --check` 通过。Phase 95 complete，当前停在第 22 例人工审阅门禁，不启动第 23 例 `工序库_11276212_温晓华.json`。
- 第 23 例目标已确认：`工序库_11276212_温晓华.json`，文件名 nid 为 `11276212`。本轮只读查询当前版本后，只有确认为 V4 才下载并转换；历史 V4/V5 产物全部保留，不删除、不启动后续案例。
- 第 23 例本地目标目录开始前不存在；数据库与平台凭据文件均为 `0600`。`127.0.0.1:13306` 当前没有监听进程，因此不能沿用上轮连接状态，必须先按只读交接说明安全恢复隧道且不得输出凭据。
- 只读交接包包含可直接使用的 `start-mysql-tunnel.sh`；本轮执行返回成功且没有回显秘密值，仍需以端口监听与实际参数化查询共同确认连接可用。
- 当前隧道进程为 SSH 且仅监听 `127.0.0.1:13306`；env 的 MYSQL 连接键完整。后续程序将在进程内读取值，输出严格限制为 nid、版本、ntype、work_id 与案例业务元数据。
- nid `11276212` 当前是明确 V4.1：data/node edt_ver 均为 4.1，`extra.verDetail=null`；ntype 1、版本 40、work_id `ci416m4qlql8k4fskbvg-216`。数据库作者罗安琪与源文件名作者温晓华不同，应在 README 中同时记录。
- 第 23 例最新完整 V4 已恢复：8,149,408 bytes、SHA-256 `561742ddf9d49582ffe80e5d6f06ccb399ca16a79f04b70f65c12b45957785fa`；三根为 `ih5-case/data-server/ih5-stage`，可用 `--ntype 1 --diag` 转换。
- 第 23 例 V5 为 5,905,861 bytes，SHA-256 `30321b1ad234536ea598ad48a29f293ab7840947efcb130471b7be84c97b24c2`；诊断 total/unique/customExpr 161、dropped 0。`&&`/`||` 各 47，另有正则 29、full-JS 9、callee 9、hasOwnProperty 6 等，需逐一与最终 161 个 jsfn 及运行语义对照，不能把 ParseError 日志直接判成转换失败。
- 第 23 例已确认两类 jsfn 代码生成错误：BinaryExpression `in` 在 fallback 代码生成中被错误逗号化；ObjectExpression 的 computed property 丢失方括号。共影响 8 个 jsfn，均可由合法 V4 源公式直接回证，属于转换器新增的不可解析 JavaScript，不是源案例问题。
- 第 23 例其余主结构目前闭合：113 次服务调用、42/13 个本地/共享服务、258 个 data-if、上传 callback 子动作均保留。24 个悬空 var 目标是源 V4 已存在且源组件集合本来缺失的陈旧引用。3 个启用 data-animate.play 被 V5 skip 的原因仍待代码与祖先上下文复核。
- 3 个 data-animate.play 的 V5 skip 是既有正确策略：目标均为 infinite 动画，跳过显式 play 可避免 V5 async 动作链永久等待；转换器注释与专门测试共同支持该结论。
- 排除 8 个不可解析 jsfn 后，153 个 fallback 的声明/实参、自由变量与语法均正常；16 类代表运行全部通过。说明本例失败不是“所有 fallback 都有问题”，而是代码生成器对 `in` 和 computed property 两种 Acorn 语法节点的序列化缺陷。
- 当前 77 个回归测试全部通过，但不存在专门断言 fallback 对 `BinaryExpression(operator="in")` 和 `Property(computed=true)` 生成合法 JavaScript 的用例，因此测试通过不否定本例实证错误；修复时应先为两类节点各补失败回归。
- 第 23 例报告已闭环，最终结论是“V5 产物生成成功但审计失败”。修复范围应聚焦 fallback 代码生成器的二元 `in` 与对象 computed property 序列化，并用本例 2+6 处结果重转验证；在用户明确授权前不修改转换器、不启动第 24 例。
- 用户已授权第 23 例修复。实现应基于 Acorn 节点语义通用支持 `BinaryExpression.operator="in"` 与 `Property.computed=true`，不能针对本例字符串或节点 ID 特判；修复后需证明 8 处全部变成可解析、可执行 jsfn，并按自动发布流程闭环。
- 当前转换器 fallback 已依赖 `acorn.parseExpressionAt` 与 `astring.generate`，正常情况下两类节点都应由 astring 原生正确输出。错误更可能来自 walker 把子表达式替换为非 ESTree 节点或替换了 computed property 的 key/`in` 两端时破坏节点形态，应修复替换契约而非手写字符串拼接枚举。
- `processFullJsExpression` 与 `processCustomExpr` 都调用同一个 walker；修复一处即可同时覆盖两条 fallback 路径。需要保持现有局部回调变量隔离、外部 V4 引用参数化、`$serverSys`/Math 归一化等既有行为不回归。
- 更精确地说，两条路径共用 walker，但输出器不同：full-JS 用 astring，普通 JSEP fallback 用 `ExprAstToString`。computed property 缺陷位于旧打印器；不能为了统一输出器贸然让 astring 接管全部 JSEP AST，因为项目仍存在 `Compound` 等非 ESTree 扩展节点。
- JSEP `in` 的正确优先级可按比较运算层注册为 7；旧打印器对应优先级 30，与 `< <= > >= ==` 同层。对象打印必须仅在 `item.computed` 为 true 时输出 `[key]`，普通 key、shorthand 与 SpreadElement 行为保持不变。
- 最小回归必须从 gateway 触发 custom fallback；单独的数组 map 会先尝试结构化 sysutil 转换，依赖运行组件映射且不稳定命中目标打印器。用逻辑运算包住表达式既符合真实案例触发方式，也能直接验证最终 jsfn。
- 最终实现没有把所有 JSEP AST 改交 astring，也没有增加本例表达式正则；只补齐现有解析器/打印器对标准 JavaScript 节点的缺口，因此对既有 Compound 扩展、参数化 walker 和 full-JS 路径影响最小。
- 重转诊断数保持 161 是预期结果：两类公式仍由 customExpr 承接，只是生成的 jsfn 从语法无效变为合法。验证重点应是最终代码、参数/args 和实际结果，而不是要求诊断减少。
- 第 23 例修复验证证明该方案是通用语法修复：JSEP 把 `in` 保持为 BinaryExpression，旧打印器按 `Property.computed` 输出方括号；真实 8 处表达式全部可解析并在构造输入上得到预期结果，未依赖案例 ID、字段名或公式文本枚举。
- 第 23 例诊断产物的真实文件名是 `app.convert-errors.json` 与 `app.convert-errors.md`；最终报告必须引用这两个文件的现有哈希，不能沿用审计脚本猜测的 `conversion-diagnostics.md` 路径。
- 修复后报告已完成一致性检查：不再包含“审计失败/等待修复”、旧 V5 大小哈希或 77/77 测试数；当前报告 SHA-256 为 `020ea0c2e095ee57aaee1b985dae0067c7d495cbc06b547344aa08d627da1ab7`。
- 生产发布脚本会把任何未跟踪文件也视为脏树；本轮唯一阻塞项是受保护的用户文档。使用脚本自身 `--allow-dirty` 不会把该文件打入运行包，构建来源仍明确记录为提交 `ba63791dbdd182d7ecd7f7b42de5a22790c65884`；Lambda 版本 24 的冒烟已成功。
- 直接在普通 shell 调 AWS CLI 没有自动继承部署脚本的认证配置并返回 NoCredentials。Lambda 最终状态复核需要复用部署脚本同一认证加载方式，不能把独立 CLI 环境失败误判为部署失败。
- 部署脚本默认 profile 是 `vl-case-json-converter-cn`；复用后确认 prod=24、State=Active、LastUpdateStatus=Successful，CodeSha256 与发布输出一致。第 23 例两类错误的代码、案例审计、云端发布和编辑器同步均闭环。
- 第 23 例节点 `crea8kta3j50000nq580` 的 V4/V5 路径均为 `stage.classes[13].children[6].children[2].children[0].children[0].children[0]`。所属前台小模块是“修改对比小模块”，classId `C_cecm420a3j50000p5pf0`、定义 ID `cecm420a3j50000p5peg`、widgetId 17481；案例中的实例 ID 为 `cnqectv2ntpg0009a81g` 与 `cjhyrhta3j50000qb3hg`。
- clothing 第 24 例目标来自已排序源清单：`工序组合库_11310840_温晓华.json`，nid 为 `11310840`。必须先按数据库当前状态判断是否仍为 V4；只有 V4 才下载并转换。
- 本例开始时历史案例不会被覆盖：`localCases/v4|v5/clothing/工序组合库_11310840_温晓华` 均不存在。只读隧道和两份 0600 凭据均可用；数据库查询应复用 `node_vx_data/node_vx/users` 的已校正字段与 `d.nid=%s` 参数化条件。
- PyPI 本轮出现 ReadTimeout，不能假设公网依赖下载稳定；优先从 pip cache、其他本地 Python site-packages 或已有 Node MySQL 包恢复只读客户端。
- 清华 PyPI 镜像可用于隔离安装 PyMySQL；当前可复用目录为 `/tmp/clothing-case24-pymysql-mirror.0s8wz6`。SSH 隧道可能在前置检查后退出，正式查询前必须再次确认端口监听。
- 隧道脚本本轮可能以前台方式阻塞；把“启动脚本”和“端口检查”串在同一短时命令里无法得到可靠状态。后续需拆分检查进程/监听，避免把超时包装结果当作明确启动失败。
- `node_vx_data` 没有 `eid`；案例所属企业 ID 应通过 `node_vx_data.uid -> users.id` 后读取 `users.eid`。第 24 例第一次 SQL 的 1054 仅是字段选择错误。
- nid `11310840` 当前为 V4.1：data/node edt_ver 4.1、verDetail null；ntype 1、版本 174、work_id `cj3gsn26qucc06pnmp8g-559`。数据库作者罗安琪与源文件名作者温晓华不同，来源 README 和报告需同时记录。
- 第 24 例下载无需新建项目依赖：权威导出脚本可直接 require `/Users/lianghuang/Desktop/ivx_repos/VxEditor41/node_modules/sjcl` 与 `pako/lib/inflate`，按 stage/server 两段恢复完整 V4。
- 导出文档示例默认写格式化 JSON；clothing 逐例产物实际采用紧凑 JSON。本轮只改变最终 `JSON.stringify` 的空白格式，不改变解码或三根校验逻辑。
- 第 24 例 V4 三根 ID 为 case `cj416pja3j500004gf7g`、server `cj416pja3j500004gf70`、stage `cj416pja3j500004gf6g`；类型分别为 `ih5-case/data-server/ih5-stage`。产物 11,209,286 bytes，哈希 `b1c6d54178716e799bbdb115fe296f76f7910a0f1b213c6402607980a8a7b4a5`。
- 第 24 例转换诊断 171 条全部由 jsfn 兜底承接、dropped 0。高风险类别包括 22 个正则、12 个 full-JS、11 个 findIndex、10 个 callee、5 个解构回调，以及大量嵌套 &&/||；必须对最终 171 个 jsfn 做语法、参数、自由变量与代表运行审计，不能从 ParseError 日志直接判错。
- V5 动作 AST 的定位键是属性 `ln=<V4 bid>`，不是节点 `op='ln'`。第 24 例初步数量为 363 个 data-if、46 个 data-service、17 个 data-sharedService，V4/V5 一致。
- 第 24 例核心结构目前未见转换错误：组件/动作完整、全部 jsfn 和 `_code` 语法有效，参数完整。两个 data-if 兼容例源条件本来为空；三个额外 skip 与前例相同，都是 infinite `data-animate.play`。
- 第 24 例服务完整性通过；17 个悬空 var ID 全部是源 V4 自身陈旧引用，不是转换器新增。事件层唯一待收口的是 2 个上传 status 包装，需验证其各自子动作 BID 已进入对应 V5 alambda。
- 第 24 例两个上传 status 的子动作均已进入各自 alambda；非 root 事件语义闭合。运行审计应优先覆盖 102 种唯一 jsfn 中的复杂种类，同时特别回归上一例修复的 `in` 与 computed property，因为同一小模块在本例再次出现。
- 第 24 例 20 个代表运行断言全部成功；`in` 返回预期 transparent，计算属性生成动态 `size` 与 `S\nM` 键。当前没有发现需要修复转换器的证据，可以生成“转换成功、审计通过”报告。
- 第 24 例最终报告为 `localCases/v5/clothing/工序组合库_11310840_温晓华/conversion-report.md`，大小 5,696 bytes，SHA-256 `bd17c531556390595e8f88cd8f22b772ba4a2eec667c395f0cef47d54879e029`；报告所列 V4/V5/诊断文件大小和哈希均已与实物复核，JSON 可正常解析。当前结论保持为转换成功、未发现转换器错误，等待人工审阅后再进入第 25 例。
- 2026-08-06：第 25 例授权已取得，目标源文件为 `工艺制作说明书_12186761_吴坤.json`、文件名 nid `12186761`。本轮仍执行“数据库确认版本 → 获取最新 V4 → 当前转换器生成 V5 → 全量结构与代表运行审计 → 单例汇报”的逐例流程，并保留全部历史产物。
- 第 25 例前置状态健康：源排序、nid 与相邻案例一致，目标目录为空；可复用现有只读隧道和隔离 PyMySQL。版本判断仍以 `node_vx/node_vx_data.edt_ver` 与 `node_vx.extra.verDetail` 共同确定。
- 第 25 例数据库类型是少见的 `ntype=92`；其版本信号仍明确为 V4.1，最新 work_id 为 `d89r08n9q0bsmc9tr9tg-40`。源文件名作者吴坤、数据库当前作者王洋，属于元数据演进而非冲突；转换命令必须传 92。
- 第 25 例可复用既有二进制导出算法；紧凑输出只改变 JSON 空白，不改变解密、解压、server.case 提升或三根完整性校验。来源 README 应保留 ntype 92 和两套作者元数据。
- 第 25 例规模较小：完整 V4 仅 948,265 bytes，三根 ID 为 `d8b9rs33ays000gw1bx0/d8b9rs33ays000gw1bg0/d8b9rs33ays000gw1bfg`，哈希 `47635cbe0f620e62fa045e24848e46f82747295cbcb558172b008023fee884c0`。下载、解码、复解析和权限检查均通过。
- 第 25 例暴露新的转换器崩溃：`convertIfCons` 假设传入值可 `.forEach`，但真实 V4 的某个 data-if condition 不是数组。错误发生在任何 V5 产物审计之前，需先精确定位源结构和影响节点；本轮未获修复授权。
- 更正影响范围：不是“某个”节点，而是本例全部 27 个 data-if 都已保存 `props.conditionVal={ast:...}`；转换器没有识别这种已结构化条件。首个遍历到的节点即会让 `cons.forEach` 崩溃，V5 产物尚未生成。
- 第 25 例的最新 work JSON 并非普通 V4 结构：大量 `ast/ln/cType/op`、`server.props.v2=1` 和 `case.props.vlId=root` 与第 24 例 V5 输出同类，而第 24 例 V4 完全没有这些标记。当前更准确的表述是“数据库 edt_ver 为 4.1，但实物已经是 V5 编译态”；转换器崩溃暴露了缺少输入格式识别/幂等守卫，是否需要转换仍需结合 ntype 92 定性。
- 原始清单与最新 work 两份 JSON 都已是 V5 编译态，且根 ID 相同；因此不是 `/work/load` 取错或解码器污染。需要把数据库元数据与 JSON 实物格式分开判断，不能仅凭 edt_ver 决定再次转换。
- ntype 92 是迁移工具和 VxEditor41 均认识的正常作品类型，不是异常参数。转换器应至少能在入口识别“已是 V5 编译态”的 JSON，并选择安全跳过/透传或给出结构化诊断，而不是深入旧 data-if 数组转换后崩溃。
- 当前公共 API 没有任何 `isV5`/schema/幂等判断，只有非空对象检查；因此它无法处理数据库元数据滞后但 JSON 已转换的真实案例。批量脚本不会写出半成品，这一点工作正常。
- 第 25 例实物自身的 V5 AST 完整性初审通过：473 个组件 ID 无重复，27 个 data-if 和 36 个事件全部有 AST，受检 ref 均有目标。项目 79 项测试虽全过，但未覆盖这类输入，因此不能用测试通过抵消真实崩溃。
- 首个触发节点是 `d8b9rs33ays000gw1d0g`（Loading），其 `conditionVal.ast` 是合法的 `sysop:isTruthy`，并非坏数据。修复不能只让 data-if 对象跳过旧数组转换后继续处理整棵树；输入的事件和动作同样已是 V5 AST，应在公共入口做完整格式识别并对混合结构保守诊断。
- 第 25 例最终结论：转换失败、无 V5 半成品；责任点是公共入口缺少已转换输入识别，而非某个 data-if AST 损坏。失败报告哈希 `584f1e0bd6cd90276eeb1dcf1bfb0699e9bdb848338da8fc102c1983789edbb5`，等待人工决定是否实施入口级兼容修复。
- 推荐的通用修复是入口级幂等分类而非节点特判：V5 输入必须原样透传并跳过所有转换/编译副作用，mixed 输入必须显式失败；现有 `data-if keeps the V5 condition AST` 测试名称容易误导，其夹具输入仍是 V4 条件数组，只验证输出 AST，并未覆盖已是 V5 的输入。
- 用户校正成立：第 25 例实际就是 V5，不是“数据库标 V4 但实物异常”的 V4 转换案例。数据库 edt_ver/verDetail 判据在本例不可靠，JSON schema 才是最终依据；此前的转换器错误定性与修复必要性均已撤回。若未来要增强入口防误用，应作为独立健壮性需求，而不是本例修复。
- VxEditor41 的实际 import 是 `formulaCode/V4FormulaCodeConverter.js -> ../../jsepWrap/index.js`，所以编辑器 jsep 注册文件位于 `src/utils/convertV4ToV5/jsepWrap/index.js`；此前依据注释推测的 `formulaCode/jsepWrap/index.js` 仍不准确，应以 import 解析为准。
- 路径解析还需注意 `formulaCode` 是 `src/utils/convertV4ToV5/formulaCode`：`../../jsepWrap` 实际落在 `src/utils/jsepWrap`，不是 `src/utils/convertV4ToV5/jsepWrap`。不存在路径的只读 diff 已失败退出，没有修改文件。
- VxEditor41 的最终同步范围只有两个生产文件：共享 JSEP 注册器和 V4→V5 表达式打印器；仓库没有对应测试脚本，验证采用精确 diff check 加生产 Webpack 构建。
- VxEditor41 全量生产构建用时约 68 秒并成功退出；33 组 warning 是该仓库既有噪声，本轮同步文件没有新增编译或 lint 错误。
- 项目内明确的版本判断文档只有 `raw/中文服完整案例JSON导出.md` 第 102–112 行：它用 `edt_ver` 与 `extra.verDetail` 区分 3.x/4.0/4.1/5.0/5.1，但没有 JSON schema 二次确认规则。README 与接口指南只描述 V4→V5 转换契约，也没有版本分类算法。第 25 例证明数据库字段可能滞后，后续逐例流程必须以下载后的完整 JSON 结构作为最终版本判据。
- 第 25 例旧失败报告已撤回并替换为 V5 跳过报告：27/27 data-if AST、36/36 event AST、`server.props.v2=1` 及全案 `op/ln/cType` 共同确认 V5。下载物因“不删除历史案例”仍保留原路径，但来源 README 已明确纠正标签；新报告 3,254 bytes，SHA-256 `1ef8c5bce5b1493ac293f97d173321db17e591dadce2296651957f7b99d3ae5d`。未修改转换器，也未启动第 26 例。
- `vx-json-evolution-claude` 的版本判定正文给出了后续逐例流程应采用的完整优先级：平台元数据先看 `extra.ver == 2`；成立后按 ntype 91/92 判 V5.1，否则 V5.0。V5 的 `edt_ver` 普遍残留 `4.1`，`verDetail` 覆盖率低且只供审计。裸 work 文件只要任一事件条目带 op-AST `ast` 就判 V5，即使夹有 tree 残留；只有旧 event/tree/Formula 信号且无 ast 才判 V4；空白无信号时不得猜测。第 25 例旧 SQL 没有查询 `extra.ver`，这是数据库初筛误判的直接缺口，后续每例必须补查 `JSON_EXTRACT(node_vx.extra,'$.ver')` 并下载后结构复核。
- clothing 第 26 例目标按 UTF-8 字节序为 `工艺库_11072568_温晓华.json`，nid `11072568`；前后是第 25 例工艺制作说明书与第 27 例快递公司配置前端。本轮只处理该例，版本查询与报告必须使用校正后的双层判定口径。
- 第 26 例首次按新口径查到 `extra.ver=null`，没有 V5 权威元数据；两表 edt_ver 均为 4.1、verDetail null，因此只能初筛为 V4.1 候选。ntype 1、work_id `cc81pdqq86m7chl12gng-485`、数据库作者罗安琪；仍须下载最新 work 并扫描事件 ast，不能仅凭数据库结论直接进入转换器。
- 第 27/51 例 `快递公司配置前端_12193536_吴坤` 的数据库元数据是首个直接命中完整 V5 权威组合的后续案例：`extra.ver=2`、`ntype=92`、`verDetail=5.1`，明确为 V5.1；两表 `edt_ver=4.1` 再次证明 edt_ver 不能用于覆盖 V5 权威信号。按用户规定的 V4→V5 测试范围，本例应跳过下载和转换，只保留版本信息与跳过报告。
- 第 28/51 例 `快递公司配置后端_12193535_吴坤` 同样命中 `extra.ver=2`、`verDetail=5.1`，其 `ntype=91` 与第 27 例的 `ntype=92` 组成 V5.1 后端/前端配对。两例的 data/node edt_ver 都残留 4.1，进一步验证版本分类必须优先使用 extra.ver。本例应直接跳过 V4 下载和转换。
- 第 29/51 例 `技术配料单_11430800_温晓华` 的 `extra.ver` 与 `verDetail` 均为空、两表 edt_ver 为 4.1，故数据库只能初筛为 V4.1 候选；ntype 1、work_id `cm4hncb1bru52ab7c4l0-277`。必须下载最新 work 并扫描事件 AST 后再最终定版，不能仅凭数据库字段直接转换。
- 第 29 例最新 `/work/load` 实物是明确 V4.1：eventAst 0、eventTree 734、Formula 6,412，ast/op/ln/cType 均为 0；紧凑 JSON 9,390,624 bytes，SHA-256 `ce14b746c1a6612e9cfed444807a86cce3263e74c9ee6bc8f177de292bc112b9`，case/server/stage 三根完整。
- 第 30/51 例 `排产规则_11283115_温晓华` 的 `extra.ver` 与 `verDetail` 为空、两表 edt_ver 为 4.1，只能初筛为 V4.1 候选；ntype 1、work_id `cibq2rfl557ut9e0du4g-335`。当前数据库作者邵伟明与源文件名作者不同，需分别记录；最终仍以最新 work 的事件 AST/V4 tree 结构定版。
- 第 30 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 260、Formula 3,401，ast/op/ln/cType 均为 0；紧凑 JSON 3,591,813 bytes、SHA-256 `80af7831326a4cf2912f9635f1b43e553a8ed979a1c1a2b2819cdd9ef7f6a840`，三根完整。
- 第 30 例 4 个 `findIndex` 公式已逐一回溯 V4 `code/str`：3 个规范源式的 V5 括号与 `!= -1` 位置正确；唯一的 `$v1.findIndex((x) => x == $v2 != -1)` 在 V4 源式中就已将 `!= -1` 写入回调内部（组件 `ccbgmrba3j50000y9ea0`、动作 `ccc4dh6a3j50000bk9t0`）。该式返回索引而非预期布尔值，是源业务公式问题，转换器没有改变其结构或新造错误。
- 第 30 例 25 组规范 jsfn 代表输入全部通过；异常源 `findIndex` 的命中/未命中输入也都与 V4 等价表达式严格一致（均返回 0）。这既证明转换保真，也具体暴露源式缺陷：对非空数组几乎总在首项返回 truthy 回调结果，因此不能产生预期的包含判断布尔值。
- 第 30 例完成项目全量回归：79/79 tests pass、fail 0。结合 1,000 个组件、260 个事件、1,379 个动作的结构闭合和代表运行，可定性为转换成功、未发现转换器错误；源 `findIndex` 缺陷应作为业务数据提醒，而不是触发转换器修复。
- 第 30 例最终报告 4,967 bytes、SHA-256 `1ef387d05d0a9064f92f42c170514e625098e663a8f49c80bae10f56d7d3a63e`；V4/V5/诊断均已复解析和核验摘要，历史产物未删除。下一案例须按源目录重新核对后再开始，不能仅依赖预记文件名。
- 更正：第 31/51 例按真实源目录字节序核对后是 `排程池_11283121_叶育科.json`，此前 findings 末尾预记的 `排程池_11280677_温晓华.json` 并不存在。应以文件名 nid `11283121` 查询，不能沿用预记值；纠正发生在任何数据库查询或案例写入之前。
- 第 31 例前置环境健康：源与相邻排序吻合，两个目标目录为空，Cookie/数据库 env 为 0600，SSH 隧道已监听。本机无 mysql CLI 和系统 PyMySQL，需要临时隔离安装；SQL 继续使用 `node_vx_data`/`node_vx`/`users` 联查，并新增 `JSON_EXTRACT(n.extra,'$.ver')` 权威版本字段。
- 第 31 例数据库查询唯一命中：`extra.ver=null`、两表 edt_ver 4.1、verDetail null，因此只是 V4.1 候选；ntype 1、版本 580、work_id `cibq4ofl557ut9e0du70-338`，标题 `APS排程池`、作者叶育科、uid/eid/gid `10187685/10000586/25391`、短链 `MkZzqib0`。必须继续以下载 JSON 实物定版。
- 第 31 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 2,532、Formula 25,153，ast/op/ln/cType 全为 0；紧凑 JSON 61,211,338 bytes、SHA-256 `715ad6c1af7068f64a71c8eddeebaa4600942b867fc42a24a51ea8f9a768839b`。这是目前 clothing 循环中明显较大的案例，后续转换和全量审计需控制内存与遍历次数。
- 第 31 例 V4→V5 转换成功，V5 48,331,941 bytes、SHA-256 `5fba07c0d81f8cc6b1fdb1f0e9a89f10010ab9e95d2315da1d7a2522feee232a`。1,310 条诊断全部由 jsfn fallback 承接且 dropped=0，去重 1,284；高频为逻辑或/与、模板字符串、findIndex、spread、flat、full-JS、正则、unknown varType、sortAndUniqueData 和 NewExpression，必须从最终 AST/运行语义核验，不能直接按日志数量判错。
- 第 31 例审计真实入口已校准：组件只沿三根 children/classes 统计；V4 action 从 event tree 的 `type=action` 识别，V5 用 `ln` 回映；data-service 总计 105 个；唯一 uploadPic 已生成 V5 method；664 个 data-if 的普通代表样本符合新契约，仅保留 `props.conditionVal.ast`、删除兼容 `binds.value`。
- 第 31 例首轮结构主链完整：10,142 个组件、2,532 个事件、11,156 个 action 全闭合；1,274 个 jsfn 与 1,019 个 `_code` 均可编译，参数/args、自由 `$` 和旧占位符问题均为 0。待回证项只有 2 个启用 play 的 skip、5 个空条件 data-if、25 个唯一悬空引用，以及含 `sortAndUniqueData/processPackageMaterials_*` 等非 `$` 自由函数名的 jsfn 是否依赖源事件局部上下文。
- server.classes 的 23 个模块定义不是“应逐字不变”的共享数据：本例其中包含大量 V4 event tree，转换后必然转为 V5 AST，所以精确 JSON diff 全部不等不代表错误。正确口径是模块 ID/type、内部组件/事件/action 的总量与回映闭合，另对 105 个 data-service 分区核验后台 AST/_code。
- 第 31 例结构例外均已闭合：2 个启用 play skip 对应 infinite 动画；5 个空 data-if 源 condition 为空，V5 `{op:'val'}` 兼容 bind 符合既有修复；25 个悬空目标在 V4/V5 全对象索引均不存在但源原文都有引用；105 个 data-service 后台 AST/_code 全部完整；23 个 server module 的 ID/type/组件数/事件数一致；uploadPic 全子树 BID 均回映。
- 本例出现非 `$` 自由标识符，需要区分合法 initJs 全局与漏参数：`numberPrecision` 8 次、sortAndUniqueData 21、processPackageMaterials 系列 4、formatData 4、checkMember 8，以及 isToShow/getElementHeight 各 1；另有无参数 `productionOrder...` 1 次。不能因语法可编译就直接判正确，下一步需核查全局脚本声明和该零参数式的外层 AST/源 loop 上下文。
- 非 `$` 自由标识符已经找到定义来源：9 个 helper 均由案例内 data-func 声明并赋给 `window`，所以 jsfn 按全局函数调用是源设计；stage.initJs 只有 `exif`，但 helper 定义位于组件树的“全局函数”等 data-func 中。`productionOrder...` 则是 V4 源中纯 str 写成的零上下文公式，所在 action 本来禁用，V5 也 skip，应记为源陈旧公式而非运行中的转换错误。
- V4/V5 的 130 个 data-func 代码逐 ID 完全一致，合法全局 helper 不仅“有定义”，而且定义和 window 挂载未被转换器改写。高风险 jsfn 代表运行应覆盖：模板/逻辑、findIndex、spread/flat、block map、Set/Array.from、numberPrecision/sortAndUniqueData/formatData、assignment/reduce/forEach、除法 receiver 的 toFixed、可选链与对象构造。
- 校正 helper 选择器后，第 31 例 29 组代表 jsfn 全部执行通过；测试实际加载案例自身的 9 个 window helper 定义，而不是用简化假实现。Unexpected `=`、Expected comma 和除法 callee 等诊断对应的 mutation/reduce/forEach/toFixed 代表式也均返回预期。
- 第 31 例项目完整测试 79/79、fail 0。综合 10,142 个组件、2,532 个事件、11,156 个动作、1,274 个 jsfn、105 个后台服务与上传/模块审计，本例可定性为转换成功、未发现转换器错误；报告应把 25 个源陈旧引用和禁用 productionOrder 公式作为源数据提醒。
- 第 31 例最终报告为 `localCases/v5/clothing/排程池_11283121_叶育科/conversion-report.md`，6,320 bytes、SHA-256 `0a0d0c4170be1d76d7f54edd253e66660cdc75a290463b60d3d8eac25fb8f4b5`。V4/V5/诊断 JSON 可解析，产物大小与摘要一致，V4 权限 0600、ignore 命中且 `git diff --check` 通过；保持“转换成功、未发现转换器错误”的结论，第 32 例未启动。
- 第 32/51 例按真实源目录排序确认为 `新裁剪任务单_12181966_吴坤.json`，nid `12181966`，前后分别是排程池和智能样板打板。本例目标目录为空、两份凭据权限 0600、只读隧道正常监听；版本查询仍必须优先读取 `extra.ver`，再用下载 JSON 的事件 AST/V4 tree 信号最终定版。
- 第 32 例数据库权威版本信号为 `extra.ver=2`、`ntype=92`、`verDetail=5.1`，明确是 V5.1 前端案例；两表 `edt_ver=4.1` 属于已知残留，不能误判为 V4。该例应跳过 `/work/load`、V4 保存、转换与转换审计，只保留数据库元数据和跳过报告。
- 第 32 例跳过报告位于 `localCases/v5/clothing/新裁剪任务单_12181966_吴坤/conversion-report.md`，2,162 bytes、SHA-256 `4c29be2d85c48f167ab944ef86ce430f7b2af3a09d4467fa2f18fec122d43882`。V4 目录未创建，V5 目录只含报告，转换器未运行或修改；第 33 例未启动。
- 第 33/51 例按真实源目录排序确认为 `智能样板打板_11285959_吴坤.json`，nid `11285959`，前后分别是新裁剪任务单和标准尺码类库。目标目录为空、两份凭据权限 0600、只读隧道正常；版本查询必须继续使用 `extra.ver` 优先规则。
- 第 33 例数据库查询唯一命中：`extra.ver=null`、两表 edt_ver 4.1、verDetail null，只能视为 V4.1 候选；ntype 1、work_id `cidu9oqso14ne2fsroh0-199`、标题 `FRP_智能样板打板审批`、数据库作者刘土明。源文件名作者吴坤与当前作者不同，来源信息需分别记录；最终版本必须由下载 JSON 结构复核。
- 第 33 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 485、Formula 4,545，ast/op/ln/cType 均为 0；紧凑 JSON 7,518,343 bytes、SHA-256 `71bcfebeaf7eed47d24437cf555b4d4e8f571ce599623266008c5cd67fe0ba5a`，case/server/stage 三根完整。
- 第 33 例 V4→V5 转换成功：V5 5,350,390 bytes、SHA-256 `e0eb44c12ced36cd87fec818518ce82aaf80c1e951da20dc06a27e7b59ab3fb5`；诊断 total 318、unique 317、customExpr 318、dropped 0。高频包含 `||`、full JavaScript、`&&`、TemplateLiteral、match、findIndex 等，必须检查最终 jsfn 而不能直接按 fallback 数量判错。
- 第 33 例发现 4 个活跃 jsfn 残留 V4 方法 `$SF_arr_search`：两个是组件绑定，两个位于启用的 setValue 动作，均无 skip。对普通数组直接运行四段输出都抛 `TypeError: $v2.$SF_arr_search is not a function`；这是转换器没有完成 V4 数组搜索方法改写的确定错误。3 个额外 skip 则都指向 `props.infinite=true` 的动画，属于既有正确规则。
- `$SF_arr_search` 的权威 V4 语义来自 VxEditor41-widgets `arr_search(value,target)`：空 receiver 降级 `[]`，再用 `findIndex(item => target === item)` 返回下标。当前 full-JS fallback 仅规范化 getSelf/Math，没有转换包含 callback 局部变量的 legacy array method，导致旧方法名残留。正确修复应在 ESTree 层按方法语义统一改写并保留空值、严格相等和下标返回，不能只做本例字符串替换。
- 第 33 例除 `$SF_arr_search` 外的 23/23 组代表 jsfn 执行通过，项目全量测试 79/79、fail 0；现有回归未覆盖 full-JS callback 中的 legacy array search，因此全绿不否定案例实证。最终应报告 1 类转换器错误、影响 4 处，源侧另有 9 个陈旧引用目标。
- 第 33 例失败报告位于 `localCases/v5/clothing/智能样板打板_11285959_吴坤/conversion-report.md`，6,391 bytes、SHA-256 `7fcbf4849683fea7b4fe7b1020143b9245666ee48e2892a8b6e4ba4697801380`。V4/V5/诊断 JSON 可解析，大小和摘要一致，V4 权限 0600、ignore 命中且 `git diff --check` 通过；等待用户是否修复 `$SF_arr_search`，第 34 例未启动。
- 第 33 例修复阶段纠正了上一轮落点漏计：真实 `$SF_arr_search` jsfn 共 5 个，不是 4 个；新增落点为活跃文本绑定 `cddrrvva3j50000ebqf0`，其同一公式外层还残留 `$SF_objArr_item`。因此只消除数组搜索仍不能让整段公式可执行，companion 方法也必须按 V4 widgets 语义归一化。
- fallback 归一化采用两阶段策略：`$SF_arr_search` 在 JSEP 结构化试探前改写，避免 callback 局部参数触发未知 sysutil；参数化完成后再扫描最终 JS AST，只处理真正残留的 `$SF_arr_search/$SF_objArr_item`。这样不会把原本可生成 V5 sysutil 的普通对象数组取值调用全部内联。
- `$SF_arr_search` 通过局部 IIFE 保证 receiver/target 各求值一次、空 receiver 降级 `[]`、严格相等 findIndex 和额外实参副作用；`$SF_objArr_item` 精确保留 row/col 非空检查、全局 isNaN、parseFloat 行号、truthy rowItem 和 undefined 返回。生成局部名会扫描原 AST 后避碰。
- 修复回归最终覆盖 JSEP callback、full-JS IIFE、严格相等、null receiver、单次求值、名字冲突、两方法组合和 `0x10/01/空/null` 行号语义；项目完整测试 83/83 通过。
- 第 33 例最终 V5 为 5,351,804 bytes、SHA-256 `a9cfdad9669535dc097fe5eaee3d6d759383f09ae75a0b1f12c0c0d231b03372`。5/5 修复落点运行通过，318 个 jsfn 的旧 `$SF_*` 残留、语法和 arity 错误均为 0；组件/事件/动作、data-if、服务 target、data-service、data-func、cType 和 `_code` 审计继续闭合。
- 第 33 例报告已更新为成功结论，7,342 bytes、SHA-256 `940545ccec72fd195be3b83893b957afb58731c3770c2bc0f2ae22f0e96ba7e1`；诊断仍为 318/317/dropped 0 且文件摘要不变。第 34 例未启动，后续是固定双仓发布流程。
- 第 33 例修复已完成固定发布闭环：tov5parser 提交 `af1fd41ec97b00ff9dfc2a681b5e44ed0d59ddc8` 已推送；生产 Lambda `prod` 已切至版本 25、冒烟实际执行版本 25，CodeSha256 `H4NEleBxf77vWZIx/aVnGhRWHLhJ+HkHr4qdTaRGDEQ=`；VxEditor41 同步提交 `5a4847084e6c818e9b18893a74da802765e55eee` 已推送。编辑器完整构建成功，两个同步文件定向 ESLint 零告警；两个仓库均只提交本次相关文件。
- V5 完全支持结构化 `arr_search`：第 33 例最终产物中已有 24 个 `{op:'sysutil', val:'arr_search'}`，至少 3 个参数直接引用 `['local','item_<blockId>']` 后取 `styleId`，证明 callback 局部变量不是障碍。当前目标公式落入 jsfn 的真正原因是外层原生 `.filter` 和 `&&` 触发整体 fallback；jsfn code 内不能直接嵌 JSON AST 节点。
- 不落盘的实例级原型已将同形公式转换为纯结构 AST：`switchexp → and → arr_filter → lambda → arr_search`，计数中 jsfn 为 0。正式实现至少要让 `&&/||` 走已有 `genConditonValAST`，并只在语义安全的原生数组回调子集把 `.filter` 映射为 `$SF_arr_filter`；不能简单把 IIFE 改成裸 `$sys.util.arr_search`，因为 jsfn 由 `new Function` 执行且不应假设可捕获 AST 编译上下文中的 `$sys`。
- 正式实现确认普通 `.filter` 已由运行时英文映射解析为 `objArr_filter`，无需重写映射；真正缺口是 `&&/||` 被主动拒绝，以及普通 filter 未校验原生调用形态。安全规则为：恰好一个表达式箭头回调、至多 item/index 两个 Identifier 形参；`thisArg`、第三个 array 形参或块体继续 jsfn。sysutil map 未加载时也必须按空对象处理，使未知方法抛 ParseError 并走 fallback，不能泄漏 TypeError 后降成空值。
- 第 33 例正式重转后目标高度绑定为 `switchexp → and → objArr_filter → lambda → arr_search`，filter `_blockId`、lambda 声明和 search 的 local item 三者一致，jsfn/IIFE 为 0。5 个旧搜索落点中 3 个结构化；2 个动作后续含块体 `.map` mutation，保留 IIFE fallback 是有意的安全边界。全案 jsfn 318→180，诊断 318/317→180/179，旧 `$SF_*` 仍为 0。
- 新产物 5,374,350 bytes、SHA-256 `660e8ff18d7a2c5aa9135e987eec250eb0984a129ad9f1f6ab63223ed7eed2ba`；组件 2,244、事件 485、动作 3,339 等结构指标继续闭合，项目测试 85/85。更新报告 8,159 bytes、SHA-256 `d6608834cfb704e3359411821012e59956d98078168f16739c13f470e8417e77`；第 34 例未启动。
- Phase 109 发布闭环完成：tov5parser `c4d2077df8def5300d7f274dfd96aa732ae5dbfe` 已推送；Lambda `prod` 最终为版本 27、Active/Successful、CodeSha256 `8M8z4mLkGRMJPeu1vUYgG3Os72HI1YGOx89NvoKCGV8=`，冒烟执行 27 且 code 0；VxEditor41 `3fec57866db51d1fe9973e521d9ef6df123a3f74` 已推送，定向 ESLint 无告警、生产构建退出 0。两仓均未混入用户无关修改。
- 第 34/51 例按真实源排序确认为 `标准尺码类库_11294217_温晓华.json`，nid `11294217`，前后分别是智能样板打板和样板库；历史案例保留，两个目标目录开始前不存在。
- 第 34 例数据库查询唯一命中：`extra.ver=null`、两表 edt_ver 4.1、verDetail null，只能初筛为 V4.1 候选；ntype 1、版本 47、work_id `cij6n2gk2oo36vrkoafg-136`、标题 `FRP_标准尺码类库`、当前作者罗安琪。源文件名作者温晓华与当前作者不同，最终版本仍须以最新 `/work/load` JSON 的事件 AST/V4 tree 结构定版。
- 第 34 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 567、Formula 8,101，ast/op/ln/cType 全为 0；紧凑 JSON 5,994,981 bytes、SHA-256 `e4da3a58d15d2b35fbedcd7bdc8770ba52f7bb88c10d521751b3acdd0357996f`，case/server/stage 三根完整。
- 第 34 例 V4→V5 转换成功生成 4,138,785-byte V5、SHA-256 `60c923eaff0fc83b2a2ba54853eb42b54ef75be8f19faa906e31a35b73620aae`；诊断 total/unique 21、customExpr 21、dropped 0。所有诊断都有 jsfn 承接，需从最终 AST 和代表执行判断语义，不能把控制台 ParseError 当成丢值。
- 第 34 例全量审计闭合：组件 2,012/2,012、事件 567/567、动作 2,647/2,647；99 个禁用 skip 与 3 个 infinite 动画额外 skip 正确。21 个 jsfn、127 个 `_code`、191 个 data-if、91 个 runsvc、18 个 server-api 调用、20/18 个本地/共享服务、2 个上传、18 个 data-func、8 个 server module 和 292 个 cType 均无转换异常。
- 第 34 例 15 种 jsfn 的 27 条代表断言和项目 85/85 测试全部通过。28 次/9 个唯一悬空 ref 均可在 V4 原文回证且源侧本来无目标，属于源陈旧引用。本例最终结论为转换成功、未发现转换器错误；报告 SHA-256 `6d046d1db8f4e4f32ff7bf99e79c113b96336115d1e01401ea7dced386479170`，第 35 例未启动。
- 第 35/51 例按真实源排序确认为 `样板库_11123253_温晓华.json`，nid `11123253`，前后分别是标准尺码类库和款式与包装分类预设；历史案例保留，两个目标目录开始前不存在。
- 第 35 例数据库查询唯一命中：`extra.ver=null`、两表 edt_ver 4.1、verDetail null，只能初筛为 V4.1 候选；ntype 1、版本 382、work_id `cdmadpkhru0k16qs9efg-1220`、标题 `FRP_样板库_副本`、当前作者罗安琪。源文件名作者温晓华与当前作者不同，最终版本仍须以最新 `/work/load` JSON 的事件 AST/V4 tree 结构定版。
- 第 35 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 1,666、Formula 24,291，ast/op/ln/cType 全为 0；紧凑 JSON 26,785,915 bytes、SHA-256 `21d19bacc67daca7fc3fe8845f46527022e53096900613fba8b55f22acc25130`，case/server/stage 三根完整。后续审计应建立单遍索引，避免对 26.8 MB 案例反复全树扫描。
- 第 35 例 V4→V5 转换成功生成 20,145,141-byte V5、SHA-256 `4279b4444c295e7eb15193fd642d2be747f2b7fa3d1c8557e8710c1973e8349a`；诊断 total 245、unique 243、customExpr 245、dropped 0。高频 fallback 为 hasOwnProperty/findIndex/正则/full-JS/spread/toString/callee，需检查最终 245 个 jsfn 的语法、参数、旧方法残留和代表语义。
- 第 35 例结构审计确认三根 ID/type 与 `server.props.v2=1` 正确，组件 6,648/6,648、事件 1,666/1,666。12 个重复组件 ID 全是 V4 源中已经重复的 `data-module-defs`，V5 数量/类型保持一致。8,956 个原始 action 中 3 个位于 `comment` 后代，V4 最终 `_code` 同样不执行；其余 8,953 个动作全部唯一回映。265 个禁用 skip、3 个 infinite 动画额外 skip 和 uploadPics 两类回调 status 包装均符合既有规则。
- 第 35 例 244 个 jsfn 共 86 种代码，语法、arity、旧 V4 方法/占位符与自由 `$` 均无异常；397 个非空 `_code` 可编译。46 条代表运行断言全部通过。唯一出现自由非 `$` 标识符的代码是禁用 consoleLog 中的 `cbParams.data.category`；源块本来禁用且不在 callback 上下文，V5 也 skip，因此是源陈旧公式，不构成活跃转换错误。
- 第 35 例服务与后台审计闭合：669 个 data-if 中 664 个非空条件只用正式 condition AST、5 个源空条件保留兼容空 bind；243 个 runsvc target、50 个 server-api 目标/方法、62 个 data-service、30 个 data-sharedService、7 个上传动作、65 个 data-func、12 个 server module 和 999 个 cType 均无转换异常。86 次/30 个唯一悬空 ref 在 V4 中同样无目标且有原文证据，属于源陈旧引用。
- 第 35 例项目完整测试 85/85 通过。最终报告 6,322 bytes、SHA-256 `89480f2941912785c6c760f32df5f3ea3ea53695491771fb60f581a902628c4b`；V4/V5/诊断 JSON 复解析、权限、摘要、ignore 和 diff check 全部通过。结论为转换成功、未发现转换器错误，第 36 例未启动。
- 第 36/51 例按真实源排序确认为 `款式与包装分类预设_11370981_温晓华.json`，nid `11370981`，前后分别是样板库和款式库。两个目标目录开始前不存在，凭据权限与只读隧道健康；版本查询必须继续优先读取 `extra.ver`，再以最新 JSON 的事件 AST/V4 tree 信号最终定版。
- 第 36 例数据库查询唯一命中：`extra.ver=null`、data/node edt_ver 4.1、verDetail null，只能视为 V4.1 候选；ntype 1、work_id `ckp2sdgmfeq7vfc7bv80-113`、标题 `FRP_款式与包材分类预设`、数据库作者罗安琪。源文件名作者温晓华与当前作者不同，最终版本必须由下载 JSON 结构复核。
- 第 36 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 597、Formula 8,354，ast/op/ln/cType 全为 0；紧凑 JSON 6,332,773 bytes、SHA-256 `1a2bec72c13420c654e99e4c4dce7ffa915544ac835d1708c54ea493201fa0d0`，case/server/stage 三根完整。
- 第 36 例 V4→V5 转换成功生成 4,379,116-byte V5、SHA-256 `d9867797d17ba009516e77e2f1deff2a1a671d05bc481659d94ff63c8df1ab7b`；诊断 35/35、customExpr 35、dropped 0。最终错误与否必须以 jsfn、动作和运行语义审计为准，不能按 fallback 日志数量判断。
- 第 36 例结构审计闭合：组件 2,197、事件 597、动作 2,790 全部回映；98 个禁用 skip、3 个 infinite 动画额外 skip、220 个 data-if、20/15 个本地/共享服务、96 个 runsvc、19 个 server-api、1 个上传、20 个 data-func、8 个 server module 和 329 个 cType 均无转换异常。11 次/7 个唯一悬空 ref 可回证为源陈旧引用。
- 第 36 例 35 个 jsfn 共 13 种代码，语法/arity/旧标记扫描通过，20 条代表运行断言覆盖全部代码种类。复杂三元式在 type=1 分支会对已经 join 成的字符串再次调用外层 join，但 V4 Formula `code` 和事件 `_code` 本来就是该结构；V5 保真复现，应作为源业务公式缺陷而不是转换器错误。
- 更精确地说，上述双重 join 公式只存在于 `cdxmb2ma3j50000x5vg0` 的禁用 consoleLog 动作 `csbedhpa3j50000ef3cg`；V4 最终事件 `_code` 不执行它，V5 同样 skip。因此属于禁用源陈旧公式。第 36 例项目完整测试 85/85 通过，当前结论为转换成功、未发现转换器错误。
- 第 36 例最终报告为 6,025 bytes、SHA-256 `5105233861fe91f499b8703525520031a7a5e6a579b453531db3556c5f4b434b`。V4/V5/诊断 JSON 复解析、V4 权限 0600、文件摘要、ignore 和临时脚本清理均通过；转换器没有修改，保持人工审阅门禁，第 37 例未启动。
- 第 37/51 例按真实源目录 C 排序确认为 `款式库_11054856_温晓华.json`，nid `11054856`，前后分别是款式与包装分类预设和款式设计。两个目标目录开始前不存在，凭据权限和只读隧道健康；版本判定继续以 `extra.ver` 为优先信号，并在 V4 候选时下载实物复核事件 AST/V4 tree。
- 第 37 例数据库唯一记录为 `extra.ver=null`、data/node edt_ver 4.1、verDetail null，属于 V4.1 候选而非最终判定；ntype 1、work_id `cbgulofnr8h39nnhuq50-1174`、标题 `FRP_款式库`、数据库作者罗安琪。源文件名作者温晓华与当前作者不同，必须在来源说明中并列记录。
- 第 37 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 1,823、Formula 20,736，ast/op/ln/cType 全为 0；紧凑 JSON 24,819,455 bytes、SHA-256 `68d3b0291859e3793f08ee433c27669dd1e6c5f7465c5bd868074ff271268a75`，case/server/stage 三根完整。
- 第 37 例 V4→V5 转换成功生成 18,380,901-byte V5、SHA-256 `d626a811dc4f439428f315a56c8e6e6793761753f34fefbcb027ab4da8657eb8`；诊断 330/312、customExpr 330、dropped 0。fallback 涵盖复杂数组回调、New/Spread、对象方法和 Babylon mesh 方法，最终错误与否必须以产物 jsfn/AST 和运行审计为准。
- 第 37 例诊断高频为 findIndex 145、hasOwnProperty 25、百分号正则 25、full-JS 20、Spread 17、callee undefined 13、toString 12、getNormal 9、native filter/Template/getChildMeshes 各 7。抽样确认最终 jsfn 正确采用 `val=[code,...params]` 与 `args`，V4 tree 的 BID 可通过 V5 AST `ln` 回映；应重点检查 mesh 方法是否保留合法 callback 变量，而不是把“未知 sysutil”日志本身判为丢逻辑。
- 第 37 例出现确定性待证信号：最终 jsfn 仍含 `$SF_arr_oneArrItem/$SF_getSelf` 共 10 处，其中 9 处位于启用动作、1 处位于禁用且 `skip:true` 的动作。活跃落点属于两个 3D 模型相关组件事件和 5 个动作 BID；若 V5 普通数组没有这两个旧原型方法，运行时会直接 TypeError，应归为转换器未完成 legacy 方法归一化。
- 首轮动作审计的 14 个无 `ln` 源 action 不能直接报丢失：13 个本来 `action:null`，另 1 个处在禁用祖先动作下。V5 禁用标记的真实形态是动作 AST 节点保留原 `op` 并附 `skip:true`，审计器应据此校准。
- VxEditor41 自身已经在循环转换中生成 `op:'sysutil', val:'arr_oneArrItem'`，`getSelf` 也有正式 sysutil/输出语义；因此最终 jsfn 中原样保留 `$SF_arr_oneArrItem/$SF_getSelf` 并不是合法 V5 AST 表示。仍需从方法资产确认数组取项的具体返回规则，再确定修复方向。
- 权威运行时语义已确认：`arr_oneArrItem(value,index)` 将无 length receiver 视为 `[]`，index 非 `undefined/null` 且通过 `!isNaN` 后使用 `parseFloat(index)` 取项；`getSelf(item)` 直接返回 item。对应活跃 jsfn 应至少把这两种 legacy 方法归一化到等价 JS 或结构化 sysutil，不能要求普通数组拥有 `$SF_*` 原型。
- 第一种残留公式自身还保留了 V4 源式的 truthy `findIndex` 用法：内层命中索引 0 会被外层谓词视为 false。运行夹具必须把内层目标放到索引 1 才能隔离验证 `$SF_*` 残留；该源既有语义与转换器未归一化方法是两个独立问题。
- 修正夹具后，两种旧方法残留代码在普通数组上都直接抛 `TypeError: $v1.$SF_arr_oneArrItem is not a function`，而等价 V4 语义都返回 1。转换器错误已经实证：共 10 个残留实例，其中 9 个位于启用动作、1 个在禁用 skip 动作；活跃影响是 2 种代码、5 个动作 BID。
- 自由标识符审计另发现 `x` 3 处：V4 中它是 `.find(x=>...)` 的回调参数，V5 外层已结构化成带生成 local 名的 lambda，但内部 jsfn 只声明 `$v1/$v2` 却继续引用 `x`。若 jsfn 按独立函数执行，这 3 处会 ReferenceError，属于 callback 参数丢失。另 1 个 `origin` 是 V4 原式与 `_code` 本来使用的浏览器全局，不应混入该转换错误。
- V5 `ast2js` 的 jsfn 分支确实使用独立 `new Function`，并把异常静默吞成 undefined；所以外层 lambda 的生成局部名无法被 code 中的自由 `x` 捕获。3 个自由 `x` 是第二类确定错误，会让两个 find 动作及一条相关条件分支无法命中，而不是仅影响公式展示。
- 第 37 例结构主链已闭合：6,841 个组件、1,823 个事件、9,553 个有定义 action 全部回映；14 个 `action:null` 是源空占位。258 个禁用动作全部 `skip:true`，3 个启用额外 skip 均为 infinite 动画。
- 7 个 status 无直接 ln 均属上传回调包装：3 个 uploadPics 的 uploading/beforeUpload 共 6 个，加 1 个 uploadPic uploading；所有子动作 BID 均精确进入对应 `alambda`，不构成丢失。
- 其余审计：676 个 data-if、71/35 个本地/共享服务、307 个 runsvc、58 个 server-api、5 个上传、81 个 data-func、30 个 server module、1,140 个 cType 均闭合。103 次/37 个唯一悬空 ref 全部能在 V4 原文找到且源索引本来不存在，属于源陈旧引用。
- jsfn 首轮口径只遍历事件 AST，得到 266 个/103 种；全案独立 AST 与 jq 遍历最终均确认实际持久化 318 个/131 种。诊断 total 330 是转换尝试/兜底记录数，不能当作产物节点数；先前“props/binds 另有 64 个、真实总数 330”的过程判断作废。
- 第 37 例全案最终口径为 318 个 jsfn、1,286 个 cType、17,790 次 ref；cType 值域全部有效，125 次/42 个唯一悬空 ref 都能在 V4 原文回证且源索引本来无目标。676 个 data-if 中 672 个非空条件只用正式 condition AST；4 个空 code 中 3 个保留 `{op:'val'}` 兼容 bind，另 1 个源条件本来就是空值等式并正确生成为 `=(val,val)`。
- 第 37 例 49/49 条代表运行和项目 85/85 测试通过，但错误对照稳定复现：旧 `$SF_*` 残留经编辑器 catch 得到 undefined、V4 等价语义为索引 1；自由 `x` 谓词经 editor catch 得到 undefined、显式回调语义为 true。因此最终结论仍是产物生成成功但转换不通过，必须修复这两类转换器错误。
- 第 37 例失败报告 8,960 bytes、SHA-256 `4c9a9800edf98a7b188bce9dedcfd4b121c522447feafc4a72bb10389301fff0`。V4/V5/诊断复解析、权限、摘要、ignore、临时脚本清理和 diff check 均通过；第 38 例目录未创建，保持人工审阅门禁。
- Phase 114 初始代码定位：旧方法残留应扩展共用 ESTree `normalizeLegacyFallbackCalls`，沿用已验证的 receiver/参数单次求值和生成变量避碰机制；`$SF_getSelf()` 的 receiver identity 已在 full-JS 入口专门折叠，但 custom-expression 路径和与 `$SF_arr_oneArrItem` 组合时仍需统一覆盖。自由 `x` 不是 AST 编译器问题，而是结构化 lambda body 的某个子表达式退入独立 jsfn 后，外层 callback local 没有变成 jsfn 的显式参数/args。
- `normalizeLegacyFallbackCalls` 当前仅有 `arraySearch/objectArrayItem` 开关；其 walker 先递归子节点再替换外层调用，适合把 `receiver.$SF_arr_oneArrItem(index)` 变为保留 receiver/index 单次求值的 IIFE，并把 `receiver.$SF_getSelf()` 变为 receiver identity。第二类错误来自 `collectLocalIdentifierNames` 的非作用域感知：子树内任何嵌套箭头声明 `x`，都会让同一子树外层自由 `x` 被全局视为 local；真实公式恰好同时有外层 `.find(x=>...)` 的 x 和内部 `.map((x)=>...)` 的 x，导致前者没有参数化。修复应按词法作用域区分同名绑定，不能简单删除 localNames 保护，否则会把内部回调形参错误替换成 V5 参数。
- 最小复现的错误 AST 与真实案例同形：外层 lambda 声明 `item_<blockId>`，内部 jsfn code 的开头仍是自由 `x.modelIndex`，其 val/args 只含 `$v1/$v2` 对应参数 items/index。说明 `innerGetCtxQueue` 在 fallback 发生时仍有效，只是 `shouldWalkFullJsSubtree` 因平面 localNames 集合提前绕过 `processIdentifier(x)`。作用域感知引用节点集合可让外层 x 参数化为一个 local-ref arg，同时保留内部 `.map((x)=>...)` 自己的 x。
- Phase 114 真实重转验证：最终仍为 318 个 jsfn/131 种代码，但旧标记从 10 降为 0、自由 x 从 3 降为 0。oneArrItem 两种代码均生成 `(__v4ArrOneItemValue,__v4ArrOneItemIndex)=>...`，之后继续 `.modelData/.list.findIndex`；callback 谓词变为 `$v1 == [...new Set($v2.map((x)=>x.modelIndex))][$v3]`（带 ingredientType 的版本另有 `$v4==1`），每个原错误落点的 args 都包含对应外层 lambda local ref，内部 map x 未被替换。
- Phase 114 第 37 例目标代码 9 条运行断言全部通过，结构指标与修复前一致，报告已改为转换成功；新 V5 SHA-256 `475c0b4480136904b2e64ab6764c54a01f1a3f5f3cb77cc2ab609191d0a219f8`，报告 SHA-256 `8535d6ced7326f1cfd59826e6be2ed5ed69fabdc4d1a81b7ad60055e17911fd7`，诊断文件摘要不变。
- Phase 114 发布闭环完成：tov5parser 修复提交 `fd14716` 已推送；Lambda `prod` 指向版本 28，CodeSha256 `l/iPyc+QQlWdltbmVHm2OFiT+ZhJ/9n0DqtgCHjVPHs=`，部署内 88/88 与冒烟通过；VxEditor41 同步提交 `7e6aa1f58` 已推送，目标 ESLint 0 问题且生产构建成功。两个仓库均未混入用户无关修改。
- stop hook 的 118/119 来自 Phase 67 作为 51 例逐例测试的长期总阶段仍在进行，而不是第 37 例修复发布未完成。Phase 67 的用户门禁优先：第 37 例已完成后必须等待用户明确继续，不能为了满足 hook 自动进入第 38 例。
- 第 38/51 例按源目录 C 排序确认为 `款式设计_11036309_吴坤.json`（nid `11036309`），相邻为款式库与物料预设库；开始前两个目标目录均不存在，历史案例无需删除。
- 第 38 例查询/下载前置可用：只读隧道监听 `127.0.0.1:13306`，数据库 env 与平台 Cookie 权限均为 0600。查询必须同时返回 `extra.ver`、两表 `edt_ver`、`verDetail`、`ntype` 和当前 `work_id`；若仅为 V4 候选，仍须下载实物扫描事件 AST 才能最终定版。
- 第 38 例数据库唯一记录：`extra.ver=null`、两表 edt_ver 4.1、verDetail null，因此只是 V4.1 候选；ntype 1、版本 404、work_id `cb147lful2mf2d2s5bc0-1095`、标题“服装-款式设计”、当前作者李孟贤。源文件名作者吴坤与当前作者不同，必须在来源中并列记录。
- 第 38 例最新 `/work/load` 实物明确为 V4.1：eventAst 0、eventTree 1,122、Formula 15,472，ast/op/ln/cType 全为 0；紧凑 JSON 27,058,290 bytes、SHA-256 `4eef743b1eb395d713af6b95a02c0342774d463fac6cd06c93732fedf52f2d00`，三根完整。源清单与最新 work 正文不同，必须使用本次下载版本。
- 第 38 例转换产物为 22,545,630 bytes、SHA-256 `2ce7ca3a153b09d02e8767475004aee09492a80df561f5834f95b69c112e729b`；诊断 638 条、去重 609，631 条 jsfn 兜底但 7 条 dropped。dropped 分布为 3 个 data-if 条件和同一多选下拉模块的 4 个动作参数，必须作为首要审计对象。
- dropped 原式分为三族：两个 data-if 条件只在末尾疑似多一个右括号；一个 data-if 从 `parentId)` 起始且明显缺少 receiver；四个动作参数的 filter 表达式末尾多一个 `]`。是否属于可安全修复的 V4 编辑器残留，需以 Formula 的 `_code/code/str` 与事件最终代码交叉验证。
- 三个 data-if 节点都提供可编译的完整 `binds.value._code`，而转换后的 `props.conditionVal.ast` 将故障分支置为 val；相对 V4 持久化运行表达式，这是确定的条件逻辑丢失信号。修复方向应优先复用完整编译条件作为整体 fallback，而不是猜测修改单个 Formula 文本。
- 四个动作参数的多余 `]` 同时存在于 Formula `code`、`str` 最后一个显式 token 和所属事件最终 `code`；事件 `code` 自身 SyntaxError，`_code` 为空。它们有强证据属于源已损坏动作，而不是转换器新增字符。
- 第 26 例下载后结构信号与数据库初筛一致：1,095 个 `events.list[*].tree`、12,719 个 Formula，事件 ast、全案 ast/op/ln/cType 均为 0。由“只有 V4 信号且无 ast”规则最终判为 V4.1；本例验证了校正后的双层判定流程。
- 第 26 例 V4→V5 转换成功，诊断 212 条全部由 jsfn 兜底承接且 dropped=0。V5 11,403,673 bytes，哈希 `bd19b02904fd302ff8c63385d8d390ffb320475107d14cfec904a3c3c82e2dc7`；下一步必须检查全部 jsfn 的语法、参数和自由变量，并对 30 个正则、SpreadElement、callee、findIndex/hasOwnProperty 等高风险类别做代表运行验证。
- 第 26 例结构主审计已闭合：组件 4,167/4,167、事件 1,095/1,095、动作 5,548/5,548；53 个本地服务均有 AST/_code，28 个共享服务精确一致，194 个 runsvc target 分布一致。两个 status 是上传回调包装，三项额外 skip 是既有 infinite 动画规则，两个无 AST data-if 是源空条件。70 次/32 个唯一悬空 ref 均在源 V4 已存在且目标本来不在组件/块集合，不属于转换新增。
- 第 26 例 212 个 jsfn 共 113 种代码；全量语法/arity/自由变量与旧标记扫描通过，21 组代表输入实际执行通过。覆盖本案全部高风险语言族，包括 full-JS 块体 mutation/reduce、正则、spread、destructuring、optional chaining、computed property 以及上一例修复的二元 `in`。源中的对象/数组字面量相等比较本来就存在，转换器没有改变该既有源语义。
- 第 26 例最终结论：V4.1→V5 转换成功、未发现转换器错误。报告位于 `localCases/v5/clothing/工艺库_11072568_温晓华/conversion-report.md`，4,896 bytes，SHA-256 `e7970d0449383ed0fc16ddf81e09f4a40f9860556b5c32f0bfd25bba75903b26`；保持人工审阅门禁，第 27 例未启动。
## Phase 115 implementation evidence (case 38)

- V4 editor persistence confirms that `data-if` stores its complete compiled condition in `node.binds.value`: `VxEditor41/src/components/eventView/genCode/genCodeUtils.js` assembles the whole condition, calls `convertCode(code)`, and writes both `code` and compiled `_code` into `binds.value`.
- The converter currently builds V5 `props.conditionVal.ast` operand-by-operand through `convertIfCons(...)`, then deletes `node.binds.value`. Therefore, when an individual legacy Formula is malformed but the V4 condition builder's complete `_code` is valid, the valid runtime condition is discarded.
- This exactly affects case 38's three `data-if` nodes (`cs7fce9a3j50000nkqqg`, `cs6trmaa3j50000068zg`, `cqxzmnta3j50000041cg`): their complete V4 `binds.value._code` parses, while V5 contains a dropped `{op:"val"}` operand and loses condition logic.
- V5's formal condition field remains `props.conditionVal.ast`; any later converter repair should populate that AST from the valid complete V4 condition rather than retaining compatibility `binds.value`.
- Four other dropped expressions belong to one FRP multi-select module action chain and contain an explicit trailing `]` in both the Formula tokens and complete V4 event code. Those are source-data defects, not characters introduced by conversion.
- Prior case reports provide the stable comparison baseline: every effective V4 action must map by BID to a V5 `ln`, disabled actions must preserve `skip`, non-empty V5 data-if conditions must live in `props.conditionVal.ast`, and all persisted `jsfn` code must compile with val/args arity aligned and no unresolved V4 runtime identifiers.
- Case 38's persisted files retain the `/work/load` wrapper object, so all structural counts must begin from the wrapper's case/server/stage values; treating the JSON itself as a root array would be a false schema assumption.
- A sampled disabled V4 action (`ckvzfsfa3j50000c2qag`, consoleData) maps to V5 `ln` with `skip:true`, validating the BID→ln audit method for this case. Event containers do not use the older assumed `tree`/top-level `ast` property shape, so event counts must be obtained from component `events` and their nested block representation.
- Sampled backend service `cd1wyvva3j50000jwx1g` demonstrates the exact event migration: V4 `events.list[0].tree.bid=cd1wyvva3j50000jwx20`; V5 `events.list[0].eventId` retains that ID and adds an AST. Its child action BID appears as AST `ln`, including backend parameter `cType`, so backend action typing can be audited directly from the final AST.
- Case 38 structural integrity is otherwise strong: identical roots and 3,696 components, 1,122 events all with AST, 4,781 effective action BIDs all mapped once, and 164 disabled actions all skipped. Missing direct status `ln` values are exactly two upload-progress wrapper statuses, the established intentional conversion form.
- The five non-empty data-if nodes containing empty `val` AST nodes split into two classes. `ctragmaa3j50000zqkmg` uses empty val as the legitimate `undefined` literal; `cqxz2gja3j5000003vg0` uses empty vals for its explicit V4 `undefined` comparison and switch-expression sentinel. They are not drops. The remaining three are the diagnostic dropped nodes and lose real operands despite valid complete V4 `_code`.
- Final jsfn and persisted code checks produce no secondary syntax/arity/legacy-runtime problem. Services, uploads, backend AST/code, function code, modules, cType, and reference provenance also show no additional converter errors.
- The diagnostic dropped set is fully localized: 3 conditions and 4 action parameters. The four actions are enabled, but all live inside the single `FRP_多选下拉菜单` instance and use one of two nearly identical formulas differing only by `当前选中值` versus `剩余已选值`.
- Do not rely on `acorn.parseExpressionAt` for trailing-token validation: it parsed the valid prefix before the final `]`. Whole-input wrapping/parse is the correct source-defect test and remains to be recorded cleanly.
- Whole-input evidence is now definitive: each affected Formula is invalid with its persisted trailing `]` and valid after removing only that token; both owning V4 event programs are invalid and have empty `_code`. The converter correctly refuses to invent a repair for these four source-broken values.
- By contrast, the three data-if nodes have valid complete V4 `binds.value._code` and their owning V4 runtime condition is available. Dropping a branch while deleting `binds.value` is therefore a converter completeness defect, even though the individual condition operand is malformed.
- Repository regression remains green at 88/88; this does not negate the uncovered real-case gap because the current suite has no complete-data-if fallback case covering this persisted V4 shape.
- Case 38 final report is 8,675 bytes with SHA-256 `c0259946261ab93688725b7e5ec831ea2cbc3ecb21f69a48474fb59171f52fdb`. Artifact parsing, hashes, permissions, ignore status, temporary-file cleanup, diff checks, and the case-39 non-start gate all pass.
- Phase 116 repair contract: trigger only from a demonstrable split-operand conversion failure, use the complete V4 data-if runtime condition as a semantic oracle only if it is syntactically valid and convertible, write the replacement exclusively to V5 `props.conditionVal.ast`, and preserve legitimate explicit `undefined` values. No real node IDs or exact case expressions may appear in production logic.
- Converter integration point is confirmed: `converter.js` owns both the split `props.conditionVal` and the complete `binds.value` at the same moment. `convertIfCons` currently exposes only AST, so the repair needs an explicit failure signal rather than recursively treating every empty `val` as dropped; explicit V4 `undefined` legitimately becomes an empty val.
- Existing `repairLegacyEditorCode` cannot solve the whole-condition case because it compares `code/_code` on one editor-value object and only removes a tokenized trailing `)`. A whole-condition fallback must be a separate, generic path and must not broaden that single-formula repair or touch the source actions ending in `]`.
- `V4FormulaCodeConverter.parseStr` first tries JSEP and then full ESTree; both failure paths report diagnostics but ultimately return `{op:'val'}`. Thus production code cannot infer failure from the AST shape. The clean contract is to expose conversion success/failure explicitly while retaining the existing public AST return for all unrelated callers.
- Complete `_code` validity is only the first gate. Runtime code contains compiler-form `$sys.util.*`; any fallback must either translate that form into the same structured V5 semantics or derive a valid editor-form whole condition. Persisting a jsfn with free `$sys` would merely replace visible branch loss with a runtime failure.
- `$sys.util.getSelf(value)` is a compiler-form identity call. AST-level unwrapping of exactly this one-argument non-computed call is safe and general; after unwrapping, all three real complete conditions convert without empty val or runtime identifiers. Other `$sys.util.*` calls must not be guessed: a safety scan should reject fallback ASTs that retain `$sys`.
- Regression design is now concrete: one data-if with a malformed trailing `)` operand and valid complete runtime getSelf expression; one with an unmatched operand `)` that is balanced only in the complete condition; and one negative case whose complete runtime code is invalid, proving the converter preserves the original dropped result instead of guessing.
- Failure baseline is established: recoverable whole-condition regression fails pre-fix as intended; invalid runtime remains dropped. Explicit `undefined` is represented in-memory as `{op:'val', val:undefined}` (JSON serialization hides the property), giving a precise distinction from parse-failure `{op:'val'}` with no own `val` property.
- Implemented failure metadata on each `V4FormulaCodeConverter` instance instead of inferring from AST. This preserves all existing caller return shapes and lets only data-if opt into whole-condition recovery.
- Diagnostic checkpointing is rare-path and synchronous: split diagnostics are saved, rolled back before trying the whole condition, retained as-is if recovery fails, and replaced by the fallback's own custom-expression diagnostics if recovery succeeds. This should reduce the real case from dropped 7 to dropped 4 without hiding the four source-broken action formulas.
- With diagnostic collection enabled in regression, recovered nodes have zero `jsep-parse`/`ast-convert` records after conversion; only legitimate fallback diagnostics may remain. This directly tests the report semantics rather than relying only on final AST shape.
- Real-case diagnostic delta proves the transaction works at scale: exactly the three data-if dropped records disappeared, while 631 jsfn/custom-expression records and the four source-broken action drops remain. No unrelated diagnostic category was accidentally suppressed.
- The repaired third condition is heavily structured rather than a monolithic jsfn: its affected AST uses only the seven formal sysutils `arr_indexOf/arr_search/arr_some/objArr_colItem/objArr_find/objArr_map/obj_item`. Runtime-audit retries failed only because the temporary evaluator initially omitted parts of this formal set; no unsafe identifier or syntax error was found in the persisted AST.
- The remaining runtime-audit harness miss is the formal unary `neg` node used for `-1`. It is not a conversion defect; adding `-Number(arg)` completes the currently observed condition expression vocabulary.
- Runtime equivalence is now proven on eight scenarios: both duplicated `非一对一` conditions cover type-3 unequal/equal selection lengths plus type-2 intersection, and `条件容器1` covers matching/nonmatching nested selection. Every final result equals the saved V4 `_code` result.
- The real-case repair is structurally isolated. All pre-fix whole-case counts remain identical, final jsfn totals remain 615/210, and the only diagnostic removals are the three recovered data-if parse failures. The four trailing-`]` source defects remain visible and untouched.
- Phase 116 修复后报告实物已核验：9,845 bytes，SHA-256 `2ef20304514e550067a8a781243f059963eadf1b6232ce40bb3b85ae11cc2159`。报告结论为转换成功，准确保留 4 个 V4 源尾随 `]` 缺陷，并记录 V5/诊断新摘要、dropped 7→4、8 条语义对照和 91/91 回归。
- 第 38 例诊断实物沿用 `convert:local` 命名 `app.convert-errors.json/.md`，不是 `convert-diagnostics.*`；提交前首轮复解析因此只报告 ENOENT，V4/V5 摘要、临时文件清理、ignore 和 diff check 已正常完成。应以实物文件名复跑，不把路径错误误判为产物缺失。
- 第 38 例最终产物复解析和摘要闭合；实现差异保持通用：只有拆分 Formula 真正 `didDrop` 才尝试完整 `_code`，只折叠精确的一参 `$sys.util.getSelf(value)`，未知 `$sys`/旧运行时标识符会拒绝回退，失败则恢复原 AST 与 dropped 诊断。
- `scripts/deploy-lambda-prod.mjs` 默认 `requireClean:true`，生产闭环应显式带 `--run-tests --smoke`；提交后产生的规划记录需先入库，避免用 `--allow-dirty` 绕过门禁。
- Phase 116 生产 Lambda 已闭环：版本 29、`prod` 指向 29，CodeSha256 `ADaDGjN1rzsdhzpWWWWfIdNQLnsE8ajgJc9udp6ESsY=`；91/91 发布前测试和线上版本动作冒烟均通过。
- VxEditor41 的转换器副本不包含 `utils/convertDiag.js`，`convertEditorValue` 也没有 CLI 诊断上下文；完整条件回退的功能核心仍可同步为 `didDrop + canParseRuntimeCode + 安全 AST 扫描`。诊断 checkpoint/rollback 只用于 CLI 报告统计，不应在编辑器中伪造空模块。
- VxEditor41 同步验证通过：目标 ESLint 0 问题，生产 webpack 构建成功（33 条既有全仓 warning，0 error）。这四个同步文件没有出现在 warning 落点中。
- Phase 116 VxEditor41 发布提交为 `5436d0db9`，已推送 `master`；同步实现不依赖 CLI 诊断模块，目标 ESLint 和生产 build 通过，用户工作区改动未混入提交。
- Phase 116 远端核验确认 tov5parser 已包含功能提交 `02121cb`、部署前记录 `0e0b8ad` 及后续 docs 记录，VxEditor41 `master=5436d0db9`；Lambda 29 为 Active/Successful 且 `prod`→29。第 38 例修复闭环，无理由自动进入第 39 例。
- Phase 117 节点 `cs7fce9a3j50000nkqqg` 最新 V5 条件不是结构化 `or/and`，而是完整运行态 `_code` fallback 生成的单个 jsfn：`($v1 != 0 && $v2 == 2 && ...) == true || $v8 == 0 || $v9 != 0 && $v10 == 3 && (...)`。其 `val` 有 `$v1…$v16`，args 16 个且表面一一对齐；8 个循环字段参数都落成 `ref:["item","cs7fce9a3j50000nkqpg"]`。下一步必须核对该 fake loop item ID 在真实 V5 data-if 执行上下文中的解析方式；上一轮自建 evaluator 直接注入参数值，可能绕过了这一层。
- `ref:["item","cs7fce9a3j50000nkqpg"]` 本身符合 V5 既有约定：该 ID 是条件的直接祖先 `data-for`，同一 V5 子树大量其他 bind/condition/event AST 也引用它，编辑器源码亦以 `forNode.id` 生成 item ref。更可能的缺口在 jsfn 的求值/参数传递、条件面板消费或完整 `_code` 与编辑器条件 code 的差异，而非悬空循环 ID。
- V5 jsfn 的正式 `ast2js` 语义确认：生成 `(function($v...){try{return new Function(...)(...)}catch(e){}})(compiledArgs...)`，任何 arg 编译或内部访问异常都会被吞为 undefined。原始持久化 `ref:["item",forId]` 不在 `ast2js` 的直接 ref switch 中；data-if 在 load/save 链路会经过 fake-AST 转换，因此需验证转换后的实际 ref，上一轮审计直接注入 arg 仍不足以证明线上正确。
- 纠正上一条假设：data-if load 时调用的 `initNodeDealBinds` 仅处理 `_fakeStage`，不处理 `item/index`。所以持久化的 loop ref 在编辑器内仍是原形；若某条路径直接交给当前 `ast2js`，它无法从 ref switch 生成 item/index 代码。是否构成该节点真实错误仍取决于 data-if 发布/runtime 是否走另一个支持 loop ref 的 VLang 编译器。
- 正式 data-if 发布契约已找到：VLang 从 `conditionVal.ast` 生成属性代码，并在进入 data-for 时按 for 节点 ID 注册 `_itemN/_indexN`；AST ref scope `item/index` 由 VLang `genVarPropAccessCode` 支持。所以上一轮基于 item ref 的疑点排除。下一步应聚焦 VLang 对 `op:jsfn` 的编译方式，以及 fallback 整体 jsfn 是否违反条件 AST 可序列化/可编辑契约。
- VLang `jsfnAstToVLang` 实现是 `s.replace(placeholder, compiledArg)`，不是编辑器 `ast2js` 的运行包装。该节点 16 个 placeholder 都各出现一次，故简单的重复占位符丢失不成立；但整体 fallback 生成的是原生 `.find/.findIndex/.filter` 箭头表达式，最终正确性还依赖 VLang 接受这段 JS 语法、每个 arg 代码无歧义，以及我们对 `$sys.util.getSelf` 的恒等假设成立。
- `$sys.util.getSelf` 不是本例根因：widgets 源码直接返回入参，VLang 的 `sysutil:getSelf` 亦编译为空后缀，证明转换器的精确一参折叠语义成立。
- Phase 117 已确认一个比运行时等价更直接的结构错误：V5 data-if 的 `ConWrap` 只把 `and/or` 当条件组，其余根节点全部交给 `BlockConItem`；`BlockConItem` 要求根节点本身是条件运算符，并读取两个操作数 `args[0]/args[1]`。`cs7fce9a3j50000nkqqg` 当前根为 `var`、仅含一个 `jsfn`，会显示不存在的 `var` 条件运算符且右操作数缺失。故该 AST 即便发布代码可执行，也不满足 V5 条件编辑器的合法可编辑结构，上一轮只做运行对照而判“正确”是不完整的。
- VLang 的权威提升规则给出直接修复依据：普通表达式进入 if 条件时应由 `convertCondItem` 包成 `{op:'sysop', val:'isTruthy', args:[expressionAst]}`，并最终编译为 `!!expression`；已有 `sysop/and/or/比较` 条件 AST 才能直接使用。转换器当前 `convertIfCons` 把完整 `_code` 的普通 `runtimeAst` 直接返回，漏掉的正是这一步。
- 第 38 例共有两个受该缺陷影响的同型节点：`cs7fce9a3j50000nkqqg` 与 `cs6trmaa3j50000068zg`，V4 都是 3 条 OR“非一对一”条件，V5 都是裸 `var/jsfn`。`cmqsrcha3j50000f3mx0` 在 V4 本来就是空条件，不属于此次问题。
- Phase 116 的 8/8 运行对照和现有 fallback 回归只能证明内部公式求值，没有覆盖 data-if 条件 AST schema。修复回归必须新增：所有成功 fallback 的根节点通过 V5 条件 AST 判定；值 AST 自动包为 `sysop:isTruthy`；合法条件 AST 不重复包装；两个真实同型节点重转后不再出现裸 `var/jsfn`。
- 用户指出的结构退化属实：Phase 115/修复前的 `cs7fce9a3j50000nkqqg` 根仍是 3 分支 `or`，只是第三分支的坏 Formula 被降成空 `val`；Phase 116 为避免该空值，检测到任一 split operand `didDrop` 后放弃整棵 split AST，改用完整 `_code`，而完整表达式又因箭头回调整体进入 custom-expression fallback，最终 3 个 OR 全被包进同一个 jsfn。故只在外层补 `isTruthy` 虽能满足条件 schema和运行真假，却仍不能恢复 V4 的 3 分支可编辑结构。
- 更完整的修复目标应是“保留已成功的 split 条件树，只对失败分支做局部恢复”：最终根继续为 `op:'or'` 且保持 3 个 args；第一、第二分支沿用原结构，第三分支从可信完整运行态条件中恢复后作为合法条件项插回。只有无法可靠对应到局部分支时，才考虑整式 `isTruthy` 作为最后兜底，并应把结构降级显式纳入诊断，不能再次把它宣称为等价的结构化转换。
- Phase 118 设计证据：公式转换器已依赖 Acorn `parseExpressionAt`，可取得完整运行态条件中每个逻辑子表达式的 `start/end` 源范围；无需用正则切 `||/&&`。可先按 V4 `conditionVal` 的 OR/AND 分组建立 skeleton，再只在含 dropped 的组中使用 Acorn 顶层逻辑段做对应恢复，并要求段数与 skeleton 完全匹配，否则保守失败而非丢弃整树。
- 两个“非一对一”节点的失败 Formula 本身没有 `_code`，但节点级 `binds.value._code` 是有效完整表达式；第三个 `条件容器1` 同样体现了单项 editor code 的括号边界可能依赖外层条件拼装。局部恢复不能仅靠枚举删除末尾 `)`，应以完整运行态表达式的语法树和 V4 条件分组共同提供边界证据。
- Acorn 对三处真实完整 `_code` 的根级分段与 V4 skeleton 精确对齐：两个“非一对一”均拆成 3 个顶层 `||` 段（前两段为 `==`，第三段为布尔 `&&`），`条件容器1` 拆成 2 个顶层 `||` 段（均为 `==`）。这证明可按组索引恢复当前真实坏分支，同时应把“实际段数必须等于 V4 组数”作为安全门禁。
- 推荐实现不再先生成整棵 split AST 后整体 rollback，而是按 condition item 建诊断 checkpoint：原 item 成功则原样保留；原 item `didDrop` 时仅回滚该 item 的 dropped 诊断，尝试用对应完整运行态段恢复；恢复成功保留新诊断，失败则恢复原 AST 和原 dropped 诊断。这样既保留成功分支 AST，也不会为清日志吞掉未恢复错误。
- 局部 runtime segment 的转换结果证明需要两种处理：包含 unsupported `findIndex` 的完整布尔段会可靠降为 `var/jsfn` 值 AST，必须仅在该条件项外包 `sysop:isTruthy`；简单比较和 `条件容器1` 的完整 `.some(...)==true` 段可直接得到正式 `=` 条件 AST。统一规则应按 AST 类别提升，不能固定所有恢复项都包 truthiness。
- 真实重转证明局部策略达到结构目标：两个“非一对一”最终均为 `or[=, =, sysop:isTruthy]`，第三分支内部才含恢复后的 jsfn；第一分支原有 jsfn 仍留在自己的 `=` 条件左值中，第二分支完全结构化。`条件容器1` 保持原生 `or[=, =]`。因此“允许分支公式内部用 jsfn”与“整棵 conditionVal 退化为 jsfn”必须在审计中明确区分。
- 全案终审显示局部恢复只带来预期诊断/公式形态变化：customExpr 631→633、jsfn 615→617，原因是两个目标节点不再各用一条整式 jsfn，而是分别保留第一分支 jsfn并新增第三分支 jsfn；这四个分支 jsfn 均语法有效、参数对齐、无 `$sys/$refs/$SF_/$P_` 残留。业务结构数量全部不变，12 条目标运行对照通过。
- 第 39/51 例按与前序一致的源目录 C 排序确认为 `物料预设库_11360385_温晓华.json`，nid `11360385`；前一项是已完成的 `款式设计_11036309_吴坤.json`，后一项是 `生产设置_11385575_温晓华.json`。本地 v4/clothing 尚无第 39 例目录，历史案例仍全部保留。
- 项目 `scripts/`、`docs/`、README 与 package scripts 中没有直接命中数据库字段/隧道/`work/load` 的可复用命令说明；第 39 例需复用已验证的本地 13306 只读隧道和受限凭证流程，从现有环境配置或历史 shell 记录定位实际查询入口，不能猜表名。
- 中文服只读流程已从 `raw/lianghuang-cn-db-20260630/README.md` 与 `raw/中文服完整案例JSON导出.md` 恢复：使用 `lianghuang_ro.mysql.env` 的只读账号查询 `vxshow.node_vx_data` + `vxshow.node_vx` + `users`，下载走 `https://editor.ivx.cn/work/load/{workId}?nid={nid}`，并复用 VxEditor41 的 sjcl/pako 解码。数据库 env 权限为 0600；版本查询需在既有 SQL 上补读 `JSON_EXTRACT(n.extra,'$.ver')`。
- 本机当前无 mysql/mariadb CLI，默认 Python 无 pymysql；隧道脚本本身只负责 SSH 转发，不携带查询工具。查询实现必须复用已有 Node/Python MySQL 客户端或安装一个最小依赖，不能退回写操作能力更大的平台接口。
- 第 39 例数据库唯一记录：nid 11360385，标题 `FRP_物料预设库`，当前作者罗安琪（源文件名作者温晓华），`extra.ver=null`、`verDetail=null`、两表 `edt_ver=4.1`，因此为 V4.1 候选；`ntype=1`、version 64、当前 work_id `ckggd70en97b4pugbo20-111`。最终版本仍须下载实物扫描事件 AST 后确认。
- 第 39 例最新 `/work/load` 实物明确为 V4.1：完整三根 `case/server/stage`，705 个事件全部有 V4 `tree`、事件 op-AST 为 0，Formula 9,399，且全案 `op/ast/ln/cType` 键均为 0。紧凑 JSON 7,153,738 bytes、SHA-256 `66d6600c11a13ae44f23a6f137b929a4a2344714273819b804fc3e350b210404`，权限 0600。可以进入当前转换器。
- 第 39 例当前转换器一次成功：V5 约 4,803.1 KB，诊断总计 48、去重 48，全部为 custom-expression/jsfn 兜底，dropped 0。控制台所见代表性不支持结构化项为字符串 `.match(regex)` 与正则 Literal，但均已进入 jsfn 保留逻辑，不能仅凭 ParseError 栈判为错误；需从诊断实物、最终 jsfn 语法/参数及动作映射判断。
- 第 39 例 48 条诊断均为 `custom-expr-fallback`：37 条动作参数、9 条 bind、2 条无参数名事件子块；主因是正则 Literal 28 条（其中 `/['%]/g` 21）、`.match` 5、整段 full-JS 4、若干 `.toFixed` callee/hasOwnProperty/findIndex 等。没有任何 jsep/AST dropped 记录。最终需要验证这 48 个对应 jsfn 均能解析且没有旧运行时自由标识符。
- 第 39 例事件迁移契约与既有基线一致：三根 ID/type 不变；V4 `events.list[*].tree.bid` 迁到 V5 `eventId`，动作 BID 成为 AST `ln`，示例 disabled 动作 `csbg1jpa3j500003mhe0` 在 V5 保留 `skip:true`。转换器会在延时变量动作旁插入随机 ln 的 delaysMethod，因此动作数量审计必须区分源 BID 映射与合法新增行。
- 第 39 例首轮全案审计通过主要不变量：节点 2,321→2,321（2,313 unique，ID/type 集合相同）；事件 705→705 且全部有 V5 AST；3,203 个 V4 action（enabled 3,104 / disabled 99）全部按 BID 映射到 ln，99 个 disabled 均 `skip:true`。另有 3 个 enabled play 被 skip，需核对其动画 infinite 属性后归类。
- 214 个 data-if 中 212 个有正式 `props.conditionVal.ast` 且根操作符全部合法；两个无 AST 节点在 V4 原本就是 `binds.value={_code:'',code:''}` + `conditionVal:null`，V5 保留兼容空 bind，属于原生空条件。5 个含空 val 的 AST 中 4 个明确来自 V4 `[null,'',undefined]`/`['',null,undefined]` 列表，另一个 `bodySize` 的 V4 条件本身就是 `['','==','']`，均不是转换丢失。
- 最终 V5 有 48 个 jsfn / 18 个唯一代码，全部语法有效、placeholder 与 args 对齐、无 `$sys/$refs/$SF_/$P_` 或 `[object Object]`；184 条非空持久化 `_code` 也全部可编译。cType 444 个（String 287、JsonVal 138、boolean 18、long 1）无空值；19 个悬空 ref target 全在 V4 源中已有，没有转换器新增悬空引用。
- 3 个 enabled-but-skip 动作全部是 `data-animate.play`，目标“顺时针旋转”均 `props.infinite=true`，符合已发布的无限动画自动跳过规则，不是丢动作。
- 服务/后台定向审计通过：125 个 V4 `fireService` 均各自映射为一个 `runsvc`，且 `runsvc.val` 与原 object ID 精确一致；V5 全案 `runsvc=125`。42 个 data-service ID/事件数不变，全部有 AST 和非空 `_code`；server `props.v2=1`。sharedService 23、data-func 22、module defs 21、前台实例 12、后台实例 7 的数量与 ID 均保持，24 个模块实例事件全部有 AST。
- V4 事件块进一步按类型核对：705 root、3,203 action、1,141 con、99 group、100 loop、19 comment 均完整映射；416 个 status 中 410 个有同 BID ln，剩余 6 个 status wrapper 尚需检查其状态类型和子动作是否属于转换器约定的无 ln 包装。3 个 `action:null` 源占位也都保留了对应 ln，不是动作缺失。
- 6 个无直接 ln 的 status 已全部解释：2 个 `uploadFile.uploading`、`uploadPics` 的 uploading/beforeUpload 各 1、`uploadVideos` 的 uploading/beforeUpload 各 1。六个 wrapper 的每个子动作 BID 都进入对应 V5 回调 AST；缺少的只是包装 status 自身 ln，符合上传动作转换约定，不是逻辑遗漏。其余 410 status 均直接映射。
- 第 39 例源清单 JSON 为 7,153,739 bytes / SHA-256 `8e28b668...90ed`，最新 work 为 7,153,738 bytes / `66d6600c...0404`；两者不完全相等，去掉源文件尾随空白后仍不同。本轮必须继续以数据库当前 work 下载实物为准，不能用源清单文件覆盖。
- 第 39 例最终结论：V4.1 → V5 转换成功，未发现转换器错误。V5 4,918,374 bytes / SHA-256 `00bda44f77b6259aa45cc82d898c603a20bbf5fa919439bbb482fffb2bd536fa`；诊断 JSON 31,824 bytes / `e2bc322e...00cf`，Markdown 13,927 bytes / `ae86d72a...fe3b`。来源 README 与转换报告均已生成并受 localCases ignore 保护；第 40 例目录不存在。
- 第 40/51 例按源目录 C 排序确认为 `生产设置_11385575_温晓华.json`，nid `11385575`；前一项为已完成的物料预设库，后一项为用料组合详情。本地 v4/v5 目标目录均不存在，历史案例保持原状。
- 第 40 例数据库唯一记录：标题/当前作者与源文件一致（生产设置 / 温晓华），uid/eid/gid `10000608/10000586/25391`，ntype 1、version 27、work_id `cl4ar70hhv94vjdoo620-353`。`extra.ver=null`、`verDetail=null`、两表 `edt_ver=4.1`，仅能判为 V4.1 候选；需下载实物最终判版。
- 第 40 例最新 `/work/load` 实物明确为 V4.1：完整三根，130 个事件全部有 V4 tree、event AST 为 0，Formula 1,559，且全案 op/ast/ln/cType 键均为 0。紧凑 JSON 1,271,379 bytes / SHA-256 `6f9c970e7a142d8c536daa4360edc93db6b8251bd4bd461f030c6d5d6cce1406`，权限 0600；可以进入转换器。
- 第 40 例源清单为 1,271,380 bytes / `7f5f703f...07fb`，与最新 work 摘要不同，去掉尾随空白后仍不一致；转换必须使用当前 work 实物。
- 第 40 例当前转换器 1/1 成功，V5 约 874.6 KB；诊断 14 条、去重 14，全部为 custom-expression/jsfn fallback，dropped 0。13 条是权限可见性/日志中的 `findIndex`，1 条是新增行序号的 `toString().padStart`，落点为 12 个 bind + 2 个动作参数；需验证最终 14 个 jsfn 的语法、参数与引用安全。
- 第 43 例 callback 参数函数修复已闭环：V4 action callback 契约中的 `func` 必须同时进入 stage property map 的显示名索引与 `$SF_*` 索引；命中时生成正式 V5 `{op:'sysutil', val:<去掉 $SF_ 前缀>, _blockType:'paramFunc'}`，名称不同时以 `_alias` 保留编辑器显示名。该规则通用于全部 callback paramFunc，不依赖案例 BID 或 `transValue` 枚举。真实案例两处 `obj_translateData/transValue` 与手工 AST 精确一致，93/93 回归通过；tov5parser `30a0707`、Lambda v32、VxEditor41 `2b184e84e` 均已发布。
- 第 44/51 例按源目录 C 排序确认为 `花名册_11280925_温晓华.json`，nid `11280925`；前一项为已完成的移动选款H5。必须先通过数据库字段和最新 work 实物共同判版，只有确认 V4 后才运行转换器；第 45 例不在本轮范围。
- 第 44 例源清单实物为 9,908,010 bytes、SHA-256 `bba352df53f656db20ff68510dcb7383060665c77aba3e9d3abe51df35c785a6`；后续下载的当前 work 必须独立留档和比较，不能默认与源清单相同。第 45 项为 `装箱策略预设_11370978_温晓华.json`，当前两侧均无花名册输出目录。
- 第 44 例数据库唯一记录：标题/当前作者与源文件一致（`FRP_花名册` / 温晓华），uid/eid/gid `10000608/10000586/25391`，ntype 1、version 221、work_id `ci8magqtuelq3jqo1p60-1748`、短链 `GXbLhnBy`。`extra.ver`、`verDetail` 均为空，两表 edt_ver 均为 4.1，只能判为 V4.1 候选；最终版本必须由最新 `/work/load` 实物确认。
- 第 44 例最新 work 明确为 V4.1：完整三根，825 个事件全部有 V4 tree、event AST 为 0，Formula 6,945，且全案 `op/ast/ln/cType` 键均为 0。紧凑 JSON 9,908,009 bytes / SHA-256 `a1d364615201fd01b7e696510423aad4a2d0828bbe5d7ad408ba2e088e806001`，权限 0600；可以进入转换器。
- 第 44 例源清单虽为 9,908,010 bytes且末尾有换行，但移除格式后与当前 work 仍不相等：解析后摘要分别为 `c9a67596...bcf2` 与 `a1d36461...6001`。本轮转换必须使用数据库当前 work，不能复制源清单。
- 第 44 例当前转换器 1/1 成功：V5 约 6,383.1 KB；诊断 216 条、去重 201，全部进入 custom-expression/jsfn fallback，dropped 0。控制台 ParseError 只是结构化路径的候选失败日志，必须进一步验证 216 条诊断落点、最终 jsfn 语法/参数/自由标识符以及完整动作结构，不能仅凭 dropped 0 宣告无错。
- 第 44 例已定位一个不可忽略的候选错误：BID `d34d0zba3j500005z6kg` 的 V4 参数 `cbParams.data` 带明确 `cbParams` token，但 V5 最终是零参数 jsfn `cbParams.data`。这不是单纯诊断日志；自由标识符已经落入持久化 AST。需结合所属 status/callback 和 V5 jsfn 执行契约确认正确 AST 应引用哪个 local 回调对象。
- `d34d0zba3j500005z6kg` 已确认为真实转换器错误：V5 jsfn 无隐式作用域，只传显式 `$vN` 参数；当前零参数 jsfn 中的 `cbParams` 必然未定义。V4 最终事件 code 证明该值来自服务调用的 callback `cbParams.data`，错误会被 V5 jsfn catch 静默吞掉并返回 undefined，导致初始化部门数据未写入。正确修复必须根据所属异步动作/状态契约生成 callback local ref + field，而不是保留源码自由变量或按字段名特判。
- 第 44 例最终 jsfn 数量为 216（66 种代码），与 216 条 custom fallback 诊断一致；除已确认的 1 个自由 `cbParams` 外，没有 `$sys/$refs/$SF_/$P_/_loop` 旧运行时残留。常规 jsfn 形态均使用 `val[1..]` 的 `$vN` 声明与 AST args 参数化，说明错误可收窄到 callback 参数上下文丢失，而非整套 fallback 全部失效。
- 校正后的全案结构审计显示，组件、事件、动作块、条件、服务和编译态总体完整；当前确定错误仍是 cbParams。另发现 fallback jsfn 裸调用 `transformString(...)`：三个项目源码都没有该自由函数定义，需确认它是否是 V4 系统方法及 V5 对应 sysutil；不能因为不含 `$sys` 残留就误判安全。
- `transformString` 在本案 V4 并不是有类型的系统 token：公式首 token 只是普通 str，V4 `code/_code` 也都保留裸函数名；因此它可能是源案例自带的外部全局约定。转换器保留它是否构成新增错误，必须看案例内是否定义/注入该函数以及 V5 jsfn 的全局解析环境，不能与明确有 cbParams token 的错误等同处理。
- 本案确有自定义代码节点定义 `function transformString(originalString)` 并执行 `window.transformString = transformString`；因此浏览器中的 `new Function` 可按全局属性解析该名字，V5 保留此自由调用与 V4 语义一致。完整 jsfn 作用域扫描的其他自由名为标准全局 Infinity/Array/Date/Set、候选自定义 getValue，以及非法 cbParams。
- 本案也定义并全局暴露了 `getValue`；因此 216 个 jsfn 的自由名中，Infinity/Array/Date/Set、transformString/getValue 都有合法来源，唯一转换新增的自由标识符就是 `cbParams`。
- 结构边界补审：两个 enabled play skip 都对应 V4 `data-animate.props.infinite=true`；唯一未落 ln 的 action 是 V4 原生 `object:null/action:null` 占位；唯一 V5 保留兼容 bind 的 data-if 源 `code/_code` 均为空。17 个悬空 ref（11 个唯一 scope/id）全部在 V4 原始 JSON 中已有引用文本，不是转换器新造目标。
- 服务审计已由数量提升为逐动作目标核对：133 个 fireService 均以同 BID let 包裹一个 runsvc/runsrv，目标 ID 133/133 精确一致。问题动作所属服务结果 local 明确是 `d34d9mya3j500005z7rgRtn`；正确 cbParams.data AST 应从该 local 结果读取，而不是零参数 jsfn。
- 同一事件中已有权威正确模板：status child 对 `cbParams.data` 生成 `var(get(ref local d34d9...Rtn, field result[_uiSkip], field data))`，`get` 带 `_blockType:'$cbParams', _ver:1`。错误动作处于 async fireService 之后的根级 sibling con；V4 把后续 siblings 继续编译进 callback，因此 cbParams 有效，而转换器只把 action-result context 传入 service status child，后续 sibling 丢失上下文后 fallback 成自由 jsfn。这是通用“异步动作 continuation 上下文传播”问题，不是 data 字段特判。
- 第 44 例最终结构审计未发现第二处转换器错误：组件/事件/条件/服务映射完整，216 个 jsfn 中标准全局与案例自定义全局均有合法来源，唯一非法自由名为 `cbParams`。项目 93/93 回归通过，说明该错误需要新增“异步动作之后的 continuation sibling 仍能解析 cbParams”专项回归，现有套件尚未覆盖。
- 第 44 例最终结论：V4.1 实物转换文件已生成，但 BID `d34d0zba3j500005z6kg` 的参数 AST 不正确，不能判定整例转换成功。修复应让异步 fireService 后续 sibling 继承前置 action-result context，生成 `local d34d9mya3j500005z7rgRtn → result → data` 的 `$cbParams` get 链；不应按 BID、字段名或源码字符串枚举。第 45 例保持未启动。
- Phase 128 修复约束：需要在事件块顺序转换层表达“异步动作后的 V4 siblings 仍在该动作 callback continuation 中”，并让公式转换已有的 cbParams/cbStatus resolver 获得相同 action-result context。不能仅在 formula fallback 中替换 `cbParams.data`，否则其他字段、cbStatus、嵌套 con/group 仍会失败。
- 当前实现已有可靠的 callback 判据：`convertAction` 仅在 `action.callback` 为真时生成 `let [bid+'Rtn', ...]`，status resolver 也最终映射到该 action BID。因此 continuation 查找应基于 V4 事件树中“当前路径之前最近的 `type:'action' && action.callback` 动作”，而不是按 fireService 名称枚举；找到后复用现有 actionResult context/AST 生成逻辑。
- 第 44 例具体词法位置是 root children 中 callback fireService 后的连续 con 链，目标动作嵌套在 else→else 内。查找算法必须能从目标后代逐层上升，并在每层父 children 中搜索当前分支之前最近的 callback action；只查目标动作的直接 siblings 仍会漏掉本例。
- 查找必须保留现有 status 祖先优先级，再以 continuation 查找兜底；这样 status 内的 cbParams 永远绑定所属 action，不会被更早的外层 callback action抢占。第 44 例唯一新增匹配是 status 外的目标动作，风险边界可通过真实全案“自由 cbParams 1→0、其余 AST 摘要稳定”验证。
- 实现没有在线性 sibling 遍历中维护可变全局状态，而是基于 env 中不可变的 V4 blockMap 按 blockId 解析词法 continuation。这样条件/循环/动作组公式入口无需新增参数，所有既有调用 `convertEditorValue` 的路径都能统一获得上下文，也便于原样同步编辑器转换器。
- 真实重转的最关键差分已闭合：错误动作从零参数 `jsfn(cbParams.data)` 变为与同事件 status 模板完全一致的 actionResult get；诊断和 jsfn 各减少 1，说明没有把该表达式留在 fallback。最终 V5 SHA-256 暂为 `fdbc95d2...42cf`，待完整审计和报告更新后作为发布前案例摘要记录。
- 完整审计确认修复没有扩散：所有修复前结构计数保持不变，唯一预期变化是 diagnostics/jsfn 216→215、自由 cbParams 1→0、目标动作改为正式 get。服务目标、条件根、后台代码、cType 和节点/事件映射均无回归。
- VxEditor41 运行态 `dealInitBlock` 会把 children 对象递归建入 caseBlockMap，然后把父 `children` 改成 BID 数组；所以编辑器版 resolver 必须把 sibling BID 经 `getEventBlockByBid` 解引用。tov5parser env 保留原始对象 children，两边应共享词法规则但采用各自数据访问方式。
- Phase 128 最终发布证据：独立转换器以 env blockMap/object children 实现 resolver，编辑器以 caseBlockMap/BID children 适配同一规则；两边分别为 `34c6157` 与 `1bb416838`。Lambda v33 明确绑定 `34c6157`，prod 在线执行 33。该修复对第 44 例的唯一语义变化是把错误 fallback 恢复为 service result get，其他审计指标稳定。
- 第 45 例开始门禁：本轮只处理 `装箱策略预设_11370978_温晓华.json`（nid `11370978`）。数据库版本字段只作初筛，必须下载当前 work 并扫描完整事件结构后最终判版；历史案例不删除，发现转换器错误时先停在审阅门禁，不自动进入修复或第 46 例。
- 第 45/51 例在源目录 C 排序中确为第 45 项，前一项为 `花名册_11280925_温晓华.json`，后一项为 `规格表_11035010_吴坤.json`。源清单文件为 6,147,067 bytes / SHA-256 `b14b7668e48c6fad44aa3ea39a5a05170c233548542b5be846de85381c94fffc`；两侧尚无同名输出目录。
- 第 45 例数据库唯一记录：标题 `FRP_装箱策略预设`、当前作者罗安琪（源文件名作者温晓华），uid/eid/gid `10000588/10000586/25391`，ntype 1、version 30、work_id `ckp2s1gmfeq7vfc7bv70-72`、短链 `MIIt1OlO`。`extra.ver`、`verDetail` 均为空，两表 edt_ver 均为 4.1，只能判为 V4.1 候选；必须下载最新 work 实物最终定版。
- 第 45 例最新 work 明确为 V4.1：完整三根，596 个事件全部有 V4 tree、event AST 为 0，Formula 8,119，且全案 `op/ast/ln/cType` 键均为 0。紧凑 JSON 6,147,066 bytes / SHA-256 `ee66c35234fc26dc6ad0e09825b47ab8b2c457292ddf443e9a6a865fb91e2893`，权限 0600；可以运行当前转换器。
- 第 45 例源清单与当前 work 并非只差末尾换行：去掉源换行后的摘要为 `5727f771...c0ad`，仍不同于当前 work `ee66c352...2893`。本轮必须继续以数据库当前 work 为转换输入。
- 第 45 例转换器一次成功：V5 约 4,170.2 KB，诊断 33 条/去重 33，全部为 custom-expression/jsfn fallback，dropped 0。控制台的 eval/正则/hasOwnProperty 等 ParseError 是结构化尝试失败日志；是否正确必须从最终 jsfn 的语法、参数化和上下文，以及全案结构映射继续判断。
- 第 45 例完整审计通过：2,184 个组件和 596 个事件完整保持；2,742 个有效动作全部映射，96 个禁用动作与 3 个无限动画 skip 均符合源/既有规则。209 个 data-if 中 208 个正式条件全部生成合法 `conditionVal.ast`，唯一源空条件保留兼容 bind；95 个服务调用目标逐 BID 全等。20 个后台服务事件均有 AST/_code，模块/函数数量、299 个 cType 和正式 paramFunc 均通过。
- 本例 33 个 jsfn 共 13 种代码，全部语法有效、形参与 args 对齐、placeholder 闭合，无 `$refs/$SF_/$P_/_loop` 等可执行 legacy 残留；唯一自由名称是 JavaScript 内建 `eval`，与 V4 原公式相同。13/13 种代表运行通过，134/134 段非空 `_code` 可编译。唯一 32 位十六进制纯文本 session 已保留为普通字符串。
- 第 45 例最终结论：V4.1 → V5 转换成功，未发现转换器错误。V5 4,270,298 bytes / SHA-256 `f3ddc021c860c7612c8579ee02ba093aa5d5bc04a991457dc48655fae5240f3e`；完整测试 94/94 通过。来源 README 与 conversion-report 已生成，历史案例继续保留，第 46 例未启动。
- 第 46–51 例执行门禁已由用户更新：无转换器错误时不再逐例暂停，自动连续完成；一旦审计确认转换器错误，立即停止且不得进入下一例，等待用户审阅/修复授权。剩余文件按 C 排序为规格表、订单列表、订单详情、部门产能管理、钉钉后台、面料对应辅料预设。
- 第 46/51 例源清单 `规格表_11035010_吴坤.json` 为 13,369,205 bytes / SHA-256 `f6efade325ad17074eeb5cc5b5f99fc85e07aab6b422a5b7881f391c2c6eb4c5`，两侧尚无同名输出目录。
- 第 46 例数据库唯一记录：标题 `服装-规格表库`、当前作者王洋，ntype 1、version 94、work_id `cav96ql63m5fl8mqv08g-1145`、短链 `XaDu7wjL`。`extra.ver/verDetail` 为空、两表 edt_ver 4.1，只能初筛为 V4.1；最终以最新 work 事件结构判版。
- 第 46 例最新 work 明确为 V4.1：完整三根，614 个事件全部有 V4 tree、event AST 0、Formula 5,763，`op/ast/ln/cType` 全为 0。V4 13,369,204 bytes / SHA-256 `4dd5a8b5f592a213dc933285ebd2a306f7eccb47300828a5a707c5cea24a703a`；源清单规范化后仍不同。
## 第 46 例：自由标识符归因

- `itemcolumeName`：V4 源公式第二个 `find` 分支已经缺少 `item.`，V5 未新增该错误。
- `data.groupC`：V4 动作参数与最终事件代码均将其作为自由表达式使用，V5 未新增该错误。
- 因此上述两类问题应在转换报告中列为“源案例问题”，不能据此判定转换器错误或中断批量转换。
- 条件审计出现的 4 个 `{op:'val'}` 空节点分别位于两个 `switchexp` 的第三个参数中；源码 `processConditionalExpression` 主动插入 `{op:'=',args:[{op:'val'},{op:'val'}]}` 作为真假分支分隔，`ast2js` 也按偶数参数对读取，属于 V5 固定结构。

## 第 47 例：版本判定

- nid `11579336` 的数据库字段只能初筛为 V4.1；当前 work 完整 JSON 中 803 个事件全部有 V4 tree、event AST 为 0，Formula 7,823 且 `op/ast/ln/cType` 键均为 0，因此实物确认为 V4.1，应执行转换。

## 第 48 例：版本判定

- nid `11260428` 当前 work 完整实物含 1,644 个 V4 event tree、0 个 event AST、16,968 个 Formula 对象，且没有 `op/ast/ln/cType` 键；结合两表 edt_ver 4.1，确定为 V4.1。

## 第 48 例：block con 缺少最终事件代码回退

- BID `d00yt7ga3j50000020hg` 的拆分 `value1.code` 为 `$refs.d0t459na3j50000pn2y0.p_value.edit!=3)`，单独解析失败；同一 V4 事件 `_code` 为 `if((($refs.d0t459na3j50000pn2y0.p_value.edit!=3))==(true))`，补上空语句块后可由 JavaScript 解析器验证为有效。
- V5 实际 switch 条件为 `=({op:'val'}, true)`；正确结构在同案其他相同表达式中已有样本，应为 `=(!=(ref.value.edit,3),true)`。
- 数据节点条件 `convertIfCons` 已有“split dropped → 精确提取 runtime segment → 验证后回退”机制；事件块条件 `convertBlockCons` 没有 runtimeCode 输入，仍直接调用 `genConObj`，这是通用转换缺口。
- 该错误会让 `businessAgent=null` 动作无法触发，属于确定性转换器错误，而不是仅有诊断噪声或源案例错误；依用户要求必须在第 48 例停止。
- 修复设计收窄为结构唯一性门禁：只有一个 V4 事件树中恰好存在一个带 `cons` 的 block，且事件 `_code` 可解析出唯一一个 `IfStatement.test` 时，才把该 test 作为 block con 的运行态候选。随后仍按 and/or 分组与条件项数精确切片，仅对 dropped 的条件项回退；有多个 block 条件、多个 if 或无法一一对齐时保持原 dropped，避免把 action/status 内部 if 误配给业务条件。
- `convertBlockCons` 将复用 `convertIfCons` 已有的诊断 checkpoint、runtime segment 提取与 AST 可用性验证；这不是删尾括号特判。真实事件恰好满足“一棵事件树一个 con + `_code` 一个 if”，运行态 test 为 `(($refs...edit!=3))==(true)`。
- 初版实现验证通过：`convertEvents` 仅在 event tree 的启用 `cons` block 数量为 1 时暴露 `_code/code`；`convertBlockCons` 仅接受可解析出唯一 `IfStatement` 的运行态代码，再复用现有 logical segment 对齐。修复前失败用例精确复现 `{op:'val'}`，修复后恢复嵌套 `!=`。
- 真实 AST 精比发现一个表示层差异：直接返回整个 runtime item AST 会把 `$condVal` 标在外层 con wrapper；正常 V5 样本是外层 `=` 无标记、内层左操作数 `!=` 带 `$condVal`。应在 runtime 根操作符与 split 根一致时只替换发生 dropped 的 operand，并把 runtime 根的 `$condVal` 元数据移到该 operand；这样同时保持 wrapper、未损坏的另一侧和编辑器可逆结构。
- operand 级修复已验证：真实目标与同案正常样本的 AST 层级/元数据一致，诊断只减少原 dropped 1 条，其他结构计数完全不变。审计仍看到一条 `$$refs...` jsfn，这是修复前就存在的案例公式，需在发布前回溯 V4 源值确认它不是本次或其他转换器引入问题。

## 第 51 例与 clothing 整批收尾

- `面料对应辅料预设_11077441_温晓华` 最新 work 完整实物是 V4.1：1,084 个事件全部有 V4 tree、event AST 为 0，Formula 14,674，`op/ast/ln/cType` 均为 0。V4 为 15,180,451 bytes / `24d5bf9c...12f7`，V5 为 11,544,569 bytes / `ce995eb3...aef3`。
- 第 51 例诊断 142/unique 142/custom 142/dropped 0。142 个 jsfn（72 种代码）全部通过语法、形参/args、placeholder 和 legacy 残留检查；297 段非空 `_code` 可编译。唯一非标准自由名称是源公式中未加引号的 `禁用失败/反禁用失败/反审核失败`，三者在 V4 最终事件 `_code` 中也原样存在，因此是源案例问题，不是转换器新增错误。
- 第 51 例 data-if 正确结构为 `props.conditionVal.ast`：414 个节点中 412 个正式条件均使用合法条件根且 `binds={}`；只有 2 个 V4 `code/_code` 全空的源空条件保留 `{value:{op:'val'}}` 兼容 bind。旧审计按 `conditionVal.op` 取值才会将 414 个全部误报为缺失。
- 第 51 例完整性闭合：节点 4,120→4,120，事件 1,084→1,084，有效动作 5,356 个全部映射，176 个 disabled 全部 skip，4 个额外 skip 均为 infinite animation；184 个 fireService 逐 BID/目标精确一致；51 个后台事件均有 AST/_code；756 个 cType 及 369 个 formal paramFunc 均正式有效。
- clothing 源目录共 51 个 JSON，V5 侧现有且仅有 51 份与源文件同名的 `conversion-report.md`，缺失 0。其中 46 例产生 `app.v5.json`，5 例最终判为原生 V5/V5.1 后跳过转换：工艺制作说明书、快递公司配置前端、快递公司配置后端、新裁剪任务单、部门产能管理。

## Phase 132：自动工作流现有链路调研

- 现有 Lambda `convertV4ToV5` 只接收内联 `v4CaseJson` 或 `v4CaseJsonS3Key`，成功时只返回 V5 JSON/下载指针，硬失败时返回 `code=10003 + errorMessage`。它不获取案例、不判版、不启用诊断采集、不验证转换正确性，也不创建 V5 案例。
- `app.convert-errors.json/.md` 是本地 `scripts/convert-local-cases.mjs --diag` 启用 `convertDiag` 后由调用脚本整理和落盘的报告，不是转换核心或当前 Lambda 自动产生的文件。
- VxEditor41 案例基础 API 为 `/work/create`、`/work/saveAs`、`/work/load/<workId>` 与 `/editor/work/get`。`onCreateCase` 支持直接传 `caseData`；创建 V5 时对外传 version≥5，对后端仍用 `version=4.1` 并通过 `extra=EditorVerHelper.genEditorVerInfo(...)` 写入 V5 版本信息。`gid` 作为可选查询参数传给 create。
- VxEditor41 `onSaveAsWork` 调用 `/work/saveAs?nid=<sourceNid>`，POST body 是完整 nodes；这与新建空案例后再 save 不同，能让服务端保留“从原案例另存”的业务语义。但是否允许非 owner 的参与者 token 调用，必须从 HTTP 认证实现和后端权限校验进一步确认，不能仅根据前端按钮可见性推断。
- VxEditor41 当前的“另存为 5.0 案例”不是一次 API，而是编排链：当前案例 `saveDealCase` → 内存转换器 → `/work/saveAs?nid=<old>&newVer=2` 创建新 nid/workId → 默认配置迁移 → 将 JSON 中旧 nid 替换为新 nid（但回退 `modDbId` 中的替换）→ `/work/save/<newWorkId>?nid=<newNid>` 写入最终 V5 JSON。新工作流要复制这条链，不能只调 `saveAs`。
- VxEditor41 的 `ajaxSend` 没有设置 Bearer/token 请求头；同源 XHR 默认依赖浏览器会话 Cookie，`withCredentials` 只在少量跨域请求中显式打开。因此用户所说的“token”是否可直接替代编辑器 Cookie，目前没有代码证据；必须先确认平台服务端支持的服务端认证协议。
- 编辑器按钮层只在非 guest/非 sandbox 时显示另存；这只是 UI 门禁。真正的“参与者能否读/能否另存”必须以 `/editor/work/get`、`/work/load`、`/work/saveAs`、`/work/save` 在对应用户身份下的 HTTP 结果为准。

## 2026-08-11：本地独立分发包实施决策

- 用户进一步明确：工作流运行在用户本地 Codex/Claude Code Agent 中，AI 分析也由本地 Agent 参与；因此 Phase 132 的中心化编排器调整为本地确定性 CLI，平台只提供当前用户权限下的元数据、load 与 Save As API。
- 面向其他用户分发时不能要求克隆或在 `tov5parser` 源码仓运行。最终产品拆为稳定 Launcher、可版本化 Workflow Runtime、只读可校验 Converter Runtime和 Codex/Claude 薄适配层；Converter 仍只由当前维护者发布。
- Job 默认不放当前工作目录，权威数据落用户全局私有目录；当前目录只保存不含 token/完整案例的可选引用。所有敏感文件 0600、目录 0700，token 只从环境变量/Keychain/隐藏输入进入内存。
- 每个新 Job 在开始前逻辑检查 stable manifest；默认 `prompt`，可选 `auto/never`。不可变包下载后必须校验 hash/签名、兼容性和冒烟测试，再原子切换；运行中 Job 固定 workflow/converter 版本，旧版本保留用于恢复和回滚。
- 更新不采用 `git pull`，而采用签名发行包和 `stable/canary` 清单。稳定 Launcher负责 Workflow 自更新，Workflow负责 Converter版本检查；Agent Skill 仅在 agent protocol 变化时同步。
- 目标 sibling `/Users/lianghuang/Desktop/ivx_repos/ivx-v4-v5-migration` 当前不存在，可以无覆盖风险地新建独立项目。宿主 Node 为 v24.14.1、npm 11.11.0；分发包仍以 Node >=20 为运行基线，优先只用标准库降低安装面。
- 当前 `@visuallogic-vlcode/tov5parser` 根导出只有 `convertV4CaseJsonToV5CaseJson` 与 `loadRuntimeMaps`；诊断 collector 位于未公开的 `v4ToV5/utils/convertDiag.js`。Workflow 的 Converter Provider 必须允许“基础转换”和“带正式诊断转换”两种能力，并在缺少后者时明确 capability，而不能依赖私有子路径作为长期发行协议。
- 本轮不会为了搭建 Workflow 擅自修改 converter 导出；MVP 先定义稳定 provider/manifest 契约并支持当前基础转换。后续由 converter 维护流程单独发布公开的 detailed conversion API 后再启用正式诊断能力。
- 真实 converter 集成冒烟候选优先选 `localCases/v4/user-avatar-menu/app.json`（约 500,780 bytes），显著小于同批 0.9–5.6MB 样本；可在不触发平台网络/保存的情况下验证独立 Workflow 对当前 tov5parser 公共 API 的兼容性。
- 首次真实冒烟正确把 `localCases/v4/user-avatar-menu/app.json` 实物识别为 V5（9 个 event AST、0 个 V4 tree），以 `SKIPPED_ALREADY_V5` 结束且未调用 converter。说明目录名不能代替实物判版，同时验证了“非 V4 不转换”的门禁。
- 搜索更小 clothing V4 样本时，使用 `xargs wc` 未处理含空格目录名，导致 `PAD 量体_...` 被拆成两个参数并报路径不存在；其余无空格结果仍返回。后续不再用裸 xargs，改用 NUL 分隔或直接选已知的 `合并分床小工具_12105173_熊/app.json`（约 106KB）核对后冒烟。
- `合并分床小工具` 是真实 V4.1 但没有任何版本化事件信号；按文档规则应由元数据兜底。初版 classifier 把“有 work 但物理信号为空”留在 ambiguous，已补为 `CONFIRMED_V4_METADATA_FALLBACK`，且只有无 V5 冲突信号时才允许转换。
- 当前 converter 对该 eventless V4 成功产出 V5，节点 5→5且摘要稳定；首版 validator 仍强制要求目标至少出现一个 V5 event AST，于是产生 `TARGET_NOT_V5` 假阳性。对没有事件的 work，文件本体本来就无法区分 V4/V5；正确规则是：源有 V4 event tree时目标必须有 V5 AST，源/目标都无版本化事件信号时由已确认元数据和“目标无 V4 残留”兜底，不应报 blocker。
- 更新分发的可维护边界已经实现为“双签名清单”：Workflow 与 Converter各自拥有不可变 tarball、SHA-256、兼容范围、minimumSupported/revoked 与 stable/canary manifest。用户机器在每个新 Job 前检查；默认提示、可选自动更新，运行中 Job 不换版本。普通 converter 修复无需改 Agent Skill。
- 维护者发行不依赖 Git pull：`release sign` 使用离线 Ed25519 私钥对 payload 的精确字节签名，客户端只持公钥；tarball 先上传、签名清单最后原子提升。测试确认清单 0600、签名可验证且输出不含私钥文本。
- 独立 MVP 的 AI 权限边界通过端到端验证：Agent 只能提交与现有 validation issue 一一对应的 owner 分类；CONVERTER 永远不能 repair；SOURCE 且明确允许的修复只能走受限 RFC6902 Patch，禁止 identity/secret/整根替换，并必须重新运行确定性验证。
- 平台接入仍有一条不可跳过的硬边界：必须分别验证 source load 和目标 Save As 权限，并完整复刻 VxEditor41 的多步另存链、保存后回读及 `SAVE_INCOMPLETE` 恢复。MVP 因缺少经实测的参与者权限矩阵而不暴露任何线上写入命令。
# Phase 33：运行时等价诊断与知识库整合（2026-08-12）

- `vx-json-evolution-claude` 的三套主文档是基于真实案例、编辑器源码和转换证据形成的知识资产，但项目自身明确声明：它们不能单独证明编辑器往返或 V4/V5 运行时等价。
- 该项目已经定义了可用于工作流诊断的证据层级：真实案例证明“存在”，编辑器/运行时代码解释“语义”，转换器实现仅作为线索而不是结果标准。
- 因此文档应作为版本化、可追溯的诊断知识库接入工作流；不应把整套 Markdown 直接塞入 Agent 提示，也不应把叙述性结论直接当作自动修复授权。
- 知识条目需要保留规则 ID、适用版本、证据引用、置信度、例外和自动化级别，Job 必须记录实际使用的知识版本与规则 ID。
- 初次批量读取文档输出过长而截断；后续改为按文件、按段读取关键章节。
- 当前 Workflow 的静态验证器只覆盖三段根、版本信号、节点保留/重复、AST 基础形态与 `jsfn` 语法/参数个数；它没有编辑器加载验证、运行时行为采集或 V4/V5 行为比较能力。
- 当前问题分类 schema 只有单一 `owner`（CONVERTER/SOURCE/PLATFORM/AUTHORIZATION/UNKNOWN）。这把“发生原因、负责方、可修复对象”混为一体，不足以表达测试脚本错误、环境不稳定、知识缺口、平台运行时差异和案例级目标修复。
- 当前 Patch 策略只允许对 Job 内 V5 JSON 做最多 20 条受限 RFC 6902 操作，保护身份/凭据字段；这可以继续作为 AI 修复的底层安全门，但需要增加运行时证据、修复轮次和保存目标约束。
- 当前保存编排器具备更新已创建目标案例与读回校验的底层接口，但状态机在首次另存完成后进入终态；要支持运行时修复闭环，应新增“同一目标案例的受控修订链”，而不是每轮重新另存产生多个案例。
- `vx-json-evolution-claude` 已有稳定 `CVT-*` 规则 ID、KI 编号、溯源簿与证据锚点，适合生成机器可检索的知识卡；正文还明确将运行时行为作为双表示争议的最终裁判，并要求新发现按最小复现与规则 ID 反哺文档。
- 不应把 `vx-json-evolution-claude` 的本机路径或 Git 仓库直接作为普通用户运行时依赖。推荐从该项目生成独立、不可变、签名的 Knowledge Runtime；Workflow Job 固定其版本与哈希，Agent 只读取按症状/路径检索出的有限知识卡。
- 原始三册和溯源材料来自大量真实案例，分发前需要专门的脱敏与授权审查；终端用户包默认只带派生规则、必要的脱敏片段和公开锚点，不打包完整案例或内部底稿。
- “直到测试通过”应实现为目标导向但有界的闭环：限定同一目标 nid、乐观并发版本、补丁次数、回归检测和低置信度停止条件，避免无限写入或把平台/测试环境问题误修进案例 JSON。

# Phase 134：修复轮次、配置复制与人工反馈（2026-08-12）

- 当前 Workflow 的 `mergeSaveAsConfig(defaultConfig, sourceConfig)` 不是完整源配置复制：主体取当前用户默认配置，只从源案例提取 `customVars`，并删除 `default` 标记；没有迁移源配置的其他顶层配置域。
- 保存编排器会对该“合并后配置”计算哈希、写入目标、再读回核对，因此现有链路保证的是“按当前合并规则写入成功”，不是“V4 与 V5 环境配置等价”。
- 这会让预览域名、微信/支付宝/钉钉等平台配置、第三方集成或环境变量在目标案例中发生变化，运行时比较前必须新增配置等价检查，不能把配置差异造成的行为差异归给转换器。
- VxEditor41 当前普通另存明确执行相同策略：读取源案例 `config.customVars`，再以当前用户默认 Work Config 生成目标 `config`；注释写明“另存的时候，保留环境变量值”。因此 Workflow 现有逻辑是对编辑器现状的复刻，不是无意遗漏。
- VxServer 将两类信息分开存储：`config` 保存微信/小程序/第三方集成与 `customVars`；`settings` 和 work 元数据保存 `domain/path/previewDomain/previewPath` 等运行地址。Workflow 目前只调用 `type:'config'`，完全没有读取或写入 `settings`，因此预览域名不是 `mergeSaveAsConfig` 少合并一个字段，而是缺少一条独立的 Settings 迁移链。
- VxServer 的复制逻辑会主动从复制后的 settings 删除 `domain/path/previewDomain/previewPath`，并给新案例生成新的 play/preview path；服务端还会校验域名是否属于目标用户以及域名+路径是否冲突。这说明不能原样复制预览域名和路径，至少要经过目标用户所有权、平台允许范围和唯一性校验。
- VxServer 的 copyConfig 对通用复制也有安全净化：删除 `wechat_config`，源 `customVars` 的值会被清空，仅保留声明；VxEditor41 普通另存随后又把源 `customVars` 写回。因此“结构复制”“运行值复制”“账号/密钥复制”必须分开制定策略。
- `/work/saveAs` 的服务端复制本身会复制 `node_vx_config`，但会净化配置；随后 VxEditor41 又用“当前用户默认 config + 源 customVars”覆盖目标 config。Workflow 也复刻了这次覆盖。最终目标配置等价性必须按平台最终读回值判断，不能只看 Save As 内部复制步骤。
- `ConfigConfig` 明确包含大量凭据/身份字段，例如支付宝私钥、钉钉 appSecret、企业微信 secret、PayPal clientSecret、Azure subscriptionKey、Android keystore 密码等。完整复制源 `config` 既可能越权，也可能把其他所有者的密钥带给当前用户，因此不能为了运行时等价默认全量复制。
- 自动运行时测试需要把配置字段至少分为：安全可复制运行值、需要目标用户重新绑定的身份配置、绝不可自动复制的 secret、以及由平台重新分配的域名/路径。测试报告应把不等价配置标为 `ENVIRONMENT_CONFIGURATION`，在其解决前不进入 Converter 根因判断。
- 推荐新增字段策略注册表，而不是整对象复制：`COPY_EXACT`、`REMAP_FOR_TARGET`、`USE_TARGET_BINDING`、`REQUIRE_USER_BINDING`、`REDACT_AND_COMPARE`、`IGNORE_FOR_PARITY`。策略应由 JSON Pointer + 版本/平台类型驱动，默认未知字段不复制并上报。
- 预览域名/路径应走 `REMAP_FOR_TARGET`：使用目标用户允许的预览域名和新案例唯一 previewPath，并在行为轨迹比较时归一化源/目标 host、nid、workId；若案例逻辑主动读取或比较预览域名，则该字段不可忽略，必须配置可满足业务语义的目标域名，否则判为环境阻断。
- `settings` 中可考虑精确复制 loading/favicon/tags/indexMetas/UA 等经审查的安全字段；domain/path/previewDomain/previewPath 需重映射，customDomain 重新计算，hideJs 等版本派生字段由目标平台生成。`config` 的 secret 和账号绑定字段默认使用目标用户绑定或要求人工配置。
- 自动修复“3 轮”应只统计成功写入目标 V5 的 AI Patch Revision，不统计诊断、只读重测、测试脚本修复、平台网络重试或用户提供新线索。三轮通常覆盖“首要缺陷修复→暴露的次生缺陷→回归收口”，再继续时因基线累积变化、因果归属减弱和覆盖用户修改风险显著上升。
- 推荐保留默认 3 轮，不直接放宽默认值；允许用户对同一目标显式追加 2 轮，单次授权硬上限 5。只有问题数单调下降、无新回归、修复范围未扩大且置信度仍高时才建议追加；出现振荡、重复失败或根因分类变化时即使未满 3 轮也停止。
- 当前 Job 数据跨 Agent 会话持久化，但 `SUCCEEDED`/`DIAGNOSTIC_COPY_CREATED` 被定义为不可继续的终态。要支持用户人工定位后续跑，应把“案例创建结果”与“运行时验收会话”拆开：前者可完成，后者保持 `AWAITING_HUMAN_EVIDENCE`/`RUNTIME_REVIEW_OPEN` 并可恢复。
- 用户自然语言不能直接改变 Job 或授权写入。应新增 `HumanFinding` 证据对象（症状、复现步骤、V4/V5 观察、可选 JSON 路径/BID/建议原因/是否手工改过目标）；Agent 将其提交给 CLI，CLI 固化来源和时间，随后重新诊断、分类和走原有 Patch/保存门禁。
- 若用户已在编辑器中手工修改目标 V5，Workflow 必须检测目标 `workId` 前进并拉取最新目标，生成与上次 Workflow 基线的外部变更 diff。只有用户明确选择“采用该人工修订作为新基线”后才能验证/重测；禁止自动覆盖人工修改。
# Phase 135：案例 11023063 两个动作块首参 AST 诊断

- 待核验目标 ln：`chz95wfa3j50000v6630`、`cx77xtqa3j5000002qxg`。
- 当前用户观察只证明编辑器展示异常；在对照 V4 源参数、V5 AST 和编辑器反序列化契约前，不预设是 Converter、源数据或平台编辑器问题。
- 用户仅授权定位，因此不会执行 Save As、诊断副本创建、目标修复或 Converter 源码修改。
- `doctor` 只读健康检查通过：平台已配置且 Token 可用；Workflow `0.3.8`、Converter `1.2.1`，两者能力/兼容范围匹配。
- `doctor` 报告 Codex/Claude 的 workflow skill 相对托管版本存在本地修改；本轮保留本地文件，不执行覆盖式同步。
- 当前 CLI 对 `runtime status` 返回 `CLI_COMMAND_UNKNOWN`，说明已加载的技能文档与本机 CLI 命令面存在版本差异；需从 CLI 当前帮助寻找等价只读状态命令，不能重复同一失败命令。
- CLI 当前帮助确认 0.3.8 没有 `runtime` 命令；本次静态 AST 诊断不依赖浏览器 Runtime Review，可将该项记录为文档/CLI 版本差异。
- 签名发行检查：Converter `1.2.1` 为 `CURRENT`；Workflow `0.3.8` 有兼容的 `0.4.1` 可更新，`required:false`，本机更新策略为 `prompt`。未获用户授权前不安装本地 Workflow 更新。
- 仓库已有 nid `11023063` 的完整 V4/V5/诊断产物：`localCases/v4/clothing/frp后台1_11023063_熊/app.json` 与对应 V5 目录，可先做无新 Job 的只读证据提取。
- 两个目标 ln 在 V5 中都是动作根 `let`，分别调用数据库变量的 `execSql`；首参精确结构均为 `method.args[0] = {op:'var', args:[{op:'jsfn', ...}]}`，第二参是空 `{op:'val'}`。
- 两个 V4 源动作首参均为 `Formula` 类型 `sql` 参数，公式由 SQL 文本、组件字段 `$refs...p_value`、service params 和三元表达式拼接；第二参 `variables` 为 null。
- 同一两个 ln 在旧目录 `frp-后台/app.v5.json` 与 nid 专属目录产物的 AST 完全一致，排除单次转换/落盘随机损坏；这是稳定的结构化转换结果。
- 目标首参的 `jsfn` 可见内容和参数绑定均完整，当前可疑点集中在编辑器对动作参数中 `var(jsfn)` 的反序列化/展示契约，而非 SQL 字符串或参数数量明显丢失。
- 诊断文件对两个目标均给出相同闭环：`phase=custom-expr-fallback`、`outcome=custom-expr`、`message=not support ||`、`prop=sql`、`propKind=actionParam`。因此 `||` 触发了 full-JS/jsfn 兼容兜底，而不是结构化 concat/switchexp 转换。
- 本案共有 78 个 `execSql` 调用：首参形态为 `var(concat)` 56、`var(jsfn)` 15、`var(get)` 3、空 `val` 4。正常结构化 SQL 的外层 `var` 明确带 `cType:'String'`；两个目标的 `var(jsfn)` 外层没有 `cType`，这是下一步需要与其余 13 个 jsfn 和编辑器契约核对的高价值差异。
- 历史转换报告只验证了 1,009 个 jsfn 可编译且形参与实参数量匹配，未验证编辑器反序列化/展示；因此原报告“逻辑保留”与当前“编辑器不可显示”并不矛盾。
- 本案 15 个 `execSql` 的 `var(jsfn)` 首参全部没有外层 `cType`，所以“缺少 `cType:'String'`”是 custom-expr fallback 的系统性特征，不能仅凭两个目标就定为它们独有根因；需要核对编辑器是否普遍无法显示这 15 个落点。
- 两个目标的 jsfn 不是 AST 特例：同案还有 13 个结构相同的 SQL fallback；潜在影响范围至少覆盖本案所有 `execSql.sql` 的 custom-expression fallback，而非仅两个 ln。
- VxEditor41/VxEditor5 及 widgets sibling 仓库均存在，可用实际编辑器反序列化源码确认 `var(jsfn)` 和 `cType` 契约。
- 转换器 `V4FormulaCodeConverter.js` 约 2517 行的注释明确声称 custom-expression 输出“与编辑器公式编辑器保存 bind 的产物一致：jsfn 外层包 var”；当前必须验证这条假设是否只覆盖 bind、却遗漏 action parameter 的类型/显示契约。
- 现有回归包含“server action parameters retain inferred cType without copying target type”以及多条 jsfn 语义测试，说明类型传播与 custom-expression 是两个已有但可能未交叉覆盖的测试维度。
- `processCustomExpr()` 的实际返回值固定为 `{op:'var', args:[{op:'jsfn', val, args}]}`，没有设置外层 `cType` 或目标 action-param 类型；因此任何 jsfn fallback 都只能依赖调用链后续的类型装饰。
- 现有 cType 回归覆盖字符串/数字字面量、对象、service param 和 serverTime，但没有 jsfn fallback；现有 jsfn 回归又主要验证运行语义、单行和参数配对。二者的交叉缺口已确认。
- VxEditor41 的可见代码中 `ASTToBlocks.js`、`VLangToTree` 和 blockProcessor 都有 `jsfn` 分支，说明编辑器并非完全不支持 jsfn；问题更可能是 jsfn 所在 action-param 根节点缺少编辑器所需上下文/类型，而非 `op:'jsfn'` 本身非法。
- `ASTToBlocks.parseAst` 对 `op:'var'` 只是递归展开其 args，对 `op:'jsfn'` 会调用 `customExprPropcessor.toToken`；这个 AST→可视块的核心分支本身不检查外层 `cType`。因此单纯缺 cType 不足以解释“不能显示”，需继续查 action 参数把 AST 送入公式编辑器前的选择/校验逻辑。
- `customExprPropcessor.toAST` 反向生成的正是 `{op:'jsfn', val:[code,...], args}`，结合外层公式保存包装可支持 round-trip；目标 AST 的 jsfn 内层基本符合这个格式。
- 转换器 `dealDbStageMethodValue` 只负责前台直调 DB 的服务参数抽取；本案 scope 为 server，因此需读取 `convertActionParamValue` 主路径，而不是沿用该前台特殊分支判断。
- 编辑器 `TypeChecker.processAst` 也没有 `jsfn` case，遇到 `var(jsfn)` 会得到 `targetType=undefined`，但 `compareType()` 仅在 targetType 和 pType 都存在时校验，因此这不会直接报类型错误；它进一步削弱了“仅缺 cType 导致完全不显示”的解释。
- `convertActionParamValue` 的定义位于 `v4ToV5/utils/action.js`（不是 actionParamConvert.js）；下一步应从该主路径看 Formula 返回 AST 是否被附加 `type`/`cType`，以及 `execSql` 参数契约如何传入。
- `convertActionParamValue` 在结束前只有拿到 `paramType` 才写 `result.type=paramType`；server Formula 还会运行 `applyBackendAstCTypes(result)`。后者能给 concat 推出 `cType:'String'`，但 `inferBackendAstCType`/编辑器 TypeChecker 都不能从 jsfn 推断类型。
- 真实目标的首参既没有 `type` 也没有 `cType`；同案结构化 execSql SQL 通常虽也没有 `type`，却因 concat 推断得到 `cType:'String'`。这表明根因很可能是两条缺口叠加：execSql 参数契约没有向转换器提供 paramType，jsfn fallback 又不可推断 cType。
- 若 `execSql.sql` 的权威方法契约应为 String，则正确修复点应优先是动作方法映射/参数类型传播；只给这两个 jsfn 硬塞 cType 会掩盖更广泛的 contract 缺失。
- 两个动作对象类型分别是 `data-league-db`（ln `chz...`）与 `data-db`（ln `cx77...`），V4/V5 节点类型均未改变；不是对象引用映射到了错误组件。
- `action.js` 明确从 `getWidgetMethodMap(...).params` 按参数名取 `paramType`，再给 AST 根写 `type`。目标根没有 `type`，意味着这两个对象的 `execSql` 方法映射没有提供可匹配的 `sql` 参数契约，或方法映射本身未命中。
- `ivxMap.txt` 中可见的 `execSql` 片段至少含 callback 定义；尚需完整提取同名方法对象，确认是否确实没有 `params`，以及 `data-db` / `data-league-db` 是否共用该缺口。
- 原始 `ivxMap.txt` 的唯一 `execSql` 方法确实有 `sql`/`variables` 两个 params，但其 UI 类型写作 `Formula`；legacy map 还有 3 个同名定义（含 `sql` 或 `sqlCode`）。因此“资产完全漏 params”已排除，问题转为运行时 MapCreator/overlay 解析后为何 `getWidgetMethodMap` 没把可匹配契约传到这两个 action。
- 原始 map 的 UI 类型不能直接当作最终 AST Java type；必须读取 `loadRuntimeMaps()` / `getWidgetMethodMap()` 的实际输出，确认 MapCreator 是否将 Formula 映射为 String、以及 data-db/data-league-db 选中了哪个同名方法。
- `env.js` 后台路径只查询 `MapCreator.getVxJaMap()[widgetName].methods`；legacy overlay 只用于前台 `VxWidgetMap`，不会补后台 `data-league-db`。因此 raw legacy `execSql` 定义不一定能进入本案后台 paramsMap。
- `loadRuntimeMaps()` 仅把 `ivxMap.txt` 各顶层映射载入 global；需直接调用运行时 `getWidgetMethodMap` 验证 data-db/data-league-db 的最终结果，尤其确认 VxJaMap 是否包含这两个键。
- 直接运行 `loadRuntimeMaps()` + `getWidgetMethodMap()` 已定案：`data-db.execSql` 与 `data-league-db.execSql` 均返回 undefined。
- `global.VxJaMap['data-db']` 存在，但方法清单只有 dbSelect/dbInsert/dbBatchUpdate 等正式 V5 DB API，没有 execSql；`global.VxJaMap['data-league-db']` 整个组件不存在。
- 因此 action.js 的 paramsMap 对两个目标都为空，首参不会得到契约 `type`。当 SQL 是结构化 concat 时 `applyBackendAstCTypes` 还能推导 `cType:'String'`；当 `||` 迫使它进入 jsfn fallback 时，推导器无 jsfn case，最终根节点既无 type 又无 cType。这一组合与两个目标的真实 AST 精确吻合。
- 当前可判为 Converter 的映射/类型保真缺口，不是源 Formula 损坏，也不是编辑器完全不支持 jsfn。仍需核对 execSql 在 raw maps 的父级归属和 MapCreator 是否已有可复用的 legacy server action contract，确定最小通用修复层。
- 路径级证据：`execSql` 只存在于 `VxWidgetMap.data-db/data-league-db/data-newDb/data-postgres` 的 methods；不在 VxJaMap。`genServerCompActionMap()` 与 `genServerCompActionJaLocMap()` 的 `$execSql` 命中数均为 0。
- 这说明根缺口是“位于 server tree 的 legacy/VxWidgetMap 数据库动作，被转换器仅按 scope 选择 VxJaMap”，导致方法输入契约丢失；不是 raw map 缺资产。
- 影响范围不限两个 ln：所有后台 `execSql` action 的 `paramType` 都会缺失；只有当参数 AST 自身能推导 cType 时编辑器表现被掩盖。任何无法推断类型的 jsfn（或其他 unknown 根）都会暴露同类展示问题。
- 修复层有两个候选：A）后台方法查询在 VxJaMap 未命中时，对明确存在的 VxWidgetMap 方法做受控契约 fallback；B）仅增强 Formula/jsfn 的 backend cType 推断。A 能恢复真实方法 params，语义更完整；B 只修类型症状，可能继续漏 paramsAsObj/errorCb 等契约，应谨慎。
- VxEditor41 原始转换器的 `getWidgetMethodMap` 同样在 `inServer=true` 时只查 `window.VxJaMap`；当前 Node 转换器忠实继承了这个选择。因此这是上游转换算法的通用缺口，不是独立移植时新引入的差异。
- 本地已知原生 V5 样本未找到 execSql 动作，暂时不能从本地手工 V5 JSON直接取规范 AST；需改从当前 V5 编辑器源码/动作契约确认显示门禁。
- 直接把 VxWidgetMap 方法作为 server paramsMap 仍需验证：其 param.type 是 UI 类型 `Formula`，而 server AST 的 `type` 通常应是 Java/VLang 类型。不能在未做类型映射的情况下盲目 fallback。
- VxEditor5 同样使用 codeEditorV2 `ASTToBlocks` 的 jsfn 分支，进一步确认目标 inner jsfn 是可支持的表示。
- VxEditor5 的动作参数重建集中在 `src/stores/funcs/event/methodUtils.js`；检索到它会依据 widget/method 参数生成 UI item，并在部分路径读取或删除 AST arg 的 `type`。需精读该函数确认“无 type+cType”如何导致首参不显示。
- `genGeneralAstParams(method, objNode, ...)` 的硬门禁是 `method`：method 不存在直接返回 undefined；存在则克隆 `method.params` 并为后台节点保留完整 param 定义。动作入参 UI 本身主要来自方法契约，而不是 AST arg.type。
- 因此若 VxEditor5 对这两个 server-tree 数据库对象也按 VxJaMap 查 `execSql`，首参/参数表会因 method undefined 无法正常重建；这与用户现象比“jsfn parser 不支持”更直接。下一步必须定位方法 lookup 的实际 scope 选择。
- `genGeneralAstParams` 的 method lookup 调用点在约 2501 行，实际目标方法由同文件的 `getTargetMethod`（约 4699 行）提供；下一步读取这两段即可确定 VxEditor5 是否按 widgetStore（VxWidgetMap）找到 execSql，以及 AST 值如何灌回参数。
- VxEditor5 `getTargetMethod` 不按 server scope 选 VxJaMap，而是统一查 `widgetStore.widget[node.type].map.methodsMap[actionName]`；因此它能从 VxWidgetMap 找到 data-db/data-league-db 的 execSql，参数表本身不会因 method undefined 消失。
- 这修正了上一假设：Converter 的 strict VxJaMap 仍会导致 AST 丢 `type`，但 V5 编辑器方法 UI 有独立 VxWidgetMap 契约。要证明首参显示失败，必须继续检查“把 method.args[i] 灌回 Formula 参数”时是否依赖 arg.type/cType，或 customExpr tokenization 是否失败。
- VxEditor5 methodUtils 中 `getActionParamValue` 只有调用、定义来自外部导入；需做 repo-wide 定位。当前 genGeneralAstParams 只是生成参数描述，并不在这里直接解析 jsfn AST。
- `getActionParamValue` 已定位到 `VxEditor5/src/stores/funcs/generalAst.js:2930`；methodUtils 从 generalAst 导入它。下一步读取该函数和通用 AST 动作参数装配，确定是否按 arg.type/cType 筛选。
- `getActionParamsArgs` 能从目标 `let -> get -> method.args` 正确取参，`getActionParamValue` 再按 index/对象 key 取对应 AST；已读部分没有按 `type`/`cType` 过滤。目标首参会原样进入 Formula 编辑器。
- 因此“无 type+cType”能证明 Converter 丢了后台契约元数据，但还不足以单独解释渲染失败；编辑器路径仍会把 `var(jsfn)` 交给 ASTToBlocks。需要核对 customExpr 的具体 tokenization 或实际页面表现，防止把相关缺陷误当根因。
- 平台只读 preflight 通过：nid `11023063` 当前仍是 V4.1、版本 `1018`、ntype 1，当前身份为 GROUP_OWNER 且可读；workId 与既有本地下载链需再核对。未创建 Job或案例。
- `getActionParamValue` 完整实现确认按索引直接返回首参 AST，不看 type/cType；目标不会在取值层被丢弃。
- VxEditor5 `customExprPropcessor.toToken` 会将 jsfn 参数占位符替换为公式块，再只读取 CodeMirror 第 0 行 tokens。目标 jsfn 已是单行，所以历史“换行导致只显示首行”问题不适用；仍需比对手工保存路径是否会补额外元数据或产生不同表达式形态。
- 平台当前 workId 为 `calcup52uhpcud8vv3h0-2539`，本地 version 1018 产物来自 `...-2508`；本地 JSON 不是当前 work 的字节级快照。两个 ln/公式由用户当前观察与本地产物共同命中，但在未新建受管 Job前，证据应标注为“结构稳定、当前平台已确认同版本，work revision 不同”。
- VxEditor5 `setParamAst` 更新已有参数时会清除 op/val/args/_syntaxError/_blockType/cType，但保留原 `type`；新保存的 jsfn 本身仍不会由 TypeChecker生成 cType。说明 type 是参数位元数据，cType 是表达式推断元数据，两者不能混为一谈。
- 当前最直接的 Converter 分叉仍是诊断中的 `not support ||`：两个正常可结构化的 SQL 拼接因内层 `param.order || "ASC"` 被整体降为 jsfn。需核对 V5 编辑器是否已有官方“空值兜底/逻辑或” AST 块；若有，转换器不应退化为 customExpr。
- 一次 `rg` 正则对 `||` 的转义写错，导致模式退化并匹配大量无关行、输出被截断；未修改文件。后续用 fixed-string `-F` 精确检索，不重复该命令。
- 转换器目前唯一可见的结构化条件表达式生成点是 `switchexp`；VxEditor5 还存在 `emptyValCondProcessor`，需要读取其 AST 格式并判断是否对应 JS `||`/空值兜底。
- VxEditor5 的正式空值判断块已确认：`emptyValCondProcessor.prefix='$evc'`，AST 为 `{op:'switchexp', _blockType:'$evc', args:[not(not(a)), a, empty-equality-sentinel, b]}`，运行语义正是 `a ? a : b`，可表达 V4 的 `a || b`，并可在公式编辑器正常往返显示。
- tov5parser 全代码未发现 `$evc`/emptyValCond 生成；它只支持普通 conditional `switchexp` 和 `&&` 等逻辑 AST。两个目标因 `param.order || "ASC"` 进入 jsfn fallback，而不是生成现有的正式 `$evc` 可视 AST。
- 根因现应表述为：V4FormulaCodeConverter 缺少 LogicalExpression `||` → V5 `$evc` 的结构化转换，fallback 保留运行语义但破坏编辑器正常展示/可逆性。缺 type/cType 是伴随的元数据缺口，会扩大 backend customExpr 的风险，但不是本案最直接的首个语义分叉。
- 进一步读源码发现 `processBinaryExpression` 表面上接受 `||`，但把它交给 `genConditonValAST` 并映射成 `op:'or'`。这个 AST 表示布尔条件“或”，不能保留 JavaScript value-or 的返回值语义（如返回 `param.order` 或字符串 `ASC`）。
- 两个目标的 `||` 嵌在字符串 `+` 拼接内部；顶层 addition/concat 的专用递归路径显然没有采用 `$evc`，最终抛出通用 `not support ||` 并让整条 SQL 降级。下一步定位 `genAdditionExpressionAST`/`genStringConcatAST` 的具体 reject 点。
- 精确定位：`genStringConcatAST` 定义约 1662 行，`genAdditionExpressionAST` 约 1707 行；上一轮读取了错误的 2200+ 行区间，未修改文件，现按真实位置读取。
- `genStringConcatAST` 本身只递归 `processParsedTree` 并拍平 concat，没有显式拒绝 `||`；`processBinaryExpression` 又有 `||` case。诊断仍报 `not support ||`，说明目标 `||` 很可能被解析成未覆盖的 `LogicalExpression`（而非该函数接收的 BinaryExpression），或由另一解析器路径进入 default。
- 下一步以当前 jsepWrap 对真实公式做只读 parse，结合 `processParsedTree` dispatch 精确确认节点类型；不再从错误信息反推函数。
- 首次内联真实 SQL 到 Node 命令时，公式里的引号被 shell 截断，导致 `param is not defined`；未修改文件。改为 Node 直接读取本地 JSON并按 bid 取 code，避免再次手工转义公式。
- 一次包含反引号的 `rg` shell 引号不匹配而失败；未执行检索。后续只检索结构标识/函数名，不把模板字面量写进 shell pattern。
- `processParsedTree` dispatch 只显式处理 `BinaryExpression`，没有 `LogicalExpression`；若当前 jsep 对 `||` 返回 LogicalExpression，default 会静默 `{op:'val'}`，但诊断中的 ParseError 仍可能来自其他嵌套路径。必须以真实 parse 结果定案。
- 真实公式 parse 已确认内层 `||` 是 `BinaryExpression`，所以当前代码会进入 `processBinaryExpression`；LogicalExpression 假设排除。
- Git blame 解释了本地诊断与当前源码的矛盾：`case '&&'/'||'` 是 2026-08-07 的 `c4d2077` 才加入；本地 app.v5/report 于 2026-07-24 生成，当时确实会报 `not support ||` 并输出 jsfn。当前 Converter 1.2.1 则会生成 `op:'or'`，必须按当前逻辑继续定位。
- 用户今天观察很可能对应当前 `op:'or'` 产物，而不是本地旧 jsfn；不能用旧产物直接作为最终 AST 结论。下一步读取 `c4d2077` 的意图/回归，判断它把 value-or 错当 boolean-or 的范围。
- `c4d2077 fix: structure safe filter logical formulas` 的 diff 明确把此前落入 default 的 `&&/||` 放进 `genConditonValAST`；新增测试只断言 `||` 产出某个 `op:'or'` 且运行结果正确，没有验证 Formula 编辑器 AST→blocks→AST 往返或嵌套在 concat 中的显示。
- 该提交的 `||` 回归样本 `objArr_item(...) || '-'` 与本案同属 value-or，却被当作条件 operator AST。这是当前最强的回归来源：运行时 `ast2js` 可保持 JS `||` 语义，但编辑器可视模型应使用专门的 `$evc` switchexp。
- 因此本案很可能是 2026-08-07 修复引入的“运行语义通过、编辑器表示不规范”缺陷；需要用当前 converter 对两个真实公式做内存级单元重放确认现输出为 nested `op:'or'`、无 jsfn。
- 已用当前 `V4FormulaCodeConverter` 对两个真实 V4 `sql` Formula 做内存级重放：两者当前均生成 `var(concat...)`，不再含 jsfn，并且各自只含一个嵌套 `op:'or'`；该节点精确对应 `param.order || "ASC"`，没有 `_blockType:'$evc'`。
- VxEditor5 `condValProcessor` 明确标注为“条件判断(bool)”，`checkOp()` 会把 `and/or/sysop` 全部序列化为 `$condVal`；因此当前 `op:'or'` 在 concat 内会被当作布尔条件块，而不是返回左值或右值的表达式块。
- VxEditor5 `emptyValCondProcessor` 是正式的值兜底表示：`{op:'switchexp', _blockType:'$evc', args:[not(not(a)), a, empty-sentinel, b]}`，ASTToBlocks/BlocksToAST 都有专门分支，能正常往返公式编辑器。
- `ast2js` 的 `opMap` 把 `or` 映射为 `||`，所以现有 `c4d2077` 回归只验证执行值时会通过；该测试没有覆盖 AST→blocks→AST，也没有覆盖 `op:'or'` 嵌在字符串 concat 中的编辑器展示。这是“运行正确、编辑器首参不显示”的直接原因。
- Converter 的确定性首个分叉位于 `V4FormulaCodeConverter.processBinaryExpression()`：它把所有 `||` 交给 `genConditonValAST()`，后者无上下文地区分 value-or 与 boolean-or，统一输出 `op:'or'`。最小修复应为 value-or 生成 `$evc` switchexp，并补真实 SQL 的编辑器往返回归；`execSql` 后台方法契约缺失应作为独立元数据修复评估。

# Phase 136：同步最新线上 VxJaMap

- 用户指出 VxEditor41 的后台 Java 组件 Map 已更新，要求从其线上 `locale.js` 读取最新资产并补全 Converter 的 VxJaMap。
- VxEditor41 当前仓库的 `shared/proxyRuntime.js` 明确引用 `https://file3.ih5.cn/v35/locale/20260617182958/locale.js`；仍需核对编辑器运行时加载/覆盖逻辑与线上响应后，才能把它定为当前权威快照。
- 本轮允许修改 tov5parser 的 vendored Map、加载逻辑和测试，但不创建/修改平台案例，不提交、不推送、不发布。
- 转换器现有权威资产为仓库根 `ivxMap.txt`，加载器位于 `utils/MapCreator.js`；`v4ToV5/env.js` 的后台方法查询直接读取 `MapCreator.getVxJaMap()`。
- 首轮检索使用了不存在的旧推测路径并触发 zsh glob 错误；已记录并改用真实文件清单，不从失败输出推断资产结构。
- VxEditor41 的默认 `locale.js` URL 可被 `IVX_LOCALE_URL` 覆盖；`editor_entry.js` 通过页面已有 `locale.js` script 标签反推 CDN 前缀，说明权威版本应从线上编辑器入口实际引用解析，而不是只信本地默认常量。
- tov5parser 的 `AGENT.md` 含自动提交/推送/部署流程，但本任务上层 Git 规则明确要求项目代码修改后先询问用户是否提交；本轮以后者为准，不自动提交、推送或发布。
- 2026-08-13 线上 `https://dev.ivx.cn/` HTML 实际引用 `//file3.ih5.cn/v35/locale/20260813145238/locale.js`，这是当前页面权威版本；它新于 VxEditor41 本地默认的 `20260617182958`。
- 旧默认 CDN 响应显示约 4,976,795 bytes、ETag `cad93a32e10c66e02c8b7e5a1855d70b`；现有 `ivxMap.txt` 为 14,131,315 bytes、SHA-256 `e79c587a...6e`，内部版本 `VxLangLocalVer=2026/6/18 10:01:59`，确实是六月快照。
- 最新线上脚本将只下载到临时目录并做静态解析，不直接执行不受信任的 JavaScript；目标只替换 `ivxMap.txt` 的 `VxJaMap`（以及若契约要求的紧密配套版本字段），避免无关 VxWidgetMap 漂移。
- Acorn 安全字面量解析完成：线上脚本共有 `VxLocale/VxLoc/VxJaLoc/VxExLoc/VxJaMap/VxJaVer` 六个赋值；`VxJaMap` 解析访问 14,954 个字面量节点，没有函数、调用或未知标识。
- 新旧 VxJaMap：179→180 个组件；新增 `data-league-db`，变更 `data-db` 与 `server-security`，无组件删除。`data-db` 新增 10 个方法（含 `execSql`），`data-league-db` 有 13 个方法（含 `execSql`）；两者 `execSql` 都定义 `sql:String`、`variables:JsonArr` 并带 `errorCb:true`。
- 最新 `server-security` 删除 `rsaOaepSha256Encrypt/rsaOaepSha256Decrypt/aesGcmEncrypt/aesGcmDecrypt` 四个方法。为真实同步当前 V5 后台契约，本轮按线上 VxJaMap 精确替换，而不是只做 additive merge；其余 VxWidgetMap/VxJaLoc/VxExLoc/VxSfMap/VxLangLocalVer 保持原样。
- 当前和最新 VxJaLoc 都没有 `data-db:+execSql` 或 `data-league-db:+execSql` 条目；这不影响 `v4ToV5/utils/action.js` 通过 VxJaMap 直接读取动作参数/返回类型，但公式层的英文别名派生仍不会凭空新增该动作。用户本轮只要求补全 VxJaMap，因此不扩大为 VxJaLoc 全量同步。
- 最新 `execSql` 返回类型引用 `DbExecSqlResult`，但最新 VxJaMap 本身没有该 class definition；保持线上原样，不私自补造返回结构。
- 已在旧 Map SHA-256、新 locale SHA-256、必需 `execSql` 契约三重门禁下机械替换 `ivxMap.txt.VxJaMap`；新文件 SHA-256 为 `a808f9a5...868e`。
- 语义 diff 复核通过：除 `VxJaMap` 外五个顶层 Map 字节解析值完全不变；VxJaMap 差异严格只有 `server-security`、`data-db`、`data-league-db` 三个组件，与预分析一致。文本 diff 为 +798/-289 行，来源于这三个对象的精确替换。
- 新增 `latest VxJaMap supplies execSql contracts for backend database components` 回归：对 `data-db`、`data-league-db` 同时断言方法存在、业务参数为 `sql:String/variables:JsonArr`、`errorCb:true`，并通过 `genMethodArgs()` 验证 AST 分别携带 `type:String`、`type:JsonArr` 和错误回调占位。
- 定向测试 1/1 通过；这证明 Map 更新已经修复先前 `getWidgetMethodMap(..., inServer:true)` 返回 undefined 的确定性缺口。
- 对案例 11023063 做完整内存重转（未覆盖历史产物）：两个目标 ln 均为 `execSql`、3 个 args；首参从旧的“无 type”恢复为 `op:var,type:String,cType:String`，第二参为 `op:val,type:JsonArr`，末尾为空错误回调占位，jsfnCount=0。两者内层仍各有一个 `op:or`，这是公式表示的独立议题，不影响本次 VxJaMap 类型契约同步结论。
- 项目完整测试 100/100 通过、0 fail；测试控制台的 ParseError/parse error 是既有 fallback 预期分支，最终 Node test 汇总为全绿。
- 最新线上 VxJaMap 与本地 vendored VxJaMap canonical JSON 完全相等，双方 SHA-256 均为 `cd22ee43f8c9b530b04596a83b928df469afc3bab687fb84a68b91e24aa69789`；`git diff --check` 通过。
- README 已记录线上来源 URL、`VxJaVer` 和“只替换 VxJaMap”的混合快照边界，避免后续把其余 Map 误认成同日版本。

# Phase 137：value-or `$evc` AST 修复

- 用户在 VxJaMap 补全后明确要求继续修复转换生成的 AST；目标是把 `a || b` 的值表达式从 `$condVal/op:or` 改成 V5 编辑器正式支持的 `$evc/switchexp`。
- 本轮保留已完成但未提交的 VxJaMap、README 与测试改动；VxEditor41 工作区有大量与本任务无关的用户修改，后续同步必须只触碰转换器对应文件并在写前后核对差异。
- 修复必须区分 value-or 与 boolean-or：字符串拼接、赋值/返回、动作参数中的 `a || b` 应生成 `$evc`；条件块或明确布尔上下文中的 OR 必须保持 `op:'or'`，否则会破坏条件编辑器和短路逻辑树。
- `gateway` 的真实含义只是“公式编辑器入口/允许 fallback”，不是 boolean context；root value-or 也以 `gateway:true` 进入，不能用它决定 `op:or` 或 `$evc`。
- 最小上下文策略：给 `processParsedTree/processBinaryExpression` 增加显式 `conditionContext`。普通 `||` 生成 `$evc`；当 `&&` 已把表达式纳入布尔逻辑树时，其左右子树以 `conditionContext:true` 递归，嵌套 `||` 保持 `op:or`。比较运算的左右值不传播条件上下文，因为 `(a || b) == c` 中左侧仍是 value-or。
- 普通 V4 条件块由 `con.js` 分别转换 value1/value2 后再组装比较 AST，因此其操作数内部的 `||` 仍应是 `$evc`；无需把所有 condition editor 输入粗暴标为 boolean。
- tov5parser 已实施首版最小修改：新增 `conditionContext`、普通 `||` 生成 `$evc`、`&&` 条件树向逻辑子节点传播 boolean context。实现时及时发现 `genConditonValAST` 会先把 `&&/||` 改名为 `and/or`，因此条件上下文标志必须在 operator 改写前捕获；已修正，避免 nested OR 被误转 `$evc`。
- 公式冒烟结构符合预期：root `order||'ASC'` 为 `$evc`；concat 内嵌 `$evc`；`(value||0)==1` 的比较左值为 `$evc`、比较根仍为 `$condVal`；`(a>0||b>0)&&enabled` 为 `$condVal(and(or(...),...))` 且无 `$evc`。
- 新增正式回归并更新既有 object-array value-or 断言；定向 2/2 通过。既有运行测试继续用 ast2js 验证 truthy/null/missing 等结果，证明 `$evc` 路径没有破坏该样本的返回值。
- 首版上下文传播仍有一个 root 边界：独立公式 `a > 0 || b > 0` 没有 `&&` 父节点提供 `conditionContext`，会被误判为 value-or。现已增加保守的结构化布尔识别：比较、`!`、`&&`、布尔字面量，以及两侧都明确为布尔表达式的 `||`，保留 `$condVal/op:or`；成员、调用等类型不明的操作数仍按 `$evc`。这避免重新把普通 `order || 'ASC'` 扩大成 condition AST。
- 新增 root boolean-or 回归后定向测试仍为 2/2；同一最小算法已同步到 VxEditor41 的目标转换器单文件，未触碰该仓库其他用户改动。
- 最终真实重转再次闭合两个目标 ln：动作均为 `execSql` 且参数数为 3；首参 `type:String/cType:String`、唯一 `$evc` fallback 为 `ASC`、`op:or` 数为 0；第二参 `JsonArr`、末参为空 error callback 占位。验证只在内存中执行，没有覆盖案例产物。
- 最终门禁：tov5parser 101/101、定向 2/2、`git diff --check` 通过；VxEditor41 Babel parse 和目标 ESLint 均为 0 error/0 warning，生产 webpack 构建 exit 0（34 类既有 warning）。两仓都未提交、推送或发布；编辑器用户的其他脏文件保持不动。

# Phase 138：Git 与生产发布

- 用户授权范围是两个仓库提交推送和 tov5parser 生产 Lambda 更新；不包含平台案例写入。发布提交将排除 tov5parser 的未跟踪 VxServer 说明文档，并严格排除 VxEditor41 的用户既有脏文件。
- 为让 Lambda 版本描述精确指向产品代码，先提交并推送 tov5parser 的产品/测试文件，再用该提交发布；部署完成后的版本号和双仓哈希作为独立发布记录提交推送。
- V4→V5 工作流技能不适用于当前发布阶段：本轮不转换/保存/修复案例，只维护 Converter 代码并部署其 Lambda。用户纠正后已停止使用，未产生工作流或平台副作用。
- 远端基线安全：两仓 fetch 后 ahead/behind 均为 0/0，可直接创建普通提交并推送；不需要 merge，更不需要 rebase/历史改写。
- tov5parser 代码发布基线为 `c83c698`；Lambda 应使用该短哈希生成版本描述和历史 S3 key。规划记录与未跟踪 VxServer 文档未进入产品提交。
- 生产回滚点为版本 34（CodeSha256 `TuW0...L30=`）；新发布版本 35 的更新响应 CodeSha256 为 `7aBq...I4c=`，部署脚本已把 `prod` 切换并用别名实际执行 35。仍需独立 read-back 后再封存最终发布记录。
- 独立 Lambda read-back 已闭合，版本 35 状态 Active/Successful、完整 CodeSha256 与发布响应一致、描述为 `tov5parser c83c698 value-or AST and VxJaMap`；回滚版本 34 未删除。
- VxEditor41 发布提交 `c5595597d` 严格为 1 file changed，未混入工作树中其他两份 tracked 修改或任何未跟踪目录；远端 master 已同步。
- 发布记录采用独立 docs 提交，避免 Lambda 版本描述所指的产品代码哈希被发布后记录覆盖；生产实际运行代码仍可明确追溯到 `c83c698`。
- 真实案例 11023063 完整内存重转通过强断言：两个目标首参各有且仅有一个 `$evc`、`op:or` 为 0、fallback 均为 `ASC`；根仍为 `type:String/cType:String`，第二参为 `JsonArr`，错误回调占位存在。
- VxEditor41 目标转换器文件当前无工作区差异，虽然仓库其他路径有用户改动；可安全把同一最小算法补丁应用到该单文件。编辑器版本源码结构与 tov5parser 对应分支一致，但缺少 Node 侧诊断/类型等独立改造，因此不能整文件覆盖。
- 受管环境复核显示 Workflow `0.4.3`、Converter `1.2.1`、Knowledge `0.1.2` 均为当前版本；Token 和平台只读访问可用，运行时浏览器已安装但登录态未配置。本轮诊断不依赖浏览器写入。
- 已有 Job `mig_20260813042241_8e9f7923f3` 处于 `SAVE_INCOMPLETE`，其源 workId 为 `...-2533`，而平台当前 workId 为 `...-2539`。为避免重复 Job 和意外恢复另存链，本轮仅把该 Job 当作只读证据，并明确标注其比当前平台落后 6 个 revision。
- 该 Job 的 Converter 1.2.1 目标产物确认两个动作首参均已是 `var(concat...)` 且根有 `cType:'String'`，内部 `param.order || 'ASC'` 则是 `op:'or'`；所以旧的 `var(jsfn)`、空 cType 现象不能再作为当前版本的主结论。
- 编辑器确定性分叉仍成立：concat 会通过通用 AST→token 路径解析每个子项，嵌套 `op:'or'` 被 `condValProcessor` 识别为 `$condVal`；只有 `_blockType:'$evc'` 的 `switchexp` 才会走值兜底专用往返路径。

# Phase 139：Converter 1.2.2 Release

- GitHub 最新 Converter Release 是不可变的 v1.2.1，target commit 为 `5509ad4`；其资产只有 `tov5parser-1.2.1.tgz` 和签名 `converter-stable.json`。修复提交 `c83c698` 及发布记录 `e6024d6` 均位于标签之后，现有用户无法通过受管更新获得修复。
- Workflow 0.4.3 的 Converter 兼容范围为 `>=1.2.0 <2.0.0`；Knowledge 0.1.2 的范围为 `>=1.2.1 <2.0.0`。因此 Converter 1.2.2 可独立发布，不需要同步发布 Workflow 或 Knowledge。
- 当前 `package.json` 仍为 1.2.1，stable channel 的 latest 也仍为 1.2.1；必须发布新 patch 版本，不能覆盖不可变 v1.2.1。
- 维护者发布脚本会在任何远端写入前强制检查：源码必须干净且与计划提交一致、仓库公开、不可变 Release 已启用、main/release-channel/v* 规则无 bypass、资产/manifest 摘要和 Ed25519 签名有效。发布顺序固定为草稿→资产校验→公开 Release→最后更新 stable channel。
- Converter 的 `package.json` 从建库起一直误留 `license: ISC`；此前用户已决定两个公开分发仓库保持 `UNLICENSED`，而 Workflow 当前也采用 UNLICENSED。v1.2.2 应同步修正 Converter 包元数据；不会改变已不可变的 v1.2.1。
- GitHub 发布安全状态已独立验证：仓库 PUBLIC；immutable releases enabled；分支规则精确保护 main/release-channel 的 deletion 与 non-fast-forward；标签规则精确保护 v*；两者 bypass actor 都为空。维护者私钥为 0600，v1.2.2 远端标签/Release 尚不存在。
- 1.2.2 版本门禁通过：101/101 tests、0 fail；dry-run tarball 为 164 files / 1,787,467 bytes / unpacked 29,336,656 bytes，9 个 bundleDependencies 全部内置，发布所需核心文件全部存在。版本差异仅 package/package-lock 的 1.2.2 与 UNLICENSED 元数据。
- 版本源提交固定为 `5572415` 并已在远端 main 可见；发布资产必须从该提交的干净 worktree 生成，不能从含用户未跟踪说明文件的主工作区直接发布。
- prepare-release 已从干净 worktree 生成 1.2.2 计划，source commit 为完整 `55724159e8192be4435dac12cf57320ad671447a` 且 dirty=false；三个本地摘要分别为 tgz `64631093ef4c735411386697281b8879a8b3a621e2152775ad917efbc9bfb058`、payload `7a4657f9b70f92ec7060b6b93202f1ed8945239b94eccbf059ee18ff8d8f9779`、signed manifest `b197d7d912152fd8118e460a877db900cedd85125af1031f94f2ad4f26bbb501`。
- 已用嵌入公钥独立验签 manifest：latest 1.2.2、minimum 1.2.0、versions 1.2.0/1.2.1/1.2.2、revoked empty；新 descriptor URL/hash/compatibleWorkflow 均正确。实际 tgz 可在无 registry 回退的 offline install 中加载 basic/detailed API，production audit 为 0 漏洞。
- 公开 Release 回读闭合：v1.2.2 isImmutable=true、isDraft=false、isPrerelease=false、Latest；tag → `55724159...447a`。GitHub 资产 digest 分别为 manifest `b197d7d9...bbb501`、tgz `64631093...bfb058`，重新下载后的本地 SHA-256 一致。stable channel → commit `224b79e3...e11d`，远端 manifest 与签名资产逐字节相等。
- 可重复的升级验收路径：在隔离 IVX_MIGRATION_HOME 中 setup 最新运行时；用 v1.2.1 的签名 release manifest 显式安装/激活 1.2.1；运行 stable `update check` 应报告 1.2.2，apply 后应激活 1.2.2；随后用受管 Converter dry-run，回滚到 1.2.1，再重新激活 1.2.2。执行前需确认 setup 的 Agent adapter 安装也能隔离。
- 实际验收采用更低副作用路径：公开 tgz 的“全新安装”已由 isolated offline install 覆盖；受管升级在现有维护者 home 从真实 1.2.1 开始。stable 检测、签名下载、摘要验证、安装和激活均成功，当前 runtime set 为 Workflow 0.4.3 / Converter 1.2.2 / Knowledge 0.1.2。
- 真实受管 dry-run 证明发布包不是只可导入：11023063 V4 snapshot 在 Converter 1.2.2 下转换成功；Job target 的两个报告 ln 均恢复 VxJaMap 类型契约并输出正式 `$evc`，精确断言为 argCount 3、first var/String/String、evcCount 1、orCount 0、fallback ASC、second JsonArr、last val placeholder。
- 1.2.2 Job 的 validation blocker 不构成发布回归：与相同 source SHA-256 的 1.2.1 Job 相比，issue rules、29 个 duplicate ID 计数、554 个 fallback、801/801 node counts 和 333 个 V5 event AST 全部相同；astNodeCount 从 341,992 增至 343,749，符合本次更多结构化 `$evc` AST 的预期。
- rollback 与再升级均通过：1.2.2→1.2.1 后 stable 正确显示 update available，再 apply 回到 1.2.2；最终 doctor pin/hash 与公开资产一致。所有本轮临时 worktree、offline install 和远端下载校验目录已清理。
