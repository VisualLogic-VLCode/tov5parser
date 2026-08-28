const FUNCTION_GROUP_TYPES = new Set(['data-funcGroup', 'obj-funcGroup'])

// Mirrors the V4 editor's nodeIsVariable() families. Keep this list explicit:
// providers such as services, transactions, triggers, and function pipelines
// may contain variables but do not share callFuncGroup entry-reset semantics.
const FUNCTION_LOCAL_VARIABLE_TYPES = new Set([
  'data-arr',
  'data-arr-2d',
  'data-bool',
  'data-int',
  'data-num',
  'data-obj-1d',
  'data-obj-arr',
  'data-obj-json',
  'data-time',
  'data-var',
  'obj-arr',
  'obj-arr-2d',
  'obj-num',
  'obj-obj-1d',
  'obj-obj-arr',
  'obj-obj-json',
  'obj-time',
  'obj-var'
])

class FunctionLocalInitError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'FunctionLocalInitError'
    this.code = code
    this.details = details
  }
}

function fail(code, message, details) {
  throw new FunctionLocalInitError(code, message, details)
}

function parseLiteral(raw, ownerId, targetId) {
  const literal = raw.trim()
  if (literal === 'undefined') {
    return { value: undefined, isUndefined: true }
  }
  try {
    return { value: JSON.parse(literal), isUndefined: false }
  } catch (error) {
    fail(
      'INVALID_LITERAL',
      `Function-local initializer for ${targetId} is not JSON or undefined.`,
      {
        ownerId,
        targetId,
        literal,
        cause: error?.message
      }
    )
  }
}

function scanAssignmentEnd(code, start, ownerId, targetId) {
  const stack = []
  let inString = false
  let escaped = false

  for (let index = start; index < code.length; index += 1) {
    const char = code[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '[' || char === '{') {
      stack.push(char)
    } else if (char === ']' || char === '}') {
      const expected = char === ']' ? '[' : '{'
      if (stack.pop() !== expected) {
        fail(
          'INVALID_LITERAL',
          `Function-local initializer for ${targetId} has unbalanced JSON.`,
          { ownerId, targetId }
        )
      }
    } else if (char === ';' && stack.length === 0) {
      return index
    }
  }

  fail(
    'ASSIGNMENT_TERMINATOR_MISSING',
    `Function-local initializer for ${targetId} has no terminating semicolon.`,
    { ownerId, targetId }
  )
}

function parseFunctionLocalInitWrapper({ code, ownerId }) {
  const prefix = `var _${ownerId}_localVarInit=false;`
  const suffix = `_${ownerId}_localVarInit=true;`
  if (typeof code !== 'string' || code.length === 0) {
    fail('WRAPPER_MISSING', 'Function-local initialization wrapper is missing.', {
      ownerId
    })
  }
  if (!code.startsWith(prefix)) {
    const hasOtherMarker = /(?:var )?_[A-Za-z0-9_$-]+_localVarInit=(?:false|true);/.test(
      code
    )
    fail(
      hasOtherMarker ? 'MARKER_MISMATCH' : 'WRAPPER_MISSING',
      hasOtherMarker
        ? 'Function-local initialization wrapper belongs to a different owner.'
        : 'Function-local initialization wrapper is missing.',
      { ownerId }
    )
  }

  const entries = []
  let cursor = prefix.length
  while (!code.startsWith(suffix, cursor)) {
    const assignmentPrefix = '$refs.'
    if (!code.startsWith(assignmentPrefix, cursor)) {
      if (code.includes(suffix, cursor)) {
        fail(
          'UNSUPPORTED_WRAPPER_STATEMENT',
          'Function-local wrapper contains a statement outside the restricted assignment grammar.',
          { ownerId, offset: cursor }
        )
      }
      fail(
        'WRAPPER_SUFFIX_MISSING',
        'Function-local initialization wrapper has no matching suffix.',
        { ownerId }
      )
    }

    const targetStart = cursor + assignmentPrefix.length
    const propertyMarker = '.p_value'
    const propertyIndex = code.indexOf(propertyMarker, targetStart)
    if (propertyIndex < 0) {
      fail(
        'UNSUPPORTED_WRAPPER_STATEMENT',
        'Function-local wrapper assignment does not target p_value.',
        { ownerId, offset: cursor }
      )
    }
    const targetId = code.slice(targetStart, propertyIndex)
    if (!/^[A-Za-z0-9_$-]+$/.test(targetId)) {
      fail(
        'INVALID_TARGET',
        'Function-local wrapper target is not a supported node identifier.',
        { ownerId, targetId }
      )
    }

    const propertyEnd = propertyIndex + propertyMarker.length
    if (code[propertyEnd] === ';') {
      // Historical V4 generation emitted a bare property read when a type
      // default resolved to actual undefined. It is an intentional runtime
      // no-op, not an assignment to undefined, and must remain a no-op.
      entries.push({ id: targetId, isNoop: true })
      cursor = propertyEnd + 1
      continue
    }
    if (code[propertyEnd] !== '=') {
      fail(
        'UNSUPPORTED_WRAPPER_STATEMENT',
        'Function-local wrapper statement is neither an assignment nor a persisted no-op reference.',
        { ownerId, targetId, offset: cursor }
      )
    }

    const literalStart = propertyEnd + 1
    const literalEnd = scanAssignmentEnd(
      code,
      literalStart,
      ownerId,
      targetId
    )
    const parsed = parseLiteral(
      code.slice(literalStart, literalEnd),
      ownerId,
      targetId
    )
    entries.push({ id: targetId, isNoop: false, ...parsed })
    cursor = literalEnd + 1
  }

  cursor += suffix.length
  if (code.indexOf(prefix, cursor) >= 0) {
    fail(
      'DUPLICATE_WRAPPER',
      'Function-local initialization wrapper occurs more than once.',
      { ownerId }
    )
  }

  return {
    wrapper: code.slice(0, cursor),
    entries
  }
}

