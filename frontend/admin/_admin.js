// Shared admin utilities – included by all admin pages
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

let adminToken = localStorage.getItem('admin_token');

async function adminFetch(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + adminToken,
      ...(opts.headers || {})
    }
  });
  if (r.status === 401 || r.status === 403) {
    localStorage.removeItem('admin_token');
    location.href = 'dashboard.html';
    throw new Error('Session expired');
  }
  return r.json();
}

async function adminLogin(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Login failed');
  if (!data.user || data.user.role !== 'admin') throw new Error('Admin access required');
  adminToken = data.accessToken;
  localStorage.setItem('admin_token', adminToken);
  localStorage.setItem('admin_email', data.user.email);
  return data;
}

function adminLogout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_email');
  location.href = 'dashboard.html';
}

function fmt(n) { return new Intl.NumberFormat().format(n || 0); }
function fmtMoney(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString() : '—'; }

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function requireAdminAuth(bootstrapFn) {
  if (adminToken) {
    bootstrapFn();
  } else {
    const gate = document.getElementById('auth-gate');
    if (gate) gate.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    const pwInput = document.getElementById('login-password');
    if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  try {
    await adminLogin(email, password);
    location.reload();
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  }
}

function handleLogout() { adminLogout(); }
