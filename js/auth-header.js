// Auth Header Component - Add to all pages
// This adds user menu and logout functionality

import Auth from './auth.js';

export function initAuthHeader(options = {}) {
    const { requireAuth = false } = options;
    
    // Initialize auth
    Auth.init();
    
    // Only check authentication if required
    if (requireAuth) {
        setTimeout(() => {
            const user = Auth.getCurrentUser();
            if (!user) {
                // Redirect to login if not authenticated
                window.location.href = 'login.html';
                return;
            }
            
            // Display user email
            const email = Auth.getEmail();
            const userEmailDisplay = document.getElementById('userEmailDisplay');
            const userEmailFull = document.getElementById('userEmailFull');
            
            if (userEmailDisplay) userEmailDisplay.textContent = email;
            if (userEmailFull) userEmailFull.textContent = email;
        }, 500);
    } else {
        // Just display email if logged in, don't redirect
        setTimeout(() => {
            const user = Auth.getCurrentUser();
            if (user) {
                const email = Auth.getEmail();
                const userEmailDisplay = document.getElementById('userEmailDisplay');
                const userEmailFull = document.getElementById('userEmailFull');
                
                if (userEmailDisplay) userEmailDisplay.textContent = email;
                if (userEmailFull) userEmailFull.textContent = email;
            }
        }, 500);
    }
    
    // User menu toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (userMenuBtn && userMenu) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('hidden');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', () => {
            userMenu.classList.add('hidden');
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                const result = await Auth.logout();
                if (result.success) {
                    window.location.href = 'login.html';
                }
            }
        });
    }
}
