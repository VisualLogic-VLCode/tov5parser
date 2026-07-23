// Vendored from VxEditor5/src/utils/ast2js.js for standalone V5 backend compilation.
// var caseInfo = {}
var logOn = false

export function ast2js(input) {
  let result = genAstCode(input)
  return result.code
}

export function ast2jsModule(input) {
  let result = genAstCode(input, 'module')
  if (!result.ctx) {
    return ''
  }
  let code = result.code
  if (input?.postProcess instanceof Function) {
    code = input.postProcess(code)
  }
  return buildModuleCode(result.ctx, code)
}

function genAstCode(input, outputMode = 'runtime') {
  if (input == null || input.ast == null) {
    return { code: '', ctx: null }
  }
  let ctx = {
    outputMode,
    logNo: 0,
    getNodeById: input.getNodeByIdFunc,
    javaMap: input.javaMap || {},
    imports: {},
    compProps: {}
  }
  // caseInfo = input.caseInfo || {}
  logOn = input.log || false
  let code = walkAst(ctx, input.ast, 0, input.eventNodeId)
  return { code, ctx }
}

// function getNodeById(id) {
//   let node
//   let map = caseInfo.map
//   if (map && map[id]) {
//     node = map[id]
//     if (node.children) {
//       node.children = [...new Set(node.children)]
//     }
//   }
//   return node
// }

var convertMap = {
  long: { util: 'toLong' },
  double: { util: 'toDouble' },
  boolean: { util: 'toBoolean' },
  String: { util: 'toString' },
  JsonArr: { util: 'toArray' },
  JsonObj: { util: 'toObject' }
}

function isModuleOutput(ctx) {
  return ctx.outputMode === 'module'
}

function addImport(ctx, source, name) {
  if (!isModuleOutput(ctx) || !source || !name) {
    return
  }
  if (!ctx.imports[source]) {
    ctx.imports[source] = new Set()
  }
  ctx.imports[source].add(name)
}

function addCompProp(ctx, compId, propName) {
  if (!isModuleOutput(ctx) || !compId || !propName) {
    return
  }
  if (!ctx.compProps[compId]) {
    ctx.compProps[compId] = new Set()
  }
  ctx.compProps[compId].add(propName)
}

function isIdentifier(name) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(name)
}

function genPropAccess(objName, propName) {
  if (isIdentifier(propName)) {
    return `${objName}.${propName}`
  }
  return `${objName}[${JSON.stringify(propName)}]`
}

function genObjKey(key) {
  return isIdentifier(key) ? key : JSON.stringify(key)
}

function safeEncodeVal(val) {
  if (typeof val === 'undefined') {
    return 'undefined'
  }
  try {
    let result = encodeVal(val)
    return typeof result === 'undefined' ? 'undefined' : result
  } catch (e) {
    return 'undefined'
  }
}

function getModuleNameByNodeType(nodeType) {
  return nodeType || 'component'
}

function getGlobalMap(name) {
  if (typeof window !== 'undefined' && window?.[name]) {
    return window[name]
  }
  if (typeof global !== 'undefined' && global?.[name]) {
    return global[name]
  }
  return {}
}

function getServerActionInfo(ctx, nodeType, methodName) {
  let actionMap = getGlobalMap('serverCompActionMap')
  return actionMap?.[`${nodeType}$${methodName}`] || null
}

function getMethodDef(ctx, nodeType, methodName) {
  let nodeInfo = ctx.javaMap?.[nodeType]
  let method = nodeInfo?.methods?.find(m => {
    return m.name == methodName
  })
  return method || null
}

function getMethodParamsForJs(ctx, nodeType, methodName) {
  let method = getMethodDef(ctx, nodeType, methodName)
  let params = method?.params instanceof Array ? [...method.params] : []
  if (params.length > 0 && params[0]?.type === 'IvxContext') {
    params.shift()
  }
  if (params[0]?.name === 'props') {
    params.shift()
  }
  if (params[0]?.name === 'parentProps') {
    params.shift()
  }
  return params
}

function methodParamsAsObj(ctx, nodeType, methodName, args) {
  let method = getMethodDef(ctx, nodeType, methodName)
  let actionInfo = getServerActionInfo(ctx, nodeType, methodName)
  return !!(
    method?.paramsAsObj ||
    method?.objParam ||
    actionInfo?.paramsAsObj ||
    args?.some(arg => arg?.key)
  )
}

