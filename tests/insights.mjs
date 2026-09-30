import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const output = mkdtempSync(join(tmpdir(), 'voc-insights-'))
try {
  execFileSync('./node_modules/.bin/tsc', ['src/insights.ts', 'src/types.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck'])
  const { scopedReviews, previousScope, measureSignal, compareSignal, emptyScope } = createRequire(import.meta.url)(join(output, 'insights.js'))
  const scope = { ...emptyScope, start: '2026-09-01', end: '2026-09-30', topic: 'sizing' }
  const review = (id, date, excluded = false, sentiment = 'Negative') => ({ id, feedback_at: date + 'T12:00:00Z', voice_source: 'Store', annotation: { cluster_id: 'sizing', excluded_from_clustering: excluded, sentiment, brand: 'Brand' } })
  const records = Array.from({ length: 6 }, (_, i) => review('r' + i, '2026-09-01'))
  records.push(review('excluded', '2026-09-02', true), review('outside', '2026-08-31'))
  assert.equal(scopedReviews(records, scope).length, 6)
  assert.equal(scopedReviews(records, { ...scope, topic: '' }).length, 7)
  assert.equal(scopedReviews(records, { ...scope, brand: 'Other' }).length, 0)
  assert.equal(scopedReviews(records, { ...scope, start: '' }).length, 0)
  assert.equal(previousScope(scope).start, '2026-08-02')
  assert.equal(previousScope(scope).end, '2026-08-31')
  assert.equal(measureSignal([], scope, 'Issue count').value, null)
  assert.equal(measureSignal(records, scope, 'Negative / mixed share').value, 100)
  assert.equal(measureSignal(records, scope, 'Manual measure').value, null)
  assert.deepEqual(measureSignal(records, scope, 'Issue count').evidence_ids, records.slice(0, 6).map(r => r.id))
  assert.equal(compareSignal({ value: 10, denominator: 10 }, { value: 5, denominator: 5 }).label, 'Improved')
  assert.equal(compareSignal({ value: 10, denominator: 10 }, { value: 0, denominator: 0 }).label, 'Insufficient evidence')
  assert.equal(compareSignal({ value: 0, denominator: 5 }, { value: 1, denominator: 5 }).relative, null)
  assert.equal(compareSignal({ value: 5, denominator: 5 }, { value: 5, denominator: 5 }).label, 'Unchanged')
  console.log('Insights checks passed: scopes, exclusions, windows, evidence, metrics and comparison limits.')
} finally { rmSync(output, { recursive: true, force: true }) }
