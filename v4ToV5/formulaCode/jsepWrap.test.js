import test from 'node:test'
import assert from 'node:assert/strict'
import jsep from './jsepWrap.js'
import V4FormulaCodeConverter from './V4FormulaCodeConverter.js'
import ExprAstToString from './ExprAstToString.js'
import { loadRuntimeMaps } from '../../index.js'
import { ast2js } from '../ast2js.js'

const assertSingleLineJsfn = jsfn => {
  assert.equal(/[\r\n]/.test(jsfn.val[0]), false)
}

const findAst = (ast, predicate) => {
  if (!ast || typeof ast !== 'object') return
  if (predicate(ast)) return ast
  for (const value of Object.values(ast)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findAst(item, predicate)
        if (found) return found
      }
    } else {
      const found = findAst(value, predicate)
      if (found) return found
    }
  }
}

const collectAst = (ast, predicate, found = []) => {
  if (!ast || typeof ast !== 'object') return found
  if (predicate(ast)) found.push(ast)
  for (const value of Object.values(ast)) {
    if (Array.isArray(value)) {
      for (const item of value) collectAst(item, predicate, found)
    } else {
      collectAst(value, predicate, found)
    }
  }
  return found
}

const assertJsfnArgumentsComplete = ast => {
  const jsfns = collectAst(ast, item => item.op === 'jsfn')
  assert.ok(jsfns.length > 0)
  for (const jsfn of jsfns) {
    const code = jsfn.val?.[0] || ''
    const requiredArgCount = Math.max(
      0,
      ...(code.match(/\$v\d+/g) || []).map(name => Number(name.slice(2)))
    )
    assert.equal(
      jsfn.args?.length || 0,
      jsfn.val.length - 1,
      `jsfn 参数名与实参数量不一致: ${code}`
    )
    assert.ok(
      (jsfn.args?.length || 0) >= requiredArgCount,
      `jsfn 缺少 $v 参数: ${code}`
    )
  }
}

test('jsepWrap registers the v4 formula syntax plugins', () => {
  const arrowAst = jsep('items.find(item => item.id === 1)')
  assert.equal(arrowAst.arguments[0].type, 'ArrowFunctionExpression')
  assert.equal(arrowAst.arguments[0].exprStr, 'item => item.id === 1')

  const objectAst = jsep('({ name: value, enabled: true })')
  assert.equal(objectAst.type, 'ObjectExpression')
  assert.equal(objectAst.properties[0].valueRaw.trim(), 'value')

  const regexAst = jsep('text.replace(/x+/g, "")')
  assert.equal(regexAst.arguments[0].value instanceof RegExp, true)

  const spreadAst = jsep('[...new Set(items)]')
  assert.equal(spreadAst.elements[0].type, 'SpreadElement')
  assert.equal(spreadAst.elements[0].argument.type, 'NewExpression')

  const templateAst = jsep('`hello ${name}`')
  assert.equal(templateAst.type, 'TemplateLiteral')
})

test('server action bare cbParams unwraps legacy single callback results', () => {
  loadRuntimeMaps()
  const converter = new V4FormulaCodeConverter({
    str: 'cbParams',
    getCtx() {},
    scope: 'server'
  })

  const countAst = converter.genActionResultAST({
    ctx: {
      actionBlockId: 'count-block',
      varCompName: 'data-db',
      varCompScope: 'server',
      action: 'dbCount'
    }
  })
  assert.deepEqual(countAst.args[0].args[1], {
    op: 'index',
    args: [{ op: 'val', val: 'result' }]
  })

  const selectAst = converter.genActionResultAST({
    ctx: {
      actionBlockId: 'select-block',
      varCompName: 'data-db',
      varCompScope: 'server',
      action: 'dbSelect'
    }
  })
  assert.equal(selectAst.args[0].args.length, 1)
})

