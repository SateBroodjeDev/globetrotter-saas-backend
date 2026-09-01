// Trip API utility

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('accessToken') || '';
}

function authHeaders() {
  return {
    'Authorization': 'Bearer ' + getToken(),
    'Content-Type': 'application/json'
  };
}

async function apiRequest(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 401) {
    localStorage.removeItem('accessToken');
    window.location.href = '/auth/login.html';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

export const getTrip = (tripId) => apiRequest('GET', `/trips/${tripId}`);
export const getWorkspaceTrips = (workspaceId) => apiRequest('GET', `/trips/workspace/${workspaceId}`);
export const createTrip = (payload) => apiRequest('POST', '/trips', payload);
export const updateTrip = (tripId, payload) => apiRequest('PUT', `/trips/${tripId}`, payload);
export const deleteTrip = (tripId) => apiRequest('DELETE', `/trips/${tripId}`);

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatCurrency = (amount, currency = 'EUR') => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount || 0);
};
