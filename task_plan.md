# Task Plan: tov5parser — 旧版本案例 JSON → 5.x 转换服务

## Goal
将 VisualLogic 旧版本（4.x，规划中含 3.x）案例 JSON 转换为 5.x 案例 JSON，
以自包含独立项目 + AWS Lambda 服务的形态供平台程序通过 HTTP 调用。

## Current Phase
Phase 67（clothing 全案例逐例 V4→V5 测试）— in progress；第 5/51 例已修复、提交、部署并同步，等待用户确认继续第 6 例

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

### Phase 34: 量体部门弹窗展开收起差异诊断（2026-07-27）
- [x] 在 V4/V5 预览中复现点击量体部门、展开和收起操作
- [x] 对比弹窗 DOM、可见内容、状态变量及案例运行日志
- [x] 从交互节点定位相关 BID、小模块和 V4/V5 动作链
- [x] 锁定首个执行或数据分叉点，判断是转换问题还是架构兼容问题
- [x] 给出根因、影响范围和修复建议
- **Status:** complete

### Phase 35: 复核量体部门弹窗实际模块定位（2026-07-28）
- [x] 从当前预览实际 DOM 重新定位树行节点，不仅依赖 Phase 34 的模块假设
- [x] 通过运行时实例/React 数据反查真实模块 class、树节点和行模板
- [x] 用 V4/V5 JSON 的静态属性与绑定公式交叉验证用户的属性改动
- [x] 解释属性改动未生效的原因，并复核原节点与根因判断
- **Status:** complete

### Phase 36: 绑定移除后树行缩进仍异常（2026-07-28）
- [x] 重新加载用户修改后的 V5 预览并读取树行最终样式
- [x] 核对运行时行 props 是否仍存在 paddingLeft 绑定结果
- [x] 验证固定值对顶层、一级和二级树行的实际影响
- [x] 独立验证展开/收起动作及树序号参数
- [x] 锁定字符串拼接展平数值加法的转换根因
- **Status:** complete

### Phase 37: 修复字符串拼接误拍平数值加法（2026-07-28）
- [x] 新增 `(6+层级*18)+'px'` 精确回归测试
- [x] 修复字符串拼接子树转换，保留内部数值 `+`
- [x] 覆盖普通字符串链和混合运算回归
- [x] 运行定向测试与项目全量测试
- [x] 重转 frp-pad 并核验目标 AST 与紧凑产物
- **Status:** complete

### Phase 38: 同步 VxEditor41 并提交推送双仓库（2026-07-28）
- [x] 核对两个仓库分支、远程及已有未提交内容
- [x] 同步公式拼接修复到 VxEditor41 转换器
- [x] 完成两个仓库的定向/全量可行验证
- [x] 仅提交本轮授权范围内的文件
- [x] 分别 push 当前分支并验证远程状态
- **Status:** complete

### Phase 39: 选择部门弹窗首次打开列表为空诊断（2026-07-28）
- [x] 在最新 V5 预览中从全新页面复现首次打开
- [x] 检查加载提示、部门服务请求及返回数据
- [x] 检查树组件 value、可见状态和相关变量更新
- [x] 对比首次加载缓存分支及 V4 的动作时序
- [x] 锁定首个分叉点并给出修复建议
- **Status:** complete

### Phase 40: 复核当前 Chrome 中持续空白状态（2026-07-28）
- [x] 读取用户当前 V5 弹窗的真实 DOM 状态
- [x] 用同一 URL、账号和四条数据行做全新页面对照
- [x] 对照 V4 children/status 与 V5 `let`，定位部门赋值后的第二个错误等待
- [x] 解释全新页“延迟出现”与现有页“永久空白”的不同结果
- [x] 将根因从单一 toast 延时修正为“无回调子块动作被错误 await”
- **Status:** complete

### Phase 41: 排查生成 path 动作组内部真实阻塞点（2026-07-28）
- [x] 撤销“无 status child 的 callback 调用本身不会返回”的错误推断
- [x] 展开 `生成path` 及递归子动作组的完整 V4/V5 动作链
- [x] 检查递归终止条件、循环边界和内部所有阻塞式动作
- [x] 用实际部门数据重放并确认新实例不存在静态未结束分支
- [x] 给出永久空白的修正后根因
- **Status:** complete

