function excludeCompName({ compName }) {
  return (
    compName &&
    (compName.startsWith('phaser-') ||
      compName.startsWith('obj-') ||
      compName.startsWith('babylon-') ||
      compName.startsWith('three-') ||
      compName.startsWith('iwx-') ||
      compName.startsWith('canvas-') ||
      compName.startsWith('krpano-') ||
      compName.startsWith('ih5-abs-') ||
      compName.startsWith('ih5-x6-') ||
      compName.startsWith('pixi-') ||
      compName.startsWith('ih5-gaodeMap-') ||
      compName.startsWith('ih5-map-') ||
      compName.startsWith('ctx-'))
  );
}

function createVxWidgetMap({ VxWidgetMap, excludeCompName } = {}) {
  //  { name, eventsMap, propsMap, locale ,methods}
  let m = Object.keys(VxWidgetMap || {}).reduce((prev, key) => {
    if (excludeCompName?.({ compName: key })) return prev;
    let { map = {} } = VxWidgetMap?.[key] || {};
    let { name, propsMap, locale, eventsMap, methods, isVlComp } = map || {};
    // if (hide === true) return prev;
    methods = (methods || []).reduce((prev2, item) => {
      let { name, locale, callback, paramsAsObj, hasSubParams, params } =
        item || {};
      prev2.push({
        name,
        locale,
        callback,
        paramsAsObj,
        hasSubParams,
        params,
      });
      return prev2;
    }, []);
    propsMap = Object.keys(propsMap || {}).reduce((prev3, key) => {
      let {
        locale,
        type,
        defaultValue,
        init,
        default: def,
        initValue,
        groupName,
        optionLocales,
        vlHide,
      } = propsMap[key] || {};
      if (type === 'Select' && optionLocales) {
        optionLocales = Object.keys(optionLocales).reduce((prev, key) => {
          let { en } = optionLocales[key] || {};
          prev[key] = { en };
          return prev;
        }, {});
      }
      let item = {
        locale,
        type,
        defaultValue,
        init,
        default: def,
        initValue,
        groupName,
        optionLocales,
      };
      if (vlHide) {
        item.vlHide = vlHide;
      }
      prev3[key] = item;
      return prev3;
    }, {});
    eventsMap = Object.keys(eventsMap || {}).reduce((prev3, key) => {
      let { locale, params } = eventsMap[key] || {};
      prev3[key] = { locale, params };
      return prev3;
    }, {});
    prev[key] = {
      map: { name, propsMap, locale, eventsMap, methods, isVlComp },
    };
    return prev;
  }, {});
  // copy
  let m2 = JSON.parse(JSON.stringify(m));
  // 剔除内部所有的zh字段
  let walkObj = (obj) => {
    // 判断是否是对象
    if (typeof obj !== 'object') return;
    delete obj?.zh;
    delete obj?.desc;
    Object.keys(obj || {}).forEach((key) => {
      walkObj(obj[key]);
    });
  };
  walkObj(m2);
  return m2;
}

function createIvxMap() {
  let m = {
    VxWidgetMap: createVxWidgetMap({
      VxWidgetMap: window?.VxWidgetMap,
      excludeCompName,
    }),
    VxJaLoc: window?.VxJaLoc,
    VxJaMap: window?.VxJaMap,
    VxExLoc: { utilFuns: window?.VxExLoc?.utilFuns },
    VxSfMap: window?.VxSfMap,
    VxLangLocalVer: new Date().toLocaleString(),
  };
  // copy
  let m2 = JSON.parse(JSON.stringify(m));
  return m2;
}

function normalizeServerAuthMethodDefInfo({ compName, action, methodDefInfo }) {
  if (compName !== 'server-auth' || action !== 'revokeAllTokens') {
    return methodDefInfo;
  }
  const params = Array.isArray(methodDefInfo?.params)
    ? [...methodDefInfo.params]
    : [];
  if (params.some((p) => p?.name === 'authRealmCode')) {
    return methodDefInfo;
  }
  return {
    ...(methodDefInfo || {}),
    paramsAsObj: true,
    params: [
      ...params,
      {
        name: 'authRealmCode',
        type: 'String',
      },
    ],
  };
}

function normalizeServerAuthParamEN({ compName, action, paramEN }) {
  if (compName !== 'server-auth' || action !== 'revokeAllTokens') {
    return paramEN;
  }
  const normalized = Array.isArray(paramEN) ? [...paramEN] : [];
  if (normalized.some((p) => p?.paramName === 'authRealmCode')) {
    return normalized;
  }
  normalized.push({
    paramName: 'authRealmCode',
    paramNameEN: 'authRealmCode',
  });
  return normalized;
}

