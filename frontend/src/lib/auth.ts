export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  selected_avatar_id?: string | null;
  is_active: boolean;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

const TOKEN_KEY = 'token';
const USER_KEY = 'auth_user';
const AUTH_EVENT = 'tech-hobby-auth-change';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function getStoredToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseStorage()) return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!token || !user || isTokenExpired(token)) {
    clearAuthSession();
    return null;
  }

  return { token, user };
}

export function saveAuthSession(session: AuthSession) {
  if (!canUseStorage()) return;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  notifyAuthChanged();
}

export function updateStoredUser(user: AuthUser) {
  if (!canUseStorage()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthChanged();
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChanged();
}

export function getAuthEventName() {
  return AUTH_EVENT;
}

function notifyAuthChanged() {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function isTokenExpired(token: string) {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  } catch {
    return true;
  }
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  if (!canUseStorage()) return null;

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const decoded = window.atob(padded);
  return JSON.parse(decoded) as { exp?: number };
}
