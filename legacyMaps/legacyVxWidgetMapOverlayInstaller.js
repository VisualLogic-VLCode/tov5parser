import MapCreator from '../utils/MapCreator.js';
import {
  createLegacyVxWidgetMapOverlay,
  getRuntimeLegacyIvxMap,
} from './legacyComponentContractResolver.js';

function installLegacyVxWidgetMapOverlay() {
  if (MapCreator.hasActiveVxWidgetMapOverlay()) {
    return MapCreator.installVxWidgetMapOverlay({
      VxWidgetMap: MapCreator.getRuntimeVxWidgetMap(),
    });
  }
  const overlay = createLegacyVxWidgetMapOverlay({
    baseVxWidgetMap: MapCreator.getRuntimeVxWidgetMap(),
    legacyIvxMap: getRuntimeLegacyIvxMap(),
  });
  if (overlay.summary.overlayCount === 0) return () => {};
  return MapCreator.installVxWidgetMapOverlay({
    VxWidgetMap: overlay.VxWidgetMap,
  });
}

export { installLegacyVxWidgetMapOverlay };