function genStageCompActionMap(VxWidgetMap) {
  VxWidgetMap = VxWidgetMap || window?.VxWidgetMap || {};
  var m = {};
  if (!VxWidgetMap) return m;
  // 获取组件方法list
  let getCompMethodList = ({ compName }) => {
    let { methods = [] } = VxWidgetMap?.[compName]?.map || {};
    return methods;
  };
  m = Object.keys(VxWidgetMap).reduce((prev, compName) => {
    // 获取所有的方法（包含继承）
    let methods = getCompMethodList({ compName });
    if (!Array.isArray(methods)) return prev;
    methods.map((m) => {
      let {
        name,
        locale,
        callback,
        paramsAsObj,
        hasSubParams,
        params: inParams,
      } = m || {};
      let { en: nameEN } = locale || {};
      let rtnPropLocMap = {};
      let {
        params,
        singleParam, // 表示只有一个返回结果，直接返回结果，而不是作为一个对象的属性
        result,
      } = callback || {};
      if (Array.isArray(params)) {
        rtnPropLocMap = params.reduce((prev2, item) => {
          let { name, locale, func } = item || {};
          let { en: nameEN } = locale || {};
          let propInfo = { name, nameEN };
          if (func) propInfo.func = func;
          prev2[`${name}`] = propInfo;
          if (func) prev2[`${func}`] = propInfo;
          return prev2;
        }, {});
      }
      if (!singleParam && result) {
        singleParam = result.single;
      }

      // 方法参数
      let inParamMap = {};
      // 特殊处理api组件
      if (compName === 'data-api' && name == 'sendApiRequest') {
        inParams = [...getApiExtParams(), ...inParams];
      }
      if (Array.isArray(inParams)) {
        inParamMap = inParams.reduce((prev2, item) => {
          let { name, locale, type, lambdaParams, allowTypes } = item || {};
          let { en: nameEN } = locale || {};
          prev2[`${name}`] = {
            name,
            nameEN,
            type,
            display: type,
            lambdaParams,
            allowTypes,
          };
          return prev2;
        }, {});
      } else if (hasSubParams) {
        inParamMap['params'] = {
          name: 'params',
          nameEN: 'params',
          hasSubParams: true,
        };
      }

      nameEN = nameEN || name;
      nameEN = formatMethodName({ input: nameEN });
      let key = `${compName}$${name}`;
      prev[key] = {
        compName,
        action: name,
        nameEN,
        rtnPropLocMap,
        inParamMap,
        inParams,
        paramsAsObj,
      };
      if (singleParam) {
        prev[key].singleParam = singleParam;
      }
    });
    return prev;
  }, {});

  return m;
}

function genServerCompActionMap(jaLocList, VxJaMap) {
  jaLocList = jaLocList || window?.VxJaLoc;
  VxJaMap = VxJaMap || window?.VxJaMap;
  var m = {};
  // 获取方法的定义信息 map
  var getMethodDefInfo = ({ compName, action }) => {
    var jaComp = VxJaMap?.[compName];
    let { methods } = jaComp || {};
    if (!Array.isArray(methods) || methods.length <= 0) return;
    return normalizeServerAuthMethodDefInfo({
      compName,
      action,
      methodDefInfo: methods.find((m) => m.name === action),
    });
  };
  // 获取后台组件动作的返回值类型
  var getServerCompActionRtnType = ({ methodDefInfo }) => {
    let rtnType;
    let { type } = methodDefInfo || {};
    if (!type) return rtnType;
    let regex = /<(.*)>/;
    let matches = type.match(regex);
    if (!matches) return rtnType;
    rtnType = matches[1];
    return rtnType;
  };
  let isParamsAsObj = ({ compName, action }) => {
    var { methods } = VxJaMap?.[compName] || {};
    if (!Array.isArray(methods) || methods.length <= 0) return;
    let method = methods.find((m) => m.name === action);
    let { paramsAsObj } = method || {};
    return paramsAsObj;
  };
  if (Array.isArray(jaLocList)) {
    let jaLocMap = jaLocList.reduce((prev, item) => {
      let { name } = item || {};
      if (!name) return prev;
      prev[name] = item;
      return prev;
    }, {});
    // 伪代码中的方法名，对应的英文翻译名称
    m = jaLocList.reduce((prev, item) => {
      let { en, name } = item || {};
      if (!name) return prev;
      let parts = name.split(':+');
      if (parts.length < 2) return prev;
      let [compName, action] = parts;
      let { nameEN, paramEN = [] } = en || {};
      paramEN = normalizeServerAuthParamEN({ compName, action, paramEN });
      nameEN = nameEN || action;
      nameEN = formatMethodName({ input: nameEN });
      if (compName === 'data-dbView' && action === 'dbInsertMulti') {
        nameEN = 'insertMany';
      }

      // 获取方法的定义信息
      let methodDefInfo = getMethodDefInfo({ compName, action });
      let { errorCb, params = [] } = methodDefInfo || {};

      let rtnPropLocMap = {};
      let rtnType = getServerCompActionRtnType({ methodDefInfo });
      let rtnTypeInfo = VxJaMap?.[rtnType];
      let { methods, record } = rtnTypeInfo || {};
      if (Array.isArray(methods)) {
        methods.map((m) => {
          let { name, type, param, func } = m || {};
          let k = `${rtnType}:+${name}`;
          let propLocInfo = jaLocMap[k];
          let { en } = propLocInfo || {};
          let { nameEN } = en || {};
          if (rtnType === 'DbInsertMultiResult' && name === 'getDataIds') {
            nameEN = 'dataIds';
          }
          let obj = { name, nameEN, type, param, func };
          rtnPropLocMap[`${name}`] = obj;
          if (func) rtnPropLocMap[`${func}`] = obj;
          if (param) rtnPropLocMap[`${param}`] = obj;
        });
      }

      // 处理入参
      let inParamMap = {};
      if (Array.isArray(paramEN)) {
        let pMap = params.reduce((prev, p) => {
          let { name } = p || {};
          prev[name] = p;
          return prev;
        }, {});
        paramEN.map((p) => {
          let { paramName: name, paramNameEN: nameEN } = p || {};
          nameEN = nameEN || name;
          let { type = 'JsonVal', display, allowTypes } = pMap[name] || {};
          inParamMap[`${name}`] = {
            name,
            nameEN,
            type,
            display,
            allowTypes,
          };
        });
        // 处理入参为对象的属性的情况，eg: insert操作
        if (paramEN.length == 0 && params?.[2]?.hasSubParams) {
          inParamMap['params'] = {
            name: 'params',
            nameEN: 'params',
            type: 'JsonObj',
            hasSubParams: true,
          };
        }
      }

      let key = `${compName}$${action}`;
      prev[key] = {
        compName,
        action,
        nameEN,
        rtnPropLocMap,
        inParamMap,
        inParams: params,
        paramsAsObj:
          methodDefInfo?.paramsAsObj || isParamsAsObj({ compName, action }),
        errorCb, // 是否有错误回调
      };
      if (record) {
        // 是否是record类型
        prev[key].record = !!record;
      }
      return prev;
    }, {});
  }
  return m;
}