### Phase 42: 首开空白、二次打开正常的刷新链诊断（2026-07-28）
- [x] 用独立 Playwright 重放刷新、首开、关闭、二次打开
- [x] 对比两次打开的部门服务、path 与房间登记日志
- [x] 对比树 DOM、组件 value 与模块部门数据
- [x] 判断变量已赋值但 UI 未刷新，还是首次动作未完成
- [x] 给出转换器可实施的最小兼容修复
- **Status:** complete

### Phase 43: 全部列表第二页空部门行精确复现（2026-07-28）
- [x] 进入“全部”并翻到第二页
- [x] 定位第一行空白量体部门及搜索图标
- [x] 记录已选部门、服务、path、房间和树 DOM
- [x] 对比非空部门行为何能触发额外刷新
- [x] 收敛最小转换兼容条件
- **Status:** complete

### Phase 44: 异步树数据写入后补 UI 刷新让步（2026-07-28）
- [x] 明确异步回调上下文在转换遍历中的最小传递方式
- [x] 为命中与非命中场景补回归测试
- [x] 实施受限的零时长 `delaysMethod` 插入规则
- [x] 运行定向测试与项目全量测试
- [x] 重转 frp-pad，核验目标 AST、紧凑 JSON 和影响范围
- **Status:** complete

### Phase 45: V5 变量写入与树组件刷新根因审计（2026-07-28）
- [x] 定位预览页实际加载的 V5 运行时脚本与对应本地源码
- [x] 追踪 `data-obj-arr.setValue/arrUpdate` 到状态写入和依赖通知链
- [x] 追踪 `ih5-tree-for` 的绑定订阅、挂载及重渲染条件
- [x] 比较同步、异步回调和额外让步三种执行时序
- [x] 判断转换规则是否应移除异步回调限制，并给出证据
- **Status:** complete

### Phase 46: Player 修复后移除变量刷新临时兼容（2026-07-28）
- [x] 核对两类变量刷新补偿的实现、测试和双仓库对应文件
- [x] 从 tov5parser 移除异步 tree-for `setValue` 补偿
- [x] 从 tov5parser 移除 V4 变量方法延时后的额外刷新补偿
- [x] 同步修改 VxEditor41 转换器
- [x] 运行双仓库定向测试、静态检查和影响面验证
- **Status:** complete

### Phase 47: 日期范围选择器缺少时间面板诊断（2026-07-28）
- [x] 在 V5 `JGTvx7MG` 精确复现量体师委派日期选择器
- [x] 在 V4 对照页复现并记录时间面板 DOM 差异
- [x] 从页面节点 class/React props 定位日期组件 ID
- [x] 对比 V4 原始 JSON 与最新 V5 转换结构
- [x] 判定是转换属性缺失、组件运行时差异还是业务动作影响
- **Status:** complete

### Phase 48: VxEditor41-widgets 版本化高度逻辑核对（2026-07-28）
- [x] 定位 `ih5-date-picker-tab` 源组件及继承的基础类
- [x] 追踪 `getStyle()` 对空高度的 V4/V5 分支
- [x] 核对 `vxConfig.ver` 的来源和 V5 判断条件
- [x] 解释默认 props、公共 CSS 与内联样式的优先关系
- [x] 判断最合理的运行时修复位置及同族组件影响面
- **Status:** complete

