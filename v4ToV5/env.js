// v4ToV5 转换的环境层：把 ConvertV4ToV5 在 4.1 编辑器里依赖的运行时能力
// （树索引、事件块索引、前后台归属、伪对象类型、组件方法映射、id 生成）
// 全部改为从输入的 v4 案例 JSON 与 vlparser 已有的组件映射资产中构建。
//
// 与 4.1 编辑器的对应关系：
//   getNodeById        ← stores/tree.js getNodeById（caseMap 扁平索引）
//   getEventBlockByBid ← stores/funcs/event.js（caseBlockMap，dealInitBlock 标注）
//   isServerRootNode   ← stores/funcs/event/methodUtils.js（改为建索引时记录归属）
//   getNodeType        ← stores/funcs/event/fakeNode.js（ntype 改为参数传入+推断兜底）
//   getWidgetMethodMap ← utils/convertV4ToV5/utils/action.js（widgets/window.VxJaMap
//                        改为 MapCreator 运行时映射，前台走 legacyIvxMap overlay）
//   genXid             ← src/utils/utils.js
import xid from 'xid-js';
import MapCreator from '../utils/MapCreator.js';
import { CASE_TYPE } from './editorConstants.js';

const EVENT_BLOCK_ROOT_TYPE = 'root';

function genXid() {
  let uuid = xid.next();
  if (uuid[0] >= '0' && uuid[0] <= '9') {
    return String.fromCharCode(65 + (uuid[0] - '0')) + uuid.substr(1);
  }
  return uuid;
}

// ── 组件方法映射 ─────────────────────────────────────────
// 前台：运行时 VxWidgetMap（调用方需先安装 legacyIvxMap overlay，
//       以覆盖 4.x 专属组件）；后台：运行时 VxJaMap（ivxMap.txt）。
function getWidgetMethodMap({ widgetName, methodName, inServer }) {
  if (inServer) {
    const jaComp = MapCreator.getVxJaMap()?.[widgetName];
    return jaComp?.methods?.find((m) => m.name === methodName);
  }
  const widgetMap = MapCreator.getRuntimeVxWidgetMap()?.[widgetName];
  return widgetMap?.map?.methods?.find((m) => m.name === methodName);
}

function getVxJaMap() {
  return MapCreator.getVxJaMap() || {};
}

// ── 伪对象类型前缀 ───────────────────────────────────────
// 4.1 fakeNode.getNodeType 只用 ntype 决定 iwx-/canvas-/ih5- 前缀；
// 未传 ntype 时从 stage 根节点类型推断。
function resolveFakeNodePrefix({ ntype, v4CaseJson }) {
  if (ntype !== undefined && ntype !== null) {
    if (ntype === CASE_TYPE.WX_APP) return 'iwx-';
    if ([CASE_TYPE.WX_GAME, CASE_TYPE.WX_GAME_3D].indexOf(ntype) >= 0) {
      return 'canvas-';
    }
    return 'ih5-';
  }
  const stageType = v4CaseJson?.stage?.type || '';
  if (stageType.startsWith('iwx-')) return 'iwx-';
  if (stageType.startsWith('canvas-')) return 'canvas-';
  return 'ih5-';
}

