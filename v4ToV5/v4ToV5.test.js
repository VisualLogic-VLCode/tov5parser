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
import {
  convertDbCons,
  convertObjJsonMultiPaths,
} from './utils/actionUtils/actionParamConvert.js';
import {
  convertBlockCons,
  genConObj,
} from './utils/con.js';
import { convertEditorValue } from './utils/formula.js';
import { getLegacyV41FormulaString } from './utils/legacyFormulaValue.js';
import {
  compileV5ServerAst,
  normalizeServerMethodErrorCallbacks,
} from './serverAstCompiler.js';

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

test('convertDbCons maps the legacy notEqual operator to V5 neq', () => {
  ensureIvxMapNodeEnv();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson: buildV4CaseJson() }));
  try {
    const ast = convertDbCons(
      [
        {
          flag: 'and',
          field: 'oldCode',
          opt: 'notEqual',
          value: { code: 'null' },
        },
      ],
      'svc1',
      'unused-block',
    );

    assert.equal(ast.args[0].args[1].val, 'neq');
  } finally {
    clearActiveEnv();
  }
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

test('data-if keeps the V5 condition AST without the legacy value bind', () => {
  ensureIvxMapNodeEnv();
  const v4CaseJson = buildV4CaseJson();
  v4CaseJson.stage.children.push({
    id: 'if1',
    type: 'data-if',
    rootId: 'stage1',
    uis: { name: '条件容器' },
    props: {
      conditionVal: [[{ code: '1' }, '==', { code: '1' }]],
      condition: null,
    },
    binds: {
      value: { _code: '1==1', code: '1==1' },
      other: { _code: '2', code: '2' },
    },
    children: [],
  });

  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });
  const dataIf = v5CaseJson.stage.children.find((node) => node.id === 'if1');

  assert.equal(dataIf.uis.astCon, true);
  assert.ok(dataIf.props.conditionVal.ast);
  assert.equal('value' in dataIf.binds, false);
  assert.deepEqual(dataIf.binds.other, { op: 'val', val: 2 });
});

test('service return keeps legacy reason text literal and empty values empty', () => {
  ensureIvxMapNodeEnv();
  const v4CaseJson = buildV4CaseJson();
  const serviceNode = v4CaseJson.server.children.find(
    (node) => node.id === 'svc1',
  );
  serviceNode.events = {
    list: [
      {
        name: 'callService',
        tree: {
          bid: 'return-root',
          type: 'root',
          children: [
            {
              bid: 'return-action',
              type: 'action',
              object: 'curObj',
              action: {
                name: 'paramResult',
                paramsAsObj: true,
                params: [
                  {
                    name: 'reason',
                    type: 'Formula',
                    value: { code: 'db error' },
                  },
                  {
                    name: 'data',
                    type: 'Formula',
                    value: { code: '', str: [] },
                  },
                ],
              },
              children: [],
            },
          ],
        },
      },
    ],
  };

  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });
  const convertedService = v5CaseJson.server.children.find(
    (node) => node.id === 'svc1',
  );
  const returnAst = convertedService.events.list[0].ast.args[0];

  assert.equal(returnAst.op, 'return');
  assert.deepEqual(returnAst.args, [
    { op: 'val', val: 'db error', key: 'reason' },
    { op: 'val', key: 'data' },
  ]);
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

