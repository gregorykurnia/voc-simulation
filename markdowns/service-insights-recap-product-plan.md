# Service Insights Recap — Product Plan and Build Prompt

## Purpose

Define the next product surface for the Delamibrands VOC simulation: a recap that turns tagged Voice of Customer / Voice of Service feedback into evidence-backed themes, cross-functional improvement actions, and a measured follow-up loop.

This document has two parts:

1. A product plan based on the supplied process image and the app that exists today.
2. A copy-ready implementation prompt for an agent asked to build this phase in the repository.

## What the reference is asking for

The image describes a sequence after feedback has been tagged and standardized:

1. Bring structured fields together: product, brand, issue type, sentiment, store, and channel.
2. Consolidate VOC / VOS data so teams can analyze it consistently.
3. Surface trends, likely root causes, and opportunities.
4. Turn those findings into recommendations and improvement actions.
5. Track the effect across Brand, MD, PD, SCM, Marketing, and Operations.

The new page should close the gap between **Processed** feedback, which explains what customers said, and **Customer service cases**, which handles an individual customer's follow-up. It should answer:

> What recurring customer or service signal should Delamibrands act on, which evidence supports it, who owns the response, and what changed afterward?

Here, an “insight” is a recurring, evidence-linked pattern. An “action” is a systemic improvement owned by a function. A customer-specific refund, exchange, or response remains a case.

## Recommendation

Add **Service Insights Recap** to the workspace sidebar as the next step after **Processed**. Give it a route at `/insights` and make it the cross-functional view over the existing tagged feedback, topic clusters, and validated case learning.

The page should help a user move through this loop:

```text
Tagged feedback → Evidence-backed insight → Named functional owner → Improvement action → Follow-up measure
```

The first release should calculate recaps from records already in the app. Users should be able to review the evidence, write or confirm an interpretation, assign a department and owner, record the intended change, and compare the signal after the action. The page should not claim that a change caused an outcome; it should show the observed before-and-after signal and its limits.

## Fit with the existing app

The repository currently has:

- `/reviews` for incoming raw statements.
- `/processed` for rule-tagged reviews, filters, topic clusters, representative quotes, confidence, and review state.
- `/cases` for customer-specific triage, ownership, SLA, resolution, QA, and validated learning.
- Shared data helpers that support both Firestore and local demo storage.
- A fictional Delamibrands proxy dataset marked `synthetic: true`.

The new page should reuse these records and existing visual language. It should not create a second review database or duplicate the case workflow. The seeded annotations are rule-based and the cluster summaries are seeded; make that provenance visible when presenting a derived insight.

## Primary users and jobs

| User | Job to be done |
| --- | --- |
| Customer insights / VOC analyst | See what is changing, check the supporting statements, and prepare a concise recap. |
| Brand or functional lead | Understand which customer issue affects their area and agree on a practical response. |
| Action owner | Know the expected change, due date, and evidence to revisit when checking impact. |
| Leadership | Review a short, traceable view of recurring signals, owners, and observed outcomes. |

## Product scope

### 1. Navigation and page structure

- Add a sidebar link named **Service Insights Recap** after **Processed** and before **Customer service cases**.
- Add the `/insights` route and use the same active-navigation and breadcrumb behavior as the existing pages.
- Use the existing Bright Utility design direction: compact, clear, data-first, accessible controls, and restrained color.
- Use a page heading that states the selected feedback period and a short description that distinguishes system-level insights from individual cases.
- Provide two page views or tabs: **Recap** and **Improvement actions**. Keep the recap as the default view.

### 2. Recap filters and signal summary

Use the current structured annotation fields and feedback dates. Provide filters for:

- Feedback date range, with useful presets and a custom range.
- Brand.
- Product category.
- Issue type / topic cluster.
- Store or location.
- Voice source / channel.
- Sentiment.

Filters must apply consistently to metrics, trends, insight evidence, and impact comparisons. Show the active scope, result count, and an accessible clear-filters action. Provide useful empty and low-volume states.

The top-line summary should prioritize:

- Number of eligible tagged statements in scope.
- Negative or mixed sentiment share, with its denominator.
- The most frequent recurring topic in scope.
- Change from the immediately preceding equal-length period, only when that comparison is meaningful.
- Number of open improvement actions in scope.

Include small, readable trends or distributions where they add meaning. Avoid decorative charts and avoid percentage-only metrics without counts. Where an annotation is uncertain or still needs review, expose the data-quality context instead of presenting the finding as settled.

### 3. Evidence-backed insight list and detail

Build insight candidates from existing topic clusters and tagged review records. An insight card or row should show:

- A short title and plain-language description of the observed signal.
- Topic / issue, affected brand, product, store, source, and date range where known.
- Supporting review count and share of the filtered feedback.
- Direction and size of change versus the comparison period, when available.
- Sentiment mix, including counts.
- A small set of representative customer statements with links to their review detail.
- Annotation provenance / review quality, so rule-assigned or unvalidated data is not mistaken for a confirmed finding.
- A clear action to review details or create an improvement action.

The detail view should let the user inspect the exact supporting statements, expand the breakdown by brand / product / store / source, and read linked validated case learning when available. Reuse review drawers or evidence patterns where appropriate.

Separate these concepts in the UI:

- **Observed signal:** what the tagged feedback and counts show.
- **Possible driver:** an analyst hypothesis supported by evidence, if one has been entered or validated.
- **Recommendation:** the proposed response.

Do not infer a definitive root cause from co-occurrence or a rule-based cluster. Present any unvalidated explanation as a hypothesis and keep its evidence accessible.

### 4. Cross-functional improvement actions

Let an authorized workspace user create an improvement action from an insight. The first release should capture:

- Action title and intended change.
- Linked insight / topic and the scope used to create it.
- Owning function: Brand, MD, PD, SCM, Marketing, or Operations.
- Named owner as editable text, because this prototype has no organization directory.
- Status: Proposed, Planned, In progress, Monitoring impact, Completed, or Closed.
- Created date, due date, next review date, and notes / updates.
- The expected signal to improve, such as issue count, negative share, a product / store signal, or a manually described measure.
- Baseline period and value; target value is optional.

An action may have more than one functional contributor if that can be represented simply. Keep the primary owner explicit. The list should support filtering by owner function, status, due date, brand, and topic, with a useful overdue / due-soon state.

Actions must persist in both the current Firestore mode and local demo mode, using the repository's existing data patterns. Preserve links to the source insight and evidence when saved. Changes should include who changed them and when where the current app's data model allows it.

### 5. Impact tracking

When an action reaches **Monitoring impact**, let the owner select a follow-up period and inspect the same signal for that period. Compare it with the stored baseline using the same insight scope and metric definition. Show:

- Baseline value, period, and denominator.
- Follow-up value, period, and denominator.
- Absolute and relative difference when valid.
- A plain-language label such as improved, unchanged, worsened, or insufficient evidence.
- An owner note about what changed and relevant context.

If no records exist for a window or the volume is too small, show “insufficient evidence.” Never manufacture a zero, hide the denominator, or label an observed association as causal impact. Let the owner record a manual outcome note for operational measures that are not present in feedback data.

### 6. Data and calculation rules

- Use annotated reviews as the source for insight counts; preserve each review ID for drill-down.
- Use `feedback_at` for time windows and the existing annotation fields for dimensions.
- Respect `excluded_from_clustering` when building cluster-specific themes. Keep excluded records identifiable in the underlying review workflow rather than silently deleting them.
- Display review-state and confidence context. Do not require every annotation to be human-validated for the demo recap to work.
- Only show period deltas when the comparison windows and denominators are available. Explain the comparison window in the UI.
- Use a minimum evidence threshold or a visibly labeled low-evidence state so a single comment does not read like a company-wide trend.
- Keep the dataset's synthetic-proxy label visible. Do not imply that the seeded feedback is real customer feedback.
- If the page uses VOS to mean Voice of Service, treat that as a working interpretation of the screenshot. Do not invent a separate feed or channel; current records are a unified feedback set.

### 7. Out of scope for this release

- Live connectors to social networks, marketplaces, CRM, survey, POS, or service platforms.
- A production data lake or a second feedback store.
- Automated AI root-cause claims, forecasting, or guaranteed causal attribution.
- Sending customer messages or creating tasks in external work-management tools.
- A general-purpose BI builder or custom report authoring system.
- Replacing the current case workflow with systemic improvement actions.

## Suggested delivery sequence

### Increment 1 — Recap foundation

- Sidebar item, route, page shell, data filters, period summary, topic trends, and evidence drill-down.
- Data-quality / provenance context and stable empty states.
- Use only existing feedback, cluster, and case-learning data.

### Increment 2 — Improvement action loop

- Persist systemic action records in Firestore and demo storage.
- Add ownership, status, due dates, scope, notes, and action list filters.
- Keep actions distinct from individual customer cases.

### Increment 3 — Follow-up measurement

- Save a baseline when the action is planned.
- Capture a same-scope follow-up period and observed signal.
- Add owner context and an insufficient-evidence state.

The repository implementation prompt below asks for a coherent first usable version of these increments while keeping the feature narrow enough for this prototype.

## Success measures for a Delamibrands pilot

Establish baselines with the pilot team before setting numerical targets. Track:

