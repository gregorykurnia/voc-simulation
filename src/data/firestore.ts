import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import { catalogs, topicClusters } from './taxonomy'
import { seedByChannel, seedStatementCount } from './seedStatements'
import { annotateReview } from '../processor'
import type { Annotation, AuditEntry, CaseEvent, CaseMessage, CaseTriage, CatalogValue, CustomerCase, ProcessingRun, ReviewRecord, SLAPolicy, TopicClusterSummary } from '../types'

interface DemoStore {
  reviews: ReviewRecord[]
  catalogs: Record<string, CatalogValue[]>
  clusters: TopicClusterSummary[]
  lastRun: ProcessingRun | null
  audits: AuditEntry[]
  cases: CustomerCase[]
  caseEvents: CaseEvent[]
  caseMessages: CaseMessage[]
}

const demoStorageKey = 'delami-signals-demo-v1'
let demoStore: DemoStore | null = null
const demoListeners = new Set<() => void>()

function database() {
  if (!db) throw new Error('Firebase is not configured. Add the VITE_FIREBASE values before opening the app.')
  return db
}

function readDemoStore(): DemoStore | null {
  try {
    const raw = window.localStorage.getItem(demoStorageKey)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<DemoStore>
    if (!Array.isArray(value.reviews) || !value.catalogs || !Array.isArray(value.clusters)) return null
    return {
      reviews: value.reviews,
      catalogs: value.catalogs,
      clusters: value.clusters,
      lastRun: value.lastRun ?? null,
      audits: value.audits ?? [],
      cases: value.cases ?? [],
      caseEvents: value.caseEvents ?? [],
      caseMessages: value.caseMessages ?? [],
    }
  } catch {
    return null
  }
}

function currentDemoStore() {
  if (!demoStore) demoStore = readDemoStore() ?? createDemoStore()
  return demoStore
}

function createDemoStore(): DemoStore {
  if (seedStatementCount !== 275) throw new Error(`Seed data contains ${seedStatementCount} statements; expected 275.`)
  const epoch = Date.UTC(2026, 5, 1)
  let index = 0
  const reviews = seedByChannel.flatMap((group) => group.statements.map((statement) => {
    const currentIndex = index++
    const feedbackAt = new Date(epoch + ((currentIndex * 37) % 120) * 86400000 + ((currentIndex * 13) % 24) * 3600000)
    return {
      id: `VOC-2026-${String(currentIndex + 1).padStart(3, '0')}`,
      raw_text: statement,
      voice_source: group.voice_source,
      source_detail: group.details[(currentIndex * 7 + Math.floor(currentIndex / 3)) % group.details.length],
      feedback_at: feedbackAt.toISOString(),
      language: 'id',
      locale: 'id-ID',
      synthetic: true as const,
      processing_status: 'Unprocessed' as const,
      updated_at: new Date().toISOString(),
    }
  }))
  return {
    reviews,
    catalogs: Object.fromEntries(Object.entries(catalogs).map(([key, values]) => [key, values.map((value) => ({ ...value }))])),
    clusters: topicClusters.map((cluster) => ({ ...cluster, review_count: 0, sentiment_mix: {}, representative_review_ids: [] })),
    lastRun: null,
    audits: [],
    cases: [],
    caseEvents: [],
    caseMessages: [],
  }
}

function saveDemoStore(nextStore: DemoStore) {
  demoStore = nextStore
  try {
    window.localStorage.setItem(demoStorageKey, JSON.stringify(nextStore))
  } catch {
    // Keep the current session usable if browser storage is unavailable or full.
  }
  demoListeners.forEach((notify) => notify())
}

function listenToDemo(onChange: () => void): Unsubscribe {
  demoListeners.add(onChange)
  onChange()
  return () => demoListeners.delete(onChange)
}

