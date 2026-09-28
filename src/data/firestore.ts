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
import type { Annotation, AuditEntry, CatalogValue, ProcessingRun, ReviewRecord, TopicClusterSummary } from '../types'

function database() {
  if (!db) throw new Error('Firebase is not configured. Add the VITE_FIREBASE values before opening the app.')
  return db
}

export async function ensureSeedData() {
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
  return onSnapshot(query(collection(database(), 'reviews')), (snapshot) => {
    const reviews = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as ReviewRecord))
    reviews.sort((a, b) => b.feedback_at.localeCompare(a.feedback_at))
    onChange(reviews)
  }, (error) => onError(error))
}

export function listenCatalogs(onChange: (catalogData: Record<string, CatalogValue[]>) => void, onError: (error: Error) => void): Unsubscribe {
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
  return onSnapshot(collection(database(), 'clusters'), (snapshot) => {
    const clusters = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as TopicClusterSummary))
    onChange(clusters.sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0)))
  }, onError)
}

export function listenLastRun(onChange: (run: ProcessingRun | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(database(), 'meta', 'last-processing-run'), (snapshot) => {
    onChange(snapshot.exists() ? snapshot.data() as ProcessingRun : null)
  }, onError)
}

export function listenReviewAudit(reviewId: string, onChange: (entries: AuditEntry[]) => void, onError: (error: Error) => void): Unsubscribe {
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

export async function saveAnnotation(review: ReviewRecord, annotation: Annotation, userId: string, change: string, allReviews: ReviewRecord[]) {
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
  const firestore = database()
  const batch = writeBatch(firestore)
  batch.update(doc(firestore, 'reviews', review.id), { annotation, processing_status: annotation.review_state === 'Validated' ? 'Processed' : review.processing_status, updated_at: new Date().toISOString() })
  const audit = doc(collection(firestore, 'auditLog'))
  batch.set(audit, { review_id: review.id, action, user_id: userId, before: review.annotation ?? null, after: annotation, created_at: new Date().toISOString() })
  addClusterSummaryUpdates(batch, allReviews, review.id, annotation)
  await batch.commit()
}

export async function updateReviewStatus(reviewId: string, status: ReviewRecord['processing_status']) {
  await updateDoc(doc(database(), 'reviews', reviewId), { processing_status: status, updated_at: new Date().toISOString() })
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
