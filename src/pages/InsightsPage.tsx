import { useState } from 'react'
import { useWorkspace } from '../context'
import { emptyScope, MIN_EVIDENCE, negativeCount, previousScope, scopedReviews, sentimentCounts, validWindow, type InsightScope } from '../insights'

export function InsightsPage() {
  const { reviews, clusters, cases, openReview, processAll, loading } = useWorkspace()
  const latest = reviews.map(r => r.feedback_at.slice(0, 10)).sort().at(-1) ?? new Date().toISOString().slice(0, 10)
  const [scope, setScope] = useState<InsightScope>({ ...emptyScope, start: new Date(Date.parse(latest) - 29 * 86400000).toISOString().slice(0, 10), end: latest })
  const [selected, setSelected] = useState('')
  const current = scopedReviews(reviews, scope), previous = scopedReviews(reviews, previousScope(scope))
  const candidates = clusters.map(cluster => ({ ...cluster, members: current.filter(r => !r.annotation!.excluded_from_clustering && r.annotation!.cluster_id === cluster.id) })).filter(c => c.members.length).sort((a,b) => b.members.length-a.members.length)
  const update = (key: keyof InsightScope, value: string) => { setScope(s => ({ ...s, [key]: value })); setSelected('') }
  const dimensions: [keyof InsightScope, string, (r: typeof reviews[number]) => string | null | undefined][] = [
    ['brand','Brand',r=>r.annotation?.brand], ['product','Product category',r=>r.annotation?.product_category], ['issue','Issue type',r=>r.annotation?.issue_type], ['store','Store / location',r=>r.annotation?.store_id], ['source','Voice source',r=>r.voice_source], ['sentiment','Sentiment',r=>r.annotation?.sentiment],
  ]
  return <div className="page-content insights-page">
    <div className="page-heading-row"><div><h1>Service Insights Recap</h1><p className="page-subtitle">{scope.start} – {scope.end} · Systemic improvement signals from synthetic proxy feedback.</p></div></div>
    <div className="insights-tabs"><button className="button-secondary" aria-current="page">Recap</button></div>
    <div className="insights-filters">
      <label>Period<select aria-label="Period preset" defaultValue="30" onChange={e=>{ if(e.target.value) setScope(s=>({...s,start:new Date(Date.parse(latest)-(Number(e.target.value)-1)*86400000).toISOString().slice(0,10),end:latest})) }}><option value="30">Latest 30 dataset days</option><option value="60">Latest 60 dataset days</option><option value="120">Latest 120 dataset days</option><option value="">Custom range</option></select></label>
      <label>From<input type="date" value={scope.start} onChange={e=>update('start',e.target.value)} /></label><label>Through<input type="date" value={scope.end} onChange={e=>update('end',e.target.value)} /></label>
      {dimensions.map(([key,label,get])=><label key={key}>{label}<select value={scope[key]} onChange={e=>update(key,e.target.value)}><option value="">All</option>{[...new Set(reviews.map(get).filter((v):v is string=>Boolean(v)))].sort().map(v=><option key={v}>{v}</option>)}</select></label>)}
      <label>Topic<select value={scope.topic} onChange={e=>update('topic',e.target.value)}><option value="">All topics</option>{clusters.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <button className="button-secondary" onClick={()=>{setScope({...emptyScope,start:new Date(Date.parse(latest)-29*86400000).toISOString().slice(0,10),end:latest});setSelected('')}}>Clear filters</button>
    </div>
    <p role="status">{current.length} eligible tagged statements · {Object.entries(scope).filter(([k,v])=>v && !['start','end'].includes(k)).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'All dimensions'}</p>
    {!validWindow(scope) && <p role="alert">Select a valid start and end date.</p>}
    <div className="metrics-strip">
      <div className="metric-item"><span>Tagged statements</span><strong className="metric-value">{current.length}</strong><small>{current.filter(r=>r.annotation!.review_state!=='Validated').length} unvalidated · {current.filter(r=>r.annotation!.confidence<.6).length} low confidence</small></div>
      <div className="metric-item"><span>Negative / mixed</span><strong className="metric-value">{current.length ? `${Math.round(negativeCount(current)/current.length*100)}%` : '—'}</strong><small>{negativeCount(current)} / {current.length} statements</small></div>
      <div className="metric-item"><span>Most frequent topic</span><strong>{candidates[0]?.title ?? 'No topic evidence'}</strong><small>{candidates[0]?.members.length ?? 0} supporting statements</small></div>
      <div className="metric-item"><span>Previous period</span><strong>{current.length>=MIN_EVIDENCE && previous.length>=MIN_EVIDENCE ? `${current.length-previous.length>=0?'+':''}${current.length-previous.length} statements` : 'Insufficient evidence'}</strong><small>{previousScope(scope).start} – {previousScope(scope).end} · {previous.length} statements</small></div>
    </div>
    <p className="page-subtitle">Rule-assigned annotations and seeded topic titles; counts calculated from exact reviews. Minimum evidence: {MIN_EVIDENCE} statements per comparison window. Excluded reviews remain in totals but are omitted from topic themes.</p>
    {!current.length && <div className="insight-panel"><h2>No tagged feedback in this scope</h2><p>Adjust filters or process the proxy reviews to see evidence-backed themes.</p><button className="button-secondary" onClick={()=>void processAll()} disabled={loading}>Process reviews</button></div>}
    {candidates.map(c=>{const before=previous.filter(r=>!r.annotation!.excluded_from_clustering && r.annotation!.cluster_id===c.id);return <section className="insight-panel" key={c.id}>
      <h2>{c.title}</h2><p><strong>Observed signal:</strong> {c.members.length} / {current.length} statements ({Math.round(c.members.length/current.length*100)}%) concern this topic. {c.members.length<MIN_EVIDENCE?'Low evidence; avoid generalizing.': 'Recurring signal in this scope.'}</p>
      <p>{sentimentCounts(c.members).map(s=>`${s.label}: ${s.count}`).join(' · ')}</p><p>{c.members.length>=MIN_EVIDENCE && before.length>=MIN_EVIDENCE?`${c.members.length-before.length>=0?'+':''}${c.members.length-before.length} statements versus previous period (${before.length}).`:`Topic comparison: insufficient evidence (${before.length} previous statements).`}</p>
      <p>{c.members.filter(r=>r.annotation!.review_state==='Validated').length} validated · {c.members.filter(r=>r.annotation!.assignment_method==='Rule-assigned').length} rule-assigned · {c.members.filter(r=>r.annotation!.confidence<.6).length} low confidence</p>
      <button className="button-secondary" onClick={()=>setSelected(selected===c.id?'':c.id)} aria-expanded={selected===c.id}>Review evidence ({c.members.length})</button>
      {(selected===c.id?c.members:c.members.slice(0,2)).map(r=><button className="insight-evidence" key={r.id} onClick={()=>openReview(r)}><span>“{r.raw_text}”</span><small>{r.id} · {r.annotation!.brand ?? 'Unknown brand'} · {r.annotation!.product_category ?? 'Unknown product'} · {r.annotation!.store_id ?? 'Unknown store'} · {r.voice_source} · {r.feedback_at.slice(0,10)} · {r.annotation!.review_state} · {Math.round(r.annotation!.confidence*100)}% confidence</small></button>)}
      {selected===c.id && <><p><strong>Possible driver:</strong> No analyst hypothesis entered. Tags alone do not establish a root cause.</p><p><strong>Recommendation:</strong> Review the evidence with the relevant function before planning a response.</p><h3>Validated case learning</h3>{cases.filter(k=>k.learning?.human_validated && k.review_ids.some(id=>c.members.some(r=>r.id===id))).map(k=><p key={k.id}><a href={`/cases?case=${k.id}`}>{k.id}</a> · {k.learning!.root_cause} · {k.learning!.product_or_store_signal}</p>)}<p>Learning is limited to validated cases linked to these exact statements.</p></>}
    </section>})}
  </div>
}
