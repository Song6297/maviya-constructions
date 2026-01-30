// Project Detail Page Logic - Firebase Version
import Storage from './firebase-storage.js';
import FinancialCalculator from './financial-calculator.js';
import FundManagement from './fund-management.js';

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
        
        try {
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
            console.log('ProjectApp.init() completed successfully');
        } catch (error) {
            console.error('Error initializing project:', error);
            this.showToast('Error loading project. Please refresh.', 'error');
        } finally {
            this.showLoading(false);
        }
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
            if (reopenBtn) reopenBtn.classList.remove('hidden');
            document.querySelectorAll('.btn-add, .btn-primary, .action-btn:not(.delete), #exportDropdown').forEach(btn => {
                if (btn.id !== 'reopenProjectBtn') {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                }
            });
            this.showToast('Project is completed and locked. Click Re-open to make changes.', 'info');
        } else {
            if (reopenBtn) reopenBtn.classList.add('hidden');
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
        const materialSelect = document.getElementById('materialSelect');
        const materialCategory = document.getElementById('materialCategory');
        const materialUnit = document.getElementById('materialUnit');
        const docCategory = document.getElementById('docCategory');
        const docCategoryFilter = document.getElementById('docCategoryFilter');
        
        if (materialSelect) materialSelect.innerHTML = '<option value="">Select</option>' + MATERIAL_LIST.map(m => `<option value="${m}">${m}</option>`).join('');
        if (materialCategory) materialCategory.innerHTML = MATERIAL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        if (materialUnit) materialUnit.innerHTML = MATERIAL_UNITS.map(u => `<option value="${u.value}">${u.label}</option>`).join('');
        if (docCategory) docCategory.innerHTML = DOC_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        if (docCategoryFilter) docCategoryFilter.innerHTML = '<option value="all">All Types</option>' + DOC_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    renderHeader() {
        document.getElementById('projectTitle').textContent = this.project.name;
        const statusEl = document.getElementById('projectStatus');
        statusEl.textContent = this.project.status;
        statusEl.className = `status-badge ${this.getStatusClass(this.project.status)}`;
        document.title = `${this.project.name} - Maviya Constructions`;
    },

    async checkBudgetAlerts() {
        const alert = document.getElementById('budgetAlert');
        const title = document.getElementById('budgetAlertTitle');
        const text = document.getElementById('budgetAlertText');
        
        // Skip if elements don't exist
        if (!alert || !title || !text) return;
        
        const spent = await this.calculateTotalSpent();
        const budget = await this.getEffectiveBudget();
        const health = Utils.getBudgetHealth(spent, budget);

        if (health.status === 'over') {
            alert.className = 'budget-alert danger';
            title.textContent = '⚠️ Budget Exceeded!';
            text.textContent = `Over budget by ₹${Utils.formatNumber(spent - budget)}. Review expenses immediately.`;
            alert.classList.remove('hidden');
        } else if (health.status === 'critical') {
            alert.className = 'budget-alert danger';
            title.textContent = '🔴 Critical: 90%+ Budget Used';
            text.textContent = `Only ₹${Utils.formatNumber(budget - spent)} remaining. Proceed with caution.`;
            alert.classList.remove('hidden');
        } else if (health.status === 'warning') {
            alert.className = 'budget-alert warning';
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
                // Get OVERALL fund status (single bank account across all projects)
                const overallStatus = await FundManagement.getOverallFundStatus();
                const totalVirtualBalance = overallStatus.totalVirtualBalance || 0; // Total money in bank (all projects)
                const totalSpentAllProjects = overallStatus.totalSpent || 0; // Total spent across all projects
                const netAvailable = totalVirtualBalance - totalSpentAllProjects; // What's left in bank
                const hasLoans = overallStatus.totalActiveLoans > 0;
                
                fundStatusCard = `
                    <div class="metric-card rounded-lg p-4 ${hasLoans ? 'border-amber-200 bg-amber-50' : ''}">
                        <p class="text-slate-600 text-sm">Total Bank Balance</p>
                        <p class="font-semibold text-emerald-600 text-xl">₹${Utils.formatNumber(totalVirtualBalance)}</p>
                        <p class="text-xs text-slate-500 mt-1">All projects combined</p>
                    </div>
                    <div class="metric-card rounded-lg p-4">
                        <p class="text-slate-600 text-sm">Net Available</p>
                        <p class="font-semibold text-${netAvailable >= 0 ? 'emerald' : 'rose'}-600 text-xl">₹${Utils.formatNumber(netAvailable)}</p>
                        <p class="text-xs text-slate-500 mt-1">${netAvailable >= 0 ? 'Available in bank' : 'Deficit'}</p>
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
                <div class="health-meter mt-2"><div class="health-indicator health-${health.color}" style="left:${Math.min(98, health.percent)}%"></div></div>
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
        // Tab switching is handled in the inline script in project.html

        // Add button event listeners with null checks
        const addMaterialBtn = document.getElementById('addMaterialBtn');
        if (addMaterialBtn) {
            addMaterialBtn.addEventListener('click', () => this.openModal('material'));
        }
        
        const addLabourBtn = document.getElementById('addLabourBtn');
        if (addLabourBtn) {
            addLabourBtn.addEventListener('click', () => {
                this.openModal('labour');
            });
        }
        
        const addVendorBtn = document.getElementById('addVendorBtn');
        if (addVendorBtn) {
            addVendorBtn.addEventListener('click', () => this.openModal('vendor'));
        }
        
        const addExpenseBtn = document.getElementById('addExpenseBtn');
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', () => this.openModal('expense'));
        }
        
        const addDocBtn = document.getElementById('addDocBtn');
        if (addDocBtn) {
            addDocBtn.addEventListener('click', () => this.openModal('document'));
        }
        
        const addLogBtn = document.getElementById('addLogBtn');
        if (addLogBtn) {
            addLogBtn.addEventListener('click', () => this.openModal('log'));
        }
        
        const addClientPaymentBtn = document.getElementById('addClientPaymentBtn');
        if (addClientPaymentBtn) {
            addClientPaymentBtn.addEventListener('click', () => this.openModal('clientPayment'));
        }

        // Worker Management Event Listeners
        const markAttendanceBtn = document.getElementById('markAttendanceBtn');
        if (markAttendanceBtn) {
            markAttendanceBtn.addEventListener('click', () => {
                this.openAttendanceSheet();
            });
        }
        
        const workerSelect = document.getElementById('workerSelect');
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

        // Form submit handlers with null checks
        const materialForm = document.getElementById('materialForm');
        if (materialForm) {
            materialForm.addEventListener('submit', e => this.handleMaterialSubmit(e));
        }
        
        const labourForm = document.getElementById('labourForm');
        if (labourForm) {
            labourForm.addEventListener('submit', e => this.handleLabourSubmit(e));
        }
        
        const vendorForm = document.getElementById('vendorForm');
        if (vendorForm) {
            vendorForm.addEventListener('submit', e => this.handleVendorSubmit(e));
        }
        
        const expenseForm = document.getElementById('expenseForm');
        if (expenseForm) {
            expenseForm.addEventListener('submit', e => this.handleExpenseSubmit(e));
        }
        
        const documentForm = document.getElementById('documentForm');
        if (documentForm) {
            documentForm.addEventListener('submit', e => this.handleDocumentSubmit(e));
        }
        
        const logForm = document.getElementById('logForm');
        if (logForm) {
            logForm.addEventListener('submit', e => this.handleLogSubmit(e));
        }
        
        const clientPaymentForm = document.getElementById('clientPaymentForm');
        if (clientPaymentForm) {
            clientPaymentForm.addEventListener('submit', e => this.handleClientPaymentSubmit(e));
        }
        
        const workerPaymentForm = document.getElementById('workerPaymentForm');
        if (workerPaymentForm) {
            workerPaymentForm.addEventListener('submit', e => this.handleWorkerPaymentSubmit(e));
        }
        
        const vendorPaymentForm = document.getElementById('vendorPaymentForm');
        if (vendorPaymentForm) {
            vendorPaymentForm.addEventListener('submit', e => this.handleVendorPaymentSubmit(e));
        }

        // Material select and filters
        const materialSelect = document.getElementById('materialSelect');
        if (materialSelect) {
            materialSelect.addEventListener('change', e => {
                const customDiv = document.getElementById('customMaterialDiv');
                if (customDiv) {
                    customDiv.classList.toggle('hidden', e.target.value !== 'Other');
                }
            });
        }
        
        const materialStatusFilter = document.getElementById('materialStatusFilter');
        if (materialStatusFilter) {
            materialStatusFilter.addEventListener('change', e => { this.materialFilter = e.target.value; this.renderMaterials(); });
        }
        
        const docCategoryFilter = document.getElementById('docCategoryFilter');
        if (docCategoryFilter) {
            docCategoryFilter.addEventListener('change', e => { this.docFilter = e.target.value; this.renderDocuments(); });
        }

        // Modal close handlers
        document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => btn.addEventListener('click', () => this.closeAllModals()));
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.addEventListener('click', e => { if (e.target === modal) this.closeAllModals(); }));

        // Delete modal handlers
        const cancelDelete = document.getElementById('cancelDelete');
        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => this.closeDeleteModal());
        }
        
        const confirmDelete = document.getElementById('confirmDelete');
        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.confirmDelete());
        }
        
        // Fund Status Event Listeners
        const refreshFundStatusBtn = document.getElementById('refreshFundStatusBtn');
        if (refreshFundStatusBtn) {
            refreshFundStatusBtn.addEventListener('click', () => this.renderFundStatus());
        }

        const recalculateWalletBtn = document.getElementById('recalculateWalletBtn');
        if (recalculateWalletBtn) {
            recalculateWalletBtn.addEventListener('click', () => this.recalculateWallet());
        }

        // Floor Plan Event Listeners
        const addFloorPlanBtn = document.getElementById('addFloorPlanBtn');
        if (addFloorPlanBtn) {
            addFloorPlanBtn.addEventListener('click', () => this.openFloorPlanModal());
        }

        const floorPlanForm = document.getElementById('floorPlanForm');
        if (floorPlanForm) {
            floorPlanForm.addEventListener('submit', e => this.handleFloorPlanSubmit(e));
        }

        const floorPlanFile = document.getElementById('floorPlanFile');
        if (floorPlanFile) {
            floorPlanFile.addEventListener('change', e => this.previewFloorPlanFile(e));
        }

        // 3D Floor Plan Viewer Controls
        const floorPlanZoomIn = document.getElementById('floorPlanZoomIn');
        if (floorPlanZoomIn) {
            floorPlanZoomIn.addEventListener('click', () => this.zoom3DFloorPlan(1));
        }

        const floorPlanZoomOut = document.getElementById('floorPlanZoomOut');
        if (floorPlanZoomOut) {
            floorPlanZoomOut.addEventListener('click', () => this.zoom3DFloorPlan(-1));
        }

        const floorPlanResetView = document.getElementById('floorPlanResetView');
        if (floorPlanResetView) {
            floorPlanResetView.addEventListener('click', () => this.reset3DView());
        }

        const floorPlanRotateX = document.getElementById('floorPlanRotateX');
        if (floorPlanRotateX) {
            floorPlanRotateX.addEventListener('click', () => this.rotate3DFloorPlanX());
        }

        const floorPlanRotateY = document.getElementById('floorPlanRotateY');
        if (floorPlanRotateY) {
            floorPlanRotateY.addEventListener('click', () => this.rotate3DFloorPlanY());
        }

        const floorPlanToggle3D = document.getElementById('floorPlanToggle3D');
        if (floorPlanToggle3D) {
            floorPlanToggle3D.addEventListener('click', () => this.toggle3DMode());
        }

        // Cleanup 3D viewer when modal closes
        document.querySelectorAll('#floorPlanViewerModal .close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.cleanup3DViewer());
        });
    },

    async switchTab(tabName) {
        // Check premium for restricted tabs
        const premiumTabs = ['floorplans', 'funds', 'documents'];
        if (premiumTabs.includes(tabName)) {
            const isPremium = await this.checkUserPremiumForFeatures();
            if (!isPremium) {
                this.showPremiumRequiredModal(tabName);
                return;
            }
        }
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        if (tabName === 'summary') await this.renderSummary();
        if (tabName === 'funds') await this.renderFundStatus();
        if (tabName === 'vendors') await this.renderVendors();
        if (tabName === 'floorplans') await this.renderFloorPlans();
    },
    
    async checkUserPremiumForFeatures() {
        try {
            const { auth, db } = await import('./firebase-config.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const user = auth.currentUser;
            if (!user) return false;
            
            // Admin and Saqlain have access to premium features
            if (user.email === 'sulaimaansong6297@gmail.com' || user.email === 'saqlainmohammed1122@gmail.com') {
                return true;
            }
            
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) return false;
            
            const userData = userDoc.data();
            if (userData.premiumStatus !== 'PREMIUM') return false;
            
            if (userData.premiumEnd) {
                const endDate = userData.premiumEnd.toDate ? userData.premiumEnd.toDate() : new Date(userData.premiumEnd);
                if (endDate <= new Date()) return false;
            }
            
            return true;
        } catch (error) {
            console.error('Premium check error:', error);
            return false;
        }
    },
    
    showPremiumRequiredModal(feature) {
        const featureNames = {
            'floorplans': '3D Floor Plans',
            'funds': 'Fund Management',
            'documents': 'Documents'
        };
        
        const modal = document.createElement('div');
        modal.id = 'premiumRequiredModal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001; padding: 1rem;" onclick="if(event.target === this) this.remove();">
                <div style="background: white; border-radius: 24px; padding: 2rem; max-width: 400px; text-align: center; box-shadow: 0 25px 80px rgba(0,0,0,0.3);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: #2C3E50; margin-bottom: 0.5rem;">Premium Feature</h3>
                    <p style="color: #7F8C8D; margin-bottom: 1.5rem;">
                        <strong>${featureNames[feature] || feature}</strong> is a premium feature. Upgrade to unlock this and many more powerful features!
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center;">
                        <a href="upgrade.html" style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #5D4E00; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 800; text-decoration: none;">Upgrade Now</a>
                        <button onclick="document.getElementById('premiumRequiredModal').remove();" style="background: #E8F4F8; color: #5B9BD5; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 800; border: none; cursor: pointer;">Maybe Later</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async renderAllTabs() {
        try { await this.renderMaterials(); } catch (e) { console.error('Error rendering materials:', e); }
        try { await this.renderLabour(); } catch (e) { console.error('Error rendering labour:', e); }
        try { await this.renderVendors(); } catch (e) { console.error('Error rendering vendors:', e); }
        try { await this.renderExpenses(); } catch (e) { console.error('Error rendering expenses:', e); }
        try { await this.renderDocuments(); } catch (e) { console.error('Error rendering documents:', e); }
        try { await this.renderLogs(); } catch (e) { console.error('Error rendering logs:', e); }
        try { await this.renderFloorPlans(); } catch (e) { console.error('Error rendering floor plans:', e); }
    },

    // Materials
    async renderMaterials() {
        let materials = await Storage.materials.getByProject(this.projectId);
        if (this.materialFilter !== 'all') materials = materials.filter(m => m.status === this.materialFilter);
        
        const tbody = document.getElementById('materialsTableBody');
        const empty = document.getElementById('materialsEmpty');
        const totalRow = document.getElementById('materialsTotalRow');

        if (!tbody || !empty || !totalRow) return;

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

        const paidAmount = parseFloat(document.getElementById('materialPaidAmount').value) || 0;
        const data = {
            projectId: this.projectId, name,
            category: document.getElementById('materialCategory').value,
            unit: document.getElementById('materialUnit').value,
            quantity: parseFloat(document.getElementById('materialQty').value),
            rate: parseFloat(document.getElementById('materialRate').value),
            status: document.getElementById('materialStatus').value,
            date: document.getElementById('materialDate').value,
            supplier: document.getElementById('materialSupplier').value.trim(),
            paidAmount: paidAmount
        };

        this.showLoading(true);
        
        // Get old paid amount if updating
        let oldPaidAmount = 0;
        if (id) {
            const oldMaterial = await Storage.materials.getById(id);
            oldPaidAmount = parseFloat(oldMaterial?.paidAmount) || 0;
        }
        
        if (id) {
            await Storage.materials.update(id, data);
        } else {
            await Storage.materials.add(data);
        }
        
        // Deduct paid amount from fund balance
        if (window.FundManagement && paidAmount > 0) {
            try {
                const wallet = await window.FundManagement.initializeProjectWallet(this.projectId);
                const currentBalance = parseFloat(wallet.virtualBalance) || 0;
                const balanceChange = id ? (oldPaidAmount - paidAmount) : -paidAmount;
                await window.FundManagement.updateProjectWallet(this.projectId, {
                    virtualBalance: currentBalance + balanceChange
                });
            } catch (err) {
                console.warn('Fund balance update skipped:', err);
            }
        }
        
        this.closeAllModals(); await this.renderMaterials(); await this.renderOverview(); await this.checkBudgetAlerts();
        this.showLoading(false);
        this.showToast('Material saved', 'success');
    },


    // Labour - Simplified view using Labour Calendar data
    async renderLabour() {
        const listContainer = document.getElementById('labourSimpleList');
        const empty = document.getElementById('labourEmpty');
        const totalWorkersEl = document.getElementById('labourTotalWorkers');
        const totalEarnedEl = document.getElementById('labourTotalEarned');
        const totalPaidEl = document.getElementById('labourTotalPaidSummary');
        const totalDueEl = document.getElementById('labourTotalDue');

        if (!listContainer) {
            console.warn('Labour list container not found');
            return;
        }

        try {
            // Import LabourCalendar dynamically
            const { default: LabourCalendar } = await import('./labour-calendar.js');
            
            // Get project labour summary
            const summary = await LabourCalendar.getProjectLabourSummary(this.projectId);
            
            if (!summary || !summary.workers || summary.workers.length === 0) {
                listContainer.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
                if (totalWorkersEl) totalWorkersEl.textContent = '0';
                if (totalEarnedEl) totalEarnedEl.textContent = '₹0';
                if (totalPaidEl) totalPaidEl.textContent = '₹0';
                if (totalDueEl) totalDueEl.textContent = '₹0';
                return;
            }

            if (empty) empty.classList.add('hidden');

            // Update totals
            if (totalWorkersEl) totalWorkersEl.textContent = summary.totals.totalWorkers;
            if (totalEarnedEl) totalEarnedEl.textContent = `₹${summary.totals.totalEarned.toLocaleString('en-IN')}`;
            if (totalPaidEl) totalPaidEl.textContent = `₹${summary.totals.totalPaid.toLocaleString('en-IN')}`;
            if (totalDueEl) totalDueEl.textContent = `₹${summary.totals.totalDue.toLocaleString('en-IN')}`;

            // Helper function to format date
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                const date = new Date(dateStr + 'T00:00:00');
                return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            };

            // Render worker list with date details
            listContainer.innerHTML = summary.workers.map(worker => {
                // Safely get arrays with defaults
                const paidDates = worker.paidDates || [];
                const unpaidDates = worker.unpaidDates || [];
                const paidDaysCount = worker.paidDaysCount || 0;
                const unpaidDaysCount = worker.unpaidDaysCount || 0;
                
                // Build paid dates badges (show last 5)
                const paidDatesHtml = paidDates.length > 0 
                    ? `<div class="flex flex-wrap gap-1 mt-1">
                        ${paidDates.slice(-5).map(d => `
                            <span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded" title="₹${(d.earned || 0).toLocaleString('en-IN')}">
                                ${formatDate(d.date)} ✓
                            </span>
                        `).join('')}
                        ${paidDates.length > 5 ? `<span class="text-xs text-slate-400">+${paidDates.length - 5} more</span>` : ''}
                       </div>`
                    : '';
                
                // Build unpaid dates badges (show all, max 5)
                const unpaidDatesHtml = unpaidDates.length > 0 
                    ? `<div class="flex flex-wrap gap-1 mt-1">
                        ${unpaidDates.slice(0, 5).map(d => `
                            <span class="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-xs rounded" title="₹${(d.earned || 0).toLocaleString('en-IN')} due">
                                ${formatDate(d.date)} ₹${(d.earned || 0).toLocaleString('en-IN')}
                            </span>
                        `).join('')}
                        ${unpaidDates.length > 5 ? `<span class="text-xs text-slate-400">+${unpaidDates.length - 5} more</span>` : ''}
                       </div>`
                    : '';

                return `
                <div class="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition mb-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-sm">
                                ${(worker.labourName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p class="font-semibold text-slate-800">${worker.labourName || 'Unknown'}</p>
                                <p class="text-xs text-slate-500">${worker.workType || 'General'} • ${worker.daysWorked || 0} days worked</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-right">
                                <p class="font-semibold ${worker.status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}">
                                    ${worker.status === 'paid' ? 'Fully Paid' : `₹${(worker.totalDue || 0).toLocaleString('en-IN')} due`}
                                </p>
                                <p class="text-xs text-slate-500">Earned: ₹${(worker.totalEarned || 0).toLocaleString('en-IN')}</p>
                            </div>
                            ${worker.status !== 'paid' ? `
                                <button onclick="ProjectApp.quickPayLabour('${worker.labourId}', '${worker.labourName || 'Worker'}', ${worker.totalDue || 0})" 
                                    class="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition">
                                    <i class="fas fa-money-bill-wave mr-1"></i> Pay
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Date Details Section -->
                    <div class="mt-2 pt-2 border-t border-slate-200">
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span class="text-slate-500 font-medium">
                                    <i class="fas fa-check-circle text-emerald-500 mr-1"></i>
                                    Paid Days (${paidDaysCount}):
                                </span>
                                ${paidDates.length > 0 ? paidDatesHtml : '<span class="text-slate-400 ml-1">None</span>'}
                            </div>
                            <div>
                                <span class="text-slate-500 font-medium">
                                    <i class="fas fa-clock text-rose-500 mr-1"></i>
                                    Unpaid Days (${unpaidDaysCount}):
                                </span>
                                ${unpaidDates.length > 0 ? unpaidDatesHtml : '<span class="text-emerald-500 ml-1">All paid!</span>'}
                            </div>
                        </div>
                    </div>
                </div>
            `}).join('');

        } catch (error) {
            console.error('Error rendering labour summary:', error);
            
            // Check if it's a permission error
            const isPermissionError = error.message && error.message.includes('permission');
            
            listContainer.innerHTML = `
                <div class="text-center py-4 text-slate-500">
                    <i class="fas fa-exclamation-circle text-2xl mb-2 ${isPermissionError ? 'text-amber-500' : ''}"></i>
                    <p>${isPermissionError ? 'Firebase permissions not configured' : 'Error loading labour data'}</p>
                    ${isPermissionError ? `
                        <p class="text-xs mt-1 text-amber-600">Please copy rules from firestore-rules.md to Firebase Console</p>
                    ` : ''}
                    <a href="labour-calendar.html" class="text-sky-600 underline text-sm block mt-2">Open Labour Calendar</a>
                </div>
            `;
        }
    },

    // Quick pay labour from project page
    async quickPayLabour(labourId, labourName, dueAmount) {
        const amount = prompt(`Pay ${labourName}\nAmount due: ₹${dueAmount.toLocaleString('en-IN')}\n\nEnter payment amount:`);
        if (!amount) return;
        
        const payAmount = parseFloat(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }
        
        try {
            const { default: LabourCalendar } = await import('./labour-calendar.js');
            await LabourCalendar.processPaymentWithFundUpdate({
                labourId,
                projectId: this.projectId,
                amount: payAmount,
                paymentDate: new Date().toISOString().split('T')[0],
                paymentMethod: 'Cash'
            });
            
            this.showToast(`Payment of ₹${payAmount.toLocaleString('en-IN')} recorded for ${labourName}`, 'success');
            await this.renderLabour();
            await this.renderOverview();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    // Vendors - Using VendorManagement System
    async renderVendors() {
        if (window.VendorManagement) {
            await window.VendorManagement.renderVendors(this.projectId);
        } else {
            // Fallback if VendorManagement not loaded
            const container = document.getElementById('vendorCardsContainer');
            const empty = document.getElementById('vendorEmpty');
            const totalRow = document.getElementById('vendorTotalRow');
            
            if (container) container.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            if (totalRow) totalRow.classList.add('hidden');
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

        if (!tbody || !empty || !totalRow) return;

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
                    <button class="action-btn" onclick="ProjectApp.generateExpenseInvoice('${exp.id}')" title="Generate Invoice"><i class="fas fa-file-invoice text-xs"></i></button>
                    <button class="action-btn" onclick="ProjectApp.shareItemWhatsApp('expense','${exp.id}')"><i class="fab fa-whatsapp text-xs"></i></button>
                    <button class="action-btn" onclick="ProjectApp.openModal('expense','${exp.id}')"><i class="fas fa-pen text-xs"></i></button>
                    <button class="action-btn delete" onclick="ProjectApp.openDeleteModal('expense','${exp.id}')"><i class="fas fa-trash text-xs"></i></button>
                </div></td>
            </tr>`;
        }).join('');
        document.getElementById('expensesTotalAmount').textContent = `₹${Utils.formatNumber(total)}`;
    },

    // Generate Invoice for Expense
    async generateExpenseInvoice(expenseId) {
        this.showToast('Generating invoice...', 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Get expense data
            const expense = await Storage.expenses.getById(expenseId);
            if (!expense) {
                this.showToast('Expense not found', 'error');
                return;
            }
            
            // Theme Colors (B&B Construction Theme)
            const colors = {
                primary: [47, 47, 47],
                secondary: [183, 200, 184],
                accent: [74, 124, 89],
                dark: [44, 62, 80],
                light: [241, 245, 249],
                white: [255, 255, 255]
            };
            
            // Get user profile data
            let companyName = 'B&B Constructions';
            let userName = 'Builder';
            let userEmail = '';
            let companyAddress = '';
            try {
                const { auth, db } = await import('./firebase-config.js');
                const { doc: docRef, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const user = auth.currentUser;
                if (user) {
                    userEmail = user.email || '';
                    userName = user.email?.split('@')[0] || 'Builder';
                    const prefsDoc = await getDoc(docRef(db, 'user_preferences', user.uid));
                    if (prefsDoc.exists()) {
                        const prefs = prefsDoc.data();
                        if (prefs.companyName) companyName = prefs.companyName;
                        if (prefs.displayName) userName = prefs.displayName;
                        if (prefs.address) companyAddress = prefs.address;
                    }
                }
            } catch (e) { console.log('Using default company name'); }
            
            // Generate invoice number
            const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}`;
            
            let y = 15;
            
            // Header bar
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, 210, 12, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(0, 12, 210, 3, 'F');
            
            // Company Logo - B&B brick pattern
            y = 28;
            doc.setFillColor(...colors.primary);
            doc.rect(22, 20, 8, 8, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(32, 20, 8, 8, 'F');
            doc.setFillColor(...colors.primary);
            doc.rect(27, 30, 8, 8, 'F');
            
            // Company Header
            doc.setFontSize(20);
            doc.setTextColor(...colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 50, y);
            y += 6;
            doc.setFontSize(9);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text('Construction Management', 50, y);
            if (companyAddress) {
                y += 4;
                doc.text(companyAddress, 50, y);
            }
            y += 4;
            doc.text(`Email: ${userEmail}`, 50, y);
            
            // Invoice Title
            y = 28;
            doc.setFontSize(24);
            doc.setTextColor(...colors.accent);
            doc.setFont('helvetica', 'bold');
            doc.text('INVOICE', 190, y, { align: 'right' });
            y += 8;
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text(`Invoice No: ${invoiceNo}`, 190, y, { align: 'right' });
            y += 5;
            doc.text(`Date: ${Utils.formatDate(new Date().toISOString())}`, 190, y, { align: 'right' });
            
            y = 65;
            
            // Project Info Box
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 25, 3, 3, 'F');
            doc.setDrawColor(...colors.accent);
            doc.setLineWidth(0.5);
            doc.roundedRect(20, y, 170, 25, 3, 3, 'S');
            
            y += 8;
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'bold');
            doc.text('Project Details', 25, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.text(`Project: ${this.project.name}`, 25, y);
            doc.text(`Client: ${this.project.clientName}`, 115, y);
            y += 5;
            doc.text(`Location: ${this.project.location}`, 25, y);
            
            y += 20;
            
            // Expense Details Table
            doc.setFillColor(...colors.accent);
            doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(...colors.white);
            doc.setFont('helvetica', 'bold');
            doc.text('EXPENSE DETAILS', 105, y + 6, { align: 'center' });
            y += 12;
            
            doc.autoTable({
                startY: y,
                head: [['Description', 'Category', 'Date', 'Amount']],
                body: [
                    [
                        expense.description || 'N/A',
                        expense.category || 'General',
                        Utils.formatDate(expense.date),
                        `Rs. ${Utils.formatNumber(expense.amount)}`
                    ]
                ],
                theme: 'grid',
                headStyles: { fillColor: colors.accent, fontSize: 10, fontStyle: 'bold' },
                bodyStyles: { fontSize: 10 },
                margin: { left: 20, right: 20 },
                columnStyles: { 
                    0: { cellWidth: 70 }, 
                    1: { cellWidth: 40 }, 
                    2: { cellWidth: 35 },
                    3: { cellWidth: 25, halign: 'right' }
                }
            });
            
            y = doc.lastAutoTable.finalY + 10;
            
            // Total Box
            doc.setFillColor(...colors.secondary);
            doc.roundedRect(120, y, 70, 15, 2, 2, 'F');
            doc.setFontSize(12);
            doc.setTextColor(...colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL:', 125, y + 10);
            doc.text(`Rs. ${Utils.formatNumber(expense.amount)}`, 185, y + 10, { align: 'right' });
            
            y += 30;
            
            // Notes
            if (expense.notes) {
                doc.setFontSize(10);
                doc.setTextColor(...colors.dark);
                doc.setFont('helvetica', 'bold');
                doc.text('Notes:', 20, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                doc.text(expense.notes, 20, y);
            }
            
            // Footer
            doc.setFillColor(...colors.light);
            doc.rect(0, 275, 210, 22, 'F');
            doc.setFontSize(8);
            doc.setTextColor(...colors.dark);
            doc.text(`${companyName} - ${this.project.name}`, 20, 282);
            doc.text(`Generated by: ${userName} | ${new Date().toLocaleString('en-IN')}`, 20, 288);
            doc.text('Thank you for your business!', 190, 285, { align: 'right' });
            
            // Save
            doc.save(`Invoice_${invoiceNo}_${expense.description.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.pdf`);
            this.showToast('Invoice generated successfully!', 'success');
            
        } catch (error) {
            console.error('Invoice generation error:', error);
            this.showToast('Failed to generate invoice: ' + error.message, 'error');
        }
    },

    // Generate All Expense Invoices as a single PDF
    async generateAllExpenseInvoices() {
        this.showToast('Generating all invoices...', 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Get all expenses
            const expenses = await Storage.expenses.getByProject(this.projectId);
            
            if (!expenses || expenses.length === 0) {
                this.showToast('No expenses to generate invoices for', 'info');
                return;
            }
            
            // Theme Colors
            const colors = {
                primary: [47, 47, 47],
                secondary: [183, 200, 184],
                accent: [74, 124, 89],
                dark: [44, 62, 80],
                light: [241, 245, 249],
                white: [255, 255, 255]
            };
            
            // Get user profile data
            let companyName = 'B&B Constructions';
            let userName = 'Builder';
            let userEmail = '';
            try {
                const { auth, db } = await import('./firebase-config.js');
                const { doc: docRef, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const user = auth.currentUser;
                if (user) {
                    userEmail = user.email || '';
                    userName = user.email?.split('@')[0] || 'Builder';
                    const prefsDoc = await getDoc(docRef(db, 'user_preferences', user.uid));
                    if (prefsDoc.exists()) {
                        const prefs = prefsDoc.data();
                        if (prefs.companyName) companyName = prefs.companyName;
                        if (prefs.displayName) userName = prefs.displayName;
                    }
                }
            } catch (e) { console.log('Using default company name'); }
            
            // Cover Page
            let y = 15;
            
            // Header bar
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, 210, 12, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(0, 12, 210, 3, 'F');
            
            // Company Logo
            y = 28;
            doc.setFillColor(...colors.primary);
            doc.rect(22, 20, 8, 8, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(32, 20, 8, 8, 'F');
            doc.setFillColor(...colors.primary);
            doc.rect(27, 30, 8, 8, 'F');
            
            // Header
            doc.setFontSize(22);
            doc.setTextColor(...colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 50, y);
            y += 7;
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text('Construction Management', 50, y);
            y += 20;
            
            // Title
            doc.setFillColor(...colors.accent);
            doc.roundedRect(20, y, 170, 15, 3, 3, 'F');
            doc.setFontSize(16);
            doc.setTextColor(...colors.white);
            doc.setFont('helvetica', 'bold');
            doc.text('EXPENSE INVOICES REPORT', 105, y + 10, { align: 'center' });
            y += 25;
            
            // Project Info
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 25, 3, 3, 'F');
            y += 8;
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'bold');
            doc.text('Project Details', 25, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            doc.text(`Project: ${this.project.name}`, 25, y);
            doc.text(`Client: ${this.project.clientName}`, 115, y);
            y += 5;
            doc.text(`Location: ${this.project.location}`, 25, y);
            doc.text(`Total Expenses: ${expenses.length}`, 115, y);
            y += 15;
            
            // Summary Table
            const totalAmount = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            
            doc.autoTable({
                startY: y,
                head: [['#', 'Description', 'Category', 'Date', 'Amount']],
                body: expenses.map((exp, idx) => [
                    idx + 1,
                    exp.description || 'N/A',
                    exp.category || 'General',
                    Utils.formatDate(exp.date),
                    `Rs. ${Utils.formatNumber(exp.amount)}`
                ]),
                foot: [['', '', '', 'TOTAL', `Rs. ${Utils.formatNumber(totalAmount)}`]],
                theme: 'grid',
                headStyles: { fillColor: colors.accent, fontSize: 9, fontStyle: 'bold' },
                bodyStyles: { fontSize: 9 },
                footStyles: { fillColor: colors.secondary, textColor: colors.primary, fontStyle: 'bold' },
                margin: { left: 20, right: 20 },
                columnStyles: { 
                    0: { cellWidth: 10 },
                    1: { cellWidth: 60 }, 
                    2: { cellWidth: 30 }, 
                    3: { cellWidth: 30 },
                    4: { cellWidth: 40, halign: 'right' }
                }
            });
            
            // Footer on all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFillColor(...colors.light);
                doc.rect(0, 285, 210, 12, 'F');
                doc.setFontSize(8);
                doc.setTextColor(...colors.dark);
                doc.text(`${companyName} - ${this.project.name} Expenses`, 20, 291);
                doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Page ${i} of ${pageCount}`, 190, 291, { align: 'right' });
            }
            
            // Save
            doc.save(`${this.project.name.replace(/[^a-z0-9]/gi, '_')}_All_Expense_Invoices.pdf`);
            this.showToast(`Generated invoices for ${expenses.length} expenses!`, 'success');
            
        } catch (error) {
            console.error('All invoices generation error:', error);
            this.showToast('Failed to generate invoices: ' + error.message, 'error');
        }
    },

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('expenseId').value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const data = {
            projectId: this.projectId,
            description: document.getElementById('expenseDesc').value.trim(),
            category: document.getElementById('expenseCategory').value,
            amount: amount,
            date: document.getElementById('expenseDate').value
        };
        this.showLoading(true);
        
        // Get old amount if updating
        let oldAmount = 0;
        if (id) {
            const oldExpense = await Storage.expenses.getById(id);
            oldAmount = parseFloat(oldExpense?.amount) || 0;
        }
        
        if (id) {
            await Storage.expenses.update(id, data);
        } else {
            await Storage.expenses.add(data);
        }
        
        // Deduct from fund balance (or adjust if updating)
        if (window.FundManagement) {
            try {
                const wallet = await window.FundManagement.initializeProjectWallet(this.projectId);
                const currentBalance = parseFloat(wallet.virtualBalance) || 0;
                const balanceChange = id ? (oldAmount - amount) : -amount; // If updating, adjust difference
                await window.FundManagement.updateProjectWallet(this.projectId, {
                    virtualBalance: currentBalance + balanceChange
                });
            } catch (err) {
                console.warn('Fund balance update skipped:', err);
            }
        }
        
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

        if (!grid || !empty) return;

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
        const fileInput = document.getElementById('docFile');
        const file = fileInput?.files?.[0];
        if (!file) {
            this.showToast('Please select a file to upload', 'error');
            return;
        }
        
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
                // Get form values with null checks
                const docNameEl = document.getElementById('docName');
                const docCategoryEl = document.getElementById('docCategory');
                const docDateEl = document.getElementById('docDate');
                const docNotesEl = document.getElementById('docNotes');
                
                const docName = docNameEl?.value?.trim() || file.name;
                const docCategory = docCategoryEl?.value || 'Other';
                const docDate = docDateEl?.value || new Date().toISOString().split('T')[0];
                const docNotes = docNotesEl?.value?.trim() || '';
                
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
                        name: docName,
                        category: docCategory,
                        docDate: docDate,
                        notes: docNotes,
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
        reader.onerror = () => {
            console.error('Error reading file');
            this.showToast('Error reading file', 'error');
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

        if (!container || !empty) return;

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

    // Floor Plans
    async renderFloorPlans() {
        const floorPlans = this.project?.floorPlans || [];
        const container = document.getElementById('floorPlansGrid');
        const empty = document.getElementById('floorPlansEmpty');
        const addBtn = document.getElementById('addFloorPlanBtn');

        // Ensure required elements exist
        if (!container) {
            console.warn('Floor plans container not found');
            return;
        }

        // Handle empty state
        if (!floorPlans.length) { 
            container.innerHTML = ''; 
            if (empty) {
                empty.classList.remove('hidden');
                // Ensure empty state has add button
                if (!empty.querySelector('.btn-add')) {
                    empty.innerHTML = `
                        <i class="fas fa-drafting-compass"></i>
                        <p>No floor plans uploaded</p>
                        <button type="button" class="btn-add mt-4" onclick="ProjectApp.openFloorPlanModal()">
                            <i class="fas fa-upload"></i> Upload Floor Plan
                        </button>
                    `;
                }
            }
            return; 
        }
        
        if (empty) empty.classList.add('hidden');

        container.innerHTML = floorPlans.map((fp, index) => `
            <div class="floor-plan-card" data-index="${index}">
                <div class="floor-plan-thumbnail" onclick="ProjectApp.viewFloorPlan(${index})">
                    ${fp.fileType === 'pdf' 
                        ? `<i class="fas fa-file-pdf pdf-icon"></i>` 
                        : `<img src="${fp.dataUrl}" alt="${Utils.escapeHtml(fp.name || 'Floor Plan')}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-image text-4xl text-slate-400\\'></i>'">`
                    }
                </div>
                <div class="floor-plan-info">
                    <div class="floor-plan-name">${Utils.escapeHtml(fp.name || 'Untitled')}</div>
                    <div class="floor-plan-type text-xs text-slate-500">${Utils.escapeHtml(fp.type || 'Floor Plan')}</div>
                    ${fp.description ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${Utils.escapeHtml(fp.description)}</p>` : ''}
                    <div class="floor-plan-actions mt-2">
                        <button type="button" class="action-btn flex-1" onclick="event.stopPropagation(); ProjectApp.viewFloorPlan(${index})" title="View">
                            <i class="fas fa-expand"></i> View
                        </button>
                        <button type="button" class="action-btn flex-1" onclick="event.stopPropagation(); ProjectApp.downloadFloorPlan(${index})" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button type="button" class="action-btn delete" onclick="event.stopPropagation(); ProjectApp.deleteFloorPlan(${index})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    viewFloorPlan(index) {
        const floorPlans = this.project?.floorPlans || [];
        const fp = floorPlans[index];
        if (!fp) {
            this.showToast('Floor plan not found', 'error');
            return;
        }

        const modal = document.getElementById('floorPlanViewerModal');
        const title = document.getElementById('floorPlanViewerTitle');
        const loading = document.getElementById('floorPlan3DLoading');
        const content = document.getElementById('floorPlanViewerContent');
        const controls = document.getElementById('floorPlan3DControls');
        
        // Ensure modal elements exist
        if (!modal || !content) {
            console.error('Floor plan viewer modal elements not found');
            this.showToast('Unable to open viewer', 'error');
            return;
        }

        // Clean up any previous viewer
        this.cleanup3DViewer();
        
        // Reset content
        content.innerHTML = `
            <canvas id="floorPlan3DCanvas" style="width: 100%; height: 100%;"></canvas>
            <div id="floorPlan3DLoading" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(30, 41, 59, 0.9);">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-sky-500 mb-3"></i>
                    <p class="text-slate-400">Loading floor plan...</p>
                </div>
            </div>
        `;

        // Update title
        if (title) title.textContent = fp.name || 'Floor Plan';
        
        // Show modal with .active class pattern
        modal.classList.remove('hidden');
        modal.classList.add('active');

        // For PDFs, show in iframe (can't render in 3D)
        if (fp.fileType === 'pdf') {
            // Hide 3D controls for PDF
            if (controls) controls.style.display = 'none';
            
            content.innerHTML = `
                <iframe src="${fp.dataUrl}" style="width: 100%; height: 100%; border: none; background: white;"></iframe>
                <div style="position: absolute; bottom: 1rem; left: 1rem; background: rgba(30, 41, 59, 0.9); border-radius: 8px; padding: 0.75rem 1rem;">
                    <p class="text-slate-400 text-xs"><i class="fas fa-file-pdf mr-2 text-red-500"></i>PDF View - 3D not available for PDFs</p>
                </div>
            `;
            return;
        }

        // Show 3D controls for images
        if (controls) controls.style.display = 'flex';

        // Initialize 3D viewer for images
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            this.init3DFloorPlanViewer(fp.dataUrl);
        }, 100);
    },

    // 3D Floor Plan Viewer State
    floorPlan3D: {
        scene: null,
        camera: null,
        renderer: null,
        plane: null,
        controls: null,
        animationId: null,
        is3DMode: true,
        isDragging: false,
        previousMousePosition: { x: 0, y: 0 }
    },

    init3DFloorPlanViewer(imageUrl) {
        const canvas = document.getElementById('floorPlan3DCanvas');
        const container = document.getElementById('floorPlanViewerContent');
        const loading = document.getElementById('floorPlan3DLoading');

        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded');
            if (loading) {
                loading.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-4xl text-amber-500 mb-3"></i>
                        <p class="text-slate-400">3D viewer not available</p>
                        <p class="text-slate-500 text-sm mt-2">Showing 2D preview instead</p>
                    </div>
                `;
            }
            // Fallback to 2D image display
            setTimeout(() => {
                if (container) {
                    container.innerHTML = `
                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1e293b;">
                            <img src="${imageUrl}" alt="Floor Plan" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px;">
                        </div>
                    `;
                }
            }, 1000);
            return;
        }

        // Ensure canvas exists
        if (!canvas || !container) {
            console.error('Canvas or container not found');
            return;
        }

        // Clean up previous instance
        this.cleanup3DViewer();

        // Get container dimensions
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        try {
            // Create scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1e293b);

            // Create camera
            const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
            camera.position.set(0, 5, 5);
            camera.lookAt(0, 0, 0);

            // Create renderer
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            scene.add(ambientLight);

            // Add directional light
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(5, 10, 5);
            scene.add(directionalLight);

            // Add grid helper
            const gridHelper = new THREE.GridHelper(20, 20, 0x3b82f6, 0x334155);
            scene.add(gridHelper);

            // Load texture and create plane
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(imageUrl, (texture) => {
                // Calculate aspect ratio
                const imgAspect = texture.image.width / texture.image.height;
                const planeWidth = 8;
                const planeHeight = planeWidth / imgAspect;

                // Create plane geometry
                const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                const material = new THREE.MeshBasicMaterial({ 
                    map: texture, 
                    side: THREE.DoubleSide,
                    transparent: true
                });
                const plane = new THREE.Mesh(geometry, material);
                plane.rotation.x = -Math.PI / 2; // Lay flat
                plane.position.y = 0.01; // Slightly above grid
                scene.add(plane);

                // Store reference
                this.floorPlan3D.plane = plane;

                // Hide loading
                if (loading) loading.style.display = 'none';
            }, undefined, (error) => {
                console.error('Error loading floor plan texture:', error);
                if (loading) {
                    loading.innerHTML = `
                        <div class="text-center">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-3"></i>
                            <p class="text-slate-400">Failed to load floor plan</p>
                            <button type="button" class="btn btn-secondary mt-4" onclick="ProjectApp.closeAllModals()">Close</button>
                        </div>
                    `;
                }
            });

            // Store references
            this.floorPlan3D.scene = scene;
            this.floorPlan3D.camera = camera;
            this.floorPlan3D.renderer = renderer;
            this.floorPlan3D.is3DMode = true;

            // Add mouse controls
            this.setup3DControls(canvas, camera, scene);

            // Animation loop
            const animate = () => {
                this.floorPlan3D.animationId = requestAnimationFrame(animate);
                renderer.render(scene, camera);
            };
            animate();

            // Handle resize
            const handleResize = () => {
                const w = container.clientWidth || 800;
                const h = container.clientHeight || 600;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            };
            window.addEventListener('resize', handleResize);
            this.floorPlan3D.resizeHandler = handleResize;
            
        } catch (error) {
            console.error('Error initializing 3D viewer:', error);
            if (loading) {
                loading.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-3"></i>
                        <p class="text-slate-400">Error initializing 3D viewer</p>
                        <p class="text-slate-500 text-sm mt-2">${error.message}</p>
                    </div>
                `;
            }
        }
    },

    setup3DControls(canvas, camera, scene) {
        let isDragging = false;
        let isRightDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 8 };

        const updateCameraPosition = () => {
            camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
            camera.position.y = spherical.radius * Math.cos(spherical.phi);
            camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
            camera.lookAt(0, 0, 0);
        };
        updateCameraPosition();

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) isDragging = true;
            if (e.button === 2) isRightDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                
                spherical.theta -= deltaX * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, spherical.phi - deltaY * 0.01));
                
                updateCameraPosition();
            }
            if (isRightDragging && this.floorPlan3D.plane) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                this.floorPlan3D.plane.position.x += deltaX * 0.01;
                this.floorPlan3D.plane.position.z += deltaY * 0.01;
            }
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            isRightDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            isRightDragging = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            spherical.radius = Math.max(3, Math.min(20, spherical.radius + e.deltaY * 0.01));
            updateCameraPosition();
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Store for external access
        this.floorPlan3D.spherical = spherical;
        this.floorPlan3D.updateCameraPosition = updateCameraPosition;
    },

    cleanup3DViewer() {
        // Cancel animation frame
        if (this.floorPlan3D.animationId) {
            cancelAnimationFrame(this.floorPlan3D.animationId);
            this.floorPlan3D.animationId = null;
        }
        
        // Dispose of Three.js objects
        if (this.floorPlan3D.plane) {
            if (this.floorPlan3D.plane.geometry) {
                this.floorPlan3D.plane.geometry.dispose();
            }
            if (this.floorPlan3D.plane.material) {
                if (this.floorPlan3D.plane.material.map) {
                    this.floorPlan3D.plane.material.map.dispose();
                }
                this.floorPlan3D.plane.material.dispose();
            }
        }
        
        // Dispose of scene objects
        if (this.floorPlan3D.scene) {
            this.floorPlan3D.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
        
        // Dispose of renderer
        if (this.floorPlan3D.renderer) {
            this.floorPlan3D.renderer.dispose();
            this.floorPlan3D.renderer.forceContextLoss();
        }
        
        // Remove resize handler
        if (this.floorPlan3D.resizeHandler) {
            window.removeEventListener('resize', this.floorPlan3D.resizeHandler);
        }
        
        // Reset state
        this.floorPlan3D = {
            scene: null,
            camera: null,
            renderer: null,
            plane: null,
            controls: null,
            animationId: null,
            is3DMode: true,
            isDragging: false,
            previousMousePosition: { x: 0, y: 0 },
            spherical: null,
            updateCameraPosition: null,
            resizeHandler: null
        };
    },

    zoom3DFloorPlan(direction) {
        if (!this.floorPlan3D.spherical || !this.floorPlan3D.updateCameraPosition) return;
        this.floorPlan3D.spherical.radius = Math.max(3, Math.min(20, this.floorPlan3D.spherical.radius - direction * 1));
        this.floorPlan3D.updateCameraPosition();
    },

    rotate3DFloorPlanX() {
        if (!this.floorPlan3D.spherical || !this.floorPlan3D.updateCameraPosition) return;
        this.floorPlan3D.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.floorPlan3D.spherical.phi - 0.2));
        this.floorPlan3D.updateCameraPosition();
    },

    rotate3DFloorPlanY() {
        if (!this.floorPlan3D.spherical || !this.floorPlan3D.updateCameraPosition) return;
        this.floorPlan3D.spherical.theta += 0.3;
        this.floorPlan3D.updateCameraPosition();
    },

    reset3DView() {
        if (!this.floorPlan3D.spherical || !this.floorPlan3D.updateCameraPosition) return;
        this.floorPlan3D.spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 8 };
        if (this.floorPlan3D.plane) {
            this.floorPlan3D.plane.position.set(0, 0.01, 0);
        }
        this.floorPlan3D.updateCameraPosition();
    },

    toggle3DMode() {
        if (!this.floorPlan3D.plane || !this.floorPlan3D.spherical || !this.floorPlan3D.updateCameraPosition) return;
        
        this.floorPlan3D.is3DMode = !this.floorPlan3D.is3DMode;
        
        if (this.floorPlan3D.is3DMode) {
            // 3D perspective view
            this.floorPlan3D.spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 8 };
        } else {
            // Top-down 2D view
            this.floorPlan3D.spherical = { theta: 0, phi: 0.01, radius: 10 };
        }
        this.floorPlan3D.updateCameraPosition();
        
        // Update button icon
        const btn = document.getElementById('floorPlanToggle3D');
        if (btn) {
            btn.innerHTML = this.floorPlan3D.is3DMode ? '<i class="fas fa-cube"></i>' : '<i class="fas fa-square"></i>';
            btn.title = this.floorPlan3D.is3DMode ? 'Switch to 2D View' : 'Switch to 3D View';
        }
    },

    downloadFloorPlan(index) {
        const floorPlans = this.project?.floorPlans || [];
        const fp = floorPlans[index];
        if (!fp) return;

        const link = document.createElement('a');
        link.href = fp.dataUrl;
        link.download = `${fp.name}.${fp.fileType === 'pdf' ? 'pdf' : 'png'}`;
        link.click();
    },

    async deleteFloorPlan(index) {
        if (!confirm('Delete this floor plan?')) return;
        
        const floorPlans = this.project?.floorPlans || [];
        floorPlans.splice(index, 1);
        
        this.showLoading(true);
        await Storage.projects.update(this.projectId, { floorPlans });
        this.project.floorPlans = floorPlans;
        await this.renderFloorPlans();
        this.showLoading(false);
        this.showToast('Floor plan deleted', 'success');
    },

    async handleFloorPlanSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('floorPlanName')?.value?.trim();
        const typeSelect = document.getElementById('floorPlanType');
        const type = typeSelect?.value || 'Floor Plan';
        const descriptionInput = document.getElementById('floorPlanDescription');
        const description = descriptionInput?.value?.trim() || '';
        const fileInput = document.getElementById('floorPlanFile');
        
        if (!name) {
            this.showToast('Please enter a floor plan name', 'error');
            return;
        }
        
        if (!fileInput?.files?.length) {
            this.showToast('Please select a file', 'error');
            return;
        }

        const file = fileInput.files[0];
        
        // Validate file type - only PNG, JPG, PDF allowed
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf'];
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            this.showToast('Invalid file type. Only PNG, JPG, and PDF files are allowed.', 'error');
            return;
        }
        
        // Validate file size - max 10MB
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`, 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Convert file to base64
            const dataUrl = await this.fileToDataUrl(file);
            const fileType = file.type.includes('pdf') || fileExtension === 'pdf' ? 'pdf' : 'image';

            const floorPlan = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                name,
                type,
                description,
                fileType,
                dataUrl,
                uploadedAt: new Date().toISOString()
            };

            const floorPlans = this.project?.floorPlans || [];
            floorPlans.push(floorPlan);

            await Storage.projects.update(this.projectId, { floorPlans });
            this.project.floorPlans = floorPlans;

            this.closeAllModals();
            await this.renderFloorPlans();
            this.showToast('Floor plan uploaded', 'success');
        } catch (err) {
            console.error('Floor plan upload error:', err);
            this.showToast('Upload failed', 'error');
        }

        this.showLoading(false);
    },

    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    openFloorPlanModal() {
        const form = document.getElementById('floorPlanForm');
        const preview = document.getElementById('floorPlanPreview');
        const modal = document.getElementById('floorPlanModal');
        const typeSelect = document.getElementById('floorPlanType');
        const descriptionInput = document.getElementById('floorPlanDescription');
        
        // Reset form if it exists
        if (form) form.reset();
        
        // Reset type to default
        if (typeSelect) typeSelect.value = 'Floor Plan';
        
        // Clear description
        if (descriptionInput) descriptionInput.value = '';
        
        // Hide preview
        if (preview) preview.classList.add('hidden');
        
        // Show modal with .active class pattern
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    },

    previewFloorPlanFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const preview = document.getElementById('floorPlanPreview');
        const content = document.getElementById('floorPlanPreviewContent');
        
        if (!preview || !content) return;

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf'];
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            content.innerHTML = `
                <div class="text-center p-4 bg-red-50 rounded-lg">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-2"></i>
                    <p class="text-red-600 font-medium">Invalid file type</p>
                    <p class="text-red-500 text-sm">Only PNG, JPG, and PDF files are allowed.</p>
                </div>
            `;
            preview.classList.remove('hidden');
            return;
        }
        
        // Validate file size
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            content.innerHTML = `
                <div class="text-center p-4 bg-red-50 rounded-lg">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-2"></i>
                    <p class="text-red-600 font-medium">File too large</p>
                    <p class="text-red-500 text-sm">${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 10MB limit.</p>
                </div>
            `;
            preview.classList.remove('hidden');
            return;
        }

        if (file.type.includes('pdf') || fileExtension === 'pdf') {
            content.innerHTML = `
                <div class="text-center p-4 bg-slate-50 rounded-lg">
                    <i class="fas fa-file-pdf text-6xl text-red-500 mb-2"></i>
                    <p class="text-slate-600 font-medium">${Utils.escapeHtml(file.name)}</p>
                    <p class="text-slate-500 text-sm">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
            `;
            preview.classList.remove('hidden');
        } else if (file.type.includes('image') || ['png', 'jpg', 'jpeg'].includes(fileExtension)) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                content.innerHTML = `
                    <div class="text-center">
                        <img src="${ev.target.result}" alt="Preview" style="max-height: 200px; max-width: 100%; border-radius: 8px;">
                        <p class="text-slate-500 text-sm mt-2">${Utils.escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)</p>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
            preview.classList.remove('hidden');
        }
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
                const newPayment = await Storage.clientPayments.add(data);
                paymentId = newPayment?.id || newPayment;
                
                // Auto-allocate to fund management system
                if (window.FundManagement && paymentId && typeof paymentId === 'string') {
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
        const totalReceived = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const pending = budget - totalReceived;

        // Add null checks for all elements (clientTotalBudget doesn't exist in HTML)
        const receivedEl = document.getElementById('clientTotalReceived');
        const pendingEl = document.getElementById('clientTotalPending');
        
        if (receivedEl) receivedEl.textContent = `₹${Utils.formatNumber(totalReceived)}`;
        if (pendingEl) pendingEl.textContent = `₹${Utils.formatNumber(Math.max(0, pending))}`;

        const list = document.getElementById('clientPaymentsList');
        if (!list) return; // Exit if element doesn't exist
        
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
        
        // Use FinancialCalculator for precise arithmetic
        const balance = FinancialCalculator.subtract(budget, spent);
        
        // Use FinancialCalculator for budget health calculation
        const health = FinancialCalculator.getBudgetHealth(spent, budget);

        // Update display using FinancialCalculator formatting with null checks
        const summaryBudgetEl = document.getElementById('summaryBudget');
        const summarySpentEl = document.getElementById('summarySpent');
        const summaryBalanceEl = document.getElementById('summaryBalance');
        const summaryPercentEl = document.getElementById('summaryPercent');
        const healthIndicatorEl = document.getElementById('healthIndicator');
        
        if (summaryBudgetEl) summaryBudgetEl.textContent = FinancialCalculator.formatCurrencyWithSymbol(budget);
        if (summarySpentEl) summarySpentEl.textContent = FinancialCalculator.formatCurrencyWithSymbol(spent);
        if (summaryBalanceEl) summaryBalanceEl.textContent = FinancialCalculator.formatCurrencyWithSymbol(Math.abs(balance));
        if (summaryPercentEl) summaryPercentEl.textContent = `${Math.round(health.percent)}%`;
        if (healthIndicatorEl) healthIndicatorEl.style.left = `${Math.min(98, health.percent)}%`;

        // Update balance card with visual warning for over-budget
        const card = document.getElementById('summaryBalanceCard');
        if (card) {
            const balanceLabel = card.querySelector('p:first-child');
            
            if (health.isOverBudget) {
                // Over budget - show danger styling with visual warning
                card.className = 'summary-card danger';
                if (balanceLabel) balanceLabel.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i>Over Budget';
                card.style.animation = 'pulse 2s infinite';
            } else if (health.status === 'critical') {
                // Critical - 90%+ used
                card.className = 'summary-card warning';
                if (balanceLabel) balanceLabel.textContent = 'Remaining (Critical)';
                card.style.animation = '';
            } else if (health.status === 'warning') {
                // Warning - 80%+ used
                card.className = 'summary-card warning';
                if (balanceLabel) balanceLabel.textContent = 'Remaining (Warning)';
                card.style.animation = '';
            } else {
                // OK - under 80%
                card.className = 'summary-card success';
                if (balanceLabel) balanceLabel.textContent = 'Remaining';
                card.style.animation = '';
            }
        }
        
        await this.renderCharts();
    },

    async renderCharts() {
        // Use parallel Promise.all() for data fetching
        const [materials, labour, expenses, vendors] = await Promise.all([
            Storage.materials.getByProject(this.projectId),
            Storage.labour.getByProject(this.projectId),
            Storage.expenses.getByProject(this.projectId),
            Storage.vendors.getByProject(this.projectId)
        ]);

        // Use the new calculation methods with FinancialCalculator
        const matCost = this.calculateMaterialCost(materials);
        const labCost = this.calculateLabourCost(labour);
        const expCost = this.calculateExpenseCost(expenses);
        const venCost = this.calculateVendorCost(vendors);

        if (this.charts.expense) this.charts.expense.destroy();
        this.charts.expense = new Chart(document.getElementById('expenseChart'), {
            type: 'doughnut',
            data: { labels: ['Materials', 'Labour', 'Vendors', 'Expenses'], datasets: [{ data: [matCost, labCost, venCost, expCost], backgroundColor: ['#F59E0B', '#10B981', '#F97316', '#8B5CF6'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } } }
        });

        if (this.charts.budget) this.charts.budget.destroy();
        const budget = await this.getEffectiveBudget();
        const spent = await this.calculateTotalSpent();
        const health = FinancialCalculator.getBudgetHealth(spent, budget);
        
        this.charts.budget = new Chart(document.getElementById('budgetChart'), {
            type: 'bar',
            data: { labels: ['Budget', 'Spent'], datasets: [{ data: [budget, spent], backgroundColor: ['#3B82F6', health.isOverBudget ? '#DC2626' : '#10B981'], borderRadius: 8 }] },
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
        // Clean up 3D viewer if it's active
        this.cleanup3DViewer();
        
        // Close all modal overlays
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
        // Use parallel Promise.all() for data fetching (divide and conquer)
        const [materials, labour, expenses, vendors] = await Promise.all([
            Storage.materials.getByProject(this.projectId),
            Storage.labour.getByProject(this.projectId),
            Storage.expenses.getByProject(this.projectId),
            Storage.vendors.getByProject(this.projectId)
        ]);
        
        // Calculate each category using FinancialCalculator
        const materialCost = this.calculateMaterialCost(materials);
        const labourCost = this.calculateLabourCost(labour);
        const expenseCost = this.calculateExpenseCost(expenses);
        const vendorCost = this.calculateVendorCost(vendors);
        
        // Combine: Sum all costs using FinancialCalculator
        return FinancialCalculator.sum([materialCost, labourCost, expenseCost, vendorCost]);
    },

    /**
     * Calculate material cost: used materials - recovered materials
     * Requirements: 5.2
     * @param {Array} materials - Array of material records
     * @returns {number} Net material cost
     */
    calculateMaterialCost(materials) {
        if (!Array.isArray(materials)) return 0;
        
        // Calculate used materials cost
        const usedCost = materials
            .filter(m => m.status === 'used')
            .reduce((sum, m) => {
                const itemCost = FinancialCalculator.multiply(
                    parseFloat(m.quantity) || 0,
                    parseFloat(m.rate) || 0
                );
                return FinancialCalculator.add(sum, itemCost);
            }, 0);
        
        // Calculate recovered materials cost
        const recoveredCost = materials
            .filter(m => m.status === 'recovered')
            .reduce((sum, m) => {
                const itemCost = FinancialCalculator.multiply(
                    parseFloat(m.quantity) || 0,
                    parseFloat(m.rate) || 0
                );
                return FinancialCalculator.add(sum, itemCost);
            }, 0);
        
        // Net cost = used - recovered (can be negative if more recovered)
        const netCost = FinancialCalculator.subtract(usedCost, recoveredCost);
        return Math.max(0, netCost);
    },

    /**
     * Calculate labour cost: (daily wage × days worked) + (overtime rate × overtime hours)
     * Requirements: 5.3
     * @param {Array} labour - Array of labour records
     * @returns {number} Total labour cost
     */
    calculateLabourCost(labour) {
        if (!Array.isArray(labour)) return 0;
        
        return labour.reduce((sum, l) => {
            // If totalAmount is set, use it directly
            const totalAmount = parseFloat(l.totalAmount) || 0;
            if (totalAmount > 0) {
                return FinancialCalculator.add(sum, totalAmount);
            }
            
            // Otherwise calculate: (dailyWage × daysWorked) + (overtimeRate × overtimeHours)
            const basePay = FinancialCalculator.multiply(
                parseFloat(l.dailyWage) || 0,
                parseFloat(l.daysWorked) || 0
            );
            const overtimePay = FinancialCalculator.multiply(
                parseFloat(l.overtimeRate) || 0,
                parseFloat(l.overtimeHours) || 0
            );
            const labourTotal = FinancialCalculator.add(basePay, overtimePay);
            return FinancialCalculator.add(sum, labourTotal);
        }, 0);
    },

    /**
     * Calculate expense cost
     * @param {Array} expenses - Array of expense records
     * @returns {number} Total expense cost
     */
    calculateExpenseCost(expenses) {
        if (!Array.isArray(expenses)) return 0;
        
        return expenses.reduce((sum, e) => {
            return FinancialCalculator.add(sum, parseFloat(e.amount) || 0);
        }, 0);
    },

    /**
     * Calculate vendor cost
     * @param {Array} vendors - Array of vendor records
     * @returns {number} Total vendor cost
     */
    calculateVendorCost(vendors) {
        if (!Array.isArray(vendors)) return 0;
        
        return vendors.reduce((sum, v) => {
            return FinancialCalculator.add(sum, parseFloat(v.agreedCost) || 0);
        }, 0);
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
    
    /**
     * Render Fund Status tab with proper error handling and FinancialCalculator formatting
     * Requirements: 8.1, 8.2, 8.4
     */
    async renderFundStatus() {
        // Show loading state initially
        const containers = ['paymentAllocationsContainer', 'loansGivenContainer', 'loansReceivedContainer', 'crossProjectExpensesContainer'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '<div class="flex items-center justify-center py-4"><i class="fas fa-spinner fa-spin text-sky-500 mr-2"></i><span class="text-slate-500 text-sm">Loading...</span></div>';
            }
        });
        
        // Helper to safely set element text with zero fallback
        const setElementValue = (elementId, value, isNegativeAllowed = false) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.textContent = FinancialCalculator.formatCurrencyWithSymbol(value);
        };

        // Helper to set zero values on error (Requirement 8.2)
        const setZeroValues = () => {
            setElementValue('virtualBalance', 0);
            setElementValue('loansGiven', 0);
            setElementValue('loansReceived', 0);
            setElementValue('netAvailable', 0);
            
            // Reset net available styling
            const netAvailableEl = document.getElementById('netAvailable');
            if (netAvailableEl) {
                netAvailableEl.className = 'font-bold text-2xl';
                netAvailableEl.style.color = 'var(--success)';
            }
        };

        try {
            // Handle missing FundManagement module gracefully (Requirement 8.2)
            // Check both window.FundManagement and imported FundManagement
            const fundMgmt = window.FundManagement || FundManagement;
            
            if (!fundMgmt) {
                console.warn('FundManagement module not loaded - displaying zero values');
                setZeroValues();
                
                // Clear sub-containers with appropriate messages
                containers.forEach(id => {
                    const container = document.getElementById(id);
                    if (container) {
                        container.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">Fund management not available</p>';
                    }
                });
                return;
            }

            // Get OVERALL fund status (single bank account across all projects)
            const overallStatus = await fundMgmt.getOverallFundStatus();
            console.log('Overall Fund Status:', overallStatus);
            
            // Get project-specific data for loans
            const fundSummary = await fundMgmt.getProjectFinancialSummary(this.projectId);
            console.log('Project Fund Summary:', fundSummary);
            
            // Total Virtual Balance = Total money received across ALL projects (single bank account)
            const totalVirtualBalance = FinancialCalculator.parseAmount(overallStatus.totalVirtualBalance);
            
            // Total Spent across ALL projects
            const totalSpentAllProjects = FinancialCalculator.parseAmount(overallStatus.totalSpent);
            
            // Project-specific loans
            const loansGiven = FinancialCalculator.parseAmount(fundSummary.activeLoansGiven);
            const loansReceived = FinancialCalculator.parseAmount(fundSummary.activeLoansReceived);
            
            // Net Available = Total bank balance - Total spent across all projects
            const netAvailable = FinancialCalculator.subtract(totalVirtualBalance, totalSpentAllProjects);
            
            // Update virtual wallet metrics - show GLOBAL balance (single bank account)
            setElementValue('virtualBalance', totalVirtualBalance);
            setElementValue('loansGiven', loansGiven);
            setElementValue('loansReceived', loansReceived);
            setElementValue('netAvailable', netAvailable);
            
            // Color code net available based on positive/negative value (Requirement 8.4)
            const netAvailableEl = document.getElementById('netAvailable');
            if (netAvailableEl) {
                if (netAvailable >= 0) {
                    netAvailableEl.className = 'font-bold text-2xl';
                    netAvailableEl.style.color = 'var(--success)';
                } else {
                    netAvailableEl.className = 'font-bold text-2xl';
                    netAvailableEl.style.color = 'var(--error)';
                }
            }

            // Render payment allocations (Requirement 8.5)
            await this.renderPaymentAllocations();
            
            // Render loans given (Requirement 8.3)
            await this.renderLoansGiven();
            
            // Render loans received (Requirement 8.3)
            await this.renderLoansReceived();
            
            // Render cross-project expenses
            await this.renderCrossProjectExpenses();
            
        } catch (error) {
            console.error('Error rendering fund status:', error);
            // Display zero values on error (Requirement 8.2)
            setZeroValues();
            
            // Show error message in containers
            containers.forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = `<div class="text-center py-4"><i class="fas fa-exclamation-circle text-rose-500 text-2xl mb-2"></i><p class="text-rose-500 text-sm">Error loading data</p><p class="text-slate-400 text-xs mt-1">${error.message || 'Unknown error'}</p></div>`;
                }
            });
        }
    },

    /**
     * Recalculate wallet balance based on actual payment allocations
     * Fixes any discrepancies where virtualBalance was incorrectly set
     */
    async recalculateWallet() {
        if (!confirm('This will recalculate the wallet balance based on actual payment allocations. Continue?')) {
            return;
        }
        
        this.showToast('Recalculating wallet...', 'info');
        
        try {
            const fundMgmt = window.FundManagement || FundManagement;
            
            if (!fundMgmt || !fundMgmt.recalculateProjectWallet) {
                throw new Error('Fund Management module not available');
            }
            
            const result = await fundMgmt.recalculateProjectWallet(this.projectId);
            
            if (result.success) {
                this.showToast('Wallet recalculated successfully!', 'success');
                // Refresh the fund status display
                await this.renderFundStatus();
                // Also refresh overview to update the Virtual Balance card
                await this.renderOverview();
            } else {
                throw new Error('Recalculation failed');
            }
        } catch (error) {
            console.error('Error recalculating wallet:', error);
            this.showToast('Failed to recalculate wallet: ' + error.message, 'error');
        }
    },

    /**
     * Render payment allocations received by project
     * Requirements: 8.5
     * - Show allocations received by project
     * - Sort by date (newest first)
     * - Handle empty state
     */
    async renderPaymentAllocations() {
        const container = document.getElementById('paymentAllocationsContainer');
        if (!container) return;
        
        try {
            const allocations = await Storage.paymentAllocations.getByProject(this.projectId);
            
            // Handle empty state (Requirement 8.5)
            if (!allocations || !allocations.length) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-inbox text-slate-300 text-2xl mb-2"></i>
                        <p class="text-slate-500 text-sm">No payment allocations received</p>
                    </div>
                `;
                return;
            }
            
            // Sort by date (newest first) (Requirement 8.5)
            const sortedAllocations = [...allocations].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const items = await Promise.all(sortedAllocations.map(async (allocation) => {
                // Get the original payment details
                let paymentInfo = '';
                try {
                    // Validate paymentId is a string before querying
                    const paymentId = allocation.paymentId;
                    if (paymentId && typeof paymentId === 'string') {
                        const payment = await Storage.clientPayments.getById(paymentId);
                        if (payment) {
                            paymentInfo = `<p class="text-xs text-slate-500">From: ${Utils.escapeHtml(payment.from || 'Client')}</p>`;
                        }
                    }
                } catch (e) {
                    // Payment may have been deleted
                }
                
                // Use FinancialCalculator for formatting
                const formattedAmount = FinancialCalculator.formatCurrencyWithSymbol(allocation.amount);
                
                return `
                    <div class="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors">
                        <div>
                            <p class="font-semibold text-slate-800">${formattedAmount}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(allocation.date)}</p>
                            ${paymentInfo}
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-slate-600">${Utils.escapeHtml(allocation.description || 'Payment allocation')}</p>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-emerald-200 text-emerald-800 text-xs rounded-full">Received</span>
                        </div>
                    </div>
                `;
            }));
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering payment allocations:', error);
            container.innerHTML = '<p class="text-rose-500 text-sm">Error loading payment allocations</p>';
        }
    },

    /**
     * Render loans given to other projects
     * Requirements: 8.3
     * - Show only active (unsettled) loans
     * - Display outstanding balance, not original amount
     */
    async renderLoansGiven() {
        const container = document.getElementById('loansGivenContainer');
        if (!container) return;
        
        try {
            const loansGiven = await Storage.crossProjectTransactions.getByLender(this.projectId);
            
            // Filter to show only active (unsettled) loans (Requirement 8.3)
            const activeLoans = (loansGiven || []).filter(loan => loan && loan.status === 'active');
            
            // Handle empty state
            if (!activeLoans.length) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-hand-holding-usd text-slate-300 text-2xl mb-2"></i>
                        <p class="text-slate-500 text-sm">No active loans given</p>
                    </div>
                `;
                return;
            }
            
            // Sort by date (oldest first - FIFO order)
            const sortedLoans = [...activeLoans].sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const items = await Promise.all(sortedLoans.map(async (loan) => {
                let borrowerName = 'Unknown Project';
                try {
                    const borrowerProject = await Storage.projects.getById(loan.borrowerProjectId);
                    if (borrowerProject) {
                        borrowerName = borrowerProject.name;
                    }
                } catch (e) {
                    // Project may have been deleted
                }
                
                // Calculate outstanding balance, not original amount (Requirement 8.3)
                const outstandingBalance = FinancialCalculator.calculateOutstandingBalance(
                    loan.amount, 
                    loan.settlementAmount || 0
                );
                const formattedBalance = FinancialCalculator.formatCurrencyWithSymbol(outstandingBalance);
                const formattedOriginal = FinancialCalculator.formatCurrencyWithSymbol(loan.amount);
                
                // Show settlement progress if partially settled
                const settlementAmount = FinancialCalculator.parseAmount(loan.settlementAmount || 0);
                const hasPartialSettlement = settlementAmount > 0;
                
                return `
                    <div class="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                        <div>
                            <p class="font-semibold text-slate-800">${Utils.escapeHtml(borrowerName)}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(loan.date)}</p>
                            <p class="text-xs text-slate-500">${Utils.escapeHtml(loan.description || 'Cross-project loan')}</p>
                            ${hasPartialSettlement ? `<p class="text-xs text-emerald-600">Settled: ${FinancialCalculator.formatCurrencyWithSymbol(settlementAmount)}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-amber-600">${formattedBalance}</p>
                            <p class="text-xs text-slate-500">Outstanding</p>
                            ${hasPartialSettlement ? `<p class="text-xs text-slate-400">of ${formattedOriginal}</p>` : ''}
                        </div>
                    </div>
                `;
            }));
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering loans given:', error);
            container.innerHTML = '<p class="text-rose-500 text-sm">Error loading loans given</p>';
        }
    },

    /**
     * Render loans received from other projects
     * Requirements: 8.3
     * - Show only active (unsettled) loans
     * - Display outstanding balance, not original amount
     */
    async renderLoansReceived() {
        const container = document.getElementById('loansReceivedContainer');
        if (!container) return;
        
        try {
            const loansReceived = await Storage.crossProjectTransactions.getByBorrower(this.projectId);
            
            // Filter to show only active (unsettled) loans (Requirement 8.3)
            const activeLoans = (loansReceived || []).filter(loan => loan && loan.status === 'active');
            
            // Handle empty state
            if (!activeLoans.length) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-hand-holding-usd text-slate-300 text-2xl mb-2"></i>
                        <p class="text-slate-500 text-sm">No active loans received</p>
                    </div>
                `;
                return;
            }
            
            // Sort by date (oldest first - FIFO order for settlement priority)
            const sortedLoans = [...activeLoans].sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const items = await Promise.all(sortedLoans.map(async (loan) => {
                let lenderName = 'Unknown Project';
                try {
                    const lenderProject = await Storage.projects.getById(loan.lenderProjectId);
                    if (lenderProject) {
                        lenderName = lenderProject.name;
                    }
                } catch (e) {
                    // Project may have been deleted
                }
                
                // Calculate outstanding balance, not original amount (Requirement 8.3)
                const outstandingBalance = FinancialCalculator.calculateOutstandingBalance(
                    loan.amount, 
                    loan.settlementAmount || 0
                );
                const formattedBalance = FinancialCalculator.formatCurrencyWithSymbol(outstandingBalance);
                const formattedOriginal = FinancialCalculator.formatCurrencyWithSymbol(loan.amount);
                
                // Show settlement progress if partially settled
                const settlementAmount = FinancialCalculator.parseAmount(loan.settlementAmount || 0);
                const hasPartialSettlement = settlementAmount > 0;
                
                return `
                    <div class="flex justify-between items-center p-3 bg-rose-50 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors">
                        <div>
                            <p class="font-semibold text-slate-800">${Utils.escapeHtml(lenderName)}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(loan.date)}</p>
                            <p class="text-xs text-slate-500">${Utils.escapeHtml(loan.description || 'Cross-project loan')}</p>
                            ${hasPartialSettlement ? `<p class="text-xs text-emerald-600">Repaid: ${FinancialCalculator.formatCurrencyWithSymbol(settlementAmount)}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-rose-600">${formattedBalance}</p>
                            <p class="text-xs text-slate-500">Owed</p>
                            ${hasPartialSettlement ? `<p class="text-xs text-slate-400">of ${formattedOriginal}</p>` : ''}
                        </div>
                    </div>
                `;
            }));
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering loans received:', error);
            container.innerHTML = '<p class="text-rose-500 text-sm">Error loading loans received</p>';
        }
    },

    /**
     * Render cross-project expenses (items paid via cross-project funding)
     */
    async renderCrossProjectExpenses() {
        const container = document.getElementById('crossProjectExpensesContainer');
        if (!container) return;
        
        try {
            // Get all materials, labour, and expenses that were paid via cross-project
            const [materials, labour, expenses] = await Promise.all([
                Storage.materials.getByProject(this.projectId).catch(() => []),
                Storage.labour.getByProject(this.projectId).catch(() => []),
                Storage.expenses.getByProject(this.projectId).catch(() => [])
            ]);
            
            const crossProjectItems = [
                ...(materials || []).filter(m => m && m.paidViaCrossProject),
                ...(labour || []).filter(l => l && l.paidViaCrossProject),
                ...(expenses || []).filter(e => e && e.paidViaCrossProject)
            ];
            
            // Handle empty state
            if (!crossProjectItems.length) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-exchange-alt text-slate-300 text-2xl mb-2"></i>
                        <p class="text-slate-500 text-sm">No cross-project expenses</p>
                    </div>
                `;
                return;
            }
            
            // Sort by date (newest first)
            crossProjectItems.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const items = crossProjectItems.map(item => {
                // Calculate amount using FinancialCalculator
                let amount = 0;
                if (item.amount) {
                    amount = FinancialCalculator.parseAmount(item.amount);
                } else if (item.quantity && item.rate) {
                    amount = FinancialCalculator.multiply(item.quantity, item.rate);
                } else if (item.totalAmount) {
                    amount = FinancialCalculator.parseAmount(item.totalAmount);
                }
                
                const formattedAmount = FinancialCalculator.formatCurrencyWithSymbol(amount);
                const description = item.name || item.description || (item.workerName ? `${item.workerName} (${item.role})` : 'Unknown');
                const type = item.name ? 'Material' : item.workerName ? 'Labour' : 'Expense';
                
                return `
                    <div class="flex justify-between items-center p-3 bg-violet-50 rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors">
                        <div>
                            <p class="font-semibold text-slate-800">${Utils.escapeHtml(description)}</p>
                            <p class="text-xs text-slate-600">${Utils.formatDate(item.date)}</p>
                            <span class="inline-block px-2 py-0.5 bg-violet-200 text-violet-800 text-xs rounded-full">${type}</span>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-violet-600">${formattedAmount}</p>
                            <p class="text-xs text-slate-500">Cross-funded</p>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = items.join('');
            
        } catch (error) {
            console.error('Error rendering cross-project expenses:', error);
            container.innerHTML = '<p class="text-rose-500 text-sm">Error loading cross-project expenses</p>';
        }
    },

    // Generate Fund Status PDF for this project
    async generateFundStatusPDF() {
        this.showToast('Generating fund status PDF...', 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Theme Colors (B&B Construction Theme)
            const colors = {
                primary: [47, 47, 47],
                secondary: [183, 200, 184],
                accent: [74, 124, 89],
                success: [16, 185, 129],
                warning: [245, 158, 11],
                danger: [239, 68, 68],
                purple: [139, 92, 246],
                dark: [51, 65, 85],
                light: [241, 245, 249],
                white: [255, 255, 255]
            };
            
            if (!window.FundManagement) {
                throw new Error('Fund Management module not loaded');
            }

            // Get user profile data
            let companyName = 'B&B Constructions';
            let userName = 'Builder';
            let userEmail = '';
            try {
                const { auth, db } = await import('./firebase-config.js');
                const { doc: docRef, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const user = auth.currentUser;
                if (user) {
                    userEmail = user.email || '';
                    userName = user.email?.split('@')[0] || 'Builder';
                    const prefsDoc = await getDoc(docRef(db, 'user_preferences', user.uid));
                    if (prefsDoc.exists()) {
                        const prefs = prefsDoc.data();
                        if (prefs.companyName) companyName = prefs.companyName;
                        if (prefs.displayName) userName = prefs.displayName;
                    }
                }
            } catch (e) { console.log('Using default company name'); }

            // Get fund summary
            const fundSummary = await FundManagement.getProjectFinancialSummary(this.projectId);
            const project = this.project;
            
            let y = 15;
            
            // Header bar with B&B theme
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, 210, 12, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(0, 12, 210, 3, 'F');
            
            // Company Logo - B&B brick pattern
            y = 28;
            doc.setFillColor(...colors.primary);
            doc.rect(22, 20, 8, 8, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(32, 20, 8, 8, 'F');
            doc.setFillColor(...colors.primary);
            doc.rect(27, 30, 8, 8, 'F');
            
            // Header
            doc.setFontSize(20);
            doc.setTextColor(...colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 50, 24);
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text('Construction Management', 50, 31);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated by: ${userName}`, 50, 37);
            y = 48;
            
            // Title Box
            doc.setFillColor(...colors.accent);
            doc.roundedRect(20, y, 170, 12, 3, 3, 'F');
            doc.setFontSize(14);
            doc.setTextColor(...colors.white);
            doc.setFont('helvetica', 'bold');
            doc.text('FUND MANAGEMENT STATUS REPORT', 105, y + 8, { align: 'center' });
            y += 20;
            
            // Project Info Box
            doc.setFillColor(...colors.secondary);
            doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(...colors.primary);
            doc.text(project.name, 105, y + 7, { align: 'center' });
            y += 15;
            
            // Project Details Card
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 18, 2, 2, 'F');
            y += 7;
            doc.setFontSize(9);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text(`Client: ${project.clientName}`, 25, y);
            doc.text(`Location: ${project.location}`, 115, y);
            y += 6;
            doc.text(`Status: ${project.status}`, 25, y);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 115, y);
            y += 15;
            
            // Virtual Wallet Summary
            doc.setFillColor(...colors.accent);
            doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
            doc.setFontSize(10);
            doc.setTextColor(...colors.white);
            doc.text('VIRTUAL WALLET SUMMARY', 105, y + 6, { align: 'center' });
            y += 12;
            
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 28, 2, 2, 'F');
            y += 8;
            
            doc.setFontSize(9);
            doc.setTextColor(...colors.dark);
            const col1 = 30, col2 = 115;
            doc.text('Virtual Balance:', col1, y);
            doc.setTextColor(...colors.accent);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.virtualBalance)}`, col1 + 40, y);
            doc.setTextColor(...colors.dark);
            doc.text('Advance Received:', col2, y);
            doc.setTextColor(...colors.success);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.advanceReceived)}`, col2 + 40, y);
            y += 7;
            doc.setTextColor(...colors.dark);
            doc.text('Loans Given:', col1, y);
            doc.setTextColor(...colors.warning);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.activeLoansGiven)}`, col1 + 40, y);
            doc.setTextColor(...colors.dark);
            doc.text('Loans Received:', col2, y);
            doc.setTextColor(...colors.danger);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.activeLoansReceived)}`, col2 + 40, y);
            y += 7;
            doc.setTextColor(...colors.dark);
            doc.text('Net Available:', col1, y);
            if (fundSummary.netAvailableBalance >= 0) {
                doc.setTextColor(...colors.success);
            } else {
                doc.setTextColor(...colors.danger);
            }
            doc.setFontSize(10);
            doc.text(`Rs. ${Utils.formatNumber(fundSummary.netAvailableBalance)}`, col1 + 40, y);
            y += 18;
            
            // Payment Allocations
            const allocations = await Storage.paymentAllocations.getByProject(this.projectId);
            if (allocations.length > 0) {
                doc.setFillColor(...colors.success);
                doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
                doc.setFontSize(10);
                doc.setTextColor(...colors.white);
                doc.text('PAYMENT ALLOCATIONS RECEIVED', 30, y + 6);
                y += 12;
                
                const allocationData = await Promise.all(allocations.map(async (alloc) => {
                    let paymentFrom = 'N/A';
                    if (alloc.paymentId && typeof alloc.paymentId === 'string') {
                        const payment = await Storage.clientPayments.getById(alloc.paymentId);
                        if (payment) paymentFrom = payment.from || 'Client';
                    }
                    return [
                        Utils.formatDate(alloc.date),
                        paymentFrom,
                        `Rs. ${Utils.formatNumber(alloc.amount)}`,
                        alloc.description || 'Payment allocation'
                    ];
                }));
                
                doc.autoTable({
                    startY: y,
                    head: [['Date', 'From', 'Amount', 'Description']],
                    body: allocationData,
                    theme: 'striped',
                    headStyles: { fillColor: colors.success, fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 9 },
                    alternateRowStyles: { fillColor: [240, 253, 244] },
                    margin: { left: 20, right: 20 }
                });
                
                y = doc.lastAutoTable.finalY + 12;
            }
            
            // Active Loans Given
            const loansGiven = await Storage.crossProjectTransactions.getByLender(this.projectId);
            const activeLoansGiven = loansGiven.filter(loan => loan.status === 'active');
            if (activeLoansGiven.length > 0) {
                doc.setFillColor(...colors.warning);
                doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
                doc.setFontSize(10);
                doc.setTextColor(...colors.white);
                doc.text('ACTIVE LOANS GIVEN TO OTHER PROJECTS', 30, y + 6);
                y += 12;
                
                const loanData = await Promise.all(activeLoansGiven.map(async (loan) => {
                    let borrowerName = 'Unknown';
                    if (loan.borrowerProjectId && typeof loan.borrowerProjectId === 'string') {
                        const borrowerProject = await Storage.projects.getById(loan.borrowerProjectId);
                        if (borrowerProject) borrowerName = borrowerProject.name;
                    }
                    const balance = loan.amount - (loan.settlementAmount || 0);
                    return [
                        borrowerName,
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
                    headStyles: { fillColor: colors.warning, fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    alternateRowStyles: { fillColor: [255, 251, 235] },
                    margin: { left: 20, right: 20 }
                });
                
                y = doc.lastAutoTable.finalY + 12;
            }
            
            // Active Loans Received
            const loansReceived = await Storage.crossProjectTransactions.getByBorrower(this.projectId);
            const activeLoansReceived = loansReceived.filter(loan => loan.status === 'active');
            if (activeLoansReceived.length > 0) {
                doc.setFillColor(...colors.danger);
                doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
                doc.setFontSize(10);
                doc.setTextColor(...colors.white);
                doc.text('ACTIVE LOANS RECEIVED FROM OTHER PROJECTS', 30, y + 6);
                y += 12;
                
                const loanData = await Promise.all(activeLoansReceived.map(async (loan) => {
                    let lenderName = 'Unknown';
                    if (loan.lenderProjectId && typeof loan.lenderProjectId === 'string') {
                        const lenderProject = await Storage.projects.getById(loan.lenderProjectId);
                        if (lenderProject) lenderName = lenderProject.name;
                    }
                    const balance = loan.amount - (loan.settlementAmount || 0);
                    return [
                        lenderName,
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
                    headStyles: { fillColor: colors.danger, fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    alternateRowStyles: { fillColor: [254, 242, 242] },
                    margin: { left: 20, right: 20 }
                });
                
                y = doc.lastAutoTable.finalY + 12;
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
                doc.setFillColor(...colors.purple);
                doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
                doc.setFontSize(10);
                doc.setTextColor(...colors.white);
                doc.text('CROSS-PROJECT EXPENSES', 30, y + 6);
                y += 12;
                
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
                    headStyles: { fillColor: colors.purple, fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 9 },
                    alternateRowStyles: { fillColor: [250, 245, 255] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // Footer on all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFillColor(...colors.light);
                doc.rect(0, 285, 210, 12, 'F');
                doc.setFontSize(8);
                doc.setTextColor(...colors.dark);
                doc.text(`Maviya Constructions - ${project.name} Fund Status`, 20, 291);
                doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Page ${i} of ${pageCount}`, 190, 291, { align: 'right' });
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
            
            // Theme Colors (B&B Construction Theme)
            const colors = {
                primary: [47, 47, 47],         // Dark charcoal
                secondary: [183, 200, 184],    // Sage green
                accent: [74, 124, 89],         // Forest green
                success: [16, 185, 129],       // Emerald
                warning: [245, 158, 11],       // Amber
                danger: [239, 68, 68],         // Red
                purple: [139, 92, 246],        // Violet
                pink: [236, 72, 153],          // Pink
                teal: [20, 184, 166],          // Teal
                dark: [44, 62, 80],            // Slate
                light: [241, 245, 249],        // Light gray
                white: [255, 255, 255]
            };
            
            // Get user profile data
            let companyName = 'B&B Constructions';
            let userName = 'Builder';
            let userEmail = '';
            try {
                const { auth, db } = await import('./firebase-config.js');
                const { doc: docRef, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const user = auth.currentUser;
                if (user) {
                    userEmail = user.email || '';
                    userName = user.email?.split('@')[0] || 'Builder';
                    const prefsDoc = await getDoc(docRef(db, 'user_preferences', user.uid));
                    if (prefsDoc.exists()) {
                        const prefs = prefsDoc.data();
                        if (prefs.companyName) companyName = prefs.companyName;
                        if (prefs.displayName) userName = prefs.displayName;
                    }
                }
            } catch (e) { console.log('Using default company name'); }
            
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
            
            let y = 15;
            
            // ===== PAGE 1: COVER & SUMMARY =====
            // Decorative header bar with B&B theme
            doc.setFillColor(...colors.primary);
            doc.rect(0, 0, 210, 12, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(0, 12, 210, 3, 'F');
            
            // Company Logo - B&B brick pattern
            y = 28;
            doc.setFillColor(...colors.primary);
            doc.rect(22, 20, 8, 8, 'F');
            doc.setFillColor(...colors.secondary);
            doc.rect(32, 20, 8, 8, 'F');
            doc.setFillColor(...colors.primary);
            doc.rect(27, 30, 8, 8, 'F');
            
            // Header with company name
            doc.setFontSize(22);
            doc.setTextColor(...colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 50, y);
            y += 7;
            
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text('Construction Management System', 50, y);
            y += 5;
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated by: ${userName} | ${userEmail}`, 50, y);
            y += 12;
            
            // Project Name Box with B&B theme
            doc.setFillColor(...colors.accent);
            doc.roundedRect(20, y, 170, 18, 4, 4, 'F');
            doc.setFontSize(14);
            doc.setTextColor(...colors.white);
            doc.setFont('helvetica', 'bold');
            doc.text(this.project.name, 105, y + 12, { align: 'center' });
            y += 28;
            
            // Project Details Card
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 35, 3, 3, 'F');
            doc.setDrawColor(...colors.accent);
            doc.setLineWidth(0.5);
            doc.roundedRect(20, y, 170, 35, 3, 3, 'S');
            
            y += 10;
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text(`Client: ${this.project.clientName}`, 25, y);
            doc.text(`Location: ${this.project.location}`, 115, y);
            y += 8;
            doc.text(`Status: ${this.project.status}`, 25, y);
            doc.text(`Progress: ${this.calculateProgress()}%`, 115, y);
            y += 8;
            doc.text(`Start: ${Utils.formatDate(this.project.startDate)}`, 25, y);
            doc.text(`End: ${Utils.formatDate(this.project.endDate)}`, 115, y);
            y += 20;
            
            // Financial Summary Box
            doc.setFillColor(...colors.accent);
            doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(...colors.white);
            doc.text('FINANCIAL SUMMARY', 105, y + 6, { align: 'center' });
            y += 12;
            
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 40, 3, 3, 'F');
            y += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            const col1 = 30, col2 = 115;
            doc.text('Total Budget:', col1, y);
            doc.setTextColor(...colors.accent);
            doc.text(`Rs. ${Utils.formatNumber(budget)}`, col1 + 45, y);
            doc.setTextColor(...colors.dark);
            doc.text('Total Spent:', col2, y);
            doc.setTextColor(...colors.warning);
            doc.text(`Rs. ${Utils.formatNumber(spent)}`, col2 + 40, y);
            y += 8;
            doc.setTextColor(...colors.dark);
            doc.text('Remaining:', col1, y);
            if (budget - spent >= 0) {
                doc.setTextColor(...colors.success);
            } else {
                doc.setTextColor(...colors.danger);
            }
            doc.text(`Rs. ${Utils.formatNumber(budget - spent)}`, col1 + 45, y);
            doc.setTextColor(...colors.dark);
            doc.text('Budget Used:', col2, y);
            doc.setTextColor(...colors.warning);
            doc.text(`${Math.round((spent / budget) * 100)}%`, col2 + 40, y);
            y += 8;
            doc.setTextColor(...colors.dark);
            doc.text('Client Received:', col1, y);
            doc.setTextColor(...colors.success);
            doc.text(`Rs. ${Utils.formatNumber(clientReceived)}`, col1 + 45, y);
            doc.setTextColor(...colors.dark);
            doc.text('Client Pending:', col2, y);
            doc.setTextColor(...colors.danger);
            doc.text(`Rs. ${Utils.formatNumber(budget - clientReceived)}`, col2 + 40, y);
            y += 22;
            
            // Cost Breakdown
            const matTotal = materials.filter(m => m.status === 'used').reduce((s, m) => s + (m.quantity * m.rate), 0);
            const labTotal = labour.reduce((s, l) => s + (parseFloat(l.totalAmount) || 0), 0);
            const expTotal = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            
            doc.setFillColor(...colors.secondary);
            doc.roundedRect(20, y, 170, 8, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(...colors.primary);
            doc.text('COST BREAKDOWN', 105, y + 6, { align: 'center' });
            y += 12;
            
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
                headStyles: { fillColor: colors.accent, fontSize: 10, fontStyle: 'bold' },
                bodyStyles: { fontSize: 10 },
                footStyles: { fillColor: colors.light, textColor: colors.dark, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 20, right: 20 },
                columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 55, halign: 'right' }, 2: { cellWidth: 45, halign: 'center' } }
            });
            
            // ===== PAGE 2: MATERIALS =====
            if (materials.length > 0) {
                doc.addPage();
                
                // Header bar
                doc.setFillColor(...colors.primary);
                doc.rect(0, 0, 210, 8, 'F');
                
                y = 20;
                doc.setFillColor(...colors.primary);
                doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.white);
                doc.text('MATERIALS', 30, y + 7);
                doc.setFontSize(10);
                doc.text(`Total: Rs. ${Utils.formatNumber(matTotal)}`, 170, y + 7, { align: 'right' });
                y += 15;
                
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
                    headStyles: { fillColor: colors.primary, fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    margin: { left: 10, right: 10 }
                });
                
                // Materials Summary
                y = doc.lastAutoTable.finalY + 10;
                doc.setFillColor(...colors.light);
                doc.roundedRect(20, y, 170, 12, 2, 2, 'F');
                doc.setFontSize(9);
                doc.setTextColor(...colors.dark);
                doc.text(`Total: Rs. ${Utils.formatNumber(matTotal)}  |  Paid: Rs. ${Utils.formatNumber(matPaid)}  |  Balance: Rs. ${Utils.formatNumber(matTotal - matPaid)}`, 105, y + 8, { align: 'center' });
            }
            
            // ===== PAGE 3: LABOUR =====
            if (labour.length > 0) {
                doc.addPage();
                
                // Header bar
                doc.setFillColor(...colors.success);
                doc.rect(0, 0, 210, 8, 'F');
                
                y = 20;
                doc.setFillColor(...colors.success);
                doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.white);
                doc.text('LABOUR', 30, y + 7);
                doc.setFontSize(10);
                doc.text(`Total: Rs. ${Utils.formatNumber(labTotal)}`, 170, y + 7, { align: 'right' });
                y += 15;
                
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
                    headStyles: { fillColor: colors.success, fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    alternateRowStyles: { fillColor: [240, 253, 244] },
                    margin: { left: 10, right: 10 }
                });
                
                y = doc.lastAutoTable.finalY + 10;
                doc.setFillColor(...colors.light);
                doc.roundedRect(20, y, 170, 12, 2, 2, 'F');
                doc.setFontSize(9);
                doc.setTextColor(...colors.dark);
                doc.text(`Total Wages: Rs. ${Utils.formatNumber(labTotal)}  |  Paid: Rs. ${Utils.formatNumber(labPaid)}  |  Balance: Rs. ${Utils.formatNumber(labTotal - labPaid)}`, 105, y + 8, { align: 'center' });
            }
            
            // ===== PAGE 4: EXPENSES =====
            if (expenses.length > 0) {
                doc.addPage();
                
                // Header bar
                doc.setFillColor(...colors.purple);
                doc.rect(0, 0, 210, 8, 'F');
                
                y = 20;
                doc.setFillColor(...colors.purple);
                doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.white);
                doc.text('EXPENSES', 30, y + 7);
                doc.setFontSize(10);
                doc.text(`Total: Rs. ${Utils.formatNumber(expTotal)}`, 170, y + 7, { align: 'right' });
                y += 15;
                
                doc.autoTable({
                    startY: y,
                    head: [['Description', 'Category', 'Amount', 'Date']],
                    body: expenses.map(e => [
                        e.description, e.category,
                        `Rs. ${Utils.formatNumber(e.amount)}`,
                        Utils.formatDate(e.date)
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: colors.purple, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [250, 245, 255] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // ===== PAGE 5: CLIENT PAYMENTS =====
            if (clientPayments.length > 0) {
                doc.addPage();
                
                // Header bar
                doc.setFillColor(...colors.warning);
                doc.rect(0, 0, 210, 8, 'F');
                
                y = 20;
                doc.setFillColor(...colors.warning);
                doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.white);
                doc.text('CLIENT PAYMENTS', 30, y + 7);
                doc.setFontSize(10);
                doc.text(`Total: Rs. ${Utils.formatNumber(clientReceived)}`, 170, y + 7, { align: 'right' });
                y += 15;
                
                doc.autoTable({
                    startY: y,
                    head: [['Date', 'Amount', 'From', 'Received By', 'Method', 'Notes']],
                    body: clientPayments.map(p => [
                        Utils.formatDate(p.date),
                        `Rs. ${Utils.formatNumber(p.amount)}`,
                        p.from, p.receivedBy, p.method, p.notes || '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: colors.warning, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [255, 251, 235] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // ===== PAGE 6: DAILY LOGS =====
            if (logs.length > 0) {
                doc.addPage();
                
                // Header bar
                doc.setFillColor(...colors.teal);
                doc.rect(0, 0, 210, 8, 'F');
                
                y = 20;
                doc.setFillColor(...colors.teal);
                doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.white);
                doc.text('DAILY SITE LOGS', 30, y + 7);
                y += 15;
                
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
                    headStyles: { fillColor: colors.teal, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [240, 253, 250] },
                    margin: { left: 20, right: 20 },
                    columnStyles: { 1: { cellWidth: 60 }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 } }
                });
            }
            
            // ===== PAGE 7: DOCUMENTS LIST =====
            if (documents.length > 0) {
                doc.addPage();
                
                // Header bar
                doc.setFillColor(...colors.pink);
                doc.rect(0, 0, 210, 8, 'F');
                
                y = 20;
                doc.setFillColor(...colors.pink);
                doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.white);
                doc.text('DOCUMENTS', 30, y + 7);
                y += 15;
                
                doc.autoTable({
                    startY: y,
                    head: [['Document Name', 'Category', 'Date', 'File Name', 'Notes']],
                    body: documents.map(d => [
                        d.name, d.category,
                        d.docDate ? Utils.formatDate(d.docDate) : '-',
                        d.fileName, d.notes || '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: colors.pink, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [253, 242, 248] },
                    margin: { left: 20, right: 20 }
                });
            }
            
            // ===== PAGE 8: FLOOR PLAN (if available) =====
            if (this.project.floorPlan2D && this.project.floorPlan2D.floors) {
                const includeFloorPlan = confirm('Include Floor Plan Sketch in PDF?');
                if (includeFloorPlan) {
                    const floorData = this.project.floorPlan2D.floors;
                    const floorIds = Object.keys(floorData).filter(id => floorData[id].elements && floorData[id].elements.length > 0);
                    
                    if (floorIds.length > 0) {
                        doc.addPage('landscape');
                        
                        // Header bar
                        doc.setFillColor(...colors.primary);
                        doc.rect(0, 0, 297, 8, 'F');
                        
                        y = 20;
                        doc.setFillColor(...colors.primary);
                        doc.roundedRect(20, y, 257, 10, 2, 2, 'F');
                        doc.setFontSize(12);
                        doc.setTextColor(...colors.white);
                        doc.text('FLOOR PLAN SKETCH', 30, y + 7);
                        y += 20;
                        
                        // Draw floor plan for each floor
                        for (const floorId of floorIds) {
                            const floor = floorData[floorId];
                            if (!floor.elements || floor.elements.length === 0) continue;
                            
                            // Floor label
                            doc.setFontSize(10);
                            doc.setTextColor(...colors.dark);
                            doc.setFont('helvetica', 'bold');
                            const floorNames = { 'GF': 'Ground Floor', 'FF': 'First Floor', 'SF': 'Second Floor', 'TF': 'Third Floor', '4F': 'Fourth Floor' };
                            doc.text(floorNames[floorId] || floorId, 25, y);
                            y += 5;
                            
                            // Calculate bounds
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            for (const el of floor.elements) {
                                if (el.type === 'line' || el.type === 'dimension') {
                                    minX = Math.min(minX, el.x1, el.x2);
                                    minY = Math.min(minY, el.y1, el.y2);
                                    maxX = Math.max(maxX, el.x1, el.x2);
                                    maxY = Math.max(maxY, el.y1, el.y2);
                                } else if (el.type === 'label') {
                                    minX = Math.min(minX, el.x - 50);
                                    minY = Math.min(minY, el.y - 20);
                                    maxX = Math.max(maxX, el.x + 50);
                                    maxY = Math.max(maxY, el.y + 30);
                                }
                            }
                            
                            // Scale to fit
                            const drawWidth = 240;
                            const drawHeight = 120;
                            const scaleX = drawWidth / (maxX - minX + 40);
                            const scaleY = drawHeight / (maxY - minY + 40);
                            const scale = Math.min(scaleX, scaleY, 0.5);
                            const offsetX = 30 - minX * scale;
                            const offsetY = y - minY * scale;
                            
                            // Draw elements
                            for (const el of floor.elements) {
                                if (el.type === 'line') {
                                    doc.setDrawColor(...colors.dark);
                                    doc.setLineWidth(el.weight ? el.weight * 0.3 : 0.5);
                                    doc.line(
                                        el.x1 * scale + offsetX,
                                        el.y1 * scale + offsetY,
                                        el.x2 * scale + offsetX,
                                        el.y2 * scale + offsetY
                                    );
                                } else if (el.type === 'label') {
                                    doc.setFontSize(8);
                                    doc.setTextColor(...colors.dark);
                                    doc.setFont('helvetica', 'bold');
                                    doc.text(el.name || 'ROOM', el.x * scale + offsetX, el.y * scale + offsetY, { align: 'center' });
                                    if (el.size) {
                                        doc.setFontSize(6);
                                        doc.setFont('helvetica', 'normal');
                                        doc.text(el.size, el.x * scale + offsetX, el.y * scale + offsetY + 4, { align: 'center' });
                                    }
                                } else if (el.type === 'dimension') {
                                    doc.setDrawColor(100, 100, 100);
                                    doc.setLineWidth(0.2);
                                    doc.setLineDashPattern([1, 1], 0);
                                    doc.line(
                                        el.x1 * scale + offsetX,
                                        el.y1 * scale + offsetY,
                                        el.x2 * scale + offsetX,
                                        el.y2 * scale + offsetY
                                    );
                                    doc.setLineDashPattern([], 0);
                                    if (el.text) {
                                        doc.setFontSize(6);
                                        doc.setTextColor(100, 100, 100);
                                        const midX = (el.x1 + el.x2) / 2 * scale + offsetX;
                                        const midY = (el.y1 + el.y2) / 2 * scale + offsetY;
                                        doc.text(el.text, midX, midY - 2, { align: 'center' });
                                    }
                                }
                            }
                            
                            y += drawHeight + 15;
                            
                            // Add new page if needed
                            if (y > 180 && floorIds.indexOf(floorId) < floorIds.length - 1) {
                                doc.addPage('landscape');
                                doc.setFillColor(...colors.primary);
                                doc.rect(0, 0, 297, 8, 'F');
                                y = 20;
                            }
                        }
                    }
                }
            }
            
            // Footer on all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                // Footer bar
                doc.setFillColor(...colors.light);
                doc.rect(0, 285, 210, 12, 'F');
                doc.setFontSize(8);
                doc.setTextColor(...colors.dark);
                doc.text(`Maviya Constructions - ${this.project.name}`, 20, 291);
                doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Page ${i} of ${pageCount}`, 190, 291, { align: 'right' });
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
            
            // Theme Colors
            const colors = {
                primary: [91, 155, 213],
                secondary: [255, 140, 97],
                success: [127, 216, 190],
                warning: [255, 184, 77],
                purple: [186, 104, 200],
                dark: [44, 62, 80],
                light: [232, 244, 248],
                white: [255, 255, 255]
            };
            
            let y = 15;
            let data = [];
            let title = '';
            let headers = [];
            let color = colors.primary;
            let altRowColor = [248, 250, 252];
            
            if (type === 'materials') {
                title = 'MATERIALS INVOICE';
                headers = [['Material', 'Qty', 'Unit', 'Rate', 'Total', 'Paid', 'Balance']];
                const materials = await Storage.materials.getByProject(this.projectId);
                data = materials.filter(m => m.status === 'used').map(m => {
                    const total = m.quantity * m.rate;
                    const paid = m.paidAmount || 0;
                    return [m.name, m.quantity, m.unit, `Rs. ${Utils.formatNumber(m.rate)}`, `Rs. ${Utils.formatNumber(total)}`, `Rs. ${Utils.formatNumber(paid)}`, `Rs. ${Utils.formatNumber(total - paid)}`];
                });
                color = colors.primary;
                altRowColor = [240, 249, 255];
            } else if (type === 'labour') {
                title = 'LABOUR INVOICE';
                headers = [['Worker', 'Role', 'Total Amount', 'Paid', 'Balance']];
                const labour = await Storage.labour.getByProject(this.projectId);
                data = labour.map(l => {
                    const total = l.totalAmount || 0;
                    const paid = l.paidAmount || 0;
                    return [l.workerName, l.role, `Rs. ${Utils.formatNumber(total)}`, `Rs. ${Utils.formatNumber(paid)}`, `Rs. ${Utils.formatNumber(total - paid)}`];
                });
                color = colors.success;
                altRowColor = [240, 253, 244];
            } else if (type === 'vendors') {
                title = 'VENDORS INVOICE';
                headers = [['Vendor', 'Service', 'Agreed Cost', 'Paid', 'Balance']];
                const vendors = await Storage.vendors.getByProject(this.projectId);
                data = await Promise.all(vendors.map(async v => {
                    const payments = await Storage.vendorPayments.getByVendorAndProject(v.id, this.projectId);
                    const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                    return [v.name, v.serviceType, `Rs. ${Utils.formatNumber(v.agreedCost)}`, `Rs. ${Utils.formatNumber(paid)}`, `Rs. ${Utils.formatNumber(v.agreedCost - paid)}`];
                }));
                color = colors.secondary;
                altRowColor = [255, 247, 237];
            } else if (type === 'expenses') {
                title = 'EXPENSES INVOICE';
                headers = [['Description', 'Category', 'Amount', 'Date']];
                const expenses = await Storage.expenses.getByProject(this.projectId);
                data = expenses.map(e => [e.description, e.category, `Rs. ${Utils.formatNumber(e.amount)}`, Utils.formatDate(e.date)]);
                color = colors.purple;
                altRowColor = [250, 245, 255];
            } else if (type === 'client') {
                title = 'CLIENT PAYMENT RECEIPT';
                headers = [['Date', 'Amount', 'From', 'Received By', 'Method']];
                const payments = await Storage.clientPayments.getByProject(this.projectId);
                data = payments.map(p => [Utils.formatDate(p.date), `Rs. ${Utils.formatNumber(p.amount)}`, p.from, p.receivedBy, p.method]);
                color = colors.warning;
                altRowColor = [255, 251, 235];
            }
            
            // Header bar
            doc.setFillColor(...color);
            doc.rect(0, 0, 210, 8, 'F');
            
            // Company Logo Area
            doc.setFillColor(...colors.warning);
            doc.circle(30, 22, 10, 'F');
            doc.setFillColor(...colors.white);
            doc.circle(30, 22, 7, 'F');
            doc.setFontSize(10);
            doc.setTextColor(...colors.warning);
            doc.setFont('helvetica', 'bold');
            doc.text('MC', 26, 24);
            
            // Header
            doc.setFontSize(20);
            doc.setTextColor(...colors.primary);
            doc.text('Maviya Constructions', 50, 20);
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text('Construction Management', 50, 27);
            y = 40;
            
            // Invoice Title Box
            doc.setFillColor(...color);
            doc.roundedRect(20, y, 170, 12, 3, 3, 'F');
            doc.setFontSize(14);
            doc.setTextColor(...colors.white);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 105, y + 8, { align: 'center' });
            y += 20;
            
            // Project Details Card
            doc.setFillColor(...colors.light);
            doc.roundedRect(20, y, 170, 22, 2, 2, 'F');
            doc.setDrawColor(...color);
            doc.setLineWidth(0.5);
            doc.roundedRect(20, y, 170, 22, 2, 2, 'S');
            
            y += 8;
            doc.setFontSize(10);
            doc.setTextColor(...colors.dark);
            doc.setFont('helvetica', 'normal');
            doc.text(`Project: ${this.project.name}`, 25, y);
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 140, y);
            y += 8;
            doc.text(`Client: ${this.project.clientName}`, 25, y);
            doc.text(`Location: ${this.project.location}`, 140, y);
            y += 15;
            
            // Table
            if (data.length > 0) {
                doc.autoTable({
                    startY: y,
                    head: headers,
                    body: data,
                    theme: 'striped',
                    headStyles: { fillColor: color, fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 9 },
                    alternateRowStyles: { fillColor: altRowColor },
                    margin: { left: 20, right: 20 }
                });
                
                // Total row
                y = doc.lastAutoTable.finalY + 10;
                if (type === 'materials' || type === 'labour' || type === 'vendors') {
                    const totalAmount = data.reduce((sum, row) => {
                        const amtStr = row[type === 'materials' ? 4 : 2].replace(/[^0-9.-]+/g, '');
                        return sum + (parseFloat(amtStr) || 0);
                    }, 0);
                    const totalPaid = data.reduce((sum, row) => {
                        const paidStr = row[type === 'materials' ? 5 : 3].replace(/[^0-9.-]+/g, '');
                        return sum + (parseFloat(paidStr) || 0);
                    }, 0);
                    
                    doc.setFillColor(...colors.light);
                    doc.roundedRect(20, y, 170, 15, 2, 2, 'F');
                    doc.setFontSize(10);
                    doc.setTextColor(...colors.dark);
                    doc.text(`Total: Rs. ${Utils.formatNumber(totalAmount)}  |  Paid: Rs. ${Utils.formatNumber(totalPaid)}  |  Balance: Rs. ${Utils.formatNumber(totalAmount - totalPaid)}`, 105, y + 10, { align: 'center' });
                }
            } else {
                doc.setFillColor(...colors.light);
                doc.roundedRect(20, y, 170, 30, 2, 2, 'F');
                doc.setFontSize(12);
                doc.setTextColor(...colors.dark);
                doc.text('No records found', 105, y + 18, { align: 'center' });
            }
            
            // Footer
            doc.setFillColor(...colors.light);
            doc.rect(0, 285, 210, 12, 'F');
            doc.setFontSize(8);
            doc.setTextColor(...colors.dark);
            doc.text(`Maviya Constructions - ${this.project.name}`, 20, 291);
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 190, 291, { align: 'right' });
            
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

    async exportVendors() {
        const vendors = await Storage.vendors.getByProject(this.projectId);
        const data = [];
        for (const v of vendors) {
            const payments = await Storage.vendorPayments.getByVendorAndProject(v.id, this.projectId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            data.push({
                'Vendor': v.name,
                'Service': v.serviceType,
                'Agreed Cost': v.agreedCost,
                'Paid': paidAmount,
                'Balance': Math.max(0, v.agreedCost - paidAmount),
                'Phone': v.phone || ''
            });
        }
        Utils.exportToCSV(data, `${this.project.name}_Vendors.csv`);
        this.showToast('Vendors CSV downloaded!', 'success');
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
    },

    // Project Switcher Methods
    toggleProjectSwitcher() {
        const switcher = document.getElementById('projectSwitcher');
        if (switcher) {
            const isOpen = switcher.classList.toggle('open');
            if (isOpen) {
                this.loadProjectsList();
                // Close when clicking outside
                document.addEventListener('click', this.closeProjectSwitcherOnOutsideClick);
            } else {
                document.removeEventListener('click', this.closeProjectSwitcherOnOutsideClick);
            }
        }
    },

    closeProjectSwitcherOnOutsideClick(e) {
        const switcher = document.getElementById('projectSwitcher');
        if (switcher && !switcher.contains(e.target)) {
            switcher.classList.remove('open');
            document.removeEventListener('click', ProjectApp.closeProjectSwitcherOnOutsideClick);
        }
    },

    async loadProjectsList() {
        const listContainer = document.getElementById('projectSwitcherList');
        if (!listContainer) return;

        try {
            const projects = await Storage.projects.getAll();
            
            if (!projects || projects.length === 0) {
                listContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--gray);">No projects found</div>';
                return;
            }

            // Sort by most recent first
            projects.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
                return dateB - dateA;
            });

            listContainer.innerHTML = projects.map(p => {
                const isActive = p.id === this.projectId;
                const statusClass = p.status === 'In Progress' ? 'active' : p.status === 'Completed' ? 'completed' : 'planning';
                const initial = (p.name || 'P')[0].toUpperCase();
                
                return `
                    <div class="project-switcher-item ${isActive ? 'active' : ''}" onclick="ProjectApp.switchToProject('${p.id}')">
                        <div class="project-icon">${initial}</div>
                        <div class="project-info">
                            <div class="project-name">${p.name || 'Unnamed Project'}</div>
                            <div class="project-meta">
                                <span class="status-dot ${statusClass}"></span>
                                ${p.status || 'Planning'}
                                ${p.budget ? ` • ₹${Number(p.budget).toLocaleString('en-IN')}` : ''}
                            </div>
                        </div>
                        ${isActive ? '<i class="fas fa-check" style="color: var(--primary); font-size: 0.75rem;"></i>' : ''}
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading projects list:', error);
            listContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--error);">Error loading projects</div>';
        }
    },

    switchToProject(projectId) {
        if (projectId && projectId !== this.projectId) {
            window.location.href = `project.html?id=${projectId}`;
        }
        // Close the switcher
        const switcher = document.getElementById('projectSwitcher');
        if (switcher) switcher.classList.remove('open');
    }
};

// Make ProjectApp available globally
window.ProjectApp = ProjectApp;

// Export for manual initialization
export { ProjectApp };
