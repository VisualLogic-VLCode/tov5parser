import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLegacyComponentContractIndex,
  buildLegacyComponentContractReport,
  createLegacyVxWidgetMapOverlay,
  getLegacyWidgetMap,
  getRuntimeLegacyIvxMap,
  normalizeLegacyIvxMap,
  resolveLegacyComponentByVlCompType,
  resolveLegacyComponentContract,
  toLegacyVlCompType,
} from './legacyComponentContractResolver.js';

test('normalizeLegacyIvxMap keeps only VxWidgetMap', () => {
  const map = normalizeLegacyIvxMap({
    VxWidgetMap: {
      'data-excel': {
        map: {
          name: 'excel',
          propsMap: {},
          eventsMap: {},
          methods: [{ name: 'importExcelToArr' }],
        },
      },
    },
    VxJaMap: { ignored: true },
  });

  assert.deepEqual(Object.keys(map), ['VxWidgetMap']);
  assert.ok(getLegacyWidgetMap(map)['data-excel']);
  assert.equal(getLegacyWidgetMap(map).VxJaMap, undefined);
});

test('getRuntimeLegacyIvxMap reads injected runtime maps without fs', (t) => {
  const previousLegacyIvxMap = global.LegacyIvxMap;
  const previousWindow = global.window;
  t.after(() => {
    if (previousLegacyIvxMap === undefined) {
      delete global.LegacyIvxMap;
    } else {
      global.LegacyIvxMap = previousLegacyIvxMap;
    }
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  });

  delete global.LegacyIvxMap;
  global.window = {
    LegacyIvxMap: {
      VxWidgetMap: {
        'ih5-customChart': {
          map: {
            name: 'chart',
            propsMap: { option: { type: 'Object' } },
            eventsMap: {},
            methods: [],
          },
        },
      },
    },
  };

  assert.ok(getRuntimeLegacyIvxMap().VxWidgetMap['ih5-customChart']);

  global.LegacyIvxMap = {
    VxWidgetMap: {
      'data-excel': {
        map: {
          name: 'excel',
          propsMap: {},
          eventsMap: {},
          methods: [{ name: 'importExcelToArr' }],
        },
      },
    },
  };

  const map = getRuntimeLegacyIvxMap();

  assert.ok(getLegacyWidgetMap(map)['data-excel']);
  assert.equal(getLegacyWidgetMap(map)['ih5-customChart'], undefined);
});

test('resolveLegacyComponentContract resolves legacyIvxMap and reports missing without a contract', () => {
  const mapResult = resolveLegacyComponentContract({
    sourceType: 'ih5-customChart',
    legacyIvxMap: {
      VxWidgetMap: {
        'ih5-customChart': {
          map: {
            name: 'chart',
            propsMap: { option: { type: 'Object' } },
            eventsMap: {},
            methods: [{ name: 'setOption' }],
          },
        },
      },
    },
  });
  const missingResult = resolveLegacyComponentContract({
    sourceType: 'data-excel',
    legacyIvxMap: { VxWidgetMap: {} },
  });

  assert.equal(mapResult.contractSource, 'legacyVxWidgetMapOverlay');
  assert.equal(mapResult.contractStatus, 'resolved');
  assert.equal(mapResult.summary.propCount, 1);
  assert.equal(mapResult.summary.methodCount, 1);
  assert.equal(missingResult.contractSource, 'missing');
  assert.equal(missingResult.contractStatus, 'missing');
  assert.equal(missingResult.contract, null);
  assert.deepEqual(missingResult.summary, {
    propCount: 0,
    eventCount: 0,
    methodCount: 0,
  });
});

test('legacy overlay merges only legacy-only components as Legacy* tags', () => {
  const overlay = createLegacyVxWidgetMapOverlay({
    baseVxWidgetMap: {
      'data-dbView': {
        map: { name: 'DataDbView', propsMap: {}, eventsMap: {}, methods: [] },
      },
    },
    legacyIvxMap: {
      VxWidgetMap: {
        'data-excel': {
          map: {
            name: 'excel',
            locale: { en: 'Excel' },
            propsMap: {},
            eventsMap: {},
            methods: [],
          },
        },
        'data-dbView': {
          map: {
            name: 'oldDbView',
            locale: { en: 'OldDbView' },
            propsMap: {},
            eventsMap: {},
            methods: [],
          },
        },
      },
    },
  });

  assert.equal(overlay.summary.overlayCount, 1);
  assert.equal(overlay.summary.skippedCount, 1);
  assert.equal(
    overlay.VxWidgetMap['data-excel'].map.locale.en,
    'LegacyDataExcel',
  );
  assert.equal(overlay.VxWidgetMap['data-excel'].map.name, 'data-excel');
  assert.equal(overlay.VxWidgetMap['data-dbView'].map.name, 'DataDbView');
  assert.deepEqual(overlay.skippedEntries, [
    {
      sourceType: 'data-dbView',
      reason: 'root-vx-widget-map-has-contract',
    },
  ]);
});

