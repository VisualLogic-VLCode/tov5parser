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

function genConObj({ conItem, scope, nodeId, blockId }) {
  let { value1, value2, operator } = conItem
  let valueAst1 = convertEditorValue({
    value: value1,
    nodeId,
    blockId
  })
  let valueAst2 = convertEditorValue({
    value: value2,
    nodeId,
    blockId,
    legacyFormulaType: 'conditionValue'
  })
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

function convertBlockCons({ cons, scope, nodeId, blockId }) {
  cons = cons.filter(con => {
    return con.enable
  })
  // 将cons数组转为ast格式
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

  let conAst = {}
  if (ors.length > 1) {
    // 有or
    conAst.op = 'or'
    conAst.args = []
    ors.forEach(orItem => {
      if (orItem.length > 1) {
        // 多个条件
        let andObj = {
          op: 'and',
          args: []
        }
        orItem.forEach(conItem => {
          let conObj = genConObj({ conItem, scope, nodeId, blockId })
          andObj.args.push(conObj)
        })
        conAst.args.push(andObj)
      } else {
        // 单个条件
        let conObj = genConObj({ conItem: orItem[0], scope, nodeId, blockId })
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
      andArray.forEach(conItem => {
        let conObj = genConObj({ conItem, scope, nodeId, blockId })
        conAst.args.push(conObj)
      })
    } else {
      // 单个条件
      conAst = genConObj({ conItem: andArray[0], scope, nodeId, blockId })
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
function convertSplitIfCons({ cons, nodeId, conversionState }) {
  // 存在特殊情况，有的cons直接是个这样的数组['$refs.I_bmrwk9na3j50000nm140', 'notIn', '$refs.bmrwk9na3j50000nm1d0.p_value']，需特殊处理
  if (typeof cons[0] === 'string') {
    cons[0] = { code: cons[0] }
    cons[2] = { code: cons[2] }
    cons = [cons]
  }
  let ors = []
  let ands = []
  cons.forEach((con, index) => {
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

  let conAst = {}
  if (ors.length > 1) {
    // 有or
    conAst.op = 'or'
    conAst.args = []
    ors.forEach(orItem => {
      if (orItem.length > 1) {
        // 多个条件
        let andObj = {
          op: 'and',
          args: []
        }
        orItem.forEach(conItem => {
          let conObj = genIfConObj({ conItem, nodeId, conversionState })
          andObj.args.push(conObj)
        })
        conAst.args.push(andObj)
      } else {
        // 单个条件
        let conObj = genIfConObj({
          conItem: orItem[0],
          nodeId,
          conversionState
        })
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
      andArray.forEach(conItem => {
        let conObj = genIfConObj({ conItem, nodeId, conversionState })
        conAst.args.push(conObj)
      })
    } else {
      // 单个条件
      conAst = genIfConObj({
        conItem: andArray[0],
        nodeId,
        conversionState
      })
    }
  }

  return conAst
}

function isUsableRuntimeConditionAst(ast, conversionState) {
  if (!ast || conversionState?.dropped) return false
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

function convertIfCons({ cons, nodeId, runtimeCode }) {
  const checkpoint = createDiagCheckpoint()
  const splitState = {}
  const splitAst = convertSplitIfCons({
    cons,
    nodeId,
    conversionState: splitState
  })
  if (!splitState.dropped) return splitAst

  const splitDiagRecords = getDiagRecordsSince(checkpoint)
  rollbackDiagCheckpoint(checkpoint)

  const runtimeState = {}
  const runtimeAst = convertRuntimeExpression({
    code: runtimeCode,
    nodeId,
    conversionState: runtimeState
  })
  if (isUsableRuntimeConditionAst(runtimeAst, runtimeState)) {
    return runtimeAst
  }

  // 完整运行态条件无效或仍含未知运行时对象时，保留原拆分 AST 与原始
  // dropped 诊断；不能为了清日志而猜测修补源数据。
  rollbackDiagCheckpoint(checkpoint)
  appendDiagRecords(splitDiagRecords)
  return splitAst
}

export {
  genConObj,
  genForEachConObj,
  convertBlockCons,
  convertIfCons
}