test('reduce lambda declares the accumulator from the sysutil callback map', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.reduce((pre, cur) => pre.concat(cur.department), [])',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const reduce = findAst(
    ast,
    item => item.op === 'sysutil' && item.val === 'arr_reduce'
  )
  const lambda = findAst(ast, item => item.op === 'lambda')
  assert.equal(typeof reduce?._blockId, 'string')
  assert.deepEqual(lambda?.val, [
    `acc_${reduce._blockId}`,
    `item_${reduce._blockId}`,
    `index_${reduce._blockId}`
  ])
  assert.match(
    JSON.stringify(lambda),
    new RegExp(`"local","acc_${reduce._blockId}"`)
  )
  assert.match(
    JSON.stringify(lambda),
    new RegExp(`"local","item_${reduce._blockId}"`)
  )

  const code = ast2js({
    ast,
    eventNodeId: 'test-node',
    getNodeByIdFunc() {}
  })
  assert.match(
    code,
    new RegExp(
      `function\\(acc_${reduce._blockId},item_${reduce._blockId},index_${reduce._blockId}\\)`
    )
  )
  const result = new Function('$sys', 'param', `return ${code}`)(
    {
      util: {
        arr_reduce: (value, fn, initVal) => value.reduce(fn, initVal),
        arr_concat: (value, next) => value.concat(next),
        obj_item: (value, key) => value[key]
      }
    },
    {
      items: [{ department: 1 }, { department: 2 }]
    }
  )
  assert.deepEqual(result, [1, 2])
})

test('ordinary array callbacks use block-scoped item and index parameters', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map((entry, position) => entry.id + position)',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const map = findAst(
    ast,
    item => item.op === 'sysutil' && /(?:^|_)map$/.test(item.val)
  )
  const lambda = findAst(ast, item => item.op === 'lambda')
  assert.equal(typeof map?._blockId, 'string')
  assert.deepEqual(lambda?.val, [
    `item_${map._blockId}`,
    `index_${map._blockId}`
  ])
  assert.match(
    JSON.stringify(lambda),
    new RegExp(`"local","item_${map._blockId}"`)
  )
  assert.match(
    JSON.stringify(lambda),
    new RegExp(`"local","index_${map._blockId}"`)
  )
})

test('nested array callbacks keep outer and inner item references distinct', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str:
      'fParamgroup.users.filter(i => !!fParamgroup.roles.find(j => i.roleList.includes(j.id)))',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const callbacks = []
  const collectCallbacks = value => {
    if (!value || typeof value !== 'object') return
    if (
      value.op === 'sysutil' &&
      ['objArr_filter', 'objArr_find'].includes(value.val)
    ) {
      callbacks.push(value)
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(collectCallbacks)
      else collectCallbacks(child)
    }
  }
  collectCallbacks(ast)

  const filter = callbacks.find(item => item.val === 'objArr_filter')
  const find = callbacks.find(item => item.val === 'objArr_find')
  assert.equal(typeof filter?._blockId, 'string')
  assert.equal(typeof find?._blockId, 'string')
  assert.notEqual(filter._blockId, find._blockId)
  const innerLambda = findAst(find, item => item.op === 'lambda')
  const innerJson = JSON.stringify(innerLambda)
  assert.match(innerJson, new RegExp(`"local","item_${filter._blockId}"`))
  assert.match(innerJson, new RegExp(`"local","item_${find._blockId}"`))

  const code = ast2js({
    ast,
    eventNodeId: 'test-node',
    getNodeByIdFunc() {}
  })
  const result = new Function('$sys', 'param', `return ${code}`)(
    {
      util: {
        objArr_filter: (value, fn) => value.filter(fn),
        objArr_find: (value, fn) => value.find(fn),
        obj_item: (value, key) => value[key],
        arr_includes: (value, item) => value.includes(item)
      }
    },
    {
      users: [
        { id: 1, roleList: [10] },
        { id: 2, roleList: [20] }
      ],
      roles: [{ id: 20 }]
    }
  )
  assert.deepEqual(result, [{ id: 2, roleList: [20] }])
})

