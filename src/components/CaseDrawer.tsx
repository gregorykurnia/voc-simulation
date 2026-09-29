import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Clock3, FileText, LoaderCircle, MessageSquare, Plus, Send, ShieldCheck, Sparkles, StickyNote, X } from 'lucide-react'
import { addCaseMessage, listenCaseEvents, listenCaseMessages, slaPolicies, updateCustomerCase } from '../data/firestore'
import type { CaseEvent, CaseLearning, CaseMessage, CasePriority, CaseResolution, CaseStatus, CustomerCase, ReviewRecord, TopicClusterSummary } from '../types'
import { compactSource, formatDate } from '../utils'

interface Props {
  customerCase: CustomerCase
  cases: CustomerCase[]
  reviews: ReviewRecord[]
  clusters: TopicClusterSummary[]
  userId: string
  onClose: () => void
  onOpenReview: (review: ReviewRecord) => void
  onSelectCase: (caseId: string) => void
}

const transitions: Record<CaseStatus, CaseStatus[]> = {
  'Needs triage': ['In review', 'Needs supervisor review'],
  'In review': ['In progress', 'Needs supervisor review'],
  'In progress': ['Pending customer', 'Pending internal / store', 'Needs supervisor review'],
  'Pending customer': ['In progress', 'Needs supervisor review'],
  'Pending internal / store': ['In progress', 'Needs supervisor review'],
  'Needs supervisor review': ['In progress', 'Pending internal / store'],
  Escalated: ['In progress', 'Pending internal / store', 'Needs supervisor review'],
  Resolved: [],
  Closed: [],
  Reopened: ['In progress', 'Needs supervisor review'],
}

const teams = ['Customer Service', 'Store Operations', 'Logistics', 'Product Team', 'Finance', 'Technology']

