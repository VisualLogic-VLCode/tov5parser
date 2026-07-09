function cloneJsonLike(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function stableShortHash(input = '') {
  let hash = 2166136261;
  const text = `${input}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 4).padStart(4, '0');
}

function splitIdentifierWords(input = '') {
  return `${input}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function upperFirst(input = '') {
  if (!input) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function lowerFirst(input = '') {
  if (!input) return '';
  return input.charAt(0).toLowerCase() + input.slice(1);
}

function toPascalCase(input = '') {
  const words = splitIdentifierWords(input);
  const code = words.map((word) => upperFirst(word)).join('');
  return code || 'LegacyComponent';
}

function toCamelCase(input = '') {
  const pascal = toPascalCase(input);
  return lowerFirst(pascal);
}

function formatLegacyLocaleName(input = '') {
  if (!input) return '';
  return `${input}`
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      const cleanWord = word.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '');
      if (index === 0) return cleanWord;
      return upperFirst(cleanWord);
    })
    .join('');
}

function toLegacyVlCompType(sourceType = '') {
  return `Legacy${toPascalCase(sourceType)}`;
}

function isSafeIdentifier(name = '') {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

function isSafePropName(name = '') {
  return /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(name);
}

function getLocaleEn(item = {}) {
  return item?.locale?.en || item?.nameEN || '';
}

function normalizeVlMemberName({ rawName = '', item = {}, kind }) {
  const localeEn = getLocaleEn(item);
  const localeName = formatLegacyLocaleName(localeEn);
  const candidate = localeName || rawName || item?.name;
  const safeChecker = kind === 'props' ? isSafePropName : isSafeIdentifier;
  if (candidate && safeChecker(candidate)) {
    return {
      vlName: candidate,
      fallbackName: candidate !== rawName,
      nameSource: candidate === rawName ? 'raw' : 'locale',
    };
  }
  const rawCandidate = rawName || item?.name;
  if (rawCandidate && safeChecker(rawCandidate)) {
    return {
      vlName: rawCandidate,
      fallbackName: true,
      nameSource: 'raw',
    };
  }
  const sanitized = toCamelCase(candidate);
  return {
    vlName: safeChecker(sanitized) ? sanitized : `legacy_${stableShortHash(candidate)}`,
    fallbackName: true,
    nameSource: 'sanitized',
  };
}

function buildParamLocMap(params = []) {
  if (!Array.isArray(params)) return {};
  return params.reduce((map, param, index) => {
    if (!param || typeof param !== 'object') return map;
    const rawName = param.name || `arg${index + 1}`;
    const { vlName } = normalizeVlMemberName({
      rawName,
      item: param,
      kind: 'methods',
    });
    map[vlName] = {
      ...cloneJsonLike(param),
      name: rawName,
      nameEN: vlName,
    };
    return map;
  }, {});
}

function buildMemberNameMaps({ sourceType, kind, entries }) {
  const rawItems = [];
  if (Array.isArray(entries)) {
    entries.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const rawName = item.name || `method${index + 1}`;
      rawItems.push({ rawName, item });
    });
  } else if (entries && typeof entries === 'object') {
    Object.entries(entries).forEach(([rawName, item]) => {
      rawItems.push({ rawName, item: item || {} });
    });
  }

  const baseCount = new Map();
  const prepared = rawItems.map(({ rawName, item }) => {
    const normalized = normalizeVlMemberName({ rawName, item, kind });
    baseCount.set(normalized.vlName, (baseCount.get(normalized.vlName) || 0) + 1);
    return { rawName, item, ...normalized };
  });

  const byRawName = {};
  const byVlName = {};
  const list = [];
  const issues = [];
  prepared.forEach((entry) => {
    const hasCollision = (baseCount.get(entry.vlName) || 0) > 1;
    const vlName = hasCollision
      ? `${entry.vlName}_C_${stableShortHash(`${sourceType}:${kind}:${entry.rawName}`)}`
      : entry.vlName;
    const mapping = {
      rawName: entry.rawName,
      vlName,
      fallbackName: entry.fallbackName || hasCollision,
      nameSource: hasCollision ? 'collisionSuffix' : entry.nameSource,
      localeEn: getLocaleEn(entry.item),
    };
    if (kind === 'methods') {
      mapping.inParamMap = buildParamLocMap(entry.item?.params || []);
      mapping.inParamLocMap = buildParamLocMap(entry.item?.params || []);
      mapping.paramsAsObj = entry.item?.paramsAsObj === true;
      mapping.rtnPropLocMap = {};
    }
    if (kind === 'events') {
      mapping.params = Array.isArray(entry.item?.params)
        ? cloneJsonLike(entry.item.params)
        : [];
    }
    byRawName[entry.rawName] = mapping;
    byVlName[vlName] = mapping;
    list.push(mapping);
    if (hasCollision) {
      issues.push({
        ruleId: 'legacy.member-name-collision',
        sourceType,
        kind,
        rawName: entry.rawName,
        vlName,
        baseVlName: entry.vlName,
      });
    } else if (mapping.fallbackName) {
      issues.push({
        ruleId: 'legacy.member-name-fallback',
        sourceType,
        kind,
        rawName: entry.rawName,
        vlName,
        nameSource: mapping.nameSource,
      });
    }
  });

  return { byRawName, byVlName, list, issues };
}

