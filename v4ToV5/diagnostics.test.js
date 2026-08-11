import assert from 'node:assert/strict'
import test from 'node:test'
import { buildConversionDiagnostics } from './diagnostics.js'

function sourceCase() {
  return {
    case: { id: 'case', type: 'case', children: [] },
    stage: {
      id: 'stage',
      type: 'stage',
      children: [
        {
          id: 'text',
          type: 'ih5-text',
          uis: { name: 'Text' },
          children: [],
          events: {
            list: [
              {
                tree: {
                  bid: 'root-block',
                  type: 'root',
                  children: [
                    {
                      bid: 'action-block',
                      type: 'action',
                      action: { name: 'setValue' },
                      children: []
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    server: { id: 'server', type: 'server', children: [] }
  }
}

test('conversion diagnostics are versioned, grouped, enriched, and bounded', () => {
  const repeated = {
    phase: 'custom-expr-fallback',
    errorName: 'ParseError',
    errorType: 'MemberExpression',
    message: 'fallback at character 12',
    nodeId: 'text',
    blockId: 'action-block',
    actionParamName: 'value',
    scope: 'stage',
    code: '$refs.text.p_value'
  }
  const report = buildConversionDiagnostics({
    v4CaseJson: sourceCase(),
    records: [
      repeated,
      { ...repeated },
      {
        ...repeated,
        phase: 'ast-convert',
        message: 'not supported',
        code: 'x'.repeat(5000)
      }
    ],
    maxRecords: 1,
    maxCategories: 1
  })

  assert.equal(report.schemaVersion, 1)
  assert.equal(report.kind, 'tov5parser-conversion-diagnostics')
  assert.equal(report.summary.total, 3)
  assert.equal(report.summary.droppedTotal, 1)
  assert.equal(report.summary.customExprTotal, 2)
  assert.equal(report.summary.uniqueTotal, 2)
  assert.equal(report.summary.returnedRecordCount, 1)
  assert.equal(report.summary.truncated, true)
  assert.equal(report.summary.categoryTruncated, true)
  assert.equal(report.records[0].outcome, 'dropped')
  assert.equal(report.records[0].nodeName, 'Text')
  assert.equal(report.records[0].actionName, 'setValue')
  assert.equal(report.records[0].prop, 'value')
  assert.equal(report.records[0].code.endsWith('…'), true)
})