## Future Work（不属于当前任务）
- v3 → v5：调研 3.x 数据结构并新增 `v3ToV5/` 转换入口。
- GitHub 推送、Access Key 轮换及调用方对接；涉及外部状态变更时另行取得用户授权。

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 系统 Python 缺少 `pymysql`，无法直接执行第 4 例只读元数据查询 | 1 | 使用 `/tmp` 下的隔离依赖目录安装驱动，不修改项目依赖或系统 Python |
| 复用的 `/tmp/tov5parser-pymysql` 中模块残缺，导入后没有 `connect` | 1 | 不覆盖该目录；改用 `mktemp -d` 新建全新依赖目录后再查询 |
| `rg` 双引号模式中的反引号被 zsh 当作命令替换 | 1 | 不再在双引号 shell 参数中放反引号；改用单引号模式或分步检索 |
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
| Chrome 接管当前 V5 预览两次超时 | 2 | 停止重复扩展路径，改用预置 sessionStorage 的独立 Playwright 完成 V4/V5 DOM、交互和 React fiber 对比 |
| Phase 35 接管最新 V5 `192cX76o` 再次超时 | 1 | 不重复接管；按 Chrome 故障指南切换独立页面，以同一 sessionStorage 做只读复现 |
| Phase 44 真实产物审计脚本把 `walk` 误写为 `w` | 1 | 修正遍历回调后重跑；转换产物不受影响 |
| 初版集合白名单在 frp-pad 新增 223 个让步动作 | 1 | 根据真实影响面撤回 `data-for/ih5-grid-for`，只保留有运行证据的 `ih5-tree-for` |
| Web 工具拒绝直接打开 V5 预览 URL（safe URL 校验） | 1 | 不重复 Web 打开；改为只读下载 HTML 并解析实际 player/widgets 构建地址 |
| 项目 Node 环境无法 resolve `playwright` | 1 | 不安装项目依赖；使用 Codex workspace dependency bundle 提供的 Playwright |
| Workspace Playwright 未安装配套 Chromium headless shell | 1 | 不下载浏览器；改用本机 Google Chrome 可执行文件作为 Playwright `executablePath` |
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
| 旧 `/tmp/tov5parser-pymysql` 可导入但缺少 `connect` | 1 | 不复用损坏临时包；新建独立临时依赖目录后再执行只读查询 |
| 全仓 saveAs 检索命令混合单双引号导致 zsh `unmatched \"` | 1 | 改用简单单引号模式分两步检索，不复用复杂 shell 正则 |
| 查询用户分片时误假设 `users.db_name` 存在 | 1 | 改为按 `editor_tables` 最新记录读取 `db_name`，只读查询随后成功 |
| 误用不存在的 `check-complete.py` | 1 | 技能实际提供 `check-complete.sh`；改用该脚本，64/64 阶段检查通过 |
| VxServer 定向 Go 测试使用默认 `proxy.golang.org` 下载依赖长期无测试事件 | 2 | 终止本轮遗留的两个测试进程，后续单次改用可达代理并等待明确 PASS/FAIL |
| VxServer 测试编译缺少本地 replace 目录 `edtgo`、`extgo` | 1 | 不伪造依赖；先检查仓库说明、忽略项和本机是否已有对应目录，再决定可用验证层级 |
| zsh 展开不存在的 `README*` 导致依赖检索中止 | 1 | 改用 `rg --files` 获取真实文件名，并分别执行不含裸 glob 的检索 |
| Chrome 按横坐标扫描全部正文 `.text_inner` 导致读取超时并重置控制会话 | 1 | 不重复宽范围 DOM 扫描；先从本地 JSON 锁定正文节点 ID，再按精确 class 在页面读取 |
| Chrome 重新 claim 已打开的 V5 预览页连续超时 | 2 | 扩展轻量 openTabs 正常，页面接管卡住；停止重复 claim，尝试复用 browser session 中已有受控 tab，否则转为 JSON 与运行时代码静态定因 |
| Chrome 已受控 V5 页的定向开发日志读取仍超时 | 1 | 停止页面读取；用案例中的完整行高事件链与 V4/V5 布局生命周期实现交叉定因 |
| Browser runtime 返回对象没有 `documentation()` 方法 | 1 | 不重复调用该接口；当前页面已能用独立 Playwright + 本机 Chrome稳定复现，继续沿用该只读诊断路径 |
| 误猜 BasePicker 文件名为 `basePicker.jsx` | 1 | 目录实际入口是 `basePicker/index.jsx`，改读真实入口；未修改任何源码 |
| 首轮全仓 `rg` 命中生成的 `player.js/locale.js` 导致输出过大 | 1 | 后续改为精确源文件和排除生成文件的定向检索 |
| AppleScript 读取 Chrome 标签失败 | 2 | 首次语法错误，修正后被 macOS 权限拒绝；停止重试，改用浏览器只读标签列表取得当前预览 URL |
| 在压缩 JSON 上使用 `rg -n` 输出整行 | 1 | 输出约 18MB 并被截断；后续改用 JSON 解析后按字符串/ln 精确提取，不再对单行产物直接打印命中行 |
| 检索 reduce 实现时误用不存在的 `test/`、`vendor/` 路径 | 1 | 用 `rg --files` 重新确认真实目录，后续只检索 `v4ToV5/`、根 map 与明确测试文件 |
### Phase49：VxEditor41-widgets 日期类选择器尺寸模式修复