function normalizeLegacyIvxMap(rawMap = {}) {
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
    return { VxWidgetMap: {} };
  }
  const VxWidgetMap =
    rawMap.VxWidgetMap &&
    typeof rawMap.VxWidgetMap === 'object' &&
    !Array.isArray(rawMap.VxWidgetMap)
      ? rawMap.VxWidgetMap
      : {};
  return { VxWidgetMap };
}

function getLegacyWidgetMap(legacyIvxMap = {}) {
  return normalizeLegacyIvxMap(legacyIvxMap).VxWidgetMap;
}

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

function getRuntimeLegacyIvxMap() {
  const runtimeGlobal = getRuntimeGlobal();
  const runtimeWindow = getRuntimeWindow(runtimeGlobal);
  const runtimeMap = runtimeGlobal?.LegacyIvxMap || runtimeWindow?.LegacyIvxMap;
  return normalizeLegacyIvxMap(runtimeMap);
}

function createLegacyOverlayWidgetEntry({ sourceType, entry }) {
  const clonedEntry = cloneJsonLike(entry || {});
  const map = clonedEntry.map && typeof clonedEntry.map === 'object'
    ? clonedEntry.map
    : {};
  const vlCompType = toLegacyVlCompType(sourceType);
  clonedEntry.map = {
    ...map,
    name: sourceType,
    locale: {
      ...(map.locale || {}),
      en: vlCompType,
    },
  };
  return clonedEntry;
}

function createLegacyVxWidgetMapOverlay({
  baseVxWidgetMap,
  legacyIvxMap,
} = {}) {
  const baseMap =
    baseVxWidgetMap && typeof baseVxWidgetMap === 'object'
      ? baseVxWidgetMap
      : {};
  const legacyWidgetMap = getLegacyWidgetMap(legacyIvxMap);
  const mergedVxWidgetMap = { ...baseMap };
  const overlayEntries = [];
  const skippedEntries = [];
  Object.entries(legacyWidgetMap).forEach(([sourceType, entry]) => {
    if (!sourceType || !entry?.map) return;
    if (baseMap[sourceType]) {
      skippedEntries.push({
        sourceType,
        reason: 'root-vx-widget-map-has-contract',
      });
      return;
    }
    const vlCompType = toLegacyVlCompType(sourceType);
    mergedVxWidgetMap[sourceType] = createLegacyOverlayWidgetEntry({
      sourceType,
      entry,
    });
    overlayEntries.push({
      sourceType,
      vlCompType,
      contractSource: 'legacyVxWidgetMapOverlay',
    });
  });
  return {
    VxWidgetMap: mergedVxWidgetMap,
    overlayEntries,
    skippedEntries,
    summary: {
      baseCount: Object.keys(baseMap).length,
      legacyCount: Object.keys(legacyWidgetMap).length,
      overlayCount: overlayEntries.length,
      skippedCount: skippedEntries.length,
    },
  };
}

