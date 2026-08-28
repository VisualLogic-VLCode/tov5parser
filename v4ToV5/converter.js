import {
  genXid,
  getNodeById,
  setActiveClassId,
  getActiveClassId,
} from './env.js'
import { convertBlockCons, genForEachConObj, convertIfCons } from './utils/con.js'
import { convertEditorValue } from './utils/formula.js'
import {
  appendDiagRecords,
  setDiagExtra,
  clearDiagExtra
} from './utils/convertDiag.js'
import { resolveFunctionLocalInit } from './utils/functionLocalInit.js'
import {
  convertActionParamValue,
  checkIsGlobalFunc,
  checkGlobalStatic,
  checkIsFakeNode,
  genMethodArgs,
  checkIsReturn,
  dealSpecialCbs,
  getActionRtnType,
  dealBlockBeforeConvert,
  genLoopObj,
  genActionObjRef,
  genActionDelay,
  genIvxResult,
  isModService
} from './utils/action.js'
import { genDbServiceInfo, genDbServiceList } from './utils/dbService.js'
import { nodeIsModuleInstance } from './utils/nodeType.js'
import { genLoopCon, genShuffleAst, genLoopBody } from './utils/loop.js'

function countConditionBlocks(block) {
  if (!block || typeof block !== 'object') return 0
  let count = Array.isArray(block.cons) && block.cons.some(con => con?.enable)
    ? 1
    : 0
  for (const child of block.children || []) {
    count += countConditionBlocks(child)
  }
  return count
}

export default class ConvertV4ToV5 {
  constructor() {
    this.caseData = {}
    this.visitedBlockIds = []
    this.dbServiceMap = {} // 前台调db的方法,需生成一个服务,然后前台调服务
    this.modDbServiceMap = {} // 小模块定义中,前台调db方法,需在模块内部生成一个服务
    this.nodeTypesConvertParams = [
      'data-funcGroup',
      'obj-funcGroup', // 画布下的动作组
      'data-func',
      'data-service',
      'data-transaction',
      'data-mqSvc'
    ] // 需要转换inParams和outParams的组件类型
    this.hasShuffleForEach = false // 画布下随机对象循环需要生额外randomArr和randomNum局部变量，放到事件块开头
    this.currentEventRuntimeCode = undefined
  }

  // 小模块作用域与节点索引由 env.js 的活动环境承载（原为静态属性 classId + treeStores）
  static getNodeById(nodeId) {
    return getNodeById(nodeId)
  }

  exec({ nodes }) {
    try {
      setActiveClassId(false)
      let _nodes = JSON.parse(JSON.stringify(nodes))
      Object.keys(_nodes).forEach(key => {
        let node = _nodes[key]

        switch (key) {
          case 'case': {
            if (node.uis) {
              node.uis.name += '_5.0'
            }
            this.caseData[key] = node
            break
          }

          case 'stage':
          case 'server':
            this.caseData[key] = this.convertNode({ node, scope: key })
            if (node.classes) {
              this.caseData[key].classes = node.classes.map(classNode => {
                let classId = classNode?.props?.classId
                setActiveClassId(classId)
                let _classNode = this.convertNode({
                  node: classNode,
                  scope: key
                })
                // v5 编辑器会用云端小模块的 modEdtVer 与案例版本比较。
                // v4 云端小模块没有该字段；内容转成 v5 后需补 2，否则编辑器
                // 会把它判为 v4 扩展组件并禁止展开。已有版本标记原样保留。
                const isCloudModule = !!(
                  _classNode?.props?.widgetId || _classNode?.uis?.registerID
                )
                if (isCloudModule && _classNode.props.modEdtVer == null) {
                  _classNode.props.modEdtVer = 2
                }
                if (key === 'server') {
                  let modDbServiceMap = this.modDbServiceMap[classId]
                  if (
                    modDbServiceMap &&
                    Object.keys(modDbServiceMap).length > 0
                  ) {
                    let dbServices = genDbServiceList(modDbServiceMap)
                    _classNode.children.push(...dbServices)
                  }
                }
                return _classNode
              })
              setActiveClassId(false)
            }
            break
        }
      })
      if (Object.keys(this.dbServiceMap).length > 0) {
        let dbServices = genDbServiceList(this.dbServiceMap)
        this.caseData.server.children.push(...dbServices)
      }
      return this.caseData
    } catch (e) {
      throw new Error(e.stack || e.message)
    }
  }

