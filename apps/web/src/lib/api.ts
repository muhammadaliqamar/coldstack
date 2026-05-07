import { useAuthStore } from './store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const { accessToken, refreshToken, setAuth, logout } = useAuthStore.getState();

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && refreshToken) {
    // Try to refresh token
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setAuth({ user: useAuthStore.getState().user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      
      // Retry original request
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      logout();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  if (response.status !== 204) {
    return response.json();
  }
}
