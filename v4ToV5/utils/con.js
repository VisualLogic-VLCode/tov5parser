import { sysOpList } from '../editorConstants.js'
import { convertEditorValue } from './formula.js'
import {
  CONDITION_OP_MAP_STAGE,
  CONDITION_OP_MAP_SERVER,
  IF_CONDITION_OP_MAP
} from './const.js'

const LEGACY_TEXT_CONDITION_OPERATORS = new Set([
  'equal',
  'notEqual',
  'include',
  'notInclude',
  'indexOf',
  'notIndexOf',
  'startWith',
  'endWith'
])

// v4 条件编辑器的纯文本右值也可能保存为 { code, str }。只处理文本比较
// 运算符、纯 str token，以及明确不应当作 JavaScript 求值的英文短语或
// www 主机名；变量/组件 token、数字、window.location 等仍走公式转换。
function getLegacyConditionTextValue({ value, operator }) {
  const code = value?.code
  const tokens = value?.str
  if (
    typeof code !== 'string' ||
    !LEGACY_TEXT_CONDITION_OPERATORS.has(operator) ||
    !Array.isArray(tokens) ||
    tokens.length === 0 ||
    !tokens.every(token => token?.type === 'str' && typeof token.obj === 'string')
  ) {
    return undefined
  }

  const trimmed = code.trim()
  const isPlainEnglishPhrase =
    /^[A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z][A-Za-z0-9_-]*)+$/.test(trimmed)
  const isWwwHost =
    /^www\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?::\d{1,5})?(?:[/?#][^\s]*)?$/.test(trimmed)

  return isPlainEnglishPhrase || isWwwHost ? trimmed : undefined
}

function genConObj({ conItem, scope, nodeId, blockId }) {
  let { value1, value2, operator } = conItem
  let valueAst1 = convertEditorValue({
    value: value1,
    nodeId,
    blockId
  })
  const legacyTextValue2 = getLegacyConditionTextValue({
    value: value2,
    operator
  })
  let valueAst2 = legacyTextValue2 === undefined
    ? convertEditorValue({
        value: value2,
        nodeId,
        blockId
      })
    : { op: 'val', val: legacyTextValue2 }
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
    blockId: loopVar
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
    if (con.flag !== 'or') {
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
function genIfConObj({ conItem, nodeId }) {
  let valueAst1 = convertEditorValue({
    value: conItem[0],
    nodeId
  })
  let valueAst2 = convertEditorValue({
    value: conItem[2],
    nodeId
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
function convertIfCons({ cons, nodeId }) {
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
          let conObj = genIfConObj({ conItem, nodeId })
          andObj.args.push(conObj)
        })
        conAst.args.push(andObj)
      } else {
        // 单个条件
        let conObj = genIfConObj({ conItem: orItem[0], nodeId })
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
        let conObj = genIfConObj({ conItem, nodeId })
        conAst.args.push(conObj)
      })
    } else {
      // 单个条件
      conAst = genIfConObj({ conItem: andArray[0], nodeId })
    }
  }

  return conAst
}

export {
  getLegacyConditionTextValue,
  genConObj,
  genForEachConObj,
  convertBlockCons,
  convertIfCons
}
