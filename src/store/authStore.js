import { create } from 'zustand';
import { loginRequest } from '@/api/enterpriseApi';
import { getViewByName, getAllViews } from '@/lib/userConfig';

const AUTH_STORAGE_KEY = 'auth_user';

function mapUserViews(viewNames = [], role = 'user') {
  if (role === 'admin' || viewNames.includes('*')) {
    return getAllViews();
  }

  return viewNames
    .map((name) => getViewByName(name))
    .filter(Boolean);
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const useAuthStore = create((set, get) => ({
  user: loadStoredUser(),
  isLoading: false,

  async login(email, password) {
    set({ isLoading: true });
    try {
      const response = await loginRequest({ email, password });
      localStorage.setItem('access_token', response.accessToken);
      localStorage.setItem('refresh_token', response.refreshToken);

      const user = {
        ...response.user,
        views: mapUserViews(response.user.views, response.user.role),
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      set({ user, isLoading: false });
      return user;
    } catch (error) {
      set({ isLoading: false });
      throw new Error(error?.response?.data?.error || 'Login failed');
    }
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem(AUTH_STORAGE_KEY);
    set({ user: null });
  },

  setUser(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    set({ user });
  },

  isAuthenticated() {
    return Boolean(get().user);
  },
}));