function genStageCompActionLocMap(VxWidgetMap) {
  VxWidgetMap = VxWidgetMap || window?.VxWidgetMap;
  var m = {};
  if (!VxWidgetMap) return m;
  // 获取组件方法list
  let getCompMethodList = ({ compName }) => {
    let { methods = [] } = VxWidgetMap?.[compName]?.map || {};
    return methods;
  };
  m = Object.keys(VxWidgetMap).reduce((prev, compName) => {
    // 获取所有的方法（包含继承）
    let methods = getCompMethodList({ compName });
    if (!Array.isArray(methods)) return prev;
    methods.map((m) => {
      let {
        name,
        locale,
        callback,
        paramsAsObj,
        hasSubParams,
        params: inParams,
      } = m || {};
      let { en: nameEN } = locale || {};
      let rtnPropLocMap = {};
      let { params, result, singleParam } = callback || {};
      if (Array.isArray(params)) {
        rtnPropLocMap = params.reduce((prev2, item) => {
          let { name, locale, func } = item || {};
          let { en: nameEN } = locale || {};
          nameEN = nameEN || name;
          let obj = { name, nameEN };
          if (func) obj.func = func;
          prev2[`${nameEN}`] = obj;
          return prev2;
        }, {});
      }
      if (!singleParam && result) {
        singleParam = result.single;
      }

      let inParamLocMap = {};
      // 特殊处理api组件
      if (compName === 'data-api' && name == 'sendApiRequest') {
        inParams = [...getApiExtParams(), ...inParams];
      }
      if (Array.isArray(inParams)) {
        inParamLocMap = inParams.reduce((prev2, item) => {
          let {
            name,
            locale,
            type,
            lambdaParams,
            subParams,
            required,
            allowTypes,
          } =
            item || {};
          let { en: nameEN } = locale || {};
          nameEN = nameEN || name;
          prev2[`${nameEN}`] = {
            name,
            nameEN,
            type,
            display: type,
            lambdaParams,
            subParams,
            required,
            allowTypes,
          };
          return prev2;
        }, {});
      } else if (hasSubParams) {
        inParamLocMap['params'] = {
          name: 'params',
          nameEN: 'params',
          type: 'JsonObj',
          hasSubParams: true,
        };
      }
      nameEN = nameEN || name;
      nameEN = formatMethodName({ input: nameEN });
      let key = `${compName}$${nameEN}`;
      prev[key] = {
        compName,
        action: name,
        nameEN,
        rtnType: callback && 'JsonVal',
        rtnPropLocMap,
        inParamLocMap,
        paramsAsObj,
      };
      if (singleParam) {
        prev[key].singleParam = singleParam;
      }
    });
    return prev;
  }, {});

  return m;
}

function genJaLocMap({ jaLocList }) {
  return jaLocList.reduce((prev, item) => {
    let { name } = item || {};
    if (!name) return prev;
    prev[name] = item;
    return prev;
  }, {});
}

function genServerCompActionJaLocMap(jaLocList, VxJaMap) {
  jaLocList = jaLocList || window?.VxJaLoc;
  VxJaMap = VxJaMap || window?.VxJaMap;
  var m = {};
  // 获取方法的定义信息 map
  var getMethodDefInfo = ({ compName, action }) => {
    var jaComp = VxJaMap?.[compName];
    let { methods, ctx } = jaComp || {};
    if (!Array.isArray(methods) || methods.length <= 0) return;
    let methodDefInfo = normalizeServerAuthMethodDefInfo({
      compName,
      action,
      methodDefInfo: methods.find((m) => m.name === action),
    });
    if (methodDefInfo && ctx) {
      Object.assign(methodDefInfo, { ctx });
    }
    return methodDefInfo;
  };
  // 获取后台组件动作的返回值类型
  var getServerCompActionRtnType = ({ methodDefInfo }) => {
    let rtnType;
    let { type } = methodDefInfo || {};
    if (!type) return rtnType;
    let regex = /<(.*)>/;
    let matches = type.match(regex);
    if (!matches) return rtnType;
    rtnType = matches[1];
    return rtnType;
  };
  var isParamsAsObj = ({ compName, action }) => {
    var { methods } = VxJaMap?.[compName] || {};
    if (!Array.isArray(methods) || methods.length <= 0) return;
    let method = methods.find((m) => m.name === action);
    let { paramsAsObj } = method || {};
    return paramsAsObj;
  };
  if (Array.isArray(jaLocList)) {
    let jaLocMap = genJaLocMap({ jaLocList });
    // 伪代码中的方法名，对应的英文翻译名称
    m = jaLocList.reduce((prev, item) => {
      let { en, name } = item || {};
      if (!name) return prev;
      let parts = name.split(':+');
      if (parts.length < 2) return prev;
      let [compName, action] = parts;
      let { nameEN, paramEN = [] } = en || {};
      paramEN = normalizeServerAuthParamEN({ compName, action, paramEN });
      nameEN = nameEN || action;
      nameEN = formatMethodName({ input: nameEN });
      const originalNameEN = nameEN;
      if (compName === 'data-dbView' && action === 'dbInsertMulti') {
        nameEN = 'insertMany';
      }
      // 获取方法的定义信息
      let methodDefInfo = getMethodDefInfo({ compName, action });
      let { errorCb, params = [], ctx, parentProps } = methodDefInfo || {};
      // 处理返回值
      let rtnPropLocMap = {};
      let rtnType = getServerCompActionRtnType({ methodDefInfo });
      let rtnTypeInfo = VxJaMap?.[rtnType];
      let { methods } = rtnTypeInfo || {};
      if (Array.isArray(methods)) {
        methods.map((m) => {
          let { name, type, param, func } = m || {};
          let k = `${rtnType}:+${name}`; // eg:DbViewSelectResult:+isSuccess
          let propLocInfo = jaLocMap[k];
          let { en } = propLocInfo || {};
          let { nameEN } = en || {};
          nameEN = nameEN || name;
          if (rtnType === 'DbInsertMultiResult' && name === 'getDataIds') {
            nameEN = 'dataIds';
          }
          rtnPropLocMap[`${nameEN}`] = { name, nameEN, type, param, func };
        });
      }
      // 处理入参
      let inParamLocMap = {};
      if (Array.isArray(params)) {
        // 生成动作参数 loc map
        let paramLocMap = Array.isArray(paramEN)
          ? paramEN.reduce((prev, cur) => {
              let { paramName } = cur || {};
              prev[paramName] = cur;
              return prev;
            }, {})
          : {};
        // 去除 java里面方法上的额外参数
        params = removeJaMethodExtraParams({ params, ctx, parentProps });
        inParamLocMap = params.reduce((prev, p) => {
          const {
            name,
            type,
            display,
            hasSubParams,
            subParams,
            required,
            allowTypes,
          } =
            p || {};
          let { paramNameEN: nameEN } = paramLocMap[name] || {};
          nameEN = nameEN || name;
          prev[`${nameEN}`] = {
            name,
            nameEN,
            type,
            display,
            hasSubParams,
            subParams,
            required,
            allowTypes,
          };
          return prev;
        }, {});
      }

      const locKey = `${compName}$${nameEN}`;
      prev[locKey] = {
        compName,
        action,
        nameEN,
        rtnType: rtnType ? `IvxResult<${rtnType}>` : undefined, // 返回值类型
        errorCb, // 是否有错误回调
        rtnPropLocMap,
        inParamLocMap,
        paramsAsObj:
          methodDefInfo?.paramsAsObj || isParamsAsObj({ compName, action }),
      };
      if (
        compName === 'data-dbView' &&
        action === 'dbInsertMulti' &&
        originalNameEN &&
        originalNameEN !== nameEN
      ) {
        prev[`${compName}$${originalNameEN}`] = {
          ...prev[locKey],
          nameEN: originalNameEN,
        };
        prev[`${compName}$insertMulti`] = {
          ...prev[locKey],
          nameEN: 'insertMulti',
        };
      }
      return prev;
    }, {});
  }
  return m;
}

