import { genXid, getVxJaMap } from '../env.js'
import {
  dealDbStageMethodValue,
  convertDbCons,
  convertNormalOrders,
  convertDbRange,
  convertDbCols,
  convertNormalUpdates,
  convertDbGroupByCols,
  convertDbGroupCols
} from './actionUtils/actionParamConvert.js'

function genDbServiceInfo({ svcNodeId, name, block, nodeId, objNodeType }) {
  let { object, action } = block
  let actionName = action.name.replace('_stage', '')
  let params = action.params || []
  let svcInParams = []
  let dbMethArgs = []
  let svcInvokeArgs = []
  let methodMap = getVxJaMap()[objNodeType]?.methods?.find(m => {
    return m.name === actionName
  })
  if (actionName === 'dbInsert') {
    let dictArgs = []
    params.forEach(param => {
      let { value } = param
      if (value !== null && value !== undefined) {
        dictArgs.push(
          {
            op: 'val',
            val: param.name
          },
          dealDbStageMethodValue({
            value: param.value,
            nodeId,
            blockId: block.bid,
            svcInvokeArgs
          })
        )
      }
    })
    dbMethArgs.push({
      op: 'dict',
      type: 'JsonObj',
      args: dictArgs
    })
  } else {
    params.forEach(param => {
      let { type, value } = param
      let paramValue = { op: 'val' }
      if (value !== null && value !== undefined) {
        switch (type) {
          case 'DbCons':
            paramValue = convertDbCons(value, nodeId, block.bid, svcInvokeArgs)
            break
          case 'DbOrders':
            paramValue = convertNormalOrders(value, true, nodeId, block.bid)
            break
          case 'DbRange':
            paramValue = convertDbRange(value, nodeId, block.bid, svcInvokeArgs)
            break
          case 'DbCols':
            paramValue = convertDbCols(value, nodeId, block.bid, svcInvokeArgs)
            break
          case 'DbUpdate':
            paramValue = convertNormalUpdates(
              value,
              nodeId,
              block.bid,
              svcInvokeArgs
            )
            break
          case 'DbGroupByCols':
            paramValue = convertDbGroupByCols(value)
            break
          case 'DbGroupCols':
          case 'DbSelectCols':
            paramValue = convertDbGroupCols(value)
            break
          case 'DbNumCol':
          case 'Select':
          case 'Boolean':
            paramValue = { op: 'val', val: value }
            break
          default:
            paramValue = dealDbStageMethodValue({
              value: param.value,
              nodeId,
              blockId: block.bid,
              svcInvokeArgs
            })
            break
        }
      }
      let paramMap = methodMap?.params?.find(p => {
        return p.name === param.name
      })
      paramValue.type = paramMap?.type || 'JsonVal'
      dbMethArgs.push(paramValue)
    })
  }

  // 加extra参数
  let last = methodMap ? methodMap.params.slice(-1)[0] : null
  if (last?.name === 'extra') {
    dbMethArgs.push({
      op: 'dict',
      type: 'JsonObj'
    })
  }
  // 数据库dbRandomSelect的java map中存在display: Hidden的参数,需特殊处理
  if (actionName === 'dbRandomSelect') {
    dbMethArgs.splice(1, 0, { op: 'val', type: 'JsonArr' })
  }
  // 加错误回调
  dbMethArgs.push({ op: 'val' })

  svcInvokeArgs.forEach((item, index) => {
    let paramName = 'param' + (index + 1)
    item.key = paramName
    svcInParams.push({ name: paramName, type: 'JsonVal' })
  })
  return {
    svcNodeId,
    name,
    svcInParams,
    dbNodeId: object,
    actionName,
    dbMethArgs,
    svcInvokeArgs,
    objNodeType
  }
}

