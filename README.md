# AllStateFundPros Vapi Dashboard

A black-and-white call dashboard for VAPI calls. It reads call data from a
Google Sheet (kept in sync with the VAPI API by a separate scheduled job),
and shows only calls that were picked up or forwarded to a human, with an
AI-vs-human pickup flag and a verbatim 2-line customer-quote summary per
call.

Built with Next.js (App Router).

## How it works

- `app/page.js` — the dashboard UI (client component)
- `app/api/calls/route.js` — a Next.js Route Handler that reads the public
  Google Sheet's CSV export and serves it as JSON, filtered by date range
  and outcome
- `lib/sheet.js` — shared Sheet-reading/CSV-parsing logic
- The Google Sheet itself is the system of record for call data; this app
  does not call the VAPI API directly, so no VAPI key is needed here

## Local development

```bash
npm install
npm run dev
```

## Environment variables

- `SHEET_ID` (optional) — overrides the Google Sheet ID the app reads from.
  Defaults to the AllStateFundPros call-log sheet.