function getContractSummary(contract = {}) {
  const map = contract?.map || {};
  return {
    propCount: Object.keys(map.propsMap || {}).length,
    eventCount: Object.keys(map.eventsMap || {}).length,
    methodCount: Array.isArray(map.methods) ? map.methods.length : 0,
  };
}

function buildContractEntry({
  sourceType,
  contract,
  vlCompType,
  contractSource,
  contractStatus,
  typeIssues = [],
}) {
  const props = buildMemberNameMaps({
    sourceType,
    kind: 'props',
    entries: contract?.map?.propsMap || {},
  });
  const events = buildMemberNameMaps({
    sourceType,
    kind: 'events',
    entries: contract?.map?.eventsMap || {},
  });
  const methods = buildMemberNameMaps({
    sourceType,
    kind: 'methods',
    entries: contract?.map?.methods || [],
  });
  const issues = [
    ...typeIssues,
    ...props.issues,
    ...events.issues,
    ...methods.issues,
  ];
  return {
    sourceType: sourceType || '',
    vlCompType,
    contractSource,
    contractStatus,
    contract: contract ? cloneJsonLike(contract) : null,
    summary: getContractSummary(contract),
    memberMappings: {
      props,
      events,
      methods,
    },
    issues,
    roundTripReady:
      contractStatus === 'resolved' && issues.length === 0,
  };
}

function getLegacySourceTypes({ legacyIvxMap, sourceTypes } = {}) {
  if (Array.isArray(sourceTypes)) {
    return [...new Set(sourceTypes.filter(Boolean))];
  }
  return Object.keys(getLegacyWidgetMap(legacyIvxMap));
}

function buildLegacyComponentContractIndex({
  legacyIvxMap,
  sourceTypes,
} = {}) {
  const widgetMap = getLegacyWidgetMap(legacyIvxMap);
  const resolvedSourceTypes = getLegacySourceTypes({
    legacyIvxMap,
    sourceTypes,
  });
  const baseNames = new Map();
  resolvedSourceTypes.forEach((sourceType) => {
    const baseVlCompType = toLegacyVlCompType(sourceType);
    if (!baseNames.has(baseVlCompType)) baseNames.set(baseVlCompType, []);
    baseNames.get(baseVlCompType).push(sourceType);
  });

  const bySourceType = {};
  const byVlCompType = {};
  const issues = [];
  resolvedSourceTypes.forEach((sourceType) => {
    const baseVlCompType = toLegacyVlCompType(sourceType);
    const collisionGroup = baseNames.get(baseVlCompType) || [];
    const hasTypeCollision = collisionGroup.length > 1;
    const vlCompType = hasTypeCollision
      ? `${baseVlCompType}_C_${stableShortHash(sourceType)}`
      : baseVlCompType;
    const typeIssues = [];
    if (hasTypeCollision) {
      const issue = {
        ruleId: 'legacy.type-name-collision',
        sourceType,
        vlCompType,
        baseVlCompType,
        collisionSourceTypes: collisionGroup,
      };
      typeIssues.push(issue);
      issues.push(issue);
    }
    const contract = widgetMap[sourceType] || null;
    const entry = buildContractEntry({
      sourceType,
      contract,
      vlCompType,
      contractSource: contract?.map ? 'legacyVxWidgetMapOverlay' : 'missing',
      contractStatus: contract?.map ? 'resolved' : 'missing',
      typeIssues,
    });
    bySourceType[sourceType] = entry;
    byVlCompType[vlCompType] = entry;
    entry.issues.forEach((issue) => {
      if (typeIssues.includes(issue)) return;
      issues.push(issue);
    });
  });

  return {
    bySourceType,
    byVlCompType,
    issues,
    summary: {
      sourceTypeCount: resolvedSourceTypes.length,
      resolvedCount: Object.values(bySourceType).filter((entry) => {
        return entry.contractStatus === 'resolved';
      }).length,
      missingCount: Object.values(bySourceType).filter((entry) => {
        return entry.contractStatus === 'missing';
      }).length,
      typeCollisionCount: issues.filter((issue) => {
        return issue.ruleId === 'legacy.type-name-collision';
      }).length,
      memberCollisionCount: issues.filter((issue) => {
        return issue.ruleId === 'legacy.member-name-collision';
      }).length,
      fallbackNameCount: issues.filter((issue) => {
        return issue.ruleId === 'legacy.member-name-fallback';
      }).length,
    },
  };
}