  convertNode({ node, scope }) {
    this.visitedBlockIds = []

    // 动作组\服务\函数等的inParams和outParams转换
    if (this.nodeTypesConvertParams.includes(node?.type)) {
      if (node.props?.inParams?.length > 0) {
        let inParams = node.props.inParams.map(p => {
          if (Object.prototype.toString.call(p) === '[object Object]') {
            if (p.default) {
              return { name: p.name, type: 'JsonVal', default: p.default }
            } else {
              return { name: p.name, type: 'JsonVal' }
            }
          } else {
            return { name: p, type: 'JsonVal' }
          }
        })
        node.props.inParams = inParams
      }
      if (node.props?.outParams?.length > 0 && node.type !== 'data-func') {
        let outParams = node.props.outParams.map(p => {
          if (Object.prototype.toString.call(p) === '[object Object]') {
            return { name: p.name, type: 'JsonVal' }
          } else {
            return { name: p, type: 'JsonVal' }
          }
        })
        node.props.outParams = outParams
      }
    }
    // if容器的条件转换
    if (node.type === 'data-if') {
      if (node.props.conditionVal) {
        node.props.conditionVal = {
          ast: convertIfCons({
            cons: node.props.conditionVal,
            nodeId: node.id,
            runtimeCode: node.binds?.value?._code
          })
        }
        node.uis.astCon = true
        // V5 data-if 的正式条件只保存在 props.conditionVal.ast。
        // V4 的 binds.value 是同一条件的运行时代码副本，不能继续作为普通
        // general AST bind 转换；同时保留节点上可能存在的其他绑定。
        if (node.binds) {
          delete node.binds.value
        }
      }
    }

    // binds的转换
    if (node?.binds && Object.keys(node.binds).length > 0) {
      node.binds = this.convertBinds({
        binds: node.binds,
        nodeId: node.id,
        scope
      })
    }

    // 事件的转换
    if (node?.events) {
      node.events = this.convertEvents({ events: node.events, node, scope })
    }

    if (node?.children?.length > 0) {
      let _children = []
      for (let child of node.children) {
        _children.push(this.convertNode({ node: child, scope }))
      }
      node.children = _children
    }

    return node
  }

  convertBinds({ binds, nodeId, scope }) {
    let _binds = {}
    Object.keys(binds).forEach(name => {
      let value = binds[name]
      // 绑定转换不传 paramName（避免影响 $curValue 的 ctx 行为），
      // 属性名仅通过诊断通道记录
      setDiagExtra({ bindName: name })
      let ast = convertEditorValue({
        value,
        nodeId
      })
      clearDiagExtra()
      _binds[name] = ast
    })

    return _binds
  }

  convertEvents({ events, node, scope }) {
    if (events.list?.length > 0) {
      let _list = []
      for (let event of events.list) {
        const previousRuntimeCode = this.currentEventRuntimeCode
        this.currentEventRuntimeCode =
          countConditionBlocks(event?.tree) === 1
            ? event?._code || event?.code
            : undefined
        try {
          const functionLocalInit = resolveFunctionLocalInit({
            owner: node,
            event,
            genId: genXid
          })
          if (functionLocalInit.applicable && !functionLocalInit.ok) {
            appendDiagRecords([
              {
                phase: 'function-local-init',
                errorName: functionLocalInit.error.name,
                errorType: functionLocalInit.error.code,
                message: functionLocalInit.error.message,
                nodeId: node.id,
                blockId: event?.tree?.bid,
                scope,
                eventName: event?.name,
                affectedNodeIds: functionLocalInit.directChildIds,
                lifecycleDetails: functionLocalInit.error.details
              }
            ])
          }
          let _event = this.convertBlock({
            block: event?.tree,
            node,
            scope,
            extra: {
              functionLocalInitPrelude: functionLocalInit.ok
                ? functionLocalInit.prelude
                : []
            }
          })
          if (_event) {
            _list.push(..._event)
          }
        } finally {
          this.currentEventRuntimeCode = previousRuntimeCode
        }
      }
      events.list = _list
    }
    delete events.order
    return events
  }

  convertBlock({ block, node, scope, sibs, extra }) {
    if (!block || this.visitedBlockIds.includes(block.bid)) {
      return
    }

    switch (block.type) {
      case 'root':
        return this.convertRoot({ block, node, scope, extra })

      case 'loop':
        return this.convertLoop({ block, node, scope })

      case 'con':
        return this.convertCon({ block, node, scope, sibs })

      case 'group':
        return this.convertGroup({ block, node, scope })

      case 'comment':
        return this.convertComment({ block })

      case 'action':
        return this.convertAction({ block, node, scope })

      case 'status':
        return this.convertActionCb({ block, node, scope, extra })
    }
  }

  convertBlockChildren({ block, node, scope, extra }) {
    let children = []
    if (block.children?.length > 0) {
      for (let child of block.children) {
        let _child = this.convertBlock({
          block: child,
          node,
          scope,
          sibs: block.children,
          extra
        })
        if (_child) {
          children.push(..._child)
        }
      }
    }

    return children
  }

