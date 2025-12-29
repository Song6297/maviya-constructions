// Authentication Check for Protected Pages
// Include this in all pages that require authentication

import Auth from './auth.js';

// Check if user is authenticated
Auth.init();

// Wait for auth state to be determined
const checkAuth = new Promise((resolve) => {
    const unsubscribe = Auth.auth.onAuthStateChanged((user) => {
        if (user) {
            resolve(true);
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
        }
        unsubscribe();
    });
});

export default checkAuth;