function getModuleMethodArgs(
  ctx,
  nodeType,
  methodName,
  args,
  eventNodeId,
  retPos
) {
  let _args = []
  if (args) {
    for (let a of args) {
      if (!a._jsSkip) {
        _args.push(a)
      }
    }
  }
  let paramsAsObj = methodParamsAsObj(ctx, nodeType, methodName, _args)
  if (paramsAsObj && !_args.some(arg => arg?.key)) {
    let params = getMethodParamsForJs(ctx, nodeType, methodName)
    _args = _args.map((arg, index) => {
      let param = params[index]
      return param?.name ? { ...arg, key: param.name } : arg
    })
  }
  let params = walkParam(
    ctx,
    _args,
    eventNodeId,
    paramsAsObj ? undefined : retPos
  )
  if (paramsAsObj && params === '') {
    params = '{}'
  }
  return params
}

function genNativeObject(ctx, args, eventNodeId) {
  let pairs = []
  if (args) {
    for (let i = 0; i < args.length; i += 2) {
      let keyAst = args[i]
      let valAst = args[i + 1]
      if (!keyAst || !valAst) {
        continue
      }
      let key = walkAst(ctx, keyAst, 0, eventNodeId)
      if (keyAst.op === 'val' && typeof keyAst.val === 'string') {
        key = genObjKey(keyAst.val)
      } else {
        key = `[${key}]`
      }
      pairs.push(`${key}: ${walkAst(ctx, valAst, 0, eventNodeId)}`)
    }
  }
  return `{${pairs.join(',')}}`
}

function genUtilCall(ctx, name, params) {
  if (isModuleOutput(ctx)) {
    switch (name) {
      case 'getSelf':
        return params
    }
    addImport(ctx, 'util', name)
    return `${name}(${params})`
  }
  return `$sys.util.${name}(${params})`
}

function buildImportLines(ctx) {
  return Object.keys(ctx.imports)
    .sort()
    .map(source => {
      let names = Array.from(ctx.imports[source]).sort()
      return `import { ${names.join(', ')} } from '${source}'`
    })
}

function buildCompPropLines(ctx) {
  let compIds = Object.keys(ctx.compProps || {}).sort()
  return compIds.map(compId => {
    let node = ctx.getNodeById(compId)
    let props = new Set()
    if (ctx.compProps[compId]) {
      ctx.compProps[compId].forEach(prop => props.add(prop))
    }
    let propCode = Array.from(props)
      .sort()
      .map(prop => {
        return `${genObjKey(prop)}: ${safeEncodeVal(node?.props?.[prop])}`
      })
      .join(', ')
    return `var ${compId} = ${propCode ? `{ ${propCode} }` : '{}'}`
  })
}

function buildModuleCode(ctx, code) {
  let sections = []
  let imports = buildImportLines(ctx)
  let compProps = buildCompPropLines(ctx)
  if (imports.length > 0) {
    sections.push(imports.join('\n'))
  }
  if (compProps.length > 0) {
    sections.push(compProps.join('\n'))
  }
  sections.push(code)
  return sections.join('\n\n')
}

function walkParam(ctx, args, eventNodeId, retPos, isReturn) {
  let result = ''
  let hasKey = false
  if (args) {
    let _args = [...args]
    if (typeof retPos === 'number' && retPos > -1) {
      _args.splice(retPos, 0, { op: 'val' })
    }
    for (let v of _args) {
      let key = v['key']
      let val = walkAst(ctx, v, 0, eventNodeId)
      if (key) {
        hasKey = true
        if (result.length == 0) {
          result += '{'
        } else {
          result += ','
        }
        // 服务\动作组\事务的return,要根据设置的类型进行转换
        if (isReturn) {
          let eventNode = ctx.getNodeById(eventNodeId)
          let pType = 'JsonVal'
          for (let param of eventNode?.props?.outParams || []) {
            if (param?.name === key) {
              pType = param.type || 'JsonVal'
            }
          }
          if (convertMap[pType]) {
            val = `${convertMap[pType].util}(${val})`
          }
        }
        result += key + ':' + val
      } else {
        if (val == 'undefined') {
          if (
            typeof v.type == 'string' &&
            (v.type == 'long' || v.type == 'double')
          ) {
            val = '0'
          } else if (typeof v.type == 'string' && v.type == 'boolean') {
            val = 'false'
          }
        } else if (typeof v.type == 'string') {
          let types = v.type.split('|')
          if (types.length == 1) {
            // 单类型
            if (v.cType !== v.type) {
              // 对象数组-从另一个数组添加列，需要从一个参数拆成两个参数的情况，不要转换类型
              let shouldConvert = !(v.op === 'ref' && v.val?.length > 2)
              if (shouldConvert && convertMap[v.type]) {
                val = `${convertMap[v.type].util}(${val})`
              }
            }
          }
        }
        if (result.length > 0) {
          result += ','
        }
        result += val
      }
    }
  }
  if (hasKey) {
    result += '}'
  }
  return result
}

