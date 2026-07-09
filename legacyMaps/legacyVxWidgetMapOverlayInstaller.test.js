import test from 'node:test';
import assert from 'node:assert/strict';

import MapCreator from '../utils/MapCreator.js';
import { createLegacyVxWidgetMapOverlay } from './legacyComponentContractResolver.js';
import {
  installLegacyVxWidgetMapOverlay,
} from './legacyVxWidgetMapOverlayInstaller.js';

function baseVxWidgetMap() {
  return {
    'data-button': {
      map: {
        name: 'data-button',
        locale: { en: 'Button' },
        propsMap: {},
        eventsMap: {},
        methods: [],
      },
    },
  };
}

function legacyIvxMap() {
  return {
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
    },
  };
}

function legacyIvxMapWithRootCollision() {
  return {
    VxWidgetMap: {
      ...legacyIvxMap().VxWidgetMap,
      'data-button': {
        map: {
          name: 'old-button',
          locale: { en: 'OldButton' },
          propsMap: {},
          eventsMap: {},
          methods: [],
        },
      },
    },
  };
}

function withRuntimeMaps(t, { VxWidgetMap, LegacyIvxMap } = {}) {
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
    MapCreator.resetVxWidgetMapCaches?.();
  });

  global.VxWidgetMap = VxWidgetMap;
  global.LegacyIvxMap = LegacyIvxMap;
  global.window = global;
  MapCreator.resetVxWidgetMapCaches?.();
}

test('runtime legacy overlay clears warm MapCreator caches and restores them', (t) => {
  withRuntimeMaps(t, {
    VxWidgetMap: baseVxWidgetMap(),
    LegacyIvxMap: legacyIvxMap(),
  });

  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'Button' }),
    'data-button',
  );
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    '',
  );

  const restore = installLegacyVxWidgetMapOverlay();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );
  restore();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'Button' }),
    'data-button',
  );
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    '',
  );
});

test('ivxMap wins over legacyIvxMap for components present in both maps', (t) => {
  withRuntimeMaps(t, {
    VxWidgetMap: baseVxWidgetMap(),
    LegacyIvxMap: legacyIvxMapWithRootCollision(),
  });

  const restore = installLegacyVxWidgetMapOverlay();
  assert.equal(
    MapCreator.getNameEnFromType({ type: 'data-button' }),
    'Button',
  );
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'Button' }),
    'data-button',
  );
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataButton' }),
    '',
  );
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );
  restore();
});

test('MapCreator VxWidgetMap overlay supports nested restore depth', (t) => {
  const baseMap = baseVxWidgetMap();
  const overlay = createLegacyVxWidgetMapOverlay({
    baseVxWidgetMap: baseMap,
    legacyIvxMap: legacyIvxMap(),
  });
  withRuntimeMaps(t, {
    VxWidgetMap: baseMap,
    LegacyIvxMap: legacyIvxMap(),
  });

  const outerRestore = MapCreator.installVxWidgetMapOverlay({
    VxWidgetMap: overlay.VxWidgetMap,
  });
  const innerRestore = MapCreator.installVxWidgetMapOverlay({
    VxWidgetMap: overlay.VxWidgetMap,
  });

  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );
  innerRestore();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );
  outerRestore();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    '',
  );
});

test('runtime legacy overlay keeps active overlay until overlapping installer restores finish', (t) => {
  withRuntimeMaps(t, {
    VxWidgetMap: baseVxWidgetMap(),
    LegacyIvxMap: legacyIvxMap(),
  });

  const outerRestore = installLegacyVxWidgetMapOverlay();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );

  const innerRestore = installLegacyVxWidgetMapOverlay();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );

  outerRestore();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    'data-excel',
  );

  innerRestore();
  assert.equal(
    MapCreator.getTypeFromNameEN({ nameEN: 'LegacyDataExcel' }),
    '',
  );
});
