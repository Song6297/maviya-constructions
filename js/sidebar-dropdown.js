// Sidebar Dashboard Dropdown Module
// Provides expandable project list in sidebar across all pages

import Storage from './firebase-storage.js';
import { auth, onAuthStateChanged } from './firebase-config.js';

// Initialize the sidebar dropdown
async function initSidebarDropdown() {
    const dropdown = document.getElementById('dashboardDropdown');
    if (!dropdown) return;
    
    // Load projects when auth is ready
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadSidebarProjects();
        }
    });
}

// Toggle dropdown open/close
function toggleDashboardDropdown(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropdown = document.getElementById('dashboardDropdown');
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

// Load projects into sidebar dropdown
async function loadSidebarProjects() {
    try {
        const projects = await Storage.projects.getAll();
        const container = document.getElementById('sidebarProjectsList');
        if (!container) return;
        
        const currentProjectId = new URLSearchParams(window.location.search).get('id');
        
        if (!projects || projects.length === 0) {
            container.innerHTML = `
                <div class="nav-dropdown-item" style="color: #95a5a6; font-style: italic;">
                    <i class="fas fa-folder-open"></i>
                    <span>No projects yet</span>
                </div>`;
            return;
        }
        
        // Sort projects by name
        const sortedProjects = projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        container.innerHTML = sortedProjects.slice(0, 10).map(p => `
            <a href="project.html?id=${p.id}" class="nav-dropdown-item ${p.id === currentProjectId ? 'active' : ''}">
                <i class="fas fa-hard-hat"></i>
                <span>${escapeHtml(p.name || 'Unnamed Project')}</span>
            </a>
        `).join('');
        
        if (projects.length > 10) {
            container.innerHTML += `
                <a href="index.html" class="nav-dropdown-item" style="color: var(--primary, #4A7C59); font-weight: 600;">
                    <i class="fas fa-ellipsis-h"></i>
                    <span>View all ${projects.length} projects...</span>
                </a>`;
        }
    } catch (error) {
        console.error('Error loading sidebar projects:', error);
        const container = document.getElementById('sidebarProjectsList');
        if (container) {
            container.innerHTML = `
                <div class="nav-dropdown-item" style="color: #e74c3c;">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Error loading projects</span>
                </div>`;
        }
    }
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('dashboardDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

// Export functions
window.toggleDashboardDropdown = toggleDashboardDropdown;
window.loadSidebarProjects = loadSidebarProjects;

export { initSidebarDropdown, toggleDashboardDropdown, loadSidebarProjects };
