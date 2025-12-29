// Hybrid Storage - Uses Firebase if available, falls back to localStorage
// This allows the app to work with or without Firebase

// Check if we're in test mode or Firebase mode
const USE_FIREBASE = !localStorage.getItem('testMode');

let StorageBackend;

if (USE_FIREBASE) {
    // Try to use Firebase
    try {
        const { default: FirebaseStorage } = await import('./firebase-storage.js');
        StorageBackend = FirebaseStorage;
        console.log('✅ Using Firebase Firestore for data storage');
    } catch (error) {
        console.warn('⚠️ Firebase not available, using localStorage');
        USE_FIREBASE = false;
    }
}

// LocalStorage fallback
const LocalStorage = {
    KEYS: {
        PROJECTS: 'contractorhub_projects',
        MATERIALS: 'contractorhub_materials',
        MATERIAL_STOCK: 'contractorhub_material_stock',
        LABOUR: 'contractorhub_labour',
        EXPENSES: 'contractorhub_expenses',
        LOGS: 'contractorhub_logs',
        BUDGET_TRANSFERS: 'contractorhub_budget_transfers',
        DOCUMENTS: 'contractorhub_documents',
        PAYMENTS: 'contractorhub_payments',
        ATTENDANCE: 'contractorhub_attendance',
        CLIENT_PAYMENTS: 'contractorhub_client_payments'
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    async getAll(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    async saveAll(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) { return false; }
    },

    async getById(key, id) {
        const items = await this.getAll(key);
        return items.find(item => item.id === id) || null;
    },

    async add(key, item) {
        const items = await this.getAll(key);
        item.id = this.generateId();
        item.createdAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        items.push(item);
        await this.saveAll(key, items);
        return item;
    },

    async update(key, id, updates) {
        const items = await this.getAll(key);
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
            await this.saveAll(key, items);
            return items[index];
        }
        return null;
    },

    async delete(key, id) {
        const items = await this.getAll(key);
        const filtered = items.filter(item => item.id !== id);
        await this.saveAll(key, filtered);
        return filtered.length < items.length;
    },

    async getByProject(key, projectId) {
        const items = await this.getAll(key);
        return items.filter(item => item.projectId === projectId);
    },

    async deleteByProject(key, projectId) {
        const items = await this.getAll(key);
        await this.saveAll(key, items.filter(item => item.projectId !== projectId));
    },

    // Collection methods
    projects: {
        async getAll() { return await LocalStorage.getAll(LocalStorage.KEYS.PROJECTS); },
        async getById(id) { return await LocalStorage.getById(LocalStorage.KEYS.PROJECTS, id); },
        async add(project) { return await LocalStorage.add(LocalStorage.KEYS.PROJECTS, project); },
        async update(id, updates) { return await LocalStorage.update(LocalStorage.KEYS.PROJECTS, id, updates); },
        async delete(id) {
            ['MATERIALS', 'LABOUR', 'EXPENSES', 'LOGS', 'DOCUMENTS', 'PAYMENTS', 'ATTENDANCE', 'CLIENT_PAYMENTS'].forEach(async k => {
                await LocalStorage.deleteByProject(LocalStorage.KEYS[k], id);
            });
            const transfers = await LocalStorage.getAll(LocalStorage.KEYS.BUDGET_TRANSFERS);
            await LocalStorage.saveAll(LocalStorage.KEYS.BUDGET_TRANSFERS, transfers.filter(t => t.fromProjectId !== id && t.toProjectId !== id));
            return await LocalStorage.delete(LocalStorage.KEYS.PROJECTS, id);
        }
    },

    materialStock: {
        async getAll() { return await LocalStorage.getAll(LocalStorage.KEYS.MATERIAL_STOCK); },
        async getById(id) { return await LocalStorage.getById(LocalStorage.KEYS.MATERIAL_STOCK, id); },
        async add(m) { return await LocalStorage.add(LocalStorage.KEYS.MATERIAL_STOCK, m); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.MATERIAL_STOCK, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.MATERIAL_STOCK, id); }
    },

    materials: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.MATERIALS, pid); },
        async add(m) { return await LocalStorage.add(LocalStorage.KEYS.MATERIALS, m); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.MATERIALS, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.MATERIALS, id); }
    },

    labour: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.LABOUR, pid); },
        async add(l) { return await LocalStorage.add(LocalStorage.KEYS.LABOUR, l); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.LABOUR, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.LABOUR, id); }
    },

    expenses: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.EXPENSES, pid); },
        async add(e) { return await LocalStorage.add(LocalStorage.KEYS.EXPENSES, e); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.EXPENSES, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.EXPENSES, id); }
    },

    logs: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.LOGS, pid); },
        async add(l) { return await LocalStorage.add(LocalStorage.KEYS.LOGS, l); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.LOGS, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.LOGS, id); }
    },

    budgetTransfers: {
        async getAll() { return await LocalStorage.getAll(LocalStorage.KEYS.BUDGET_TRANSFERS); },
        async getByProject(pid) {
            const all = await LocalStorage.getAll(LocalStorage.KEYS.BUDGET_TRANSFERS);
            return all.filter(t => t.fromProjectId === pid || t.toProjectId === pid);
        },
        async add(t) { return await LocalStorage.add(LocalStorage.KEYS.BUDGET_TRANSFERS, t); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.BUDGET_TRANSFERS, id); }
    },

    documents: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.DOCUMENTS, pid); },
        async add(d) { return await LocalStorage.add(LocalStorage.KEYS.DOCUMENTS, d); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.DOCUMENTS, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.DOCUMENTS, id); }
    },

    payments: {
        async getAll() { return await LocalStorage.getAll(LocalStorage.KEYS.PAYMENTS); },
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.PAYMENTS, pid); },
        async add(p) { return await LocalStorage.add(LocalStorage.KEYS.PAYMENTS, p); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.PAYMENTS, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.PAYMENTS, id); }
    },

    attendance: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.ATTENDANCE, pid); },
        async add(a) { return await LocalStorage.add(LocalStorage.KEYS.ATTENDANCE, a); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.ATTENDANCE, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.ATTENDANCE, id); }
    },

    clientPayments: {
        async getByProject(pid) { return await LocalStorage.getByProject(LocalStorage.KEYS.CLIENT_PAYMENTS, pid); },
        async add(cp) { return await LocalStorage.add(LocalStorage.KEYS.CLIENT_PAYMENTS, cp); },
        async update(id, u) { return await LocalStorage.update(LocalStorage.KEYS.CLIENT_PAYMENTS, id, u); },
        async delete(id) { return await LocalStorage.delete(LocalStorage.KEYS.CLIENT_PAYMENTS, id); }
    }
};

// Export the appropriate storage backend
const Storage = USE_FIREBASE ? StorageBackend : LocalStorage;

export default Storage;
