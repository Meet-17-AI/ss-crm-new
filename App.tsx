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

const getPathForRole = (user: any): string => {
  if (user?.role === 'therapist') return '/therapist';
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

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogin = (userData: any) => {
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
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    window.history.pushState({}, '', '/');
  };

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
    const correctPath = getPathForRole(user);
    if (path !== correctPath) {
      window.history.replaceState({}, '', correctPath);
    }

    if (role === 'therapist') return <TherapistDashboard onLogout={handleLogout} user={user} />;
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
