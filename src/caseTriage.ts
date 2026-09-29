import type { CasePriority, CaseTriage, ReviewRecord } from './types'

const rulesVersion = 'Rules v1.0'

export function triageReview(review: ReviewRecord): CaseTriage {
  const text = review.raw_text.toLocaleLowerCase('id-ID')
  const risks: string[] = []
  if (/akun.*(dibobol|diambil alih|diretas)|kata sandi|password|data pribadi|privasi/.test(text)) risks.push('Privacy / account security')
  if (/diskriminasi|pelecehan|ancaman|kekerasan|cedera|terluka|unsafe|safety/.test(text)) risks.push('Safety / conduct')
  if (/pengacara|lawyer|polisi|gugatan|legal|hukum/.test(text)) risks.push('Legal')
  if (/bayar|pembayaran|tagihan|refund|pengembalian dana|transfer|kartu debit|kartu kredit|transaksi|voucher/.test(text)) risks.push('Payment / financial')

  const explicitIssue = /rusak|bermasalah|lepas|pudar|luntur|menyusut|robek|cacat|salah kirim|tertukar|hilang|belum (datang|masuk|diterima)|terlambat|terpotong dua kali|gagal|tidak bisa|nggak bisa|belum ada kabar|belum dibalas|minta dibantu|tolong dibantu|komplain|keluhan|klaim|retur|tukar|refund|pengembalian dana/.test(text)
  const requestOrQuestion = /\?|kapan|apakah|boleh|bisa|mohon|tolong|minta|cek stok|ada stok|tersedia|restock|ukuran .* ada|info .*|bagaimana|gimana/.test(text)
  const vagueComplaint = /barang(nya)? bermasalah|produk(nya)? bermasalah|tolong dibantu|mohon dibantu/.test(text)
    && !/rusak|lepas|pudar|luntur|menyusut|robek|cacat|jahitan|kancing|resleting|tertukar|hilang|terlambat|refund|retur|tukar/.test(text)
  const positiveOnly = /^(terima kasih|makasih|suka|senang|nyaman|bagus|ramah|rapi|cepat|puas|keren|cantik|adem|lembut|sesuai|membantu)/.test(text.trim()) && !explicitIssue && !requestOrQuestion

  let eligibility: CaseTriage['case_eligibility'] = 'Insight only'
  let confidence = 0.9
  let intent = 'Capture feedback insight'
  let explanation = 'No individual follow-up request was detected; keep this feedback in the insights workflow.'
  if (vagueComplaint) {
    eligibility = 'Needs review'
    confidence = 0.48
    intent = 'Clarify the customer concern'
    explanation = 'The statement signals dissatisfaction but does not identify a clear issue or requested action.'
  } else if (explicitIssue || requestOrQuestion) {
    eligibility = 'Actionable case'
    confidence = explicitIssue ? 0.88 : 0.76
    intent = inferIntent(text)
    explanation = explicitIssue
      ? 'The statement describes a specific issue or asks for help that may need individual follow-up.'
      : 'The statement contains a direct product, stock, or service question that may need a reply.'
  } else if (!positiveOnly && /tidak|belum|kurang|sulit|susah|beda|agak/.test(text)) {
    eligibility = 'Needs review'
    confidence = 0.57
    intent = 'Clarify whether follow-up is required'
    explanation = 'A possible concern is present, but the rule-based triage cannot confirm that customer action is needed.'
  }

  const priority: CasePriority = risks.some((risk) => risk !== 'Payment / financial')
    ? 'Critical'
    : risks.length || explicitIssue ? 'High' : eligibility === 'Actionable case' ? 'Normal' : 'Low'
  const issue = review.annotation?.issue_type ?? inferIssue(text)
  const brand = review.annotation?.brand ?? inferBrand(text)
  const product = review.annotation?.product_category ?? inferProduct(text)
  const sentiment = review.annotation?.sentiment ?? (/rusak|bermasalah|pudar|luntur|menyusut|salah|terlambat|belum|komplain|keluhan|gagal|tidak puas/.test(text) ? 'Negative' : positiveOnly ? 'Positive' : 'Neutral')
  const suggestedTeam = inferTeam(text, issue)
  const responseDraft = eligibility === 'Actionable case' || eligibility === 'Needs review'
    ? 'Halo, terima kasih sudah menghubungi kami. Kami akan membantu meninjau hal ini. Jika berkenan, kirimkan detail yang relevan agar tim kami dapat memeriksa lebih lanjut.'
    : ''

  return {
    case_eligibility: eligibility,
    intent,
    priority_suggestion: priority,
    sla_policy_suggestion: priority.toLocaleLowerCase('en-US'),
    suggested_team: suggestedTeam,
    issue_type: issue,
    brand,
    product_category: product,
    store: null,
    sentiment,
    risk_flags: risks,
    possible_duplicate_case_ids: [],
    response_draft: responseDraft,
    confidence,
    explanation,
    model_or_rule_version: rulesVersion,
  }
}

