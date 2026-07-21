import { convertEditorValue } from './formula.js'
import { setDiagExtra, clearDiagExtra } from './convertDiag.js'
import {
  METHODS_HAS_SUB_PARAMS,
  METHODS_AS_GLOBAL_FUNCS,
  METHODS_AS_GLOBAL_STATICS,
  METHODS_AS_RETURN,
  FAKE_NODES,
  FAKE_NODES_METHOD_MAP
} from './const.js'
import { propType } from '../editorConstants.js'
import {
  convertMultiKeyValue,
  convertMultiPureKeyValue,
  convertMultiValue,
  convertNormalCons,
  convertNormalUpdates,
  convertNormalOrders,
  convertDbRange,
  convertDbCons,
  convertObjJsonParamsSelect,
  convertObjJsonMultiPaths,
  convertJsonEditor,
  convertDbCols,
  convertDbGroupByCols,
  convertDbGroupCols,
  convertBabylonVector3,
  convertApiParamsKeyValue
} from './actionUtils/actionParamConvert.js'
// 原实现从 ih5-widgets（编辑器运行时组件注册表）和 window.VxJaMap 查方法映射，
// 现统一由 env.js 基于 vlparser 的运行时组件映射提供
import { genXid, getNodeById, getWidgetMethodMap } from '../env.js'

function dealMethodParams({
  widgetName,
  methodName,
  inServer,
  preParams = []
}) {
  let _params = []
  let methodMap = getWidgetMethodMap({
    widgetName,
    methodName,
    inServer
  })
  if (methodMap) {
    let methodParams = methodMap.params
    for (let p of methodParams) {
      let find = preParams.find(item => {
        return item.name === p.name
      })
      if (find) {
        _params.push(find)
      } else {
        _params.push({ name: p.name, type: p.type, value: null })
      }
    }
  }
  return _params
}

