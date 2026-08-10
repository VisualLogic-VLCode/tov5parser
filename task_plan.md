# Task Plan: tov5parser — 旧版本案例 JSON → 5.x 转换服务

## Goal
将 VisualLogic 旧版本（4.x，规划中含 3.x）案例 JSON 转换为 5.x 案例 JSON，
以自包含独立项目 + AWS Lambda 服务的形态供平台程序通过 HTTP 调用。

## Current Phase
Phase 128（修复第 44 例异步 continuation 回调上下文并自动发布）— in progress

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
- 2026-08-05 第 14 例 Cookie 刷新后重试：用户确认 Cookie 已更新，但下载器从 `SecretRoot.local.env` 的 `PLATFORM_COOKIE_CN*` 读取后仍返回 HTTP 203，说明更新发生在另一缓存文件或该变量尚未同步。后续不重复读取这两个旧值，先只读定位最近更新的 Cookie 文件路径/时间，再改用该来源。
- 2026-08-05 第 14 例记录补丁：首次同时更新当前检查点、错误表和进度时，补丁块在文件中的顺序由后向前，导致整体校验失败且没有部分写入；已按实际文件顺序重排，不重复原补丁。
- 2026-08-05 第 14 例 Chrome 第二次认领：按故障说明重新连接、重新枚举并仅执行标签认领，仍在 30 秒内超时并重置；证明并非 DOM 快照导致。停止重复浏览器接管，等待用户刷新 Cookie 或重新建立可接管的中文服登录页。
- 2026-08-05 第 14 例 Chrome 会话：Chrome 扩展可列出标签并找到已登录 `dev.ivx.cn` 编辑器页，但首次把“认领标签 + DOM 快照”合并调用时超时并重置；未导航或下载。后续先读取 Chrome 故障说明，再把认领和状态读取拆开，避免再次请求完整 DOM。
- 2026-08-05 第 14 例应用内浏览器第二次尝试：改用轻量同源 `robots.txt` 并拆掉 DOM 等待后仍在导航阶段超时、会话再次重置。按不重复失败原则停止应用内浏览器路径，改选 Chrome 扩展会话；若不可用则请求用户更新登录态。
- 2026-08-05 第 14 例浏览器登录态检查：首次在新标签页导航编辑器并等待 DOM 时超过 30 秒，浏览器执行会话重置；未下载或写入文件。已读取浏览器故障说明，后续保持同一浏览器绑定、缩短单次动作并优先使用直接 URL/最小状态读取，不重复长等待组合。
- 2026-08-05 第 14 例 `/work/load` 下载：本地 `PLATFORM_COOKIE_CN*` 候选去重后只有一个有效格式值，但接口返回 HTTP 203，说明缓存登录态已过期；下载器在创建目标目录/文件前停止。后续不重复该 Cookie，改用当前 Chrome 已登录会话或其他已授权只读登录态。
- 2026-08-05 第 14 例 Cookie 定位：为查看 `SecretRoot.local.env` 的键名使用了只替换赋值行的脱敏命令，但文件注释区仍含人工登录凭据，工具输出暴露了注释中的密码文本；未修改文件，也不在后续记录中复述具体值。后续只用 Python 解析所需机器变量，禁止再次输出该文件正文。
- 2026-08-05 第 14 例下载准备：对单行压缩的 `VxEditor41/src/components/stageProxy.js` 做关键词检索导致输出膨胀并被截断；未修改文件。后续不重复读取该构建产物，改用此前已验证流程或非压缩源码。
- 2026-08-04 Phase 81 首次实现补丁：一个跨 5 文件的大补丁因 `con.js` export 顺序与预期上下文不同而整体校验失败，没有发生部分写入；后续拆为新文件、公共入口、各调用方与测试的独立补丁，不重复大补丁。
- 2026-08-04 Phase 81 补丁失败核查：确认新文件是否存在时又在只读命令中使用了 `&&/||`，虽未修改文件但不符合终端输出约束；后续使用单一命令或并行独立调用，不再串接。
- 2026-08-04 读取 `formulaStr` 定义：一次只读命令用 `&&` 串接定位与范围读取，不符合当前终端输出约束，且范围未覆盖到函数正文；未修改文件。后续拆成单一明确读取命令，不重复串接。
- 2026-08-04 查找 V4 事件代码生成器：首次对整个 `ivx_repos` 执行源码检索时误包含 `editorExtra` 的压缩 player 资产，输出膨胀到约 3.4M tokens 并被截断；没有修改文件。后续限定到 `VxEditor4` 源码并显式排除构建/依赖目录，不重复宽范围检索。
- 2026-08-04 `_code` 覆盖率只读统计：首版临时脚本为了识别字符串表达式使用了 `Function(...)` 求值，虽然输入仅来自本地案例且本轮未发现外部副作用，但这种统计不应执行案例代码；覆盖率结论只采用无需求值的字段计数，后续语法分类必须使用 Acorn/JSEP AST 静态解析，不重复动态求值。
- 2026-08-04 参数契约说明补记：首次向 `progress.md` 追加时误用了 `findings.md` 的上下文行，`apply_patch` 校验失败且没有部分写入；读取实际文件尾部后使用正确锚点完成，不重复原补丁。
- 2026-08-04 Phase 78：首次用裸 `index.js` 在内存重放真实案例探测 `_code` 时未加载 ivx runtime map，`MapCreator.genSysutilMap()` 内出现多条 TypeError，探测在输出目标前终止；这不是 `_code` 结论。后续改用项目本地转换脚本所采用的 map 初始化入口或定向测试环境，不重复裸调用。
- 2026-08-04 第 11 例审计：一次 `rg` 同时给了不存在的 `tests` 路径，产生 `rg: tests: No such file or directory`；实际测试文件在 `v4ToV5/v4ToV5.test.js`，后续已改用真实路径，未重复失败命令。
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

**执行约束：** 保留全部已测试案例的 V4/V5 数据与报告；每例汇报后必须暂停等待用户确认。后续数据库查询必须同时读取 `extra.ver`、两表 `edt_ver`、`verDetail` 与 `ntype`：`extra.ver == 2` 优先判 V5，`ntype ∈ {91,92}` 只在此前提下细分 V5.1；`edt_ver`/`verDetail` 仅作辅助。下载后必须扫描完整 JSON：任一事件条目存在 op-AST `ast` 即判 V5；只有 V4 结构信号且无事件 AST 才进入转换器；无信号或矛盾时留档人工判断。

**当前检查点：** 第 44/51 例 `花名册_11280925_温晓华.json`（nid `11280925`）已完成数据库查询、最新 work 下载、V4.1 实物判定、V5 转换、诊断、全案审计和报告。转换文件已生成，但确认 BID `d34d0zba3j500005z6kg` 存在 1 处通用异步 continuation 上下文传播错误：有效的 `cbParams.data` 被转成无参数自由 jsfn；其余结构审计通过，项目 93/93 测试通过。当前等待用户审阅并决定是否授权修复；历史案例继续保留，第 45 例 `装箱策略预设_11370978_温晓华.json` 未启动。

**架构讨论记录：** VxEditor41 的 V4.1 事件生成链路已确认直接读取完整 `value.code`，经上下文替换后调用通用 `formulaStr(code)`，第 13 例事件因此把 session 明确编译为双引号字符串。统一 resolver 应复用该同源 formulaStr 作为 V4 语义分类层，再交给现有结构化公式转换；`str` token、作用域符号、契约/默认值和事件最终 `code/_code` 用于消歧及回证。事件代码覆盖约 97.8%，但 292 个无代码事件仍含 800 个动作块，且整段代码无 BID、难以稳定回映嵌套/重复动作，因此不能作为唯一主输入。该方案已在 Phase 81 完成并发布。第 14 例进一步证明：当 `code` 中的 `fParam<旧ID>` 已失效时，事件最终代码也会继承该失效标识符；但 Formula token 的 `funcGroupParam` 类型、参数名与当前函数组 `inParams` 三方仍可提供安全恢复证据。

### Phase 78：修复 clothing 第 11 例三类转换器错误并自动发布（2026-08-04）

- [x] 为有效 `_code` 回退、中文 toast 文本识别、`$SF_sys_multiObjListToObjArr` 转换分别补失败回归
- [x] 实施通用最小修复，避免掩盖真正无效公式或误判真实公式为文本
- [x] 运行定向/完整测试并重转第 11 例，复核 20 个问题位置及全量结构审计
- [x] 更新案例报告，精确暂存并提交、推送 tov5parser
- [x] 部署生产 Lambda，验证新版本、`prod` 别名与冒烟调用
- [x] 同步 VxEditor41 转换器，在隔离用户既有修改的前提下验证、提交并推送
- [x] 记录双仓库提交和 Lambda 版本，回到 Phase 67 第 11 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确要求“修复”；根据 Phase 76 与 `AGENT.md`/`CLAUDE.md` 的持续授权，修复验证通过后自动完成双仓库提交推送和生产 Lambda 部署。只处理报告中的 3 类转换器错误；V4 源悬空服务不由转换器伪造定义。第 12 例仍不启动。

**测试与错误记录：** 修复前定向回归 0/3 通过；最终定向回归与全量 65/65 通过。首版真实重转因候选预检漏做 `$P_*:` 预处理而仍有 7 条 dropped，升级真实结构回归后清零。第二次重转包装命令曾误用 zsh 只读变量 `status`，但转换实际成功；后续通过日志和产物时间戳确认。首轮综合审计的全局字符串计数过宽，已改为按目标 BID/AST/jsfn 作用域断言并通过。

**发布结果：** tov5parser 修复提交 `24b0068603f2d639202178f7914771d2250271d9`；生产 Lambda 版本 `14`、CodeSha256 `ZtgR/TAMXsNgMlHb2iG0i2lqzP2QQewPsPZL7ObPCOo=`；VxEditor41 同步提交 `9c6cacce1`。最终规划记录另行精确提交到 tov5parser。

**本例错误记录：** ECS task definition 取密首次调用返回 AWS CLI exit 255（当前用户缺 `aws-cn-ivx` profile）；本机也无 `mysql` CLI。改为从既有线程记录恢复只读交接路径，并使用隔离临时 PyMySQL，不重复失败路径。

### Phase 79：修复 clothing 第 12 例首条 OR 条件崩溃并自动发布（2026-08-04）

- [x] 为“首条启用条件 `flag:'or'`”补转换失败回归，覆盖真实 2 条/5 条 OR 形态
- [x] 实施最小 OR 分组修复；同时修复重转审计暴露的纯文本嵌套 URL、full-js `$SF_getSelf` 残留与上传中回调漏挂载
- [x] 运行定向与完整测试，重转第 12 例并完成全量结构/公式/服务审计
- [x] 更新案例报告，精确提交并推送 tov5parser
- [x] 部署生产 Lambda，验证新版本、`prod` 别名和冒烟调用
- [x] 同步 VxEditor41 对应转换器，定向验证/构建后精确提交并推送
- [x] 记录双仓库提交与 Lambda 版本，回到第 12 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“修复”；根据 `AGENT.md`/`CLAUDE.md` 的持续授权，验证通过后自动完成双仓库提交推送与生产 Lambda 部署。修复条件组首 OR 标志，并处理重转审计确认的纯文本嵌套 URL 丢失、full-js `$SF_getSelf` 残留和上传中回调漏挂载；不改变完整条件的操作符/值语义，不对 V4 code/_code 冲突或裸 `a/c` 猜测业务意图，不补造源悬空服务，不启动第 13 例。

**补充错误记录：** 补查 link 时首次误选无依赖的旧 `/tmp/clothing-pymysql.*`；改为按 `pymysql/__init__.py` 实际文件定位模块根目录。

**审计命令错误：** 搜索 V5 新增服务名时 `rg` 无匹配使后续 `&& node` 未运行；后续拆分检索与结构检查并容忍无匹配。

**报告补丁错误：** 首次新增报告时混入一个错误的进度文件上下文，`apply_patch` 整体拒绝且未部分写入；已拆分为独立补丁完成。

**第 13 例恢复检索错误：** 为定位数据库流程时对项目根执行的 Markdown 关键词检索范围过宽，意外输出了无关未跟踪 `VxServer-saveAs-same-gid-group-db-fix.md` 的匹配行；未修改或暂存该文件。后续所有检索显式排除该路径，不使用其中内容。

**修复验证：** 四项转换器问题均有最小回归；最后两项回归修复前 0/2、修复后 2/2，完整项目测试 69/69。真实重转后 766 个 jsfn 全部可编译且 `$SF_*` 残留为 0，10/10 uploading 状态完整挂入 lambda，两个目标 OR AST、嵌套绝对 URL、节点/data-if/service/当前路径审计均通过。唯一 dropped 是 V4 editor `code` 与 `_code` 对 sort 语义冲突；裸 `a/c` 与 3 个悬空服务也均为源数据问题，不做猜测修复。

**发布结果：** tov5parser `e8c1a4fe1548da07e8ae56e58696e3c8bbec7d0f`；生产 Lambda 版本 `15`、CodeSha256 `P2lgZlx6NBrkmxKF6NyXL2SzCUn2wLpf+iKNo9iW1Ac=`，`prod` 冒烟通过；VxEditor41 `25b0bc5c844da036d2ec99336e39946bc2bb3eec`。回到 Phase 67 第 12 例人工审阅门禁，不启动第 13 例。

### Phase 80：修复 clothing 第 13 例 session 十六进制文本并自动发布（2026-08-04）

- [x] 为纯文本 token 明确标记的 32 位十六进制 `session` 参数补失败回归，同时覆盖真实公式不被字符串化
- [x] 实施最小文本识别修复并运行定向/完整测试
- [x] 重新转换第 13 例，复核目标参数、诊断、结构、事件、公式和服务引用
- [x] 更新案例报告，精确提交并推送 tov5parser
- [x] 部署生产 Lambda，验证新版本、`prod` 别名和冒烟调用
- [x] 同步 VxEditor41 对应转换器，隔离用户既有修改后验证、提交并推送
- [x] 记录双仓库提交和 Lambda 版本，回到第 13 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“修复”；`AGENT.md`/`CLAUDE.md` 的持续授权要求验证通过后自动完成双仓库提交推送与生产 Lambda 部署。仅处理本例 `session` 十六进制纯文本漏判，不补造 V4 源悬空服务，不启动第 14 例。

**回归基线：** 新增定向回归在修复前 0/1，通过失败值 `undefined !== 6a939b74c7b83df984bb4ae9be230a18` 精确复现问题；不重复该失败路径。

**部署错误记录：** 首次 `npm run deploy:lambda:prod` 在上传前因 dirty tree 主动退出；dirty 内容仅为提交后规划记录及既有无关未跟踪文档。后续不重复同一失败调用，改用经过核验的安全部署路径。

**部署恢复方案：** 打包清单显式排除规划文件和无关文档，且运行时代码与提交 `3e7f0e2` 一致；使用 `--allow-dirty --run-tests --smoke`，版本描述明确绑定该提交。

**发布结果：** tov5parser 修复提交 `3e7f0e2ce32a184968034d2eb6c6fe23b36a0b19`；生产 Lambda 版本 `16`、CodeSha256 `qLu1kM+jdcZs+JILCXRWXknYlBLMlatWZrnO7JvJV4o=`，`prod` 冒烟和最终状态复核通过；VxEditor41 同步提交 `70bc972c19fc87ea1ad5e7f875cff27d60157428`。双仓均已推送且无分叉，返回 Phase 67 第 13 例人工审阅门禁。

### Phase 81：统一 V4.1 Formula code 语义分类并自动发布（2026-08-04）

- [x] 建立 V4.1 `formulaStr(code)` 同源分类回归，覆盖 session、中文/英文文本、URL、百分比、数字、布尔/null、refs/调用/运算及损坏公式
- [x] 实施统一旧 Formula code 分类层，替代可由同源规则覆盖的参数名/内容枚举，同时保留确属参数 API 语义的独立适配
- [x] 运行定向与完整测试，重转第 13 例并对已保存 clothing 案例做影响面审计
- [x] 更新第 13 例报告，精确提交并推送 tov5parser
- [x] 部署生产 Lambda，验证新版本、`prod` 别名与冒烟调用
- [x] 同步 VxEditor41 对应转换器，隔离用户既有修改后验证、提交并推送
- [x] 记录双仓提交和 Lambda 版本，返回第 13 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确要求按已确认方案完善转换器。根据 `AGENT.md`/`CLAUDE.md` 固定流程，验证通过后自动完成双仓提交推送与生产 Lambda 部署。仅重构/修复旧 Formula 语义分类，不启动第 14 例，不触碰用户无关未跟踪文档。

**发布结果：** tov5parser 修复提交 `4177d62` 已推送至 `origin/main`；生产 Lambda 版本 `17`、CodeSha256 `T10gu75G09cOVU7tieos62Yc3XAYhE0GTJns2O4Tdik=`，`prod` 冒烟返回业务码 0；VxEditor41 同步提交 `1c5b35ebd` 已推送至 `origin/master`，生产构建 0 error（33 个既有 warning）。当前返回 Phase 67 第 13 例人工审阅门禁，第 14 例未启动。

### Phase 82：修复 clothing 第 14 例旧函数组参数恢复并自动发布（2026-08-05）

- [x] 为不存在的旧 `fParam<id>`、但 token 与当前函数组入参一致的公式补失败回归
- [x] 实施三重证据约束的最小恢复规则，保留无证据未知变量的既有 fallback
- [x] 运行定向/完整测试并重转第 14 例，确认 4 个自由变量清零
- [x] 重跑组件、事件、公式、data-if、服务和上传静态审计并更新案例报告
- [x] 精确提交并推送 tov5parser，部署生产 Lambda 并完成冒烟验证
- [x] 同步 VxEditor41 转换器，隔离用户既有修改后验证、提交并推送
- [x] 记录双仓提交和 Lambda 版本，返回第 14 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户已明确回复“修复”。根据 `AGENT.md`/`CLAUDE.md` 持续授权，验证通过后自动完成双仓提交推送和生产 Lambda 部署。只修复本例旧函数组参数的安全恢复，不把任意未知 `fParam` 猜成当前参数，不启动第 15 例。

**发布结果：** tov5parser 修复提交 `4aa0a26a9e4071fb35e56d34f770c7cd10dd1e40` 已推送 `origin/main`；生产 Lambda 版本 `18`、CodeSha256 `En3ggJjZJ/58UDKAka/yHawbWEEiswS6K/ZERfDB4jU=`，`prod` 冒烟通过且最终状态 Active/Successful；VxEditor41 同步提交 `e32b73c71f5a8c936fb7773a5e46bcb1cafc7081` 已推送 `origin/master`，定向 ESLint 0 warning、生产构建成功。两个仓库的用户无关改动均未混入提交。

### Phase 76：修复中文文本 Formula 并自动发布、同步（2026-08-04）

- [x] 将“转换器修复后自动提交、推送、部署 Lambda，并同步 VxEditor41 后提交推送”写入当前项目 `AGENT.md` 与 `CLAUDE.md`
- [x] 为 V4 `str` tokens 明确表示纯文本、但 code 可被当作合法标识符的动作参数补失败回归
- [x] 实施最小通用修复，避免把真实公式误判为文本
- [x] 运行定向与完整测试，重转并审计第 8 例，更新转换报告
- [x] 核对 tov5parser 远端状态、提交并推送本轮修复与规则
- [x] 部署生产 Lambda，验证新版本与 `prod` 别名
- [x] 同步 VxEditor41 转换器，验证后提交并推送
- [x] 记录提交、部署版本与最终验证，回到 Phase 67 人工审阅门禁

**Status:** complete

**用户持续授权：** 此后每次修复转换器，无需再次询问 Git 提交；完成修复和验证后自动执行 tov5parser 提交/推送、Lambda 部署、VxEditor41 同步/提交/推送。

### Phase 77：修复 clothing 第 9 例转换器错误并自动发布（2026-08-04）

- [x] 为启用 setProps 中的 CSS 百分比文本补充失败回归并修复
- [x] 为启用 pushMulVal 中的逗号表达式补充失败回归并修复
- [x] 将 `$curJsonPathValue`/`$curPathValue` 转为目标变量真实当前路径 AST
- [x] 定性其余裸函数与不可达自由变量，排除源案例问题
- [x] 运行定向/完整测试并重转第 9 例，完成结构与运行风险审计
- [x] 更新案例报告并提交、推送 tov5parser
- [x] 部署生产 Lambda 并验证 `prod`
- [x] 同步 VxEditor41 转换器，验证、提交并推送
- [x] 回到 Phase 67 第 9 例人工审阅门禁，不启动第 10 例

**Status:** complete

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

### Phase 72：清理 data-if 冗余 `binds.value`（2026-08-03）

- [x] 复核 V5 正式条件、widgets 运行 prop、旧 stageProxy 与保存 JSON 的消费边界
- [x] 判断转换器应删除旧 value bind，还是生成空 `_code/code` 兼容壳（结论：删除，不生成空壳）
- [x] 新增 data-if 精确回归测试并确认修复前失败
- [x] 实施最小转换器修复
- [x] 运行定向测试与项目完整测试
- [x] 重新转换第 6 例并复核全部 data-if、Tree→VLang 与诊断结果
- [x] 更新案例报告和规划记录，等待用户确认是否提交

**Status:** complete

### Phase 73：提交、部署并同步 VxEditor41（2026-08-03）

- [x] 复核 tov5parser 提交范围、远程分支与完整测试
- [x] 仅提交本轮转换器、测试和规划记录并推送 `main`
- [x] 从已提交版本构建并部署生产 Lambda，验证新版本与 `prod` 别名
- [x] 在 VxEditor41 中同步等价 data-if 清理逻辑，隔离用户已有修改
- [x] 运行 VxEditor41 定向验证与可行的生产构建
- [x] 仅提交并推送 VxEditor41 本轮转换器修改
- [x] 复核两个远程分支、Lambda 状态并记录结果

**Status:** complete

### Phase 74：修复嵌套回调 `jsfn` 参数丢失（2026-08-03）

- [x] 用第 7 例 5 组源公式建立最小复现，确认参数在哪一层丢失
- [x] 新增失败回归测试，覆盖表达式回调与块体回调中的嵌套 custom expression
- [x] 实施通用最小修复，避免只针对具体公式
- [x] 运行定向测试和项目完整测试
- [x] 重新转换第 7 例，确认 9 个缺参 `jsfn` 清零
- [x] 重跑结构、事件、data-if、服务与旧式引用审计
- [x] 更新案例报告和规划记录，等待用户确认是否提交

**Status:** complete

### Phase 75：提交、部署并同步 VxEditor41（2026-08-04）

- [x] 复核 tov5parser 提交范围、远程分支与完整测试
- [x] 仅提交本轮转换器、测试和规划记录并推送 `main`
- [x] 从已提交版本构建并部署生产 Lambda，验证新版本与 `prod` 别名
- [x] 在 VxEditor41 中同步等价公式转换器修复，隔离用户已有修改
- [x] 运行 VxEditor41 定向验证与生产构建
- [x] 仅提交并推送 VxEditor41 本轮转换器修改
- [x] 复核两个远程分支、Lambda 状态并记录结果

**Status:** complete

### Phase 83：修复 clothing 第 15 例当前行值与嵌套回调作用域并自动发布（2026-08-05）

