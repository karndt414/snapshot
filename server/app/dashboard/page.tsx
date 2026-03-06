'use client';

import { useEffect, useMemo, useState } from 'react';

interface SnapshotMeta {
  id: string;
  machine_id: string;
  machine_name: string;
  snapshot_name: string;
  timestamp: string;
}

type MachineType = 'Laptop' | 'Desktop' | 'Server' | 'Virtual Machine' | 'Unknown';
type SortMode = 'recent' | 'name' | 'type';

interface MachineGroup {
  machineId: string;
  machineName: string;
  machineType: MachineType;
  snapshots: SnapshotMeta[];
  latestTimestamp: string;
}

function inferMachineType(machineName: string, machineId: string): MachineType {
  const value = `${machineName} ${machineId}`.toLowerCase();
  if (value.includes('server')) return 'Server';
  if (value.includes('vm') || value.includes('virtual') || value.includes('hyper-v') || value.includes('wsl')) return 'Virtual Machine';
  if (value.includes('macbook') || value.includes('laptop') || value.includes('notebook')) return 'Laptop';
  if (value.includes('desktop') || value.includes('workstation') || value.includes('imac')) return 'Desktop';
  return 'Unknown';
}

function compareMachines(a: MachineGroup, b: MachineGroup, sortMode: SortMode) {
  if (sortMode === 'name') {
    return a.machineName.localeCompare(b.machineName);
  }

  if (sortMode === 'type') {
    const byType = a.machineType.localeCompare(b.machineType);
    if (byType !== 0) return byType;
    return b.latestTimestamp.localeCompare(a.latestTimestamp);
  }

  return b.latestTimestamp.localeCompare(a.latestTimestamp);
}

