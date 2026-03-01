import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Validate API key
function isAuthorized(req: NextRequest) {
  const key = req.headers.get('x-api-key');
  return key === process.env.API_SECRET_KEY;
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

    const { data: inserted, error } = await supabase
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

    if (error) throw error;

    return NextResponse.json({ success: true, id: inserted.id });
  } catch (e: any) {
    console.error('Error saving snapshot:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/snapshots — list all snapshots (optionally filter by machine_id)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const machine_id = searchParams.get('machine_id');

  let query = supabase
    .from('snapshots')
    .select('id, machine_id, machine_name, snapshot_name, timestamp')
    .order('timestamp', { ascending: false });

  if (machine_id) {
    query = query.eq('machine_id', machine_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
