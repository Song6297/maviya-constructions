// User Preferences & Role Management Module
// Handles Resume Work and Role-Based View features

import { db, doc, setDoc, getDoc, serverTimestamp, auth } from './firebase-config.js';

// Role definitions with their permissions and UI emphasis
const ROLE_CONFIG = {
    owner: {
        name: 'Owner',
        icon: '👑',
        color: '#FFB84D',
        emphasis: ['projects', 'finance', 'vendors'],
        primaryActions: [
            { label: 'Open Dashboard', href: 'dashboard.html', icon: 'fa-th-large', color: 'blueprint' },
            { label: 'View Finance', href: 'funds.html', icon: 'fa-wallet', color: 'mint' },
            { label: 'Compare Projects', href: 'compare.html', icon: 'fa-chart-bar', color: 'orange' }
        ],
        quickStats: ['totalBudget', 'pendingPayments', 'activeProjects']
    },
    engineer: {
        name: 'Engineer',
        icon: '👷',
        color: '#5B9BD5',
        emphasis: ['projects', 'materials'],
        primaryActions: [
            { label: 'View Projects', href: 'dashboard.html', icon: 'fa-clipboard-list', color: 'blueprint' },
            { label: 'Update Project', href: 'dashboard.html', icon: 'fa-edit', color: 'orange' },
            { label: 'View Materials', href: 'materials.html', icon: 'fa-boxes', color: 'mint' }
        ],
        quickStats: ['activeProjects', 'materialsUsed', 'pendingTasks']
    },
    accountant: {
        name: 'Accountant',
        icon: '📊',
        color: '#7FD8BE',
        emphasis: ['finance', 'payments', 'vendors'],
        primaryActions: [
            { label: 'Record Payment', href: 'payments.html', icon: 'fa-credit-card', color: 'mint' },
            { label: 'View Ledger', href: 'funds.html', icon: 'fa-book', color: 'blueprint' },
            { label: 'Export Reports', href: 'compare.html', icon: 'fa-file-export', color: 'orange' }
        ],
        quickStats: ['pendingPayments', 'totalExpenses', 'vendorDues']
    },
    supervisor: {
        name: 'Supervisor',
        icon: '🔧',
        color: '#FF8C61',
        emphasis: ['labour', 'materials', 'attendance'],
        primaryActions: [
            { label: 'View Projects', href: 'dashboard.html', icon: 'fa-hard-hat', color: 'orange' },
            { label: 'Add Material', href: 'materials.html', icon: 'fa-plus-circle', color: 'mint' },
            { label: 'Track Stock', href: 'materials.html', icon: 'fa-boxes', color: 'blueprint' }
        ],
        quickStats: ['todayAttendance', 'materialsToday', 'activeWorkers']
    }
};

const UserPreferences = {
    // Cache for user data
    _cache: {
        preferences: null,
        role: null,
        lastFetch: null
    },
    
    // Cache duration (5 minutes)
    CACHE_DURATION: 5 * 60 * 1000,
    
    // Get current user ID
    getUserId() {
        return auth.currentUser?.uid || null;
    },
    
    // Check if cache is valid
    isCacheValid() {
        if (!this._cache.lastFetch) return false;
        return (Date.now() - this._cache.lastFetch) < this.CACHE_DURATION;
    },
    
    // Get user preferences (with caching)
    async getPreferences() {
        const userId = this.getUserId();
        if (!userId) return null;
        
        if (this.isCacheValid() && this._cache.preferences) {
            return this._cache.preferences;
        }
        
        try {
            const docRef = doc(db, 'user_preferences', userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                this._cache.preferences = docSnap.data();
                this._cache.lastFetch = Date.now();
                return this._cache.preferences;
            }
            return null;
        } catch (error) {
            console.error('Error getting preferences:', error);
            return null;
        }
    },
    
    // Save user preferences
    async savePreferences(data) {
        const userId = this.getUserId();
        if (!userId) return false;
        
        try {
            const docRef = doc(db, 'user_preferences', userId);
            await setDoc(docRef, {
                ...data,
                userId,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            // Update cache
            this._cache.preferences = { ...this._cache.preferences, ...data };
            this._cache.lastFetch = Date.now();
            
            return true;
        } catch (error) {
            console.error('Error saving preferences:', error);
            return false;
        }
    },
    
    // Track user activity for Resume Work
    async trackActivity(route, projectId = null, module = null) {
        const data = {
            lastRoute: route,
            lastProjectId: projectId,
            lastModule: module,
            lastActivityAt: new Date().toISOString()
        };
        
        // Also save to localStorage for faster access
        localStorage.setItem('bb_resume_data', JSON.stringify(data));
        
        return await this.savePreferences(data);
    },
    
    // Get resume work data
    async getResumeData() {
        // Try localStorage first for speed
        const localData = localStorage.getItem('bb_resume_data');
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (e) {}
        }
        
        // Fall back to Firestore
        const prefs = await this.getPreferences();
        if (prefs?.lastRoute) {
            return {
                lastRoute: prefs.lastRoute,
                lastProjectId: prefs.lastProjectId,
                lastModule: prefs.lastModule,
                lastActivityAt: prefs.lastActivityAt
            };
        }
        
        return null;
    },
    
    // Get user role
    async getRole() {
        const userId = this.getUserId();
        if (!userId) return 'owner'; // Default role
        
        if (this.isCacheValid() && this._cache.role) {
            return this._cache.role;
        }
        
        try {
            // Check user document for role
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists() && userDocSnap.data().role) {
                this._cache.role = userDocSnap.data().role;
                return this._cache.role;
            }
            
            // Check preferences for role
            const prefs = await this.getPreferences();
            if (prefs?.role) {
                this._cache.role = prefs.role;
                return this._cache.role;
            }
            
            // Default to owner
            return 'owner';
        } catch (error) {
            console.error('Error getting role:', error);
            return 'owner';
        }
    },
    
    // Set user role
    async setRole(role) {
        if (!ROLE_CONFIG[role]) {
            console.error('Invalid role:', role);
            return false;
        }
        
        this._cache.role = role;
        return await this.savePreferences({ role });
    },
    
    // Get role configuration
    getRoleConfig(role) {
        return ROLE_CONFIG[role] || ROLE_CONFIG.owner;
    },
    
    // Get all role configs
    getAllRoles() {
        return ROLE_CONFIG;
    },
    
    // Clear cache
    clearCache() {
        this._cache = {
            preferences: null,
            role: null,
            lastFetch: null
        };
        localStorage.removeItem('bb_resume_data');
    }
};

export default UserPreferences;
export { ROLE_CONFIG };