test('server compiler removes only legacy error callback placeholders', () => {
  ensureIvxMapNodeEnv();
  const javaMap = global.VxJaMap;
  const nodes = {
    api: { id: 'api', type: 'server-api' },
    db: { id: 'db', type: 'data-db' },
  };
  const createMethodCall = (nodeId, methodName, businessArgCount, lastArg) => ({
    op: 'get',
    args: [
      { op: 'ref', val: ['var', nodeId] },
      {
        op: 'method',
        val: methodName,
        args: [
          ...Array.from({ length: businessArgCount }, () => ({ op: 'val' })),
          lastArg,
        ],
      },
    ],
  });
  const apiCall = createMethodCall(
    'api',
    'sendServerApiRequest',
    6,
    { op: 'val' },
  );
  const dbCall = createMethodCall('db', 'dbBatchUpdate', 4, { op: 'val' });
  const fakeCallback = {
    op: 'alambda',
    _fakeCbInner: true,
    args: [{ op: 'val' }],
  };
  const apiCallWithV5FakeCallback = createMethodCall(
    'api',
    'sendServerApiRequest',
    6,
    fakeCallback,
  );
  const rootAst = {
    op: 'block',
    args: [apiCall, dbCall, apiCallWithV5FakeCallback],
  };

  assert.equal(
    normalizeServerMethodErrorCallbacks(
      rootAst,
      (id) => nodes[id],
      javaMap,
    ),
    2,
  );
  assert.equal(apiCall.args[1].args.length, 6);
  assert.equal(dbCall.args[1].args.length, 4);
  assert.equal(apiCallWithV5FakeCallback.args[1].args.length, 7);
  assert.equal(
    apiCallWithV5FakeCallback.args[1].args.at(-1),
    fakeCallback,
    'V5 fake callbacks remain available for the existing fake-callback pass',
  );
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

test('delayed variable methods keep only the original business delay', (t) => {
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

  assert.equal(actionAsts.length, 5);
  assert.equal(actionAsts[1].ln, 'delayed-bool-method');
  assert.equal(actionAsts[3].ln, 'delayed-text-method');
  assert.equal(actionAsts[4].ln, 'plain-bool-method');

  const assertDelayAst = ({ ast, time }) => {
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
    assert.deepEqual(methodAst.args[0], {
      key: 'time',
      op: 'val',
      val: time,
    });
  };

  assertDelayAst({ ast: actionAsts[0], time: 1.5 });
  assertDelayAst({ ast: actionAsts[2], time: 2 });
});

test('async tree-bound variable setValue does not synthesize refresh delays', (t) => {
  if (!ensureIvxMapNodeEnv()) {
    t.skip('missing optional fixture: ivxMap.txt');
    return;
  }

  const v4CaseJson = buildV4CaseJson();
  v4CaseJson.stage.children.push(
    {
      id: 'async-bound-list',
      type: 'data-obj-arr',
      rootId: 'stage1',
      uis: { name: '异步树数据' },
      props: { value: [] },
      binds: {},
      children: [],
      _cited: {
        props: {
          'async-tree': ['value'],
        },
      },
    },
    {
      id: 'async-unbound-list',
      type: 'data-obj-arr',
      rootId: 'stage1',
      uis: { name: '未绑定数据' },
      props: { value: [] },
      binds: {},
      children: [],
    },
    {
      id: 'async-text-bound-list',
      type: 'data-obj-arr',
      rootId: 'stage1',
      uis: { name: '普通文本绑定数据' },
      props: { value: [] },
      binds: {},
      children: [],
      _cited: {
        props: {
          'async-bound-text': ['text'],
        },
      },
    },
    {
      id: 'async-tree',
      type: 'ih5-tree-for',
      rootId: 'stage1',
      uis: {},
      props: {},
      binds: {},
      children: [],
    },
    {
      id: 'async-bound-text',
      type: 'ih5-text',
      rootId: 'stage1',
      uis: {},
      props: {},
      binds: {},
      children: [],
    },
    {
      id: 'async-source',
      type: 'data-funcGroup',
      rootId: 'stage1',
      uis: {},
      props: { inParams: [], outParams: [] },
      binds: {},
      children: [],
    },
    {
      id: 'async-refresh-controller',
      type: 'ih5-text',
      rootId: 'stage1',
      uis: {},
      props: {},
      binds: {},
      children: [],
      events: {
        list: [
          {
            tree: {
              bid: 'async-refresh-root',
              type: 'root',
              trigger: { name: 'click' },
              children: [
                {
                  bid: 'plain-bound-set',
                  type: 'action',
                  object: 'async-bound-list',
                  action: { name: 'setValue', params: [] },
                  children: [],
                },
                {
                  bid: 'async-source-call',
                  type: 'action',
                  object: 'async-source',
                  action: {
                    name: 'fireFuncGroup',
                    callback: true,
                    params: [],
                  },
                  children: [
                    {
                      bid: 'async-source-status',
                      type: 'status',
                      option: null,
                      children: [
                        {
                          bid: 'async-bound-set',
                          type: 'action',
                          object: 'async-bound-list',
                          action: { name: 'setValue', params: [] },
                          children: [],
                        },
                        {
                          bid: 'async-unbound-set',
                          type: 'action',
                          object: 'async-unbound-list',
                          action: { name: 'setValue', params: [] },
                          children: [],
                        },
                        {
                          bid: 'async-text-bound-set',
                          type: 'action',
                          object: 'async-text-bound-list',
                          action: { name: 'setValue', params: [] },
                          children: [],
                        },
                        {
                          bid: 'async-bound-clear',
                          type: 'action',
                          object: 'async-bound-list',
                          action: { name: 'clearValue', params: [] },
                          children: [],
                        },
                      ],
                    },
                  ],
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
    (node) => node.id === 'async-refresh-controller',
  );
  const eventAst = controller.events.list[0].ast;

  const findSiblingArgs = (ast, ln) => {
    if (!ast || typeof ast !== 'object') return undefined;
    if (Array.isArray(ast.args)) {
      if (ast.args.some((item) => item?.ln === ln)) return ast.args;
      for (const item of ast.args) {
        const found = findSiblingArgs(item, ln);
        if (found) return found;
      }
    }
    return undefined;
  };
  const isYieldAst = (ast) =>
    ast?.op === 'let' &&
    ast.args?.[0]?.args?.[0]?.val?.[0] === 'sobj' &&
    ast.args?.[0]?.args?.[1]?.val === 'delaysMethod';

  const rootArgs = findSiblingArgs(eventAst, 'plain-bound-set');
  const plainIndex = rootArgs.findIndex((ast) => ast.ln === 'plain-bound-set');
  assert.equal(rootArgs[plainIndex + 1].ln, 'async-source-call');

  const callbackArgs = findSiblingArgs(eventAst, 'async-bound-set');
  assert.deepEqual(
    callbackArgs.map((ast) => ast.ln),
    [
      'async-bound-set',
      'async-unbound-set',
      'async-text-bound-set',
      'async-bound-clear',
    ],
  );
  assert.equal(callbackArgs.some(isYieldAst), false);
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

test('formula conversion follows the V4.1 event-code literal semantics', () => {
  const v4CaseJson = buildV4CaseJson();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));

  const convert = code =>
    convertEditorValue({
      value: { code },
      nodeId: 'txt1',
      blockId: 'legacy-v41-formula-str',
    });

  try {
    const stringCases = [
      ['6a939b74c7b83df984bb4ae9be230a18', '6a939b74c7b83df984bb4ae9be230a18'],
      ['message', 'message'],
      [' 选中数据审核字段有误', ' 选中数据审核字段有误'],
      [' 否', ' 否'],
      ['db error', 'db error'],
      ['4新路径', '4新路径'],
      ['wy 量体部门', 'wy 量体部门'],
      ['session,key', 'session,key'],
      ['typeof', 'typeof'],
      ['10px', '10px'],
      ['100vh', '100vh'],
      ['100%', '100%'],
      ['application/json', 'application/json'],
      ['https://pricing.ivx.cn/path', 'https://pricing.ivx.cn/path'],
      ['https://pricing.ivx.cn/a b', 'https://pricing.ivx.cn/ab'],
      ['ftp://files.ivx.cn/archive', 'ftp://files.ivx.cn/archive'],
      ['//cdn.ivx.cn/asset', '//cdn.ivx.cn/asset'],
      ['http://localhost:8080/path', 'http://localhost:8080/path'],
      ['www.ivx.cn', 'www.ivx.cn'],
      ['-0.5%', '-0.5%'],
    ];
    for (const [code, expected] of stringCases) {
      assert.deepEqual(convert(code), { op: 'val', val: expected }, code);
    }

    assert.deepEqual(convert('6'), { op: 'val', val: 6 });
    assert.deepEqual(convert('true'), { op: 'val', val: true });
    assert.deepEqual(convert('null'), { op: 'val', val: null });
    assert.deepEqual(convert("'style'"), { op: 'val', val: 'style' });

    const refAst = convert('$refs.txt1.p_value');
    assert.equal(refAst.op, 'var');

    const expressionAst = convert('1 + 2');
    assert.notDeepEqual(expressionAst, { op: 'val', val: '1 + 2' });

    const malformedAst = convert('user.name +');
    assert.notDeepEqual(malformedAst, { op: 'val', val: 'user.name +' });

    const incompleteUrlAst = convert('https:xxxx');
    assert.notDeepEqual(incompleteUrlAst, { op: 'val', val: 'https:xxxx' });

    assert.equal(
      getLegacyV41FormulaString({ code: '【提示】' }),
      undefined,
    );
    for (const code of [
      ',',
      'param.value',
      'System.now',
      'ids.current',
      'Math.abs(1)',
      '_loopevent',
      'cbParams',
      '$curPathValue',
      '$refs',
    ]) {
      assert.equal(getLegacyV41FormulaString({ code }), undefined, code);
    }
  } finally {
    clearActiveEnv();
  }
});

test('stale function-group parameter prefixes recover from the current token contract', () => {
  const v4CaseJson = buildV4CaseJson();
  v4CaseJson.stage.children.push({
    id: 'currentfuncgroup',
    type: 'data-funcGroup',
    rootId: 'stage1',
    uis: {},
    props: { inParams: ['value', 'name'] },
    binds: {},
    children: [],
  });
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));

  const convertParam = name =>
    convertEditorValue({
      value: {
        code: `fParamdeletedfuncgroup.${name}`,
        str: [
          {
            type: 'param',
            obj: name,
            extra: { type: 'funcGroupParam' },
          },
        ],
      },
      nodeId: 'currentfuncgroup',
      blockId: 'stale-func-group-param',
    });

  const expectedParamAst = name => ({
    op: 'var',
    args: [
      {
        op: 'get',
        args: [{ op: 'ref', val: ['param', name] }],
        _blockType: '$cbParams',
      },
    ],
  });

  try {
    for (const name of ['value', 'name']) {
      assert.deepEqual(convertParam(name), expectedParamAst(name));
    }

    assert.deepEqual(
      convertEditorValue({
        value: { code: 'fParamcurrentfuncgroup.value' },
        nodeId: 'currentfuncgroup',
      }),
      expectedParamAst('value'),
    );

    const originalConsoleLog = console.log;
    console.log = () => {};
    try {
      for (const value of [
        {
          code: 'fParamdeletedfuncgroup.value',
          str: [{ type: 'str', obj: 'fParamdeletedfuncgroup.value' }],
        },
        {
          code: 'fParamdeletedfuncgroup.secret',
          str: [
            {
              type: 'param',
              obj: 'secret',
              extra: { type: 'funcGroupParam' },
            },
          ],
        },
      ]) {
        const unresolved = convertEditorValue({
          value,
          nodeId: 'currentfuncgroup',
        });
        assert.match(JSON.stringify(unresolved), /fParamdeletedfuncgroup/);
      }
    } finally {
      console.log = originalConsoleLog;
    }
  } finally {
    clearActiveEnv();
  }
});

test('legacy action API path text stays literal', () => {
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
    getLegacyFormulaTextValue({ param: formulaParam('value', '.style') }),
    undefined,
  );
  assert.equal(
    getLegacyFormulaTextValue({
      param: formulaParam('path', 'param.path || ".style"'),
    }),
    undefined,
  );
});

test('object-json multi-path values preserve tokenized absolute URL text', () => {
  const v4CaseJson = buildV4CaseJson();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));
  const url = 'https://v4pre.h5sys.cn/upload?m=p&nid=11405038';

  try {
    const ast = convertObjJsonMultiPaths([
      {
        path: [{ name: 'uploadUrl' }],
        value: {
          code: url,
          str: [
            { type: 'str', obj: 'https' },
            { type: 'str', obj: ':' },
            { type: 'str', obj: '//v4pre.h5sys.cn/upload?m=p&nid=11405038' },
          ],
        },
      },
      {
        path: [{ name: 'fileUrl' }],
        value: {
          code: 'param.fileUrl',
          str: [{ type: 'param', obj: 'fileUrl' }],
        },
      },
    ], 'svc1', 'nested-url');

    assert.deepEqual(ast.args[1], { op: 'val', val: url });
    assert.equal(ast.args[3].op, 'var');
    assert.doesNotMatch(JSON.stringify(ast.args[3]), /"val":"param\.fileUrl"/);
  } finally {
    clearActiveEnv();
  }
});

test('full JavaScript fallback removes only zero-argument legacy getSelf calls', () => {
  const v4CaseJson = buildV4CaseJson();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));

  try {
    const ast = convertEditorValue({
      value: {
        code: '[1, 2].filter(item => { return item > 0; }).$SF_getSelf().$SF_getSelf().map(x => { return x; })',
        str: [],
      },
      nodeId: 'txt1',
      blockId: 'legacy-get-self',
    });
    const serialized = JSON.stringify(ast);

    assert.match(serialized, /"op":"jsfn"/);
    assert.doesNotMatch(serialized, /\$SF_getSelf/);
    assert.match(serialized, /\.filter\(/);
    assert.match(serialized, /\.map\(/);

    const callWithArgument = convertEditorValue({
      value: {
        code: '[1].map(x => { return x; }).$SF_getSelf(1)',
        str: [],
      },
      nodeId: 'txt1',
      blockId: 'non-identity-get-self',
    });
    assert.match(JSON.stringify(callWithArgument), /\$SF_getSelf/);
  } finally {
    clearActiveEnv();
  }
});

test('file upload callbacks append missing V5 lambda parameters', () => {
  ensureIvxMapNodeEnv();
  const v4CaseJson = buildV4CaseJson();
  const textNode = v4CaseJson.stage.children[0];
  textNode.events = {
    list: [
      {
        tree: {
          bid: 'upload-root',
          type: 'root',
          name: 'click',
          children: [
            {
              bid: 'upload-action',
              type: 'action',
              object: '$sobj_file',
              action: {
                name: 'uploadFile',
                callback: true,
                paramsAsObj: true,
                params: [
                  { name: 'path', type: 'Formula', value: null },
                  { name: 'readType', type: 'Select', value: 'preview' },
                  { name: 'size', type: 'Formula', value: null },
                  { name: 'minSize', type: 'Formula', value: null },
                  { name: 'timeout', type: 'Formula', value: null },
                  { name: 'accept', type: 'Formula', value: null },
                ],
              },
              children: [
                {
                  bid: 'uploading-status',
                  type: 'status',
                  option: 'uploading',
                  children: [
                    {
                      bid: 'uploading-action',
                      type: 'action',
                      object: '$sobj_base',
                      action: {
                        name: 'consoleLog',
                        params: [
                          {
                            name: 'info',
                            type: 'Formula',
                            value: {
                              code: 'cbParams.progress',
                              str: [
                                null,
                                null,
                                {
                                  type: 'cbParams',
                                  obj: 'uploaded file',
                                  props: ['progress'],
                                },
                              ],
                            },
                          },
                          { name: 'detail', type: 'Formula', value: null },
                        ],
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson });
  let uploadAction;
  const pending = [v5CaseJson];
  while (pending.length && !uploadAction) {
    const item = pending.pop();
    if (!item || typeof item !== 'object') continue;
    if (item.ln === 'upload-action') {
      uploadAction = item;
      break;
    }
    pending.push(...(Array.isArray(item) ? item : Object.values(item)));
  }

  assert.ok(uploadAction);
  const methodArgs = uploadAction.args[0].args[1].args;
  const uploadingCb = methodArgs.find(item => item.key === 'uploadingCb');
  assert.equal(uploadingCb?.op, 'alambda');
  assert.deepEqual(uploadingCb?.val, ['param']);
  assert.match(JSON.stringify(uploadingCb), /uploading-action/);
});

test('legacy editor formulas repair only a tokenized surplus trailing parenthesis', () => {
  ensureIvxMapNodeEnv();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson: buildV4CaseJson() }));
  try {
    const repaired = convertEditorValue({
      value: {
        _code:
          "$sys.util.getSelf($sys.util.objArr_rowItem($refs.txt1.p_value, 0)) ? 'selected' : 'idle'",
        code:
          "$refs.txt1.p_value.$SF_objArr_rowItem($P_row:0).$SF_getSelf() ? 'selected' : 'idle')",
        str: [
          {
            type: 'str',
            obj:
              "$refs.txt1.p_value.$SF_objArr_rowItem($P_row:0).$SF_getSelf() ? 'selected' : 'idle'",
          },
          { type: 'str', obj: ')' },
        ],
      },
      nodeId: 'txt1',
    });
    assert.equal(repaired.op, 'switchexp');
    assert.deepEqual(repaired.args[1], { op: 'val', val: 'selected' });
    assert.deepEqual(repaired.args[3], { op: 'val', val: 'idle' });

    const withoutRuntimeCode = convertEditorValue({
      value: {
        code:
          "$refs.txt1.p_value.$SF_objArr_rowItem($P_row:0).$SF_getSelf() ? 'selected' : 'idle')",
        str: [
          {
            type: 'str',
            obj:
              "$refs.txt1.p_value.$SF_objArr_rowItem($P_row:0).$SF_getSelf() ? 'selected' : 'idle'",
          },
          { type: 'str', obj: ')' },
        ],
      },
      nodeId: 'txt1',
    });
    assert.deepEqual(withoutRuntimeCode, { op: 'val' });

    const realBracket = convertEditorValue({
      value: {
        _code:
          "$sys.util.getSelf($sys.util.objArr_rowItem($refs.txt1.p_value, 0)) ? 'selected' : 'idle'",
        code:
          "$refs.txt1.p_value.$SF_objArr_rowItem($P_row:0).$SF_getSelf() ? 'selected' : 'idle')",
        str: [
          {
            type: 'str',
            obj:
              "$refs.txt1.p_value.$SF_objArr_rowItem($P_row:0).$SF_getSelf() ? 'selected' : 'idle'",
          },
          { type: 'bracket', obj: ')' },
        ],
      },
      nodeId: 'txt1',
    });
    assert.deepEqual(realBracket, { op: 'val' });
  } finally {
    clearActiveEnv();
  }
});

test('legacy current-path placeholders resolve to the target value AST', () => {
  ensureIvxMapNodeEnv();
  const jsonFormula = { code: '$curJsonPathValue.concat(["next"])' };
  const customJsonFormula = { code: '$curJsonPathValue+1' };
  const arrFormula = { code: '$curPathValue+1' };
  const rowColFormula = { code: '$curPathValue*2' };
  const rowValueFormula = { code: '$curRowValue.buttonText' };
  const v4CaseJson = buildV4CaseJson();
  v4CaseJson.stage.children.push(
    {
      id: 'json-var',
      type: 'data-obj-json',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
    },
    {
      id: 'arr-var',
      type: 'data-arr',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
    },
    {
      id: 'obj-arr-var',
      type: 'data-obj-arr',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
    },
    {
      id: 'path-trigger',
      type: 'ih5-text',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
      events: {
        list: [
          {
            tree: {
              bid: 'path-root',
              type: 'root',
              children: [
                {
                  bid: 'json-path-action',
                  type: 'action',
                  object: 'json-var',
                  action: {
                    name: 'setPathValue',
                    params: [
                      {
                        name: 'path',
                        type: 'ObjJsonParamsSelect',
                        value: [
                          { name: 'items', jType: 'array' },
                          { name: '_jArrValue', jType: 'jsonEnd' },
                        ],
                      },
                      { name: 'value', type: 'Formula', value: jsonFormula },
                    ],
                  },
                  children: [],
                },
                {
                  bid: 'arr-path-action',
                  type: 'action',
                  object: 'arr-var',
                  action: {
                    name: 'setOneValue',
                    params: [
                      {
                        name: 'index',
                        type: 'Formula',
                        value: { code: '1' },
                      },
                      { name: 'value', type: 'Formula', value: arrFormula },
                    ],
                  },
                  children: [],
                },
                {
                  bid: 'custom-json-path-action',
                  type: 'action',
                  object: 'json-var',
                  action: {
                    name: 'setCusPathValue',
                    params: [
                      {
                        name: 'path',
                        type: 'Formula',
                        value: { code: `'["a.b"][0]'` },
                      },
                      {
                        name: 'value',
                        type: 'Formula',
                        value: customJsonFormula,
                      },
                    ],
                  },
                  children: [],
                },
                {
                  bid: 'row-col-path-action',
                  type: 'action',
                  object: 'obj-arr-var',
                  action: {
                    name: 'setRowColsValue',
                    params: [
                      {
                        name: 'row',
                        type: 'Formula',
                        value: { code: '2' },
                      },
                      {
                        name: 'colValue',
                        type: 'ArrColValue',
                        value: [
                          {
                            col: { code: '"score"' },
                            value: rowColFormula,
                          },
                          {
                            col: { code: '"enabled"' },
                            value: rowValueFormula,
                          },
                        ],
                      },
                    ],
                  },
                  children: [],
                },
              ],
            },
          },
        ],
      },
    },
  );

  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));
  try {
    const cases = [
      {
        ast: convertEditorValue({
          value: jsonFormula,
          nodeId: 'path-trigger',
          blockId: 'json-path-action',
        }),
        targetId: 'json-var',
        pathValues: ['items'],
      },
      {
        ast: convertEditorValue({
          value: arrFormula,
          nodeId: 'path-trigger',
          blockId: 'arr-path-action',
        }),
        targetId: 'arr-var',
        pathValues: [1],
      },
      {
        ast: convertEditorValue({
          value: rowColFormula,
          nodeId: 'path-trigger',
          blockId: 'row-col-path-action',
        }),
        targetId: 'obj-arr-var',
        pathValues: [2, 'score'],
      },
      {
        ast: convertEditorValue({
          value: rowValueFormula,
          nodeId: 'path-trigger',
          blockId: 'row-col-path-action',
        }),
        targetId: 'obj-arr-var',
        pathValues: [2, 'buttonText'],
        absentPathValues: ['enabled'],
      },
    ];

    for (const item of cases) {
      const serialized = JSON.stringify(item.ast);
      assert.doesNotMatch(serialized, /\$cur(?:Json)?PathValue/);
      assert.match(serialized, new RegExp(`"var","${item.targetId}"`));
      assert.match(serialized, /"field","val":"value"/);
      for (const pathValue of item.pathValues) {
        assert.match(serialized, new RegExp(`"val":${JSON.stringify(pathValue)}`));
      }
      for (const pathValue of item.absentPathValues || []) {
        assert.doesNotMatch(
          serialized,
          new RegExp(`"val":${JSON.stringify(pathValue)}`),
        );
      }
    }

    const customPathAst = convertEditorValue({
      value: customJsonFormula,
      nodeId: 'path-trigger',
      blockId: 'custom-json-path-action',
    });
    let dynamicPathJsfn;
    const pending = [customPathAst];
    while (pending.length && !dynamicPathJsfn) {
      const item = pending.pop();
      if (!item || typeof item !== 'object') continue;
      if (item.op === 'jsfn' && item.val?.[0]?.includes('new Function')) {
        dynamicPathJsfn = item;
        break;
      }
      pending.push(...(Array.isArray(item) ? item : Object.values(item)));
    }
    assert.ok(dynamicPathJsfn);
    assert.doesNotMatch(JSON.stringify(customPathAst), /\$curJsonPathValue/);
    const evaluateDynamicPath = new Function(
      ...dynamicPathJsfn.val.slice(1),
      `return (${dynamicPathJsfn.val[0]});`,
    );
    assert.equal(
      evaluateDynamicPath({ 'a.b': [41] }, '["a.b"][0]'),
      41,
    );
  } finally {
    clearActiveEnv();
  }
});

test('legacy condition values use V4.1 literals and preserve formulas', () => {
  const v4CaseJson = buildV4CaseJson();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));
  const condition = (code, operator = 'equal') =>
    genConObj({
      conItem: {
        value1: { code: '1' },
        value2: { code },
        operator,
      },
      scope: 'stage',
      nodeId: 'txt1',
      blockId: 'legacy-v41-condition',
    });

  try {
    assert.deepEqual(condition('domain not registered').args[1], {
      op: 'val',
      val: 'domain not registered',
    });
    assert.deepEqual(condition('www.ivx.cn', 'include').args[1], {
      op: 'val',
      val: 'www.ivx.cn',
    });
    assert.deepEqual(condition('domain not registered', 'greater').args[1], {
      op: 'val',
      val: 'domain not registered',
    });

    const refAst = condition('$refs.txt1.p_value').args[1];
    assert.equal(refAst.op, 'var');

    const expressionAst = condition('window.location.href', 'include').args[1];
    assert.notDeepEqual(expressionAst, {
      op: 'val',
      val: 'window.location.href',
    });

    const typeSentinelAst = condition('$valid_Null').args[1];
    assert.notDeepEqual(typeSentinelAst, {
      op: 'val',
      val: '$valid_Null',
    });
  } finally {
    clearActiveEnv();
  }
});

test('block conditions treat a leading OR flag as the first branch', () => {
  const v4CaseJson = buildV4CaseJson();
  setActiveEnv(createV4ConvertEnv({ v4CaseJson }));

  const makeCondition = (index, flag) => ({
    enable: true,
    flag,
    operator: 'equal',
    value1: { code: JSON.stringify(`left-${index}`) },
    value2: { code: JSON.stringify(`right-${index}`) },
  });

  try {
    for (const count of [2, 5]) {
      const ast = convertBlockCons({
        cons: Array.from({ length: count }, (_, index) =>
          makeCondition(index, 'or')),
        scope: 'stage',
        nodeId: 'txt1',
        blockId: `leading-or-${count}`,
      });

      assert.equal(ast.op, 'or');
      assert.equal(ast.args.length, count);
      ast.args.forEach((branch, index) => {
        assert.deepEqual(branch, {
          op: '=',
          args: [
            { op: 'val', val: `left-${index}` },
            { op: 'val', val: `right-${index}` },
          ],
        });
      });
    }

    const mixedAst = convertBlockCons({
      cons: [
        makeCondition(0, 'and'),
        makeCondition(1, 'and'),
        makeCondition(2, 'or'),
        makeCondition(3, 'and'),
      ],
      scope: 'stage',
      nodeId: 'txt1',
      blockId: 'mixed-and-or',
    });
    assert.equal(mixedAst.op, 'or');
    assert.deepEqual(mixedAst.args.map(branch => [branch.op, branch.args.length]), [
      ['and', 2],
      ['and', 2],
    ]);
  } finally {
    clearActiveEnv();
  }
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
