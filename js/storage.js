// Storage utilities for ContractorHub

const Storage = {
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

    getAll(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    saveAll(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) { return false; }
    },

    getById(key, id) {
        return this.getAll(key).find(item => item.id === id) || null;
    },

    add(key, item) {
        const items = this.getAll(key);
        item.id = this.generateId();
        item.createdAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        items.push(item);
        this.saveAll(key, items);
        return item;
    },

    update(key, id, updates) {
        const items = this.getAll(key);
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveAll(key, items);
            return items[index];
        }
        return null;
    },

    delete(key, id) {
        const items = this.getAll(key);
        const filtered = items.filter(item => item.id !== id);
        this.saveAll(key, filtered);
        return filtered.length < items.length;
    },

    getByProject(key, projectId) {
        return this.getAll(key).filter(item => item.projectId === projectId);
    },

    deleteByProject(key, projectId) {
        const items = this.getAll(key);
        this.saveAll(key, items.filter(item => item.projectId !== projectId));
    },

    // Projects
    projects: {
        getAll() { return Storage.getAll(Storage.KEYS.PROJECTS); },
        getById(id) { return Storage.getById(Storage.KEYS.PROJECTS, id); },
        add(project) { return Storage.add(Storage.KEYS.PROJECTS, project); },
        update(id, updates) { return Storage.update(Storage.KEYS.PROJECTS, id, updates); },
        delete(id) {
            ['MATERIALS', 'LABOUR', 'EXPENSES', 'LOGS', 'DOCUMENTS', 'PAYMENTS', 'ATTENDANCE'].forEach(k => {
                Storage.deleteByProject(Storage.KEYS[k], id);
            });
            const transfers = Storage.getAll(Storage.KEYS.BUDGET_TRANSFERS);
            Storage.saveAll(Storage.KEYS.BUDGET_TRANSFERS, transfers.filter(t => t.fromProjectId !== id && t.toProjectId !== id));
            return Storage.delete(Storage.KEYS.PROJECTS, id);
        }
    },

    materialStock: {
        getAll() { return Storage.getAll(Storage.KEYS.MATERIAL_STOCK); },
        getById(id) { return Storage.getById(Storage.KEYS.MATERIAL_STOCK, id); },
        add(m) { return Storage.add(Storage.KEYS.MATERIAL_STOCK, m); },
        update(id, u) { return Storage.update(Storage.KEYS.MATERIAL_STOCK, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.MATERIAL_STOCK, id); }
    },

    materials: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.MATERIALS, pid); },
        add(m) { return Storage.add(Storage.KEYS.MATERIALS, m); },
        update(id, u) { return Storage.update(Storage.KEYS.MATERIALS, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.MATERIALS, id); }
    },

    labour: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.LABOUR, pid); },
        add(l) { return Storage.add(Storage.KEYS.LABOUR, l); },
        update(id, u) { return Storage.update(Storage.KEYS.LABOUR, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.LABOUR, id); }
    },

    expenses: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.EXPENSES, pid); },
        add(e) { return Storage.add(Storage.KEYS.EXPENSES, e); },
        update(id, u) { return Storage.update(Storage.KEYS.EXPENSES, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.EXPENSES, id); }
    },

    logs: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.LOGS, pid); },
        add(l) { return Storage.add(Storage.KEYS.LOGS, l); },
        update(id, u) { return Storage.update(Storage.KEYS.LOGS, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.LOGS, id); }
    },

    budgetTransfers: {
        getAll() { return Storage.getAll(Storage.KEYS.BUDGET_TRANSFERS); },
        getByProject(pid) {
            return Storage.getAll(Storage.KEYS.BUDGET_TRANSFERS).filter(t => t.fromProjectId === pid || t.toProjectId === pid);
        },
        add(t) { return Storage.add(Storage.KEYS.BUDGET_TRANSFERS, t); },
        delete(id) { return Storage.delete(Storage.KEYS.BUDGET_TRANSFERS, id); }
    },

    documents: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.DOCUMENTS, pid); },
        add(d) { return Storage.add(Storage.KEYS.DOCUMENTS, d); },
        update(id, u) { return Storage.update(Storage.KEYS.DOCUMENTS, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.DOCUMENTS, id); }
    },

    payments: {
        getAll() { return Storage.getAll(Storage.KEYS.PAYMENTS); },
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.PAYMENTS, pid); },
        add(p) { return Storage.add(Storage.KEYS.PAYMENTS, p); },
        update(id, u) { return Storage.update(Storage.KEYS.PAYMENTS, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.PAYMENTS, id); }
    },

    attendance: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.ATTENDANCE, pid); },
        add(a) { return Storage.add(Storage.KEYS.ATTENDANCE, a); },
        update(id, u) { return Storage.update(Storage.KEYS.ATTENDANCE, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.ATTENDANCE, id); }
    },

    clientPayments: {
        getByProject(pid) { return Storage.getByProject(Storage.KEYS.CLIENT_PAYMENTS, pid); },
        add(cp) { return Storage.add(Storage.KEYS.CLIENT_PAYMENTS, cp); },
        update(id, u) { return Storage.update(Storage.KEYS.CLIENT_PAYMENTS, id, u); },
        delete(id) { return Storage.delete(Storage.KEYS.CLIENT_PAYMENTS, id); }
    }
};

