import { useEffect, useState } from 'react'
import { useWorkspace } from '../context'
import { listenImprovementActions, saveImprovementAction } from '../data/firestore'
import type { ImprovementAction } from '../types'
import { compareSignal, measureSignal, validWindow, type InsightScope } from '../insights'

export const functions = ['Brand', 'MD / Merchandising', 'PD / Product Development', 'SCM / Supply Chain', 'Marketing', 'Operations']
const statuses: ImprovementAction['status'][] = ['Proposed','Planned','In progress','Monitoring impact','Completed','Closed']
export function newAction(topic: string, title: string, scope: InsightScope, ids: string[], user: string): ImprovementAction {
  const now = new Date().toISOString()
  return { id: `ACTION-${crypto.randomUUID()}`, title, intended_change:'', topic_id:topic, scope:{...scope,topic}, evidence_ids:ids, owner_function:'Operations', owner_name:'', contributors:'',status:'Proposed',due_date:'',next_review_date:'',notes:'',hypothesis:'',metric:'Issue count',target:'',baseline:null,followup_start:'',followup_end:'',outcome_note:'',created_at:now,created_by:user,updated_at:now,updated_by:user,updates:[] }
}
export function useActions() {
  const [actions,setActions] = useState<ImprovementAction[]>([]), [error,setError] = useState(''), [loading,setLoading] = useState(true)
  useEffect(()=>listenImprovementActions(a=>{setActions(a);setLoading(false)},e=>{setError(e.message);setLoading(false)}),[])
  return {actions,error,loading}
}
export function ActionEditor({ initial, onClose }: { initial: ImprovementAction; onClose:()=>void }) {
  const {user,reviews} = useWorkspace()
  const [draft,setDraft] = useState(initial), [error,setError] = useState(''), [saving,setSaving] = useState(false)
  const set = (key:keyof ImprovementAction,value:string)=>setDraft(d=>({...d,[key]:value}))
  async function save() {
    setSaving(true);setError('')
    try {
      const now=new Date().toISOString()
      if (!validWindow(draft.scope)) throw new Error('The baseline period is invalid.')
      if (draft.followup_start || draft.followup_end) {
        if (!validWindow({...draft.scope,start:draft.followup_start,end:draft.followup_end}) || draft.followup_start <= draft.scope.end) throw new Error('Choose a complete follow-up period after the baseline.')
        if (draft.metric==='Issue count' && Date.parse(draft.followup_end)-Date.parse(draft.followup_start)!==Date.parse(draft.scope.end)-Date.parse(draft.scope.start)) throw new Error('Issue counts require equal-length baseline and follow-up windows.')
      }
      const baseline=draft.baseline ?? (draft.status!=='Proposed' ? measureSignal(reviews,draft.scope,draft.metric):null)
      await saveImprovementAction({...draft,baseline,updated_at:now,updated_by:user.uid,updates:[...draft.updates,{at:now,by:user.uid,status:draft.status,notes:draft.notes}]});onClose()
    } catch(e) {setError(e instanceof Error?e.message:'Could not save action.')} finally {setSaving(false)}
  }
  return <section className="insight-panel"><h2>{initial.updates.length?'Update improvement action':'Create improvement action'}</h2><p>Source topic: {draft.topic_id} · Baseline scope: {draft.scope.start} – {draft.scope.end} · {draft.evidence_ids.length} linked statements. Saved scope and planned metric remain fixed.</p>
    <form onSubmit={e=>{e.preventDefault();void save()}}><div className="insight-form">
      {(['title','intended_change','owner_name','contributors','notes','hypothesis','target'] as const).map(key=><label key={key}>{({title:'Action title',intended_change:'Intended change / recommendation',owner_name:'Named owner',contributors:'Functional contributors',notes:'Notes / update',hypothesis:'Possible driver (unvalidated hypothesis)',target:'Optional target'})[key]}<input required={['title','intended_change','owner_name'].includes(key)} value={draft[key]} onChange={e=>set(key,e.target.value)} /></label>)}
      <label>Primary function<select aria-label="Primary function" value={draft.owner_function} onChange={e=>set('owner_function',e.target.value)}>{functions.map(f=><option key={f}>{f}</option>)}</select></label>
      <label>Status<select aria-label="Status" value={draft.status} onChange={e=>set('status',e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Due date<input required type="date" value={draft.due_date} onChange={e=>set('due_date',e.target.value)} /></label><label>Next review date<input type="date" value={draft.next_review_date} onChange={e=>set('next_review_date',e.target.value)} /></label>
      <label>Expected signal<select aria-label="Expected signal" disabled={Boolean(draft.baseline)} value={draft.metric} onChange={e=>set('metric',e.target.value)}>{['Issue count','Negative / mixed share','Manual measure'].map(m=><option key={m}>{m}</option>)}</select></label>
      {['Monitoring impact','Completed','Closed'].includes(draft.status) && <><label>Follow-up from<input type="date" value={draft.followup_start} onChange={e=>set('followup_start',e.target.value)} /></label><label>Follow-up through<input type="date" value={draft.followup_end} onChange={e=>set('followup_end',e.target.value)} /></label><label>Owner outcome / operational measure note<textarea value={draft.outcome_note} onChange={e=>set('outcome_note',e.target.value)} /></label></>}
    </div>{draft.baseline && <ImpactComparison action={draft} />}{error && <p role="alert">{error}</p>}<div className="insights-tabs"><button className="button-primary" disabled={saving}>{saving?'Saving…':'Save improvement action'}</button><button type="button" className="button-secondary" onClick={onClose}>Cancel</button></div></form>
    <p>Created {draft.created_at} by {draft.created_by} · Updated {draft.updated_at} by {draft.updated_by}</p>
    {draft.updates.map((u,i)=><p key={i}>{u.at} · {u.by} · {u.status} · {u.notes}</p>)}
  </section>
}
export function ActionsList({actions,onEdit,scope}: {actions:ImprovementAction[];onEdit:(a:ImprovementAction)=>void;scope:InsightScope}) {
  const [owner,setOwner]=useState(''),[status,setStatus]=useState(''),[due,setDue]=useState('')
  const today=new Date().toISOString().slice(0,10), soon=new Date(Date.now()+7*86400000).toISOString().slice(0,10)
  const scoped=actions.filter(a=>Object.entries(scope).every(([k,v])=>!v || ['start','end'].includes(k) || a.scope[k as keyof InsightScope]===v))
  const filtered=scoped.filter(a=>(!owner||a.owner_function===owner)&&(!status||a.status===status)&&(!due||(due==='Overdue'?a.due_date<today:a.due_date>=today&&a.due_date<=soon)) )
  return <><div className="insights-filters"><label>Owner function<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All</option>{functions.map(f=><option key={f}>{f}</option>)}</select></label><label>Status<select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Due date<select value={due} onChange={e=>setDue(e.target.value)}><option value="">All</option><option>Overdue</option><option>Due soon</option></select></label></div><p>Actions match selected dimensions; their saved baseline windows remain fixed.</p>{!filtered.length&&<p>No improvement actions match. Create one from a recap topic.</p>}{filtered.map(a=><section className="insight-panel" key={a.id}><h2>{a.title}</h2><p>{a.status} · {a.owner_function} · {a.owner_name} · Due {a.due_date} { !['Completed','Closed'].includes(a.status) ? a.due_date<today?'· Overdue':a.due_date<=soon?'· Due soon':'':''}</p><p>{a.intended_change}</p><p>{Object.entries(a.scope).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p><button className="button-secondary" onClick={()=>onEdit(a)}>Open action</button></section>)}</>
}

function ImpactComparison({ action }: { action: ImprovementAction }) {
  const {reviews,openReview}=useWorkspace()
  const scope={...action.scope,start:action.followup_start,end:action.followup_end}
  const followup=measureSignal(reviews,scope,action.metric), baseline=action.baseline!
  const equalLength=Date.parse(scope.end)-Date.parse(scope.start)===Date.parse(baseline.end)-Date.parse(baseline.start)
  const valid=validWindow(scope) && scope.start>baseline.end && (action.metric!=='Issue count'||equalLength)
  const result=compareSignal(baseline,valid?followup:{value:null,denominator:0})
  const format=(v:number|null)=>v===null?'Unavailable':`${Number(v.toFixed(2))}${action.metric==='Negative / mixed share'?'%':''}`
  return <section className="insight-panel"><h3>Observed follow-up · {result.label}</h3><p>{action.metric} · Lower is the expected improvement direction.</p>
    <p>Stored baseline: {format(baseline.value)} · {baseline.start} – {baseline.end} · denominator: {baseline.denominator} tagged statements.</p>
    <p>Follow-up: {valid?format(followup.value):'Unavailable'} · {scope.start || 'Select start'} – {scope.end || 'Select end'} · denominator: {valid?followup.denominator:0} tagged statements.</p>
    {result.absolute!==null && <p>Absolute difference: {result.absolute.toFixed(2)} {action.metric==='Negative / mixed share'?'percentage points':'statements'} · Relative difference: {result.relative===null?'Unavailable (zero baseline)':`${result.relative.toFixed(2)}%`}</p>}
    <p>Minimum {5} statements in each window. Issue counts require equal-length windows. This is an observed association; it does not establish that the action caused a change. Follow-up counts use current annotations; the baseline is a saved snapshot.</p>
    {action.metric==='Manual measure' && <p>Operational measures are recorded in the owner note and are not calculated from feedback.</p>}
    <details><summary>Inspect baseline and follow-up evidence</summary>{[['Baseline',baseline.evidence_ids],['Follow-up',valid?followup.evidence_ids:[]]].map(([label,ids])=><div key={label as string}><h4>{label}</h4>{(ids as string[]).map(id=>{const r=reviews.find(r=>r.id===id);return <button type="button" className="insight-evidence" key={id} disabled={!r} onClick={()=>r&&openReview(r)}>{id} · {r?.raw_text ?? 'Record unavailable'}</button>})}</div>)}</details>
  </section>
}