export async function ensureSeedData() {
  if (!db) {
    if (demoStore || readDemoStore()) {
      demoStore ??= readDemoStore()
      return false
    }
    saveDemoStore(createDemoStore())
    return true
  }
  const firestore = database()
  if (seedStatementCount !== 275) throw new Error(`Seed data contains ${seedStatementCount} statements; expected 275.`)
  const seedMarker = doc(firestore, 'meta', 'seed-v1')
  if ((await getDoc(seedMarker)).exists()) return false

  const batch = writeBatch(firestore)
  const epoch = Date.UTC(2026, 5, 1)
  let index = 0
  for (const group of seedByChannel) {
    for (const statement of group.statements) {
      const id = `VOC-2026-${String(index + 1).padStart(3, '0')}`
      const detail = group.details[(index * 7 + Math.floor(index / 3)) % group.details.length]
      const feedbackAt = new Date(epoch + ((index * 37) % 120) * 86400000 + ((index * 13) % 24) * 3600000)
      batch.set(doc(firestore, 'reviews', id), {
        id,
        raw_text: statement,
        voice_source: group.voice_source,
        source_detail: detail,
        feedback_at: feedbackAt.toISOString(),
        language: 'id',
        locale: 'id-ID',
        synthetic: true,
        processing_status: 'Unprocessed',
        updated_at: new Date().toISOString(),
      })
      index += 1
    }
  }

  for (const [catalogId, values] of Object.entries(catalogs)) {
    batch.set(doc(firestore, 'catalogs', catalogId), { values, version: 'taxonomy-v1.0', updated_at: new Date().toISOString() })
  }
  for (const cluster of topicClusters) {
    batch.set(doc(firestore, 'clusters', cluster.id), { ...cluster, review_count: 0, sentiment_mix: {}, representative_review_ids: [] })
  }
  batch.set(seedMarker, { version: 'seed-v1', record_count: index, synthetic: true, created_at: new Date().toISOString() })
  await batch.commit()
  return true
}

export function listenReviews(onChange: (reviews: ReviewRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange([...currentDemoStore().reviews].sort((a, b) => b.feedback_at.localeCompare(a.feedback_at))))
  return onSnapshot(query(collection(database(), 'reviews')), (snapshot) => {
    const reviews = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as ReviewRecord))
    reviews.sort((a, b) => b.feedback_at.localeCompare(a.feedback_at))
    onChange(reviews)
  }, (error) => onError(error))
}

export const slaPolicies: SLAPolicy[] = [
  { id: 'critical', label: 'Critical', first_response_minutes: 60, resolution_minutes: 240, pause_statuses: ['Pending customer'], escalation_minutes_before_due: 30 },
  { id: 'high', label: 'High', first_response_minutes: 120, resolution_minutes: 480, pause_statuses: ['Pending customer'], escalation_minutes_before_due: 60 },
  { id: 'normal', label: 'Normal', first_response_minutes: 240, resolution_minutes: 1440, pause_statuses: ['Pending customer'], escalation_minutes_before_due: 120 },
  { id: 'low', label: 'Low', first_response_minutes: 480, resolution_minutes: 2880, pause_statuses: ['Pending customer'], escalation_minutes_before_due: 240 },
]

export function listenCases(onChange: (cases: CustomerCase[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange([...currentDemoStore().cases].sort((a, b) => b.updated_at.localeCompare(a.updated_at))))
  return onSnapshot(query(collection(database(), 'cases'), orderBy('updated_at', 'desc')), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as CustomerCase)))
  }, onError)
}

export function listenCaseEvents(caseId: string, onChange: (events: CaseEvent[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange(currentDemoStore().caseEvents.filter((event) => event.case_id === caseId).sort((a, b) => a.created_at.localeCompare(b.created_at))))
  return onSnapshot(query(collection(database(), 'caseEvents'), where('case_id', '==', caseId)), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as CaseEvent)).sort((a, b) => a.created_at.localeCompare(b.created_at)))
  }, onError)
}

export function listenCaseMessages(caseId: string, onChange: (messages: CaseMessage[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange(currentDemoStore().caseMessages.filter((message) => message.case_id === caseId).sort((a, b) => a.created_at.localeCompare(b.created_at))))
  return onSnapshot(query(collection(database(), 'caseMessages'), where('case_id', '==', caseId)), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as CaseMessage)).sort((a, b) => a.created_at.localeCompare(b.created_at)))
  }, onError)
}

