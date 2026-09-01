// Shared authentication utility

const AUTH_TOKEN_KEY = 'accessToken';
const WORKSPACE_ID_KEY = 'workspaceId';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const setAuthTokens = (accessToken, workspaceId, refreshToken) => {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  if (workspaceId) localStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const getAuthTokens = () => ({
  accessToken: localStorage.getItem(AUTH_TOKEN_KEY),
  workspaceId: localStorage.getItem(WORKSPACE_ID_KEY),
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY)
});

export const clearAuthTokens = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_ID_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const isAuthenticated = () => {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
};

export const getAuthHeaders = () => ({
  'Authorization': 'Bearer ' + (localStorage.getItem(AUTH_TOKEN_KEY) || ''),
  'Content-Type': 'application/json'
});

export const handleAuthError = (response) => {
  if (response.status === 401) {
    clearAuthTokens();
    window.location.href = '/auth/login.html';
  }
};

export const requireAuth = () => {
  if (!isAuthenticated()) {
    window.location.href = '/auth/login.html';
    return false;
  }
  return true;
};
