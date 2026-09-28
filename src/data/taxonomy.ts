import type { CatalogValue, TopicCluster } from '../types'

export const catalogs: Record<string, CatalogValue[]> = {
  voiceSources: [
    { id: 'instagram', label: 'Instagram' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'store', label: 'Store' },
    { id: 'qr-survey', label: 'QR survey' },
    { id: 'ecommerce', label: 'Brand website / e-commerce' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'email', label: 'Email' },
    { id: 'customer-service', label: 'Customer-service phone call' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'other', label: 'Other' },
  ],
  brands: [
    { id: 'the-executive', label: 'The Executive', active: true },
    { id: 'colorbox', label: 'Colorbox', active: true },
    { id: 'et-cetera', label: 'et cetera', active: true },
    { id: 'wood', label: 'Wood', active: true },
    { id: 'wrangler', label: 'Wrangler', active: true },
    { id: 'jenahara', label: 'Jenahara', active: true },
    { id: 'tirajeans', label: 'Tirajeans', active: true },
  ],
  productCategories: [
    ...['casual shirt', 'dress shirt', 'Oxford shirt', 'polo shirt', 'T-shirt', 'blouse', 'knit top', 'sweater', 'tunic', 'career chinos', 'tailored trousers', 'casual trousers', 'jeans', 'denim shorts', 'casual shorts', 'skirt', 'traveler jacket', 'denim jacket', 'blazer', 'overshirt', 'cardigan', 'dress', 'jumpsuit', 'modest tunic', 'modest outerwear', 'long dress', 'hijab', 'belt', 'belt buckle', 'bag', 'wallet', 'scarf', 'tie', 'socks', 'footwear', 'Other / not specified'].map((label) => ({ id: slug(label), label })),
  ],
  issueTypes: [
    ...['Availability', 'Sizing', 'Fit / comfort', 'Color', 'Product design', 'Product quality', 'Material / fabric', 'Durability', 'Construction / finishing', 'Price / value', 'Product information', 'Promotion / discount', 'Order / fulfillment', 'Delivery', 'Return / exchange / refund', 'Store experience', 'Staff / service', 'Payment / checkout', 'Website / app / marketplace experience', 'Membership / rewards', 'Other / unclear'].map((label) => ({ id: slug(label), label })),
  ],
  stores: [
    store('grand-indonesia', 'Grand Indonesia', 'Central Jakarta', 'DKI Jakarta'),
    store('kota-kasablanka', 'Mall Kota Kasablanka', 'South Jakarta', 'DKI Jakarta'),
    store('kelapa-gading', 'Mall Kelapa Gading', 'North Jakarta', 'DKI Jakarta'),
    store('puri-indah', 'Puri Indah Mall', 'West Jakarta', 'DKI Jakarta'),
    store('summarecon-serpong', 'Summarecon Mall Serpong', 'Tangerang', 'Banten'),
    store('supermal-karawaci', 'Supermal Karawaci', 'Tangerang', 'Banten'),
    store('summarecon-bekasi', 'Summarecon Mall Bekasi', 'Bekasi', 'West Java'),
    store('botani-square', 'Botani Square', 'Bogor', 'West Java'),
    store('paris-van-java', 'Paris Van Java', 'Bandung', 'West Java'),
    store('csb-mall', 'Cirebon Super Block (CSB Mall)', 'Cirebon', 'West Java'),
    store('paragon-city-mall', 'Paragon City Mall', 'Semarang', 'Central Java'),
    store('the-park-solo', 'The Park Mall Solo Baru', 'Sukoharjo / Greater Surakarta', 'Central Java'),
    store('plaza-ambarrukmo', 'Plaza Ambarrukmo', 'Sleman / Yogyakarta', 'Special Region of Yogyakarta'),
    store('pakuwon-surabaya', 'Pakuwon Surabaya', 'Surabaya', 'East Java'),
    store('sun-plaza', 'Sun Plaza', 'Medan', 'North Sumatra'),
    store('palembang-icon', 'Palembang Icon Mall', 'Palembang', 'South Sumatra'),
    store('ciputra-seraya', 'Ciputra Seraya', 'Pekanbaru', 'Riau'),
    store('lampung-city', 'Lampung City Mall', 'Bandar Lampung', 'Lampung'),
    store('bali-galeria', 'Mall Bali Galeria', 'Badung', 'Bali'),
    store('mall-ratu-indah', 'Mall Ratu Indah', 'Makassar', 'South Sulawesi'),
    store('manado-town-square', 'Manado Town Square', 'Manado', 'North Sulawesi'),
    store('pentacity', 'Pentacity Mall', 'Balikpapan', 'East Kalimantan'),
    store('duta-mall', 'Duta Mall', 'Banjarmasin', 'South Kalimantan'),
    store('grand-batam', 'Grand Batam Mall', 'Batam', 'Riau Islands'),
    store('mall-a-yani', 'Mall A Yani', 'Pontianak', 'West Kalimantan'),
    { id: 'online-not-applicable', label: 'Online / Not applicable', active: true, availability_status: 'Unverified', city: 'Online', province: 'Not applicable', region: 'Online', brand_availability: [], opened_on: null, closed_on: null },
  ],
  workflowStatuses: [
    ...['Open', 'In Review', 'In Progress', 'Pending Customer', 'Pending Internal / Store', 'Validated', 'Resolved', 'Closed', 'Reopened'].map((label) => ({ id: slug(label), label })),
  ],
  sentiments: ['Positive', 'Neutral', 'Mixed', 'Negative'].map((label) => ({ id: slug(label), label })),
}

