const OCURLY_CODE = 123 // {
const CCURLY_CODE = 125 // }
const OBJECT_EXP = 'ObjectExpression'
const PROPERTY = 'Property'

// 同步自 VxEditor41 src/utils/jsepWrap/plugins/object.js。
// 相比官方 object 插件额外保留 valueRaw，供 v4 公式转换器还原原表达式。
export default {
  name: 'object',

  init(jsep) {
    function gobbleObjectExpression(env) {
      if (this.code === OCURLY_CODE) {
        this.index++
        const properties = []

        while (!isNaN(this.code)) {
          this.gobbleSpaces()
          if (this.code === CCURLY_CODE) {
            this.index++
            env.node = this.gobbleTokenProperty({
              type: OBJECT_EXP,
              properties
            })
            return
          }

          const key = this.gobbleExpression()
          if (!key) {
            break
          }

          this.gobbleSpaces()
          if (
            key.type === jsep.IDENTIFIER &&
            (this.code === jsep.COMMA_CODE || this.code === CCURLY_CODE)
          ) {
            properties.push({
              type: PROPERTY,
              computed: false,
              key,
              value: key,
              shorthand: true
            })
          } else if (this.code === jsep.COLON_CODE) {
            this.index++
            const preIndex = this.index
            const value = this.gobbleExpression()

            if (!value) {
              this.throwError('unexpected object property')
            }
            const computed = key.type === jsep.ARRAY_EXP
            const valueRaw = this.expr.slice(preIndex, this.index)
            properties.push({
              type: PROPERTY,
              computed,
              key: computed ? key.elements[0] : key,
              value,
              valueRaw,
              shorthand: false
            })
            this.gobbleSpaces()
          } else if (key) {
            properties.push(key)
          }

          if (this.code === jsep.COMMA_CODE) {
            this.index++
          }
        }
        this.throwError('missing }')
      }
    }

    jsep.hooks.add('gobble-token', gobbleObjectExpression)
  }
}