function encodeVal(val) {
  if (typeof val == 'number' || typeof val == 'boolean') {
    return '' + val
  }
  if (
    typeof val == 'string' ||
    val instanceof Array ||
    typeof val == 'object'
  ) {
    return JSON.stringify(val)
  }
  if (val == null) {
    return 'undefined'
  }
  throw 'unknown value'
}

// 是否为组件
function checkIsGlobalVar(args) {
  return (
    args[0] && args[0].op == 'ref' && args[0].val && args[0].val[0] == 'var'
  )
}

// 是否为服务调用
function checkIsRunService(node) {
  return (
    node &&
    node.op == 'get' &&
    node.args &&
    node.args[0] &&
    node.args[0].op == 'ref' &&
    node.args[0].val &&
    node.args[0].val[0] == 'global' &&
    node.args[0].val[1] == 'Service'
  )
}

// 是否为自定义函数调用
function checkIsFireFunc(node) {
  return (
    node &&
    node.op == 'get' &&
    node.args &&
    node.args[0] &&
    node.args[0].op == 'ref' &&
    node.args[0].val &&
    node.args[0].val[0] == 'var' &&
    // node.args[0].val[1] &&
    node.args[1].op === 'method' &&
    node.args[1].val === 'fireFunc'
  )
}

// 是否为helper
function checkIsGlobalStatic(node) {
  return (
    node &&
    node.op == 'get' &&
    node.args &&
    node.args[0] &&
    node.args[0].op == 'ref' &&
    node.args[0].val &&
    node.args[0].val[0] == 'global' &&
    node.args[0].val[1] !== 'Service'
  )
}

// 是否为后台系统伪对象
function checkIsSobj(args) {
  return (
    args[0] && args[0].op == 'ref' && args[0].val && args[0].val[0] == 'sobj'
  )
}

// 是否为调用后台小模块公共方法下的动作组
function checkIsModServerMeth(node) {
  return (
    node &&
    node.mini &&
    node.op == 'get' &&
    node.args?.[0]?.op == 'ref' &&
    node.args[0].val?.[0] == 'var' &&
    node.args[1]?.op == 'method'
  )
}

// 是否为动作组
function isFuncGroup(ctx, nodeId) {
  let node = ctx.getNodeById(nodeId)
  return node && node.type == 'data-funcGroup'
}

function setLogInput(ctx, args, params, paramsAsObj) {
  if (paramsAsObj || (args && args[0] && args[0].key)) {
    ctx.logInput = params
  } else {
    ctx.logInput = `[${params}]`
  }
}

function genLog({ ctx, eventNodeId, ln, logType, logNo, data }) {
  let eNode = ctx.getNodeById(eventNodeId)
  let name = eNode?.uis?.name || ''
  return `$sys.func('server-sys-serverSys',$self,'','setLog',{topic:"trace",level:0,sMsg:"${name}-log${logNo}-${logType} (${ln})",aData:${data}})`
}

function getConArgs({ ast, conArgs, ctx, eventNodeId }) {
  switch (ast.op) {
    case 'and':
    case 'or':
    case 'sysop':
      let args = ast.args
      if (args && args.length > 0) {
        args.forEach(arg => {
          getConArgs({ ast: arg, conArgs, ctx, eventNodeId })
        })
      }
      break

    default:
      conArgs.push(walkAst(ctx, ast, 0, eventNodeId))
  }
}

function buildBlockLines(ctx, args, eventNodeId) {
  let lines = []
  if (args) {
    for (let v of args) {
      let line = walkAst(ctx, v, 0, eventNodeId)
      if (line.length > 0) {
        if (line.slice(-1) !== '}') {
          line += ';'
        }
      }
      lines.push(`${line}\n`)
    }
  }
  return lines
}

function getGuardFailArgs(messageAst) {
  return [
    { op: 'val', val: false, type: 'boolean', key: 'success' },
    { ...(messageAst || { op: 'val' }), type: 'String', key: 'message' }
  ]
}

function getGuardDefaultExitCode(ctx, messageAst, eventNodeId) {
  let targetNode = ctx.getNodeById(eventNodeId)
  let nodeType = targetNode?.type
  let failArgs = getGuardFailArgs(messageAst)
  if (nodeType === 'data-transaction') {
    let params = walkParam(ctx, failArgs, eventNodeId, undefined, true) || '{}'
    return `return $sys.func('${nodeType}',$self,'${eventNodeId}','rollback',${params})`
  }
  if (
    nodeType === 'data-service' ||
    nodeType === 'data-funcGroup' ||
    nodeType === 'data-funcPipeline' ||
    nodeType === 'data-timerService' ||
    nodeType === 'data-workflow'
  ) {
    return walkAst(ctx, { op: 'return', args: failArgs }, 0, eventNodeId)
  }
  let params = walkParam(ctx, failArgs, eventNodeId, undefined, true) || '{}'
  return `return ${params}`
}