  convertRoot({ block, node, scope, extra }) {
    let _block = { eventId: block.bid, ast: { op: 'block' } }
    if (block.trigger?.name) {
      _block.name = block.trigger.name
    }
    if (block.enable === false) {
      _block.skip = true
    }
    if (block.expand === false) {
      _block._fold = true
    }
    // 小模块实例根的事件,转了后要加mini标记
    if (nodeIsModuleInstance({ node })) {
      _block.mini = true
    }

    let hasCon = false
    let triggerArgs = block.trigger?.args
    if (triggerArgs) {
      switch (block.trigger.name) {
        case 'keydown': {
          let comKey = triggerArgs[0]?.value
          let keyValue = triggerArgs[1]?.value
          let keyValueCode = keyValue?.code
          if (comKey || keyValueCode) {
            hasCon = true
            let cons = []
            if (comKey) {
              cons.push({
                op: '=',
                args: [
                  {
                    op: 'var',
                    args: [
                      {
                        op: 'get',
                        args: [
                          {
                            op: 'ref',
                            val: ['param', 'ctrlKey']
                          }
                        ],
                        _blockType: '$cbParams'
                      }
                    ]
                  },
                  {
                    op: 'val',
                    val: true
                  }
                ]
              })
            }
            if (keyValueCode) {
              if (cons.length === 0) {
                let keyList = ['ctrlKey', 'shiftKey', 'altKey']
                keyList.forEach(item => {
                  cons.push({
                    op: '=',
                    args: [
                      {
                        op: 'var',
                        args: [
                          {
                            op: 'get',
                            args: [
                              {
                                op: 'ref',
                                val: ['param', item]
                              }
                            ],
                            _blockType: '$cbParams'
                          }
                        ]
                      },
                      {
                        op: 'val',
                        val: false
                      }
                    ]
                  })
                })
              }
              cons.push({
                op: 'or',
                args: [
                  {
                    op: '=',
                    args: [
                      {
                        op: 'var',
                        args: [
                          {
                            op: 'concat',
                            args: [
                              {
                                op: 'var',
                                args: [
                                  {
                                    op: 'get',
                                    args: [
                                      {
                                        op: 'ref',
                                        val: ['param', 'key']
                                      }
                                    ],
                                    _blockType: '$cbParams'
                                  }
                                ]
                              },
                              {
                                op: 'val',
                                val: ''
                              }
                            ]
                          }
                        ]
                      },
                      convertEditorValue({
                        value: keyValue,
                        nodeId: node.id,
                        blockId: block.bid
                      })
                    ]
                  },
                  {
                    op: '=',
                    args: [
                      {
                        op: 'var',
                        args: [
                          {
                            op: 'concat',
                            args: [
                              {
                                op: 'var',
                                args: [
                                  {
                                    op: 'get',
                                    args: [
                                      {
                                        op: 'ref',
                                        val: ['param', 'keyCode']
                                      }
                                    ],
                                    _blockType: '$cbParams'
                                  }
                                ]
                              },
                              {
                                op: 'val',
                                val: ''
                              }
                            ]
                          }
                        ]
                      },
                      convertEditorValue({
                        value: keyValue,
                        nodeId: node.id,
                        blockId: block.bid
                      })
                    ]
                  }
                ]
              })
            }
            let conAst = cons.length > 1 ? { op: 'and', args: cons } : cons[0]
            let switchAst = {
              op: 'switch',
              args: [conAst, { op: 'block', ln: genXid() }],
              ln: genXid()
            }
            _block.ast.args = [switchAst]
          }
          break
        }

        case 'wechatShare': {
          let shareType = triggerArgs[0]?.value
          if (shareType && shareType !== 'any') {
            hasCon = true
            let conAst = {
              op: '=',
              args: [
                {
                  op: 'var',
                  args: [
                    {
                      op: 'get',
                      args: [
                        {
                          op: 'ref',
                          val: ['param', triggerArgs[0].name]
                        }
                      ],
                      _blockType: '$cbParams'
                    }
                  ]
                },
                {
                  op: 'val',
                  val: shareType
                }
              ]
            }
            let switchAst = {
              op: 'switch',
              args: [conAst, { op: 'block', ln: genXid() }],
              ln: genXid()
            }
            _block.ast.args = [switchAst]
          }
          break
        }

        case 'collide':
        case 'overlap':
        case 'collisionstart':
        case 'collisionactive':
        case 'collisionend':
        case 'beginContact':
        case 'endContact':
        case 'beginOverlap':
        case 'endContact': {
          let target = triggerArgs[0]?.value
          if (target) {
            hasCon = true
            let refValue = [
              'beginContact',
              'endContact',
              'beginOverlap',
              'endContact'
            ].includes(block.trigger.name)
              ? 'target'
              : 'body'
            let conAst = {
              op: '=',
              args: [
                {
                  op: 'var',
                  args: [
                    {
                      op: 'get',
                      args: [
                        {
                          op: 'ref',
                          val: ['param', refValue]
                        },
                        { op: 'field', val: '_ivxId' }
                      ],
                      _blockType: '$cbParams'
                    }
                  ]
                },
                {
                  op: 'var',
                  args: [
                    {
                      op: 'get',
                      args: [
                        {
                          op: 'ref',
                          val: ['var', target]
                        },
                        {
                          op: 'field',
                          val: '_ivxId'
                        }
                      ],
                      _blockType: '$refs'
                    }
                  ]
                }
              ]
            }
            let switchAst = {
              op: 'switch',
              args: [conAst, { op: 'block', ln: genXid() }],
              ln: genXid()
            }
            _block.ast.args = [switchAst]
          }
          break
        }
      }
    }
    if (block.cons?.length > 0) {
      let conAst = convertBlockCons({
        cons: block.cons,
        scope,
        nodeId: node.id,
        blockId: block.bid,
        runtimeCode: this.currentEventRuntimeCode
      })
      if (hasCon) {
        _block.ast.args[0].args[0] = {
          op: 'and',
          args: [_block.ast.args[0].args[0], conAst]
        }
      } else {
        let switchAst = {
          op: 'switch',
          args: [conAst, { op: 'block', ln: genXid() }],
          ln: genXid()
        }
        _block.ast.args = [switchAst]
      }
      hasCon = true
    }

    this.hasShuffleForEach = false
    let _children = this.convertBlockChildren({ block, node, scope })
    if (_children.length > 0) {
      if (hasCon) {
        _block.ast.args[0].args[1].args = _children
      } else {
        _block.ast.args = _children
      }
    }

    const rootPrelude = Array.isArray(extra?.functionLocalInitPrelude)
      ? [...extra.functionLocalInitPrelude]
      : []

    // 事件块下添加画布随机对象循环需要的随机变量。把所有树外前缀在
    // convertRoot 的最终组装点一次性合并，避免多个 unshift 形成隐式顺序。
    if (_children.length > 0 && this.hasShuffleForEach) {
      rootPrelude.push(
        {
          op: 'let',
          val: ['candidateIndexes', 'JsonVal'],
          args: [
            {
              op: 'val',
              val: null
            }
          ],
          ln: genXid(),
          isLocalVar: true
        },
        {
          op: 'let',
          val: ['randomArr', 'JsonVal'],
          args: [
            {
              op: 'val',
              val: null
            }
          ],
          ln: genXid(),
          isLocalVar: true
        },
        {
          op: 'let',
          val: ['randomNum', 'long'],
          args: [
            {
              op: 'val',
              val: 0
            }
          ],
          ln: genXid(),
          isLocalVar: true
        }
      )
    }
    if (rootPrelude.length > 0) {
      _block.ast.args = [...rootPrelude, ...(_block.ast.args || [])]
    }

    return [_block]
  }