// 去除 java里面方法上的额外参数
function removeJaMethodExtraParams({ params = [], ctx, parentProps }) {
  params = [...params];
  if (!params?.length) return params;
  if (['true', true].includes(ctx) || params[0].type == 'IvxContext') {
    params = params.slice(1);
  }
  if (params?.[0]?.name == 'props') {
    params = params.slice(1);
  }
  if (['true', true].includes(parentProps)) {
    params = params.slice(1);
  }
  return params;
}

function formatMethodName({ input }) {
  if (!input) return '';
  let parts = input.split(' ');
  // 去除空格并将每个单词的首字母大写
  return parts
    .filter(Boolean) // 过滤掉空字符串
    .map((word, i) => {
      // 去除符号
      word = word.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '');
      if (i === 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }) // 使用小驼峰命名法
    .join(''); // 合并为一个字符串
}

function genStageCompMap(VxWidgetMap) {
  VxWidgetMap = VxWidgetMap || window?.VxWidgetMap || {};
  var m = {};
  for (let key in VxWidgetMap) {
    let { map } = VxWidgetMap[key] || {};
    let { name: compName, eventsMap, propsMap, locale } = map || {};
    let nameEN = replaceSpecialChars({ nameEN: locale?.en || compName });

    let eM = {}; // 事件
    let eLocalM = {};
    for (let key in eventsMap) {
      let { locale, params } = eventsMap[key] || {};
      let { en: nameEN } = locale || {};
      nameEN = formatMethodName({ input: nameEN || key });
      let info = { name: key, nameEN };
      if (Array.isArray(params) && params.length > 0) {
        info.params = params.filter((p) => !p.hidden);
      }
      eM[key] = info;
      eLocalM[nameEN] = eM[key];
    }
    let pM = {}; // 属性
    let pLocalM = {};
    let pInitValMap = {}; // 属性初始值map
    for (let key in propsMap) {
      let {
        locale,
        type: display,
        defaultValue,
        init,
        default: def,
        initValue,
        groupName,
        optionLocales,
        vlHide,
      } = propsMap[key] || {};
      let { en: nameEN } = locale || {};
      nameEN = formatMethodName({ input: nameEN || key });
      let obj = { name: key, nameEN, display, groupName };
      // 默认值
      if (defaultValue !== undefined) {
        obj.defaultValue = defaultValue;
      }
      // 初始值
      initValue = init ?? initValue ?? def;
      if (initValue !== undefined && initValue !== defaultValue) {
        obj.initValue = initValue;
        pInitValMap[key] = initValue;
      }
      if (optionLocales) obj.optionLocales = optionLocales;
      if (vlHide !== undefined) obj.vlHide = vlHide;
      pM[key] = obj;
      pLocalM[nameEN] = pM[key];
    }
    m[compName] = {
      eventsMap: eM,
      eventsLocalMap: eLocalM,
      propsMap: pM,
      propsLocalMap: pLocalM,
      pInitValMap,
      nameEN,
    };
  }
  return m;
}
// 生成后台组件的属性map
function genServerCompMap(jaLocList = [], VxJaMap) {
  const win =
    typeof window !== 'undefined'
      ? window
      : getRuntimeGlobal() || {};
  jaLocList = jaLocList || win.VxJaLoc;
  VxJaMap = VxJaMap || win.VxJaMap;
  var m = {};
  let jaLocMap = genJaLocMap({ jaLocList });
  for (let compType in VxJaMap) {
    let { clsDef, props = [] } = VxJaMap[compType] || {};
    if (clsDef) continue;
    let jaLocCompKey = `${compType}:*`;
    let { name: nameEN } = jaLocMap[jaLocCompKey]?.en || {};
    nameEN = nameEN || compType;
    let item = { nameEN, propsMap: {}, propsLocalMap: {} };

    if (props.length) {
      props.forEach((prop) => {
        let { name } = prop || {};
        let jaLocPropKey = `${compType}:.${name}`;
        let { nameEN } = jaLocMap?.[jaLocPropKey]?.en || {};
        nameEN = nameEN || name;
        item.propsMap[name] = { name, nameEN };
        item.propsLocalMap[nameEN] = item.propsMap[name];
      });
    }

    m[compType] = item;
  }
  return m;
}

