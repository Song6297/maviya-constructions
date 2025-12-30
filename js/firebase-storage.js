// Firebase Firestore Storage Adapter
// Replaces localStorage with cloud storage

import { db, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, onAuthStateChanged, auth } from './firebase-config.js';

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
});

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

    // Get all documents from a collection for current user
    async getAll(collectionName) {
        try {
            await this.waitForAuth();
            const userId = this.getUserId();
            const q = query(collection(db, collectionName), where('userId', '==', userId));
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
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
            return true;
        } catch (error) {
            console.error(`Error saving ${collectionName}:`, error);
            return false;
        }
    },

    // Get document by ID
    async getById(collectionName, id) {
        try {
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
            return { ...data, id };
        } catch (error) {
            console.error(`Error adding to ${collectionName}:`, error);
            return null;
        }
    },

    // Update document
    async update(collectionName, id, updates) {
        try {
            await this.waitForAuth();
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            return { id, ...updates };
        } catch (error) {
            console.error(`Error updating document ${id}:`, error);
            return null;
        }
    },

    // Delete document
    async delete(collectionName, id) {
        try {
            await this.waitForAuth();
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            console.error(`Error deleting document ${id}:`, error);
            return false;
        }
    },

    // Get documents by project ID
    async getByProject(collectionName, projectId) {
        try {
            await this.waitForAuth();
            const userId = this.getUserId();
            const q = query(
                collection(db, collectionName),
                where('userId', '==', userId),
                where('projectId', '==', projectId)
            );
            const querySnapshot = await getDocs(q);
            const items = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
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
        UNALLOCATED_FUNDS: 'unallocated_funds'
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
            // Delete all related data
            const collections = ['MATERIALS', 'LABOUR', 'EXPENSES', 'LOGS', 'DOCUMENTS', 'PAYMENTS', 'ATTENDANCE', 'CLIENT_PAYMENTS', 'VENDORS', 'VENDOR_PAYMENTS'];
            for (const col of collections) {
                await FirebaseStorage.deleteByProject(Storage.COLLECTIONS[col], id);
            }
            
            return await FirebaseStorage.delete(Storage.COLLECTIONS.PROJECTS, id);
        }
    },

    materialStock: {
        async getAll() { return await FirebaseStorage.getAll(Storage.COLLECTIONS.MATERIAL_STOCK); },
        async getById(id) { return await FirebaseStorage.getById(Storage.COLLECTIONS.MATERIAL_STOCK, id); },
        async add(m) { return await FirebaseStorage.add(Storage.COLLECTIONS.MATERIAL_STOCK, m); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.MATERIAL_STOCK, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.MATERIAL_STOCK, id); }
    },

    materials: {
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.MATERIALS, pid); },
        async add(m) { return await FirebaseStorage.add(Storage.COLLECTIONS.MATERIALS, m); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.MATERIALS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.MATERIALS, id); }
    },

    labour: {
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.LABOUR, pid); },
        async add(l) { return await FirebaseStorage.add(Storage.COLLECTIONS.LABOUR, l); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.LABOUR, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.LABOUR, id); }
    },

    expenses: {
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.EXPENSES, pid); },
        async add(e) { return await FirebaseStorage.add(Storage.COLLECTIONS.EXPENSES, e); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.EXPENSES, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.EXPENSES, id); }
    },

    logs: {
        async getByProject(pid) { return await FirebaseStorage.getByProject(Storage.COLLECTIONS.LOGS, pid); },
        async add(l) { return await FirebaseStorage.add(Storage.COLLECTIONS.LOGS, l); },
        async update(id, u) { return await FirebaseStorage.update(Storage.COLLECTIONS.LOGS, id, u); },
        async delete(id) { return await FirebaseStorage.delete(Storage.COLLECTIONS.LOGS, id); }
    },

    documents: {
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
    }
};

export default Storage;