// Constants
const MATERIAL_LIST = [
    'Cement', 'Sand', 'Gravel', 'Bricks', 'Concrete Blocks', 'Steel Rebar',
    'TMT Bars', 'Binding Wire', 'Plywood', 'Timber', 'Glass', 'Tiles',
    'Marble', 'Granite', 'Paint', 'Primer', 'Putty', 'PVC Pipes',
    'GI Pipes', 'Electrical Wire', 'Switches', 'MCB', 'Distribution Box',
    'Nails', 'Screws', 'Bolts', 'Hinges', 'Door Locks', 'Waterproofing',
    'Adhesive', 'Sealant', 'Insulation', 'Roofing Sheets', 'Other'
];

const MATERIAL_CATEGORIES = ['Structural', 'Finishing', 'Electrical', 'Plumbing', 'Hardware', 'Other'];

const MATERIAL_UNITS = [
    { value: 'bags', label: 'Bags' }, { value: 'kg', label: 'Kilograms' }, { value: 'tons', label: 'Tons' },
    { value: 'pcs', label: 'Pieces' }, { value: 'sqft', label: 'Sq. Feet' }, { value: 'sqm', label: 'Sq. Meters' },
    { value: 'rft', label: 'Running Feet' }, { value: 'm', label: 'Meters' }, { value: 'liters', label: 'Liters' },
    { value: 'cft', label: 'Cubic Feet' }, { value: 'cum', label: 'Cubic Meters' }, { value: 'bundle', label: 'Bundles' },
    { value: 'box', label: 'Boxes' }, { value: 'roll', label: 'Rolls' }
];

const DOC_CATEGORIES = ['Agreement', 'Drawing', 'Bill', 'BOQ', 'Invoice', 'Receipt', 'Photo', 'Other'];

// Utility functions
const Utils = {
    formatNumber(num) { 
        if (num === null || num === undefined || isNaN(num)) return '0';
        return new Intl.NumberFormat('en-IN').format(num); 
    },
    formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); },
    escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; },
    
    getDaysRemaining(endDate) {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    },

    getBudgetHealth(spent, budget) {
        spent = parseFloat(spent) || 0;
        budget = parseFloat(budget) || 0;
        if (budget <= 0) return { percent: 0, status: 'ok', color: 'green' };
        const percent = (spent / budget) * 100;
        if (isNaN(percent)) return { percent: 0, status: 'ok', color: 'green' };
        if (percent >= 100) return { percent, status: 'over', color: 'red' };
        if (percent >= 90) return { percent, status: 'critical', color: 'red' };
        if (percent >= 80) return { percent, status: 'warning', color: 'amber' };
        return { percent, status: 'ok', color: 'green' };
    },

    getDeadlineStatus(endDate, status) {
        if (status === 'Completed') return { class: 'text-green-500 bg-green-500/10', text: 'Completed', priority: 0 };
        const days = this.getDaysRemaining(endDate);
        if (days < 0) return { class: 'text-red-500 bg-red-500/20 animate-pulse', text: `${Math.abs(days)}d overdue`, priority: 4 };
        if (days === 0) return { class: 'text-red-500 bg-red-500/10', text: 'Due today', priority: 3 };
        if (days <= 3) return { class: 'text-red-400 bg-red-400/10', text: `${days}d left`, priority: 2 };
        if (days <= 7) return { class: 'text-amber-500 bg-amber-500/10', text: `${days}d left`, priority: 1 };
        return { class: 'text-gray-400', text: `${days}d left`, priority: 0 };
    },

    getPaymentStatus(dueDate, isPaid) {
        if (isPaid) return { class: 'text-green-500 bg-green-500/10', text: 'Paid' };
        const days = this.getDaysRemaining(dueDate);
        if (days < 0) return { class: 'text-red-500 bg-red-500/20 animate-pulse', text: `${Math.abs(days)}d overdue` };
        if (days === 0) return { class: 'text-red-500 bg-red-500/10', text: 'Due today' };
        if (days <= 3) return { class: 'text-amber-500 bg-amber-500/10', text: `Due in ${days}d` };
        return { class: 'text-gray-400', text: `Due in ${days}d` };
    },

    shareToWhatsApp(text) {
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    },

    exportToCSV(data, filename) {
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};