- [x] 为 `$curRowValue` 在 `setRowColsValue.colValue` 的动作上下文语义建立失败回归
- [x] 为 custom-expression fallback 中嵌套 `every(key => ... item[key])` 建立失败回归
- [x] 实施通用最小修复，避免针对具体 BID、字段名或参数名枚举
- [x] 运行定向测试和项目完整测试
- [x] 真实重转第 15 例，确认 10 个无参错误 jsfn 清零并重跑完整静态审计
- [x] 更新案例报告、规划记录
- [x] 精确提交推送 tov5parser
- [x] 从已提交版本部署生产 Lambda，验证新版本、`prod` 别名和冒烟
- [x] 等价同步 VxEditor41 转换器，定向检查/生产构建后精确提交推送
- [x] 复核双仓远端与 Lambda 状态，返回第 15 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确要求“修复”；`AGENT.md`/`CLAUDE.md` 固定发布流程生效，验证通过后无需再次询问提交或部署。仅处理报告确认的两类转换器错误；源案例已有的 3 个悬空服务调用不由转换器伪造服务定义。第 16 例不启动。

### Phase 84：clothing 第 16 例逐例转换与审计（2026-08-05）

- [x] 参数化只读查询 nid `11769634` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；保留此前全部案例数据，只处理第 16 例。若数据库版本不是 V4，则记录并跳过转换；若发现转换器错误，只汇报并等待用户是否修复，不自动启动第 17 例。

### Phase 85：clothing 第 17 例逐例转换与审计（2026-08-05）

- [x] 参数化只读查询 nid `12105173` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；保留此前全部案例数据，只处理第 17 例。若数据库版本不是 V4，则记录并跳过转换；若发现转换器错误，只汇报并等待用户是否修复，不自动启动第 18 例。

**错误记录：** 第 17 例首次参数化查询连接成功，但 SQL 使用不存在的 `users.user_name`，返回 MySQL 1054；未修改数据。下一次先以 `SHOW COLUMNS FROM users` 校正，不重复失败 SQL。记录错误的首个补丁也因一个空格的上下文差异被整体拒绝，已用精确上下文重试成功。

### Phase 86：clothing 第 18 例逐例转换与审计（2026-08-05）

- [x] 参数化只读查询 nid `11261416` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；保留此前全部案例数据，只处理第 18 例。若数据库版本不是 V4，则记录并跳过转换；若发现转换器错误，只汇报并等待用户是否修复，不自动启动第 19 例。

**错误记录：** 本例首次服务 `_code` 审计错读 `props._code`，误报 0 bytes；已按 `events.list[0]._code` 校正并通过。首次跨仓运行时搜索的组合正则被 zsh 解析成 bad pattern，未修改数据；后续拆成固定字符串搜索。

**最终结论：** 结构、事件、data-if、服务定义/调用和上传审计未发现丢失，项目测试 72/72 通过；但确认 4 个服务动作中的 `$serverSys.f__sysTime(...)` 被保留在 `jsfn` 中。V5 `new Function` 只注入 `$vN`，该自由标识符运行时报错并被 catch 吞掉，使 `{updator, updateTime}` 整体成为 `undefined`。已生成报告并停在人工审阅门禁，未修改转换器、未启动第 19 例。

### Phase 87：修复第 18 例 `$serverSys` 运行时对象并自动发布（2026-08-05）

- [x] 定位公式解析/自定义表达式回退中服务系统对象未规范化的最小根因
- [x] 新增失败回归测试并实施通用 `$serverSys → $sobj_serverSys` 转换
- [x] 运行定向测试和项目完整测试
- [x] 重转第 18 例，确认 4 个错误 jsfn 清零并重跑完整静态审计
- [x] 更新案例报告与规划记录
- [x] 精确提交并推送 tov5parser 当前修复
- [x] 从已提交版本部署生产 Lambda，验证新版本、`prod` 别名和冒烟
- [x] 等价同步 VxEditor41 转换器并完成定向检查/生产构建
- [x] 精确提交并推送 VxEditor41 当前同步
- [x] 复核双仓远端和 Lambda 最终状态，返回第 18 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“修复”。`AGENT.md`/`CLAUDE.md` 固定发布流程生效：修复验证后无需再次询问，自动完成 tov5parser 提交推送、生产 Lambda 部署和 VxEditor41 同步提交推送。只处理本例确认的统一公式对象规范化缺陷，不启动第 19 例；不得读取、修改或提交无关未跟踪文档。

**错误记录：** 新增回归首次运行按预期失败，实际 jsfn 仍含 `$serverSys.f__sysTime(...)`，证明用例命中真实缺陷。用例中原先用 `fParamgroup.obj.$serverSys` 检查静态成员名，但该完整 V4 引用会被正确参数化成单个 `$vN`，无法观察属性名；测试需改用未知 receiver 的静态成员，仅校验规范化器边界，不重复错误断言。

**发布结果：** tov5parser 修复提交 `6b49b0c221654cc0dadcc427708ca6182ac1773d` 已推送；生产 Lambda 版本 `20`、CodeSha256 `S5quTBb6SJjGhoX9D5eiV9tDBHNeCvmtfxYB05RU5VY=`，`prod` 冒烟和最终状态复核通过；VxEditor41 同步提交 `ca0caa89200dc59843ed17af0a8c03c61553ad70` 已推送。两个仓库均无远端分叉，用户已有无关改动未混入提交；第 19 例未启动。

### Phase 88：复核第 18 例服务系统对象的正确 V5 AST（2026-08-05）

- [x] 复现当前 `$sobj_serverSys` jsfn 在真实 V5 代码生成作用域中的可见性
- [x] 从 VxEditor41/V5 AST 代码生成链路找到服务系统对象的正式 AST 表达
- [x] 对比当前案例 4 个落点与正确 AST/最终 `_code`
- [x] 形成纠正结论并向用户解释此前判断依据与错误点

**Status:** complete

**授权与范围：** 用户当前要求解释并核对 AST，属于诊断请求；不修改已发布代码、不创建提交、不部署。若确认 Phase 87 修复错误，明确记录并等待用户另行授权修复。

**结论：** Phase 87 判断错误。`$sobj_serverSys` 是 V4 外层生成代码中的规范变量名，却不是 V5 `jsfn/new Function` 可捕获的变量；当前四个 AST 运行时均抛 `ReferenceError`。V5 正式表达应使用 `get(ref ['sobj','serverSys'], method '_sysTime')`，并让对象字面量保持结构化 `dict`；该 AST 会生成 `$sys.func('server-sys-serverSys',$self,'','_sysTime',"ymdhms")`。本阶段仅完成诊断，尚未修复已发布转换器。

### Phase 89：正确修复第 18 例后台系统时间 AST 并自动发布（2026-08-05）

- [x] 新增失败回归，证明当前转换仍生成带自由变量的 jsfn
- [x] 实施 V4 `$serverSys`/`f__sysTime` 到 V5 `sobj/serverSys`/`_sysTime` 的结构化转换
- [x] 运行定向测试和项目完整测试
- [x] 重转第 18 例并核验四个 BID、最终服务代码和完整结构基线
- [x] 更新第 18 例报告及规划记录，纠正 Phase 87 的错误结论
- [x] 精确提交并推送 tov5parser 本轮修复
- [x] 从已提交版本部署生产 Lambda并验证 `prod` 冒烟与最终状态
- [x] 等价同步 VxEditor41，完成定向检查和可行生产构建
- [x] 精确提交并推送 VxEditor41 本轮同步
- [x] 最终复核双仓远端、Lambda版本及用户无关工作区内容

**Status:** complete

**授权与范围：** 用户明确回复“修复”。项目 `AGENT.md`/`CLAUDE.md` 固定发布流程生效：修复与真实案例验证通过后自动完成双仓提交推送、生产 Lambda 部署和 VxEditor41 同步。不得启动第 19 例，不得读取、修改或提交无关未跟踪文档。

**错误记录：** 新增结构化后台时间回归首次运行按预期 25 pass / 1 fail；实际仍找到 `jsfn`，内容为 `{updator: $v1, updateTime: $sobj_serverSys.f__sysTime("ymdhms")}`，准确复现当前错误。测试输出中的其他 ParseError 是既有 fallback 可观测日志，不是新增失败。

**实现校准：** 首次加入结构化实现后，新回归已经通过，但 Phase 87 的旧测试仍断言自由 `$sobj_serverSys.f__sysTime` 应保留，导致定向测试仍为 25 pass / 1 fail。实际新输出已将该调用替换为显式 `$v2`；这是旧错误断言，需改为验证 `$v2` 对应的 args 是正式 sobj AST，同时继续检查字符串、静态对象键和静态成员名不被误改。

**发布结果：** tov5parser `6b0ce5dee02e5977a2214704e776e5965344ef1c` 已推送；生产 Lambda 版本 `21`、CodeSha256 `jx2d/R7C8RHqzxZXda0Av6xJcRles4OLijjrCFooWiY=`，`prod` 冒烟和最终状态复核通过；VxEditor41 `06c726746682a0b70a3e34b9a469c41ddda8a179` 已推送。四个目标 BID 均生成结构化 sobj `_sysTime` AST，相关 jsfn/new Function/free serverSys 均清零；第 19 例未启动。

### Phase 90：补全后台公式 AST 的实际类型 `cType` 并自动发布（2026-08-05）

- [x] 对照 VxEditor41 `TypeChecker` 建立后台 AST 实际类型推导规则和边界
- [x] 新增失败回归，覆盖后台动作参数及嵌套 `_sysTime` 字符串实参
- [x] 实施通用最小修复，未知类型不写 `cType`，不得简单复制目标 `type`
- [x] 运行定向测试和项目完整测试
- [x] 重转第 18 例并审计目标 AST、服务代码及完整结构基线
- [x] 更新第 18 例报告与规划记录
- [x] 精确提交并推送 tov5parser 本轮修复
- [x] 从已提交版本部署生产 Lambda 并验证 `prod` 冒烟与最终状态
- [x] 等价同步 VxEditor41，完成定向检查和可行生产构建
- [x] 精确提交并推送 VxEditor41 本轮同步
- [x] 最终复核双仓远端、Lambda 版本及用户无关工作区内容

**Status:** complete

**授权与范围：** 用户明确回复“修复”。项目 `AGENT.md`/`CLAUDE.md` 固定发布流程生效：修复和真实案例验证通过后自动完成双仓提交推送、生产 Lambda 部署和 VxEditor41 同步。只处理后台公式 AST 实际类型保真，不启动第 19 例；不得读取、修改或提交无关未跟踪文档。

**错误记录：** 新增动作级回归首次运行按预期 0 pass / 1 fail；字符串公式实际为 `{op:'val',val:'hello',type:'String'}`，缺少期望的 `cType:'String'`，证明用例命中通用后台动作参数入口，而非只检查 `_sysTime` 样本。实现后首次复跑进入 `_sysTime` 子断言时，测试夹具未加载运行时公式 map，导致 `genSysutilMap()` 为空；已在用例入口复用既有 `ensureIvxMapNodeEnv()`，不改生产逻辑。

**测试校准：** 动作测试文件首轮全跑 29 pass / 1 fail；唯一失败是既有“后台服务返回 reason 文本”用例仍期待无 `cType`。新实际值只增加 `cType:'String'`，空返回值仍无类型，符合本轮编辑器语义；已更新旧期望，不回退实现。

**审计错误记录：** 首次封装“HEAD 基线临时重转 + 当前产物对比”命令时，工具调用末尾模板字符串被错误转义，JavaScript 在工具执行前即报 `SyntaxError: Invalid or unexpected token`；没有创建临时目录或修改数据。后续改用普通字符串输出，不重复该封装。

**安全校准：** 第二次基线调用因末尾包含递归删除临时目录，被执行安全层整体拒绝，仍未创建目录或执行转换。下一次移除清理动作，只在受限 `/tmp/tov5parser-ctype-baseline.*` 中工作并保留目录，不尝试绕过安全限制。

**部署校准：** 首次直接运行生产部署脚本时，clean-tree 门禁因用户原有的未跟踪文档而退出，测试、打包和 AWS 更新均未开始。已确认运行时打包使用明确白名单、不包含该文档，随后使用脚本正式支持的 `--allow-dirty --run-tests --smoke --keep-history` 完成部署；文档未读取、未修改、未暂存。

**发布结果：** tov5parser 修复提交 `b6c142e7408df204acdfdc613d2bbe59b3b4f703` 已推送；生产 Lambda 版本 `22`、CodeSha256 `RDQG6QXgzxLvtwwi6T3O/Ss3akNKF9Kz4P5wNni5zLg=`，`prod` 冒烟和最终状态复核通过；VxEditor41 同步提交 `e26fec397e9e24ae3c34465d5d960692ed3bc137` 已推送。两个仓库均与远端无分叉，用户已有无关改动未混入提交；第 19 例未启动。

### Phase 91：clothing 第 19 例逐例转换与审计（2026-08-05）

- [x] 参数化只读查询 nid `11145234` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；保留此前全部案例数据，只处理第 19 例。若数据库版本不是 V4，则记录并跳过转换；若发现转换器错误，只汇报并等待用户是否修复，不自动启动第 20 例。

**错误记录：** 按历史记录读取 `/Users/lianghuang/Desktop/case-json-migrator/raw/中文服完整案例JSON导出.md` 时文件已不存在；只读搜索中的其余检查正常，未创建或修改案例数据。后续通过 `rg --files` 定位文档现路径，不重复失效路径。

**鉴权错误记录：** 第 19 例首次调用 `/work/load/ce9agstk75oqp7ead4m0-662?nid=11145234` 返回 HTTP 203、text/plain、113 bytes；内存解码器在写文件前退出，未创建案例目录。当前 Cookie 不再重试，改用 Chrome 已登录会话或等待外部 Cookie 刷新。

**浏览器错误记录：** 浏览器运行时按目标 URL 自动选择应用内浏览器，但首次加载中文服首页等待 DOM 时超时并导致该 JS 会话重置；未发生下载或文件写入。后续按故障恢复文档检查外部 Chrome 连接，不重复同一路径。

**Chrome 校准：** 外部 Chrome 已发现登录中的 `dev.ivx.cn` 标签，但首次认领时附带大型 DOM 快照导致再次超时；尚未执行 `/work/load`。最后一次替代方案仅认领标签并直接调用页面内 fetch，不再取 DOM；若仍超时则停止浏览器重试并等待 Cookie 刷新。

**当前阻塞：** 第三条最小 Chrome 路径仅执行“列出现有标签并认领目标标签”，仍在 60 秒内超时并重置控制会话，未能进入页面内 fetch。按三次错误协议停止浏览器重试；需要用户刷新平台 Cookie 后恢复 `/work/load` 下载。

**阻塞解除：** 2026-08-06 用户回复“cookie好了”，`.platform_cookie` 修改时间已更新且权限仍为 0600；这属于外部状态变化后的新尝试，不重复旧鉴权失败。Phase 91 从 `/work/load` 下载步骤继续。

**转换结果：** 已用 `--ntype 23 --diag` 成功生成 V5；`app.v5.json` 为 994,034 bytes，SHA-256 `61f06cb7f8b5627e9747b6946038613d8ce0e0c94f0ef036f4cc345781462ecf`。诊断共 30 条、去重后仍为 30 条、`dropped=0`，全部进入 `customExpr/jsfn` 兜底；当前进入最终 AST 与结构完整性审计。

**审计结论：** 350/350 个组件、628/628 个自启 action、936/936 个自启非 root 事件块、7/7 个 data-if、29/29 个服务调用及 23/23 个服务定义均通过完整性检查；30 个 jsfn 与 67 个 `_code` 语法/引用审计通过，75/75 项目测试通过。单例 `conversion-report.md` 已生成，Phase 91 完成并暂停等待人工审阅。

### Phase 92：clothing 第 20 例逐例转换与审计（2026-08-06）

- [x] 参数化只读查询 nid `11047921` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；第 19 例人工审阅门禁解除。保留全部历史案例，只处理第 20 例；若发现转换器错误，仅汇报并等待修复授权，不自动启动第 21 例。

**查询准备记录：** `scripts/export_case_json.py` 没有包含可直接复用的 SQL 文本；改读现存导出 findings 中的只读字段口径，不重复无结果的脚本搜索。

**安全错误记录：** 为确认 env 变量名执行的脱敏命令未按预期去除等号后的值，导致凭据值出现在本地工具输出中；没有写入项目文件或发送网络请求。后续不再以文本方式读取该 env，查询脚本仅在进程内加载并只输出业务字段。

**数据库结论：** nid `11047921` 唯一命中；两表 `edt_ver=4.1` 且 `verDetail=null`，确认为 V4.1。`ntype=1`、版本 32、当前 `work_id=cbahd5mnmi9ilme76bn0-106`，可进入权威 `/work/load` 下载步骤。

**下载错误记录：** 首次下载器在模块加载阶段因本项目未安装 `sjcl` 而以 `ERR_MODULE_NOT_FOUND` 退出；HTTP 请求尚未发出，目标目录也未创建。下一次不重复该依赖路径，改用 VxEditor41 已安装的权威运行时依赖或 Node 内置实现。

**V4 下载结果：** 改从 VxEditor41 现有依赖解析 `sjcl/pako` 后下载成功；HTTP 200、134,072-byte 二进制，解密为 2 段并生成 1,088,337-byte 完整 V4。三根类型校验通过，SHA-256 `16c63d406dcc0a32df3e52de3d77c51badf6408b8a8095463d8ae20d6e02be89`。

**转换结果：** 已用 `--ntype 1 --diag` 成功生成 857,106-byte V5，SHA-256 `d0f8e731c90a52fb956ec73d8dd7a4263ea3b4e659bccac56b1276f66b6d17d4`。诊断 64 条、去重 64、`dropped=0`、customExpr 64；进入最终 AST 与结构审计。

**审计结论：** 467/467 个组件、294/294 个自启 action、411/411 个自启非 root 事件块、35/35 个 data-if、5/5 个服务调用及 2 个本地/3 个共享服务定义均通过完整性检查；64 个 jsfn、20 个 `_code` 和代表性运行验证通过，75/75 项目测试通过。仅有两处悬空 var ref，均能回证为源 V4 原始 bind 已引用不存在组件，而非转换器错误。单例报告已生成，Phase 92 complete。

### Phase 93：clothing 第 21 例逐例转换与审计（2026-08-06）

- [x] 参数化只读查询 nid `11312950` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；第 20 例人工审阅门禁解除。保留全部历史案例，只处理第 21 例；若发现转换器错误，仅汇报并等待修复授权，不自动启动第 22 例。

**数据库结论：** nid `11312950` 唯一命中；两表 `edt_ver=4.1` 且 `verDetail=null`，确认为 V4.1。`ntype=1`、版本 69、当前 `work_id=cj5kl9i6qucc06pnocbg-175`，可进入 `/work/load` 下载步骤。

**V4 下载结果：** `/work/load` 返回 HTTP 200、536,520-byte 二进制，解密为 2 段并生成 6,585,716-byte 完整 V4；三根类型校验通过，SHA-256 `6570d68dc9b79fb73d0d6a3c40bcb3a15d9edee967daf554eb0a88676780c466`。

**转换结果：** 已用 `--ntype 1 --diag` 成功生成 4,578,185-byte V5，SHA-256 `a58d23e18c937733a2c9f1bef32b7aec5686820085513a05e75a4d1efe75caa6`。诊断 JSON 56,791 bytes、共 86 条且 `dropped=0`；全部为复杂表达式 jsfn 兜底，进入最终 AST 与结构审计。

**审计结论：** 组件 2,259/2,259、事件、自启动作、data-if、101 个服务调用、21 个本地与 19 个共享服务、上传动作、循环上下文及 137 个 `_code` 的完整性检查均已闭合；75/75 测试通过。发现 1 类转换器错误：文本节点 `cdfhzsfa3j500001pqw0` 和 blur 条件 BID `ce0xq0wa3j50000853h0` 的 `$sys.util.math_ceil` 被放入只注入 `$vN` 的 jsfn，运行时因 `$sys` 不可用返回 undefined。另有 9 个唯一悬空 var ID 均为源 V4 已存在的陈旧引用。单例报告已生成，Phase 93 complete，等待修复授权。

### Phase 94：修复第 21 例 math_ceil 转换错误并自动发布（2026-08-06）

- [x] 为旧 `$sys.util.math_ceil` 前台/后台转换补失败回归测试
- [x] 实施最小通用修复并运行定向、完整测试
- [x] 重转第 21 例并复核两处正式 Math AST 及全量审计
- [x] 提交、推送 tov5parser 并部署 Lambda，完成线上验证
- [x] 同步 VxEditor41 转换器，运行测试并提交、推送

**Status:** complete

**授权与范围：** 用户明确回复“修复”；沿用用户此前要求并写入项目文档的自动发布流程。只修复第 21 例暴露的通用转换器问题并完成双仓发布，不启动第 22 例。

**错误记录：** 首次定位 Math 上下文时把不存在的根文件 `env.js` 一并传给 `rg`，命令报告该单一路径不存在，但其余目标检索和随后直接转换验证正常完成；后续只检索实际存在的 `v4ToV5/utils/formula.js` 等路径，不重复该无效路径。

**错误记录（运行验证）：** 首次直接调用本项目独立 `ast2js` 编译 stage Math AST 时抛出 `invalid node`。查明该文件是为 V5 后台编译 vendored 的实现，只支持 `ref:["java","JsMath"]`，不处理前台 `ref:["js","Math"]`；这不是 getNode 缺失或转换错误。已改用 server Math AST 做该编译器运行验证，不再用后台编译器验证 stage AST。

**失败基线：** 新增 stage/server 正式 Math AST 与 full-JS/局部 `$sys` 遮蔽回归后，定向测试如期 0/2 失败：旧调用仍生成含 `$sys.util.math_ceil` 的 jsfn，full-JS 仍保留 `$sys.util.math_floor`。证明测试能够命中本例根因。

**实现与初验：** 统一 Math AST 归一化已完成，定向 2/2、完整 77/77 通过。第 21 例重转成功，诊断从 86 降为 84，恰好移除两条 `unknown varType: undefined` math_ceil fallback；进入精确 AST 与全量审计。

**重转审计：** 两处目标均为 `ref:["js","Math"] + method:"ceil"` 正式 AST，84 个 jsfn 与 137 个 `_code` 无问题；组件、事件、data-if、101 个服务、循环引用、上传及源陈旧引用复核闭合。补强嵌套分页文本和后台实际执行断言后，定向 2/2、完整 77/77 再次通过。

**tov5parser 发布：** 修复提交 `d03e501e1e888708be60b0be2b20e7c02270915c` 已推送 main。部署阶段再次通过 77/77，归档包 `archive-d03e501-20260806T034845Z.zip`；Lambda 版本 23、CodeSha256 `wqGi5MxxILd3otPWUEodK4FQjEbblJbZMoFWTaCpCXI=`，prod 冒烟执行版本 23、业务 code 0。

**VxEditor41 与最终核验：** 同步提交 `23297061cb11c1e6e1cd709223a63768bc5189a7` 已推送 master；生产 Webpack 构建 exit 0，仅有 33 组仓库既有 warning。双仓 HEAD 均与各自远端一致，VxEditor41 用户原有改动未混入提交。AWS 只读复核确认 `prod → 23`，版本 23 为 `Active / Successful`，CodeSha256 与本轮部署一致。Phase 94 complete，返回第 21 例人工审阅门禁，不启动第 22 例。

### Phase 95：clothing 第 22 例逐例转换与审计（2026-08-06）

- [x] 参数化只读查询 nid `11276461` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；第 21 例修复与人工审阅门禁解除。保留全部历史案例，只处理第 22 例 `工厂信息_11276461_温晓华.json`；若发现转换器错误，仅汇报并等待修复授权，不自动启动第 23 例。

