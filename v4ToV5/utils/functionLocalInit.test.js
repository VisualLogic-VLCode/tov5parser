import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FUNCTION_LOCAL_VARIABLE_TYPES,
  parseFunctionLocalInitWrapper,
  resolveFunctionLocalInit
} from './functionLocalInit.js'

const ownerId = 'funcGroup1'

function child(id, type = 'data-var', value = 'current-props-value') {
  return {
    id,
    type,
    props: { value },
    children: []
  }
}

function wrapper(assignments, id = ownerId) {
  return (
    `var _${id}_localVarInit=false;` +
    assignments.map(item => `$refs.${item.id}.p_value=${item.rhs};`).join('') +
    `_${id}_localVarInit=true;`
  )
}

function functionGroup({
  id = ownerId,
  type = 'data-funcGroup',
  children,
  source
}) {
  return {
    id,
    type,
    props: { code: source, _code: source },
    children,
    events: {
      list: [
        {
          name: 'callFuncGroup',
          code: source,
          _code: source,
          tree: {
            bid: 'root1',
            type: 'root',
            trigger: { name: 'callFuncGroup' },
            children: []
          }
        }
      ]
    }
  }
}

function resolve(owner) {
  return resolveFunctionLocalInit({
    owner,
    event: owner.events.list[0],
    genId: (() => {
      let index = 0
      return () => `reset-${++index}`
    })()
  })
}

test('restricted function-local wrapper parser accepts every supported literal shape', () => {
  const assignments = [
    { id: 'vUndefined', rhs: 'undefined', expected: undefined },
    { id: 'vNull', rhs: 'null', expected: null },
    { id: 'vTrue', rhs: 'true', expected: true },
    { id: 'vFalse', rhs: 'false', expected: false },
    { id: 'vInteger', rhs: '-12', expected: -12 },
    { id: 'vNumber', rhs: '3.25e2', expected: 325 },
    {
      id: 'vString',
      rhs: '"中文;\\n\\\"quoted\\\"\\\\tail"',
      expected: '中文;\n"quoted"\\tail'
    },
    {
      id: 'vArray',
      rhs: '[1,"semi;colon",{"nested":[false,null]}]',
      expected: [1, 'semi;colon', { nested: [false, null] }]
    },
    {
      id: 'vObject',
      rhs: '{"name":"值;\\u4e2d","items":[{"x":1}]}',
      expected: { name: '值;中', items: [{ x: 1 }] }
    }
  ]
  const parsed = parseFunctionLocalInitWrapper({
    code: `${wrapper(assignments)}business();`,
    ownerId
  })

  assert.equal(parsed.wrapper, wrapper(assignments))
  assert.deepEqual(
    parsed.entries.map(item => ({ id: item.id, value: item.value })),
    assignments.map(item => ({ id: item.id, value: item.expected }))
  )
  assert.equal(parsed.entries[0].isUndefined, true)
  assert.equal(parsed.entries[1].isUndefined, false)
})

test('function-local wrapper parser rejects executable expressions and marker damage', () => {
  assert.throws(
    () =>
      parseFunctionLocalInitWrapper({
        code: wrapper([{ id: 'value1', rhs: 'source + 1' }]),
        ownerId
      }),
    error => error.code === 'INVALID_LITERAL'
  )
  assert.throws(
    () =>
      parseFunctionLocalInitWrapper({
        code: wrapper([{ id: 'value1', rhs: '0' }], 'otherOwner'),
        ownerId
      }),
    error => error.code === 'MARKER_MISMATCH'
  )
  assert.throws(
    () =>
      parseFunctionLocalInitWrapper({
        code: `var _${ownerId}_localVarInit=false;$refs.value1.p_value=0;`,
        ownerId
      }),
    error => error.code === 'WRAPPER_SUFFIX_MISSING'
  )
})

test('persisted bare p_value statements remain validated runtime no-ops', () => {
  const source =
    `var _${ownerId}_localVarInit=false;` +
    '$refs.timeValue.p_value;' +
    '$refs.boolValue.p_value=false;' +
    `_${ownerId}_localVarInit=true;`
  const owner = functionGroup({
    children: [
      child('timeValue', 'data-time'),
      child('boolValue', 'data-bool')
    ],
    source
  })
  const result = resolve(owner)

  assert.equal(result.ok, true)
  assert.deepEqual(
    result.statements.map(item => ({ id: item.id, isNoop: item.isNoop })),
    [
      { id: 'timeValue', isNoop: true },
      { id: 'boolValue', isNoop: false }
    ]
  )
  assert.equal(result.prelude.length, 1)
  assert.equal(result.prelude[0].args[0].val[1], 'boolValue')
})

test('function-local resolution validates direct targets, uniqueness, completeness, and order', () => {
  const direct = [child('first'), child('second')]
  const cases = [
    {
      name: 'duplicate',
      assignments: [
        { id: 'first', rhs: '0' },
        { id: 'first', rhs: '1' }
      ],
      errorCode: 'DUPLICATE_TARGET'
    },
    {
      name: 'external target',
      assignments: [
        { id: 'first', rhs: '0' },
        { id: 'external', rhs: '1' }
      ],
      errorCode: 'TARGET_NOT_DIRECT_CHILD'
    },
    {
      name: 'nested target',
      assignments: [
        { id: 'first', rhs: '0' },
        { id: 'nested', rhs: '1' }
      ],
      errorCode: 'TARGET_NOT_DIRECT_CHILD',
      extraChildren: [
        {
          id: 'nestedGroup',
          type: 'data-funcGroup',
          props: {},
          children: [child('nested')]
        }
      ]
    },
    {
      name: 'missing target',
      assignments: [{ id: 'first', rhs: '0' }],
      errorCode: 'TARGET_SET_INCOMPLETE'
    },
    {
      name: 'reordered target',
      assignments: [
        { id: 'second', rhs: '0' },
        { id: 'first', rhs: '1' }
      ],
      errorCode: 'TARGET_ORDER_MISMATCH'
    }
  ]

  for (const item of cases) {
    const source = wrapper(item.assignments)
    const result = resolve(
      functionGroup({
        children: [...direct, ...(item.extraChildren || [])],
        source
      })
    )
    assert.equal(result.ok, false, item.name)
    assert.equal(result.error.code, item.errorCode, item.name)
    assert.deepEqual(result.prelude, [], item.name)
  }
})

