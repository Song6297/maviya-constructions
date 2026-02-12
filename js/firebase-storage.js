// Firebase Firestore Storage Adapter
// Replaces localStorage with cloud storage
// Enhanced with: caching, real-time listeners, debounced writes
// Updated: Fixed missing materialTransactions issue

import { db, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, onAuthStateChanged, auth, onSnapshot } from './firebase-config.js';

let currentUserId = null;
let authReady = false;
let authReadyPromise = null;
let authReadyResolve = null;

// Create a promise that resolves when auth is ready
authReadyPromise = new Promise((resolve) => {
    authReadyResolve = resolve;
});

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    currentUserId = user ? user.uid : null;
    if (!authReady) {
        authReady = true;
        authReadyResolve();
    }
    // Clear cache on user change
    if (DataCache) DataCache.clearAll();
});

// ==================== IN-MEMORY CACHE LAYER ====================
const DataCache = {
    _store: new Map(),      // key -> { data, timestamp }
    _ttl: 30000,            // 30-second default TTL
    _listeners: new Map(),  // key -> Set<callback>

    _key(collectionName, qualifier) {
        return qualifier ? `${collectionName}::${qualifier}` : collectionName;
    },

    get(collectionName, qualifier) {
        const key = this._key(collectionName, qualifier);
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this._ttl) {
            this._store.delete(key);
            return null;
        }
        return entry.data;
    },

    set(collectionName, qualifier, data) {
        const key = this._key(collectionName, qualifier);
        this._store.set(key, { data, timestamp: Date.now() });
        // Notify any listeners
        const listeners = this._listeners.get(key);
        if (listeners) {
            listeners.forEach(cb => {
                try { cb(data); } catch (e) { console.error('Cache listener error:', e); }
            });
        }
    },

    invalidate(collectionName) {
        // Clear all entries that start with this collection name
        for (const key of this._store.keys()) {
            if (key === collectionName || key.startsWith(collectionName + '::')) {
                this._store.delete(key);
            }
        }
    },

    clearAll() {
        this._store.clear();
    },

    // Subscribe to cache updates for a specific key
    onChange(collectionName, qualifier, callback) {
        const key = this._key(collectionName, qualifier);
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key).add(callback);
        return () => {
            const set = this._listeners.get(key);
            if (set) set.delete(callback);
        };
    }
};

// ==================== REAL-TIME SUBSCRIPTION MANAGER ====================
const RealtimeManager = {
    _unsubscribers: new Map(), // key -> unsubscribe function

    // Subscribe to a collection with real-time updates
    subscribe(collectionName, callback) {
        const key = `rt::${collectionName}`;
        // Unsubscribe existing if any
        this.unsubscribe(collectionName);

        try {
            if (!currentUserId) return null;
            const q = query(collection(db, collectionName), where('userId', '==', currentUserId));
            const unsub = onSnapshot(q, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                // Update cache
                DataCache.set(collectionName, null, items);
                // Notify callback
                if (callback) callback(items);
            }, (error) => {
                console.error(`[Realtime] Error on ${collectionName}:`, error);
            });
            this._unsubscribers.set(key, unsub);
            return unsub;
        } catch (error) {
            console.error(`[Realtime] Failed to subscribe to ${collectionName}:`, error);
            return null;
        }
    },

    // Subscribe to project-scoped collection
    subscribeByProject(collectionName, projectId, callback) {
        const key = `rt::${collectionName}::${projectId}`;
        this.unsubscribeByKey(key);

        try {
            if (!currentUserId) return null;
            const q = query(
                collection(db, collectionName),
                where('userId', '==', currentUserId),
                where('projectId', '==', projectId)
            );
            const unsub = onSnapshot(q, (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() });
                });
                DataCache.set(collectionName, projectId, items);
                if (callback) callback(items);
            }, (error) => {
                console.error(`[Realtime] Error on ${collectionName}/${projectId}:`, error);
            });
            this._unsubscribers.set(key, unsub);
            return unsub;
        } catch (error) {
            console.error(`[Realtime] Failed to subscribe to ${collectionName}/${projectId}:`, error);
            return null;
        }
    },

    unsubscribe(collectionName) {
        const key = `rt::${collectionName}`;
        this.unsubscribeByKey(key);
    },

    unsubscribeByKey(key) {
        const unsub = this._unsubscribers.get(key);
        if (unsub) {
            unsub();
            this._unsubscribers.delete(key);
        }
    },

    unsubscribeAll() {
        for (const unsub of this._unsubscribers.values()) {
            try { unsub(); } catch (e) { /* ignore */ }
        }
        this._unsubscribers.clear();
    }
};

