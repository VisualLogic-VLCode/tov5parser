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

test('custom fallback preserves the JavaScript in operator inside callbacks', () => {
  const parsed = jsep('key in value')
  assert.equal(parsed.type, 'BinaryExpression')
  assert.equal(parsed.operator, 'in')

  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.find(i => fParamgroup.key in i) && true',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.match(jsfn.val[0], /\.find\(\(i\) => \$v2 in i\)/)
  assert.doesNotMatch(jsfn.val[0], /,\s*in\s*,/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.equal(evaluate([{ code: 1 }], 'code'), true)
})

test('custom fallback preserves computed object property keys', () => {
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(i => ({[i.name]: i.value})) || []',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.match(jsfn.val[0], /\(\{\[i\.name\]: i\.value\}\)/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.deepEqual(evaluate([{ name: 'size', value: 'M' }]), [
    { size: 'M' }
  ])
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

test('legacy multi-object-list conversion becomes a structured V5 sysutil call', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.uploads.$SF_sys_multiObjListToObjArr().map(item => item.name)',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const multiObjListToObjArr = findAst(
    ast,
    item =>
      item.op === 'sysutil' && item.val === 'sys_multiObjListToObjArr'
  )
  assert.ok(multiObjListToObjArr)
  assert.equal(
    collectAst(ast, item => item.op === 'jsfn').length,
    0
  )
  assert.doesNotMatch(JSON.stringify(ast), /\$SF_sys_multiObjListToObjArr/)

  const code = ast2js({
    ast,
    eventNodeId: 'test-node',
    getNodeByIdFunc() {}
  })
  assert.match(code, /\$sys\.util\.sys_multiObjListToObjArr\(/)
  const result = new Function('$sys', 'param', `return ${code}`)(
    {
      util: {
        sys_multiObjListToObjArr(value) {
          const length = Math.max(
            0,
            ...Object.values(value).map(item => item.length)
          )
          return Array.from({ length }, (_, index) =>
            Object.fromEntries(
              Object.entries(value).map(([key, item]) => [key, item[index]])
            )
          )
        },
        objArr_map: (value, callback) => value.map(callback),
        obj_item: (value, key) => value[key]
      }
    },
    {
      uploads: {
        name: ['first', 'second'],
        url: ['/first', '/second']
      }
    }
  )
  assert.deepEqual(result, ['first', 'second'])
})

test('legacy callback translation becomes a structured V5 sysutil call', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.result.$SF_obj_translateData()',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const translateData = findAst(
    ast,
    item => item.op === 'sysutil' && item.val === 'obj_translateData'
  )
  assert.ok(translateData)
  assert.equal(collectAst(ast, item => item.op === 'jsfn').length, 0)
  assert.doesNotMatch(JSON.stringify(ast), /\$SF_obj_translateData/)

  const code = ast2js({
    ast,
    eventNodeId: 'test-node',
    getNodeByIdFunc() {}
  })
  assert.match(code, /\$sys\.util\.obj_translateData\(/)
  const objTranslateData = value => {
    if (!value.mapping) return value
    const result = {}
    Object.keys(value).forEach(key => {
      const translatedKey = value.mapping[key]
      result[key] = value[key]
      if (translatedKey) result[translatedKey] = value[key]
    })
    return result
  }
  const evaluate = result =>
    new Function('$sys', 'param', `return ${code}`)(
      { util: { obj_translateData: objTranslateData } },
      { result }
    )

  const mapped = {
    mapping: { cityName: 'city' },
    cityName: '杭州',
    untouched: 'kept'
  }
  assert.deepEqual(evaluate(mapped), {
    mapping: mapped.mapping,
    cityName: '杭州',
    city: '杭州',
    untouched: 'kept'
  })
  const plain = { cityName: '杭州' }
  assert.equal(evaluate(plain), plain)
})