function genSysUtilMap(VxExLoc, VxSfMap) {
  VxExLoc = VxExLoc || window?.VxExLoc;
  VxSfMap = VxSfMap || window?.VxSfMap;
  var utilFuns = VxExLoc?.utilFuns || [];
  let descMap = utilFuns.reduce((prev, item) => {
    let { name } = item || {};
    if (!name) return prev;
    prev[name] = item; // 原始：$SF_xxxx
    return prev;
  }, {});
  let sfMap = VxSfMap || {};
  let sfMapKeys = Object.keys(sfMap);
  let containsChinese = ({ str }) => {
    // 使用 Unicode 范围匹配汉字
    return /[\u4e00-\u9fa5]/.test(str);
  };
  return sfMapKeys.reduce((prev, key) => {
    let item = sfMap[key];
    let { name, uType, params, locale } = item || {};
    let localItem = descMap[key];
    let { en, zh } = localItem || {};
    zh = zh || locale?.zh || '';
    en = en || locale?.en || '';
    let info = { name, uType, params, zh, en };
    prev[name] = info; // 原始：$SF_xxxx
    // eg: JSON转字符串(JSON.stringify)
    var reg = /^.*[\(\（](.*?)[\)\）]$/;
    var match = zh.match(reg);
    var nameEN =
      match && !containsChinese({ str: match[1] })
        ? match[1]
        : formatMethodName({ input: en });
    prev[nameEN] = info; // 英文翻译
    Object.assign(info, { nameEN });
    return prev;
  }, {});
}
// 去除名称中特殊字符
function replaceSpecialChars({ nameEN }) {
  if (!nameEN) return nameEN;
  return nameEN.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '');
}

// 生成系统模块 map
function genSysModMap(VxSysModList) {
  VxSysModList = VxSysModList || window?.VxSysCodeFragmentList;
  let m = {};
  if (Array.isArray(VxSysModList)) {
    m = VxSysModList.reduce((prev, item) => {
      prev[item.title] = item;
      return prev;
    }, {});
  }
  return m;
}

// 特殊处理，添加api组件发送请求动作上的header 和body 参数
function getApiExtParams() {
  return [
    { name: 'headers', type: 'ApiParamsKeyValue' },
    { name: 'body', type: 'ApiParamsKeyValue' },
  ];
}

const VX_WIDGET_MAP_OVERLAY_STATE_KEY = Symbol.for(
  'vlparser.vxWidgetMapOverlayState',
);

function getRuntimeGlobal() {
  if (typeof global !== 'undefined') return global;
  if (typeof window !== 'undefined') return window;
  return null;
}

function getRuntimeWindow(runtimeGlobal = getRuntimeGlobal()) {
  const runtimeWindow = runtimeGlobal?.window;
  return runtimeWindow && typeof runtimeWindow === 'object'
    ? runtimeWindow
    : null;
}

class MapCreator {
  // 静态属性
  static sysutilMap = null;
  static serverCompActionMap = null;
  static stageCompActionMap = null;
  static stageCompActionLocMap = null;
  static serverCompActionJaLocMap = null;
  static stageCompMap = null;
  static stageCompMapLoc = null;
  static serverCompMap = null; // 后台组件属性 map
  static sysModMap = null; // 系统模块 map
  static sysModList = []; // 系统模块 list(需要通过接口获取)

  static resetVxWidgetMapCaches = () => {
    MapCreator.stageCompActionMap = null;
    MapCreator.stageCompActionLocMap = null;
    MapCreator.stageCompMap = null;
    MapCreator.stageCompMapLoc = null;
  };

  static getRuntimeVxWidgetMap = () => {
    const runtimeGlobal = getRuntimeGlobal();
    const runtimeWindow = getRuntimeWindow(runtimeGlobal);
    return runtimeGlobal?.VxWidgetMap || runtimeWindow?.VxWidgetMap || {};
  };

  static hasActiveVxWidgetMapOverlay = () => {
    const runtimeGlobal = getRuntimeGlobal();
    const activeState = runtimeGlobal?.[VX_WIDGET_MAP_OVERLAY_STATE_KEY];
    return activeState?.active === true;
  };

