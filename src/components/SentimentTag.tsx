import type { Sentiment } from '../types'

export function SentimentTag({ sentiment }: { sentiment: Sentiment }) {
  const klass = sentiment.toLowerCase()
  return <span className={`sentiment-tag sentiment-${klass}`}><span />{sentiment}</span>
}