export async function createCustomerCase(review: ReviewRecord, triage: CaseTriage, userId: string) {
  const now = new Date()
  const policy = slaPolicies.find((item) => item.id === triage.sla_policy_suggestion) ?? slaPolicies[2]
  const createdAt = now.toISOString()
  const addMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60000).toISOString()
  const caseId = `CASE-${now.getUTCFullYear()}-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
  const status: CustomerCase['status'] = triage.risk_flags.length
    ? 'Needs supervisor review'
    : triage.case_eligibility === 'Needs review' || triage.confidence < 0.6
      ? 'Needs triage'
      : 'In review'
  const customerCase: CustomerCase = {
    id: caseId,
    status,
    priority: triage.priority_suggestion,
    subject: `${triage.issue_type}: ${review.raw_text.slice(0, 82)}${review.raw_text.length > 82 ? '…' : ''}`,
    review_ids: [review.id],
    primary_review_id: review.id,
    customer_reference: null,
    source_channel: review.voice_source,
    brand: triage.brand,
    product_category: triage.product_category,
    issue_type: triage.issue_type,
    store_id: review.annotation?.store_id ?? null,
    owner_user_id: null,
    owner_team: triage.suggested_team,
    supervisor_user_id: null,
    sla_policy_id: policy.id,
    first_response_due_at: addMinutes(policy.first_response_minutes),
    resolution_due_at: addMinutes(policy.resolution_minutes),
    first_response_at: null,
    resolved_at: null,
    closed_at: null,
    ai_triage: triage,
    resolution: null,
    learning: null,
    created_at: createdAt,
    updated_at: createdAt,
    last_activity_at: createdAt,
  }
  const event = makeCaseEvent(caseId, 'Created', `Case created from ${review.id} · ${status}`, userId, createdAt)
  const message: CaseMessage = {
    id: `${caseId}-MSG-1`,
    case_id: caseId,
    direction: 'Inbound',
    channel: review.voice_source,
    body: review.raw_text,
    author_user_id: 'customer',
    created_at: review.feedback_at,
    delivery_state: 'Delivered',
  }

  if (!db) {
    const store = currentDemoStore()
    saveDemoStore({ ...store, cases: [customerCase, ...store.cases], caseEvents: [...store.caseEvents, event], caseMessages: [...store.caseMessages, message] })
    return customerCase
  }
  const firestore = database()
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, 'cases', caseId), customerCase)
  batch.set(doc(firestore, 'caseEvents', event.id), event)
  batch.set(doc(firestore, 'caseMessages', message.id), message)
  await batch.commit()
  return customerCase
}

export async function updateCustomerCase(
  caseId: string,
  changes: Partial<Omit<CustomerCase, 'id' | 'created_at'>>,
  userId: string,
  eventType: CaseEvent['type'],
  summary: string,
) {
  const updatedAt = new Date().toISOString()
  const event = makeCaseEvent(caseId, eventType, summary, userId, updatedAt)
  if (!db) {
    const store = currentDemoStore()
    const found = store.cases.some((item) => item.id === caseId)
    if (!found) throw new Error('This case is no longer available.')
    const cases = store.cases.map((item) => item.id === caseId ? { ...item, ...changes, updated_at: updatedAt, last_activity_at: updatedAt } : item)
    saveDemoStore({ ...store, cases, caseEvents: [...store.caseEvents, event] })
    return
  }
  const firestore = database()
  const batch = writeBatch(firestore)
  batch.update(doc(firestore, 'cases', caseId), { ...changes, updated_at: updatedAt, last_activity_at: updatedAt })
  batch.set(doc(firestore, 'caseEvents', event.id), event)
  await batch.commit()
}

export async function addCaseMessage(caseId: string, body: string, direction: CaseMessage['direction'], channel: string, userId: string, markFirstResponse = false) {
  const createdAt = new Date().toISOString()
  const message: CaseMessage = {
    id: `MSG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    case_id: caseId,
    direction,
    channel,
    body: body.trim(),
    author_user_id: direction === 'Inbound' ? 'customer' : userId,
    created_at: createdAt,
    delivery_state: direction === 'Outbound' ? 'Sent' : direction === 'Internal note' ? 'Not sent' : 'Delivered',
  }
  const eventType: CaseEvent['type'] = direction === 'Internal note' ? 'Note' : 'Customer notification'
  const summary = direction === 'Internal note' ? 'Internal note added' : direction === 'Outbound' ? `Customer response recorded via ${channel}` : `Customer follow-up received via ${channel}`
  const event = makeCaseEvent(caseId, eventType, summary, userId, createdAt)
  const changes = direction === 'Outbound' && markFirstResponse ? { first_response_at: createdAt } : {}
  if (!db) {
    const store = currentDemoStore()
    const found = store.cases.some((item) => item.id === caseId)
    if (!found) throw new Error('This case is no longer available.')
    const cases = store.cases.map((item) => item.id === caseId ? { ...item, ...changes, updated_at: createdAt, last_activity_at: createdAt } : item)
    saveDemoStore({ ...store, cases, caseEvents: [...store.caseEvents, event], caseMessages: [...store.caseMessages, message] })
    return
  }
  const firestore = database()
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, 'caseMessages', message.id), message)
  batch.set(doc(firestore, 'caseEvents', event.id), event)
  batch.update(doc(firestore, 'cases', caseId), { ...changes, updated_at: createdAt, last_activity_at: createdAt })
  await batch.commit()
}

