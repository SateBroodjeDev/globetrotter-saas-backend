const shareToken = window.location.pathname.split('/').filter(Boolean).pop();
const visitorIdKey = `globetrotter-share-visitor:${shareToken}`;
const visitorId = localStorage.getItem(visitorIdKey) || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `visitor-${Date.now()}`);
localStorage.setItem(visitorIdKey, visitorId);

let currentShare = null;
let maxScrollDepth = 0;
let timeSpentSeconds = 0;

function formatDateRange(startDate, endDate) {
  const start = startDate ? new Date(startDate).toLocaleDateString() : '—';
  const end = endDate ? new Date(endDate).toLocaleDateString() : '—';
  return `${start} – ${end}`;
}

function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount || 0));
}

function setError(message) {
  document.getElementById('content').classList.add('hidden');
  const errorState = document.getElementById('error-state');
  errorState.textContent = message;
  errorState.classList.remove('hidden');
}

function renderMembers(members = []) {
  const el = document.getElementById('members-list');
  el.innerHTML = members.length
    ? members.map((member) => `
      <div class="flex items-center gap-3 rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3">
        <div class="w-11 h-11 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-sm font-semibold">
          ${member.avatar ? `<img src="${member.avatar}" alt="${member.firstName || 'Traveller'}" class="w-full h-full object-cover">` : (member.firstName || '?').slice(0, 1)}
        </div>
        <div>
          <p class="font-medium">${member.firstName || ''} ${member.lastName || ''}</p>
          <p class="text-xs text-slate-400">Trip member</p>
        </div>
      </div>
    `).join('')
    : '<p class="text-sm text-slate-400">No members available.</p>';
}

function renderExpenses(trip) {
  const summary = trip.expenseSummary || { totalSpent: 0, expenseCount: 0, byCategory: [] };
  document.getElementById('expense-total').textContent = formatCurrency(summary.totalSpent);
  document.getElementById('expense-count').textContent = summary.expenseCount;
  document.getElementById('expense-mode').textContent = trip.expenses?.length ? 'Detailed expenses visible' : 'Summary only';

  const categoryEl = document.getElementById('expense-categories');
  categoryEl.innerHTML = summary.byCategory.length
    ? summary.byCategory.map((item) => `
      <div class="rounded-2xl bg-slate-800 border border-slate-700 p-4">
        <p class="text-xs uppercase tracking-wide text-slate-400">${item.category}</p>
        <p class="text-lg font-semibold mt-1">${formatCurrency(item.amount)}</p>
      </div>
    `).join('')
    : '<p class="text-sm text-slate-400 sm:col-span-2">No expense categories available yet.</p>';

  const expenseListEl = document.getElementById('expenses-list');
  if (!trip.expenses?.length) {
    expenseListEl.innerHTML = '<div class="rounded-2xl bg-slate-800 border border-slate-700 p-4 text-sm text-slate-400">Detailed expense entries are hidden for this shared trip.</div>';
    return;
  }

  expenseListEl.innerHTML = trip.expenses.map((expense) => `
    <div class="flex items-center justify-between gap-4 rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3">
      <div>
        <p class="font-medium">${expense.description}</p>
        <p class="text-xs text-slate-400">${expense.category} • ${new Date(expense.date).toLocaleDateString()}</p>
      </div>
      <p class="font-semibold text-sky-300">${formatCurrency(expense.amount)}</p>
    </div>
  `).join('');
}

function renderTimeline(days = []) {
  const el = document.getElementById('timeline-list');
  el.innerHTML = days.length
    ? days.map((day) => `
      <div class="rounded-2xl border border-slate-700 bg-slate-800 p-4">
        <div class="flex items-center justify-between gap-3 mb-2">
          <p class="font-semibold">${new Date(day.date).toLocaleDateString()}</p>
          <span class="text-sm text-slate-400">${day.location || 'Location TBA'}</span>
        </div>
        ${(day.activities || []).length ? `<ul class="list-disc pl-5 text-sm text-slate-300 space-y-1">${day.activities.map((activity) => `<li>${activity}</li>`).join('')}</ul>` : '<p class="text-sm text-slate-400">No activities added.</p>'}
        ${day.notes ? `<p class="text-sm text-slate-300 mt-3">${day.notes}</p>` : ''}
      </div>
    `).join('')
    : '<p class="text-sm text-slate-400">No itinerary timeline has been added yet.</p>';
}

function renderBookings(bookings = []) {
  const el = document.getElementById('bookings-list');
  el.innerHTML = bookings.length
    ? bookings.map((booking) => `
      <div class="rounded-2xl border border-slate-700 bg-slate-800 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-medium">${booking.provider}</p>
            <p class="text-xs text-slate-400">${booking.type} • ${new Date(booking.date).toLocaleDateString()}${booking.location ? ` • ${booking.location}` : ''}</p>
          </div>
          <span class="text-sm font-semibold">${formatCurrency(booking.price, booking.currency || 'EUR')}</span>
        </div>
        ${booking.bookingReference ? `<p class="text-xs text-slate-400 mt-2">Reference: ${booking.bookingReference}</p>` : ''}
        ${booking.document ? `<p class="text-xs text-slate-400 mt-1 break-all">Document: ${booking.document}</p>` : ''}
        ${booking.notes ? `<p class="text-sm text-slate-300 mt-2">${booking.notes}</p>` : ''}
      </div>
    `).join('')
    : '<p class="text-sm text-slate-400">No bookings shared yet.</p>';
}

