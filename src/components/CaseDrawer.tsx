import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Clock3, FileText, LoaderCircle, MessageSquare, Plus, Send, ShieldCheck, Sparkles, StickyNote, X } from 'lucide-react'
import { addCaseMessage, listenCaseEvents, listenCaseMessages, slaPolicies, updateCustomerCase } from '../data/firestore'
import type { CaseEvent, CaseMessage, CaseStatus, CustomerCase, ReviewRecord } from '../types'
import { compactSource, formatDate } from '../utils'

interface Props {
  customerCase: CustomerCase
  cases: CustomerCase[]
  reviews: ReviewRecord[]
  userId: string
  onClose: () => void
  onOpenReview: (review: ReviewRecord) => void
  onSelectCase: (caseId: string) => void
}

const transitions: Record<CaseStatus, CaseStatus[]> = {
  'Needs triage': ['In review', 'Needs supervisor review'],
  'In review': ['In progress', 'Needs supervisor review'],
  'In progress': ['Pending customer', 'Pending internal / store', 'Needs supervisor review', 'Escalated'],
  'Pending customer': ['In progress', 'Needs supervisor review'],
  'Pending internal / store': ['In progress', 'Escalated', 'Needs supervisor review'],
  'Needs supervisor review': ['In progress', 'Pending internal / store', 'Escalated'],
  Escalated: ['In progress', 'Pending internal / store', 'Needs supervisor review'],
  Resolved: ['Reopened'],
  Closed: ['Reopened'],
  Reopened: ['In progress', 'Needs supervisor review'],
}

const teams = ['Customer Service', 'Store Operations', 'Logistics', 'Product Team', 'Finance', 'Technology']

