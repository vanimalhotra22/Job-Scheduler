import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';

const API_BASE = 'http://localhost:5000/api';

// --- Theme Context ---
type ThemeMode = 'dark' | 'light';
const ThemeContext = createContext<{ theme: ThemeMode; toggle: () => void }>({ theme: 'dark', toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

// --- Toast System ---
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: string; type: ToastType; title: string; message?: string; }
let toastIdCounter = 0;
let globalAddToast: ((type: ToastType, title: string, message?: string) => void) | null = null;
function addToast(type: ToastType, title: string, message?: string) {
  if (globalAddToast) globalAddToast(type, title, message);
}

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  globalAddToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${++toastIdCounter}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const iconMap: Record<ToastType, string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} style={{ position: 'relative' }}>
          <span className="toast-icon">{iconMap[t.type]}</span>
          <div className="toast-content">
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
          <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}

// --- SVG Icons (Self-Contained & Inline) ---
const Icons = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  Queue: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><rect x="7" y="3" width="4" height="18" rx="1" fill="var(--bg-main)"/></svg>,
  Job: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"/><circle cx="8" cy="12" r="2"/></svg>,
  Worker: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Pause: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Refresh: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>,
  Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Warning: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Logs: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><rect x="2" y="3" width="20" height="18" rx="2"/></svg>,
  Key: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  Audit: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  AI: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>,
  DAG: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="6" y1="9" x2="6" y2="15"/><path d="M9 6h6a3 3 0 0 1 3 3v6"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Sun: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Command: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Gantt: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="7" y="16" width="10" height="4" rx="1"/></svg>
};