- [x] 在 `Ih5Base.adaptiveWHStyle` 中向 `processAdaptiveWH` 透传内部 `sizeMode`
- [x] 为日期/时间选择器公共基类设置内部默认值 `sizeMode: 'auto'`
- [x] 核对未修改属性面板映射，并完成 lint、构建与差异检查

**Status:** completed

### Phase 50：同步日期类选择器尺寸修复并提交推送（2026-07-28）

- [x] 核对 `VxEditor5-widgets` 对应基础组件、选择器继承链和工作区状态
- [x] 同步 `sizeMode` 透传及 Picker 内部默认值
- [x] 分别完成两个仓库的 ESLint、构建与差异检查
- [x] 分别只暂存本次修复文件并创建提交
- [x] 推送两个仓库当前分支并核对远程状态

**Status:** complete

### Phase 51：量体师委派中选择人员确认无效诊断（2026-07-29）

- [x] 在 V5 复现“量体师委派 → 量体师新增 → 勾选人员 → 确定”无效
- [x] 在 V4 执行同一路径并记录正常关闭、回填行为
- [x] 从 DOM/React fiber 定位选择人员弹窗、确定按钮及相关节点 ID
- [x] 对比 V4/V5 JSON 中确定事件的完整动作链和编译 AST
- [x] 识别首个阻塞、异常或语义分叉点，给出根因与责任范围

**Status:** complete

### Phase 52：修复 reduce 回调形参转换（2026-07-29）

- [x] 按系统方法映射的 `inParams` 生成 lambda 形参，移除固定 `item/index`
- [x] 增加 reduce 累加器及普通数组回调的回归测试
- [x] 运行定向测试与项目全量测试
- [x] 重新转换 frp-pad，并核验目标 BID 与同类 `arr_reduce`
- [x] 检查最终差异并记录修复结果

**Status:** complete

### Phase 53：重新下载并转换最新 frp-pad（2026-07-29）

- [x] 按 `raw` 文档确认案例导出接口、参数与凭据读取方式
- [x] 调接口下载最新 V4 JSON并覆盖本地源文件
- [x] 核对下载结果的案例标识、结构和版本变化
- [x] 用当前转换器生成紧凑 V5 JSON及诊断报告
- [x] 核验 reduce 修复、jsfn 可编译性与最终产物格式

**Status:** complete

### Phase 54：reduce 修复导致选择人员列表缺失回归（2026-07-29）

- [x] 复现最新 V5 中打开“量体师选择”后列表为空
- [x] 定位打开弹窗动作链及其中受 reduce 修改影响的公式
- [x] 对比修复前后 AST、编译代码与运行时回调约定
- [x] 实施最小修复并补回归测试
- [x] 重转 frp-pad，验证列表与确定动作对应 AST 同时正常

**Status:** complete

### Phase 55：新增量体师后责任量体师下拉无数据诊断（2026-07-29）

- [x] 在最新 V5 复现“量体师委派 → 新增量体师 → 责任量体师下拉为空”
- [x] 记录新增前后委派数据、责任量体师选项变量及组件绑定值
- [x] 从运行日志/DOM 定位相关节点 ID、动作组和首个数据分叉点
- [x] 对比 V4 同路径与 V4/V5 JSON 的公式、动作顺序及 AST
- [x] 给出根因、影响范围和建议修复位置，不修改转换代码

**Status:** complete

### Phase 56：修复 full-JS 嵌套块体回调被清空（2026-07-29）

- [x] 核对当前未提交修改，避免覆盖上一轮工作
- [x] 修复完整 JS 遍历中 `CallExpression/NewExpression` 参数子树的回调保护
- [x] 补充 `new Set(reduce(blockArrow))` 及 frp-pad 原公式回归测试
- [x] 运行公式转换单测与项目相关测试
- [x] 重新转换 frp-pad，核对责任量体师相关 BID 的回调 AST

**Status:** complete

### Phase 57：提交 tov5parser 并同步 VxEditor41（2026-07-29）

