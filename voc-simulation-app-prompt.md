# Delamibrands VOC Simulation App — Build Prompt

## How to use this file

Use the specification below as the build prompt for a future implementation agent. It describes the first usable version of a web app for a Delamibrands voice-of-customer (VOC) simulation. Do not deploy, publish, or launch the app as part of this prompt. Build only after the owner explicitly asks for implementation.

The first seed dataset should contain 250–300 raw customer statements, with 275 as the default target. The app must be designed so that these seed records can later be replaced or supplemented by imported real feedback.

## Product brief

Build a web application that stores customer statements from fashion-retail channels and automatically turns each statement into structured VOC data. Every review should retain its original wording and receive normalized tags for:

- voice source
- brand
- product category and product/style mentioned
- product attributes such as color, size, fit, and material
- issue type
- store location, when relevant
- sentiment and sentiment confidence
- processing status
- topic cluster

The app should then group semantically similar reviews into topic clusters and generate a grounded summary for each cluster. A user must be able to move from a cluster summary to the exact reviews supporting it.

This is a prototype for Delamibrands fashion retail. Use synthetic or proxy data only until the owner supplies an approved real-data source. Do not imply that generated reviews are real customer feedback.

### Raw VOC seed dataset brief

Create the initial seed as 250–300 separate raw customer statements in natural Bahasa Indonesia, with 275 statements as the default generated count. The records should read like ordinary feedback that arrived through real retail touchpoints: some short and spontaneous, some detailed, some incomplete, and some conversational. They must be useful for testing downstream tagging without sounding like examples written to demonstrate a taxonomy.

The statements are fictional seed data for the prototype. Keep that fact in dataset metadata and the application shell, but never insert words such as `synthetic`, `proxy`, `sample`, `fake`, `generated`, or `AI` into the customer-facing statement itself.

#### Channel mix and voice

Distribute the records across several Indonesian customer-feedback channels. Use this as a target mix, allowing small variation so the dataset does not look mechanically balanced:

- Instagram comments, mentions, and DMs: about 18%
- WhatsApp conversations: about 18%
- In-store conversations or store feedback: about 16%
- Customer-service phone, chat, or follow-up: about 14%
- QR or receipt surveys: about 10%
- Brand website, e-commerce, and marketplace reviews: about 12%
- TikTok, Facebook, and email: about 12%

Store and customer-service records may use `source_detail` to distinguish the interaction type. Keep the controlled `voice_source` values from `voc-proxy-data-items.md`; do not create a new source value for every wording variation.

Write in Indonesian as people actually use it in these settings:

- Mix `aku`, `saya`, `kita`, `kak`, `min`, `mbak`, and `mas` where natural for the channel and situation.
- Let WhatsApp and social comments use occasional abbreviations, missing capitalization, repeated letters, or light emoji, but keep them readable.
- Let surveys and marketplace reviews be more compact and direct; let customer-service and store comments include more context about what happened.
- Use occasional everyday English or retail terms such as `fit`, `restock`, `checkout`, `size chart`, `worth it`, or `return` only where an Indonesian customer would naturally use them.
- Vary punctuation, sentence length, opening phrases, and emotional intensity. Avoid making every record begin with “Saya” or end with a request.
- Do not force slang into every statement. Clear, polite, neutral, and disappointed voices should all appear.

#### Realism and taggability requirements

Make the statements specific enough to support later annotation while preserving the ambiguity found in real feedback:

- Most statements should contain one clear primary signal and an optional secondary signal, such as a sizing problem plus a request to exchange, or praise for staff plus a long queue.
- Include concrete but non-identifying details when natural: brand, product or style, color, labeled size, fit, fabric feel, price or promotion, mall/store location, order channel, delivery experience, or what the customer tried to do.
- Include positive, neutral, mixed, and negative comments. Do not make every record a complaint.
- Include a useful range of brands, product categories, issue types, and store locations from the seed taxonomy. Do not make every record mention a brand or product if a real customer would not know or state it.
- Leave some records genuinely partial or ambiguous so the processor can return `null`, `Unknown`, or `Needs review`. Do not add details just to make every field taggable.
- Aim for roughly 70–80% of records to have enough evidence for a confident primary tag, 15–20% to have partial evidence or multiple plausible tags, and 5–10% to remain genuinely unclear.
- Vary the point of view and outcome: asking whether an item is available, reporting a problem, praising a resolution, comparing an item with expectations, following up on a prior contact, or simply sharing an observation.
- Do not repeat a sentence template with only the product or location changed. Avoid near-duplicate paraphrases and evenly distributed combinations that reveal a generation pattern.
- Do not include names, phone numbers, email addresses, order numbers, membership IDs, exact addresses, or other personally identifying information.