function getRetPos(ctx, nodeType, meth) {
  let widgetMap = ctx.javaMap || {}
  let nodeInfo = widgetMap[nodeType]
  if (nodeInfo) {
    let method = nodeInfo.methods.find(m => {
      return m.name == meth
    })
    if (method && method.jsRetPos) {
      return method.jsRetPos - 3
    }
  }
  return null
}

let opList = ['+', '-', '*', '/', '%', '<', '>', '>=', '<=']
let opMap = {
  '=': '==',
  and: '&&',
  or: '||',
  neg: '-',
  not: '!'
}
let svcInvokeMap = {
  'data-service': 'runService',
  'data-funcGroup': 'fireFuncGroup',
  'data-transaction': 'runTransaction',
  'data-timerService': 'runService',
  'data-sharedService': 'runService',
  'data-workflow': 'runWorkflow'
}
let svcRtnMap = {
  'data-service': 'paramResult',
  'data-funcGroup': 'cbFParam',
  'data-transaction': 'paramResult',
  'data-timerService': 'recordResult'
}

function walkAst(ctx, node, flags, eventNodeId) {
  let op = node['op']
  let val = node['val']
  let args = node['args']
  let ln = node['ln']
  let log = node['log']
  if (logOn && log) {
    ctx.logNo += 1
  }
  if (!!node['skip'] || !op) {
    return ''
  }
  switch (op) {
    case 'block': {
      let lines = buildBlockLines(ctx, args, eventNodeId)
      return `{\n${lines.join('')}}`
    }

    case 'let':
      if (val) {
        if (!val[0]) {
          return ''
        }
        let v = `let ${val[0]}`
        if (args && args[0]) {
          if (logOn && log) {
            ctx.logInput = true
          }

          let flag = typeof flags == 'number' && (flags & 1) !== 0
          v += (flag ? ' of ' : ' = ') + walkAst(ctx, args[0], 1, eventNodeId)
          if (logOn && log) {
            // 在有返回值的动作块的前后添加input/output log
            v =
              genLog({
                ctx,
                eventNodeId,
                ln,
                logType: 'input',
                logNo: ctx.logNo,
                data: ctx.logInput
              }) +
              ';\n' +
              v +
              ';\n' +
              genLog({
                ctx,
                eventNodeId,
                ln,
                logType: 'output',
                logNo: ctx.logNo,
                data: val[0]
              })

            ctx.logInput = false
          }
        }
        return v
      }
      break

    case 'ref':
      if (val && val.length >= 2) {
        let scope = val[0]
        switch (scope) {
          case 'var': {
            let id = val[1]
            let v = ''
            // 如果要访问多个props的话：（只用在method参数里面）
            // {
            //   "op": "ref",
            //   "val": ["var", "compId", "type,value"]
            // }
            // 根据prop的类型调用相应的get函数,如getArray()
            if (val[2]) {
              let props = val[2].split(',')
              props.forEach(prop => {
                if (v.length > 0) {
                  v += ','
                }
                if (isModuleOutput(ctx)) {
                  addCompProp(ctx, id, prop)
                  v += genPropAccess(id, prop)
                } else {
                  v += `$sys.get($self,'${id}','${prop}')`
                }
              })
            } else {
              v = id
            }
            return v
          }

          case 'local':
            return val[1]

          case 'java':
            return 'Math'

          case 'param':
            if (isFuncGroup(ctx, eventNodeId)) {
              return `fParam${eventNodeId}.${val[1]}`
            }
            return `param.${val[1]}`

          case 'global': {
            let result = ''
            let next = ctx.next
            if (val[1] == 'Service') {
              result = next?.val || ''
            } else {
              let nodeId =
                next &&
                next.op == 'method' &&
                next.args &&
                next.args[0] &&
                next.args[0].val
              if (nodeId && ctx.getNodeById(nodeId)) {
                result = nodeId
              } else {
                result = eventNodeId
              }
            }
            delete ctx.next
            return result
          }

          case 'sobj':
            return 'server-sys-serverSys'

          case 'sysParam':
          case 'sysGetter': {
            // 公式编辑器中引用案例nid、ucUser等，js生成param._nid, param._ucUser.id
            let suffix = ''
            if (args instanceof Array) {
              for (let v of args) {
                let sop = v['op']
                switch (sop) {
                  case 'field':
                    suffix += `.${v['val']}`
                    break
                }
              }
            }
            return `param.${val[1]}` + suffix
          }

          case 'sysFunc':
            // 公式编辑器中引用Header、cookie等，js生成_serviceReqHeader()
            return `${val[1]}()`

          case 'sysHelper':
            // 公式编辑器中引用body、url参数等，js生成$sys.util.getInParams_body(param)
            return genUtilCall(ctx, val[1], 'param')
        }
      }
      break

    case 'set':
      if (args) {
        let prefix = walkAst(ctx, args[0], 0, eventNodeId)
        let lines = []
        let isGlobalVar = checkIsGlobalVar(args)
        for (let v of args.slice(1)) {
          if (v['op'] == 'field') {
            if (v['val']) {
              if (isGlobalVar) {
                // $refs.aa.value = 1 => $sys.set($self, 'aa', 'value', 1)
                if (isModuleOutput(ctx)) {
                  addCompProp(ctx, prefix, v['val'])
                  lines.push(
                    `${genPropAccess(prefix, v['val'])} = ${walkAst(
                      ctx,
                      v['args'][0],
                      0,
                      eventNodeId
                    )}`
                  )
                } else {
                  lines.push(
                    `$sys.set($self,'${prefix}','${v['val']}',${walkAst(
                      ctx,
                      v['args'][0],
                      0,
                      eventNodeId
                    )})`
                  )
                }
              } else {
                prefix += `.${v['val']}`
                lines.push(
                  `${prefix} = ${walkAst(ctx, v['args'][0], 0, eventNodeId)}`
                )
              }
            }
          } else {
            let suffix = walkAst(ctx, v, 0, eventNodeId)
            let addLog = ''
            if (logOn && log) {
              // 局部变量赋值动作前添加input log
              addLog =
                genLog({
                  ctx,
                  eventNodeId,
                  ln,
                  logType: 'input',
                  logNo: ctx.logNo,
                  data: suffix
                }) + ';\n'
            }
            lines.push(addLog + `${prefix} = ${suffix}`)
          }
        }
        return lines.join(';\n')
      }
      break

    case 'get':
      if (args) {
        ctx.next = args[1]
        let result = walkAst(ctx, args[0], 0, eventNodeId)
        let isRunService = checkIsRunService(node)
        let isFireFunc = checkIsFireFunc(node)
        let isGlobalVar = checkIsGlobalVar(args)
        let isGlobalStatic = checkIsGlobalStatic(node)
        let isSobj = checkIsSobj(args)
        let isModServerMeth = checkIsModServerMeth(node)
        if (isModServerMeth) {
          result = args[1].val + '.' + result
        }
        for (let v of args.slice(1)) {
          let sop = v['op']
          switch (sop) {
            case 'field':
              if (isGlobalVar) {
                // $refs.aa.value => $sys.get($self, 'aa', 'value')
                if (isModuleOutput(ctx)) {
                  addCompProp(ctx, result, v['val'])
                  result = genPropAccess(result, v['val'])
                } else {
                  result = `$sys.get($self,'${result}','${v['val']}')`
                }

                isGlobalVar = false
              } else {
                result += '.' + v['val']
              }
              break

            case 'index':
              result += '[' + walkAst(ctx, v['args'][0], 0, eventNodeId) + ']'
              break

            case 'method':
              if (v._jsParam) {
                // 服务的返回结果参数引用和反包函数处理
                if (v._jsParam.startsWith('$SF_')) {
                  let meth = v._jsParam.slice('$SF_'.length)
                  result = genUtilCall(ctx, meth, result)
                } else {
                  result += '.' + v._jsParam
                }
              } else {
                // flag为1则调用$sys.afunc()
                let flag = typeof flags == 'number' && (flags & 1) !== 0
                let func = flag || isRunService || isFireFunc ? 'afunc' : 'func'
                if (isRunService || isModServerMeth) {
                  // 服务,动作组,事务和定时服务调用的处理
                  let nodeId = v['val']
                  let nodeType
                  if (isModServerMeth) {
                    nodeType = 'data-funcGroup'
                  } else {
                    let targetNode = ctx.getNodeById(nodeId)
                    nodeType = targetNode?.type
                  }
                  if (nodeType) {
                    let meth = svcInvokeMap[nodeType]
                    // // 参数需要转为一个对象传入
                    // let _args = []
                    // let inParams = targetNode.props.inParams
                    // if (
                    //   v['args'] &&
                    //   v['args'].length > 0 &&
                    //   inParams &&
                    //   inParams.length > 0
                    // ) {
                    //   v['args'].forEach((a, i) => {
                    //     if (inParams[i]) {
                    //       _args.push({ ...a, key: inParams[i].name })
                    //     }
                    //   })
                    // }
                    let params = walkParam(ctx, v['args'], eventNodeId) || '{}'
                    if (logOn && ((flag && ctx.logInput) || log)) {
                      setLogInput(ctx, v['args'], params, true)
                    }
                    // if (v.modId && nodeType === 'data-service') {
                    //   result = `$sys.ainvoke('${result}.${v.modId}',${params})`
                    // } else {
                    result = `$sys.${func}('${nodeType}',$self,'${result}','${meth}',${params})`
                    // }
                  }

                  isRunService = false
                } else if (isGlobalVar || isGlobalStatic) {
                  // $refs.aa.dbSelect(...) => $sys.func('data-db', $self, 'aa', 'dbSelect', ...)
                  let nodeId = result
                  let targetNode = ctx.getNodeById(nodeId)
                  let nodeType = targetNode?.type
                  let params
                  if (nodeType) {
                    let retPos = null
                    if (
                      nodeType === 'data-transaction' &&
                      v['val'] === 'rollback'
                    ) {
                      // // 事务回滚参数需要转为一个对象传入
                      // let _args = []
                      // let outParams = targetNode.props.outParams
                      // if (
                      //   v['args'] &&
                      //   v['args'].length > 0 &&
                      //   outParams &&
                      //   outParams.length > 0
                      // ) {
                      //   v['args'].forEach((a, i) => {
                      //     if (outParams[i]) {
                      //       _args.push({ ...a, key: outParams[i].name })
                      //     }
                      //   })
                      // }
                      params =
                        walkParam(
                          ctx,
                          v['args'],
                          eventNodeId,
                          undefined,
                          true
                        ) || '{}'
                      if (logOn && ((flag && ctx.logInput) || log)) {
                        setLogInput(ctx, v['args'], params, true)
                      }
                    } else {
                      // 过滤掉仅在java版需要传的参数
                      let _args = []
                      if (v['args']) {
                        for (let a of v['args']) {
                          if (!a._jsSkip) {
                            _args.push(a)
                          }
                        }
                      }
                      // 处理旧版组件方法legacy,需要多传一个占位的参数
                      retPos = getRetPos(ctx, nodeType, v['val'])
                      params = walkParam(ctx, _args, eventNodeId, retPos)
                      if (logOn && ((flag && ctx.logInput) || log)) {
                        setLogInput(ctx, _args, params)
                      }
                    }

                    if (isModuleOutput(ctx)) {
                      let methodName = v['val']
                      addImport(
                        ctx,
                        getModuleNameByNodeType(nodeType),
                        methodName
                      )
                      let moduleParams = getModuleMethodArgs(
                        ctx,
                        nodeType,
                        v['val'],
                        v['args'],
                        eventNodeId,
                        retPos
                      )
                      result = `${methodName}(${nodeId}${
                        moduleParams !== '' ? ',' + moduleParams : ''
                      })`
                    } else {
                      result = `$sys.${func}('${nodeType}',$self,'${result}','${
                        v['val']
                      }'${params !== '' ? ',' + params : ''})`
                    }
                  }
                } else if (isSobj) {
                  // 后台系统$sobj_serverSys.f_setLog({topic: "t1", ....}) => $sys.func('server-sys-serverSys', $self, '', 'setLog', ...)
                  let params = walkParam(ctx, v['args'], eventNodeId)
                  if (logOn && ((flag && ctx.logInput) || log)) {
                    setLogInput(ctx, v['args'], params)
                  }
                  result = `$sys.${
                    v['val'] === 'genToken' ? 'afunc' : 'func'
                  }('${result}',$self,'','${v['val']}'${
                    params !== '' ? ',' + params : ''
                  })`
                } else {
                  let params = walkParam(ctx, v['args'], eventNodeId)
                  if (logOn && ((flag && ctx.logInput) || log)) {
                    setLogInput(ctx, v['args'], params)
                  }
                  result += `.${v['val']}(${params})`
                }
              }
              break

            case 'sysutil': {
              let params = walkParam(ctx, v['args'], eventNodeId)
              result = genUtilCall(
                ctx,
                v['val'],
                result + (params.length == 0 ? '' : ',' + params)
              )
              break
            }

            case 'pipe': {
              let params = walkParam(ctx, v['args'], eventNodeId)
              result =
                '$staticFns && $staticFns["' +
                v['val'] +
                '"]' +
                '(' +
                result +
                (params.length == 0 ? '' : ',' + params) +
                ')'
              break
            }
          }
          if (logOn && log) {
            // 动作块前添加input log
            result =
              genLog({
                ctx,
                eventNodeId,
                ln,
                logType: 'input',
                logNo: ctx.logNo,
                data: ctx.logInput
              }) +
              ';\n' +
              result

            ctx.logInput = false
          }
        }
        return result
      }
      break

    case 'val':
      return encodeVal(val)

    case 'var':
      if (args && args.length == 1) {
        return walkAst(ctx, args[0], 0, eventNodeId)
      }
      break

    case 'lambda': {
      let params = ''
      let body = {}
      if (val instanceof Array) {
        params = val.join(',')
      }
      if (args && args[0] && args[0].op === 'block') {
        ctx.lambda = true
        body = walkAst(ctx, args[0], 0, eventNodeId)
        ctx.lambda = false
      }
      return `function(${params}) ${body}`
    }

    case 'if':
      if (args && args.length == 2) {
        return `if (${walkAst(ctx, args[0], 0, eventNodeId)}) ${walkAst(
          ctx,
          args[1],
          0,
          eventNodeId
        )}`
      }
      break

    case 'while':
      if (args && args.length == 2) {
        let addLog = ''
        let c = walkAst(ctx, args[0], 0, eventNodeId)
        if (logOn && log) {
          // while循环块前添加condition log
          addLog =
            genLog({
              ctx,
              eventNodeId,
              ln,
              logType: 'loop condition',
              logNo: ctx.logNo,
              data: c
            }) + ';\n'
        }
        return addLog + `while (${c}) ${walkAst(ctx, args[1], 0, eventNodeId)}`
      }
      break

    case 'for':
      if (args && args.length == 2) {
        let v = walkAst(ctx, args[0], 1, eventNodeId)
        let addLog = ''
        if (logOn && log) {
          // for循环块前添加loop count/loop array log
          let logType = 'loop count' // 次数循环
          let loopVarDef = args[0]
          if (
            loopVarDef &&
            loopVarDef.args &&
            loopVarDef.args[0] &&
            loopVarDef.args[0].op !== 'step'
          ) {
            logType = 'loop array' // 数组循环
          }
          addLog =
            genLog({
              ctx,
              eventNodeId,
              ln,
              logType,
              logNo: ctx.logNo,
              data: v.split(' of ')[1]
            }) + ';\n'
        }
        return addLog + `for (${v}) ${walkAst(ctx, args[1], 0, eventNodeId)}`
      }
      break

    case 'switch':
      if (args && (args.length & 1) == 0) {
        let consLog = []
        let index = 0
        let result = ''
        while (index < args.length) {
          let cond = args[index]
          if (!cond['skip']) {
            let c = walkAst(ctx, cond, 0, eventNodeId)
            let v = walkAst(ctx, args[index + 1], 0, eventNodeId)
            if (result.length > 0) {
              result += '\nelse '
            }
            if (cond._isElse) {
              // 其余
              if (result.length == 0) {
                result += 'if (true) '
              }
              consLog.push(`{index:'其余',result:true}`)
              result += v
              break
            } else {
              let conArgs = []
              getConArgs({ ast: cond, conArgs, ctx, eventNodeId })
              consLog.push(
                `{index:'情况'+${index / 2 +
                  1},result:${c},args:[${conArgs.join(',')}]}`
              )
              result += `if (${c}) ${v}`
            }
          }
          index += 2
        }
        let addLog = ''
        if (logOn && log) {
          // switch块前添加condition log
          addLog =
            genLog({
              ctx,
              eventNodeId,
              ln,
              logType: 'condition',
              logNo: ctx.logNo,
              data: `[${consLog.join(',')}]`
            }) + ';\n'
        }
        return addLog + result
      }
      return ''

    case 'guard':
      if (args && args.length >= 2) {
        let lines = []
        let childBlock = args[2]
        if (childBlock && childBlock.op == 'block') {
          lines = buildBlockLines(ctx, childBlock.args, eventNodeId)
        }
        let exitLine = getGuardDefaultExitCode(ctx, args[1], eventNodeId)
        if (exitLine.length > 0) {
          if (exitLine.slice(-1) !== '}') {
            exitLine += ';'
          }
          lines.push(`${exitLine}\n`)
        }
        return `if (${walkAst(ctx, args[0], 0, eventNodeId)}) {\n${lines.join(
          ''
        )}}`
      }
      break

    case 'switchexp':
      if (args && (args.length & 1) == 0) {
        let index = 0
        let result = ''
        while (index < args.length) {
          let v = args[index]
          if (result.length > 0) {
            result += ':'
          }
          if (index + 2 < args.length) {
            result += '(' + walkAst(ctx, v, 0, eventNodeId) + ')?'
          }
          result += '(' + walkAst(ctx, args[index + 1], 0, eventNodeId) + ')'
          index += 2
        }
        return result
      }
      break

    case 'step': {
      return genUtilCall(ctx, 'fnStep', walkParam(ctx, args, eventNodeId))
    }

    case 'entries': {
      return genUtilCall(ctx, 'fnEntries', walkParam(ctx, args, eventNodeId))
    }

    case 'list': {
      let v = walkParam(ctx, args, eventNodeId)
      if (v === 'undefined') {
        v = ''
      }
      return `[${v}]`
    }

    case 'dict': {
      if (isModuleOutput(ctx)) {
        return genNativeObject(ctx, args, eventNodeId)
      }
      return genUtilCall(
        ctx,
        'fnJsonObj',
        `[${walkParam(ctx, args, eventNodeId)}]`
      )
    }

    case 'concat': {
      return `[${walkParam(ctx, args, eventNodeId)}].join('')`
    }

    case 'sysop': {
      return genUtilCall(ctx, `op_${val}`, walkParam(ctx, args, eventNodeId))
    }

    case 'jsfn': {
      let fnArg = val.slice(1).join(',')
      return (
        '(function(' +
        fnArg +
        '){try{return new Function("' +
        fnArg +
        '",' +
        JSON.stringify('return ' + val[0]) +
        ')(' +
        fnArg +
        ')}catch(e){}})(' +
        walkParam(ctx, args, eventNodeId) +
        ')'
      )
    }

    case 'return': {
      if (ctx.lambda) {
        // lambda函数中的return
        return 'return ' + walkAst(ctx, args[0], 0, eventNodeId)
      } else {
        // 服务,动作组,事务和定时服务设置返回结果的处理
        let targetNode = ctx.getNodeById(eventNodeId)
        let nodeType = targetNode?.type
        if (nodeType) {
          let meth = svcRtnMap[nodeType]
          let params = ''
          let result = ''
          switch (nodeType) {
            case 'data-service':
            case 'data-transaction':
            case 'data-funcGroup':
            case 'data-funcPipeline': {
              // // 参数需要转为一个对象传入
              // let _args = []
              // let outParams = targetNode.props.outParams
              // if (args && args.length > 0 && outParams && outParams.length > 0) {
              //   args.forEach((a, i) => {
              //     if (outParams[i]) {
              //       _args.push({ ...a, key: outParams[i].name })
              //     }
              //   })
              // }
              params =
                walkParam(ctx, args, eventNodeId, undefined, true) || '{}'
              let addLog = ''
              if (logOn && log) {
                // return动作块前添加input log
                setLogInput(ctx, args, params)
                addLog =
                  genLog({
                    ctx,
                    eventNodeId,
                    ln,
                    logType: 'return',
                    logNo: ctx.logNo,
                    data: ctx.logInput
                  }) + ';\n'

                ctx.logInput = false
              }
              if (nodeType == 'data-funcGroup') {
                // 旧版的动作组设置返回结果是特殊处理的
                result =
                  addLog +
                  `if(${meth + eventNodeId}){return ${meth +
                    eventNodeId}('success',${params});}`
              } else if (nodeType === 'data-funcPipeline') {
                result = addLog + `return ${params}`
              } else {
                let extra =
                  nodeType == 'data-transaction'
                    ? 'delete $sys.inTransaction; txCommit();\n'
                    : ''
                let value =
                  nodeType == 'data-service' &&
                  checkIsGlobalStatic(args && args[0])
                    ? 'return ' + params // 服务设置自定义返回结果，前面加return
                    : `return $sys.func('${nodeType}',$self,'${eventNodeId}','${meth}',${params})`
                result = addLog + extra + value
              }
              break
            }

            case 'data-timerService':
              if (
                args &&
                args[0] &&
                args[0].args &&
                args[0].args[1] &&
                args[0].args[1].op == 'method'
              ) {
                params = walkParam(ctx, args[0].args[1].args, eventNodeId)
                result = `return $sys.func('${nodeType}',$self,'${eventNodeId}','${meth}',${params})`
              }
              break

            case 'data-workflow': {
              result =
                'return ' +
                (walkParam(ctx, args, eventNodeId, undefined, true) || '{}')
            }
          }
          return result
        }
      }

      break
    }

    case 'runsvc': {
      return `$sys.ainvoke('${val}',${walkParam(ctx, args, eventNodeId) ||
        '{}'})`
    }

    case 'break':
    case 'continue':
      return op

    case 'nop':
      return ''

    default:
      let mathOp = opList.includes(op) ? op : opMap[op]
      if (mathOp) {
        if (args) {
          let parts = []
          for (let v of args) {
            parts.push(`(${walkAst(ctx, v, 0, eventNodeId)})`)
          }
          return parts.length === 1 ? mathOp + parts[0] : parts.join(mathOp)
        }
      }
  }
  // debugger

  throw 'invalid node'
}
