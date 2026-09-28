import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Clock3, FilterX, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { StatusPill } from '../components/StatusPill'
import { useWorkspace } from '../context'
import { compactSource, formatDate } from '../utils'

type SortKey = 'feedback_at' | 'voice_source' | 'source_detail' | 'processing_status'

export function ReviewsPage() {
  const { reviews, catalogs, processAll, openReview, processProgress } = useWorkspace()
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [detail, setDetail] = useState('')
  const [status, setStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('feedback_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)
  const pageSize = 20

  const unprocessed = reviews.filter((review) => review.processing_status === 'Unprocessed').length
  const processed = reviews.filter((review) => review.processing_status === 'Processed').length
  const needsReview = reviews.filter((review) => review.processing_status === 'Needs review').length
  const sourceDetails = useMemo(() => [...new Set(reviews.filter((review) => !source || review.voice_source === source).map((review) => review.source_detail))].sort(), [reviews, source])

  const filtered = useMemo(() => reviews.filter((review) => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (query && !`${review.raw_text} ${review.id} ${review.voice_source} ${review.source_detail}`.toLocaleLowerCase('id-ID').includes(query)) return false
    if (source && review.voice_source !== source) return false
    if (detail && review.source_detail !== detail) return false
    if (status && review.processing_status !== status) return false
    if (fromDate && review.feedback_at.slice(0, 10) < fromDate) return false
    if (toDate && review.feedback_at.slice(0, 10) > toDate) return false
    return true
  }).sort((a, b) => {
    const comparison = sortKey === 'feedback_at'
      ? a.feedback_at.localeCompare(b.feedback_at)
      : String(a[sortKey]).localeCompare(String(b[sortKey]))
    return comparison * (sortDirection === 'asc' ? 1 : -1)
  }), [reviews, search, source, detail, status, fromDate, toDate, sortKey, sortDirection])

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const hasFilters = Boolean(search || source || detail || status || fromDate || toDate)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const updateSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection(key === 'feedback_at' ? 'desc' : 'asc') }
  }
  const clearFilters = () => { setSearch(''); setSource(''); setDetail(''); setStatus(''); setFromDate(''); setToDate(''); setPage(1) }

  return <section className="page-content">
    <div className="page-heading-row">
      <div>
        <div className="page-kicker"><span className="kicker-rule" /> INCOMING FEEDBACK</div>
        <h1>Raw reviews <span className="heading-count">{reviews.length.toLocaleString()} statements</span></h1>
        <p className="page-subtitle">Original customer wording, ready for review and enrichment.</p>
      </div>
      <button className="button-primary process-all-button" onClick={() => void processAll()} disabled={!unprocessed || Boolean(processProgress && processProgress.state !== 'Completed')}>
        <Sparkles size={15} /> Process {unprocessed > 0 ? `${unprocessed} reviews` : 'reviews'} <span className="button-arrow">→</span>
      </button>
    </div>

    <div className="metrics-strip" aria-label="Review processing summary">
      <Metric icon={<Search size={15} />} label="Total statements" value={reviews.length} detail="Across all feedback channels" />
      <Metric icon={<Clock3 size={15} />} label="Unprocessed" value={unprocessed} detail="Waiting for enrichment" tone="blue" />
      <Metric icon={<Sparkles size={15} />} label="Processed" value={processed} detail="Tags and cluster assigned" tone="green" />
      <Metric icon={<span className="metric-alert">!</span>} label="Needs review" value={needsReview} detail="Low confidence or unclear" tone="amber" />
    </div>

    <div className="section-toolbar">
      <div className="section-title-group"><h2>Feedback inbox</h2><span className="result-count">{filtered.length.toLocaleString()} results</span></div>
      <div className="table-tools-note"><span className="table-dot" /> Original statements are shown as received</div>
    </div>

    <div className="filter-panel">
      <label className="search-control"><Search size={17} /><input ref={searchRef} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search customer statements…" aria-label="Search customer statements" /><kbd>⌘ K</kbd></label>
      <div className="filter-separator" />
      <div className="filter-select-wrap"><SlidersHorizontal size={15} /><span>Filter</span></div>
      <select aria-label="Filter by voice source" value={source} onChange={(event) => { setSource(event.target.value); setDetail(''); setPage(1) }}><option value="">All sources</option>{(catalogs.voiceSources ?? []).map((item) => <option key={item.id} value={item.label}>{compactSource(item.label)}</option>)}</select>
      <select aria-label="Filter by source detail" value={detail} onChange={(event) => { setDetail(event.target.value); setPage(1) }}><option value="">All details</option>{sourceDetails.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <label className="date-filter"><span>From</span><input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} aria-label="Feedback date from" /></label>
      <label className="date-filter"><span>To</span><input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1) }} aria-label="Feedback date to" /></label>
      <select aria-label="Filter by processing status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option>{['Unprocessed', 'Queued', 'Processing', 'Processed', 'Needs review', 'Failed'].map((item) => <option key={item}>{item}</option>)}</select>
      {hasFilters && <button className="clear-filter-button" onClick={clearFilters}><FilterX size={14} /> Clear</button>}
    </div>

    <div className="table-frame raw-table-frame">
      <table className="data-table raw-table">
        <thead><tr>
          <th className="raw-text-heading">Customer statement</th>
          <SortableHeader label="Source" field="voice_source" selected={sortKey} direction={sortDirection} onSort={updateSort} />
          <SortableHeader label="Source detail" field="source_detail" selected={sortKey} direction={sortDirection} onSort={updateSort} />
          <SortableHeader label="Received" field="feedback_at" selected={sortKey} direction={sortDirection} onSort={updateSort} />
          <SortableHeader label="Processing status" field="processing_status" selected={sortKey} direction={sortDirection} onSort={updateSort} />
          <th aria-label="Open details" className="icon-column" />
        </tr></thead>
        <tbody>
          {visible.map((review) => <tr key={review.id} className="review-row" tabIndex={0} onClick={() => openReview(review)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReview(review) } }} aria-label={`Open review ${review.id}`}>
            <td className="raw-text-cell"><p className="raw-quote">{review.raw_text}</p><span className="row-id">{review.id}</span></td>
            <td><span className="source-label"><SourceGlyph source={review.voice_source} />{compactSource(review.voice_source)}</span></td>
            <td className="muted-cell">{review.source_detail}</td>
            <td className="date-cell">{formatDate(review.feedback_at)}</td>
            <td><StatusPill status={review.processing_status} compact /></td>
            <td className="open-cell"><button className="row-open" tabIndex={-1} aria-hidden="true">↗</button></td>
          </tr>)}
        </tbody>
      </table>
      {!visible.length && <div className="empty-table"><div className="empty-icon"><Search size={19} /></div><h3>{hasFilters ? 'No reviews match these filters' : 'No reviews yet'}</h3><p>{hasFilters ? 'Try adjusting the search or clearing one of the selected filters.' : 'The synthetic proxy statements will appear here once Firestore is connected.'}</p>{hasFilters && <button className="button-secondary" onClick={clearFilters}>Clear filters</button>}</div>}
      {visible.length > 0 && <div className="table-footer"><span>Showing <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length.toLocaleString()}</strong> reviews</span><Pagination page={page} maxPage={maxPage} setPage={setPage} /></div>}
    </div>
  </section>
}

