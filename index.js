// @visuallogic-vlcode/tov5parser 库入口
//
// 使用前置条件：运行时全局需已加载组件映射（global/window 上的
// VxWidgetMap、VxJaMap、VxJaLoc、VxExLoc、VxSfMap 以及 LegacyIvxMap）。
// Node 环境可调用 loadRuntimeMaps() 从包内资产完成加载；
// lambda 入口 lambdaIndex.js 会在冷启动时自动完成。
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export {
  convertV4CaseJsonToV5CaseJson,
  convertV4CaseJsonToV5CaseJsonDetailed,
} from './v4ToV5/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// 将 ivxMap.txt（VxWidgetMap/VxJaMap 等 5.x 运行时组件映射）与
// legacyIvxMap.txt（4.x/legacy 专属组件的 overlay 源）载入运行时全局。
// 幂等：已加载则跳过。
export function loadRuntimeMaps() {
  if (typeof global === 'undefined') return;
  if (!global.VxWidgetMap) {
    const maps = JSON.parse(
      fs.readFileSync(path.join(__dirname, './ivxMap.txt'), 'utf8'),
    );
    for (const key in maps) {
      global[key] = maps[key];
    }
    if (global.window && typeof global.window === 'object') {
      Object.assign(global.window, maps);
    }
  }
  if (!global.LegacyIvxMap) {
    global.LegacyIvxMap = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, './legacyMaps/legacyIvxMap.txt'),
        'utf8',
      ),
    );
    if (global.window && typeof global.window === 'object') {
      global.window.LegacyIvxMap = global.LegacyIvxMap;
    }
  }
}