#### Raw record contract

Each seed record must include at least:

- `raw_text`: the exact Indonesian statement shown to the user on page 1
- `voice_source` and optional `source_detail`
- `feedback_at` with plausible variation across recent dates
- `synthetic: true` in metadata, never in `raw_text`
- `processing_status: Unprocessed` before page 2 enrichment runs

Do not include generated tags, cluster names, summaries, sentiment labels, rationales, or hidden annotation instructions inside `raw_text`. Page 1 must present these statements as an unprocessed stream of incoming feedback. Page 2 is where the same records become tagged, grouped, and summarized.

Representative style examples (style guidance only; do not copy these sentences or reuse them as fixed fixtures):

```text
IG comment — “Kak, celana Career Chinos warna navy size 30 kapan restock ya? Kemarin ke store tinggal size 32 ke atas.”
WhatsApp — “Mbak mau tanya, polo yang saya beli minggu lalu setelah dicuci pertama kok bagian kerahnya agak menggelombang ya. Cara claim-nya gimana?”
Store — “Saya suka potongannya, cuma pas duduk bagian pahanya terasa sempit padahal biasanya pakai ukuran yang sama.”
Customer service — “Adminnya responsif dan dibantu cek ke cabang lain, tapi proses tukar size-nya hampir seminggu karena barangnya baru datang.”
QR survey — “Kasirnya ramah, fitting room bersih. Antre bayar agak panjang sekitar jam makan siang.”
Marketplace — “Warnanya lebih gelap dari foto, tapi bahannya adem dan pengirimannya cepat.”
Instagram DM — “Ada blazer yang modelnya mirip ini tapi versi petite? Yang sekarang bagian lengannya kepanjangan di saya.”
TikTok comment — “Bagus sih cutting-nya, cuma tolong ada opsi warna selain hitam dan beige dong.”
```

## Initial scope

Implement two initial user-facing pages. Do not build a general executive dashboard, campaign management system, CRM, or production data ingestion connector yet.

### Page 1: Raw Reviews

Route: `/reviews`

Show the 250–300 imported raw statements exactly as stored, with light ingestion metadata. Use 275 as the default count in seed data and make the displayed count dynamic.

Page 1 is the pre-enrichment view. It should feel like a live stream or inbox of incoming feedback, not a tagging report. Keep the original statement as the primary content and reserve normalized tags, cluster membership, sentiment, confidence, and summaries for Page 2.

Required behavior:

- searchable table of raw statement text
- pagination or virtualized scrolling
- sort by feedback date, voice source, source detail, and processing status
- filters for voice source, source detail, date range, and processing status
- review detail drawer or detail route showing the complete original statement
- visible processing state: `Unprocessed`, `Queued`, `Processing`, `Processed`, `Needs review`, or `Failed`
- an action to process one review or queue all unprocessed reviews
- a clear app-level label that the dataset is synthetic/proxy data; keep this label outside the raw statement text

The raw page must not silently rewrite the original statement or expose derived tags as if they were source content. If normalized text is needed for embeddings, store it in a separate field and show it only as derived data in the detail view. Do not show brand, product, issue, sentiment, or cluster tags in the main raw table before processing; those belong to Page 2.

### Page 2: Tagged Reviews & Topic Clusters

Route: `/processed`

Show the same reviews after automatic enrichment. The page should make it easy to see both the per-review tags and the groups formed from similar reviews.

Required behavior:

