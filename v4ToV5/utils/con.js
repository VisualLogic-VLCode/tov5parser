import { parse, parseExpressionAt } from 'acorn'
import { sysOpList } from '../editorConstants.js'
import { convertEditorValue, convertRuntimeExpression } from './formula.js'
import {
  appendDiagRecords,
  createDiagCheckpoint,
  getDiagRecordsSince,
  rollbackDiagCheckpoint
} from './convertDiag.js'
import {
  CONDITION_OP_MAP_STAGE,
  CONDITION_OP_MAP_SERVER,
  IF_CONDITION_OP_MAP
} from './const.js'

function genConObj({
  conItem,
  scope,
  nodeId,
  blockId,
  conversionState,
  operandStates
}) {
  let { value1, value2, operator } = conItem
  const value1State = {}
  const value2State = {}
  let valueAst1 = convertEditorValue({
    value: value1,
    nodeId,
    blockId,
    conversionState: value1State
  })
  let valueAst2 = convertEditorValue({
    value: value2,
    nodeId,
    blockId,
    legacyFormulaType: 'conditionValue',
    conversionState: value2State
  })
  if (conversionState && (value1State.dropped || value2State.dropped)) {
    conversionState.dropped = true
  }
  if (operandStates) {
    operandStates.value1 = value1State
    operandStates.value2 = value2State
  }
  // v41的数据库返回结果.是否成功,值是"是"或"否"，转v5需要特殊处理成true或false
  let isDbSuccess = value1?.code === 'cbParams.$SF_db_isSuccess()'
  let isEqualityOperator = ['equal', 'notEqual'].includes(operator)
  if (isDbSuccess && isEqualityOperator) {
    let value2Code = value2?.code
    switch (value2Code) {
      case '是':
      case '"是"':
      case "'是'":
        valueAst2 = { op: 'val', val: true }
        break
      case '否':
      case '"否"':
      case "'否'":
        valueAst2 = { op: 'val', val: false }
        break
    }
  }
  let v5operator =
    scope === 'stage'
      ? CONDITION_OP_MAP_STAGE[operator]
      : CONDITION_OP_MAP_SERVER[operator]
  let isSysOp = sysOpList.indexOf(v5operator) >= 0
  let op = isSysOp ? 'sysop' : v5operator
  let obj = {
    op,
    args: [valueAst1, valueAst2]
  }
  if (isSysOp) {
    obj.val = v5operator
  }
  return obj
}
// 画布等的对象循环\随机对象循环
function genForEachConObj({ conItem, scope, loopVar, nodeId }) {
  let valueAst1 = conItem?.prop?.name
    ? {
        op: 'var',
        args: [
          {
            op: 'get',
            args: [
              {
                op: 'ref',
                val: ['local', loopVar]
              },
              {
                op: 'index',
                args: [
                  {
                    op: 'val',
                    val: 1
                  }
                ],
                _uiSkip: true
              },
              {
                op: 'field',
                val: conItem.prop.name
              }
            ],
            _blockType: '$cbParams',
            _cbParamsType: 'forEachParamsIndex'
          }
        ]
      }
    : { op: 'val' }
  let valueAst2 = convertEditorValue({
    value: conItem.value,
    nodeId,
    blockId: loopVar,
    legacyFormulaType: 'conditionValue'
  })
  let operator =
    scope === 'stage'
      ? CONDITION_OP_MAP_STAGE[conItem.operator]
      : CONDITION_OP_MAP_SERVER[conItem.operator]
  let op = sysOpList.indexOf(operator) >= 0 ? 'sysop' : operator
  let obj = {
    op,
    args: [valueAst1, valueAst2]
  }
  if (sysOpList.indexOf(operator) >= 0) {
    obj.val = operator
  }
  return obj
}

function groupBlockCons(cons) {
  cons = cons.filter(con => {
    return con.enable
  })
  let ors = []
  let ands = []
  cons.forEach((con, index) => {
    // 部分 V4 数据会把第一条启用条件也标为 or；它表示第一组的起点，
    // 不能在它前面创建空分组。只有已有条件时，or 才切到下一组。
    if (con.flag === 'or' && ands.length > 0) {
      ors.push(ands)
      ands = []
    }
    ands.push(con)
    if (index === cons.length - 1) {
      ors.push(ands)
    }
  })
  return ors
}

function extractSingleRuntimeIfCondition(runtimeCode) {
  if (typeof runtimeCode !== 'string' || runtimeCode.trim() === '') return
  let runtimeAst
  for (const candidate of [runtimeCode, `${runtimeCode}{}`]) {
    try {
      runtimeAst = parse(candidate, {
        ecmaVersion: 'latest',
        sourceType: 'script'
      })
      break
    } catch {
      runtimeAst = undefined
    }
  }
  if (!runtimeAst) return

  const ifStatements = []
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (value.type === 'IfStatement') ifStatements.push(value)
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      walk(child)
    }
  }
  walk(runtimeAst)
  if (ifStatements.length !== 1) return

  const test = ifStatements[0].test
  if (!test || test.end > runtimeCode.length) return
  return runtimeCode.slice(test.start, test.end)
}

