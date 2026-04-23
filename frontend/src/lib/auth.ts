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

  if (!token || !user) {
    return null;
  }

  return { token, user };
}

export function saveAuthSession(session: AuthSession) {
  if (!canUseStorage()) return;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function updateStoredUser(user: AuthUser) {
  if (!canUseStorage()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
