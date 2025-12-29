// Multi-Project Comparison Logic - Firebase Version
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

const CompareApp = {
    charts: {},
    colors: ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],

    async init() {
        this.showLoading(true);
        await this.renderProfitability();
        await this.renderDelays();
        await this.renderResources();
        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());
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


    async getProjectData() {
        const projects = await Storage.projects.getAll();
        const result = [];
        
        for (const p of projects) {
            const materials = await Storage.materials.getByProject(p.id);
            const labour = await Storage.labour.getByProject(p.id);
            const expenses = await Storage.expenses.getByProject(p.id);
            const transfers = await Storage.budgetTransfers.getByProject(p.id);

            let budgetAdj = 0;
            transfers.forEach(t => {
                const amount = parseFloat(t.amount) || 0;
                if (t.fromProjectId === p.id) budgetAdj -= amount;
                if (t.toProjectId === p.id) budgetAdj += amount;
            });

            const matCost = materials.filter(m => m.status === 'used').reduce((s, m) => {
                const qty = parseFloat(m.quantity) || 0;
                const rate = parseFloat(m.rate) || 0;
                return s + (qty * rate);
            }, 0) - materials.filter(m => m.status === 'recovered').reduce((s, m) => {
                const qty = parseFloat(m.quantity) || 0;
                const rate = parseFloat(m.rate) || 0;
                return s + (qty * rate);
            }, 0);
            
            const labCost = labour.reduce((s, l) => {
                const total = parseFloat(l.totalAmount) || 0;
                const wage = parseFloat(l.dailyWage) || 0;
                const days = parseFloat(l.daysWorked) || 0;
                return s + (total || (wage * days));
            }, 0);
            
            const expCost = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            const effectiveBudget = (parseFloat(p.budget) || 0) + budgetAdj;
            const totalSpent = Math.max(0, matCost) + labCost + expCost;
            
            const startDate = new Date(p.startDate);
            const endDate = new Date(p.endDate);
            const daysTotal = isNaN(startDate.getTime()) || isNaN(endDate.getTime()) ? 0 : Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            const daysRemaining = Utils.getDaysRemaining(p.endDate);
            const daysElapsed = Math.max(0, daysTotal - daysRemaining);
            const progress = p.status === 'Completed' ? 100 : p.status === 'Planning' ? 0 : daysTotal > 0 ? Math.min(100, Math.round((daysElapsed / daysTotal) * 100)) : 0;

            result.push({
                ...p,
                effectiveBudget,
                matCost: Math.max(0, matCost),
                labCost,
                expCost,
                totalSpent,
                remaining: effectiveBudget - totalSpent,
                percentUsed: effectiveBudget > 0 ? Math.round((totalSpent / effectiveBudget) * 100) : 0,
                daysTotal,
                daysRemaining,
                daysElapsed,
                progress,
                workerCount: labour.length
            });
        }
        return result;
    },

    async renderProfitability() {
        const data = await this.getProjectData();
        const tbody = document.getElementById('profitTable');

        tbody.innerHTML = data.map(p => {
            const health = Utils.getBudgetHealth(p.totalSpent, p.effectiveBudget);
            return `
                <tr>
                    <td class="font-medium text-slate-800">${Utils.escapeHtml(p.name)}</td>
                    <td>₹${Utils.formatNumber(p.effectiveBudget)}</td>
                    <td class="text-sky-600">₹${Utils.formatNumber(p.totalSpent)}</td>
                    <td class="${p.remaining >= 0 ? 'text-green-500' : 'text-red-500'}">₹${Utils.formatNumber(Math.abs(p.remaining))}</td>
                    <td><span class="text-${health.color}-500">${p.percentUsed}%</span></td>
                    <td><span class="status-badge ${this.getStatusClass(p.status)}">${p.status}</span></td>
                </tr>
            `;
        }).join('');

        if (this.charts.profit) this.charts.profit.destroy();
        this.charts.profit = new Chart(document.getElementById('profitChart'), {
            type: 'bar',
            data: {
                labels: data.map(p => p.name.substring(0, 15)),
                datasets: [
                    { label: 'Budget', data: data.map(p => p.effectiveBudget), backgroundColor: '#3B82F6' },
                    { label: 'Spent', data: data.map(p => p.totalSpent), backgroundColor: '#F59E0B' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#9CA3AF' } } },
                scales: {
                    y: { ticks: { color: '#9CA3AF', callback: v => '₹' + (v/1000) + 'K' }, grid: { color: '#e5e7eb' } },
                    x: { ticks: { color: '#9CA3AF' }, grid: { display: false } }
                }
            }
        });
    },

    async renderDelays() {
        const data = await this.getProjectData();
        const tbody = document.getElementById('delayTable');

        tbody.innerHTML = data.map(p => {
            const deadline = Utils.getDeadlineStatus(p.endDate, p.status);
            return `
                <tr>
                    <td class="font-medium text-slate-800">${Utils.escapeHtml(p.name)}</td>
                    <td>${Utils.formatDate(p.startDate)}</td>
                    <td>${Utils.formatDate(p.endDate)}</td>
                    <td>${p.daysTotal} days</td>
                    <td><span class="px-2 py-1 rounded text-xs ${deadline.class}">${deadline.text}</span></td>
                    <td>
                        <div class="flex items-center gap-2">
                            <div class="flex-1 progress-bar"><div class="progress-fill bg-sky-500" style="width:${p.progress}%"></div></div>
                            <span class="text-xs text-gray-400">${p.progress}%</span>
                        </div>
                    </td>
                    <td><span class="status-badge ${this.getStatusClass(p.status)}">${p.status}</span></td>
                </tr>
            `;
        }).join('');

        if (this.charts.delay) this.charts.delay.destroy();
        this.charts.delay = new Chart(document.getElementById('delayChart'), {
            type: 'bar',
            data: {
                labels: data.map(p => p.name.substring(0, 15)),
                datasets: [{
                    label: 'Days Remaining',
                    data: data.map(p => p.daysRemaining),
                    backgroundColor: data.map(p => p.daysRemaining < 0 ? '#EF4444' : p.daysRemaining <= 7 ? '#F59E0B' : '#10B981')
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#9CA3AF' }, grid: { color: '#e5e7eb' } },
                    y: { ticks: { color: '#9CA3AF' }, grid: { display: false } }
                }
            }
        });
    },

    async renderResources() {
        const data = await this.getProjectData();
        const tbody = document.getElementById('resourceTable');

        tbody.innerHTML = data.map(p => `
            <tr>
                <td class="font-medium text-slate-800">${Utils.escapeHtml(p.name)}</td>
                <td class="text-blue-500">₹${Utils.formatNumber(p.matCost)}</td>
                <td class="text-green-500">₹${Utils.formatNumber(p.labCost)}</td>
                <td class="text-purple-500">₹${Utils.formatNumber(p.expCost)}</td>
                <td class="font-semibold text-sky-600">₹${Utils.formatNumber(p.totalSpent)}</td>
                <td>${p.workerCount}</td>
            </tr>
        `).join('');

        if (this.charts.material) this.charts.material.destroy();
        this.charts.material = new Chart(document.getElementById('materialChart'), {
            type: 'doughnut',
            data: {
                labels: data.map(p => p.name.substring(0, 12)),
                datasets: [{ data: data.map(p => p.matCost), backgroundColor: this.colors }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#9CA3AF' } } } }
        });

        if (this.charts.labour) this.charts.labour.destroy();
        this.charts.labour = new Chart(document.getElementById('labourChart'), {
            type: 'doughnut',
            data: {
                labels: data.map(p => p.name.substring(0, 12)),
                datasets: [{ data: data.map(p => p.labCost), backgroundColor: this.colors }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#9CA3AF' } } } }
        });
    },

    async exportCSV() {
        const data = await this.getProjectData();
        const exportData = data.map(p => ({
            'Project': p.name,
            'Client': p.clientName,
            'Status': p.status,
            'Budget': p.effectiveBudget,
            'Materials': p.matCost,
            'Labour': p.labCost,
            'Expenses': p.expCost,
            'Total Spent': p.totalSpent,
            'Remaining': p.remaining,
            '% Used': p.percentUsed,
            'Days Total': p.daysTotal,
            'Days Remaining': p.daysRemaining,
            'Progress %': p.progress,
            'Workers': p.workerCount
        }));
        Utils.exportToCSV(exportData, 'project_comparison.csv');
    },

    getStatusClass(status) {
        return { 'Planning': 'status-planning', 'In Progress': 'status-in-progress', 'On Hold': 'status-on-hold', 'Completed': 'status-completed' }[status] || 'status-planning';
    }
};

window.CompareApp = CompareApp;

export { CompareApp };
