export default class ParseError extends Error {
  constructor({ message, type }) {
    super(message)
    this.name = 'ParseError'
    this.type = type
    this.source = ''
  }
}