  convertLoop({ block, node, scope }) {
    let result = []
    let _block = { ln: block.bid, args: [] }
    if (block.enable === false) {
      _block.skip = true
    }
    if (block.expand === false) {
      _block._fold = true
    }
    switch (block.option) {
      case 'for': {
        _block.op = 'for'
        // 循环条件
        let loopCon = {
          op: 'let',
          val: [block.bid, 'long'],
          args: [{ op: 'step' }]
        }
        if (block.times?.code && block.times.code.trim() !== '') {
          loopCon.args[0].args = [
            {
              op: 'list',
              args: [
                { op: 'val', val: 0 },
                convertEditorValue({
                  value: block.times,
                  nodeId: node.id,
                  blockId: block.bid
                })
              ]
            }
          ]
        }
        _block.args.push(loopCon)
        break
      }

      case 'while': {
        _block.op = 'while'
        // 循环条件
        let loopCon
        if (block.cons?.length > 0) {
          loopCon = convertBlockCons({
            cons: block.cons,
            scope,
            nodeId: node.id,
            blockId: block.bid,
            runtimeCode: this.currentEventRuntimeCode
          })
        } else {
          loopCon = {
            op: '=',
            args: [
              {
                op: 'val'
              },
              {
                op: 'val'
              }
            ]
          }
        }
        _block.args.push(loopCon)
        break
      }
      // 画布中的对象循环
      case 'forEach':
      case 'shuffleForEach': {
        _block.op = 'for'
        // 循环条件
        let loopCon = genLoopCon({
          loopId: block.bid,
          range: block.addition?.range
        })
        _block.args.push(loopCon)
        break
      }
    }

    // 循环body
    let addShuffleCon =
      block.option === 'shuffleForEach' &&
      block.addition?.range &&
      block.addition?.shuffleMax?.code
    let loopBody
    let _children = this.convertBlockChildren({ block, node, scope })
    switch (block.option) {
      case 'for':
      case 'while':
        loopBody = {
          op: 'block'
        }
        if (_children.length > 0) {
          loopBody.args = _children
        }
        break

      case 'forEach':
      case 'shuffleForEach':
        loopBody = genLoopBody({
          children: _children,
          loopId: block.bid,
          additionType: block.addition?.type,
          additionCons: block.addition?.cons,
          scope,
          nodeId: node.id,
          addShuffleCon
        })
        break
    }
    _block.args.push(loopBody)
    result.push(_block)

    // 随机对象循环要生额外代码实现随机选择对象
    if (addShuffleCon) {
      this.hasShuffleForEach = true
      let shuffle = genShuffleAst({
        block,
        scope,
        nodeId: node.id,
        shuffleMax: block.addition.shuffleMax
      })

      result.unshift(...shuffle.args)
    }
    return result
  }