test('nested callback custom expressions keep their own jsfn arguments', () => {
  loadRuntimeMaps()
  const formulas = [
    '!!fParamgroup.items.find(i => !!i.permission && !!i.permission.save && !!i.permission.save.enabled) && fParamgroup.status != "done"',
    'fParamgroup.items.filter(item => !item[fParamgroup.error] && item.details.filter(x => x.error || x[fParamgroup.error]).length > 0)'
  ]

  for (const str of formulas) {
    const ast = new V4FormulaCodeConverter({
      str,
      getCtx(name) {
        if (name === 'fParamgroup') return { varType: 'param' }
      },
      scope: 'stage'
    }).exec()
    assertJsfnArgumentsComplete(ast)
  }
})

test('full JavaScript callbacks keep nested custom-expression arguments', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(i => { if (fParamgroup.keys.includes(i.index) && !!fParamgroup.filters.find(j => i.index == j.index) && !!fParamgroup.filters.find(j => i.index == j.index).value) i.value = fParamgroup.filters.find(j => i.index == j.index).value; return i })',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  assertJsfnArgumentsComplete(ast)
  const jsfns = collectAst(ast, item => item.op === 'jsfn')
  assert.equal(jsfns.length, 1)
  assert.match(jsfns[0].val[0], /\.includes\(i\.index\)/)
  assert.match(jsfns[0].val[0], /\.find\(j => i\.index == j\.index\)/)
})

test('destructured callback parameters stay inside a callable jsfn', () => {
  loadRuntimeMaps()
  const cases = [
    {
      str: 'Object.entries(fParamgroup.obj).map(([key,value]) => `${key}${value}`).join(",")',
      input: ['name', 2],
      expected: 'name2'
    },
    {
      str: 'fParamgroup.items.map(({title,code}) => ({name:title,code}))',
      input: { title: '标题', code: 'code-1' },
      expected: { name: '标题', code: 'code-1' }
    }
  ]

  for (const item of cases) {
    const ast = new V4FormulaCodeConverter({
      str: item.str,
      getCtx(name) {
        if (name === 'fParamgroup') return { varType: 'param' }
      },
      scope: 'stage'
    }).exec()
    const jsfns = collectAst(ast, value => value.op === 'jsfn')
    assert.equal(jsfns.length, 1)
    assert.match(jsfns[0].val[0], /=>/)
    const callback = new Function(
      ...jsfns[0].val.slice(1),
      `return (${jsfns[0].val[0]});`
    )()
    assert.deepEqual(callback(item.input), item.expected)
  }
})

