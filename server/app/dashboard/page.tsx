'use client';

import { useEffect, useState } from 'react';

interface SnapshotMeta {
  id: string;
  machine_id: string;
  machine_name: string;
  snapshot_name: string;
  timestamp: string;
}

export default function Dashboard() {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  // Group by machine
  const machines = [...new Set(snapshots.map(s => s.machine_id))];

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

        {machines.map(machineId => {
          const machineSnapshots = snapshots.filter(s => s.machine_id === machineId);
          const machineName = machineSnapshots[0]?.machine_name || machineId;
          return (
            <div key={machineId} className="border-b">
              <div className="px-4 py-2 bg-gray-50 font-semibold text-sm text-gray-600 uppercase tracking-wide">
                🖥️ {machineName}
              </div>
              {machineSnapshots.map(snap => (
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
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg">
            �� Select a snapshot to view details
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
