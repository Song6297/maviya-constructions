// Authentication Logic

import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from './firebase-config.js';

const Auth = {
    currentUser: null,

    init() {
        // Check authentication state
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.onAuthSuccess();
            } else {
                this.currentUser = null;
                this.onAuthRequired();
            }
        });
    },

    onAuthSuccess() {
        // Hide login page, show app
        const loginPage = document.getElementById('loginPage');
        const appContent = document.getElementById('appContent');
        
        if (loginPage) loginPage.classList.add('hidden');
        if (appContent) appContent.classList.remove('hidden');
        
        // Store user info
        if (this.currentUser) {
            localStorage.setItem('userEmail', this.currentUser.email);
            localStorage.setItem('userId', this.currentUser.uid);
        }
    },

    onAuthRequired() {
        // Show login page, hide app
        const loginPage = document.getElementById('loginPage');
        const appContent = document.getElementById('appContent');
        
        if (loginPage) loginPage.classList.remove('hidden');
        if (appContent) appContent.classList.add('hidden');
        
        // Clear user info
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
    },

    async signUp(email, password) {
        try {
            console.log('📧 Creating account for:', email);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            this.currentUser = userCredential.user;
            console.log('✅ Account created successfully');
            return { success: true, message: 'Account created successfully!', user: userCredential.user };
        } catch (error) {
            console.error('❌ Error creating account:', error);
            
            let message = 'Failed to create account. ';
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Please login instead.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address.';
            } else if (error.code === 'auth/weak-password') {
                message = 'Password should be at least 6 characters.';
            } else {
                message += error.message;
            }
            
            return { success: false, message };
        }
    },

    async login(email, password) {
        try {
            console.log('🔐 Logging in:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            this.currentUser = userCredential.user;
            console.log('✅ Login successful');
            return { success: true, message: 'Login successful!', user: userCredential.user };
        } catch (error) {
            console.error('❌ Error logging in:', error);
            
            let message = 'Failed to login. ';
            if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email. Please sign up first.';
            } else if (error.code === 'auth/wrong-password') {
                message = 'Incorrect password. Please try again.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address.';
            } else if (error.code === 'auth/user-disabled') {
                message = 'This account has been disabled.';
            } else if (error.code === 'auth/invalid-credential') {
                message = 'Invalid email or password.';
            } else {
                message += error.message;
            }
            
            return { success: false, message };
        }
    },

    async resetPassword(email) {
        try {
            console.log('📧 Sending password reset email to:', email);
            await sendPasswordResetEmail(auth, email);
            console.log('✅ Password reset email sent');
            return { success: true, message: 'Password reset email sent! Check your inbox.' };
        } catch (error) {
            console.error('❌ Error sending reset email:', error);
            
            let message = 'Failed to send reset email. ';
            if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email.';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Invalid email address.';
            } else {
                message += error.message;
            }
            
            return { success: false, message };
        }
    },

    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            return { success: true, message: 'Logged out successfully!' };
        } catch (error) {
            console.error('Error logging out:', error);
            return { success: false, message: 'Failed to logout.' };
        }
    },

    getCurrentUser() {
        return this.currentUser;
    },

    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    },

    getEmail() {
        return this.currentUser ? this.currentUser.email : null;
    }
};

export default Auth;