test('full JavaScript fallback preserves block arrows as parameterized jsfn', () => {
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(item => { if (item.ok) return item.value; return null })',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = ast.args[0]
  assert.equal(jsfn.op, 'jsfn')
  assertSingleLineJsfn(jsfn)
  assert.match(jsfn.val[0], /^\$v1\.map\(/)
  assert.equal(jsfn.args.length, 1)
  assert.deepEqual(jsfn.args[0].args[0].args[0].val, ['param', 'items'])
})

test('full JavaScript fallback handles IIFE and assignment expressions', () => {
  const ast = new V4FormulaCodeConverter({
    str: '(function () { var value = fParamgroup.count; value += 1; return value })()',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = ast.args[0]
  assert.equal(jsfn.op, 'jsfn')
  assertSingleLineJsfn(jsfn)
  assert.match(jsfn.val[0], /var value = \$v1;/)
  assert.match(jsfn.val[0], /value \+= 1;/)
  assert.equal(jsfn.args.length, 1)
})

test('block arrows are routed to full parser before jsep can misparse the body', () => {
  const converter = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(item => { return { name: item.name, value: item.id } })',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  })
  assert.equal(converter.shouldUseFullJsParser({ str: converter.str }), true)

  const jsfn = converter.exec().args[0]
  assertSingleLineJsfn(jsfn)
  assert.match(jsfn.val[0], /return \{ name: item\.name,/)
  assert.doesNotThrow(() => {
    new Function(...jsfn.val.slice(1), `return (${jsfn.val[0]});`)
  })
})

test('object-return arrows remain valid in custom-expression output', () => {
  const code = new ExprAstToString({
    ast: jsep('items.flatMap(item => ({ name: item.name, id: item.id }))')
  }).exec()

  assert.match(code, /=> \(\{name:/)
  assert.doesNotThrow(() => {
    new Function('items', `return (${code});`)
  })
})

test('numeric literal receivers stay valid in custom-expression output', () => {
  const code = new ExprAstToString({
    ast: jsep('(1).toString().padStart(2, "0")')
  }).exec()

  assert.equal(code, '(1).toString().padStart(2, "0")')
  assert.doesNotThrow(() => {
    new Function(`return (${code});`)
  })
})

test('compound expressions preserve JavaScript comma semantics in jsfn fallback', () => {
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.first, fParamgroup.second, fParamgroup.third',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.equal(jsfn.val[0], '$v1, $v2, $v3')
  assert.deepEqual(jsfn.val.slice(1), ['$v1', '$v2', '$v3'])
  assert.equal(jsfn.args.length, 3)
  const evaluate = new Function(...jsfn.val.slice(1), `return (${jsfn.val[0]});`)
  assert.equal(evaluate('first', 'second', 'third'), 'third')
})

test('conditional receivers keep parentheses in custom-expression output', () => {
  const code = new ExprAstToString({
    ast: jsep('(hasValue ? nextValue : 1).toString().padStart(3, "0")')
  }).exec()

  assert.equal(
    code,
    '(hasValue ? nextValue : 1).toString().padStart(3, "0")'
  )
  assert.doesNotThrow(() => {
    new Function('hasValue', 'nextValue', `return (${code});`)
  })
})

test('conditional collection receivers preserve surrounding unary semantics', () => {
  const code = new ExprAstToString({
    ast: jsep(
      '!(afterSaleType === -4 ? ["后整理"] : ["缝制", "后整理"]).every(item => values.includes(item))'
    )
  }).exec()

  assert.equal(
    code,
    '!(afterSaleType === -4 ? ["后整理"] : ["缝制", "后整理"]).every((item) => values.includes(item))'
  )
  const evaluate = new Function(
    'afterSaleType',
    'values',
    `return (${code});`
  )
  assert.equal(evaluate(-4, ['后整理']), false)
  assert.equal(evaluate(-4, []), true)
  assert.equal(evaluate(0, ['缝制', '后整理']), false)
})

test('string concatenation preserves nested numeric addition', () => {
  const ast = new V4FormulaCodeConverter({
    str: "(6+$refs.v0_chpq9t7a3j50000jzpp0*18)+'px'",
    getCtx() {},
    scope: 'stage'
  }).exec()

  assert.equal(ast.op, 'var')
  assert.equal(ast.cType, 'String')
  assert.equal(ast.args[0].op, 'concat')
  assert.equal(ast.args[0].args.length, 2)
  assert.deepEqual(ast.args[0].args[0], {
    op: '+',
    args: [
      {
        op: 'val',
        val: 6
      },
      {
        op: '*',
        args: [
          {
            op: 'var',
            args: [
              {
                op: 'get',
                args: [
                  {
                    op: 'ref',
                    val: ['arg0', 'chpq9t7a3j50000jzpp0']
                  }
                ],
                _blockType: '$cbParams'
              }
            ]
          },
          {
            op: 'val',
            val: 18
          }
        ]
      }
    ]
  })
  assert.deepEqual(ast.args[0].args[1], {
    op: 'val',
    val: 'px'
  })
})

test('ordinary string concatenation chains remain flattened', () => {
  const ast = new V4FormulaCodeConverter({
    str: "'prefix-'+fParamgroup.value+'-suffix'",
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  assert.equal(ast.args[0].op, 'concat')
  assert.equal(ast.args[0].args.length, 3)
  assert.deepEqual(ast.args[0].args[0], {
    op: 'val',
    val: 'prefix-'
  })
  assert.deepEqual(ast.args[0].args[2], {
    op: 'val',
    val: '-suffix'
  })
})

test('typeof expressions use the full parser and bare equals inside strings do not', () => {
  const converter = new V4FormulaCodeConverter({
    str: 'typeof fParamgroup.value === "number" ? fParamgroup.value : `${fParamgroup.value}`',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  })
  assert.equal(converter.shouldUseFullJsParser({ str: converter.str }), true)
  assert.equal(
    converter.shouldUseFullJsParser({
      str: '({ where: "status = 1", enabled: true })'
    }),
    false
  )

  const jsfn = converter.exec().args[0]
  assert.match(jsfn.val[0], /^typeof \$v1 === "number"/)
  assert.doesNotThrow(() => {
    new Function(...jsfn.val.slice(1), `return (${jsfn.val[0]});`)
  })
})

test('full parser keeps callback subtrees intact while parameterizing external refs', () => {
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(i => { i.assistAttributes = fParamgroup.attrs.filter(j => (i.assistAttributeIds || []).includes(j.id)); return i })',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = ast.args[0]
  assertSingleLineJsfn(jsfn)
  assert.match(jsfn.val[0], /\.filter\(j => \(i\.assistAttributeIds \|\| \[\]\)\.includes\(j\.id\)\)/)
  assert.equal(jsfn.args.length, 2)
  assert.doesNotThrow(() => {
    new Function(...jsfn.val.slice(1), `return (${jsfn.val[0]});`)
  })
})

test('full parser keeps block reduce callbacks nested inside new expressions', () => {
  const ast = new V4FormulaCodeConverter({
    str:
      '[...new Set(fParamgroup.items.reduce((pre,cur)=>{if(!!cur.measureUserIds)pre=pre.concat(cur.measureUserIds);return pre},[]))].map(item=>{return {userId:item}})',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = ast.args[0]
  assert.equal(jsfn.op, 'jsfn')
  assertSingleLineJsfn(jsfn)
  assert.match(jsfn.val[0], /new Set\(\$v1\.reduce\(\(pre, cur\) => \{/)
  assert.match(jsfn.val[0], /pre = pre\.concat\(cur\.measureUserIds\);/)
  assert.match(jsfn.val[0], /return pre;/)
  assert.equal(
    findAst(
      ast,
      item => item.op === 'sysutil' && item.val === 'arr_reduce'
    ),
    undefined
  )

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.deepEqual(
    evaluate([
      { measureUserIds: ['u1', 'u2'] },
      { measureUserIds: null },
      { measureUserIds: ['u2', 'u3'] }
    ]),
    [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]
  )
})

test('full parser keeps block callbacks nested in conditional branches', () => {
  const ast = new V4FormulaCodeConverter({
    str: '!fParamgroup.items ? "" : fParamgroup.items.map(item => { if (item.ok) { var value = item.value; return value; } else { return ""; } }).join("、")',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = ast.args[0]
  assert.equal(jsfn.op, 'jsfn')
  assertSingleLineJsfn(jsfn)
  assert.match(jsfn.val[0], /\.map\(item => \{/)
  assert.match(jsfn.val[0], /if \(item\.ok\) \{/)
  assert.match(jsfn.val[0], /return value;/)
  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.equal(
    evaluate(
      [{ ok: true, value: 'ignored' }],
      [{ ok: true, value: 'A' }, { ok: true, value: 'B' }]
    ),
    'A、B'
  )
})