export function CaseDrawer({ customerCase, cases, reviews, clusters, userId, onClose, onOpenReview, onSelectCase }: Props) {
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [responseDraft, setResponseDraft] = useState(customerCase.ai_triage.response_draft)
  const [resolutionDraft, setResolutionDraft] = useState<CaseResolution>(() => customerCase.resolution ?? emptyResolution())
  const [learningDraft, setLearningDraft] = useState<CaseLearning>(() => initialLearning(customerCase, reviews))
  const [qaNote, setQaNote] = useState(customerCase.qa_review_note ?? '')
  const [reopenReason, setReopenReason] = useState('')
  const [linkReviewId, setLinkReviewId] = useState('')
  const [requestedPriority, setRequestedPriority] = useState<CasePriority>(customerCase.requested_priority ?? customerCase.priority)
  const [requestedPolicyId, setRequestedPolicyId] = useState(customerCase.requested_sla_policy_id ?? customerCase.sla_policy_id)
  const [supervisorNote, setSupervisorNote] = useState(customerCase.supervisor_review_note ?? '')
  const [escalationTeam, setEscalationTeam] = useState('Store Operations')
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const resolutionSerialized = JSON.stringify(customerCase.resolution)
  const learningSerialized = JSON.stringify(customerCase.learning)

  useEffect(() => {
    const stopEvents = listenCaseEvents(customerCase.id, setEvents, (err) => setError(err.message))
    const stopMessages = listenCaseMessages(customerCase.id, setMessages, (err) => setError(err.message))
    return () => { stopEvents(); stopMessages() }
  }, [customerCase.id])

  useEffect(() => {
    setNoteDraft('')
    setResponseDraft(customerCase.ai_triage.response_draft)
    setResolutionDraft(customerCase.resolution ?? emptyResolution())
    setLearningDraft(customerCase.learning ?? initialLearning(customerCase, reviews))
    setQaNote(customerCase.qa_review_note ?? '')
    setReopenReason('')
    setRequestedPriority(customerCase.requested_priority ?? customerCase.priority)
    setRequestedPolicyId(customerCase.requested_sla_policy_id ?? customerCase.sla_policy_id)
    setSupervisorNote(customerCase.supervisor_review_note ?? '')
    setEscalationTeam(customerCase.escalated_to ?? 'Store Operations')
    setError('')
  }, [customerCase.id, customerCase.ai_triage.response_draft, customerCase.priority, customerCase.sla_policy_id, customerCase.requested_priority, customerCase.requested_sla_policy_id, customerCase.supervisor_review_note, customerCase.escalated_to, resolutionSerialized, learningSerialized, customerCase.qa_review_note])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const linkedReviews = customerCase.review_ids.map((id) => reviews.find((review) => review.id === id)).filter((item): item is ReviewRecord => Boolean(item))
  const primaryReview = reviews.find((review) => review.id === customerCase.primary_review_id)
  const caseLinkedReviewIds = new Set(cases.flatMap((item) => item.review_ids))
  const availableReviews = reviews.filter((review) => !caseLinkedReviewIds.has(review.id))
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
  const supervisorPending = customerCase.supervisor_review_state === 'Pending'
  const nextStatuses = customerCase.status === 'Needs supervisor review' && supervisorPending ? [] : transitions[customerCase.status]
  const hasCompensation = Boolean(resolutionDraft.compensation_details.trim()) || (resolutionDraft.compensation_amount ?? 0) > 0
  const compensationMatchesApproval = !hasCompensation || (
    customerCase.supervisor_review_state === 'Approved'
    && customerCase.resolution?.compensation_details === resolutionDraft.compensation_details
    && (customerCase.resolution?.compensation_amount ?? null) === (resolutionDraft.compensation_amount ?? null)
  )
  const approvalRequired = customerCase.ai_triage.risk_flags.length > 0 || customerCase.priority === 'Critical' || hasCompensation
  const supervisorApprovalSatisfied = !approvalRequired || (customerCase.supervisor_review_state === 'Approved' && compensationMatchesApproval)
  const supervisorReviewRequired = approvalRequired || Boolean(customerCase.requested_priority || customerCase.requested_sla_policy_id) || ['Pending', 'Approved', 'Returned'].includes(customerCase.supervisor_review_state ?? '')
  const qaPending = customerCase.status === 'Resolved' && customerCase.qa_review_state === 'Pending'
  const qaApproved = customerCase.status === 'Resolved' && customerCase.qa_review_state === 'Approved'
  const canEscalate = !['Resolved', 'Closed'].includes(customerCase.status)
  const canEditResolution = !['Resolved', 'Closed'].includes(customerCase.status) && !supervisorPending
  const learningReady = Boolean(learningDraft.root_cause.trim() && learningDraft.resolution_type.trim() && learningDraft.customer_outcome.trim())
  const canClose = Boolean(customerCase.status === 'Resolved' && customerCase.resolution?.summary.trim() && customerCase.resolution.customer_notified !== null && customerCase.qa_review_state === 'Approved' && learningDraft.human_validated)
  const supervisorRequestChanged = requestedPriority !== customerCase.priority || requestedPolicyId !== customerCase.sla_policy_id
  const supervisorRequestDisabled = !supervisorRequestChanged && (!supervisorReviewRequired || (customerCase.supervisor_review_state === 'Approved' && compensationMatchesApproval))

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusyAction(key)
    setError('')
    try { await action() }
    catch (err) { setError(err instanceof Error ? err.message : 'The case update could not be saved.') }
    finally { setBusyAction('') }
  }
  const changeStatus = (status: CaseStatus) => {
    const startsSupervisorReview = status === 'Needs supervisor review'
    const now = new Date()
    const slaChanges: Partial<CustomerCase> = status === 'Pending customer'
      ? { sla_paused_at: now.toISOString() }
      : customerCase.status === 'Pending customer'
        ? {
            sla_paused_at: null,
            resolution_due_at: new Date(new Date(customerCase.resolution_due_at).getTime() + Math.max(0, now.getTime() - new Date(customerCase.sla_paused_at ?? now.toISOString()).getTime())).toISOString(),
          }
        : {}
    void runAction('status', () => updateCustomerCase(
      customerCase.id,
      { ...slaChanges, status, ...(startsSupervisorReview ? { supervisor_review_state: 'Pending' as const } : {}) },
      userId,
      startsSupervisorReview ? 'Supervisor decision' : 'Status change',
      startsSupervisorReview ? 'Supervisor review requested' : `Status changed to ${status}`,
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

  const requestSupervisorReview = () => {
    const policyChanged = requestedPolicyId !== customerCase.sla_policy_id
    const priorityChanged = requestedPriority !== customerCase.priority
    if (!policyChanged && !priorityChanged && customerCase.supervisor_review_state !== 'Pending' && !supervisorReviewRequired) return
    const reason = supervisorNote.trim() || (hasCompensation ? `Compensation approval requested: ${resolutionDraft.compensation_details || `${resolutionDraft.compensation_amount} IDR`}` : '')
    void runAction('supervisor-request', () => updateCustomerCase(customerCase.id, {
      status: 'Needs supervisor review',
      supervisor_review_state: 'Pending',
      supervisor_review_note: reason,
      requested_priority: priorityChanged ? requestedPriority : null,
      requested_sla_policy_id: policyChanged ? requestedPolicyId : null,
      resolution: resolutionDraft,
    }, userId, 'Supervisor decision', hasCompensation ? 'Compensation approval requested' : 'Priority or SLA review requested'))
  }
  const approveSupervisorReview = () => {
    const requestedPolicy = slaPolicies.find((item) => item.id === customerCase.requested_sla_policy_id)
    const now = new Date()
    const changes: Partial<CustomerCase> = {
      supervisor_review_state: 'Approved',
      supervisor_user_id: userId,
      supervisor_review_note: supervisorNote.trim() || 'Approved in the supervisor review queue.',
      requested_priority: null,
      requested_sla_policy_id: null,
      status: customerCase.status === 'Needs supervisor review' ? 'In progress' : customerCase.status,
      resolution: resolutionDraft,
    }
    if (customerCase.requested_priority) changes.priority = customerCase.requested_priority
    if (requestedPolicy) {
      changes.sla_policy_id = requestedPolicy.id
      if (!customerCase.first_response_at) changes.first_response_due_at = new Date(now.getTime() + requestedPolicy.first_response_minutes * 60000).toISOString()
      changes.resolution_due_at = new Date(now.getTime() + requestedPolicy.resolution_minutes * 60000).toISOString()
    }
    void runAction('supervisor-approve', () => updateCustomerCase(customerCase.id, changes, userId, 'Supervisor decision', 'Supervisor approved case priority, SLA, and routing'))
  }
  const returnToAgent = () => void runAction('supervisor-return', () => updateCustomerCase(customerCase.id, {
    status: 'In review',
    supervisor_review_state: 'Returned',
    supervisor_review_note: supervisorNote.trim() || 'Returned for more evidence.',
    requested_priority: null,
    requested_sla_policy_id: null,
  }, userId, 'Supervisor decision', 'Case returned to the agent for clarification'))
  const escalateCase = () => {
    if (!escalationTeam) return
    void runAction('escalate', () => updateCustomerCase(customerCase.id, {
      status: 'Escalated',
      escalated_to: escalationTeam,
    }, userId, 'Escalation', `Escalated to ${escalationTeam}; original case owner retained`))
  }
  const updateResolution = <K extends keyof CaseResolution>(key: K, value: CaseResolution[K]) => {
    setResolutionDraft((current) => ({ ...current, [key]: value }))
  }
  const updateLearning = <K extends keyof CaseLearning>(key: K, value: CaseLearning[K]) => {
    setLearningDraft((current) => ({ ...current, [key]: value, human_validated: false, validated_by: null, validated_at: null }))
  }
  const saveResolutionDraft = () => void runAction('resolution-save', () => updateCustomerCase(customerCase.id, { resolution: resolutionDraft }, userId, 'Resolution', 'Resolution draft saved'))
  const markResolved = () => {
    const missing: string[] = []
    if (!resolutionDraft.summary.trim()) missing.push('resolution summary')
    if (!resolutionDraft.root_cause.trim()) missing.push('root cause')
    if (!resolutionDraft.action_taken.trim()) missing.push('action taken')
    if (!resolutionDraft.customer_notification_channel.trim()) missing.push('customer notification channel')
    if (resolutionDraft.customer_notified === null) missing.push('whether the customer was notified')
    if (missing.length) { setError(`Add ${missing.join(', ')} before resolving this case.`); return }
    if (!supervisorApprovalSatisfied) { setError('Supervisor approval is required before resolving this sensitive or compensation case.'); return }
    const now = new Date().toISOString()
    const learning: CaseLearning = {
      ...learningDraft,
      root_cause: learningDraft.root_cause || resolutionDraft.root_cause,
      resolution_type: learningDraft.resolution_type || resolutionDraft.action_taken,
      product_or_store_signal: learningDraft.product_or_store_signal || customerCase.issue_type,
      customer_outcome: learningDraft.customer_outcome || (resolutionDraft.customer_confirmed === true ? 'Satisfied' : resolutionDraft.customer_confirmed === false ? 'Unresolved' : 'Not confirmed'),
      topic_cluster_id: learningDraft.topic_cluster_id ?? primaryReview?.annotation?.cluster_id ?? null,
      human_validated: false,
      validated_by: null,
      validated_at: null,
    }
    const summary = `Case resolved; customer ${resolutionDraft.customer_notified ? `notified via ${resolutionDraft.customer_notification_channel}` : 'not notified'}`
    void runAction('resolve', async () => {
      await updateCustomerCase(customerCase.id, { status: 'Resolved', resolved_at: now, closed_at: null, resolution: resolutionDraft, learning, qa_review_state: 'Pending', qa_review_note: '' }, userId, 'Resolution', summary)
      setLearningDraft(learning)
    })
  }
  const approveQa = () => void runAction('qa-approve', () => updateCustomerCase(customerCase.id, {
    qa_review_state: 'Approved',
    qa_review_note: qaNote.trim() || 'Resolution and evidence approved.',
  }, userId, 'QA decision', 'QA approved the documented resolution'))
  const returnQa = () => {
    if (!qaNote.trim()) { setError('Add a QA note explaining what needs correction.'); return }
    void runAction('qa-return', () => updateCustomerCase(customerCase.id, {
      status: 'In progress',
      resolved_at: null,
      closed_at: null,
      qa_review_state: 'Returned',
      qa_review_note: qaNote.trim(),
      learning: customerCase.learning ? { ...customerCase.learning, human_validated: false, validated_by: null, validated_at: null } : null,
    }, userId, 'QA decision', 'QA returned the resolution to the agent'))
  }
  const validateLearning = () => {
    if (!qaApproved) { setError('QA must approve the resolution before case learning can be validated.'); return }
    if (!learningDraft.root_cause.trim() || !learningDraft.resolution_type.trim() || !learningDraft.customer_outcome.trim()) {
      setError('Add a root cause, resolution type, and customer outcome before validating learning.')
      return
    }
    const learning: CaseLearning = { ...learningDraft, human_validated: true, validated_by: userId, validated_at: new Date().toISOString() }
    void runAction('learning-validate', async () => {
      await updateCustomerCase(customerCase.id, { learning }, userId, 'Learning validated', 'Case learning validated for the linked topic cluster')
      setLearningDraft(learning)
    })
  }
  const closeCase = () => {
    if (customerCase.status !== 'Resolved' || !customerCase.resolution?.summary.trim() || customerCase.resolution.customer_notified === null) {
      setError('A documented resolution and customer notification state are required before closing this case.')
      return
    }
    if (customerCase.qa_review_state !== 'Approved') { setError('QA approval is required before closing this case.'); return }
    if (!learningDraft.human_validated) { setError('Validate the case learning signal before closing this case.'); return }
    const closedAt = new Date().toISOString()
    void runAction('close', () => updateCustomerCase(customerCase.id, { status: 'Closed', closed_at: closedAt }, userId, 'Status change', 'Case closed after QA approval and validated learning'))
  }
  const reopenCase = () => {
    if (!reopenReason.trim()) { setError('Add a reopen reason to preserve why this case returned to the queue.'); return }
    const reason = reopenReason.trim()
    const learning = customerCase.learning ? { ...customerCase.learning, human_validated: false, validated_by: null, validated_at: null } : null
    void runAction('reopen', async () => {
      await updateCustomerCase(customerCase.id, {
        status: 'Reopened',
        resolved_at: null,
        closed_at: null,
        sla_paused_at: null,
        qa_review_state: 'Not required',
        qa_review_note: '',
        resolution: customerCase.resolution ? { ...customerCase.resolution, reopen_reason: reason } : null,
        learning,
      }, userId, 'Reopened', `Case reopened: ${reason}`)
      setReopenReason('')
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
          <div className="case-transition-row"><label><span>Move case to</span><select value="" disabled={!nextStatuses.length || busyAction === 'status'} onChange={(event) => { if (event.target.value) changeStatus(event.target.value as CaseStatus) }}><option value="">{supervisorPending ? 'Waiting for supervisor review…' : 'Choose next status…'}</option>{nextStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><span>Changes are recorded in the case history.</span></div>
        </section>

        {(supervisorReviewRequired || canEscalate) && <section className="drawer-section supervisor-controls-section">
          <div className="drawer-section-title"><h3><ShieldCheck size={14} />{supervisorReviewRequired ? 'Supervisor review' : 'Priority, SLA & escalation'}</h3><span className={`case-status ${supervisorPending ? 'status-needs-supervisor-review' : customerCase.supervisor_review_state === 'Approved' ? 'status-resolved' : ''}`}>{customerCase.supervisor_review_state ?? 'Review required'}</span></div>
          {customerCase.ai_triage.risk_flags.length > 0 && <p className="supervisor-risk-note"><AlertTriangle size={13} /> Review required for: {customerCase.ai_triage.risk_flags.join(', ')}</p>}
          <div className="supervisor-override-grid">
            <label><span>Priority request</span><select value={requestedPriority} disabled={supervisorPending} onChange={(event) => setRequestedPriority(event.target.value as CasePriority)}>{['Critical', 'High', 'Normal', 'Low'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>SLA policy request</span><select value={requestedPolicyId} disabled={supervisorPending} onChange={(event) => setRequestedPolicyId(event.target.value)}>{slaPolicies.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.first_response_minutes / 60}h response / {item.resolution_minutes / 60}h resolution</option>)}</select></label>
          </div>
          <label className="case-compose-label supervisor-note"><span>Decision note / reason</span><textarea value={supervisorNote} disabled={customerCase.supervisor_review_state === 'Approved'} onChange={(event) => setSupervisorNote(event.target.value)} placeholder="Record the evidence or reason for this decision…" rows={2} /></label>
          {supervisorPending ? <div className="supervisor-decision-actions"><button className="button-primary case-submit-button" disabled={busyAction === 'supervisor-approve'} onClick={approveSupervisorReview}>{busyAction === 'supervisor-approve' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Approve review</button><button className="button-secondary case-submit-button" disabled={busyAction === 'supervisor-return'} onClick={returnToAgent}>Return to agent</button></div>
            : <button className="button-secondary case-submit-button" disabled={busyAction === 'supervisor-request' || supervisorRequestDisabled} onClick={requestSupervisorReview}>{busyAction === 'supervisor-request' ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />} {customerCase.supervisor_review_state === 'Returned' ? 'Resubmit for supervisor review' : 'Request priority / SLA override'}</button>}
          <div className="case-escalation-control"><div><strong>Specialist escalation</strong><small>{customerCase.escalated_to ? `Currently with ${customerCase.escalated_to}; original owner retained.` : 'Route work while retaining the original owner and history.'}</small></div><div className="case-escalation-actions"><select aria-label="Escalation destination" value={escalationTeam} onChange={(event) => setEscalationTeam(event.target.value)}>{['Store Operations', 'Logistics', 'Product Team', 'Finance', 'Technology'].map((item) => <option key={item}>{item}</option>)}</select><button className="button-secondary" disabled={!canEscalate || busyAction === 'escalate'} onClick={escalateCase}>{busyAction === 'escalate' ? 'Routing…' : 'Escalate'}</button></div></div>
          <p className="case-prototype-note">Supervisor controls are simulated for this single-role prototype. Every decision is written to case history.</p>
        </section>}

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
          {customerCase.ai_triage.possible_duplicate_case_ids.length > 0 && <div className="possible-duplicate-cases"><span>Possible duplicate cases · confirm before creating a separate case</span>{customerCase.ai_triage.possible_duplicate_case_ids.map((caseId) => cases.find((item) => item.id === caseId)).filter((item): item is CustomerCase => Boolean(item)).map((item) => <button key={item.id} onClick={() => onSelectCase(item.id)}><strong>{item.id}</strong><small>{item.subject}</small></button>)}</div>}
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

        <section className="drawer-section case-resolution-section">
          <div className="drawer-section-title"><h3>Resolution and closure</h3><span className={`case-status ${customerCase.status === 'Resolved' || customerCase.status === 'Closed' ? 'status-resolved' : ''}`}>{customerCase.status === 'Resolved' || customerCase.status === 'Closed' ? customerCase.status : 'Draft'}</span></div>
          <label className="case-compose-label"><span>Resolution summary <i>Required</i></span><textarea value={resolutionDraft.summary} disabled={!canEditResolution} onChange={(event) => updateResolution('summary', event.target.value)} placeholder="What happened and how was the customer's concern addressed?" rows={3} /></label>
          <div className="resolution-fields-grid">
            <label className="case-compose-label"><span>Root cause <i>Required</i></span><input value={resolutionDraft.root_cause} disabled={!canEditResolution} onChange={(event) => updateResolution('root_cause', event.target.value)} placeholder="e.g. incorrect size chart" /></label>
            <label className="case-compose-label"><span>Action taken <i>Required</i></span><input value={resolutionDraft.action_taken} disabled={!canEditResolution} onChange={(event) => updateResolution('action_taken', event.target.value)} placeholder="e.g. exchange approved" /></label>
          </div>
          <label className="case-compose-label"><span>Compensation or exception details <i>Supervisor approval required</i></span><textarea value={resolutionDraft.compensation_details} disabled={!canEditResolution} onChange={(event) => updateResolution('compensation_details', event.target.value)} placeholder="Refund, exchange, voucher, or other approved exception" rows={2} /></label>
          <div className="resolution-fields-grid">
            <label className="case-compose-label"><span>Compensation amount (IDR)</span><input type="number" min="0" step="1000" value={resolutionDraft.compensation_amount ?? ''} disabled={!canEditResolution} onChange={(event) => updateResolution('compensation_amount', event.target.value ? Number(event.target.value) : null)} placeholder="Optional" /></label>
            <label className="case-compose-label"><span>Customer notification channel <i>Required</i></span><select value={resolutionDraft.customer_notification_channel} disabled={!canEditResolution} onChange={(event) => updateResolution('customer_notification_channel', event.target.value)}><option value="">Select channel…</option>{['WhatsApp', 'Instagram', 'Email', 'Phone', 'Store visit', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <div className="resolution-fields-grid">
            <label className="case-compose-label"><span>Customer notified? <i>Record yes or no</i></span><select value={resolutionDraft.customer_notified === null ? '' : resolutionDraft.customer_notified ? 'yes' : 'no'} disabled={!canEditResolution} onChange={(event) => updateResolution('customer_notified', event.target.value === '' ? null : event.target.value === 'yes')}><option value="">Choose state…</option><option value="yes">Yes, notified</option><option value="no">No, not notified</option></select></label>
            <label className="case-compose-label"><span>Customer confirmation</span><select value={resolutionDraft.customer_confirmed === null ? '' : resolutionDraft.customer_confirmed ? 'yes' : 'no'} disabled={!canEditResolution} onChange={(event) => updateResolution('customer_confirmed', event.target.value === '' ? null : event.target.value === 'yes')}><option value="">Not recorded</option><option value="yes">Confirmed satisfied</option><option value="no">Still unresolved</option></select></label>
          </div>
          {customerCase.resolution?.reopen_reason && <div className="reopen-reason-note"><strong>Latest reopen reason</strong><span>{customerCase.resolution.reopen_reason}</span></div>}
          {canEditResolution ? <div className="resolution-action-row"><button className="button-secondary case-submit-button" disabled={busyAction === 'resolution-save'} onClick={saveResolutionDraft}>{busyAction === 'resolution-save' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Save resolution draft</button><button className="button-primary case-submit-button" disabled={busyAction === 'resolve' || !supervisorApprovalSatisfied} onClick={markResolved}>{busyAction === 'resolve' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Mark resolved</button></div>
            : customerCase.status === 'Resolved' ? <div className="resolution-action-row"><button className="button-primary case-submit-button" disabled={!canClose || busyAction === 'close'} onClick={closeCase}>{busyAction === 'close' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Close case</button><span>{canClose ? 'QA and learning validated' : 'QA approval and validated learning are required to close.'}</span></div> : <div className="closed-case-note"><Check size={14} /> Case closed with its evidence and timeline retained.</div>}
        </section>

        {customerCase.status === 'Resolved' && <section className="drawer-section case-qa-section">
          <div className="drawer-section-title"><h3><ShieldCheck size={14} /> QA review</h3><span className={`case-status ${customerCase.qa_review_state === 'Approved' ? 'status-resolved' : customerCase.qa_review_state === 'Pending' ? 'status-needs-supervisor-review' : ''}`}>{customerCase.qa_review_state ?? 'Not reviewed'}</span></div>
          {qaPending ? <><p className="case-ai-explanation">Check the evidence, resolution summary, notification state, and any compensation approval before approving closure.</p><label className="case-compose-label"><span>QA decision note</span><textarea value={qaNote} onChange={(event) => setQaNote(event.target.value)} placeholder="Record any policy or evidence review…" rows={2} /></label><div className="supervisor-decision-actions"><button className="button-primary case-submit-button" disabled={!supervisorApprovalSatisfied || busyAction === 'qa-approve'} onClick={approveQa}>{busyAction === 'qa-approve' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Approve QA</button><button className="button-secondary case-submit-button" disabled={busyAction === 'qa-return'} onClick={returnQa}>Return to agent</button></div></>
            : <p className="case-no-evidence">{qaApproved ? `Approved · ${customerCase.qa_review_note || 'Resolution and evidence approved.'}` : customerCase.qa_review_note || 'QA review is not yet approved.'}</p>}
        </section>}

        {(customerCase.status === 'Resolved' || customerCase.status === 'Closed') && <section className="drawer-section case-learning-section">
          <div className="drawer-section-title"><h3>Validated case learning</h3><span className={`case-status ${learningDraft.human_validated ? 'status-resolved' : ''}`}>{learningDraft.human_validated ? 'Validated' : 'Draft signal'}</span></div>
          <p className="case-ai-explanation">Only validated outcomes are included with the linked topic cluster. AI suggestions remain untrusted until a human validates them.</p>
          <div className="resolution-fields-grid">
            <label className="case-compose-label"><span>Root cause <i>Required</i></span><input value={learningDraft.root_cause} onChange={(event) => updateLearning('root_cause', event.target.value)} placeholder="Validated underlying cause" /></label>
            <label className="case-compose-label"><span>Resolution type <i>Required</i></span><input value={learningDraft.resolution_type} onChange={(event) => updateLearning('resolution_type', event.target.value)} placeholder="Exchange, refund, information…" /></label>
          </div>
          <div className="resolution-fields-grid">
            <label className="case-compose-label"><span>Customer outcome <i>Required</i></span><select value={learningDraft.customer_outcome} onChange={(event) => updateLearning('customer_outcome', event.target.value)}><option value="">Select outcome…</option>{['Satisfied', 'Partially satisfied', 'Unresolved', 'No response', 'Not confirmed'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="case-compose-label"><span>Topic cluster</span><select value={learningDraft.topic_cluster_id ?? ''} onChange={(event) => updateLearning('topic_cluster_id', event.target.value || null)}><option value="">Not linked</option>{clusters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          </div>
          <label className="case-compose-label"><span>Product or store signal</span><input value={learningDraft.product_or_store_signal} onChange={(event) => updateLearning('product_or_store_signal', event.target.value)} placeholder="What should product, store, or operations teams learn?" /></label>
          <div className="resolution-fields-grid">
            <label className="case-compose-label"><span>Preventable issue?</span><select value={learningDraft.preventable === null ? '' : learningDraft.preventable ? 'yes' : 'no'} onChange={(event) => updateLearning('preventable', event.target.value === '' ? null : event.target.value === 'yes')}><option value="">Not assessed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label className="case-compose-label"><span>Repeated issue?</span><select value={learningDraft.repeated_issue === null ? '' : learningDraft.repeated_issue ? 'yes' : 'no'} onChange={(event) => updateLearning('repeated_issue', event.target.value === '' ? null : event.target.value === 'yes')}><option value="">Not assessed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          </div>
          <label className="case-compose-label"><span>Reusable response or knowledge pattern</span><textarea value={learningDraft.reusable_response_pattern} onChange={(event) => updateLearning('reusable_response_pattern', event.target.value)} placeholder="A concise pattern that may help resolve similar cases" rows={2} /></label>
          <div className="resolution-action-row"><button className="button-secondary case-submit-button" disabled={busyAction === 'learning-save'} onClick={() => void runAction('learning-save', () => updateCustomerCase(customerCase.id, { learning: { ...learningDraft, human_validated: false, validated_by: null, validated_at: null } }, userId, 'Resolution', 'Case learning draft saved'))}>{busyAction === 'learning-save' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Save learning draft</button><button className="button-primary case-submit-button" disabled={!qaApproved || !learningReady || busyAction === 'learning-validate'} onClick={validateLearning}>{busyAction === 'learning-validate' ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />} Validate learning</button></div>
          {!qaApproved && <p className="case-prototype-note">QA approval is required before learning can be validated and added to a cluster.</p>}
        </section>}

        {(customerCase.status === 'Resolved' || customerCase.status === 'Closed') && <section className="drawer-section case-reopen-section">
          <div className="drawer-section-title"><h3>Reopen case</h3><span>Retains the full case history</span></div>
          <label className="case-compose-label"><span>Reason for reopening <i>Required</i></span><textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="What needs another investigation or customer follow-up?" rows={2} /></label>
          <button className="button-secondary case-submit-button" disabled={!reopenReason.trim() || busyAction === 'reopen'} onClick={reopenCase}>{busyAction === 'reopen' ? <LoaderCircle size={14} className="spin" /> : <ArrowUpRight size={14} />} Reopen case</button>
        </section>}

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

function emptyResolution(): CaseResolution {
  return {
    summary: '',
    root_cause: '',
    action_taken: '',
    compensation_details: '',
    compensation_amount: null,
    customer_notification_channel: '',
    customer_notified: null,
    customer_confirmed: null,
    reopen_reason: '',
  }
}

function initialLearning(customerCase: CustomerCase, reviews: ReviewRecord[]): CaseLearning {
  const primaryReview = reviews.find((review) => review.id === customerCase.primary_review_id)
  const existing = customerCase.learning
  const confirmed = customerCase.resolution?.customer_confirmed
  return {
    root_cause: existing?.root_cause ?? customerCase.resolution?.root_cause ?? '',
    resolution_type: existing?.resolution_type ?? customerCase.resolution?.action_taken ?? '',
    product_or_store_signal: existing?.product_or_store_signal ?? customerCase.issue_type,
    customer_outcome: existing?.customer_outcome ?? (confirmed === true ? 'Satisfied' : confirmed === false ? 'Unresolved' : 'Not confirmed'),
    preventable: existing?.preventable ?? null,
    repeated_issue: existing?.repeated_issue ?? null,
    reusable_response_pattern: existing?.reusable_response_pattern ?? '',
    topic_cluster_id: existing?.topic_cluster_id ?? primaryReview?.annotation?.cluster_id ?? null,
    human_validated: existing?.human_validated ?? false,
    validated_by: existing?.validated_by ?? null,
    validated_at: existing?.validated_at ?? null,
  }
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