- table of reviews with the original statement and tag chips for source, brand, product, issue type, store, sentiment, and cluster
- filters for every major tag plus cluster
- a cluster summary area with cluster title, review count, short summary, dominant tags, sentiment mix, and representative review IDs
- clicking a cluster filters the review table to its members
- clicking a review opens its full annotation detail
- clear `AI-assigned`, `Rule-assigned`, `Human-reviewed`, and `Needs review` indicators where applicable
- show confidence for each annotation or at least for annotations below the review threshold
- allow a reviewer to correct a tag, move a review to another cluster, exclude a review from clustering, or mark an annotation as validated
- show the last processing run and model/prompt version used

Do not require a chart-heavy dashboard in this phase. The cluster cards and filtered tables are the first insight surface; charts can be added after the tagging quality is understood.

## Canonical taxonomy

Use [`voc-proxy-data-items.md`](./voc-proxy-data-items.md) as the seed taxonomy and store the values in database tables rather than hard-coding them in UI components.

### Voice source values

At minimum:

- Instagram
- WhatsApp
- Store
- QR survey
- Brand website / e-commerce
- Marketplace
- Email
- Customer-service phone call
- TikTok
- Facebook
- Other

Keep a separate optional `source_detail` field, such as `Instagram DM`, `Instagram comment`, or `QR receipt survey`.

### Brand values

Use the full company-wide proxy list:

- The Executive
- Colorbox
- et cetera
- Wood
- Wrangler
- Jenahara
- Tirajeans

Treat `Executive` as an alias of `The Executive` when importing data. Do not create duplicate brands because of capitalization or naming variations.

### Product values

Keep product type separate from product attributes. Seed product categories such as:

- casual shirt, dress shirt, Oxford shirt, polo shirt, T-shirt, blouse, knit top, sweater, tunic
- career chinos, tailored trousers, casual trousers, jeans, denim shorts, casual shorts, skirt
- traveler jacket, denim jacket, blazer, overshirt, cardigan
- dress, jumpsuit, modest tunic, modest outerwear, long dress, hijab
- belt, belt buckle, bag, wallet, scarf, tie, socks, footwear

The supplied examples are valid proxy mentions, but should be normalized as follows:

- `4 Way Stretch` → product attribute: `stretch fabric`; product category remains unknown unless the statement names the garment
- `Belt Buckle` → product category: `belt` when the customer is discussing the belt; retain `belt buckle` as a component attribute
- `Career Chinos` → product category: `career chinos`
- `Casual Shirt` → product category: `casual shirt`
- `Oxford` → normalize to `Oxford shirt` when context indicates a shirt; otherwise retain as an unresolved product mention
- `Polo Shirt` → product category: `polo shirt`
- `Traveler Jacket` → product category: `traveler jacket`

Allow `product_style_mentioned` to remain free text when the item is not in the controlled catalog. Never invent a SKU, style code, store, or brand to fill a missing value.

### Issue type values

Use one primary issue type and optional secondary issue tags:

- Availability
- Sizing
- Fit / comfort
- Color
- Product design
- Product quality
- Material / fabric
- Durability
- Construction / finishing
- Price / value
- Product information
- Promotion / discount
- Order / fulfillment
- Delivery
- Return / exchange / refund
- Store experience
- Staff / service
- Payment / checkout
- Website / app / marketplace experience
- Membership / rewards
- Other / unclear

### Store values

Seed the store master from the 25-location proxy list in `voc-proxy-data-items.md`. Store display labels should use `Location — City, Province`, while records should reference a stable `store_id`. Add `Online / Not applicable` for reviews with no physical-store relationship. Keep store availability and open/closed state in the store master so historical records do not change meaning when a branch closes.

### Workflow status values

- Open
- In Review
- In Progress
- Pending Customer
- Pending Internal / Store
- Validated
- Resolved
- Closed
- Reopened

Keep workflow status separate from annotation confidence and review state. `Validated` is retained for compatibility with the existing proxy, but a separate review state is preferred for future reporting.

## Recommended application stack

Use a TypeScript-first stack with a relational database and vector search in the same system:

