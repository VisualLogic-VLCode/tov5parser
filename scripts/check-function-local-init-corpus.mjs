import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  convertV4CaseJsonToV5CaseJsonDetailed,
  loadRuntimeMaps
} from '../index.js'
import { resolveFunctionLocalInit } from '../v4ToV5/utils/functionLocalInit.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDir, '..')
const corpusRoot = path.resolve(
  process.argv[2] || path.join(repositoryRoot, 'localCases/v4')
)
const frpPath = path.resolve(
  process.argv[3] || path.join(corpusRoot, 'clothing/frp-pad/app.json')
)

function collectAppJsonFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) collectAppJsonFiles(target, result)
    else if (entry.name === 'app.json') result.push(target)
  }
  return result
}

function walkCaseNodes(caseJson, visitor) {
  const walk = node => {
    if (!node || typeof node !== 'object') return
    visitor(node)
    for (const child of node.children || []) walk(child)
    for (const child of node.classes || []) walk(child)
  }
  for (const key of ['case', 'stage', 'server']) walk(caseJson?.[key])
}

function hasExpectedWrapperCarrier(owner, event) {
  const prefix = `var _${owner.id}_localVarInit=false;`
  return [
    event?._code,
    event?.code,
    owner?.props?._code,
    owner?.props?.code
  ].some(code => typeof code === 'string' && code.startsWith(prefix))
}

function collectSourceExpectations({ caseJson, file }) {
  const expectations = []
  const missingWrappers = []
  const validationFailures = []
  let noopStatementCount = 0
  let undefinedPropsMismatchCount = 0

  walkCaseNodes(caseJson, owner => {
    for (const event of owner.events?.list || []) {
      const result = resolveFunctionLocalInit({
        owner,
        event,
        genId: () => 'corpus-reset'
      })
      if (!result.applicable) continue
      if (!result.ok) {
        const failure = {
          file,
          ownerId: owner.id,
          rootBlockId: event?.tree?.bid,
          code: result.error.code,
          affectedNodeIds: result.directChildIds
        }
        if (
          result.error.code === 'WRAPPER_MISSING' &&
          !hasExpectedWrapperCarrier(owner, event)
        ) {
          missingWrappers.push(failure)
        } else {
          validationFailures.push(failure)
        }
        continue
      }
      noopStatementCount += (result.statements || []).filter(
        entry => entry.isNoop
      ).length
      const directChildren = new Map(
        (owner.children || []).map(child => [child.id, child])
      )
      undefinedPropsMismatchCount += result.entries.filter(
        entry =>
          entry.isUndefined && directChildren.get(entry.id)?.props?.value === ''
      ).length
      expectations.push({
        ownerId: owner.id,
        rootBlockId: event.tree.bid,
        entries: result.entries,
        prelude: result.prelude
      })
    }
  })
  return {
    expectations,
    missingWrappers,
    validationFailures,
    noopStatementCount,
    undefinedPropsMismatchCount
  }
}

function verifyMaterializedPreludes({ expectations, file }) {
  let resetCount = 0
  for (const expectation of expectations) {
    assert.equal(
      expectation.prelude.length,
      expectation.entries.length,
      `${file}: incomplete materialized prelude for ${expectation.ownerId}`
    )
    expectation.entries.forEach((entry, index) => {
      const ast = expectation.prelude[index]
      assert.deepEqual(ast?.args?.[0]?.val, ['var', entry.id], file)
      assert.equal(ast?.args?.[1]?.val, 'setValue', file)
      assert.equal(ast?.args?.[1]?.args?.length, 1, file)
      const valueAst = ast.args[1].args[0]
      if (entry.isUndefined) assert.deepEqual(valueAst, { op: 'val' }, file)
      else assert.deepEqual(valueAst, { op: 'val', val: entry.value }, file)
    })
    resetCount += expectation.prelude.length
  }
  return resetCount
}

function scanOne(file) {
  const caseJson = JSON.parse(fs.readFileSync(file, 'utf8'))
  const source = collectSourceExpectations({ caseJson, file })
  const materializedResetCount = verifyMaterializedPreludes({
    expectations: source.expectations,
    file
  })
  return {
    wrapperCount: source.expectations.length,
    resetCount: source.expectations.reduce(
      (total, item) => total + item.entries.length,
      0
    ),
    materializedResetCount,
    noopStatementCount: source.noopStatementCount,
    undefinedPropsMismatchCount: source.undefinedPropsMismatchCount,
    missingWrappers: source.missingWrappers,
    validationFailures: source.validationFailures
  }
}

