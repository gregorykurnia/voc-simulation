import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, ArrowUpRight, Check, Clock3, FileText, LoaderCircle, Save, ShieldCheck, X } from 'lucide-react'
import { addCorrectionAudit, saveAnnotation } from '../data/firestore'
import { ReviewState, StatusPill } from './StatusPill'
import { SentimentTag } from './SentimentTag'
import { formatDate } from '../utils'
import type { Annotation, AuditEntry, CatalogValue, ReviewRecord, TopicClusterSummary } from '../types'

interface Props {
  review: ReviewRecord
  allReviews: ReviewRecord[]
  catalogs: Record<string, CatalogValue[]>
  clusters: TopicClusterSummary[]
  audit: AuditEntry[]
  mode: 'raw' | 'processed'
  userId: string
  onClose: () => void
  onProcess: () => void
}

export function ReviewDrawer({ review, allReviews, catalogs, clusters, audit, mode, userId, onClose, onProcess }: Props) {
  const [draft, setDraft] = useState<Annotation | null>(review.annotation ? structuredClone(review.annotation) : null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [localError, setLocalError] = useState('')
  const annotation = review.annotation
  const cluster = clusters.find((item) => item.id === annotation?.cluster_id)
  const productOptions = catalogs.productCategories ?? []

  useEffect(() => {
    setDraft(review.annotation ? structuredClone(review.annotation) : null)
    setSaved(false)
    setLocalError('')
  }, [review.id, review.annotation?.processed_at])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const update = <K extends keyof Annotation>(key: K, value: Annotation[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setSaved(false)
  }
  const commit = async (validated: boolean) => {
    if (!draft) return
    setSaving(true)
    setLocalError('')
    try {
      const reviewed = {
        ...draft,
        assignment_method: 'Human-reviewed' as const,
        review_state: validated ? 'Validated' as const : 'Needs clarification' as const,
        confidence: validated ? 1 : draft.confidence,
      }
      await saveAnnotation(review, reviewed, userId, validated ? 'validated' : 'corrected', allReviews)
      setDraft(reviewed)
      setSaved(true)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'The annotation could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const toggleExcluded = async (checked: boolean) => {
    if (!draft) return
    const updated = { ...draft, excluded_from_clustering: checked, assignment_method: 'Human-reviewed' as const }
    setDraft(updated)
    setSaving(true)
    setLocalError('')
    try {
      await addCorrectionAudit(review, updated, userId, checked ? 'excluded-from-clustering' : 'included-in-clustering', allReviews)
      setSaved(true)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'The clustering preference could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="review-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header className="drawer-header"><div><span className="drawer-eyebrow">{mode === 'raw' ? 'RAW REVIEW' : 'ANNOTATION DETAIL'}</span><h2 id="drawer-title">{review.id}</h2></div><button className="icon-button drawer-close" onClick={onClose} aria-label="Close review details"><X size={18} /></button></header>
      <div className="drawer-content">
        <section className="drawer-section original-section">
          <div className="drawer-section-title"><h3>Original statement</h3><span className="verbatim-label"><FileText size={13} /> Verbatim</span></div>
          <blockquote className="review-verbatim">“{review.raw_text}”</blockquote>
          <div className="original-foot"><span>{review.id}</span><span>{formatDate(review.feedback_at, true)}</span></div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-title"><h3>Source metadata</h3><StatusPill status={review.processing_status} compact /></div>
          <div className="metadata-grid"><Metadata label="Voice source" value={review.voice_source} /><Metadata label="Source detail" value={review.source_detail} /><Metadata label="Received" value={formatDate(review.feedback_at, true)} /><Metadata label="Dataset" value="Synthetic proxy · fictional record" /></div>
        </section>

        {annotation && draft ? <>
          <section className="drawer-section annotation-section">
            <div className="drawer-section-title"><h3>Derived annotations</h3><span className="assignment-label"><span className="assignment-dot" />{annotation.assignment_method}</span></div>
            <div className="annotation-status-row"><ReviewState state={annotation.review_state} /><span className={`confidence-badge ${annotation.confidence < 0.69 ? 'low' : ''}`}>{Math.round(annotation.confidence * 100)}% confidence</span></div>
            {mode === 'processed' ? <div className="annotation-editor">
              <EditField label="Brand" value={draft.brand ?? ''} options={catalogs.brands ?? []} emptyLabel="Unknown / not stated" onChange={(value) => update('brand', value || null)} />
              <EditField label="Product category" value={draft.product_category ?? ''} options={productOptions} emptyLabel="Unknown / not stated" onChange={(value) => update('product_category', value || null)} />
              <label className="edit-field"><span>Product/style mentioned</span><input value={draft.product_style_mentioned ?? ''} onChange={(event) => update('product_style_mentioned', event.target.value || null)} placeholder="Free-text style, if stated" /></label>
              <EditField label="Primary issue" value={draft.issue_type} options={catalogs.issueTypes ?? []} onChange={(value) => update('issue_type', value)} />
              <EditField label="Store location" value={draft.store_id ?? ''} options={catalogs.stores ?? []} useId emptyLabel="Not specified" onChange={(value) => update('store_id', value || null)} />
              <EditField label="Sentiment" value={draft.sentiment} options={catalogs.sentiments ?? []} onChange={(value) => update('sentiment', value as Annotation['sentiment'])} />
              <EditField label="Topic cluster" value={draft.cluster_id} options={clusters.map((item) => ({ id: item.id, label: item.title }))} useId onChange={(value) => update('cluster_id', value)} />
              <EditField label="Workflow status" value={draft.workflow_status} options={catalogs.workflowStatuses ?? []} onChange={(value) => update('workflow_status', value)} />
            </div> : <div className="annotation-summary-grid">
              <AnnotationValue label="Brand" value={annotation.brand ?? 'Unknown'} />
              <AnnotationValue label="Product category" value={annotation.product_category ?? 'Unknown'} />
              <AnnotationValue label="Product/style" value={annotation.product_style_mentioned ?? 'Not specified'} />
              <AnnotationValue label="Primary issue" value={annotation.issue_type} />
              <AnnotationValue label="Store" value={catalogs.stores?.find((item) => item.id === annotation.store_id)?.label ?? 'Not specified'} />
              <AnnotationValue label="Sentiment" value={<SentimentTag sentiment={annotation.sentiment} />} />
              <AnnotationValue label="Topic cluster" value={cluster?.title ?? 'Unassigned'} />
              <AnnotationValue label="Sentiment confidence" value={`${Math.round(annotation.sentiment_confidence * 100)}%`} />
              <AnnotationValue label="Workflow status" value={annotation.workflow_status} />
              <div className="attribute-value"><span>Product attributes</span><div>{annotation.attributes.length ? annotation.attributes.map((item) => <span className="tag-neutral" key={item}>{item}</span>) : <em>None identified</em>}</div></div>
            </div>}

            <label className="exclude-toggle"><input type="checkbox" checked={draft.excluded_from_clustering} onChange={(event) => void toggleExcluded(event.target.checked)} /><span className="custom-checkbox"><Check size={12} /></span><span>Exclude this review from clustering</span></label>
            <div className="annotation-actions">
              {mode === 'processed' && <button className="button-secondary save-correction" disabled={saving || !isChanged(review.annotation, draft)} onClick={() => void commit(false)}>{saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} Save correction</button>}
              {annotation.review_state !== 'Validated' && <button className="validate-button" disabled={saving} onClick={() => void commit(true)}><ShieldCheck size={15} /> Mark as validated</button>}
            </div>
            {saved && <div className="saved-note"><Check size={14} /> Annotation saved to Firestore</div>}
            {localError && <div className="drawer-error"><AlertCircle size={14} />{localError}</div>}

            <div className="provenance-details"><div className="provenance-line"><span>Assignment method</span><strong>{annotation.assignment_method}</strong></div><div className="provenance-line"><span>Annotation confidence</span><strong className={annotation.confidence < 0.69 ? 'confidence-low' : ''}>{Math.round(annotation.confidence * 100)}%</strong></div><div className="provenance-line"><span>Rule set</span><strong>Rules v1.0 · Taxonomy v1.0</strong></div><div className="provenance-line"><span>Last processed</span><strong>{formatDate(annotation.processed_at, true)}</strong></div></div>
            {annotation.normalized_text && <details className="normalized-details"><summary>View normalized text <span>Derived data</span></summary><p>{annotation.normalized_text}</p></details>}
          </section>
          {cluster && <section className="drawer-section cluster-context-section"><div className="drawer-section-title"><h3>Cluster context</h3><span className="cluster-context-count">{cluster.review_count} reviews</span></div><h4>{cluster.title}</h4><p>{cluster.summary}</p><span className="drawer-evidence-heading">NEIGHBORING EVIDENCE</span>{(cluster.representative_review_ids ?? []).filter((id) => id !== review.id).slice(0, 2).map((id) => <NeighborEvidence key={id} record={allReviews.find((item) => item.id === id)} id={id} />)}</section>}
          {audit.length > 0 && <section className="drawer-section audit-section"><div className="drawer-section-title"><h3>Review history</h3><span>{audit.length} updates</span></div><div className="audit-list">{audit.map((entry) => <div className="audit-item" key={entry.id}><span className="audit-dot" /><div><strong>{auditLabel(entry.action)}</strong><span>{formatDate(entry.created_at, true)}</span></div><ArrowUpRight size={13} /></div>)}</div></section>}
        </> : <section className="drawer-section unprocessed-drawer-section">
          <div className="drawer-section-title"><h3>Processing history</h3><span className="pending-history"><Clock3 size={13} /> Waiting to process</span></div>
          <p className="processing-explanation">This record has not been enriched. Its original text remains unchanged until processing runs.</p>
          <div className="history-row"><span className="history-dot" /><div><strong>Statement received</strong><span>{formatDate(review.feedback_at, true)}</span></div><span className="history-status">Stored</span></div>
          <div className="history-row history-pending"><span className="history-dot" /><div><strong>Tag and cluster review</strong><span>Not started</span></div><span className="history-status">Pending</span></div>
          <button className="button-primary drawer-process-button" onClick={() => { onProcess(); onClose() }}><span className="button-icon"><span className="button-arrow">✦</span></span> Process this review</button>
        </section>}
      </div>
      <footer className="drawer-footer"><span><span className="drawer-footer-dot" /> Stored in Firestore</span><button className="text-button" onClick={onClose}>Close</button></footer>
    </aside>
  </div>
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="metadata-cell"><span>{label}</span><strong>{value}</strong></div>
}

function AnnotationValue({ label, value }: { label: string; value: ReactNode }) {
  return <div className="annotation-value"><span>{label}</span><strong>{value}</strong></div>
}

function EditField({ label, value, options, onChange, emptyLabel, useId = false }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; emptyLabel?: string; useId?: boolean }) {
  return <label className="edit-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{emptyLabel && <option value="">{emptyLabel}</option>}{options.map((item) => <option key={item.id} value={useId ? item.id : item.label}>{item.label}</option>)}</select></label>
}

function NeighborEvidence({ id, record }: { id: string; record?: ReviewRecord }) {
  return <div className="neighbor-evidence"><span>“{record?.raw_text ?? 'Evidence statement is unavailable.'}”</span><small>{id}</small></div>
}

function isChanged(original: Annotation | undefined, draft: Annotation) {
  if (!original) return false
  const canonical = (value: Annotation) => JSON.stringify(Object.entries({ ...value, processed_at: '' }).sort(([a], [b]) => a.localeCompare(b)))
  return canonical(original) !== canonical(draft)
}

function auditLabel(action: string) {
  if (action === 'validated') return 'Annotation validated'
  if (action === 'corrected') return 'Tags corrected'
  if (action === 'excluded-from-clustering') return 'Excluded from clustering'
  if (action === 'included-in-clustering') return 'Returned to clustering'
  return action.replaceAll('-', ' ')
}