function inferIntent(text: string) {
  if (/retur|tukar|refund|pengembalian dana|klaim/.test(text)) return 'Return, exchange, or refund support'
  if (/stok|restock|tersedia|ukuran .* ada|cabang/.test(text)) return 'Check product or store availability'
  if (/kirim|paket|pesanan|order|kurir|terlambat/.test(text)) return 'Investigate order or delivery'
  if (/bayar|pembayaran|tagihan|voucher|transaksi/.test(text)) return 'Resolve payment or promotion issue'
  if (/poin|member|akun|password|kata sandi/.test(text)) return 'Resolve account or membership issue'
  if (/jahitan|kancing|resleting|luntur|pudar|menyusut|rusak|cacat/.test(text)) return 'Investigate product quality'
  return 'Answer customer question or follow up'
}

function inferIssue(text: string) {
  if (/retur|tukar|refund|pengembalian dana|klaim/.test(text)) return 'Return / exchange / refund'
  if (/paket|pesanan|order|kurir|kirim|terlambat/.test(text)) return 'Order / fulfillment'
  if (/bayar|pembayaran|tagihan|voucher|promo|diskon|transaksi/.test(text)) return /bayar|pembayaran|tagihan|transaksi/.test(text) ? 'Payment / checkout' : 'Promotion / discount'
  if (/stok|restock|tersedia|ukuran .* ada|habis|kosong|cabang/.test(text)) return 'Availability'
  if (/jahitan|kancing|resleting|luntur|pudar|menyusut|robek|cacat|rusak|berbulu/.test(text)) return 'Product quality'
  if (/kasir|antre|antrian|staf|petugas|ruang ganti|toko/.test(text)) return 'Store experience'
  if (/ukuran|size|sempit|longgar|panjang|potongan/.test(text)) return 'Sizing'
  if (text.includes('?')) return 'Product information'
  return 'Other / unclear'
}

function inferTeam(text: string, issue: string) {
  if (/paket|pesanan|order|kurir|kirim|gudang/.test(text)) return 'Logistics'
  if (/bayar|pembayaran|tagihan|refund|pengembalian dana|transaksi/.test(text)) return 'Finance'
  if (/kasir|antri|antrian|staf|petugas|cabang|toko|store/.test(text)) return 'Store Operations'
  if (issue === 'Product quality' || issue === 'Material / fabric') return 'Product Team'
  return 'Customer Service'
}

function inferBrand(text: string) {
  return ['The Executive', 'Colorbox', 'Wrangler', 'Tirajeans', 'Jenahara', 'et cetera', 'Wood'].find((brand) => text.toLocaleLowerCase('id-ID').includes(brand.toLocaleLowerCase('id-ID'))) ?? null
}

function inferProduct(text: string) {
  const terms: [RegExp, string][] = [
    [/jeans|denim|celana/, 'jeans'], [/blazer/, 'blazer'], [/kemeja|shirt/, 'casual shirt'], [/dress|gaun/, 'dress'], [/blouse/, 'blouse'], [/hijab|hijab voal/, 'hijab'], [/polo/, 'polo shirt'], [/cardigan/, 'cardigan'], [/rok/, 'skirt'], [/tas/, 'bag'], [/belt|sabuk/, 'belt'],
  ]
  return terms.find(([pattern]) => pattern.test(text))?.[1] ?? null
}