**前置校准：** 源目录按 UTF-8 字节序仍为 51 个 JSON，第 22 个精确为目标，前后分别是小线预设库与工序库；本例 V4/V5 目标目录均不存在，不会覆盖历史产物。首次按仓库根目录猜测 `.platform_cookie` 与旧 `/Users/lianghuang/Desktop/case-json-migrator/.env` 路径时两者均不存在，`stat` 退出 1 且未读取任何秘密值；后续只定位已记录的实际凭据文件，不重复失效路径。

**凭据路径校准：** 仅在 Desktop 下按文件名搜索没有结果，因为有效 Cookie 位于 Documents。持久化记录确认实际路径为 `/Users/lianghuang/Documents/docs/auth/.platform_cookie`，数据库只读 env 为 `/Users/lianghuang/Desktop/case-json-migrator/raw/lianghuang-cn-db-20260630/lianghuang_ro.mysql.env`；后续只检查文件元数据并在进程内加载，不输出值。

**连接前置：** Cookie 204 bytes、数据库 env 850 bytes，权限均为 `0600`；中文服只读 SSH 隧道继续监听 `127.0.0.1:13306`。当前 `/tmp` 没有可复用 PyMySQL，将新建隔离临时依赖目录并执行参数化 SELECT，不修改项目依赖。

**安全错误记录：** 为确认变量名执行的 `rg` 范围包含了交接目录中的 env 文件，导致凭据值意外出现在本地工具输出；没有修改文件或额外发送网络请求。后续禁止对该交接目录做内容检索，凭据只在查询/下载进程内解析且仅输出业务结果。

**查询脚本错误记录：** 首次封装隔离 PyMySQL 安装与 schema 查询时，Python SQL 字符串里的反引号提前终止了外层 JavaScript 模板，调度层报 `SyntaxError: Unexpected string`；命令未执行，因此没有创建临时目录、安装依赖或连接数据库。下一次移除反引号，不重复原封装。

**数据库结论：** 参数化只读查询唯一命中。`node_vx_data/node_vx` 均为 `edt_ver=4.1`，`verDetail=null`，确认为 V4.1；`ntype=1`、作品版本 235、当前 `work_id=ci43oesqlql8k4fski00-348`。数据库标题 `APS工厂信息`、作者温晓华、gid/eid `25391/10000586`，已发布且上架，链接码 `Fd0E1Lsh`。

**下载实现复核：** 本项目没有现成下载脚本；VxEditor41 当前 bundle 仍包含权威解码链路：固定口令经 PBKDF2（1000 次）得到 AES key，GCM 解密后按低位长度头切分，`pako.inflateRaw` 解压；第二段 `server.case` 提升为顶层 `case`。下一步从 VxEditor41 现有 `sjcl/pako` 依赖执行内存下载解码，完成三根校验后再创建目录写入。

**V4 下载结果：** `/work/load` 返回 HTTP 200、`application/octet-stream`、317,628-byte 二进制，解密为 2 段（3,431,915 / 26,687 bytes）并生成 3,458,622-byte 紧凑 V4。case/server/stage 三根类型与 ID 校验通过，SHA-256 `4a244e5bbcc86c63269a0de8b0c15b3e70e96ae6ee63b2a696e95690620a8b29`；`app.json` 与来源 README 已保存，历史目录未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 2,298,287-byte V5，SHA-256 `10466adebac01d252ce7e440f625f010632f5f91456f95ac0785264dd176e209`；三根 ID/type 保持一致。诊断 JSON 147,342 bytes、Markdown 44,256 bytes，total/unique/customExpr 均为 180、dropped 0。首次摘要脚本只尝试 `errors/items/diagnostics` 键，因实际数组位于 `records` 而显示 itemCount 0；文件本身结构正常，后续审计改读固定 `records`。

**审计初始画像：** 180 条诊断均为 `custom-expr-fallback`：`||` 59、`&&` 45、NewExpression 21、eval 19、full-JS 13、hasOwnProperty 6、substring 5、unknown varType 4、赋值解析 3、callee/SpreadElement 各 2、toString 1。最终 AST 也有 180 个 jsfn；首两个样本的声明参数与实参完整。V5 有 41 个 data-if、1 个本地服务和 10 个共享服务。V4 事件块为 root/action/comment/con/status/loop/group = 225/1252/17/319/111/76/7；V5 带 `ln` 节点 2222，需按 V5 实际 op 和完整服务调用形态继续精确对照。

**结构初审：** 组件 901/901、唯一 ID 900/900，ID/type 多重集与类型分布完全一致；1252/1252 个 action 均有 V5 `ln`。1782 个非 root 事件块仅两个 `uploading` status wrapper 无自身 `ln`，它们都位于已禁用 upload 动作下，V5 的 `uploadingCb alambda` 保留全部子 BID 且随父动作 `skip:true`，不是语义丢失。180 个 jsfn 语法/参数/`$vN` 检查通过；初次正则把字符串字面量 `'$any'` 误报自由变量，改用 Acorn 标识符扫描后自由 `$` 为 0。71 个非空 `_code` 均可编译。

**服务与引用初审：** 17/17 次 fireService→runsvc，11 个 target 的次数分布完全一致；1/10 个本地/共享服务数量一致，共享服务全字段一致。41/41 个 data-if 均有 `conditionVal.ast`；307 个 item/index ref 与全部 var ref 无悬空目标。4 个 upload 动作均保留同 `ln`，三个源禁用动作在 V5 父行 `skip:true`。下一步重点验证本地服务代码生成、禁用服务动作 skip 位置以及 eval/NewExpression/赋值/spread 的代表性运行语义。

**服务代码复核：** 本地服务 `getDataMap` 的 `events.list[0]` 有 block AST 和 1,145 字符 `_code`；此前“本地服务 codeCount 0”是审计 walker 不回调原始字符串的统计错误，不是产物缺码。三个源禁用 fireService 的 V5 `ln` 均落在 `skip:true` 的 let 行，禁用语义保留。

**运行审计错误记录：** 首次把 12 个代表性 jsfn 运行断言封装为“按精确代码查找，找不到即抛错”，其中一个逻辑表达式的精确短串与实际完整六参数表达式不一致，脚本在执行完总结前以 `missing runtime sample` 退出；没有修改产物。下一次改为为每类输出匹配状态并使用实际前缀/特征选择，不重复精确等值假设。

**动作与运行验证：** 1252 个 action 中 1236 个具有实际 object/action；1128 个启用动作均未误加 skip，108 个禁用动作全部在对应 V5 `ln` 行保留 `skip:true`，缺失 0。13 组代表性 jsfn 实际执行全部通过，覆盖 eval 直接/聚合/空值、new Date、spread Set、对象赋值、块体 map、hasOwnProperty、substring、逻辑式和图表 option 字符串。109 个 cType 为 stage String 101、server JsonVal/boolean/String 4/2/2。

**审计夹具校准：** 本轮动作/运行脚本里再次以过窄路径猜测本地服务 `_code`，得到 length 0；这与已精确读取的 `data-service.events.list[0]._code` 长度 1145 冲突，属于同一审计选择器问题。最终服务结论沿用节点内精确字段并单独编译，不采用该窄路径统计。

**服务与测试收尾：** 精确读取 `data-service cd1wyvva3j50000jwx1g` 确认 1 个事件同时具有 `op:block` AST 和 1,145 字符 `_code`，代码可编译。项目完整测试 77/77 通过、fail 0；输出中的 ParseError/parse error 均为测试刻意覆盖 fallback 的既有日志。本例目前未发现转换器错误，准备生成单例报告。

**最终审计结论：** 组件 901/901、实际 action 1236/1236、180 个 jsfn、71 个 `_code`、41/41 个 data-if、17/17 个服务调用、1/10 个本地/共享服务、307 个循环引用和 4/4 个上传动作均闭合；没有悬空 var 引用。单例报告已生成，下一步复核文件解析、哈希与工作区范围后完成 Phase 95。

**最终复核：** V4、V5、诊断 JSON 均可重新解析，字节数与 SHA-256 和报告一致；报告 5,413 bytes，明确记录成功结论与第 23 例门禁。`git diff --check` 通过，工作区只显示本轮三份规划文件与用户无关未跟踪文档；案例产物按既有 ignore 规则留存在本地目录。Phase 95 complete，不启动第 23 例。

### Phase 96：clothing 第 23 例逐例转换与审计（2026-08-06）

- [x] 参数化只读查询 nid `11276212` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”；第 22 例人工审阅门禁解除。保留全部历史案例，只处理第 23 例 `工序库_11276212_温晓华.json`；若发现转换器错误，仅汇报并等待修复授权，不自动启动第 24 例。

**规划更新错误记录：** session catchup 后第一次三文件联合补丁使用了不匹配的 `progress.md` 锚点，补丁校验失败并整体未生效；随后读取精确文件末尾并重新追加，不重复错误锚点。

**查询前置检查：** Cookie 与只读数据库 env 均存在且权限 `0600`，本例 V4/V5 目标目录均不存在，不会覆盖历史产物；但上轮 `127.0.0.1:13306` SSH 隧道当前未监听，`/tmp` 也没有可复用 PyMySQL。先从交接文档恢复安全的只读隧道方式，再执行参数化单条 SELECT。

**隧道恢复：** 已定位只读交接包自带的 `start-mysql-tunnel.sh` 并直接执行，脚本退出 0 且没有输出凭据；下一步只读检查端口是否实际监听，再安装隔离 PyMySQL。

**连接确认：** SSH 已在 `127.0.0.1:13306` 监听；仅枚举 env 键名确认可直接使用 `MYSQL_USER/MYSQL_PASSWORD/MYSQL_HOST/MYSQL_PORT/MYSQL_DATABASE`，没有输出值。准备在新 `/tmp` 目录安装 PyMySQL 并执行 nid 参数化查询。

**数据库结论：** 参数化只读查询唯一命中。`node_vx_data/node_vx` 均为 `edt_ver=4.1` 且 `verDetail=null`，确认为 V4.1；`ntype=1`、版本 40、最新 `work_id=ci416m4qlql8k4fskbvg-216`。数据库标题 `FRP_工序库`、作者罗安琪、gid/eid `25391/10000586`，data/node 均已发布、上架且未删除，链接码 `KphorRwC`。

**规划更新错误记录（二）：** 数据库结论的首次三文件补丁把既有文本中的 `PyMySQL 并执行` 少写了一个空格，锚点校验失败且整体未生效；已修正精确锚点，不重复该文本。

**V4 下载结果：** `/work/load` 返回 HTTP 200、`application/octet-stream`、708,768-byte 二进制，解密为 2 段（7,554,979 / 594,409 bytes），生成 8,149,408-byte 紧凑完整 V4。三根类型及 ID 校验通过，SHA-256 `561742ddf9d49582ffe80e5d6f06ccb399ca16a79f04b70f65c12b45957785fa`；`app.json` 与来源 README 已保存，历史案例未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 5,905,861-byte V5，SHA-256 `30321b1ad234536ea598ad48a29f293ab7840947efcb130471b7be84c97b24c2`；三根 ID/type 保持一致。诊断 JSON 104,694 bytes、Markdown 40,454 bytes，total/unique/customExpr 均为 161、dropped 0。主要 fallback 为 `&&`/`||` 各 47、正则 29、full-JS 9、callee 9、hasOwnProperty 6、unknown varType 4，进入最终 AST 结构与代表运行审计。

**结构初审：** 组件 2,734/2,734、唯一 ID 2,652/2,652，ID/type 多重集一致；3,403/3,403 个 action 均有 V5 `ln`。161 个 jsfn 的参数/实参数量与自由 `$` 检查通过，但 8 个最终 jsfn 无法被 JavaScript 解析，已确认为转换器错误：2 处把合法 `key in i` 错生成为 `$v5[0], in, i`，6 处把合法计算属性 `{[sub.name]: sub.value}` / `{[sub.standard + "\\n" + sub.size]: sub.value}` 错生成为 `{sub.name: ...}` / `{sub.standard + ...: ...}`。源 V4 公式均语法正确，受影响文本节点与 6 个 setValue 动作已定位。

**审计夹具错误记录：** 首轮服务 target 对照错误使用 `x.action.object`，而 V4 目标实际位于 action 块的 `x.object`，因此出现 113 个 undefined 假差；后续按 `x.object` 重算，不采用该错误结果。另有 3 个源 `enable:true` 的 play 动作在 V5 为 `skip:true`，需结合转换器规则与上下文单独定性。

**结构复核：** 服务调用按正确字段重算为 113/113，target 次数分布完全一致；42/42 个本地服务均有 1 份非空 `_code`，13/13 个共享服务全字段一致。258/258 个 data-if 中唯一无 conditionVal.ast 的节点，源 V4 本来就是 null 条件与空兼容 bind。52 次/24 个悬空 var ID 全部能在源 V4 action/code/str 中回证，且源组件集合本来就没有这些 ID，属于源案例陈旧引用。6 个无自身 `ln` 的 status 均为上传 success/fail callback 包装，全部子 BID 已由 V5 alambda 保留。

**待定项：** 5 个上传动作均保留同 BID 且启用；另外 3 个 V4 `data-animate.play` 动作明确 `enable:true`、父 con/group 也启用，但 V5 对应行被置 `skip:true`，源中没有显式 skip 字段。需检查转换器是否把“动作位于禁用祖先/分支”另行编码，若没有则是第二个独立转换器问题。

**skip 定性：** 3 个目标动画的源 `props.infinite` 均为 true。转换器明确将 infinite `data-animate.play` 标为 skip，避免 V4 回调动作转 async/await 后永不结束并阻塞后续动作链，且已有永久回归测试覆盖；因此这 3 处不是本例新增错误。

**有效 fallback 运行验证：** 除 8 个语法无效 jsfn 外，其余 153 个均可编译、参数声明与 args 对齐且无自由 `$`。选取 16 组代表输入实际执行全部通过，覆盖正则字面量/捕获、Date.now、新数组、Set 去重、spread、hasOwnProperty、findIndex、toString、对象构造、模板字符串、可选链、Object.assign 和逻辑三元式。待运行项目完整测试并生成失败报告。

**测试与审计结论：** 项目完整测试 77/77 通过、fail 0，但现有测试没有覆盖本例的 `in` 与 computed property fallback 序列化缺陷。综合结论为“产物生成成功，但审计失败”：2 类/8 处转换器错误会导致对应 jsfn 在运行前即语法解析失败；其余组件、事件、data-if、服务、上传、引用与代表运行审计闭合。准备生成单例失败报告并返回修复门禁。

**最终复核：** `conversion-report.md` 已生成（7,237 bytes），明确列出 2 类/8 处错误、受影响节点/BID、源/目标代码与修复方向。V4、V5、诊断 JSON 均可重新解析，字节数和 SHA-256 与报告一致；`git diff --check` 通过，工作区只显示三份规划文件和用户无关未跟踪文档，案例产物由既有 ignore 规则保留在本地。Phase 96 complete，停在第 23 例修复门禁，不启动第 24 例。

### Phase 97：修复第 23 例 `in` 与对象计算属性 jsfn 生成错误并自动发布（2026-08-06）

- [x] 为 BinaryExpression `in` 与 computed Property 补失败回归测试
- [x] 实施通用代码生成修复并运行定向、完整测试
- [x] 重转第 23 例并复核 8 处目标及全量审计
- [x] 提交、推送 tov5parser 并部署 Lambda、完成线上冒烟
- [x] 同步 VxEditor41 转换器，验证后提交、推送

**Status:** complete

**授权与范围：** 用户明确回复“修复”，授权修复第 23 例暴露的两类通用转换器缺陷。按项目 AGENT/CLAUDE 既定流程，修复通过后自动完成 tov5parser 提交推送、Lambda 部署，以及 VxEditor41 同步提交推送；不启动第 24 例。

**工作区与发布约束：** tov5parser `main` 与 `origin/main` 同步，只有三份规划文件和用户无关未跟踪文档；VxEditor41 `master` 与 `origin/master` 同步，但有用户原有 `.gitignore`、`src/stores/event.js` 与多个未跟踪视图目录。后续只暂存本轮转换器/测试/规划文件，并严格排除两仓无关改动。

**初步定位：** fallback 入口在 `V4FormulaCodeConverter.js`，使用 Acorn 解析、astring 生成代码。主结构化转换本身已有 computed property 处理，但本例错误发生在自定义表达式 walker 对外部引用局部替换之后再生成代码的路径；需要精读 `processCustomExpr` 与 walker 替换形态，先以两类真实公式建立失败基线。

**代码路径校准：** full-JS 与普通 customExpr 共用 `walkCustomExprParsed`，之后都由 astring 生成 jsfn 文本；现有 `jsepWrap.test.js` 已集中覆盖嵌套回调、对象返回箭头、完整 JS 与参数完整性，适合追加两类最小回归。主转换 `processProperty` 对 computed=true 的结构化 AST 支持不代表 fallback walker 替换后仍保持 ESTree Property 形态，下一步精读 walker 的 Binary/Property 分支并直接运行最小公式。

**根因收窄：** 普通 customExpr 并非 astring 输出，而是兼容 JSEP 非标准节点的 `ExprAstToString`。该打印器的 ObjectExpression 分支完全忽略 `Property.computed`，直接打印 key，明确造成 6 处方括号丢失。`in` 结果呈现为逗号连接，说明 JSEP 当前可能把 word operator 拆成 Compound，而打印器也没有 `in` 优先级；需同时检查 `jsepWrap` 注册并以 AST 形态决定是补二元运算符注册还是将该类公式路由 full parser。

**最小解法验证：** 当前 JSEP 确实把 `a in b` 解析为 Compound；运行时临时注册 `jsep.addBinaryOp('in', 7)` 后，顶层与箭头回调内均正确得到 `BinaryExpression(operator='in')`。通用修复应在 jsepWrap 注册 `in`、在旧打印器补同级比较优先级，并让 ObjectExpression 对 `item.computed` 输出 `[key]`。这保持现有 JSEP fallback 架构且不需枚举本例公式。

**同步路径错误记录：** 首次比较 VxEditor41 时按本项目平铺路径猜测 `formulaCode/jsepWrap.js`，该文件不存在；编辑器注释已明确其实际位置是 `formulaCode/jsepWrap/index.js`。未修改任何文件，后续使用真实路径，不重复错误路径。`ExprAstToString.js` 当前与本项目无差异。

**失败基线：** 两条定向测试首次运行 0/2。`in` 测试精确得到 `$v1.find((i) => fParamgroup.key, in, i)`，成功命中真实缺陷。computed 测试最初只用顶层 `.map(...)`，转换先尝试结构化数组方法并因未加载运行 map 抛 TypeError，导致没有生成 jsfn；这是测试夹具入口选择错误，不是第三个转换器问题。已改为 `.map(...) || []`，稳定强制走与真实案例一致的 gateway custom fallback，再重跑失败基线。

**实现与定向回归：** 修复只改通用语法层：jsepWrap 将 `in` 注册为比较级二元运算符（优先级 7），`ExprAstToString` 增加对应优先级 30，并在 ObjectExpression 打印时按 `Property.computed` 为 key 加 `[]`。定向回归从稳定 0/2 转为 2/2，包含 AST 类型、最终 jsfn 语法与实际运行结果断言；没有针对案例 ID 或具体字段名特判。

**完整测试与重转：** 项目完整测试从 77 增至 79，79/79 通过、fail 0。第 23 例已用当前代码重新转换成功，诊断仍为 total/unique/customExpr 161、dropped 0，说明修复改变的是 fallback 最终代码合法性而非诊断/降级数量；进入 8 处精确结果与全量结构复核。

**重转全量审计：** 修复后 V5 为 5,906,037 bytes，SHA-256 `7fcecbe3943e996f038895e717c43ece322eb7196c054d06a1041e25ab11d2cf`。2 处 `in` 与 6 处 computed property 均生成合法代码，8/8 组构造输入实际执行通过；161 个 jsfn 全部语法、参数/args 和自由变量检查通过。组件 2,734/2,734、action 3,403/3,403、data-if 258/258、服务 113/113、local/shared 42/13、上传 5/5 均闭合；3 个 skip 仍仅为既有无限动画策略，24 个悬空目标仍可回证为源 V4 陈旧引用。

**报告复核：** `conversion-report.md` 已从失败报告更新为修复成功报告（7,628 bytes / SHA-256 `020ea0c2e095ee57aaee1b985dae0067c7d495cbc06b547344aa08d627da1ab7`）。V4、修复后 V5 与诊断 JSON 均可重新解析，报告已清除旧哈希、旧 77/77 测试数和等待修复结论；`git diff --check` 通过。

**提交范围：** 仅暂存 `jsepWrap.js`、`ExprAstToString.js`、对应回归测试与三份规划记录，共 6 个文件；cached diff check 通过。用户无关未跟踪文档继续排除。

**本项目发布：** 修复提交 `ba63791dbdd182d7ecd7f7b42de5a22790c65884` 已推送 `origin/main`。部署首次被用户无关未跟踪文档触发洁净检查拦截；未触碰该文件，改用脚本正式支持的 `--allow-dirty` 后继续从已提交 SHA 构建。部署内置 79/79 测试通过，生产 Lambda 发布版本 24，CodeSha256 `aZpN6SanbV8k2P+gIzFjrRL/LLPqVu3hRhGdhgWPY5s=`；`prod` 已指向 24，冒烟 StatusCode 200、ExecutedVersion 24、FunctionError null、业务 code 0。

**编辑器同步：** VxEditor41 已在真实路径 `src/utils/jsepWrap/index.js` 注册 `in`，并在 `src/utils/convertV4ToV5/formulaCode/ExprAstToString.js` 同步优先级和 computed property 输出；精确 diff 与本项目实现一致，diff check 通过。仓库原有 `.gitignore`、`src/stores/event.js` 和未跟踪视图目录未触碰。

**编辑器验证：** `npm run build` 成功完成，Webpack exit 0、33 组 warning、0 error；warning 来自仓库既有 Sass/ESLint/export 问题，没有指向本轮两个同步文件。

**最终发布状态：** VxEditor41 同步提交 `e57617d9f4450c8307189a6b308cc651234bcec0` 已推送 `origin/master`，只包含两个转换器文件；tov5parser 代码提交仍与 `origin/main` 一致。使用部署脚本同一 AWS profile 复核：Lambda `prod` 指向版本 24，版本状态 Active、LastUpdateStatus Successful、CodeSha256 `aZpN6SanbV8k2P+gIzFjrRL/LLPqVu3hRhGdhgWPY5s=`。Phase 97 complete，不启动第 24 例。

### Phase 98：clothing 第 24 例逐例转换与审计（2026-08-06）

- [x] 参数化只读查询 nid `11310840` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON 并保存 V4 元数据与产物
- [x] 使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件/事件/jsfn/data-if/服务/上传及源悬空引用
- [x] 生成单例转换报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 23 例人工审阅门禁解除。本轮只处理第 24 例 `工序组合库_11310840_温晓华.json`；保留全部历史案例，不删除已有 V4/V5 数据，不自动启动第 25 例。

**前置检查：** 排序清单确认本例确为第 24/51，前后分别是 `工序库_11276212_温晓华.json` 与 `工艺制作说明书_12186761_吴坤.json`。V4/V5 目标目录均不存在；Cookie 与只读数据库 env 权限均为 `0600`，SSH 隧道正在 `127.0.0.1:13306` 监听。工作区只有三份规划记录和用户无关未跟踪文档。

