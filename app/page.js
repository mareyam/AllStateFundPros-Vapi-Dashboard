'use client';

import { useEffect, useState, useCallback } from 'react';

const OUTCOME_LABEL = {
  'ai-completed': 'Picked up (AI)',
  forwarded: 'Forwarded to human',
  voicemail: 'Voicemail',
  cut: 'Call cut',
  'no-answer': 'No answer',
  other: 'Other'
};
const HANDLED_LABEL = {
  ai: 'AI',
  human: 'Human',
  voicemail: 'Voicemail',
  unclear: 'Unclear',
  none: '—'
};

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(sec) {
  if (sec === null || sec === undefined) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export default function DashboardPage() {
  const [dateStart, setDateStart] = useState('2026-06-01');
  const [dateEnd, setDateEnd] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [handledFilter, setHandledFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const [calls, setCalls] = useState([]);
  const [status, setStatus] = useState('Loading…');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setDateEnd(isoDate(new Date()));
  }, []);

  const load = useCallback(async (start, end, all) => {
    setStatus('Loading calls from Google Sheet…');
    try {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      if (all) params.set('all', '1');
      const res = await fetch('/api/calls?' + params.toString());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const data = await res.json();
      setCalls(data);
      setStatus(
        `${data.length} calls, ${start || '2026-06-01'} to ${end || 'today'}` +
        (all ? ' (showing all)' : ' (picked up + forwarded only)')
      );
    } catch (err) {
      setStatus('Failed to load: ' + err.message);
    }
  }, []);

  useEffect(() => {
    if (dateEnd) load(dateStart, dateEnd, showAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateEnd]);

  const filtered = calls.filter(c => {
    if (outcomeFilter && c.outcome !== outcomeFilter) return false;
    if (handledFilter && c.handledBy !== handledFilter) return false;
    if (search && !c.customerNumber.includes(search)) return false;
    return true;
  });

  const picked = calls.filter(c => c.outcome === 'ai-completed').length;
  const forwarded = calls.filter(c => c.outcome === 'forwarded').length;
  const handledCounts = calls.reduce((acc, c) => {
    acc[c.handledBy] = (acc[c.handledBy] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <header className="header">
        <div>
          <h1>AllStateFundPros Vapi Dashboard</h1>
          <div className="sub">{status}</div>
        </div>
        <button onClick={() => load(dateStart, dateEnd, showAll)}>Refresh</button>
      </header>

      <div className="stats">
        <Stat label="Shown" n={calls.length} />
        <Stat label="Picked up" n={picked} />
        <Stat label="Forwarded" n={forwarded} />
        <Stat label="AI handled" n={handledCounts.ai || 0} />
        <Stat label="Human handled" n={handledCounts.human || 0} />
      </div>

      <div className="controls">
        <label>From</label>
        <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
        <label>To</label>
        <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
        <button className="secondary" onClick={() => load(dateStart, dateEnd, showAll)}>Apply range</button>

        <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
          <option value="">Picked up + forwarded</option>
          <option value="ai-completed">Picked up (AI)</option>
          <option value="forwarded">Forwarded to human</option>
        </select>

        <select value={handledFilter} onChange={e => setHandledFilter(e.target.value)}>
          <option value="">AI or human: all</option>
          <option value="ai">AI picked up</option>
          <option value="human">Human picked up</option>
          <option value="unclear">Unclear</option>
        </select>

        <input
          type="text"
          placeholder="Search phone number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={showAll}
            onChange={e => {
              setShowAll(e.target.checked);
              load(dateStart, dateEnd, e.target.checked);
            }}
          />
          Show no-answers / voicemail / failed too
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Duration</th>
            <th>Outcome</th>
            <th>Picked up by</th>
            <th>Customer said</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id} onClick={() => setSelected(c)}>
              <td>{fmtDate(c.startedAt)}</td>
              <td>{c.customerNumber || '—'}</td>
              <td>{fmtDuration(c.durationSec)}</td>
              <td>
                <span className={`badge badge-${c.outcome}`}>
                  {OUTCOME_LABEL[c.outcome] || c.outcome}
                </span>
              </td>
              <td className={`handled-${c.handledBy}`}>{HANDLED_LABEL[c.handledBy] || c.handledBy}</td>
              <td className="quote">
                {c.quotes.length
                  ? c.quotes.map((q, i) => <div key={i}>{q}</div>)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && <div className="empty">No calls match these filters.</div>}

      {selected && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <h2>{selected.customerNumber || 'Unknown number'}</h2>
            <div className="meta">
              {fmtDate(selected.startedAt)} · {fmtDuration(selected.durationSec)} · {OUTCOME_LABEL[selected.outcome] || selected.outcome} · picked up by: {HANDLED_LABEL[selected.handledBy] || selected.handledBy} · ended: {selected.endedReason || '—'}
            </div>
            <div className="section-label">Customer said (verbatim)</div>
            <div className="quote">
              {selected.quotes.length
                ? selected.quotes.map((q, i) => <div key={i}>{q}</div>)
                : <div style={{ fontStyle: 'italic' }}>No customer speech captured.</div>}
            </div>
            <div className="section-label">Full transcript</div>
            <pre>{selected.transcript || '(no transcript available)'}</pre>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, n }) {
  return (
    <div className="stat">
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}