function convertBlockCons({ cons, scope, nodeId, blockId, runtimeCode }) {
  const ors = groupBlockCons(cons)
  let runtimeSegments
  let runtimeSegmentsResolved = false

  const convertConItem = (conItem, groupIndex, itemIndex) => {
    const checkpoint = createDiagCheckpoint()
    const splitState = {}
    const operandStates = {}
    const splitAst = genConObj({
      conItem,
      scope,
      nodeId,
      blockId,
      conversionState: splitState,
      operandStates
    })
    if (!splitState.dropped) return splitAst

    const splitDiagRecords = getDiagRecordsSince(checkpoint)
    rollbackDiagCheckpoint(checkpoint)
    if (!runtimeSegmentsResolved) {
      const runtimeCondition = extractSingleRuntimeIfCondition(runtimeCode)
      runtimeSegments = extractRuntimeConditionSegments({
        runtimeCode: runtimeCondition,
        groups: ors
      })
      runtimeSegmentsResolved = true
    }
    const segment = runtimeSegments?.[groupIndex]?.[itemIndex]
    const runtimeState = {}
    const runtimeAst = asConditionAst(
      convertRuntimeExpression({
        code: segment,
        nodeId,
        blockId,
        conversionState: runtimeState
      })
    )
    if (isUsableRuntimeConditionAst(runtimeAst, runtimeState)) {
      const repairedSplitAst = repairDroppedConditionOperands({
        splitAst,
        runtimeAst,
        operandStates
      })
      return repairedSplitAst || runtimeAst
    }

    rollbackDiagCheckpoint(checkpoint)
    appendDiagRecords(splitDiagRecords)
    return splitAst
  }

  let conAst = {}
  if (ors.length > 1) {
    // 有or
    conAst.op = 'or'
    conAst.args = []
    ors.forEach((orItem, groupIndex) => {
      if (orItem.length > 1) {
        // 多个条件
        let andObj = {
          op: 'and',
          args: []
        }
        orItem.forEach((conItem, itemIndex) => {
          let conObj = convertConItem(conItem, groupIndex, itemIndex)
          andObj.args.push(conObj)
        })
        conAst.args.push(andObj)
      } else {
        // 单个条件
        let conObj = convertConItem(orItem[0], groupIndex, 0)
        conAst.args.push(conObj)
      }
    })
  } else {
    // 没有or
    conAst.op = 'and'
    conAst.args = []
    let andArray = ors[0]
    if (andArray.length > 1) {
      // 多个条件
      andArray.forEach((conItem, itemIndex) => {
        let conObj = convertConItem(conItem, 0, itemIndex)
        conAst.args.push(conObj)
      })
    } else {
      // 单个条件
      conAst = convertConItem(andArray[0], 0, 0)
    }
  }

  return conAst
}

// if容器的条件转ast
function genIfConObj({ conItem, nodeId, conversionState }) {
  let valueAst1 = convertEditorValue({
    value: conItem[0],
    nodeId,
    conversionState
  })
  let valueAst2 = convertEditorValue({
    value: conItem[2],
    nodeId,
    legacyFormulaType: 'conditionValue',
    conversionState
  })
  let operator = IF_CONDITION_OP_MAP[conItem[1]]
  let op = sysOpList.indexOf(operator) >= 0 ? 'sysop' : operator
  let obj = {
    op,
    args: [valueAst1, valueAst2]
  }
  if (sysOpList.indexOf(operator) >= 0) {
    obj.val = operator
  }
  return obj
}
function groupIfCons(cons) {
  // 存在特殊情况，有的cons直接是个这样的数组['$refs.I_bmrwk9na3j50000nm140', 'notIn', '$refs.bmrwk9na3j50000nm1d0.p_value']，需特殊处理
  if (typeof cons?.[0] === 'string') {
    cons = [[{ code: cons[0] }, cons[1], { code: cons[2] }, cons[3]]]
  }
  let ors = []
  let ands = []
  const conList = cons || []
  conList.forEach((con, index) => {
    if (con[3] !== '||' || index === 0) {
      ands.push(con)
    } else {
      ors.push(ands)
      ands = []
      ands.push(con)
    }
    if (index === cons.length - 1) {
      ors.push(ands)
    }
  })
  return ors
}

function composeIfConditionAst(groupAsts) {
  if (groupAsts.length > 1) {
    return {
      op: 'or',
      args: groupAsts.map(items =>
        items.length > 1 ? { op: 'and', args: items } : items[0]
      )
    }
  }
  const items = groupAsts[0] || []
  if (items.length > 1) return { op: 'and', args: items }
  return items[0] || { op: 'val' }
}