test('stage callback param funcs preserve their editor metadata from the action contract', () => {
  loadRuntimeMaps()
  const convertActionResult = ({ str, actionBlockId, varCompName, action }) =>
    new V4FormulaCodeConverter({
      str,
      getCtx(name) {
        if (name === 'cbParams') {
          return {
            varType: 'actionResult',
            actionBlockId,
            varCompName,
            varCompScope: 'stage',
            action
          }
        }
      },
      scope: 'stage'
    }).exec()

  const translateAst = convertActionResult({
    str: 'cbParams.$SF_obj_translateData()',
    actionBlockId: 'choose-address',
    varCompName: 'ih5-wechat',
    action: 'chooseAddress'
  })
  assert.deepEqual(translateAst, {
    op: 'var',
    args: [
      {
        op: 'get',
        args: [
          {
            op: 'ref',
            val: ['local', 'choose-addressRtn']
          },
          {
            op: 'field',
            val: 'result',
            _uiSkip: true
          },
          {
            op: 'sysutil',
            val: 'obj_translateData',
            _blockType: 'paramFunc',
            _alias: 'transValue'
          }
        ],
        _blockType: '$cbParams',
        _ver: 1
      }
    ]
  })

  const uploadAst = convertActionResult({
    str: 'cbParams.$SF_sys_multiObjListToObjArr()',
    actionBlockId: 'upload-files',
    varCompName: 'ih5-sys-file',
    action: 'uploadFiles'
  })
  assert.deepEqual(findAst(uploadAst, item => item.op === 'sysutil'), {
    op: 'sysutil',
    val: 'sys_multiObjListToObjArr',
    _blockType: 'paramFunc',
    _alias: 'objData'
  })
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

test('nested logical callbacks keep references in their owning scope', () => {
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
    const jsfns = collectAst(ast, item => item.op === 'jsfn')
    if (jsfns.length > 0) {
      assertJsfnArgumentsComplete(ast)
      continue
    }
    const declaredLocals = new Set(
      collectAst(ast, item => item.op === 'lambda').flatMap(
        lambda => lambda.val || []
      )
    )
    const referencedLocals = collectAst(
      ast,
      item => item.op === 'ref' && item.val?.[0] === 'local'
    )
    assert.ok(referencedLocals.length > 0)
    for (const ref of referencedLocals) {
      assert.ok(
        declaredLocals.has(ref.val[1]),
        `未声明的 callback local: ${ref.val[1]}`
      )
    }
  }
})

test('legacy server system time is converted to a structured sobj method AST', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'Object.assign(param.formData,{updator:$refs.userId.p_value,updateTime:$serverSys.f__sysTime("ymdhms")})',
    getCtx(name) {
      if (name === 'param') return { varType: 'serviceParam' }
    },
    scope: 'server'
  }).exec()

  assert.equal(findAst(ast, item => item.op === 'jsfn'), undefined)
  const serverTimeAst = findAst(
    ast,
    item =>
      item.op === 'get' &&
      item.args?.[0]?.op === 'ref' &&
      item.args[0].val?.[0] === 'sobj' &&
      item.args[0].val?.[1] === 'serverSys'
  )
  assert.deepEqual(serverTimeAst, {
    op: 'get',
    args: [
      { op: 'ref', val: ['sobj', 'serverSys'] },
      {
        op: 'method',
        val: '_sysTime',
        args: [{ op: 'val', val: 'ymdhms' }]
      }
    ],
    _blockType: '$refs'
  })

  const code = ast2js({
    ast,
    getNodeByIdFunc() {},
    eventNodeId: 'service'
  })
  assert.match(
    code,
    /\$sys\.func\('server-sys-serverSys',\$self,'','_sysTime',"ymdhms"\)/
  )
  assert.doesNotMatch(code, /new Function|\$sobj_serverSys|\$serverSys/)
})

