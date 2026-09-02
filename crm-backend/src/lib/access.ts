/**
 * Authentication and dashboard access for crm-backend.
 *
 * Ported from panel-backend/src/lib/access.ts, which stays the reference copy.
 * Both services must agree, so changes belong in both — they are two processes
 * enforcing one policy, not two policies.
 *
 * BACKGROUND. This service previously had NO authentication of any kind: its
 * whole middleware stack was cors() and express.json(), and all 111 routes —
 * case histories, progress notes, session notes, SOS documentation, client
 * profiles, password changes — answered anyone who knew the URL. Its /api/login
 * verified a password and returned a user object without issuing a token,
 * because nothing downstream ever looked for one.
 *
 * The model, same as the panel:
 *   role   = who you are        (immutable: therapist | admin | sales)
 *   scope  = what you may open  (grantable, additive)
 * A token is signed by panel-backend and verified here with the same secret.
 * This service never issues one — one issuer, one identity.
 */

import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import pool from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail at boot, not per request. Without the secret every token looks forged,
  // and a service that cannot authenticate anyone must not start and pretend to.
  console.error('❌ FATAL: JWT_SECRET is not set. It must match panel-backend exactly.');
  process.exit(1);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Mint a session token.
 *
 * Identical claim shape to panel-backend's issueToken, and signed with the same
 * secret, so a token from either service is accepted by both. That is what makes
 * one login work across the panel and the CRM — and what will let the dashboard
 * switcher move between them without a second sign-in.
 *
 * Claims stay minimal: anything else can be looked up from the id at request
 * time, and a claim that is not in the token cannot go stale inside it.
 */
export function issueToken(user: { id: any; username?: string; role: string; therapist_id?: any; email?: string }): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      therapist_id: user.therapist_id ?? null,
      email: user.email ?? null,
    },
    JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

/**
 * MUST match panel-backend/src/lib/access.ts exactly.
 *
 * `superadmin` was missing here, and the divergence was silent rather than loud:
 * loadScopes() filters grant rows through isScope(), so a superadmin grant was
 * discarded by this service without a word while the panel honoured it. Nothing
 * in the CRM gates on it today, which is why it caused no visible damage — but
 * "the two copies disagree about what a scope even is" is the failure this file
 * header warns about, and the first superadmin-only CRM surface would have
 * inherited it.
 */
export type Scope = 'admin_dashboard' | 'therapist_dashboard' | 'crm' | 'superadmin';
export const ALL_SCOPES: Scope[] = ['admin_dashboard', 'therapist_dashboard', 'crm', 'superadmin'];
export const isScope = (v: any): v is Scope => ALL_SCOPES.includes(v);

/**
 * Scopes that name a dashboard someone can stand in. `superadmin` is an
 * elevation OF the admin dashboard, not a place to go — so it is never a
 * handoff target and never appears in the switcher.
 */
export const DASHBOARD_SCOPES: Scope[] = ['admin_dashboard', 'therapist_dashboard', 'crm'];

/**
 * An array per role, not a single scope — a superadmin carries the admin
 * dashboard they stand in AND the elevation behind it. The panel has always
 * modelled it this way; this copy flattened it to one scope and lost the second.
 */
const BASE_SCOPES: Record<string, Scope[]> = {
  therapist: ['therapist_dashboard'],
  admin: ['admin_dashboard'],
  superadmin: ['admin_dashboard', 'superadmin'],
  fluidadmin: ['admin_dashboard', 'superadmin'],
  sales: ['crm'],
};

export const baseScopesForRole = (role: any): Scope[] =>
  BASE_SCOPES[String(role || '').toLowerCase()] ?? [];

export const baseScopeForRole = (role: any): Scope | null =>
  baseScopesForRole(role).find((s) => DASHBOARD_SCOPES.includes(s)) ?? null;

const BASE_ADMIN_ROLES = ['admin', 'superadmin', 'fluidadmin'];
export const isBaseAdminRole = (user: any): boolean =>
  BASE_ADMIN_ROLES.includes(String(user?.role || '').toLowerCase());

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Routes reachable without a token. Closed by default: a route added later is
 * authenticated unless it is listed here deliberately.
 *
 * Method matters. The webhook and paperform entries are server-to-server and
 * carry their own verification inside the handler.
 */
