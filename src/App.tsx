import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { AlertCircle, BriefcaseBusiness, CircleHelp, Database, FileText, Inbox, LoaderCircle, RefreshCw, Tags } from 'lucide-react'
import { auth, disableFirestoreData } from './firebase'
import { createCustomerCase, ensureSeedData, listenCases, listenCatalogs, listenClusters, listenLastRun, listenReviews, processReviews, type ProcessProgress } from './data/firestore'
import { triageReview } from './caseTriage'
import { CasesPage } from './pages/CasesPage'
import { ProcessedPage } from './pages/ProcessedPage'
import { ReviewsPage } from './pages/ReviewsPage'
import type { AuditEntry, CatalogValue, CustomerCase, ProcessingRun, ReviewRecord, TopicClusterSummary } from './types'
import { listenReviewAudit } from './data/firestore'
import { ReviewDrawer } from './components/ReviewDrawer'
import { WorkspaceContext, type WorkspaceUser } from './context'

export function App() {
  return <BrowserRouter><AppGate /></BrowserRouter>
}

function AppGate() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [demoMode, setDemoMode] = useState(!auth)
  const demoUser: WorkspaceUser = { uid: 'browser-demo', displayName: 'Demo' }

  useEffect(() => {
    const firebaseAuth = auth
    if (!firebaseAuth) {
      setAuthReady(true)
      return
    }
    let cancelled = false
    let anonymousSignInStarted = false
    const useDemoMode = () => {
      disableFirestoreData()
      setUser(null)
      setDemoMode(true)
      setAuthReady(true)
    }
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (cancelled) return
      if (nextUser) {
        setUser(nextUser)
        setDemoMode(false)
        setAuthReady(true)
        return
      }
      if (anonymousSignInStarted) return
      anonymousSignInStarted = true
      void signInAnonymously(firebaseAuth).catch(() => {
        if (!cancelled) useDemoMode()
      })
    }, () => {
      if (!cancelled) useDemoMode()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  if (!authReady) return <CenteredState icon={<LoaderCircle className="spin" />} title="Preparing the review workbench" note="Loading the synthetic proxy dataset." />
  if (demoMode || !user) return <Workspace user={demoUser} demoMode />
  return <Workspace user={user} />
}

function Workspace({ user, demoMode = false }: { user: WorkspaceUser; demoMode?: boolean }) {
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, CatalogValue[]>>({})
  const [clusters, setClusters] = useState<TopicClusterSummary[]>([])
  const [cases, setCases] = useState<CustomerCase[]>([])
  const [lastRun, setLastRun] = useState<ProcessingRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processProgress, setProcessProgress] = useState<ProcessProgress | null>(null)
  const [selectedReview, setSelectedReview] = useState<ReviewRecord | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    const unsubscribers: (() => void)[] = []
    setLoading(true)
    setError('')
    ensureSeedData().then(() => {
      if (cancelled) return
      unsubscribers.push(listenReviews(setReviews, (err) => setError(err.message)))
      unsubscribers.push(listenCatalogs(setCatalogs, (err) => setError(err.message)))
      unsubscribers.push(listenClusters(setClusters, (err) => setError(err.message)))
      unsubscribers.push(listenCases(setCases, (err) => setError(err.message)))
      unsubscribers.push(listenLastRun(setLastRun, (err) => setError(err.message)))
      setLoading(false)
    }).catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Could not read the Firestore database.')
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [user.uid])

  useEffect(() => {
    setSelectedReview(null)
  }, [location.pathname])

  useEffect(() => {
    if (!selectedReview) {
      setAudit([])
      return
    }
    return listenReviewAudit(selectedReview.id, setAudit, () => setAudit([]))
  }, [selectedReview?.id])

  const processTargets = useCallback(async (targets: ReviewRecord[]) => {
    if (!targets.length) return
    setError('')
    try {
      await processReviews(targets, reviews, user.uid, setProcessProgress)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing stopped. Please retry the affected reviews.')
    }
  }, [reviews, user.uid])

  const processAll = useCallback(async () => {
    const targets = reviews.filter((review) => ['Unprocessed', 'Failed'].includes(review.processing_status))
    await processTargets(targets)
  }, [processTargets, reviews])

  const processOne = useCallback(async (review: ReviewRecord) => processTargets([review]), [processTargets])
  const createCaseFromReview = useCallback(async (review: ReviewRecord, triage = triageReview(review)) => {
    const existing = cases.find((customerCase) => customerCase.review_ids.includes(review.id))
    if (existing) return existing
    return createCustomerCase(review, triage, user.uid)
  }, [cases, user.uid])
  const clearProcessProgress = useCallback(() => setProcessProgress(null), [])
  const value = useMemo(() => ({
    reviews, catalogs, clusters, cases, lastRun, user, loading, error, processProgress,
    processAll, processOne, openReview: setSelectedReview, createCaseFromReview, clearProcessProgress,
  }), [reviews, catalogs, clusters, cases, lastRun, user, loading, error, processProgress, processAll, processOne, createCaseFromReview, clearProcessProgress])

  if (loading && !reviews.length) return <CenteredState icon={<LoaderCircle className="spin" />} title="Preparing the review workbench" note="Connecting catalogs and loading the proxy dataset." />

  return <WorkspaceContext.Provider value={value}>
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" to="/reviews" aria-label="Delami Signals home">
          <span className="brand-mark">D</span>
          <span className="brand-name">DELAMI <span>/</span> SIGNALS</span>
        </Link>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavLink to="/reviews" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Inbox size={17} /><span>Reviews</span><span className="nav-count">{reviews.length || 275}</span></NavLink>
          <NavLink to="/processed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Tags size={17} /><span>Processed</span></NavLink>
          <NavLink to="/cases" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><BriefcaseBusiness size={17} /><span>Cases</span>{cases.filter((customerCase) => !['Resolved', 'Closed'].includes(customerCase.status)).length > 0 && <span className="nav-count">{cases.filter((customerCase) => !['Resolved', 'Closed'].includes(customerCase.status)).length}</span>}</NavLink>
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-section-label">REFERENCE</div>
        <div className="side-reference"><Database size={15} /><span>Taxonomy v1.0</span></div>
        <div className="side-reference"><FileText size={15} /><span>Processing runs</span></div>
        <div className="sidebar-spacer" />
        <div className="synthetic-card"><span className="synthetic-indicator" /><div><strong>Synthetic proxy</strong><span>Fictional seed statements</span></div><CircleHelp size={15} /></div>
        <div className="sidebar-footer"><span>VOC SIMULATION</span><span>v0.1</span></div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>Customer signals</span><span className="breadcrumb-slash">/</span><strong>{location.pathname === '/processed' ? 'Processed' : location.pathname === '/cases' ? 'Customer service cases' : 'Reviews'}</strong></div>
          <div className="topbar-actions">
            <div className="data-badge"><span className="tiny-dot" /> Dataset: Synthetic proxy</div>
            <div className="topbar-divider" />
            <span className="topbar-user" title={user.email ?? undefined}>{demoMode ? 'Demo' : user.displayName?.split(' ')[0] ?? 'Guest'}</span>
          </div>
        </header>
        {processProgress && <div className="global-progress" role="status">
          <div className="progress-copy"><LoaderCircle size={15} className="spin" /><span>{processProgress.state === 'Queued' ? `Queueing ${processProgress.total} reviews` : processProgress.state === 'Completed' ? `Completed ${processProgress.completed} reviews` : `Processing reviews · ${processProgress.completed} of ${processProgress.total}`}</span></div>
          <div className="progress-track"><span style={{ width: `${processProgress.total ? Math.round(processProgress.completed / processProgress.total * 100) : 100}%` }} /></div>
          {processProgress.state === 'Completed' && <button className="progress-dismiss" onClick={() => setProcessProgress(null)}>Dismiss</button>}
        </div>}
        {error && <div className="error-banner" role="alert"><AlertCircle size={17} /><span>{friendlyError(error)}</span><button type="button" className="text-button" onClick={() => window.location.reload()}><RefreshCw size={14} /> Retry</button></div>}
        <Routes>
          <Route path="/" element={<Navigate to="/reviews" replace />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/processed" element={<ProcessedPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="*" element={<Navigate to="/reviews" replace />} />
        </Routes>
        {selectedReview && <ReviewDrawer review={reviews.find((review) => review.id === selectedReview.id) ?? selectedReview} allReviews={reviews} catalogs={catalogs} clusters={clusters} audit={audit} mode={location.pathname === '/processed' ? 'processed' : 'raw'} userId={user.uid} onClose={() => setSelectedReview(null)} onProcess={() => void processOne(selectedReview)} existingCase={cases.find((customerCase) => customerCase.review_ids.includes(selectedReview.id))} onCreateCase={(review) => createCaseFromReview(review)} />}
      </main>
    </div>
  </WorkspaceContext.Provider>
}

function CenteredState({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return <div className="centered-state"><div className="state-icon">{icon}</div><h2>{title}</h2><p>{note}</p></div>
}

function friendlyError(message: string) {
  if (/permission|insufficient/i.test(message)) return 'Firestore denied access. Check the Firebase Authentication and Firestore rules settings.'
  if (/auth/i.test(message) && /unauthorized-domain/i.test(message)) return 'Add this site to Firebase Authentication’s authorized domains, then try again.'
  return message
}
