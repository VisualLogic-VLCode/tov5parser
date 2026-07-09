// 从 4.1 编辑器（VxEditor41）环境中拷贝的纯常量，供 v4ToV5 转换模块使用。
// 来源：
//   propType  ← src/const/propType.js
//   sysOpList ← src/const/enum.js
//   CASE_TYPE ← src/const/const.js

const propType = {
  String: 'String',
  Number: 'Number',
  Integer: 'Integer',
  Percentage: 'Percentage',
  Degree: 'Degree',
  Boolean: 'Boolean',
  Color: 'Color',
  Select: 'Select',
  SelectMq: 'SelectMq', // 仅用于mq组件 2022/9/7
  IconSelect: 'IconSelect',
  FontSelect: 'FontSelect',
  FontString: 'FontString',
  EventBusSelect: 'EventBusSelect',
  EventBusParams: 'EventBusParams',
  ObjSelect: 'ObjSelect',
  ImgSelect: 'ImgSelect', //广告组件的图片下拉显示
  newIcon: 'Icon', //icon组件优化
  messageDisplay: 'messageDisplay', //只读消息显示
  DatePicker: 'DatePicker', //日期选择
  refresh: 'refresh', //刷新属性栏的属性，目前仅mq接收端，2022.6.10
  singleValue: 'singleValue', // 单值，支持用户填写字符串，数值，和布尔值
  PercentPx: 'PercentPx',
  PercentPxInt: 'PercentPxInt',
  Transform: 'Transform',
  Upload: 'Upload',
  SrcChoose: 'SrcChoose',
  TextArea: 'TextArea',
  Array: 'Array',
  List: 'List',
  Hidden: 'Hidden',
  Time: 'Time',
  SelectMore: 'SelectMore',
  BtnSwitch: 'BtnSwitch',
  Button: 'Button',
  Permissions: 'permissions',
  ServiceParams: 'ServiceParams',
  ApiParams: 'ApiParams',
  PropArray: 'PropArray',
  SelectUpload: 'SelectUpload',
  Text: 'Text',
  HintsDropdown: 'HintsDropdown', // 类似自定义样式那样可以填写的下拉框
  ApiDebug: 'ApiDebug',
  Condition: 'Condition',
  Pairs: 'Pairs',
  ObjJson: 'ObjJson',
  Any: 'Any',
  Lock: 'Lock',
  CollideSet: 'CollideSet',
  ExtLinks: 'ExtLinks', // 第三方js
  ExtTip: 'ExtTip',
  showSid: 'showSid',
  Libraries: 'Libraries',
  ApiJson: 'ApiJson',
  PythonLibraries: 'PythonLibraries',
  InputDropDown: 'InputDropDown', //输入可选择
  ObjJsx: 'ObjJsx', //自定义组件的JSX
  ObjCss: 'ObjCss', //自定义组件的CSS
  ResourceSelect: 'ResourceSelect',
  ThemeStyle: 'themeStyle',
  SimpleObj: 'SimpleObj', // 显示对象 （单层）
  //事件
  Formula: 'Formula',
  FormulaColor: 'FormulaColor',
  MultiKeyValue: 'MultiKeyValue',
  MultiPureKeyValue: 'MultiPureKeyValue',
  MultiValue: 'MultiValue',
  ArrColValue: 'ArrColValue',
  ArrMultiValue: 'ArrMultiValue',
  KeyValueJson: 'KeyValueJson',
  NormalCons: 'NormalCons',
  NormalUpdates: 'NormalUpdates',
  NormalOrders: 'NormalOrders',
  ObjResult: 'ObjResult',
  ObjSelectCb: 'ObjSelectCb',
  DbRange: 'DbRange',
  DbCons: 'DbCons',
  DbCols: 'DbCols',
  DbSearchRange: 'DbSearchRange',
  DbGroupByCols: 'DbGroupByCols',
  DbGroupCols: 'DbGroupCols',
  DbSelectCols: 'DbSelectCols',
  DbOrders: 'DbOrders',
  DbNumCol: 'DbNumCol',
  DbUpdate: 'DbUpdate',
  ObjJsonParamsSelect: 'ObjJsonParamsSelect',
  ObjJsonMultiPaths: 'ObjJsonMultiPaths',
  CloneChild: 'CloneChild',
  Object1D: 'Object1D',
  FormulaJson: 'FormulaJson', // 一个大的编辑器
  JsonEditor: 'JsonEditor', // 整个行为一个编辑器
  DyQueryCons: 'DyQueryCons', // dynamo数据库输出的条件
  DyUpdate: 'DyUpdate', // dynamo数据库更新块
  DyCons: 'DyCons', // dynamo数据库条件块
  ApiParamsKeyValue: 'ApiParamsKeyValue', //API的header和body参数
  BabylonVector4: 'BabylonVector4',
  BabylonVector3: 'BabylonVector3',
  BabylonVector2: 'BabylonVector2',
  ClassStructureSelect: 'ClassStructureSelect', // class变量绑定结构
  ConfigParam: 'ConfigParam', // 代码片段动作组入参自定义结构
  Lambda: 'Lambda', // 函数
  CbObj: 'CbObj',
  TransformSection: 'TransformSection', // 原生组件transform填写模块
  ServiceSchedule: 'ServiceSchedule',
};

const sysOpList = [
  'equal',
  'notEqual',
  'less',
  'eLess',
  'greater',
  'eGreater',
  'isTruthy',
  'isFalsy',
  'include',
  'notInclude',
  'stringInclude',
  'stringNotInclude',
  'arrayInclude',
  'arrayNotInclude',
  'typeIs',
  'typeIsNot',
  'belongTo',
  'notBelongTo',
  'stringBelongTo',
  'stringNotBelongTo',
  'arrayBelongTo',
  'arrayNotBelongTo',
];

// 案例类型 ntype
const CASE_TYPE = {
  PC_REL: 1,
  PC_ABS: 2,
  PHONE_REL: 3,
  PHONE_ABS: 4,
  WX_APP: 5,
  WX_GAME: 6,
  WEB_APP_REL: 7,
  RN_APP: 8,
  WX_GAME_3D: 9,
  MOD_STAGE: 21,
  MOD_SERVER: 22,
  MOD_BOTH: 23,
  MOD_WX_STAGE: 24,
  MOD_WX_BOTH: 25,
  MOD_WX_SERVER: 'wx_server', // 内部使用区分壳案例的类型
  COMPONENT_LIB: 31,
  FOREGROUND: 92, // v51组应用-前台应用
  BACKGROUND: 91, // v51组应用-后台应用
};

export { propType, sysOpList, CASE_TYPE };
export default propType;