function resolveLegacyComponentContract({
  sourceType,
  legacyIvxMap,
  legacyIndex,
} = {}) {
  const index =
    legacyIndex ||
    buildLegacyComponentContractIndex({
      legacyIvxMap,
      sourceTypes: sourceType ? [sourceType] : [],
    });
  const entry = sourceType ? index.bySourceType[sourceType] : null;
  if (entry) {
    return {
      ...cloneJsonLike(entry),
      mapKey: sourceType,
    };
  }
  return buildContractEntry({
    sourceType: sourceType || '',
    contract: null,
    vlCompType: toLegacyVlCompType(sourceType || ''),
    contractSource: 'missing',
    contractStatus: 'missing',
  });
}

function resolveLegacyComponentByVlCompType({
  vlCompType,
  legacyIvxMap,
  legacyIndex,
} = {}) {
  const index =
    legacyIndex ||
    buildLegacyComponentContractIndex({
      legacyIvxMap,
    });
  return vlCompType ? index.byVlCompType[vlCompType] || null : null;
}

function resolveLegacyComponentContracts({
  sourceTypes = [],
  legacyIvxMap,
} = {}) {
  return sourceTypes.map((sourceType) => {
    return resolveLegacyComponentContract({ sourceType, legacyIvxMap });
  });
}

function buildLegacyComponentContractReport({
  componentMap = [],
  legacyIvxMap,
} = {}) {
  const legacyComponents = componentMap.filter((item) => {
    return item?.category === 'legacyIsland';
  });
  const sourceTypes = [
    ...new Set(
      legacyComponents
        .map((item) => item?.nodeType)
        .filter(Boolean),
    ),
  ];
  const legacyIndex = buildLegacyComponentContractIndex({
    legacyIvxMap,
    sourceTypes,
  });
  const contracts = Object.values(legacyIndex.bySourceType);
  const components = legacyComponents.map((item) => {
    const contract = legacyIndex.bySourceType[item.nodeType] ||
      resolveLegacyComponentContract({
        sourceType: item.nodeType,
        legacyIndex,
      });
    return {
      sourceId: item.nodeId || '',
      sourceType: item.nodeType || '',
      sourceName: item.nodeName || '',
      sourcePath: item.path || '',
      vlCompType: contract.vlCompType,
      contractSource: contract.contractSource,
      contractStatus: contract.contractStatus,
      roundTripReady: contract.roundTripReady === true,
      memberMappingSummary: contract.summary,
    };
  });
  return {
    summary: {
      componentCount: components.length,
      contractTypeCount: contracts.length,
      resolvedCount: contracts.filter((item) => {
        return item.contractStatus === 'resolved';
      }).length,
      missingCount: contracts.filter((item) => {
        return item.contractStatus === 'missing';
      }).length,
      roundTripReadyCount: components.filter((item) => {
        return item.roundTripReady === true;
      }).length,
      typeCollisionCount: legacyIndex.summary.typeCollisionCount,
      memberCollisionCount: legacyIndex.summary.memberCollisionCount,
      fallbackNameCount: legacyIndex.summary.fallbackNameCount,
    },
    components,
    contracts: contracts.map((item) => ({
      sourceType: item.sourceType,
      vlCompType: item.vlCompType,
      contractSource: item.contractSource,
      contractStatus: item.contractStatus,
      roundTripReady: item.roundTripReady,
      summary: item.summary,
      memberMappings: item.memberMappings,
      issues: item.issues,
    })),
    issues: legacyIndex.issues,
  };
}

export {
  buildLegacyComponentContractIndex,
  buildLegacyComponentContractReport,
  createLegacyVxWidgetMapOverlay,
  getLegacyWidgetMap,
  getRuntimeLegacyIvxMap,
  normalizeLegacyIvxMap,
  resolveLegacyComponentByVlCompType,
  resolveLegacyComponentContract,
  resolveLegacyComponentContracts,
  toLegacyVlCompType,
};
