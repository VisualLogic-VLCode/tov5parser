import jsep from './jsepWrap.js'
import { parseExpressionAt } from 'acorn'
import { generate } from 'astring'
import ParseError from './ParseError.js'
import ExprAstToString from './ExprAstToString.js'
import { reportDiagError } from '../utils/convertDiag.js'
// 原 4.1 编辑器内的 formulaCode/MapCreator 是 vlparser utils/MapCreator 的同源阉割版
// （从 window 读映射），移植后直接使用 vlparser 完整版（支持 Node 的 global 读取）
import MapCreator from '../../utils/MapCreator.js'

export default class V4FormulaCodeConverter {
  constructor(props) {
    this.props = props
    this.str = props.str
    this.scope = props.scope || 'stage' // stage 或 server, 公式编辑器所处的位置
    this.innerGetCtxQueue = []
  }
  // 静态属性
  static sfutilAliasMap = {
    $SF_db_getDbOneArrItem: '$SF_arr_oneArrItem', // 一维数组的某个值
    $SF_db_getDbTwoArrCol: 'SF_arr2d_aArrCol', // 二维数组的某一列
    $SF_db_getDbTwoArrRow: '$SF_arr2d_aArrRow', // 二维数组的某一行
    $SF_db_getDbTwoArrItem: '$SF_arr2d_twoArrItem', // 二维数组的某个值
    $SF_db_getDbObjArrCol: '$SF_objArr_colItem', // 对象数组的某一列
    $SF_db_getDbObjArrRow: '$SF_arr2d_aArrRow', // 对象数组的某一行
    $SF_db_getDbObjArrItem: '$SF_objArr_item' // 对象数组的某个值
  }
  // 静态方法
  static isGetAST = ({ ast }) => {
    let walkAst = ({ ast }) => {
      let { op, args } = ast || {}
      switch (op) {
        case 'get':
          return true
        case 'var':
          return walkAst({ ast: args?.[0] })
      }
    }
    return walkAst({ ast })
  }
  exec() {
    return this.parseStr({ str: this.preprocessStr({ str: this.str }) })
  }
  // 预处理字符串
  preprocessStr = ({ str }) => {
    let regList = [
      /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/ // 判断是否是颜色
    ]
    for (let reg of regList) {
      if (reg.test(str)) return JSON.stringify(str)
    }
    return str
  }
  parseStr = ({ str }) => {
    let parsed = {}
    try {
      str = this.replaceSFParamPrompt({ str })
      if (this.shouldUseFullJsParser({ str })) {
        const ast = this.processFullJsExpression({ str })
        reportDiagError({
          phase: 'custom-expr-fallback',
          error: new ParseError({
            message: 'full JavaScript expression fallback',
            type: 'FullJsExpression'
          })
        })
        return ast
      }
      parsed = jsep(str)
    } catch (e) {
      // jsep 只解析表达式子集，块体箭头函数、IIFE 与赋值表达式交给
      // 完整 ESTree 解析器，再沿用 jsfn 的 v4 引用参数化逻辑。
      try {
        const ast = this.processFullJsExpression({ str })
        reportDiagError({ phase: 'custom-expr-fallback', error: e })
        return ast
      } catch (fullJsError) {
        console.log('parse error:', e)
        reportDiagError({ phase: 'jsep-parse', error: e })
      }
    }
    this.log('parsed:', JSON.stringify(parsed, null, 2))
    let ast
    try {
      ast = this.processParsedTree({ parsed, gateway: true })
    } catch (e) {
      ast = { op: 'val' }
      console.log(e)
      reportDiagError({ phase: 'ast-convert', error: e })
    }
    return ast
  }
  shouldUseFullJsParser = ({ str }) => {
    return (
      /=>\s*\{/.test(str) ||
      /\bfunction\s*\(/.test(str) ||
      /\btypeof\b/.test(str) ||
      /(?:\+=|-=|\*=|\/=|%=)/.test(str)
    )
  }
  processFullJsExpression = ({ str }) => {
    const parsed = parseExpressionAt(str, 0, { ecmaVersion: 'latest' })
    if (str.slice(parsed.end).trim()) {
      throw new Error('Unexpected trailing JavaScript tokens')
    }
    const context = {
      num: 0,
      vList: [],
      jsFnArgs: [],
      fullJsMode: true
    }
    this.walkCustomExprParsed({ parsed, context })
    return {
      op: 'var',
      args: [
        {
          op: 'jsfn',
          val: [generate(parsed), ...context.vList],
          args: context.jsFnArgs
        }
      ]
    }
  }
  getCtx = (...params) => {
    if (
      Array.isArray(this.innerGetCtxQueue) &&
      this.innerGetCtxQueue.length > 0
    ) {
      let len = this.innerGetCtxQueue.length
      let ctx
      for (let i = len - 1; i >= 0; i--) {
        let innerGetCtx = this.innerGetCtxQueue[i]
        if (innerGetCtx instanceof Function) {
          ctx = innerGetCtx(...params)
          if (ctx) return ctx
        }
      }
    }
    let ctx = this.props.getCtx(...params)
    if (!ctx) {
      ctx = this.defaultInnerGetCtx(...params)
    }
    return ctx
  }
  defaultInnerGetCtx = str => {
    switch (str) {
      case '$constSys': {
        return {
          varType: 'constSys' // 应用系统
        }
      }
      case '$curValue': {
        return {
          varType: 'curValue' // 当前值
        }
      }
      case '$curObj': {
        return {
          varType: 'curObj' // 当前对象
        }
      }
      default:
        break
    }
  }
  processParsedTree = ({
    parsed, // 字符串解析后的jsep的AST树
    gateway = false, // 是否为公式编辑器的入口位置
    sysutilInfo, // 系统工具函数信息
    identity, // 身份，用于标识jsep的ast的来源。eg: callee
    args = [], // 函数调用的参数，当identity为callee时有效
    customExprContext // 自定义表达式的上下文
  }) => {
    let { type } = parsed || {}
    try {
      switch (type) {
        case 'Literal': // 常量
          return this.processLiteral({ parsed })
        case 'Property': // 属性{a:33,b:444}: 返回的是一个数组
          return this.processProperty({ parsed })
        case 'Identifier': // 变量
          if (identity === 'callee') {
            return this.genSysutilMethodPrefixAst({
              args,
              funcArg: this.genSysutilMethodAST({ funcName: parsed?.name })
            })
          } else {
            return this.processIdentifier({ parsed })
          }
        case 'MemberExpression': // 成员表达式
          return this.processMemberExpression({ parsed, identity, args })
        case 'CallExpression': // 函数调用
          return this.processCallExpression({ parsed })
        case 'UnaryExpression': // 一元表达式
          return this.processUnaryExpression({ parsed })
        case 'BinaryExpression': // 二元表达式
          return this.processBinaryExpression({ parsed, gateway, identity })
        case 'ConditionalExpression': // 三元表达式
          return this.processConditionalExpression({ parsed })
        case 'ArrayExpression': // 数组
          return this.processArrayExpression({ parsed })
        case 'ObjectExpression': // 对象
          return this.processObjectExpression({ parsed })
        case 'ArrowFunctionExpression': // 箭头函数
          return this.processArrowFunctionExpression({
            parsed,
            sysutilInfo
          })
        case 'Compound': // 复合表达式 (typeof aaa)
          return this.processCompound({ parsed })
        case 'NewExpression': // new 关键字
        case 'SpreadElement': // 展开运算符
        case 'TemplateLiteral': // 模板字符串
          throw new ParseError({
            message: `not support ${type}`,
            type: type
          })
        default:
          return { op: 'val' }
      }
    } catch (e) {
      if (e instanceof ParseError) {
        if (gateway) {
          // 如果是公式编辑器入口位置，fallback使用自定义表达式
          switch (e.type) {
            case 'SpreadElement':
              if (parsed.type === e.type) {
                throw e // 不处理展开运算符，错误继续抛出
              }
              break
            default:
              break
          }
          e.source = parsed.exprStr
          console.log(e)
          reportDiagError({ phase: 'custom-expr-fallback', error: e })
          return this.processCustomExpr({ parsed })
        } else if (customExprContext) {
          // custom-expression walker 的调用方会负责继续递归。这里若再次递归，
          // 复合节点会被局部替换两次，可能留下 `.includes(...)` 或空箭头体。
          return
        } else {
          throw e
        }
      } else {
        throw e
      }
    }
  }
  processLiteral = ({ parsed }) => {
    const { value, raw } = parsed || {}
    if (value && value instanceof Object) {
      // eg: $文本变量1.replace(/#+s+/g, "")
      // 正则表达式无法直接在公式编辑器中编辑，需要使用自定义表达式
      throw new ParseError({
        message: `not support Literal. ${raw}`,
        type: 'Literal'
      })
    }
    return {
      op: 'val',
      val: value
    }
  }
  processProperty = ({ parsed }) => {
    let { key, value, computed } = parsed || {}
    let keyAst
    if (computed) {
      // 计算属性
      keyAst = this.processParsedTree({ parsed: key })
    } else {
      let { name, value } = key || {}
      keyAst = { op: 'val', val: name || value }
    }
    return [keyAst, this.processParsedTree({ parsed: value })]
  }
  processIdentifier = ({ parsed }) => {
    let { name } = parsed || {}
    let ctx = this.getCtx(name)
    let { varType } = ctx || {}
    let ast = { op: 'val' }
    switch (varType) {
      case 'actionResult': // 动作返回
        ast = this.genActionResultAST({ ctx })
        break
      case 'forItem': // 循环下的当前数据
        ast = this.genForItemAST({ ctx })
        break
      case 'forIndex': // 循环下的当前序号
        ast = this.genForIndexAST({ ctx })
        break
      case 'forArg': // 循环下的arg参数
        ast = this.genForArgAst({ ctx })
        break
      case 'forEachParams': // 次数循环下的循环次数
        ast = this.genForEachParamsAST({ ctx })
        break
      case 'forEachParamsIndex': // 数组循环下的局部变量
        ast = this.genForEachParamsIndexAST({ ctx })
        break
      case 'arrCallbackParam': // 数组相关方法的，循环处理函数的形参
      case 'local': // 局部变量
        ast = this.genLocalAST({ ctx, parsed })
        break
      case 'globalVar': // 全局变量
        ast = this.genGlobalVarAST({ ctx })
        break
      case 'comp': // 组件
        ast = this.genCompAST({ ctx })
        break
      case 'reqUser':
        ast = this.genReqUserAst({ parsed })
        break
      case 'localVar': // ivx局部变量
        ast = this.genLocalVarAST({ parsed })
        break
      case 'typeIs': // 类型判断
        ast = this.genTypeIsAST({ parsed })
        break
      case 'curValue':
        ast = this.genCurValueAST({ ctx })
        break
      default:
        ast = this.genOtherIdentifierAST({ parsed, varType })
        break
    }
    return ast
  }
  processMemberExpression = ({ parsed, identity, args }) => {
    let { object, property, computed } = parsed || {}
    let ctx = this.getCtx(object?.name)
    let { varType: objectVarType, varCompId } = ctx || {}
    if (!objectVarType) {
      if (this.isRefsMemberExpression({ parsed })) {
        // $refs.cx4nm2rh3f4000077ggg
        objectVarType = '$refs' // 组件引用
      } else if (this.isRefsCompMemberExpression({ parsed })) {
        // $refs.cx4nm2rh3f4000077ggg.p_value
        objectVarType = '$refsComp' // 组件引用的属性
      } else if (this.isObjectMethodMemberExpression({ parsed, identity })) {
        objectVarType = 'Object' // 对象方法
      } else if (this.isJsonMethodMemberExpression({ parsed, identity })) {
        objectVarType = 'JSON' // JSON
      }
    }

    let ast
    let propertyAST
    // 处理属性
    switch (objectVarType) {
      case 'actionResult': {
        ast = this.processParsedTree({ parsed: object })
        propertyAST = this.genActionResultPropertyAST({
          ...ctx,
          property,
          artAst: ast,
          identity
        })
        break
      }
      case 'curObj':
        ast = this.genCurObjCompPropertyAST({ property, varCompId })
        break
      case 'constSys': // 应用系统
        ast = this.genConstSysPropertyAST({ property })
        break
      case 'requestInfo':
        ast = this.genRequestInfoAst({ property })
        break
      case 'forItem': // 循环下的当前数据
        ast = this.processParsedTree({ parsed: object })
        this.genObjectPropertyAST({ property, objAst: ast, computed })
        break
      case '$refs':
        // 组件引用，eg: $refs.cwtsb74h3f400000gs80
        // eg: $refs.I_cxgfkgyh3f400007q6rg,$refs.i_cxgfkgyh3f400007q6rg
        return this.genRefsAST({ property })
      case '$refsComp':
        // 组件引用的属性 eg: eg: $refs.cwtsb74h3f400000gs80.p_value
        // eg: $refs.cwszty3a3j50000bnsg0.f__windowWidth()
        // eg: $refs.cs63nyfa3j500002r1y0.m__currentWidth()
        ast = this.processParsedTree({ parsed: object })
        propertyAST = this.genRefsCompPropertyAST({ property, compAst: ast })
        break
      case 'Object': // 对象方法，eg: Object.parse(_item.distance)
        return this.genObjectMethodPropertyAST({ property, args })
      case 'JSON': // JSON方法，eg: JSON.parse(_item.distance)
        return this.genJsonMethodPropertyAST({ property, args })
      case 'serviceParam': // 服务入参
        ast = this.genServiceParamAST({ parsed: property })
        break
      case 'param': // 参数
        ast = this.genParamAST({ parsed: property })
        break
      default:
        // 处理属性
        ast = this.processParsedTree({ parsed: object })
        if (identity === 'callee') {
          propertyAST = this.genSysutilMethodAST({
            funcName: property?.name
          })
          // 判断 objAst 是否是get ast
          if (V4FormulaCodeConverter.isGetAST({ ast })) {
            this.appPropertyAST({ objAst: ast, propertyAST })
          } else {
            // 如果不是get ast，则转为自定义表达式
            throw new ParseError({
              message: `not support callee: ${object?.exprStr}`,
              type: 'MemberExprCallee'
            })
          }
        } else {
          // 判断是否是后台
          let flag = this.isServerCbParamsAST({ ast, property })
          if (!flag) {
            this.genObjectPropertyAST({ property, objAst: ast, computed })
          }
        }
        break
    }

    if (identity === 'callee') {
      this.appendFuncArgs({
        sysUtilFuncAST: propertyAST,
        funcArgs: args,
        funcName: property?.name
      })
    }

    return ast
  }
  // 判断是否是后台组件动作的返回值
  isServerCbParamsAST = ({ ast, property }) => {
    let { op, args } = ast || {}
    switch (op) {
      case 'var':
        return this.isServerCbParamsAST({ ast: args[0], property })
      case 'get': {
        let { _blockType } = ast || {}
        // 判断是否是组件动作的返回值
        if (_blockType !== '$cbParams') return false
        // 判断是否是后台组件动作的返回值
        let ctx = this.getCtx('cbParams')
        let { varCompName, varCompScope, action } = ctx || {}
        if (varCompScope !== 'server' || args.length !== 3) return false
        let prePropertyName = args[2].val
        let { ast: propertyAST } =
          this.getServerCompActionRtnPropAST({
            varCompName,
            action,
            propertyName: `${prePropertyName}.${property.name}`
          }) || {}
        if (!propertyAST) return false
        args[2] = propertyAST
        return true
      }
      default:
        break
    }
  }
  processCallExpression = ({ parsed }) => {
    let { callee, arguments: args } = parsed || {}
    let ast = { op: 'val' }
    let isMath = this.isMathMethod({ callee })
    if (isMath) {
      // Math方法: math前台和后台的方法不同，需要特殊处理
      ast = this.genMathMethodAST({ callee, args })
    } else {
      // 其他方法 TODO...
      ast =
        this.processParsedTree({
          parsed: callee,
          identity: 'callee',
          args
        }) || ast
    }
    return ast
  }
  processUnaryExpression = ({ parsed }) => {
    const { operator, argument } = parsed || {}
    let ast = { op: 'val' }
    let opMap = {
      '!': 'not',
      '-': 'neg'
    }
    let op = opMap[operator]
    switch (op) {
      case 'not':
      case 'neg':
        ast = {
          op,
          args: [this.processParsedTree({ parsed: argument })]
        }
        break
    }
    return ast
  }
  processBinaryExpression = ({ parsed, gateway, identity }) => {
    let { operator, left, right } = parsed || {}
    let ast = {}
    switch (operator) {
      case '|': // 字符串拼接
        ast = this.genStringConcatAST({ left, right })
        break
      case '==': // 等于
      case '!=': // 不等于
      case '===': // 全等
      case '!==': // 不全等
      case '>': // 大于
      case '>=': // 大于等于
      case '<': // 小于
      case '<=': // 小于等于
        ast = this.genConditonValAST({ parsed, gateway })
        break
      case '+': // 字符串拼接/加法
        ast = this.genAdditionExpressionAST({ parsed, identity })
        break
      case '-': // 减法
      case '*': // 乘法
      case '/': // 除法
      case '%': // 取余
      case '//': // 整除
        ast = this.genBinaryExpressionAST({ parsed })
        break
      case '&&': // 与
      case '||': // 或
      default:
        throw new ParseError({
          message: `not support ${operator}`,
          type: 'BinaryExpression'
        })
    }
    return ast
  }
  processArrayExpression = ({ parsed }) => {
    let { elements } = parsed || {}
    let args = []
    if (Array.isArray(elements)) {
      elements.map(e => {
        let r = this.processParsedTree({ parsed: e, gateway: true })
        if (!Array.isArray(r)) {
          r = [r]
        }
        args.push(...r)
      })
    }
    return {
      op: 'var',
      args: [
        {
          op: 'list',
          args
        }
      ]
    }
  }
  processObjectExpression = ({ parsed }) => {
    let { properties } = parsed || {}
    let dictArgs = []
    if (Array.isArray(properties)) {
      properties.map(p => {
        let r = this.processParsedTree({ parsed: p })
        if (!Array.isArray(r)) {
          r = [r]
        }
        dictArgs.push(...r)
      })
    }
    return {
      op: 'var',
      args: [
        {
          op: 'dict',
          args: dictArgs
        }
      ]
    }
  }
  processArrowFunctionExpression = ({ parsed, sysutilInfo }) => {
    let { params, body } = parsed || {}
    let innerGetCtx = (...ps) => {
      let str = ps[0]
      let index = -1
      if (Array.isArray(params)) {
        index = params.findIndex(p => p.name === str)
      }
      if (index < 0) return
      let { inParams } = sysutilInfo?.params?.[0] || {}
      let { name: paramName } = inParams?.[index] || {}
      return {
        varType: 'arrCallbackParam',
        paramName
      }
    }
    this.innerGetCtxQueue.push(innerGetCtx)
    let rtnAst = this.processParsedTree({ parsed: body, gateway: true })
    this.innerGetCtxQueue.pop()
    return {
      op: 'lambda',
      val: ['item', 'index'],
      args: [
        {
          op: 'block',
          args: [
            {
              op: 'return',
              args: [rtnAst]
            }
          ]
        }
      ],
      _blockType: 'funcInParam'
    }
  }
  processCompound = ({ parsed }) => {
    let { body } = parsed || {}
    let ast = { op: 'val' }
    if (
      Array.isArray(body) &&
      body.length > 1 &&
      this.isTypeof({ parsed: body[0] })
    ) {
      let funcName = body[0].name
      ast = this.processParsedTree({
        parsed: body[1],
        sysutilInfo: this.getSysutilInfoFromFuncName({ funcName })
      })
      let funcArg = this.genSysutilMethodAST({
        funcName
      })
      if (this.isGetAST({ ast }) && funcArg) {
        let getArgs = ast.args?.[0]?.args
        getArgs.push(funcArg)
      }
    } else {
      throw new ParseError({
        message: 'not support compound expression',
        type: 'compound'
      })
    }
    return ast
  }
  processConditionalExpression = ({ parsed }) => {
    let { test, consequent, alternate } = parsed || {}
    let args = []
    if (test) {
      args.push(this.processParsedTree({ parsed: test }))
    }
    if (consequent) {
      args.push(this.processParsedTree({ parsed: consequent }))
    }
    if (alternate) {
      args.push({
        op: '=',
        args: [{ op: 'val' }, { op: 'val' }]
      })
      args.push(this.processParsedTree({ parsed: alternate }))
    }
    return { op: 'switchexp', args }
  }
  genActionResultAST = ({ ctx }) => {
    let { actionBlockId, varCompName, action, varCompScope } = ctx || {}
    let ast = {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['local', `${actionBlockId}Rtn`]
            }
          ],
          _blockType: '$cbParams',
          _ver: 1
        }
      ]
    }
    if (varCompScope === 'stage') {
      // 处理当个返回值情况：cbParams
      let stageCompActionMap = MapCreator.genStageCompActionMap()
      let key = `${varCompName}$${action}`
      let { singleParam } = stageCompActionMap[key] || {}
      if (singleParam) {
        ast.args[0].args.push({
          op: 'index',
          args: [{ op: 'val', val: 'result' }]
        })
      }
    }

    return ast
  }
  genForItemAST = ({ ctx: { forContainerId } }) => {
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['item', forContainerId]
            }
          ],
          _blockType: '$cbParams'
        }
      ]
    }
  }
  genObjectPropertyAST = ({ property, objAst = {}, computed }) => {
    if (!this.isGetAST({ ast: objAst })) return
    // 处理属性(存在两种情况)：
    // aa.bb: {type:"Identifier", name: "bb}
    // aa[0]: {type:"Literal", value: 0}
    // aa[bb]: {type:"Identifier", name: "bb"}
    // aa["bb"]: {type:"Literal", value: "bb"}
    let { name } = property || {}
    let propertyAst
    if (computed) {
      // 计算属性
      propertyAst = this.processParsedTree({ parsed: property, gateway: true })
    } else {
      propertyAst =
        name !== undefined
          ? { op: 'val', val: name }
          : this.processParsedTree({ parsed: property, gateway: true })
    }
    let isArrayRtn = this.isArrayRtnFromAST({ ast: objAst })
    let pAst
    if (isArrayRtn) {
      let { value } = property || {}
      if (value === 0) {
        pAst = {
          op: 'sysutil',
          val: 'arr_firstItem',
          _blockType: 'sysutil'
        }
      } else if (name === 'length') {
        // 特殊处理数组长度的显示
        pAst = {
          op: 'sysutil',
          val: 'arr_itemTotal',
          _blockType: 'sysutil'
        }
      } else {
        pAst = {
          op: 'sysutil',
          val: 'arr_oneArrItem',
          _blockType: 'sysutil',
          args: [propertyAst]
        }
      }
    } else {
      pAst = {
        op: 'sysutil',
        val: 'obj_item',
        _blockType: 'sysutil',
        args: [propertyAst]
      }
    }
    let getArgs = objAst.args?.[0]?.args
    if (getArgs) {
      getArgs.push(pAst)
    }
    return pAst
  }
  genForIndexAST = ({ ctx: { forContainerId } }) => {
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['index', forContainerId]
            }
          ],
          _blockType: '$cbParams'
        }
      ]
    }
  }
  genForArgAst = ({ ctx: { forContainerId, argIndex } }) => {
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: [`arg${argIndex}`, forContainerId]
            }
          ],
          _blockType: '$cbParams'
        }
      ]
    }
  }
  genServiceParamAST = ({ parsed }) => {
    let { name } = parsed || {}
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['param', name]
            }
          ],
          _cbParamsType: 'serviceParam',
          _blockType: '$cbParams',
          _ver: 1
        }
      ],
      cType: 'JsonVal'
    }
  }
  genParamAST = ({ parsed }) => {
    let { name } = parsed || {}
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['param', name]
            }
          ],
          _blockType: '$cbParams'
        }
      ]
    }
  }
  genLocalVarAST = ({ parsed }) => {
    let { name } = parsed || {}
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['local', name]
            }
          ],
          _cbParamsType: 'localVar',
          _blockType: '$cbParams'
        }
      ]
    }
  }
  genGlobalVarAST = ({ ctx: { varCompId } }) => {
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['var', varCompId]
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
  // 数组相关方法（map,find），循环处理的回调函数的形参
  genLocalAST = ({ ctx, parsed }) => {
    let { paramName } = ctx || {}
    let { name } = parsed || {}
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['local', paramName || name]
            }
          ],
          _blockType: '$cbParams'
        }
      ]
    }
  }
  genStringConcatAST = ({ left, right }) => {
    let convertedArgs = []
    ;[left, right].map(item => {
      let r = this.processParsedTree({
        parsed: item,
        identity: 'stringConcat'
      })
      if (!Array.isArray(r)) {
        let arg = r?.args?.[0]
        let { op, args } = arg || {}
        if (op === 'concat') {
          // 字符串拼接拍平
          r = args
        } else {
          r = [r]
        }
      }
      convertedArgs.push(...r)
    })
    return {
      op: 'var',
      cType: 'String',
      args: [
        {
          op: 'concat',
          args: convertedArgs
        }
      ]
    }
  }
  genBinaryExpressionAST = ({ parsed }) => {
    let { operator, left, right } = parsed || {}
    let convertedArgs = []
    ;[left, right].map(item => {
      let r = this.processParsedTree({ parsed: item })
      if (!Array.isArray(r)) {
        r = [r]
      }
      convertedArgs.push(...r)
    })
    return {
      op: operator,
      args: convertedArgs
    }
  }
  genAdditionExpressionAST = ({ parsed, identity }) => {
    let { operator, left, right } = parsed || {}
    if (
      this.isStringConcatExpression({ parsed }) ||
      identity === 'stringConcat'
    ) {
      return this.genStringConcatAST({ left, right })
    } else {
      return this.genBinaryExpressionAST({ parsed })
    }
  }
  genTypeIsAST = ({ parsed }) => {
    let { name } = parsed || {}
    return {
      op: 'get',
      args: [
        {
          op: 'ref',
          val: ['local', `"${name}"`]
        }
      ],
      _blockType: '$cbParams'
    }
  }
  // 生成当前对象组件属性的AST
  genCurObjCompPropertyAST = ({ property, varCompId }) => {
    let compAst = this.genCompAST({
      ctx: { varCompId, _blockType: '$curObj' }
    })
    this.genRefsCompPropertyAST({ property, compAst })
    return compAst
  }
  // 生成应用系统的属性的AST
  genConstSysPropertyAST = ({ property }) => {
    let compAst = {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['sobj', 'base']
            }
          ],
          _blockType: '$refs'
        }
      ]
    }
    this.genRefsCompPropertyAST({ property, compAst })
    return compAst
  }
  // 生成当前数据的 AST
  genCurValueAST = ({ ctx }) => {
    let { varCompId, paramName } = ctx || {}
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['var', varCompId]
            },
            {
              op: 'field',
              val: paramName
            }
          ],
          _blockType: '$refs'
        }
      ]
    }
  }
  genOtherIdentifierAST = ({ parsed, varType }) => {
    let { name } = parsed || {}
    // fix undefined 转为字符串问题
    if (name === 'undefined') {
      return {
        op: 'val',
        val: undefined
      }
    } else if (name === this.str) {
      return {
        op: 'val',
        val: name
      }
    }
    throw new ParseError({
      message: `unknown varType: ${varType}`,
      type: 'unknownVarType'
    })
  }

  isMathMethod = ({ callee }) => {
    let { type, object } = callee || {}
    if (type === 'MemberExpression') {
      let { name } = object || {}
      return name === 'Math'
    }
  }
  isObjectMethodMemberExpression = ({ parsed, identity }) => {
    let { type, object } = parsed || {}
    if (type === 'MemberExpression') {
      let { name } = object || {}
      return name === 'Object' && identity === 'callee'
    }
  }
  isJsonMethodMemberExpression = ({ parsed, identity }) => {
    let { type, object } = parsed || {}
    if (type === 'MemberExpression') {
      let { name } = object || {}
      return name === 'JSON' && identity === 'callee'
    }
  }
  // 判断jsep的ast是否是refs
  isRefsMemberExpression = ({ parsed }) => {
    let { type, object } = parsed || {}
    return (
      type === 'MemberExpression' &&
      object?.type === 'Identifier' &&
      object?.name === '$refs'
    )
  }
  // 判断jsep的ast是否是refsProperty
  isRefsCompMemberExpression = ({ parsed }) => {
    let { type, object, property } = parsed || {}
    let { type: objectType, object: objectObj, property: objectProperty } =
      object || {}
    return (
      type === 'MemberExpression' &&
      objectType === 'MemberExpression' &&
      objectObj?.name === '$refs' &&
      objectProperty?.name?.length === 20 &&
      property?.type === 'Identifier'
    )
  }
  isStringConcatExpression = ({ parsed }) => {
    let { operator, left, right } = parsed || {}
    if (operator !== '+') return false
    return [left, right].some(item => {
      let { type, value } = item || {}
      switch (type) {
        case 'Literal':
          return typeof value === 'string'
        case 'BinaryExpression':
          return this.isStringConcatExpression({ parsed: item })
        default:
          break
      }
    })
  }
  isTypeof = ({ parsed }) => {
    let { name } = parsed || {}
    return name === 'typeof'
  }
  isNewOperator = ({ parsed }) => {
    let { name } = parsed || {}
    return name === 'new'
  }
  genMathMethodAST = ({ callee, args }) => {
    let { property, object } = callee || {}
    let { name } = property || {}
    let convertedArgs = args.map(item =>
      this.processParsedTree({ parsed: item })
    )
    let methodArg = {
      op: 'method',
      val: name
    }
    if (Array.isArray(convertedArgs) && convertedArgs.length > 0) {
      methodArg.args = convertedArgs
    }
    let { varType } = this.getCtx(object.name) || {}
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          _blockType: '$sysUtil',
          args: [
            {
              op: 'ref',
              val:
                varType === 'serverMath' ? ['java', 'JsMath'] : ['js', 'Math']
            },
            methodArg
          ]
        }
      ]
    }
  }

  getSysutilInfoFromFuncName = ({ funcName }) => {
    let sysutilMap = MapCreator.genSysutilMap()
    // 反包函数的别名映射
    funcName = V4FormulaCodeConverter.sfutilAliasMap[funcName] || funcName
    let sysutilInfo = sysutilMap[funcName]
    return sysutilInfo
  }
  // 生成反包函数的arg
  genSysutilMethodAST = ({ funcName }) => {
    if (funcName === '$SF_getSelf') return
    let sysutilInfo = this.getSysutilInfoFromFuncName({ funcName })
    let { name } = sysutilInfo || {}
    if (!name) {
      throw new ParseError({
        message: `not support sysutil method ${funcName}`,
        type: 'sysutil'
      })
    }
    return {
      op: 'sysutil',
      val: name.replace('$SF_', ''),
      _blockType: 'sysutil'
    }
  }
  // 生成返回结果的值属性
  genGetSelfAST = () => {
    return {
      op: 'sysutil',
      val: 'getSelf',
      _blockType: 'paramFunc',
      _alias: 'value'
    }
  }
  genSysutilMethodPrefixAst = ({ args, funcArg }) => {
    let convertedArgs = args.map(item =>
      this.processParsedTree({ parsed: item })
    )
    if (Array.isArray(convertedArgs) && convertedArgs.length > 0) {
      // 存在反包函数的前缀系统块
      let firtArg = convertedArgs[0]
      if (this.isGetAST({ ast: firtArg }) && funcArg) {
        funcArg.args = convertedArgs.slice(1)
        let getArgs = firtArg?.args?.[0]?.args
        getArgs.push(funcArg)
      }
      return firtArg
    }
  }
  isGetAST = ({ ast }) => {
    let { op, args } = ast || {}
    if (op === 'var') {
      op = args?.[0]?.op
    }
    return op === 'get'
  }
  genCompAST = ({ ctx: { varCompId, _blockType = '$refs' } }) => {
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['var', varCompId]
            }
          ],
          _blockType
        }
      ]
    }
  }
  genRefsAST = ({ property }) => {
    let { name } = property || {}
    if (!name) return
    let prefixPart
    let parts = name.split('_')
    if (parts.length > 1) {
      prefixPart = parts[0]
      name = parts[1]
    }
    switch (prefixPart) {
      case 'I': // 循环下的当前数据
        return this.genForItemAST({ ctx: { forContainerId: name } })
      case 'i': // 循环下的当前序号
        return this.genForIndexAST({ ctx: { forContainerId: name } })
      case 'v0': // 树形容器的当前层级
        return this.genForArgAst({
          ctx: { forContainerId: name, argIndex: 0 }
        })
      case 'v1': // 树形容器的当前序号
        return this.genForArgAst({
          ctx: { forContainerId: name, argIndex: 1 }
        })
      case 'v2': // 树形容器的当前展开状态
        return this.genForArgAst({
          ctx: { forContainerId: name, argIndex: 2 }
        })
      default:
        return this.genCompAST({
          ctx: { varCompId: name }
        })
    }
  }
  // 处理refs的属性
  genRefsCompPropertyAST = ({ property, compAst }) => {
    if (!this.isGetAST({ ast: compAst })) return
    let { name } = property || {}
    if (!name) return
    let prefixPart = name.slice(0, 2)
    name = name.slice(2)
    let pAst
    switch (prefixPart) {
      case 'p_':
        pAst = {
          op: 'field',
          val: name
        }
        break
      case 'm_':
      case 'f_':
        pAst = {
          op: 'method',
          val: name
        }
        break
      default:
        break
    }
    let getArgs = compAst.args?.[0]?.args
    if (getArgs && pAst) {
      getArgs.push(pAst)
    }
    return pAst
  }

  genObjectMethodPropertyAST = ({ property, args }) => {
    // eg: Object.parse(_item.distance)
    let ast // 处理前缀部分的ast
    let funcName // 函数名
    let sysUtilFuncAST // 反包函数的ast
    let funcArgs = [] // 函数参数

    let [prefixPart, ...restArgs] = args || []
    funcArgs = restArgs
    funcName = property?.name
    ast = this.processParsedTree({
      parsed: prefixPart,
      sysutilInfo: this.getSysutilInfoFromFuncName({ funcName })
    })
    sysUtilFuncAST = this.genSysutilMethodAST({
      funcName
    })
    this.appendSysutilFuncASTWithFuncArgs({
      ast,
      sysUtilFuncAST,
      funcArgs,
      funcName
    })
    return ast
  }
  genJsonMethodPropertyAST = ({ property, args }) => {
    // eg: JSON.parse(_item.distance)
    let ast // 处理前缀部分的ast
    let funcName // 函数名
    let sysUtilFuncAST // 反包函数的ast
    let funcArgs = [] // 函数参数

    let [prefixPart, ...restArgs] = args || []
    funcArgs = restArgs
    funcName = `JSON.${property?.name}`
    ast = this.processParsedTree({ parsed: prefixPart })
    sysUtilFuncAST = this.genSysutilMethodAST({ funcName })

    this.appendSysutilFuncASTWithFuncArgs({
      ast,
      sysUtilFuncAST,
      funcArgs,
      funcName
    })
    return ast
  }
  // 将反包函数ast追加到getast的参数中
  appendSysutilFuncASTWithFuncArgs = ({
    ast,
    sysUtilFuncAST,
    funcArgs,
    funcName
  }) => {
    if (this.isGetAST({ ast }) && sysUtilFuncAST) {
      // 处理函数参数
      this.appendFuncArgs({
        sysUtilFuncAST,
        funcArgs,
        funcName
      })
      let getArgs = ast.args?.[0]?.args
      getArgs.push(sysUtilFuncAST)
    }
  }
  // 将函数参数追加到反包函数ast中
  appendFuncArgs = ({ sysUtilFuncAST, funcArgs, funcName }) => {
    if (Array.isArray(funcArgs) && funcArgs.length > 0 && sysUtilFuncAST) {
      // 处理函数参数
      sysUtilFuncAST.args = funcArgs.map(item =>
        this.processParsedTree({
          gateway: true, // 是否为公式编辑器的入口位置
          parsed: item,
          sysutilInfo: this.getSysutilInfoFromFuncName({ funcName })
        })
      )
    }
  }
  // 将Member中的perperty属性的ast追加到object的ast上去
  appPropertyAST = ({ objAst, propertyAST }) => {
    let getArgs = this.getGetASTArgs({ ast: objAst })
    if (getArgs && propertyAST) {
      getArgs.push(propertyAST)
    }
  }
  // 获取 getAst中的 args
  getGetASTArgs = ({ ast }) => {
    let walkAst = ({ ast }) => {
      let { op, args } = ast || {}
      if (op === 'get') {
        return args
      } else if (op === 'var') {
        return walkAst({ ast: args?.[0] })
      }
    }
    return walkAst({ ast })
  }
  // 条件块(true/false)
  genConditonValAST = ({ parsed, gateway }) => {
    let { operator, left, right } = parsed || {}
    let val
    switch (operator) {
      case '&&':
        operator = 'and'
        break
      case '||':
        operator = 'or'
        break
      case '==':
      case '===': {
        if (this.scope === 'server') {
          operator = 'sysop'
          val = 'equal'
        } else {
          operator = '='
        }
        break
      }
      case '!=':
      case '!==': {
        if (this.scope === 'server') {
          operator = 'sysop'
          val = 'notEqual'
        } else {
          operator = '!='
        }
        break
      }
    }
    let convertedArgs = [left, right].map(item =>
      this.processParsedTree({ parsed: item })
    )
    let ast = {
      op: operator,
      args: convertedArgs
    }
    if (gateway) ast._blockType = '$condVal'
    if (val) ast.val = val
    return ast
  }
  // 次数循环下的循环次数
  genForEachParamsAST = ({ ctx: { forContainerId } }) => {
    return {
      op: 'get',
      args: [
        {
          op: 'ref',
          val: ['local', forContainerId]
        }
      ],
      _blockType: '$cbParams'
    }
  }
  // 数组循环下的局部变量的处理
  genForEachParamsIndexAST = ({ ctx: { forContainerId, index } }) => {
    return {
      op: 'get',
      args: [
        {
          op: 'ref',
          val: ['local', forContainerId]
        },
        {
          op: 'index',
          args: [
            {
              op: 'val',
              val: index
            }
          ],
          _uiSkip: true
        }
      ],
      _cbParamsType: 'forEachParamsIndex',
      _blockType: '$cbParams'
    }
  }
  // 生成请求用户的信息
  genReqUserAst = ({ parsed }) => {
    let { name } = parsed || {}
    let sysFunc =
      name === '$$userInfo' ? '_serviceReqUserInfo' : '_serviceReqUserId'
    return {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            {
              op: 'ref',
              val: ['sysFunc', sysFunc]
            }
          ],
          _cbParamsType: 'serviceParam',
          _blockType: '$cbParams'
        }
      ],
      cType: 'String'
    }
  }
  // 生成请求信息的AST
  genRequestInfoAst = ({ property }) => {
    let { name } = property || {}
    let cType, sysfunc, _cbParamsType, _cbParamsGroup
    switch (name) {
      case 'userId':
        cType = 'String'
        sysfunc = '_serviceReqUserId'
        _cbParamsType = 'serviceParam'
        break
      case 'userInfo':
        cType = 'String'
        sysfunc = '_serviceReqUserInfo'
        _cbParamsType = 'serviceParam'
        break
      case 'ip':
        cType = 'String'
        sysfunc = '_serviceReqIP'
        _cbParamsGroup = 'requestInfo'
        break
      case 'header':
        cType = 'JsonObj'
        sysfunc = '_serviceReqHeader'
        _cbParamsGroup = 'requestInfo'
        break
      case 'body':
        cType = 'String'
        sysfunc = 'getInParams_body'
        _cbParamsGroup = 'requestInfo'
        break
      case 'cookie':
        cType = 'String'
        sysfunc = '_serviceCookies'
        _cbParamsGroup = 'requestInfo'
        break
      case 'agent':
        cType = 'String'
        sysfunc = '_serviceReqUserAgent'
        _cbParamsGroup = 'requestInfo'
        break
      case 'url':
        cType = 'String'
        sysfunc = 'getInParams_url'
        _cbParamsGroup = 'requestInfo'
        break
    }

    let arg = {
      op: 'get',
      args: [
        {
          op: 'ref',
          val: ['sysFunc', sysfunc]
        }
      ],
      _blockType: '$cbParams'
    }
    if (_cbParamsGroup) arg._cbParamsGroup = _cbParamsGroup
    if (_cbParamsType) arg._cbParamsType = _cbParamsType
    return { op: 'var', args: [arg], cType }
  }
  // 判断ast结果的是数组还是对象
  isArrayRtnFromAST = ({ ast }) => {
    let { cType } = ast || {}
    // 存在cType的情况下，优先使用cType
    if (cType) {
      return ['JsonArr'].includes(cType)
    } else {
      // 查询最后一个
      let walkAst = ({ ast }) => {
        let { args, op } = ast || {}
        if (Array.isArray(args) && args.length > 0) {
          return walkAst({ ast: args[args.length - 1] })
        } else {
          switch (op) {
            case 'list':
              return true
            case 'method': {
              let { _jsParam } = ast || {}
              if (!_jsParam) return false
              let sysutilInfo = this.getSysutilInfoFromFuncName({
                funcName: _jsParam
              })
              let { uType } = sysutilInfo || {}
              return ['arr', 'arr2d'].includes(uType)
            }
            default:
              return false
          }
        }
      }
    }
  }
  genActionResultPropertyAST = ({
    property,
    varCompName,
    varCompScope,
    action,
    artAst = {},
    identity // 标识当前的property的类型，eg: callee
  }) => {
    let { name } = property || {}
    let ast
    let cType = ''
    let singleParam = false // 是否是单个值
    if (varCompScope === 'stage') {
      let ret =
        this.getStageCompActionRtnPropAST({
          varCompName,
          action,
          propertyName: name
        }) || {}
      ast = ret.ast
      singleParam = ret.singleParam
    } else {
      let ret =
        this.getServerCompActionRtnPropAST({
          varCompName,
          action,
          propertyName: name
        }) || {}
      ast = ret.ast
      cType = ret.cType
      singleParam = ret.singleParam
    }

    if (!ast && !singleParam) {
      if (identity === 'callee') {
        ast = this.genSysutilMethodAST({ funcName: name })
        if (!ast) ast = this.genGetSelfAST()
      } else {
        ast = { op: 'field', val: name }
      }
    }

    if (cType) artAst.cType = cType
    let getArgs = artAst.args?.[0]?.args
    if (getArgs && ast) {
      if (singleParam) {
        getArgs.push(ast)
      } else {
        getArgs.push(
          {
            op: 'field',
            val: 'result',
            _uiSkip: true
          },
          ast
        )
      }
    }
    return ast
  }
  // 获取后台动作返回参数的属性ast
  getServerCompActionRtnPropAST = ({ varCompName, action, propertyName }) => {
    let ast, singleParam
    let serverCompActionMap = MapCreator.genServerCompActionMap()
    let key = `${varCompName}$${action}`
    let { rtnPropLocMap } = serverCompActionMap?.[key] || {}
    // TODO.... 处理 java 中 record参数: {name:"data",type:"String",param:"result.data"}
    let propInfo = rtnPropLocMap?.[propertyName]

    if (!propInfo) return
    let { name, func, param, type } = propInfo || {}
    if (func || param) {
      ast = {
        op: 'method',
        val: name,
        _jsParam: param || func
      }
    }
    return { ast, cType: type, singleParam }
  }
  // 获取前台动作返回参数的属性ast
  getStageCompActionRtnPropAST = ({ varCompName, action, propertyName }) => {
    let stageCompActionMap = MapCreator.genStageCompActionMap()
    let key = `${varCompName}$${action}`
    let { rtnPropLocMap, singleParam } = stageCompActionMap[key] || {}
    if (singleParam) {
      return {
        ast: {
          op: 'sysutil',
          val: 'obj_item',
          _blockType: 'sysutil',
          args: [{ op: 'val', val: propertyName }]
        },
        singleParam
      }
    }
    let propInfo = rtnPropLocMap?.[propertyName]
    if (!propInfo) return
    let { name, func } = propInfo || {}
    let ast
    if (func) {
      ast = {
        type: 'paramFunc',
        name
      }
      if (func !== name) ast.val = func
    } else {
      ast = {
        op: 'field',
        val: name
      }
    }

    return { ast }
  }
  // 去除过滤掉反包函数中参数的提示文本部分
  replaceSFParamPrompt = ({ str }) => {
    var regex = /\$P_.+?:/g
    str = str.replace(regex, match => '')
    return str
  }
  log = (...args) => {
    // 原实现在非浏览器环境下无条件打印，作为服务接口运行时会刷屏，改为需显式开启
    if (
      typeof process !== 'undefined' &&
      process.env?.V4_TO_V5_FORMULA_DEBUG
    ) {
      console.log(...args)
    }
  }
  /**自定义表达式 */
  processCustomExpr = ({ parsed }) => {
    let context = {
      num: 0,
      vList: [],
      jsFnArgs: []
    }
    this.walkCustomExprParsed({ parsed, context })
    let { jsFnArgs, vList } = context
    // 与编辑器公式编辑器保存 bind 的产物一致：jsfn 外层包 var（表达式值包装）
    return {
      op: 'var',
      args: [
        {
          op: 'jsfn',
          val: [new ExprAstToString({ ast: parsed }).exec(), ...vList],
          args: jsFnArgs
        }
      ]
    }
  }
  walkCustomExprParsed = ({ parsed, context }) => {
    let { type } = parsed || {}
    switch (type) {
      case 'CallExpression':
      case 'NewExpression':
        {
          let { arguments: args, callee } = parsed || {}
          this.walkCustomExprParsed({ parsed: callee, context })
          if (Array.isArray(args) && args.length > 0) {
            args.map(item => {
              let { type } = item || {}
              let ast
              if (type === 'ArrowFunctionExpression') {
                // 箭头函数
                this.walkCustomExprParsed({ parsed: item, context })
              } else {
                ast = this.processParsedTree({
                  parsed: item,
                  customExprContext: context
                })
              }

              if (this.isGetAST({ ast })) {
                this.genReplacement({ context, ast, parsed: item })
              } else {
                // 不能转为getAst，继续递归处理
                this.walkCustomExprParsed({ parsed: item, context })
              }
            })
          }
        }
        break
      case 'MemberExpression':
        {
          let { object, property } = parsed || {}
          if (
            context.fullJsMode &&
            this.containsFunctionExpression({ parsed: object })
          ) {
            this.walkCustomExprParsed({ parsed: object, context })
          } else {
            let ast = this.processParsedTree({
              parsed: object,
              customExprContext: context
            })
            if (this.isGetAST({ ast })) {
              parsed.object = this.genReplacement({ context, ast })
            } else {
              // 不能转为getAst，继续递归处理
              this.walkCustomExprParsed({ parsed: object, context })
            }
          }
          let ast2 = this.processParsedTree({
            parsed: property,
            customExprContext: context
          })
          if (this.isGetAST({ ast: ast2 })) {
            parsed.property = this.genReplacement({ context, ast: ast2 })
          } else {
            // 不能转为getAst，继续递归处理
            this.walkCustomExprParsed({ parsed: property, context })
          }
        }
        break
      case 'ArrayExpression':
        {
          let { elements } = parsed || {}
          elements.map(item => {
            let ast = this.processParsedTree({
              parsed: item,
              customExprContext: context
            })
            if (this.isGetAST({ ast })) {
              return this.genReplacement({ context, ast, parsed: item })
            } else {
              // 不能转为getAst，继续递归处理
              this.walkCustomExprParsed({ parsed: item, context })
            }
          })
        }
        break
      case 'SpreadElement': // 展开运算符
        {
          let { argument } = parsed || {}
          let ast = this.processParsedTree({
            parsed: argument,
            customExprContext: context
          })
          if (this.isGetAST({ ast })) {
            this.genReplacement({
              context,
              ast,
              parsed: argument
            })
          } else {
            // 不能转为getAst，继续递归处理
            this.walkCustomExprParsed({ parsed: argument, context })
          }
        }
        break
      case 'ObjectExpression':
        {
          let { properties } = parsed || {}
          properties.forEach(item => {
            this.walkCustomExprParsed({ parsed: item, context })
          })
        }
        break
      case 'Property': {
        if (parsed.computed) {
          this.walkOrReplaceCustomExpr({ parsed: parsed.key, context })
        }
        this.walkOrReplaceCustomExpr({ parsed: parsed.value, context })
        break
      }
      case 'BinaryExpression':
      case 'LogicalExpression':
      case 'AssignmentExpression': {
        // eg: param.pageX-$curObj.m__elOffsetLeft()-$refs.c3tf99na3j50000ar3s0.p_value/2
        let { left, right } = parsed || {}
        if (type === 'AssignmentExpression') {
          // 赋值左侧只替换其对象部分，保留最后一级属性写入语义。
          this.walkCustomExprParsed({ parsed: left, context })
        } else {
          this.walkOrReplaceCustomExpr({ parsed: left, context })
        }
        this.walkOrReplaceCustomExpr({ parsed: right, context })
        break
      }
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
      case 'FunctionDeclaration': {
        let { body } = parsed || {}
        this.walkCustomExprParsed({ parsed: body, context })
        break
      }
      case 'UnaryExpression': {
        // eg: !phone.match(/^1[3-9]\d{9}$/)
        let { argument } = parsed || {}
        let ast = this.processParsedTree({
          parsed: argument,
          customExprContext: context
        })
        if (this.isGetAST({ ast })) {
          this.genReplacement({ context, ast, parsed: argument })
        } else {
          // 不能转为getAst，继续递归处理
          this.walkCustomExprParsed({ parsed: argument, context })
        }
        break
      }
      case 'TemplateLiteral': {
        let { expressions } = parsed || {}
        if (Array.isArray(expressions) && expressions.length > 0) {
          expressions.map(item => {
            let ast = this.processParsedTree({
              parsed: item,
              customExprContext: context
            })
            if (this.isGetAST({ ast })) {
              this.genReplacement({ context, ast, parsed: item })
            } else {
              this.walkCustomExprParsed({ parsed: item, context })
            }
          })
        }
        break
      }
      case 'ConditionalExpression': {
        let { test, consequent, alternate } = parsed || {}
        let list = [test, consequent, alternate]
        list.map(item => {
          let ast = this.processParsedTree({
            parsed: item,
            customExprContext: context
          })
          if (this.isGetAST({ ast })) {
            this.genReplacement({ context, ast, parsed: item })
          } else {
            this.walkCustomExprParsed({ parsed: item, context })
          }
        })
        break
      }
      case 'BlockStatement':
      case 'Program': {
        for (const item of parsed.body || []) {
          this.walkCustomExprParsed({ parsed: item, context })
        }
        break
      }
      case 'ExpressionStatement':
        this.walkOrReplaceCustomExpr({ parsed: parsed.expression, context })
        break
      case 'ReturnStatement':
      case 'ThrowStatement':
      case 'AwaitExpression':
      case 'YieldExpression':
        this.walkOrReplaceCustomExpr({ parsed: parsed.argument, context })
        break
      case 'VariableDeclaration':
        for (const declaration of parsed.declarations || []) {
          this.walkCustomExprParsed({ parsed: declaration, context })
        }
        break
      case 'VariableDeclarator':
        this.walkOrReplaceCustomExpr({ parsed: parsed.init, context })
        break
      case 'IfStatement':
        this.walkOrReplaceCustomExpr({ parsed: parsed.test, context })
        this.walkCustomExprParsed({ parsed: parsed.consequent, context })
        this.walkCustomExprParsed({ parsed: parsed.alternate, context })
        break
      case 'SequenceExpression':
        for (const expression of parsed.expressions || []) {
          this.walkOrReplaceCustomExpr({ parsed: expression, context })
        }
        break
      case 'UpdateExpression':
        this.walkCustomExprParsed({ parsed: parsed.argument, context })
        break
      case 'ChainExpression':
        this.walkCustomExprParsed({ parsed: parsed.expression, context })
        break
      default: {
        // 其他类型的表达式，TODO...
        break
      }
    }
  }
  walkOrReplaceCustomExpr = ({ parsed, context }) => {
    if (!parsed) return
    // 完整 JavaScript 中带回调的调用必须保留为 JS 子树；若把整个子树
    // 折叠成一个原生 AST 参数，其内部失败的 custom expression 会被旧打印器
    // 单独序列化，容易丢失 receiver 或 block body。
    if (
      context.fullJsMode &&
      this.containsFunctionExpression({ parsed })
    ) {
      this.walkCustomExprParsed({ parsed, context })
      return
    }
    const ast = this.processParsedTree({
      parsed,
      customExprContext: context
    })
    if (this.isGetAST({ ast })) {
      this.genReplacement({ context, ast, parsed })
    } else {
      this.walkCustomExprParsed({ parsed, context })
    }
  }
  containsFunctionExpression = ({ parsed }) => {
    if (!parsed || typeof parsed !== 'object') return false
    if (
      ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(
        parsed.type
      )
    ) {
      return true
    }
    return Object.entries(parsed).some(([key, value]) => {
      if (['exprStr', 'start', 'end', 'loc'].includes(key)) return false
      if (Array.isArray(value)) {
        return value.some(item =>
          this.containsFunctionExpression({ parsed: item })
        )
      }
      return this.containsFunctionExpression({ parsed: value })
    })
  }
  genReplacement = ({ context, ast, parsed }) => {
    let { vList, jsFnArgs } = context || {}
    let v = `$v${++context.num}`
    vList.push(v)
    jsFnArgs.push(ast)
    let rst = {
      type: 'Identifier',
      name: v
    }
    if (parsed) {
      Object.keys(parsed).forEach(key => {
        parsed[key] = undefined
      })
      Object.assign(parsed, rst)
    }
    return rst
  }
}
