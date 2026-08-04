import V4FormulaCodeConverter from '../formulaCode/V4FormulaCodeConverter.js'
import {
  getNodeById,
  getEventBlockByBid,
  isServerRootNode,
  getNodeType
} from '../env.js'
import { pushDiagContext, popDiagContext } from './convertDiag.js'

function convertEditorValue({
  value,
  nodeId,
  blockId,
  paramName,
  cloneChildId
}) {
  if (!value) {
    return { op: 'val' }
  }

  if (typeof value === 'string') {
    return { op: 'val', val: value }
  }

  if (value.code === '' || value.code === null || value.code === undefined) {
    return { op: 'val' }
  }

  function wrapCtx(str) {
    return getCtx(str, {
      nodeId,
      blockId,
      paramName,
      cloneChildId,
      formulaValue: value
    })
  }

  let node = getNodeById(nodeId)
  let nodeInServer = isServerRootNode(node)

  let scope = nodeInServer ? 'server' : 'stage'
  pushDiagContext({ nodeId, blockId, paramName, cloneChildId, scope, code: value.code })
  try {
    return new V4FormulaCodeConverter({
      str: value.code,
      getCtx: wrapCtx,
      scope
    }).exec()
  } finally {
    popDiagContext()
  }
}

// 事件数块类型
const EVENT_BLOCK_TYPE = {
  ROOT: 'root',
  ACTION: 'action',
  CON: 'con',
  SWITCH: 'switch',
  LOOP: 'loop',
  STATUS: 'status',
  COMMENT: 'comment',
  GROUP: 'group'
}

const fakeNodeIds = [
  '$sobj_base',
  '$sobj_storage',
  '$sobj_device',
  '$sobj_file',
  '$sobj_view',
  '$sobj_serverSys' // 后台系统
]

function genTargetValueAst(targetId) {
  return {
    op: 'var',
    args: [
      {
        op: 'get',
        args: [
          {
            op: 'ref',
            val: ['var', targetId]
          },
          {
            op: 'field',
            val: 'value'
          }
        ],
        _blockType: '$refs'
      }
    ]
  }
}

function appendPathToValueAst(valueAst, pathAsts) {
  const getAst = valueAst?.args?.[0]
  if (!getAst || !Array.isArray(getAst.args)) return valueAst
  for (const pathAst of pathAsts || []) {
    if (!pathAst) continue
    getAst.args.push({
      op: 'sysutil',
      val: 'obj_item',
      _blockType: 'sysutil',
      args: [pathAst]
    })
  }
  return valueAst
}

function convertPathFormula({ value, nodeId, blockId }) {
  if (!value) return
  return convertEditorValue({ value, nodeId, blockId })
}

function genJsonPathAsts({ pathParam, nodeId, blockId }) {
  if (!Array.isArray(pathParam?.value)) return []
  const pathAsts = []
  for (const item of pathParam.value) {
    if (item?.jType === 'jsonEnd' && item?.name === '_jArrValue') {
      continue
    }
    if (
      item?.name === '数组元素' &&
      (Object.prototype.hasOwnProperty.call(item, 'v41Input') ||
        Object.prototype.hasOwnProperty.call(item, 'input'))
    ) {
      const value =
        !item.v41Input?.code && item.input
          ? { code: item.input }
          : item.v41Input
      pathAsts.push(convertPathFormula({ value, nodeId, blockId }))
    } else if (item?.name !== undefined) {
      pathAsts.push({ op: 'val', val: item.name })
    }
  }
  return pathAsts
}

function findFormulaLocation({ params, formulaValue }) {
  let codeFallback
  for (let paramIndex = 0; paramIndex < (params || []).length; paramIndex++) {
    const param = params[paramIndex]
    if (param?.value === formulaValue) {
      return { param, paramIndex }
    }
    if (param?.value?.code === formulaValue?.code && !codeFallback) {
      codeFallback = { param, paramIndex }
    }
    if (!Array.isArray(param?.value)) continue
    for (const item of param.value) {
      for (const key of ['value']) {
        if (item?.[key] === formulaValue) {
          return { param, paramIndex, item, itemKey: key }
        }
        if (
          item?.[key]?.code === formulaValue?.code &&
          !codeFallback
        ) {
          codeFallback = { param, paramIndex, item, itemKey: key }
        }
      }
    }
  }
  return codeFallback
}

function genDynamicJsonPathValueAst({ baseAst, pathAst }) {
  return {
    op: 'var',
    args: [
      {
        op: 'jsfn',
        val: [
          '(() => { try { return new Function("$v1", "return $v1" + $v2)($v1) } catch (e) { return undefined } })()',
          '$v1',
          '$v2'
        ],
        args: [baseAst, pathAst]
      }
    ]
  }
}

