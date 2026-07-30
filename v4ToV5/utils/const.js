const CONDITION_OP_MAP_STAGE = {
  equal: '=',
  notEqual: '!=',
  greater: '>',
  less: '<',
  eGreater: '>=',
  eLess: '<=',
  include: 'include',
  notInclude: 'notInclude',
  match: 'typeIs',
  notMatch: 'typeIsNot',
  indexOf: 'belongTo',
  notIndexOf: 'notBelongTo',
  startWith: 'stringInclude',
  endWith: 'stringInclude'
}

const CONDITION_OP_MAP_SERVER = {
  equal: 'equal',
  notEqual: 'notEqual',
  greater: 'greater',
  less: 'less',
  eGreater: 'eGreater',
  eLess: 'eLess',
  include: 'include',
  notInclude: 'notInclude',
  match: 'typeIs',
  notMatch: 'typeIsNot',
  indexOf: 'belongTo',
  notIndexOf: 'notBelongTo'
}

const IF_CONDITION_OP_MAP = {
  '==': '=',
  '!=': '!=',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  include: 'include',
  notInclude: 'notInclude',
  match: 'typeIs',
  notMatch: 'typeIsNot',
  in: 'belongTo',
  notIn: 'notBelongTo'
}

const METHODS_HAS_SUB_PARAMS = [
  'fireFuncGroup',
  'dbInsert',
  'setCookies',
  'customParamResult'
]

const METHODS_AS_GLOBAL_FUNCS = [
  'fireFuncGroup',
  'runService',
  'runTransaction'
]

const METHODS_AS_GLOBAL_STATICS = [
  'getConfig', // 定时服务获取当前配置
  'setConfig', // 重置定时服务
  'timerDel', // 停止定时服务
  'rollback', // 事务回滚
  'setCookies', // 服务设置返回cookie
  'customParamResult' // 服务设置自定义返回结果
]

const METHODS_AS_RETURN = ['paramResult', 'funcResult', 'recordResult']

const FAKE_NODES = [
  '$sobj_base',
  '$sobj_storage',
  '$sobj_device',
  '$sobj_file',
  '$sobj_view',
  '$sobj_serverSys' // 后台系统
]

// 以前的某些方法需要转成fakeNode的方法,如uploadPic等
const FAKE_NODES_METHOD_MAP = {
  uploadPic: { fakeNodeType: 'file' },
  uploadPics: { fakeNodeType: 'file' },
  alertLog: { fakeNodeType: 'view', convertMethName: 'showToast' },
  showLoading: { fakeNodeType: 'view' },
  hideLoading: { fakeNodeType: 'view' },
  showModal: { fakeNodeType: 'view' },
  showToast: { fakeNodeType: 'view' },
  setCookie: { fakeNodeType: 'storage' },
  setSessionStorage: { fakeNodeType: 'storage' },
  setLocalStorage: { fakeNodeType: 'storage' },
  getCookies: { fakeNodeType: 'storage' },
  getSessionStorage: { fakeNodeType: 'storage' },
  getLocalStorage: { fakeNodeType: 'storage' },
  getUrlInfo: { fakeNodeType: 'base' }
}

const CON_OP_MAP = {
  equal: 'eq',
  notE: 'neq',
  notEqual: 'neq',
  greater: 'gt',
  less: 'lt',
  ge: 'gte',
  le: 'lte',
  in: 'in',
  nin: 'nin',
  includes: 'contains',
  notIncludes: 'notContains',
  startWith: 'startsWith',
  endWith: 'endsWith'
}

export {
  CONDITION_OP_MAP_STAGE,
  CONDITION_OP_MAP_SERVER,
  IF_CONDITION_OP_MAP,
  METHODS_HAS_SUB_PARAMS,
  METHODS_AS_GLOBAL_FUNCS,
  METHODS_AS_GLOBAL_STATICS,
  METHODS_AS_RETURN,
  FAKE_NODES,
  FAKE_NODES_METHOD_MAP,
  CON_OP_MAP
}