test('legacy server system references are structured without rewriting static names', () => {
  const getCtx = name => {
    if (name === 'fParamgroup') return { varType: 'param' }
  }
  const ordinaryAst = new V4FormulaCodeConverter({
    str: 'fParamgroup.ok && ({label:"$serverSys", $serverSys:$serverSys.f__sysTime("ymdhms"), property:plain.$serverSys})',
    getCtx,
    scope: 'server'
  }).exec()
  const ordinaryJsfn = findAst(ordinaryAst, item => item.op === 'jsfn')

  assert.match(ordinaryJsfn.val[0], /\$serverSys: \$v2/)
  assert.match(ordinaryJsfn.val[0], /label: "\$serverSys"/)
  assert.match(ordinaryJsfn.val[0], /property: plain\.\$serverSys/)
  assert.doesNotMatch(
    ordinaryJsfn.val[0],
    /\$(?:sobj_)?serverSys\.f__sysTime/
  )
  assert.equal(
    collectAst(
      ordinaryAst,
      item =>
        item.op === 'ref' &&
        item.val?.[0] === 'sobj' &&
        item.val?.[1] === 'serverSys'
    ).length,
    1
  )
  assertJsfnArgumentsComplete(ordinaryAst)

  const fullJsAst = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(item => { return $serverSys.f__sysTime("ymdhms") })',
    getCtx,
    scope: 'server'
  }).exec()
  const fullJsfn = findAst(fullJsAst, item => item.op === 'jsfn')

  assert.match(fullJsfn.val[0], /return \$v2/)
  assert.doesNotMatch(fullJsfn.val[0], /\$(?:sobj_)?serverSys\.f__sysTime/)
  assert.equal(
    collectAst(
      fullJsAst,
      item =>
        item.op === 'ref' &&
        item.val?.[0] === 'sobj' &&
        item.val?.[1] === 'serverSys'
    ).length,
    1
  )
  assertJsfnArgumentsComplete(fullJsAst)

  const shadowedAst = new V4FormulaCodeConverter({
    str: '(() => { const $serverSys = {f__sysTime:() => "local"}; return $serverSys.f__sysTime() })()',
    getCtx,
    scope: 'server'
  }).exec()
  const shadowedJsfn = findAst(shadowedAst, item => item.op === 'jsfn')

  assert.match(shadowedJsfn.val[0], /const \$serverSys =/)
  assert.match(shadowedJsfn.val[0], /return \$serverSys\.f__sysTime\(\)/)
  assert.doesNotMatch(shadowedJsfn.val[0], /\$sobj_serverSys/)
})

test('legacy runtime math methods use structured stage and server Math AST', () => {
  const convert = ({ str, scope }) =>
    new V4FormulaCodeConverter({
      str,
      scope,
      getCtx(name) {
        if (name === 'Math') {
          return {
            varType: scope === 'server' ? 'serverMath' : 'stageMath'
          }
        }
      }
    }).exec()

  const stageAst = convert({
    str: '$sys.util.math_ceil(5 / 2)',
    scope: 'stage'
  })
  assert.equal(findAst(stageAst, item => item.op === 'jsfn'), undefined)
  assert.deepEqual(stageAst, {
    op: 'var',
    args: [
      {
        op: 'get',
        _blockType: '$sysUtil',
        args: [
          { op: 'ref', val: ['js', 'Math'] },
          {
            op: 'method',
            val: 'ceil',
            args: [
              {
                op: '/',
                args: [
                  { op: 'val', val: 5 },
                  { op: 'val', val: 2 }
                ]
              }
            ]
          }
        ]
      }
    ]
  })

  const stageTextAst = convert({
    str: '"共" + $sys.util.math_ceil(5 / 2) + "页"',
    scope: 'stage'
  })
  assert.equal(findAst(stageTextAst, item => item.op === 'jsfn'), undefined)
  assert.equal(
    findAst(stageTextAst, item => item.op === 'method' && item.val === 'ceil')
      ?.val,
    'ceil'
  )

  const serverAst = convert({
    str: '$sys.util.math_abs(-3)',
    scope: 'server'
  })
  assert.equal(findAst(serverAst, item => item.op === 'jsfn'), undefined)
  assert.deepEqual(serverAst.args[0].args[0], {
    op: 'ref',
    val: ['java', 'JsMath']
  })
  assert.equal(serverAst.args[0].args[1].val, 'abs')
  const serverCode = ast2js({
    ast: serverAst,
    getNodeByIdFunc() {},
    eventNodeId: 'math-test'
  })
  assert.equal(serverCode, 'Math.abs(-(3))')
  assert.equal(new Function(`return ${serverCode}`)(), 3)
})

