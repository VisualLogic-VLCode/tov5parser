// 与 VxEditor41 src/utils/jsepWrap/index.js 保持一致。
// 插件注册在 jsep 单例上，公式转换器必须从本模块导入，不能直接导入 jsep。
import jsep, { Jsep } from 'jsep'
import arrow from '@jsep-plugin/arrow'
import regex from '@jsep-plugin/regex'
import spread from '@jsep-plugin/spread'
import newOp from '@jsep-plugin/new'
import template from '@jsep-plugin/template'
import object from './jsepObjectPlugin.js'

jsep.plugins.register(object)
jsep.plugins.register(arrow)
jsep.plugins.register(regex)
jsep.plugins.register(spread)
jsep.plugins.register(newOp)
jsep.plugins.register(template)

jsep.addBinaryOp('**', 10)
jsep.addBinaryOp('in', 7)

Jsep.hooks.add('gobble-expression', env => {
  let { exprIndexesQueue, index } = env.context
  if (!exprIndexesQueue) {
    exprIndexesQueue = []
    env.context.exprIndexesQueue = exprIndexesQueue
  }
  exprIndexesQueue.push(index)
})

Jsep.hooks.add('after-expression', env => {
  const { context, node } = env || {}
  const { exprIndexesQueue, index, expr } = context
  const preIndex = exprIndexesQueue.pop()
  if (node && expr) node.exprStr = expr.slice(preIndex, index)
})

export default jsep
export { Jsep }
