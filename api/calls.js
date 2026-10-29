// Vercel serverless function: GET /api/calls
// Reads call data from the public Google Sheet (no VAPI key needed here —
// the Sheet is the system of record; a separate scheduled job keeps it
// synced with the VAPI API).

const SHEET_ID = process.env.SHEET_ID || '1vaaBtJmCpcZC76qDbp_WSuR9pZQVIz3Ur1zInyoDNUA';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const DEFAULT_START = '2026-06-01T00:00:00.000Z';

// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes ("") and embedded newlines inside quoted fields.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

async function fetchCallsFromSheet() {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) {
    throw new Error(`Could not read the Google Sheet (status ${res.status}). Make sure it's shared so this app can read it.`);
  }
  const csv = await res.text();
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  const idx = name => header.indexOf(name);

  return rows.slice(1)
    .filter(r => r.some(cell => cell && cell.trim()))
    .map(r => {
      const durationRaw = r[idx('Duration (sec)')];
      const durationSec = durationRaw === '' || durationRaw === undefined ? null : Number(durationRaw);
      const quotes = [r[idx('Quote 1')], r[idx('Quote 2')]].filter(q => q && q.trim());
      return {
        id: r[idx('Call ID')] || '',
        startedAt: r[idx('Started At')] || '',
        durationSec: Number.isFinite(durationSec) ? durationSec : null,
        endedReason: r[idx('Ended Reason')] || '',
        customerNumber: r[idx('Customer Number')] || '',
        outcome: r[idx('Outcome')] || 'other',
        handledBy: r[idx('Picked Up By')] || 'unclear',
        quotes,
        transcript: quotes.join('\n')
      };
    });
}

module.exports = async (req, res) => {
  try {
    const query = req.query || {};
    const start = query.start ? new Date(query.start + 'T00:00:00.000Z').getTime() : new Date(DEFAULT_START).getTime();
    const end = query.end ? new Date(query.end + 'T23:59:59.999Z').getTime() : Date.now();
    const showAll = query.all === '1';

    const rows = await fetchCallsFromSheet();

    const data = rows
      .filter(row => {
        if (!row.startedAt) return true; // keep rows without a timestamp (e.g. failed-to-connect calls)
        const t = new Date(row.startedAt).getTime();
        return t >= start && t <= end;
      })
      // the sheet holds EVERY call; the dashboard, by default, only
      // surfaces calls that were actually picked up (by AI) or forwarded
      // to a human — no-answers, voicemails and dropped/failed-to-connect
      // calls are hidden unless showAll is requested.
      .filter(row => showAll || row.outcome === 'ai-completed' || row.outcome === 'forwarded')
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(data);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: err.message });
  }
};