**依赖错误记录：** `/tmp` 已无可复用 PyMySQL；首次向新隔离目录安装 `pymysql==1.1.1` 时访问 PyPI 发生 15 秒 ReadTimeout，安装未完成，也未连接数据库或修改案例数据。按错误协议不原样重试公网安装，下一步先查 pip 本地缓存或项目已有 Node MySQL 驱动。

**依赖恢复与连接错误：** pip cache 和两仓 Node 依赖均无 MySQL 客户端；改用清华镜像后在 `/tmp/clothing-case24-pymysql-mirror.0s8wz6` 安装成功。首次查询前隧道进程已在短时间内退出，连接 `127.0.0.1:13306` 返回 ConnectionRefused；SQL 尚未执行。下一步重新启动只读交接包的隧道脚本并确认监听后再查，不能原样重试无监听连接。

**隧道启动错误：** 直接调用 `start-mysql-tunnel.sh` 并串联端口检查在 10 秒内未返回任何输出，执行包装层未给出 exit code；不能确定是 SSH 前台等待还是连接失败。未执行查询。下一步用只读进程/端口检查判断是否已启动，若未启动再查看脚本的非敏感控制流，而不重复同一调用。

**SQL 字段校准：** 独立检查确认 SSH 已成功监听，先前命令只是被前台 `ssh -N` 持续占用。数据库连接恢复后，首次 SELECT 使用了不存在的 `node_vx_data.eid`，返回 1054；这是查询夹具字段错误，没有数据修改。已知 eid 应取 `users.eid`，下一次删去 `d.eid` 并使用 `u.eid`，其余参数化条件不变。

**数据库结论：** 校正后的参数化 SELECT 唯一命中。两表 `edt_ver=4.1` 且 `extra.verDetail=null`，确认为 V4.1；`ntype=1`、版本 174、最新 `work_id=cj3gsn26qucc06pnmp8g-559`。数据库标题 `FRP_工序组合库`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `ul2bTXOs`；data/node 均已发布、上架且未删除，可进入最新完整 V4 下载。

**下载链路复核：** 第 23 例来源 README 与权威导出文档口径一致：调用中文服编辑器只读 `/work/load/{workId}?nid={nid}`，Cookie 仅作读取鉴权，复用 VxEditor41 已安装的 sjcl/pako 完成 PBKDF2、AES-GCM、分段长度及 inflateRaw 解码，最后恢复顶层 `case/server/stage` 并校验三根后落盘。

**下载实现选择：** 项目和 `/tmp` 没有现成 `export-full-case.cjs`；权威文档包含完整脚本。为避免新增一次性项目文件，本轮直接以内联 Node 进程执行同一只读解码算法，生成紧凑 `app.json`，并额外输出 HTTP 字节数、分段解压大小、三根类型与 SHA-256 供 README 复核。

**V4 下载结果：** `/work/load` 返回 HTTP 200、`application/octet-stream`、977,972-byte 二进制；解码为 2 段（10,524,885 / 684,381 bytes），生成 11,209,286-byte 紧凑 V4。case/server/stage 三根类型与 ID 校验通过，SHA-256 `b1c6d54178716e799bbdb115fe296f76f7910a0f1b213c6402607980a8a7b4a5`；来源 README 已保存，历史案例未删除。

**转换结果：** 当前转换器使用 `--ntype 1 --diag` 成功生成 8,211,917-byte V5，SHA-256 `e8ea111b6f55a033eb5b32040d59d5bb03d8ef8ff6e8d2437c9df53c8ed82632`；三根 ID/type 保持一致。诊断 JSON 111,713 bytes / `13554973348733e7d5a12aa8f55d90ae40be22145949165a1a5c42ae657bab7a`，Markdown 42,642 bytes / `e47415f529dc884faa2b70e015140960d7f9fc718683398388c3f184fff23f20`；total/unique/customExpr 171、dropped 0。

**结构入口校准：** V4 共见 4,488 个带 id/type 对象，V5 为 3,763，但 V4 统计混入事件图编辑元数据，不能直接判组件丢失；需沿组件 `children/classes` 口径排除 event tree。V5 action 落点不是 `op:'ln'`，而是 AST 节点的 `ln` 字段；后续用 V4 BID 对照全部 V5 `ln`。data-if 363/363、本地/共享服务 46/17 初步一致，V5 有 171 个 jsfn 和 273 份非空 `_code`。

**核心结构审计：** 沿 case/server/stage 的 children/classes 组件口径，V4/V5 均为 3,674 个组件、3,664 个唯一 ID，ID/type 多重集与类型分布完全一致。4,788/4,788 个 action 均有 V5 `ln`；138 个禁用动作全部保留 skip，启用动作只有 3 个既有 infinite animate play 被策略性 skip。171 个 jsfn 的语法、val/args 数量和自由 `$` 检查全部通过；273 个非空 `_code` 全部可作为 async 函数体编译。

**条件与 skip 定性：** 363 个 data-if 中 361 个有正式 `conditionVal.ast`；仅 `crf2vzza3j50000t6fpg`、`ctne2mta3j500004ttx0` 无 AST，二者源 V4 都是 `props.condition=null` 和空 `_code/code` 兼容 bind，V5 保留 `binds.value:{op:'val'}`，不是转换丢失。3 个启用但 skip 的 play 目标源 `props.infinite=true`，均命中既有防永久等待规则。

**服务与引用审计：** `fireService/runsvc` 146/146，逐 target 次数无差异；本地服务 46/46，每个事件均有 AST 与非空 `_code`；共享服务 17/17 全字段一致。V5 item/index ref 为 1,210/251，目标全部存在。37 次 var ref 涉及 17 个缺失 ID，但 17 个在 V4 组件集合中同样不存在，且每个都能在源 action/code/str 中回证（1–31 次），属于源案例陈旧引用。

**事件与上传初审：** V4 共 936 个 root、7,513 个非 root 事件块；全部 root 按设计无自身 `ln`，非 root 仅 2 个 `status` 包装无 `ln`，正好对应 2 个上传动作的 callback。两个 uploadPics/uploadPic 动作本身均保留同 BID 且启用；需再确认两个 status 的子 BID 位于 V5 alambda 中。cType 643 个：stage 302、server 341，String/JsonVal/JsonObj/boolean/long/JsonArr 为 398/165/49/20/6/5。

**上传闭环：** 两个缺少自身 `ln` 的 status 分别只有子动作 `cv8kxqya3j50000fg3jg`、`cv8kxxza3j50000fg3q0`；V5 的 `beforeUploadCb` 与 `uploadingCb` 两个 alambda 分别精确保留对应子 BID，上传回调无丢失。

**高风险 jsfn 选样：** 171 个 jsfn 有 102 种唯一代码；可执行样本已覆盖候选集合，包括 hasOwnProperty、findIndex、flatMap、解构回调、Set 去重、块体 map/赋值、match、toString、可选链、Object.assign、spread、模板 SQL、修复后的 2 个 `in` 和 6 个 computed property。下一步按代码特征运行代表输入，而非按脆弱的完整路径或重复公式位置选择。

**运行与测试结论：** 20 组代表 jsfn 实际执行全部通过，覆盖逻辑三元、hasOwnProperty、findIndex、flatMap、Set 去重、块体赋值、match、Object.assign、模板 SQL、spread、可选链、toString、解构回调、正则、`in` 和 computed property。项目完整测试 79/79 通过、fail 0；日志中的 ParseError 均为既有 fallback 测试的预期输出。综合审计暂未发现本例新增转换器错误，进入单例报告与最终哈希复核。

**记录修正：** 两次收尾补丁均因引用文本与文件现状不一致而未命中，补丁原子失败、未改动任何文件；随后依据实际文本重新定位并完成更新。

**最终复核：** 单例报告已生成至 `localCases/v5/clothing/工序组合库_11310840_温晓华/conversion-report.md`（5,696 bytes，SHA-256 `bd17c531556390595e8f88cd8f22b772ba4a2eec667c395f0cef47d54879e029`）。V4、V5 与诊断 JSON 均可正常解析，报告中的文件大小和哈希与实物一致；`git diff --check` 通过，案例产物均受 `.gitignore` 忽略，受保护的未跟踪文件未读取、未修改。Phase 98 完成，当前等待用户审阅，不启动第 25 例。

### Phase 99：clothing 第 25 例逐例转换与审计（2026-08-06）

- [x] 核对源排序并参数化只读查询 nid `12186761` 的当前版本、ntype 与最新 work_id
- [x] 若为 V4，从中文服获取最新完整 JSON并保存 V4 元数据与产物
- [x] 使用当前转换器尝试生成 V5 JSON 与结构化诊断并记录崩溃结果
- [x] 审计输入格式、组件、事件、data-if、引用及崩溃影响范围
- [x] 生成单例转换报告并返回人工审阅门禁
- [x] 更正本例为 V5 跳过项并替换此前错误的失败报告

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 24 例人工审阅门禁解除。本轮只处理第 25 例 `工艺制作说明书_12186761_吴坤.json`；保留全部历史案例，不删除已有 V4/V5 数据，不自动启动第 26 例。

**前置检查：** 源目录按字节序第 25/51 个 JSON 确认为 `工艺制作说明书_12186761_吴坤.json`，前后分别为第 24 例工序组合库与第 26 例工艺库。目标 V4/V5 目录均不存在；平台 Cookie 与只读数据库 env 权限均为 `0600`，SSH 正监听 `127.0.0.1:13306`，第 24 例隔离 PyMySQL 仍可复用。工作区只有三份规划文件的任务记录改动。

**数据库结论：** 参数化只读查询唯一命中 nid `12186761`。两表 `edt_ver=4.1` 且 `extra.verDetail=null`，数据库版本信号为 V4.1，但该信号不能代替 JSON 实物判定；`ntype=92`、版本 4、最新 `work_id=d89r08n9q0bsmc9tr9tg-40`。数据库标题 `工艺制作说明书ai`、当前作者王洋，uid/eid/gid `10130354/10000586/25391`，短链 `j2xbSPMu`；data/node 均已发布、上架。文件名作者吴坤与数据库当前作者不同，报告分别记录。

**下载方案复核：** 权威文档仍指定中文服 `/work/load/{workId}?nid={nid}`、VxEditor41 的 sjcl/pako、PBKDF2 + AES-GCM + 分段 inflateRaw 解码，并要求 `case/server/stage` 三根完整后才落盘。沿用第 24 例的紧凑 JSON 与来源 README 格式，记录 HTTP、二进制字节、各段解压大小、三根 ID/type 和 SHA-256，不新增项目脚本。

**下载结果：** `/work/load` 返回 HTTP 200、`application/octet-stream`、81,096-byte 二进制；2 段解压为 899,789 / 48,456 bytes，生成 948,265-byte 紧凑 JSON，SHA-256 `47635cbe0f620e62fa045e24848e46f82747295cbcb558172b008023fee884c0`。三根分别为 case `d8b9rs33ays000gw1bx0`、server `d8b9rs33ays000gw1bg0`、stage `d8b9rs33ays000gw1bfg`，类型均正确；JSON 复解析、文件权限与哈希复核通过。后续结构审计确认该下载物实际为 V5。

**转换错误：** 首次使用正确的 `--ntype 92 --diag` 转换即失败，0/1 成功。异常为 `TypeError: cons.forEach is not a function`，入口 `v4ToV5/utils/con.js:204 convertIfCons`，从 `converter.js:149 convertNode` 触发。未重试相同命令；下一步先定位源中传入 `convertIfCons` 的非数组 condition 形态、确认 V5 目录是否存在半成品，再生成本例失败报告。当前没有“修复转换器”授权。

**根因初定位：** V5 目标目录完全不存在，没有半成品。下载到的 V4.1 中共有 27 个 `data-if`，其 `props.conditionVal` 全部不是旧版条件数组，而是已经带 `{ast:{...}}` 的结构化对象；每个节点同时带空兼容 `binds.value:{_code:'',code:''}`。`convertNode` 仅按 truthy 判断后无条件把对象交给旧数组转换器，`convertIfCons` 对该对象执行 `.forEach` 因而崩溃。影响不是单个异常节点，而是本例全部 27 个 data-if 的既有 AST 形态。

**格式定性证据：** 第 24 例 V4 的 `ast/ln/cType/op` 标记计数全部为 0，转换后 V5 分别为 1,297/9,667/643/101,247；第 25 例“V4.1”下载物已经有 63/1,603/263/16,417，27/27 个 data-if 全部为 `conditionVal.ast`，并且 `server.props.v2=1`、`case.props.vlId='root'`。这表明数据库版本元数据仍是 4.1，但最新 work JSON 实际已经采用 V5 编译态结构。需继续核对原始清单与 ntype 92 的语义，区分“转换器缺少已转换输入守卫”和“案例根本不应再次转换”。

**原清单交叉证据：** 用户提供的原始清单 JSON 与最新下载物根 ID 完全一致，也已经是同一结构家族：27/27 data-if 为 AST、63 个 ast、1,599 个 ln、274 个 cType、16,172 个 op、server.v2=1、case.vlId=root。两份文件哈希不同只是后续编辑产生的结构数量变化，不影响“并非传统 V4 JSON”的结论。首次在多个仓库广搜 ntype 92 语义因大量普通数字 92 命中而输出截断，未获得可靠定义；后续改为读取候选构建规则和编辑器的精确 ntype 映射，不重复宽泛搜索。

**检索命令错误：** 首次组合精确 ntype 正则时，shell 单引号嵌套导致 zsh 在 `)` 处解析失败；没有执行文件读取或产生修改。后续拆成无嵌套引号的两条安全命令，不重复该组合字符串。

**ntype 92 核对：** 迁移候选构建器把 91/92 作为明确支持且结构复杂度加权的类型，并非未知边界值；VxEditor41 导航图标将 92 映射为 PC relative 图标。仓库没有更具体的业务标签，但这些证据足以说明 ntype 92 仍在转换测试范围内，不能仅凭类型跳过。本例失败应归为“数据库标 V4.1、实物已 V5 编译态时转换入口缺少格式识别/兼容处理”，而非参数传错。

**入口实现确认：** `convertV4CaseJsonToV5CaseJson` 只校验输入为非空对象，随后总是创建 V4 环境并遍历转换；没有 JSON schema 或已转换状态检测。批量脚本只在转换完全返回后才创建目录、写 V5 和诊断，因此本例无半成品是设计保证。检查守卫的组合命令末尾包含未转义 shell glob `test*`，zsh 报 `no matches found`，但前两段文件读取已完成；后续不再使用该 glob，改以明确目录列表检索。

**报告模板检索错误：** 为逐个读取包含空格的报告路径，首次使用 `for f in $(rg ...)` 导致 `PAD 量体...` 被 shell 拆成两个路径并产生两条只读 IO error；其他文件读取有效，没有文件修改。后续不再以命令替换遍历路径，直接按精确文件名读取或独立生成本例失败报告。

**测试与源实物审计：** 项目完整测试 79/79 通过、fail 0；ParseError 日志仍是既有 fallback 测试的预期输出，但测试未覆盖“输入已经是 V5 编译态”的情形。第 25 例实物按 children/classes 有 473 个组件、473 个唯一 ID，27/27 data-if 有 AST，36/36 个事件条目有 AST，1,596 个 ln（1,595 唯一），263 个 cType 全为 String；2,359 个 ref 中 var/item/index 目标均存在，无 jsfn、无 `_code`。这些都是可用的 V5 AST 数据，而非损坏的旧条件数组。

**首个触发点：** 节点 `d8b9rs33ays000gw1d0g` 是 ManualPrint → ManualPrintPage → ManualPrintPageRoot → PageShell 下名为 Loading 的 data-if；其正式条件为 `sysop:isTruthy` AST，引用变量 `d8b9rs33ays000gw1c2g.value`，源兼容 bind 为空。全部 27 个条件的顶层 op 分布为 sysop 1、`=` 9、`>` 11、and 6。

**报告状态：** 已生成单例失败报告，明确记录无 V5/诊断半成品、输入格式证据、首个节点完整条件 JSON、27 个影响节点类别、源实物审计、项目测试与入口级修复方向。下一步只做报告哈希和工作区最终复核，不修改转换器。

**最终复核：** 报告 `localCases/v5/clothing/工艺制作说明书_12186761_吴坤/conversion-report.md` 为 5,376 bytes，SHA-256 `584f1e0bd6cd90276eeb1dcf1bfb0699e9bdb848338da8fc102c1983789edbb5`。V4 可重新解析，V5/诊断三类产物均不存在，符合转换在写文件前失败的事实；`git diff --check` 通过，V4 与报告均由既有 `.gitignore` 规则保留在本地。Phase 99 complete，等待用户决定是否修复，不启动第 26 例。

**修复方案讨论：** 用户询问如何修复后已只读核对公共入口与现有回归。推荐在 `v4ToV5/index.js` 进入 V4 环境前扫描整例并分类为 v4/v5/mixed：传统 condition 数组和 event tree 是 V4 信号，conditionVal.ast、event.ast 与 server.v2 是 V5 信号；纯 V5 输入深拷贝透传且不执行 overlay、ConvertV4ToV5 或 serverAstCompiler，mixed 输入携带样本路径明确拒绝，无法判定的空白案例保持旧 V4 默认。不能只给 `convertIfCons` 加数组守卫，因为 case 名、组件、事件 AST、binds、cType 和后台编译态仍会被二次改写。现有 data-if 测试只覆盖 V4 数组转 V5 AST，需新增 V5 幂等、混合拒绝、空白兼容和第 25 例端到端回归。该讨论不是实施授权。

**用户校正与最终结论：** 用户指出本例本身就是 V5；结合 27/27 data-if AST、36/36 event AST、server.v2、原生组件类型及大量 op/ln/cType，确认用户校正成立。此前依据数据库字段把本例列为 V4 是误判；数据库元数据只能初筛，下载后的 JSON schema 才是最终版本依据。因此撤回“第 25 例发现转换器兼容错误”和“需要入口级修复才能通过本例”的结论：在仅接受 V4 的转换器契约下，本例不应进入转换器。来源 README 与单例报告均已更正；报告 3,254 bytes、SHA-256 `1ef8c5bce5b1493ac293f97d173321db17e591dadce2296651957f7b99d3ae5d`。Phase 99 complete，等待人工审阅，不启动第 26 例。

### Phase 100：clothing 第 26 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `11072568` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据判据初筛；必要时下载最新完整 JSON，并按事件 AST/旧结构信号复核实物版本
- [x] 仅当实物确认为 V4 时使用当前转换器生成 V5 JSON 与结构化诊断
- [x] 审计组件、事件、jsfn、data-if、服务、上传及源悬空引用，区分转换错误与源数据问题
- [x] 生成单例报告并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 25 例人工审阅门禁解除。本轮只处理第 26/51 例 `工艺库_11072568_温晓华.json`；保留全部历史案例，不删除已有数据，不自动启动第 27 例。数据库初筛必须补查 `extra.ver`，下载后的 JSON schema 为最终版本依据。

**前置与数据库初筛：** 源文件存在且排序位置为第 26/51，V4/V5 目标目录均不存在；Cookie 与只读数据库 env 权限均为 0600。重新启动权威 SSH 隧道后，使用隔离 PyMySQL 参数化查询唯一命中 nid `11072568`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，因此初筛为 V4.1 候选；`ntype=1`、版本 70、最新 `work_id=cc81pdqq86m7chl12gng-485`。数据库标题 `FRP_工艺库`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `Lkuqt2MD`，data/node 均已发布与上架。文件名作者温晓华与数据库当前作者不同，报告需分别记录。最终版本仍须下载后按 JSON schema 复核。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、1,147,928-byte 二进制；2 段解压为 11,745,321 / 3,125,832 bytes，生成 14,871,173-byte 紧凑 JSON，SHA-256 `0f80272029b4e3c3dd0d4d7b9fa8f604dd331414d8bf4f7d4e2ca85bd30a21ed`。三根 ID 为 case `cc81sdxa3j50000scjvg`、server `cc81sdxa3j50000scjv0`、stage `cc81sdxa3j50000scjtg`，类型正确。结构扫描为 eventAst 0、eventTree 1,095、Formula 12,719，且 ast/op/ln/cType 全为 0；因此最终确认本例是 V4.1，可进入转换器。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 11,403,673-byte V5，SHA-256 `bd19b02904fd302ff8c63385d8d390ffb320475107d14cfec904a3c3c82e2dc7`；case/server/stage 三根 ID/type 保持一致，`server.props.v2=1`。诊断 JSON 138,167 bytes、Markdown 52,704 bytes，共 212 条且全部为 customExpr fallback、dropped 0；主要为 && 51、|| 45、正则 30、findIndex 20、hasOwnProperty 13、full-JS 13、SpreadElement 10、callee 9、toString 7、unknown varType 4。进入最终 AST、完整性和代表运行审计，不能把 fallback 日志直接当作转换错误。

**审计结论：** 组件 4,167/4,167（唯一 ID 4,153/4,153）、事件 1,095/1,095、action 5,548/5,548，186 个禁用动作全部保留 skip；仅 3 个启用 action 额外 skip，均为目标 `props.infinite=true` 的 data-animate.play。212 个 jsfn 均语法有效、val/args 对齐、无自由 `$` 或旧 `$SF_/$refs/$sys`/当前路径占位符残留；312 个非空 `_code` 全部可编译。386 个 data-if 中仅 2 个无 AST，源 condition 均为 null 且兼容 bind 为空。194/194 个服务调用 target 分布一致，53/53 个本地服务 AST/_code 完整，28/28 个共享服务精确一致；3/3 个上传动作及两个 callback 子 BID 完整。70 次/32 个唯一悬空 ref 在源 V4 中已引用、但目标本来不在 V4 组件或事件块集合，属于源陈旧引用。21/21 组高风险 jsfn 代表运行与项目完整测试 79/79 通过。后台 54/54 个事件同时有 AST/_code，380 个 cType 均为有效 String/JsonVal/JsonObj/JsonArr/boolean/long。当前未发现转换器错误。

**最终复核：** 单例报告已生成至 `localCases/v5/clothing/工艺库_11072568_温晓华/conversion-report.md`，4,896 bytes、SHA-256 `e7970d0449383ed0fc16ddf81e09f4a40f9860556b5c32f0bfd25bba75903b26`。V4、V5 与诊断 JSON 均可重新解析，报告中的版本判据、大小、哈希、测试和门禁结论与实物一致；`git diff --check` 通过，案例产物受既有 ignore 规则保留。Phase 100 complete，等待用户审阅，不启动第 27 例。

### Phase 101：clothing 第 27 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `12193536` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据定版；仅对未命中 V5 权威信号的 V4 候选下载最新完整 JSON 并扫描事件 AST/V4 结构
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断；V5 案例正确跳过
- [x] 按案例实际路径完成审计：转换案例审计结构和运行，V5 跳过案例审计版本证据与产物边界
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 26 例人工审阅门禁解除。本轮只处理第 27/51 例 `快递公司配置前端_12193536_吴坤.json`；保留全部历史案例，不删除已有数据，不自动启动第 28 例。数据库查询必须包含 `extra.ver`，下载后的 JSON schema 是最终版本依据。

**数据库定版：** 参数化只读查询唯一命中 nid `12193536`：`extra.ver=2` 是 V5 权威信号，且 `ntype=92`、`verDetail=5.1`，因此明确为 V5.1；两表 `edt_ver=4.1` 只是 V5 常见残留，不能覆盖权威信号。当前版本 2、`work_id=d8efq2jc1t2c73d87jk0-1`，标题 `App`、作者吴坤、uid/eid/gid `10000589/10000586/25391`、短链 `ticrJ8CY`，data/node 均已发布和上架。本例不进入 V4 下载与转换链路。