  static installVxWidgetMapOverlay = ({ VxWidgetMap } = {}) => {
    const runtimeGlobal = getRuntimeGlobal();
    if (!runtimeGlobal || !VxWidgetMap || typeof VxWidgetMap !== 'object') {
      return () => {};
    }

    const activeState = runtimeGlobal[VX_WIDGET_MAP_OVERLAY_STATE_KEY];
    if (activeState?.active) {
      activeState.depth += 1;
      let restored = false;
      return () => {
        if (restored) return;
        restored = true;
        activeState.depth -= 1;
        if (activeState.depth > 0) return;
        activeState.restore();
      };
    }

    const runtimeWindow = getRuntimeWindow(runtimeGlobal);
    const originalGlobalOwn = Object.prototype.hasOwnProperty.call(
      runtimeGlobal,
      'VxWidgetMap',
    );
    const originalGlobalVxWidgetMap = runtimeGlobal.VxWidgetMap;
    const originalWindowOwn = runtimeWindow
      ? Object.prototype.hasOwnProperty.call(runtimeWindow, 'VxWidgetMap')
      : false;
    const originalWindowVxWidgetMap = runtimeWindow?.VxWidgetMap;
    const restore = () => {
      const state = runtimeGlobal[VX_WIDGET_MAP_OVERLAY_STATE_KEY];
      if (!state?.active) return;
      if (originalGlobalOwn) {
        runtimeGlobal.VxWidgetMap = originalGlobalVxWidgetMap;
      } else {
        delete runtimeGlobal.VxWidgetMap;
      }
      if (runtimeWindow && runtimeWindow !== runtimeGlobal) {
        if (originalWindowOwn) {
          runtimeWindow.VxWidgetMap = originalWindowVxWidgetMap;
        } else {
          delete runtimeWindow.VxWidgetMap;
        }
      }
      delete runtimeGlobal[VX_WIDGET_MAP_OVERLAY_STATE_KEY];
      MapCreator.resetVxWidgetMapCaches();
    };

    runtimeGlobal.VxWidgetMap = VxWidgetMap;
    if (runtimeWindow && runtimeWindow !== runtimeGlobal) {
      runtimeWindow.VxWidgetMap = VxWidgetMap;
    }
    runtimeGlobal[VX_WIDGET_MAP_OVERLAY_STATE_KEY] = {
      active: true,
      depth: 1,
      restore,
    };
    MapCreator.resetVxWidgetMapCaches();

    let restored = false;
    return () => {
      if (restored) return;
      restored = true;
      const state = runtimeGlobal[VX_WIDGET_MAP_OVERLAY_STATE_KEY];
      if (!state?.active) return;
      state.depth -= 1;
      if (state.depth > 0) return;
      state.restore();
    };
  };

  // 获取前台组件动作的名称 map
  static genStageCompActionMap = () => {
    if (MapCreator.stageCompActionMap) {
      return MapCreator.stageCompActionMap;
    } else if (typeof window !== 'undefined') {
      var m = genStageCompActionMap();
      if (Object.keys(m).length > 0) {
        MapCreator.stageCompActionMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxWidgetMap) {
        MapCreator.stageCompActionMap = genStageCompActionMap(
          global.VxWidgetMap,
        );
        return MapCreator.stageCompActionMap;
      }
      MapCreator.stageCompActionMap = global.stageCompActionMap;
      return MapCreator.stageCompActionMap;
    }
    return {};
  };

  // 获取后台组件动作的名称 map
  static genServerCompActionMap = () => {
    if (MapCreator.serverCompActionMap) {
      return MapCreator.serverCompActionMap;
    } else if (typeof window !== 'undefined') {
      var m = genServerCompActionMap();
      if (Object.keys(m).length > 0) {
        MapCreator.serverCompActionMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxJaLoc) {
        MapCreator.serverCompActionMap = genServerCompActionMap(
          global.VxJaLoc,
          global.VxJaMap,
        );
        return MapCreator.serverCompActionMap;
      }
      MapCreator.serverCompActionMap = global.serverCompActionMap || {};
      return MapCreator.serverCompActionMap;
    }
    return {};
  };

  // 生成反包函数map
  static genSysutilMap = () => {
    if (MapCreator.sysutilMap) {
      return MapCreator.sysutilMap;
    } else if (typeof window !== 'undefined') {
      let m = genSysUtilMap();
      if (Object.keys(m).length > 0) {
        MapCreator.sysutilMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxExLoc) {
        MapCreator.sysutilMap = genSysUtilMap(global.VxExLoc, global.VxSfMap);
        return MapCreator.sysutilMap;
      }
      MapCreator.sysutilMap = global.sysutilMap;
      return MapCreator.sysutilMap;
    }
    return {};
  };

  // 获取前台组件动作的英文翻译map
  static genStageCompActionLocMap = () => {
    if (MapCreator.stageCompActionLocMap) {
      return MapCreator.stageCompActionLocMap;
    } else if (typeof window !== 'undefined') {
      var m = genStageCompActionLocMap();
      if (Object.keys(m).length > 0) {
        MapCreator.stageCompActionLocMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxWidgetMap) {
        MapCreator.stageCompActionLocMap = genStageCompActionLocMap(
          global.VxWidgetMap,
        );
        return MapCreator.stageCompActionLocMap;
      }
      MapCreator.stageCompActionLocMap = global.stageCompActionLocMap;
      return MapCreator.stageCompActionLocMap;
    }
    return {};
  };

  // 获取后台组件动作的英文翻译map
  static genServerCompActionJaLocMap = () => {
    if (MapCreator.serverCompActionJaLocMap) {
      return MapCreator.serverCompActionJaLocMap;
    } else if (typeof window !== 'undefined') {
      var m = genServerCompActionJaLocMap();
      if (Object.keys(m).length > 0) {
        MapCreator.serverCompActionJaLocMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxJaLoc) {
        MapCreator.serverCompActionJaLocMap = genServerCompActionJaLocMap(
          global.VxJaLoc,
          global.VxJaMap,
        );
        return MapCreator.serverCompActionJaLocMap;
      }
      MapCreator.serverCompActionJaLocMap =
        global.serverCompActionJaLocMap || {};
      return MapCreator.serverCompActionJaLocMap;
    }
    return {};
  };
  // 获取后台组件动作的 javamap
  static getVxJaMap = () => {
    if (typeof window !== 'undefined') {
      return window.VxJaMap || {};
    } else if (typeof global !== 'undefined') {
      return global.VxJaMap || {};
    } else {
      return {};
    }
  };

