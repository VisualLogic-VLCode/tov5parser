import test from 'node:test';
import assert from 'node:assert/strict';
import { createV4ConvertEnv, getWidgetMethodMap } from './env.js';
import { convertV4CaseJsonToV5CaseJson } from './index.js';
import { loadRuntimeMaps } from '../index.js';

// 将包内 ivxMap.txt / legacyIvxMap.txt 载入运行时全局（VxWidgetMap/VxJaMap 等）
function ensureIvxMapNodeEnv() {
  loadRuntimeMaps();
  return !!global.VxWidgetMap;
}

function buildV4CaseJson() {
  return {
    case: {
      id: 'case1',
      type: 'case',
      uis: { name: 'demo' },
      props: {},
    },
    stage: {
      id: 'stage1',
      type: 'ih5-stage',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [
        {
          id: 'txt1',
          type: 'ih5-text',
          rootId: 'stage1',
          uis: {},
          props: {},
          children: [],
          events: {
            list: [
              {
                tree: {
                  bid: 'blk-root',
                  type: 'root',
                  name: 'click',
                  children: [
                    {
                      bid: 'blk-child',
                      type: 'action',
                      object: 'txt1',
                      action: { name: 'noSuchMethod', params: [] },
                      children: [],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      classes: [
        {
          id: 'cls1',
          type: 'data-modClass',
          rootId: 'cls1',
          uis: {},
          props: { classId: 'clsA', isModServer: true },
          children: [
            {
              id: 'clsChild1',
              type: 'data-var',
              rootId: 'cls1',
              uis: {},
              props: {},
              children: [],
            },
          ],
        },
      ],
    },
    server: {
      id: 'server1',
      type: 'system-server',
      rootId: 'server1',
      uis: {},
      props: {},
      children: [
        {
          id: 'svc1',
          type: 'data-service',
          rootId: 'server1',
          uis: {},
          props: { inParams: ['p1'], outParams: ['q1'] },
          children: [],
        },
      ],
    },
  };
}

test('createV4ConvertEnv indexes nodes across main and class scopes', () => {
  const env = createV4ConvertEnv({ v4CaseJson: buildV4CaseJson() });

  // 主索引
  assert.equal(env.getNodeById('txt1').type, 'ih5-text');
  assert.equal(env.getNodeById('svc1').type, 'data-service');
  // 类根节点同时在主索引中
  assert.equal(env.getNodeById('cls1').type, 'data-modClass');
  // 类内容需带 classId（或已切换活动 classId）才能命中
  assert.equal(env.getNodeById('clsChild1'), undefined);
  assert.equal(env.getNodeById('clsChild1', 'clsA').type, 'data-var');
  env.setClassId('clsA');
  assert.equal(env.getNodeById('clsChild1').type, 'data-var');
  env.setClassId(false);
});

test('createV4ConvertEnv annotates and indexes event blocks', () => {
  const caseJson = buildV4CaseJson();
  const env = createV4ConvertEnv({ v4CaseJson: caseJson });

  const rootBlock = env.getEventBlockByBid('blk-root');
  const childBlock = env.getEventBlockByBid('blk-child');
  assert.equal(rootBlock.nodeId, 'txt1');
  assert.equal(rootBlock.parentBid, undefined);
  assert.equal(rootBlock.enable, true);
  assert.equal(childBlock.parentBid, 'blk-root');
  assert.equal(childBlock.rootBid, 'blk-root');
});

test('createV4ConvertEnv resolves server scope by tree position', () => {
  const env = createV4ConvertEnv({ v4CaseJson: buildV4CaseJson() });

  assert.equal(env.isServerRootNode(env.getNodeById('txt1')), false);
  assert.equal(env.isServerRootNode(env.getNodeById('svc1')), true);
  // isModServer 的小模块类内容归属后台
  assert.equal(
    env.isServerRootNode(env.getNodeById('clsChild1', 'clsA')),
    true,
  );
  // 后台系统伪对象
  assert.equal(env.isServerRootNode({ type: 'server-sys-serverSys' }), true);
});

test('createV4ConvertEnv maps fake node types with inferred prefix', () => {
  const env = createV4ConvertEnv({ v4CaseJson: buildV4CaseJson() });
  assert.equal(env.getNodeType('$sobj_base'), 'ih5-system');
  assert.equal(env.getNodeType('$sobj_file'), 'ih5-sys-file');
  assert.equal(env.getNodeType('$sobj_serverSys'), 'server-sys-serverSys');

  const wxCaseJson = buildV4CaseJson();
  wxCaseJson.stage.type = 'iwx-stage';
  const wxEnv = createV4ConvertEnv({ v4CaseJson: wxCaseJson });
  assert.equal(wxEnv.getNodeType('$sobj_base'), 'iwx-system');

  // 显式 ntype 优先于推断（5 = WX_APP）
  const typedEnv = createV4ConvertEnv({
    v4CaseJson: buildV4CaseJson(),
    ntype: 5,
  });
  assert.equal(typedEnv.getNodeType('$sobj_base'), 'iwx-system');
});

test('convertV4CaseJsonToV5CaseJson converts structure without touching input', () => {
  const v4CaseJson = buildV4CaseJson();
  const inputSnapshot = JSON.stringify(v4CaseJson);
  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });

  // 输入不被污染（env 标注发生在内部深拷贝上）
  assert.equal(JSON.stringify(v4CaseJson), inputSnapshot);

  assert.equal(v5CaseJson.case.uis.name, 'demo_5.0');
  assert.equal(v5CaseJson.stage.id, 'stage1');
  assert.equal(v5CaseJson.server.id, 'server1');
  // data-service 的字符串入参/出参转换为对象参数
  const svcNode = v5CaseJson.server.children.find((n) => n.id === 'svc1');
  assert.deepEqual(svcNode.props.inParams, [{ name: 'p1', type: 'JsonVal' }]);
  assert.deepEqual(svcNode.props.outParams, [{ name: 'q1', type: 'JsonVal' }]);
  // 小模块类完成转换
  assert.equal(v5CaseJson.stage.classes.length, 1);
});

test('getWidgetMethodMap resolves methods from runtime maps', (t) => {
  if (!ensureIvxMapNodeEnv()) {
    t.skip('missing optional fixture: ivxMap.txt');
    return;
  }
  // 前台：VxWidgetMap 任一带方法的组件
  const [stageName, stageComp] =
    Object.entries(global.VxWidgetMap).find(
      ([, comp]) => comp?.map?.methods?.length > 0,
    ) || [];
  assert.ok(stageName, 'VxWidgetMap should contain a component with methods');
  const stageMethod = stageComp.map.methods[0];
  assert.equal(
    getWidgetMethodMap({
      widgetName: stageName,
      methodName: stageMethod.name,
      inServer: false,
    }),
    stageMethod,
  );
  // 后台：VxJaMap 的 data-db
  const dbMethod = global.VxJaMap['data-db']?.methods?.[0];
  assert.ok(dbMethod, 'VxJaMap should contain data-db methods');
  assert.equal(
    getWidgetMethodMap({
      widgetName: 'data-db',
      methodName: dbMethod.name,
      inServer: true,
    }),
    dbMethod,
  );
});

test('convertV4CaseJsonToV5CaseJson converts with runtime maps loaded', (t) => {
  if (!ensureIvxMapNodeEnv()) {
    t.skip('missing optional fixture: ivxMap.txt');
    return;
  }
  const v5CaseJson = convertV4CaseJsonToV5CaseJson({
    v4CaseJson: buildV4CaseJson(),
  });
  assert.equal(v5CaseJson.case.uis.name, 'demo_5.0');
  assert.ok(v5CaseJson.stage && v5CaseJson.server);
});

test('convertV4CaseJsonToV5CaseJson rejects invalid input', () => {
  assert.throws(
    () => convertV4CaseJsonToV5CaseJson({ v4CaseJson: null }),
    /non-null object/,
  );
});
