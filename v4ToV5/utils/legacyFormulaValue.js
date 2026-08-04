// V4.1 事件代码生成器会先读取完整 value.code，再用 formulaStr 判断它是
// 普通文本还是可执行表达式。本模块只复刻其中的“字符串判定”语义；真正的
// 数字、布尔、null、引用、调用和运算仍交给现有结构化公式转换器。

const LEGACY_V41_PROPER_NOUNS = new Set([
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data'
])

const LEGACY_V41_SPECIAL_VALUES = new Set([
  'true',
  'false',
  'null',
  'undefined'
])

const LEGACY_V41_INNER_VALUES = new Set([
  '_loop',
  '$refs',
  'cbStatus',
  'cbParams',
  '$curValue',
  '$curObj',
  '$curJsonPathValue',
  '$curPathValue',
  '$curRowValue',
  '$curUser'
])

const LEGACY_V41_CONDITION_VALUES = new Set([
  '$valid_Null',
  '$valid_Chinese',
  '$valid_OddNumber',
  '$valid_EvenNumber',
  '$valid_PositiveInt',
  '$valid_Number',
  '$valid_Char',
  '$valid_Phone',
  '$valid_Identity',
  '$valid_Email',
  '$valid_BankCard',
  '$valid_Time',
  '$valid_Date',
  '$valid_Custom'
])

const LEGACY_V41_FORMULA_SYMBOLS = [
  '＋',
  '－',
  '＊',
  '／',
  '（',
  '）',
  '？',
  '：',
  '‘',
  '’',
  '。',
  '；',
  '，',
  '％',
  '＝',
  '《',
  '》',
  '｜',
  '【',
  '】',
  '&',
  '+',
  '-',
  '*',
  '/',
  '(',
  ')',
  '?',
  ':',
  "'",
  '.',
  ';',
  '%',
  '=',
  '<',
  '>',
  '|',
  '[',
  ']',
  '"',
  '{',
  '}',
  '!'
]

const IPV4_PART = '(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)'
const IPV4 = `(?:${IPV4_PART}\\.){3}${IPV4_PART}`
const HOST_PART =
  '(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)'
const DOMAIN =
  '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*'
const TLD = '(?:\\.[a-z\\u00a1-\\uffff]{2,})\\.?'
const LEGACY_V41_URL = new RegExp(
  `^(?:(?:(?:[a-z]+:)?//)|www\\.)(?:\\S+(?::\\S*)?@)?(?:localhost|${IPV4}|${HOST_PART}${DOMAIN}${TLD})(?::\\d{2,5})?(?:[/?#][^\\s"]*)?$`,
  'iu'
)

function hasLegacyV41FormulaSymbol(value) {
  return LEGACY_V41_FORMULA_SYMBOLS.some(symbol => value.includes(symbol))
}

function isLegacyV41InnerFormula(value, conditionValue) {
  return (
    value.startsWith('_loop') ||
    LEGACY_V41_INNER_VALUES.has(value) ||
    ['param', 'System', 'ids', 'Math'].some(prefix =>
      value.startsWith(`${prefix}.`)
    ) ||
    (conditionValue && LEGACY_V41_CONDITION_VALUES.has(value))
  )
}

function getLegacyV41FormulaString({ code, conditionValue = false }) {
  if (typeof code !== 'string') return undefined
  if (isLegacyV41InnerFormula(code, conditionValue)) return undefined

  const isNonNumeric = Number.isNaN(Number(code))
  if (
    isNonNumeric &&
    code !== ',' &&
    (LEGACY_V41_PROPER_NOUNS.has(code) ||
      !hasLegacyV41FormulaSymbol(code))
  ) {
    return LEGACY_V41_SPECIAL_VALUES.has(code) ? undefined : code
  }

  if (isNonNumeric && LEGACY_V41_URL.test(code)) return code

  const compactUrl = code.split(' ').join('')
  if (isNonNumeric && compactUrl && LEGACY_V41_URL.test(compactUrl)) {
    return compactUrl
  }

  return /^-?(?:\d+)(?:\.\d+)?%$/u.test(code) ? code : undefined
}

export { getLegacyV41FormulaString }
