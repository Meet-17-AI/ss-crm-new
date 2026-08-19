/**
 * Attaches the auth token to every same-origin /api request.
 *
 * Ported from the panel. This app makes hundreds of bare `fetch('/api/...')`
 * calls; patching fetch once means none of them change, and any call added later
 * is covered rather than silently unauthenticated.
 *
 * It became necessary the moment crm-backend started requiring a token. Before
 * that this app had no concept of one — login returned a user object, the
 * frontend put it in localStorage, and that object WAS the session.
 */

const TOKEN_KEY = 'authToken';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable (private mode) — requests will 401 and bounce to login */
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

/** True for requests aimed at our own API — the only ones we may attach a token to. */
const isOwnApiRequest = (url: string): boolean => {
  if (url.startsWith('/api/')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

let installed = false;

export function installAuthFetch(): void {
  if (installed) return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;

    // Never leak the token to third-party hosts.
    if (!isOwnApiRequest(url)) return nativeFetch(input as any, init);

    const token = getToken();
    if (token) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      init = { ...init, headers };
    }

    const response = await nativeFetch(input as any, init);

    // An expired or invalid token means the stored session is dead. Clear it
    // rather than letting every screen render an empty error state.
    if (response.status === 401) {
      clearToken();
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
      } catch {
        /* ignore */
      }
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/');
      }
    }

    return response;
  };
}