**最终复核：** 跳过报告已生成至 `localCases/v5/clothing/快递公司配置前端_12193536_吴坤/conversion-report.md`，2,146 bytes、SHA-256 `3e4fa923ea6f7eaf184f60a1b4ce4858c2f7776c4d93a231810e13b7c8bd1520`。V4 目录不存在，V5 目录只有报告，没有 app.v5 或诊断文件，符合原生 V5.1 不进入转换器的边界；报告受既有 `.gitignore` 规则保留，`git diff --check` 通过。Phase 101 complete，等待人工审阅，不启动第 28 例。

### Phase 102：clothing 第 28 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `12193535` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据定版；仅对未命中 V5 权威信号的 V4 候选下载最新完整 JSON 并扫描事件 AST/V4 结构
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断；V5 案例正确跳过
- [x] 按案例实际路径审计转换结果或版本证据与产物边界
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 27 例人工审阅门禁解除。本轮只处理第 28/51 例 `快递公司配置后端_12193535_吴坤.json`；保留全部历史案例，不删除已有数据，不自动启动第 29 例。

**数据库定版：** 参数化只读查询唯一命中 nid `12193535`：`extra.ver=2`、`ntype=91`、`verDetail=5.1`，明确为 V5.1；data/node `edt_ver=4.1` 仅是残留辅助字段。当前版本 2、`work_id=d8efq23c1t2c73d87jj0-26`，标题 `Services`、作者吴坤、uid/eid/gid `10000589/10000586/25391`、短链 `d6hu5r5l`，data/node 均已发布和上架。本例与第 27 例形成 ntype 91/92 的 V5.1 后端/前端配对，不进入 V4 下载和转换链路。

**最终复核：** 跳过报告已生成至 `localCases/v5/clothing/快递公司配置后端_12193535_吴坤/conversion-report.md`，2,441 bytes、SHA-256 `e5d966113d3cec62311a865ffe5199419c2a1c7236e41f2b9614df2b4ffcf76d`。V4 目录不存在，V5 目录只有报告，没有 app.v5 或诊断文件；ignore 命中且 `git diff --check` 通过。Phase 102 complete，等待人工审阅，不启动第 29 例。

### Phase 103：clothing 第 29 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `11430800` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 28 例人工审阅门禁解除。本轮只处理第 29/51 例 `技术配料单_11430800_温晓华.json`；保留全部历史案例，不删除已有数据，不自动启动第 30 例。

**数据库初筛：** 参数化只读查询唯一命中 nid `11430800`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，初筛为 V4.1 候选；`ntype=1`、版本 86、最新 `work_id=cm4hncb1bru52ab7c4l0-277`。数据库标题 `FRP_技术配料单`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `yGrtmbkK`，data/node 均已发布和上架。文件名作者温晓华与数据库当前作者不同，报告分别记录；最终版本须下载后按 JSON schema 复核。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、768,700-byte 二进制；2 段解压为 8,192,629 / 1,197,975 bytes，生成 9,390,624-byte 紧凑 JSON，SHA-256 `ce14b746c1a6612e9cfed444807a86cce3263e74c9ee6bc8f177de292bc112b9`。三根 ID 为 case `cp4hqfna3j500005q4yg`、server `cp4hqfna3j500005q4y0`、stage `cp4hqfna3j500005q4xg`，类型正确；结构扫描 eventAst 0、eventTree 734、Formula 6,412，且 ast/op/ln/cType 全为 0，最终确认是 V4.1，可进入转换器。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 7,117,483-byte V5，SHA-256 `99131547e290f89476ce5e49df5dc3f8c276d18c9d3ddbfb8fbefdc310c2bfa6`；case/server/stage 三根 ID/type 保持一致，`server.props.v2=1`。诊断 JSON 155,732 bytes、Markdown 59,089 bytes，共 239 条，全部为 customExpr fallback、dropped 0、去重后 238 条；主要为 `||` 73、`&&` 47、正则 37、full-JS 19、TemplateLiteral 19、callee 11、SpreadElement 6、unknown varType 6 等。fallback 日志只表示结构化公式降级为 jsfn，需继续审计语法、参数与运行语义，不能直接定性为错误。

**结构审计：** V4/V5 组件均为 3,163 个、唯一 ID 3,155 个，ID/type 多重集完全一致；734/734 个事件和 3,654/3,654 个 action 全部闭合。133 个禁用动作都保留 skip，额外 3 个启用 skip 均是 infinite=true 的 data-animate.play。238 个 jsfn（138 种代码）语法、val/args 参数数、自由 `$` 和旧占位符检查均通过；244 个非空 `_code` 全部可编译。314 个 data-if 中仅 4 个无 AST，源 condition 原本均为 null 且空兼容 bind 转为 `{op:'val'}`。121/121 个服务调用 target 一致，41/41 个本地服务事件 AST/_code 完整，9/9 个共享服务完全一致；1 个 uploadPic 与 3 个回调 action BID 均保留。55 次/26 个唯一悬空 var ref 的目标在源组件/事件块集合中也不存在，且每个 ID 均能在源文本回证，属于源陈旧引用。493 个 cType 全为有效 String/JsonVal/boolean/JsonArr；后台 41/41 事件 AST/_code 完整。待完成代表运行和项目测试后最终定性。

**运行与测试结论：** 校正一次错误的 flatMap 测试夹具后，21/21 组高风险 jsfn 代表运行通过；项目完整测试 79/79、fail 0。结合全部结构、参数、服务、引用、后台与运行审计，本例未发现转换器错误。进入报告哈希和最终产物复核。

**最终复核：** 单例报告已生成至 `localCases/v5/clothing/技术配料单_11430800_温晓华/conversion-report.md`，4,489 bytes、SHA-256 `56893e5d009b336c355cdf5b8009c5d646a74e5877ed727067bad6f543a5efd1`。V4、V5 与诊断 JSON 均可重新解析，大小与哈希一致；V4 app.json 权限为 0600，案例产物均受既有 ignore 规则保留，`git diff --check` 通过。Phase 103 complete，等待人工审阅，不启动第 30 例。

### Phase 104：clothing 第 30 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `11283115` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 29 例人工审阅门禁解除。本轮只处理第 30/51 例 `排产规则_11283115_温晓华.json`；保留全部历史案例，不删除已有数据，不自动启动第 31 例。

**查询准备错误：** 首次向此前可用的清华 PyPI 镜像安装隔离 PyMySQL 时，镜像本次返回 `No matching distribution found`，数据库查询尚未发起、案例目录没有变化。下一步不重复该镜像请求，改查本机 pip 缓存及残留模块；若可用则离线安装或直接复用。

**数据库初筛：** 本机无缓存或残留 PyMySQL，改用默认 PyPI 安装隔离客户端后参数化查询唯一命中 nid `11283115`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，初筛为 V4.1 候选；ntype 1、版本 60、最新 `work_id=cibq2rfl557ut9e0du4g-335`。数据库标题 `APS排产规则`、当前作者邵伟明、uid/eid/gid `10179057/10000586/25391`、短链 `ooKF0uzm`，data/node 均已发布和上架。文件名作者温晓华与数据库当前作者不同，报告分别记录；最终版本须按下载 JSON 结构复核。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、300,204-byte 二进制；2 段解压为 3,535,794 / 55,999 bytes，生成 3,591,813-byte 紧凑 JSON，SHA-256 `80af7831326a4cf2912f9635f1b43e553a8ed979a1c1a2b2819cdd9ef7f6a840`。三根 ID 为 case `cjbt2vba3j50000etep0`、server `cjbt2vba3j50000eteng`、stage `cjbt2vba3j50000eten0`，类型正确；结构扫描 eventAst 0、eventTree 260、Formula 3,401，且 ast/op/ln/cType 全为 0，最终确认是 V4.1，可进入转换器。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 2,292,275-byte V5，SHA-256 `be2d9ad22cb3de23e313c16ebc84769e8e35d9ef2336347dbaf90cb361bab6f2`；三根 ID/type 一致，`server.props.v2=1`。诊断 JSON 78,206 bytes、Markdown 27,869 bytes，共 114 条、去重 113，全部为 customExpr fallback、dropped 0；主要为 `||` 69、`&&` 21、toString 10、callee 6、findIndex 4，另有 in、TemplateLiteral 和 2 条解析兜底。需继续审计所有 jsfn 与结构，不能把 fallback 日志直接当作转换错误。

**结构审计：** V4/V5 组件均为 1,000 个、唯一 ID 998 个，ID/type 多重集完全一致；260/260 个事件和 1,379/1,379 个 action 全部闭合。66 个禁用动作均保留 skip，没有额外启用动作被 skip。114 个 jsfn（65 种代码）语法与 val/args 参数数均通过，80 个非空 `_code` 全部可编译；初筛把字符串常量 `'$any'` 误报为自由变量，改用 Acorn AST 标识符级检查后真实自由 `$` 为 0，旧占位符残留也为 0。84/84 个 data-if 全有 AST；42/42 个服务调用 target 一致，2/2 个本地服务事件 AST/_code 完整，28/28 个共享服务完全一致；本例无上传动作。3,545 个受检 var/item/index ref 均有目标，63 个 cType 全为有效 String/JsonVal/boolean；后台 2/2 事件 AST/_code 完整。待代表运行与项目测试后最终定性。

**`findIndex` 语义追溯：** 4 个 `findIndex` fallback 中，3 个源公式把 `!= -1` 放在 `findIndex(...)` 外，V5 均正确生成 `$v1.findIndex((x) => x == $v2) != -1`。唯一可疑输出 `$v1.findIndex((x) => x == $v2 != -1)` 对应 V4 原始 `code` 和 `str` 本身就把 `!= -1` 放在回调内部；落点为组件 `ccbgmrba3j50000y9ea0`（ih5-layoutrow/选项）、动作 BID `ccc4dh6a3j50000bk9t0`。因此这是源 V4 公式的既有括号/语义问题，转换器忠实保留，并非本轮转换新增错误；报告需单独提示，不能修正源业务表达式。

**代表运行：** 25/25 组规范 jsfn 实际执行通过，覆盖逻辑优先级/三元式、权限链、数组/对象、filter、toString、正则截取、二元 `in`、模板字符串、computed assignment、undefined、map 与正常 `findIndex` 命中/未命中。异常源 `findIndex` 另以命中和未命中两组输入比较 V4 等价表达式与 V5 输出，二者都返回索引 0，证明转换语义等价，同时也确认源式本身会把非命中误判为首项命中。下一步运行项目完整测试并生成报告。

**项目回归：** `npm test` 79/79 通过、fail 0；控制台 ParseError 均来自刻意覆盖 fallback/修复路径的既有测试，测试断言全部成功。结合结构审计与运行结果，本例未发现转换器新增错误；需在成功报告中明确提示那条 V4 源公式问题。

**最终复核：** 单例报告已生成至 `localCases/v5/clothing/排产规则_11283115_温晓华/conversion-report.md`，4,967 bytes、SHA-256 `1ef387d05d0a9064f92f42c170514e625098e663a8f49c80bae10f56d7d3a63e`。V4、V5 与诊断 JSON 均可重新解析，全部大小与哈希一致；V4 `app.json` 权限为 0600，案例产物受既有 ignore 规则保留，`git diff --check` 通过。Phase 104 complete，等待人工审阅，不启动第 31 例。

### Phase 105：clothing 第 31 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `11283121` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 30 例人工审阅门禁解除。本轮只处理第 31/51 例 `排程池_11283121_叶育科.json`；保留全部历史案例，不删除已有数据，不自动启动第 32 例。

**前置记录纠正：** 启动时沿用了错误的预记文件名 `排程池_11280677_温晓华.json`；实际按 `LC_ALL=C` 排序核对源目录后，第 31 例明确为 `排程池_11283121_叶育科.json`，前后分别是第 30 例排产规则和第 32 例新裁剪任务单。错误预记对应的源文件不存在，数据库查询和目标目录写入均未发生；本阶段已在首项操作前改用真实 nid `11283121`。

**查询准备：** 真实源文件和相邻排序已核准，V4/V5 目标目录均不存在；平台 Cookie 与只读数据库 env 权限均为 0600，`127.0.0.1:13306` 隧道由既有 SSH 进程正常监听。本机没有 mysql CLI 或系统 PyMySQL；权威导出文档确认查询表/连接方式。下一步使用隔离临时 PyMySQL 客户端执行参数化 SELECT，并在旧字段集上补查 `extra.ver`。

**数据库初筛：** 默认 PyPI 隔离安装 PyMySQL 成功，参数化只读查询唯一命中 nid `11283121`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 580、最新 `work_id=cibq4ofl557ut9e0du70-338`。数据库标题 `APS排程池`、当前作者叶育科、uid/eid/gid `10187685/10000586/25391`、短链 `MkZzqib0`，data/node 均已发布和上架。文件名作者与数据库作者一致；最终仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、4,680,948-byte 二进制；2 段解压为 56,079,920 / 5,131,398 bytes，生成 61,211,338-byte 紧凑 JSON，SHA-256 `715ad6c1af7068f64a71c8eddeebaa4600942b867fc42a24a51ea8f9a768839b`。三根 ID 为 case `cjbt4rba3j50000e4j50`、server `cjbt4rba3j50000e4j4g`、stage `cjbt4rba3j50000e4j40`，类型正确；结构扫描 eventAst 0、eventTree 2,532、Formula 25,153，且 ast/op/ln/cType 全为 0，最终确认是 V4.1，可进入转换器。V4 已以 0600 保存，历史案例未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 48,331,941-byte V5，SHA-256 `5fba07c0d81f8cc6b1fdb1f0e9a89f10010ab9e95d2315da1d7a2522feee232a`；case/server/stage 三根 ID/type 一致，`server.props.v2=1`。诊断 JSON 848,484 bytes、Markdown 308,407 bytes，共 1,310 条、去重 1,284，全部为 customExpr fallback、dropped 0；主要为 `||` 435、TemplateLiteral 295、`&&` 196、findIndex 98、SpreadElement 45、flat 41、full-JS 40、正则 40、unknown varType 21、sortAndUniqueData 20、NewExpression 16。需审计最终 jsfn 与结构，不能把大量 fallback 日志直接当作转换失败。

**审计入口校准：** V4 事件为 `events.list[*].tree`，action 为 tree 内 `type=action` 且带 BID；V5 事件为 `events.list[*].ast`，动作回映使用 AST `ln`。组件口径继续沿三根的 `children/classes` 遍历，避免把公式 token 的 `type` 计作组件。当前实物有 105 个 `data-service`、1 个 V4 `uploadPic`，V5 对应上传 method 存在；data-if 已从 V4 condition 数组与兼容 `binds.value` 转为 V5 `props.conditionVal.ast` 且不保留 value bind。后续使用单遍索引闭合组件、动作、服务、上传、引用和 jsfn。

**首轮结构审计：** 组件 10,142/10,142、唯一 ID 10,119/10,119，ID/type 多重集无差异；事件 2,532/2,532 且 eventId 全闭合，V5 缺 AST 0；V4 event block 19,015、action 11,156，所有 action BID 均命中 V5 `ln`。421 个禁用动作全部带 skip；另有 2 个启用 `play` 被 skip，需回证 infinite 动画规则。1,274 个 jsfn（656 种代码）语法、val/args 和自由 `$` 均通过，旧 `$SF_/$refs/$sys`、fParam、当前路径及 `[object Object]` 残留 0；1,019 个非空 `_code` 全部可编译。664/664 个 data-if 中 5 个无 AST 且仍有兼容 value bind，源样本显示 condition 为空、bind 为空，需逐项确认。251/251 个服务调用 target 无差异，1 个上传主 action 已回映。25 个唯一悬空 ref、server classes 23 个非逐字相等以及自由函数名型 jsfn 需继续回证，暂不定性。

**结构例外回证：** 2 个额外 skip 的目标都是 `data-animate` 且 `props.infinite=true`，符合既有防永久等待规则。5 个无 AST data-if 的源 `props.condition=null`、无 `conditionVal`，兼容 bind 都是 `{_code:'',code:''}`；V5 统一保留 `binds.value={op:'val'}`，与已发布的空条件兼容修复一致。33 次/25 个唯一悬空 ref 在 V4/V5 全对象 id/bid/eventId 索引中都没有目标，但每个 ID 均在 V4 原文出现，属于源陈旧引用。105 个 data-service 分为 server.children 8、server.classes 97，共 105/105 个后台事件，AST/_code 缺失均为 0；23 个 server module 的 ID/type、内部组件数和事件数逐项一致。uploadPic 主动作、uploaded status 与全部子 action BID 均已回映。剩余高风险是 10 类非标准自由标识符 jsfn：`productionOrder`、`numberPrecision`、`processPackageMaterials_*`、`sortAndUniqueData`、`isToShow`、`formatData`、`checkMember`、`getElementHeight`；需先核对 initJs/外层 callback 作用域再定性。

**自由标识符回证：** `numberPrecision`、`sortAndUniqueData`、`processPackageMaterials_1/2/_item`、`isToShow`、`formatData`、`checkMember`、`getElementHeight` 均由案例内 `data-func.props.code` 定义并显式挂到 `window`，不是漏传的 jsfn 参数；需再确认对应 data-func 代码在 V5 原样保留。唯一的 `productionOrder.scheduleStatus...` 零参数 jsfn 来自 BID `d3az4q2a3j50000b0jbg` 的 V4 原公式，token 全是普通 str、没有 loop/item 契约，而且该 action 本来 `enable=false`，V5 对应动作已按禁用规则 skip；这是源中失效且不会执行的残留公式，不是转换新增作用域丢失。

**全局函数与高风险选样：** V4/V5 均有 130 个 data-func，逐 ID 的 `props.code` 差异为 0；上述 9 个 helper 均能在 V5 同一 data-func 中找到 `window.<name>` 赋值，`productionOrder` 对应 V5 `ln` 明确 `skip=true`。656 种唯一 jsfn 已按语言族建立代表候选，覆盖逻辑/模板、findIndex、spread/flat、块体回调、正则、NewExpression、optional、hasOwnProperty、赋值/逗号表达式、全局 helper、toString 与 Array.from。13 个 Unexpected `=`、5 个 Expected comma 和除法 receiver/callee 诊断的最终代码均语法有效，需在代表运行中覆盖 mutation/reduce/forEach/toFixed 等语义。

**代表运行夹具错误：** 首次启动 29 组运行测试时，在任何 jsfn 执行前加载全局 helper 失败：用字符串前缀匹配 `window.processPackageMaterials_1` 时误把后出现的 `window.processPackageMaterials_1_item` 定义覆盖到同一槽位，随后检测不到前者。该错误只在临时测试夹具中，未修改案例或转换器。下一次改用带赋值符号边界的精确正则选择 helper，不能重复前缀匹配。

**代表运行结果：** 使用 `window.<完整名称>\s*=` 精确加载原案例 data-func 后，29/29 组 jsfn 实际执行通过。覆盖逻辑/可选链、模板字符串、findIndex、spread/flat、块体 map 与 mutation、Set/正则、Date、hasOwnProperty、reduce/map/forEach 赋值、除法 receiver/toFixed、Array.from、numberPrecision、sortAndUniqueData、processPackageMaterials、formatData、checkMember、复杂对象映射和 toString。首轮夹具错误已消除且没有产物失败；下一步运行项目完整测试。

**项目回归与定性：** `npm test` 79/79 通过、fail 0；控制台 ParseError 均来自既有 fallback/修复路径测试，断言全部成功。综合组件、事件、动作、jsfn、data-if、服务、模块、上传、引用、后台 cType/data-func 与代表运行审计，本例未发现转换器错误。源问题仅包括 25 个陈旧引用目标和 1 条位于禁用 action 的无上下文 `productionOrder` 公式；需在成功报告中单列说明。

**最终复核：** 成功报告 6,320 bytes、SHA-256 `0a0d0c4170be1d76d7f54edd253e66660cdc75a290463b60d3d8eac25fb8f4b5`。V4、V5 与 `app.convert-errors.json` 均可重新解析，五份主要产物大小和摘要与报告一致；来源 README 1,282 bytes、SHA-256 `964ee0632ff6a50ca3f65e5707aca041893c349bd05116a39fb162737daaa2e3`。V4 主文件保持 0600，产物全部命中 `localCases/*` 忽略规则，`git diff --check` 通过。第 32 例的 V4/V5 目录均不存在，保持人工审阅门禁。

### Phase 106：clothing 第 32 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `12181966` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 31 例人工审阅门禁解除。本轮只处理第 32/51 例候选 `新裁剪任务单_12181966_吴坤.json`；先按真实源排序复核文件名与 nid，保留全部历史案例，不删除已有数据，不自动启动第 33 例。

**前置检查：** 真实源目录排序已确认第 32 例正是 `新裁剪任务单_12181966_吴坤.json`（nid `12181966`），前后分别为第 31 例排程池和第 33 例智能样板打板；V4/V5 目标目录均不存在。平台 Cookie 与只读数据库 env 权限均为 0600，既有 SSH 进程继续监听 `127.0.0.1:13306`。本机没有系统 PyMySQL，下一步复用或新建隔离客户端执行参数化只读查询。

**版本结论与跳过边界：** 隔离 PyMySQL 安装成功，参数化只读查询唯一命中 nid `12181966`：`extra.ver=2`、`ntype=92`、`verDetail=5.1`，权威定版为 V5.1 前端案例；data/node `edt_ver=4.1` 只是 V5 中的残留字段，不能覆盖该结论。版本 3、最新 `work_id=d86jg0rc1t2c739gp5ng-2`，标题 `CuttingTaskApp`、作者吴坤、uid/eid/gid `10000589/10000586/25391`、短链 `3zIAjCBH`，data/node 均已发布和上架。按 V4→V5 测试范围，本例不调用 `/work/load`、不保存伪 V4、不运行转换器，也不存在转换产物审计；只生成版本跳过报告。

**最终复核：** 跳过报告 2,162 bytes、SHA-256 `4c29be2d85c48f167ab944ef86ce430f7b2af3a09d4467fa2f18fec122d43882`，内容与数据库结果一致并命中 `localCases/*` 忽略规则。V4 目录不存在，V5 目录仅包含 `conversion-report.md`；`git diff --check` 通过。第 33 例的 V4/V5 目录均不存在，保持人工审阅门禁。

### Phase 107：clothing 第 33 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对源排序并参数化只读查询 nid `11285959` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 32 例人工审阅门禁解除。本轮只处理第 33/51 例候选 `智能样板打板_11285959_吴坤.json`；先按真实源排序复核文件名与 nid，保留全部历史案例，不删除已有数据，不自动启动第 34 例。

**前置检查：** 真实源目录排序已确认第 33 例正是 `智能样板打板_11285959_吴坤.json`（nid `11285959`），前后分别为第 32 例新裁剪任务单和第 34 例标准尺码类库；V4/V5 目标目录均不存在。平台 Cookie 与只读数据库 env 权限均为 0600，既有 SSH 进程继续监听 `127.0.0.1:13306`。没有可复用的第 32 例临时 PyMySQL 目录，下一步新建隔离客户端执行参数化只读查询。