function flattenLogicalExpression(ast, operator) {
  if (ast?.type === 'LogicalExpression' && ast.operator === operator) {
    return [
      ...flattenLogicalExpression(ast.left, operator),
      ...flattenLogicalExpression(ast.right, operator)
    ]
  }
  return [ast]
}

function extractRuntimeConditionSegments({ runtimeCode, groups }) {
  if (typeof runtimeCode !== 'string' || runtimeCode.trim() === '') return
  try {
    const runtimeAst = parseExpressionAt(runtimeCode, 0, {
      ecmaVersion: 'latest'
    })
    if (runtimeCode.slice(runtimeAst.end).trim() !== '') return

    const groupNodes =
      groups.length > 1
        ? flattenLogicalExpression(runtimeAst, '||')
        : [runtimeAst]
    if (groupNodes.length !== groups.length) return

    return groupNodes.map((groupNode, groupIndex) => {
      const group = groups[groupIndex]
      const itemNodes =
        group.length > 1
          ? flattenLogicalExpression(groupNode, '&&')
          : [groupNode]
      if (itemNodes.length !== group.length) return
      return itemNodes.map(itemNode =>
        runtimeCode.slice(itemNode.start, itemNode.end)
      )
    })
  } catch {
    return
  }
}

function isConditionAst(ast) {
  return [
    'and',
    'or',
    'sysop',
    '=',
    '!=',
    '>',
    '<',
    '>=',
    '<='
  ].includes(ast?.op)
}

function asConditionAst(ast) {
  if (!ast || isConditionAst(ast)) return ast
  return {
    op: 'sysop',
    val: 'isTruthy',
    args: [ast]
  }
}

function isUsableRuntimeConditionAst(ast, conversionState) {
  if (!ast || conversionState?.dropped || !isConditionAst(ast)) return false
  if (ast.op === 'val' && !Object.prototype.hasOwnProperty.call(ast, 'val')) {
    return false
  }

  let usable = true
  const walk = value => {
    if (!usable || !value || typeof value !== 'object') return
    if (
      value.op === 'jsfn' &&
      /\$sys\b|\$refs\b|\$SF_|\$P_/.test(value.val?.[0] || '')
    ) {
      usable = false
      return
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      walk(child)
    }
  }
  walk(ast)
  return usable
}

function repairDroppedConditionOperands({
  splitAst,
  runtimeAst,
  operandStates
}) {
  if (
    !splitAst ||
    !runtimeAst ||
    splitAst.op !== runtimeAst.op ||
    splitAst.val !== runtimeAst.val ||
    !Array.isArray(splitAst.args) ||
    !Array.isArray(runtimeAst.args) ||
    splitAst.args.length !== runtimeAst.args.length
  ) {
    return
  }

  const droppedIndexes = [operandStates?.value1, operandStates?.value2]
    .map((state, index) => state?.dropped ? index : -1)
    .filter(index => index >= 0)
  if (droppedIndexes.length === 0) return

  const repaired = { ...splitAst, args: [...splitAst.args] }
  for (const index of droppedIndexes) {
    let replacement = runtimeAst.args[index]
    if (!replacement || typeof replacement !== 'object') return
    if (runtimeAst._blockType && replacement._blockType == null) {
      replacement = { ...replacement, _blockType: runtimeAst._blockType }
    }
    repaired.args[index] = replacement
  }
  return repaired
}

function convertIfCons({ cons, nodeId, runtimeCode }) {
  const groups = groupIfCons(cons)
  const runtimeSegments = extractRuntimeConditionSegments({
    runtimeCode,
    groups
  })
  const groupAsts = groups.map((group, groupIndex) =>
    group.map((conItem, itemIndex) => {
      const checkpoint = createDiagCheckpoint()
      const splitState = {}
      const splitAst = genIfConObj({
        conItem,
        nodeId,
        conversionState: splitState
      })
      if (!splitState.dropped) return splitAst

      const splitDiagRecords = getDiagRecordsSince(checkpoint)
      rollbackDiagCheckpoint(checkpoint)
      const segment = runtimeSegments?.[groupIndex]?.[itemIndex]
      const runtimeState = {}
      const runtimeAst = asConditionAst(
        convertRuntimeExpression({
          code: segment,
          nodeId,
          conversionState: runtimeState
        })
      )
      if (isUsableRuntimeConditionAst(runtimeAst, runtimeState)) {
        return runtimeAst
      }

      // 当前 item 没有可验证的一一对应运行态片段时，只恢复该 item 的
      // 原 AST 与 dropped 诊断；已成功转换的兄弟条件保持原样。
      rollbackDiagCheckpoint(checkpoint)
      appendDiagRecords(splitDiagRecords)
      return splitAst
    })
  )

  return composeIfConditionAst(groupAsts)
}

export {
  genConObj,
  genForEachConObj,
  convertBlockCons,
  convertIfCons
}