- [x] 核对 tov5parser 分支、远端和待提交范围
- [x] 提交并推送 tov5parser 当前累计修复
- [x] 核对 VxEditor41 仓库状态及转换器对应差异
- [x] 同步最近的回调作用域与 full-JS 块体回调修复
- [x] 运行 VxEditor41 相关验证
- [x] 提交并推送 VxEditor41 转换器修改

**Status:** complete

### Phase 58：部署最新 tov5parser 到生产 Lambda（2026-07-29）

- [x] 核对本地提交、部署脚本、目标函数和 AWS 身份
- [x] 重新生成 Lambda 运行包并验证压缩包内容
- [x] 执行生产 Lambda 更新
- [x] 等待函数更新完成并核对远端代码摘要/更新时间
- [x] 调用线上版本或只读接口验证最新代码生效

**Status:** complete

### Phase 59：按案例名称重抓并转换 11023063（2026-07-30）

- [x] 核对现有目录、案例元数据和下载接口文档
- [x] 确认案例真实名称及合法目录名
- [x] 将 V4/V5 目录统一迁移为案例名称
- [x] 重新下载最新 V4 案例 JSON 并核验
- [x] 用当前转换器生成同名目录下的压缩 V5 JSON
- [x] 核对产物结构、格式和目录残留

**Status:** complete

### Phase 59：重新获取并转换案例 11023063（2026-07-29）

- [x] 查询最新案例元数据、`work_id`、版本和 `ntype`
- [x] 调编辑器加载接口重新下载并解码完整 V4 JSON
- [x] 用当前转换器重新生成紧凑 V5 JSON与诊断报告
- [x] 审计 dropped、jsfn 语法/参数、旧版引用和服务目标
- [x] 更新错误分析文档并运行项目测试

**Status:** complete

### Phase 60：诊断 `/work/saveAs` 另存为 V5 报错（2026-07-29）

- [x] 脱敏提取附件中的请求参数、HTTP 状态和响应错误
- [x] 在 ivx_repos 全局定位 `/work/saveAs` 路由和实际处理项目
- [x] 追踪 `nid=11023063,newVer=2` 的服务端调用链与数据依赖
- [x] 结合案例元数据/数据库或安全复现定位首个失败点
- [x] 给出确定根因、责任项目和修复建议，不修改代码

**Status:** complete

### Phase 61：修复 VxServer 同 gid 组级表误复制（2026-07-29）

- [x] 核对 `getNeedCopyTables` 既有测试、scope 语义与 dirty worktree
- [x] 实施同 gid 的 `g` scope 表复用判断
- [x] 增加 old/new uid 不同但 gid 相同的回归测试
- [x] 运行定向测试、相关包测试和格式检查（Go 包测试受 checkout 缺少本地 replace 依赖阻塞，已记录）
- [x] 复核差异与风险，不提交，等待用户确认

**Status:** complete

### Phase 62：提交并推送 VxServer 修复（2026-07-29）

- [x] 核对 VxServer 分支、上游、差异和提交范围
- [x] 获取远端状态，确认可快进推送
- [x] 仅暂存实现与回归测试两个文件
- [x] 创建提交并复核提交内容
- [x] 推送 `stable` 并确认本地/远端一致

**Status:** complete

### Phase 63：将服装案例归入 clothing 分类目录（2026-07-30）

- [x] 核对 V4/V5 中 `frp-后台`、`frp-pad` 的现有文件
- [x] 创建 `clothing` 分类并迁移两个案例目录
- [x] 验证 V4/V5 目录结构一致且文件完整
- [x] 验证转换脚本可按新层级生成对应 V5 路径

**Status:** complete

### Phase 64：诊断 frp-后台 V5 导出数据明显减少（2026-07-30）

- [x] 对比 V4/V5 两份 XLSX 的工作表、维度、字段和缺失记录
- [x] 定位“新旧导出”相关节点、动作链、服务和导出数据源
- [x] 对比 V4/V5 JSON 转换结果，找到首个数据分叉点
- [x] 必要时复现两个预览页并核对网络请求及运行时数据
- [x] 给出确定根因、影响范围和修复建议，不修改代码

**Status:** complete

### Phase 65：修复数据库条件与后台单值回调转换（2026-07-30）

