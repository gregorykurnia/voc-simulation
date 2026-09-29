import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Clock3, Search, ShieldCheck, Siren, Sparkles } from 'lucide-react'
import { triageReview } from '../caseTriage'
import { CaseDrawer } from '../components/CaseDrawer'
import { slaPolicies } from '../data/firestore'
import { useWorkspace } from '../context'
import type { CaseStatus, CustomerCase, ReviewRecord } from '../types'
import { compactSource, formatDate } from '../utils'

type QueueFilter = 'All cases' | 'My queue' | CaseStatus | 'SLA at risk'
type PageView = 'cases' | 'candidates'

const queueTabs: QueueFilter[] = ['All cases', 'My queue', 'Needs triage', 'In review', 'In progress', 'Pending customer', 'Pending internal / store', 'Needs supervisor review', 'Escalated', 'Resolved', 'Closed', 'Reopened']

export function CasesPage() {
  const { cases, reviews, user, createCaseFromReview, openReview } = useWorkspace()
  const [view, setView] = useState<PageView>('cases')
  const [queue, setQueue] = useState<QueueFilter>('All cases')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [team, setTeam] = useState('')
  const [source, setSource] = useState('')
  const [creatingId, setCreatingId] = useState('')
  const [createdIds, setCreatedIds] = useState<string[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [actionError, setActionError] = useState('')
  const now = Date.now()
  const activeCases = cases.filter((item) => !['Resolved', 'Closed'].includes(item.status))
  const needsTriage = cases.filter((item) => item.status === 'Needs triage')
  const slaAtRisk = activeCases.filter((item) => isSlaAtRisk(item, now))
  const slaBreached = activeCases.filter((item) => isSlaBreached(item, now))
  const supervisorQueue = cases.filter((item) => item.status === 'Needs supervisor review')
  const escalated = cases.filter((item) => item.status === 'Escalated')
  const resolvedThisWeek = cases.filter((item) => item.resolved_at && now - new Date(item.resolved_at).getTime() < 7 * 86400000).length
  const linkedReviewIds = useMemo(() => new Set(cases.flatMap((item) => item.review_ids)), [cases])
  const candidates = useMemo(() => reviews
    .filter((review) => !linkedReviewIds.has(review.id) && !createdIds.includes(review.id))
    .map((review) => ({ review, triage: triageReview(review) }))
    .filter((item) => item.triage.case_eligibility !== 'Insight only'), [reviews, linkedReviewIds, createdIds])
  const teams = useMemo(() => [...new Set(cases.map((item) => item.owner_team))].sort(), [cases])
  const sources = useMemo(() => [...new Set([...cases.map((item) => item.source_channel), ...reviews.map((item) => item.voice_source)])].sort(), [cases, reviews])
  const matchingCases = useMemo(() => cases.filter((item) => {
    if (queue === 'My queue' && item.owner_user_id !== user.uid) return false
    if (queue === 'SLA at risk' && !isSlaAtRisk(item, now)) return false
    if (queue !== 'All cases' && queue !== 'My queue' && queue !== 'SLA at risk' && item.status !== queue) return false
    if (priority && item.priority !== priority) return false
    if (team && item.owner_team !== team) return false
    if (source && item.source_channel !== source) return false
    const query = search.trim().toLocaleLowerCase('id-ID')
    return !query || `${item.id} ${item.subject} ${item.source_channel} ${item.issue_type} ${item.owner_team} ${item.brand ?? ''} ${item.product_category ?? ''}`.toLocaleLowerCase('id-ID').includes(query)
  }), [cases, queue, user.uid, now, priority, team, source, search])
  const matchingCandidates = useMemo(() => candidates.filter(({ review, triage }) => {
    if (priority && triage.priority_suggestion !== priority) return false
    if (team && triage.suggested_team !== team) return false
    if (source && review.voice_source !== source) return false
    const query = search.trim().toLocaleLowerCase('id-ID')
    return !query || `${review.id} ${review.raw_text} ${review.voice_source} ${triage.issue_type} ${triage.suggested_team}`.toLocaleLowerCase('id-ID').includes(query)
  }), [candidates, priority, team, source, search])

  const selectMetric = (target: QueueFilter) => { setView('cases'); setQueue(target) }
  const createCase = async (review: ReviewRecord, triage = triageReview(review)) => {
    setCreatingId(review.id)
    setActionError('')
    try {
      await createCaseFromReview(review, triage)
      setCreatedIds((current) => [...current, review.id])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The case could not be created.')
    } finally {
      setCreatingId('')
    }
  }

  return <section className="page-content cases-page">
    <div className="page-heading-row">
      <div>
        <div className="page-kicker"><span className="kicker-rule" /> CUSTOMER RESOLUTION</div>
        <h1>Customer service cases <span className="heading-count">{cases.length.toLocaleString()} cases</span></h1>
        <p className="page-subtitle">Turn customer feedback that needs follow-up into owned, auditable work.</p>
      </div>
      <button className={`button-secondary case-view-toggle ${view === 'candidates' ? 'selected' : ''}`} onClick={() => { setView(view === 'cases' ? 'candidates' : 'cases'); setQueue('All cases') }}><Sparkles size={15} />{view === 'candidates' ? 'View case queue' : `Actionable candidates · ${candidates.length}`}</button>
    </div>

    {slaAtRisk.length > 0 && <div className="case-sla-alert" role="status"><AlertTriangle size={16} /><span><strong>{slaBreached.length ? `${slaBreached.length} breached` : 'SLA attention needed'}</strong> · {slaAtRisk.length} {slaAtRisk.length === 1 ? 'case is' : 'cases are'} due soon or overdue. The supervisor queue should review these cases.</span><button onClick={() => selectMetric('SLA at risk')}>Review SLA cases →</button></div>}

    <div className="metrics-strip cases-metrics" aria-label="Case queue summary">
      <Metric icon={<BriefcaseBusiness size={15} />} label="Open cases" value={activeCases.length} detail="Awaiting a resolution" onClick={() => selectMetric('All cases')} />
      <Metric icon={<AlertTriangle size={15} />} label="Needs triage" value={needsTriage.length} detail="Confirm intent and ownership" tone="amber" onClick={() => selectMetric('Needs triage')} />
      <Metric icon={<Clock3 size={15} />} label="SLA at risk" value={slaAtRisk.length} detail="Due within two hours" tone="amber" onClick={() => selectMetric('SLA at risk')} />
      <Metric icon={<ShieldCheck size={15} />} label="Supervisor review" value={supervisorQueue.length} detail="Sensitive or high-risk cases" tone="blue" onClick={() => selectMetric('Needs supervisor review')} />
      <Metric icon={<Siren size={15} />} label="Escalated" value={escalated.length} detail="With a specialist team" tone="red" onClick={() => selectMetric('Escalated')} />
      <Metric icon={<CheckCircle2 size={15} />} label="Resolved this week" value={resolvedThisWeek} detail="Resolution recorded" tone="green" onClick={() => selectMetric('Resolved')} />
    </div>

    <div className="section-toolbar cases-toolbar">
      <div className="section-title-group"><h2>{view === 'candidates' ? 'Actionable review candidates' : 'Case queue'}</h2><span className="result-count">{(view === 'candidates' ? matchingCandidates.length : matchingCases.length).toLocaleString()} results</span></div>
      <div className="table-tools-note"><span className="table-dot" /> Original customer statements stay linked as evidence</div>
    </div>
    {view === 'cases' && <nav className="case-queue-tabs" aria-label="Case queues">{queueTabs.map((tab) => <button key={tab} className={queue === tab ? 'active' : ''} onClick={() => setQueue(tab)}>{tab}{tab === 'Needs triage' && needsTriage.length > 0 && <span>{needsTriage.length}</span>}</button>)}</nav>}
    <div className="filter-panel case-filter-panel">
      <label className="search-control"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === 'candidates' ? 'Search statements or candidate tags…' : 'Search cases or customer statements…'} aria-label="Search cases" /></label>
      <div className="filter-separator" />
      <select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{['Critical', 'High', 'Normal', 'Low'].map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filter by assigned team" value={team} onChange={(event) => setTeam(event.target.value)}><option value="">All teams</option>{[...new Set([...teams, 'Customer Service', 'Store Operations', 'Logistics', 'Finance', 'Product Team'])].sort().map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filter by channel" value={source} onChange={(event) => setSource(event.target.value)}><option value="">All channels</option>{sources.map((value) => <option key={value}>{value}</option>)}</select>
      {(search || priority || team || source) && <button className="clear-filter-button" onClick={() => { setSearch(''); setPriority(''); setTeam(''); setSource('') }}>Clear filters</button>}
    </div>
    {actionError && <div className="case-action-error" role="alert">{actionError}</div>}
    <div className="table-frame case-table-frame"><div className="table-scroll">
      {view === 'cases' ? <table className="data-table case-table"><thead><tr><th>CASE ID</th><th>PRIORITY · SLA</th><th>CUSTOMER ISSUE</th><th>CHANNEL</th><th>BRAND · PRODUCT</th><th>ISSUE TYPE</th><th>OWNER · TEAM</th><th>STATUS</th><th>LAST ACTIVITY</th></tr></thead><tbody>
        {matchingCases.map((item) => <CaseRow key={item.id} customerCase={item} onOpen={() => setSelectedCaseId(item.id)} />)}
      </tbody></table> : <table className="data-table candidate-table"><thead><tr><th>REVIEW</th><th>TRIAGE</th><th>ISSUE TYPE · TEAM</th><th>CHANNEL</th><th>RECEIVED</th><th>ACTION</th></tr></thead><tbody>
        {matchingCandidates.map(({ review, triage }) => <tr key={review.id}>
          <td className="candidate-statement"><p>“{review.raw_text}”</p><span>{review.id} · {review.processing_status}</span></td>
          <td><span className={`case-eligibility case-eligibility-${triage.case_eligibility === 'Actionable case' ? 'actionable' : 'review'}`}>{triage.case_eligibility}</span><small className="candidate-confidence">{Math.round(triage.confidence * 100)}% confidence{triage.risk_flags.length > 0 ? ' · supervisor review' : ''}</small></td>
          <td>{triage.issue_type}<small className="candidate-team">{triage.suggested_team} · {triage.priority_suggestion}</small></td>
          <td>{compactSource(review.voice_source)}</td><td>{formatDate(review.feedback_at)}</td>
          <td><button className="button-secondary candidate-create" disabled={creatingId === review.id} onClick={() => void createCase(review, triage)}>{creatingId === review.id ? 'Creating…' : 'Create case'}</button></td>
        </tr>)}
      </tbody></table>}
      {((view === 'cases' && !matchingCases.length) || (view === 'candidates' && !matchingCandidates.length)) && <div className="empty-table case-empty"><div className="empty-icon"><BriefcaseBusiness size={17} /></div><h3>{view === 'cases' ? 'No cases in this queue yet' : 'No actionable candidates found'}</h3><p>{view === 'cases' ? 'Create a case from any review, or switch to actionable candidates to triage likely customer follow-up.' : 'Candidate triage excludes insight-only feedback. Clear filters or review a statement directly to create a case.'}</p></div>}
    </div><div className="table-footer"><span>Showing <strong>{view === 'candidates' ? matchingCandidates.length : matchingCases.length}</strong> of <strong>{view === 'candidates' ? candidates.length : cases.length}</strong> {view === 'candidates' ? 'candidates' : 'cases'}</span><span>{slaPolicies.length} demo SLA policies · Rules v1.0 triage</span></div></div>
    {cases.find((item) => item.id === selectedCaseId) && <CaseDrawer
      customerCase={cases.find((item) => item.id === selectedCaseId)!}
      cases={cases}
      reviews={reviews}
      userId={user.uid}
      onClose={() => setSelectedCaseId('')}
      onOpenReview={(review) => { setSelectedCaseId(''); openReview(review) }}
      onSelectCase={setSelectedCaseId}
    />}
  </section>
}

function CaseRow({ customerCase, onOpen }: { customerCase: CustomerCase; onOpen: () => void }) {
  const dueAt = new Date(customerCase.first_response_at ? customerCase.resolution_due_at : customerCase.first_response_due_at).getTime()
  const remaining = dueAt - Date.now()
  const paused = slaPolicies.find((item) => item.id === customerCase.sla_policy_id)?.pause_statuses.includes(customerCase.status) ?? false
  const slaText = paused ? 'Paused' : remaining <= 0 ? 'Breached' : formatRemaining(remaining)
  const priorityClass = customerCase.priority.toLowerCase()
  return <tr className="case-table-row" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }} aria-label={`Open case ${customerCase.id}`}>
    <td className="case-id-cell"><strong>{customerCase.id}</strong><small>{formatDate(customerCase.created_at)}</small></td>
    <td><span className={`case-priority priority-${priorityClass}`}>{customerCase.priority}</span><small className={`case-sla ${remaining <= 0 && !paused ? 'breached' : isSlaAtRisk(customerCase, Date.now()) ? 'at-risk' : ''}`}><Clock3 size={11} />{slaText}</small></td>
    <td className="case-subject-cell"><strong>{customerCase.subject}</strong><small>{customerCase.review_ids.length} linked review{customerCase.review_ids.length === 1 ? '' : 's'}</small></td>
    <td>{compactSource(customerCase.source_channel)}</td>
    <td>{customerCase.brand ?? 'Unknown'}<small>{customerCase.product_category ?? 'Product not specified'}</small></td>
    <td>{customerCase.issue_type}</td>
    <td>{customerCase.owner_user_id ?? 'Unassigned'}<small>{customerCase.owner_team}</small></td>
    <td><span className={`case-status status-${slug(customerCase.status)}`}>{customerCase.status}</span></td>
    <td>{formatDate(customerCase.last_activity_at, true)}</td>
  </tr>
}

