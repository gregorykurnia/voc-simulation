import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, ChevronRight, FilterX, Layers3, Search, Sparkles } from 'lucide-react'
import { useWorkspace } from '../context'
import { Pagination, SourceGlyph } from './ReviewsPage'
import { ReviewState } from '../components/StatusPill'
import { SentimentTag } from '../components/SentimentTag'
import { compactSource, formatDate } from '../utils'
import type { ReviewRecord, Sentiment, TopicClusterSummary } from '../types'

export function ProcessedPage() {
  const { reviews, catalogs, clusters, lastRun, processAll, openReview, processProgress } = useWorkspace()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ source: '', brand: '', product: '', issue: '', store: '', sentiment: '', cluster: '', status: '', workflow: '' })
  const [selectedCluster, setSelectedCluster] = useState('')
  const [allClusters, setAllClusters] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15
  const processed = reviews.filter((review) => Boolean(review.annotation))
  const pending = reviews.filter((review) => ['Unprocessed', 'Failed'].includes(review.processing_status)).length
  const needReview = reviews.filter((review) => review.processing_status === 'Needs review').length
  const clusterCards = clusters.filter((cluster) => cluster.review_count > 0).slice(0, allClusters ? undefined : 4)
  const hasAnyProcessed = processed.length > 0

  const filtered = useMemo(() => processed.filter((review) => {
    const annotation = review.annotation!
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (query && !`${review.raw_text} ${review.id} ${annotation.brand ?? ''} ${annotation.product_category ?? ''} ${annotation.issue_type}`.toLocaleLowerCase('id-ID').includes(query)) return false
    if (filters.source && review.voice_source !== filters.source) return false
    if (filters.brand && annotation.brand !== filters.brand) return false
    if (filters.product && annotation.product_category !== filters.product) return false
    if (filters.issue && annotation.issue_type !== filters.issue) return false
    if (filters.store && annotation.store_id !== filters.store) return false
    if (filters.sentiment && annotation.sentiment !== filters.sentiment) return false
    if (filters.cluster && annotation.cluster_id !== filters.cluster) return false
    if (filters.status && review.processing_status !== filters.status) return false
    if (filters.workflow && annotation.workflow_status !== filters.workflow) return false
    if (selectedCluster && annotation.cluster_id !== selectedCluster) return false
    return true
  }).sort((a, b) => b.feedback_at.localeCompare(a.feedback_at)), [processed, search, filters, selectedCluster])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const activeCluster = clusters.find((cluster) => cluster.id === selectedCluster)
  const resetFilters = () => { setSearch(''); setFilters({ source: '', brand: '', product: '', issue: '', store: '', sentiment: '', cluster: '', status: '', workflow: '' }); setSelectedCluster(''); setPage(1) }
  const setFilter = (key: keyof typeof filters, value: string) => { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1) }

  return <section className="page-content processed-page">
    <div className="page-heading-row processed-heading">
      <div>
        <div className="page-kicker"><span className="kicker-rule" /> ENRICHED FEEDBACK</div>
        <h1>Processed signals <span className="heading-count">{processed.length.toLocaleString()} reviews</span></h1>
        <p className="page-subtitle">Explore tags and topic groups, then trace each signal to its source statement.</p>
      </div>
      <div className="processed-heading-meta">
        <div className="last-run-chip"><span className={`run-indicator ${lastRun ? 'run-complete' : ''}`} /><div><span>LAST PROCESSING RUN</span><strong>{lastRun ? formatDate(lastRun.completed_at, true) : 'No run yet'}</strong></div></div>
        {pending > 0 && <button className="button-primary process-all-button" onClick={() => void processAll()} disabled={Boolean(processProgress && processProgress.state !== 'Completed')}><Sparkles size={15} /> Process {pending} reviews <span className="button-arrow">→</span></button>}
      </div>
    </div>

    {hasAnyProcessed ? <>
      <div className="run-meta-row"><span className="run-method"><Sparkles size={14} /> Rule-based annotations</span><span>{lastRun?.prompt_version ?? 'Taxonomy v1.0'}</span><span>{lastRun?.model_version ?? 'Rules v1.0'}</span><span className="run-needs-review"><AlertCircle size={14} /> {needReview} need review</span></div>

      <div className="cluster-section-heading"><div><h2>Topic clusters</h2><span>{clusters.filter((cluster) => cluster.review_count > 0).length} groups formed from customer evidence</span></div>{clusters.filter((cluster) => cluster.review_count > 0).length > 4 && <button className="quiet-action" onClick={() => setAllClusters((value) => !value)}>{allClusters ? 'Show top clusters' : 'View all clusters'} <ArrowRight size={14} /></button>}</div>
      <div className={`cluster-grid ${allClusters ? 'cluster-grid-expanded' : ''}`}>
        {clusterCards.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} selected={selectedCluster === cluster.id} reviews={reviews} onSelect={() => { const next = selectedCluster === cluster.id ? '' : cluster.id; setSelectedCluster(next); setFilter('cluster', next); setPage(1) }} onReview={openReview} />)}
      </div>
      {activeCluster && <div className="cluster-evidence-panel">
          <div className="cluster-evidence-title"><div><span className="evidence-label">CUSTOMER EVIDENCE</span><h3>{activeCluster.title}</h3></div><button aria-label="Clear selected cluster" className="quiet-action" onClick={() => { setSelectedCluster(''); setFilter('cluster', '') }}>Clear selection <span>×</span></button></div>
        <p className="cluster-evidence-summary">{activeCluster.summary}</p>
        <div className="evidence-list">{(activeCluster.representative_review_ids ?? []).slice(0, 3).map((id) => {
          const review = reviews.find((entry) => entry.id === id)
          if (!review) return null
          return <button className="evidence-quote" key={id} onClick={() => openReview(review)}><span className="quote-mark">“</span><span className="evidence-quote-text">{review.raw_text}</span><span className="evidence-quote-meta">{review.id} <ChevronRight size={13} /></span></button>
        })}</div>
      </div>}

      <div className="section-toolbar processed-table-heading"><div className="section-title-group"><h2>Tagged reviews</h2><span className="result-count">{filtered.length.toLocaleString()} results</span></div><div className="assignment-legend"><span className="legend-assignment"><span /> Rule-assigned</span><span className="legend-assignment human"><span /> Human-reviewed</span></div></div>
      <div className="filter-panel processed-filter-panel">
        <label className="search-control"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search statements or tags…" aria-label="Search processed reviews" /></label>
        <select aria-label="Filter by source" value={filters.source} onChange={(event) => setFilter('source', event.target.value)}><option value="">All sources</option>{(catalogs.voiceSources ?? []).map((item) => <option value={item.label} key={item.id}>{compactSource(item.label)}</option>)}</select>
        <select aria-label="Filter by brand" value={filters.brand} onChange={(event) => setFilter('brand', event.target.value)}><option value="">All brands</option>{(catalogs.brands ?? []).map((item) => <option value={item.label} key={item.id}>{item.label}</option>)}</select>
        <select aria-label="Filter by product category" value={filters.product} onChange={(event) => setFilter('product', event.target.value)}><option value="">All products</option>{(catalogs.productCategories ?? []).map((item) => <option value={item.label} key={item.id}>{item.label}</option>)}</select>
        <select aria-label="Filter by issue type" value={filters.issue} onChange={(event) => setFilter('issue', event.target.value)}><option value="">All issues</option>{(catalogs.issueTypes ?? []).map((item) => <option value={item.label} key={item.id}>{item.label}</option>)}</select>
        <select aria-label="Filter by store location" value={filters.store} onChange={(event) => setFilter('store', event.target.value)}><option value="">All stores</option>{(catalogs.stores ?? []).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
        <select aria-label="Filter by sentiment" value={filters.sentiment} onChange={(event) => setFilter('sentiment', event.target.value)}><option value="">All sentiment</option>{(catalogs.sentiments ?? []).map((item) => <option value={item.label} key={item.id}>{item.label}</option>)}</select>
        <select aria-label="Filter by cluster" value={filters.cluster} onChange={(event) => { setSelectedCluster(''); setFilter('cluster', event.target.value) }}><option value="">All clusters</option>{clusters.filter((cluster) => cluster.review_count > 0).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select>
        <select aria-label="Filter by workflow status" value={filters.workflow} onChange={(event) => setFilter('workflow', event.target.value)}><option value="">All workflows</option>{(catalogs.workflowStatuses ?? []).map((item) => <option value={item.label} key={item.id}>{item.label}</option>)}</select>
        <select aria-label="Filter by processing status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">All states</option><option>Processed</option><option>Needs review</option></select>
        {Object.values(filters).some(Boolean) || search ? <button className="clear-filter-button" onClick={resetFilters}><FilterX size={14} /> Clear</button> : null}
      </div>

      <div className="table-frame processed-table-frame">
        {selectedCluster && <div className="selection-bar"><Layers3 size={15} /><span>Showing <strong>{filtered.length} reviews</strong> in “{activeCluster?.title}”</span><button onClick={() => { setSelectedCluster(''); setFilter('cluster', '') }}>Clear selection <span>×</span></button></div>}
        <div className="table-scroll"><table className="data-table processed-table">
          <thead><tr><th className="processed-review-column">Customer statement</th><th>Source</th><th>Brand / product</th><th>Issue</th><th>Store</th><th>Sentiment</th><th>Cluster</th><th>Confidence</th><th>Review state</th></tr></thead>
          <tbody>{visible.map((review) => <ProcessedRow key={review.id} review={review} catalogs={catalogs} clusters={clusters} onOpen={() => openReview(review)} onSelectCluster={(clusterId) => { setSelectedCluster(clusterId); setFilter('cluster', clusterId) }} />)}</tbody>
        </table></div>
        {!visible.length && <div className="empty-table"><div className="empty-icon"><Search size={19} /></div><h3>No tagged reviews match</h3><p>Adjust the selected filters to see more review evidence.</p><button className="button-secondary" onClick={resetFilters}>Clear filters</button></div>}
        {visible.length > 0 && <div className="table-footer"><span>Showing <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length.toLocaleString()}</strong> reviews</span><Pagination page={page} maxPage={maxPage} setPage={setPage} /></div>}
      </div>
    </> : <div className="empty-processing-state">
      <div className="empty-processing-icon"><Sparkles size={21} /></div>
      <div><span className="eyebrow">READY FOR ENRICHMENT</span><h2>Process the proxy reviews to see tags and clusters</h2><p>Each statement will receive rule-assigned tags. You can inspect the evidence, correct an annotation, and mark it validated.</p></div>
      <button className="button-primary" onClick={() => void processAll()} disabled={!pending || Boolean(processProgress && processProgress.state !== 'Completed')}><Sparkles size={15} /> Process {pending} reviews <ArrowRight size={15} /></button>
    </div>}
  </section>
}

