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
    return getCtx(str, { nodeId, blockId, paramName, cloneChildId })
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
  const THREE_IDS = /^ids$/

  str = str.trim()
  let { nodeId, blockId, paramName, cloneChildId } = extra
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