- Time required to prepare and review a recurring VOC / VOS recap.
- Share of surfaced insights with evidence that users can inspect.
- Share of accepted insights with a named functional owner and due date.
- On-time completion and overdue rate of improvement actions.
- Share of actions with a completed follow-up measurement.
- Whether the same issue signal recurs in the follow-up period.
- Analyst and action-owner confidence that the recap is useful and traceable.

## Assumptions to validate with Delamibrands

- **MD** is interpreted as Merchandising; confirm the company’s preferred expansion and team label.
- **PD** is interpreted as Product Development and **SCM** as Supply Chain Management.
- VOC / VOS are treated as customer and service feedback consolidated into one analysis view for this prototype. Confirm if Delamibrands has a separate VOS source or definition.
- The first users are insights analysts and functional owners; the page is not an external customer-facing experience.
- The current synthetic proxy data is suitable for demonstrating the workflow, but real-data access and approved source mappings will be needed before operational use.
- Impact is an observed before-and-after comparison unless Delamibrands later supplies an agreed evaluation method.

---

## Copy-ready implementation prompt

```text
Implement the Service Insights Recap phase described in `markdowns/service-insights-recap-product-plan.md` in this repository.

First inspect `AGENTS.md`, `README.md`, `markdowns/voc-simulation-design-direction.md`, `markdowns/customer-service-cases-product-plan.md`, and the existing app structure. Follow the repository workflow: make a focused change, run the relevant checks, review the changed-file list before staging, commit only this feature's files, and push to the configured upstream branch. Never stage `.env.local`, `node_modules/`, or `dist/`.

## Product outcome

Add a Service Insights Recap workspace page that connects the existing Processed feedback and topic clusters to cross-functional improvement actions and observed follow-up measures. Keep the existing Reviews, Processed, and Customer service cases behavior intact.

## Implementation requirements

1. Add a sidebar navigation item named `Service Insights Recap`, a `/insights` route, active navigation state, and the correct breadcrumb. Place it after Processed and before Customer service cases.
2. Build the page in the existing Bright Utility visual system. Include a Recap view and an Improvement actions view, responsive layouts, accessible labels and focus states, and loading, error, empty, and low-evidence states.
3. Derive recap data from existing annotated reviews, clusters, and validated case learning. Do not create a duplicate feedback store or assume a production data connector exists.
4. Add consistent filters for date range, brand, product category, issue / topic, store, voice source, and sentiment. Apply the selected scope consistently to counts, trends, insights, evidence, and impact comparison. Include a clear-filters action and visibly state the selected date window.
5. Show signal volume, negative / mixed share with its denominator, recurring topics, sentiment mix, and an equal-length previous-period comparison only when both windows contain enough evidence. Use clear counts and compact charts or distributions; do not add a chart dependency without a concrete need.
6. Make every surfaced insight traceable to exact review records. Show counts, dimensions, evidence statements, sentiment, annotation provenance / review state, and comparison limits. Reuse existing review detail behavior where practical.
7. Keep observed signal, possible driver, and recommendation distinct. Mark unvalidated explanations as hypotheses. Do not present rule-based tags or correlations as confirmed root causes, and do not imply the synthetic proxy statements are real.
8. Allow users to create systemic improvement actions from insights. Capture title, intended change, linked insight and scope, primary owner function (Brand, MD / Merchandising, PD / Product Development, SCM / Supply Chain, Marketing, Operations), editable owner name, status, due date, next review date, notes, metric, baseline period/value, and optional target.
9. Keep systemic improvement actions separate from customer service cases. Persist actions in both Firestore and local demo mode through the existing data architecture. Preserve source-insight links and make updates durable after refresh.
10. For actions being monitored, compare a same-scope follow-up period with the stored baseline. Show values, denominators, difference, follow-up window, and an outcome label. Show `insufficient evidence` for missing or too-small samples; never substitute zero or claim causal impact. Allow an owner note for measures not represented in feedback records.

## Acceptance criteria

- `/insights` is reachable from the sidebar and its breadcrumb is correct.
- Filters recompute the same scoped metrics, insights, evidence, and comparisons.
- A user can open an insight and navigate from it to its exact supporting reviews.
- A user can create and update an improvement action; it remains after reload in demo mode and uses the existing Firestore persistence path when configured.
- An action's follow-up comparison uses the same scope and metric as its baseline and reports insufficient evidence accurately.
- No new external service, real feedback source, CRM behavior, or customer messaging is introduced.
- Existing Reviews, Processed, and Customer service cases routes remain functional.
- Run the relevant repository checks and report their results, then commit and push according to `AGENTS.md`.

Use sound judgment on implementation details, but keep the product behavior aligned with the plan and call out any assumption that blocks a faithful implementation.
```
