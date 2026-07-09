// 小模块实例
let nodeIsModuleInstance = ({ node }) => {
  return node?.type === 'data-module-instance'
}

export { nodeIsModuleInstance }
