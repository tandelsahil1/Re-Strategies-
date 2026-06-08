// profile.js - User profile settings modal
import { getSupabase, getCurrentUser, getUserProfile } from './supabase.js';

export async function showProfileModal() {
  const user = await getCurrentUser();
  if (!user) {
    alert('Please sign in to view your profile.');
    return;
  }

  const { data: profile } = await getUserProfile();

  const existing = document.getElementById('profileModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'profileModal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-backdrop" id="profileBackdrop"></div>
    <div class="auth-card" style="max-width:480px;">
      <button class="auth-close" id="profileClose">✕</button>
      <div class="auth-header">
        <div class="auth-logo">👤</div>
        <h2 class="auth-title">Profile Settings</h2>
        <p class="auth-subtitle">${escapeHtml(user.email || '')}</p>
      </div>
      <form class="auth-form" id="profileForm">
        <div class="auth-field">
          <label class="auth-label">Full Name</label>
          <input type="text" id="profileName" class="auth-input"
                 value="${escapeHtml(profile?.full_name || '')}"
                 placeholder="Your full name" />
        </div>
        <div class="auth-field">
          <label class="auth-label">Company</label>
          <input type="text" id="profileCompany" class="auth-input"
                 value="${escapeHtml(profile?.company || 'Lindner Group')}"
                 placeholder="Company name" />
        </div>
        <div class="auth-field">
          <label class="auth-label">Role</label>
          <select id="profileRole" class="auth-input">
            <option value="architect" ${profile?.role === 'architect' ? 'selected' : ''}>Architect</option>
            <option value="engineer" ${profile?.role === 'engineer' ? 'selected' : ''}>Engineer</option>
            <option value="project_manager" ${profile?.role === 'project_manager' ? 'selected' : ''}>Project Manager</option>
            <option value="sustainability" ${profile?.role === 'sustainability' ? 'selected' : ''}>Sustainability Consultant</option>
            <option value="user" ${(!profile?.role || profile?.role === 'user') ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;margin-top:4px;">
          <div class="auth-label" style="margin-bottom:10px;">Language Preference</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button type="button" class="lang-btn ${(profile?.preferences?.language || 'en') === 'en' ? 'active' : ''}" data-lang="en">
              🇬🇧 English
            </button>
            <button type="button" class="lang-btn ${profile?.preferences?.language === 'de' ? 'active' : ''}" data-lang="de">
              🇩🇪 Deutsch
            </button>
          </div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;margin-top:4px;">
          <div class="auth-label" style="margin-bottom:6px;">Account Info</div>
          <div style="font-size:0.8rem;color:var(--muted);padding:6px 0;">
            Email: <strong style="color:#eaf0ff;">${escapeHtml(user.email || '')}</strong>
          </div>
          <div style="font-size:0.8rem;color:var(--muted);padding:4px 0;">
            Member since: <strong style="color:#eaf0ff;">${formatJoinDate(user.created_at)}</strong>
          </div>
        </div>
        <div class="auth-error" id="profileError"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
          <button type="button" class="btn" id="profileCancel">Cancel</button>
          <button type="submit" class="auth-btn">
            <span id="profileSaveText">Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  let selectedLang = profile?.preferences?.language || 'en';

  // Language toggle
  modal.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLang = btn.dataset.lang;
    });
  });

  const closeModal = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 300);
  };

  document.getElementById('profileBackdrop')?.addEventListener('click', closeModal);
  document.getElementById('profileClose')?.addEventListener('click', closeModal);
  document.getElementById('profileCancel')?.addEventListener('click', closeModal);

  // Save profile
  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveText = document.getElementById('profileSaveText');
    const errorEl = document.getElementById('profileError');

    saveText.textContent = '⏳ Saving...';
    errorEl.textContent = '';

    try {
      const supabase = await getSupabase();
      if (!supabase) throw new Error('Not connected');

      const newName = document.getElementById('profileName').value.trim();
      const newCompany = document.getElementById('profileCompany').value.trim();
      const newRole = document.getElementById('profileRole').value;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: newName,
          company: newCompany,
          role: newRole,
          preferences: {
            ...(profile?.preferences || {}),
            language: selectedLang
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        errorEl.textContent = '❌ Failed to save. Please try again.';
        saveText.textContent = 'Save Changes';
      } else {
        saveText.textContent = '✅ Saved!';

        // Update name in header button
        const nameEl = document.querySelector('.auth-user-name');
        const avatarEl = document.querySelector('.auth-user-avatar');
        if (nameEl && newName) nameEl.textContent = newName;
        if (avatarEl && newName) avatarEl.textContent = newName.charAt(0).toUpperCase();

        // Update dropdown
        const dropdownName = document.getElementById('dropdownName');
        if (dropdownName && newName) dropdownName.textContent = newName;

        setTimeout(closeModal, 1200);
      }
    } catch (err) {
      errorEl.textContent = '❌ Connection error. Please try again.';
      saveText.textContent = 'Save Changes';
    }
  });
}

function formatJoinDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return '—';
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
