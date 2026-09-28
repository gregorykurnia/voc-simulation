export type ProcessingStatus = 'Unprocessed' | 'Queued' | 'Processing' | 'Processed' | 'Needs review' | 'Failed'
export type Sentiment = 'Positive' | 'Neutral' | 'Mixed' | 'Negative'
export type AssignmentMethod = 'Rule-assigned' | 'AI-assigned' | 'Human-reviewed'

export interface Annotation {
  brand: string | null
  product_category: string | null
  product_style_mentioned: string | null
  attributes: string[]
  issue_type: string
  secondary_issues: string[]
  store_id: string | null
  sentiment: Sentiment
  sentiment_confidence: number
  cluster_id: string
  confidence: number
  assignment_method: AssignmentMethod
  review_state: 'Not reviewed' | 'Validated' | 'Needs clarification'
  workflow_status: string
  excluded_from_clustering: boolean
  normalized_text?: string
  processed_at: string
}

export interface ReviewRecord {
  id: string
  raw_text: string
  voice_source: string
  source_detail: string
  feedback_at: string
  synthetic: true
  processing_status: ProcessingStatus
  annotation?: Annotation
  updated_at?: string
}

export interface CatalogValue {
  id: string
  label: string
  active?: boolean
  city?: string
  province?: string
  region?: string
  brand_availability?: string[]
  availability_status?: 'Verified open' | 'Unverified' | 'Closed'
  opened_on?: string | null
  closed_on?: string | null
}

export interface TopicCluster {
  id: string
  title: string
  summary: string
  issue: string
  product: string
  evidence_hint: string
}

export interface TopicClusterSummary extends TopicCluster {
  review_count: number
  sentiment_mix?: Partial<Record<Sentiment, number>>
  dominant_issues?: string[]
  dominant_products?: string[]
  representative_review_ids?: string[]
}

export interface AuditEntry {
  id: string
  review_id: string
  action: string
  user_id: string
  created_at: string
  before?: Partial<Annotation> | null
  after?: Partial<Annotation>
}

export interface ProcessingRun {
  id: string
  started_at: string
  completed_at: string
  processed_count: number
  needs_review_count: number
  model_version: string
  prompt_version: string
  method: string
}