const PUBLIC_ROUTES: { methods: string[]; pattern: RegExp }[] = [
  { methods: ['POST'], pattern: /^\/api\/login$/ },
  { methods: ['POST'], pattern: /^\/api\/logout$/ },
  // Exchanges a one-time ticket from the panel for a session here. Necessarily
  // public: the caller has no session on this origin yet — that is the point.
  { methods: ['POST'], pattern: /^\/api\/handoff\/redeem$/ },
  { methods: ['POST'], pattern: /^\/api\/verify-therapist-otp$/ },
  { methods: ['POST'], pattern: /^\/api\/forgot-password\/(send-otp|verify-otp|reset)$/ },
  // Server-to-server. panel-backend calls this on every new booking to move the
  // lead through the pipeline; it has no user session to present.
  { methods: ['POST'], pattern: /^\/api\/webhooks\/new-booking$/ },
  { methods: ['POST'], pattern: /^\/api\/paperform-webhook\/(free-consultation|therapy-documentation)$/ },
  // Client-facing, token-gated inside the handler rather than by session.
  { methods: ['GET'],  pattern: /^\/api\/sos-documentation$/ },
  { methods: ['GET'],  pattern: /^\/api\/session-notes-info$/ },
  { methods: ['POST'], pattern: /^\/api\/session-documentation$/ },
  { methods: ['GET'],  pattern: /^\/api\/public\/booking\/[^/]+$/ },
  { methods: ['GET'],  pattern: /^\/health$/ },
];

const isPublicRoute = (method: string, path: string): boolean =>
  PUBLIC_ROUTES.some((r) => r.methods.includes(method) && r.pattern.test(path));

export const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET as string);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/** The global gate. Register before any route so declaration order cannot bypass it. */
export const authGate = (req: any, res: any, next: any) => {
  if (!req.path.startsWith('/api/')) return next();
  if (req.method === 'OPTIONS') return next();          // preflight carries no header
  if (isPublicRoute(req.method, req.path)) return next();
  return authMiddleware(req, res, next);
};

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;
const ACCESS_CHANNEL = 'access_changed';
const cache = new Map<string, { scopes: Set<Scope>; at: number }>();

const applyInvalidation = (payload: string) => {
  if (payload === '*') cache.clear();
  else cache.delete(payload);
};

/**
 * Listens for grant changes made by panel-backend.
 *
 * This is the reason invalidation was built on Postgres NOTIFY rather than a
 * local map: the write happens in a different process on a different HOST, and
 * only a channel both can see will carry it. Without this, revoking someone's
 * CRM access in the panel would leave this service honouring it.
 */
let listener: Client | null = null;
function startAccessListener(): void {
  if (listener) return;
  const client = new Client({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  listener = client;

  const retry = (why: string) => {
    console.error(`[access] invalidation listener ${why}; retrying in 5s`);
    listener = null;
    cache.clear(); // may have gone stale while deaf
    setTimeout(startAccessListener, 5000).unref?.();
  };

  client.on('notification', (msg) => applyInvalidation(String(msg.payload ?? '*')));
  client.on('error', (err: any) => retry(`errored (${err?.message || err})`));
  client.on('end', () => retry('disconnected'));

  client
    .connect()
    .then(() => client.query(`LISTEN ${ACCESS_CHANNEL}`))
    .then(() => console.log('[access] invalidation listener ready'))
    .catch((err: any) => retry(`could not connect (${err?.message || err})`));
}
startAccessListener();

/**
 * Every scope the caller holds: the one their role implies plus what was granted.
 *
 * Read from the database, never from the token — a scope baked into a 24h JWT
 * would outlive its revocation by up to a day.
 */
export async function loadScopes(user: any): Promise<Set<Scope>> {
  const fallback = new Set<Scope>(baseScopesForRole(user?.role));
  if (!user?.id) return fallback;

  const key = String(user.id);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.scopes;

  try {
    // The ROLE is read from the database here, exactly as the panel reads it.
    //
    // This query used to select grants only, and derive the base scope from
    // `user.role` — which is the decoded JWT. So the doc comment above was half
    // true: grants were live, but the role-derived half was pinned to a 24-hour
    // token. Demote someone from admin to therapist and the panel stopped
    // honouring admin_dashboard within the 30s cache window while this service
    // kept honouring it for up to a day. LISTEN/NOTIFY could not help, because
    // clearing the cache just re-derived the same stale answer from the same
    // stale token.
    const { rows } = await pool.query(
      `SELECT u.role, g.scope
         FROM users u
         LEFT JOIN user_access_grants g ON g.user_id = u.id
        WHERE u.id = $1`,
      [user.id]
    );
    // No row means no account. Left as the token's base rather than empty, for
    // the same fail-open-on-base reason below — and a deleted user cannot log
    // in again regardless.
    if (rows.length === 0) return fallback;

    const scopes = new Set<Scope>(baseScopesForRole(rows[0].role));
    for (const row of rows) if (isScope(row.scope)) scopes.add(row.scope);
    cache.set(key, { scopes, at: Date.now() });
    return scopes;
  } catch (err: any) {
    // Fail closed on EXTRAS, open on the base scope: a database blip must not
    // hand out access nobody granted, nor lock someone out of their own app.
    console.error('[access] scope lookup failed:', err?.message || err);
    return fallback;
  }
}

export const requireScope = (scope: Scope) => async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    if (!(await loadScopes(req.user)).has(scope)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  } catch (err: any) {
    console.error('[access] requireScope failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not verify permissions' });
  }
  next();
};