**数据库初筛：** 隔离 PyMySQL 安装成功，参数化只读查询唯一命中 nid `11285959`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 121、最新 `work_id=cidu9oqso14ne2fsroh0-199`。数据库标题 `FRP_智能样板打板审批`、当前作者刘土明、uid/eid/gid `10012130/10000586/25391`、短链 `CuiOieCk`，data/node 均已发布和上架。源文件名作者吴坤与数据库当前作者不同，后续分别记录；最终仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载准备：** 权威导出文档与 VxEditor41 依赖已复核，`sjcl` 和 `pako/lib/inflate` 均可解析；继续使用 PBKDF2/AES-GCM、分段长度和 inflateRaw 的只读 `/work/load` 解码链路。在内存完成 HTTP 类型、分段、JSON 与三根校验后，只有实物确认 V4 才写入 `localCases/v4/clothing`。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、641,928-byte 二进制；2 段压缩长度 615,856 / 26,027 bytes，解压为 7,258,917 / 259,406 bytes，生成 7,518,343-byte 紧凑 JSON，SHA-256 `71bcfebeaf7eed47d24437cf555b4d4e8f571ce599623266008c5cd67fe0ba5a`。三根 ID 为 case `cjdy9rza3j500000xh90`、server `cjdy9rza3j500000xh8g`、stage `cjdy9rza3j500000xh80`，类型正确；结构扫描 eventAst 0、eventTree 485、Formula 4,545，且 ast/op/ln/cType 全为 0，最终确认是 V4.1。V4 已以 0600 保存，来源 README 记录作者差异和下载信息，历史案例未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 5,350,390-byte V5，SHA-256 `e0eb44c12ced36cd87fec818518ce82aaf80c1e951da20dc06a27e7b59ab3fb5`；case/server/stage 三根 ID/type 一致，`server.props.v2=1`。诊断 JSON 213,679 bytes、Markdown 78,857 bytes，共 318 条、去重 317，全部由 customExpr/jsfn 兜底，空值降级 0；需审计最终 AST 和运行语义，不能把控制台 ParseError 直接当作转换失败。

**诊断汇总夹具错误：** 首次自行聚合诊断类别时使用普通对象作为计数器，类别键 `toString` 命中 Object 原型方法并被拼接成异常字符串；这只影响临时摘要显示，不影响诊断文件或 V5。下一次改用 `Map` 或诊断自带 `byCategory`，不重复普通对象键冲突。

**首轮结构审计与已确认错误：** 组件 2,244/2,244、事件 485/485、动作 3,339/3,339 全部闭合；106 个禁用动作全部 skip，3 个额外 skip 均已回证为 infinite 动画。318 个 jsfn 语法和参数对齐均通过，但其中 4 个活跃 jsfn 仍残留 V4 方法 `$SF_arr_search`：两处组件绑定、两处启用 `setValue` 动作。四段代码在普通数组输入下均抛 `TypeError: $v2.$SF_arr_search is not a function`，因此这是转换器错误，不是仅有 fallback 日志或禁用源残留。其余初审：237 个 `_code` 语法通过；114/114 data-if 均有 AST；43/43 服务调用、33 个本地服务、18 个共享服务闭合；无上传；9 个唯一悬空 ref 均为源已有陈旧引用；494 个 cType 合法；41 个 data-func 代码一致；5 个 server module 摘要一致。仍需核准 `$SF_arr_search` 的正确 V5 映射并对其余 314 个 jsfn 做代表运行，之后生成失败报告等待用户是否修复。

**错误语义与实现缺口：** VxEditor41-widgets 的 V4 `arr_search(value,target)` 会对空值先降级为空数组，再用 `findIndex(item => target === item)` 返回下标；编辑器元数据也明确把 `$SF_arr_search` 定义为数组“搜索值”、返回数字。当前 full-JS fallback 只专门折叠 `$SF_getSelf()` 并归一化旧 Math 标识符，遍历包含 callback 局部变量的子树时没有归一化 `$SF_arr_search`，因此把 V4 原型方法名原样打印进 jsfn。修复时应在 ESTree 层通用转换该方法并保留空数组降级/严格相等/返回下标语义，不能按本例代码文本或节点 ID 特判；本阶段只诊断，不修改代码。

**代表运行夹具错误：** 首次构造其余 jsfn 的 24 组代表测试时，`array-from-set` 测试调用多写了一个数组右括号，Node 在解析测试脚本阶段报 `SyntaxError: missing ) after argument list`；任何 jsfn 都未执行，案例与转换器未修改。下一次只校正该实参数组括号并重新运行完整 24 组，不重复错误脚本。

**代表运行首轮：** 校正语法后的实际测试共有 23 组，20 组直接通过；3 个失败均为夹具问题：正则 value 用模糊子串误选了同前缀的 `.index` 代码，对象 spread 用字段名误选到另一条表达式，动态键 map 的 `$v2` 少包一层按 `$v4` 取组的数组。下一次分别使用精确 code 条件、对象字面量起始边界和双层分组输入只复测这三项；不能把当前 20/23 记为产物新增错误。

**代表运行与项目回归：** 三项夹具校正后均通过，因此排除已确认的 4 个 `$SF_arr_search` 错误位置后，23/23 组高风险代表 jsfn 执行通过，覆盖模板、正则、findIndex、flatMap、spread、Set/Array.from、New Array、对象合并、块体 mutation/reduce、可选链、动态键和 toString。项目完整测试 79/79、fail 0；控制台 ParseError 是既有 fallback 测试预期路径。现有测试没有覆盖 full-JS callback 中 `$SF_arr_search` 的归一化，故测试全绿不否定真实案例的 4 处运行时错误。本例最终定性为“V5 产物已生成，但审计失败，发现 1 类转换器错误影响 4 处”；下一步生成失败报告，等待用户是否修复。

**最终复核：** 失败报告 6,391 bytes、SHA-256 `7fcbf4849683fea7b4fe7b1020143b9245666ee48e2892a8b6e4ba4697801380`。V4、V5 与 `app.convert-errors.json` 均可重新解析，五份主要产物大小和摘要与报告一致；来源 README 1,339 bytes、SHA-256 `4b1e33e10d01ba63cc72a3ac423243930ffbcae518e42df0fff82490ce9d87cb`。V4 主文件保持 0600，产物全部命中 `localCases/*` 忽略规则，`git diff --check` 通过。转换器未修改、未提交或部署，第 34 例的 V4/V5 目录均不存在。

### Phase 108：修复 V4 `$SF_arr_search` 在 jsfn 中残留并发布（2026-08-07）

- [x] 为 JSEP custom-expression 与 full-JS callback 两条兜底路径补充失败回归，覆盖空 receiver、严格相等和单次求值语义
- [x] 在共用 ESTree 归一化层将 V4 receiver 方法 `$SF_arr_search(target)` 转换为等价 V5 JavaScript
- [x] 运行定向及完整测试，重转第 33 例并复核全部真实公式及全案例结构
- [x] 更新第 33 例报告和规划记录，仅提交并推送本次 tov5parser 相关变更
- [x] 发布生产 Lambda、完成 prod 冒烟并记录版本与代码摘要
- [x] 同步 VxEditor41 转换器，完成定向检查/构建后仅提交推送同步文件

**Status:** complete

**授权与范围：** 用户明确要求“修复”。本阶段只修复第 33 例确认的通用 `$SF_arr_search` 转换缺口，不启动第 34 例。实现必须基于 V4 widgets 的权威语义（空值降级为空数组、严格相等、返回 findIndex 下标），不得按案例 ID 或公式文本特判。按照项目 `AGENT.md`/`CLAUDE.md` 中用户既有固定授权，验证通过后自动完成双仓提交推送与 Lambda 生产发布；受保护的未跟踪文档不读取、不修改、不暂存。

**失败回归基线：** 已新增 JSEP custom-expression callback 与 full-JS IIFE 两条回归。修复前定向测试 32 项中 30 通过、2 项按预期失败；两项实际输出都仍含 `$SF_arr_search`，分别复现第 33 例的回调残留和副作用表达式运行缺口。现有其余用例未回退。

**实现与回归：** 共用归一化会把 receiver 方法改写为局部 IIFE：receiver/target 各求值一次，按 `value && value.length ? value : []` 选择数组，再执行 `findIndex(item => target === item)`；额外实参仍会求值。生成参数名会扫描原 AST 后避碰，JSEP 打印器也补齐箭头 callee 括号和 LogicalExpression 输出。真实重转又发现一处同公式伴随残留的 `$SF_objArr_item`，已按 widgets 权威实现补齐，并采用“array search 在结构化试探前、其余方法在参数化后只处理残留”的两阶段归一化，避免改写本来可生成 sysutil 的普通调用。项目完整测试最终为 83/83 通过；控制台 ParseError 均为既有预期 fallback 路径。

**真实案例复核：** 重转后的 V5 为 5,351,804 bytes、SHA-256 `a9cfdad9669535dc097fe5eaee3d6d759383f09ae75a0b1f12c0c0d231b03372`；诊断仍为 318 条/去重 317/dropped 0，两个诊断文件摘要不变。上一轮漏计一个 `ih5-text` 活跃绑定，故实际 `$SF_arr_search` 落点为 5 个而非 4 个；当前 5/5 均已运行通过，其中组合公式的 `$SF_objArr_item` 也已消除，318 个 jsfn 中旧 `$SF_*` 残留为 0。全案仍为组件 2,244/2,244、事件 485/485、动作 3,339 全部回映、禁用 skip 106/106、额外 infinite 动画 skip 3、data-if 114/114、服务 target 43/43、data-service 33/33、data-func 41/41、cType 494 且非法 0；jsfn 语法/arity 与 237 个 `_code` 语法错误均为 0。

**报告更新：** 第 33 例报告已由失败结论改为转换成功，纠正落点数并记录实现、运行与结构证据；报告 7,342 bytes、SHA-256 `940545ccec72fd195be3b83893b957afb58731c3770c2bc0f2ae22f0e96ba7e1`。第 34 例仍未启动。

**发布结果：** tov5parser 修复提交 `af1fd41ec97b00ff9dfc2a681b5e44ed0d59ddc8` 已推送 `main`；生产 Lambda 发布版本 `25`，`prod` 别名与冒烟执行版本均为 25，CodeSha256 `H4NEleBxf77vWZIx/aVnGhRWHLhJ+HkHr4qdTaRGDEQ=`；VxEditor41 同步提交 `5a4847084e6c818e9b18893a74da802765e55eee` 已推送 `master`，完整生产构建成功（仅仓库既有告警），两个转换文件定向 ESLint 零告警。双仓库远程均与本地提交同步；受保护文档和 VxEditor41 用户原有修改均未纳入提交。

**后续结构化可行性复核：** V5 AST 可以表达本例的 `arr_search` sysutil，并能把 `i.styleId` 作为 `lambda` 的 local ref 传入；本例现有 V5 中已有 24 个结构化 `arr_search`，包含同类 lambda-local 参数。只读内存原型为 `&&/||` 开启 `and/or` 转换、并将安全子集的原生 `.filter` 识别为 `arr_filter` 后，完整公式成功生成 `switchexp → and → arr_filter → lambda → arr_search`，不再产生 jsfn。首轮原型误改 prototype，但转换器这些处理器是实例字段，故仍走旧 fallback；改为只在临时实例上覆盖后验证成功，未修改项目文件。若正式采用，需要补充原生数组方法的安全边界与全量回归，不能只把当前 jsfn 中的 IIFE 文本替换为 `$sys.util`。

### Phase 109：将安全原生 `.filter` 与逻辑表达式结构化为 V5 sysutil 并发布（2026-08-07）

- [x] 用真实公式与内存原型确认 `arr_filter → lambda → arr_search` 的 V5 AST 可行性及安全边界
- [x] 补充结构化回归与不安全调用 fallback 回归，覆盖 `&&/||`、局部参数和运行语义
- [x] 实现安全原生 `.filter` 映射及逻辑运算结构化，保留复杂 JavaScript 的 jsfn fallback
- [x] 运行定向/完整测试，重转第 33 例并复核目标公式与全案例结构
- [x] 更新报告和规划记录，仅提交并推送本次 tov5parser 相关变更
- [x] 发布生产 Lambda、完成 prod 冒烟并记录版本与代码摘要
- [x] 同步 VxEditor41 转换器，完成定向检查/构建后仅提交推送同步文件

**Status:** complete

**授权与范围：** 用户明确要求“修改”。本阶段只把已核准的安全原生 `.filter(callback)` 子集与 `&&/||` 转为 V5 结构 AST，使第 33 例目标公式使用 `arr_filter`、`lambda` 和 `arr_search`；带额外实参、第三个 callback 参数、块体或其他不受支持语法继续进入既有 jsfn fallback。不得按案例 ID 或公式文本特判，不启动第 34 例。验证通过后按项目固定流程自动完成双仓提交推送与 Lambda 生产发布；受保护的未跟踪文档不读取、不修改、不暂存。

**实现与真实复核：** 运行时映射会把本例对象数组上的普通 `.filter` 解析为 `objArr_filter`，因此实现保留类型映射结果，只新增严格调用形态校验；逻辑运算直接复用既有 `genConditonValAST` 生成 `and/or`。项目测试 85/85 通过。第 33 例重转后 V5 为 5,374,350 bytes、SHA-256 `660e8ff18d7a2c5aa9135e987eec250eb0984a129ad9f1f6ab63223ed7eed2ba`；诊断 180/去重 179/dropped 0，较上一产物减少 138 条。目标 `ckp3kzqa3j500001xvf0.binds.height` 已成为 `switchexp → and → objArr_filter → lambda → arr_search`，jsfn/IIFE 为 0，search local 精确命中 filter 自己的 `item_<blockId>`。5 个原始落点中 3 个结构化，另 2 个因后续块体 map mutation 保留已验证 fallback；180 个 jsfn 的语法、arity 和旧 `$SF_*` 残留错误均为 0。组件 2,244、事件 485、动作 3,339、data-if 114、服务与 data-func 等结构审计继续闭合。更新报告 8,159 bytes、SHA-256 `d6608834cfb704e3359411821012e59956d98078168f16739c13f470e8417e77`。

**发布结果：** tov5parser 代码/测试/规划提交 `c4d2077df8def5300d7f274dfd96aa732ae5dbfe` 已推送 `main`。部署脚本再次通过 85/85 测试；生产 `prod` 最终指向版本 27，状态 Active/Successful，CodeSha256 `8M8z4mLkGRMJPeu1vUYgG3Os72HI1YGOx89NvoKCGV8=`，独立冒烟实际执行版本 27、HTTP 200、业务 `code=0`。VxEditor41 只同步公式转换器文件，定向 ESLint 0 告警，生产构建退出 0（33 条仓库既有告警）；提交 `3fec57866db51d1fe9973e521d9ef6df123a3f74` 已推送 `master`，远程差异 0/0。两仓用户无关修改和受保护文档均未纳入提交，第 34 例未启动。

### Phase 110：clothing 第 34 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对真实源排序、文件名 nid、相邻案例与目标目录状态
- [x] 参数化只读查询 nid `11294217` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 33 例人工审阅门禁解除。本轮只处理第 34/51 例 `标准尺码类库_11294217_温晓华.json`（nid `11294217`）；真实排序前后分别为第 33 例智能样板打板和第 35 例样板库。V4/V5 目标目录均不存在。保留全部历史案例，不删除已有数据，不自动启动第 35 例。

**数据库初筛：** 两份只读凭据权限均为 0600；上轮 SSH 隧道已自然退出，按交接脚本恢复后确认仅监听 `127.0.0.1:13306`。隔离安装 PyMySQL 后，参数化只读查询唯一命中 nid `11294217`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 47、最新 `work_id=cij6n2gk2oo36vrkoafg-136`。数据库标题 `FRP_标准尺码类库`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `olpxkVqg`，data/node 均已发布和上架。源文件名作者温晓华与数据库当前作者不同，后续分别记录；最终仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、485,208-byte 二进制；2 段压缩长度 462,183 / 22,980 bytes，解压为 5,787,283 / 207,678 bytes，生成 5,994,981-byte 紧凑 JSON，SHA-256 `e4da3a58d15d2b35fbedcd7bdc8770ba52f7bb88c10d521751b3acdd0357996f`。三根 ID 为 case `cc8w34wa3j50000t7c10`、server `cc8w34wa3j50000t7c0g`、stage `cc8w34wa3j50000t7c00`，类型正确；结构扫描 eventAst 0、eventTree 567、Formula 8,101，且 ast/op/ln/cType 全为 0，最终确认是 V4.1。V4 已以 0600 保存，来源 README 记录作者差异和下载信息，历史案例未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 4,138,785-byte V5，SHA-256 `60c923eaff0fc83b2a2ba54853eb42b54ef75be8f19faa906e31a35b73620aae`。诊断 JSON 13,879 bytes、Markdown 6,701 bytes，共 21 条且全部去重，均由 customExpr/jsfn 兜底承接，dropped 0。类别包括原生 findIndex/hasOwnProperty、正则、除法结果 `.toFixed`、full-JS map/filter 及一条 includes 组合式；控制台 ParseError 是结构化试探日志，下一步必须检查最终 jsfn 的语法、参数和实际语义，不能直接定性为转换失败。

**审计结论：** 三根 ID/type 一致且 `server.props.v2=1`；组件 2,012/2,012、事件 567/567、动作 2,647/2,647 全部闭合。99 个禁用动作全部 skip，3 个额外 skip 均为 infinite 动画。21 个 jsfn（15 种代码）语法、arity、旧标记和自由 `$` 错误均为 0；127 个非空 `_code` 可编译。191 个 data-if 中 190 个非空条件使用正式 AST，唯一无 AST 的源条件本来为空且仅保留 `{op:'val'}` 兼容 bind。91 个 runsvc、18 个 server-api 调用、20/18 个本地/共享服务、2 个上传动作、18 个 data-func、8 个 server module 和 292 个 cType 均闭合。28 次/9 个唯一悬空 ref 在 V4 中同样无目标但有原文引用，属于源陈旧引用。15/15 种 jsfn 共 27/27 条代表断言通过；项目完整测试 85/85、fail 0，未发现转换器错误。

**最终复核：** 成功报告 5,515 bytes、SHA-256 `6d046d1db8f4e4f32ff7bf99e79c113b96336115d1e01401ea7dced386479170`。V4、V5 与诊断 JSON 均可重新解析，主要产物大小和摘要与报告一致；来源 README 1,338 bytes、SHA-256 `01de2a981b31a6ea4c2b1ef6392748f0e704561c24d967a0b7b50e68b4c49deb`。V4 主文件保持 0600，产物全部命中 `localCases/*` 忽略规则。转换器未修改、未提交或部署；第 35 例 V4/V5 目录均不存在。

### Phase 111：clothing 第 35 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对真实源排序、文件名 nid、相邻案例与目标目录状态
- [x] 参数化只读查询 nid `11123253` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 34 例人工审阅门禁解除。本轮只处理第 35/51 例 `样板库_11123253_温晓华.json`（nid `11123253`）；真实排序前后分别为第 34 例标准尺码类库和第 36 例款式与包装分类预设。V4/V5 目标目录均不存在。保留全部历史案例，不删除已有数据，不自动启动第 36 例。

**数据库初筛：** 平台 Cookie 与只读数据库 env 权限均为 0600，既有 SSH 进程继续只监听 `127.0.0.1:13306`。隔离安装 PyMySQL 后，参数化只读查询唯一命中 nid `11123253`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 382、最新 `work_id=cdmadpkhru0k16qs9efg-1220`。数据库标题 `FRP_样板库_副本`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `3C8PCh3b`，data/node 均已发布和上架。源文件名作者温晓华与数据库当前作者不同，后续分别记录；最终仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、1,934,096-byte 二进制；2 段压缩长度 1,695,817 / 238,235 bytes，解压为 22,129,785 / 4,656,110 bytes，生成 26,785,915-byte 紧凑 JSON，SHA-256 `21d19bacc67daca7fc3fe8845f46527022e53096900613fba8b55f22acc25130`。三根 ID 为 case `caxd5zza3j50000bfrsg`、server `caxd5zza3j50000bfrs0`、stage `caxd5zza3j50000bfrrg`，类型正确；结构扫描 eventAst 0、eventTree 1,666、Formula 24,291，且 ast/op/ln/cType 全为 0，最终确认是 V4.1。V4 已以 0600 保存，来源 README 记录作者差异和下载信息，历史案例未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 20,145,141-byte V5，SHA-256 `4279b4444c295e7eb15193fd642d2be747f2b7fa3d1c8557e8710c1973e8349a`。诊断 JSON 160,126 bytes、Markdown 61,468 bytes，共 245 条、去重 243，全部由 customExpr/jsfn 兜底承接，dropped 0。高频类别为 hasOwnProperty 66、findIndex 48、正则 34、full-JS 21、spread 12、toString/callee 各 11，另有 native filter、模板、unknown varType、NewExpression、flat/flatMap/match/in 等；控制台 ParseError 是结构化试探日志，下一步必须从最终 jsfn、AST 和运行语义审计，不能直接判错。

**审计结论：** 三根 ID/type 一致且 `server.props.v2=1`；组件 6,648/6,648、事件 1,666/1,666。V4 tree 的 8,956 个 action 中 3 个只是 `comment` 子树内容且 V4 `_code` 本来也不执行，其余 8,953 个全部唯一回映。265 个禁用动作全部 skip，3 个额外 skip 均为 infinite 动画；uploadPics 的 uploading/beforeUpload 两个 status 包装均保留子动作。244 个 jsfn（86 种代码）与 397 个 `_code` 全部可编译，arity、旧标记和自由 `$` 异常为 0；46/46 条代表运行及项目 85/85 测试通过。669 个 data-if、243 个 runsvc、50 个 server-api、62/30 个本地/共享服务、7 个上传动作、65 个 data-func、12 个 server module 和 999 个 cType 均闭合。86 次/30 个唯一悬空 ref 在 V4 中同样无目标且有源原文引用，属于源陈旧引用；唯一自由 `cbParams` jsfn 位于源本来禁用且无 callback 上下文的 consoleLog，V5 也 skip，属于禁用源陈旧公式。未发现转换器错误。

**最终复核：** 成功报告 6,322 bytes、SHA-256 `89480f2941912785c6c760f32df5f3ea3ea53695491771fb60f581a902628c4b`。V4、V5 与诊断 JSON 可重新解析，主要产物大小和摘要与报告一致；来源 README 1,332 bytes、SHA-256 `8c11dec2c673a24d07b3f12575ba07f66906d0a3e411610929b5cbfea6d87987`。V4 主文件保持 0600，全部产物命中 ignore，临时审计脚本已删除且 `git diff --check` 通过。转换器未修改、未提交或部署；第 36 例未启动。

### Phase 112：clothing 第 36 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对真实源排序、文件名 nid、相邻案例与目标目录状态
- [x] 参数化只读查询 nid `11370981` 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 35 例人工审阅门禁解除。本轮只处理第 36/51 例 `款式与包装分类预设_11370981_温晓华.json`（nid `11370981`）；真实排序前后分别为第 35 例样板库和第 37 例款式库。V4/V5 目标目录均不存在。保留全部历史案例，不删除已有数据，不自动启动第 37 例。

