// Project Detail Page Logic - Firebase Version
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
const DOC_CATEGORIES = ['Agreement', 'Drawing', 'Bill', 'BOQ', 'Invoice', 'Receipt', 'Photo', 'Other'];

// Utils (shared with app.js)
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
    shareToWhatsApp(text) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); },
    exportToCSV(data, filename) {
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }
};


const ProjectApp = {
    projectId: null,
    project: null,
    deleteTarget: { type: null, id: null },
    charts: {},
    materialFilter: 'all',
    docFilter: 'all',

    async init() {
        console.log('ProjectApp.init() starting...');
        this.projectId = new URLSearchParams(window.location.search).get('id');
        if (!this.projectId) { window.location.href = 'index.html'; return; }
        
        this.showLoading(true);
        this.project = await Storage.projects.getById(this.projectId);
        if (!this.project) { window.location.href = 'index.html'; return; }
        
        this.populateDropdowns();
        this.renderHeader();
        await this.checkProjectLock();
        await this.checkBudgetAlerts();
        await this.renderOverview();
        this.bindEvents();
        console.log('ProjectApp.bindEvents() completed');
        await this.renderAllTabs();
        this.showLoading(false);
        console.log('ProjectApp.init() completed successfully');
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

    async checkProjectLock() {
        const isCompleted = this.project.status === 'Completed';
        const reopenBtn = document.getElementById('reopenProjectBtn');
        
        if (isCompleted) {
            reopenBtn.classList.remove('hidden');
            document.querySelectorAll('.btn-add, .btn-primary, .action-btn:not(.delete), #exportDropdown').forEach(btn => {
                if (btn.id !== 'reopenProjectBtn') {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                }
            });
            this.showToast('Project is completed and locked. Click Re-open to make changes.', 'info');
        } else {
            reopenBtn.classList.add('hidden');
            document.querySelectorAll('.btn-add, .btn-primary, .action-btn').forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            });
        }
    },

    async reopenProject() {
        if (confirm('Are you sure you want to re-open this completed project?')) {
            this.project.status = 'In Progress';
            await Storage.projects.update(this.projectId, { status: 'In Progress' });
            this.showToast('Project re-opened successfully', 'success');
            location.reload();
        }
    },

    populateDropdowns() {
        document.getElementById('materialSelect').innerHTML = '<option value="">Select</option>' + MATERIAL_LIST.map(m => `<option value="${m}">${m}</option>`).join('');
        document.getElementById('materialCategory').innerHTML = MATERIAL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        document.getElementById('materialUnit').innerHTML = MATERIAL_UNITS.map(u => `<option value="${u.value}">${u.label}</option>`).join('');
        document.getElementById('docCategory').innerHTML = DOC_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        document.getElementById('docCategoryFilter').innerHTML = '<option value="all">All Types</option>' + DOC_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    renderHeader() {
        document.getElementById('projectTitle').textContent = this.project.name;
        const statusEl = document.getElementById('projectStatus');
        statusEl.textContent = this.project.status;
        statusEl.className = `status-badge ${this.getStatusClass(this.project.status)}`;
        document.title = `${this.project.name} - Maviya Constructions`;
    },

    async checkBudgetAlerts() {
        const spent = await this.calculateTotalSpent();
        const budget = await this.getEffectiveBudget();
        const health = Utils.getBudgetHealth(spent, budget);
        const alert = document.getElementById('budgetAlert');
        const title = document.getElementById('budgetAlertTitle');
        const text = document.getElementById('budgetAlertText');

        if (health.status === 'over') {
            alert.className = 'mb-4 p-4 rounded-lg border-l-4 flex items-center gap-3 bg-red-500/10 border-red-500 text-red-400';
            title.textContent = '⚠️ Budget Exceeded!';
            text.textContent = `Over budget by ₹${Utils.formatNumber(spent - budget)}. Review expenses immediately.`;
            alert.classList.remove('hidden');
        } else if (health.status === 'critical') {
            alert.className = 'mb-4 p-4 rounded-lg border-l-4 flex items-center gap-3 bg-red-500/10 border-red-500 text-red-400';
            title.textContent = '🔴 Critical: 90%+ Budget Used';
            text.textContent = `Only ₹${Utils.formatNumber(budget - spent)} remaining. Proceed with caution.`;
            alert.classList.remove('hidden');
        } else if (health.status === 'warning') {
            alert.className = 'mb-4 p-4 rounded-lg border-l-4 flex items-center gap-3 bg-amber-500/10 border-amber-500 text-amber-400';
            title.textContent = '🟡 Warning: 80%+ Budget Used';
            text.textContent = `₹${Utils.formatNumber(budget - spent)} remaining. Monitor spending closely.`;
            alert.classList.remove('hidden');
        } else {
            alert.classList.add('hidden');
        }
    },

    async renderOverview() {
        const container = document.getElementById('overviewSection');
        const spent = await this.calculateTotalSpent();
        const budget = await this.getEffectiveBudget();
        const health = Utils.getBudgetHealth(spent, budget);
        const deadline = Utils.getDeadlineStatus(this.project.endDate, this.project.status);
        const progress = this.calculateProgress();

        // Get fund status if available
        let fundStatusCard = '';
        try {
            if (window.FundManagement) {
                const fundSummary = await FundManagement.getProjectFinancialSummary(this.projectId);
                const netAvailable = fundSummary.netAvailableBalance;
                const hasLoans = fundSummary.activeLoansGiven > 0 || fundSummary.activeLoansReceived > 0;
                
                fundStatusCard = `
                    <div class="metric-card rounded-lg p-4 ${hasLoans ? 'border-amber-200 bg-amber-50' : ''}">
                        <p class="text-slate-600 text-sm">Virtual Balance</p>
                        <p class="font-semibold text-${netAvailable >= 0 ? 'emerald' : 'rose'}-600 text-xl">₹${Utils.formatNumber(netAvailable)}</p>
                        <p class="text-xs text-slate-500 mt-1">${hasLoans ? 'Has inter-project loans' : 'Net available'}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('Fund status not available:', error);
        }

        container.innerHTML = `
            <div class="metric-card rounded-lg p-4">
                <p class="text-slate-600 text-sm">Client</p>
                <p class="font-semibold text-slate-800">${Utils.escapeHtml(this.project.clientName)}</p>
                <p class="text-xs text-slate-500 mt-1"><i class="fas fa-map-marker-alt mr-1"></i>${Utils.escapeHtml(this.project.location)}</p>
            </div>
            <div class="metric-card rounded-lg p-4">
                <p class="text-slate-600 text-sm">Deadline</p>
                <p class="font-semibold text-slate-800 text-sm">${Utils.formatDate(this.project.endDate)}</p>
                <p class="text-xs px-2 py-1 rounded mt-1 inline-block ${deadline.class}">${deadline.text}</p>
            </div>
            <div class="metric-card rounded-lg p-4">
                <p class="text-slate-600 text-sm">Progress</p>
                <p class="font-semibold text-sky-600 text-xl">${progress}%</p>
                <div class="progress-bar mt-2"><div class="progress-fill" style="width:${progress}%"></div></div>
            </div>
            <div class="metric-card rounded-lg p-4">
                <p class="text-slate-600 text-sm">Budget Health</p>
                <p class="font-semibold text-${health.color}-600 text-xl">${Math.round(health.percent)}%</p>
                <div class="health-meter mt-2"><div class="health-indicator" style="left:${Math.min(98, health.percent)}%"></div></div>
            </div>
            <div class="metric-card rounded-lg p-4">
                <p class="text-slate-600 text-sm">Spent / Budget</p>
                <p class="font-semibold text-slate-800">₹${Utils.formatNumber(spent)}</p>
                <p class="text-xs text-slate-500">of ₹${Utils.formatNumber(budget)}</p>
            </div>
            ${fundStatusCard}
        `;
    },


    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
        document.getElementById('exportDropdown').addEventListener('click', () => {
            document.getElementById('exportMenu').classList.toggle('hidden');
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('#exportDropdown') && !e.target.closest('#exportMenu')) {
                document.getElementById('exportMenu').classList.add('hidden');
            }
        });

        document.getElementById('addMaterialBtn').addEventListener('click', () => this.openModal('material'));
        
        const addLabourBtn = document.getElementById('addLabourBtn');
        console.log('addLabourBtn found:', !!addLabourBtn);
        if (addLabourBtn) {
            addLabourBtn.addEventListener('click', () => {
                console.log('Add Worker button clicked');
                this.openModal('labour');
            });
        }
        
        const addVendorBtn = document.getElementById('addVendorBtn');
        if (addVendorBtn) {
            addVendorBtn.addEventListener('click', () => this.openModal('vendor'));
        }
        
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.openModal('expense'));
        document.getElementById('addDocBtn').addEventListener('click', () => this.openModal('document'));
        document.getElementById('addLogBtn').addEventListener('click', () => this.openModal('log'));
        document.getElementById('addClientPaymentBtn').addEventListener('click', () => this.openModal('clientPayment'));

        // Worker Management Event Listeners
        const markAttendanceBtn = document.getElementById('markAttendanceBtn');
        console.log('markAttendanceBtn found:', !!markAttendanceBtn);
        if (markAttendanceBtn) {
            markAttendanceBtn.addEventListener('click', () => {
                console.log('Mark Attendance button clicked');
                this.openAttendanceSheet();
            });
        }
        
        const workerSelect = document.getElementById('workerSelect');
        console.log('workerSelect found:', !!workerSelect);
        if (workerSelect) {
            workerSelect.addEventListener('change', (e) => this.onWorkerSelect(e.target.value));
        }
        
        const attendanceDateInput = document.getElementById('attendanceDateInput');
        if (attendanceDateInput) {
            attendanceDateInput.addEventListener('change', (e) => this.loadAttendanceForDate(e.target.value));
        }
        
        const markAllPresentBtn = document.getElementById('markAllPresentBtn');
        if (markAllPresentBtn) {
            markAllPresentBtn.addEventListener('click', () => this.markAllPresent());
        }
        
        const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
        if (saveAttendanceBtn) {
            saveAttendanceBtn.addEventListener('click', () => this.saveAttendance());
        }

        document.getElementById('materialForm').addEventListener('submit', e => this.handleMaterialSubmit(e));
        document.getElementById('labourForm').addEventListener('submit', e => this.handleLabourSubmit(e));
        document.getElementById('vendorForm').addEventListener('submit', e => this.handleVendorSubmit(e));
        document.getElementById('expenseForm').addEventListener('submit', e => this.handleExpenseSubmit(e));
        document.getElementById('documentForm').addEventListener('submit', e => this.handleDocumentSubmit(e));
        document.getElementById('logForm').addEventListener('submit', e => this.handleLogSubmit(e));
        document.getElementById('clientPaymentForm').addEventListener('submit', e => this.handleClientPaymentSubmit(e));
        document.getElementById('workerPaymentForm').addEventListener('submit', e => this.handleWorkerPaymentSubmit(e));
        document.getElementById('vendorPaymentForm').addEventListener('submit', e => this.handleVendorPaymentSubmit(e));

        document.getElementById('materialSelect').addEventListener('change', e => {
            document.getElementById('customMaterialDiv').classList.toggle('hidden', e.target.value !== 'Other');
        });
        document.getElementById('materialStatusFilter').addEventListener('change', e => { this.materialFilter = e.target.value; this.renderMaterials(); });
        document.getElementById('docCategoryFilter').addEventListener('change', e => { this.docFilter = e.target.value; this.renderDocuments(); });

        document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => btn.addEventListener('click', () => this.closeAllModals()));
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.addEventListener('click', e => { if (e.target === modal) this.closeAllModals(); }));

        document.getElementById('cancelDelete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());
        
        // Fund Status Event Listeners
        const refreshFundStatusBtn = document.getElementById('refreshFundStatusBtn');
        if (refreshFundStatusBtn) {
            refreshFundStatusBtn.addEventListener('click', () => this.renderFundStatus());
        }
    },

    async switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.remove('hidden');
        if (tabName === 'summary') await this.renderSummary();
        if (tabName === 'funds') await this.renderFundStatus();
        if (tabName === 'vendors') await this.renderVendors();
    },

    async renderAllTabs() {
        await this.renderMaterials();
        await this.renderLabour();
        await this.renderVendors();
        await this.renderExpenses();
        await this.renderDocuments();
        await this.renderLogs();
    },

    // Materials
    async renderMaterials() {
        let materials = await Storage.materials.getByProject(this.projectId);
        if (this.materialFilter !== 'all') materials = materials.filter(m => m.status === this.materialFilter);
        
        const tbody = document.getElementById('materialsTableBody');
        const empty = document.getElementById('materialsEmpty');
        const totalRow = document.getElementById('materialsTotalRow');

        if (!materials.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); totalRow.classList.add('hidden'); return; }
        empty.classList.add('hidden'); totalRow.classList.remove('hidden');

        let total = 0, totalPaid = 0;
        tbody.innerHTML = materials.map(m => {
            const itemTotal = m.quantity * m.rate;
            const paidAmount = m.paidAmount || 0;
            const balance = itemTotal - paidAmount;
            if (m.status === 'used') { total += itemTotal; totalPaid += paidAmount; } else { total -= itemTotal; }
            return `<tr>
                <td class="font-medium text-slate-800">${Utils.escapeHtml(m.name)}</td>
                <td><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">${m.category}</span></td>
                <td class="text-slate-700">${m.quantity}</td><td class="text-slate-700">${m.unit}</td><td class="text-slate-700">₹${Utils.formatNumber(m.rate)}</td>
                <td class="font-semibold ${m.status === 'recovered' ? 'text-emerald-600' : 'text-sky-600'}">${m.status === 'recovered' ? '-' : ''}₹${Utils.formatNumber(itemTotal)}</td>
                <td class="font-semibold text-emerald-600">₹${Utils.formatNumber(paidAmount)}</td>
                <td class="font-semibold ${balance > 0 ? 'text-rose-600' : 'text-slate-500'}">₹${Utils.formatNumber(balance)}</td>
                <td><span class="material-status material-${m.status}">${m.status}</span></td>
                <td class="text-slate-700">${Utils.formatDate(m.date)}</td>
                <td><div class="flex gap-1">
                    <button class="action-btn" onclick="ProjectApp.shareItemWhatsApp('material','${m.id}')"><i class="fab fa-whatsapp text-xs"></i></button>
                    <button class="action-btn" onclick="ProjectApp.openModal('material','${m.id}')"><i class="fas fa-pen text-xs"></i></button>
                    <button class="action-btn delete" onclick="ProjectApp.openDeleteModal('material','${m.id}')"><i class="fas fa-trash text-xs"></i></button>
                </div></td>
            </tr>`;
        }).join('');
        
        const totalBalance = Math.max(0, total) - totalPaid;
        document.getElementById('materialsTotalAmount').textContent = `₹${Utils.formatNumber(Math.max(0, total))}`;
        document.getElementById('materialsTotalPaid').textContent = `₹${Utils.formatNumber(totalPaid)}`;
        document.getElementById('materialsTotalBalance').textContent = `₹${Utils.formatNumber(Math.max(0, totalBalance))}`;
    },

    async handleMaterialSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('materialId').value;
        const sel = document.getElementById('materialSelect').value;
        const name = sel === 'Other' ? document.getElementById('customMaterialName').value.trim() : sel;
        if (!name) { alert('Select material'); return; }

        const data = {
            projectId: this.projectId, name,
            category: document.getElementById('materialCategory').value,
            unit: document.getElementById('materialUnit').value,
            quantity: parseFloat(document.getElementById('materialQty').value),
            rate: parseFloat(document.getElementById('materialRate').value),
            status: document.getElementById('materialStatus').value,
            date: document.getElementById('materialDate').value,
            supplier: document.getElementById('materialSupplier').value.trim(),
            paidAmount: parseFloat(document.getElementById('materialPaidAmount').value) || 0
        };

        this.showLoading(true);
        if (id) await Storage.materials.update(id, data); else await Storage.materials.add(data);
        this.closeAllModals(); await this.renderMaterials(); await this.renderOverview(); await this.checkBudgetAlerts();
        this.showLoading(false);
        this.showToast('Material saved', 'success');
    },


    // Labour - Using new Worker Management System
    async renderLabour() {
        if (window.WorkerManagement) {
            await window.WorkerManagement.renderLabour(this.projectId);
        } else {
            // Fallback to old system if WorkerManagement not loaded
            const container = document.getElementById('labourCardsContainer');
            const empty = document.getElementById('labourEmpty');
            container.innerHTML = '';
            empty.classList.remove('hidden');
            document.getElementById('labourTotalRow').classList.add('hidden');
            document.getElementById('attendanceSummary').classList.add('hidden');
        }
    },

    async handleLabourSubmit(e) {
        e.preventDefault();
        this.showLoading(true);
        
        try {
            if (window.WorkerManagement) {
                const success = await window.WorkerManagement.handleLabourSubmit(e, this.projectId);
                if (success) {
                    await window.WorkerManagement.loadWorkerDropdown();
                    this.closeAllModals();
                    await this.renderLabour();
                    await this.renderOverview();
                    await this.checkBudgetAlerts();
                    this.showToast('Worker assigned successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error saving worker:', error);
            this.showToast('Error saving worker', 'error');
        }
        
        this.showLoading(false);
    },

    // Vendors - Using VendorManagement System
    async renderVendors() {
        if (window.VendorManagement) {
            await window.VendorManagement.renderVendors(this.projectId);
        } else {
            // Fallback if VendorManagement not loaded
            const container = document.getElementById('vendorCardsContainer');
            const empty = document.getElementById('vendorEmpty');
            container.innerHTML = '';
            empty.classList.remove('hidden');
            document.getElementById('vendorTotalRow').classList.add('hidden');
        }
    },

    async handleVendorSubmit(e) {
        e.preventDefault();
        this.showLoading(true);
        
        try {
            if (window.VendorManagement) {
                const success = await window.VendorManagement.handleVendorSubmit(e, this.projectId);
                if (success) {
                    this.closeAllModals();
                    await this.renderVendors();
                    await this.renderOverview();
                    await this.checkBudgetAlerts();
                    this.showToast('Vendor saved successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error saving vendor:', error);
            this.showToast('Error saving vendor', 'error');
        }
        
        this.showLoading(false);
    },

    async handleVendorPaymentSubmit(e) {
        e.preventDefault();
        this.showLoading(true);
        
        try {
            if (window.VendorManagement) {
                const success = await window.VendorManagement.handleVendorPaymentSubmit(e, this.projectId);
                if (success) {
                    this.closeAllModals();
                    await this.renderVendors();
                    await this.renderOverview();
                    await this.checkBudgetAlerts();
                    this.showToast('Payment recorded successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error recording vendor payment:', error);
            this.showToast('Error recording payment', 'error');
        }
        
        this.showLoading(false);
    },

    // Expenses
    async renderExpenses() {
        const expenses = await Storage.expenses.getByProject(this.projectId);
        const tbody = document.getElementById('expensesTableBody');
        const empty = document.getElementById('expensesEmpty');
        const totalRow = document.getElementById('expensesTotalRow');

        if (!expenses.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); totalRow.classList.add('hidden'); return; }
        empty.classList.add('hidden'); totalRow.classList.remove('hidden');

        let total = 0;
        tbody.innerHTML = expenses.map(exp => {
            total += exp.amount;
            return `<tr>
                <td class="font-medium text-slate-800">${Utils.escapeHtml(exp.description)}</td>
                <td><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">${exp.category}</span></td>
                <td class="font-semibold text-violet-600">₹${Utils.formatNumber(exp.amount)}</td>
                <td class="text-slate-700">${Utils.formatDate(exp.date)}</td>
                <td><div class="flex gap-1">
                    <button class="action-btn" onclick="ProjectApp.shareItemWhatsApp('expense','${exp.id}')"><i class="fab fa-whatsapp text-xs"></i></button>
                    <button class="action-btn" onclick="ProjectApp.openModal('expense','${exp.id}')"><i class="fas fa-pen text-xs"></i></button>
                    <button class="action-btn delete" onclick="ProjectApp.openDeleteModal('expense','${exp.id}')"><i class="fas fa-trash text-xs"></i></button>
                </div></td>
            </tr>`;
        }).join('');
        document.getElementById('expensesTotalAmount').textContent = `₹${Utils.formatNumber(total)}`;
    },

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('expenseId').value;
        const data = {
            projectId: this.projectId,
            description: document.getElementById('expenseDesc').value.trim(),
            category: document.getElementById('expenseCategory').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            date: document.getElementById('expenseDate').value
        };
        this.showLoading(true);
        if (id) await Storage.expenses.update(id, data); else await Storage.expenses.add(data);
        this.closeAllModals(); await this.renderExpenses(); await this.renderOverview(); await this.checkBudgetAlerts();
        this.showLoading(false);
        this.showToast('Expense saved', 'success');
    },

    // Documents - Using Google Drive via Apps Script
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzjUkxdlyj4IFJESAvc-ADOZfBz4YMCYMgiQSjFE5cU_gKNvTj78CY-7sifBH5zTgT9/exec',

    async renderDocuments() {
        let docs = await Storage.documents.getByProject(this.projectId);
        if (this.docFilter !== 'all') docs = docs.filter(d => d.category === this.docFilter);
        
        const grid = document.getElementById('documentsGrid');
        const empty = document.getElementById('documentsEmpty');

        if (!docs.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        grid.innerHTML = docs.map(d => {
            const isImage = d.fileType?.startsWith('image/');
            const thumbnailSrc = d.viewUrl || d.fileData;
            return `<div class="doc-card">
                <div class="doc-preview cursor-pointer" onclick="ProjectApp.previewDocument('${d.id}')">
                    ${isImage && thumbnailSrc ? `<img src="${thumbnailSrc}" alt="${Utils.escapeHtml(d.name)}" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><i class="fas fa-image text-slate-400 text-4xl" style="display:none"></i>` : `<i class="fas fa-file-${d.fileType?.includes('pdf') ? 'pdf text-red-500' : 'alt text-slate-400'} text-4xl"></i>`}
                </div>
                <div class="p-3">
                    <p class="text-slate-800 text-sm font-medium truncate">${Utils.escapeHtml(d.name)}</p>
                    <p class="text-slate-500 text-xs">${d.category}</p>
                    ${d.viewUrl ? '<p class="text-green-500 text-xs"><i class="fas fa-cloud mr-1"></i>Google Drive</p>' : ''}
                    ${d.docDate ? `<p class="text-slate-400 text-xs mt-1"><i class="fas fa-calendar text-xs mr-1"></i>${Utils.formatDate(d.docDate)}</p>` : ''}
                    <div class="flex gap-1 mt-2">
                        <button class="action-btn" onclick="ProjectApp.previewDocument('${d.id}')"><i class="fas fa-eye text-xs"></i></button>
                        ${d.viewUrl ? `<button class="action-btn" onclick="window.open('${d.viewUrl}', '_blank')"><i class="fas fa-external-link-alt text-xs"></i></button>` : ''}
                        <button class="action-btn delete" onclick="ProjectApp.openDeleteModal('document','${d.id}')"><i class="fas fa-trash text-xs"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    async handleDocumentSubmit(e) {
        e.preventDefault();
        const file = document.getElementById('docFile').files[0];
        if (!file) return;
        
        // Allow up to 10MB files with Google Drive
        if (file.size > 10 * 1024 * 1024) { 
            alert('File too large! Maximum size is 10MB.'); 
            return; 
        }

        this.showLoading(true);
        this.showToast('Uploading to Google Drive...', 'info');

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const payload = {
                    fileName: `${this.projectId}_${Date.now()}_${file.name}`,
                    mimeType: file.type,
                    fileData: reader.result
                };

                // Use fetch with text response to handle Apps Script redirect
                const response = await fetch(this.APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                    body: JSON.stringify(payload)
                });
                
                const responseText = await response.text();
                console.log('Apps Script response:', responseText);
                
                let driveData;
                try {
                    driveData = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('Failed to parse response:', parseError);
                    throw new Error('Invalid response from server');
                }

                if (driveData.success) {
                    // Save metadata to Firestore with Google Drive URL
                    const data = {
                        projectId: this.projectId,
                        name: document.getElementById('docName').value.trim(),
                        category: document.getElementById('docCategory').value,
                        docDate: document.getElementById('docDate').value,
                        notes: document.getElementById('docNotes').value.trim(),
                        fileName: file.name,
                        fileType: file.type,
                        fileId: driveData.fileId,
                        viewUrl: driveData.viewUrl
                    };
                    
                    await Storage.documents.add(data);
                    this.closeAllModals(); 
                    await this.renderDocuments();
                    this.showToast('Document uploaded to Google Drive!', 'success');
                } else {
                    throw new Error(driveData.error || 'Upload failed');
                }
            } catch (error) {
                console.error('Error uploading document:', error);
                this.showToast('Upload failed: ' + error.message, 'error');
            }
            this.showLoading(false);
        };
        reader.readAsDataURL(file);
    },

    async previewDocument(id) {
        const doc = await Storage.documents.getByProject(this.projectId).then(docs => docs.find(d => d.id === id));
        if (!doc) return;
        const content = document.getElementById('previewContent');
        const title = document.getElementById('previewTitle');
        
        const fileUrl = doc.viewUrl || doc.fileData;
        
        if (!fileUrl) {
            content.innerHTML = `<div class="text-center text-gray-400"><i class="fas fa-exclamation-circle text-6xl mb-4"></i><p>File not found</p></div>`;
        } else if (doc.fileType?.startsWith('image/')) {
            content.innerHTML = `<img src="${fileUrl}" class="max-h-[80vh] max-w-full rounded-lg">`;
        } else if (doc.fileType?.includes('pdf')) {
            if (doc.fileId) {
                const pdfUrl = `https://drive.google.com/file/d/${doc.fileId}/preview`;
                content.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-[80vh] rounded-lg" allow="autoplay"></iframe>`;
            } else {
                content.innerHTML = `<iframe src="${fileUrl}" class="w-full h-[80vh] rounded-lg"></iframe>`;
            }
        } else {
            const downloadUrl = doc.fileId ? `https://drive.google.com/uc?export=download&id=${doc.fileId}` : fileUrl;
            content.innerHTML = `<div class="text-center text-gray-400"><i class="fas fa-file-alt text-6xl mb-4"></i><p>Preview not available</p><a href="${downloadUrl}" target="_blank" class="btn-primary mt-4 inline-block">Download</a></div>`;
        }
        
        title.textContent = doc.name;
        document.getElementById('previewModal').classList.add('active');
        document.getElementById('previewModal').classList.remove('hidden');
    },


    // Logs
    async renderLogs() {
        const logs = await Storage.logs.getByProject(this.projectId);
        const container = document.getElementById('logsContainer');
        const empty = document.getElementById('logsEmpty');

        if (!logs.length) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = logs.map(log => `
            <div class="log-card ${log.issues ? 'has-issues' : ''}">
                <div class="flex items-start justify-between mb-4">
                    <div class="log-date-badge"><i class="fas fa-calendar-day"></i><span>${Utils.formatDate(log.date)}</span></div>
                    <div class="flex gap-2">
                        <button type="button" class="action-btn" onclick="ProjectApp.openModal('log','${log.id}')" title="Edit Log"><i class="fas fa-pen"></i></button>
                        <button type="button" class="action-btn delete" onclick="ProjectApp.openDeleteModal('log','${log.id}')" title="Delete Log"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="space-y-3">
                    <div>
                        <div class="flex items-center gap-2 mb-2"><i class="fas fa-hammer text-sky-500 text-lg"></i><h4 class="text-slate-800 font-semibold">Work Done</h4></div>
                        <p class="text-slate-700 pl-7 leading-relaxed">${Utils.escapeHtml(log.description)}</p>
                    </div>
                    ${log.issues ? `<div class="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-lg"><div class="flex items-center gap-2 mb-1"><i class="fas fa-exclamation-triangle text-rose-500"></i><h4 class="text-rose-800 font-semibold text-sm">Issues / Delays</h4></div><p class="text-rose-700 text-sm pl-6">${Utils.escapeHtml(log.issues)}</p></div>` : ''}
                    ${log.notes ? `<div class="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg"><div class="flex items-center gap-2 mb-1"><i class="fas fa-sticky-note text-amber-500"></i><h4 class="text-amber-800 font-semibold text-sm">Notes</h4></div><p class="text-amber-700 text-sm pl-6">${Utils.escapeHtml(log.notes)}</p></div>` : ''}
                </div>
            </div>
        `).join('');
    },

    async handleLogSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('logId').value;
        const data = {
            projectId: this.projectId,
            date: document.getElementById('logDate').value,
            description: document.getElementById('logDescription').value.trim(),
            issues: document.getElementById('logIssues').value.trim(),
            notes: document.getElementById('logNotes').value.trim()
        };
        this.showLoading(true);
        if (id) await Storage.logs.update(id, data); else await Storage.logs.add(data);
        this.closeAllModals(); await this.renderLogs();
        this.showLoading(false);
        this.showToast('Log saved', 'success');
    },

    // Client Payments
    async handleClientPaymentSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('clientPaymentId').value;
        const data = {
            projectId: this.projectId,
            amount: parseFloat(document.getElementById('clientPaymentAmount').value),
            date: document.getElementById('clientPaymentDate').value,
            receivedBy: document.getElementById('clientPaymentReceivedBy').value.trim(),
            from: document.getElementById('clientPaymentFrom').value.trim(),
            method: document.getElementById('clientPaymentMethod').value,
            notes: document.getElementById('clientPaymentNotes').value.trim()
        };
        
        this.showLoading(true);
        
        try {
            let paymentId;
            
            if (id) {
                // Update existing payment
                await Storage.clientPayments.update(id, data);
                paymentId = id;
            } else {
                // Add new payment
                paymentId = await Storage.clientPayments.add(data);
                
                // Auto-allocate to fund management system
                if (window.FundManagement && paymentId) {
                    try {
                        // Create automatic payment allocation for this single project
                        await FundManagement.allocateClientPayment(
                            data.amount,
                            data.date,
                            data.from,
                            data.receivedBy,
                            data.method,
                            [{
                                projectId: this.projectId,
                                amount: data.amount,
                                description: `Auto-allocated payment from ${data.from}`
                            }],
                            `Auto-allocated single project payment. ${data.notes || ''}`.trim(),
                            paymentId // Pass the payment ID for linking
                        );
                        
                        console.log(`Auto-allocated payment of ₹${data.amount} to project ${this.projectId}`);
                    } catch (fundError) {
                        console.error('Error auto-allocating payment to fund management:', fundError);
                        // Don't fail the payment creation if fund allocation fails
                        this.showToast('Payment recorded but fund allocation failed. Please allocate manually.', 'warning');
                    }
                }
            }
            
            this.closeAllModals(); 
            await this.renderSummary();
            this.showLoading(false);
            this.showToast('Client payment recorded and auto-allocated to project funds', 'success');
            
        } catch (error) {
            this.showLoading(false);
            console.error('Error recording client payment:', error);
            this.showToast('Error recording client payment: ' + error.message, 'error');
        }
    },

    async renderClientPayments() {
        const payments = await Storage.clientPayments.getByProject(this.projectId);
        const budget = await this.getEffectiveBudget();
        const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
        const pending = budget - totalReceived;

        document.getElementById('clientTotalBudget').textContent = `₹${Utils.formatNumber(budget)}`;
        document.getElementById('clientTotalReceived').textContent = `₹${Utils.formatNumber(totalReceived)}`;
        document.getElementById('clientTotalPending').textContent = `₹${Utils.formatNumber(Math.max(0, pending))}`;

        const list = document.getElementById('clientPaymentsList');
        if (!payments.length) {
            list.innerHTML = '<p class="text-xs text-slate-500 text-center py-2">No payments received yet</p>';
            return;
        }

        // Check which payments have been allocated to fund management
        const allAllocations = await Storage.paymentAllocations.getAll();
        const allocatedPaymentIds = new Set(allAllocations.map(a => a.paymentId));

        payments.sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = payments.map(p => {
            const isAllocated = allocatedPaymentIds.has(p.id);
            const allocationBadge = isAllocated 
                ? '<span class="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium ml-2">✓ Fund Allocated</span>'
                : '<span class="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium ml-2">⚠ Not Allocated</span>';
            
            return `
                <div class="flex justify-between items-center p-2 bg-white rounded border border-sky-200">
                    <div class="flex-1">
                        <div class="flex items-center">
                            <p class="text-sm font-semibold text-slate-800">₹${Utils.formatNumber(p.amount)}</p>
                            ${allocationBadge}
                        </div>
                        <p class="text-xs text-slate-500">${Utils.formatDate(p.date)} • ${p.method}</p>
                        ${p.from ? `<p class="text-xs text-slate-600">From: ${Utils.escapeHtml(p.from)}</p>` : ''}
                        ${p.receivedBy ? `<p class="text-xs text-slate-600">Received by: ${Utils.escapeHtml(p.receivedBy)}</p>` : ''}
                        ${isAllocated ? '<p class="text-xs text-green-600 mt-1"><i class="fas fa-wallet mr-1"></i>Auto-allocated to project virtual wallet</p>' : ''}
                    </div>
                    <button type="button" class="action-btn delete text-xs" onclick="ProjectApp.deleteClientPayment('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
        }).join('');
    },

    async deleteClientPayment(id) {
        if (confirm('Delete this payment record? This will also remove any fund allocations.')) {
            this.showLoading(true);
            
            try {
                // Check if this payment has fund allocations
                const allocations = await Storage.paymentAllocations.getByPayment(id);
                
                if (allocations.length > 0) {
                    // Remove fund allocations and update virtual wallets
                    for (const allocation of allocations) {
                        // Update project wallet (subtract the allocation)
                        if (window.FundManagement) {
                            const wallet = await FundManagement.initializeProjectWallet(allocation.projectId);
                            await FundManagement.updateProjectWallet(allocation.projectId, {
                                virtualBalance: (wallet.virtualBalance || 0) - allocation.amount,
                                advanceReceived: (wallet.advanceReceived || 0) - allocation.amount
                            });
                        }
                        
                        // Delete the allocation record
                        await Storage.paymentAllocations.delete(allocation.id);
                    }
                }
                
                // Delete the payment
                await Storage.clientPayments.delete(id);
                await this.renderSummary();
                this.showLoading(false);
                this.showToast('Payment and fund allocations deleted', 'success');
                
            } catch (error) {
                this.showLoading(false);
                console.error('Error deleting payment:', error);
                this.showToast('Error deleting payment: ' + error.message, 'error');
            }
        }
    },

    // Summary
    async renderSummary() {
        await this.renderClientPayments();
        
        const budget = await this.getEffectiveBudget();
        const spent = await this.calculateTotalSpent();
        const balance = budget - spent;
        const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;

        document.getElementById('summaryBudget').textContent = `₹${Utils.formatNumber(budget)}`;
        document.getElementById('summarySpent').textContent = `₹${Utils.formatNumber(spent)}`;
        document.getElementById('summaryBalance').textContent = `₹${Utils.formatNumber(Math.abs(balance))}`;
        document.getElementById('summaryPercent').textContent = `${percent}%`;
        document.getElementById('healthIndicator').style.left = `${Math.min(98, percent)}%`;

        const card = document.getElementById('summaryBalanceCard');
        if (balance < 0) {
            card.className = 'summary-card danger';
            card.querySelector('p:first-child').textContent = 'Over Budget';
        } else {
            card.className = 'summary-card success';
            card.querySelector('p:first-child').textContent = 'Remaining';
        }
        await this.renderCharts();
    },

    async renderCharts() {
        const materials = await Storage.materials.getByProject(this.projectId);
        const labour = await Storage.labour.getByProject(this.projectId);
        const expenses = await Storage.expenses.getByProject(this.projectId);
        const vendors = await Storage.vendors.getByProject(this.projectId);

        const matCost = materials.filter(m => m.status === 'used').reduce((s, m) => s + m.quantity * m.rate, 0) -
                       materials.filter(m => m.status === 'recovered').reduce((s, m) => s + m.quantity * m.rate, 0);
        const labCost = labour.reduce((s, l) => s + (l.totalAmount || (l.dailyWage * (l.daysWorked || 0))), 0);
        const expCost = expenses.reduce((s, e) => s + e.amount, 0);
        const venCost = vendors.reduce((s, v) => s + (parseFloat(v.agreedCost) || 0), 0);

        if (this.charts.expense) this.charts.expense.destroy();
        this.charts.expense = new Chart(document.getElementById('expenseChart'), {
            type: 'doughnut',
            data: { labels: ['Materials', 'Labour', 'Vendors', 'Expenses'], datasets: [{ data: [Math.max(0, matCost), labCost, venCost, expCost], backgroundColor: ['#F59E0B', '#10B981', '#F97316', '#8B5CF6'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } } }
        });

        if (this.charts.budget) this.charts.budget.destroy();
        const budget = await this.getEffectiveBudget();
        const spent = await this.calculateTotalSpent();
        this.charts.budget = new Chart(document.getElementById('budgetChart'), {
            type: 'bar',
            data: { labels: ['Budget', 'Spent'], datasets: [{ data: [budget, spent], backgroundColor: ['#3B82F6', spent > budget ? '#DC2626' : '#10B981'], borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#9CA3AF', callback: v => '₹' + (v/1000) + 'K' }, grid: { color: '#3a3a3a' } }, x: { ticks: { color: '#9CA3AF' }, grid: { display: false } } } }
        });
    },


    // Modal handling
    async openModal(type, id = null) {
        const modal = document.getElementById(`${type}Modal`);
        const form = document.getElementById(`${type}Form`);
        if (form) form.reset();
        const today = new Date().toISOString().split('T')[0];

        if (type === 'material') {
            document.getElementById('materialId').value = '';
            document.getElementById('customMaterialDiv').classList.add('hidden');
            document.getElementById('materialDate').value = today;
            document.getElementById('materialPaidAmount').value = '0';
            document.getElementById('materialTotalDisplay').classList.add('hidden');
            document.getElementById('materialBalanceDisplay').classList.add('hidden');
            
            const updateMaterialCalculation = () => {
                const qty = parseFloat(document.getElementById('materialQty').value) || 0;
                const rate = parseFloat(document.getElementById('materialRate').value) || 0;
                const paid = parseFloat(document.getElementById('materialPaidAmount').value) || 0;
                const total = qty * rate;
                const balance = total - paid;
                
                if (total > 0) {
                    document.getElementById('materialTotalDisplay').classList.remove('hidden');
                    document.getElementById('materialTotalAmount').textContent = `₹${Utils.formatNumber(total)}`;
                } else {
                    document.getElementById('materialTotalDisplay').classList.add('hidden');
                }
                
                if (paid > 0 || total > 0) {
                    document.getElementById('materialBalanceDisplay').classList.remove('hidden');
                    document.getElementById('materialPaidDisplay').textContent = `₹${Utils.formatNumber(paid)}`;
                    document.getElementById('materialBalanceAmount').textContent = `₹${Utils.formatNumber(Math.max(0, balance))}`;
                } else {
                    document.getElementById('materialBalanceDisplay').classList.add('hidden');
                }
            };
            
            document.getElementById('materialQty').addEventListener('input', updateMaterialCalculation);
            document.getElementById('materialRate').addEventListener('input', updateMaterialCalculation);
            document.getElementById('materialPaidAmount').addEventListener('input', updateMaterialCalculation);
            
            if (id) {
                const materials = await Storage.materials.getByProject(this.projectId);
                const m = materials.find(mat => mat.id === id);
                if (m) {
                    document.getElementById('materialModalTitle').textContent = 'Edit Material';
                    document.getElementById('materialId').value = m.id;
                    document.getElementById('materialSelect').value = MATERIAL_LIST.includes(m.name) ? m.name : 'Other';
                    if (!MATERIAL_LIST.includes(m.name)) { document.getElementById('customMaterialDiv').classList.remove('hidden'); document.getElementById('customMaterialName').value = m.name; }
                    document.getElementById('materialCategory').value = m.category;
                    document.getElementById('materialUnit').value = m.unit;
                    document.getElementById('materialQty').value = m.quantity;
                    document.getElementById('materialRate').value = m.rate;
                    document.getElementById('materialStatus').value = m.status;
                    document.getElementById('materialDate').value = m.date;
                    document.getElementById('materialSupplier').value = m.supplier || '';
                    document.getElementById('materialPaidAmount').value = m.paidAmount || 0;
                    updateMaterialCalculation();
                }
            } else { document.getElementById('materialModalTitle').textContent = 'Add Material'; }
        } else if (type === 'labour') {
            const labourIdEl = document.getElementById('labourId');
            const workerIdEl = document.getElementById('workerId');
            const startDateEl = document.getElementById('labourStartDate');
            const endDateEl = document.getElementById('labourEndDate');
            const workerNameEl = document.getElementById('workerName');
            const workerPhoneEl = document.getElementById('workerPhone');
            const dailyWageEl = document.getElementById('dailyWage');
            const overtimeRateEl = document.getElementById('overtimeRate');
            const newWorkerFieldsEl = document.getElementById('newWorkerFields');
            const workerSelectEl = document.getElementById('workerSelect');
            
            if (labourIdEl) labourIdEl.value = '';
            if (workerIdEl) workerIdEl.value = '';
            if (startDateEl) startDateEl.value = today;
            if (endDateEl) endDateEl.value = '';
            if (workerNameEl) workerNameEl.value = '';
            if (workerPhoneEl) workerPhoneEl.value = '';
            if (dailyWageEl) dailyWageEl.value = '';
            if (overtimeRateEl) overtimeRateEl.value = '';
            if (newWorkerFieldsEl) newWorkerFieldsEl.style.display = 'block';
            
            // Load workers dropdown
            if (window.WorkerManagement) {
                await window.WorkerManagement.loadWorkerDropdown();
            }
            if (workerSelectEl) workerSelectEl.value = '';
            
            if (id) {
                // Edit existing assignment
                const assignments = await Storage.workerAssignments.getByProject(this.projectId);
                const assignment = assignments.find(a => a.id === id);
                if (assignment) {
                    const titleEl = document.getElementById('labourModalTitle');
                    const roleEl = document.getElementById('workerRole');
                    if (titleEl) titleEl.textContent = 'Edit Worker Assignment';
                    if (labourIdEl) labourIdEl.value = assignment.id;
                    if (workerIdEl) workerIdEl.value = assignment.workerId;
                    if (workerSelectEl) workerSelectEl.value = assignment.workerId;
                    if (roleEl) roleEl.value = assignment.role;
                    if (dailyWageEl) dailyWageEl.value = assignment.dailyWage;
                    if (overtimeRateEl) overtimeRateEl.value = assignment.overtimeRate || '';
                    if (startDateEl) startDateEl.value = assignment.startDate;
                    if (endDateEl) endDateEl.value = assignment.endDate || '';
                    if (newWorkerFieldsEl) newWorkerFieldsEl.style.display = 'none';
                }
            } else { 
                const titleEl = document.getElementById('labourModalTitle');
                if (titleEl) titleEl.textContent = 'Add Worker'; 
            }
        } else if (type === 'vendor') {
            document.getElementById('vendorId').value = '';
            
            // Populate vendor dropdowns
            if (window.VendorManagement) {
                window.VendorManagement.populateVendorDropdowns();
            }
            
            if (id) {
                const vendors = await Storage.vendors.getByProject(this.projectId);
                const vendor = vendors.find(v => v.id === id);
                if (vendor) {
                    document.getElementById('vendorModalTitle').textContent = 'Edit Vendor';
                    document.getElementById('vendorId').value = vendor.id;
                    document.getElementById('vendorName').value = vendor.name;
                    document.getElementById('vendorPhone').value = vendor.phone || '';
                    document.getElementById('vendorServiceType').value = vendor.serviceType;
                    document.getElementById('vendorWorkDescription').value = vendor.workDescription;
                    document.getElementById('vendorAgreedCost').value = vendor.agreedCost;
                }
            } else { 
                document.getElementById('vendorModalTitle').textContent = 'Add Vendor'; 
            }
        } else if (type === 'expense') {
            document.getElementById('expenseId').value = '';
            document.getElementById('expenseDate').value = today;
            if (id) {
                const expenses = await Storage.expenses.getByProject(this.projectId);
                const e = expenses.find(exp => exp.id === id);
                if (e) {
                    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
                    document.getElementById('expenseId').value = e.id;
                    document.getElementById('expenseDesc').value = e.description;
                    document.getElementById('expenseCategory').value = e.category;
                    document.getElementById('expenseAmount').value = e.amount;
                    document.getElementById('expenseDate').value = e.date;
                }
            } else { document.getElementById('expenseModalTitle').textContent = 'Add Expense'; }
        } else if (type === 'log') {
            document.getElementById('logId').value = '';
            document.getElementById('logDate').value = today;
            if (id) {
                const logs = await Storage.logs.getByProject(this.projectId);
                const log = logs.find(l => l.id === id);
                if (log) {
                    document.getElementById('logModalTitle').textContent = 'Edit Log';
                    document.getElementById('logId').value = log.id;
                    document.getElementById('logDate').value = log.date;
                    document.getElementById('logDescription').value = log.description;
                    document.getElementById('logIssues').value = log.issues || '';
                    document.getElementById('logNotes').value = log.notes || '';
                }
            } else { document.getElementById('logModalTitle').textContent = 'Add Log'; }
        } else if (type === 'clientPayment') {
            document.getElementById('clientPaymentId').value = '';
            document.getElementById('clientPaymentDate').value = today;
            if (id) {
                const payments = await Storage.clientPayments.getByProject(this.projectId);
                const cp = payments.find(p => p.id === id);
                if (cp) {
                    document.getElementById('clientPaymentId').value = cp.id;
                    document.getElementById('clientPaymentAmount').value = cp.amount;
                    document.getElementById('clientPaymentDate').value = cp.date;
                    document.getElementById('clientPaymentReceivedBy').value = cp.receivedBy || '';
                    document.getElementById('clientPaymentFrom').value = cp.from || '';
                    document.getElementById('clientPaymentMethod').value = cp.method || 'Cash';
                    document.getElementById('clientPaymentNotes').value = cp.notes || '';
                }
            }
        } else if (type === 'document') {
            document.getElementById('docDate').value = today;
        }

        modal.classList.add('active');
        modal.classList.remove('hidden');
    },

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('active');
        });
    },

    openDeleteModal(type, id) {
        this.deleteTarget = { type, id };
        document.getElementById('deleteModal').classList.add('active');
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.remove('active');
        setTimeout(() => document.getElementById('deleteModal').classList.add('hidden'), 300);
        this.deleteTarget = { type: null, id: null };
    },

    async confirmDelete() {
        const { type, id } = this.deleteTarget;
        if (!type || !id) return;
        this.showLoading(true);
        if (type === 'material') await Storage.materials.delete(id);
        else if (type === 'labour') await Storage.labour.delete(id);
        else if (type === 'workerAssignment') await Storage.workerAssignments.delete(id);
        else if (type === 'vendor') {
            // Delete vendor and all associated payments
            const payments = await Storage.vendorPayments.getByVendor(id);
            for (const payment of payments) {
                await Storage.vendorPayments.delete(payment.id);
            }
            await Storage.vendors.delete(id);
        }
        else if (type === 'expense') await Storage.expenses.delete(id);
        else if (type === 'document') await Storage.documents.delete(id);
        else if (type === 'log') await Storage.logs.delete(id);
        this.closeDeleteModal(); await this.renderAllTabs(); await this.renderOverview(); await this.checkBudgetAlerts();
        this.showLoading(false);
        this.showToast('Deleted', 'success');
    },


    // WhatsApp sharing
    async shareItemWhatsApp(type, id) {
        let text = `*${this.project.name}*\n\n`;
        if (type === 'material') {
            const materials = await Storage.materials.getByProject(this.projectId);
            const m = materials.find(mat => mat.id === id);
            if (m) text += `📦 *Material*\n${m.name}\nQty: ${m.quantity} ${m.unit}\nRate: ₹${Utils.formatNumber(m.rate)}\nTotal: ₹${Utils.formatNumber(m.quantity * m.rate)}\nStatus: ${m.status}\nDate: ${Utils.formatDate(m.date)}`;
        } else if (type === 'labour') {
            const labour = await Storage.labour.getByProject(this.projectId);
            const l = labour.find(lab => lab.id === id);
            if (l) text += `👷 *Labour*\n${l.workerName} (${l.role})\nWage: ₹${Utils.formatNumber(l.dailyWage)}/day\nTotal: ₹${Utils.formatNumber(l.totalAmount || 0)}`;
        } else if (type === 'vendor') {
            const vendors = await Storage.vendors.getByProject(this.projectId);
            const v = vendors.find(ven => ven.id === id);
            if (v) {
                const payments = await Storage.vendorPayments.getByVendorAndProject(v.id, this.projectId);
                const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const balance = Math.max(0, v.agreedCost - paidAmount);
                text += `🤝 *Vendor Service*\n${v.name} (${v.serviceType})\nWork: ${v.workDescription}\nAgreed Cost: ₹${Utils.formatNumber(v.agreedCost)}\nPaid: ₹${Utils.formatNumber(paidAmount)}\nBalance: ₹${Utils.formatNumber(balance)}`;
                if (v.phone) text += `\nPhone: ${v.phone}`;
            }
        } else if (type === 'expense') {
            const expenses = await Storage.expenses.getByProject(this.projectId);
            const e = expenses.find(exp => exp.id === id);
            if (e) text += `💰 *Expense*\n${e.description}\nCategory: ${e.category}\nAmount: ₹${Utils.formatNumber(e.amount)}\nDate: ${Utils.formatDate(e.date)}`;
        }
        text += '\n\n- Maviya Constructions';
        Utils.shareToWhatsApp(text);
    },

    async shareMaterialsWhatsApp() {
        const materials = await Storage.materials.getByProject(this.projectId);
        let text = `*${this.project.name} - Materials*\n\n`;
        materials.forEach(m => { text += `• ${m.name}: ${m.quantity} ${m.unit} @ ₹${Utils.formatNumber(m.rate)} = ₹${Utils.formatNumber(m.quantity * m.rate)} (${m.status})\n`; });
        const total = materials.filter(m => m.status === 'used').reduce((s, m) => s + m.quantity * m.rate, 0);
        text += `\n*Total: ₹${Utils.formatNumber(total)}*\n\n- Maviya Constructions`;
        Utils.shareToWhatsApp(text);
    },

    async shareLabourWhatsApp() {
        const labour = await Storage.labour.getByProject(this.projectId);
        let text = `*${this.project.name} - Labour*\n\n`;
        labour.forEach(l => { text += `• ${l.workerName} (${l.role}): ₹${Utils.formatNumber(l.totalAmount || 0)}\n`; });
        const total = labour.reduce((s, l) => s + (l.totalAmount || 0), 0);
        text += `\n*Total: ₹${Utils.formatNumber(total)}*\n\n- Maviya Constructions`;
        Utils.shareToWhatsApp(text);
    },

    async shareExpensesWhatsApp() {
        const expenses = await Storage.expenses.getByProject(this.projectId);
        let text = `*${this.project.name} - Expenses*\n\n`;
        expenses.forEach(e => { text += `• ${e.description} (${e.category}): ₹${Utils.formatNumber(e.amount)}\n`; });
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        text += `\n*Total: ₹${Utils.formatNumber(total)}*\n\n- Maviya Constructions`;
        Utils.shareToWhatsApp(text);
    },

    async shareVendorsWhatsApp() {
        const vendors = await Storage.vendors.getByProject(this.projectId);
        let text = `*${this.project.name} - Vendors*\n\n`;
        let totalCost = 0, totalPaid = 0;
        
        for (const v of vendors) {
            const payments = await Storage.vendorPayments.getByVendorAndProject(v.id, this.projectId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const balance = Math.max(0, v.agreedCost - paidAmount);
            
            totalCost += v.agreedCost;
            totalPaid += paidAmount;
            
            text += `• ${v.name} (${v.serviceType}): ₹${Utils.formatNumber(v.agreedCost)} - Paid: ₹${Utils.formatNumber(paidAmount)} - Balance: ₹${Utils.formatNumber(balance)}\n`;
        }
        
        const totalBalance = Math.max(0, totalCost - totalPaid);
        text += `\n*Total Cost: ₹${Utils.formatNumber(totalCost)}*\n*Total Paid: ₹${Utils.formatNumber(totalPaid)}*\n*Total Balance: ₹${Utils.formatNumber(totalBalance)}*\n\n- Maviya Constructions`;
        Utils.shareToWhatsApp(text);
    },

    // Exports
    async exportMaterials() {
        const materials = await Storage.materials.getByProject(this.projectId);
        const data = materials.map(m => ({
            Material: m.name, Category: m.category, Quantity: m.quantity, Unit: m.unit,
            Rate: m.rate, Total: m.quantity * m.rate, Paid: m.paidAmount || 0, Balance: (m.quantity * m.rate) - (m.paidAmount || 0), Status: m.status, Date: m.date, Supplier: m.supplier || ''
        }));
        Utils.exportToCSV(data, `${this.project.name}_Materials.csv`);
    },

    async exportLabour() {
        const labour = await Storage.labour.getByProject(this.projectId);
        const data = labour.map(l => ({
            Worker: l.workerName, Role: l.role, 'Daily Wage': l.dailyWage,
            Total: l.totalAmount || 0, 'Start Date': l.startDate, 'End Date': l.endDate
        }));
        Utils.exportToCSV(data, `${this.project.name}_Labour.csv`);
    },

    async exportVendors() {
        const vendors = await Storage.vendors.getByProject(this.projectId);
        const data = [];
        
        for (const v of vendors) {
            const payments = await Storage.vendorPayments.getByVendorAndProject(v.id, this.projectId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const balance = Math.max(0, v.agreedCost - paidAmount);
            
            data.push({
                'Vendor Name': v.name,
                'Service Type': v.serviceType,
                'Work Description': v.workDescription,
                'Phone': v.phone || '',
                'Agreed Cost': v.agreedCost,
                'Paid Amount': paidAmount,
                'Balance': balance,
                'Payment Status': paidAmount >= v.agreedCost ? 'Completed' : paidAmount > 0 ? 'Partially Paid' : 'Pending'
            });
        }
        
        Utils.exportToCSV(data, `${this.project.name}_Vendors.csv`);
    },

    async exportExpenses() {
        const expenses = await Storage.expenses.getByProject(this.projectId);
        const data = expenses.map(e => ({
            Description: e.description, Category: e.category, Amount: e.amount, Date: e.date
        }));
        Utils.exportToCSV(data, `${this.project.name}_Expenses.csv`);
    },

    // ===== WORKER MANAGEMENT FUNCTIONS =====
    
    async openAttendanceSheet() {
        console.log('openAttendanceSheet called, WorkerManagement:', !!window.WorkerManagement);
        if (window.WorkerManagement) {
            try {
                await window.WorkerManagement.openAttendanceSheet(this.projectId);
                console.log('openAttendanceSheet completed');
            } catch (error) {
                console.error('Error in openAttendanceSheet:', error);
                this.showToast('Error opening attendance sheet', 'error');
            }
        } else {
            console.error('WorkerManagement not loaded');
            this.showToast('Worker Management not loaded', 'error');
        }
    },

    async saveAttendance() {
        this.showLoading(true);
        try {
            const success = await window.WorkerManagement.saveAttendance(this.projectId);
            if (success) {
                this.closeAllModals();
                await this.renderLabour();
                this.showToast('Attendance saved successfully', 'success');
            }
        } catch (error) {
            console.error('Error saving attendance:', error);
            this.showToast('Error saving attendance', 'error');
        }
        this.showLoading(false);
    },

    markAllPresent() {
        if (window.WorkerManagement) {
            window.WorkerManagement.markAllPresent();
        }
    },

    async loadAttendanceForDate(date) {
        if (window.WorkerManagement) {
            await window.WorkerManagement.loadAttendanceForDate(date, this.projectId);
        }
    },

    onWorkerSelect(value) {
        if (window.WorkerManagement) {
            window.WorkerManagement.onWorkerSelect(value);
        }
    },

    async handleWorkerPaymentSubmit(e) {
        e.preventDefault();
        this.showLoading(true);
        try {
            const success = await window.WorkerManagement.handleWorkerPaymentSubmit(e, this.projectId);
            if (success) {
                this.closeAllModals();
                await this.renderLabour();
                this.showToast('Payment recorded successfully', 'success');
            }
        } catch (error) {
            console.error('Error recording payment:', error);
            this.showToast('Error recording payment', 'error');
        }
        this.showLoading(false);
    },

    // ===== END WORKER MANAGEMENT =====

    // Utilities
    async getEffectiveBudget() {
        // With Fund Management system, we use the original project budget
        // Cross-project funding is handled through the virtual wallet system
        const budget = parseFloat(this.project.budget) || 0;
        return budget;
    },

    async calculateTotalSpent() {
        const materials = await Storage.materials.getByProject(this.projectId);
        const labour = await Storage.labour.getByProject(this.projectId);
        const expenses = await Storage.expenses.getByProject(this.projectId);
        const vendors = await Storage.vendors.getByProject(this.projectId);
        
        const mat = materials.filter(m => m.status === 'used').reduce((s, m) => {
            const qty = parseFloat(m.quantity) || 0;
            const rate = parseFloat(m.rate) || 0;
            return s + (qty * rate);
        }, 0) - materials.filter(m => m.status === 'recovered').reduce((s, m) => {
            const qty = parseFloat(m.quantity) || 0;
            const rate = parseFloat(m.rate) || 0;
            return s + (qty * rate);
        }, 0);
        
        const lab = labour.reduce((s, l) => {
            const total = parseFloat(l.totalAmount) || 0;
            const wage = parseFloat(l.dailyWage) || 0;
            const days = parseFloat(l.daysWorked) || 0;
            return s + (total || (wage * days));
        }, 0);
        
        const exp = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        
        const ven = vendors.reduce((s, v) => s + (parseFloat(v.agreedCost) || 0), 0);
        
        return Math.max(0, mat) + lab + exp + ven;
    },

    calculateProgress() {
        if (this.project.status === 'Completed') return 100;
        if (this.project.status === 'Planning') return 0;
        const start = new Date(this.project.startDate);
        const end = new Date(this.project.endDate);
        const today = new Date();
        const total = end - start;
        const elapsed = today - start;
        return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    },

    getStatusClass(status) {
        return { 'Planning': 'status-planning', 'In Progress': 'status-in-progress', 'On Hold': 'status-on-hold', 'Completed': 'status-completed' }[status] || 'status-planning';
    },

    // ===== FUND MANAGEMENT INTEGRATION =====
    
    async renderFundStatus() {
        try {
            if (!window.FundManagement) {
                console.warn('FundManagement module not loaded');
                return;
            }

            // Get project financial summary
            const fundSummary = await FundManagement.getProjectFinancialSummary(this.projectId);
            
            // Update virtual wallet metrics
            document.getElementById('virtualBalance').textContent = `₹${Utils.formatNumber(fundSummary.virtualBalance)}`;
            document.getElementById('loansGiven').textContent = `₹${Utils.formatNumber(fundSummary.activeLoansGiven)}`;
            document.getElementById('loansReceived').textContent = `₹${Utils.formatNumber(fundSummary.activeLoansReceived)}`;
            document.getElementById('netAvailable').textContent = `₹${Utils.formatNumber(fundSummary.netAvailableBalance)}`;
            
            // Update net available color based on value
            const netAvailableEl = document.getElementById('netAvailable');
            if (fundSummary.netAvailableBalance >= 0) {
                netAvailableEl.className = 'font-bold text-2xl text-emerald-600';
            } else {
                netAvailableEl.className = 'font-bold text-2xl text-rose-600';
            }

            // Render payment allocations
            await this.renderPaymentAllocations();
            
            // Render loans given
            await this.renderLoansGiven();
            
            // Render loans received  
            await this.renderLoansReceived();
            
            // Render cross-project expenses
            await this.renderCrossProjectExpenses();
            
        } catch (error) {
            console.error('Error rendering fund status:', error);
            this.showToast('Error loading fund status', 'error');
        }
    },

    async renderPaymentAllocations() {
        try {
            const allocations = await Storage.paymentAllocations.getByProject(this.projectId);
            const container = document.getElementById('paymentAllocationsContainer');
            
            if (!allocations.length) {
                container.innerHTML = '<p class="text-slate-500 text-sm">No payment allocations received</p>';
                return;
            }
            
            // Sort by date (newest first)
            allocations.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const items = await Promise.all(allocations.map(async (allocation) => {
                // Get the original payment details
                const payment = await Storage.clientPayments.getById(allocation.paymentId);
                
                return `
                    <div class="flex justify-between items-center p-2 bg-emerald-50 rounded border border-emerald-200">
                        <div>
                            <p class="font-semibold text-slate-800 text-sm">₹${Utils.formatNumber(allocation.amount)}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(allocation.date)}</p>
                            ${payment ? `<p class="text-xs text-slate-500">From: ${payment.from}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-slate-600">${allocation.description || 'Payment allocation'}</p>
                        </div>
                    </div>
                `;
            }));
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering payment allocations:', error);
            document.getElementById('paymentAllocationsContainer').innerHTML = 
                '<p class="text-rose-500 text-sm">Error loading payment allocations</p>';
        }
    },

    async renderLoansGiven() {
        try {
            const loansGiven = await Storage.crossProjectTransactions.getByLender(this.projectId);
            const activeLoans = loansGiven.filter(loan => loan.status === 'active');
            const container = document.getElementById('loansGivenContainer');
            
            if (!activeLoans.length) {
                container.innerHTML = '<p class="text-slate-500 text-sm">No active loans given</p>';
                return;
            }
            
            const items = await Promise.all(activeLoans.map(async (loan) => {
                const borrowerProject = await Storage.projects.getById(loan.borrowerProjectId);
                const balance = loan.amount - (loan.settlementAmount || 0);
                
                return `
                    <div class="flex justify-between items-center p-2 bg-amber-50 rounded border border-amber-200">
                        <div>
                            <p class="font-semibold text-slate-800 text-sm">${borrowerProject ? borrowerProject.name : 'Unknown Project'}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(loan.date)}</p>
                            <p class="text-xs text-slate-500">${loan.description}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-amber-600">₹${Utils.formatNumber(balance)}</p>
                            <p class="text-xs text-slate-500">Outstanding</p>
                        </div>
                    </div>
                `;
            }));
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering loans given:', error);
            document.getElementById('loansGivenContainer').innerHTML = 
                '<p class="text-rose-500 text-sm">Error loading loans given</p>';
        }
    },

    async renderLoansReceived() {
        try {
            const loansReceived = await Storage.crossProjectTransactions.getByBorrower(this.projectId);
            const activeLoans = loansReceived.filter(loan => loan.status === 'active');
            const container = document.getElementById('loansReceivedContainer');
            
            if (!activeLoans.length) {
                container.innerHTML = '<p class="text-slate-500 text-sm">No active loans received</p>';
                return;
            }
            
            const items = await Promise.all(activeLoans.map(async (loan) => {
                const lenderProject = await Storage.projects.getById(loan.lenderProjectId);
                const balance = loan.amount - (loan.settlementAmount || 0);
                
                return `
                    <div class="flex justify-between items-center p-2 bg-rose-50 rounded border border-rose-200">
                        <div>
                            <p class="font-semibold text-slate-800 text-sm">${lenderProject ? lenderProject.name : 'Unknown Project'}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(loan.date)}</p>
                            <p class="text-xs text-slate-500">${loan.description}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-rose-600">₹${Utils.formatNumber(balance)}</p>
                            <p class="text-xs text-slate-500">Owed</p>
                        </div>
                    </div>
                `;
            }));
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering loans received:', error);
            document.getElementById('loansReceivedContainer').innerHTML = 
                '<p class="text-rose-500 text-sm">Error loading loans received</p>';
        }
    },

    async renderCrossProjectExpenses() {
        try {
            // Get all materials, labour, and expenses that were paid via cross-project
            const materials = await Storage.materials.getByProject(this.projectId);
            const labour = await Storage.labour.getByProject(this.projectId);
            const expenses = await Storage.expenses.getByProject(this.projectId);
            
            const crossProjectItems = [
                ...materials.filter(m => m.paidViaCrossProject),
                ...labour.filter(l => l.paidViaCrossProject),
                ...expenses.filter(e => e.paidViaCrossProject)
            ];
            
            const container = document.getElementById('crossProjectExpensesContainer');
            
            if (!crossProjectItems.length) {
                container.innerHTML = '<p class="text-slate-500 text-sm">No cross-project expenses</p>';
                return;
            }
            
            // Sort by date (newest first)
            crossProjectItems.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const items = crossProjectItems.map(item => {
                const amount = item.amount || (item.quantity * item.rate) || item.totalAmount || 0;
                const description = item.name || item.description || `${item.workerName} (${item.role})` || 'Unknown';
                const type = item.name ? 'Material' : item.workerName ? 'Labour' : 'Expense';
                
                return `
                    <div class="flex justify-between items-center p-2 bg-violet-50 rounded border border-violet-200">
                        <div>
                            <p class="font-semibold text-slate-800 text-sm">${description}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(item.date)}</p>
                            <p class="text-xs text-violet-600">${type}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-violet-600">₹${Utils.formatNumber(amount)}</p>
                            <p class="text-xs text-slate-500">Cross-funded</p>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering cross-project expenses:', error);
            document.getElementById('crossProjectExpensesContainer').innerHTML = 
                '<p class="text-rose-500 text-sm">Error loading cross-project expenses</p>';
        }
    },

    // Generate Fund Status PDF for this project
    async generateFundStatusPDF() {
        this.showToast('Generating fund status PDF...', 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            if (!window.FundManagement) {
                throw new Error('Fund Management module not loaded');
            }

            // Get fund summary
            const fundSummary = await FundManagement.getProjectFinancialSummary(this.projectId);
            const project = this.project;
            
            let y = 20;
            
            // Header
            doc.setFontSize(20);
            doc.setTextColor(14, 165, 233);
            doc.text('Maviya Constructions', 105, y, { align: 'center' });
            y += 10;
            
            doc.setFontSize(16);
            doc.setTextColor(51, 65, 85);
            doc.text('Fund Management Status Report', 105, y, { align: 'center' });
            y += 15;
            
            // Project Info Box
            doc.setFillColor(14, 165, 233);
            doc.roundedRect(20, y, 170, 12, 3, 3, 'F');
            doc.setFontSize(12);
            doc.setTextColor(255, 255, 255);
            doc.text(project.name, 105, y + 8, { align: 'center' });
            y += 20;
            
            // Project Details
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85);
            doc.text(`Client: ${project.clientName}`, 20, y);
            doc.text(`Location: ${project.location}`, 120, y);
            y += 6;
            doc.text(`Status: ${project.status}`, 20, y);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 120, y);
            y += 15;
            
            // Virtual Wallet Summary
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(20, y, 170, 35, 3, 3, 'F');
            y += 8;
            doc.setFontSize(12);
            doc.setTextColor(14, 165, 233);
            doc.text('Virtual Wallet Summary', 105, y, { align: 'center' });
            y += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85);
            const col1 = 35, col2 = 105;
            doc.text('Virtual Balance:', col1, y);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.virtualBalance)}`, col1 + 50, y);
            doc.text('Advance Received:', col2, y);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.advanceReceived)}`, col2 + 50, y);
            y += 7;
            doc.text('Loans Given:', col1, y);
            doc.setTextColor(245, 158, 11);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.activeLoansGiven)}`, col1 + 50, y);
            doc.setTextColor(51, 65, 85);
            doc.text('Loans Received:', col2, y);
            doc.setTextColor(239, 68, 68);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.activeLoansReceived)}`, col2 + 50, y);
            y += 7;
            doc.setTextColor(51, 65, 85);
            doc.text('Net Available:', col1, y);
            if (fundSummary.netAvailableBalance >= 0) {
                doc.setTextColor(16, 185, 129);
            } else {
                doc.setTextColor(239, 68, 68);
            }
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.netAvailableBalance)}`, col1 + 50, y);
            y += 20;
            
            // Payment Allocations
            const allocations = await Storage.paymentAllocations.getByProject(this.projectId);
            if (allocations.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(16, 185, 129);
                doc.text('Payment Allocations Received', 20, y);
                y += 8;
                
                const allocationData = await Promise.all(allocations.map(async (alloc) => {
                    const payment = await Storage.clientPayments.getById(alloc.paymentId);
                    return [
                        Utils.formatDate(alloc.date),
                        payment ? payment.from : 'N/A',
                        `Rs. ${Utils.formatNumber(alloc.amount)}`,
                        alloc.description || 'Payment allocation'
                    ];
                }));
                
                doc.autoTable({
                    startY: y,
                    head: [['Date', 'From', 'Amount', 'Description']],
                    body: allocationData,
                    theme: 'striped',
                    headStyles: { fillColor: [16, 185, 129] },
                    margin: { left: 20, right: 20 }
                });
                
                y = doc.lastAutoTable.finalY + 15;
            }
            
            // Active Loans Given
            const loansGiven = await Storage.crossProjectTransactions.getByLender(this.projectId);
            const activeLoansGiven = loansGiven.filter(loan => loan.status === 'active');
            if (activeLoansGiven.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(245, 158, 11);
                doc.text('Active Loans Given to Other Projects', 20, y);
                y += 8;
                
                const loanData = await Promise.all(activeLoansGiven.map(async (loan) => {
                    const borrowerProject = await Storage.projects.getById(loan.borrowerProjectId);
                    const balance = loan.amount - (loan.settlementAmount || 0);
                    return [
                        borrowerProject ? borrowerProject.name : 'Unknown',
                        Utils.formatDate(loan.date),
                        `Rs. ${Utils.formatNumber(loan.amount)}`,
                        `Rs. ${Utils.formatNumber(loan.settlementAmount || 0)}`,
                        `Rs. ${Utils.formatNumber(balance)}`,
                        loan.description
                    ];
                }));
                
                doc.autoTable({
                    startY: y,
                    head: [['Borrower Project', 'Date', 'Original', 'Settled', 'Outstanding', 'Description']],
                    body: loanData,
                    theme: 'striped',
                    headStyles: { fillColor: [245, 158, 11] },
                    margin: { left: 20, right: 20 }
                });
                
                y = doc.lastAutoTable.finalY + 15;
            }
            
            // Active Loans Received
            const loansReceived = await Storage.crossProjectTransactions.getByBorrower(this.projectId);
            const activeLoansReceived = loansReceived.filter(loan => loan.status === 'active');
            if (activeLoansReceived.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(239, 68, 68);
                doc.text('Active Loans Received from Other Projects', 20, y);
                y += 8;
                
                const loanData = await Promise.all(activeLoansReceived.map(async (loan) => {
                    const lenderProject = await Storage.projects.getById(loan.lenderProjectId);
                    const balance = loan.amount - (loan.settlementAmount || 0);
                    return [
                        lenderProject ? lenderProject.name : 'Unknown',
                        Utils.formatDate(loan.date),
                        `Rs. ${Utils.formatNumber(loan.amount)}`,
                        `Rs. ${Utils.formatNumber(loan.settlementAmount || 0)}`,
                        `Rs. ${Utils.formatNumber(balance)}`,
                        loan.description
                    ];
                }));
                
                doc.autoTable({
                    startY: y,
                    head: [['Lender Project', 'Date', 'Original', 'Settled', 'Outstanding', 'Description']],
                    body: loanData,
                    theme: 'striped',
                    headStyles: { fillColor: [239, 68, 68] },
                    margin: { left: 20, right: 20 }
                });
                
                y = doc.lastAutoTable.finalY + 15;
            }
            
            // Cross-Project Expenses
            const materials = await Storage.materials.getByProject(this.projectId);
            const labour = await Storage.labour.getByProject(this.projectId);
            const expenses = await Storage.expenses.getByProject(this.projectId);
            
            const crossProjectItems = [
                ...materials.filter(m => m.paidViaCrossProject),
                ...labour.filter(l => l.paidViaCrossProject),
                ...expenses.filter(e => e.paidViaCrossProject)
            ];
            
            if (crossProjectItems.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(139, 92, 246);
                doc.text('Cross-Project Expenses (Paid by Other Projects)', 20, y);
                y += 8;
                
                const expenseData = crossProjectItems.map(item => {
                    const amount = item.amount || (item.quantity * item.rate) || item.totalAmount || 0;
                    const description = item.name || item.description || `${item.workerName} (${item.role})` || 'Unknown';
                    const type = item.name ? 'Material' : item.workerName ? 'Labour' : 'Expense';
                    
                    return [
                        Utils.formatDate(item.date),
                        type,
                        description,
                        `Rs. ${Utils.formatNumber(amount)}`
                    ];
                });
                
                doc.autoTable({
                    startY: y,
                    head: [['Date', 'Type', 'Description', 'Amount']],
                    body: expenseData,
                    theme: 'striped',
                    headStyles: { fillColor: [139, 92, 246] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Maviya Constructions - ${project.name} Fund Status`, 20, 290);
                doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
            }
            
            // Save
            doc.save(`${project.name.replace(/[^a-z0-9]/gi, '_')}_Fund_Status.pdf`);
            this.showToast('Fund status PDF downloaded!', 'success');
            
        } catch (error) {
            console.error('Fund status PDF generation error:', error);
            this.showToast('Failed to generate fund status PDF: ' + error.message, 'error');
        }
    },

    showToast(msg, type = 'info') {
        document.querySelector('.toast')?.remove();
        const t = document.createElement('div'); t.className = `toast ${type}`;
        t.innerHTML = `<i class="fas fa-check-circle mr-2 text-sky-500"></i>${msg}`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
    },

    // PDF Generation - Complete Project Report
    async generatePDF() {
        this.showToast('Generating complete PDF report...', 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Fetch all data
            const materials = await Storage.materials.getByProject(this.projectId);
            const labour = await Storage.labour.getByProject(this.projectId);
            const expenses = await Storage.expenses.getByProject(this.projectId);
            const logs = await Storage.logs.getByProject(this.projectId);
            const clientPayments = await Storage.clientPayments.getByProject(this.projectId);
            const documents = await Storage.documents.getByProject(this.projectId);
            
            const spent = await this.calculateTotalSpent();
            const budget = await this.getEffectiveBudget();
            const clientReceived = clientPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            
            let y = 20;
            
            // ===== PAGE 1: COVER & SUMMARY =====
            // Header
            doc.setFontSize(24);
            doc.setTextColor(14, 165, 233);
            doc.text('Maviya Constructions', 105, y, { align: 'center' });
            y += 12;
            
            doc.setFontSize(18);
            doc.setTextColor(51, 65, 85);
            doc.text('Project Report', 105, y, { align: 'center' });
            y += 15;
            
            // Project Name Box
            doc.setFillColor(14, 165, 233);
            doc.roundedRect(20, y, 170, 15, 3, 3, 'F');
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text(this.project.name, 105, y + 10, { align: 'center' });
            y += 25;
            
            // Project Details
            doc.setFontSize(11);
            doc.setTextColor(51, 65, 85);
            doc.text(`Client: ${this.project.clientName}`, 20, y);
            doc.text(`Location: ${this.project.location}`, 120, y);
            y += 7;
            doc.text(`Status: ${this.project.status}`, 20, y);
            doc.text(`Progress: ${this.calculateProgress()}%`, 120, y);
            y += 7;
            doc.text(`Start Date: ${Utils.formatDate(this.project.startDate)}`, 20, y);
            doc.text(`End Date: ${Utils.formatDate(this.project.endDate)}`, 120, y);
            y += 15;
            
            // Financial Summary Box
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(20, y, 170, 45, 3, 3, 'F');
            y += 8;
            doc.setFontSize(12);
            doc.setTextColor(14, 165, 233);
            doc.text('Financial Summary', 105, y, { align: 'center' });
            y += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85);
            const col1 = 35, col2 = 105;
            doc.text('Total Budget:', col1, y);
            doc.text(`Rs. ${Utils.formatNumber(budget)}`, col1 + 50, y);
            doc.text('Total Spent:', col2, y);
            doc.text(`Rs. ${Utils.formatNumber(spent)}`, col2 + 50, y);
            y += 7;
            doc.text('Remaining:', col1, y);
            if (budget - spent >= 0) {
                doc.setTextColor(16, 185, 129);
            } else {
                doc.setTextColor(239, 68, 68);
            }
            doc.text(`Rs. ${Utils.formatNumber(budget - spent)}`, col1 + 50, y);
            doc.setTextColor(51, 65, 85);
            doc.text('Budget Used:', col2, y);
            doc.text(`${Math.round((spent / budget) * 100)}%`, col2 + 50, y);
            y += 7;
            doc.text('Client Received:', col1, y);
            doc.setTextColor(16, 185, 129);
            doc.text(`Rs. ${Utils.formatNumber(clientReceived)}`, col1 + 50, y);
            doc.setTextColor(51, 65, 85);
            doc.text('Client Pending:', col2, y);
            doc.setTextColor(239, 68, 68);
            doc.text(`Rs. ${Utils.formatNumber(budget - clientReceived)}`, col2 + 50, y);
            y += 20;
            
            // Cost Breakdown
            const matTotal = materials.filter(m => m.status === 'used').reduce((s, m) => s + (m.quantity * m.rate), 0);
            const labTotal = labour.reduce((s, l) => s + (parseFloat(l.totalAmount) || 0), 0);
            const expTotal = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            
            doc.setTextColor(51, 65, 85);
            doc.setFontSize(12);
            doc.text('Cost Breakdown', 20, y);
            y += 8;
            
            doc.autoTable({
                startY: y,
                head: [['Category', 'Amount', 'Percentage']],
                body: [
                    ['Materials', `Rs. ${Utils.formatNumber(matTotal)}`, `${spent > 0 ? Math.round((matTotal / spent) * 100) : 0}%`],
                    ['Labour', `Rs. ${Utils.formatNumber(labTotal)}`, `${spent > 0 ? Math.round((labTotal / spent) * 100) : 0}%`],
                    ['Expenses', `Rs. ${Utils.formatNumber(expTotal)}`, `${spent > 0 ? Math.round((expTotal / spent) * 100) : 0}%`],
                    ['TOTAL', `Rs. ${Utils.formatNumber(spent)}`, '100%']
                ],
                theme: 'grid',
                headStyles: { fillColor: [14, 165, 233] },
                footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
                margin: { left: 20, right: 20 },
                columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 60, halign: 'right' }, 2: { cellWidth: 50, halign: 'center' } }
            });
            
            // ===== PAGE 2: MATERIALS =====
            if (materials.length > 0) {
                doc.addPage();
                y = 20;
                doc.setFontSize(14);
                doc.setTextColor(14, 165, 233);
                doc.text('Materials', 20, y);
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Total: Rs. ${Utils.formatNumber(matTotal)}`, 160, y);
                y += 8;
                
                const matPaid = materials.reduce((s, m) => s + (parseFloat(m.paidAmount) || 0), 0);
                
                doc.autoTable({
                    startY: y,
                    head: [['Material', 'Category', 'Qty', 'Unit', 'Rate', 'Total', 'Paid', 'Balance', 'Status', 'Date']],
                    body: materials.map(m => {
                        const total = m.quantity * m.rate;
                        const paid = m.paidAmount || 0;
                        return [
                            m.name, m.category, m.quantity, m.unit,
                            `Rs. ${Utils.formatNumber(m.rate)}`,
                            `Rs. ${Utils.formatNumber(total)}`,
                            `Rs. ${Utils.formatNumber(paid)}`,
                            `Rs. ${Utils.formatNumber(total - paid)}`,
                            m.status, Utils.formatDate(m.date)
                        ];
                    }),
                    theme: 'striped',
                    headStyles: { fillColor: [14, 165, 233], fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 10, right: 10 }
                });
                
                // Materials Summary
                y = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(10);
                doc.text(`Total Amount: Rs. ${Utils.formatNumber(matTotal)}  |  Total Paid: Rs. ${Utils.formatNumber(matPaid)}  |  Balance: Rs. ${Utils.formatNumber(matTotal - matPaid)}`, 20, y);
            }
            
            // ===== PAGE 3: LABOUR =====
            if (labour.length > 0) {
                doc.addPage();
                y = 20;
                doc.setFontSize(14);
                doc.setTextColor(16, 185, 129);
                doc.text('Labour', 20, y);
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Total: Rs. ${Utils.formatNumber(labTotal)}`, 160, y);
                y += 8;
                
                const labPaid = labour.reduce((s, l) => s + (parseFloat(l.paidAmount) || 0), 0);
                
                doc.autoTable({
                    startY: y,
                    head: [['Worker Name', 'Role', 'Daily Wage', 'Total Amount', 'Paid', 'Balance', 'Start Date', 'End Date']],
                    body: labour.map(l => {
                        const total = l.totalAmount || 0;
                        const paid = l.paidAmount || 0;
                        return [
                            l.workerName, l.role,
                            `Rs. ${Utils.formatNumber(l.dailyWage)}`,
                            `Rs. ${Utils.formatNumber(total)}`,
                            `Rs. ${Utils.formatNumber(paid)}`,
                            `Rs. ${Utils.formatNumber(total - paid)}`,
                            Utils.formatDate(l.startDate),
                            l.endDate ? Utils.formatDate(l.endDate) : '-'
                        ];
                    }),
                    theme: 'striped',
                    headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 10, right: 10 }
                });
                
                y = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(10);
                doc.text(`Total Wages: Rs. ${Utils.formatNumber(labTotal)}  |  Total Paid: Rs. ${Utils.formatNumber(labPaid)}  |  Balance: Rs. ${Utils.formatNumber(labTotal - labPaid)}`, 20, y);
            }
            
            // ===== PAGE 4: EXPENSES =====
            if (expenses.length > 0) {
                doc.addPage();
                y = 20;
                doc.setFontSize(14);
                doc.setTextColor(139, 92, 246);
                doc.text('Expenses', 20, y);
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Total: Rs. ${Utils.formatNumber(expTotal)}`, 160, y);
                y += 8;
                
                doc.autoTable({
                    startY: y,
                    head: [['Description', 'Category', 'Amount', 'Date']],
                    body: expenses.map(e => [
                        e.description, e.category,
                        `Rs. ${Utils.formatNumber(e.amount)}`,
                        Utils.formatDate(e.date)
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [139, 92, 246] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // ===== PAGE 5: CLIENT PAYMENTS =====
            if (clientPayments.length > 0) {
                doc.addPage();
                y = 20;
                doc.setFontSize(14);
                doc.setTextColor(59, 130, 246);
                doc.text('Client Payments Received', 20, y);
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Total Received: Rs. ${Utils.formatNumber(clientReceived)}`, 140, y);
                y += 8;
                
                doc.autoTable({
                    startY: y,
                    head: [['Date', 'Amount', 'From', 'Received By', 'Method', 'Notes']],
                    body: clientPayments.map(p => [
                        Utils.formatDate(p.date),
                        `Rs. ${Utils.formatNumber(p.amount)}`,
                        p.from, p.receivedBy, p.method, p.notes || '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [59, 130, 246] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // ===== PAGE 6: DAILY LOGS =====
            if (logs.length > 0) {
                doc.addPage();
                y = 20;
                doc.setFontSize(14);
                doc.setTextColor(20, 184, 166);
                doc.text('Daily Site Logs', 20, y);
                y += 8;
                
                logs.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                doc.autoTable({
                    startY: y,
                    head: [['Date', 'Work Description', 'Issues/Delays', 'Notes']],
                    body: logs.map(l => [
                        Utils.formatDate(l.date),
                        l.description,
                        l.issues || '-',
                        l.notes || '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [20, 184, 166] },
                    margin: { left: 20, right: 20 },
                    columnStyles: { 1: { cellWidth: 60 }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 } }
                });
            }
            
            // ===== PAGE 8: DOCUMENTS LIST =====
            if (documents.length > 0) {
                doc.addPage();
                y = 20;
                doc.setFontSize(14);
                doc.setTextColor(236, 72, 153);
                doc.text('Documents', 20, y);
                y += 8;
                
                doc.autoTable({
                    startY: y,
                    head: [['Document Name', 'Category', 'Date', 'File Name', 'Notes']],
                    body: documents.map(d => [
                        d.name, d.category,
                        d.docDate ? Utils.formatDate(d.docDate) : '-',
                        d.fileName, d.notes || '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [236, 72, 153] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // Footer on all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Maviya Constructions - ${this.project.name}`, 20, 290);
                doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
            }
            
            // Save
            doc.save(`${this.project.name.replace(/[^a-z0-9]/gi, '_')}_Complete_Report.pdf`);
            this.showToast('Complete PDF report downloaded!', 'success');
            
        } catch (error) {
            console.error('PDF generation error:', error);
            this.showToast('Failed to generate PDF: ' + error.message, 'error');
        }
    },

    async generateInvoice(type) {
        this.showToast(`Generating ${type} invoice...`, 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            let y = 20;
            let data = [];
            let title = '';
            let headers = [];
            let color = [14, 165, 233];
            
            if (type === 'materials') {
                title = 'Materials Invoice';
                headers = [['Material', 'Qty', 'Unit', 'Rate', 'Total', 'Paid', 'Balance']];
                const materials = await Storage.materials.getByProject(this.projectId);
                data = materials.filter(m => m.status === 'used').map(m => {
                    const total = m.quantity * m.rate;
                    const paid = m.paidAmount || 0;
                    return [m.name, m.quantity, m.unit, `Rs. ${Utils.formatNumber(m.rate)}`, `Rs. ${Utils.formatNumber(total)}`, `Rs. ${Utils.formatNumber(paid)}`, `Rs. ${Utils.formatNumber(total - paid)}`];
                });
                color = [14, 165, 233];
            } else if (type === 'labour') {
                title = 'Labour Invoice';
                headers = [['Worker', 'Role', 'Total Amount', 'Paid', 'Balance']];
                const labour = await Storage.labour.getByProject(this.projectId);
                data = labour.map(l => {
                    const total = l.totalAmount || 0;
                    const paid = l.paidAmount || 0;
                    return [l.workerName, l.role, `Rs. ${Utils.formatNumber(total)}`, `Rs. ${Utils.formatNumber(paid)}`, `Rs. ${Utils.formatNumber(total - paid)}`];
                });
                color = [16, 185, 129];
            } else if (type === 'expenses') {
                title = 'Expenses Invoice';
                headers = [['Description', 'Category', 'Amount', 'Date']];
                const expenses = await Storage.expenses.getByProject(this.projectId);
                data = expenses.map(e => [e.description, e.category, `Rs. ${Utils.formatNumber(e.amount)}`, Utils.formatDate(e.date)]);
                color = [139, 92, 246];
            } else if (type === 'client') {
                title = 'Client Payment Receipt';
                headers = [['Date', 'Amount', 'From', 'Received By', 'Method']];
                const payments = await Storage.clientPayments.getByProject(this.projectId);
                data = payments.map(p => [Utils.formatDate(p.date), `Rs. ${Utils.formatNumber(p.amount)}`, p.from, p.receivedBy, p.method]);
                color = [59, 130, 246];
            }
            
            // Header
            doc.setFontSize(18);
            doc.setTextColor(14, 165, 233);
            doc.text('Maviya Constructions', 105, y, { align: 'center' });
            y += 8;
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(title, 105, y, { align: 'center' });
            y += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Project: ${this.project.name}`, 20, y);
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 150, y);
            y += 6;
            doc.text(`Client: ${this.project.clientName}`, 20, y);
            y += 10;
            
            // Table
            if (data.length > 0) {
                doc.autoTable({
                    startY: y,
                    head: headers,
                    body: data,
                    theme: 'striped',
                    headStyles: { fillColor: color },
                    margin: { left: 20, right: 20 }
                });
            } else {
                doc.text('No records found', 105, y + 10, { align: 'center' });
            }
            
            // Save
            doc.save(`${this.project.name.replace(/[^a-z0-9]/gi, '_')}_${type}_Invoice.pdf`);
            this.showToast('Invoice downloaded!', 'success');
            
        } catch (error) {
            console.error('Invoice generation error:', error);
            this.showToast('Failed to generate invoice', 'error');
        }
    },

    // CSV Export functions
    async exportMaterials() {
        const materials = await Storage.materials.getByProject(this.projectId);
        const data = materials.map(m => ({
            'Material': m.name,
            'Category': m.category,
            'Quantity': m.quantity,
            'Unit': m.unit,
            'Rate': m.rate,
            'Total': m.quantity * m.rate,
            'Paid': m.paidAmount || 0,
            'Status': m.status,
            'Date': m.date,
            'Supplier': m.supplier || ''
        }));
        Utils.exportToCSV(data, `${this.project.name}_Materials.csv`);
        this.showToast('Materials CSV downloaded!', 'success');
    },

    async exportLabour() {
        const labour = await Storage.labour.getByProject(this.projectId);
        const data = labour.map(l => ({
            'Worker': l.workerName,
            'Role': l.role,
            'Daily Wage': l.dailyWage,
            'Total Amount': l.totalAmount || 0,
            'Paid': l.paidAmount || 0,
            'Balance': (l.totalAmount || 0) - (l.paidAmount || 0),
            'Start Date': l.startDate,
            'End Date': l.endDate || ''
        }));
        Utils.exportToCSV(data, `${this.project.name}_Labour.csv`);
        this.showToast('Labour CSV downloaded!', 'success');
    },

    async exportExpenses() {
        const expenses = await Storage.expenses.getByProject(this.projectId);
        const data = expenses.map(e => ({
            'Description': e.description,
            'Category': e.category,
            'Amount': e.amount,
            'Date': e.date
        }));
        Utils.exportToCSV(data, `${this.project.name}_Expenses.csv`);
        this.showToast('Expenses CSV downloaded!', 'success');
    }
};

// Make ProjectApp available globally
window.ProjectApp = ProjectApp;

// Export for manual initialization
export { ProjectApp };
