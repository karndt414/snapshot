import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

type SnapshotStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';
const DEFAULT_API_SECRET_KEY = 'sb_publishable_4cRWlmo693rt6aPU8Tmqjg_ZDnfLWJV';

function estimateSnapshotSizeBytes(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload || {}), 'utf8');
  } catch {
    return 0;
  }
}

function normalizeStatus(value: unknown): SnapshotStatus {
  if (typeof value !== 'string') return 'Completed';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'running') return 'Running';
  if (normalized === 'failed') return 'Failed';
  return 'Completed';
}

function extractStatus(data: any): SnapshotStatus {
  const candidate = data?.metadata?.snapshot_status || data?.metadata?.status;
  return normalizeStatus(candidate);
}

function extractStatusError(data: any): string | null {
  const error = data?.metadata?.error || data?.metadata?.failure_reason || null;
  if (typeof error === 'string' && error.trim()) return error.trim();
  return null;
}

// Validate API key
function isAuthorized(req: NextRequest) {
  const key = req.headers.get('x-api-key');
  return key === (process.env.API_SECRET_KEY || DEFAULT_API_SECRET_KEY);
}

// POST /api/snapshots — upload a snapshot from an Electron machine
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { machine_id, machine_name, snapshot_name, data } = body;

    if (!machine_id || !snapshot_name || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try inserting with dedicated columns; fall back without them
    let inserted: { id: string } | null = null;
    const { data: result1, error: err1 } = await getSupabase()
      .from('snapshots')
      .insert({
        machine_id,
        machine_name: machine_name || machine_id,
        snapshot_name,
        timestamp: data.metadata?.timestamp || new Date().toISOString(),
        data,
        snapshot_status: extractStatus(data),
        snapshot_size_bytes: estimateSnapshotSizeBytes(data),
        snapshot_error: extractStatusError(data),
      })
      .select('id')
      .single();

    if (err1) {
      // Retry without the new columns in case they don't exist yet
      const { data: result2, error: err2 } = await getSupabase()
        .from('snapshots')
        .insert({
          machine_id,
          machine_name: machine_name || machine_id,
          snapshot_name,
          timestamp: data.metadata?.timestamp || new Date().toISOString(),
          data,
        })
        .select('id')
        .single();

      if (err2) throw err2;
      inserted = result2;
    } else {
      inserted = result1;
    }

    return NextResponse.json({ success: true, id: inserted!.id });
  } catch (e: any) {
    console.error('Error saving snapshot:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/snapshots — list all snapshots (optionally filter by machine_id)
// NOTE: deliberately excludes the `data` column to avoid massive Supabase egress.
// Status and size are read from dedicated columns (snapshot_status, snapshot_size_bytes)
// if they exist, otherwise they fall back to safe defaults without fetching the blob.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const machine_id = searchParams.get('machine_id');

  // Try the lightweight query first (uses dedicated columns).
  // Fall back to fetching `data` if the columns don't exist yet.
  let query = getSupabase()
    .from('snapshots')
    .select('id, machine_id, machine_name, snapshot_name, timestamp, snapshot_status, snapshot_size_bytes, snapshot_error')
    .order('timestamp', { ascending: false });

  if (machine_id) {
    query = query.eq('machine_id', machine_id);
  }

  let { data, error } = await query;

  // If the query failed (e.g. columns don't exist yet), fall back to fetching with data
  if (error) {
    let fallbackQuery = getSupabase()
      .from('snapshots')
      .select('id, machine_id, machine_name, snapshot_name, timestamp, data')
      .order('timestamp', { ascending: false });

    if (machine_id) {
      fallbackQuery = fallbackQuery.eq('machine_id', machine_id);
    }

    const fallback = await fallbackQuery;
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });

    const rows = (fallback.data || []).map((row: any) => ({
      id: row.id,
      machine_id: row.machine_id,
      machine_name: row.machine_name,
      snapshot_name: row.snapshot_name,
      timestamp: row.timestamp,
      snapshot_size_bytes: estimateSnapshotSizeBytes(row.data),
      snapshot_status: extractStatus(row.data),
      snapshot_error: extractStatusError(row.data),
    }));

    return NextResponse.json(rows);
  }

  const rows = (data || []).map((row: any) => ({
    id: row.id,
    machine_id: row.machine_id,
    machine_name: row.machine_name,
    snapshot_name: row.snapshot_name,
    timestamp: row.timestamp,
    snapshot_size_bytes: row.snapshot_size_bytes ?? 0,
    snapshot_status: normalizeStatus(row.snapshot_status),
    snapshot_error: row.snapshot_error ?? null,
  }));

  return NextResponse.json(rows);
}