// ---------------------------------------------------------------------------
// Object-level ownership
// ---------------------------------------------------------------------------

/**
 * May the caller act on this therapist's data? Their own, or an admin.
 *
 * Two identifiers are accepted, matching panel-backend. A therapist is named by
 * both users.id and users.therapist_id (a five-digit code), and routes disagree
 * about which one their `therapist_id` parameter carries. Checking only the
 * latter matched neither, and refused every therapist their own data with a 403.
 * Both keys are unique to one user and both are read from the SESSION, so a
 * therapist still cannot pass a colleague's id under either naming.
 */
export async function mayActAsTherapist(req: any, therapistId: any): Promise<boolean> {
  if (therapistId === null || therapistId === undefined || therapistId === '') return false;
  const wanted = String(therapistId);
  if (req?.user?.id != null && String(req.user.id) === wanted) return true;
  if (req?.user?.therapist_id != null && String(req.user.therapist_id) === wanted) return true;
  return (await loadScopes(req?.user)).has('admin_dashboard');
}

export const requireTherapistScope = (pick: (req: any) => any) => async (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    if (!(await mayActAsTherapist(req, pick(req)))) {
      return res.status(403).json({ error: 'Not your therapist record' });
    }
  } catch (err: any) {
    console.error('[access] therapist scope check failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not verify permissions' });
  }
  next();
};

/**
 * May the caller read or write THIS CLIENT'S clinical records?
 *
 * Stricter than any dashboard scope, and checked on ROLE rather than scope so no
 * grant can confer it. A therapist reaches a client only through a booking of
 * their own; being given the CRM or an admin panel is not consent to read every
 * client's therapy record.
 */
