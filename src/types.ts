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

export type CaseStatus =
  | 'Needs triage'
  | 'In review'
  | 'In progress'
  | 'Pending customer'
  | 'Pending internal / store'
  | 'Needs supervisor review'
  | 'Escalated'
  | 'Resolved'
  | 'Closed'
  | 'Reopened'

export type CasePriority = 'Critical' | 'High' | 'Normal' | 'Low'
export type CaseEligibility = 'Actionable case' | 'Insight only' | 'Needs review'

export interface CaseTriage {
  case_eligibility: CaseEligibility
  intent: string
  priority_suggestion: CasePriority
  sla_policy_suggestion: string
  suggested_team: string
  issue_type: string
  brand: string | null
  product_category: string | null
  store: string | null
  sentiment: Sentiment
  risk_flags: string[]
  possible_duplicate_case_ids: string[]
  response_draft: string
  confidence: number
  explanation: string
  model_or_rule_version: string
}

export interface CaseResolution {
  summary: string
  root_cause: string
  action_taken: string
  compensation_details: string
  compensation_amount: number | null
  customer_notification_channel: string
  customer_notified: boolean | null
  customer_confirmed: boolean | null
  reopen_reason: string
}

export interface CaseLearning {
  root_cause: string
  resolution_type: string
  product_or_store_signal: string
  customer_outcome: string
  preventable: boolean | null
  repeated_issue: boolean | null
  reusable_response_pattern: string
  topic_cluster_id: string | null
  human_validated: boolean
  validated_by: string | null
  validated_at: string | null
}

export interface CustomerCase {
  id: string
  status: CaseStatus
  priority: CasePriority
  subject: string
  review_ids: string[]
  primary_review_id: string
  customer_reference: string | null
  source_channel: string
  brand: string | null
  product_category: string | null
  issue_type: string
  store_id: string | null
  owner_user_id: string | null
  owner_team: string
  supervisor_user_id: string | null
  sla_policy_id: string
  first_response_due_at: string
  resolution_due_at: string
  first_response_at: string | null
  sla_paused_at?: string | null
  resolved_at: string | null
  closed_at: string | null
  escalated_to?: string | null
  requested_priority?: CasePriority | null
  requested_sla_policy_id?: string | null
  supervisor_review_state?: 'Not required' | 'Pending' | 'Approved' | 'Returned'
  supervisor_review_note?: string
  qa_review_state?: 'Not required' | 'Pending' | 'Approved' | 'Returned'
  qa_review_note?: string
  ai_triage: CaseTriage
  resolution: CaseResolution | null
  learning: CaseLearning | null
  created_at: string
  updated_at: string
  last_activity_at: string
}

export interface CaseEvent {
  id: string
  case_id: string
  type: 'Status change' | 'Assignment' | 'Evidence linked' | 'Note' | 'Escalation' | 'Supervisor decision' | 'QA decision' | 'Learning validated' | 'Customer notification' | 'Resolution' | 'Reopened' | 'Created'
  summary: string
  actor_user_id: string
  created_at: string
  details?: Record<string, string | number | boolean | null>
}

export interface CaseMessage {
  id: string
  case_id: string
  direction: 'Inbound' | 'Outbound' | 'Internal note'
  channel: string
  body: string
  author_user_id: string
  created_at: string
  delivery_state: 'Not sent' | 'Draft' | 'Sent' | 'Delivered' | 'Failed'
}

export interface SLAPolicy {
  id: string
  label: string
  first_response_minutes: number
  resolution_minutes: number
  pause_statuses: CaseStatus[]
  escalation_minutes_before_due: number
}