function makeCaseEvent(caseId: string, type: CaseEvent['type'], summary: string, userId: string, createdAt = new Date().toISOString(), details?: CaseEvent['details']): CaseEvent {
  return { id: `EVENT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, case_id: caseId, type, summary, actor_user_id: userId, created_at: createdAt, details }
}

export function listenCatalogs(onChange: (catalogData: Record<string, CatalogValue[]>) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange(currentDemoStore().catalogs))
  return onSnapshot(collection(database(), 'catalogs'), (snapshot) => {
    const result: Record<string, CatalogValue[]> = {}
    snapshot.docs.forEach((item) => {
      const values = (item.data() as { values?: DocumentData[] }).values ?? []
      result[item.id] = values as CatalogValue[]
    })
    onChange(result)
  }, onError)
}

export function listenClusters(onChange: (clusters: TopicClusterSummary[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange(currentDemoStore().clusters))
  return onSnapshot(collection(database(), 'clusters'), (snapshot) => {
    const clusters = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as TopicClusterSummary))
    onChange(clusters.sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0)))
  }, onError)
}

export function listenLastRun(onChange: (run: ProcessingRun | null) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange(currentDemoStore().lastRun))
  return onSnapshot(doc(database(), 'meta', 'last-processing-run'), (snapshot) => {
    onChange(snapshot.exists() ? snapshot.data() as ProcessingRun : null)
  }, onError)
}

export function listenReviewAudit(reviewId: string, onChange: (entries: AuditEntry[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) return listenToDemo(() => onChange(currentDemoStore().audits.filter((entry) => entry.review_id === reviewId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12)))
  const auditQuery = query(collection(database(), 'auditLog'), where('review_id', '==', reviewId), orderBy('created_at', 'desc'), limit(12))
  return onSnapshot(auditQuery, (snapshot) => onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as AuditEntry))), onError)
}

export interface ProcessProgress {
  completed: number
  total: number
  state: 'Queued' | 'Processing' | 'Completed'
}

export async function processReviews(
  targets: ReviewRecord[],
  allReviews: ReviewRecord[],
  userId: string,
  onProgress: (progress: ProcessProgress) => void,
) {
  if (!db) return processReviewsInDemo(targets, onProgress)
  const firestore = database()
  const runId = `RUN-${Date.now()}`
  const startedAt = new Date().toISOString()
  const queuedBatch = writeBatch(firestore)
  targets.forEach((review) => queuedBatch.update(doc(firestore, 'reviews', review.id), { processing_status: 'Queued', updated_at: new Date().toISOString() }))
  await queuedBatch.commit()
  onProgress({ completed: 0, total: targets.length, state: 'Queued' })

  const freshAnnotations = new Map<string, Annotation>()
  const finishedReviewIds = new Set<string>()
  const chunkSize = 32
  try {
    for (let start = 0; start < targets.length; start += chunkSize) {
      const chunk = targets.slice(start, start + chunkSize)
      const inFlight = writeBatch(firestore)
      chunk.forEach((review) => inFlight.update(doc(firestore, 'reviews', review.id), { processing_status: 'Processing', updated_at: new Date().toISOString() }))
      await inFlight.commit()
      onProgress({ completed: start, total: targets.length, state: 'Processing' })
      await new Promise((resolve) => window.setTimeout(resolve, 85))

      const results = chunk.map((review) => ({ review, annotation: annotateReview(review) }))
      const completedBatch = writeBatch(firestore)
      results.forEach(({ review, annotation }) => {
        freshAnnotations.set(review.id, annotation)
        completedBatch.update(doc(firestore, 'reviews', review.id), {
          annotation,
          processing_status: annotation.review_state === 'Needs clarification' ? 'Needs review' : 'Processed',
          updated_at: new Date().toISOString(),
        })
      })
      await completedBatch.commit()
      results.forEach(({ review }) => finishedReviewIds.add(review.id))
      onProgress({ completed: Math.min(start + chunk.length, targets.length), total: targets.length, state: 'Processing' })
    }
  } catch (error) {
    const failedBatch = writeBatch(firestore)
    targets.filter((review) => !finishedReviewIds.has(review.id)).forEach((review) => failedBatch.update(doc(firestore, 'reviews', review.id), { processing_status: 'Failed', updated_at: new Date().toISOString() }))
    await failedBatch.commit()
    throw error
  }

  const aggregateRecords: ReviewRecord[] = []
  allReviews.forEach((review) => {
    const annotation = freshAnnotations.get(review.id) ?? review.annotation
    if (annotation && !annotation.excluded_from_clustering) aggregateRecords.push({ ...review, annotation })
  })
  const aggregates = new Map<string, ReviewRecord[]>()
  aggregateRecords.forEach((review) => {
    const clusterId = review.annotation!.cluster_id
    aggregates.set(clusterId, [...(aggregates.get(clusterId) ?? []), review])
  })
  const totalNeedsReview = [...freshAnnotations.values()].filter((annotation) => annotation.review_state === 'Needs clarification').length
  const run: ProcessingRun = {
    id: runId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    processed_count: targets.length,
    needs_review_count: totalNeedsReview,
    model_version: 'Rules v1.0',
    prompt_version: 'Taxonomy v1.0',
    method: 'Rule-based annotation',
  }
  const finalBatch = writeBatch(firestore)
  for (const cluster of topicClusters) {
    const members = aggregates.get(cluster.id) ?? []
    const sentimentMix: Record<string, number> = {}
    members.forEach((review) => {
      const sentiment = review.annotation!.sentiment
      sentimentMix[sentiment] = (sentimentMix[sentiment] ?? 0) + 1
    })
    finalBatch.set(doc(firestore, 'clusters', cluster.id), {
      ...cluster,
      review_count: members.length,
      sentiment_mix: sentimentMix,
      dominant_issues: mostCommon(members.map((review) => review.annotation!.issue_type)),
      dominant_products: mostCommon(members.map((review) => review.annotation!.product_category).filter((value): value is string => Boolean(value))),
      representative_review_ids: members.slice(0, 5).map((review) => review.id),
      updated_at: new Date().toISOString(),
    })
  }
  finalBatch.set(doc(firestore, 'processingRuns', runId), { ...run, user_id: userId, status: 'Completed' })
  finalBatch.set(doc(firestore, 'meta', 'last-processing-run'), run)
  await finalBatch.commit()
  onProgress({ completed: targets.length, total: targets.length, state: 'Completed' })
  return run
}

async function processReviewsInDemo(targets: ReviewRecord[], onProgress: (progress: ProcessProgress) => void) {
  const targetIds = new Set(targets.map((review) => review.id))
  let store = currentDemoStore()
  saveDemoStore({ ...store, reviews: store.reviews.map((review) => targetIds.has(review.id) ? { ...review, processing_status: 'Queued', updated_at: new Date().toISOString() } : review) })
  onProgress({ completed: 0, total: targets.length, state: 'Queued' })

  const freshAnnotations = new Map<string, Annotation>()
  const chunkSize = 32
  for (let start = 0; start < targets.length; start += chunkSize) {
    const chunk = targets.slice(start, start + chunkSize)
    const chunkIds = new Set(chunk.map((review) => review.id))
    store = currentDemoStore()
    saveDemoStore({ ...store, reviews: store.reviews.map((review) => chunkIds.has(review.id) ? { ...review, processing_status: 'Processing', updated_at: new Date().toISOString() } : review) })
    onProgress({ completed: start, total: targets.length, state: 'Processing' })
    await new Promise((resolve) => window.setTimeout(resolve, 30))

    const results = chunk.map((review) => ({ review, annotation: annotateReview(currentDemoStore().reviews.find((item) => item.id === review.id) ?? review) }))
    results.forEach(({ review, annotation }) => freshAnnotations.set(review.id, annotation))
    store = currentDemoStore()
    saveDemoStore({ ...store, reviews: store.reviews.map((review) => {
      const annotation = freshAnnotations.get(review.id)
      if (!annotation) return review
      return {
        ...review,
        annotation,
        processing_status: annotation.review_state === 'Needs clarification' ? 'Needs review' : 'Processed',
        updated_at: new Date().toISOString(),
      }
    }) })
    onProgress({ completed: Math.min(start + chunk.length, targets.length), total: targets.length, state: 'Processing' })
  }

  const completedAt = new Date().toISOString()
  const run: ProcessingRun = {
    id: `RUN-${Date.now()}`,
    started_at: completedAt,
    completed_at: completedAt,
    processed_count: targets.length,
    needs_review_count: [...freshAnnotations.values()].filter((annotation) => annotation.review_state === 'Needs clarification').length,
    model_version: 'Rules v1.0',
    prompt_version: 'Taxonomy v1.0',
    method: 'Rule-based annotation',
  }
  store = currentDemoStore()
  const reviews = store.reviews
  saveDemoStore({ ...store, lastRun: run, clusters: summarizeClusters(reviews), reviews })
  onProgress({ completed: targets.length, total: targets.length, state: 'Completed' })
  return run
}

export async function saveAnnotation(review: ReviewRecord, annotation: Annotation, userId: string, change: string, allReviews: ReviewRecord[]) {
  if (!db) {
    const reviewedAnnotation: Annotation = {
      ...annotation,
      assignment_method: 'Human-reviewed',
      review_state: change === 'validated' ? 'Validated' : 'Needs clarification',
      confidence: change === 'validated' ? 1 : annotation.confidence,
    }
    saveDemoAnnotation(review, reviewedAnnotation, userId, change, change === 'validated' ? 'Processed' : 'Needs review')
    return
  }
  const firestore = database()
  const batch = writeBatch(firestore)
  const reviewedAnnotation: Annotation = {
    ...annotation,
    assignment_method: 'Human-reviewed',
    review_state: change === 'validated' ? 'Validated' : 'Needs clarification',
    confidence: change === 'validated' ? 1 : annotation.confidence,
  }
  batch.update(doc(firestore, 'reviews', review.id), {
    annotation: reviewedAnnotation,
    processing_status: change === 'validated' ? 'Processed' : 'Needs review',
    updated_at: new Date().toISOString(),
  })
  const audit = doc(collection(firestore, 'auditLog'))
  batch.set(audit, {
    review_id: review.id,
    action: change,
    user_id: userId,
    before: review.annotation ?? null,
    after: reviewedAnnotation,
    created_at: new Date().toISOString(),
  })
  addClusterSummaryUpdates(batch, allReviews, review.id, reviewedAnnotation)
  await batch.commit()
}

export async function addCorrectionAudit(review: ReviewRecord, annotation: Annotation, userId: string, action: string, allReviews: ReviewRecord[]) {
  if (!db) {
    saveDemoAnnotation(review, annotation, userId, action, annotation.review_state === 'Validated' ? 'Processed' : review.processing_status)
    return
  }
  const firestore = database()
  const batch = writeBatch(firestore)
  batch.update(doc(firestore, 'reviews', review.id), { annotation, processing_status: annotation.review_state === 'Validated' ? 'Processed' : review.processing_status, updated_at: new Date().toISOString() })
  const audit = doc(collection(firestore, 'auditLog'))
  batch.set(audit, { review_id: review.id, action, user_id: userId, before: review.annotation ?? null, after: annotation, created_at: new Date().toISOString() })
  addClusterSummaryUpdates(batch, allReviews, review.id, annotation)
  await batch.commit()
}

export async function updateReviewStatus(reviewId: string, status: ReviewRecord['processing_status']) {
  if (!db) {
    const store = currentDemoStore()
    saveDemoStore({ ...store, reviews: store.reviews.map((review) => review.id === reviewId ? { ...review, processing_status: status, updated_at: new Date().toISOString() } : review) })
    return
  }
  await updateDoc(doc(database(), 'reviews', reviewId), { processing_status: status, updated_at: new Date().toISOString() })
}

function saveDemoAnnotation(review: ReviewRecord, annotation: Annotation, userId: string, action: string, status: ReviewRecord['processing_status']) {
  const store = currentDemoStore()
  const updatedAt = new Date().toISOString()
  const reviews = store.reviews.map((item) => item.id === review.id ? { ...item, annotation, processing_status: status, updated_at: updatedAt } : item)
  const audit: AuditEntry = {
    id: `DEMO-AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    review_id: review.id,
    action,
    user_id: userId,
    before: review.annotation ?? null,
    after: annotation,
    created_at: updatedAt,
  }
  saveDemoStore({ ...store, reviews, clusters: summarizeClusters(reviews), audits: [audit, ...store.audits] })
}