function Metric({ icon, label, value, detail, tone = 'neutral' }: { icon: ReactNode; label: string; value: number; detail: string; tone?: string }) {
  return <div className={`metric-item metric-${tone}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span></div><div className="metric-value">{value.toLocaleString()}</div><div className="metric-detail">{detail}</div></div>
}

export function Pagination({ page, maxPage, setPage }: { page: number; maxPage: number; setPage: (page: number) => void }) {
  return <div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={16} /></button><span><strong>{page}</strong><i>/</i>{maxPage}</span><button aria-label="Next page" disabled={page >= maxPage} onClick={() => setPage(Math.min(maxPage, page + 1))}><ChevronRight size={16} /></button></div>
}

function SortableHeader({ label, field, selected, direction, onSort }: { label: string; field: SortKey; selected: SortKey; direction: 'asc' | 'desc'; onSort: (field: SortKey) => void }) {
  const active = selected === field
  const icon = !active ? <ArrowUpDown size={12} /> : direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  return <th><button className={`sort-header ${active ? 'sort-active' : ''}`} onClick={() => onSort(field)}>{label}{icon}</button></th>
}

export function SourceGlyph({ source }: { source: string }) {
  const initial = source === 'Customer-service phone call' ? 'CS' : source === 'Brand website / e-commerce' ? 'WEB' : source.slice(0, 1).toUpperCase()
  return <span className={`source-glyph source-${source.toLowerCase().replace(/[^a-z]+/g, '-')}`} aria-hidden="true">{initial}</span>
}