**数据库初筛：** 隔离安装 PyMySQL 后，参数化只读查询唯一命中 nid `11370981`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 40、最新 `work_id=ckp2sdgmfeq7vfc7bv80-113`。数据库标题 `FRP_款式与包材分类预设`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `sucPxBuh`，data/node 均已发布和上架。源文件名作者温晓华与数据库当前作者不同，后续分别记录；最终仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、512,704-byte 二进制；2 段压缩长度 490,715 / 21,943 bytes，解压为 6,128,423 / 204,330 bytes，生成 6,332,773-byte 紧凑 JSON，SHA-256 `1a2bec72c13420c654e99e4c4dce7ffa915544ac835d1708c54ea493201fa0d0`。三根 ID 为 case `cc8w34wa3j50000t7c10`、server `cc8w34wa3j50000t7c0g`、stage `cc8w34wa3j50000t7c00`，类型正确；结构扫描 eventAst 0、eventTree 597、Formula 8,354，且 ast/op/ln/cType 全为 0，最终确认是 V4.1。V4 已以 0600 保存，来源 README 已记录，历史案例未删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 4,379,116-byte V5，SHA-256 `d9867797d17ba009516e77e2f1deff2a1a671d05bc481659d94ff63c8df1ab7b`。诊断 JSON 24,496 bytes、Markdown 10,673 bytes，共 35 条且全部去重，全部由 customExpr/jsfn 兜底承接，dropped 0。类别为 `['%']` 正则 20、hasOwnProperty 3、`%` 正则 3、full-JS 2，以及复杂条件 receiver、lookbehind、callee、中文且/或、单引号和非法字符正则各 1；下一步从最终 jsfn、AST 和运行语义审计，不能直接把 ParseError 视为转换失败。

**审计结论：** 三根 ID/type 一致且 `server.props.v2=1`；组件 2,197/2,197、事件 597/597、动作 2,790/2,790 全部闭合。98 个禁用动作全部 skip，3 个额外 skip 均为 infinite 动画；346 个 status 全部回映。35 个 jsfn（13 种代码）与 128 个非空 `_code` 全部可编译，arity、旧标记和自由 `$` 异常为 0；13 种代码的 20/20 条代表断言通过。220 个 data-if、96 个 runsvc、19 个 server-api、20/15 个本地/共享服务、1 个上传动作、20 个 data-func、8 个 server module 和 329 个 cType 均闭合。11 次/7 个唯一悬空 ref 在 V4 中同样无目标且有源原文引用，属于源陈旧引用。复杂三元公式只存在于禁用 consoleLog 动作 `csbedhpa3j50000ef3cg`：源 V4 Formula 本来就会在真分支先 `.join(',')` 成字符串，再由外层 `.join(',')` 二次调用；V4 最终事件 `_code` 不执行它，V5 同样 skip。因此这是禁用源陈旧公式，不是转换器新增错误。项目完整测试 85/85 通过。

**最终复核：** 成功报告 6,025 bytes、SHA-256 `5105233861fe91f499b8703525520031a7a5e6a579b453531db3556c5f4b434b`；来源 README 1,365 bytes、SHA-256 `0eb8cf71f577999f1a2700b10fd68404cd4f0fe74d99c715e178c872168ed5de`。V4、V5 与诊断 JSON 均可重新解析，主要产物大小和摘要与报告一致；V4 主文件保持 0600，全部产物命中 ignore，下载/审计/运行临时脚本均已删除，`git diff --check` 通过。转换器未修改，因此没有提交、推送或部署；Phase 112 complete，等待人工审阅且不启动第 37 例。

### Phase 113：clothing 第 37 例逐例版本核验、转换与审计（2026-08-07）

- [x] 核对真实源排序、文件名 nid、相邻案例与目标目录状态
- [x] 参数化只读查询该 nid 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确回复“继续”，第 36 例人工审阅门禁解除。本轮只处理第 37/51 例；保留全部历史案例，不删除已有数据，不自动启动第 38 例。真实文件名、nid 和相邻案例须先从源目录排序核准，随后才允许查询数据库或创建本例目录。

**范围核准：** 源目录共 51 个 JSON，C 排序第 37 例为 `款式库_11054856_温晓华.json`（nid `11054856`），前后分别是第 36 例款式与包装分类预设和第 38 例款式设计。V4/V5 目标目录开始前均不存在；平台 Cookie 与数据库 env 均为 0600，既有 SSH 进程只监听 `127.0.0.1:13306`。下一步执行包含 `extra.ver` 的参数化只读查询。

**数据库初筛：** 隔离 PyMySQL 参数化只读查询唯一命中 nid `11054856`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 638、最新 `work_id=cbgulofnr8h39nnhuq50-1174`。数据库标题 `FRP_款式库`、当前作者罗安琪、uid/eid/gid `10000588/10000586/25391`、短链 `yEttDBvK`，data/node 均已发布和上架。源文件名作者温晓华与数据库当前作者不同，来源信息需分别记录；最终版本仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、1,900,956-byte 二进制；2 段压缩长度 1,706,144 / 194,767 bytes，解压为 21,331,536 / 3,487,899 bytes，生成 24,819,455-byte 紧凑 JSON，SHA-256 `68d3b0291859e3793f08ee433c27669dd1e6c5f7465c5bd868074ff271268a75`。三根 ID 为 case `cbgynrqa3j50000xx8t0`、server `cbgynrqa3j50000xx8sg`、stage `cbgynrqa3j50000xx8s0`，类型正确；结构扫描 eventAst 0、eventTree 1,823、Formula 20,736，且 ast/op/ln/cType 全为 0，最终确认是 V4.1。V4 已以 0600 保存，来源 README 已记录，下载临时脚本已删除。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 18,380,901-byte V5，SHA-256 `d626a811dc4f439428f315a56c8e6e6793761753f34fefbcb027ab4da8657eb8`。诊断 JSON 208,813 bytes、Markdown 81,098 bytes，总数 330、去重 312，全部由 customExpr/jsfn 兜底承接，dropped 0。控制台可见 callee、NewExpression、hasOwnProperty、SpreadElement、findIndex、getChildMeshes 等结构化试探失败；必须检查最终 jsfn 和 AST 的语法、参数、旧标记及运行语义，不能按 ParseError 数量直接判错。

**首轮审计发现：** 三根 ID/type 与 `server.props.v2=1` 正确，组件 6,841/6,841、事件 1,823/1,823；15 个重复 ID 均为源侧已重复的 `data-module-defs`，V5 数量和类型一致。最终 jsfn 均可编译且参数对齐，但 10 个 jsfn 残留 `$SF_arr_oneArrItem/$SF_getSelf`：其中 9 个位于启用动作，影响组件 `csmq030a3j50000wsyeg` / `csmq5cda3j50000wt120` 的两个事件和 5 个动作 BID；另 1 个位于禁用动作 `csmq6c9a3j50000wt1xg` 且 V5 正确 `skip:true`。需继续核对 V4 方法权威语义并用普通数组运行，确认这 9 个活跃落点是否为转换器错误。首轮动作“缺失”14 个中 13 个是 `action:null` 空占位，另 1 个位于禁用祖先，不能计为可执行动作丢失；禁用口径须按 AST `skip:true` 而非 `op:'skip'` 校准。

**旧方法语义证据：** VxEditor41-widgets `sysFunc.js` 的 `arr_oneArrItem(value,index)` 会先把空/无 length receiver 降级为 `[]`，仅在 index 非空且 `!isNaN` 时按 `parseFloat(index)` 取项；`getSelf(item)` 直接返回 item。V5 已有正式 `sysutil:arr_oneArrItem/getSelf`，因此 jsfn 中原样调用 `$SF_*` 不是合法 V5 运行形态。源码检索的第二次命令虽继续得到结果，但显式传入了不存在的 `test` 目录并产生 `rg` 路径警告；已通过 `rg --files` 确认测试实际位于仓库根和 `v4ToV5/*.test.js`，后续不再使用该错误目录。

**运行确认：** 两种残留 jsfn 均以普通数组和可命中数据执行，当前 V5 都抛 `TypeError: $v1.$SF_arr_oneArrItem is not a function`；按 V4 `arr_oneArrItem` 与 `getSelf` 权威实现计算则都返回索引 1。首次夹具把第一种源式的内层匹配放在索引 0，被该源公式自身的 truthy `findIndex` 写法判成 false，预期侧取项失败；已记录并改用索引 1 隔离方法残留。由此可确定本例至少有 1 类转换器错误，影响 9 个活跃 jsfn 落点。项目没有 `eslint-scope/acorn-walk/acorn-globals`，后续自由非 `$` 标识符审计需用本地 AST walker 实现，不新增依赖。

**自由标识符复核：** 本地作用域 walker 从 266 个 jsfn 中检出 4 个非参数标识符：`origin` 1、`x` 3。`origin` 在 V4 Formula 与最终事件 `code/_code` 中本来就是未限定标识符，并且浏览器存在同名全局值，当前先按源语义保留项处理。3 个 `x` 则不同：V4 原式中 `x` 都是 `.find(x => ...)` 的回调形参；V5 已把外层调用结构化成 `objArr_find → lambda(item_<blockId>)`，却把谓词部分放进只声明 `$v1/$v2` 的 jsfn，并仍写 `x.modelIndex/x.ingredientType`。这表明 callback 局部变量没有进入 jsfn 参数；还需从 AST 编译器的 jsfn 执行方式确认其不会闭包捕获外层 lambda，然后做运行对照。

**jsfn 执行确认：** VxEditor41 `src/utils/ast2js.js` 的 `case 'jsfn'` 明确生成独立 `new Function(fnArg, 'return '+code)(fnArg)`，只接收 `val.slice(1)` 声明的参数，并在异常时 catch 后返回 undefined；它不会闭包捕获外层结构化 lambda。因此 3 个只声明 `$v1/$v2` 却引用 `x` 的谓词必然触发 ReferenceError 后静默变成 undefined，使外层 `objArr_find` 匹配失败。这是第二类确定的转换器错误，影响两个启用动作（其中一段谓词还在启用条件 AST 中复用）。

**结构审计进展：** 9,567 个源 action 中 14 个是 `action:null` 空占位，其余 9,553 个全部按 BID 唯一回映；258 个自身禁用动作均 `skip:true`，3 个额外 skip 均为目标 `props.infinite=true` 的动画 play。1,278 个 status 中 1,271 个保留同名 ln；另 7 个均为 3 个 uploadPics 的 uploading/beforeUpload 包装和 1 个 uploadPic 的 uploading 包装，status 自身不保留 ln，但全部子动作 BID 精确进入相应 upload 方法的 alambda。463 个非空 `_code` 可编译；676 个 data-if、71/35 个本地/共享服务、307 个 runsvc、58 个 server-api、5 个上传、81 个 data-func 和 30 个 server module 均闭合。首轮 jsfn/cType/ref 只沿事件 AST 统计得到 266/1,140/103；扩展到全案后，V5 实际持久化 318 个 jsfn、131 种代码（不是诊断记录数 330）、1,286 个 cType，引用 17,790 次。10 个旧 `$SF_*` 残留（9 活跃）和 3 个自由 `x`（全部活跃）保持不变；125 次/42 个唯一悬空引用均不在源组件/动作索引中，但可在 V4 原文回证为源陈旧引用。

**data-if 与 skip 复核：** 3 个源动作启用但目标 `skip:true` 的例外均为无限动画，目标对象 `props.infinite=true`，符合既有转换规则。676 个 data-if 数量一致；672 个非空条件全部有 `props.conditionVal.ast` 且未残留 `binds.value`。4 个空 code 中 3 个保存兼容 AST `binds.value={op:'val'}`；另 1 个源 `props.conditionVal` 本来就是空值等式 `["", "==", ""]`，目标正确生成 `=(val,val)`，不是空绑定丢失。

**代表运行与回归：** 用 VxEditor41 `ast2js` 同型的 `new Function` 参数方式完成 49/49 条代表断言，覆盖 49/131 种最终 jsfn；普通数组、正则、Set/Spread、flat/flatMap、可选链、动态对象键、3D 方法和服务查询对象等均符合代码语义。两种旧 `$SF_*` 残留在普通数组上抛 TypeError，编辑器 catch 后为 undefined，而 V4 等价语义均返回索引 1；两种自由 `x` 谓词同样被 catch 为 undefined，显式提供回调项时应为 true。项目完整测试 85/85、fail 0；本例结论为产物生成成功但存在两类确定转换器错误。

**完成结论：** 第 37 例最新实物为 V4.1，V5 与诊断文件均已生成并完成报告。最终判定不通过：10 个 jsfn 残留旧 `$SF_*` 方法（9 活跃，影响 5 个动作 BID），另有 3 个启用 jsfn 丢失外层回调变量 `x`（影响 2 个动作和 1 个条件）。转换器未修改；停在人工审阅门禁，不启动第 38 例。

### Phase 114：修复第 37 例 `$SF_arr_oneArrItem/$SF_getSelf` 残留与回调变量丢失并发布（2026-08-07）

- [x] 补充两类最小失败回归，分别固定 V4 方法语义、单次求值与结构化 callback 局部变量作用域
- [x] 实现通用转换规则，不按案例、组件、动作 ID 或完整公式文本特判
- [x] 运行定向与完整测试，重转第 37 例并复核旧标记、自由变量、结构和运行语义
- [x] 更新第 37 例报告，将修复结论与真实产物摘要写入规划记录
- [x] 仅提交并推送本次 tov5parser 相关修改，发布生产 Lambda 并完成 prod 冒烟
- [x] 同步 VxEditor41 对应转换器，完成定向检查/构建，仅提交并推送同步文件

**Status:** complete

**授权与范围：** 用户明确要求“修复”。本阶段只修复第 37 例已确认的两类通用转换缺口，不启动第 38 例：其一是 full-JS/jsfn 兜底仍保留 receiver 形式的 `$SF_arr_oneArrItem/$SF_getSelf`；其二是外层数组 callback 已结构化为 lambda 时，内部 jsfn 未把该 callback 局部变量作为显式参数。实现必须基于 V4 widgets 权威语义和 V5 ast2js 的独立函数执行方式，不得按真实案例 ID 或整段代码文本匹配。

**发布门禁：** 按项目 `AGENT.md`/`CLAUDE.md` 中用户既有固定授权，只有定向测试、完整测试和第 37 例真实重转审计全部通过后，才自动执行 tov5parser 提交推送、生产 Lambda 发布与冒烟、VxEditor41 同步检查/构建/提交推送。只暂存本次相关文件，不读取、不修改、不暂存受保护的未跟踪文档或 VxEditor41 用户已有无关修改；禁止 rebase、强推或覆盖用户修改。

**失败回归基线：** 新增 3 项定向回归，修复前 0/3 通过并精准失败：真实同形 custom fallback 同时残留 `$SF_arr_oneArrItem/$SF_getSelf`；full-JS IIFE 虽已折叠 getSelf 但仍残留 `$SF_arr_oneArrItem`；结构化 find 的谓词 jsfn 仍以自由 `x.modelIndex` 开头且没有 lambda local arg。ParseError 日志分别来自既有 findIndex/SpreadElement 结构化试探，正是进入 fallback 的预期路径，不是额外失败。

**实现进展：** 共用 fallback 归一化器新增 `$SF_arr_oneArrItem`（含旧 db alias）与零参数直接成员 `$SF_getSelf()`。one-array-item 使用避碰命名 IIFE，让 receiver/index/额外实参各只求值一次，空 receiver 降为 `[]`，并按 V4 `index !== undefined/null && !isNaN(index)` 后 `parseFloat(index)` 取项。custom-expression 的 flat local-name Set 改为词法作用域感知的 Identifier WeakSet：外层结构 lambda 的自由引用会参数化为 local ref，嵌套同名 callback 形参仍留在自己的 JS 作用域。定向覆盖目标两类错误及既有 nested-callback 用例最终 4/4 通过，`git diff --check` 通过。

**真实重转审计：** 项目测试 88/88 后重转第 37 例，新 V5 为 18,385,066 bytes、SHA-256 `475c0b4480136904b2e64ab6764c54a01f1a3f5f3cb77cc2ab609191d0a219f8`；诊断仍为 330/312、customExpr 330、dropped 0，诊断文件摘要不变。组件 6,841、事件 1,823、有效动作 9,553、data-if 676、服务/上传/后台/cType/ref 等结构指标与修复前完全一致。318 个 jsfn/131 种代码语法、arity、旧 `$SF_*` 和自由非全局标识符错误均为 0；10 个 oneArrItem 落点变为 2 种等价 IIFE，3 个原自由 x 落点均带外层 lambda local ref。真实目标代码 9 条运行断言通过：两种取项链返回索引 1，两个谓词版本按命中项返回正确 true/false。

**报告更新：** 第 37 例报告已从“不通过”改为修复后转换成功，记录两类通用实现、全案结构/语法/自由变量审计、9 条目标运行对照和 88/88 回归结果；报告 9,619 bytes、SHA-256 `8535d6ced7326f1cfd59826e6be2ed5ed69fabdc4d1a81b7ad60055e17911fd7`。第 38 例仍未启动。

**发布完成：** tov5parser 修复提交 `fd14716` 已推送 `main`；生产 Lambda 发布版本 `28`，`prod` 已切到 `28`，CodeSha256 `l/iPyc+QQlWdltbmVHm2OFiT+ZhJ/9n0DqtgCHjVPHs=`，部署内 88/88 测试和版本冒烟均通过。VxEditor41 只同步对应转换器文件，定向 ESLint 0 问题、production webpack 构建成功；提交 `7e6aa1f58` 已推送 `master`。两个仓库的用户无关修改均未混入提交；Phase 114 complete，保持第 37 例人工审阅门禁，不启动第 38 例。

### Phase 115：clothing 第 38 例逐例版本核验、转换与审计（2026-08-10）

- [x] 核对真实源排序、文件名 nid、相邻案例与目标目录状态
- [x] 参数化只读查询该 nid 的 `extra.ver`、两表 edt_ver、verDetail、ntype 与最新 work_id
- [x] 按权威元数据初筛；若为 V4 候选，下载最新完整 JSON 并按事件 AST/V4 结构信号最终定版
- [x] 仅当实物确认为 V4 时保存来源、运行当前转换器并生成结构化诊断
- [x] 审计组件、事件、公式、data-if、服务、上传、引用与代表运行，区分转换错误和源数据问题
- [x] 生成单例报告、复核产物并返回人工审阅门禁

**Status:** complete

**授权与范围：** 用户于 2026-08-10 明确回复“继续”，第 37 例人工审阅门禁解除。本阶段只处理真实排序第 38/51 例；保留全部历史案例，不删除已有数据，不自动启动第 39 例。先从源目录重新核准文件名、nid、相邻案例与目标目录，再执行只读版本查询。

**范围核准：** 源目录仍为 51 个 JSON，C 排序第 38 例为 `款式设计_11036309_吴坤.json`（nid `11036309`），前后分别是第 37 例款式库和第 39 例物料预设库。源清单文件 27,058,291 bytes；对应 V4/V5 目标目录均不存在，不会覆盖历史产物。当前仓库只存在上一轮 stop-hook 形成的三份规划记录修改和受保护的未跟踪文档，后者继续不读取、不修改、不暂存。

**数据库初筛：** 新建隔离 PyMySQL 后，参数化只读查询唯一命中 nid `11036309`：`extra.ver=null`、data/node `edt_ver=4.1`、`verDetail=null`，只能初筛为 V4.1 候选；`ntype=1`、版本 404、最新 `work_id=cb147lful2mf2d2s5bc0-1095`。数据库标题 `服装-款式设计`、当前作者李孟贤，uid/eid/gid `10201723/10000586/25391`、短链 `AEuIXmm3`，data/node 均已发布和上架。源文件名作者吴坤与数据库当前作者不同，需分别记录；最终版本仍须下载最新 JSON 并按事件 AST/V4 tree 信号定版。

**下载与最终定版：** 中文服 `/work/load` 返回 HTTP 200、`application/octet-stream`、1,629,712-byte 二进制；两段压缩长度 1,498,101 / 131,566 bytes，解压为 24,224,552 / 2,833,718 bytes，生成 27,058,290-byte 紧凑 JSON，SHA-256 `4eef743b1eb395d713af6b95a02c0342774d463fac6cd06c93732fedf52f2d00`。三根 ID 为 case `cb147nya3j500008djz0`、server `cb147nya3j500008djyg`、stage `cb147nya3j500008djy0`，类型正确；结构扫描 eventAst 0、eventTree 1,122、Formula 15,472，且 ast/op/ln/cType 全为 0，最终确认是 V4.1。V4 已以 0600 保存。源清单文件虽然只多 1 byte，但去掉末尾换行后仍与最新 work 不同，不能用源清单替代本次下载。

**转换结果：** 当前转换器以 `--ntype 1 --diag` 成功生成 22,545,630-byte V5，SHA-256 `2ce7ca3a153b09d02e8767475004aee09492a80df561f5834f95b69c112e729b`。诊断 JSON 462,234 bytes、Markdown 160,437 bytes，总数 638、去重 609；631 条由 customExpr/jsfn 兜底承接，但有 7 条降级为空值。高频为 findIndex 492、full-JS 51、TemplateLiteral 22、hasOwnProperty 19、SpreadElement 15、getNormal 9、getChildMeshes 7；ParseError 本身不能直接判错，但 7 个 dropped 必须逐条回查 V4 原式、事件最终代码和目标 AST，确认是源语法错误还是转换器逻辑丢失。

**审计结论：** 7 个 dropped 中，3 个属于确定的转换器错误：data-if `cs7fce9a3j50000nkqqg`、`cs6trmaa3j50000068zg`、`cqxzmnta3j50000041cg` 的完整 V4 `binds.value._code` 语法有效，但逐操作数转换失败后 V5 正式 `props.conditionVal.ast` 用空 val 代替真实分支并删除旧 bind。其余 4 个动作参数都位于 `FRP_多选下拉菜单`，V4 Formula token/代码和完整事件 code 原本就带多余末尾 `]`，事件 `_code` 为空；它们是 V4 源坏数据。全案 3,696 个组件、1,122 个事件、4,781 个有效动作闭合，164 个禁用动作均 skip；615 个 jsfn/210 种代码与 240 个非空 `_code` 均可解析且参数无错位。服务、上传、后台、模块、函数、cType 和引用来源没有发现其他转换器错误；项目测试 88/88 通过。

**报告与终检：** 失败报告 8,675 bytes、SHA-256 `c0259946261ab93688725b7e5ec831ea2cbc3ecb21f69a48474fb59171f52fdb`。V4/V5/诊断 JSON 均可重新解析，V4 权限保持 0600，全部案例产物命中 ignore，临时脚本已删除，`git diff --check` 通过，第 39 例目录未创建。Phase 115 complete；本轮未修改转换器，因此未触发提交、推送、Lambda 部署或 VxEditor41 同步，返回 Phase 67 人工审阅门禁。

### Phase 116：修复第 38 例 data-if 完整条件回退并发布（2026-08-10）

- [x] 复核双仓库工作区与 data-if/公式转换链，确定完整 V4 条件转 V5 AST 的通用边界
- [x] 为三种真实形态增加失败回归：拆分操作数失败、完整 `_code` 有效、V5 正式条件不得含 dropped 空值
- [x] 实施最小通用修复，不猜修无有效完整运行时条件的源坏公式
- [x] 运行定向与完整测试，重转第 38 例并完成全案结构、条件、服务与运行审计
- [x] 更新第 38 例报告，只暂存相关文件并提交、推送 tov5parser
- [x] 部署生产 Lambda，验证完整测试、版本、prod 别名和转换冒烟
- [x] 同步 VxEditor41 对应转换器，执行定向检查与生产构建，只提交相关文件并推送
- [x] 记录双仓提交、生产版本与终检结果，返回第 38 例人工审阅门禁

**Status:** complete

