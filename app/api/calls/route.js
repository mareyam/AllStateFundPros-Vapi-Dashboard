import { NextResponse } from 'next/server';
import { fetchCallsFromSheet, DEFAULT_START } from '../../../lib/sheet';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const showAll = searchParams.get('all') === '1';

    const start = startParam ? new Date(startParam + 'T00:00:00.000Z').getTime() : new Date(DEFAULT_START).getTime();
    const end = endParam ? new Date(endParam + 'T23:59:59.999Z').getTime() : Date.now();

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

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