export default function Dashboard() {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [query, setQuery] = useState('');

  const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';

  useEffect(() => {
    if (!apiKey) {
      setError('NEXT_PUBLIC_API_KEY is not configured.');
      setLoading(false);
      return;
    }
    fetch('/api/snapshots', { headers: { 'x-api-key': apiKey } })
      .then(async r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then(data => { setSnapshots(Array.isArray(data) ? data : []); setLoading(false); })
      .catch((e) => { setError(`Failed to load snapshots: ${e.message}`); setLoading(false); });
  }, [apiKey]);

  async function loadSnapshot(id: string) {
    const res = await fetch(`/api/snapshots/${id}`, { headers: { 'x-api-key': apiKey } });
    const row = await res.json();
    setSelected(row);
  }

  async function deleteSnapshot(id: string) {
    if (!confirm('Delete this snapshot? This cannot be undone.')) return;
    setDeleting(true);
    await fetch(`/api/snapshots/${id}`, { method: 'DELETE', headers: { 'x-api-key': apiKey } });
    setSnapshots(prev => prev.filter(s => s.id !== id));
    if (selected?.id === id) setSelected(null);
    setDeleting(false);
  }

  const machineGroups = useMemo<MachineGroup[]>(() => {
    const grouped = new Map<string, SnapshotMeta[]>();

    for (const snap of snapshots) {
      const current = grouped.get(snap.machine_id) || [];
      current.push(snap);
      grouped.set(snap.machine_id, current);
    }

    const groups: MachineGroup[] = [];
    grouped.forEach((machineSnapshots, machineId) => {
      const sortedSnapshots = [...machineSnapshots].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const machineName = sortedSnapshots[0]?.machine_name || machineId;

      groups.push({
        machineId,
        machineName,
        machineType: inferMachineType(machineName, machineId),
        snapshots: sortedSnapshots,
        latestTimestamp: sortedSnapshots[0]?.timestamp || '',
      });
    });

    return groups;
  }, [snapshots]);

  const visibleMachines = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = machineGroups.filter(machine => {
      if (!needle) return true;
      const haystack = `${machine.machineName} ${machine.machineId} ${machine.machineType}`.toLowerCase();
      return haystack.includes(needle);
    });

    return filtered.sort((a, b) => compareMachines(a, b, sortMode));
  }, [machineGroups, query, sortMode]);

  const totalMachines = machineGroups.length;
  const machineTypeCounts = useMemo(() => {
    return machineGroups.reduce<Record<MachineType, number>>((acc, machine) => {
      acc[machine.machineType] += 1;
      return acc;
    }, { Laptop: 0, Desktop: 0, Server: 0, 'Virtual Machine': 0, Unknown: 0 });
  }, [machineGroups]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r overflow-y-auto flex flex-col">
        <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <h1 className="text-xl font-bold">📸 Snapshot Server</h1>
          <p className="text-sm opacity-80">Multi-machine dashboard</p>
        </div>

        {loading && <p className="p-4 text-gray-500">Loading...</p>}
        {error && <p className="p-4 text-red-500">{error}</p>}

        <div className="p-3 border-b bg-gray-50 space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search machines..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base font-medium text-gray-800 placeholder:text-gray-500 bg-white"
          />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base font-medium text-gray-800 bg-white"
          >
            <option value="recent">Sort: Most recently updated</option>
            <option value="name">Sort: Machine name (A-Z)</option>
            <option value="type">Sort: Machine type</option>
          </select>
          <p className="text-xs text-gray-500">
            {totalMachines} machines · {snapshots.length} snapshots
          </p>
        </div>

        {visibleMachines.map(machine => {
          return (
            <div key={machine.machineId} className="border-b">
              <div className="px-4 py-2 bg-gray-50">
                <div className="font-semibold text-sm text-gray-700 tracking-wide">
                  🖥️ {machine.machineName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {machine.machineType} · {machine.snapshots.length} snapshots · Last update {new Date(machine.latestTimestamp).toLocaleString()}
                </div>
              </div>
              {machine.snapshots.map(snap => (
                <div
                  key={snap.id}
                  onClick={() => loadSnapshot(snap.id)}
                  className={`px-4 py-3 cursor-pointer hover:bg-indigo-50 border-b text-sm transition-colors group ${
                    selected?.id === snap.id ? 'bg-indigo-100 border-l-4 border-indigo-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-gray-800">{snap.snapshot_name}</div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteSnapshot(snap.id); }}
                      disabled={deleting}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs ml-2 shrink-0"
                      title="Delete snapshot"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {new Date(snap.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {!loading && !error && visibleMachines.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No machines match your filters.</p>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Organization Overview</h2>
            <p className="text-gray-500 mb-6">Sort machines by recency, name, or type from the sidebar. Select any snapshot to inspect full details.</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {Object.entries(machineTypeCounts).map(([type, count]) => (
                <div key={type} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{type}</div>
                  <div className="text-2xl font-semibold text-gray-800 mt-1">{count}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Feature Board</h3>
              <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                <li>Now: sorting by recency, machine name, and inferred machine type.</li>
                <li>Next: add tags (team, environment, risk level) for richer filtering.</li>
                <li>Next: add status badges for stale machines (for example no snapshot in 7+ days).</li>
                <li>Next: save per-user dashboard views (favorite filters and sort mode).</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="mb-6 pb-4 border-b flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selected.snapshot_name}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {new Date(selected.timestamp).toLocaleString()} · 🖥️ {selected.machine_name}
                </p>
                {selected.data?.integrity && (
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    ✓ SHA256: {selected.data.integrity.sha256_checksum.substring(0, 16)}...
                  </p>
                )}
              </div>
            </div>

            {/* System Info */}
            <section className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">💻 System Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ['CPU', `${selected.data?.system?.cpu_brand}`],
                  ['Cores', selected.data?.system?.cpu_cores],
                  ['Memory', `${selected.data?.system?.total_memory_gb} GB (${selected.data?.system?.used_memory_gb} GB used)`],
                  ['OS', `${selected.data?.system?.os_distro} ${selected.data?.system?.os_release}`],
                  ['Platform', selected.data?.system?.os_platform],
                  ['Disk', `${selected.data?.system?.total_disk_size_gb} GB`],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
                    <div className="font-medium text-gray-800 mt-1">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Network */}
            <section className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">🌐 Listening Ports</h3>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {selected.data?.network?.listening_ports?.slice(0, 10).map((port: any, i: number) => (
                  <div key={i} className="px-4 py-2 border-b text-sm flex justify-between">
                    <span className="font-medium">{port.process_name || 'Unknown'}</span>
                    <span className="text-gray-500">{port.protocol?.toUpperCase()} :{port.local_port}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Processes */}
            <section>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                ⚙️ Top Processes ({selected.data?.running_processes?.length} total)
              </h3>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {selected.data?.running_processes?.slice(0, 20).map((proc: any, i: number) => (
                  <div key={i} className="px-4 py-2 border-b text-sm flex justify-between items-center">
                    <div>
                      <span className="font-medium">{proc.name}</span>
                      <span className="text-gray-400 ml-2">PID {proc.pid}</span>
                    </div>
                    <div className="text-right text-gray-500">
                      <span className="mr-4">CPU {proc.cpu_usage?.toFixed(2)}%</span>
                      <span>MEM {proc.mem_usage?.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
