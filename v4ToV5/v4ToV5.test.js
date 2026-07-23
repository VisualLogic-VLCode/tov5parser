import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearActiveEnv,
  createV4ConvertEnv,
  getWidgetMethodMap,
  setActiveEnv,
} from './env.js';
import { convertV4CaseJsonToV5CaseJson } from './index.js';
import { loadRuntimeMaps } from '../index.js';
import { getLegacyFormulaTextValue } from './utils/action.js';
import { genConObj, getLegacyConditionTextValue } from './utils/con.js';
import { compileV5ServerAst } from './serverAstCompiler.js';

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
      classes: [
        {
          id: 'cls1',
          type: 'data-modClass',
          rootId: 'cls1',
          uis: {},
          props: { classId: 'clsA', isModServer: true },
          children: [
            {
              id: 'clsServerChild1',
              type: 'data-service',
              rootId: 'cls1',
              uis: {},
              props: {},
              children: [],
            },
          ],
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
  // 同一 classId 的前台/后台节点必须合并，后建的 server class 不能覆盖 stage。
  assert.equal(
    env.getNodeById('clsServerChild1', 'clsA').type,
    'data-service',
  );
  env.setClassId('clsA');
  assert.equal(env.getNodeById('clsChild1').type, 'data-var');
  assert.equal(env.getNodeById('clsServerChild1').type, 'data-service');
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
  assert.equal(
    env.isServerRootNode(env.getNodeById('clsServerChild1', 'clsA')),
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

test('compileV5ServerAst makes server class services registrable', () => {
  ensureIvxMapNodeEnv();
  const serviceNode = {
    id: 'service-in-class',
    type: 'data-service',
    uis: { name: 'getStyleList' },
    props: {
      inParams: [{ name: 'session', type: 'JsonVal' }],
    },
    children: [],
    events: {
      list: [
        {
          name: 'callService',
          ast: {
            op: 'let',
            val: ['serviceResult', 'JsonVal'],
            args: [{ op: 'val', val: 'ok' }],
          },
        },
      ],
    },
  };
  const caseJson = {
    server: {
      id: 'server-root',
      type: 'system-server',
      props: {},
      children: [],
      classes: [
        {
          id: 'server-class',
          type: 'data-modClass',
          props: { classId: 'C_server_class' },
          children: [serviceNode],
        },
      ],
    },
  };

  assert.equal(compileV5ServerAst(caseJson), 1);
  assert.equal(caseJson.server.props.v2, 1);
  assert.match(
    serviceNode.events.list[0]._code,
    /_checkInParamsTypeError\(\[{"name":"session","type":"JsonVal"}\], param\)/,
  );
  assert.match(
    serviceNode.events.list[0]._code,
    /let serviceResult = "ok"/,
  );
  assert.equal(
    typeof serviceNode.events.list[0]._code,
    'string',
    'runtime service collection only registers string _code',
  );
});

test('compileV5ServerAst mirrors loose function-group parameter handling', () => {
  ensureIvxMapNodeEnv();
  const funcGroup = {
    id: 'funcgroup',
    type: 'data-funcGroup',
    props: {
      inParams: [{ name: 'count', type: 'long' }],
    },
    children: [],
    events: {
      list: [
        {
          name: 'callFuncGroup',
          ast: {
            op: 'let',
            val: ['funcResult', 'JsonVal'],
            args: [{ op: 'val', val: 1 }],
          },
        },
      ],
    },
  };
  const caseJson = {
    server: {
      id: 'server-root',
      type: 'system-server',
      props: { paramLooseMode: true },
      children: [funcGroup],
      classes: [],
    },
  };

  compileV5ServerAst(caseJson);
  assert.match(
    funcGroup.events.list[0]._code,
    /^fParamfuncgroup\.count = toLong\(fParamfuncgroup\.count\);/,
  );
  assert.equal(funcGroup.props._code, funcGroup.events.list[0]._code);
});

test('converted cloud module classes are marked editable in v5', () => {
  const v4CaseJson = buildV4CaseJson();
  const stageCloudClass = v4CaseJson.stage.classes[0];
  const serverCloudClass = v4CaseJson.server.classes[0];

  stageCloudClass.props.widgetId = 12345;
  serverCloudClass.uis.registerID = 67890;
  v4CaseJson.stage.classes.push({
    id: 'localCls',
    type: 'data-modClass',
    rootId: 'localCls',
    uis: {},
    props: { classId: 'localClsA' },
    children: [],
  });
  v4CaseJson.server.classes.push({
    id: 'futureCls',
    type: 'data-modClass',
    rootId: 'futureCls',
    uis: {},
    props: { classId: 'futureClsA', widgetId: 24680, modEdtVer: 3 },
    children: [],
  });

  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });

  assert.equal(v5CaseJson.stage.classes[0].props.modEdtVer, 2);
  assert.equal(v5CaseJson.server.classes[0].props.modEdtVer, 2);
  assert.equal(v5CaseJson.stage.classes[1].props.modEdtVer, undefined);
  assert.equal(v5CaseJson.server.classes[1].props.modEdtVer, 3);
});

test('infinite data-animate play actions are skipped to avoid awaiting forever', (t) => {
  if (!ensureIvxMapNodeEnv()) {
    t.skip('missing optional fixture: ivxMap.txt');
    return;
  }

  const v4CaseJson = buildV4CaseJson();
  v4CaseJson.stage.children.push(
    {
      id: 'infinite-animate',
      type: 'data-animate',
      rootId: 'stage1',
      uis: { name: '无限动画' },
      props: { infinite: true },
      binds: {},
      children: [],
    },
    {
      id: 'finite-animate',
      type: 'data-animate',
      rootId: 'stage1',
      uis: { name: '有限动画' },
      props: { infinite: false },
      binds: {},
      children: [],
    },
    {
      id: 'animate-controller',
      type: 'ih5-text',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
      events: {
        list: [
          {
            tree: {
              bid: 'animate-root',
              type: 'root',
              trigger: { name: 'click' },
              children: [
                {
                  bid: 'infinite-play',
                  type: 'action',
                  object: 'infinite-animate',
                  action: { name: 'play', callback: true, params: [] },
                  children: [],
                },
                {
                  bid: 'finite-play',
                  type: 'action',
                  object: 'finite-animate',
                  action: { name: 'play', callback: true, params: [] },
                  children: [],
                },
              ],
            },
          },
        ],
      },
    },
  );

  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });
  const controller = v5CaseJson.stage.children.find(
    (node) => node.id === 'animate-controller',
  );
  const actionAsts = controller.events.list[0].ast.args;
  const infinitePlay = actionAsts.find((ast) => ast.ln === 'infinite-play');
  const finitePlay = actionAsts.find((ast) => ast.ln === 'finite-play');

  assert.equal(infinitePlay.op, 'let');
  assert.equal(infinitePlay.skip, true);
  assert.equal(finitePlay.op, 'let');
  assert.equal(finitePlay.skip, undefined);
});