export function CaseDrawer({ customerCase, cases, reviews, userId, onClose, onOpenReview, onSelectCase }: Props) {
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [responseDraft, setResponseDraft] = useState(customerCase.ai_triage.response_draft)
  const [linkReviewId, setLinkReviewId] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const stopEvents = listenCaseEvents(customerCase.id, setEvents, (err) => setError(err.message))
    const stopMessages = listenCaseMessages(customerCase.id, setMessages, (err) => setError(err.message))
    return () => { stopEvents(); stopMessages() }
  }, [customerCase.id])

  useEffect(() => {
    setNoteDraft('')
    setResponseDraft(customerCase.ai_triage.response_draft)
    setError('')
  }, [customerCase.id, customerCase.ai_triage.response_draft])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const linkedReviews = customerCase.review_ids.map((id) => reviews.find((review) => review.id === id)).filter((item): item is ReviewRecord => Boolean(item))
  const availableReviews = reviews.filter((review) => !customerCase.review_ids.includes(review.id))
  const relatedCases = useMemo(() => cases
    .filter((item) => item.id !== customerCase.id && (item.issue_type === customerCase.issue_type || (customerCase.brand && item.brand === customerCase.brand)))
    .slice(0, 5), [cases, customerCase.id, customerCase.issue_type, customerCase.brand])
  const timeline = [
    ...events.filter((event) => !['Note', 'Customer notification'].includes(event.type)).map((event) => ({
      id: event.id,
      kind: event.type,
      title: event.summary,
      body: '',
      channel: '',
      created_at: event.created_at,
      direction: 'event' as const,
    })),
    ...messages.map((message) => ({
      id: message.id,
      kind: message.direction,
      title: message.direction === 'Inbound' ? 'Customer message' : message.direction === 'Outbound' ? 'Customer response' : 'Internal note',
      body: message.body,
      channel: message.channel,
      created_at: message.created_at,
      direction: 'message' as const,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const policy = slaPolicies.find((item) => item.id === customerCase.sla_policy_id)
  const paused = policy?.pause_statuses.includes(customerCase.status) ?? false
  const slaDeadline = customerCase.first_response_at ? customerCase.resolution_due_at : customerCase.first_response_due_at
  const slaRemaining = new Date(slaDeadline).getTime() - Date.now()
  const nextStatuses = transitions[customerCase.status]

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusyAction(key)
    setError('')
    try { await action() }
    catch (err) { setError(err instanceof Error ? err.message : 'The case update could not be saved.') }
    finally { setBusyAction('') }
  }
  const changeStatus = (status: CaseStatus) => {
    const reopened = status === 'Reopened'
    void runAction('status', () => updateCustomerCase(
      customerCase.id,
      { status, ...(reopened ? { resolved_at: null, closed_at: null, resolution: customerCase.resolution ? { ...customerCase.resolution, reopen_reason: 'Customer or agent requested follow-up.' } : null } : {}) },
      userId,
      reopened ? 'Reopened' : 'Status change',
      reopened ? 'Case reopened and returned for follow-up' : `Status changed to ${status}`,
    ))
  }
  const changeTeam = (ownerTeam: string) => void runAction('team', () => updateCustomerCase(customerCase.id, { owner_team: ownerTeam }, userId, 'Assignment', `Assigned to ${ownerTeam}`))
  const changeOwner = (ownerUserId: string | null) => void runAction('owner', () => updateCustomerCase(customerCase.id, { owner_user_id: ownerUserId }, userId, 'Assignment', ownerUserId ? 'Assigned to current agent' : 'Ownership cleared'))
  const addNote = () => {
    if (!noteDraft.trim()) return
    const body = noteDraft.trim()
    void runAction('note', async () => { await addCaseMessage(customerCase.id, body, 'Internal note', 'Internal', userId); setNoteDraft('') })
  }
  const recordResponse = () => {
    if (!responseDraft.trim()) return
    const body = responseDraft.trim()
    void runAction('response', async () => { await addCaseMessage(customerCase.id, body, 'Outbound', compactSource(customerCase.source_channel), userId, !customerCase.first_response_at); setResponseDraft('') })
  }
  const linkReview = () => {
    if (!linkReviewId || customerCase.review_ids.includes(linkReviewId)) return
    const linked = reviews.find((item) => item.id === linkReviewId)
    if (!linked) return
    void runAction('link', async () => {
      await updateCustomerCase(customerCase.id, { review_ids: [...customerCase.review_ids, linked.id] }, userId, 'Evidence linked', `Linked review ${linked.id}`)
      setLinkReviewId('')
    })
  }

  return <div className="drawer-scrim case-drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="review-drawer case-drawer" role="dialog" aria-modal="true" aria-labelledby="case-drawer-title">
      <header className="drawer-header case-drawer-header"><div><span className="drawer-eyebrow">CUSTOMER SERVICE CASE</span><h2 id="case-drawer-title">{customerCase.id}</h2></div><div className="case-header-actions"><span className={`case-priority priority-${customerCase.priority.toLowerCase()}`}>{customerCase.priority}</span><span className={`case-status status-${slug(customerCase.status)}`}>{customerCase.status}</span><button className="icon-button drawer-close" onClick={onClose} aria-label="Close case details"><X size={18} /></button></div></header>
      <div className="drawer-content">
        <section className="drawer-section case-detail-overview">
          <h3>{customerCase.subject}</h3>
          <div className="case-detail-meta"><span><Clock3 size={13} />{paused ? 'SLA paused' : slaRemaining <= 0 ? 'SLA breached' : `${formatRemaining(slaRemaining)} to ${customerCase.first_response_at ? 'resolution' : 'first response'}`}</span><span>Opened {formatDate(customerCase.created_at, true)}</span><span>Updated {formatDate(customerCase.last_activity_at, true)}</span></div>
          <div className="case-assignment-controls">
            <label><span>Assigned agent</span><select value={customerCase.owner_user_id ?? ''} disabled={busyAction === 'owner'} onChange={(event) => changeOwner(event.target.value || null)}><option value="">Unassigned</option><option value={userId}>You · {userId === 'browser-demo' ? 'Demo agent' : 'Current agent'}</option></select></label>
            <label><span>Assigned team</span><select value={customerCase.owner_team} disabled={busyAction === 'team'} onChange={(event) => changeTeam(event.target.value)}>{[...new Set([...teams, customerCase.owner_team])].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <div className="case-transition-row"><label><span>Move case to</span><select value="" disabled={!nextStatuses.length || busyAction === 'status'} onChange={(event) => { if (event.target.value) changeStatus(event.target.value as CaseStatus) }}><option value="">Choose next status…</option>{nextStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><span>Changes are recorded in the case history.</span></div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-title"><h3>Customer evidence</h3><span className="cluster-context-count">{customerCase.review_ids.length} linked</span></div>
          {linkedReviews.map((review) => <article className="case-evidence-card" key={review.id}>
            <div className="case-evidence-top"><button className="evidence-link" onClick={() => { onClose(); onOpenReview(review) }}><FileText size={13} />{review.id}</button><span>{compactSource(review.voice_source)} · {formatDate(review.feedback_at, true)}</span></div>
            <blockquote>“{review.raw_text}”</blockquote>
          </article>)}
          {!linkedReviews.length && <p className="case-no-evidence">The linked review record is unavailable.</p>}
          {availableReviews.length > 0 && <div className="link-evidence-control"><select aria-label="Select review to link" value={linkReviewId} onChange={(event) => setLinkReviewId(event.target.value)}><option value="">Link another review…</option>{availableReviews.map((review) => <option key={review.id} value={review.id}>{review.id} · {compactSource(review.voice_source)} · {review.raw_text.slice(0, 58)}</option>)}</select><button className="icon-button" aria-label="Link selected review" disabled={!linkReviewId || busyAction === 'link'} onClick={linkReview}><Plus size={16} /></button></div>}
        </section>

        <section className="drawer-section case-ai-section">
          <div className="drawer-section-title"><h3><Sparkles size={14} /> AI triage recommendation</h3><span className={`confidence-badge ${customerCase.ai_triage.confidence < 0.69 ? 'low' : ''}`}>{Math.round(customerCase.ai_triage.confidence * 100)}% confidence</span></div>
          <p className="case-ai-explanation">{customerCase.ai_triage.explanation}</p>
          <div className="case-ai-grid"><CaseDatum label="Intent" value={customerCase.ai_triage.intent} /><CaseDatum label="Issue type" value={customerCase.ai_triage.issue_type} /><CaseDatum label="Suggested priority" value={customerCase.ai_triage.priority_suggestion} /><CaseDatum label="Suggested team" value={customerCase.ai_triage.suggested_team} /><CaseDatum label="Brand" value={customerCase.ai_triage.brand ?? 'Not identified'} /><CaseDatum label="Product" value={customerCase.ai_triage.product_category ?? 'Not identified'} /></div>
          {customerCase.ai_triage.risk_flags.length > 0 && <div className="case-risk-flags"><ShieldCheck size={14} />Supervisor review required · {customerCase.ai_triage.risk_flags.join(', ')}</div>}
          <div className="case-rule-version">{customerCase.ai_triage.model_or_rule_version} · human confirmation required</div>
        </section>

        <section className="drawer-section case-timeline-section">
          <div className="drawer-section-title"><h3>Case timeline</h3><span>{timeline.length} events</span></div>
          {timeline.length ? <div className="case-timeline">{timeline.map((item) => <div className={`case-timeline-item timeline-${item.direction}`} key={item.id}>
            <span className="timeline-marker">{item.direction === 'event' ? <ArrowUpRight size={12} /> : item.kind === 'Inbound' ? <ArrowDownRight size={12} /> : item.kind === 'Internal note' ? <StickyNote size={12} /> : <MessageSquare size={12} />}</span>
            <div className="timeline-copy"><div className="timeline-title-row"><strong>{item.title}</strong><span>{formatDate(item.created_at, true)}</span></div>{item.body && <p>{item.body}</p>}{item.channel && <small>{item.channel}</small>}</div>
          </div>)}</div> : <p className="case-no-evidence">The case timeline will show messages, notes, assignment changes, and status updates.</p>}
          <label className="case-compose-label"><span><StickyNote size={13} /> Add internal note</span><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Record investigation details for the team…" rows={3} /></label>
          <button className="button-secondary case-submit-button" disabled={!noteDraft.trim() || busyAction === 'note'} onClick={addNote}>{busyAction === 'note' ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />} Add note</button>
        </section>

        <section className="drawer-section case-response-section">
          <div className="drawer-section-title"><h3><Send size={14} /> Response and action</h3><span>{compactSource(customerCase.source_channel)}</span></div>
          <label className="case-compose-label"><span>Suggested response · edit before use</span><textarea value={responseDraft} onChange={(event) => setResponseDraft(event.target.value)} placeholder="Write a response in the customer's language…" rows={4} /></label>
          <p className="case-prototype-note">Record a response after sending it through the customer’s channel. This workspace does not deliver messages externally.</p>
          <button className="button-primary case-submit-button" disabled={!responseDraft.trim() || busyAction === 'response'} onClick={recordResponse}>{busyAction === 'response' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Record customer response</button>
        </section>

        {relatedCases.length > 0 && <section className="drawer-section">
          <div className="drawer-section-title"><h3>Related cases</h3><span>{relatedCases.length} matches</span></div>
          <div className="related-case-list">{relatedCases.map((item) => <button key={item.id} onClick={() => onSelectCase(item.id)}><span><strong>{item.id}</strong><small>{item.subject}</small></span><span className={`case-status status-${slug(item.status)}`}>{item.status}</span></button>)}</div>
        </section>}
      </div>
      {error && <div className="case-drawer-error" role="alert"><AlertTriangle size={14} />{error}</div>}
      <footer className="drawer-footer"><span><span className="drawer-footer-dot" /> Case activity is audited</span><button className="text-button" onClick={onClose}>Close</button></footer>
    </aside>
  </div>
}

function CaseDatum({ label, value }: { label: string; value: string }) {
  return <div className="case-ai-datum"><span>{label}</span><strong>{value}</strong></div>
}

function slug(value: string) {
  return value.toLocaleLowerCase('en-US').replaceAll(/[^a-z0-9]+/g, '-')
}

function formatRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
