import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { HeroPanel } from './components/HeroPanel';
import { Logo } from './components/Logo';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { TherapistDashboard } from './components/TherapistDashboard';
import { MaintenancePage } from './components/MaintenancePage';
import { SOSDocumentationView } from './components/SOSDocumentationView';
import { PublicBookingContainer } from './components/PublicBookingContainer';
import { BookingConfirmation } from './components/BookingConfirmation';
import { SessionNotesPage } from './components/SessionNotesPage';
import CRMApp from './src/crm/App';
import { Monitor } from 'lucide-react';
import { setToken, clearToken, getToken } from './lib/authFetch';

/**
 * A one-time ticket from the panel, carried in the URL FRAGMENT.
 *
 * The fragment rather than the query string on purpose: fragments are never sent
 * to a server, so the ticket stays out of access logs and Referer headers. It is
 * stripped from the address bar as soon as it is read, and it is single-use
 * server-side regardless.
 */
const readHandoffTicket = (): string | null => {
  const m = window.location.hash.match(/(?:^|[#&])t=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const stripHandoffFromUrl = () => {
  window.history.replaceState({}, '', window.location.pathname + window.location.search);
};

// Public routes — no auth needed
const renderPublicRoute = (path: string) => {
  const sosMatch = path.match(/^\/sos-view\/(.+)$/);
  if (sosMatch) return <SOSDocumentationView token={sosMatch[1]} />;

  const bookMatch = path.match(/^\/book\/(.+)$/);
  if (bookMatch) return <PublicBookingContainer slug={bookMatch[1]} />;

  const confirmMatch = path.match(/^\/booking-confirmation\/(.+)$/);
  if (confirmMatch) return <BookingConfirmation bookingId={confirmMatch[1]} />;

  const notesMatch = path.match(/^\/session-notes\/(.+)$/);
  if (notesMatch) return <SessionNotesPage bookingId={notesMatch[1]} />;

  return null;
};

const getPathForRole = (user: any, forceCrm = false): string => {
  if (user?.role === 'therapist' && !forceCrm) return '/therapist';
  return '/crm';
};

const loadSavedUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Clear stale sessions with old sales_role field
    if ('sales_role' in parsed) {
      localStorage.clear();
      return null;
    }
    // A stored user with no token predates token auth, or the token was cleared
    // after a 401. Every API call would fail, so treat it as signed out rather
    // than rendering a shell that cannot load anything.
    if (!getToken()) {
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const App: React.FC = () => {
  const path = window.location.pathname;

  // Handle public routes before any state
  const publicRoute = renderPublicRoute(path);
  if (publicRoute) return publicRoute;

  // Maintenance mode (Vercel/production)
  if (import.meta.env.VITE_VERCEL === '1') return <MaintenancePage />;

  const [user, setUser] = useState<any>(loadSavedUser);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!loadSavedUser() && localStorage.getItem('isLoggedIn') === 'true';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // A ticket in the URL means we arrived from the panel's dashboard switcher.
  // Held in state so the login form is never shown while the exchange is in
  // flight — otherwise the user sees a sign-in page flash for someone who is
  // already signed in, which is the whole thing this is meant to avoid.
  const [handoff, setHandoff] = useState<'none' | 'pending' | 'failed'>(
    () => (readHandoffTicket() ? 'pending' : 'none')
  );
  const [handoffError, setHandoffError] = useState<string>('');

  // Sticky across reloads, so refreshing the CRM does not bounce a therapist to
  // their own dashboard. Cleared on logout.
  const [forceCrm, setForceCrm] = useState<boolean>(
    () => localStorage.getItem('landedOnCrm') === 'true'
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const ticket = readHandoffTicket();
    if (!ticket) return;
    // Out of the address bar immediately — before the request, so a reload or a
    // shared URL cannot replay it even though the server would also refuse.
    stripHandoffFromUrl();

    (async () => {
      try {
        const res = await fetch('/api/handoff/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.token) {
          throw new Error(data?.error || `Sign-in handoff failed (HTTP ${res.status})`);
        }
        setToken(data.token);
        setUser(data.user);
        setIsLoggedIn(true);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        // They asked for the CRM. Without this a therapist would be handed their
        // therapist dashboard by the role rule below — the one screen they were
        // switching away FROM.
        setForceCrm(true);
        localStorage.setItem('landedOnCrm', 'true');
        setHandoff('none');
      } catch (e: any) {
        // Fall back to the normal login form with an explanation, rather than a
        // blank screen or a silent bounce.
        //
        // Also logged, because the explanation used to be captured here and
        // rendered NOWHERE: a failed handoff dropped the user on the sign-in
        // form with no indication that anything had been attempted, let alone
        // what went wrong. It cost a day of diagnosing "the CRM switch does
        // nothing" from the outside.
        console.error('[handoff] redeem failed:', e);
        setHandoffError(e?.message || 'Could not sign you in from the panel.');
        setHandoff('failed');
      }
    })();
  }, []);

  const handleLogin = (userData: any, token?: string) => {
    if (token) setToken(token);
    setUser(userData);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isLoggedIn', 'true');
    const dest = getPathForRole(userData);
    if (window.location.pathname !== dest) {
      window.history.pushState({}, '', dest);
    }
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setIsLoggedIn(false);
    setForceCrm(false);
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('landedOnCrm');
    window.history.pushState({}, '', '/');
  };

  // The ticket is still being exchanged. Showing the login form here would ask
  // someone who is already signed in to sign in again.
  if (handoff === 'pending') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Signing you in…</p>
        </div>
      </div>
    );
  }

  // A failed handoff SAYS SO. This state existed and rendered nothing, so the
  // app fell through to the sign-in form and the reason — already captured in
  // handoffError — was discarded. Someone switching from the panel simply
  // arrived at a login page, with no way to tell a broken handoff from having
  // been signed out. Signing in by hand still works, and is offered here.
  if (handoff === 'failed') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-base font-semibold text-gray-900">Could not sign you in from the panel</h1>
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            {handoffError || 'The sign-in handoff failed.'}
          </p>
          <p className="mt-4 text-sm text-gray-500">
            You can sign in below instead, or go back to the panel and try again.
          </p>
          <button
            onClick={() => setHandoff('none')}
            className="mt-5 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Continue to sign in
          </button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-teal-50 to-teal-100 p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center">
              <Monitor size={40} className="text-teal-700" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Desktop View Required</h1>
          <p className="text-gray-600 mb-2">Mobile view is not available yet.</p>
          <p className="text-gray-600">Please view this application on a desktop or laptop for the best experience.</p>
        </div>
      </div>
    );
  }

  if (isLoggedIn && user) {
    const role = user.role?.toLowerCase();

    // Keep URL in sync with role
    const correctPath = getPathForRole(user, forceCrm);
    if (path !== correctPath) {
      window.history.replaceState({}, '', correctPath);
    }

    if (role === 'therapist' && !forceCrm) {
      return <TherapistDashboard onLogout={handleLogout} user={user} />;
    }
    return <CRMApp user={user} onLogout={handleLogout} />;
  }

  // Login page
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white overflow-hidden">
      <div className="w-full md:w-1/2 flex flex-col justify-between p-8 md:p-12 lg:p-16 relative">
        <div className="flex-none">
          <Logo />
        </div>
        <div className="flex-grow flex items-center justify-center py-10">
          <div className="w-full max-w-md">
            <LoginForm onLogin={handleLogin} />
          </div>
        </div>
        <div className="flex-none flex justify-center">
          <Footer />
        </div>
      </div>
      <div className="hidden md:flex md:w-1/2 p-4 h-screen">
        <HeroPanel />
      </div>
    </div>
  );
};

export default App;