test('delayed variable methods yield once after updating bindings', (t) => {
  if (!ensureIvxMapNodeEnv()) {
    t.skip('missing optional fixture: ivxMap.txt');
    return;
  }

  const v4CaseJson = buildV4CaseJson();
  v4CaseJson.stage.children.push(
    {
      id: 'refresh-bool',
      type: 'data-bool',
      rootId: 'stage1',
      uis: { name: '刷新布尔变量' },
      props: { value: true },
      binds: {},
      children: [],
    },
    {
      id: 'refresh-text',
      type: 'ih5-text',
      rootId: 'stage1',
      uis: { name: '普通文本' },
      props: {},
      binds: {},
      children: [],
    },
    {
      id: 'refresh-controller',
      type: 'ih5-text',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
      events: {
        list: [
          {
            tree: {
              bid: 'refresh-root',
              type: 'root',
              trigger: { name: 'click' },
              children: [
                {
                  bid: 'delayed-bool-method',
                  type: 'action',
                  object: 'refresh-bool',
                  delay: 1.5,
                  action: { name: 'setFalse', params: [] },
                  children: [],
                },
                {
                  bid: 'delayed-text-method',
                  type: 'action',
                  object: 'refresh-text',
                  delay: 2,
                  action: { name: 'setProps', params: [] },
                  children: [],
                },
                {
                  bid: 'plain-bool-method',
                  type: 'action',
                  object: 'refresh-bool',
                  action: { name: 'setTrue', params: [] },
                  children: [],
                },
              ],
            },
          },
        ],
      },
    },
  );

  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });
  const controller = v5CaseJson.stage.children.find(
    (node) => node.id === 'refresh-controller',
  );
  const actionAsts = controller.events.list[0].ast.args;

  assert.equal(actionAsts.length, 6);
  assert.equal(actionAsts[1].ln, 'delayed-bool-method');
  assert.equal(actionAsts[4].ln, 'delayed-text-method');
  assert.equal(actionAsts[5].ln, 'plain-bool-method');

  const assertDelayAst = ({ ast, time, hasTimeValue }) => {
    assert.equal(ast.op, 'let');
    assert.deepEqual(ast.val, [`${ast.ln}Rtn`, 'JsonVal']);
    const getAst = ast.args[0];
    assert.equal(getAst.op, 'get');
    assert.deepEqual(getAst.args[0], {
      op: 'ref',
      val: ['sobj', 'base'],
    });
    const methodAst = getAst.args[1];
    assert.equal(methodAst.op, 'method');
    assert.equal(methodAst.val, 'delaysMethod');
    assert.equal(methodAst.args.length, 1);
    assert.deepEqual(
      methodAst.args[0],
      hasTimeValue
        ? { key: 'time', op: 'val', val: time }
        : { key: 'time', op: 'val' },
    );
  };

  // 原有延时仍在变量方法前。
  assertDelayAst({ ast: actionAsts[0], time: 1.5, hasTimeValue: true });
  // 变量方法后新增一次无 time 值的零时长让步。
  assertDelayAst({ ast: actionAsts[2], hasTimeValue: false });
  // 非变量组件只有原有前置延时，不追加刷新让步。
  assertDelayAst({ ast: actionAsts[3], time: 2, hasTimeValue: true });
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