// ── 环境构建 ─────────────────────────────────────────────
// 索引的是转换前的 v4 JSON（converter.exec 内部会再深拷贝一份去改，
// 与编辑器里 caseMap/caseBlockMap 持有未转换原件的行为一致）。
// 注意：会在传入 JSON 的事件块上补 parentBid/rootBid/nodeId/enable 标注
// （等价于编辑器加载案例时 dealInitBlock 的行为），调用方如需保持输入
// 不被触碰，应传入深拷贝。
function createV4ConvertEnv({ v4CaseJson, ntype } = {}) {
  if (!v4CaseJson || typeof v4CaseJson !== 'object') {
    throw new Error('createV4ConvertEnv: v4CaseJson must be a non-null object.');
  }

  const mainNodeMap = {}; // 主案例节点索引（含小模块类根节点）
  const classNodeMaps = {}; // classId -> { nodeId -> node }
  const nodeScopes = new WeakMap(); // node -> 'stage' | 'server'
  const blockMap = {}; // bid -> 标注后的事件块

  // 等价于 4.1 stores/funcs/event.js dealInitBlock 的最小实现：
  // 只做 bid 索引与 parentBid/rootBid/nodeId/enable 标注。
  function indexBlock({ block, parentBid, rootBid, nodeId }) {
    if (!block || !block.bid) return;
    block.parentBid = parentBid;
    block.rootBid = rootBid;
    if (block.type === EVENT_BLOCK_ROOT_TYPE) {
      block.nodeId = nodeId;
    }
    if (block.enable === undefined) {
      block.enable = true;
    }
    blockMap[block.bid] = block;
    if (block.children?.length > 0) {
      block.children.forEach((child) => {
        indexBlock({ block: child, parentBid: block.bid, rootBid, nodeId });
      });
    }
  }

  function indexNodeEvents(node) {
    const list = node?.events?.list || [];
    for (const event of list) {
      if (!event?.tree?.bid) continue;
      indexBlock({
        block: event.tree,
        parentBid: undefined,
        rootBid: event.tree.bid,
        nodeId: node.id,
      });
    }
  }

  function walkTree({ node, scope, targetMap }) {
    if (!node || node.id === undefined || node.id === null) return;
    targetMap[node.id] = node;
    nodeScopes.set(node, scope);
    indexNodeEvents(node);
    if (node.children?.length > 0) {
      for (const child of node.children) {
        walkTree({ node: child, scope, targetMap });
      }
    }
  }

  const caseNode = v4CaseJson.case;
  if (caseNode && caseNode.id !== undefined && caseNode.id !== null) {
    mainNodeMap[caseNode.id] = caseNode;
    nodeScopes.set(caseNode, 'stage');
  }
  for (const scopeKey of ['stage', 'server']) {
    const rootNode = v4CaseJson[scopeKey];
    if (!rootNode) continue;
    walkTree({ node: rootNode, scope: scopeKey, targetMap: mainNodeMap });
    for (const classNode of rootNode.classes || []) {
      const classId = classNode?.props?.classId;
      if (classId === undefined || classId === null) continue;
      // 小模块内容的前后台归属由类自身的 isModServer 决定
      const classScope = classNode?.props?.isModServer ? 'server' : scopeKey;
      // 同一个小模块的前台/后台定义共用 classId，但各自包含不同节点。
      // 必须合并两棵树；重新赋空对象会在处理 server 时覆盖 stage 节点。
      classNodeMaps[classId] ||= {};
      // 类根节点同时进主索引：rootId 的查询（isServerRootNode）不带 classId
      mainNodeMap[classNode.id] = classNode;
      walkTree({
        node: classNode,
        scope: classScope,
        targetMap: classNodeMaps[classId],
      });
    }
  }

  function getNodeByIdWithClass(nodeId, classId) {
    if (nodeId === undefined || nodeId === null) return undefined;
    if (classId !== undefined && classId !== null && classId !== false) {
      const fromClass = classNodeMaps[classId]?.[nodeId];
      if (fromClass) return fromClass;
    }
    return mainNodeMap[nodeId];
  }

  // V4 的 callback action 会把同一事件路径中位于它之后的 block 编译到
  // callback continuation。目标 block 可能嵌套在后续 con/group 中，因此
  // 需要逐层向外检查当前分支之前的 siblings，而不能只看直接父节点。
  // 只接受直接位于该层 children 中的 callback action：条件分支内部的
  // callback 并不支配分支外的后续 block，不能作为外部 continuation。
  function getContinuationActionBlockByBid(bid) {
    let branch = blockMap[bid];
    while (branch?.parentBid) {
      const parent = blockMap[branch.parentBid];
      const siblings = Array.isArray(parent?.children) ? parent.children : [];
      const branchIndex = siblings.findIndex((item) => item?.bid === branch.bid);
      for (let index = branchIndex - 1; index >= 0; index -= 1) {
        const sibling = siblings[index];
        if (
          sibling?.type === 'action' &&
          sibling.action?.callback === true
        ) {
          return sibling;
        }
      }
      branch = parent;
    }
    return undefined;
  }

  // 等价于 4.1 methodUtils.isServerRootNode：
  // 原实现查根节点的 widget map isServer/isModServer 标志，
  // 这里建索引时已按所在树记录归属，直接查表。
  function isServerRootNode(objNode) {
    if (!objNode) return false;
    if (objNode.type === 'server-sys-serverSys') {
      // 后台系统伪对象
      return true;
    }
    let scope = nodeScopes.get(objNode);
    if (!scope && objNode.rootId !== undefined) {
      const rootNode = getNodeByIdWithClass(objNode.rootId);
      if (rootNode) scope = nodeScopes.get(rootNode);
    }
    return scope === 'server';
  }

  const fakeNodePrefix = resolveFakeNodePrefix({ ntype, v4CaseJson });

  // 等价于 4.1 fakeNode.getNodeType（$sobj_* 伪对象 → 组件类型名）
  function getNodeType(type) {
    let postfix;
    switch (type) {
      case '$sobj_base':
        postfix = 'system';
        break;
      case '$sobj_storage':
      case '$sobj_device':
      case '$sobj_file':
      case '$sobj_view':
      case '$sobj_route': {
        const typeName = type.split('_');
        postfix = 'sys-' + typeName[1];
        break;
      }
      case '$sobj_serverSys':
        // 后台系统
        return 'server-sys-serverSys';
      default:
        return undefined;
    }
    return fakeNodePrefix + postfix;
  }

  // 对应原 ConvertV4ToV5.classId 静态属性：转换小模块类内容时切换作用域
  let activeClassId = false;

  return {
    getNodeById(nodeId, classId = activeClassId) {
      return getNodeByIdWithClass(nodeId, classId);
    },
    getEventBlockByBid(bid) {
      return blockMap[bid];
    },
    getContinuationActionBlockByBid,
    isServerRootNode,
    getNodeType,
    setClassId(classId) {
      activeClassId = classId === undefined ? false : classId;
    },
    getClassId() {
      return activeClassId;
    },
  };
}

