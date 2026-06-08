// projectManager.js - Handles project save/load/management
import { saveProject, loadProjects, loadProject, deleteProject, getCurrentUser } from './supabase.js';

let currentProjectId = null;
let autoSaveTimer = null;
let lastSaveHash = null;
let isSaving = false;
const AUTO_SAVE_DELAY = 5000;

export function setCurrentProjectId(id) {
  currentProjectId = id;
}

export function getCurrentProjectId() {
  return currentProjectId;
}

export function triggerAutoSave(buildingData) {
  getCurrentUser().then(user => {
    if (!user) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    showSaveIndicator('saving');
    autoSaveTimer = setTimeout(() => {
      performSave(buildingData);
    }, AUTO_SAVE_DELAY);
  }).catch(() => {});
}

async function performSave(buildingData) {
  if (isSaving) return;
  const hash = JSON.stringify(buildingData).length.toString();
  if (hash === lastSaveHash) {
    hideSaveIndicator();
    return;
  }
  isSaving = true;
  showSaveIndicator('saving');
  try {
    const storedId = localStorage.getItem('lindner-current-project-id');
    const { data, error } = await saveProject(buildingData, storedId || currentProjectId || null);
    if (error) {
      showSaveIndicator('error');
      setTimeout(hideSaveIndicator, 3000);
    } else if (data) {
      currentProjectId = data.id;
      lastSaveHash = hash;
      localStorage.setItem('lindner-current-project-id', data.id);
      showSaveIndicator('saved');
      setTimeout(hideSaveIndicator, 2000);
    }
  } catch (err) {
    showSaveIndicator('error');
    setTimeout(hideSaveIndicator, 3000);
  } finally {
    isSaving = false;
  }
}

export async function manualSave(buildingData) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  return await performSave(buildingData);
}

export async function loadProjectById(projectId) {
  showLoadingOverlay('Loading project...');
  try {
    const { data, error } = await loadProject(projectId);
    hideLoadingOverlay();
    if (error || !data) {
      alert('Failed to load project. Please try again.');
      return null;
    }
    currentProjectId = projectId;
    localStorage.setItem('lindner-current-project-id', projectId);
    return data.building_data;
  } catch (e) {
    hideLoadingOverlay();
    return null;
  }
}

export function getLastProjectId() {
  return localStorage.getItem('lindner-current-project-id');
}

export async function showProjectsModal() {
  const user = await getCurrentUser();
  if (!user) {
    alert('Please sign in to see your projects.');
    return;
  }

  const { data: projects } = await loadProjects();

  const existing = document.getElementById('projectsModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'projectsModal';
  modal.className = 'projects-modal';
  modal.innerHTML = `
    <div class="projects-modal-backdrop" id="projectsModalBackdrop"></div>
    <div class="projects-modal-card">
      <div class="projects-modal-header">
        <h3 class="projects-modal-title">📂 My Projects</h3>
        <button class="projects-modal-close" id="projectsModalClose">✕</button>
      </div>
      <div class="projects-modal-body">
        ${!projects || projects.length === 0
          ? `<div class="projects-empty">
               <div class="projects-empty-icon">📭</div>
               <div style="font-size:0.95rem;font-weight:700;color:#eaf0ff;">No saved projects yet</div>
               <div style="color:var(--muted);font-size:0.8rem;margin-top:8px;">
                 Build a room and click Save Project to get started
               </div>
             </div>`
          : `<div class="projects-list-modal">
               ${projects.map(p => `
                 <div class="project-card" data-id="${p.id}">
                   <div class="project-card-info">
                     <div class="project-card-name">${escapeHtml(p.name)}</div>
                     <div class="project-card-meta">
                       ${p.description ? `<span>${escapeHtml(p.description)}</span> • ` : ''}
                       <span>Updated ${formatDate(p.updated_at)}</span>
                     </div>
                   </div>
                   <div style="display:flex;gap:6px;flex-shrink:0;">
                     <button class="project-load-btn btn" data-id="${p.id}">Open →</button>
                     <button class="project-delete-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete">🗑️</button>
                   </div>
                 </div>
               `).join('')}
             </div>`
        }
      </div>
      <div class="projects-modal-footer">
        <button class="btn" id="projectsModalNewBtn">+ New Project</button>
        <button class="btn" id="projectsModalClose2">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  const closeModal = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 300);
  };

  document.getElementById('projectsModalBackdrop')?.addEventListener('click', closeModal);
  document.getElementById('projectsModalClose')?.addEventListener('click', closeModal);
  document.getElementById('projectsModalClose2')?.addEventListener('click', closeModal);

  // New project
  document.getElementById('projectsModalNewBtn')?.addEventListener('click', () => {
    closeModal();
    const hasSavedId = !!localStorage.getItem('lindner-current-project-id');
    const msg = hasSavedId
      ? 'Create a new project?\n\nYour current work is saved and will still be in "My Projects".'
      : 'Create a new project?\n\nYour current work is NOT saved yet!';
    if (confirm(msg)) {
      currentProjectId = null;
      localStorage.removeItem('lindner-current-project-id');
      localStorage.removeItem('lindner-project');
      window.location.reload();
    }
  });

  // Load project buttons
  modal.querySelectorAll('.project-load-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.textContent = '⏳';
      btn.disabled = true;
      closeModal();
      const projectData = await loadProjectById(id);
      if (projectData) {
        if (window.loadProjectData) {
          window.loadProjectData(projectData);
        } else {
          localStorage.setItem('lindner-load-project', JSON.stringify(projectData));
          window.location.reload();
        }
      }
    });
  });

  // Delete project buttons
  modal.querySelectorAll('.project-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;

      btn.textContent = '⏳';
      btn.disabled = true;

      const { error } = await deleteProject(id);
      if (error) {
        btn.textContent = '❌';
        setTimeout(() => { btn.textContent = '🗑️'; btn.disabled = false; }, 2000);
      } else {
        const card = btn.closest('.project-card');
        if (card) {
          card.style.transition = 'all 0.3s ease';
          card.style.opacity = '0';
          card.style.transform = 'translateX(-20px)';
          setTimeout(() => card.remove(), 300);
        }
        if (localStorage.getItem('lindner-current-project-id') === id) {
          localStorage.removeItem('lindner-current-project-id');
          currentProjectId = null;
        }
      }
    });
  });
}

function showSaveIndicator(state) {
  let indicator = document.getElementById('saveIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'saveIndicator';
    indicator.className = 'save-indicator';
    document.body.appendChild(indicator);
  }
  const messages = {
    saving: '⏳ Saving...',
    saved: '✅ Saved',
    error: '⚠️ Save failed'
  };
  indicator.className = `save-indicator ${state}`;
  indicator.textContent = messages[state] || '';
  indicator.style.opacity = '1';
}

function hideSaveIndicator() {
  const indicator = document.getElementById('saveIndicator');
  if (indicator) indicator.style.opacity = '0';
}

function showLoadingOverlay(message) {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="loading-overlay-content">
      <div style="width:40px;height:40px;border:3px solid rgba(94,167,255,0.2);border-top-color:#5ea7ff;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="margin-top:16px;font-size:1rem;font-weight:700;">${message}</div>
    </div>
  `;
  overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return '';
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
