import { convertEditorValue } from '../formula.js'
import { CON_OP_MAP } from '../const.js'

// 处理前台直接调db的转换
function dealDbStageMethodValue({ value, nodeId, blockId, svcInvokeArgs }) {
  let result = convertEditorValue({
    value,
    nodeId,
    blockId
  })
  // value非常量时，作为服务入参传入
  if (svcInvokeArgs && result?.op !== 'val') {
    svcInvokeArgs.push(result)
    let paramName = 'param' + svcInvokeArgs.length
    result = {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['param', paramName]
            }
          ],
          _cbParamsType: 'serviceParam',
          _blockType: '$cbParams',
          _ver: 1
        }
      ]
    }
  }
  return result
}

function convertMultiKeyValue(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  const order = ['key', 'col', 'row', 'value']
  return {
    op: 'list',
    args: value.map(v => {
      let dictArgs = []
      Object.keys(v)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))
        .forEach(key => {
          dictArgs.push(
            {
              op: 'val',
              val: key
            },
            convertEditorValue({ value: v[key], nodeId, blockId })
          )
        })
      return {
        op: 'dict',
        args: dictArgs
      }
    })
  }
}

function convertMultiPureKeyValue(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  let dictArgs = []
  value.forEach(v => {
    dictArgs.push(
      { op: 'val', val: v.key },
      convertEditorValue({ value: v.value, nodeId, blockId })
    )
  })

  return {
    op: 'dict',
    args: dictArgs
  }
}

function convertMultiValue(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return convertEditorValue({ value: v.value, nodeId, blockId })
    })
  }
}

function convertNormalCons(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return {
        op: 'dict',
        args: [
          {
            op: 'val',
            val: 'pred'
          },
          {
            op: 'val',
            val: v.flag
          },
          {
            op: 'val',
            val: 'column'
          },
          convertEditorValue({ value: v.field, nodeId, blockId }),
          {
            op: 'val',
            val: 'comp'
          },
          {
            op: 'val',
            val: v.opt
          },
          {
            op: 'val',
            val: 'value'
          },
          convertEditorValue({ value: v.value, nodeId, blockId })
        ]
      }
    })
  }
}

function convertNormalUpdates(value, nodeId, blockId, svcInvokeArgs) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return {
        op: 'dict',
        args: [
          {
            op: 'val',
            val: 'column'
          },
          dealDbStageMethodValue({
            value: v.field,
            nodeId,
            blockId,
            svcInvokeArgs
          }),
          {
            op: 'val',
            val: 'op'
          },
          dealDbStageMethodValue({
            value: v.opt,
            nodeId,
            blockId,
            svcInvokeArgs
          }),
          {
            op: 'val',
            val: 'value'
          },
          dealDbStageMethodValue({
            value: v.value,
            nodeId,
            blockId,
            svcInvokeArgs
          })
        ]
      }
    })
  }
}

function convertNormalOrders(value, isDb = false, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return {
        op: 'dict',
        args: [
          {
            op: 'val',
            val: 'column'
          },
          convertEditorValue({ value: v.field, nodeId, blockId }),
          {
            op: 'val',
            val: 'asc'
          },
          isDb
            ? { op: 'val', val: v.asc }
            : convertEditorValue({ value: v.asc, nodeId, blockId })
        ]
      }
    })
  }
}

function convertDbRange(value, nodeId, blockId, svcInvokeArgs) {
  if (!value) {
    return { op: 'val' }
  }

  let offset = { op: 'val' }
  if (value.start && value.start.code) {
    offset = dealDbStageMethodValue({
      value: value.start,
      nodeId,
      blockId,
      svcInvokeArgs
    })
    if (offset.op === 'val' && typeof offset.val === 'number') {
      offset.val = offset.val - 1
    } else {
      offset = {
        op: '-',
        args: [
          offset,
          {
            op: 'val',
            val: 1
          }
        ]
      }
    }
  }

  let limit = { op: 'val' }
  if (value.end && value.end.code) {
    limit = dealDbStageMethodValue({
      value: value.end,
      nodeId,
      blockId,
      svcInvokeArgs
    })
    if (value.start && value.start.code) {
      if (
        limit.op === 'val' &&
        typeof limit.val === 'number' &&
        offset.op === 'val' &&
        typeof offset.val === 'number'
      ) {
        limit.val = limit.val - offset.val
      } else {
        limit = {
          op: '-',
          args: [limit, offset]
        }
      }
    }
  }

  return {
    op: 'dict',
    args: [
      {
        op: 'val',
        val: 'offset'
      },
      offset,
      {
        op: 'val',
        val: 'limit'
      },
      limit
    ]
  }
}

