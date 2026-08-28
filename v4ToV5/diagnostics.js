const DIAGNOSTICS_SCHEMA_VERSION = 1
const DEFAULT_MAX_RECORDS = 5000
const DEFAULT_MAX_CATEGORIES = 200
const MAX_TEXT_LENGTH = 4096

function boundedText(value, maxLength = MAX_TEXT_LENGTH) {
  if (value == null) return null
  const text = String(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function boundedDetails(value, depth = 0) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') return boundedText(value)
  if (depth >= 4) return boundedText(JSON.stringify(value))
  if (Array.isArray(value)) {
    return value.slice(0, 1024).map(item => boundedDetails(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 256)
        .map(([key, item]) => [
          boundedText(key, 256),
          boundedDetails(item, depth + 1)
        ])
    )
  }
  return boundedText(value)
}

function collectNodeIndex(v4CaseJson) {
  const map = new Map()
  const walkNode = node => {
    if (!node || typeof node !== 'object') return
    if (node.id) {
      map.set(node.id, {
        type: boundedText(node.type, 256),
        name: boundedText(node.uis?.name, 512)
      })
    }
    for (const child of node.children || []) walkNode(child)
    for (const child of node.classes || []) walkNode(child)
  }
  for (const key of ['stage', 'server', 'case']) walkNode(v4CaseJson?.[key])
  return map
}

function collectBlockIndex(v4CaseJson) {
  const map = new Map()
  const walkBlock = (block, eventNodeId) => {
    if (!block || typeof block !== 'object') return
    if (block.bid) {
      map.set(block.bid, {
        blockType: boundedText(block.type, 256),
        triggerName: boundedText(block.triggerName, 512),
        actionName: boundedText(block.action?.name, 512),
        eventNodeId,
        lnIsRegenerated: ['multiObjs', 'randMultiObjs'].includes(block.object)
      })
    }
    for (const child of block.children || []) walkBlock(child, eventNodeId)
  }
  const walkNode = node => {
    if (!node || typeof node !== 'object') return
    for (const event of node.events?.list || []) walkBlock(event?.tree, node.id)
    for (const child of node.children || []) walkNode(child)
    for (const child of node.classes || []) walkNode(child)
  }
  for (const key of ['stage', 'server', 'case']) walkNode(v4CaseJson?.[key])
  return map
}

function normalizeRecord(record, nodeIndex, blockIndex) {
  const node = nodeIndex.get(record.nodeId) || {}
  const block = (record.blockId && blockIndex.get(record.blockId)) || {}
  const prop = record.paramName ?? record.actionParamName ?? record.bindName ?? null
  const phase = boundedText(record.phase, 128)
  return {
    outcome: phase === 'custom-expr-fallback' ? 'custom-expr' : 'dropped',
    phase,
    errorName: boundedText(record.errorName, 256),
    errorType: boundedText(record.errorType, 256),
    message: boundedText(record.message, 1024),
    nodeId: boundedText(record.nodeId, 256),
    nodeType: node.type ?? null,
    nodeName: node.name ?? null,
    bid: boundedText(record.blockId, 256),
    ln: record.blockId
      ? (block.lnIsRegenerated ? null : boundedText(record.blockId, 256))
      : null,
    lnNote: block.lnIsRegenerated
      ? 'multiObjs 拆循环，动作行 ln 为转换时新生成的 xid'
      : undefined,
    prop: boundedText(prop, 512),
    propKind:
      record.paramName != null ? 'paramName'
      : record.actionParamName != null ? 'actionParam'
      : record.bindName != null ? 'bind'
      : null,
    triggerName: block.triggerName ?? null,
    actionName: block.actionName ?? null,
    blockType: block.blockType ?? null,
    scope: boundedText(record.scope, 128),
    code: boundedText(record.code),
    eventName: boundedText(record.eventName, 512),
    affectedNodeIds: Array.isArray(record.affectedNodeIds)
      ? record.affectedNodeIds
          .slice(0, 1024)
          .map(nodeId => boundedText(nodeId, 256))
      : undefined,
    lifecycleDetails:
      record.lifecycleDetails && typeof record.lifecycleDetails === 'object'
        ? boundedDetails(record.lifecycleDetails)
        : undefined
  }
}

function groupRecords(records) {
  const grouped = new Map()
  for (const item of records) {
    const key = [
      item.nodeId,
      item.bid,
      item.prop,
      item.code,
      item.message,
      item.phase
    ].join('\u0001')
    const found = grouped.get(key)
    if (found) found.count += 1
    else grouped.set(key, { ...item, count: 1 })
  }
  return [...grouped.values()].sort((a, b) => {
    const outcomeOrder = Number(a.outcome !== 'dropped') - Number(b.outcome !== 'dropped')
    return outcomeOrder || b.count - a.count
  })
}

function countBy(records, selector, maxEntries) {
  const counts = new Map()
  for (const record of records) {
    const key = selector(record)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return {
    values: Object.fromEntries(sorted.slice(0, maxEntries)),
    truncated: sorted.length > maxEntries,
    totalKeys: sorted.length
  }
}

function buildConversionDiagnostics({
  v4CaseJson,
  records = [],
  maxRecords = DEFAULT_MAX_RECORDS,
  maxCategories = DEFAULT_MAX_CATEGORIES
} = {}) {
  const safeRecords = Array.isArray(records) ? records : []
  const nodeIndex = collectNodeIndex(v4CaseJson)
  const blockIndex = collectBlockIndex(v4CaseJson)
  const enriched = safeRecords.map(record =>
    normalizeRecord(record || {}, nodeIndex, blockIndex)
  )
  const unique = groupRecords(enriched)
  const byPhase = countBy(enriched, record => record.phase || 'unknown', maxCategories)
  const byCategory = countBy(
    enriched,
    record => (record.message || '').replace(/ at character \d+/, ''),
    maxCategories
  )
  const droppedTotal = enriched.filter(record => record.outcome === 'dropped').length

  return {
    schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    kind: 'tov5parser-conversion-diagnostics',
    summary: {
      total: enriched.length,
      droppedTotal,
      customExprTotal: enriched.length - droppedTotal,
      uniqueTotal: unique.length,
      returnedRecordCount: Math.min(unique.length, maxRecords),
      truncated: unique.length > maxRecords,
      categoryTruncated: byCategory.truncated,
      phaseTruncated: byPhase.truncated,
      categoryTotal: byCategory.totalKeys,
      phaseTotal: byPhase.totalKeys,
      byCategory: byCategory.values,
      byPhase: byPhase.values
    },
    limits: {
      maxRecords,
      maxCategories,
      maxTextLength: MAX_TEXT_LENGTH
    },
    records: unique.slice(0, maxRecords)
  }
}

export {
  DIAGNOSTICS_SCHEMA_VERSION,
  buildConversionDiagnostics
}
