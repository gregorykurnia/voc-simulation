import type { ReviewRecord } from './types'

export const MIN_EVIDENCE = 5
export interface InsightScope {
  start: string; end: string; brand: string; product: string; issue: string; topic: string; store: string; source: string; sentiment: string
}
export const emptyScope: InsightScope = { start: '', end: '', brand: '', product: '', issue: '', topic: '', store: '', source: '', sentiment: '' }
const DAY = 86400000
export function validWindow(scope: InsightScope) {
  return Boolean(scope.start && scope.end && Number.isFinite(Date.parse(scope.start)) && Number.isFinite(Date.parse(scope.end)) && scope.start <= scope.end)
}
export function previousScope(scope: InsightScope): InsightScope {
  if (!validWindow(scope)) return { ...scope, start: '', end: '' }
  const start = Date.parse(scope.start), length = Date.parse(scope.end) - start + DAY
  return { ...scope, start: new Date(start - length).toISOString().slice(0, 10), end: new Date(start - DAY).toISOString().slice(0, 10) }
}
export function scopedReviews(reviews: ReviewRecord[], scope: InsightScope) {
  if (!validWindow(scope)) return []
  return reviews.filter(r => {
    const a = r.annotation, date = r.feedback_at.slice(0, 10)
    return a && date >= scope.start && date <= scope.end &&
      (!scope.brand || a.brand === scope.brand) && (!scope.product || a.product_category === scope.product) &&
      (!scope.issue || a.issue_type === scope.issue) && (!scope.topic || (!a.excluded_from_clustering && a.cluster_id === scope.topic)) &&
      (!scope.store || a.store_id === scope.store) && (!scope.source || r.voice_source === scope.source) && (!scope.sentiment || a.sentiment === scope.sentiment)
  })
}
export function negativeCount(reviews: ReviewRecord[]) { return reviews.filter(r => ['Negative', 'Mixed'].includes(r.annotation!.sentiment)).length }
export function sentimentCounts(reviews: ReviewRecord[]) {
  return ['Positive', 'Neutral', 'Mixed', 'Negative'].map(label => ({ label, count: reviews.filter(r => r.annotation?.sentiment === label).length }))
}

export function measureSignal(reviews: ReviewRecord[], scope: InsightScope, metric: string) {
  const members = scopedReviews(reviews, scope)
  return { start: scope.start, end: scope.end, value: metric === 'Manual measure' || !members.length ? null : metric === 'Issue count' ? members.length : negativeCount(members) / members.length * 100, denominator: members.length, evidence_ids: members.map(r => r.id) }
}
export function compareSignal(baseline: { value: number | null; denominator: number }, followup: { value: number | null; denominator: number }) {
  if (baseline.value === null || followup.value === null || baseline.denominator < MIN_EVIDENCE || followup.denominator < MIN_EVIDENCE) return { label: 'Insufficient evidence', absolute: null, relative: null }
  const absolute = followup.value - baseline.value
  return { label: Math.abs(absolute) < 0.000001 ? 'Unchanged' : absolute < 0 ? 'Improved' : 'Worsened', absolute, relative: baseline.value ? absolute / baseline.value * 100 : null }
}
