# Findings & Decisions

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
