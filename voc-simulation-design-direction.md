# Delamibrands VOC Simulation — Design Direction

## Visual previews

Open the [four-direction comparison](voc-design-directions-overview.png), or view each full-size screen:

- [Signal Studio](voc-direction-signal-studio.png)
- [Bright Utility](voc-direction-bright-utility.png)
- [Editorial Signals](voc-direction-editorial-signals.png)
- [Soft Prism](voc-direction-soft-prism.png)

Each preview uses the same processed-review content so the visual directions are easy to compare.

## Design objective

Make the app feel like a polished product used by a real customer-insights team: bright, clear, confident, and practical. It should have enough density for reviewing hundreds of comments without becoming a spreadsheet, and enough product-specific detail to feel connected to a fashion retailer.

The visual idea is **a customer-signal workbench**. Raw comments are the material; tags, clusters, and summaries are the signals the team shapes from that material.

The design must feel intentional and product-led rather than like a generic AI dashboard. The interface should earn attention through typography, spacing, hierarchy, and useful data states—not through decorative gradients or glowing AI motifs.

## Options to consider

### Option A — Signal Studio

**Character:** bright operations tool with a subtle fashion-editorial edge.

**Visual language:** warm white canvas, deep ink text, confident cobalt actions, small coral and lime moments, crisp borders, compact tables, and one restrained serif style for insight headlines.

**Why it fits:** it balances real analytical work with Delamibrands’ fashion context. It can look distinctive without making the data harder to scan.

**Main risk:** accent colors need discipline. If every tag gets a different bright color, the interface will become noisy.

### Option B — Bright Utility

**Character:** fast, precise, highly usable internal SaaS workbench.

**Visual language:** white and cool gray surfaces, electric blue primary actions, dark navy text, compact 8px spacing rhythm, dense tables, and almost no decorative elements.

**Why it fits:** strongest choice if the application will become a daily operations tool with large datasets and frequent filtering.

**Main risk:** it may feel like a generic analytics product unless the typography and empty states add more brand character.

### Option C — Editorial Signals

**Character:** fashion-insights publication translated into a working application.

**Visual language:** cream canvas, black ink, cobalt rules, oversized editorial headings, generous whitespace, thin dividers, and cluster summaries presented like short research notes.

**Why it fits:** strongest expression of a fashion company and a good direction for presenting insight clusters to leadership.

**Main risk:** the editorial treatment can reduce scan speed on the raw-review page if it is applied to every table element.

### Option D — Soft Prism

**Character:** friendly, approachable, collaborative research tool.

**Visual language:** pale sky, mint, lilac, and butter-yellow accents; rounded cards; softer shadows; larger empty states; conversational copy.

**Why it fits:** approachable for non-technical users and useful if the tool will be shared across many teams.

**Main risk:** pastel palettes and rounded cards are common in AI-generated interfaces. It needs unusually strong typography and restraint to avoid looking interchangeable.

## Selected direction: Bright Utility

**Bright Utility is the chosen design direction** (recorded 2026-09-28). Build the app as a fast, precise internal SaaS workbench: white and cool-gray surfaces, dark navy text, electric-blue actions, compact spacing, dense readable tables, and minimal decoration. Keep the customer-signal workbench concept and the evidence, accessibility, and product-behavior guidance below. Let Delamibrands context come through in precise copy and real customer evidence.

### Core principles

1. **Data first, decoration second.** The review sentence and its tags are the visual focus.
2. **Bright and practical.** Use white and cool-gray surfaces with strong navy text and clear separation instead of gradients.
3. **One strong action color.** Electric blue means action and selection. Use semantic status colors only when they communicate a state.
4. **Controlled density.** Tables should fit useful information in one glance, with details available in a drawer.
5. **Clarity over ornament.** Use a consistent sans-serif type system for controls, data, and insight titles.
6. **Visible provenance.** AI-derived tags should look trustworthy because their source, confidence, and review state are clear.
7. **Real product behavior.** Filters, loading states, empty states, retries, and editing affordances should be designed as carefully as the happy path.

## Visual system

### Color tokens

Use semantic tokens so the palette can be tuned without changing components.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F5F7FA` | Main page background; cool and very light |
| `surface` | `#FFFFFF` | Tables, drawers, cards, and menus |
| `surface-subtle` | `#F0F3F7` | Secondary panels and selected filter areas |
| `ink` | `#17243A` | Main text and headings |
| `ink-muted` | `#66738A` | Supporting text and metadata |
| `line` | `#DCE3EC` | Borders and table rules |
| `blue` | `#2563EB` | Primary action, links, selected states |
| `blue-soft` | `#EAF1FF` | Selected background and focus tint |
| `success` | `#18794E` | Validated state and positive status |
| `success-soft` | `#EAF6EF` | Positive status backgrounds |
| `warning` | `#A85D00` | Attention and needs-review status |
| `warning-soft` | `#FFF4DF` | Warning status backgrounds |
| `danger` | `#C0393B` | Errors and destructive actions |