test('legacy text-like formula parameters stay literal without hiding real formulas', () => {
  const formulaParam = (name, code) => ({
    name,
    type: 'Formula',
    value: { code },
  });

  assert.equal(
    getLegacyFormulaTextValue({ param: formulaParam('path', '.style') }),
    '.style',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('paddingRight', '10px'),
      paramName: 'paddingRight',
    }),
    '10px',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('info', '4新路径'),
    }),
    '4新路径',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('info', 'wy 量体部门'),
    }),
    'wy 量体部门',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('info', 'session,key'),
    }),
    'session,key',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('info', 'typeof'),
    }),
    'typeof',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('url', 'https://pricing.ivx.cn/'),
    }),
    'https://pricing.ivx.cn/',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('url', 'ftp://files.ivx.cn/release.zip'),
    }),
    'ftp://files.ivx.cn/release.zip',
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('url', 'window.open("https://pricing.ivx.cn/")'),
    }),
    undefined,
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('url', '"https://www.ivx.cn/" + path'),
    }),
    undefined,
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('value', '$refs.node.p_value'),
    }),
    undefined,
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('paddingRight', '10 + offset'),
      paramName: 'paddingRight',
    }),
    undefined,
  );
});

test('legacy condition text values stay literal without hiding formulas', () => {
  const textValue = (code, str = [
    { type: 'str', obj: code },
  ]) => ({ code, str });

  assert.equal(
    getLegacyConditionTextValue({
      value: textValue('domain not registered', [
        { type: 'str', obj: 'domain' },
        { type: 'str', obj: ' ' },
        { type: 'str', obj: 'not' },
        { type: 'str', obj: ' ' },
        { type: 'str', obj: 'registered' },
      ]),
      operator: 'equal',
    }),
    'domain not registered',
  );
  assert.equal(
    getLegacyConditionTextValue({
      value: textValue('www.ivx.cn', [
        { type: 'str', obj: 'www' },
        { type: 'str', obj: '.' },
        { type: 'str', obj: 'ivx' },
        { type: 'str', obj: '.' },
        { type: 'str', obj: 'cn' },
      ]),
      operator: 'include',
    }),
    'www.ivx.cn',
  );
  assert.equal(
    getLegacyConditionTextValue({
      value: textValue('window.location.href'),
      operator: 'include',
    }),
    undefined,
  );
  assert.equal(
    getLegacyConditionTextValue({
      value: {
        code: 'param.value',
        str: [null, { type: 'param', obj: 'value' }],
      },
      operator: 'equal',
    }),
    undefined,
  );
  assert.equal(
    getLegacyConditionTextValue({
      value: textValue('domain not registered'),
      operator: 'greater',
    }),
    undefined,
  );
});

test('legacy application system conditions keep the original receiver and method args', () => {
  const v4CaseJson = buildV4CaseJson();
  const systemNodeId = 'cbx1ewka3j50000c35vg';
  v4CaseJson.stage.children.push({
    id: systemNodeId,
    type: 'ih5-system',
    rootId: 'stage1',
    uis: { name: '应用系统' },
    props: {},
    children: [],
  });
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));

  try {
    const conditionAst = genConObj({
      conItem: {
        value1: {
          code: `$refs.${systemNodeId}.f__appEnv('appType')`,
          str: [
            {
              type: 'obj',
              obj: '应用系统',
              nodeId: systemNodeId,
              props: ['获取应用环境|环境', '环境类型'],
            },
          ],
        },
        operator: 'equal',
        value2: { code: '"PC"', str: [{ type: 'str', obj: '"PC"' }] },
      },
      scope: 'stage',
      nodeId: systemNodeId,
      blockId: 'system-condition',
    });

    assert.deepEqual(conditionAst.args[0], {
      op: 'var',
      args: [
        {
          op: 'get',
          args: [
            { op: 'ref', val: ['var', systemNodeId] },
            {
              op: 'method',
              val: '_appEnv',
              args: [{ op: 'val', val: 'appType' }],
            },
          ],
          _blockType: '$refs',
        },
      ],
    });
    assert.deepEqual(conditionAst.args[1], { op: 'val', val: 'PC' });
  } finally {
    clearActiveEnv();
  }
});