function validateTargets({ entries, directChildren, ownerId }) {
  const expectedIds = directChildren.map(child => child.id)
  const expectedSet = new Set(expectedIds)
  const seen = new Set()

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      fail(
        'DUPLICATE_TARGET',
        `Function-local wrapper assigns ${entry.id} more than once.`,
        { ownerId, targetId: entry.id, expectedIds }
      )
    }
    seen.add(entry.id)
    if (!expectedSet.has(entry.id)) {
      fail(
        'TARGET_NOT_DIRECT_CHILD',
        `Function-local wrapper target ${entry.id} is not a direct variable child.`,
        { ownerId, targetId: entry.id, expectedIds }
      )
    }
  }

  if (entries.length !== expectedIds.length) {
    fail(
      'TARGET_SET_INCOMPLETE',
      'Function-local wrapper does not initialize every direct variable child.',
      {
        ownerId,
        expectedIds,
        actualIds: entries.map(entry => entry.id)
      }
    )
  }
  if (entries.some((entry, index) => entry.id !== expectedIds[index])) {
    fail(
      'TARGET_ORDER_MISMATCH',
      'Function-local wrapper target order differs from direct child order.',
      {
        ownerId,
        expectedIds,
        actualIds: entries.map(entry => entry.id)
      }
    )
  }
}

function createValueAst(entry) {
  return entry.isUndefined
    ? { op: 'val' }
    : { op: 'val', val: entry.value }
}

function createPrelude(entries, genId) {
  return entries.map(entry => ({
    op: 'get',
    args: [
      { op: 'ref', val: ['var', entry.id] },
      {
        op: 'method',
        val: 'setValue',
        args: [createValueAst(entry)]
      }
    ],
    ln: genId()
  }))
}

function resolveFunctionLocalInit({ owner, event, genId }) {
  const empty = { applicable: false, ok: true, prelude: [], entries: [] }
  if (
    !FUNCTION_GROUP_TYPES.has(owner?.type) ||
    event?.name !== 'callFuncGroup' ||
    event?.tree?.type !== 'root'
  ) {
    return empty
  }

  const directChildren = (owner.children || []).filter(child =>
    FUNCTION_LOCAL_VARIABLE_TYPES.has(child?.type)
  )
  if (directChildren.length === 0) return empty

  const sources = [
    ['event._code', event?._code],
    ['event.code', event?.code],
    ['owner.props._code', owner?.props?._code],
    ['owner.props.code', owner?.props?.code]
  ].filter(([, code]) => typeof code === 'string')

  try {
    if (sources.length === 0) {
      fail(
        'WRAPPER_MISSING',
        'Function group has direct variables but no generated initialization wrapper.',
        { ownerId: owner.id }
      )
    }
    const parsed = sources.map(([source, code]) => ({
      source,
      ...parseFunctionLocalInitWrapper({ code, ownerId: owner.id })
    }))
    const authoritative = parsed[0]
    const divergent = parsed.find(
      item => item.wrapper !== authoritative.wrapper
    )
    if (divergent) {
      fail(
        'WRAPPER_DIVERGENCE',
        'Generated function-local wrappers disagree across persisted carriers.',
        {
          ownerId: owner.id,
          authoritativeSource: authoritative.source,
          divergentSource: divergent.source
        }
      )
    }
    validateTargets({
      entries: authoritative.entries,
      directChildren,
      ownerId: owner.id
    })
    const safeGenId = typeof genId === 'function' ? genId : () => undefined
    const resetEntries = authoritative.entries.filter(entry => !entry.isNoop)
    return {
      applicable: true,
      ok: true,
      prelude: createPrelude(resetEntries, safeGenId),
      entries: resetEntries,
      statements: authoritative.entries,
      wrapper: authoritative.wrapper,
      sources: parsed.map(item => item.source),
      directChildIds: directChildren.map(child => child.id)
    }
  } catch (error) {
    const normalized =
      error instanceof FunctionLocalInitError
        ? error
        : new FunctionLocalInitError(
            'UNEXPECTED_PARSE_ERROR',
            error?.message || String(error),
            { ownerId: owner?.id }
          )
    return {
      applicable: true,
      ok: false,
      prelude: [],
      entries: [],
      directChildIds: directChildren.map(child => child.id),
      error: {
        name: normalized.name,
        code: normalized.code,
        message: normalized.message,
        details: normalized.details
      }
    }
  }
}

export {
  FUNCTION_LOCAL_VARIABLE_TYPES,
  FunctionLocalInitError,
  parseFunctionLocalInitWrapper,
  resolveFunctionLocalInit
}