// ── 活动环境（模块级）────────────────────────────────────
// ConvertV4ToV5 的转换过程是同步的，单个 Node 进程内不会交错执行，
// 因此用模块级活动环境即可让移植代码免于逐层传参。
let activeEnv = null;

function setActiveEnv(env) {
  activeEnv = env;
}

function clearActiveEnv() {
  activeEnv = null;
}

function requireActiveEnv() {
  if (!activeEnv) {
    throw new Error(
      'v4ToV5 env is not active. Wrap the conversion with setActiveEnv(createV4ConvertEnv(...)).',
    );
  }
  return activeEnv;
}

// 供移植代码直接 import 的委托函数（对应原编辑器全局能力）
const getNodeById = (nodeId, classId) =>
  classId === undefined
    ? requireActiveEnv().getNodeById(nodeId)
    : requireActiveEnv().getNodeById(nodeId, classId);
const getEventBlockByBid = (bid) => requireActiveEnv().getEventBlockByBid(bid);
const getContinuationActionBlockByBid = (bid) =>
  requireActiveEnv().getContinuationActionBlockByBid(bid);
const isServerRootNode = (node) => requireActiveEnv().isServerRootNode(node);
const getNodeType = (type) => requireActiveEnv().getNodeType(type);
const setActiveClassId = (classId) => requireActiveEnv().setClassId(classId);
const getActiveClassId = () => requireActiveEnv().getClassId();

export {
  createV4ConvertEnv,
  setActiveEnv,
  clearActiveEnv,
  genXid,
  getWidgetMethodMap,
  getVxJaMap,
  getNodeById,
  getEventBlockByBid,
  getContinuationActionBlockByBid,
  isServerRootNode,
  getNodeType,
  setActiveClassId,
  getActiveClassId,
};
