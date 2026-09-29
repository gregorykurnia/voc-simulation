import { createContext, useContext } from 'react'
import type { ProcessProgress } from './data/firestore'
import type { CaseTriage, CatalogValue, CustomerCase, ProcessingRun, ReviewRecord, TopicClusterSummary } from './types'

export interface WorkspaceUser {
  uid: string
  email?: string | null
  displayName?: string | null
}

export interface WorkspaceContextValue {
  reviews: ReviewRecord[]
  catalogs: Record<string, CatalogValue[]>
  clusters: TopicClusterSummary[]
  cases: CustomerCase[]
  lastRun: ProcessingRun | null
  user: WorkspaceUser
  loading: boolean
  error: string
  processProgress: ProcessProgress | null
  processAll: () => Promise<void>
  processOne: (review: ReviewRecord) => Promise<void>
  openReview: (review: ReviewRecord) => void
  createCaseFromReview: (review: ReviewRecord, triage: CaseTriage) => Promise<CustomerCase>
  clearProcessProgress: () => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace context is missing.')
  return context
}