  convertCon({ block, node, scope, sibs = [] }) {
    // 找出与当前条件块构成if elseif else结构的后续条件块
    let continuousCons = [block]
    let index = sibs.findIndex(sib => {
      return sib.bid === block.bid
    })
    for (let i = index + 1; i < sibs.length; i++) {
      let sib = sibs[i]
      if (sib.type === 'con' && sib.option === 'else') {
        continuousCons.push(sib)
      } else {
        break
      }
    }
    let switchAst = { op: 'switch', ln: genXid(), args: [] }
    continuousCons.forEach((blockItem, conIndex) => {
      let conAst
      if (blockItem.cons?.length > 0) {
        conAst = convertBlockCons({
          cons: blockItem.cons,
          scope,
          nodeId: node.id,
          blockId: blockItem.bid,
          runtimeCode: this.currentEventRuntimeCode
        })
      } else {
        conAst = {
          op: '=',
          args: [
            {
              op: 'val'
            },
            {
              op: 'val'
            }
          ]
        }
      }

      let conBody = {
        op: 'block',
        ln: blockItem.bid
      }
      let _children = this.convertBlockChildren({
        block: blockItem,
        node,
        scope
      })
      if (_children.length > 0) {
        conBody.args = _children
      }

      if (blockItem.enable === false) {
        conAst.skip = true
      }
      if (blockItem.expand === false) {
        conBody._fold = true
      }

      // 最后一个条件块,如果没填内容,转成"其余"块
      if (conIndex > 0 && conIndex === continuousCons.length - 1) {
        if (blockItem.cons?.length === 1) {
          let con = blockItem.cons[0]
          let { value1, value2 } = con
          if ((!value1 || !value1.code) && (!value2 || !value2.code)) {
            conAst._isElse = true
          }
        }
      }

      switchAst.args.push(conAst, conBody)
      this.visitedBlockIds.push(blockItem.bid)
    })

    return [switchAst]
  }

  convertGroup({ block, node, scope }) {
    let _block = { op: 'block', ln: block.bid }
    if (block.desc) {
      _block.com = block.desc
    }
    if (block.enable === false) {
      _block.skip = true
    }
    if (block.expand === false) {
      _block._fold = true
    }

    let _children = this.convertBlockChildren({ block, node, scope })
    if (_children.length > 0) {
      _block.args = _children
    }

    return [_block]
  }

  convertComment({ block }) {
    let _block = { op: 'nop', ln: block.bid }
    if (block.comment) {
      _block.val = block.comment
    }

    return [_block]
  }

  // 处理前台调db方法
  dealDbStage({ block, nodeId, objNodeName = '', objNodeType }) {
    let ast
    let { action } = block
    let actionName = action.name.replace('_stage', '')
    let svcNodeId = genXid()
    let svcInfo = genDbServiceInfo({
      svcNodeId,
      name: objNodeName + actionName,
      block,
      nodeId,
      objNodeType
    })
    let classId = getActiveClassId()
    if (classId) {
      if (!this.modDbServiceMap[classId]) {
        this.modDbServiceMap[classId] = {}
      }
      this.modDbServiceMap[classId][svcNodeId] = svcInfo
    } else {
      this.dbServiceMap[svcNodeId] = svcInfo
    }
    ast = {
      op: 'let',
      val: [block.bid + 'Rtn', genIvxResult({ id: svcNodeId })],
      args: [
        {
          op: 'runsvc',
          val: svcNodeId,
          args: svcInfo.svcInvokeArgs
        }
      ]
    }

    return ast
  }

