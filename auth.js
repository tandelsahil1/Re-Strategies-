// auth.js - Authentication UI and management
import {
  signIn, signUp, signOut,
  getCurrentUser, onAuthStateChange,
  getUserProfile
} from './supabase.js';

let currentUser = null;
let currentProfile = null;

export async function initAuth() {
  try {
    currentUser = await getCurrentUser();
    if (currentUser) {
      const { data } = await getUserProfile();
      currentProfile = data;
    }
    onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        const { data } = await getUserProfile();
        currentProfile = data;
        updateAuthUI();
        hideAuthModal();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentProfile = null;
        updateAuthUI();
      }
    });
    updateAuthUI();
  } catch (e) {
    console.warn('Auth init error:', e.message);
  }
  return currentUser;
}

export function getCurrentUserData() {
  return { user: currentUser, profile: currentProfile };
}

export function isLoggedIn() {
  return !!currentUser;
}

export function createAuthUI() {
  const existing = document.getElementById('authModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-backdrop" id="authBackdrop"></div>
    <div class="auth-card">
      <button class="auth-close" id="authCloseBtn" title="Close">✕</button>
      <div class="auth-header">
        <div class="auth-logo">🏢</div>
        <h2 class="auth-title">Lindner LCA Tool</h2>
        <p class="auth-subtitle">Professional Building CO₂ Calculator</p>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" id="loginTabBtn">Sign In</button>
        <button class="auth-tab" id="signupTabBtn">Create Account</button>
      </div>
      <form class="auth-form" id="loginForm">
        <div class="auth-field">
          <label class="auth-label">Email</label>
          <input type="email" id="loginEmail" class="auth-input"
                 placeholder="your@email.com" required autocomplete="email" />
        </div>
        <div class="auth-field">
          <label class="auth-label">Password</label>
          <input type="password" id="loginPassword" class="auth-input"
                 placeholder="Enter your password" required autocomplete="current-password" />
        </div>
        <div class="auth-error" id="loginError"></div>
        <button type="submit" class="auth-btn" id="loginBtn">
          <span class="auth-btn-text">Sign In</span>
          <span class="auth-btn-loader" style="display:none;">⏳ Signing in...</span>
        </button>
        <p class="auth-hint">Use your Lindner email address</p>
      </form>
      <form class="auth-form" id="signupForm" style="display:none;">
        <div class="auth-field">
          <label class="auth-label">Full Name</label>
          <input type="text" id="signupName" class="auth-input"
                 placeholder="Your full name" required autocomplete="name" />
        </div>
        <div class="auth-field">
          <label class="auth-label">Email</label>
          <input type="email" id="signupEmail" class="auth-input"
                 placeholder="your@lindner-group.com" required autocomplete="email" />
        </div>
        <div class="auth-field">
          <label class="auth-label">Password</label>
          <input type="password" id="signupPassword" class="auth-input"
                 placeholder="Min. 8 characters" required
                 minlength="8" autocomplete="new-password" />
        </div>
        <div class="auth-field">
          <label class="auth-label">Confirm Password</label>
          <input type="password" id="signupConfirm" class="auth-input"
                 placeholder="Repeat password" required autocomplete="new-password" />
        </div>
        <div class="auth-error" id="signupError"></div>
        <button type="submit" class="auth-btn" id="signupBtn">
          <span class="auth-btn-text">Create Account</span>
          <span class="auth-btn-loader" style="display:none;">⏳ Creating...</span>
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('authBackdrop')?.addEventListener('click', hideAuthModal);
  document.getElementById('authCloseBtn')?.addEventListener('click', hideAuthModal);
  document.getElementById('loginTabBtn')?.addEventListener('click', () => switchTab('login'));
  document.getElementById('signupTabBtn')?.addEventListener('click', () => switchTab('signup'));
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('signupForm')?.addEventListener('submit', handleSignup);
}

function switchTab(tab) {
  const loginTab = document.getElementById('loginTabBtn');
  const signupTab = document.getElementById('signupTabBtn');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  if (tab === 'login') {
    loginTab?.classList.add('active');
    signupTab?.classList.remove('active');
    if (loginForm) loginForm.style.display = 'flex';
    if (signupForm) signupForm.style.display = 'none';
  } else {
    signupTab?.classList.add('active');
    loginTab?.classList.remove('active');
    if (signupForm) signupForm.style.display = 'flex';
    if (loginForm) loginForm.style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const error = document.getElementById('loginError');

  btn.querySelector('.auth-btn-text').style.display = 'none';
  btn.querySelector('.auth-btn-loader').style.display = 'inline';
  btn.disabled = true;
  error.textContent = '';

  const { data, error: authError } = await signIn(email, password);

  btn.querySelector('.auth-btn-text').style.display = 'inline';
  btn.querySelector('.auth-btn-loader').style.display = 'none';
  btn.disabled = false;

  if (authError) {
    error.textContent = authError.message === 'Invalid login credentials'
      ? '❌ Wrong email or password. Please try again.'
      : `❌ ${authError.message}`;
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const btn = document.getElementById('signupBtn');
  const error = document.getElementById('signupError');

  error.textContent = '';

  if (password !== confirm) {
    error.textContent = '❌ Passwords do not match.';
    return;
  }
  if (password.length < 8) {
    error.textContent = '❌ Password must be at least 8 characters.';
    return;
  }

  btn.querySelector('.auth-btn-text').style.display = 'none';
  btn.querySelector('.auth-btn-loader').style.display = 'inline';
  btn.disabled = true;

  const { data, error: authError } = await signUp(email, password, name);

  btn.querySelector('.auth-btn-text').style.display = 'inline';
  btn.querySelector('.auth-btn-loader').style.display = 'none';
  btn.disabled = false;

  if (authError) {
    error.textContent = `❌ ${authError.message}`;
  } else {
    error.style.color = '#79f5dc';
    error.textContent = '✅ Account created! You are now logged in.';
  }
}

export function showAuthModal() {
  if (!document.getElementById('authModal')) createAuthUI();
  setTimeout(() => {
    const m = document.getElementById('authModal');
    if (m) m.classList.add('visible');
  }, 10);
}

export function hideAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('visible');
}

function updateAuthUI() {
  const btn = document.getElementById('authUserBtn');
  if (!btn) return;

  if (currentUser) {
    const name = currentProfile?.full_name || currentUser.email?.split('@')[0] || 'User';
    btn.innerHTML = `
      <span class="auth-user-avatar">${name.charAt(0).toUpperCase()}</span>
      <span class="auth-user-name">${name}</span>
      <span class="auth-user-chevron">▾</span>
    `;
    btn.classList.add('logged-in');

    const nameEl = document.getElementById('dropdownName');
    const emailEl = document.getElementById('dropdownEmail');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = currentUser.email || '';
  } else {
    btn.innerHTML = '🔐 Sign In';
    btn.classList.remove('logged-in');
  }
}
