// 公式转换诊断采集（默认关闭，关闭时零行为影响）。
//
// 公式解析失败时 V4FormulaCodeConverter.parseStr 会把结果降级为 { op: 'val' }
// 并只 console.log 错误本身，丢失了“是哪个节点/哪个事件块/哪个属性的公式”。
// 本模块提供一个进程内采集器：convertEditorValue 在调用公式转换前把上下文
// 压栈，parseStr 的 catch 里上报错误时带上栈顶上下文，转换完成后由调用方
// （如 scripts/convert-local-cases.mjs --diag）取走全部记录。
//
// 转换是同步单线程的，用栈支持潜在的嵌套调用。

let enabled = false
let records = []
let contextStack = []
let extraContext = null

function enableConvertDiag() {
  enabled = true
  records = []
  contextStack = []
  extraContext = null
}

function disableConvertDiag() {
  enabled = false
  contextStack = []
  extraContext = null
}

function isConvertDiagEnabled() {
  return enabled
}

function pushDiagContext(ctx) {
  if (enabled) contextStack.push(ctx)
}

function popDiagContext() {
  if (enabled) contextStack.pop()
}

// 补充调用方专有的上下文（如 convertBinds 的绑定属性名），
// 会合并进随后 push 的上下文记录里
function setDiagExtra(extra) {
  if (enabled) extraContext = extra
}

function clearDiagExtra() {
  if (enabled) extraContext = null
}

function reportDiagError({ phase, error }) {
  if (!enabled) return false
  let context = contextStack[contextStack.length - 1] || {}
  records.push({
    ...(extraContext || {}),
    ...context,
    phase, // 'jsep-parse'（jsep 解析失败）| 'ast-convert'（AST 转换失败）
    errorName: error?.name,
    errorType: error?.type,
    message: error?.message || String(error)
  })
  return true
}

function getDiagRecords() {
  return records.slice()
}

function createDiagCheckpoint() {
  return enabled ? records.length : null
}

function getDiagRecordsSince(checkpoint) {
  if (!enabled || !Number.isInteger(checkpoint)) return []
  return records.slice(checkpoint)
}

function rollbackDiagCheckpoint(checkpoint) {
  if (!enabled || !Number.isInteger(checkpoint)) return
  records.length = checkpoint
}

function appendDiagRecords(items) {
  if (!enabled || !Array.isArray(items) || items.length === 0) return
  records.push(...items)
}

export {
  enableConvertDiag,
  disableConvertDiag,
  isConvertDiagEnabled,
  pushDiagContext,
  popDiagContext,
  setDiagExtra,
  clearDiagExtra,
  reportDiagError,
  getDiagRecords,
  createDiagCheckpoint,
  getDiagRecordsSince,
  rollbackDiagCheckpoint,
  appendDiagRecords
}
