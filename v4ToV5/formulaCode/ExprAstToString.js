export default class ExprAstToString {
  constructor({ ast }) {
    this.ast = ast
  }
  // 运算符优先级映射表
  static operatorPriority = {
    '(': 100, // 括号优先级最高
    ')': 100,
    '++': 90, // 自增、自减
    '--': 90,
    '**': 80, // 幂运算符
    '*': 70,
    '/': 70,
    '%': 70,
    '+': 60,
    '-': 60,
    '<<': 50,
    '>>': 50,
    '>>>': 50,
    '&': 40,
    '^': 40,
    '|': 40,
    '<': 30,
    '<=': 30,
    '>': 30,
    '>=': 30,
    in: 30,
    '==': 30,
    '!=': 30,
    '===': 30,
    '!==': 30,
    '&&': 20,
    '||': 10,
    '? :': 5, // 添加三元表达式优先级
    '=': 0, // 赋值运算符最低
    '+=': 0,
    '-=': 0,
    '*=': 0,
    '/=': 0,
    '%=': 0
  }
  exec() {
    return this.visit({ ast: this.ast })
  }
  visit = ({ ast }) => {
    let { type } = ast || {}
    switch (type) {
      case 'Literal':
        // 处理字面量，返回值（数字、字符串等），不能使用 JSON.stringify() 方法，eg: jsep(`/aaa/`);
        // return JSON.stringify(ast.value);
        return ast.raw
      case 'Identifier':
        // 处理标识符，直接返回变量名
        return ast.name
      case 'MemberExpression': {
        // 处理成员表达式（例如对象属性访问）
        // 例如：obj.prop
        // 例如：obj['prop']
        let { object, property, computed, optional } = ast
        let objStr = this.visit({ ast: object })
        // 整数后直接接点号会被解析成小数（1.toString 非法），必须保留括号。
        const isNumericLiteral =
          object.type === 'Literal' && typeof object.value === 'number'
        if (
          object.type === 'BinaryExpression' ||
          object.type === 'ConditionalExpression' ||
          isNumericLiteral
        ) {
          objStr = `(${objStr})`
        }
        let propertyStr = this.visit({ ast: property })
        if (computed) {
          let optionalStr = optional ? '?.' : ''
          return `${objStr}${optionalStr}[${propertyStr}]`
        } else {
          let optionalStr = optional ? '?' : ''
          return `${objStr}${optionalStr}.${propertyStr}`
        }
      }
      case 'CallExpression': {
        // 箭头函数作为 callee 时必须带括号，否则会打印成无效的 `() => x()`。
        let callee = this.visit({ ast: ast.callee })
        if (
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(
            ast.callee?.type
          )
        ) {
          callee = `(${callee})`
        }
        return `${callee}(${ast.arguments
          .map(item => this.visit({ ast: item }))
          .join(', ')})`
      }
      case 'UnaryExpression':
        // 处理一元表达式（例如负号或逻辑非），递归处理操作数
        return `${ast.operator}${this.visit({ ast: ast.argument })}`
      case 'BinaryExpression':
      case 'LogicalExpression': {
        // 处理二元表达式，递归处理左子树和右子树，处理运算优先级,判断使用扩号
        let { operator, left, right } = ast
        let leftStr = this.visit({ ast: left })
        let rightStr = this.visit({ ast: right })
        let leftOp = this.getOperator({ ast: left })
        let rightOp = this.getOperator({ ast: right })
        if (
          leftOp &&
          !this.compareOp({
            op1: leftOp,
            op2: operator
          })
        ) {
          leftStr = `(${leftStr})`
        }
        if (
          rightOp &&
          this.compareOp({
            op1: operator,
            op2: rightOp
          })
        ) {
          rightStr = `(${rightStr})`
        }

        return `${leftStr} ${operator} ${rightStr}`
      }
      case 'ConditionalExpression':
        // 处理条件表达式（三元运算符：condition ? expr1 : expr2）
        return `${this.visit({ ast: ast.test })} ? ${this.visit({
          ast: ast.consequent
        })} : ${this.visit({ ast: ast.alternate })}`
      case 'Compound':
        return (ast.body || [])
          .map(item => this.visit({ ast: item }))
          .join(', ')
      case 'SequenceExpression':
        return (ast.expressions || [])
          .map(item => this.visit({ ast: item }))
          .join(', ')
      case 'ArrayExpression':
        // 处理数组表达式
        return `[${ast.elements
          .map(item => this.visit({ ast: item }))
          .join(', ')}]`
      case 'ObjectExpression': {
        // 处理对象表达式
        return `{${ast.properties
          .map(item => {
            let { type, shorthand } = item
            if (type === 'SpreadElement') {
              return `...${this.visit({ ast: item.argument })}`
            } else if (shorthand) {
              return `${this.visit({ ast: item.value })}`
            } else {
              const key = this.visit({ ast: item.key })
              const propertyKey = item.computed ? `[${key}]` : key
              return `${propertyKey}: ${this.visit({
                ast: item.value
              })}`
            }
          })
          .join(', ')}}`
      }
      case 'ArrowFunctionExpression': {
        let { params, body } = ast
        params = params || []
        let bodyStr = this.visit({ ast: body })
        if (body?.type === 'ObjectExpression') {
          bodyStr = `(${bodyStr})`
        }
        // 处理箭头函数表达式
        return `(${params
          .map(item => this.visit({ ast: item }))
          .join(', ')}) => ${bodyStr}`
      }
      case 'NewExpression':
        // 处理 new 表达式
        return `new ${this.visit({ ast: ast.callee })}(${ast.arguments
          .map(item => this.visit({ ast: item }))
          .join(', ')})`
      case 'SpreadElement':
        return `...${this.visit({ ast: ast.argument })}`
      case 'TemplateLiteral': // 处理模板字面量
        return `\`${this.astToTemplateString({ ast })}\``
    }
    return ''
  }
  // 运算符比较
  compareOp = ({ op1, op2 }) => {
    return (
      ExprAstToString.operatorPriority[op1] >=
      ExprAstToString.operatorPriority[op2]
    )
  }
  // 归一化 获取ast中的operator
  getOperator = ({ ast }) => {
    let { operator, type } = ast || {}
    if (operator) {
      return operator
    }
    switch (type) {
      case 'ConditionalExpression':
        return '? :'
      default:
        return
    }
  }
  astToTemplateString = ({ ast }) => {
    let result = ''
    const quasis = ast.quasis
    const expressions = ast.expressions

    // 遍历每个静态文本（quasis）和表达式（expressions）
    for (let i = 0; i < quasis.length; i++) {
      result += quasis[i].value.cooked // 添加静态文本
      if (i < expressions.length) {
        result += `\${${this.visit({ ast: expressions[i] })}}` // 添加插值表达式
      }
    }
    return result
  }
}

const exprAstString = ({ ast }) => {
  return new ExprAstToString({ ast }).exec()
}
export { exprAstString }