Do not use a full rainbow of tag colors. Map tag color by meaning: workflow state, sentiment, provenance, and selection. Most taxonomy tags should remain neutral with a small icon or label distinction.

### Typography

- **UI and data:** `Manrope`, `Inter`, or a system sans fallback. Prioritize legibility and compact, consistent forms.
- **Insight titles:** use the same sans-serif family as the interface, with a clear semibold hierarchy rather than a decorative serif.
- **Technical metadata:** system monospace at small sizes for IDs, model versions, and processing-run keys only.

Suggested type scale:

| Role | Size | Weight | Notes |
| --- | ---: | ---: | --- |
| Page title | 26px | 700 | Compact line height; one per page |
| Cluster title | 18px | 650 | Short, human-readable topic name |
| Section title | 14px | 650 | Sentence case |
| Body / review text | 14px | 400 | 1.4 line height for comments |
| Table metadata | 12px | 500 | Muted ink; never below 12px |
| Status / tag text | 11px | 600 | Use sentence case, not all caps |

### Shape, borders, and elevation

- Default radius: 6px.
- Large panels: 8px.
- Buttons and inputs: 6px.
- Use 1px borders as the main separation mechanism.
- Keep shadows minimal; reserve a soft shadow for drawers, menus, and floating controls.
- Avoid making every section a floating card. Use table rules, dividers, and subtle background shifts.

### Spacing and layout

- 4px base unit; use an 8px rhythm with common values of 8, 16, 24, and 32px.
- Desktop shell: 220px left navigation, flexible content, 24px page gutters.
- Content max width: 1440px.
- Keep the main data table at least 760px wide before stacking or horizontal scrolling.
- Use a 12-column grid for composed pages, but do not fill every column with a card.

## App shell

Use a quiet, persistent shell that makes the app feel established.

```text
┌──────────────────────┬─────────────────────────────────────────────────────┐
│ DELAMI / SIGNALS     │ dataset: Synthetic proxy     Process reviews  ⋯     │
│                      ├─────────────────────────────────────────────────────┤
│  Reviews             │                                                     │
│  Processed           │  page title                         last run …       │
│                      │  short one-line description                         │
│  ───────────────     │                                                     │
│  Taxonomy v1         │  filters / search / actions                         │
│  Processing status   │                                                     │
│                      │  primary content                                    │
│  ○ Synthetic proxy   │                                                     │
└──────────────────────┴─────────────────────────────────────────────────────┘
```

Navigation details:

- Wordmark: `DELAMI / SIGNALS`, not a large logo block.
- Active navigation uses an electric-blue left rule and a light-blue background.
- The synthetic-data label is always visible in the shell.
- The top bar contains one primary action, such as `Process reviews`, and a small processing indicator.
- Keep navigation labels plain: `Reviews` and `Processed`.

## Page compositions

### Raw Reviews page

The page should feel like a well-designed research inbox.

1. Page header: `Raw reviews` with a small `200 proxy statements` count and a one-line explanation.
2. A slim summary strip: total reviews, unprocessed, processed, and needs review. Keep these as metric rows, not giant statistic cards.
3. Search and filter toolbar with a wide search input, source filter, brand filter, store filter, status filter, and a compact `Process all` action.
4. Main table with these columns:
   - review text
   - source
   - brand
   - product mention
   - feedback date
   - processing status
   - more action
5. Detail drawer opens from the right and preserves the table position. Show the full review first, then source metadata, then processing history.

Table behavior:

- Let the review sentence occupy the most width.
- Keep tags short and truncate long product names with a tooltip/detail view.
- Use source icons only as secondary cues; always show the source label for accessibility.
- Use row hover to reveal the open-detail affordance, but keep the entire row clickable.

### Processed page

The page should feel like a signal map with a reliable evidence table underneath.

1. Page header: `Processed signals` with a `last processed` timestamp and taxonomy/model version.
2. A horizontal cluster overview with 3–5 highest-volume clusters and a final `View all clusters` control.
3. Cluster cards use a simple structure:
   - cluster title
   - review count
   - one-sentence summary
   - dominant issue and product tags
   - sentiment mix bar