function SystemSimulator() {
  const [jobs, setJobs] = useState([
    { id: 'job-101', queue: 'Alert-Dispatch', priority: 'CRITICAL', status: 'QUEUED', progress: 0 },
    { id: 'job-102', queue: 'Transcoder-HQ', priority: 'MEDIUM', status: 'QUEUED', progress: 0 },
    { id: 'job-103', queue: 'Mail-Campaign', priority: 'LOW', status: 'QUEUED', progress: 0 }
  ]);
  const [workers, setWorkers] = useState([
    { id: 'node-alpha', status: 'IDLE', cpu: 2, mem: 12 },
    { id: 'node-beta', status: 'IDLE', cpu: 1, mem: 8 }
  ]);
  const [simActive, setSimActive] = useState(false);
  const [log, setLog] = useState<string[]>(['[System] Cluster idle. Ready to simulate workflow.']);

  useEffect(() => {
    if (!simActive) return;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) {
        setLog(prev => [...prev, '[Scheduler] Scanning... Found 3 QUEUED jobs.', '[Scheduler] Claiming job-101 (CRITICAL) via atomic write lock.']);
        setJobs(prev => prev.map((j, idx) => idx === 0 ? { ...j, status: 'CLAIMED' } : j));
      } else if (step === 2) {
        setLog(prev => [...prev, '[Worker] node-alpha claim accepted. Starting job-101.']);
        setWorkers(prev => prev.map((w, idx) => idx === 0 ? { ...w, status: 'BUSY', cpu: 48, mem: 24 } : w));
        setJobs(prev => prev.map((j, idx) => idx === 0 ? { ...j, status: 'RUNNING' } : j));
      } else if (step === 3) {
        setJobs(prev => prev.map((j, idx) => idx === 0 ? { ...j, progress: 50 } : j));
        setLog(prev => [...prev, '[Worker] node-alpha progress: 50%']);
      } else if (step === 4) {
        setJobs(prev => prev.map((j, idx) => idx === 0 ? { ...j, status: 'COMPLETED', progress: 100 } : j));
        setWorkers(prev => prev.map((w, idx) => idx === 0 ? { ...w, status: 'IDLE', cpu: 3, mem: 14 } : w));
        setLog(prev => [...prev, '[Worker] node-alpha execution complete. Status code 200.', '[Scheduler] Unblocking DAG child job-102 (MEDIUM) to QUEUED state.']);
      } else if (step === 5) {
        setJobs(prev => prev.map((j, idx) => idx === 1 ? { ...j, status: 'CLAIMED' } : j));
        setLog(prev => [...prev, '[Scheduler] Claiming job-102 (MEDIUM) via atomic write lock.']);
      } else if (step === 6) {
        setLog(prev => [...prev, '[Worker] node-beta claim accepted. Starting job-102.']);
        setWorkers(prev => prev.map((w, idx) => idx === 1 ? { ...w, status: 'BUSY', cpu: 76, mem: 62 } : w));
        setJobs(prev => prev.map((j, idx) => idx === 1 ? { ...j, status: 'RUNNING' } : j));
      } else if (step === 7) {
        setJobs(prev => prev.map((j, idx) => idx === 1 ? { ...j, progress: 100, status: 'COMPLETED' } : j));
        setWorkers(prev => prev.map((w, idx) => idx === 1 ? { ...w, status: 'IDLE', cpu: 4, mem: 16 } : w));
        setLog(prev => [...prev, '[Worker] node-beta execution complete. Status code 200.']);
      } else if (step === 8) {
        setLog(prev => [...prev, '[Scheduler] No more high-priority jobs. Pipeline flushed.', '[System] Cluster returned to idle.']);
        setSimActive(false);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [simActive]);

  const triggerSim = () => {
    setJobs([
      { id: 'job-101', queue: 'Alert-Dispatch', priority: 'CRITICAL', status: 'QUEUED', progress: 0 },
      { id: 'job-102', queue: 'Transcoder-HQ', priority: 'MEDIUM', status: 'QUEUED', progress: 0 },
      { id: 'job-103', queue: 'Mail-Campaign', priority: 'LOW', status: 'QUEUED', progress: 0 }
    ]);
    setWorkers([
      { id: 'node-alpha', status: 'IDLE', cpu: 2, mem: 12 },
      { id: 'node-beta', status: 'IDLE', cpu: 1, mem: 8 }
    ]);
    setLog(['[System] Initializing simulation...']);
    setSimActive(true);
  };

  return (
    <div className="glass-card" style={{ width: '100%', maxWidth: '800px', padding: '2rem', marginTop: '3rem', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ textAlign: 'left' }}>
          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, background: 'var(--accent-primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Interactive Queue Simulator</h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Watch atomic locking & parent-child DAG transitions in real-time</span>
        </div>
        <button onClick={triggerSim} disabled={simActive} className="sim-btn" style={{ fontSize: '0.85rem' }}>
          {simActive ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Jobs State */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Mock Job Queue</span>
          {jobs.map(job => (
            <div key={job.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{job.id} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({job.queue})</span></span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  backgroundColor: job.priority === 'CRITICAL' ? 'var(--accent-danger-glow)' : 'rgba(255,255,255,0.05)',
                  color: job.priority === 'CRITICAL' ? 'var(--accent-danger)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}>{job.priority}</span>
              </div>
              <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status: <span style={{ 
                  fontWeight: 600,
                  color: job.status === 'RUNNING' ? 'var(--accent-cyan)' : job.status === 'COMPLETED' ? 'var(--accent-success)' : job.status === 'CLAIMED' ? 'var(--accent-primary)' : 'var(--text-muted)'
                }}>{job.status}</span></span>
                {job.progress > 0 && <span>{job.progress}%</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Cluster / Log State */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Live Worker Nodes</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {workers.map(w => (
              <div key={w.id} style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{w.id}</span>
                <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 600, color: w.status === 'BUSY' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{w.status}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>CPU: {w.cpu}% | RAM: {w.mem}%</div>
              </div>
            ))}
          </div>

          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.5rem', textAlign: 'left' }}>Simulation Log</span>
          <div style={{ backgroundColor: '#090a0d', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', height: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', color: '#a5b4fc', textAlign: 'left', borderLeft: '3px solid var(--accent-primary)' }}>
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Command Palette Component ---
function CommandPalette({ isOpen, onClose, commands }: { isOpen: boolean; onClose: () => void; commands: { label: string; icon: string; shortcut?: string; action: () => void; group: string }[] }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
  const groups = [...new Set(filtered.map(c => c.group))];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[activeIndex]) { filtered[activeIndex].action(); onClose(); }
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  let itemIdx = -1;
  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrapper">
          <Icons.Search />
          <input ref={inputRef} className="cmd-input" placeholder="Type a command..." value={query} onChange={e => { setQuery(e.target.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} />
          <span className="kbd">ESC</span>
        </div>
        <div className="cmd-results">
          {filtered.length === 0 ? (
            <div className="cmd-empty">No matching commands found.</div>
          ) : (
            groups.map(group => (
              <div key={group}>
                <div className="cmd-group-label">{group}</div>
                {filtered.filter(c => c.group === group).map(cmd => {
                  itemIdx++;
                  const idx = itemIdx;
                  return (
                    <div key={cmd.label} className={`cmd-item ${idx === activeIndex ? 'active' : ''}`} onClick={() => { cmd.action(); onClose(); }} onMouseEnter={() => setActiveIndex(idx)}>
                      <span className="cmd-icon">{cmd.icon}</span>
                      <span className="cmd-label">{cmd.label}</span>
                      {cmd.shortcut && <span className="cmd-shortcut">{cmd.shortcut}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- DAG Visualization Component ---
function DAGView({ jobs, onSeedDemoDAG }: { jobs: any[]; onSeedDemoDAG: () => void }) {
  const dagJobs = jobs.filter(j => j.dependency_job_id);
  const rootJobs = jobs.filter(j => !j.dependency_job_id && jobs.some(c => c.dependency_job_id === j.id));
  const allDAGNodes = [...rootJobs, ...dagJobs];

  if (allDAGNodes.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
        <h3 style={{ marginBottom: '0.5rem' }}>No Job Dependencies Found</h3>
        <p style={{ fontSize: '0.85rem' }}>Create jobs with <code>dependency_job_id</code> to visualize parent-child DAG pipelines here.</p>
        <button 
          onClick={onSeedDemoDAG}
          className="btn btn-primary" 
          style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <span>⚡</span> Seed Demo DAG Pipeline
        </button>
      </div>
    );
  }

  // Build adjacency map
  const children: Record<string, any[]> = {};
  dagJobs.forEach(j => {
    if (!children[j.dependency_job_id]) children[j.dependency_job_id] = [];
    children[j.dependency_job_id].push(j);
  });

  const renderNode = (job: any, depth: number, index: number) => {
    const kids = children[job.id] || [];
    const statusColor = job.status === 'COMPLETED' ? 'var(--accent-success)' : job.status === 'RUNNING' ? 'var(--accent-cyan)' : job.status === 'FAILED' || job.status === 'DEAD' ? 'var(--accent-danger)' : job.status === 'BLOCKED' ? 'var(--accent-warning)' : 'var(--text-muted)';
    return (
      <div key={job.id} style={{ marginLeft: depth * 48, marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {depth > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>└─</span>}
          <div className={`dag-node ${job.status.toLowerCase()}`} style={{ position: 'relative' }}>
            <div className="dag-node-label">{(job.payload?.type || job.type || 'Job').toString()}</div>
            <div className="dag-node-status" style={{ color: statusColor }}>{job.status}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{job.id.substring(0, 12)}</div>
          </div>
        </div>
        {kids.map((child, ci) => renderNode(child, depth + 1, ci))}
      </div>
    );
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Icons.DAG /> Dependency Graph (DAG Pipeline)
      </h3>
      <div style={{ overflowX: 'auto' }}>
        {rootJobs.map((root, i) => renderNode(root, 0, i))}
      </div>
    </div>
  );
}

// --- Gantt Chart Component ---
function GanttChart({ executions }: { executions: any[] }) {
  if (!executions || executions.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No execution data to visualize.
      </div>
    );
  }

  const sortedExecs = [...executions].filter(e => e.start_time).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  if (sortedExecs.length === 0) return null;

  const minTime = new Date(sortedExecs[0].start_time).getTime();
  const maxTime = Math.max(...sortedExecs.map(e => new Date(e.end_time || e.start_time).getTime() + (e.duration_ms || 5000)));
  const totalRange = maxTime - minTime || 1;

  return (
    <div className="gantt-container">
      <div className="gantt-header">
        <div className="gantt-label" style={{ fontWeight: 700 }}>Worker</div>
        <div style={{ flex: 1, display: 'flex', padding: '0.25rem 0' }}>
          {[0, 25, 50, 75, 100].map(pct => (
            <div key={pct} className="gantt-time-label" style={{ flex: 1 }}>
              {new Date(minTime + (totalRange * pct / 100)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          ))}
        </div>
      </div>
      {sortedExecs.slice(0, 20).map(exec => {
        const start = new Date(exec.start_time).getTime();
        const duration = exec.duration_ms || 5000;
        const leftPct = ((start - minTime) / totalRange) * 100;
        const widthPct = Math.max((duration / totalRange) * 100, 1);
        const barClass = exec.status === 'SUCCESS' ? 'success' : exec.status === 'RUNNING' ? 'running' : 'failed';
        return (
          <div key={exec.id} className="gantt-row">
            <div className="gantt-label">{exec.worker_id ? exec.worker_id.substring(0, 10) : 'N/A'}</div>
            <div className="gantt-track">
              <div className={`gantt-bar ${barClass}`} style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
                {(duration / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  // --- Theme State ---
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('scheduler_theme') as ThemeMode) || 'dark');
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('scheduler_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // --- Command Palette State ---
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // --- Auth State ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<any>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Form states
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  // --- Project & Organization Scope ---
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjId, setSelectedProjId] = useState('');

  // --- Layout State ---
  const [activeTab, setActiveTab] = useState<'overview' | 'queues' | 'jobs' | 'workers' | 'audit' | 'apikeys' | 'aiops' | 'dag' | 'gantt'>('overview');

  // --- App Data States ---
  const [metrics, setMetrics] = useState<any>(null);
  const [queues, setQueues] = useState<any[]>([]);
  const [retryPolicies, setRetryPolicies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);

  // New data states
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterQueue, setFilterQueue] = useState('');

  // Modals & Details
  const [selectedJobDetails, setSelectedJobDetails] = useState<any>(null);
  const [selectedJobLogs, setSelectedJobLogs] = useState<any[]>([]);
  const [selectedJobExecs, setSelectedJobExecs] = useState<any[]>([]);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);

  // Creation forms
  const [newQueueForm, setNewQueueForm] = useState({ name: '', priority: 2, concurrency_limit: 5, retry_policy_id: '', rate_limit_per_minute: '', webhook_url: '' });
  const [newJobForm, setNewJobForm] = useState({ queue_id: '', type: 'email', payload: '{}', priority: 1, delay_ms: 0, cron: '', isBatch: false, batchCount: 3, dependency_job_id: '', tags: '' });

  // Polling ref
  const pollTimerRef = useRef<any>(null);

  // API Keys state
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyExpiry, setApiKeyExpiry] = useState(30);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // AI Ops state
  const [aiErrorMessage, setAiErrorMessage] = useState('');
  const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
  const [predictedQueueId, setPredictedQueueId] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [nlpQuery, setNlpQuery] = useState('');
  const [nlpResults, setNlpResults] = useState<any[]>([]);
  const [nlpFilters, setNlpFilters] = useState<any>(null);

  // Cluster Health / Scaling state
  const [scalingMetrics, setScalingMetrics] = useState<any>(null);
  const [scalingRec, setScalingRec] = useState<any>(null);

  // AI Retry Advisor (Job Inspector)
  const [aiRetryAdvice, setAiRetryAdvice] = useState<any>(null);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdPaletteOpen(prev => !prev); }
      if (e.key === 'Escape') setCmdPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Command definitions ---
  const commandList = [
    { label: 'Go to Overview', icon: '📊', group: 'Navigation', action: () => setActiveTab('overview') },
    { label: 'Go to Queue Settings', icon: '📋', group: 'Navigation', action: () => setActiveTab('queues') },
    { label: 'Go to Jobs Explorer', icon: '⚡', group: 'Navigation', action: () => setActiveTab('jobs') },
    { label: 'Go to Active Workers', icon: '🖥', group: 'Navigation', action: () => setActiveTab('workers') },
    { label: 'Go to Audit Logs', icon: '🛡', group: 'Navigation', action: () => setActiveTab('audit') },
    { label: 'Go to API Keys', icon: '🔑', group: 'Navigation', action: () => setActiveTab('apikeys') },
    { label: 'Go to AI Ops', icon: '🧠', group: 'Navigation', action: () => setActiveTab('aiops') },
    { label: 'Go to DAG View', icon: '🔗', group: 'Navigation', action: () => setActiveTab('dag') },
    { label: 'Go to Gantt Chart', icon: '📊', group: 'Navigation', action: () => setActiveTab('gantt') },
    { label: 'Toggle Theme', icon: '🌓', shortcut: 'T', group: 'Actions', action: toggleTheme },
    { label: 'Refresh Dashboard', icon: '🔄', shortcut: 'R', group: 'Actions', action: () => fetchDashboardData() },
    { label: 'Retry All Failed Jobs', icon: '♻', group: 'Actions', action: () => handleRetryAll() },
    { label: 'Pause All Queues', icon: '⏸', group: 'Actions', action: () => handleToggleAllQueues(true) },
    { label: 'Resume All Queues', icon: '▶', group: 'Actions', action: () => handleToggleAllQueues(false) },
    { label: 'Sign Out', icon: '🚪', group: 'Account', action: () => handleLogout() },
  ];

  // --- Fetch Auth Profile ---
  useEffect(() => {
    if (token) {
      localStorage.setItem('jwt_token', token);
      fetchProfile();
    } else {
      localStorage.removeItem('jwt_token');
      setUser(null);
    }
  }, [token]);

  // --- Fetch Organizations & Projects once profile loaded ---
  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  // --- Fetch Projects when Org changes ---
  useEffect(() => {
    if (selectedOrgId) {
      fetchProjects(selectedOrgId);
    }
  }, [selectedOrgId]);

  // --- Server-Sent Events (SSE) Live Update Stream ---
  useEffect(() => {
    if (!token || !selectedProjId) return;

    fetchDashboardData();
    fetchRetryPolicies();

    // EventSource connects using query parameter token
    const eventSource = new EventSource(`${API_BASE}/events?token=${token}`);

    const handleUpdate = () => {
      fetchDashboardData();
    };

    eventSource.addEventListener('job_updated', handleUpdate);
    eventSource.addEventListener('queue_updated', handleUpdate);
    eventSource.addEventListener('worker_updated', handleUpdate);

    eventSource.onerror = () => {
      console.error('[SSE] Connection lost. Reconnecting...');
    };

    // Fallback slow poll (every 30s) to guarantee eventual consistency if SSE fails
    const fallbackPoll = setInterval(fetchDashboardData, 30000);

    return () => {
      eventSource.close();
      clearInterval(fallbackPoll);
    };
  }, [token, selectedProjId]);

  // --- API Request Helper ---
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (res.status === 401) {
      if (endpoint !== '/auth/login') {
        handleLogout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
  };

  // --- Fetch Handlers ---
  const fetchProfile = async () => {
    try {
      const data = await apiRequest('/auth/profile');
      setUser(data.user);
    } catch (err: any) {
      console.error(err);
      handleLogout();
    }
  };

  const fetchOrganizations = async () => {
    try {
      const orgsList = await apiRequest('/organizations');
      setOrgs(orgsList);
      if (orgsList.length > 0) {
        setSelectedOrgId(orgsList[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchProjects = async (orgId: string) => {
    try {
      const projList = await apiRequest(`/projects?organization_id=${orgId}`);
      setProjects(projList);
      if (projList.length > 0) {
        setSelectedProjId(projList[0].id);
      } else {
        setSelectedProjId('');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedProjId) return;
    try {
      // 1. Fetch queues
      const queueList = await apiRequest(`/queues?project_id=${selectedProjId}`);
      setQueues(queueList);

      // Set default queue in form if not set
      if (queueList.length > 0 && !newJobForm.queue_id) {
        setNewJobForm(f => ({ ...f, queue_id: queueList[0].id }));
      }

      // 2. Fetch jobs
      const queryParams = new URLSearchParams();
      if (filterStatus) queryParams.append('status', filterStatus);
      if (filterQueue) queryParams.append('queue_id', filterQueue);
      const jobsList = await apiRequest(`/jobs?${queryParams.toString()}`);
      setJobs(jobsList);

      // 3. Fetch workers
      const workersList = await apiRequest('/workers');
      setWorkers(workersList);

      // 4. Fetch metrics
      const systemMetrics = await apiRequest('/metrics');
      setMetrics(systemMetrics);

      // 5. Fetch logs
      const systemLogsList = await apiRequest('/logs?limit=50');
      setSystemLogs(systemLogsList);

      // 6. Fetch cluster scaling metrics + recommendation (fire-and-forget, non-blocking)
      apiRequest('/scaling/metrics').then(setScalingMetrics).catch(() => {});
      apiRequest('/scaling/recommendation').then(setScalingRec).catch(() => {});
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  const fetchRetryPolicies = async () => {
    try {
      const policies = await apiRequest('/retry-policies');
      setRetryPolicies(policies);
      if (policies.length > 0) {
        setNewQueueForm(f => ({ ...f, retry_policy_id: policies[0].id }));
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // --- API Key & Security Audit Fetchers & Actions ---
  const fetchAuditLogs = async () => {
    if (!selectedProjId) return;
    try {
      const data = await apiRequest('/audit-logs');
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err.message);
    }
  };

  const fetchApiKeys = async () => {
    if (!selectedProjId) return;
    try {
      const data = await apiRequest(`/api-keys?project_id=${selectedProjId}`);
      setApiKeys(data || []);
    } catch (err: any) {
      console.error('Error fetching api keys:', err.message);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyName) return;
    try {
      const data = await apiRequest('/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: apiKeyName,
          project_id: selectedProjId,
          expires_in_days: apiKeyExpiry
        })
      });
      setNewlyCreatedKey(data.apiKey);
      setApiKeyName('');
      fetchApiKeys();
      addToast('success', 'API Key Generated', 'Store it safely; it will not be shown again.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await apiRequest(`/api-keys/${id}`, { method: 'DELETE' });
      fetchApiKeys();
      addToast('success', 'API Key Revoked');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSeedDemoDAG = async () => {
    if (queues.length === 0) {
      addToast('error', 'No Queues Found', 'Please create a queue first under Queue Settings.');
      return;
    }
    const targetQueueId = queues[0].id;
    try {
      addToast('info', 'Seeding DAG...', 'Creating dependency pipeline...');
      
      // 1. Create Parent Job
      const parent = await apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          queue_id: targetQueueId,
          priority: 2,
          payload: { type: 'Data Extraction', file: 'dump_2026.csv' }
        })
      });

      if (!parent || !parent.id) {
        throw new Error('Failed to create parent job');
      }

      // 2. Create Child Job 1
      const child1 = await apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          queue_id: targetQueueId,
          priority: 2,
          payload: { type: 'Data Processing (Spark)', step: 'cleaning' },
          dependency_job_id: parent.id
        })
      });

      // 3. Create Child Job 2
      await apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          queue_id: targetQueueId,
          priority: 1,
          payload: { type: 'Analytics Aggregation', metrics: ['daily_revenue'] },
          dependency_job_id: parent.id
        })
      });

      if (child1 && child1.id) {
        // 4. Create Grandchild Job (dependent on Child 1)
        await apiRequest('/jobs', {
          method: 'POST',
          body: JSON.stringify({
            queue_id: targetQueueId,
            priority: 3,
            payload: { type: 'Slack Notification Alert', channel: '#ops-alerts' },
            dependency_job_id: child1.id
          })
        });
      }

      addToast('success', 'DAG Seeding Completed', 'Created a 4-node parent-child-grandchild pipeline.');
      fetchDashboardData();
    } catch (err: any) {
      addToast('error', 'Failed to seed DAG', err.message);
    }
  };

  const handleAiDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiErrorMessage) return;
    try {
      const data = await apiRequest('/ai/failure-analysis', {
        method: 'POST',
        body: JSON.stringify({ error_message: aiErrorMessage })
      });
      setAiDiagnosis(data);
      addToast('info', 'AI Diagnostics Compiled');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFetchPredictions = async (qId: string) => {
    if (!qId) return;
    try {
      const data = await apiRequest(`/ai/queue-prediction/${qId}`);
      setPredictions(data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleNlpSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpQuery) return;
    try {
      const data = await apiRequest('/ai/log-search', {
        method: 'POST',
        body: JSON.stringify({ query: nlpQuery })
      });
      setNlpResults(data.results || []);
      setNlpFilters(data.filtersApplied);
      addToast('success', 'Natural Language Query Executed');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Trigger security/API fetches when active tab shifts
  useEffect(() => {
    if (!selectedProjId) return;
    if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'apikeys') {
      fetchApiKeys();
      setNewlyCreatedKey(null);
    } else if (activeTab === 'aiops' && queues.length > 0 && !predictedQueueId) {
      setPredictedQueueId(queues[0].id);
      handleFetchPredictions(queues[0].id);
    }
  }, [activeTab, selectedProjId]);

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isLoginView) {
        const data = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: authForm.email, password: authForm.password })
        });
        setToken(data.token);
      } else {
        const data = await apiRequest('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(authForm)
        });
        setToken(data.token);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setOrgs([]);
    setProjects([]);
    setSelectedOrgId('');
    setSelectedProjId('');
    setJobs([]);
    setQueues([]);
    setWorkers([]);
    setMetrics(null);
    setActiveTab('overview');
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // --- Action Handlers ---
  const handleCreateOrganization = async () => {
    const name = prompt('Enter Organization Name:');
    if (!name) return;
    try {
      const newOrg = await apiRequest('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      setOrgs([...orgs, newOrg]);
      setSelectedOrgId(newOrg.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateProject = async () => {
    if (!selectedOrgId) return;
    const name = prompt('Enter Project Name:');
    if (!name) return;
    const desc = prompt('Enter Project Description:');
    try {
      const newProj = await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({ organization_id: selectedOrgId, name, description: desc || '' })
      });
      setProjects([...projects, newProj]);
      setSelectedProjId(newProj.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueForm.name) return;
    try {
      await apiRequest('/queues', {
        method: 'POST',
        body: JSON.stringify({
          project_id: selectedProjId,
          name: newQueueForm.name,
          priority: Number(newQueueForm.priority),
          concurrency_limit: Number(newQueueForm.concurrency_limit),
          retry_policy_id: newQueueForm.retry_policy_id || null,
          rate_limit_per_minute: newQueueForm.rate_limit_per_minute ? Number(newQueueForm.rate_limit_per_minute) : null,
          webhook_url: newQueueForm.webhook_url || null
        })
      });
      setNewQueueForm({ name: '', priority: 2, concurrency_limit: 5, retry_policy_id: retryPolicies[0]?.id || '', rate_limit_per_minute: '', webhook_url: '' });
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleQueuePause = async (queueId: string, currentPaused: boolean) => {
    try {
      await apiRequest(`/queues/${queueId}/pause`, {
        method: 'PATCH',
        body: JSON.stringify({ paused: !currentPaused })
      });
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobForm.queue_id) return;
    
    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(newJobForm.payload || '{}');
    } catch (err) {
      alert('Invalid JSON format in Payload field');
      return;
    }

    // Merge type into payload
    const finalPayload = {
      type: newJobForm.type,
      ...parsedPayload
    };

    try {
      if (newJobForm.isBatch) {
        // Create an array of mock payloads
        const batchPayloads = Array.from({ length: newJobForm.batchCount }).map((_, i) => ({
          ...finalPayload,
          batch_index: i + 1
        }));

        await apiRequest('/jobs', {
          method: 'POST',
          body: JSON.stringify({
            queue_id: newJobForm.queue_id,
            batch: batchPayloads,
            priority: Number(newJobForm.priority),
            delay_ms: newJobForm.delay_ms > 0 ? Number(newJobForm.delay_ms) : null
          })
        });
      } else {
        await apiRequest('/jobs', {
          method: 'POST',
          body: JSON.stringify({
            queue_id: newJobForm.queue_id,
            payload: finalPayload,
            priority: Number(newJobForm.priority),
            delay_ms: newJobForm.delay_ms > 0 ? Number(newJobForm.delay_ms) : null,
            cron: newJobForm.cron || null,
            dependency_job_id: newJobForm.dependency_job_id || null
          })
        });
      }

      setNewJobForm(f => ({ ...f, payload: '{}', delay_ms: 0, cron: '', isBatch: false, dependency_job_id: '' }));
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      await apiRequest(`/jobs/${jobId}/cancel`, { method: 'POST' });
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePurgeQueue = async (queueId: string) => {
    if (!confirm('Are you sure you want to purge all non-active jobs in this queue?')) return;
    try {
      const data = await apiRequest(`/queues/${queueId}/purge`, { method: 'POST' });
      alert(data.message);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetryAll = async () => {
    if (!confirm('Are you sure you want to retry all failed/dead jobs?')) return;
    try {
      const data = await apiRequest('/jobs/bulk/retry', { method: 'POST' });
      alert(data.message);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAllQueues = async (paused: boolean) => {
    if (!confirm(`Are you sure you want to ${paused ? 'pause' : 'resume'} all queues?`)) return;
    try {
      const data = await apiRequest('/queues/bulk/pause', {
        method: 'POST',
        body: JSON.stringify({ paused })
      });
      alert(data.message);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInspectJob = async (jobId: string) => {
    setAiRetryAdvice(null); // reset previous advice
    try {
      const data = await apiRequest(`/jobs/${jobId}`);
      setSelectedJobDetails(data.job);
      setSelectedJobExecs(data.executions);
      setSelectedJobLogs(data.logs);
      setIsJobModalOpen(true);

      // If the job failed, auto-fetch AI retry recommendation
      if (data.job && (data.job.status === 'FAILED' || data.job.status === 'DEAD')) {
        const errorLog = data.logs?.find((l: any) => l.level === 'ERROR');
        if (errorLog?.message) {
          apiRequest('/ai/retry-recommendation', {
            method: 'POST',
            body: JSON.stringify({ error_message: errorLog.message, retry_count: data.job.retry_count || 0 })
          }).then(setAiRetryAdvice).catch(() => {});
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await apiRequest(`/jobs/${jobId}/retry`, { method: 'POST' });
      setIsJobModalOpen(false);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- SVG Chart Coordinates Calculator ---
  const renderSVGChart = () => {
    if (!metrics || !metrics.hourlyThroughput || metrics.hourlyThroughput.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No execution throughput data available yet.
        </div>
      );
    }

    const data = metrics.hourlyThroughput;
    const width = 500;
    const height = 150;
    const padding = 20;

    const values: number[] = data.map((d: any) => d.jobs);
    const maxVal = Math.max(...values, 5); // Fallback to 5 to avoid flat chart on zero jobs

    const points = data.map((d: any, i: number) => {
      const x = padding + (i * (width - padding * 2)) / (data.length - 1);
      const y = height - padding - (d.jobs / maxVal) * (height - padding * 2);
      return { x, y, jobs: d.jobs, label: d.time };
    });

    const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ');
    
    // Gradient fill path
    const fillD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div style={{ width: '100%' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

          {/* Gradient Fill */}
          <path d={fillD} fill="url(#chartGrad)" />

          {/* Sparkline Line */}
          <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots & Tooltips */}
          {points.map((p: any, i: number) => (
            <g key={i} className="chart-dot-group">
              <circle cx={p.x} cy={p.y} r="3.5" fill="var(--bg-main)" stroke="var(--accent-primary)" strokeWidth="2" />
              <text x={p.x} y={p.y - 8} fontSize="9" fontWeight="bold" fill="var(--text-primary)" textAnchor="middle" opacity="0.8">
                {p.jobs > 0 ? p.jobs : ''}
              </text>
              <text x={p.x} y={height - 4} fontSize="8" fill="var(--text-muted)" textAnchor="middle">
                {i % 2 === 0 ? p.label : ''}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // --- Auth View / Landing Page ---
  if (!token) {
    if (!showAuth) {
      return (
        <div className="landing-grid-bg" style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', overflowX: 'hidden', position: 'relative' }}>
          {/* Orbs */}
          <div className="landing-glow-orb" style={{ top: '5%', right: '5%' }}></div>
          <div className="landing-glow-orb" style={{ bottom: '15%', left: '2%' }}></div>

          {/* Header */}
          <header style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 4rem', borderBottom: '1px solid var(--border-light)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--accent-primary-gradient)', width: '36px', height: '36px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1.4rem' }}>
                J
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px' }}>Distributed Sched</span>
            </div>
            <button onClick={() => setShowAuth(true)} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>
              Go to Dashboard
            </button>
          </header>

          {/* Hero Section */}
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6rem 2rem 2rem 2rem', maxWidth: '900px', margin: '0 auto', zIndex: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '2rem', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              <span className="pulse-dot-green"></span> Engine version 2.0 (Production-Ready)
            </div>
            
            <h1 style={{ fontSize: '3.75rem', fontWeight: 800, lineHeight: 1.15, background: 'linear-gradient(135deg, #fff 0%, #a78bfa 50%, #d946ef 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1.5rem', letterSpacing: '-1.5px' }}>
              Industrial-Grade Distributed Job Scheduling Platform
            </h1>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: 1.6, maxWidth: '650px', marginBottom: '2.5rem' }}>
              Manage millions of cron tasks, background worker clusters, and complex DAG dependencies with lock-free atomic claiming, real-time telemetry, and automatic failovers.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <button onClick={() => setShowAuth(true)} className="btn btn-primary" style={{ padding: '0.85rem 2.25rem', fontSize: '1rem', fontWeight: 600 }}>
                Get Started Free
              </button>
              <a href="#architecture" className="btn btn-secondary" style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
                Explore Features &darr;
              </a>
            </div>

            {/* Platform Metrics Counter */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', maxWidth: '800px', width: '100%', margin: '4rem auto 0 auto' }}>
              <div className="landing-stat-card">
                <div style={{ fontSize: '2.5rem', fontWeight: 800, background: 'var(--accent-primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>1M+</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jobs / Day</div>
              </div>
              <div className="landing-stat-card">
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-success)', marginBottom: '0.25rem' }}>&lt; 50ms</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claim Latency</div>
              </div>
              <div className="landing-stat-card">
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>99.99%</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uptime SLA</div>
              </div>
            </div>

            {/* Simulator Widget */}
            <SystemSimulator />
          </section>

          {/* Tech Cards Section */}
          <section id="architecture" style={{ padding: '6rem 4rem 8rem 4rem', maxWidth: '1200px', margin: '0 auto', width: '100%', zIndex: 10 }}>
            <h2 style={{ textAlign: 'center', fontSize: '2.25rem', fontWeight: 700, marginBottom: '4rem', background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Engineered for High Availability & Scale
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              
              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>🔒</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Lock-Free Claiming</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Uses atomic `BEGIN IMMEDIATE` transaction write locks on SQLite WAL mode to guarantee exactly-once job execution. Multiple workers poll the central DB concurrently without race conditions.
                </p>
              </div>

              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>🔗</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>DAG Workflow Pipelines</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Establish parent-child relationships. Child jobs start as `BLOCKED` and automatically transition to `QUEUED` when parents complete. DLQ failures cascade recursively.
                </p>
              </div>

              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>⚡</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Token Bucket Rate Limits</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Set rate limits per queue. The claiming logic dynamically evaluates executions in the last 60 seconds against queue capacities inside the atomic poll query.
                </p>
              </div>

              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>⏱️</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Active Timeout Monitoring</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Background reclaimer sweeps active runs, automatically failing jobs that exceed their `timeout_ms` threshold. Stranded tasks from offline workers are auto-rescheduled.
                </p>
              </div>

              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>📡</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Live Telemetry & Webhooks</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Real-time update streams powered by Server-Sent Events (SSE). Sends Slack alert notifications immediately when jobs land in the Dead Letter Queue.
                </p>
              </div>

              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>📊</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Standard Instrumentation</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Built-in Prometheus scrapers `/api/prometheus/metrics` and native Kubernetes `/health/liveness` / `/health/readiness` probes for instant container orchestration readiness.
                </p>
              </div>

            </div>
          </section>

          {/* Footer */}
          <footer style={{ marginTop: 'auto', padding: '2.5rem', borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', zIndex: 10 }}>
            <p>© {new Date().getFullYear()} Distributed Sched. All rights reserved.</p>
          </footer>
        </div>
      );
    }

    return (
      <div className="auth-wrapper" style={{ flexDirection: 'column', gap: '1.5rem' }}>
        <button 
          onClick={() => setShowAuth(false)} 
          className="btn btn-secondary" 
          style={{ padding: '0.5rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', zIndex: 10 }}
        >
          &larr; Back to Landing Page
        </button>
        <div className="glass-card" style={{ width: '400px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, background: 'var(--accent-primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>
              Distributed Sched
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Distributed Job Scheduling Platform
            </p>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {!isLoginView && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={authForm.name}
                  onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@scheduler.com"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
            </div>

            {authError && (
              <div style={{ backgroundColor: 'var(--accent-danger-glow)', border: '1px solid var(--accent-danger)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                <Icons.Warning />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={authLoading}>
              {authLoading ? 'Authenticating...' : isLoginView ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isLoginView ? "Don't have an account? " : 'Already registered? '}
            </span>
            <button
              onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
            >
              {isLoginView ? 'Create one' : 'Sign In'}
            </button>
          </div>
          
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Demo credentials: <strong>admin@scheduler.com</strong> / <strong>admin123</strong>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Layout ---
  return (
    <div className="app-container">
      <CommandPalette isOpen={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} commands={commandList} />
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--accent-primary-gradient)', width: '32px', height: '32px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
            J
          </div>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.5px' }}>Job Scheduler</h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="pulse-dot-green"></span> Engine Online
            </span>
          </div>
        </div>

        {/* Tenant Scope Selector */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Organization</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="form-select" 
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} 
                value={selectedOrgId}
                onChange={e => setSelectedOrgId(e.target.value)}
              >
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button onClick={handleCreateOrganization} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                <Icons.Plus />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Scope</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="form-select" 
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={selectedProjId}
                onChange={e => setSelectedProjId(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={handleCreateProject} className="btn btn-secondary" style={{ padding: '0.4rem' }} disabled={!selectedOrgId}>
                <Icons.Plus />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0.5rem 1rem 0.25rem', marginBottom: '0.25rem' }}>Core</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {[
              { key: 'overview' as const, icon: <Icons.Dashboard />, label: 'Overview' },
              { key: 'queues' as const, icon: <Icons.Queue />, label: 'Queue Settings' },
              { key: 'jobs' as const, icon: <Icons.Job />, label: 'Jobs Explorer' },
              { key: 'workers' as const, icon: <Icons.Worker />, label: 'Active Workers' },
            ].map(item => (
              <li key={item.key}>
                <button className={`btn ${activeTab === item.key ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', padding: '0.55rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveTab(item.key)} disabled={!selectedProjId}>
                  {item.icon} {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0.75rem 1rem 0.25rem', marginBottom: '0.25rem' }}>Analytics</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {[
              { key: 'dag' as const, icon: <Icons.DAG />, label: 'DAG View' },
              { key: 'gantt' as const, icon: <Icons.Gantt />, label: 'Gantt Chart' },
              { key: 'aiops' as const, icon: <Icons.AI />, label: 'AI Ops' },
            ].map(item => (
              <li key={item.key}>
                <button className={`btn ${activeTab === item.key ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', padding: '0.55rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveTab(item.key)} disabled={!selectedProjId}>
                  {item.icon} {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0.75rem 1rem 0.25rem', marginBottom: '0.25rem' }}>Security</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {[
              { key: 'audit' as const, icon: <Icons.Audit />, label: 'Audit Logs' },
              { key: 'apikeys' as const, icon: <Icons.Key />, label: 'API Keys' },
            ].map(item => (
              <li key={item.key}>
                <button className={`btn ${activeTab === item.key ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start', border: 'none', padding: '0.55rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveTab(item.key)} disabled={!selectedProjId}>
                  {item.icon} {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Command Palette trigger - outside scrollable nav */}
        <button
          style={{ margin: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'transparent', width: 'calc(100% - 1rem)', flexShrink: 0 }}
          onClick={() => setCmdPaletteOpen(true)}
        >
          <Icons.Search /> <span style={{ flex: 1, textAlign: 'left' }}>Search commands...</span> <span className="kbd">⌘K</span>
        </button>

        {/* Footer User Info */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyItems: 'space-between', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {user?.name || 'Loading...'}
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {user?.role || 'USER'}
            </span>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Log out">
            <Icons.Logout />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        
        {/* Top Header */}
        <header style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>
              {selectedProjId 
                ? projects.find(p => p.id === selectedProjId)?.name 
                : 'Welcome'
              }
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {selectedProjId 
                ? projects.find(p => p.id === selectedProjId)?.description || 'No project description'
                : 'Select or create a project to monitor tasks'
              }
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {selectedProjId && (
              <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ padding: '0.6rem' }} title="Force Refresh">
                <Icons.Refresh />
              </button>
            )}
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
            </button>
          </div>
        </header>

        {/* Dynamic Pages */}
        <div style={{ padding: '2rem', flex: 1 }}>
          {!selectedProjId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', textAlign: 'center' }}>
              <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>
                <Icons.Dashboard />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Active Project Scope</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Create or select a project in the sidebar layout to initialize monitoring queues, registering workers, and launching background jobs.
              </p>
              <button onClick={handleCreateProject} className="btn btn-primary">
                <Icons.Plus /> Create Project
              </button>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* Grid cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    
                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Active Workers</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {metrics?.workers.active || 0}
                        <span className="pulse-dot-green"></span>
                      </h2>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{metrics?.workers.offline || 0} offline instances</span>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Running Jobs</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-cyan)' }}>
                        {metrics?.jobCounts.RUNNING || 0}
                      </h2>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{metrics?.jobCounts.CLAIMED || 0} claimed by workers</span>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Queued / Scheduled</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-warning)' }}>
                        {(metrics?.jobCounts.QUEUED || 0) + (metrics?.jobCounts.SCHEDULED || 0)}
                      </h2>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{metrics?.jobCounts.QUEUED || 0} queued, {metrics?.jobCounts.SCHEDULED || 0} scheduled</span>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Completed Jobs</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-success)' }}>
                        {metrics?.jobCounts.COMPLETED || 0}
                      </h2>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{metrics?.throughput.last24Hours || 0} runs in last 24h</span>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Dead Letter Queue</span>
                      <h2 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-danger)' }}>
                        {metrics?.jobCounts.DEAD || 0}
                      </h2>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Requires manual investigation</span>
                    </div>

                  </div>

                  {/* Bulk Actions Control Center */}
                  <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bulk Controls:</span>
                    <button onClick={() => handleToggleAllQueues(true)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      Pause All Queues
                    </button>
                    <button onClick={() => handleToggleAllQueues(false)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      Resume All Queues
                    </button>
                    <button onClick={handleRetryAll} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      Retry All Failed/Dead Jobs
                    </button>
                  </div>

                  {/* Throughput & Latency section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                    
                    {/* Throughput chart */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Job Throughput (Runs/Hour)</h3>
                      {renderSVGChart()}
                    </div>

                    {/* Latency & Metrics */}
                    <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Performance Metrics</h3>
                      
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Avg Execution Duration</span>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.15rem' }}>
                          {metrics?.averageDurationMs ? `${(metrics.averageDurationMs / 1000).toFixed(2)}s` : '0.00s'}
                        </h3>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Avg Queuing Delay</span>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.15rem' }}>
                          {metrics?.averageQueueDelaySec ? `${metrics.averageQueueDelaySec}s` : '0s'}
                        </h3>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Success / Failure Ratio</span>
                        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem', backgroundColor: '#374151' }}>
                          {metrics && (metrics.runs.success || metrics.runs.failure) ? (
                            <>
                              <div style={{ width: `${(metrics.runs.success / (metrics.runs.success + metrics.runs.failure)) * 100}%`, backgroundColor: 'var(--accent-success)' }} />
                              <div style={{ width: `${(metrics.runs.failure / (metrics.runs.success + metrics.runs.failure)) * 100}%`, backgroundColor: 'var(--accent-danger)' }} />
                            </>
                          ) : (
                            <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)' }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                          <span>Success: {metrics?.runs.success || 0}</span>
                          <span>Failure: {metrics?.runs.failure || 0}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Cluster Health & Auto-Scaler */}
                  {scalingMetrics && (
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>⚙️</span> Cluster Health &amp; Auto-Scaler
                        {scalingRec && (
                          <span style={{
                            marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px',
                            borderRadius: '9999px',
                            background: scalingRec.action === 'SCALE_UP' ? 'rgba(245,158,11,0.15)' : scalingRec.action === 'SCALE_DOWN' ? 'rgba(6,182,212,0.12)' : 'rgba(16,185,129,0.12)',
                            color: scalingRec.action === 'SCALE_UP' ? 'var(--accent-warning)' : scalingRec.action === 'SCALE_DOWN' ? 'var(--accent-cyan)' : 'var(--accent-success)',
                            border: `1px solid ${scalingRec.action === 'SCALE_UP' ? 'rgba(245,158,11,0.3)' : scalingRec.action === 'SCALE_DOWN' ? 'rgba(6,182,212,0.25)' : 'rgba(16,185,129,0.25)'}`
                          }}>
                            {scalingRec.action === 'SCALE_UP' ? '↑ SCALE UP' : scalingRec.action === 'SCALE_DOWN' ? '↓ SCALE DOWN' : '✓ OPTIMAL'}
                          </span>
                        )}
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)' }}>{scalingMetrics.workers?.active}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Workers</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{scalingMetrics.workers?.utilizationPercent}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Worker Utilization</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-warning)' }}>{scalingMetrics.jobs?.queued}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queued Backlog</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{scalingMetrics.throughput?.last5MinCompleted}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed/5min</div>
                        </div>
                      </div>
                      {scalingRec && scalingRec.shouldScale && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.06)', border: '1px dashed rgba(245,158,11,0.3)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span>💡</span>
                          <span><strong style={{ color: 'var(--accent-warning)' }}>Scaler Recommendation:</strong> {scalingRec.reason} Target replica count: <strong>{scalingRec.targetReplicaCount}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* System Event Logs */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icons.Logs /> Live Execution Audit Logs
                    </h3>
                    <div className="terminal-window">
                      {systemLogs.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)' }}>Waiting for system events...</div>
                      ) : (
                        systemLogs.map(log => (
                          <div key={log.id} className={`terminal-line ${log.level.toLowerCase()}`}>
                            [{new Date(log.timestamp).toLocaleTimeString()}] [{log.queue_name}] <span style={{ fontWeight: 600 }}>{log.level}</span>: {log.message}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Queues Tab */}
              {activeTab === 'queues' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Create queue form */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Create Job Queue</h3>
                    <form onSubmit={handleCreateQueue} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                      
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Queue Identifier</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="email-notifications"
                          value={newQueueForm.name}
                          onChange={e => setNewQueueForm({ ...newQueueForm, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Priority Order</label>
                        <select
                          className="form-select"
                          value={newQueueForm.priority}
                          onChange={e => setNewQueueForm({ ...newQueueForm, priority: Number(e.target.value) })}
                        >
                          <option value="1">1 - Low Priority</option>
                          <option value="2">2 - Medium Priority</option>
                          <option value="3">3 - High Priority</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Concurrency Limit (Workers)</label>
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          max="100"
                          value={newQueueForm.concurrency_limit}
                          onChange={e => setNewQueueForm({ ...newQueueForm, concurrency_limit: Number(e.target.value) })}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Retry Strategy</label>
                        <select
                          className="form-select"
                          value={newQueueForm.retry_policy_id}
                          onChange={e => setNewQueueForm({ ...newQueueForm, retry_policy_id: e.target.value })}
                        >
                          <option value="">-- No Retry (Immediate DLQ) --</option>
                          {retryPolicies.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Rate Limit (Jobs/Min)</label>
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          placeholder="Unlimited"
                          value={newQueueForm.rate_limit_per_minute}
                          onChange={e => setNewQueueForm({ ...newQueueForm, rate_limit_per_minute: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Slack Webhook URL</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Incoming hook (Optional)"
                          value={newQueueForm.webhook_url}
                          onChange={e => setNewQueueForm({ ...newQueueForm, webhook_url: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
                        <Icons.Plus /> Create Queue
                      </button>

                    </form>
                  </div>

                  {/* Queues List */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Active Queues</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                      {queues.length === 0 ? (
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', gridColumn: '1/-1', color: 'var(--text-secondary)' }}>
                          No queues initialized. Create a queue above to get started.
                        </div>
                      ) : (
                        queues.map(q => (
                          <div key={q.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{q.name}</h4>
                              
                              {/* Toggle switch for pause/resume */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: q.paused ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                                  {q.paused ? 'Paused' : 'Active'}
                                </span>
                                <label className="switch">
                                  <input
                                    type="checkbox"
                                    checked={!q.paused}
                                    onChange={() => handleToggleQueuePause(q.id, !!q.paused)}
                                  />
                                  <span className="slider"></span>
                                </label>
                                <button onClick={() => handlePurgeQueue(q.id)} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'none', color: 'var(--accent-danger)' }} title="Purge Inactive Jobs">
                                  <Icons.Trash />
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '0.75rem 0' }}>
                              <div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Priority</span>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: q.priority === 3 ? '#a78bfa' : q.priority === 2 ? '#60a5fa' : '#9ca3af' }}>
                                  {q.priority === 3 ? 'HIGH' : q.priority === 2 ? 'MEDIUM' : 'LOW'}
                                </p>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Concurrency</span>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{q.concurrency_limit} max</p>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Retries</span>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                  {retryPolicies.find(p => p.id === q.retry_policy_id)?.max_retries || '0'} attempts
                                </p>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                               <span>Rate Limit:</span>
                               <span>{q.rate_limit_per_minute ? `${q.rate_limit_per_minute} jobs/min` : 'Unlimited'}</span>
                             </div>
                             <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                               <span>Slack Alerts:</span>
                               <span style={{ color: q.webhook_url ? 'var(--accent-success)' : 'var(--text-secondary)' }}>
                                 {q.webhook_url ? 'Configured' : 'Disabled'}
                               </span>
                             </div>
                             <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                               <span>Queue ID:</span>
                               <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{q.id.substring(0, 8)}...</span>
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Jobs Explorer Tab */}
              {activeTab === 'jobs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Job Submission Form */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Submit Background Job</h3>
                    <form onSubmit={handleCreateJob}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Target Queue</label>
                          <select
                            className="form-select"
                            value={newJobForm.queue_id}
                            onChange={e => setNewJobForm({ ...newJobForm, queue_id: e.target.value })}
                            required
                          >
                            {queues.map(q => <option key={q.id} value={q.id}>{q.name} (Priority: {q.priority})</option>)}
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Job Task Type</label>
                          <select
                            className="form-select"
                            value={newJobForm.type}
                            onChange={e => setNewJobForm({ ...newJobForm, type: e.target.value })}
                          >
                            <option value="email">Email Task (Mock sending delay)</option>
                            <option value="video-transcode">Video Transcoding (High CPU heavy mock)</option>
                            <option value="image-resize">Image Resizing (Quick mock)</option>
                            <option value="failure-test">Failure Simulator (Tests retry & DLQ routing)</option>
                            <option value="generic">Generic Task (Timeout customizable)</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Job Execution Priority</label>
                          <select
                            className="form-select"
                            value={newJobForm.priority}
                            onChange={e => setNewJobForm({ ...newJobForm, priority: Number(e.target.value) })}
                          >
                            <option value="1">1 - Low priority (run last)</option>
                            <option value="2">2 - Medium priority</option>
                            <option value="3">3 - High priority (run first)</option>
                          </select>
                        </div>

                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">JSON Payload Variables (Optional)</label>
                          <textarea
                            className="form-textarea"
                            placeholder='{ "to": "user@gmail.com", "width": 800 }'
                            value={newJobForm.payload}
                            onChange={e => setNewJobForm({ ...newJobForm, payload: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Scheduling Options</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="number"
                                className="form-input"
                                placeholder="Delay in MS (e.g. 5000)"
                                value={newJobForm.delay_ms || ''}
                                onChange={e => setNewJobForm({ ...newJobForm, delay_ms: Number(e.target.value), cron: '' })}
                              />
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Cron expression (e.g. */5 * * * * *)"
                                value={newJobForm.cron}
                                onChange={e => setNewJobForm({ ...newJobForm, cron: e.target.value, delay_ms: 0 })}
                              />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                              Specify delay (one-shot delayed execution) OR cron expression (recurring execution). Leave blank for immediate queueing.
                            </span>
                          </div>

                          <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                            <label className="form-label">Workflow Dependency (Parent Job)</label>
                            <select
                              className="form-select"
                              value={newJobForm.dependency_job_id}
                              onChange={e => setNewJobForm({ ...newJobForm, dependency_job_id: e.target.value })}
                            >
                              <option value="">-- No Dependency (Immediate execution) --</option>
                              {jobs
                                .filter(j => j.status !== 'COMPLETED' && j.status !== 'CANCELLED')
                                .map(j => (
                                  <option key={j.id} value={j.id}>
                                    {(j.payload?.type || 'generic')} ({j.id.substring(0, 8)}) - {j.status}
                                  </option>
                                ))}
                            </select>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                              If selected, this job will start in BLOCKED state and run only after the parent job finishes successfully.
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={newJobForm.isBatch}
                                onChange={e => setNewJobForm({ ...newJobForm, isBatch: e.target.checked })}
                              />
                              <span>Submit as Batch Jobs</span>
                            </label>
                            {newJobForm.isBatch && (
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                                min="1"
                                max="100"
                                value={newJobForm.batchCount}
                                onChange={e => setNewJobForm({ ...newJobForm, batchCount: Number(e.target.value) })}
                              />
                            )}
                          </div>
                        </div>

                      </div>

                      <div style={{ display: 'flex', justifyItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
                          <Icons.Plus /> Submit Job
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Jobs List & Filters */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Submitted Background Jobs</h3>
                      
                      {/* Filter Row */}
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <select 
                          className="form-select" 
                          style={{ width: '150px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                          value={filterQueue}
                          onChange={e => setFilterQueue(e.target.value)}
                        >
                          <option value="">All Queues</option>
                          {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>

                        <select 
                          className="form-select" 
                          style={{ width: '150px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                          value={filterStatus}
                          onChange={e => setFilterStatus(e.target.value)}
                        >
                          <option value="">All Statuses</option>
                          <option value="QUEUED">QUEUED</option>
                          <option value="SCHEDULED">SCHEDULED</option>
                          <option value="CLAIMED">CLAIMED</option>
                          <option value="RUNNING">RUNNING</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="FAILED">FAILED</option>
                          <option value="DEAD">DEAD (DLQ)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Job ID</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Queue</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Retries</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Scheduled For</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobs.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No jobs found matching filters.
                              </td>
                            </tr>
                          ) : (
                            jobs.map(j => (
                              <tr key={j.id} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }} onClick={() => handleInspectJob(j.id)} className="table-row-hover">
                                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                                  {j.id.substring(0, 8)}...
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{j.queue_name}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>{j.payload?.type || 'generic'}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                  <span style={{ color: j.priority === 3 ? '#d946ef' : j.priority === 2 ? '#60a5fa' : '#9ca3af' }}>{j.priority}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span className={`badge badge-${j.status.toLowerCase()}`}>{j.status}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{j.retry_count} / {j.max_retries}</td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {new Date(j.scheduled_for).toLocaleString()}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleCancelJob(j.id)} className="btn btn-secondary" style={{ padding: '0.35rem', color: 'var(--accent-danger)', border: 'none', background: 'none' }} title="Cancel/Delete Job" disabled={j.status === 'RUNNING' || j.status === 'CLAIMED'}>
                                    <Icons.Trash />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'dag' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <DAGView jobs={jobs} onSeedDemoDAG={handleSeedDemoDAG} />
                </div>
              )}

              {activeTab === 'gantt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div className="glass-card" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icons.Gantt /> Execution Gantt Timeline
                    </h3>
                    <GanttChart executions={selectedJobExecs.length > 0 ? selectedJobExecs : [
                      { id: 'd1', worker_id: 'worker-node-01', start_time: new Date(Date.now() - 5000).toISOString(), duration_ms: 3200, status: 'SUCCESS' },
                      { id: 'd2', worker_id: 'worker-node-02', start_time: new Date(Date.now() - 3500).toISOString(), duration_ms: 2200, status: 'SUCCESS' },
                      { id: 'd3', worker_id: 'worker-node-03', start_time: new Date(Date.now() - 1500).toISOString(), duration_ms: 1200, status: 'RUNNING' }
                    ]} />
                  </div>
                </div>
              )}

              {activeTab === 'aiops' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* Row 1: Failure Analysis & Queue load prediction */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    
                    {/* Failure Advisor */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>AI Failure Diagnostics Advisor</h3>
                      <form onSubmit={handleAiDiagnose} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Paste Worker/Job Error Log Message</label>
                          <textarea
                            className="form-textarea"
                            placeholder="e.g., TypeError: fetch failed due to ECONNREFUSED 127.0.0.1:5432"
                            value={aiErrorMessage}
                            onChange={e => setAiErrorMessage(e.target.value)}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
                          Analyze Log
                        </button>
                      </form>

                      {aiDiagnosis && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{aiDiagnosis.category}</span>
                            <span className={`badge ${aiDiagnosis.severity === 'CRITICAL' ? 'badge-failed' : 'badge-scheduled'}`}>{aiDiagnosis.severity}</span>
                          </div>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Diagnosis:</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{aiDiagnosis.summary}</p>
                          </div>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Recommended Fix Action:</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>{aiDiagnosis.recommendation}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Queue prediction */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>AI Load Forecast (Next 6 Hours)</h3>
                        <select
                          className="form-select"
                          style={{ width: '150px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                          value={predictedQueueId}
                          onChange={e => { setPredictedQueueId(e.target.value); handleFetchPredictions(e.target.value); }}
                        >
                          {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>
                      </div>

                      {predictions.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Select a queue to render forecasts.</div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: '0.5rem', height: '140px', alignItems: 'end', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                            {predictions.map((p, idx) => {
                              const maxVal = Math.max(...predictions.map(x => x.predictedJobs), 10);
                              const heightPct = (p.predictedJobs / maxVal) * 100;
                              return (
                                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{p.predictedJobs}</span>
                                  <div style={{ width: '100%', height: `${heightPct}%`, background: 'var(--accent-primary-gradient)', borderRadius: '4px 4px 0 0', minHeight: '4px' }} />
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            {predictions.map((p, idx) => (
                              <span key={idx} style={{ flex: 1, textAlignment: 'center', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.time}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Row 2: NL Log Search */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>AI-Powered Natural Language Log Search</h3>
                    <form onSubmit={handleNlpSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Try: 'show failed jobs' or 'error logs limit 5'"
                        value={nlpQuery}
                        onChange={e => setNlpQuery(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn btn-primary">
                        Search Logs
                      </button>
                    </form>

                    {nlpFilters && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Applied Filters: {nlpFilters.status && <span className="badge badge-queued" style={{ marginRight: '4px' }}>Status: {nlpFilters.status}</span>}
                        {nlpFilters.level && <span className="badge badge-failed" style={{ marginRight: '4px' }}>Level: {nlpFilters.level}</span>}
                        Limit: {nlpFilters.limit}
                      </div>
                    )}

                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.5rem' }}>Time</th>
                            <th style={{ padding: '0.5rem' }}>Queue</th>
                            <th style={{ padding: '0.5rem' }}>Level</th>
                            <th style={{ padding: '0.5rem' }}>Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nlpResults.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {nlpFilters ? 'No logs matched the AI query.' : 'Type a query above to search logs via natural language processing.'}
                              </td>
                            </tr>
                          ) : (
                            nlpResults.map(log => (
                              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{log.queue_name}</td>
                                <td style={{ padding: '0.5rem' }}>
                                  <span style={{ color: log.level === 'ERROR' ? 'var(--accent-danger)' : log.level === 'WARN' ? 'var(--accent-warning)' : 'var(--accent-success)' }}>{log.level}</span>
                                </td>
                                <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{log.message}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>System Security Audit Logs</h3>
                    <button onClick={fetchAuditLogs} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      Refresh Audits
                    </button>
                  </div>

                  <div className="glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Action</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Entity</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Operator</th>
                          <th style={{ padding: '0.75rem 1rem' }}>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              No security audit events recorded yet.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className={`audit-action ${log.action.includes('REVOKE') || log.action.includes('DELETE') ? 'audit-delete' : log.action.includes('CREATE') ? 'audit-create' : 'audit-update'}`}>
                                  {log.action.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)' }}>{log.entity_type} ({log.entity_id ? log.entity_id.substring(0, 8) : 'N/A'})</td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{log.user_id}</td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{log.ip_address}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'apikeys' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Key Generator */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Generate Client API Access Key</h3>
                    <form onSubmit={handleCreateApiKey} style={{ display: 'flex', gap: '1.25rem', alignItems: 'end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label">Key Name / Description</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g., CI/CD Production Server Key"
                          value={apiKeyName}
                          onChange={e => setApiKeyName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0, width: '150px' }}>
                        <label className="form-label">Expiration Period</label>
                        <select
                          className="form-select"
                          value={apiKeyExpiry}
                          onChange={e => setApiKeyExpiry(Number(e.target.value))}
                        >
                          <option value="30">30 Days</option>
                          <option value="90">90 Days</option>
                          <option value="365">365 Days</option>
                          <option value="0">Never Expires</option>
                        </select>
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
                        <Icons.Key /> Generate Key
                      </button>
                    </form>

                    {newlyCreatedKey && (
                      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--accent-success)', borderRadius: 'var(--radius-md)', background: 'var(--accent-success-glow)', color: 'var(--text-primary)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>Client API Token Generated:</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          Copy this key now. For security purposes, it will never be displayed in the panel again.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <code style={{ flex: 1, padding: '0.5rem', background: '#000', borderRadius: '4px', fontSize: '0.9rem', fontFamily: 'var(--font-mono)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {newlyCreatedKey}
                          </code>
                          <button onClick={() => { navigator.clipboard.writeText(newlyCreatedKey); addToast('success', 'Copied to clipboard'); }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Keys List */}
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Active Authorization Credentials</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Credential Name</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Created At</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Expires At</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Revoke</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No API Key credentials registered for this project.
                              </td>
                            </tr>
                          ) : (
                            apiKeys.map(key => (
                              <tr key={key.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{key.name}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{new Date(key.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '0.75rem 1rem', color: key.expires_at ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                  {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                  <button onClick={() => handleDeleteApiKey(key.id)} className="btn btn-secondary" style={{ padding: '0.35rem', color: 'var(--accent-danger)', border: 'none', background: 'none' }} title="Revoke API Key">
                                    <Icons.Trash />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Workers Tab */}
              {activeTab === 'workers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Registered Worker Nodes</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Total nodes: {workers.length} (Active: {workers.filter(w => w.status !== 'OFFLINE').length})
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {workers.length === 0 ? (
                      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1/-1', color: 'var(--text-secondary)' }}>
                        No worker instances registered. Launch the worker script using command <code>npm run worker</code> to spin up concurrent nodes.
                      </div>
                    ) : (
                      workers.map(w => (
                        <div key={w.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          
                          {/* Node Header */}
                          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{w.hostname}</h4>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{w.id.substring(0, 18)}...</span>
                            </div>
                            <span className={`badge badge-${w.status.toLowerCase()}`}>{w.status}</span>
                          </div>

                          {/* Stats Gauges */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            
                            {/* CPU usage bar */}
                            <div>
                              <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                <span>CPU Usage</span>
                                <span>{w.last_cpu !== null ? `${w.last_cpu}%` : 'N/A'}</span>
                              </div>
                              <div style={{ height: '6px', backgroundColor: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: w.last_cpu !== null ? `${w.last_cpu}%` : '0%', backgroundColor: w.last_cpu > 80 ? 'var(--accent-danger)' : w.last_cpu > 50 ? 'var(--accent-warning)' : 'var(--accent-cyan)', transition: 'width 0.5s ease' }} />
                              </div>
                            </div>

                            {/* Memory usage bar */}
                            <div>
                              <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                <span>RAM Usage</span>
                                <span>{w.last_memory !== null ? `${w.last_memory}%` : 'N/A'}</span>
                              </div>
                              <div style={{ height: '6px', backgroundColor: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: w.last_memory !== null ? `${w.last_memory}%` : '0%', backgroundColor: w.last_memory > 85 ? 'var(--accent-danger)' : w.last_memory > 60 ? 'var(--accent-warning)' : 'var(--accent-success)', transition: 'width 0.5s ease' }} />
                              </div>
                            </div>

                          </div>

                          {/* Worker details footer */}
                          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>Last Pulse:</span>
                            <span>{new Date(w.last_heartbeat).toLocaleTimeString()}</span>
                          </div>

                        </div>
                      ))
                    )}
                  </div>

                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Inspect Job Drawer Modal */}
      {isJobModalOpen && selectedJobDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyItems: 'flex-end', justifyContent: 'flex-end', zIndex: 100 }} onClick={() => setIsJobModalOpen(false)}>
          <div style={{ width: '550px', height: '100%', backgroundColor: '#111217', borderLeft: '1px solid var(--border-light)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Job Inspector</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {selectedJobDetails.id.substring(0, 18)}...
                </h3>
              </div>
              <button onClick={() => setIsJobModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* General Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <div style={{ marginTop: '0.2rem' }}>
                  <span className={`badge badge-${selectedJobDetails.status.toLowerCase()}`}>{selectedJobDetails.status}</span>
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Target Queue:</span>
                <p style={{ marginTop: '0.2rem', fontWeight: 600 }}>{selectedJobDetails.queue_name}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Priority:</span>
                <p style={{ marginTop: '0.2rem', fontWeight: 600 }}>{selectedJobDetails.priority}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Retries:</span>
                <p style={{ marginTop: '0.2rem', fontWeight: 600 }}>{selectedJobDetails.retry_count} / {selectedJobDetails.max_retries}</p>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Scheduled execution time:</span>
                <p style={{ marginTop: '0.2rem' }}>{new Date(selectedJobDetails.scheduled_for).toLocaleString()}</p>
              </div>
            </div>

            {/* Payload block */}
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Job Arguments Payload</span>
              <pre style={{ backgroundColor: '#07080a', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid var(--border-light)' }}>
                {JSON.stringify(selectedJobDetails.payload, null, 2)}
              </pre>
            </div>

            {/* Retry failed action block */}
            {(selectedJobDetails.status === 'FAILED' || selectedJobDetails.status === 'DEAD') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>Job Execution Stalled</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manually force reset to QUEUED state</p>
                  </div>
                  <button onClick={() => handleRetryJob(selectedJobDetails.id)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    Retry execution
                  </button>
                </div>
                {aiRetryAdvice && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(6,182,212,0.05))', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🤖</span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-primary)' }}>AI Retry Advisor</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Recommended backoff delay: <strong style={{ color: 'var(--accent-cyan)' }}>{aiRetryAdvice.recommended_delay_ms >= 60000 ? `${(aiRetryAdvice.recommended_delay_ms / 60000).toFixed(1)} min` : `${(aiRetryAdvice.recommended_delay_ms / 1000).toFixed(0)}s`}</strong>
                      <br />
                      {aiRetryAdvice.message}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Execution logs terminal */}
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Traced Job Log History</span>
              <div className="terminal-window" style={{ maxHeight: '180px' }}>
                {selectedJobLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No logs compiled for this job instance.</div>
                ) : (
                  selectedJobLogs.map(log => (
                    <div key={log.id} className={`terminal-line ${log.level.toLowerCase()}`}>
                      [{new Date(log.timestamp).toLocaleTimeString()}] <span style={{ fontWeight: 600 }}>{log.level}</span>: {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Executions Run History */}
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Attempts Run History</span>
              <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', fontSize: '0.8rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#07080a', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Start Time</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Worker</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Duration</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJobExecs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No execution attempts registered.
                        </td>
                      </tr>
                    ) : (
                      selectedJobExecs.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(e.start_time).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{e.worker_id ? e.worker_id.substring(0, 8) : 'N/A'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{e.duration_ms ? `${(e.duration_ms / 1000).toFixed(2)}s` : 'N/A'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{ color: e.status === 'SUCCESS' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{e.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
