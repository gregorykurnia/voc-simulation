import { useEffect, useState } from 'react'
import { useWorkspace } from '../context'
import { listenImprovementActions, saveImprovementAction } from '../data/firestore'
import type { ImprovementAction } from '../types'
import { negativeCount, scopedReviews, type InsightScope } from '../insights'

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
      const now=new Date().toISOString(), members=scopedReviews(reviews,draft.scope)
      const baseline=draft.baseline ?? (draft.status!=='Proposed' ? {start:draft.scope.start,end:draft.scope.end,value:draft.metric==='Manual measure'?null:draft.metric==='Issue count'?members.length:members.length?negativeCount(members)/members.length*100:null,denominator:members.length,evidence_ids:members.map(r=>r.id)}:null)
      await saveImprovementAction({...draft,baseline,updated_at:now,updated_by:user.uid,updates:[...draft.updates,{at:now,by:user.uid,status:draft.status,notes:draft.notes}]});onClose()
    } catch(e) {setError(e instanceof Error?e.message:'Could not save action.')} finally {setSaving(false)}
  }
  return <section className="insight-panel"><h2>{initial.updates.length?'Update improvement action':'Create improvement action'}</h2><p>Source topic: {draft.topic_id} · Baseline scope: {draft.scope.start} – {draft.scope.end} · {draft.evidence_ids.length} linked statements. Saved scope and planned metric remain fixed.</p>
    <form onSubmit={e=>{e.preventDefault();void save()}}><div className="insight-form">
      {(['title','intended_change','owner_name','contributors','notes','hypothesis','target'] as const).map(key=><label key={key}>{({title:'Action title',intended_change:'Intended change / recommendation',owner_name:'Named owner',contributors:'Functional contributors',notes:'Notes / update',hypothesis:'Possible driver (unvalidated hypothesis)',target:'Optional target'})[key]}<input required={['title','intended_change','owner_name'].includes(key)} value={draft[key]} onChange={e=>set(key,e.target.value)} /></label>)}
      <label>Primary function<select value={draft.owner_function} onChange={e=>set('owner_function',e.target.value)}>{functions.map(f=><option key={f}>{f}</option>)}</select></label>
      <label>Status<select value={draft.status} onChange={e=>set('status',e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Due date<input required type="date" value={draft.due_date} onChange={e=>set('due_date',e.target.value)} /></label><label>Next review date<input type="date" value={draft.next_review_date} onChange={e=>set('next_review_date',e.target.value)} /></label>
      <label>Expected signal<select disabled={Boolean(draft.baseline)} value={draft.metric} onChange={e=>set('metric',e.target.value)}>{['Issue count','Negative / mixed share','Manual measure'].map(m=><option key={m}>{m}</option>)}</select></label>
    </div>{error && <p role="alert">{error}</p>}<div className="insights-tabs"><button className="button-primary" disabled={saving}>{saving?'Saving…':'Save improvement action'}</button><button type="button" className="button-secondary" onClick={onClose}>Cancel</button></div></form>
    <p>Created {draft.created_at} by {draft.created_by} · Updated {draft.updated_at} by {draft.updated_by}</p>
    {draft.updates.map((u,i)=><p key={i}>{u.at} · {u.by} · {u.status} · {u.notes}</p>)}
  </section>
}
export function ActionsList({actions,onEdit,scope}: {actions:ImprovementAction[];onEdit:(a:ImprovementAction)=>void;scope:InsightScope}) {
  const [owner,setOwner]=useState(''),[status,setStatus]=useState(''),[due,setDue]=useState('')
  const today=new Date().toISOString().slice(0,10), soon=new Date(Date.now()+7*86400000).toISOString().slice(0,10)
  const scoped=actions.filter(a=>Object.entries(scope).every(([k,v])=>!v || ['start','end'].includes(k) || a.scope[k as keyof InsightScope]===v))
  const filtered=scoped.filter(a=>(!owner||a.owner_function===owner)&&(!status||a.status===status)&&(!due||(due==='Overdue'?a.due_date<today:a.due_date>=today&&a.due_date<=soon)) )
  return <><div className="insights-filters"><label>Owner function<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All</option>{functions.map(f=><option key={f}>{f}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Due date<select value={due} onChange={e=>setDue(e.target.value)}><option value="">All</option><option>Overdue</option><option>Due soon</option></select></label></div><p>Actions match selected dimensions; their saved baseline windows remain fixed.</p>{!filtered.length&&<p>No improvement actions match. Create one from a recap topic.</p>}{filtered.map(a=><section className="insight-panel" key={a.id}><h2>{a.title}</h2><p>{a.status} · {a.owner_function} · {a.owner_name} · Due {a.due_date} { !['Completed','Closed'].includes(a.status) ? a.due_date<today?'· Overdue':a.due_date<=soon?'· Due soon':'':''}</p><p>{a.intended_change}</p><p>{Object.entries(a.scope).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p><button className="button-secondary" onClick={()=>onEdit(a)}>Open action</button></section>)}</>
}