4. Below the overview, show the enriched review table with tags for source, brand, product, issue, store, sentiment, cluster, and confidence.
5. Selecting a cluster turns the cluster card into a selected state and filters the table. A small selection bar should say `Showing 18 reviews in “Sizing inconsistency”` with a clear action.
6. Review detail drawer shows:
   - original statement
   - normalized tags
   - confidence and assignment method
   - cluster summary and neighboring reviews
   - edit controls
   - audit history

### Cluster detail treatment

Cluster summaries should look like concise research notes, not AI chat responses. Use a clear sans-serif title, a one-sentence summary, and a compact evidence section titled `Customer evidence` with exact review excerpts linked to their source rows.

Good cluster title examples:

- `Sizes feel inconsistent across the same chino fit`
- `Popular colors disappear fastest in stores`
- `Customers like the cut but question fabric durability`

Avoid generic titles such as `Product feedback cluster 4` or `AI-generated insight`.

## Component direction

### Tags

Use compact rectangular tags with 6px radius, not oversized pill clouds. Keep most tags neutral; use color sparingly for:

- status
- sentiment
- review state
- selected cluster

Example:

```text
Instagram   The Executive   Career chinos   Sizing   Cluster 03
```

### Status indicators

Use a small colored dot plus text. Do not rely on color alone.

- Open: muted blue dot
- In Review: amber dot
- In Progress: blue dot
- Validated: green dot
- Needs review: amber outline
- Failed: red dot

### Buttons

- Primary: electric-blue fill, white text, 6px radius.
- Secondary: white or transparent with a line border.
- Quiet: text button with a small arrow or icon.
- Destructive: outline or red text until the action is confirmed.

Keep button labels specific: `Process 200 reviews`, `Open cluster`, `Save correction`, and `Clear filters` are better than `Run`, `View`, `Save`, and `Reset`.

### Empty, loading, and error states

Design these as product content, not placeholders:

- No reviews: explain how a seed file will appear and show a disabled import placeholder only if importing is not yet implemented.
- No processed reviews: show `Process the proxy reviews to see tags and clusters` with the processing action.
- No filter matches: show the active filters and a `Clear filters` action.
- Processing: show counts and a thin progress bar; do not block the entire page.
- Failed processing: show the affected count, a short error reason, and a retry action.

## Motion and interaction

Keep motion quick and functional:

- 150–200ms for hover, filter, and selection changes.
- 220–280ms for the detail drawer.
- Fade/slide new cluster summaries in after processing completes.
- Do not add animated gradients, floating blobs, pulsing AI orbs, or constant shimmer effects.
- Preserve scroll position when opening and closing a review drawer.

## Accessibility and trust

- Meet WCAG AA contrast for body text and controls.
- Provide visible keyboard focus states using a 2px electric-blue outline.
- Every colored status includes text or an accessible label.
- Tables must have real headers and support keyboard navigation.
- Do not describe AI-derived tags as facts without showing confidence/provenance.
- Keep the original customer statement visually distinct from normalized or generated content.

## Anti-patterns to avoid

- Purple-on-black “AI command center” styling.
- Giant gradient hero sections inside an internal data app.
- Excessive glassmorphism, blur, glowing borders, or floating blobs.
- A wall of identical white cards with no hierarchy.
- Pill-shaped containers for every label.
- A chart before the user can inspect the supporting reviews.
- Generic copy such as `Unlock powerful insights with AI`.
- Hiding confidence, model version, or source evidence behind a secondary screen.
- Showing a made-up summary without links to the exact comments that support it.

## Design decision summary

Use **Bright Utility** as the selected direction:

- white and cool-gray surfaces
- dark navy typography with electric-blue actions
- semantic status colors used sparingly
- a consistent sans-serif type system
- compact, evidence-first tables
- cluster summaries presented as research notes
- compact spacing, light borders, and minimal elevation
- no dark AI aesthetic, decorative gradients, or excessive rounded cards

This keeps the product fast and clear for daily operations while preserving customer evidence and useful fashion-retail context.

## Prompt for a future implementation agent

Build the Delamibrands VOC Simulation app using the **Bright Utility** design direction in this document. Treat the interface as a precise customer-insights workbench, not a generic AI dashboard. Use the specified semantic color tokens, sans-serif typography, compact spacing, shell, two-page compositions, table behavior, cluster evidence treatment, accessibility rules, and anti-patterns. Start with the two pages defined in `voc-simulation-app-prompt.md`: `/reviews` and `/processed`. Preserve the raw review as the primary object, make derived tags visibly derived, and make every cluster summary traceable to exact supporting reviews. Do not deploy or launch the app as part of the initial implementation.