function verifyConvertedFrp({ caseJson, expectations, file }) {
  loadRuntimeMaps()
  const conversion = convertV4CaseJsonToV5CaseJsonDetailed({
    v4CaseJson: caseJson
  })
  const targetNodes = new Map()
  walkCaseNodes(conversion.v5CaseJson, node => targetNodes.set(node.id, node))
  let resetCount = 0

  for (const expectation of expectations) {
    const owner = targetNodes.get(expectation.ownerId)
    const event = owner?.events?.list?.find(
      item => item.eventId === expectation.rootBlockId
    )
    assert.ok(
      event,
      `${file}: converted event ${expectation.rootBlockId} is missing`
    )
    const prefix = event.ast?.args?.slice(0, expectation.entries.length)
    assert.equal(
      prefix?.length,
      expectation.entries.length,
      `${file}: converted prelude is incomplete for ${expectation.ownerId}`
    )
    expectation.entries.forEach((entry, index) => {
      const ast = prefix[index]
      assert.deepEqual(ast?.args?.[0]?.val, ['var', entry.id], file)
      assert.equal(ast?.args?.[1]?.val, 'setValue', file)
      const valueAst = ast?.args?.[1]?.args?.[0]
      if (entry.isUndefined) assert.deepEqual(valueAst, { op: 'val' }, file)
      else assert.deepEqual(valueAst, { op: 'val', val: entry.value }, file)
    })
    resetCount += expectation.entries.length
  }

  return {
    resetCount,
    lifecycleDiagnosticCount: conversion.diagnostics.records.filter(
      item => item.phase === 'function-local-init'
    ).length
  }
}

const files = collectAppJsonFiles(corpusRoot).sort()
const totals = {
  fileCount: files.length,
  wrapperCount: 0,
  resetCount: 0,
  materializedResetCount: 0,
  noopStatementCount: 0,
  undefinedPropsMismatchCount: 0,
  missingWrappers: [],
  validationFailures: []
}
for (const file of files) {
  const result = scanOne(file)
  totals.wrapperCount += result.wrapperCount
  totals.resetCount += result.resetCount
  totals.materializedResetCount += result.materializedResetCount
  totals.noopStatementCount += result.noopStatementCount
  totals.undefinedPropsMismatchCount += result.undefinedPropsMismatchCount
  totals.missingWrappers.push(...result.missingWrappers)
  totals.validationFailures.push(...result.validationFailures)
}

const frpCaseJson = JSON.parse(fs.readFileSync(frpPath, 'utf8'))
const frpSource = collectSourceExpectations({
  caseJson: frpCaseJson,
  file: frpPath
})
const frp = scanOne(frpPath)
const convertedFrp = verifyConvertedFrp({
  caseJson: frpCaseJson,
  expectations: frpSource.expectations,
  file: frpPath
})
const summary = {
  corpusRoot,
  ...totals,
  missingWrapperCount: totals.missingWrappers.length,
  validationFailureCount: totals.validationFailures.length,
  frp: {
    file: frpPath,
    wrapperCount: frp.wrapperCount,
    resetCount: frp.resetCount,
    noopStatementCount: frp.noopStatementCount,
    undefinedPropsMismatchCount: frp.undefinedPropsMismatchCount,
    missingWrapperCount: frp.missingWrappers.length,
    validationFailureCount: frp.validationFailures.length,
    convertedResetCount: convertedFrp.resetCount,
    lifecycleDiagnosticCount: convertedFrp.lifecycleDiagnosticCount
  }
}

console.log(JSON.stringify(summary, null, 2))

assert.equal(summary.fileCount, 72)
assert.equal(summary.wrapperCount, 3949)
assert.equal(summary.resetCount, 11052)
assert.equal(summary.materializedResetCount, 11052)
assert.equal(summary.undefinedPropsMismatchCount, 76)
assert.equal(summary.validationFailureCount, 0)
assert.equal(summary.frp.wrapperCount, 356)
assert.equal(summary.frp.resetCount, 1244)
assert.equal(summary.frp.undefinedPropsMismatchCount, 15)
assert.equal(summary.frp.validationFailureCount, 0)
assert.equal(summary.frp.convertedResetCount, 1244)
assert.equal(summary.frp.lifecycleDiagnosticCount, 0)
