import test from 'node:test'
import assert from 'node:assert/strict'
import jsep from './jsepWrap.js'
import V4FormulaCodeConverter from './V4FormulaCodeConverter.js'
import ExprAstToString from './ExprAstToString.js'

const assertSingleLineJsfn = jsfn => {
  assert.equal(/[\r\n]/.test(jsfn.val[0]), false)
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
