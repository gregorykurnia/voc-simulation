# Delami / Signals

A VOC and service-insights workbench for the fictional Delamibrands proxy dataset. The app uses Vite, React, TypeScript, Firebase Authentication, and Cloud Firestore.

## Firebase setup

The Firebase web configuration is loaded from `.env.local` and is ignored by version control. When Firebase is configured, the app signs in anonymously in the background, so opening the site does not require a Google sign-in. If anonymous sign-in is unavailable, the app opens in demo mode with the synthetic dataset stored in that browser. Demo changes stay in that browser and are not shared.

For shared data, enable Cloud Firestore and the Anonymous provider in Firebase Authentication, then add all `VITE_FIREBASE_*` values from `.env.local` to the Vercel project. Apply the authenticated rules in `firestore.rules` from the Firebase console or Firebase CLI. The rules require a signed-in Firebase user for reads and writes.

In shared mode, the first anonymous sign-in seeds 275 Indonesian fictional statements, taxonomy catalogs, proxy store locations, and empty topic-cluster definitions in Firestore. In demo mode, the same dataset is created in browser storage. All records carry `synthetic: true` metadata; the customer statements themselves contain no synthetic-data label.

## Run locally

```sh
npm install
npm run dev
```

Open `/reviews` for the unprocessed inbox, `/processed` for tagged reviews and topic clusters, and `/cases` for customer-service work. Cases can be created from any review; a rule-based triage view also surfaces likely actionable feedback and similar open cases for an agent to confirm. The case workflow records ownership, SLA and supervisor decisions, escalation, response history, resolution, QA, reopening, and validated learning linked to topic clusters. Case records, events, and messages save to browser storage in demo mode or Firestore when configured. Case triage is behind a provider interface; the configured `Rules v1.0` provider uses transparent local rules and does not call an AI service. Customer messages are recorded after agents send them through the channel; this prototype does not send messages externally.

Vercel hosting is configured outside this repository.


## Service Insights Recap

Open `/insights` to review scoped tagged feedback, sentiment counts, previous equal-length periods, topic evidence, and linked validated case learning. Period presets end at the latest feedback date in the dataset so the proxy demo remains useful over time. All figures use `feedback_at`; excluded reviews remain in overall counts but do not contribute to topic themes. The minimum comparison sample is five statements in each window.

Create systemic improvement actions from a topic, then assign a function and named owner, due dates, intended change, and expected metric. Actions are stored in the `improvementActions` Firestore collection under the existing authenticated rules or in the existing browser demo store. Moving an action beyond Proposed stores its baseline snapshot, evidence IDs, scope, and metric. Scope and metric remain fixed after planning. Monitoring supports a later follow-up window, owner context, and exact evidence. Issue-count comparisons require equal-length windows. Shares show percentage-point and relative changes; absent or small samples show insufficient evidence. Manual operational outcomes use owner notes. These observed comparisons do not establish causality.

Run `npm run test:insights` for calculation checks and `npm run build` for TypeScript and the production bundle.