function renderComments(comments = []) {
  document.getElementById('trip-comments-count').textContent = comments.length;
  document.getElementById('comments-approved-count').textContent = `${comments.length} approved`;
  const el = document.getElementById('comments-list');
  el.innerHTML = comments.length
    ? comments.map((comment) => `
      <article class="rounded-2xl border border-slate-700 bg-slate-800 p-4">
        <div class="flex items-center justify-between gap-3 mb-2">
          <p class="font-medium">${comment.visitorName}</p>
          <span class="text-xs text-slate-400">${new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
        <p class="text-slate-300 whitespace-pre-wrap">${comment.comment}</p>
      </article>
    `).join('')
    : '<p class="text-sm text-slate-400">No approved comments yet.</p>';
}

async function loadComments() {
  const response = await fetch(`/api/public/trips/${shareToken}/comments`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Failed to load comments');
  }
  renderComments(data.comments || []);
}

async function loadPublicTrip() {
  try {
    const response = await fetch(`/api/trips/public/${shareToken}`, {
      headers: {
        'x-visitor-id': visitorId
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || data.error || 'Trip not found or has expired');
    }

    currentShare = data.share;
    const trip = data.trip;

    document.title = `${trip.title} – Globetrotter`;
    document.getElementById('trip-title').textContent = trip.title;
    document.getElementById('share-message').textContent = currentShare.message || trip.description || '';
    document.getElementById('trip-description').textContent = trip.description || 'No description provided.';
    document.getElementById('trip-dates').textContent = formatDateRange(trip.startDate, trip.endDate);
    document.getElementById('trip-budget').textContent = formatCurrency(trip.budget || 0, trip.currency || 'EUR');
    document.getElementById('trip-views').textContent = currentShare.viewCount || 0;
    document.getElementById('share-visibility').textContent = currentShare.visibility;
    document.getElementById('share-expenses').textContent = currentShare.hideExpenseDetails ? 'Summary only' : 'Visible';
    document.getElementById('share-expires').textContent = currentShare.expiresAt ? new Date(currentShare.expiresAt).toLocaleString() : 'Never';

    if (trip.coverImage) {
      document.getElementById('cover').style.backgroundImage = `url(${trip.coverImage})`;
      document.getElementById('cover').style.backgroundSize = 'cover';
      document.getElementById('cover').style.backgroundPosition = 'center';
    }

    renderMembers(trip.members);
    renderExpenses(trip);
    renderTimeline(trip.days);
    renderBookings(trip.bookings);
    renderComments(trip.comments || []);

    if (currentShare.allowComments) {
      document.getElementById('comments-section').classList.remove('hidden');
      await loadComments();
    } else {
      document.getElementById('comments-section').classList.add('hidden');
    }

    document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Check out ${trip.title}`)}`;
    document.getElementById('share-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`Check out this trip: ${window.location.href}`)}`;
    document.getElementById('content').classList.remove('hidden');
    document.getElementById('error-state').classList.add('hidden');
  } catch (error) {
    setError(error.message);
  }
}

async function submitComment(event) {
  event.preventDefault();

  const name = document.getElementById('visitor-name').value.trim();
  const email = document.getElementById('visitor-email').value.trim();
  const comment = document.getElementById('comment-text').value.trim();
  const feedback = document.getElementById('comment-feedback');

  if (!name || !comment) {
    feedback.textContent = 'Please enter your name and comment.';
    return;
  }

  try {
    feedback.textContent = 'Submitting your comment…';
    const response = await fetch(`/api/public/trips/${shareToken}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: name, visitorEmail: email || null, comment })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || data.error || 'Failed to submit comment');
    }

    document.getElementById('visitor-name').value = '';
    document.getElementById('visitor-email').value = '';
    document.getElementById('comment-text').value = '';
    feedback.textContent = data.message || 'Comment submitted for review.';
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function reportEngagement() {
  const payload = JSON.stringify({
    visitorId,
    timeSpentSeconds,
    scrollDepth: maxScrollDepth
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(`/api/public/trips/${shareToken}/engagement`, new Blob([payload], { type: 'application/json' }));
    return;
  }

  fetch(`/api/public/trips/${shareToken}/engagement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-visitor-id': visitorId
    },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

document.getElementById('copy-link-button').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    document.getElementById('copy-link-button').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('copy-link-button').textContent = 'Copy link';
    }, 1500);
  } catch {
    window.prompt('Copy this link', window.location.href);
  }
});

document.getElementById('comment-form').addEventListener('submit', submitComment);

window.addEventListener('scroll', () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  maxScrollDepth = scrollable > 0
    ? Math.max(maxScrollDepth, Math.round((window.scrollY / scrollable) * 100))
    : 100;
});

setInterval(() => {
  timeSpentSeconds += 1;
}, 1000);

window.addEventListener('beforeunload', reportEngagement);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    reportEngagement();
  }
});
document.addEventListener('DOMContentLoaded', loadPublicTrip);