- **Web app:** Next.js App Router with TypeScript. Use Server Components for initial data reads and Client Components only for interactive tables, filters, drawers, and optimistic edits.
- **UI:** Tailwind CSS, shadcn/ui, and TanStack Table. Use a restrained operations dashboard style: readable tables, compact chips, clear status colors, and strong empty/loading/error states.
- **Validation and types:** Zod schemas shared by route handlers, background jobs, and UI forms. Generate database types where possible.
- **Database:** Supabase-hosted PostgreSQL with migrations. Use relational tables for reviews, taxonomies, annotations, clusters, and processing runs; use JSONB only for raw source payloads and model audit data.
- **Semantic search:** PostgreSQL `pgvector` for review embeddings and cosine similarity. Store the embedding model name and dimensions with each embedding so it can be regenerated safely.
- **ORM/database access:** Drizzle ORM for ordinary relational queries, with explicit SQL migrations and SQL functions for pgvector similarity queries. Keep vector operations behind a small repository/service interface.
- **AI extraction and summaries:** OpenAI Responses API with Structured Outputs and a strict JSON schema. The model must select only allowed taxonomy values or return `null`/`Unknown`; it must not fabricate a store, product, brand, or quote.
- **Embeddings:** Use a configurable embedding model through an adapter. The default can be an OpenAI embedding model, but the provider and model must be environment-configurable.
- **Background processing:** Inngest or an equivalent durable job runner for batch processing, retries, rate limits, and progress reporting. Do not make a browser request wait for all 250–300 reviews to finish.
- **Testing:** Vitest for taxonomy, normalization, clustering, and API tests; Playwright for the two primary pages and the end-to-end processing flow. Add tests after implementation begins, not during this prompt-only phase.
- **Deployment later:** Vercel for the Next.js app and Supabase for Postgres. Deployment is explicitly out of scope until requested.

The choice of Next.js App Router, Supabase/Postgres with `pgvector`, and OpenAI Structured Outputs follows the current official documentation and keeps relational records, embeddings, and validated model output close together. See the source links at the end of this document.

## Data model

Use UUIDs for internal identifiers and timestamps in UTC. Keep human-readable labels in taxonomy tables, not only in JSON blobs.

### `reviews`

Suggested fields:

- `id`
- `external_id` nullable, unique per source when available
- `raw_text` — immutable original statement
- `normalized_text` nullable — optional text used for search/embedding
- `feedback_at` nullable
- `source_id`
- `source_detail` nullable
- `language` default `id` or `unknown`
- `locale` nullable
- `raw_payload` JSONB nullable
- `synthetic` boolean default `true` for the proxy seed
- `processing_status`
- `created_at`, `updated_at`, `processed_at`

### `brands`, `product_taxonomy`, `issue_taxonomy`, `voice_sources`, and `stores`

Each taxonomy table should include:

- `id`
- `slug` — stable machine value
- `display_name`
- `description` or examples where useful
- `is_active`
- `sort_order`
- `created_at`, `updated_at`

Stores additionally need `city`, `province`, `mall_or_location_name`, `store_code` nullable, `latitude`/`longitude` nullable, and historical `opened_at`/`closed_at` nullable.

### `review_annotations`

One current annotation record per review, with history retained separately or through an audit table:

- `review_id`
- `brand_id` nullable
- `product_category_id` nullable
- `product_style_mentioned` nullable
- `product_attributes` JSONB — normalized key/value values such as `{ "color": "navy", "size": "L", "fit": "slim", "material": "4-way stretch" }`
- `primary_issue_type_id` nullable
- `secondary_issue_type_ids` or a join table
- `store_id` nullable
- `sentiment` — `positive`, `neutral`, `negative`, `mixed`, or `unknown`
- `sentiment_score` nullable
- `overall_confidence` nullable
- `annotation_source` — `rule`, `ai`, `human`, or `hybrid`
- `model_name` nullable
- `prompt_version` nullable
- `rationale` nullable and concise
- `review_state` — `Not reviewed`, `Validated`, or `Needs clarification`
- `updated_at`

### `review_embeddings`

- `review_id`
- `embedding` vector column
- `embedding_model`
- `embedding_dimensions`
- `embedding_text_hash`
- `created_at`

Use a vector index once the data volume requires it; keep the distance metric and threshold configurable.

### `clusters`