// function genDbMethArgs({ params, methodMap }) {
//   let args = []
//   if (methodMap.name === 'dbInsert') {
//     let dictArgs = []
//     params.forEach(param => {
//       let { name } = param
//       dictArgs.push(
//         {
//           op: 'val',
//           val: name
//         },
//         {
//           op: 'var',
//           args: [
//             {
//               op: 'get',
//               args: [
//                 {
//                   op: 'ref',
//                   val: ['param', name]
//                 }
//               ],
//               _cbParamsType: 'serviceParam',
//               _blockType: '$cbParams',
//               _ver: 1
//             }
//           ],
//           cType: 'JsonVal'
//         }
//       )
//     })
//     args.push({
//       op: 'dict',
//       type: 'JsonObj',
//       args: dictArgs
//     })
//   } else {
//     params.forEach(param => {
//       let value = { op: 'val' }
//       let { name, type } = param
//       let paramMap = methodMap.params.find(p => {
//         return p.name === name
//       })
//       let inParam = {
//         op: 'var',
//         args: [
//           {
//             op: 'get',
//             args: [
//               {
//                 op: 'ref',
//                 val: ['param', name]
//               }
//             ],
//             _cbParamsType: 'serviceParam',
//             _blockType: '$cbParams',
//             _ver: 1
//           }
//         ]
//       }
//       switch (type) {
//         case 'DbCons':
//           value = {
//             op: 'get',
//             args: [
//               {
//                 op: 'ref',
//                 val: ['local', '$sys.util']
//               },
//               {
//                 op: 'method',
//                 val: 'dbFilterArrToJson',
//                 args: [inParam]
//               }
//             ],
//             _blockType: 'json'
//           }
//           break
//         case 'DbOrders':
//           value = {
//             op: 'get',
//             args: [
//               {
//                 op: 'ref',
//                 val: ['local', '$sys.util']
//               },
//               {
//                 op: 'method',
//                 val: 'dbOrderConvert',
//                 args: [
//                   {
//                     op: 'var',
//                     args: [inParam],
//                     _blockType: 'json'
//                   }
//                 ]
//               }
//             ],
//             _blockType: 'json'
//           }
//           break
//         case 'DbRange':
//           value = {
//             op: 'dict',
//             args: [
//               {
//                 op: 'val',
//                 val: 'offset'
//               },
//               {
//                 op: 'var',
//                 args: [
//                   {
//                     op: 'get',
//                     args: [
//                       {
//                         op: 'ref',
//                         val: ['param', name]
//                       },
//                       {
//                         op: 'field',
//                         val: 'offset'
//                       }
//                     ],
//                     _cbParamsType: 'serviceParam',
//                     _blockType: '$cbParams',
//                     _ver: 1
//                   }
//                 ]
//               },
//               {
//                 op: 'val',
//                 val: 'limit'
//               },
//               {
//                 op: 'var',
//                 args: [
//                   {
//                     op: 'get',
//                     args: [
//                       {
//                         op: 'ref',
//                         val: ['param', name]
//                       },
//                       {
//                         op: 'field',
//                         val: 'limit'
//                       }
//                     ],
//                     _cbParamsType: 'serviceParam',
//                     _blockType: '$cbParams',
//                     _ver: 1
//                   }
//                 ]
//               }
//             ]
//           }
//           break
//         case 'DbCols':
//           value = {
//             op: 'var',
//             args: [inParam],
//             _blockType: 'json'
//           }
//           break
//         case 'DbUpdate':
//           value = {
//             op: 'get',
//             args: [
//               {
//                 op: 'ref',
//                 val: ['local', '$sys.util']
//               },
//               {
//                 op: 'method',
//                 val: 'dbView_customUpdateToDbSet',
//                 args: [
//                   {
//                     op: 'var',
//                     args: [inParam]
//                   }
//                 ]
//               }
//             ],
//             _blockType: 'json'
//           }
//           break
//         case 'DbGroupByCols':
//           value = {
//             op: 'get',
//             args: [
//               {
//                 op: 'ref',
//                 val: ['local', '$sys.util']
//               },
//               {
//                 op: 'method',
//                 val: 'dbView_customGroupByColsToDbCols',
//                 args: [inParam]
//               }
//             ],
//             _blockType: 'json'
//           }
//           break
//         case 'DbGroupCols':
//         case 'DbSelectCols':
//         case 'DbNumCol':
//           value = {
//             ...inParam,
//             _blockType: 'json'
//           }
//           break
//         default:
//           value = {
//             op: 'var',
//             args: [inParam],
//             cType: 'JsonVal'
//           }
//           break
//       }
//       value.type = paramMap?.type || 'JsonVal'
//       args.push(value)
//     })
//   }

//   let last = methodMap.params.slice(-1)[0]
//   if (last?.name === 'extra' && last.subParams?.includes('filterNull')) {
//     args.push({
//       op: 'dict',
//       type: 'JsonObj',
//       args: [
//         {
//           op: 'val',
//           val: 'filterNull'
//         },
//         {
//           op: 'val',
//           val: true
//         }
//       ]
//     })
//   }
//   // 加错误回调
//   args.push({ op: 'val' })

//   return args
// }

function genSvcAst({ info }) {
  let { dbNodeId, actionName, dbMethArgs, objNodeType } = info
  let dbBlockId = genXid()
  let map = getVxJaMap()[objNodeType]?.methods?.find(m => {
    return m.name === actionName
  })
  let methType = map?.type || 'JsonVal'
  let ast = {
    op: 'block',
    args: [
      {
        ln: dbBlockId,
        op: 'let',
        val: [dbBlockId + 'Rtn', methType],
        args: [
          {
            op: 'get',
            args: [
              {
                op: 'ref',
                val: ['var', dbNodeId]
              },
              {
                op: 'method',
                val: actionName,
                args: dbMethArgs
              }
            ]
          }
        ]
      },
      {
        ln: genXid(),
        op: 'return',
        args: [
          {
            key: 'result',
            op: 'var',
            args: [
              {
                op: 'get',
                args: [
                  {
                    op: 'ref',
                    val: ['local', dbBlockId + 'Rtn']
                  }
                ],
                _blockType: '$cbParams',
                _ver: 1
              }
            ],
            cType: methType
          }
        ]
      }
    ]
  }

  return ast
}

function genDbServiceList(dbServiceMap) {
  let list = []
  for (let key in dbServiceMap) {
    let item = dbServiceMap[key]
    let { svcNodeId, name, svcInParams } = item
    let node = {
      type: 'data-service',
      id: svcNodeId,
      uis: {
        name
      },
      props: {
        outParams: [{ name: 'result', type: 'JsonVal' }],
        inParams: svcInParams
      },
      binds: {},
      field: {},
      children: [],
      events: {
        enable: true,
        list: [
          {
            eventId: genXid(),
            ast: genSvcAst({ info: item }),
            name: 'callService'
          }
        ]
      }
    }
    list.push(node)
  }

  return list
}

export { genDbServiceInfo, genDbServiceList }