test('function-local resolution rejects divergent carriers without partial materialization', () => {
  const source = wrapper([{ id: 'value1', rhs: '0' }])
  const owner = functionGroup({ children: [child('value1')], source })
  owner.events.list[0]._code = wrapper([{ id: 'value1', rhs: '1' }])

  const result = resolve(owner)
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'WRAPPER_DIVERGENCE')
  assert.deepEqual(result.prelude, [])

  owner.events.list[0]._code = source
  owner.props.code = ''
  const emptyCarrier = resolve(owner)
  assert.equal(emptyCarrier.ok, false)
  assert.equal(emptyCarrier.error.code, 'WRAPPER_MISSING')
  assert.deepEqual(emptyCarrier.prelude, [])
})

test('function-local resolution materializes canonical setValue AST from wrapper values', () => {
  const assignments = [
    { id: 'value1', rhs: 'undefined' },
    { id: 'value2', rhs: '[{"name":"wrapper"}]' }
  ]
  const owner = functionGroup({
    type: 'obj-funcGroup',
    children: [child('value1', 'obj-var'), child('value2', 'obj-obj-arr', [])],
    source: wrapper(assignments)
  })
  const result = resolve(owner)

  assert.equal(result.applicable, true)
  assert.equal(result.ok, true)
  assert.deepEqual(result.prelude, [
    {
      op: 'get',
      args: [
        { op: 'ref', val: ['var', 'value1'] },
        { op: 'method', val: 'setValue', args: [{ op: 'val' }] }
      ],
      ln: 'reset-1'
    },
    {
      op: 'get',
      args: [
        { op: 'ref', val: ['var', 'value2'] },
        {
          op: 'method',
          val: 'setValue',
          args: [{ op: 'val', val: [{ name: 'wrapper' }] }]
        }
      ],
      ln: 'reset-2'
    }
  ])
})

test('function-local resolution covers every V4 data/object variable type from wrapper authority', () => {
  const children = [...FUNCTION_LOCAL_VARIABLE_TYPES].map((type, index) =>
    child(`typedValue${index}`, type, { stale: type })
  )
  const assignments = children.map((item, index) => ({
    id: item.id,
    rhs:
      item.type.includes('obj-json')
        ? '{"schemaDefault":{"enabled":true},"rows":[1,2]}'
        : index % 3 === 0
          ? 'undefined'
          : index % 3 === 1
            ? `[${index},{"type":"${item.type}"}]`
            : JSON.stringify(`wrapper-${item.type}`)
  }))
  const result = resolve(
    functionGroup({ children, source: wrapper(assignments) })
  )

  assert.equal(result.ok, true)
  assert.equal(result.prelude.length, FUNCTION_LOCAL_VARIABLE_TYPES.size)
  assert.deepEqual(
    result.prelude.map(item => item.args[0].val[1]),
    children.map(item => item.id)
  )
  for (let index = 0; index < children.length; index += 1) {
    const valueAst = result.prelude[index].args[1].args[0]
    assert.notDeepEqual(
      valueAst.val,
      children[index].props.value,
      children[index].type
    )
  }
  const jsonIndex = children.findIndex(item => item.type === 'data-obj-json')
  assert.deepEqual(result.prelude[jsonIndex].args[1].args[0], {
    op: 'val',
    val: { schemaDefault: { enabled: true }, rows: [1, 2] }
  })
})

test('function groups with direct variables but no wrapper fail closed', () => {
  const owner = functionGroup({
    children: [child('value1')],
    source: ''
  })
  const result = resolve(owner)

  assert.equal(result.applicable, true)
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'WRAPPER_MISSING')
  assert.deepEqual(result.prelude, [])
})

test('function-local resolution is scoped only to callFuncGroup variable owners', () => {
  const source = wrapper([{ id: 'value1', rhs: '0' }])
  for (const type of [
    'data-service',
    'data-transaction',
    'ih5-trigger',
    'data-funcPipeline'
  ]) {
    const owner = functionGroup({ type, children: [child('value1')], source })
    if (type === 'data-funcPipeline') {
      owner.events.list[0].name = 'callFuncPipeline'
      owner.events.list[0].tree.trigger.name = 'callFuncPipeline'
    }
    const result = resolve(owner)
    assert.equal(result.applicable, false, type)
    assert.deepEqual(result.prelude, [], type)
  }

  assert.ok(FUNCTION_LOCAL_VARIABLE_TYPES.has('data-obj-json'))
  assert.ok(FUNCTION_LOCAL_VARIABLE_TYPES.has('data-time'))
  assert.ok(FUNCTION_LOCAL_VARIABLE_TYPES.has('obj-obj-json'))
  assert.ok(FUNCTION_LOCAL_VARIABLE_TYPES.has('obj-time'))
})
