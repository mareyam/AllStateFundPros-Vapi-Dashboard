// Reads call data from the public Google Sheet (no VAPI key needed — the
// Sheet is the system of record; a separate scheduled job keeps it synced
// with the VAPI API).

const SHEET_ID = process.env.SHEET_ID || '1vaaBtJmCpcZC76qDbp_WSuR9pZQVIz3Ur1zInyoDNUA';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

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

export async function fetchCallsFromSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
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

export const DEFAULT_START = '2026-06-01T00:00:00.000Z';
