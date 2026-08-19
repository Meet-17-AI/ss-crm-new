import React, { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Check, ChevronDown } from 'lucide-react';

/**
 * Moves from the CRM back to the panel's dashboards.
 *
 * The mirror of the panel's switcher. Without it, switching is a trapdoor: a
 * therapist or admin who came here would have to sign in again to get back to the
 * dashboard they arrived from.
 *
 * The panel is a DIFFERENT origin, so this cannot simply navigate and expect the
 * session to follow — it asks this backend for a one-time ticket and hands it
 * over in the URL fragment, exactly as the panel does coming the other way.
 *
 * Renders nothing when the user holds nothing but the CRM, which is the ordinary
 * case for a sales account.
 */

type Scope = 'admin_dashboard' | 'therapist_dashboard' | 'crm';

const LABEL: Record<Scope, string> = {
  admin_dashboard: 'Admin dashboard',
  therapist_dashboard: 'Therapist dashboard',
  crm: 'CRM',
};

const ORDER: Scope[] = ['admin_dashboard', 'therapist_dashboard', 'crm'];

/**
 * Which panel route each dashboard lives at.
 *
 * The destination has to be named HERE, in the redirect itself. Sending everyone
 * to the panel's root instead makes the panel pick a default, and its default is
 * the first scope the user holds — so anyone with admin access landed on the
 * admin dashboard no matter which option they chose.
 */
const PANEL_PATH: Record<Scope, string> = {
  admin_dashboard: '/admin',
  therapist_dashboard: '/therapist',
  crm: '/',
};

// Where the panel is served. Set VITE_PANEL_URL in production.
const PANEL_URL: string =
  (import.meta as any).env?.VITE_PANEL_URL || 'http://localhost:5173';

export const DashboardSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Asked of the server rather than read from the stored user object, which is
    // on disk and editable. Nothing here grants anything — the panel re-checks
    // the scope when the ticket is issued and again when it is redeemed — but
    // showing an option that would be refused is a poor way to find out.
    (async () => {
      try {
        const res = await fetch('/api/me/access');
        if (!res.ok) return;
        const data = await res.json();
        setScopes(Array.isArray(data.scopes) ? data.scopes : []);
      } catch {
        /* leave the switcher hidden rather than guessing */
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const held = ORDER.filter((s) => scopes.includes(s));
  if (held.length < 2) return null;

  const go = async (scope: Scope) => {
    setOpen(false);
    if (scope === 'crm') return; // already here
    setLeaving(true);
    setError('');
    try {
      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: scope }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket) {
        throw new Error(data?.error || `Could not open that dashboard (HTTP ${res.status})`);
      }
      // Land directly on the chosen dashboard, with the ticket in the FRAGMENT —
      // fragments are never sent to a server, so it stays out of access logs and
      // Referer headers.
      window.location.href =
        `${PANEL_URL.replace(/\/$/, '')}${PANEL_PATH[scope]}#t=${encodeURIComponent(data.ticket)}`;
      // No setLeaving(false) — the page is navigating away, and clearing it would
      // flash the button back first.
    } catch (e: any) {
      setLeaving(false);
      setError(e?.message || 'Could not switch.');
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={leaving}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5
                   text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50
                   disabled:cursor-wait disabled:opacity-60"
      >
        <LayoutGrid size={16} className="shrink-0 text-teal-700" />
        <span className="flex-1 text-left truncate">{leaving ? 'Opening…' : 'CRM'}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        // Opens UPWARD: this sits at the bottom of the sidebar, so a downward
        // menu would render off-screen.
        <div role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[13rem] rounded-xl border
                     bg-white py-1 shadow-lg">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Switch to
          </p>
          {held.map((scope) => (
            <button
              key={scope}
              role="menuitem"
              onClick={() => go(scope)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm
                          transition-colors hover:bg-teal-50 hover:text-teal-700 ${
                            scope === 'crm' ? 'font-semibold text-teal-700' : 'text-gray-700'
                          }`}
            >
              {LABEL[scope]}
              {scope === 'crm' && <Check size={15} />}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1.5 px-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
};

export default DashboardSwitcher;