// ==================== DEBOUNCED WRITE MANAGER ====================
const WriteDebouncer = {
    _pending: new Map(),  // key -> { timeout, data }
    _delay: 500,          // 500ms debounce window

    // Schedule a debounced write
    schedule(collectionName, id, writeFn) {
        const key = `${collectionName}::${id}`;
        const existing = this._pending.get(key);
        if (existing) {
            clearTimeout(existing.timeout);
        }
        const timeout = setTimeout(async () => {
            this._pending.delete(key);
            try {
                await writeFn();
            } catch (e) {
                console.error(`[Debounce] Failed write for ${key}:`, e);
            }
        }, this._delay);
        this._pending.set(key, { timeout });
    },

    // Flush all pending writes immediately
    async flushAll() {
        // This triggers immediate execution by clearing timeouts and running writes
        for (const [key, entry] of this._pending.entries()) {
            clearTimeout(entry.timeout);
        }
        this._pending.clear();
    }
};


const FirebaseStorage = {
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Wait for auth to be ready
    async waitForAuth() {
        if (authReady) return;
        await authReadyPromise;
    },

    // Get user ID
    getUserId() {
        if (!currentUserId) {
            // Try to get from localStorage as fallback
            const storedId = localStorage.getItem('userId');
            if (storedId) return storedId;
            throw new Error('User not authenticated');
        }
        return currentUserId;
    },

    // Get all documents from a collection (with cache)
    async getAll(collectionName) {
        try {
            // Check cache first
            const cached = DataCache.get(collectionName, null);
            if (cached) return cached;

            await this.waitForAuth();
            const userId = this.getUserId();
            // Filter by userId to ensure data isolation per user
            const q = query(collection(db, collectionName), where('userId', '==', userId));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            // Populate cache
            DataCache.set(collectionName, null, items);
            return items;
        } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
            return [];
        }
    },

    // Save all documents (batch operation)
    async saveAll(collectionName, items) {
        try {
            await this.waitForAuth();
            const userId = this.getUserId();
            const promises = items.map(item => {
                const docRef = doc(db, collectionName, item.id);
                return setDoc(docRef, { ...item, userId, updatedAt: serverTimestamp() });
            });
            await Promise.all(promises);
            DataCache.invalidate(collectionName);
            return true;
        } catch (error) {
            console.error(`Error saving ${collectionName}:`, error);
            return false;
        }
    },

    // Get document by ID
    async getById(collectionName, id) {
        try {
            // Validate id is a string
            if (!id || typeof id !== 'string') {
                console.warn(`Invalid ID passed to getById for ${collectionName}:`, id);
                return null;
            }
            await this.waitForAuth();
            const docRef = doc(db, collectionName, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error(`Error getting document ${id}:`, error);
            return null;
        }
    },

    // Add new document
    async add(collectionName, item) {
        try {
            await this.waitForAuth();
            const userId = this.getUserId();
            const id = this.generateId();
            const docRef = doc(db, collectionName, id);
            const data = {
                ...item,
                id,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, data);
            DataCache.invalidate(collectionName);
            return { ...data, id };
        } catch (error) {
            console.error(`Error adding to ${collectionName}:`, error);
            return null;
        }
    },

    // Update document
    async update(collectionName, id, updates) {
        try {
            // Validate id is a string
            if (!id || typeof id !== 'string') {
                console.warn(`Invalid ID passed to update for ${collectionName}:`, id);
                return null;
            }
            await this.waitForAuth();
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            DataCache.invalidate(collectionName);
            return { id, ...updates };
        } catch (error) {
            console.error(`Error updating document ${id}:`, error);
            return null;
        }
    },

    // Delete document
    async delete(collectionName, id) {
        try {
            // Validate id is a string
            if (!id || typeof id !== 'string') {
                console.warn(`Invalid ID passed to delete for ${collectionName}:`, id);
                return false;
            }
            await this.waitForAuth();
            console.log(`[FirebaseStorage] Deleting ${collectionName}/${id}`);
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
            DataCache.invalidate(collectionName);
            console.log(`[FirebaseStorage] Successfully deleted ${collectionName}/${id}`);
            return true;
        } catch (error) {
            console.error(`[FirebaseStorage] Error deleting ${collectionName}/${id}:`, error);
            throw error; // Re-throw to let caller handle it
        }
    },

    // Get documents by project ID (with cache)
    async getByProject(collectionName, projectId) {
        try {
            // Check cache first
            const cached = DataCache.get(collectionName, projectId);
            if (cached) return cached;

            await this.waitForAuth();
            // Filter by both userId and projectId to ensure data isolation
            const q = query(
                collection(db, collectionName),
                where('userId', '==', this.getUserId()),
                where('projectId', '==', projectId)
            );
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            // Populate cache
            DataCache.set(collectionName, projectId, items);
            return items;
        } catch (error) {
            console.error(`Error getting ${collectionName} by project:`, error);
            return [];
        }
    },

    // Delete all documents by project ID
    async deleteByProject(collectionName, projectId) {
        try {
            await this.waitForAuth();
            const items = await this.getByProject(collectionName, projectId);
            const promises = items.map(item => this.delete(collectionName, item.id));
            await Promise.all(promises);
            DataCache.invalidate(collectionName);
            return true;
        } catch (error) {
            console.error(`Error deleting ${collectionName} by project:`, error);
            return false;
        }
    }
};

