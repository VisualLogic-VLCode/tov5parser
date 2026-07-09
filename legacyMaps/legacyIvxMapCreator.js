function includeLegacyMapCompName({ compName } = {}) {
  if (!compName) return false;
  const legacyPrefixes = [
    'phaser-',
    'obj-',
    'babylon-',
    'three-',
    'canvas-',
    'krpano-',
    'ih5-abs-',
    'ih5-x6-',
    'pixi-',
    'ih5-gaodeMap-',
    'ih5-map-',
    'ctx-',
  ];
  const legacyOnlyCompNames = [
    'data-accountSys',
    'data-androidSDK',
    'data-apiFaker',
    'data-baseSDK',
    'data-custom',
    'data-ds',
    'data-dynamoDb',
    'data-esDb',
    'data-excel',
    'data-flow',
    'data-iotMessage',
    'data-javaSDK',
    'data-jsSDK',
    'data-langChain',
    'data-league-db',
    'data-live',
    'data-mall',
    'data-mallCart',
    'data-mallOrder',
    'data-mallProduct',
    'data-mqtt',
    'data-newDb',
    'data-newEsDb',
    'data-payment',
    'data-postgres',
    'data-pythonSDK',
    'data-redPack',
    'data-sqltemplate',
    'data-stableDiffusion',
    'data-transcoding',
    'data-vote',
    'data-voteCandidate',
    'data-voteRecord',
    'data-xflow',
    'ih5-InformationFlowAd',
    'ih5-appletInterface',
    'ih5-ast-cons',
    'ih5-ast-view',
    'ih5-babylon-root',
    'ih5-bannerAd',
    'ih5-barChart',
    'ih5-customChart',
    'ih5-diagram',
    'ih5-editor',
    'ih5-flow-editor',
    'ih5-funnelChart',
    'ih5-ganttChart',
    'ih5-gaodeMapPanel',
    'ih5-gaodemap',
    'ih5-livePlayer',
    'ih5-map',
    'ih5-mapChart',
    'ih5-mediaStream',
    'ih5-microPage',
    'ih5-note',
    'ih5-openScreenAd',
    'ih5-pieChart',
    'ih5-polar-barChart',
    'ih5-popWindowAd',
    'ih5-radarChart',
    'ih5-rel-barChart',
    'ih5-rel-editor',
    'ih5-rel-funnelChart',
    'ih5-rel-ganttChart',
    'ih5-rel-gaodeMapPanel',
    'ih5-rel-gaodemap',
    'ih5-rel-lineChart',
    'ih5-rel-livePlayer',
    'ih5-rel-map',
    'ih5-rel-mapChart',
    'ih5-rel-note',
    'ih5-rel-pieChart',
    'ih5-rel-polar-barChart',
    'ih5-rel-radarChart',
    'ih5-rel-richtext',
    'ih5-rel-scatterChart',
    'ih5-richtext',
    'ih5-rtspPlayer',
    'ih5-rtspPlayerManager',
    'ih5-scatterChart',
    'ih5-suspension',
    'ih5-textChainAd',
    'ih5-turn-book',
    'ih5-turn-book-item',
    'ih5-x6',
  ];
  return (
    legacyPrefixes.some((prefix) => compName.startsWith(prefix)) ||
    legacyOnlyCompNames.includes(compName)
  );
}

function createLegacyIvxMap() {
  const VxWidgetMap =
    typeof window === 'undefined' ? undefined : window?.VxWidgetMap;
  const createLegacyVxWidgetMap = ({ VxWidgetMap } = {}) => {
    let map = Object.keys(VxWidgetMap || {}).reduce((prev, key) => {
      if (includeLegacyMapCompName({ compName: key }) !== true) return prev;
      let { map = {} } = VxWidgetMap?.[key] || {};
      let { name, propsMap, eventsMap, methods, isVlComp } = map || {};
      methods = (methods || []).reduce((list, item) => {
        let { name, locale, callback, paramsAsObj, hasSubParams, params } =
          item || {};
        list.push({
          name,
          locale,
          callback,
          paramsAsObj,
          hasSubParams,
          params,
        });
        return list;
      }, []);
      propsMap = Object.keys(propsMap || {}).reduce((propMap, propName) => {
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
        } = propsMap[propName] || {};
        if (type === 'Select' && optionLocales) {
          optionLocales = Object.keys(optionLocales).reduce((optionMap, key) => {
            let { en } = optionLocales[key] || {};
            optionMap[key] = { en };
            return optionMap;
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
        if (vlHide) item.vlHide = vlHide;
        propMap[propName] = item;
        return propMap;
      }, {});
      eventsMap = Object.keys(eventsMap || {}).reduce((eventMap, eventName) => {
        let { locale, params } = eventsMap[eventName] || {};
        eventMap[eventName] = { locale, params };
        return eventMap;
      }, {});
      prev[key] = {
        map: { name, propsMap, eventsMap, methods, isVlComp },
      };
      return prev;
    }, {});
    let clonedMap = JSON.parse(JSON.stringify(map));
    let walkObj = (obj) => {
      if (typeof obj !== 'object') return;
      delete obj?.zh;
      delete obj?.desc;
      Object.keys(obj || {}).forEach((key) => {
        walkObj(obj[key]);
      });
    };
    walkObj(clonedMap);
    return clonedMap;
  };

  return {
    VxWidgetMap: createLegacyVxWidgetMap({ VxWidgetMap }),
  };
}

export { createLegacyIvxMap, includeLegacyMapCompName };