export const topicClusters: TopicCluster[] = [
  { id: 'sizing-fit', title: 'Ukuran terasa berbeda antar model', summary: 'Pelanggan menyebut ukuran berlabel sama terasa berbeda, atau potongan tertentu membatasi gerak dan kenyamanan.', issue: 'Sizing', product: 'Career chinos', evidence_hint: 'size, ukuran, sempit, longgar, panjang, fit' },
  { id: 'availability', title: 'Ukuran dan warna favorit cepat habis', summary: 'Pelanggan kesulitan menemukan ukuran atau warna tertentu di toko maupun kanal online.', issue: 'Availability', product: 'Apparel', evidence_hint: 'stok, habis, restock, tersedia, kosong' },
  { id: 'quality-care', title: 'Bahan dan finishing setelah dipakai', summary: 'Komentar membahas perubahan kain, jahitan, kancing, dan bentuk pakaian setelah pemakaian atau pencucian.', issue: 'Product quality', product: 'Apparel', evidence_hint: 'jahitan, kain, luntur, melar, cuci, pilling' },
  { id: 'store-service', title: 'Bantuan staf dan pengalaman di toko', summary: 'Pengalaman staf, ruang pas, antrean, dan suasana toko membentuk kesan kunjungan.', issue: 'Staff / service', product: 'Store experience', evidence_hint: 'staff, kasir, antre, fitting room, dibantu' },
  { id: 'price-promotion', title: 'Harga dan promo perlu lebih jelas', summary: 'Pelanggan menimbang nilai produk atau meminta syarat promosi dan perhitungan diskon dijelaskan lebih baik.', issue: 'Price / value', product: 'Apparel', evidence_hint: 'harga, diskon, promo, worth it, poin' },
  { id: 'order-delivery', title: 'Pemesanan dan pengiriman belum mulus', summary: 'Ulasan mencatat kendala checkout, pesanan, pengembalian, atau ketepatan pengiriman.', issue: 'Order / fulfillment', product: 'Online order', evidence_hint: 'order, checkout, kirim, retur, refund, paket' },
  { id: 'product-design', title: 'Detail desain dan warna sesuai harapan', summary: 'Pelanggan memberi masukan tentang potongan, warna, detail desain, dan kecocokan produk dengan foto.', issue: 'Product design', product: 'Apparel', evidence_hint: 'warna, foto, model, potongan, desain' },
  { id: 'other-feedback', title: 'Masukan lain untuk ditinjau', summary: 'Komentar dengan konteks yang belum cukup kuat untuk masuk ke kelompok topik utama.', issue: 'Other / unclear', product: 'Not specified', evidence_hint: 'needs review' },
]

export const catalogLabels = (key: string) => catalogs[key]?.map((item) => item.label) ?? []

export function slug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function store(id: string, location: string, city: string, province: string): CatalogValue {
  return { id, label: `${location} — ${city}, ${province}`, city, province, region: province, brand_availability: [], availability_status: 'Unverified', opened_on: null, closed_on: null }
}