  // 获取前台组件属性和事件
  static genStageCompMap = () => {
    if (MapCreator.stageCompMap) {
      return MapCreator.stageCompMap;
    } else if (typeof window !== 'undefined') {
      var m = genStageCompMap();
      if (Object.keys(m).length > 0) {
        MapCreator.stageCompMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxWidgetMap) {
        MapCreator.stageCompMap = genStageCompMap(global.VxWidgetMap);
        return MapCreator.stageCompMap;
      }
      MapCreator.stageCompMap = global.stageCompMap;
      return MapCreator.stageCompMap;
    }
  };
  // 获取前台组件属性和事件locale
  static genStageCompMapLoc = () => {
    if (MapCreator.stageCompMapLoc) {
      return MapCreator.stageCompMapLoc;
    } else {
      var m = MapCreator.genStageCompMap() || {};
      var m2 = {};
      for (let key in m) {
        let { nameEN, ...rest } = m[key] || {};
        m2[nameEN] = { name: key, ...rest };
      }
      if (Object.keys(m2).length > 0) {
        MapCreator.stageCompMapLoc = m2;
      }
      return m2;
    }
  };

  // 获取后台组件属性
  static genServerCompMap = () => {
    if (MapCreator.serverCompMap) {
      return MapCreator.serverCompMap;
    } else if (typeof window !== 'undefined') {
      var m = genServerCompMap();
      if (Object.keys(m).length > 0) {
        MapCreator.serverCompMap = m;
      }
      return m;
    } else if (typeof global !== 'undefined') {
      if (global.VxJaLoc && global.VxJaMap) {
        MapCreator.serverCompMap = genServerCompMap(
          global.VxJaLoc,
          global.VxJaMap,
        );
        return MapCreator.serverCompMap;
      }
      MapCreator.serverCompMap = global.serverCompMap;
      return MapCreator.serverCompMap;
    }
  };

  // 获取系统模块列表（代码片段，小模块）
  static getSysModMap = () => {
    if (MapCreator.sysModMap) {
      return MapCreator.sysModMap;
    } else {
      var m = genSysModMap(MapCreator.sysModList);
      if (Object.keys(m).length > 0) {
        MapCreator.sysModMap = m;
      }
      return m;
    }
  };

