import React from 'react';
import { Logo } from './Logo';

/**
 * TEMPORARY — holds staff out of the CRM while the production migration runs.
 *
 * ============================================================================
 *  HOW TO REMOVE, once the migration is done
 *
 *    Quickest:  set MIGRATION_ACTIVE to false below and redeploy.
 *    Properly:  delete this file, then remove the two lines in App.tsx that
 *               import <MigrationGate> and wrap the signed-in branch in it.
 *
 *  Nothing else in the codebase refers to this, by design.
 * ============================================================================
 *
 * Mirrors the panel's copy. It takes the user as a PROP rather than reading a
 * context, because this app keeps the signed-in user in App.tsx state and has no
 * auth provider to read from.
 *
 * WHAT IT DOES NOT DO. This is a notice, not a lock — it runs in the browser and
 * the API behind it stays open. It exists so staff see an explanation instead of
 * half-migrated data.
 */
export const MIGRATION_ACTIVE = true;

/** Matched against BOTH username and email, case-insensitively. */
const ALLOWED_IDENTITIES = ['aiteam', 'aiteam@fluid.live'];

const isAllowed = (user: any): boolean =>
  [user?.username, user?.email].some(
    (id) => id && ALLOWED_IDENTITIES.includes(String(id).trim().toLowerCase())
  );

const MaintenanceNotice: React.FC<{ user: any; onSignOut: () => void }> = ({ user, onSignOut }) => (
  <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-teal-50 to-teal-100 p-6">
    <div className="bg-white rounded-2xl shadow-2xl px-10 py-12 max-w-lg w-full text-center">
      <div className="flex justify-center mb-8">
        <Logo />
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-3">
        The panel is under maintenance
      </h1>

      <p className="text-gray-600 mb-2">
        We are upgrading the platform right now. It will be back shortly, and you
        will get an email as soon as it is ready to use.
      </p>
      <p className="text-gray-600">
        Please do not create or edit bookings until then.
      </p>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <p className="text-sm text-gray-400 mb-3">
          Signed in as{' '}
          <span className="font-medium text-gray-600">
            {user?.full_name || user?.username || 'this account'}
          </span>
        </p>
        {/* Lets the migration account take over a browser where a colleague is
            already signed in, without clearing site data by hand. */}
        <button
          onClick={onSignOut}
          className="text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500
                     focus-visible:ring-offset-2 rounded px-2 py-1"
        >
          Sign out
        </button>
      </div>
    </div>
  </div>
);

export const MigrationGate: React.FC<{
  user: any;
  onSignOut: () => void;
  children: React.ReactNode;
}> = ({ user, onSignOut, children }) => {
  if (!MIGRATION_ACTIVE) return <>{children}</>;
  if (!user) return <>{children}</>;
  if (isAllowed(user)) return <>{children}</>;
  return <MaintenanceNotice user={user} onSignOut={onSignOut} />;
};

export default MigrationGate;
