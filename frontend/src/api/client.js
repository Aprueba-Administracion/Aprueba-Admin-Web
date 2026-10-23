// Cliente HTTP del API. Maneja el envelope {data,error,meta},
// el token Bearer y el refresh automático del access token.
const BASE = '/api/v1';

let accessToken = null;
let refreshToken = null;
let onAuthFail = null;
let onTokens = null;

export function setTokens(a, r) {
  accessToken = a;
  refreshToken = r;
}

export function setAuthFailHandler(fn) {
  onAuthFail = fn;
}

// Permite a AuthContext persistir los tokens renovados.
export function setTokensChangedHandler(fn) {
  onTokens = fn;
}

export function getAccessToken() {
  return accessToken;
}

async function raw(method, path, body, retry = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return { data: null, meta: null };
  }

  const json = await res.json().catch(() => ({
    error: {
      code: 'PARSE',
      message: 'Respuesta inválida',
    },
  }));

  if (!res.ok) {
    // Intenta renovar una vez si el access token expiró.
    if (
      res.status === 401 &&
      retry &&
      refreshToken &&
      !path.startsWith('/admin/auth')
    ) {
      const refreshed = await tryRefresh();

      if (refreshed) {
        return raw(method, path, body, false);
      }

      if (onAuthFail) onAuthFail();
    }

    const err = new Error(json.error?.message || 'Error');
    err.code = json.error?.code;
    err.status = res.status;
    throw err;
  }

  return json;
}

// Evita varios refresh simultáneos: con rotación, el segundo token usado
// invalidaría la sesión.
let refreshing = null;

function tryRefresh() {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function doRefresh() {
  try {
    const res = await fetch(`${BASE}/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const json = await res.json();

    accessToken = json.data.accessToken;
    refreshToken = json.data.refreshToken;

    if (onTokens) {
      onTokens(accessToken, refreshToken);
    }

    return true;
  } catch {
    return false;
  }
}

// Construye un query-string omitiendo valores vacíos.
export function qs(params = {}) {
  const p = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      p.set(key, String(value));
    }
  }

  const query = p.toString();
  return query ? `?${query}` : '';
}

export const api = {
  login: (email, password, otp) =>
    raw('POST', '/admin/auth/login', {
      email,
      password,
      otp,
    }),

  // Revoca la sesión en el backend.
  // AuthContext limpiará después los tokens locales.
  logout: () =>
    raw(
      'POST',
      '/admin/auth/logout',
      { refreshToken },
      false
    ),

  // Cierra todas las sesiones del usuario (requiere access token vigente).
  logoutAll: () => raw('POST', '/admin/auth/logout-all', {}, false),

  get: (path) =>
    raw('GET', '/admin' + path),

  post: (path, body) =>
    raw('POST', '/admin' + path, body),

  patch: (path, body) =>
    raw('PATCH', '/admin' + path, body),

  put: (path, body) =>
    raw('PUT', '/admin' + path, body),

  del: (path) =>
    raw('DELETE', '/admin' + path),
};