function summarizeClusters(reviews: ReviewRecord[]): TopicClusterSummary[] {
  const membersByCluster = new Map<string, ReviewRecord[]>()
  reviews.forEach((review) => {
    if (!review.annotation || review.annotation.excluded_from_clustering) return
    const clusterId = review.annotation.cluster_id
    membersByCluster.set(clusterId, [...(membersByCluster.get(clusterId) ?? []), review])
  })
  return topicClusters.map((cluster) => {
    const members = membersByCluster.get(cluster.id) ?? []
    const sentimentMix: Record<string, number> = {}
    members.forEach((review) => {
      const sentiment = review.annotation!.sentiment
      sentimentMix[sentiment] = (sentimentMix[sentiment] ?? 0) + 1
    })
    return {
      ...cluster,
      review_count: members.length,
      sentiment_mix: sentimentMix,
      dominant_issues: mostCommon(members.map((review) => review.annotation!.issue_type)),
      dominant_products: mostCommon(members.map((review) => review.annotation!.product_category).filter((value): value is string => Boolean(value))),
      representative_review_ids: members.slice(0, 5).map((review) => review.id),
    }
  }).sort((a, b) => b.review_count - a.review_count)
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label]) => label)
}

function addClusterSummaryUpdates(batch: ReturnType<typeof writeBatch>, reviews: ReviewRecord[], changedReviewId: string, changedAnnotation: Annotation) {
  const membersByCluster = new Map<string, ReviewRecord[]>()
  reviews.forEach((review) => {
    const annotation = review.id === changedReviewId ? changedAnnotation : review.annotation
    if (!annotation || annotation.excluded_from_clustering) return
    membersByCluster.set(annotation.cluster_id, [...(membersByCluster.get(annotation.cluster_id) ?? []), { ...review, annotation }])
  })

  for (const cluster of topicClusters) {
    const members = membersByCluster.get(cluster.id) ?? []
    const sentimentMix: Record<string, number> = {}
    members.forEach((review) => {
      const sentiment = review.annotation!.sentiment
      sentimentMix[sentiment] = (sentimentMix[sentiment] ?? 0) + 1
    })
    batch.set(doc(database(), 'clusters', cluster.id), {
      ...cluster,
      review_count: members.length,
      sentiment_mix: sentimentMix,
      dominant_issues: mostCommon(members.map((review) => review.annotation!.issue_type)),
      dominant_products: mostCommon(members.map((review) => review.annotation!.product_category).filter((value): value is string => Boolean(value))),
      representative_review_ids: members.slice(0, 5).map((review) => review.id),
      updated_at: new Date().toISOString(),
    })
  }
}