function ClusterCard({ cluster, selected, reviews, onSelect, onReview }: { cluster: TopicClusterSummary; selected: boolean; reviews: ReviewRecord[]; onSelect: () => void; onReview: (review: ReviewRecord) => void }) {
  const members = reviews.filter((review) => review.annotation?.cluster_id === cluster.id && !review.annotation.excluded_from_clustering)
  const mix = cluster.sentiment_mix ?? {}
  const total = Object.values(mix).reduce((sum, count) => sum + (count ?? 0), 0) || 1
  const segments: [Sentiment, number][] = [['Positive', mix.Positive ?? 0], ['Neutral', mix.Neutral ?? 0], ['Mixed', mix.Mixed ?? 0], ['Negative', mix.Negative ?? 0]]
  const evidence = members.slice(0, 2)
  return <article className={`cluster-card ${selected ? 'cluster-card-selected' : ''}`}>
    <button className="cluster-card-main" onClick={onSelect} aria-pressed={selected}>
      <span className="cluster-card-top"><span className="cluster-index">TOPIC GROUP</span><span className="cluster-count">{cluster.review_count} reviews</span></span>
      <span className="cluster-card-title">{cluster.title}</span>
      <span className="cluster-summary">{cluster.summary}</span>
      <span className="cluster-tags"><span className="tag-neutral">{cluster.dominant_issues?.[0] ?? cluster.issue}</span><span className="tag-neutral">{cluster.dominant_products?.[0] ?? cluster.product}</span></span>
      <span className="sentiment-bar sentiment-mix-bar" aria-label={`Sentiment mix: ${segments.map(([label, count]) => `${label} ${Math.round(count / total * 100)}%`).join(', ')}`}>{segments.map(([label, count]) => <span className={`mix-${label.toLowerCase()}`} key={label} style={{ width: `${count / total * 100}%` }} />)}</span>
      <span className="cluster-sentiment-copy"><span>Sentiment mix</span><strong>{segments.map(([label, count]) => `${label[0]} ${Math.round(count / total * 100)}%`).join(' · ')}</strong></span>
    </button>
    {evidence.length > 0 && <div className="cluster-mini-evidence"><span className="mini-evidence-label">EVIDENCE</span>{evidence.map((review) => <button key={review.id} onClick={() => onReview(review)} title={review.raw_text}><span>“{review.raw_text}”</span><i>{review.id}</i></button>)}</div>}
  </article>
}

