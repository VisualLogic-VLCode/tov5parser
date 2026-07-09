import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './lambdaIndex.js';

function makeV4CaseJson() {
  return {
    case: { id: 'case1', type: 'case', uis: { name: 'LambdaCase' }, props: {} },
    stage: {
      id: 'stage1',
      type: 'ih5-stage',
      rootId: 'stage1',
      uis: {},
      props: {},
      children: [],
    },
    server: {
      id: 'server1',
      type: 'system-server',
      rootId: 'server1',
      uis: {},
      props: {},
      children: [],
    },
  };
}

async function invoke(body) {
  const response = await handler({
    headers: {},
    body: JSON.stringify(body),
  });
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

test('handler reports version info', async () => {
  const payload = await invoke({ action: 'version' });
  assert.equal(payload.code, 0);
  assert.equal(payload.data.packageName, '@visuallogic-vlcode/tov5parser');
  assert.ok(payload.data.packageVersion);
});

test('handler converts v4 case json', async () => {
  const payload = await invoke({
    action: 'convertV4ToV5',
    v4CaseJson: makeV4CaseJson(),
  });
  assert.equal(payload.code, 0);
  assert.equal(payload.message, 'success');
  assert.equal(payload.data.v5CaseJson.case.uis.name, 'LambdaCase_5.0');
});

test('handler validates input and action', async () => {
  const invalidInput = await invoke({ action: 'convertV4ToV5' });
  assert.equal(invalidInput.code, 10001);
  assert.match(invalidInput.message, /v4CaseJson/);

  const unknownAction = await invoke({ action: 'nope' });
  assert.equal(unknownAction.code, 10001);
  assert.match(unknownAction.message, /not support/);

  const emptyAction = await invoke({});
  assert.equal(emptyAction.code, 10001);
  assert.match(emptyAction.message, /action is empty/);
});

test('handler supports direct-invoke event shape', async () => {
  const response = await handler({
    action: 'convertV4ToV5',
    v4CaseJson: makeV4CaseJson(),
  });
  const payload = JSON.parse(response.body);
  assert.equal(payload.code, 0);
  assert.equal(payload.data.v5CaseJson.case.uis.name, 'LambdaCase_5.0');
});

test('handler validates s3 transfer key without touching network', async () => {
  const badKey = await invoke({
    action: 'convertV4ToV5',
    v4CaseJsonS3Key: 'lambda-packages/latest.zip',
  });
  assert.equal(badKey.code, 10001);
  assert.match(badKey.message, /transfer\/in\//);

  const traversal = await invoke({
    action: 'convertV4ToV5',
    v4CaseJsonS3Key: 'transfer/in/../x.json',
  });
  assert.equal(traversal.code, 10001);
});