test('legacy runtime math methods normalize inside fallback without rewriting local $sys', () => {
  const getCtx = name => {
    if (name === 'fParamgroup') return { varType: 'param' }
    if (name === 'Math') return { varType: 'stageMath' }
  }
  const fallbackAst = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.map(item => { return $sys.util.math_floor(item) })',
    getCtx,
    scope: 'stage'
  }).exec()
  const fallbackJsfn = findAst(fallbackAst, item => item.op === 'jsfn')
  assert.match(fallbackJsfn.val[0], /Math\.floor\(item\)/)
  assert.doesNotMatch(fallbackJsfn.val[0], /\$sys\.util\.math_/)
  assertJsfnArgumentsComplete(fallbackAst)

  const shadowedAst = new V4FormulaCodeConverter({
    str: '(() => { const $sys = {util:{math_floor:value => value}}; return $sys.util.math_floor(3) })()',
    getCtx,
    scope: 'stage'
  }).exec()
  const shadowedJsfn = findAst(shadowedAst, item => item.op === 'jsfn')
  assert.match(shadowedJsfn.val[0], /const \$sys =/)
  assert.match(shadowedJsfn.val[0], /\$sys\.util\.math_floor\(3\)/)
})

test('safe native filter and logical expressions become structured V5 sysutils', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.filter((item, index) => fParamgroup.ids.$SF_arr_search(item.id) != -1).length > 0 && fParamgroup.enabled ? 228 : 224',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  assert.equal(findAst(ast, item => item.op === 'jsfn'), undefined)
  assert.ok(findAst(ast, item => item.op === 'switchexp'))
  assert.ok(findAst(ast, item => item.op === 'and'))
  const filter = findAst(
    ast,
    item => item.op === 'sysutil' && /(?:^|_)filter$/.test(item.val)
  )
  const search = findAst(
    ast,
    item => item.op === 'sysutil' && item.val === 'arr_search'
  )
  const lambda = findAst(filter, item => item.op === 'lambda')
  assert.ok(filter)
  assert.ok(search)
  assert.equal(typeof filter._blockId, 'string')
  assert.deepEqual(lambda.val, [
    `item_${filter._blockId}`,
    `index_${filter._blockId}`
  ])
  assert.match(
    JSON.stringify(search),
    new RegExp(`"local","item_${filter._blockId}"`)
  )

  // `ast2js` 的历史运行时映射不直接编译 stage `!=` 节点；另用等价的
  // `>= 0` 公式执行 sysutil/lambda/逻辑/三元链路，目标式本身仍按上面
  // 的 `!= -1` AST 断言。
  const runtimeAst = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.filter((item, index) => fParamgroup.ids.$SF_arr_search(item.id) >= 0).length > 0 && fParamgroup.enabled ? 228 : 224',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()
  const code = ast2js({
    ast: runtimeAst,
    eventNodeId: 'native-filter-test',
    getNodeByIdFunc() {}
  })
  const evaluate = param =>
    new Function('$sys', 'param', `return ${code}`)(
      {
        util: {
          objArr_filter: (value, fn) => value.filter(fn),
          arr_filter: (value, fn) => value.filter(fn),
          arr_search: (value, target) =>
            (value && value.length ? value : []).findIndex(
              item => target === item
            ),
          obj_item: (value, key) => value[key]
        }
      },
      param
    )

  assert.equal(evaluate({ items: [{ id: 1 }], ids: [1], enabled: true }), 228)
  assert.equal(
    evaluate({ items: [{ id: '1' }], ids: [1], enabled: true }),
    224,
    'V4 arr_search uses strict equality'
  )
  assert.equal(evaluate({ items: [{ id: 1 }], ids: [1], enabled: false }), 224)
})