function dealBlockBeforeConvert({ block }) {
  let extraBlock = null
  if (block) {
    let { action, bid } = block
    let actionName = action?.name
    if (actionName) {
      if (FAKE_NODES_METHOD_MAP[actionName]) {
        // 古早版本中上传图片是系统组件的方法，需转为文件接口中的方法
        // 古早版本中系统组件的alertLog方法，需转为系统界面-显示提示语
        let convertInfo = FAKE_NODES_METHOD_MAP[actionName]
        let { fakeNodeType, convertMethName = actionName } = convertInfo
        let widgetName = 'ih5-sys-' + fakeNodeType
        block.object = '$sobj_' + fakeNodeType
        block.action.name = convertMethName
        if (actionName === 'alertLog') {
          // 参数名转后有变化
          if (block.action.params?.[0]) {
            block.action.params[0].name = 'title'
          }
        }
        // 转换后的方法paramsAsObj处理
        let methodMap = getWidgetMethodMap({
          widgetName,
          methodName: convertMethName,
          inServer: false
        })
        if (methodMap) {
          let { paramsAsObj } = methodMap
          if (paramsAsObj) {
            block.action.paramsAsObj = true
          } else {
            delete block.action.paramsAsObj
          }
        }
        let params = action.params
        // 古早版本的系统-getCookies等方法，会有一个result参数，用来将获取结果赋值给某个对象。
        // 转后需要在动作后面增加一个给这个对象赋值的动作
        let findObjSelectCb = params?.find(
          p =>
            p.name === 'result' &&
            ['ObjSelectCb', 'ObjResult'].includes(p.type) &&
            p.value
        )
        if (findObjSelectCb) {
          extraBlock = {
            ln: genXid(),
            op: 'get',
            args: [
              {
                op: 'ref',
                val: ['var', findObjSelectCb.value]
              },
              {
                op: 'method',
                val: 'setValue',
                args: [
                  {
                    op: 'var',
                    args: [
                      {
                        op: 'get',
                        args: [
                          {
                            op: 'ref',
                            val: ['local', bid + 'Rtn']
                          },
                          {
                            op: 'index',
                            args: [
                              {
                                op: 'val',
                                val: 'result'
                              }
                            ]
                          }
                        ],
                        _blockType: '$cbParams',
                        _ver: 1
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
        if (findObjSelectCb) {
          block.action.callback = true
        }
        let _params = dealMethodParams({
          widgetName,
          methodName: convertMethName,
          inServer: false,
          preParams: params
        })
        block.action.params = _params
      } else if (actionName === 'paramResultReturn') {
        // 服务的paramResultReturn方法在5.0中等同于paramResult
        block.action.name = 'paramResult'
      } else if (actionName === 'wxLogin_stage' && !block.visited) {
        // 前台直接调后台用户数据库组件的发起微信公众号登录(wxLogin_stage)方法，需要在前面额外加一个动作块获取code参数
        let tempBlock = JSON.parse(JSON.stringify(block))
        let _params = dealMethodParams({
          widgetName: 'data-user',
          methodName: 'wxLogin',
          inServer: false,
          preParams: tempBlock.action.params
        })
        _params[0].value = {
          code: '$constSys.f__currentURL()',
          str: [
            {
              type: 'obj',
              obj: '系统变量',
              nodeId: '$constSys',
              props: ['获取当前URL|URL']
            }
          ]
        }
        tempBlock.action.params = _params
        tempBlock.visited = true
        let bid = genXid()
        tempBlock.relatedBid = bid
        block.bid = bid
        block.object = '$sobj_base'
        block.action = {
          name: 'getUrlInfo',
          visible: 'all',
          callback: true,
          params: [
            {
              name: 'info',
              type: 'Formula',
              value: {
                code: '"code"',
                str: [
                  {
                    type: 'str',
                    obj: '"code"'
                  }
                ]
              }
            }
          ]
        }
        block.children = [
          {
            bid: genXid(),
            type: 'status',
            children: [tempBlock],
            expand: true,
            enable: true,
            option: 'finished'
          }
        ]
        block.removeChildrenStatus = true
      }
    }
  }

  return extraBlock
}

function isEmptyParamValue({ param }) {
  return (
    param?.value === undefined ||
    param?.value === null ||
    (param?.type === 'Formula' && param.value?.code === '')
  )
}

// v4 公式编辑器会把部分本质为文本的动作参数也保存成 { code, str }。
// 这里只处理有明确参数语义且不可能是合法 JS 表达式的三类值，避免把真正的
// 公式解析错误一概吞成字符串。
function getLegacyFormulaTextValue({ param, paramName }) {
  const code = param?.value?.code
  if (typeof code !== 'string') return undefined

  const name = paramName || param?.name
  const trimmed = code.trim()
  if (
    name === 'path' &&
    /^(?:\.[\p{L}\p{N}_$]+)+$/u.test(trimmed)
  ) {
    return trimmed
  }
  if (
    name === 'paddingRight' &&
    /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rpx|em|rem|%|vh|vw|vmin|vmax)$/i.test(
      trimmed
    )
  ) {
    return trimmed
  }
  if (
    name === 'info' &&
    (trimmed === 'typeof' ||
      /^\d+\p{Script=Han}[\p{L}\p{N}_-]*$/u.test(trimmed) ||
      /^[\p{L}\p{N}_-]+(?:\s+[\p{L}\p{N}_-]+)+$/u.test(trimmed) ||
      /^[\p{L}\p{N}_-]+(?:\s*,\s*[\p{L}\p{N}_-]+)+$/u.test(trimmed))
  ) {
    return trimmed
  }
  return undefined
}

function convertActionParamValue({
  param,
  paramsAsObj = false,
  paramType,
  nodeId,
  blockId,
  paramName,
  cloneChildId
}) {
  let result = { op: 'val' }

  // 动作参数名仅通过诊断通道记录（不传 paramName，避免影响 $curValue 的 ctx 行为）
  setDiagExtra({ actionParamName: param?.name })
  if (!isEmptyParamValue({ param })) {
    const legacyTextValue = getLegacyFormulaTextValue({ param, paramName })
    if (legacyTextValue !== undefined) {
      clearDiagExtra()
      return { op: 'val', val: legacyTextValue }
    }
    switch (param.type) {
      case propType.Formula:
      case propType.FormulaColor:
      case propType.FormulaJson:
        result = convertEditorValue({
          value: param.value,
          nodeId,
          blockId,
          paramName,
          cloneChildId
        })
        break
      case propType.Boolean:
        result = { op: 'val', val: !!param.value }
        break
      case propType.Select:
      case propType.SelectUpload:
      case propType.FontSelect:
      case propType.IconSelect:
        result = { op: 'val', val: param.value }
        break
      case propType.MultiKeyValue:
      case propType.ArrColValue:
      case propType.ArrMultiValue:
        result = convertMultiKeyValue(param.value, nodeId, blockId)
        break
      case propType.MultiPureKeyValue:
        result = convertMultiPureKeyValue(param.value, nodeId, blockId)
        break
      case propType.MultiValue:
        result = convertMultiValue(param.value, nodeId, blockId)
        break
      case propType.KeyValueJson:
        // TODO: Email组件才有的,5.0目前没有这个组件了,暂不处理
        break
      case propType.NormalCons:
        result = convertNormalCons(param.value, nodeId, blockId)
        break
      case propType.NormalUpdates:
      case propType.DbUpdate:
        result = convertNormalUpdates(param.value, nodeId, blockId)
        break
      case propType.NormalOrders:
        result = convertNormalOrders(param.value, false, nodeId, blockId)
        break
      case propType.DbRange:
        result = convertDbRange(param.value, nodeId, blockId)
        break
      case propType.DbCons:
        result = convertDbCons(param.value, nodeId, blockId)
        break
      case propType.DbOrders:
        result = convertNormalOrders(param.value, true, nodeId, blockId)
        break
      case propType.DbNumCol:
        result = param.value ? { op: 'val', val: param.value } : { op: 'val' }
        break
      case propType.ObjSelect:
      case propType.ObjResult:
      case propType.ObjSelectCb:
        result = param.value ? { op: 'val', val: param.value } : { op: 'val' }
        break
      case propType.ObjJsonParamsSelect:
        result = convertObjJsonParamsSelect(param.value, nodeId, blockId)
        break
      case propType.ObjJsonMultiPaths:
        result = convertObjJsonMultiPaths(param.value, nodeId, blockId)
        break
      case propType.JsonEditor:
        result = convertJsonEditor(param.value, nodeId, blockId)
        break
      case propType.CloneChild:
        // TODO: 画布下cloneChild待处理
        break
      case propType.DbCols:
        result = convertDbCols(param.value, nodeId, blockId)
        break
      case propType.DbSearchRange:
        // TODO: 数据库全文搜索方法的参数,5.0没有,暂不处理
        break
      case propType.DbGroupByCols:
        result = convertDbGroupByCols(param.value)
        break
      case propType.DbGroupCols:
      case propType.DbSelectCols:
        result = convertDbGroupCols(param.value)
        break
      case propType.DyQueryCons:
        // TODO: 快表相关,5.0没有,暂不处理
        break
      case propType.DyUpdate:
        // TODO: 快表相关,5.0没有,暂不处理
        break
      case propType.DyCons:
        // TODO: 快表相关,5.0没有,暂不处理
        break
      case propType.BabylonVector3:
        result = convertBabylonVector3(param.value, nodeId, blockId)
        break
      case propType.ApiParamsKeyValue:
        result = convertApiParamsKeyValue(param.value, nodeId, blockId)
        break
    }
  }

  if (paramType && !paramsAsObj) {
    result.type = paramType
  }
  if (paramsAsObj) {
    result.key = param.name
  }

  clearDiagExtra()
  return result
}

function checkMethodHasSubParams({ methodName, scope, mini = false }) {
  return (
    (METHODS_HAS_SUB_PARAMS.includes(methodName) &&
      !(methodName === 'fireFuncGroup' && scope === 'server') &&
      !(methodName === 'setCookies' && scope === 'stage')) ||
    mini
  )
}

function checkIsGlobalFunc({ methodName, scope }) {
  return scope === 'server' && METHODS_AS_GLOBAL_FUNCS.includes(methodName)
}

function checkGlobalStatic({ methodName, object }) {
  if (METHODS_AS_GLOBAL_STATICS.includes(methodName)) {
    if (methodName === 'rollback' && object === 'curObj') {
      return 'DataTransaction'
    } else if (
      ['setCookies', 'customParamResult'].includes(methodName) &&
      object === 'curObj'
    ) {
      return 'DataService'
    } else {
      let node = getNodeById(object)
      if (node && node.type === 'data-timerService') {
        return 'DataTimerService'
      }
    }
  }

  return ''
}

function checkIsReturn({ methodName, object }) {
  return object === 'curObj' && METHODS_AS_RETURN.includes(methodName)
}

function checkIsFakeNode({ object }) {
  return FAKE_NODES.includes(object)
}

function genActionObjRef({
  actionObject,
  isGlobalFunc,
  globalStatic,
  isFakeNode
}) {
  return isGlobalFunc
    ? ['global', 'Service']
    : globalStatic
    ? ['global', globalStatic]
    : isFakeNode
    ? ['sobj', actionObject.replace('$sobj_', '')]
    : ['collideObject', 'overlapObject'].includes(actionObject)
    ? ['param', 'gameObject']
    : ['collideBody', 'overlapBody'].includes(actionObject)
    ? ['param', 'body']
    : ['contactTarget', 'overlapTarget'].includes(actionObject)
    ? ['param', 'target']
    : ['var', actionObject]
}

function genMethodArgs({ action, scope, actionObject, nodeId, blockId }) {
  let args = []
  let hasSubParams = checkMethodHasSubParams({
    methodName: action.name,
    scope,
    mini: action.mini && !isModService({ action })
  })
  let params = action.params
  let paramsMap
  let errorCb = false
  let objNode = getNodeById(actionObject)
  if (actionObject && objNode) {
    if (scope === 'server') {
      let method = getWidgetMethodMap({
        widgetName: objNode.type,
        methodName: action.name,
        inServer: true
      })
      if (method?.errorCb) {
        errorCb = true
      }
      paramsMap = method?.params
      if (
        objNode.type === 'data-func' &&
        action.name === 'fireFunc' &&
        objNode.props?.inParams?.length > 0
      ) {
        paramsMap = []
        objNode.props.inParams.forEach(p => {
          paramsMap.push({ name: p.name, type: 'JsonVal' })
        })
      }
    } else {
      let method = getWidgetMethodMap({
        widgetName: objNode.type,
        methodName: action.name,
        inServer: false
      })
      let findErrorCbParam = method?.params?.find(p => {
        return p.name === '_ivx_error_cb' && p.type === 'Lambda'
      })
      errorCb = !!findErrorCbParam
    }
  }
  if (params?.length > 0) {
    if (hasSubParams) {
      let dict = { op: 'dict' }
      let dictArgs = []
      params.forEach(param => {
        if (!isEmptyParamValue({ param })) {
          dictArgs.push(
            { op: 'val', val: param.name },
            convertActionParamValue({
              param,
              nodeId,
              blockId
            })
          )
        }
      })
      dict.args = dictArgs
      args = [dict]
    } else if (action.name === 'clone') {
      // 画布和phaser等的clone方法
      let dict = { op: 'dict' }
      let dictArgs = []
      let cloneId = params[0]?.value
      params.forEach(param => {
        if (param.isProp) {
          if (!isEmptyParamValue({ param })) {
            dictArgs.push(
              { op: 'val', val: param.name },
              convertActionParamValue({
                param,
                nodeId,
                blockId,
                paramName: param.name,
                cloneChildId: cloneId
              })
            )
          }
        } else if (param.type === 'CloneChild') {
          if (param.value) {
            param.value.forEach(cParam => {
              if (cParam?.id && cParam.props?.length > 0) {
                cParam.props.forEach(cProp => {
                  if (!isEmptyParamValue({ param: cProp })) {
                    dictArgs.push(
                      { op: 'val', val: cParam.id + '.' + cProp.name },
                      convertActionParamValue({
                        param: cProp,
                        nodeId,
                        blockId,
                        paramName: cProp.name,
                        cloneChildId: cParam.id
                      })
                    )
                  }
                })
              }
            })
          }
        } else {
          args.push(
            convertActionParamValue({
              param,
              paramsAsObj: action.paramsAsObj,
              nodeId,
              blockId
            })
          )
        }
      })
      if (dictArgs.length > 0) {
        dict.args = dictArgs
      }
      let insertIndex = params.findIndex(param => {
        return param.name === 'isBottom' && !param.isProp
      })
      if (insertIndex === -1) {
        args.push(dict)
      } else {
        args.splice(insertIndex, 0, dict)
      }
    } else {
      // 特殊处理API的方法参数
      if (
        [
          'sendApiRequest',
          'openStreamUrl',
          'sendStreamRequest',
          'sendServerApiRequest',
          'prepareEventStream'
        ].includes(action.name)
      ) {
        let _params = params.filter(p => {
          return !p.pGroup
        })
        _params.unshift({
          name: 'body',
          type: 'ApiParamsKeyValue',
          value: params.filter(p => {
            return p.pGroup === 'Body'
          })
        })
        _params.unshift({
          name: 'headers',
          type: 'ApiParamsKeyValue',
          value: params.filter(p => {
            return p.pGroup === 'Header'
          })
        })
        if (action.name === 'sendApiRequest') {
          _params.push(
            { name: 'loadingCb', value: null },
            { name: '_ivx_error_cb', value: null }
          )
        }
        params = _params
      }
      args = params.map(param => {
        let paramType
        if (paramsMap) {
          let targetParam = paramsMap.find(p => {
            return p.name === param.name
          })
          if (targetParam) {
            paramType = targetParam.type
          }
        }
        return convertActionParamValue({
          param,
          paramsAsObj: action.paramsAsObj,
          paramType,
          nodeId,
          blockId
        })
      })
    }
  } else {
    // 动作组等没有入参时要传一个空对象
    if (hasSubParams) {
      args = [{ op: 'dict' }]
    }
  }
  // 数据库extra
  if (objNode?.type === 'data-db' && paramsMap) {
    let last = paramsMap.slice(-1)[0]
    if (last?.name === 'extra') {
      args.push({
        op: 'dict',
        type: 'JsonObj'
      })
    }
    // 数据库dbRandomSelect的java map中存在display: Hidden的参数,需特殊处理
    if (action.name === 'dbRandomSelect') {
      args.splice(1, 0, { op: 'val', type: 'JsonArr' })
    }
  }
  // 加错误回调
  if (errorCb) {
    let errorCbAst = { op: 'val' }
    if (action.paramsAsObj) {
      errorCbAst.key = '_ivx_error_cb'
    }
    args.push(errorCbAst)
  }

  return args
}

// 处理动作组自定义子事件,文件接口上传文件子事件等
function dealSpecialCbs({ actionCbs, block, node }) {
  let cbList = [] // 普通回调
  let funcGroupCbList = null // 动作组的子事件回调
  let fileUploadCbList = null // 文件上传等动作的开始上传和上传中回调
  let funcGroupCbs = []
  let fileUploadCbs = []
  let { action, children } = block
  let isCurObj = block.object === 'curObj'
  let actionObject = isCurObj ? node.id : block.object
  let objNode = getNodeById(actionObject)
  if (actionCbs.length > 0 && action?.name === 'fireFuncGroup') {
    actionCbs.forEach((item, index) => {
      let option = children[index].option
      if (option === null) {
        // 动作组"完成"回调
        cbList.push(item)
      } else {
        // 动作组自定义子事件
        funcGroupCbs.push({ name: option, cb: item })
      }
    })
  } else if (actionCbs.length > 0 && actionObject === '$sobj_file') {
    actionCbs.forEach((item, index) => {
      let option = children[index].option
      if (['beforeUpload', 'uploading'].includes(option)) {
        // 开始上传和上传中回调
        fileUploadCbs.push({ name: option, cb: item })
      } else {
        cbList.push(item)
      }
    })
  } else {
    cbList = actionCbs
  }
  // 将动作组自定义子事件转为lambda函数
  if (funcGroupCbs.length > 0) {
    let dictArgs = []
    funcGroupCbs.forEach(item => {
      let { name, cb } = item
      if (objNode) {
        for (let childId of objNode.children || []) {
          let childNode = getNodeById(childId)
          if (
            childNode?.type === 'data-funcGroupCb' &&
            childNode?.props?.status === name
          ) {
            dictArgs.push(
              {
                op: 'val',
                val: childNode.id
              },
              {
                op: 'alambda',
                val: ['param'],
                args: [
                  {
                    op: 'block',
                    args: cb.args[1].args || []
                  }
                ],
                skip: cb.skip
              }
            )
            break
          }
        }
      }
    })
    if (dictArgs.length > 0) {
      funcGroupCbList = [
        {
          op: 'val',
          val: '_ivx_funcGroup_cb'
        },
        {
          op: 'dict',
          args: dictArgs
        }
      ]
    }
  }
  // 将开始上传和上传中回调转为lambda函数
  if (fileUploadCbs.length > 0) {
    fileUploadCbList = []
    fileUploadCbs.forEach(item => {
      let { name, cb } = item
      fileUploadCbList.push({
        name: name + 'Cb',
        lambda: {
          op: 'alambda',
          val: ['param'],
          args: [
            {
              op: 'block',
              args: cb.args[1].args || []
            }
          ],
          skip: cb.skip
        }
      })
    })
  }

  return { cbList, funcGroupCbList, fileUploadCbList }
}

function genIvxResult({ id }) {
  if (!id) {
    return 'JsonVal'
  }

  return `IvxResult<${id.slice(0, 1).toUpperCase() + id.slice(1)}Output>`
}

// 调用后台小模块的服务方法
function isModService({ action }) {
  return action?.miniType === 'service'
}

function getActionRtnType({ action, scope, actionObject }) {
  if (isModService({ action })) {
    return genIvxResult({ id: action.name })
  }

  if (scope === 'stage') {
    if (action.name === 'fireService' && action.meth === 'invoke') {
      return genIvxResult({ id: actionObject })
    }
    return 'JsonVal'
  }

  if (actionObject) {
    let objNode = getNodeById(actionObject)
    if (METHODS_AS_GLOBAL_FUNCS.includes(action.name)) {
      return genIvxResult({ id: actionObject })
    }
    if (objNode) {
      let method = getWidgetMethodMap({
        widgetName: objNode.type,
        methodName: action.name,
        inServer: true
      })
      return method?.type || 'JsonVal'
    }
  }

  return 'JsonVal'
}

// function genDbServiceArgs({ block, nodeId }) {
//   let args = []
//   let params = block.action.params || []
//   params.forEach(param => {
//     let { name, type, value } = param
//     let paramValue = { op: 'val' }
//     if (value !== null && value !== undefined) {
//       switch (type) {
//         case 'DbCons':
//           paramValue = dealDbCons({ param, nodeId, blockId: block.bid })
//           break
//         case 'DbOrders':
//           paramValue = dealDbOrders({ param })
//           break
//         case 'DbRange':
//           paramValue = dealDbRange({ param, nodeId, blockId: block.bid })
//           break
//         case 'DbCols':
//           paramValue = dealDbCols({ param, nodeId, blockId: block.bid })
//           break
//         case 'DbUpdate':
//           paramValue = dealDbUpdate({ param, nodeId, blockId: block.bid })
//           break
//         case 'DbGroupByCols':
//           paramValue = dealDbGroupByCols({ param })
//           break
//         case 'DbGroupCols':
//         case 'DbSelectCols':
//           paramValue = dealDbGroupCols({ param })
//           break
//         case 'DbNumCol':
//           paramValue = dealDbNumCol({ param })
//           break
//         default:
//           paramValue = dealFormula({ param, nodeId, blockId: block.bid })
//           break
//       }
//     }
//     paramValue.key = name
//     args.push(paramValue)
//   })

//   return args
// }

function genLoopObj({ actionObject }) {
  let loopVar = actionObject.replace('_loopObj', '')
  return [
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
      ]
    }
  ]
}

function genActionDelay(time) {
  let ln = genXid()
  return {
    ln,
    op: 'let',
    val: [ln + 'Rtn', 'JsonVal'],
    args: [
      {
        op: 'get',
        args: [
          {
            op: 'ref',
            val: ['sobj', 'base']
          },
          {
            op: 'method',
            val: 'delaysMethod',
            args: [
              {
                key: 'time',
                op: 'val',
                val: time
              }
            ]
          }
        ]
      }
    ]
  }
}

export {
  dealBlockBeforeConvert,
  genActionObjRef,
  isEmptyParamValue,
  convertActionParamValue,
  getLegacyFormulaTextValue,
  checkMethodHasSubParams,
  checkIsGlobalFunc,
  checkGlobalStatic,
  checkIsReturn,
  checkIsFakeNode,
  genMethodArgs,
  dealSpecialCbs,
  genIvxResult,
  isModService,
  getActionRtnType,
  // genDbServiceArgs,
  genLoopObj,
  genActionDelay
}
