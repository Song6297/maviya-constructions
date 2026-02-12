// Main Dashboard Application - Firebase Version
import Storage from './firebase-storage.js';

// Make Utils available globally for other scripts
window.Utils = {
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
        if (status === 'Completed') return { class: 'text-green-500 bg-primary/10', text: 'Completed', priority: 0 };
        const days = this.getDaysRemaining(endDate);
        if (days < 0) return { class: 'text-red-500 bg-red-500/20 animate-pulse', text: `${Math.abs(days)}d overdue`, priority: 4 };
        if (days === 0) return { class: 'text-red-500 bg-red-500/10', text: 'Due today', priority: 3 };
        if (days <= 3) return { class: 'text-red-400 bg-red-400/10', text: `${days}d left`, priority: 2 };
        if (days <= 7) return { class: 'text-amber-500 bg-amber-500/10', text: `${days}d left`, priority: 1 };
        return { class: 'text-gray-400', text: `${days}d left`, priority: 0 };
    },

    getPaymentStatus(dueDate, isPaid) {
        if (isPaid) return { class: 'text-green-500 bg-primary/10', text: 'Paid' };
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

const App = {
    currentFilter: 'all',
    deleteTargetId: null,
    alerts: [],

    async init() {
        this.showLoading(true);
        this.bindEvents();
        await this.generateAlerts();
        this.renderAlerts();
        await this.renderProjects();
        await this.updateMetrics();
        this.showLoading(false);

        // Load analytics widgets in parallel (non-blocking)
        Promise.all([
            this.renderActivityFeed(),
            this.renderCashFlow(),
            this.renderWorkerUtilization(),
            this.renderBurnRate()
        ]).catch(e => console.error('Analytics widget error:', e));
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

    async generateAlerts() {
        this.alerts = [];
        const projects = await Storage.projects.getAll();
        const payments = await Storage.payments.getAll();

        for (const p of projects) {
            if (p.status === 'Completed') continue;
            const status = Utils.getDeadlineStatus(p.endDate, p.status);
            if (status.priority >= 2) {
                this.alerts.push({ type: 'danger', icon: 'clock', text: `${p.name}: ${status.text}`, projectId: p.id });
            } else if (status.priority === 1) {
                this.alerts.push({ type: 'warning', icon: 'clock', text: `${p.name}: ${status.text}`, projectId: p.id });
            }

            const spent = await this.getProjectSpent(p.id);
            const budget = await this.getEffectiveBudget(p);
            const health = Utils.getBudgetHealth(spent, budget);
            if (health.status === 'over') {
                this.alerts.push({ type: 'danger', icon: 'exclamation-triangle', text: `${p.name}: Over budget by ₹${Utils.formatNumber(spent - budget)}`, projectId: p.id });
            } else if (health.status === 'critical') {
                this.alerts.push({ type: 'danger', icon: 'chart-line', text: `${p.name}: 90%+ budget used`, projectId: p.id });
            } else if (health.status === 'warning') {
                this.alerts.push({ type: 'warning', icon: 'chart-line', text: `${p.name}: 80%+ budget used`, projectId: p.id });
            }

            const todayExpenses = await this.getTodayExpenses(p.id);
            const avgDaily = budget / Math.max(1, Utils.getDaysRemaining(p.endDate) + this.getDaysElapsed(p.startDate));
            if (todayExpenses > avgDaily * 1.5 && todayExpenses > 0) {
                this.alerts.push({ type: 'warning', icon: 'rupee-sign', text: `${p.name}: High spending today (₹${Utils.formatNumber(todayExpenses)})`, projectId: p.id });
            }
        }

        payments.filter(p => !p.isPaid).forEach(p => {
            const status = Utils.getPaymentStatus(p.dueDate, p.isPaid);
            if (status.text.includes('overdue')) {
                this.alerts.push({ type: 'danger', icon: 'wallet', text: `Payment overdue: ${p.vendorName} - ₹${Utils.formatNumber(p.amount)}` });
            } else if (status.text.includes('today') || status.text.includes('in 1d') || status.text.includes('in 2d') || status.text.includes('in 3d')) {
                this.alerts.push({ type: 'warning', icon: 'wallet', text: `Payment ${status.text}: ${p.vendorName} - ₹${Utils.formatNumber(p.amount)}` });
            }
        });

        const activeProjects = projects.filter(p => p.status === 'In Progress');
        for (const p of activeProjects) {
            const labour = await Storage.labour.getByProject(p.id);
            const attendance = await Storage.attendance.getByProject(p.id);
            const todayStr = new Date().toISOString().split('T')[0];
            const todayAttendance = attendance.filter(a => a.date === todayStr);
            if (labour.length > 0 && todayAttendance.length === 0) {
                this.alerts.push({ type: 'info', icon: 'user-clock', text: `${p.name}: Mark today's attendance`, projectId: p.id });
            }
        }
    },

    async getProjectSpent(projectId) {
        const materials = await Storage.materials.getByProject(projectId);
        const labour = await Storage.labour.getByProject(projectId);
        const expenses = await Storage.expenses.getByProject(projectId);

        const matTotal = materials.filter(m => m.status === 'used').reduce((s, m) => {
            const qty = parseFloat(m.quantity) || 0;
            const rate = parseFloat(m.rate) || 0;
            return s + (qty * rate);
        }, 0) - materials.filter(m => m.status === 'recovered').reduce((s, m) => {
            const qty = parseFloat(m.quantity) || 0;
            const rate = parseFloat(m.rate) || 0;
            return s + (qty * rate);
        }, 0);

        const labTotal = labour.reduce((s, l) => {
            const total = parseFloat(l.totalAmount) || 0;
            const wage = parseFloat(l.dailyWage) || 0;
            const days = parseFloat(l.daysWorked) || 0;
            return s + (total || (wage * days));
        }, 0);

        const expTotal = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        return Math.max(0, matTotal) + labTotal + expTotal;
    },

    async getEffectiveBudget(project) {
        // With Fund Management system, we use the original project budget
        // Cross-project funding is handled through the virtual wallet system
        const budget = parseFloat(project.budget) || 0;
        return budget;
    },

    async getTodayExpenses(projectId) {
        const today = new Date().toISOString().split('T')[0];
        const materials = await Storage.materials.getByProject(projectId);
        const expenses = await Storage.expenses.getByProject(projectId);
        const todayMaterials = materials.filter(m => m.date === today && m.status === 'used');
        const todayExpenses = expenses.filter(e => e.date === today);
        const matTotal = todayMaterials.reduce((s, m) => {
            const qty = parseFloat(m.quantity) || 0;
            const rate = parseFloat(m.rate) || 0;
            return s + (qty * rate);
        }, 0);
        const expTotal = todayExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        return matTotal + expTotal;
    },

    getDaysElapsed(startDate) {
        const start = new Date(startDate);
        const today = new Date();
        if (isNaN(start.getTime())) return 0;
        return Math.max(0, Math.ceil((today - start) / (1000 * 60 * 60 * 24)));
    },

    renderAlerts() {
        const panel = document.getElementById('alertsPanel');
        const list = document.getElementById('alertsList');
        if (this.alerts.length === 0) { panel.classList.add('hidden'); return; }
        panel.classList.remove('hidden');
        list.innerHTML = this.alerts.map(a => `
            <div class="alert-item ${a.type}" ${a.projectId ? `onclick="window.location.href='project.html?id=${a.projectId}'" style="cursor:pointer"` : ''}>
                <i class="fas fa-${a.icon} mr-2"></i>${a.text}
            </div>
        `).join('');
    },

    bindEvents() {
        document.getElementById('addProjectBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('projectModal').addEventListener('click', e => { if (e.target.id === 'projectModal') this.closeModal(); });
        document.getElementById('projectForm').addEventListener('submit', e => this.handleSubmit(e));
        document.getElementById('statusFilter').addEventListener('change', e => { this.currentFilter = e.target.value; this.renderProjects(); });
        document.getElementById('cancelDelete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());
        document.getElementById('deleteModal').addEventListener('click', e => { if (e.target.id === 'deleteModal') this.closeDeleteModal(); });
        document.getElementById('dismissAlerts')?.addEventListener('click', () => { document.getElementById('alertsPanel').classList.add('hidden'); });
    },

    async openModal(projectId = null) {
        const modal = document.getElementById('projectModal');
        const form = document.getElementById('projectForm');
        form.reset();
        document.getElementById('projectId').value = '';
        document.getElementById('dateError').classList.add('hidden');

        if (projectId) {
            const p = await Storage.projects.getById(projectId);
            if (p) {
                document.getElementById('modalTitle').textContent = 'Edit Project';
                document.getElementById('projectId').value = p.id;
                document.getElementById('projectName').value = p.name;
                document.getElementById('clientName').value = p.clientName;
                document.getElementById('location').value = p.location;
                document.getElementById('budget').value = p.budget;
                document.getElementById('startDate').value = p.startDate;
                document.getElementById('endDate').value = p.endDate;
                document.getElementById('status').value = p.status;
            }
        } else {
            document.getElementById('modalTitle').textContent = 'New Project';
            document.getElementById('startDate').value = new Date().toISOString().split('T')[0];
        }
        modal.classList.add('active');
        modal.classList.remove('hidden');
    },

    closeModal() {
        const modal = document.getElementById('projectModal');
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    async handleSubmit(e) {
        e.preventDefault();
        const start = document.getElementById('startDate').value;
        const end = document.getElementById('endDate').value;
        if (new Date(end) < new Date(start)) { document.getElementById('dateError').classList.remove('hidden'); return; }

        const id = document.getElementById('projectId').value;
        const data = {
            name: document.getElementById('projectName').value.trim(),
            clientName: document.getElementById('clientName').value.trim(),
            location: document.getElementById('location').value.trim(),
            budget: parseFloat(document.getElementById('budget').value),
            startDate: start, endDate: end,
            status: document.getElementById('status').value
        };

        // Check if creating new project (not editing)
        if (!id) {
            // Check premium status for new projects
            const isPremium = await this.checkUserPremiumStatus();
            if (!isPremium) {
                // Free user - redirect to payment page
                this.closeModal();
                const projectName = encodeURIComponent(data.name);
                window.location.href = `project-fee.html?projectName=${projectName}`;
                return;
            }
        }

        this.showLoading(true);
        if (id) await Storage.projects.update(id, data);
        else await Storage.projects.add(data);

        this.closeModal();
        await this.generateAlerts();
        this.renderAlerts();
        await this.renderProjects();
        await this.updateMetrics();
        this.showLoading(false);
        this.showToast(id ? 'Project updated' : 'Project created', 'success');
    },

    async checkUserPremiumStatus() {
        try {
            const { auth, db } = await import('./firebase-config.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const user = auth.currentUser;
            if (!user) {
                console.log('Premium check: No user logged in');
                return false;
            }

            // Admin always has full premium access (no project fee)
            if (user.email === 'sulaimaansong6297@gmail.com') {
                console.log('Premium check: Admin user - full premium granted');
                return true;
            }

            // Saqlain has premium features but still pays ₹5 per project
            // This is handled separately - he gets premium UI but project fee still applies
            // So we return false here to trigger project fee payment
            if (user.email === 'saqlainmohammed1122@gmail.com') {
                console.log('Premium check: Saqlain - premium features but project fee applies');
                return false; // Will redirect to project fee page
            }

            console.log('Premium check: Checking user', user.email);

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                console.log('Premium check: User doc not found - free user');
                return false;
            }

            const userData = userDoc.data();
            console.log('Premium check: User data', userData.premiumStatus, userData.premiumEnd);

            if (userData.premiumStatus !== 'PREMIUM') {
                console.log('Premium check: Not premium status');
                return false;
            }

            // Check if premium expired
            if (userData.premiumEnd) {
                const endDate = userData.premiumEnd.toDate ? userData.premiumEnd.toDate() : new Date(userData.premiumEnd);
                if (endDate <= new Date()) {
                    console.log('Premium check: Premium expired');
                    return false;
                }
            }

            console.log('Premium check: Premium active');
            return true;
        } catch (error) {
            console.error('Error checking premium:', error);
            // On permission error, assume free user (redirect to payment)
            return false;
        }
    },

    async renderProjects() {
        const container = document.getElementById('projectsContainer');
        const empty = document.getElementById('emptyState');
        let projects = await Storage.projects.getAll();

        if (this.currentFilter !== 'all') projects = projects.filter(p => p.status === this.currentFilter);
        projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        if (!projects.length) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');

        const cards = [];
        for (const p of projects) {
            cards.push(await this.createProjectCard(p));
        }
        container.innerHTML = cards.join('');

        container.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); this.openModal(btn.dataset.id); }));
        container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); this.openDeleteModal(btn.dataset.id); }));
        container.querySelectorAll('.project-card').forEach(card => card.addEventListener('click', () => { window.location.href = `project.html?id=${card.dataset.id}`; }));
    },

    async createProjectCard(p) {
        const spent = await this.getProjectSpent(p.id);
        const budget = await this.getEffectiveBudget(p);
        const health = Utils.getBudgetHealth(spent, budget);
        const deadline = Utils.getDeadlineStatus(p.endDate, p.status);
        const progress = p.status === 'Completed' ? 100 : p.status === 'Planning' ? 0 : Math.min(100, Math.round((this.getDaysElapsed(p.startDate) / Math.max(1, this.getDaysElapsed(p.startDate) + Utils.getDaysRemaining(p.endDate))) * 100));

        return `
            <div class="project-card animate-fade-in" data-id="${p.id}">
                <div class="flex items-start justify-between mb-4">
                    <span class="status-badge ${this.getStatusClass(p.status)}">${p.status}</span>
                    <div class="flex gap-2">
                        <button type="button" class="action-btn edit-btn" data-id="${p.id}"><i class="fas fa-pen text-sm"></i></button>
                        <button type="button" class="action-btn delete delete-btn" data-id="${p.id}"><i class="fas fa-trash text-sm"></i></button>
                    </div>
                </div>
                
                <h3 class="font-bold text-gray-800 mb-2 text-lg">${Utils.escapeHtml(p.name)}</h3>
                <div class="space-y-2 mb-4">
                    <p class="text-sm text-gray-600 flex items-center gap-2">
                        <i class="fas fa-user w-4"></i>${Utils.escapeHtml(p.clientName)}
                    </p>
                    <p class="text-sm text-gray-600 flex items-center gap-2">
                        <i class="fas fa-map-marker-alt w-4"></i>${Utils.escapeHtml(p.location)}
                    </p>
                </div>
                
                <div class="flex items-center justify-between mb-4 text-xs">
                    <span class="text-gray-500">${Utils.formatDate(p.startDate)}</span>
                    <i class="fas fa-arrow-right text-gray-400"></i>
                    <span class="text-gray-500">${Utils.formatDate(p.endDate)}</span>
                </div>

                <div class="mb-4">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-gray-600 font-medium">Progress</span>
                        <span class="font-bold text-sky-600">${progress}%</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
                </div>

                <div class="mb-4">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-gray-600 font-medium">Budget Health</span>
                        <span class="font-bold text-${health.color}-600">${Math.round(health.percent)}%</span>
                    </div>
                    <div class="health-meter"><div class="health-indicator" style="left:${Math.min(98, health.percent)}%"></div></div>
                </div>

                <div class="pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div>
                        <p class="text-xs text-gray-500 mb-1">Budget</p>
                        <p class="text-xl font-bold text-sky-600">₹${Utils.formatNumber(budget)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-gray-500 mb-1">Spent</p>
                        <p class="text-sm font-semibold text-gray-700">₹${Utils.formatNumber(spent)}</p>
                    </div>
                </div>
                
                ${deadline.priority >= 2 ? `<div class="mt-3 px-3 py-2 rounded-lg ${deadline.class} text-xs font-semibold text-center">${deadline.text}</div>` : ''}
            </div>
        `;
    },

    getStatusClass(status) {
        return { 'Planning': 'status-planning', 'In Progress': 'status-in-progress', 'On Hold': 'status-on-hold', 'Completed': 'status-completed' }[status] || 'status-planning';
    },

    async updateMetrics() {
        const projects = await Storage.projects.getAll();
        const payments = await Storage.payments.getAll();

        document.getElementById('totalProjects').textContent = projects.length;
        document.getElementById('activeProjects').textContent = projects.filter(p => p.status === 'In Progress').length;
        document.getElementById('completedProjects').textContent = projects.filter(p => p.status === 'Completed').length;
        document.getElementById('delayedProjects').textContent = projects.filter(p => p.status !== 'Completed' && Utils.getDaysRemaining(p.endDate) < 0).length;

        const pending = payments.filter(p => !p.isPaid).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        document.getElementById('pendingPayments').textContent = `₹${Utils.formatNumber(pending)}`;

        // Load and display available credits
        await this.loadUserCredits();
    },

    async loadUserCredits() {
        try {
            const creditsEl = document.getElementById('availableCredits');
            if (!creditsEl) return;

            const { auth, db } = await import('./firebase-config.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const credits = userData.projectCredits || 0;
                creditsEl.textContent = credits;

                // Show/hide credits card based on premium status
                const creditsCard = document.getElementById('creditsCard');
                const buyCreditsBtn = document.getElementById('buyCreditsBtn');

                // Admin and Saqlain always have premium features
                const isPremium = userData.premiumStatus === 'PREMIUM' ||
                    user.email === 'sulaimaansong6297@gmail.com' ||
                    user.email === 'saqlainmohammed1122@gmail.com';

                if (isPremium && user.email !== 'saqlainmohammed1122@gmail.com') {
                    // Premium users (except Saqlain) don't need credits
                    if (creditsCard) creditsCard.style.display = 'none';
                    if (buyCreditsBtn) buyCreditsBtn.style.display = 'none';
                } else {
                    // Free users and Saqlain need credits
                    if (creditsCard) creditsCard.style.display = 'block';
                    if (buyCreditsBtn) buyCreditsBtn.style.display = 'inline-flex';
                }
            }
        } catch (e) {
            console.error('Error loading credits:', e);
        }
    },

    openDeleteModal(id) {
        this.deleteTargetId = id;
        const modal = document.getElementById('deleteModal');
        modal.classList.add('active');
        modal.classList.remove('hidden');
    },

    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
        this.deleteTargetId = null;
    },

    async confirmDelete() {
        if (this.deleteTargetId) {
            this.showLoading(true);
            await Storage.projects.delete(this.deleteTargetId);
            await this.generateAlerts();
            this.renderAlerts();
            await this.renderProjects();
            await this.updateMetrics();
            this.showLoading(false);
            this.showToast('Project deleted', 'success');
        }
        this.closeDeleteModal();
    },

    showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-check-circle mr-2 text-sky-500"></i>${message}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
    },

    // ==================== ANALYTICS WIDGETS ====================

    async renderActivityFeed() {
        const container = document.getElementById('activityFeedList');
        const countEl = document.getElementById('activityCount');
        if (!container) return;

        try {
            const [projects, expenses, logs, attendance] = await Promise.all([
                Storage.projects.getAll(),
                Storage.expenses ? Storage.expenses.getAll() : Promise.resolve([]),
                Storage.logs ? Storage.logs.getAll() : Promise.resolve([]),
                Storage.attendance ? Storage.attendance.getAll() : Promise.resolve([])
            ]);

            const projectMap = {};
            projects.forEach(p => { projectMap[p.id] = p.name; });

            const activities = [];

            // Recent expenses
            expenses.forEach(e => {
                activities.push({
                    icon: 'receipt',
                    color: '#EF4444',
                    text: `Expense: ₹${Utils.formatNumber(e.amount)}`,
                    project: projectMap[e.projectId] || 'Unknown',
                    time: e.date || e.createdAt,
                    category: e.category || ''
                });
            });

            // Recent logs
            logs.forEach(l => {
                activities.push({
                    icon: 'clipboard-list',
                    color: '#6366F1',
                    text: l.description || l.note || 'Log entry',
                    project: projectMap[l.projectId] || 'Unknown',
                    time: l.date || l.createdAt,
                    category: 'Log'
                });
            });

            // Recent attendance
            attendance.forEach(a => {
                activities.push({
                    icon: 'user-check',
                    color: '#10B981',
                    text: `Attendance: ${a.status || 'Present'}`,
                    project: projectMap[a.projectId] || 'Unknown',
                    time: a.date || a.createdAt,
                    category: 'Attendance'
                });
            });

            // Sort by date (most recent first) and take top 10
            activities.sort((a, b) => {
                const dateA = a.time ? new Date(typeof a.time === 'object' && a.time.seconds ? a.time.seconds * 1000 : a.time) : new Date(0);
                const dateB = b.time ? new Date(typeof b.time === 'object' && b.time.seconds ? b.time.seconds * 1000 : b.time) : new Date(0);
                return dateB - dateA;
            });

            const recent = activities.slice(0, 10);

            if (countEl) countEl.textContent = `${recent.length} recent`;

            if (recent.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 1.5rem; color: var(--gray);">
                        <i class="fas fa-inbox" style="font-size: 1.5rem; opacity: 0.3;"></i>
                        <p style="font-size: 0.75rem; margin-top: 0.5rem;">No recent activity</p>
                    </div>`;
                return;
            }

            container.innerHTML = recent.map(a => {
                const timeStr = a.time ? this._formatRelativeTime(a.time) : '';
                return `
                    <div style="display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: ${a.color}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-${a.icon}" style="font-size: 0.6875rem; color: ${a.color};"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <p style="font-size: 0.75rem; font-weight: 600; color: var(--dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Utils.escapeHtml(a.text)}</p>
                            <p style="font-size: 0.625rem; color: var(--gray);">${Utils.escapeHtml(a.project)} • ${timeStr}</p>
                        </div>
                    </div>`;
            }).join('');
        } catch (e) {
            console.error('Activity feed error:', e);
            container.innerHTML = '<p style="font-size: 0.75rem; color: var(--gray); text-align: center; padding: 1rem;">Could not load activity</p>';
        }
    },

    _formatRelativeTime(time) {
        try {
            const date = time && typeof time === 'object' && time.seconds
                ? new Date(time.seconds * 1000)
                : new Date(time);
            if (isNaN(date.getTime())) return '';
            const now = new Date();
            const diff = now - date;
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Just now';
            if (mins < 60) return `${mins}m ago`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            if (days < 7) return `${days}d ago`;
            return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } catch (e) {
            return '';
        }
    },

    async renderCashFlow() {
        const incomeEl = document.getElementById('cashFlowIncome');
        const outflowEl = document.getElementById('cashFlowOutflow');
        const netEl = document.getElementById('cashFlowNet');
        const barEl = document.getElementById('cashFlowBar');
        if (!incomeEl) return;

        try {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

            const [projects, clientPayments, expenses, labour] = await Promise.all([
                Storage.projects.getAll(),
                Storage.clientPayments ? Storage.clientPayments.getAll() : Promise.resolve([]),
                Storage.expenses ? Storage.expenses.getAll() : Promise.resolve([]),
                Storage.labour ? Storage.labour.getAll() : Promise.resolve([])
            ]);

            // Income: client payments this month
            const income = clientPayments
                .filter(p => p.date >= monthStart || p.paymentDate >= monthStart)
                .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

            // Outflow: expenses + labour this month
            const expenseOut = expenses
                .filter(e => e.date >= monthStart)
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            const labourOut = labour
                .filter(l => l.date >= monthStart)
                .reduce((s, l) => s + (parseFloat(l.totalAmount) || parseFloat(l.dailyWage) || 0), 0);
            const outflow = expenseOut + labourOut;

            const net = income - outflow;

            incomeEl.textContent = `₹${Utils.formatNumber(income)}`;
            outflowEl.textContent = `₹${Utils.formatNumber(outflow)}`;
            netEl.textContent = `${net >= 0 ? '+' : ''}₹${Utils.formatNumber(Math.abs(net))}`;
            netEl.style.color = net >= 0 ? '#059669' : '#DC2626';

            // Update bar (income ratio)
            const total = income + outflow;
            const ratio = total > 0 ? (income / total * 100) : 50;
            barEl.style.width = `${ratio}%`;
            barEl.style.background = net >= 0
                ? 'linear-gradient(90deg, #10B981, #059669)'
                : 'linear-gradient(90deg, #EF4444, #DC2626)';
        } catch (e) {
            console.error('Cash flow error:', e);
        }
    },

    async renderWorkerUtilization() {
        const arcEl = document.getElementById('utilizationArc');
        const percentEl = document.getElementById('utilizationPercent');
        const activeEl = document.getElementById('activeWorkersToday');
        const totalEl = document.getElementById('totalWorkforce');
        const hoursEl = document.getElementById('todayHoursLogged');
        if (!arcEl) return;

        try {
            const todayStr = new Date().toISOString().split('T')[0];

            const [labour, workEntries, attendance] = await Promise.all([
                Storage.labour ? Storage.labour.getAll() : Promise.resolve([]),
                Storage.workEntries ? Storage.workEntries.getAll() : Promise.resolve([]),
                Storage.attendance ? Storage.attendance.getAll() : Promise.resolve([])
            ]);

            const totalWorkers = labour.length;

            // Workers active today (from work entries or attendance)
            const activeToday = new Set();
            workEntries.filter(w => w.date === todayStr).forEach(w => activeToday.add(w.labourId || w.workerId));
            attendance.filter(a => a.date === todayStr && a.status !== 'absent').forEach(a => activeToday.add(a.workerId || a.labourId));
            const activeCount = activeToday.size;

            // Hours logged today
            const hoursToday = workEntries
                .filter(w => w.date === todayStr)
                .reduce((s, w) => s + (parseFloat(w.hoursWorked) || 0), 0);

            const utilization = totalWorkers > 0 ? Math.round((activeCount / totalWorkers) * 100) : 0;

            percentEl.textContent = `${utilization}%`;
            activeEl.textContent = activeCount;
            totalEl.textContent = totalWorkers;
            hoursEl.textContent = `${hoursToday.toFixed(1)}h`;

            // Update SVG arc
            arcEl.setAttribute('stroke-dasharray', `${utilization}, 100`);
            arcEl.setAttribute('stroke', utilization > 70 ? '#10B981' : utilization > 30 ? '#F59E0B' : '#EF4444');
        } catch (e) {
            console.error('Worker utilization error:', e);
        }
    },

    async renderBurnRate() {
        const container = document.getElementById('burnRateList');
        if (!container) return;

        try {
            const projects = await Storage.projects.getAll();
            const activeProjects = projects.filter(p => p.status === 'In Progress');

            if (activeProjects.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 1rem; color: var(--gray);">
                        <i class="fas fa-check-circle" style="font-size: 1.25rem; opacity: 0.3;"></i>
                        <p style="font-size: 0.75rem; margin-top: 0.5rem;">No active projects</p>
                    </div>`;
                return;
            }

            const burnItems = [];
            for (const p of activeProjects.slice(0, 5)) {
                const budget = parseFloat(p.budget) || 0;
                const spent = await this.getProjectSpent(p.id);
                const remaining = Math.max(0, budget - spent);
                const elapsed = this.getDaysElapsed(p.startDate);
                const dailyRate = elapsed > 0 ? spent / elapsed : 0;
                const daysLeft = dailyRate > 0 ? Math.round(remaining / dailyRate) : Infinity;
                const burnPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

                let color = '#10B981';
                if (burnPercent > 90) color = '#EF4444';
                else if (burnPercent > 70) color = '#F59E0B';

                burnItems.push({
                    name: p.name,
                    burnPercent,
                    daysLeft,
                    dailyRate,
                    color,
                    id: p.id
                });
            }

            container.innerHTML = burnItems.map(b => `
                <div style="cursor: pointer;" onclick="window.location.href='project.html?id=${b.id}'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;">${Utils.escapeHtml(b.name)}</span>
                        <span style="font-size: 0.6875rem; font-weight: 700; color: ${b.color};">${b.daysLeft === Infinity ? '∞' : b.daysLeft + 'd'} left</span>
                    </div>
                    <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${b.burnPercent}%; background: ${b.color}; border-radius: 3px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                        <span style="font-size: 0.5625rem; color: var(--gray);">${b.burnPercent}% spent</span>
                        <span style="font-size: 0.5625rem; color: var(--gray);">₹${Utils.formatNumber(Math.round(b.dailyRate))}/day</span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error('Burn rate error:', e);
            container.innerHTML = '<p style="font-size: 0.75rem; color: var(--gray); text-align: center; padding: 1rem;">Could not load data</p>';
        }
    }
};

// Make App available globally
window.App = App;

// Export for manual initialization from index.html
export { App, Storage };