// Storage wrapper that maintains the same API as localStorage version
const Storage = {
    COLLECTIONS: {
        PROJECTS: 'projects',
        MATERIALS: 'materials',
        MATERIAL_STOCK: 'material_stock',
        MATERIAL_TRANSACTIONS: 'material_transactions',
        LABOUR: 'labour',
        EXPENSES: 'expenses',
        LOGS: 'logs',
        DOCUMENTS: 'documents',
        PAYMENTS: 'payments',
        ATTENDANCE: 'attendance',
        CLIENT_PAYMENTS: 'client_payments',
        WORKERS: 'workers',
        WORKER_ATTENDANCE: 'worker_attendance',
        WORKER_PAYMENTS: 'worker_payments',
        WORKER_ASSIGNMENTS: 'worker_assignments',
        VENDORS: 'vendors',
        VENDOR_PAYMENTS: 'vendor_payments',
        PROJECT_WALLETS: 'project_wallets',
        PAYMENT_ALLOCATIONS: 'payment_allocations',
        CROSS_PROJECT_TRANSACTIONS: 'cross_project_transactions',
        SETTLEMENT_RECORDS: 'settlement_records',
        UNALLOCATED_FUNDS: 'unallocated_funds',
        // Phase Management Collections
        PHASES: 'phases',
        PHASE_CHECKLISTS: 'phase_checklists',
        PHASE_WORKERS: 'phase_workers',
        // Labour Calendar Collections
        WORK_ENTRIES: 'work_entries',
        LABOUR_PAYMENTS: 'labour_payments',
        MEETINGS: 'meetings',
        WORK_TYPE_RATES: 'work_type_rates'
    },

    generateId() {
        return FirebaseStorage.generateId();
    },

    async waitForAuth() {
        return await FirebaseStorage.waitForAuth();
    },

    async getAll(collectionName) {
        return await FirebaseStorage.getAll(collectionName);
    },

    async saveAll(collectionName, data) {
        return await FirebaseStorage.saveAll(collectionName, data);
    },

    async getById(collectionName, id) {
        return await FirebaseStorage.getById(collectionName, id);
    },

    async add(collectionName, item) {
        return await FirebaseStorage.add(collectionName, item);
    },

    async update(collectionName, id, updates) {
        return await FirebaseStorage.update(collectionName, id, updates);
    },

    async delete(collectionName, id) {
        return await FirebaseStorage.delete(collectionName, id);
    },

    async getByProject(collectionName, projectId) {
        return await FirebaseStorage.getByProject(collectionName, projectId);
    },

    async deleteByProject(collectionName, projectId) {
        return await FirebaseStorage.deleteByProject(collectionName, projectId);
    },

    // Projects
    projects: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PROJECTS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.PROJECTS, id); },
        async add(project) { return await FirebaseStorage.add(Storage.COLLECTIONS.PROJECTS, project); },
        async update(id, updates) { return await FirebaseStorage.update(Storage.COLLECTIONS.PROJECTS, id, updates); },
        async delete(id) {
            console.log('[Storage] Deleting project and related data:', id);
            try {
                // Delete all related data
                const collections = ['MATERIALS', 'LABOUR', 'EXPENSES', 'LOGS', 'DOCUMENTS', 'PAYMENTS', 'ATTENDANCE', 'CLIENT_PAYMENTS', 'VENDORS', 'VENDOR_PAYMENTS'];
                for (const col of collections) {
                    console.log(`[Storage] Deleting ${col} for project ${id}`);
                    await FirebaseStorage.deleteByProject(Storage.COLLECTIONS[col], id);
                }

                console.log('[Storage] Deleting project document:', id);
                const result = await FirebaseStorage.delete(Storage.COLLECTIONS.PROJECTS, id);
                console.log('[Storage] Project delete result:', result);
                return result;
            } catch (error) {
                console.error('[Storage] Error deleting project:', error);
                throw error;
            }
        }
    },

    materialStock: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.MATERIAL_STOCK); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.MATERIAL_STOCK, id); },
        async add(m) { return await FirebaseStorage.add(Storage.COLLECTIONS.MATERIAL_STOCK, m); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.MATERIAL_STOCK, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.MATERIAL_STOCK, id); }
    },

    materialTransactions: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.MATERIAL_TRANSACTIONS); },
        async getByStockId(stockId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.MATERIAL_TRANSACTIONS);
            return all.filter(t => t.stockId === stockId);
        },
        async add(t) { return await FirebaseStorage.add(Storage.COLLECTIONS.MATERIAL_TRANSACTIONS, t); }
    },

    materials: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.MATERIALS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.MATERIALS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.MATERIALS, pid); },
        async add(m) { return await FirebaseStorage.add(Storage.COLLECTIONS.MATERIALS, m); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.MATERIALS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.MATERIALS, id); }
    },

    labour: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.LABOUR); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.LABOUR, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.LABOUR, pid); },
        async add(l) { return await FirebaseStorage.add(Storage.COLLECTIONS.LABOUR, l); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.LABOUR, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.LABOUR, id); }
    },

    expenses: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.EXPENSES); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.EXPENSES, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.EXPENSES, pid); },
        async add(e) { return await FirebaseStorage.add(Storage.COLLECTIONS.EXPENSES, e); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.EXPENSES, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.EXPENSES, id); }
    },

    logs: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.LOGS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.LOGS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.LOGS, pid); },
        async add(l) { return await FirebaseStorage.add(Storage.COLLECTIONS.LOGS, l); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.LOGS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.LOGS, id); }
    },

    documents: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.DOCUMENTS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.DOCUMENTS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.DOCUMENTS, pid); },
        async add(d) { return await FirebaseStorage.add(Storage.COLLECTIONS.DOCUMENTS, d); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.DOCUMENTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.DOCUMENTS, id); }
    },

    payments: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PAYMENTS); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.PAYMENTS, pid); },
        async add(p) { return await FirebaseStorage.add(Storage.COLLECTIONS.PAYMENTS, p); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.PAYMENTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.PAYMENTS, id); }
    },

    attendance: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.ATTENDANCE); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.ATTENDANCE, pid); },
        async add(a) { return await FirebaseStorage.add(Storage.COLLECTIONS.ATTENDANCE, a); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.ATTENDANCE, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.ATTENDANCE, id); }
    },

    clientPayments: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.CLIENT_PAYMENTS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.CLIENT_PAYMENTS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.CLIENT_PAYMENTS, pid); },
        async add(cp) { return await FirebaseStorage.add(Storage.COLLECTIONS.CLIENT_PAYMENTS, cp); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.CLIENT_PAYMENTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.CLIENT_PAYMENTS, id); }
    },

    // Workers Master Database (global, not project-specific)
    workers: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKERS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.WORKERS, id); },
        async add(w) { return await FirebaseStorage.add(Storage.COLLECTIONS.WORKERS, w); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.WORKERS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.WORKERS, id); }
    },

    // Worker Assignments (links workers to projects)
    workerAssignments: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_ASSIGNMENTS); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.WORKER_ASSIGNMENTS, pid); },
        async getByWorker(workerId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_ASSIGNMENTS);
            return all.filter(a => a.workerId === workerId);
        },
        async add(a) { return await FirebaseStorage.add(Storage.COLLECTIONS.WORKER_ASSIGNMENTS, a); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.WORKER_ASSIGNMENTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.WORKER_ASSIGNMENTS, id); }
    },

    // Worker Daily Attendance
    workerAttendance: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_ATTENDANCE); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.WORKER_ATTENDANCE, pid); },
        async getByWorker(workerId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_ATTENDANCE);
            return all.filter(a => a.workerId === workerId);
        },
        async getByWorkerAndProject(workerId, projectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_ATTENDANCE);
            return all.filter(a => a.workerId === workerId && a.projectId === projectId);
        },
        async getByDate(projectId, date) {
            const all = await FirebaseStorage.getByProject(Storage.COLLECTIONS.WORKER_ATTENDANCE, projectId);
            return all.filter(a => a.date === date);
        },
        async add(a) { return await FirebaseStorage.add(Storage.COLLECTIONS.WORKER_ATTENDANCE, a); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.WORKER_ATTENDANCE, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.WORKER_ATTENDANCE, id); }
    },

    // Worker Payments
    workerPayments: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_PAYMENTS); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.WORKER_PAYMENTS, pid); },
        async getByWorker(workerId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_PAYMENTS);
            return all.filter(p => p.workerId === workerId);
        },
        async getByWorkerAndProject(workerId, projectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORKER_PAYMENTS);
            return all.filter(p => p.workerId === workerId && p.projectId === projectId);
        },
        async add(p) { return await FirebaseStorage.add(Storage.COLLECTIONS.WORKER_PAYMENTS, p); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.WORKER_PAYMENTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.WORKER_PAYMENTS, id); }
    },

    // ===== MULTI-PROJECT FUND MANAGEMENT =====

    // Project Virtual Wallets
    projectWallets: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PROJECT_WALLETS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.PROJECT_WALLETS, id); },
        async getByProject(pid) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.PROJECT_WALLETS);
            return all.find(w => w.projectId === pid);
        },
        async add(w) { return await FirebaseStorage.add(Storage.COLLECTIONS.PROJECT_WALLETS, w); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.PROJECT_WALLETS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.PROJECT_WALLETS, id); }
    },

    // Payment Allocations (Client payments → Projects)
    paymentAllocations: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS, pid); },
        async getByPayment(paymentId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS);
            return all.filter(a => a.paymentId === paymentId);
        },
        async add(a) { return await FirebaseStorage.add(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS, a); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.PAYMENT_ALLOCATIONS, id); }
    },

    // Cross-Project Transactions (P1 pays for P3)
    crossProjectTransactions: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS, id); },
        async getByLender(lenderProjectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS);
            return all.filter(t => t.lenderProjectId === lenderProjectId);
        },
        async getByBorrower(borrowerProjectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS);
            return all.filter(t => t.borrowerProjectId === borrowerProjectId);
        },
        async getByProjects(lenderProjectId, borrowerProjectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS);
            return all.filter(t => t.lenderProjectId === lenderProjectId && t.borrowerProjectId === borrowerProjectId);
        },
        async add(t) { return await FirebaseStorage.add(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS, t); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.CROSS_PROJECT_TRANSACTIONS, id); }
    },

    // Settlement Records (Auto loan repayments)
    settlementRecords: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.SETTLEMENT_RECORDS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.SETTLEMENT_RECORDS, id); },
        async getByTransaction(transactionId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.SETTLEMENT_RECORDS);
            return all.filter(s => s.transactionId === transactionId);
        },
        async add(s) { return await FirebaseStorage.add(Storage.COLLECTIONS.SETTLEMENT_RECORDS, s); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.SETTLEMENT_RECORDS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.SETTLEMENT_RECORDS, id); }
    },

    // Unallocated Funds (Payments awaiting assignment)
    unallocatedFunds: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.UNALLOCATED_FUNDS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.UNALLOCATED_FUNDS, id); },
        async add(f) { return await FirebaseStorage.add(Storage.COLLECTIONS.UNALLOCATED_FUNDS, f); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.UNALLOCATED_FUNDS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.UNALLOCATED_FUNDS, id); }
    },

    // Vendors (Project-specific vendor services)
    vendors: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.VENDORS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.VENDORS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.VENDORS, pid); },
        async add(v) { return await FirebaseStorage.add(Storage.COLLECTIONS.VENDORS, v); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.VENDORS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.VENDORS, id); }
    },

    // Vendor Payments
    vendorPayments: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.VENDOR_PAYMENTS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.VENDOR_PAYMENTS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.VENDOR_PAYMENTS, pid); },
        async getByVendor(vendorId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.VENDOR_PAYMENTS);
            return all.filter(p => p.vendorId === vendorId);
        },
        async getByVendorAndProject(vendorId, projectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.VENDOR_PAYMENTS);
            return all.filter(p => p.vendorId === vendorId && p.projectId === projectId);
        },
        async add(p) { return await FirebaseStorage.add(Storage.COLLECTIONS.VENDOR_PAYMENTS, p); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.VENDOR_PAYMENTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.VENDOR_PAYMENTS, id); }
    },

    // ===== PHASE MANAGEMENT =====

    // Project Phases
    phases: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PHASES); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.PHASES, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.PHASES, pid); },
        async add(p) { return await FirebaseStorage.add(Storage.COLLECTIONS.PHASES, p); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.PHASES, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.PHASES, id); }
    },

    // Phase Checklists
    phaseChecklists: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PHASE_CHECKLISTS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.PHASE_CHECKLISTS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.PHASE_CHECKLISTS, pid); },
        async getByPhase(phaseId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.PHASE_CHECKLISTS);
            return all.filter(c => c.phaseId === phaseId);
        },
        async add(c) { return await FirebaseStorage.add(Storage.COLLECTIONS.PHASE_CHECKLISTS, c); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.PHASE_CHECKLISTS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.PHASE_CHECKLISTS, id); }
    },

    // Phase Worker Assignments
    phaseWorkers: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.PHASE_WORKERS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.PHASE_WORKERS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.PHASE_WORKERS, pid); },
        async getByPhase(phaseId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.PHASE_WORKERS);
            return all.filter(w => w.phaseId === phaseId);
        },
        async getByWorker(workerId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.PHASE_WORKERS);
            return all.filter(w => w.workerId === workerId);
        },
        async add(w) { return await FirebaseStorage.add(Storage.COLLECTIONS.PHASE_WORKERS, w); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.PHASE_WORKERS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.PHASE_WORKERS, id); }
    },

    // ===== LABOUR CALENDAR SYSTEM =====

    // Work Entries (time-based labour tracking)
    workEntries: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.WORK_ENTRIES); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.WORK_ENTRIES, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.WORK_ENTRIES, pid); },
        async getByLabour(labourId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORK_ENTRIES);
            return all.filter(e => e.labourId === labourId);
        },
        async getByDate(date) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORK_ENTRIES);
            return all.filter(e => e.date === date);
        },
        async getByLabourAndDate(labourId, date) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORK_ENTRIES);
            return all.filter(e => e.labourId === labourId && e.date === date);
        },
        async add(e) { return await FirebaseStorage.add(Storage.COLLECTIONS.WORK_ENTRIES, e); },
        // Note: Work entries are immutable - no update/delete for audit trail
        async update(id, u) {
            console.warn('Work entries are immutable. Create a new entry instead.');
            return null;
        },
        async delete(id) {
            console.warn('Work entries are immutable. Cannot delete.');
            return false;
        }
    },

    // Labour Payments (calendar-based payment tracking)
    labourPayments: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.LABOUR_PAYMENTS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.LABOUR_PAYMENTS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.LABOUR_PAYMENTS, pid); },
        async getByLabour(labourId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.LABOUR_PAYMENTS);
            return all.filter(p => p.labourId === labourId);
        },
        async getByDate(date) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.LABOUR_PAYMENTS);
            return all.filter(p => p.paymentDate === date);
        },
        async getByLabourAndProject(labourId, projectId) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.LABOUR_PAYMENTS);
            return all.filter(p => p.labourId === labourId && p.projectId === projectId);
        },
        async add(p) { return await FirebaseStorage.add(Storage.COLLECTIONS.LABOUR_PAYMENTS, p); },
        // Note: Payments are immutable for audit trail
        async update(id, u) {
            console.warn('Labour payments are immutable. Create a new record instead.');
            return null;
        },
        async delete(id) {
            console.warn('Labour payments are immutable. Cannot delete.');
            return false;
        }
    },

    // Meetings (non-wage time blocks)
    meetings: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.MEETINGS); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.MEETINGS, id); },
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.MEETINGS, pid); },
        async getByDate(date) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.MEETINGS);
            return all.filter(m => m.date === date);
        },
        async add(m) { return await FirebaseStorage.add(Storage.COLLECTIONS.MEETINGS, m); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.MEETINGS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.MEETINGS, id); }
    },

    // Work Type Rates (hourly rates by work type)
    workTypeRates: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.WORK_TYPE_RATES); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.WORK_TYPE_RATES, id); },
        async getByWorkType(workType) {
            const all = await FirebaseStorage.getAll(Storage.COLLECTIONS.WORK_TYPE_RATES);
            return all.find(r => r.workType === workType);
        },
        async add(r) { return await FirebaseStorage.add(Storage.COLLECTIONS.WORK_TYPE_RATES, r); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.WORK_TYPE_RATES, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.WORK_TYPE_RATES, id); }
    },

    // ===== REAL-TIME & CACHE UTILITIES =====

    // Subscribe to real-time updates for a collection
    subscribe(collectionName, callback) {
        return RealtimeManager.subscribe(collectionName, callback);
    },

    // Subscribe to project-scoped real-time updates
    subscribeByProject(collectionName, projectId, callback) {
        return RealtimeManager.subscribeByProject(collectionName, projectId, callback);
    },

    // Unsubscribe all real-time listeners
    unsubscribeAll() {
        RealtimeManager.unsubscribeAll();
    },

    // Prefetch commonly needed collections to warm the cache
    async prefetch(...collectionNames) {
        await FirebaseStorage.waitForAuth();
        const promises = collectionNames.map(name => this.getAll(name));
        return await Promise.all(promises);
    },

    // Invalidate cache for a collection (force re-fetch on next read)
    invalidateCache(collectionName) {
        DataCache.invalidate(collectionName);
    },

    // Clear all cached data
    clearCache() {
        DataCache.clearAll();
    },

    // Schedule a debounced update (for rapid-fire operations like toggling checkboxes)
    debouncedUpdate(collectionName, id, updates) {
        WriteDebouncer.schedule(collectionName, id, () => {
            return FirebaseStorage.update(collectionName, id, updates);
        });
    },

    // Listen to cache changes for reactive UI updates
    onCacheChange(collectionName, qualifier, callback) {
        return DataCache.onChange(collectionName, qualifier, callback);
    }
};

export default Storage;