function convertDbCons(value, nodeId, blockId, svcInvokeArgs) {
  if (!value) {
    return { op: 'val' }
  }
  function genConItemAst(conItem) {
    if (!conItem.field || !conItem.value || !conItem.value.code) {
      return { op: 'dict', args: [] }
    }

    let _value = dealDbStageMethodValue({
      value: conItem.value,
      nodeId,
      blockId,
      svcInvokeArgs
    })

    return {
      op: 'dict',
      args: [
        {
          op: 'val',
          val: 'op'
        },
        {
          op: 'val',
          val: CON_OP_MAP[conItem.opt]
        },
        {
          op: 'val',
          val: 'col'
        },
        {
          op: 'val',
          val: conItem.field || undefined
        },
        {
          op: 'val',
          val: 'val'
        },
        _value
      ]
    }
  }
  let result = { op: 'val' }
  let ors = []
  let ands = []
  value.forEach((con, index) => {
    if (con.flag !== 'or') {
      ands.push(con)
    } else {
      ors.push(ands)
      ands = []
      ands.push(con)
    }
    if (index === value.length - 1) {
      ors.push(ands)
    }
  })

  if (ors.length > 1) {
    // 有or
    result = {
      op: 'list',
      args: [
        {
          op: 'dict',
          args: [
            {
              op: 'val',
              val: 'op'
            },
            {
              op: 'val',
              val: 'or'
            },
            {
              op: 'val',
              val: 'args'
            },
            {
              op: 'list',
              args: ors.map(orItem => {
                return {
                  op: 'dict',
                  args: [
                    {
                      op: 'val',
                      val: 'op'
                    },
                    {
                      op: 'val',
                      val: 'and'
                    },
                    {
                      op: 'val',
                      val: 'args'
                    },
                    {
                      op: 'list',
                      args: orItem.map(conItem => {
                        return genConItemAst(conItem)
                      })
                    }
                  ]
                }
              })
            }
          ]
        }
      ]
    }
  } else {
    // 没有or
    result = {
      op: 'list',
      args: []
    }
    let andArray = ors[0]
    andArray.forEach(conItem => {
      result.args.push(genConItemAst(conItem))
    })
  }

  return result
}

function convertObjJsonParamsSelect(value, nodeId, blockId) {
  if (!value || value.length === 0) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      let path
      if (v.jType === 'jsonEnd' && v.name === '_jArrValue') {
        path = {
          op: 'val',
          val: '_jArrValue'
        }
      } else if (
        v.name === '数组元素' &&
        (v.hasOwnProperty('v41Input') || v.hasOwnProperty('input'))
      ) {
        let _value =
          !v.v41Input?.code && v.input ? { code: v.input } : v.v41Input
        let convertValue = convertEditorValue({
          value: _value,
          nodeId,
          blockId
        })
        if (convertValue?.op !== 'var') {
          convertValue = { op: 'var', args: [convertValue] }
        }
        path = convertValue
      } else {
        path = {
          op: 'val',
          val: v.name
        }
      }

      return path
    })
  }
}

function convertObjJsonMultiPaths(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  let args = []
  value.forEach(v => {
    let { path } = v || {}
    let pathList = { op: 'val' }
    if (path?.length > 0) {
      pathList = { op: 'list', args: [] }
      path.forEach(p => {
        if (p.jType === 'jsonEnd' && p.name === '_jArrValue') {
          pathList.args.push({
            op: 'val',
            val: '_jArrValue'
          })
        } else if (p.name === '数组元素' && p.hasOwnProperty('v41Input')) {
          let convertValue = convertEditorValue({
            value: p.v41Input,
            nodeId,
            blockId
          })
          if (convertValue?.op !== 'var') {
            convertValue = { op: 'var', args: [convertValue] }
          }
          pathList.args.push(convertValue)
        } else {
          pathList.args.push({
            op: 'val',
            val: p.name
          })
        }
      })
    }
    let _value = convertEditorValue({ value: v.value, nodeId, blockId })

    args.push(pathList, _value)
  })

  return {
    op: 'list',
    args
  }
}

function convertJsonEditor(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  let convertValue = convertEditorValue({ value, nodeId, blockId })
  convertValue._blockType = 'json'
  return convertValue
}

function convertDbCols(value, nodeId, blockId, svcInvokeArgs) {
  if (!value) {
    return { op: 'val' }
  }

  if (value.type === 'param') {
    let args = []
    for (let name in value.value) {
      if (value.value[name]) {
        args.push({
          op: 'dict',
          args: [
            {
              op: 'val',
              val: 'name'
            },
            {
              op: 'val',
              val: name
            }
          ]
        })
      }
    }
    return {
      op: 'list',
      _blockType: 'param',
      args
    }
  } else {
    let convertValue = dealDbStageMethodValue({
      value: value.value,
      nodeId,
      blockId,
      svcInvokeArgs
    })
    convertValue._blockType = 'json'
    return convertValue
  }
}

function convertDbGroupByCols(value) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return {
        op: 'dict',
        args: [
          {
            op: 'val',
            val: 'name'
          },
          {
            op: 'val',
            val: v.name
          },
          {
            op: 'val',
            val: 'aggregate'
          },
          {
            op: 'val',
            val: v.aggregate
          }
        ]
      }
    })
  }
}

function convertDbGroupCols(value) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return {
        op: 'val',
        val: v.column
      }
    })
  }
}

function convertBabylonVector3(value, nodeId, blockId) {
  if (!value) {
    return { op: 'val' }
  }

  return {
    op: 'list',
    args: value.map(v => {
      return convertEditorValue({ value: v.value, nodeId, blockId })
    })
  }
}

function convertApiParamsKeyValue(value, nodeId, blockId) {
  if (value.length === 0) {
    return { op: 'dict' }
  }

  if (value[0].type === 'JsonEditor') {
    // 自定义输入
    let ast = convertEditorValue({ value: value[0].value, nodeId, blockId })
    ast._blockType = 'json'
    return ast
  } else {
    let dictArgs = []
    value.forEach(v => {
      dictArgs.push(
        { op: 'val', val: v.name },
        convertEditorValue({ value: v.value, nodeId, blockId })
      )
    })
    return {
      op: 'dict',
      _blockType: 'param',
      args: dictArgs
    }
  }
}

export {
  dealDbStageMethodValue,
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
}