  convertAction({ block, node, scope }) {
    let isMultiObjs = block.object === 'multiObjs'
    let isRandMultiObjs = block.object === 'randMultiObjs'
    // 画布下选择多个对象动作,转成v5数组循环
    if (isMultiObjs || isRandMultiObjs) {
      block.object = '_loopObj' + block.bid
      block.modifyBid = true // 选择多个对象动作,由于要生额外循环块(bid用动作块的),所以动作块要改bid
      let loopBlock = JSON.parse(JSON.stringify(block))
      loopBlock.type = 'loop'
      loopBlock.option = isMultiObjs ? 'forEach' : 'shuffleForEach'
      loopBlock.children = [block]
      let loopAst = this.convertLoop({ block: loopBlock, node, scope })
      return loopAst
    }
    // 转换前对block进行预处理（主要是处理一些特殊方法）
    let addExtraBlock = dealBlockBeforeConvert({ block })
    let _block = { ln: block.modifyBid ? genXid() : block.bid }
    let isCurObj = block.object === 'curObj'
    let actionObject = isCurObj ? node.id : block.object
    // 当前服务、动作组等的设置返回结果
    let isReturn = checkIsReturn({
      methodName: block.action?.name,
      object: block.object
    })
    // 定时服务的获取当前配置、事务回滚等方法，ast特殊
    let globalStatic = checkGlobalStatic({
      methodName: block.action?.name,
      object: block.object
    })
    // 应用系统等伪对象
    let isFakeNode = checkIsFakeNode({ object: block.object })
    let isDbStageMethod = false // 是否是前台直接调用后台数据库方法
    let skipInfiniteAnimatePlay = false
    // 前台直接调后台用户数据库组件的发起微信公众号登录(wxLogin_stage)方法，需要在前面额外加一个动作块获取code参数
    let { action, relatedBid } = block
    if (action) {
      let objNode = ConvertV4ToV5.getNodeById(actionObject)
      let isLoopObj = actionObject.startsWith('_loopObj')
      let actionName = action.name
      // v4 的组件动作使用回调模型；v5 转为 async/await 后，等待 infinite
      // 动画的 play 永远不会结束。此类案例本身已由 infinite 属性启动循环，
      // 转换时跳过重复的 play 动作，避免阻塞后续动作链。
      skipInfiniteAnimatePlay =
        objNode?.type === 'data-animate' &&
        actionName === 'play' &&
        objNode.props?.infinite === true
      isDbStageMethod =
        ['data-db', 'data-user'].includes(objNode?.type) &&
        actionName?.endsWith('_stage') // 是否是前台直接调用后台数据库方法
      if (actionName === 'setProps') {
        // 设置属性
        _block.op = 'set'
        _block.args = [
          {
            op: 'ref',
            val: genActionObjRef({
              actionObject,
              globalStatic,
              isFakeNode
            })
          }
        ]
        if (isLoopObj) {
          // 画布中对象循环下的循环对象
          let loopObj = genLoopObj({ actionObject })
          _block.args = loopObj
          _block._isLoopObj = true
        }
        if (action.params?.length > 0) {
          action.params.forEach(param => {
            if (
              param.name &&
              param.value !== undefined &&
              param.value !== null &&
              !(
                Object.prototype.toString.call(param.value) ===
                  '[object Object]' &&
                (param.value.code === '' || param.value.code === null)
              )
            ) {
              let temp = {
                op: 'field',
                val: param.name,
                args: [
                  convertActionParamValue({
                    param,
                    nodeId: node.id,
                    blockId: block.bid,
                    paramName: param.name
                  })
                ]
              }
              if (param.mini) {
                temp.mini = true
              }
              _block.args.push(temp)
            }
          })
        }
      } else if (actionName === 'fireFuncCb') {
        // 动作组中触发子事件
        _block.op = 'get'
        let dictArgs = []
        action.params?.forEach(p => {
          dictArgs.push(
            { op: 'val', val: p.name },
            convertEditorValue({
              value: p.value,
              nodeId: node.id,
              blockId: block.bid
            })
          )
        })
        _block.args = [
          {
            op: 'ref',
            val: ['var', actionObject]
          },
          {
            op: 'method',
            val: 'callFuncCb',
            args: [
              {
                op: 'get',
                args: [
                  {
                    op: 'ref',
                    val: ['local', 'param']
                  }
                ]
              },
              {
                op: 'dict',
                args: dictArgs
              }
            ]
          }
        ]
      } else if (action.meth === 'emit' && actionName === 'fireEvent') {
        // 小模块触发自定义事件
        _block.op = 'emit'
        _block.val = actionObject
        if (action.params?.length > 0) {
          _block.args = action.params.map(p => {
            return {
              key: p.name,
              ...convertEditorValue({
                value: p.value,
                nodeId: node.id,
                blockId: block.bid
              })
            }
          })
        }
      } else if (action.meth === 'emit' && action.miniEmit) {
        // 更新数据至小模块
        _block.op = 'emit'
        _block.val = actionObject + 'Change'
        _block.args = [
          {
            key: 'value',
            op: 'get',
            args: [
              {
                op: 'ref',
                val: ['var', actionObject]
              },
              {
                op: 'field',
                val: 'value'
              }
            ]
          }
        ]
      } else if (isDbStageMethod) {
        // 前台直接调db的方法，需要生成一个服务，前台去调服务
        let temp = this.dealDbStage({
          block,
          nodeId: node.id,
          objNodeName: objNode.uis?.name,
          objNodeType: objNode.type
        })
        if (actionName === 'wxLogin_stage') {
          temp.args[0].args[0] = {
            key: 'param1',
            op: 'var',
            args: [
              {
                op: 'get',
                args: [
                  {
                    op: 'ref',
                    val: ['local', relatedBid + 'Rtn']
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
        }
        _block = { ..._block, ...temp }
      } else {
        let temp
        if (isReturn) {
          if (actionName === 'recordResult') {
            let methArgs = genMethodArgs({
              action,
              scope,
              nodeId: node.id,
              blockId: block.bid
            })
            methArgs[0].type = 'JsonVal'
            // 定时服务返回结果，直接调用recordResult，不加return包裹
            temp = {
              op: 'get',
              args: [
                {
                  op: 'ref',
                  val: ['global', 'DataTimerService']
                },
                {
                  op: 'method',
                  val: 'recordResult',
                  args: methArgs
                }
              ]
            }
          } else {
            // 当前服务、动作组等的设置返回结果
            temp = { op: 'return' }
            temp.args = genMethodArgs({
              action,
              scope,
              nodeId: node.id,
              blockId: block.bid
            })
          }
        } else if (
          (action.meth === 'invoke' && actionName === 'fireService') ||
          isModService({ action })
        ) {
          // 前台调服务,或者前台/后台调后台小模块的服务
          temp = { op: 'runsvc', val: actionObject }
          if (isModService({ action })) {
            temp.val = actionName + '.' + actionObject
            temp.mini = true
            temp.modId = actionObject
          }
          let args = genMethodArgs({
            action,
            scope,
            nodeId: node.id,
            blockId: block.bid
          })
          if (args.length > 0) {
            temp.args = args
          }
        } else if (action.mini) {
          // 外部调用小模块方法
          let methodArgs = genMethodArgs({
            action,
            scope,
            actionObject,
            nodeId: node.id,
            blockId: block.bid
          })
          temp = {
            op: 'get',
            mini: true,
            args: [
              {
                op: 'ref',
                val: ['var', actionObject]
              },
              {
                op: 'method',
                val: actionName,
                args: methodArgs
              }
            ]
          }
        } else {
          let isGlobalFunc = checkIsGlobalFunc({
            methodName: actionName,
            scope
          }) // 后台服务、动作组等作为global函数调用,ast特殊
          let ref = {
            op: 'ref',
            val: genActionObjRef({
              actionObject,
              isGlobalFunc,
              globalStatic,
              isFakeNode
            })
          }
          let method = {
            op: 'method',
            val: isGlobalFunc ? block.object : actionName
          }
          // // 文件接口的uploadPic和uploadPics方法的参数，转换时加上prefix参数
          // if (
          //   actionObject === '$sobj_file' &&
          //   ['uploadPic', 'uploadPics'].includes(actionName)
          // ) {
          //   let widgetMap = widgetStore.widget['ih5-sys-file']
          //   let methodMap = widgetMap.map.methodsMap[actionName]
          //   let methodParams = methodMap.params
          //   let _params = []
          //   methodParams.forEach(param => {
          //     let findPrefix = action.params.find(p => {
          //       return p.name === param.name
          //     })
          //     if (findPrefix) {
          //       _params.push(findPrefix)
          //     } else {
          //       _params.push({
          //         name: param.name,
          //         type: 'Formula',
          //         value: null
          //       })
          //     }
          //   })
          //   action.params = _params
          // }
          let methodArgs = genMethodArgs({
            action,
            scope,
            actionObject,
            nodeId: node.id,
            blockId: block.bid
          })
          if (methodArgs.length > 0) {
            method.args = methodArgs
          }
          if (globalStatic === 'DataTimerService') {
            // 定时服务的获取当前配置等方法需增加额外参数
            method.args = method.args || []
            method.args.unshift({
              op: 'val',
              val: block.object,
              type: 'String',
              _jsSkip: true
            })
          } else if (globalStatic === 'DataService') {
            // 服务设置返回cookie
            method.args = method.args || []
            method.args.unshift({
              op: 'get',
              args: [
                {
                  op: 'ref',
                  val: ['local', 'ctx']
                }
              ],
              _jsSkip: true
            })
          }

          temp = { op: 'get', args: [ref, method] }
          if (isLoopObj) {
            // 画布中对象循环下的循环对象
            let loopObj = genLoopObj({ actionObject })
            temp = { op: 'get', args: [...loopObj, method] }
          }
        }

        if (action.callback) {
          _block.op = 'let'
          // 动作块返回值类型
          let rtnType = getActionRtnType({ action, scope, actionObject })
          _block.val = [block.bid + 'Rtn', rtnType]
          _block.args = [temp]
        } else {
          _block = { ..._block, ...temp }
        }
        if (isLoopObj) {
          // 画布中对象循环下的循环对象
          _block._isLoopObj = true
        }
      }
    } else if (actionObject) {
      _block.val = genActionObjRef({
        actionObject,
        globalStatic,
        isFakeNode
      })
    }
    if (block.enable === false || skipInfiniteAnimatePlay) {
      _block.skip = true
    }
    // 当前触发对象
    if (isCurObj && !isReturn && !globalStatic) {
      _block._isCurObj = true
    }

    // 回调
    let actionCbs = this.convertBlockChildren({
      block,
      node,
      scope,
      extra: {
        associatedActionBid: block.bid,
        actionSkip: block.enable === false || skipInfiniteAnimatePlay,
        isDbStageMethod
      }
    })
    // cbList为普通回调,funcGroupCbList为动作组的子事件回调, fileUploadCbList为文件上传等动作的开始上传和上传中回调
    let { cbList, funcGroupCbList, fileUploadCbList } = dealSpecialCbs({
      actionCbs,
      block,
      node
    })
    if (funcGroupCbList) {
      // 动作组的子事件作为动作组调用时的参数传入
      _block.args[0].args[1].args[0].args =
        _block.args[0].args[1].args[0].args || []
      _block.args[0].args[1].args[0].args.push(...funcGroupCbList)
    }
    if (fileUploadCbList) {
      // 文件上传等动作的开始上传和上传中回调作为参数传入
      let methArgs = _block.args[0].args[1].args
      fileUploadCbList.forEach(item => {
        let found = false
        for (let i = 0; i < methArgs.length; i++) {
          if (methArgs[i].key === item.name) {
            methArgs[i] = { ...methArgs[i], ...item.lambda }
            found = true
            break
          }
        }
        // V4 动作只保存用户可编辑的普通参数，Lambda 参数往往不会作为空占位
        // 出现在 action.params 中。没有占位时也必须追加，否则上传中回调会静默丢失。
        if (!found) {
          methArgs.push({ key: item.name, ...item.lambda })
        }
      })
    }

    if (block.removeChildrenStatus) {
      // 前台直接调后台用户数据库组件的发起微信公众号登录(wxLogin_stage)方法处理
      // 不要获取code参数后的回调块
      cbList = cbList[0].args[1].args
    }
    let result = [_block]
    result.push(...cbList)
    if (block.delay) {
      // 在前添加延时
      result.unshift(genActionDelay(block.delay))
    }
    if (addExtraBlock) {
      // 古早版本的系统-getCookies等方法，会有一个result参数，用来将获取结果赋值给某个对象。
      // 转后需要在动作后面增加一个给这个对象赋值的动作
      result.push(addExtraBlock)
    }
    return result
  }

  convertActionCb({ block, node, scope, extra }) {
    let { actionSkip, associatedActionBid, isDbStageMethod } = extra
    let _block = { op: 'switch', ln: block.bid, args: [] }
    if (block.enable === false || actionSkip) {
      _block.skip = true
    }
    if (block.expand === false) {
      _block._fold = true
    }

    let conAst =
      block.option !== null
        ? isDbStageMethod
          ? {
              op: '=',
              args: [
                {
                  op: 'get',
                  args: [
                    {
                      op: 'ref',
                      val: ['local', associatedActionBid + 'Rtn']
                    },
                    {
                      op: 'field',
                      val: 'result',
                      _uiSkip: true
                    },
                    {
                      op: 'index',
                      args: [
                        {
                          op: 'val',
                          val: 'result'
                        }
                      ]
                    },
                    {
                      op: 'sysutil',
                      val: 'obj_item',
                      args: [
                        {
                          op: 'val',
                          val: 'status'
                        }
                      ]
                    }
                  ],
                  _blockType: '$cbParams',
                  _ver: 1
                },
                {
                  op: 'val',
                  val: block.option
                }
              ]
            }
          : {
              op: '=',
              args: [
                {
                  op: 'get',
                  args: [
                    {
                      op: 'ref',
                      val: ['local', associatedActionBid + 'Rtn']
                    },
                    {
                      op: 'field',
                      val: 'status'
                    }
                  ],
                  _blockType: '$cbParams',
                  _ver: 1
                },
                {
                  op: 'val',
                  val: block.option
                }
              ]
            }
        : {
            op: '=',
            args: [
              {
                op: 'val'
              },
              {
                op: 'val'
              }
            ]
          }
    if (scope === 'server') {
      conAst.op = 'sysop'
      conAst.val = 'equal'
    }

    let conBody = {
      op: 'block',
      ln: genXid()
    }
    let _children = this.convertBlockChildren({ block, node, scope })
    if (_children.length > 0) {
      conBody.args = _children
    }

    _block.args.push(conAst, conBody)

    return [_block]
  }
}
