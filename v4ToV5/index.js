// 4.x 案例 JSON → 5.x 案例 JSON
//
// ConvertV4ToV5 移植自 4.1 编辑器（VxEditor41 src/utils/convertV4ToV5），
// 其编辑器环境依赖（树索引/事件块索引/组件映射等）由 env.js 基于输入 JSON
// 与运行时组件映射（ivxMap.txt + legacyIvxMap overlay）重建，详见 env.js 头部说明。
import ConvertV4ToV5 from './converter.js';
import {
  createV4ConvertEnv,
  setActiveEnv,
  clearActiveEnv,
} from './env.js';
import { installLegacyVxWidgetMapOverlay } from '../legacyMaps/legacyVxWidgetMapOverlayInstaller.js';
import { compileV5ServerAst } from './serverAstCompiler.js';

// 4.x 案例 JSON（{ case, stage, server } 结构，即 4.1 编辑器 saveDealCase 的产物）
// 转 5.x 案例 JSON。ntype 为 4.x 平台案例记录上的案例类型，未传时从
// stage 根节点类型推断（见 env.js resolveFakeNodePrefix）。
function convertV4CaseJsonToV5CaseJson({ v4CaseJson, ntype } = {}) {
  if (!v4CaseJson || typeof v4CaseJson !== 'object') {
    throw new Error(
      'convertV4CaseJsonToV5CaseJson: v4CaseJson must be a non-null object.',
    );
  }
  // 深拷贝：env 建索引时会在事件块上补 parentBid 等标注，不触碰调用方对象
  const workingJson = JSON.parse(JSON.stringify(v4CaseJson));
  // 前台组件方法映射的查询需覆盖 4.x 专属组件（legacyIvxMap overlay）
  const uninstallOverlay = installLegacyVxWidgetMapOverlay();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson: workingJson, ntype }));
  try {
    const converter = new ConvertV4ToV5();
    const v5CaseJson = converter.exec({ nodes: workingJson });
    compileV5ServerAst(v5CaseJson);
    return v5CaseJson;
  } finally {
    clearActiveEnv();
    if (typeof uninstallOverlay === 'function') uninstallOverlay();
  }
}

export { convertV4CaseJsonToV5CaseJson };