**授权与范围：** 用户明确要求“修复”。根据项目 `AGENT.md`/`CLAUDE.md` 的固定发布流程，本阶段在修复与真实回归通过后无需再次询问，自动完成 tov5parser 提交推送、生产 Lambda 发布、VxEditor41 同步提交推送。只修复第 38 例的 3 个 data-if 通用转换缺口；4 个 V4 源公式多余 `]` 不做猜测性修补；不启动第 39 例。

**设计约束：** V5 data-if 的正式字段是 `props.conditionVal.ast`。修复必须只在拆分条件出现真实转换失败且 V4 保存的完整运行时条件可验证、可无损转换时启用回退；不得重新保留旧 `binds.value`，不得把合法的显式 `undefined` 空 val 误判为 dropped，也不得按案例 ID 或整段真实代码硬编码。

**报告复核：** 修复成功报告为 9,845 bytes、SHA-256 `2ef20304514e550067a8a781243f059963eadf1b6232ce40bb3b85ae11cc2159`；旧失败措辞、旧 88/88 测试数、旧产物大小与摘要已清除。报告与实物一致记录 dropped 4、8/8 运行对照和 91/91 回归。提交发布前仅剩临时审计脚本清理与工作区终检。

**tov5parser 提交：** 修复、3 个回归与规划记录已在提交 `02121cb`（`fix: recover data-if from complete v4 condition`）中精确提交并推送到 `origin/main`；受保护的未跟踪文档和本地案例产物未进入提交。下一步发布生产 Lambda。

**Lambda 发布：** 从提交 `0e0b8ad` 打包，发布前 91/91 测试通过；AWS 账号 `587849590304` 校验通过，代码 CodeSha256 `ADaDGjN1rzsdhzpWWWWfIdNQLnsE8ajgJc9udp6ESsY=`，生产版本 29 已发布，`prod` 别名指向 29。版本动作冒烟返回 StatusCode 200、ExecutedVersion 29、FunctionError null。因受保护未跟踪文档无法移动或提交，仅对该已知文件使用 `--allow-dirty`；所有本轮代码和规划改动在部署前均已提交。

**VxEditor41 同步：** 编辑器副本没有 CLI `convertDiag.js`，因此同步功能核心到 `index.js`、`V4FormulaCodeConverter.js`、`utils/con.js`、`utils/formula.js`，保留编辑器专属导入和风格。四个目标文件 ESLint 0 问题，生产 webpack 构建成功（仅 33 条既有全仓 warning，0 error）；提交 `5436d0db9`（`fix: recover converted data-if conditions`）已推送 `origin/master`，所有用户无关修改保持未暂存。

**最终核验：** tov5parser 功能修复提交 `02121cb` 与部署前记录提交 `0e0b8ad` 均已推送，Phase 116 的最终规划记录随后继续以 docs 提交推送；VxEditor41 本地与 `origin/master` 同为 `5436d0db9`。Lambda `prod` 再查询仍指向版本 29，版本状态 Active、更新状态 Successful、CodeSha256 与发布输出一致。临时审计脚本不存在，两个仓库 diff check 通过；仅保留受保护文档、VxEditor41 已知用户改动和被忽略的 Lambda 打包产物。Phase 116 complete，返回第 38 例人工审阅门禁，不启动第 39 例。

### Phase 117：复核第 38 例 data-if 最新转换语义（2026-08-10）

- [x] 提取 `cs7fce9a3j50000nkqqg` 的 V4 条件数组、完整 `code/_code` 与最新 V5 `props.conditionVal.ast`
- [x] 按 V5 正式 AST 执行规则核对变量参数、运算符优先级和代表输入语义
- [x] 对照 VxEditor41/V5 运行器确认 AST 消费契约，定位上一轮审计为何误判
- [x] 形成证据充分的错误结论与修复方向，等待用户明确修复授权

**Status:** complete

**范围：** 用户指出最新产物中节点 `cs7fce9a3j50000nkqqg` 的条件仍错误。本阶段先诊断现有持久化 V5 AST 的真实运行语义，不修改转换器、不重新发布、不启动第 39 例；若确认错误，必须撤回 Phase 116 对该节点“8/8 语义一致”的相关结论并解释审计夹具缺口。

**结论：** 用户判断正确。V4 的该节点是 3 条 OR 条件；修复前转换也保留了 `or.args=3`，只是第三分支 Formula 被错误降为空 `val`。Phase 116 在某个拆分 Formula `didDrop` 后放弃了整棵 split OR，将完整 `binds.value._code` 转成普通值表达式 `var/jsfn`，随后直接写入 `props.conditionVal.ast`，所以当前三个 OR 确实全部退化进一个 jsfn。VxEditor41 的条件面板只将 `and/or` 视为条件组，其余根节点都必须是条件运算符并提供相应操作数；裸 `var` 会被错误地当作条件运算符且缺少右操作数。正式 VLang 对普通表达式会包装 `{op:'sysop', val:'isTruthy', args:[expressionAst]}`，但该包装只能修 AST 合法性与真假运行，不能恢复原来的 3 分支可编辑结构。完整修复方向应是保留 split 得到的 3 分支 OR，只从可信完整运行态表达式中局部恢复失败的第三分支；整式 `isTruthy` 只能作为显式记录结构降级的最后兜底。第 38 例另一个同名节点 `cs6trmaa3j50000068zg` 受相同错误影响；V4 空条件 `cmqsrcha3j50000f3mx0` 与本缺陷无关。

**审计缺口：** 上一轮 8/8 只对内部 jsfn 的真假结果做了运行对照，证明公式值计算基本一致，却没有校验 `conditionVal.ast` 的 schema/编辑器消费契约；现有两个 fallback 回归也只检查无空值、无旧运行时标识符及无 dropped 诊断，未断言根必须是正式条件节点。因此 Phase 116 对这两个节点的“结构正确”结论撤回。下一步待用户明确要求修复后，补“保留 OR 分支结构并只恢复 dropped 分支”的回归、实施局部恢复、重转第 38 例，并按固定流程提交推送、部署 Lambda、同步并提交推送 VxEditor41。

### Phase 118：修复第 38 例 data-if 整式 jsfn 结构退化并发布（2026-08-10）

- [x] 固定真实同形失败回归：V4 三个 OR 中仅一支 split Formula 失败时，V5 必须保留 `or.args=3`
- [x] 设计并实现通用局部分支恢复，不按案例 ID、完整公式或固定分支序号特判
- [x] 验证失败分支无空值、其余成功分支 AST 不变，且整式 fallback 不再静默造成结构退化
- [x] 运行定向与完整测试，重转第 38 例并复核两个同型节点、第三个受影响条件及全案关键不变量
- [x] 更新第 38 例转换报告与规划记录，只提交并推送本次 tov5parser 相关文件
- [x] 发布生产 Lambda，完成完整测试、版本、prod 别名与冒烟验证
- [x] 同步 VxEditor41 转换器，完成定向检查/生产构建，只提交并推送同步文件

**Status:** complete

**授权与范围：** 用户明确要求“修复”。只修复 Phase 116 引入的 data-if 整体 custom-jsfn 结构退化，不启动第 39 例。目标是保留 V4 条件数组形成的 AND/OR 条件树，只局部恢复真正 `didDrop` 的条件值或分支；不得用整式 `isTruthy` 冒充结构保持，不得按真实节点 ID、完整业务表达式或“第三分支”硬编码。

**发布门禁：** 本项目 `AGENT.md`/`CLAUDE.md` 已记录用户既有固定授权：代码修复和真实回归全部通过后自动提交、推送、部署 Lambda，并同步 VxEditor41 后提交推送。只暂存本次相关文件；受保护未跟踪文档不读取、不修改、不暂存；VxEditor41 用户已有无关改动保持原状。任何测试、构建、推送或部署失败都停止后续发布，不 rebase、不强推、不覆盖用户修改。

**tov5parser 发布准备：** 通用逐 item 恢复、三 OR/AND/错配安全回归和三份规划记录已提交为 `41b0135`（`fix: preserve data-if condition groups`）并推送 `origin/main`。真实第 38 例与报告产物按 ignore 规则保留在本地，没有进入 Git；受保护未跟踪文档未暂存。进入 Lambda 发布前需先提交本条发布记录，保持部署脚本的干净工作区门禁。

**Lambda 发布：** 从提交 `1c8dee7` 打包，发布脚本内 91/91 测试通过；CodeSha256 `JWM+IG5KkDuTHgenrIworz42u+7SUma+TOFHq9lwfDE=`，生产版本 30 已发布，`prod` 指向 30。版本动作冒烟返回 StatusCode 200、ExecutedVersion 30、FunctionError null。仅对已知受保护未跟踪文档使用 `--allow-dirty`，提交内代码与规划记录均已推送。

**VxEditor41 同步：** 仅同步 `src/utils/convertV4ToV5/utils/con.js`，目标 ESLint 0 error / 0 warning，生产 webpack 构建成功；提交 `be3ae0b51`（`fix: preserve converted data-if groups`）已推送到 `origin/master`。编辑器既有用户修改全部保留未暂存。Phase 118 发布链完成，返回第 38 例人工审阅门禁；第 39 例未启动。

### Phase 119：clothing 第 39/51 例逐例转换测试（2026-08-10）

- [x] 按源目录既定排序确认第 39 例文件名与 nid，保留历史案例产物
- [x] 查询数据库 `extra.ver`、两表 `edt_ver`、`verDetail`、`ntype` 与当前 work 信息
- [x] 若为 V4 候选，下载最新完整 JSON并以事件 AST/V4 结构信号最终判版
- [x] 对确认的 V4 案例运行当前转换器，生成 V5 JSON及诊断报告
- [x] 审计转换结论、错误与关键结构，形成单例报告
- [x] 向用户汇报后暂停，未经明确“继续”不启动第 40 例

**Status:** complete

**授权与门禁：** 用户已明确“继续”，仅授权开始第 39 例。已测试案例全部保留，不删除历史数据；若数据库或下载实物显示为 V5，则记录并跳过转换，但仍单独汇报。不得因长期 Phase 67 未完成而连续进入第 40 例。

**结论：** 数据库与最新三根实物确认本例为 V4.1；转换 1/1 成功。V5 4,918,374 bytes，诊断 48 customExpr / 0 dropped；2,321 个节点、705 个事件、3,203 个动作、214 个 data-if、125 个服务调用、42 个后台服务和全部模块/cType/引用审计通过。48 个 jsfn 与 184 条非空 `_code` 均无语法或参数错误，91/91 项目测试通过。报告位于本例 V5 目录；未发现转换器错误，不触发提交、Lambda 部署或 VxEditor41 同步。

### Phase 120：clothing 第 40/51 例逐例转换测试（2026-08-10）

- [x] 按源目录既定排序确认第 40 例文件名与 nid，保留历史案例产物
- [x] 查询数据库 `extra.ver`、两表 `edt_ver`、`verDetail`、`ntype` 与当前 work 信息
- [x] 若为 V4 候选，下载最新完整 JSON并以事件 AST/V4 结构信号最终判版
- [x] 对确认的 V4 案例运行当前转换器，生成 V5 JSON及诊断报告
- [x] 审计转换结论、错误与关键结构，形成单例报告
- [x] 向用户汇报后暂停，未经明确“继续”不启动第 41 例

**Status:** complete

**授权与门禁：** 用户已明确“继续”，仅授权开始第 40 例。已测试案例全部保留，不删除历史数据；若数据库或下载实物显示为 V5，则记录并跳过转换，但仍单独汇报。不得因长期 Phase 67 未完成而连续进入第 41 例。

**结论：** 最新实物确认为 V4.1，转换 1/1 成功。V4/V5 均为 536 个节点和 130 棵事件树，130 个 V5 事件全部有 AST；647 个动作、45 个 data-if、28 个服务调用及后台/模块结构均保留。14 个 jsfn、29 段持久化代码与 55 个动作参数 cType 检查通过。两个未独立映射的 `uploading` status 是 `uploadPic` 包装状态，其子动作均已映射；一个 V4 空动作仍为空；唯一未解析变量引用在 V4 已存在，没有新增悬空引用。项目完整测试 91/91 通过；来源说明和转换报告已生成，临时脚本与 SSH 隧道均已清理。未发现转换器错误，不触发提交、Lambda 部署或 VxEditor41 同步；返回 Phase 67 第 40 例人工审阅门禁，不启动第 41 例。

### Phase 121：clothing 第 41/51 例逐例转换测试（2026-08-10）

- [x] 按源目录既定排序确认第 41 例文件名与 nid，保留历史案例产物
- [x] 查询数据库 `extra.ver`、两表 `edt_ver`、`verDetail`、`ntype` 与当前 work 信息
- [x] 若为 V4 候选，下载最新完整 JSON并以事件 AST/V4 结构信号最终判版
- [x] 对确认的 V4 案例运行当前转换器，生成 V5 JSON及诊断报告
- [x] 审计转换结论、错误与关键结构，形成单例报告
- [x] 向用户汇报后暂停，未经明确“继续”不启动第 42 例

**Status:** complete

**授权与门禁：** 用户已明确“继续”，仅授权开始第 41 例。已测试案例全部保留，不删除历史数据；若数据库或下载实物显示为 V5，则记录并跳过转换，但仍单独汇报。不得因长期 Phase 67 未完成而连续进入第 42 例。

**结论：** 最新实物确认为 V4.1，转换 1/1 成功。V4/V5 均为 1,637 个节点和 379 棵事件树，379 个 V5 事件全部有 AST；1,826 个动作、160 个 data-if、50 个服务调用及后台/模块结构均保留。49 个 jsfn、143 段持久化代码与 288 个动作参数 cType 检查通过；3 个空条件值均为合法 else 哨兵。9 个未解析引用全部来自 V4，没有新增悬空引用。项目完整测试 91/91 通过；来源说明和转换报告已生成，临时脚本已清理。未发现转换器错误，不触发提交、Lambda 部署或 VxEditor41 同步；返回 Phase 67 第 41 例人工审阅门禁，不启动第 42 例。

### Phase 122：clothing 第 42/51 例逐例转换测试（2026-08-10）

- [x] 按源目录既定排序确认第 42 例文件名与 nid，保留历史案例产物
- [x] 查询数据库 `extra.ver`、两表 `edt_ver`、`verDetail`、`ntype` 与当前 work 信息
- [x] 若为 V4 候选，下载最新完整 JSON并以事件 AST/V4 结构信号最终判版
- [x] 对确认的 V4 案例运行当前转换器，生成 V5 JSON及诊断报告
- [x] 审计转换结论、错误与关键结构，形成单例报告
- [x] 向用户汇报后暂停，未经明确“继续”不启动第 43 例

**Status:** complete

**授权与门禁：** 用户已明确“继续”，仅授权开始第 42 例。已测试案例全部保留，不删除历史数据；若数据库或下载实物显示为 V5，则记录并跳过转换，但仍单独汇报。不得因长期 Phase 67 未完成而连续进入第 43 例。

**结论：** 最新实物确认为 V4.1，转换 1/1 成功。V4/V5 均为 2,654 个节点和 605 棵事件树，605 个 V5 事件全部有 AST；3,060 个动作、314 个 data-if、89 个服务调用及后台/模块结构均保留。65 个 jsfn、172 段持久化代码与 338 个动作参数 cType 检查通过；2 个 data-if 是 V4 原生空条件，8 个空 val 均为明确 undefined 或三元默认哨兵。29 个未解析引用全部来自 V4，新增悬空引用 0。项目完整测试 91/91 通过；来源说明和转换报告已生成，临时脚本及 SSH 隧道均已清理。未发现转换器错误，不触发提交、Lambda 部署或 VxEditor41 同步；返回 Phase 67 第 42 例人工审阅门禁，不启动第 43 例。

### Phase 123：clothing 第 43/51 例逐例转换测试（2026-08-10）

- [x] 按源目录既定排序确认第 43 例文件名与 nid，保留历史案例产物
- [x] 查询数据库 `extra.ver`、两表 `edt_ver`、`verDetail`、`ntype` 与当前 work 信息
- [x] 若为 V4 候选，下载最新完整 JSON并以事件 AST/V4 结构信号最终判版
- [x] 对确认的 V4 案例运行当前转换器，生成 V5 JSON及诊断报告
- [x] 审计转换结论、错误与关键结构，形成单例报告
- [x] 向用户汇报后暂停，未经明确“继续”不启动第 44 例

**Status:** complete

**授权与门禁：** 用户已明确“继续”，仅授权开始第 43 例。已测试案例全部保留，不删除历史数据；若数据库或下载实物显示为 V5，则记录并跳过转换，但仍单独汇报。不得因长期 Phase 67 未完成而连续进入第 44 例。

**结论：** 最新实物确认为 V4.1，转换产物与诊断已生成；组件 1,088→1,088、事件 244→244、动作/条件/服务/后台/模块/cType/引用主链均闭合，项目测试 91/91。但两个启用的微信 `chooseAddress` 回调动作（BID `cjk76jaa3j50000sdws0`、`cjhwqm6a3j500007z6kg`）仍生成 `$v1.$SF_obj_translateData()`，而 V4 `_code` 的正确运行语义是 `$sys.util.obj_translateData(cbParams)`。本例判定存在 1 类、2 个落点的确定性转换器错误；报告已生成，等待用户审阅/授权修复，不启动第 44 例。

### Phase 124：修复第 43 例 `$SF_obj_translateData` 残留并发布（2026-08-10）

- [x] 核对双仓工作区和转换链，补充 `$SF_obj_translateData` 的失败回归测试
- [x] 实施通用 legacy sysutil 映射修复并通过定向/完整测试
- [x] 重转第 43 例，复核两个 BID、全案 jsfn 与结构审计并更新报告
- [x] 精确提交并推送 tov5parser，部署生产 Lambda 并完成 prod 冒烟
- [x] 同步 VxEditor41 对应转换器，完成定向检查/构建、精确提交并推送
- [x] 记录双仓提交、Lambda 版本和最终门禁，不启动第 44 例

**Status:** complete

**授权与范围：** 用户明确要求“修复”。根据本项目 `AGENT.md`/`CLAUDE.md` 固定流程，修复与回归通过后无需再次询问，自动完成 tov5parser 提交推送、生产 Lambda 部署、VxEditor41 同步提交推送。只修复 `$SF_obj_translateData` 通用映射缺口，不处理其他未证实问题，不触碰受保护未跟踪文档，不启动第 44 例。

**发布结论：** tov5parser `9c5e6ae` 已推送，生产 Lambda `prod` 已发布到版本 31并通过冒烟；VxEditor41 `26a9b0421` 已推送。第 43 例重转与全案审计通过，第 44 例目录仍不存在，返回 Phase 67 人工审阅门禁。

### Phase 125：核对第 43 例手工 AST 与转换 AST 的元数据差异（2026-08-10）

- [x] 从真实 V5 产物精确提取 BID `cjk76jaa3j50000sdws0` 的转换 AST
- [x] 对照用户提供的手工 AST，区分运行语义差异与编辑器元数据差异
- [x] 追踪转换器和 VxEditor41 生成路径，确定通用修复点与回归范围
- [x] 汇报差异和修复方案；本轮仅诊断，不修改转换器、不启动第 44 例

**Status:** complete

**授权与范围：** 用户要求对比检查并说明如何修复。按“诊断不自动实施”的边界，本阶段只形成证据和修复方案；若确认需改代码，等待用户明确要求修复后再进入固定发布流程。

**结论：** 当前转换 AST 与手工 AST 的执行语义相同，唯一差异是转换器把 callback 参数函数节点写成普通 `_blockType:'sysutil'`，缺少 `_blockType:'paramFunc'/_alias:'transValue'`，导致编辑器表示不可逆。根因是 stage action map 丢弃 callback `func`，而 property 转换器的 func 分支仍返回旧 block shape。应通用修复 map 双索引和正式 V5 paramFunc AST 构造，并以真实 actionResult 契约补回归；本轮未修改代码。

### Phase 126：修复 callback paramFunc 元数据并发布（2026-08-10）

- [x] 核对双仓基线，新增 actionResult callback paramFunc 失败回归
- [x] 通用修复 stage callback `func` 双索引与正式 V5 paramFunc AST 构造
- [x] 通过定向/完整测试，重转第 43 例并验证目标 BID 与全案不变量
- [x] 精确提交推送 tov5parser，部署生产 Lambda 并完成 prod 冒烟
- [x] 同步 VxEditor41 的 MapCreator/转换器，检查构建后精确提交推送
- [x] 记录最终版本并返回第 43 例审阅门禁，不启动第 44 例

**Status:** complete

**授权与范围：** 用户明确要求“修复”。按 `AGENT.md`/`CLAUDE.md` 固定流程，验证通过后自动完成双仓提交推送与生产 Lambda 部署。实现必须由组件动作 callback 契约驱动，覆盖通用 paramFunc，不按案例 BID 或 transValue 特判；保留历史案例产物，不启动第 44 例。

### Phase 127：clothing 第 44/51 例逐例测试（2026-08-10）

- [x] 核对源目录排序、nid、双仓与本地案例目录基线
- [x] 只读查询数据库版本字段、ntype 与当前 work 信息
- [x] 下载最新完整 work，扫描 V4/V5 实物信号并最终判版
- [x] 若为 V4，使用当前转换器生成 V5 与诊断并完成全案结构/公式审计
- [x] 运行必要回归、生成来源说明与单例转换报告
- [x] 汇报第 44 例结论并返回人工审阅门禁，不启动第 45 例

**Status:** complete

**授权与范围：** 用户明确回复“继续”，仅授权第 44 例 `花名册_11280925_温晓华.json`（nid `11280925`）。保留全部历史案例；若发现转换器错误，先形成证据并等待用户明确“修复”，本轮不自动修改转换器。第 45 例保持关闭。

**结果：** 最新 work 最终确认为 V4.1，V5 与诊断已生成并完成全案审计；确认 BID `d34d0zba3j500005z6kg` 的 `cbParams.data` 因异步 action 后续 sibling 丢失 action-result context 而退化为无参数 jsfn，这是 1 处真实转换器错误。正确模板应从 local `d34d9mya3j500005z7rgRtn.result.data` 读取并保留 `$cbParams/_ver` 元数据。项目 93/93 测试通过，但现有回归未覆盖该结构。来源 README 与 conversion-report 已落盘且案例目录受 ignore 保护；未修改转换器，未提交/推送/部署，未启动第 45 例。

### Phase 128：修复第 44 例异步 continuation 回调上下文并自动发布（2026-08-10）

- [x] 追踪事件块顺序转换和 action-result context 生命周期，建立失败回归
- [x] 实施通用 continuation 上下文传播修复，不按 BID/字段/源码枚举
- [x] 运行定向与完整测试，重转第 44 例并复核完整审计和报告
- [ ] 精确提交并推送 tov5parser，部署生产 Lambda并完成别名/冒烟核验
- [ ] 同步 VxEditor41 转换器，完成定向检查与生产构建
- [ ] 精确提交并推送 VxEditor41，记录双仓提交与 Lambda 版本
- [ ] 返回第 44 例人工审阅门禁，不启动第 45 例

**Status:** in progress

**授权与范围：** 用户明确要求“修复”。按 `AGENT.md`/`CLAUDE.md` 固定流程，验证通过后自动完成双仓提交推送与生产 Lambda 部署。修复必须由异步动作的 callback continuation 契约驱动，覆盖后续 sibling 对 `cbParams/cbStatus` 的通用引用，不按本案 BID、`data` 字段或 `cbParams.data` 源码特判；保留全部历史案例，第 45 例仍关闭。