- `id`
- `cluster_key` stable within a processing run
- `title`
- `summary`
- `customer_need_or_signal` nullable
- `keywords` array
- `dominant_brand_id` nullable
- `dominant_product_category_id` nullable
- `dominant_issue_type_id` nullable
- `sentiment_mix` JSONB
- `review_count`
- `cluster_method`
- `similarity_threshold` nullable
- `summary_model_name`
- `summary_prompt_version`
- `generated_at`
- `is_active`

### `review_cluster_members`

- `review_id`
- `cluster_id`
- `membership_score` nullable
- `assignment_source` — `similarity`, `ai`, `human`, or `hybrid`
- `assigned_at`

Allow one active cluster membership for the first version. Keep the schema extensible for multiple topics per review later.

### `processing_runs` and `annotation_audit_log`

Record every batch or single-review run:

- trigger (`manual`, `batch`, `import`)
- requested and completed counts
- failed count and structured errors
- taxonomy version
- embedding model
- extraction model and prompt version
- clustering method and threshold
- start/end timestamps

The audit log should capture before/after values when a human edits a tag or cluster assignment.

## Automatic processing pipeline

Implement processing as an idempotent background workflow. A retry must not create duplicate annotations, embeddings, or clusters.

### Step 1: Validate and normalize

- Confirm that `raw_text` is present and within configured length limits.
- Normalize whitespace and obvious encoding problems into `normalized_text` without modifying `raw_text`.
- Normalize known aliases such as `Executive` → `The Executive` and common spelling/case variations.
- Match exact known stores, brands, and product terms where confidence is high.
- Leave unknown values empty or `Unknown`; never guess.

### Step 2: Extract structured tags

Send the review text and the current taxonomy to the model. Require a strict structured response with fields equivalent to:

```json
{
  "voice_source": "Instagram",
  "brand": "The Executive",
  "product_category": "career chinos",
  "product_style_mentioned": "Career Chinos",
  "product_attributes": {
    "color": "navy",
    "size": "L",
    "fit": "slim",
    "material": "4-way stretch"
  },
  "primary_issue_type": "Sizing",
  "secondary_issue_types": ["Fit / comfort"],
  "store": null,
  "sentiment": "negative",
  "sentiment_score": 0.82,
  "confidence": 0.91,
  "needs_human_review": false,
  "rationale": "The customer says the labeled L is tighter than expected."
}
```

The actual implementation must use enums or taxonomy IDs wherever possible rather than accepting arbitrary labels from the model. Validate the response with Zod. If it fails validation, retry once with the validation error, then mark the review `Needs review` and preserve the error for inspection.

### Step 3: Create or refresh embeddings

Embed a controlled representation containing the review text and relevant normalized context. Do not embed private identifiers. Save a hash of the embedded text so an annotation edit can trigger a deliberate re-embedding decision.

### Step 4: Assign semantic clusters

For the initial 250–300-review prototype, with 275 as the default seed count:

- compare embeddings using cosine similarity
- use broad metadata as a soft constraint or ranking signal, especially issue type and product category
- make the similarity threshold configurable and visible in the processing run
- assign a review to an existing cluster when it exceeds the threshold and is semantically coherent
- create a new cluster when no existing cluster is a good match
- permit an explicit `Unclustered / insufficient evidence` state
- store membership scores and the method used

Keep clustering behind an interface so a later batch job can replace the prototype approach with agglomerative clustering, HDBSCAN, or another evaluated method without changing the UI or database contract.

Do not force unrelated comments together merely because they share a brand or issue type. For example, “no navy chinos in size L” and “the navy color faded after washing” may share product and color but belong to different topics.

### Step 5: Summarize clusters

For each cluster, generate a grounded structured summary containing:

- short canonical topic title
- one- or two-sentence VOC summary
- what customers appear to need or expect
- key phrases/keywords
- dominant brand, product, and issue tags
- sentiment distribution
- representative review IDs selected from the actual cluster members
- optional follow-up cue, clearly marked as an interpretation rather than a fact

The model must not invent quotes. If the UI displays a representative quote, retrieve the exact `raw_text` from the referenced review ID. Recompute summaries when membership changes or when the taxonomy/prompt version changes.

## API and job surface

Create typed server endpoints or server actions equivalent to:

- `GET /api/reviews` — paginated raw or enriched reviews with filters and sorting
- `GET /api/reviews/:id` — raw text, annotations, cluster membership, and audit history
- `POST /api/reviews/:id/process` — queue one review
- `POST /api/processing-runs` — queue a batch with selected review IDs or a filter
- `GET /api/processing-runs/:id` — progress, failures, and configuration
- `GET /api/clusters` — active clusters with summaries and counts
- `GET /api/clusters/:id` — cluster details and member review IDs
- `PATCH /api/reviews/:id/annotation` — human correction with audit record
- `PATCH /api/reviews/:id/cluster` — manual move, merge, or uncluster action with audit record

Use server-side pagination and filtering. Never fetch all reviews into the browser just to filter 250–300 rows; the prototype should still model the production access pattern.

## UI and interaction requirements

- Desktop-first responsive layout, usable on a laptop at 1280px wide and still readable on tablet.
- Persistent top bar with app name, dataset label (`Synthetic proxy`), processing status, and navigation between the two pages.
- Filter chips should be removable individually and have a `Clear all` action.
- Use neutral colors for taxonomy chips and reserve strong colors for workflow status, sentiment, warnings, and errors.
- Long review text should be truncated in tables but fully readable in a detail drawer.
- Empty states should explain whether there are no matching reviews or processing has not happened yet.
- Loading states should preserve table structure with skeleton rows.
- Errors should identify the failed operation and provide a retry action.
- Show provenance on every AI-derived value: method, confidence, model/prompt version, and last processed timestamp.
- Avoid exposing raw API keys or model prompts in the normal user interface.

## Import and future seed workflow

Later, add a seed/import command that accepts 250–300 reviews in JSON or CSV, with 275 as the default seed size. The importer should:

- assign deterministic IDs when an `external_id` is absent
- set `synthetic = true`
- preserve the original text exactly in `raw_text`
- map known columns to source, brand, product, issue, and store when supplied
- leave missing tags for the processing pipeline instead of inventing values
- report duplicates, invalid rows, and skipped rows
- enqueue processing after import only when explicitly requested by the user

The seed dataset should include realistic variation: Bahasa Indonesia and occasional English, channel-specific wording, abbreviated WhatsApp messages, store names, product references, mixed sentiment, one or two issues in a statement, and some comments where the correct tag is genuinely unknown. Follow the Raw VOC seed dataset brief above. Avoid personally identifiable information and do not add generation language to `raw_text`.

## Acceptance criteria for the future implementation

The implementation is ready for review when:

1. The app can load the proxy dataset without losing original review text.
2. `/reviews` displays raw reviews with pagination, search, filters, and processing state.
3. A user can queue one review or the whole seed dataset for processing.
4. The pipeline produces schema-valid annotations using only taxonomy values or explicit unknowns.
5. Each processed review has an embedding, a cluster membership or `Unclustered`, and provenance fields.
6. `/processed` shows every review with visible tags and a cluster summary area.
7. Opening a cluster shows its member reviews and exact supporting text.
8. Cluster summaries are grounded in the member review IDs and do not contain invented quotations.
9. A human can correct a tag or cluster membership, and the change is auditable.
10. Failed model calls and invalid outputs are retriable and do not leave duplicate records.
11. The app has clear synthetic-data labeling and does not claim that proxy reviews are real.
12. No deployment or external launch occurs until separately authorized.

## Build constraints for the implementation agent

- Begin by inspecting the existing repository and `voc-proxy-data-items.md`.
- Ask before making a materially different stack choice.
- Implement the smallest vertical slice first: database schema, seed import, one-review processing, then the two pages, then batch processing and cluster summaries.
- Keep taxonomy, prompt, model, and clustering settings versioned and configurable.
- Do not hard-code AI output into UI fixtures once database-backed data exists.
- Do not add real customer data, external integrations, deployment, or authentication requirements unless requested.
- Do not launch, publish, or deploy during the initial implementation request.

## Reference documentation

- [Next.js App Router documentation](https://nextjs.org/docs/app)
- [Supabase vector columns and pgvector](https://supabase.com/docs/guides/ai/vector-columns)
- [Supabase AI and vectors overview](https://supabase.com/docs/guides/ai)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Delamibrands proxy taxonomy](./voc-proxy-data-items.md)