function genLegacyCurrentValueCtx({
  kind,
  nodeId,
  blockId,
  formulaValue
}) {
  const block = getEventBlockByBid(blockId)
  const action = block?.action
  if (!block || block.type !== EVENT_BLOCK_TYPE.ACTION || !action) return
  const targetId = block.object === 'curObj' ? nodeId : block.object
  if (!targetId || !getNodeById(targetId)) return
  const baseAst = genTargetValueAst(targetId)
  const params = action.params || []

  if (kind === 'jsonPath') {
    if (action.name === 'setPathValue') {
      const pathParam = params.find(param => param?.name === 'path')
      const pathAsts = genJsonPathAsts({ pathParam, nodeId, blockId })
      return {
        varType: 'legacyCurrentValue',
        ast: appendPathToValueAst(baseAst, pathAsts)
      }
    }
    if (action.name === 'setCusPathValue') {
      const pathParam = params.find(param => param?.name === 'path')
      const pathAst = convertPathFormula({
        value: pathParam?.value,
        nodeId,
        blockId
      })
      if (!pathAst) return
      return {
        varType: 'legacyCurrentValue',
        ast: genDynamicJsonPathValueAst({ baseAst, pathAst })
      }
    }
    return
  }

  const location = findFormulaLocation({ params, formulaValue })
  if (!location) return
  const pathValues = []
  if (
    ['setOneValue', 'setItemValue'].includes(action.name) &&
    !location.item
  ) {
    for (const param of params.slice(0, location.paramIndex)) {
      if (param?.value) pathValues.push(param.value)
    }
  } else if (
    action.name === 'setRowColsValue' &&
    location.item?.col
  ) {
    for (const param of params.slice(0, location.paramIndex)) {
      if (param?.value) pathValues.push(param.value)
    }
    pathValues.push(location.item.col)
  } else if (
    action.name === 'setMultiValue' &&
    location.item?.row &&
    location.item?.col
  ) {
    pathValues.push(location.item.row, location.item.col)
  } else {
    return
  }

  const pathAsts = pathValues.map(value =>
    convertPathFormula({ value, nodeId, blockId })
  )
  return {
    varType: 'legacyCurrentValue',
    ast: appendPathToValueAst(baseAst, pathAsts)
  }
}

function getCtx(str, extra) {
  if (!str) {
    return null
  }

  const CB_PARAMS = /^cbParams$/
  const LOOP = /^_loop.+/
  const PARAM = /^param$/
  const FUNC_GROUP_PARAM = /^fParam.+/
  const TYPE_IS = /^\$(valid_Null|valid_Chinese|valid_OddNumber|valid_EvenNumber|valid_PositiveInt|valid_Number|valid_Char|valid_Phone|valid_Identity|valid_Email|valid_BankCard|valid_Time|valid_Date|valid_Custom)$/
  const MATH = /^Math$/
  const CUR_VALUE = /^\$curValue$/
  const CUR_OBJ = /^\$curObj$/
  const CUR_JSON_PATH_VALUE = /^\$curJsonPathValue$/
  const CUR_PATH_VALUE = /^\$curPathValue$/
  const THREE_IDS = /^ids$/

  str = str.trim()
  let {
    nodeId,
    blockId,
    paramName,
    cloneChildId,
    formulaValue
  } = extra
  if (CB_PARAMS.test(str)) {
    // 动作返回结果
    let block = getEventBlockByBid(blockId)
    let actionBlock = null
    while (block && block.parentBid) {
      block = getEventBlockByBid(block.parentBid)
      if (block && block.type === EVENT_BLOCK_TYPE.STATUS) {
        // 回调
        actionBlock = getEventBlockByBid(block.parentBid)
        break
      }
    }
    if (actionBlock) {
      let objNodeType
      let objNodeInServer
      let obj = actionBlock.object
      if (fakeNodeIds.includes(obj)) {
        // 伪对象
        objNodeType = getNodeType(obj)
        objNodeInServer = obj === '$sobj_serverSys'
      } else {
        let objNodeId = obj === 'curObj' ? nodeId : obj
        let objNode = getNodeById(objNodeId)
        objNodeType = objNode?.type
        objNodeInServer = isServerRootNode(objNode)
      }
      return {
        varType: 'actionResult',
        varCompName: objNodeType,
        varCompScope: objNodeInServer ? 'server' : 'stage',
        action: actionBlock.action?.name,
        actionBlockId: actionBlock.bid
      }
    }
  } else if (LOOP.test(str)) {
    // 次数循环：循环次数
    let loopId = str.slice('_loop'.length)
    let block = getEventBlockByBid(loopId)
    if (block?.type === 'loop') {
      return {
        varType: 'forEachParams',
        forContainerId: loopId
      }
    }
  } else if (PARAM.test(str)) {
    // 事件参数
    let node = getNodeById(nodeId)
    return {
      varType: node?.type === 'data-service' ? 'serviceParam' : 'param'
    }
  } else if (FUNC_GROUP_PARAM.test(str)) {
    // 动作组入参
    let funcGroupId = str.slice('fParam'.length)
    let node = getNodeById(funcGroupId)
    if (['data-funcGroup', 'obj-funcGroup'].includes(node?.type)) {
      return {
        varType: 'param'
      }
    }
  } else if (TYPE_IS.test(str)) {
    return {
      varType: 'typeIs'
    }
  } else if (MATH.test(str)) {
    // 数学公式
    let node = getNodeById(nodeId)
    let nodeInServer = isServerRootNode(node)
    return {
      varType: nodeInServer ? 'serverMath' : 'stageMath' // 前台\后台位置里面的数学公式
    }
  } else if (CUR_VALUE.test(str)) {
    // 当前属性值
    let block = getEventBlockByBid(blockId)
    let objNodeId = cloneChildId || block?.object
    return {
      varType: 'curValue',
      varCompId: objNodeId,
      paramName
    }
  } else if (CUR_OBJ.test(str)) {
    // 当前触发对象
    return {
      varType: 'curObj',
      varCompId: nodeId
    }
  } else if (CUR_JSON_PATH_VALUE.test(str)) {
    return genLegacyCurrentValueCtx({
      kind: 'jsonPath',
      nodeId,
      blockId,
      formulaValue
    })
  } else if (CUR_PATH_VALUE.test(str)) {
    return genLegacyCurrentValueCtx({
      kind: 'path',
      nodeId,
      blockId,
      formulaValue
    })
  } else if (THREE_IDS.test(str)) {
    // 3D世界的ids
    let node = getNodeById(nodeId)
    if (node?.type?.startsWith('three-')) {
      return {
        varType: 'local'
      }
    }
  }

  return null
}

export { convertEditorValue }