function ProcessedRow({ review, catalogs, clusters, onOpen, onSelectCluster }: { review: ReviewRecord; catalogs: Record<string, { id: string; label: string }[]>; clusters: TopicClusterSummary[]; onOpen: () => void; onSelectCluster: (clusterId: string) => void }) {
  const annotation = review.annotation!
  const cluster = clusters.find((item) => item.id === annotation.cluster_id)
  const store = catalogs.stores?.find((item) => item.id === annotation.store_id)
  return <tr className="review-row processed-row" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }} aria-label={`Open processed review ${review.id}`}>
    <td className="processed-review-cell"><p>{review.raw_text}</p><span>{review.id} · {formatDate(review.feedback_at)}</span></td>
    <td><span className="source-label"><SourceGlyph source={review.voice_source} /><span className="processed-source-name" title={review.voice_source}>{compactSource(review.voice_source)}</span></span></td>
    <td><div className="brand-product"><span>{annotation.brand ?? <span className="unassigned">Unknown brand</span>}</span><span className="tag-neutral">{annotation.product_category ?? 'Product unclear'}</span></div></td>
    <td><span className="tag-neutral issue-tag">{annotation.issue_type}</span></td>
    <td className="store-cell">{store?.label.split(' — ')[0] ?? '—'}</td>
    <td><SentimentTag sentiment={annotation.sentiment} /></td>
    <td><button className="cluster-link" onClick={(event) => { event.stopPropagation(); onSelectCluster(annotation.cluster_id) }} title={cluster?.title}>{cluster?.title ?? 'Needs review'}<ChevronRight size={13} /></button></td>
    <td><span className={`confidence-value ${annotation.confidence < 0.69 ? 'confidence-low' : ''}`}>{Math.round(annotation.confidence * 100)}%</span></td>
    <td><ReviewState state={annotation.review_state} /></td>
  </tr>
}
