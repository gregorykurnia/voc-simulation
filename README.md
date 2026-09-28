# Delami / Signals

A local two-page VOC workbench for the fictional Delamibrands proxy dataset. The app uses Vite, React, TypeScript, Firebase Authentication, and Cloud Firestore.

## Firebase setup

The Firebase web configuration is loaded from `.env.local` and is ignored by version control. Before signing in, enable Cloud Firestore and the Google provider in Firebase Authentication. Apply the authenticated rules in `firestore.rules` from the Firebase console or Firebase CLI. The rules require a signed-in Firebase user for reads and writes.

On first sign-in, the app seeds 275 Indonesian fictional statements, taxonomy catalogs, proxy store locations, and empty topic-cluster definitions. The seed is idempotent after `meta/seed-v1` is written. All records carry `synthetic: true` metadata; the customer statements themselves contain no synthetic-data label.

## Run locally

```sh
npm install
npm run dev
```

Open `/reviews` for the unprocessed inbox and `/processed` for tagged reviews and topic clusters. Processing currently uses a transparent local rule set (`Rules v1.0`) and records that provenance in Firestore. It does not call an AI provider.

No hosting or deployment is configured as part of this prototype.
