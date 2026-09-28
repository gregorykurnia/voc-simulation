# Delami / Signals

A local two-page VOC workbench for the fictional Delamibrands proxy dataset. The app uses Vite, React, TypeScript, Firebase Authentication, and Cloud Firestore.

## Firebase setup

The Firebase web configuration is loaded from `.env.local` and is ignored by version control. When those values are missing (for example, when they are not set in Vercel), the app opens in demo mode with the synthetic dataset stored in that browser. Demo changes stay in that browser and are not shared.

For shared data, enable Cloud Firestore and the Google provider in Firebase Authentication, then add all `VITE_FIREBASE_*` values from `.env.local` to the Vercel project. Apply the authenticated rules in `firestore.rules` from the Firebase console or Firebase CLI. The rules require a signed-in Firebase user for reads and writes.

In shared mode, the first sign-in seeds 275 Indonesian fictional statements, taxonomy catalogs, proxy store locations, and empty topic-cluster definitions in Firestore. In demo mode, the same dataset is created in browser storage. All records carry `synthetic: true` metadata; the customer statements themselves contain no synthetic-data label.

## Run locally

```sh
npm install
npm run dev
```

Open `/reviews` for the unprocessed inbox and `/processed` for tagged reviews and topic clusters. Processing uses the transparent local rule set (`Rules v1.0`) and saves results to browser storage in demo mode or Firestore when configured. It does not call an AI provider.

Vercel hosting is configured outside this repository.
