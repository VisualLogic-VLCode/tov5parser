import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTransferKeys,
  isTransferInKey,
  deriveOutKey,
} from './s3Transfer.js';

test('makeTransferKeys generates paired transfer keys', () => {
  const { inKey, outKey } = makeTransferKeys();
  assert.match(inKey, /^transfer\/in\/[0-9]+-\w+\.v4\.json$/);
  assert.match(outKey, /^transfer\/out\/[0-9]+-\w+\.v5\.json$/);
  // 同一个 id
  assert.equal(
    inKey.slice('transfer/in/'.length, -'.v4.json'.length),
    outKey.slice('transfer/out/'.length, -'.v5.json'.length),
  );
  // 每次生成不重复
  assert.notEqual(makeTransferKeys().inKey, inKey);
});

test('isTransferInKey only accepts keys under transfer/in/', () => {
  assert.equal(isTransferInKey('transfer/in/abc.v4.json'), true);
  assert.equal(isTransferInKey('transfer/out/abc.v5.json'), false);
  assert.equal(isTransferInKey('lambda-packages/latest.zip'), false);
  assert.equal(isTransferInKey('transfer/in/'), false);
  assert.equal(isTransferInKey('transfer/in/../secret.json'), false);
  assert.equal(isTransferInKey(null), false);
  assert.equal(isTransferInKey(123), false);
});

test('deriveOutKey maps in-keys to out-keys', () => {
  assert.equal(
    deriveOutKey('transfer/in/123-abc.v4.json'),
    'transfer/out/123-abc.v5.json',
  );
  // 非标准命名也能得到 out-key
  assert.equal(
    deriveOutKey('transfer/in/custom.json'),
    'transfer/out/custom.json.v5.json',
  );
});