- [x] 恢复文件化计划并核对当前未提交修改
- [x] 为 `notEqual → neq` 与后台 `dbCount` 单值回调解包补充失败回归测试
- [x] 实施最小转换器修复
- [x] 运行定向测试与项目完整测试
- [x] 重新转换 `clothing/frp-后台` 并核对目标服务 AST/生成代码
- [x] 验证 V5 主文件保持紧凑单行格式并复核最终差异

**Status:** complete

### Phase 66：提交、部署 Lambda 并同步 VxEditor41（2026-07-30）

- [x] 恢复文件化计划并核对两个仓库的未提交内容
- [x] 提交并推送 tov5parser 的已跟踪修改
- [x] 从已提交版本打包并部署生产 Lambda
- [x] 验证 Lambda 新版本、prod 别名和冒烟调用
- [x] 将两项转换器修复同步到 VxEditor41
- [x] 运行 VxEditor41 定向校验并复核仅修改转换器文件
- [x] 提交并推送 VxEditor41
- [x] 记录两边提交与部署版本并完成最终复核

**Status:** complete

### Phase 67：clothing 全案例逐例 V4→V5 测试（2026-07-31）

- [x] 盘点 `04_原始项目JSON代码` 下全部 JSON，并从文件名提取 nid
- [ ] 按文件名排序逐例查询数据库版本；非 V4 案例记录结论后跳过
- [ ] 对当前 V4 案例拉取最新完整 JSON，保存到 `localCases/v4/clothing`
- [ ] 使用本项目转换器生成 V5 JSON和诊断结果，保存到 `localCases/v5/clothing`
- [ ] 校验转换产物并向用户汇报，等待审阅
- [ ] 用户确认继续后保留已测试案例，再处理下一例

**Status:** in progress

**执行约束：** 保留全部已测试案例的 V4/V5 数据与报告；每例汇报后必须暂停等待用户确认。

**当前检查点：** 第 5/51 例已完成；下一例为 `pda扫码_11328085_吴坤.json`，收到用户确认前不启动。

### Phase 68：修复 reason 文本 Formula 生成空 jsfn（2026-07-31）

- [x] 追踪异常 `jsfn` 的精确参数，纠正为 `reason: "db error"` 未加引号文本
- [x] 新增 `reason` 英文短语 Formula 回归测试，确认修复前精确失败
- [x] 实施最小修复，保留非文本 Formula 既有语义
- [x] 运行定向测试与项目全量测试
- [x] 重新转换 `aps后台_11437420_吴坤`，确认空 `jsfn` 清零并更新报告
- [x] 复核最终差异，等待用户确认是否创建 Git 提交

**Status:** complete

### Phase 69：提交、部署 Lambda 并同步 VxEditor41（2026-07-31）

- [x] 核对 tov5parser 提交范围、远程状态与敏感信息
- [x] 提交并推送 tov5parser 当前修复
- [x] 从已提交版本构建并部署生产 Lambda，验证新版本与 `prod` 别名
- [x] 核对 VxEditor41 工作区，隔离用户已有改动
- [x] 同步本次转换器修复并完成定向/构建验证
- [x] 仅提交并推送 VxEditor41 本次转换器修改
- [x] 复核两个远程分支、Lambda 状态，并记录结果

**Status:** complete

### Phase 70：修复 ConditionalExpression receiver 括号丢失（2026-08-03）

- [x] 为三元表达式后调用 `.toString()` / `.every()` 增加失败回归测试
- [x] 在 `ExprAstToString` 实施最小括号保留修复
- [x] 运行定向测试与项目全量测试
- [x] 重新转换 `frp后台2_11260689_熊` 并复核 5 个目标落点
- [x] 重跑全部 `jsfn`、结构、引用和服务目标审计
- [x] 更新案例报告与规划记录，等待用户确认是否创建 Git 提交

**Status:** complete

### Phase 71：提交、部署并同步 VxEditor41（2026-08-03）

- [x] 复核 tov5parser 提交范围、远程分支和测试状态
- [x] 提交并推送 tov5parser 当前修复
- [x] 从提交版本构建并部署生产 Lambda，验证新版本与 `prod` 别名
- [x] 在 VxEditor41 中同步等价转换器修复并隔离用户已有改动
- [x] 运行 VxEditor41 静态检查与生产构建
- [x] 仅提交并推送 VxEditor41 本次转换器修改
- [x] 复核两个远程分支、Lambda 状态并记录结果

**Status:** complete