export async function mayAccessClientRecords(
  req: any,
  ref: { clientId?: any; bookingId?: any }
): Promise<boolean> {
  if (isBaseAdminRole(req?.user)) return true;

  const therapistId = req?.user?.therapist_id;
  if (!therapistId) return false;

  const clientId = ref.clientId ? String(ref.clientId) : null;
  const bookingId = ref.bookingId ? String(ref.bookingId) : null;
  if (!clientId && !bookingId) return false;

  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM bookings b
        WHERE b.therapist_id = $1
          AND (
                ($2::text IS NOT NULL AND b.booking_id = $2)
             OR ($3::text IS NOT NULL AND (
                   LOWER(b.invitee_email) = LOWER($3)
                   OR (b.invitee_phone IS NOT NULL AND $3 ~ '[0-9]' AND
                       regexp_replace(b.invitee_phone, '[^0-9]', '', 'g')
                         = regexp_replace($3, '[^0-9]', '', 'g'))
                ))
          )
        LIMIT 1`,
      [therapistId, bookingId, clientId]
    );
    return rows.length > 0;
  } catch (err: any) {
    console.error('[access] client record check failed:', err?.message || err);
    return false; // fail closed
  }
}

export const requireClientRecordAccess =
  (pick: (req: any) => { clientId?: any; bookingId?: any }) =>
  async (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    try {
      if (!(await mayAccessClientRecords(req, pick(req)))) {
        return res.status(403).json({ error: "These records belong to another therapist's client." });
      }
    } catch (err: any) {
      console.error('[access] client record guard failed:', err?.message || err);
      return res.status(500).json({ error: 'Could not verify permissions' });
    }
    next();
  };

// ---------------------------------------------------------------------------
// Blanket scope gate
// ---------------------------------------------------------------------------

const SCOPED_ROUTES: { pattern: RegExp; scope: Scope }[] = [
  { pattern: /^\/api\/leads(\/|$)/, scope: 'crm' },
  { pattern: /^\/api\/lead-managers(\/|$)/, scope: 'crm' },
  { pattern: /^\/api\/pretherapy-form(\/|$)/, scope: 'crm' },
  { pattern: /^\/api\/crm(\/|-|$)/, scope: 'crm' },
];

/**
 * ENFORCES by default; shadow mode is opt-in via ACCESS_ENFORCE=false.
 *
 * Was shadow-by-default, and the variable turning it on was set in no
 * environment anywhere — so the gate reported and passed everything for months.
 * A check whose default is "off" is not a check. Must stay identical to
 * panel-backend: one service enforcing while the other does not is a policy
 * split. See that copy for how to stage a rollout.
 */
const ENFORCING = String(process.env.ACCESS_ENFORCE ?? 'true').toLowerCase() !== 'false';

/** The gate's real state, for the diagnostic endpoint. See panel-backend. */
export const isEnforcing = (): boolean => ENFORCING;

/**
 * What the gate WOULD have blocked, while it runs in shadow mode.
 *
 * PERSISTED, because the decision it feeds takes a week and the process does not
 * live that long. This was a Map on the reasoning that a one-off rollout
 * diagnostic is not worth a table — true of the DATA, false of the JOB: every
 * deploy, restart and idle spin-down emptied it, so whoever finally read the list
 * would see only the traffic since the last restart and mistake a short quiet
 * window for a clean week.
 *
 * Written fire-and-forget: a diagnostic must never slow or fail the request it
 * is observing. Mirrors panel-backend — keep the two identical.
 */
const SERVICE = 'crm-backend';

const SHADOW_TABLE = `
  CREATE TABLE IF NOT EXISTS access_shadow_denials (
    service    TEXT        NOT NULL,
    route      TEXT        NOT NULL,
    role       TEXT        NOT NULL,
    scope      TEXT        NOT NULL,
    count      BIGINT      NOT NULL DEFAULT 1,
    first_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (service, route, role)
  )`;

let shadowTableReady: Promise<void> | null = null;
const ensureShadowTable = (): Promise<void> =>
  (shadowTableReady ??= pool.query(SHADOW_TABLE).then(
    () => undefined,
    (err: any) => {
      shadowTableReady = null;
      console.error('[access] could not create shadow denial table:', err?.message || err);
      throw err;
    }
  ));

/** Local dedup for the console only, so the log shows the distinct list once. */
const shadowPrinted = new Set<string>();

const recordShadowDenial = (route: string, role: string, scope: Scope): void => {
  void ensureShadowTable()
    .then(() =>
      pool.query(
        `INSERT INTO access_shadow_denials (service, route, role, scope)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (service, route, role)
         DO UPDATE SET count = access_shadow_denials.count + 1, last_at = now()`,
        [SERVICE, route, role, scope]
      )
    )
    .catch((err: any) => console.error('[access] shadow denial not recorded:', err?.message || err));
};

/**
 * Reads BOTH services' rows, not just this one's — the gate has to be switched on
 * in both together, so the decision needs both halves in one list.
 */
export const getShadowDenials = async () => {
  try {
    await ensureShadowTable();
    const { rows } = await pool.query(
      `SELECT service, route, role, scope, count::int AS count,
              first_at AS "firstAt", last_at AS "lastAt"
         FROM access_shadow_denials ORDER BY count DESC`
    );
    return rows;
  } catch {
    // An unreadable diagnostic must not be reported as an empty one — that reads
    // as "nothing would break", the single most dangerous wrong answer here.
    throw new Error('shadow denial log is unavailable');
  }
};

export const scopeGate = async (req: any, res: any, next: any) => {
  const path = req.path || '';
  const match = SCOPED_ROUTES.find((r) => r.pattern.test(path));
  if (!match || !req.user) return next();

  let allowed = true;
  try {
    allowed = (await loadScopes(req.user)).has(match.scope);
  } catch {
    allowed = !ENFORCING;
  }
  if (allowed) return next();

  const role = String(req.user.role || 'unknown');
  if (!ENFORCING) {
    const route = `${req.method} ${path}`;
    const key = `${route}|${role}`;
    recordShadowDenial(route, role, match.scope);
    // Printed only the FIRST time in this process; the durable count is in the
    // table, which both services and every instance share.
    if (!shadowPrinted.has(key)) {
      shadowPrinted.add(key);
      console.warn(`[access] SHADOW would deny ${role} ${req.method} ${path} — needs ${match.scope}`);
    }
    return next();
  }

  const who = req.user.username || req.user.email || req.user.id;
  console.warn(`[access] denied ${who} (${role}) ${req.method} ${path} — needs ${match.scope}`);
  return res.status(403).json({ error: 'Insufficient permissions' });
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Replaces a bare cors(), which reflected every origin on the internet — so any
 * website a logged-in user visited could read this API with their credentials.
 */
export const allowedOrigins = (): string[] =>
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
