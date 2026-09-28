import type { ProcessingStatus } from '../types'

export function StatusPill({ status, compact = false }: { status: ProcessingStatus; compact?: boolean }) {
  const style = status.toLowerCase().replace(/\s+/g, '-')
  return <span className={`status-pill status-${style}${compact ? ' status-compact' : ''}`}><span className="status-dot" />{status}</span>
}

export function ReviewState({ state }: { state: string }) {
  const tone = state === 'Validated' ? 'validated' : state === 'Needs clarification' ? 'needs-review' : 'not-reviewed'
  return <span className={`review-state review-state-${tone}`}><span className="state-mark">{state === 'Validated' ? '✓' : state === 'Needs clarification' ? '!' : '·'}</span>{state}</span>
}