function Metric({ icon, label, value, detail, tone = '', onClick }: { icon: ReactNode; label: string; value: number; detail: string; tone?: string; onClick: () => void }) {
  return <button className={`metric-item metric-clickable ${tone ? `metric-${tone}` : ''}`} onClick={onClick}>
    <span className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span></span>
    <span className="metric-value">{value.toLocaleString()}</span>
    <span className="metric-detail">{detail}</span>
  </button>
}

function isSlaAtRisk(item: CustomerCase, now: number) {
  if (['Resolved', 'Closed'].includes(item.status)) return false
  const paused = slaPolicies.find((policy) => policy.id === item.sla_policy_id)?.pause_statuses.includes(item.status) ?? false
  const dueAt = item.first_response_at ? item.resolution_due_at : item.first_response_due_at
  const remaining = new Date(dueAt).getTime() - now
  return !paused && remaining <= 2 * 60 * 60 * 1000
}

function isSlaBreached(item: CustomerCase, now: number) {
  if (['Resolved', 'Closed'].includes(item.status)) return false
  const paused = slaPolicies.find((policy) => policy.id === item.sla_policy_id)?.pause_statuses.includes(item.status) ?? false
  const dueAt = item.first_response_at ? item.resolution_due_at : item.first_response_due_at
  return !paused && new Date(dueAt).getTime() < now
}

function formatRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}d ${hours}h left`
  if (hours) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function slug(value: string) {
  return value.toLocaleLowerCase('en-US').replaceAll(/[^a-z0-9]+/g, '-')
}
