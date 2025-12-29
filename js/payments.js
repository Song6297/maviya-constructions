// Payments Page Logic - Firebase Version
import Storage from './firebase-storage.js';

const Utils = window.Utils || {
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
    getPaymentStatus(dueDate, isPaid) {
        if (isPaid) return { class: 'text-green-500 bg-green-500/10', text: 'Paid' };
        const days = this.getDaysRemaining(dueDate);
        if (days < 0) return { class: 'text-red-500 bg-red-500/20 animate-pulse', text: `${Math.abs(days)}d overdue` };
        if (days === 0) return { class: 'text-red-500 bg-red-500/10', text: 'Due today' };
        if (days <= 3) return { class: 'text-amber-500 bg-amber-500/10', text: `Due in ${days}d` };
        return { class: 'text-gray-400', text: `Due in ${days}d` };
    },
    shareToWhatsApp(text) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
};

const PaymentsApp = {
    deleteTargetId: null,
    filters: { status: 'all', type: 'all', project: 'all' },

    async init() {
        this.showLoading(true);
        await this.populateProjectFilter();
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

    async populateProjectFilter() {
        const projects = await Storage.projects.getAll();
        const select = document.getElementById('projectFilter');
        const formSelect = document.getElementById('paymentProject');
        
        select.innerHTML = '<option value="all">All Projects</option>' + projects.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('');
        formSelect.innerHTML = '<option value="">No Project</option>' + projects.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('');
    },


    bindEvents() {
        document.getElementById('addPaymentBtn').addEventListener('click', () => this.openModal());
        document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => btn.addEventListener('click', () => this.closeModal()));
        document.getElementById('paymentModal').addEventListener('click', e => { if (e.target.id === 'paymentModal') this.closeModal(); });
        document.getElementById('paymentForm').addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('isPaid').addEventListener('change', e => {
            document.getElementById('paidDateDiv').classList.toggle('hidden', !e.target.checked);
            if (e.target.checked) document.getElementById('paidDate').value = new Date().toISOString().split('T')[0];
        });
        document.getElementById('statusFilter').addEventListener('change', e => { this.filters.status = e.target.value; this.render(); });
        document.getElementById('typeFilter').addEventListener('change', e => { this.filters.type = e.target.value; this.render(); });
        document.getElementById('projectFilter').addEventListener('change', e => { this.filters.project = e.target.value; this.render(); });
        document.getElementById('cancelDelete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());
        document.getElementById('deleteModal').addEventListener('click', e => { if (e.target.id === 'deleteModal') this.closeDeleteModal(); });
    },

    async openModal(id = null) {
        const modal = document.getElementById('paymentModal');
        const form = document.getElementById('paymentForm');
        form.reset();
        document.getElementById('paymentId').value = '';
        document.getElementById('paidDateDiv').classList.add('hidden');
        document.getElementById('dueDate').value = new Date().toISOString().split('T')[0];

        if (id) {
            const payments = await Storage.payments.getAll();
            const p = payments.find(pay => pay.id === id);
            if (p) {
                document.getElementById('modalTitle').textContent = 'Edit Payment';
                document.getElementById('paymentId').value = p.id;
                document.getElementById('vendorName').value = p.vendorName;
                document.getElementById('paymentType').value = p.type;
                document.getElementById('paymentProject').value = p.projectId || '';
                document.getElementById('paymentAmount').value = p.amount;
                document.getElementById('dueDate').value = p.dueDate;
                document.getElementById('paymentDesc').value = p.description || '';
                document.getElementById('isPaid').checked = p.isPaid;
                if (p.isPaid) {
                    document.getElementById('paidDateDiv').classList.remove('hidden');
                    document.getElementById('paidDate').value = p.paidDate || '';
                }
            }
        } else {
            document.getElementById('modalTitle').textContent = 'Add Payment';
        }
        modal.classList.add('active');
        modal.classList.remove('hidden');
    },

    closeModal() {
        const modal = document.getElementById('paymentModal');
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('paymentId').value;
        const data = {
            vendorName: document.getElementById('vendorName').value.trim(),
            type: document.getElementById('paymentType').value,
            projectId: document.getElementById('paymentProject').value || null,
            amount: parseFloat(document.getElementById('paymentAmount').value),
            dueDate: document.getElementById('dueDate').value,
            description: document.getElementById('paymentDesc').value.trim(),
            isPaid: document.getElementById('isPaid').checked,
            paidDate: document.getElementById('isPaid').checked ? document.getElementById('paidDate').value : null
        };

        this.showLoading(true);
        if (id) await Storage.payments.update(id, data);
        else await Storage.payments.add(data);

        this.closeModal();
        await this.render();
        await this.updateMetrics();
        this.showLoading(false);
        this.showToast('Payment saved', 'success');
    },

    async render() {
        let payments = await Storage.payments.getAll();
        const tbody = document.getElementById('paymentsTableBody');
        const empty = document.getElementById('emptyState');

        if (this.filters.status === 'pending') payments = payments.filter(p => !p.isPaid);
        else if (this.filters.status === 'paid') payments = payments.filter(p => p.isPaid);
        else if (this.filters.status === 'overdue') payments = payments.filter(p => !p.isPaid && Utils.getDaysRemaining(p.dueDate) < 0);
        
        if (this.filters.type !== 'all') payments = payments.filter(p => p.type === this.filters.type);
        if (this.filters.project !== 'all') payments = payments.filter(p => p.projectId === this.filters.project);

        payments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (!payments.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        const projects = await Storage.projects.getAll();
        tbody.innerHTML = payments.map(p => {
            const project = p.projectId ? projects.find(proj => proj.id === p.projectId) : null;
            const status = Utils.getPaymentStatus(p.dueDate, p.isPaid);
            return `
                <tr>
                    <td class="font-medium text-slate-800">${Utils.escapeHtml(p.vendorName)}</td>
                    <td><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">${p.type}</span></td>
                    <td class="text-slate-600">${project ? Utils.escapeHtml(project.name) : '-'}</td>
                    <td class="font-semibold text-sky-600">₹${Utils.formatNumber(p.amount)}</td>
                    <td>${Utils.formatDate(p.dueDate)}</td>
                    <td><span class="px-2 py-1 rounded text-xs ${status.class}">${status.text}</span></td>
                    <td>
                        <div class="flex gap-1">
                            ${!p.isPaid ? `<button class="action-btn" onclick="PaymentsApp.markPaid('${p.id}')" title="Mark Paid"><i class="fas fa-check text-xs"></i></button>` : ''}
                            <button class="action-btn" onclick="PaymentsApp.shareWhatsApp('${p.id}')" title="Share"><i class="fab fa-whatsapp text-xs"></i></button>
                            <button class="action-btn" onclick="PaymentsApp.openModal('${p.id}')"><i class="fas fa-pen text-xs"></i></button>
                            <button class="action-btn delete" onclick="PaymentsApp.openDeleteModal('${p.id}')"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async markPaid(id) {
        this.showLoading(true);
        await Storage.payments.update(id, { isPaid: true, paidDate: new Date().toISOString().split('T')[0] });
        await this.render();
        await this.updateMetrics();
        this.showLoading(false);
        this.showToast('Marked as paid', 'success');
    },

    async shareWhatsApp(id) {
        const payments = await Storage.payments.getAll();
        const p = payments.find(pay => pay.id === id);
        if (!p) return;
        const projects = await Storage.projects.getAll();
        const project = p.projectId ? projects.find(proj => proj.id === p.projectId) : null;
        const text = `*Payment Reminder*\n\nVendor: ${p.vendorName}\nAmount: ₹${Utils.formatNumber(p.amount)}\nDue: ${Utils.formatDate(p.dueDate)}${project ? `\nProject: ${project.name}` : ''}\nStatus: ${p.isPaid ? 'Paid' : 'Pending'}\n\n- Maviya Constructions`;
        Utils.shareToWhatsApp(text);
    },

    async updateMetrics() {
        const payments = await Storage.payments.getAll();
        const total = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const pending = payments.filter(p => !p.isPaid).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const paid = payments.filter(p => p.isPaid).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const overdue = payments.filter(p => !p.isPaid && Utils.getDaysRemaining(p.dueDate) < 0).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

        document.getElementById('totalPayable').textContent = `₹${Utils.formatNumber(total)}`;
        document.getElementById('totalPending').textContent = `₹${Utils.formatNumber(pending)}`;
        document.getElementById('totalPaid').textContent = `₹${Utils.formatNumber(paid)}`;
        document.getElementById('totalOverdue').textContent = `₹${Utils.formatNumber(overdue)}`;
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
            await Storage.payments.delete(this.deleteTargetId);
            await this.render();
            await this.updateMetrics();
            this.showLoading(false);
            this.showToast('Payment deleted', 'success');
        }
        this.closeDeleteModal();
    },

    showToast(message, type = 'info') {
        document.querySelector('.toast')?.remove();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-check-circle mr-2 text-sky-500"></i>${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
    }
};

window.PaymentsApp = PaymentsApp;

export { PaymentsApp };
