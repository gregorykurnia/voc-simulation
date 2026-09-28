import type { Annotation, ReviewRecord, Sentiment } from './types'
import { catalogs, topicClusters } from './data/taxonomy'

const brandRules: [RegExp, string][] = [
  [/\b(the executive|executive)\b/i, 'The Executive'],
  [/\bcolorbox\b/i, 'Colorbox'],
  [/\bet cetera\b/i, 'et cetera'],
  [/\bwood\b/i, 'Wood'],
  [/\bwrangler\b/i, 'Wrangler'],
  [/\bjenahara\b/i, 'Jenahara'],
  [/\btirajeans\b/i, 'Tirajeans'],
]

const productRules: [RegExp, string][] = [
  [/career chinos?/i, 'career chinos'],
  [/chinos?/i, 'career chinos'],
  [/oxford(?: shirt)?/i, 'Oxford shirt'],
  [/polo(?: shirt)?/i, 'polo shirt'],
  [/t-?shirt|kaus/i, 'T-shirt'],
  [/dress shirt|kemeja/i, 'casual shirt'],
  [/blazer/i, 'blazer'],
  [/traveler jacket/i, 'traveler jacket'],
  [/jaket denim|denim jacket/i, 'denim jacket'],
  [/jacket|jaket/i, 'traveler jacket'],
  [/blouse/i, 'blouse'],
  [/cardigan/i, 'cardigan'],
  [/sweater/i, 'sweater'],
  [/knit top/i, 'knit top'],
  [/tunik|tunic/i, 'tunic'],
  [/hijab/i, 'hijab'],
  [/outer/i, 'modest outerwear'],
  [/dress|gaun/i, 'dress'],
  [/jumpsuit/i, 'jumpsuit'],
  [/jeans?|denim/i, 'jeans'],
  [/rok|skirt/i, 'skirt'],
  [/celana pendek/i, 'casual shorts'],
  [/celana|trousers?/i, 'casual trousers'],
  [/overshirt/i, 'overshirt'],
  [/belt buckle/i, 'belt'],
  [/belt|ikat pinggang/i, 'belt'],
  [/tas|bag/i, 'bag'],
  [/wallet|dompet/i, 'wallet'],
  [/scarf|syal/i, 'scarf'],
  [/sepatu|footwear/i, 'footwear'],
  [/kaus kaki|socks/i, 'socks'],
]

const locationRules = catalogs.stores.filter((store) => store.id !== 'online-not-applicable')

export function annotateReview(review: ReviewRecord): Annotation {
  const text = review.raw_text.toLocaleLowerCase('id-ID')
  const brand = brandRules.find(([rule]) => rule.test(review.raw_text))?.[1] ?? null
  const productMatch = productRules.find(([rule]) => rule.test(review.raw_text))
  const product = productMatch?.[1] ?? null
  const store = locationRules.find((entry) => {
    const location = entry.label.split(' — ')[0].toLocaleLowerCase('id-ID')
    const aliases = [location, location.replace(/^mall\s+/i, ''), location.replace(/^supermal\s+/i, '')]
    return aliases.some((alias) => text.includes(alias))
  })
  const attributes = extractAttributes(text)
  const { issue, clusterId, issueScore } = classifyIssue(text)
  const sentiment = classifySentiment(text)
  const sentimentConfidence = sentiment === 'Mixed' ? 0.76 : sentiment === 'Neutral' ? 0.67 : 0.87
  const confidence = Math.min(0.96, 0.53 + (issueScore * 0.16) + (product ? 0.1 : 0) + (brand ? 0.05 : 0) + (attributes.length ? 0.04 : 0))
  const needsReview = confidence < 0.69 || issue === 'Other / unclear'

  return {
    brand,
    product_category: product,
    product_style_mentioned: product ? findStyleMention(review.raw_text, product) : null,
    attributes,
    issue_type: issue,
    secondary_issues: [],
    store_id: store?.id ?? (['Brand website / e-commerce', 'Marketplace'].includes(review.voice_source) ? 'online-not-applicable' : null),
    sentiment,
    sentiment_confidence: sentimentConfidence,
    cluster_id: clusterId,
    confidence: Number(confidence.toFixed(2)),
    assignment_method: 'Rule-assigned',
    review_state: needsReview ? 'Needs clarification' : 'Not reviewed',
    workflow_status: 'Open',
    excluded_from_clustering: false,
    normalized_text: review.raw_text.trim().replace(/\s+/g, ' '),
    processed_at: new Date().toISOString(),
  }
}