test('unsafe native filter shapes stay in jsfn fallback', () => {
  loadRuntimeMaps()
  const formulas = [
    'fParamgroup.items.filter((item, index, array) => array.length > index).length',
    'fParamgroup.items.filter(item => item.active, fParamgroup.thisArg).length'
  ]

  for (const str of formulas) {
    const ast = new V4FormulaCodeConverter({
      str,
      getCtx(name) {
        if (name === 'fParamgroup') return { varType: 'param' }
      },
      scope: 'stage'
    }).exec()
    assert.equal(
      findAst(ast, item => item.op === 'sysutil' && /(?:^|_)filter$/.test(item.val)),
      undefined
    )
    assertJsfnArgumentsComplete(ast)
  }
})

test('legacy array search normalizes when unsafe native filter falls back', () => {
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.filter((item, index, array) => fParamgroup.ids.$SF_arr_search(item.id) != -1 && array.length > index).length > 0 && true',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.doesNotMatch(jsfn.val[0], /\$SF_arr_search/)
  assert.match(jsfn.val[0], /\.findIndex\(/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.equal(
    evaluate([{ id: 1 }, { id: '1' }], [1]),
    true,
    'V4 arr_search uses strict equality'
  )
  assert.equal(evaluate([{ id: '1' }], [1]), false)
  assert.equal(evaluate([{ id: 1 }], null), false)
})

test('legacy array search full-JS normalization evaluates receiver and target once', () => {
  const ast = new V4FormulaCodeConverter({
    str: '(() => { const __v4ArrSearchValue1 = "kept"; let receiverCount = 0; let targetCount = 0; const source = () => { receiverCount += 1; return [1] }; const target = () => { targetCount += 1; return 1 }; const result = source().$SF_arr_search(target()); return [result, receiverCount, targetCount, __v4ArrSearchValue1] })()',
    getCtx() {},
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.doesNotMatch(jsfn.val[0], /\$SF_arr_search/)
  assert.match(jsfn.val[0], /\.findIndex\(/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.deepEqual(evaluate(), [0, 1, 1, 'kept'])
})

test('value-or uses the V5 empty-value block while boolean trees keep condition or', () => {
  const getCtx = name =>
    name === 'fParamgroup' ? { varType: 'param' } : undefined
  const convert = str =>
    new V4FormulaCodeConverter({ str, getCtx, scope: 'stage' }).exec()

  const valueAst = convert('fParamgroup.order || "ASC"')
  assert.equal(valueAst.op, 'switchexp')
  assert.equal(valueAst._blockType, '$evc')
  assert.equal(valueAst.args.length, 4)
  assert.deepEqual(valueAst.args[0], {
    op: 'not',
    args: [{ op: 'not', args: [valueAst.args[1]] }]
  })
  assert.deepEqual(valueAst.args[2], {
    op: '=',
    args: [{ op: 'val' }, { op: 'val' }]
  })
  assert.deepEqual(valueAst.args[3], { op: 'val', val: 'ASC' })
  assert.equal(findAst(valueAst, item => item.op === 'or'), undefined)

  const concatAst = convert(
    '" ORDER BY " + (fParamgroup.order || "ASC")'
  )
  assert.ok(
    findAst(
      concatAst,
      item => item.op === 'switchexp' && item._blockType === '$evc'
    )
  )

  const comparisonAst = convert('(fParamgroup.value || 0) == 1')
  assert.equal(comparisonAst.op, '=')
  assert.equal(comparisonAst._blockType, '$condVal')
  assert.equal(comparisonAst.args[0]._blockType, '$evc')

  const rootBooleanAst = convert(
    'fParamgroup.a > 0 || fParamgroup.b > 0'
  )
  assert.equal(rootBooleanAst.op, 'or')
  assert.equal(rootBooleanAst._blockType, '$condVal')
  assert.equal(
    findAst(rootBooleanAst, item => item._blockType === '$evc'),
    undefined
  )

  const booleanAst = convert(
    '(fParamgroup.a > 0 || fParamgroup.b > 0) && fParamgroup.enabled'
  )
  assert.equal(booleanAst.op, 'and')
  assert.equal(booleanAst._blockType, '$condVal')
  assert.equal(booleanAst.args[0].op, 'or')
  assert.equal(
    findAst(booleanAst, item => item._blockType === '$evc'),
    undefined
  )
})

test('member access after value-or receivers preserves nested properties', () => {
  const ast = new V4FormulaCodeConverter({
    str: '((fParamgroup.row || {}).customerCompany || {}).name',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const code = ast2js({
    ast,
    eventNodeId: 'value-or-member-test',
    getNodeByIdFunc() {}
  })
  const evaluate = row =>
    new Function('$sys', 'param', `return ${code}`)(
      {
        util: {
          obj_item: (value, key) => value?.[key]
        }
      },
      { row }
    )

  assert.equal(
    evaluate({ customerCompany: { name: 'Acme' } }),
    'Acme'
  )
  assert.equal(evaluate({ customerCompany: null }), undefined)
  assert.equal(evaluate(null), undefined)

  const conditionalAst = new V4FormulaCodeConverter({
    str: 'fParamgroup.index == "invoiceCode" ? fParamgroup.row[fParamgroup.index] : ((fParamgroup.row || {}).customerCompany || {}).name',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()
  const conditionalCode = ast2js({
    ast: conditionalAst,
    eventNodeId: 'value-or-member-conditional-test',
    getNodeByIdFunc() {}
  })
  const evaluateConditional = (row, index) =>
    new Function('$sys', 'param', `return ${conditionalCode}`)(
      {
        util: {
          obj_item: (value, key) => value?.[key]
        }
      },
      { row, index }
    )

  const row = {
    invoiceCode: 'D.043847',
    customerCompany: { name: '特变电工国际工程有限公司' }
  }
  assert.equal(evaluateConditional(row, 'invoiceCode'), 'D.043847')
  assert.equal(
    evaluateConditional(row, 'customerCompany'),
    '特变电工国际工程有限公司'
  )
})

test('legacy object-array item composes with array search as structured sysutils', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.people.$SF_objArr_item(fParamgroup.ids.$SF_arr_search(fParamgroup.id), "name") || "-"',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  assert.equal(findAst(ast, item => item.op === 'jsfn'), undefined)
  assert.ok(
    findAst(
      ast,
      item => item.op === 'switchexp' && item._blockType === '$evc'
    )
  )
  assert.equal(findAst(ast, item => item.op === 'or'), undefined)
  assert.ok(
    findAst(ast, item => item.op === 'sysutil' && item.val === 'arr_search')
  )
  assert.ok(
    findAst(ast, item => item.op === 'sysutil' && item.val === 'objArr_item')
  )

  const code = ast2js({
    ast,
    eventNodeId: 'object-array-item-test',
    getNodeByIdFunc() {}
  })
  const evaluate = param =>
    new Function('$sys', 'param', `return ${code}`)(
      {
        util: {
          arr_search: (value, target) =>
            (value && value.length ? value : []).findIndex(
              item => target === item
            ),
          objArr_item: (value, row, col) => value?.[row]?.[col]
        }
      },
      param
    )
  assert.equal(
    evaluate({ people: [{ name: 'Alice' }], ids: [7], id: 7 }),
    'Alice'
  )
  assert.equal(evaluate({ people: [{ name: 'Alice' }], ids: [7], id: 8 }), '-')
  assert.equal(evaluate({ people: null, ids: [7], id: 7 }), '-')
})

test('legacy object-array item fallback preserves V4 row coercion', () => {
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.rows.map(row => { return fParamgroup.people.$SF_objArr_item(row, "name") }) || []',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.doesNotMatch(jsfn.val[0], /\$SF_objArr_item/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.deepEqual(
    evaluate(['0x10', '01', '', null], [
      { name: 'A' },
      { name: 'B' }
    ]),
    ['A', 'B', undefined, undefined]
  )
})

test('legacy array one item and getSelf normalize inside custom fallback', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.groups.$SF_arr_oneArrItem(fParamgroup.groups.findIndex((x) => x.modelData.findIndex((a) => a.index == fParamgroup.id) != -1)).modelData.$SF_getSelf().findIndex((x) => x.index == fParamgroup.target)',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.doesNotMatch(jsfn.val[0], /\$SF_arr_oneArrItem|\$SF_getSelf/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  const groups = [
    {
      modelData: [{ index: 0 }, { index: 7 }]
    },
    {
      modelData: [{ index: 0 }, { index: 7 }]
    }
  ]
  assert.equal(evaluate(groups, groups, 7, 7), 1)
})

test('legacy array one item full-JS normalization preserves coercion and single evaluation', () => {
  const ast = new V4FormulaCodeConverter({
    str: '(() => { const __v4ArrOneItemValue1 = "kept"; let receiverCount = 0; let indexCount = 0; const source = () => { receiverCount += 1; return ["A", "B"] }; const index = () => { indexCount += 1; return "01" }; const result = source().$SF_arr_oneArrItem(index()).$SF_getSelf(); const empty = null.$SF_arr_oneArrItem(0); return [result, empty, receiverCount, indexCount, __v4ArrOneItemValue1] })()',
    getCtx() {},
    scope: 'stage'
  }).exec()

  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.doesNotMatch(jsfn.val[0], /\$SF_arr_oneArrItem|\$SF_getSelf/)
  assertJsfnArgumentsComplete(ast)

  const evaluate = new Function(
    ...jsfn.val.slice(1),
    `return (${jsfn.val[0]});`
  )
  assert.deepEqual(evaluate(), ['B', undefined, 1, 1, 'kept'])
})

test('structured callback locals become explicit jsfn arguments across shadowed inner callbacks', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: 'fParamgroup.items.find(x => x.modelIndex == [...new Set(fParamgroup.items.map((x) => x.modelIndex))][fParamgroup.index])',
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const lambda = findAst(ast, item => item.op === 'lambda')
  const jsfn = findAst(ast, item => item.op === 'jsfn')
  assert.ok(lambda)
  assert.ok(jsfn)
  assertJsfnArgumentsComplete(ast)
  assert.match(jsfn.val[0], /^\$v1 ==/)
  assert.match(jsfn.val[0], /\.map\(\(?x\)? => x\.modelIndex\)/)
  assert.ok(
    findAst(
      jsfn,
      item => item.op === 'ref' && item.val?.[0] === 'local' && item.val?.[1] === lambda.val[0]
    )
  )

  const code = ast2js({
    ast,
    eventNodeId: 'shadowed-callback-local-test',
    getNodeByIdFunc() {}
  })
  const items = [
    { modelIndex: 2 },
    { modelIndex: 4 }
  ]
  const result = new Function('$sys', 'param', `return ${code}`)(
    {
      util: {
        objArr_find: (value, callback) => value.find(callback),
        obj_item: (value, key) => value[key]
      }
    },
    { items, index: 1 }
  )
  assert.equal(result, items[1])
})

test('nested callback locals stay in the owning jsfn scope', () => {
  loadRuntimeMaps()
  const ast = new V4FormulaCodeConverter({
    str: "fParamgroup.items.filter(item => ['departmentOneId','departmentTwoId'].every(key => fParamgroup.allowed.includes(item[key])))",
    getCtx(name) {
      if (name === 'fParamgroup') return { varType: 'param' }
    },
    scope: 'stage'
  }).exec()

  const jsfns = collectAst(ast, item => item.op === 'jsfn')
  assert.equal(
    jsfns.some(
      jsfn =>
        jsfn.val?.[0]?.trim() === 'key' &&
        (jsfn.args?.length || 0) === 0
    ),
    false
  )
  assertJsfnArgumentsComplete(ast)

  const code = ast2js({
    ast,
    eventNodeId: 'test-node',
    getNodeByIdFunc() {}
  })
  const result = new Function('$sys', 'param', `return ${code}`)(
    {
      util: {
        objArr_filter: (value, fn) => value.filter(fn),
        arr_every: (value, fn) => value.every(fn),
        arr_includes: (value, item) => value.includes(item),
        obj_item: (value, key) => value[key]
      }
    },
    {
      items: [
        { departmentOneId: 1, departmentTwoId: 2 },
        { departmentOneId: 1, departmentTwoId: 3 }
      ],
      allowed: [1, 2]
    }
  )
  assert.deepEqual(result, [
    { departmentOneId: 1, departmentTwoId: 2 }
  ])
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