  static formatMethodName = formatMethodName;
  static replaceSpecialChars = replaceSpecialChars;
  // 根据 ivx 组件 type 查询获取 locale 翻译，不管前后台组件，组件的翻译都使用这个方法
  static getNameEnFromType = ({ type }) => {
    let stageCompMap = MapCreator.genStageCompMap();
    let { nameEN } = stageCompMap[type] || {};
    return nameEN || replaceSpecialChars({ nameEN: type });
  };
  // 根据 ivx 组件 type和propName 查询获取 locale 翻译
  static getNameEnFromPropName = ({ type, propName }) => {
    let propInfo = MapCreator.getPropInfoFromPropName({ type, propName });
    let { nameEN } = propInfo || {};
    return nameEN;
  };
  // 根据 ivx 组件 type和propName 查询属性相关信息
  static getPropInfoFromPropName = ({ type, propName }) => {
    let stageCompMap = MapCreator.genStageCompMap();
    let { propsMap } = stageCompMap[type] || {};
    return propsMap?.[propName] || {};
  };
  // 根据 ivx 组件type和eventName 查询获取 locale 翻译
  static getNameEnFromEventName = ({ type, eventName }) => {
    let stageCompMap = MapCreator.genStageCompMap();
    let { eventsMap } = stageCompMap[type] || {};
    let { nameEN, params } = eventsMap?.[eventName] || {};
    return { nameEN, params };
  };
  // 归一化事件参数信息：VL-facing 名称统一优先取 locale.en
  static normalizeEventParams = ({ params = [] }) => {
    if (!Array.isArray(params)) return [];
    return params
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        let { name, locale } = item || {};
        let nameEN = locale?.en || name;
        return {
          ...item,
          actualName: name,
          name: nameEN,
          nameEN,
        };
      });
  };
  // 根据 ivx 组件 type 和 eventName 查询事件参数（VL-facing）
  static getVLEventParams = ({ type, eventName }) => {
    let { params = [] } = MapCreator.getNameEnFromEventName({
      type,
      eventName,
    });
    return MapCreator.normalizeEventParams({ params });
  };
  // 根据 ivx 组件 type 和 eventName 查询事件参数名列表
  static getEventParamNames = ({ type, eventName }) => {
    let { params = [] } = MapCreator.getNameEnFromEventName({
      type,
      eventName,
    });
    return params
      .map((item) => item?.name)
      .filter((name) => typeof name === 'string' && name);
  };
  // 根据ivx 组件的 NameEN 查询获取 type 类型
  static getTypeFromNameEN = ({ nameEN }) => {
    let stageCompMapLoc = MapCreator.genStageCompMapLoc();
    let { name } = stageCompMapLoc?.[nameEN] || {};
    if (name) return name;

    let serverCompMap = MapCreator.genServerCompMap() || {};
    for (let compType in serverCompMap) {
      let item = serverCompMap[compType] || {};
      if (item.nameEN === nameEN) {
        return compType;
      }
    }
    return '';
  };
  // 根据ivx 组件的 NameEN 查询获取 propName
  static getPropNameFromNameEN = ({ nameEN, compType, ivxCompType }) => {
    let compMap;
    if (ivxCompType) {
      let stageCompMap = MapCreator.genStageCompMap();
      compMap = stageCompMap[ivxCompType] || {};
    } else {
      let stageCompMapLoc = MapCreator.genStageCompMapLoc();
      compMap = stageCompMapLoc[compType] || {};
    }
    let { propsLocalMap } = compMap || {};
    let { name } = propsLocalMap?.[nameEN] || {};
    return name;
  };
  // 根据ivx 组件的 type 和 属性 NameEN 查询 propInfo
  static getPropInfoFromNameEN = ({
    nameEN,
    type: ivxCompType,
    compType,
    isStageScopeComp = true,
  }) => {
    if (isStageScopeComp) {
      return MapCreator.getFrontendPropInfoFromNameEN({
        nameEN,
        type: ivxCompType,
        compType,
      });
    } else {
      return MapCreator.getBackendPropInfoFromNameEN({
        nameEN,
        type: ivxCompType,
      });
    }
  };
  // 根据ivx 前台组件的 type 和 属性 NameEN 查询 propInfo
  static getFrontendPropInfoFromNameEN = ({
    nameEN,
    type: ivxCompType,
    compType,
  }) => {
    let compMap;
    if (ivxCompType) {
      let stageCompMap = MapCreator.genStageCompMap() || {};
      compMap = stageCompMap[ivxCompType] || {};
    } else {
      let stageCompMapLoc = MapCreator.genStageCompMapLoc();
      compMap = stageCompMapLoc[compType] || {};
    }
    let { propsLocalMap } = compMap || {};
    let pInfo = propsLocalMap?.[nameEN];
    if (!pInfo) return;
    let { defaultValue, initValue, name, display, optionLocales, vlHide } =
      pInfo || {};
    return { defaultValue, initValue, name, display, optionLocales, vlHide };
  };
  // 根据ivx 后台组件的type 和属性NameEN 查询 propInfo
  static getBackendPropInfoFromNameEN = ({ nameEN, type: ivxCompType }) => {
    const widgetPropInfo = MapCreator.getFrontendPropInfoFromNameEN({
      nameEN,
      type: ivxCompType,
    });
    if (widgetPropInfo) return widgetPropInfo;

    let serverCompMap = MapCreator.genServerCompMap() || {};
    let compMap = serverCompMap[ivxCompType] || {};
    let { propsLocalMap } = compMap || {};
    let pInfo = propsLocalMap?.[nameEN];
    if (!pInfo) return;
    let { name, display } = pInfo || {};
    return { name, display };
  };

  // 根据ivx 组件的 NameEN 查询获取 eventName(后台组件暂时也使用 stageCompMap)
  static getEventNameFromNameEN = ({ nameEN, compType, ivxCompType }) => {
    let compMap;
    if (ivxCompType) {
      let stageCompMap = MapCreator.genStageCompMap();
      compMap = stageCompMap[ivxCompType] || {};
    } else {
      let stageCompMapLoc = MapCreator.genStageCompMapLoc();
      compMap = stageCompMapLoc[compType] || {};
    }
    let { eventsLocalMap } = compMap || {};
    let { name, params } = eventsLocalMap?.[nameEN] || {};
    return { name, params };
  };

  // 根据 ivx组件 type 和 action 查询获取 动作的 英文翻译
  static getActionNameEnFromType = ({ type, action, isStageScopeComp }) => {
    let { nameEN } = MapCreator.getActionInfoFromType({
      type,
      action,
      isStageScopeComp,
    });
    return nameEN;
  };
  // 根据 ivx组件 type 和 action 查询获取 动作信息
  static getActionInfoFromType = ({ type, action, isStageScopeComp }) => {
    let rst;
    let key = `${type}$${action}`;
    if (isStageScopeComp) {
      let stageCompActionMap = MapCreator.genStageCompActionMap();
      rst = stageCompActionMap[key] || {};
    } else {
      let serverCompActionMap = MapCreator.genServerCompActionMap();
      rst = serverCompActionMap[key] || {};
    }
    let { nameEN, rtnPropLocMap, inParamMap } = rst || {};
    return { nameEN, rtnPropLocMap, inParamMap };
  };

  // 根据 ivx组件 type 和 actionNameEN 查询获取动作的名称
  static getActionNameFromNameEN = ({ nameEN, type, isStageScopeComp }) => {
    let key = `${type}$${nameEN}`;
    let compActionLocMap = {};
    if (isStageScopeComp) {
      compActionLocMap = MapCreator.genStageCompActionLocMap();
    } else {
      compActionLocMap = MapCreator.genServerCompActionJaLocMap();
    }
    let {
      action,
      inParamLocMap,
      rtnPropLocMap,
      paramsAsObj,
      errorCb,
      singleParam,
    } = compActionLocMap[key] || {};
    return {
      action,
      inParamLocMap,
      rtnPropLocMap,
      paramsAsObj,
      errorCb,
      singleParam,
    };
  };

  // 获取 local的 SF 函数
  static getLocalSfFromNameEN = ({ nameEN }) => {
    let sysutilMap = MapCreator.genSysutilMap();
    let name, params;
    let prefix = '$SF_local_';
    for (let key in sysutilMap) {
      let item = sysutilMap[key] || {};
      if (item.nameEN === nameEN && item.name.startsWith(prefix)) {
        name = item.name.replace('$SF_', '');
        params = item.params;
        return { name, params };
      }
    }
    return {};
  };

  // 判断是否是后台组件
  static isServerComp = ({ node, compType, parsed }) => {
    let { type, uis } = node || {};
    type = type || compType;
    switch (type) {
      case 'data-service':
      case 'data-dbView':
      case 'data-db':
      case 'server-sys-serverSys':
      case 'data-module-instance-server':
      case 'server-api':
      case 'user-store':
      case 'data-mqSvc':
        return true;
      case 'data-wrap': {
        let {
          serverModule,
          _server, // 标识这是一个后台的 wrap组件
        } = uis || {};
        return serverModule || _server;
      }
      default: {
        if (parsed) {
          let { scope } = parsed || {};
          return scope == 'server';
        }
        return type && type.startsWith('server-');
      }
    }
  };

  // 判断是否是前台的舞台组件
  static isStageNodeComp = ({ node }) => {
    return node?.type === 'ih5-stage';
  };

  // 判断是否是带有路径调用的方法
  static isCallWithPath = ({ nameEN }) => {
    return [
      'push',
      'pop',
      'shift',
      'unshift',
      'splice',
      'sort',
      'reverse',
    ].includes(nameEN);
  };
}

export default MapCreator;
export {
  createIvxMap,
  createVxWidgetMap,
  excludeCompName,
  genStageCompActionMap,
  genServerCompActionMap,
};