test('createLegacyVxWidgetMapOverlay returns data without mutating runtime map', (t) => {
  const previousVxWidgetMap = global.VxWidgetMap;
  const previousLegacyIvxMap = global.LegacyIvxMap;
  const previousWindow = global.window;
  t.after(() => {
    if (previousVxWidgetMap === undefined) {
      delete global.VxWidgetMap;
    } else {
      global.VxWidgetMap = previousVxWidgetMap;
    }
    if (previousLegacyIvxMap === undefined) {
      delete global.LegacyIvxMap;
    } else {
      global.LegacyIvxMap = previousLegacyIvxMap;
    }
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  });

  const runtimeVxWidgetMap = {};
  global.VxWidgetMap = runtimeVxWidgetMap;
  global.LegacyIvxMap = {
    VxWidgetMap: {
      'data-excel': {
        map: {
          name: 'excel',
          propsMap: {},
          eventsMap: {},
          methods: [],
        },
      },
    },
  };
  global.window = global;

  const overlay = createLegacyVxWidgetMapOverlay({
    baseVxWidgetMap: global.VxWidgetMap,
    legacyIvxMap: getRuntimeLegacyIvxMap(),
  });

  assert.equal(overlay.summary.overlayCount, 1);
  assert.equal(
    overlay.VxWidgetMap['data-excel'].map.locale.en,
    'LegacyDataExcel',
  );
  assert.equal(global.VxWidgetMap, runtimeVxWidgetMap);
  assert.equal(global.VxWidgetMap['data-excel'], undefined);
});

test('legacy contract index builds Legacy* tags and member mappings', () => {
  const legacyIvxMap = {
    VxWidgetMap: {
      'data-excel': {
        map: {
          name: 'excel',
          propsMap: {
            fileName: { locale: { en: 'fileName' }, type: 'String' },
            'bad prop': { locale: { en: 'bad prop' }, type: 'String' },
          },
          eventsMap: {
            ready: { locale: { en: 'ready' }, params: [] },
          },
          methods: [
            {
              name: 'importExcelToArr',
              locale: { en: 'importXlsAsMatrix' },
              paramsAsObj: true,
              params: [{ name: 'file', locale: { en: 'file' } }],
            },
          ],
        },
      },
      'ih5-customChart': {
        map: {
          name: 'chart',
          propsMap: { option: { locale: { en: 'option' } } },
          eventsMap: {},
          methods: [],
        },
      },
    },
  };
  const index = buildLegacyComponentContractIndex({
    legacyIvxMap,
    sourceTypes: ['data-excel', 'ih5-customChart', 'legacy-private-widget'],
  });

  assert.equal(toLegacyVlCompType('data-excel'), 'LegacyDataExcel');
  assert.equal(
    toLegacyVlCompType('ih5-customChart'),
    'LegacyIh5CustomChart',
  );
  assert.equal(toLegacyVlCompType('data-dbView'), 'LegacyDataDbView');
  assert.equal(
    index.bySourceType['data-excel'].vlCompType,
    'LegacyDataExcel',
  );
  assert.equal(
    index.bySourceType['ih5-customChart'].vlCompType,
    'LegacyIh5CustomChart',
  );
  assert.equal(
    index.byVlCompType.LegacyDataExcel.sourceType,
    'data-excel',
  );
  assert.equal(
    index.bySourceType['data-excel'].memberMappings.props.byRawName.fileName
      .vlName,
    'fileName',
  );
  assert.equal(
    index.bySourceType['data-excel'].memberMappings.methods.byVlName
      .importXlsAsMatrix.rawName,
    'importExcelToArr',
  );
  assert.equal(
    index.bySourceType['legacy-private-widget'].contractStatus,
    'missing',
  );
  assert.equal(
    resolveLegacyComponentByVlCompType({
      vlCompType: 'LegacyDataExcel',
      legacyIndex: index,
    }).sourceType,
    'data-excel',
  );
});

test('legacy contract report records missing contracts and type collisions', () => {
  const legacyIvxMap = {
    VxWidgetMap: {
      'foo-bar': {
        map: { propsMap: {}, eventsMap: {}, methods: [] },
      },
      fooBar: {
        map: { propsMap: {}, eventsMap: {}, methods: [] },
      },
    },
  };
  const report = buildLegacyComponentContractReport({
    legacyIvxMap,
    componentMap: [
      {
        nodeId: 'a',
        nodeType: 'foo-bar',
        nodeName: 'Foo A',
        path: '/stage/children/0',
        category: 'legacyIsland',
      },
      {
        nodeId: 'b',
        nodeType: 'fooBar',
        nodeName: 'Foo B',
        path: '/stage/children/1',
        category: 'legacyIsland',
      },
      {
        nodeId: 'c',
        nodeType: 'unknown-old',
        nodeName: 'Unknown',
        path: '/stage/children/2',
        category: 'legacyIsland',
      },
    ],
  });

  assert.equal(report.summary.componentCount, 3);
  assert.equal(report.summary.resolvedCount, 2);
  assert.equal(report.summary.missingCount, 1);
  assert.equal(report.summary.typeCollisionCount, 2);
  assert.ok(
    report.components.find((item) => item.sourceType === 'unknown-old')
      .vlCompType.startsWith('LegacyUnknownOld'),
  );
  assert.ok(
    report.issues.every((issue) =>
      ['legacy.type-name-collision'].includes(issue.ruleId),
    ),
  );
});
