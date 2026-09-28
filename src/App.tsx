import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { AlertCircle, ArrowRight, CircleHelp, Database, FileText, Inbox, LoaderCircle, LogOut, RefreshCw, Tags } from 'lucide-react'
import { auth, firebaseConfigured, googleProvider } from './firebase'
import { ensureSeedData, listenCatalogs, listenClusters, listenLastRun, listenReviews, processReviews, type ProcessProgress } from './data/firestore'
import { ProcessedPage } from './pages/ProcessedPage'
import { ReviewsPage } from './pages/ReviewsPage'
import type { AuditEntry, CatalogValue, ProcessingRun, ReviewRecord, TopicClusterSummary } from './types'
import { listenReviewAudit } from './data/firestore'
import { ReviewDrawer } from './components/ReviewDrawer'
import { WorkspaceContext, type WorkspaceUser } from './context'

export function App() {
  return <BrowserRouter><AppGate /></BrowserRouter>
}

function AppGate() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const demoUser: WorkspaceUser = { uid: 'browser-demo', displayName: 'Demo' }

  useEffect(() => {
    if (!auth) {
      setAuthReady(true)
      return
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    }, (error) => {
      setAuthError(error.message)
      setAuthReady(true)
    })
  }, [])

  const signIn = async () => {
    if (!auth) return
    setAuthError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in could not be completed.')
    }
  }

  if (!firebaseConfigured) return <Workspace user={demoUser} demoMode />
  if (!authReady) return <CenteredState icon={<LoaderCircle className="spin" />} title="Connecting to Firebase" note="Checking your sign-in session." />
  if (!user) return <SignInCard onSignIn={signIn} error={authError} />
  return <Workspace user={user} />
}

function Workspace({ user, demoMode = false }: { user: WorkspaceUser; demoMode?: boolean }) {
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, CatalogValue[]>>({})
  const [clusters, setClusters] = useState<TopicClusterSummary[]>([])
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
  const clearProcessProgress = useCallback(() => setProcessProgress(null), [])
  const value = useMemo(() => ({
    reviews, catalogs, clusters, lastRun, user, loading, error, processProgress,
    processAll, processOne, openReview: setSelectedReview, clearProcessProgress,
  }), [reviews, catalogs, clusters, lastRun, user, loading, error, processProgress, processAll, processOne, clearProcessProgress])

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
          <div className="breadcrumb"><span>Customer signals</span><span className="breadcrumb-slash">/</span><strong>{location.pathname === '/processed' ? 'Processed' : 'Reviews'}</strong></div>
          <div className="topbar-actions">
            <div className="data-badge"><span className="tiny-dot" /> Dataset: Synthetic proxy</div>
            <div className="topbar-divider" />
            <span className="topbar-user" title={user.email ?? undefined}>{demoMode ? 'Demo' : user.displayName?.split(' ')[0] ?? 'Account'}</span>
            {!demoMode && <button className="icon-button" type="button" title="Sign out" aria-label="Sign out" onClick={() => auth && void signOut(auth)}><LogOut size={16} /></button>}
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
          <Route path="*" element={<Navigate to="/reviews" replace />} />
        </Routes>
        {selectedReview && <ReviewDrawer review={reviews.find((review) => review.id === selectedReview.id) ?? selectedReview} allReviews={reviews} catalogs={catalogs} clusters={clusters} audit={audit} mode={location.pathname === '/processed' ? 'processed' : 'raw'} userId={user.uid} onClose={() => setSelectedReview(null)} onProcess={() => void processOne(selectedReview)} />}
      </main>
    </div>
  </WorkspaceContext.Provider>
}

function SignInCard({ onSignIn, error }: { onSignIn: () => void; error: string }) {
  return <div className="auth-screen"><div className="auth-card">
    <div className="auth-mark">D</div>
    <p className="eyebrow">DELAMI / SIGNALS</p>
    <h1>Sign in to your workbench</h1>
    <p className="auth-copy">Review customer feedback, inspect evidence, and validate annotations.</p>
    <button className="google-button" onClick={onSignIn}><GoogleGlyph /> Continue with Google <ArrowRight size={16} /></button>
    {error && <p className="auth-error" role="alert">{friendlyError(error)}</p>}
    <div className="auth-footnote"><span className="tiny-dot" /> Firebase sign-in protects the review workspace.</div>
  </div></div>
}

function CenteredState({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return <div className="centered-state"><div className="state-icon">{icon}</div><h2>{title}</h2><p>{note}</p></div>
}

function GoogleGlyph() {
  return <svg aria-hidden="true" className="google-glyph" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.74 7.18l7.64 5.93c4.46-4.13 7.14-10.2 7.14-17.58Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.96 23.96 0 0 0 0 24c0 3.88.93 7.55 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.64-5.93c-2.13 1.45-4.85 2.3-8.26 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
}

function friendlyError(message: string) {
  if (/permission|insufficient/i.test(message)) return 'Firestore denied access. Enable Google sign-in and apply the authenticated rules in firestore.rules.'
  if (/auth/i.test(message) && /unauthorized-domain/i.test(message)) return 'Add this local address to Firebase Authentication’s authorized domains, then try again.'
  return message
}
