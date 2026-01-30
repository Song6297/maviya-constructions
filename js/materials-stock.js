// Material Stock Page Logic - Firebase Version
import Storage from './firebase-storage.js';

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

const Utils = window.Utils || {
    formatNumber(num) { 
        if (num === null || num === undefined || isNaN(num)) return '0';
        return new Intl.NumberFormat('en-IN').format(num); 
    },
    escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
};

const MaterialStock = {
    deleteTargetId: null,
    filters: { status: 'all', category: 'all' },

    async init() {
        this.showLoading(true);
        this.populateDropdowns();
        this.bindEvents();
        await this.render();
        await this.updateMetrics();
        this.showLoading(false);
    },

    showLoading(show) {
        let loader = document.getElementById('loadingOverlay');
        if (show && !loader) {
            loader = document.createElement('div');
            loader.id = 'loadingOverlay';
            loader.className = 'fixed inset-0 bg-white/80 flex items-center justify-center z-50';
            loader.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin text-4xl text-sky-500 mb-4"></i><p class="text-slate-600">Loading...</p></div>';
            document.body.appendChild(loader);
        } else if (!show && loader) {
            loader.remove();
        }
    },


    populateDropdowns() {
        document.getElementById('materialSelect').innerHTML = '<option value="">Select</option>' + MATERIAL_LIST.map(m => `<option value="${m}">${m}</option>`).join('');
        document.getElementById('materialCategory').innerHTML = MATERIAL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        document.getElementById('materialUnit').innerHTML = MATERIAL_UNITS.map(u => `<option value="${u.value}">${u.label}</option>`).join('');
        document.getElementById('categoryFilter').innerHTML = '<option value="all">All Categories</option>' + MATERIAL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    bindEvents() {
        document.getElementById('addStockBtn').addEventListener('click', () => this.openModal());
        document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => btn.addEventListener('click', () => this.closeModal()));
        document.getElementById('stockModal').addEventListener('click', e => { if (e.target.id === 'stockModal') this.closeModal(); });
        document.getElementById('stockForm').addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('materialSelect').addEventListener('change', e => {
            document.getElementById('customNameDiv').classList.toggle('hidden', e.target.value !== 'Other');
        });
        document.getElementById('statusFilter').addEventListener('change', e => { this.filters.status = e.target.value; this.render(); });
        document.getElementById('categoryFilter').addEventListener('change', e => { this.filters.category = e.target.value; this.render(); });
        document.getElementById('cancelDelete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());
        document.getElementById('deleteModal').addEventListener('click', e => { if (e.target.id === 'deleteModal') this.closeDeleteModal(); });
    },

    async openModal(id = null) {
        const modal = document.getElementById('stockModal');
        document.getElementById('stockForm').reset();
        document.getElementById('stockId').value = '';
        document.getElementById('customNameDiv').classList.add('hidden');

        if (id) {
            const item = await Storage.materialStock.getById(id);
            if (item) {
                document.getElementById('modalTitle').textContent = 'Edit Stock';
                document.getElementById('stockId').value = item.id;
                document.getElementById('materialSelect').value = MATERIAL_LIST.includes(item.name) ? item.name : 'Other';
                if (!MATERIAL_LIST.includes(item.name)) {
                    document.getElementById('customNameDiv').classList.remove('hidden');
                    document.getElementById('customMaterialName').value = item.name;
                }
                document.getElementById('materialCategory').value = item.category;
                document.getElementById('materialUnit').value = item.unit;
                document.getElementById('availableQty').value = item.available;
                document.getElementById('minStock').value = item.minStock || 0;
                document.getElementById('ratePerUnit').value = item.rate;
                document.getElementById('supplier').value = item.supplier || '';
            }
        } else {
            document.getElementById('modalTitle').textContent = 'Add Stock';
        }
        modal.classList.add('active');
        modal.classList.remove('hidden');
    },

    closeModal() {
        const modal = document.getElementById('stockModal');
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('stockId').value;
        const sel = document.getElementById('materialSelect').value;
        const name = sel === 'Other' ? document.getElementById('customMaterialName').value.trim() : sel;
        if (!name) { alert('Select material'); return; }

        const existingItem = id ? await Storage.materialStock.getById(id) : null;
        const data = {
            name,
            category: document.getElementById('materialCategory').value,
            unit: document.getElementById('materialUnit').value,
            available: parseFloat(document.getElementById('availableQty').value),
            used: existingItem?.used || 0,
            recovered: existingItem?.recovered || 0,
            minStock: parseFloat(document.getElementById('minStock').value) || 0,
            rate: parseFloat(document.getElementById('ratePerUnit').value),
            supplier: document.getElementById('supplier').value.trim()
        };

        this.showLoading(true);
        if (id) await Storage.materialStock.update(id, data);
        else await Storage.materialStock.add(data);

        this.closeModal();
        await this.render();
        await this.updateMetrics();
        this.showLoading(false);
        this.showToast('Stock saved', 'success');
    },

    async render() {
        let items = await Storage.materialStock.getAll();
        
        if (this.filters.status === 'available') items = items.filter(i => i.available > i.minStock);
        else if (this.filters.status === 'low') items = items.filter(i => i.available <= i.minStock);
        if (this.filters.category !== 'all') items = items.filter(i => i.category === this.filters.category);

        const tbody = document.getElementById('stockTableBody');
        const empty = document.getElementById('emptyState');

        if (!items.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        tbody.innerHTML = items.map(item => {
            const available = parseFloat(item.available) || 0;
            const rate = parseFloat(item.rate) || 0;
            const value = available * rate;
            const minStock = parseFloat(item.minStock) || 0;
            const isLow = available <= minStock;
            return `<tr class="${isLow ? 'bg-red-500/5' : ''}">
                <td class="font-medium text-slate-800">${Utils.escapeHtml(item.name)}</td>
                <td><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">${item.category}</span></td>
                <td class="font-semibold ${isLow ? 'text-red-500' : 'text-green-500'}">${available}</td>
                <td class="text-slate-600">${parseFloat(item.used) || 0}</td>
                <td class="text-blue-500">${parseFloat(item.recovered) || 0}</td>
                <td class="text-slate-500">${minStock}</td>
                <td>${item.unit}</td>
                <td>₹${Utils.formatNumber(rate)}</td>
                <td class="font-semibold text-sky-600">₹${Utils.formatNumber(value)}</td>
                <td><span class="material-status ${isLow ? 'material-low' : 'material-available'}">${isLow ? 'Low' : 'OK'}</span></td>
                <td><div class="flex gap-1">
                    <button class="action-btn" onclick="MaterialStock.openModal('${item.id}')"><i class="fas fa-pen text-xs"></i></button>
                    <button class="action-btn delete" onclick="MaterialStock.openDeleteModal('${item.id}')"><i class="fas fa-trash text-xs"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    },

    async updateMetrics() {
        const items = await Storage.materialStock.getAll();
        const totalValue = items.reduce((s, i) => {
            const available = parseFloat(i.available) || 0;
            const rate = parseFloat(i.rate) || 0;
            return s + (available * rate);
        }, 0);
        const lowStock = items.filter(i => {
            const available = parseFloat(i.available) || 0;
            const minStock = parseFloat(i.minStock) || 0;
            return available <= minStock;
        }).length;

        document.getElementById('totalItems').textContent = items.length;
        document.getElementById('availableItems').textContent = items.filter(i => (parseFloat(i.available) || 0) > 0).length;
        document.getElementById('lowStockItems').textContent = lowStock;
        document.getElementById('totalValue').textContent = '₹' + Utils.formatNumber(totalValue);
    },

    openDeleteModal(id) {
        this.deleteTargetId = id;
        document.getElementById('deleteModal').classList.add('active');
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.remove('active');
        setTimeout(() => document.getElementById('deleteModal').classList.add('hidden'), 300);
        this.deleteTargetId = null;
    },

    async confirmDelete() {
        if (this.deleteTargetId) {
            this.showLoading(true);
            await Storage.materialStock.delete(this.deleteTargetId);
            await this.render();
            await this.updateMetrics();
            this.showLoading(false);
            this.showToast('Deleted', 'success');
        }
        this.closeDeleteModal();
    },

    showToast(msg, type = 'info') {
        document.querySelector('.toast')?.remove();
        const t = document.createElement('div'); t.className = `toast ${type}`;
        t.innerHTML = `<i class="fas fa-check-circle mr-2 text-sky-500"></i>${msg}`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
    }
};

window.MaterialStock = MaterialStock;

export { MaterialStock };