function extractAttributes(text: string) {
  const found = new Set<string>()
  const colorRules: [RegExp, string][] = [
    [/\bnavy\b/, 'Navy'], [/\bputih\b/, 'White'], [/\bhitam\b/, 'Black'], [/\bbiru\b/, 'Blue'],
    [/\b(beige|khaki)\b/, 'Beige'], [/\bcream\b/, 'Cream'], [/\bmaroon\b/, 'Maroon'], [/\bolive\b/, 'Olive'],
    [/\babu(?:-abu)?\b/, 'Grey'], [/\bsage\b/, 'Sage'], [/\blilac\b/, 'Lilac'], [/\bburgundy\b/, 'Burgundy'],
  ]
  for (const [rule, value] of colorRules) if (rule.test(text)) found.add(`Color: ${value}`)
  const size = text.match(/\b(?:size|ukuran)\s*(xxl|xl|xs|s|m|l|\d{1,2})\b/i)
  if (size) found.add(`Size: ${size[1].toUpperCase()}`)
  if (/sempit|ketat|longgar|kebesaran|kekecilan|fit|cutting|panjang|kepanjangan/i.test(text)) found.add('Fit')
  if (/kain|bahan|katun|linen|stretch|denim|voal|poliester/i.test(text)) found.add('Material')
  if (/kerah|kancing|resleting|jahit|saku|strap/i.test(text)) found.add('Construction detail')
  return [...found]
}

function classifyIssue(text: string) {
  const match = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text))
  let issue = 'Other / unclear'
  let clusterId = 'other-feedback'
  let issueScore = 0

  if (match([/restock|stok|stock|habis|kosong|tersedia|ukuran .* tidak ada|ukuran .* habis/i])) {
    issue = 'Availability'; clusterId = 'availability'; issueScore = 2
  } else if (match([/size chart|size\s*(?:xs|s|m|l|xl|\d)|ukuran|inseam|lingkar|pinggang|sempit|ketat|longgar|kepanjangan|terlalu panjang|fit\b|cutting/i])) {
    issue = match([/sempit|ketat|longgar|kebesaran|kepanjangan|nyaman|gerak/i]) ? 'Fit / comfort' : 'Sizing'; clusterId = 'sizing-fit'; issueScore = 2
  } else if (match([/checkout|voucher|pembayaran|payment|keranjang|website|aplikasi|login|password|katalog|tautan|tombol/i])) {
    issue = match([/voucher|promo|diskon|poin/i]) ? 'Promotion / discount' : 'Website / app / marketplace experience'; clusterId = 'order-delivery'; issueScore = 2
  } else if (match([/kurir|pengiriman|paket|terlambat|estimasi|kirim|invoice|pesanan|order|refund|retur|retur|retur|tukar|exchange|pengembalian|salah pesan|tertukar/i])) {
    issue = match([/refund|retur|tukar|pengembalian/i]) ? 'Return / exchange / refund' : match([/kurir|pengiriman|paket|terlambat|estimasi|kirim/i]) ? 'Delivery' : 'Order / fulfillment'; clusterId = 'order-delivery'; issueScore = 2
  } else if (match([/kasir|antre|antrean|ruang pas|fitting room|toko|cabang|lantai|musik|pencahayaan|rak/i])) {
    issue = 'Store experience'; clusterId = 'store-service'; issueScore = 2
  } else if (match([/petugas|staf|staff|pelayanan|admin|dibantu|ramah|kasar|respons|menjawab/i])) {
    issue = 'Staff / service'; clusterId = 'store-service'; issueScore = 2
  } else if (match([/harga|promo|diskon|voucher|worth it|poin|member/i])) {
    issue = match([/promo|diskon|voucher|poin/i]) ? 'Promotion / discount' : 'Price / value'; clusterId = 'price-promotion'; issueScore = 2
  } else if (match([/luntur|pudar|melar|berbulu|menyusut|kusut|noda|jahitan|kancing|resleting|robek|rusak|lepas|pilling/i])) {
    issue = match([/jahitan|kancing|resleting|lepas|robek/i]) ? 'Construction / finishing' : 'Durability'; clusterId = 'quality-care'; issueScore = 2
  } else if (match([/kain|bahan|katun|linen|adem|nerawang|menerawang|tipis|tebal|stretch|furing/i])) {
    issue = 'Material / fabric'; clusterId = 'quality-care'; issueScore = 1
  } else if (match([/warna|color|foto|model|potongan|desain|motif/i])) {
    issue = match([/warna|color|foto/i]) ? 'Color' : 'Product design'; clusterId = 'product-design'; issueScore = 1
  }

  const cluster = topicClusters.find((entry) => entry.id === clusterId)
  if (cluster?.id === 'other-feedback') issueScore = 0
  return { issue, clusterId, issueScore }
}

function classifySentiment(text: string): Sentiment {
  const positive = /suka|bagus|cantik|nyaman|ramah|cepat|rapi|membantu|terima kasih|adem|pas\b|lancar|puas|menyenangkan|lengkap/i.test(text)
  const negative = /sayang|tetapi|cuma|hanya|belum|tidak|nggak|gagal|susah|sulit|terlalu|kurang|lama|rusak|lepas|luntur|beda|pudar|telat|tertukar|bingung|sempit|ketat|kosong|habis|menunggu|belum ada/i.test(text)
  if (positive && negative) return 'Mixed'
  if (negative) return 'Negative'
  if (positive) return 'Positive'
  return 'Neutral'
}

function findStyleMention(text: string, category: string) {
  const compact = text.replace(/[“”"'()]/g, '').trim()
  const productPattern = new RegExp(`(?:celana|kemeja|kaus|baju|rok|tas|jaket|dress|blazer|\\s*${escapeRegExp(category)})([^,.!?]{0,26})`, 'i')
  const match = compact.match(productPattern)
  return match ? `${category}${match[1]}`.trim().slice(0, 48) : category
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
