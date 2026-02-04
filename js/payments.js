// Payments Page Logic - Firebase Version
import Storage from './firebase-storage.js';
import FinancialCalculator from './financial-calculator.js';

// Import FundManagement for wallet synchronization (Requirement 4.1)
let FundManagement = null;
const loadFundManagement = async () => {
    if (!FundManagement && window.FundManagement) {
        FundManagement = window.FundManagement;
    }
    if (!FundManagement) {
        try {
            const module = await import('./fund-management.js');
            FundManagement = module.default;
        } catch (e) {
            console.warn('FundManagement module not available:', e);
        }
    }
    return FundManagement;
};

const Utils = window.Utils || {
    formatNumber(num) { 
        if (num === null || num === undefined || isNaN(num)) return '0';
        return new Intl.NumberFormat('en-IN').format(num); 
    },
    formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); },
    escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; },
    /**
     * Get days remaining until due date
     * Fixed to handle timezone issues correctly (Requirement 4.3)
     * @param {string} endDate - Due date string
     * @returns {number} Days remaining (negative if overdue)
     */
    getDaysRemaining(endDate) {
        // Parse the date string as local date to avoid timezone issues
        const [year, month, day] = endDate.split('-').map(Number);
        const end = new Date(year, month - 1, day); // month is 0-indexed
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    },
    /**
     * Get payment status based on due date and paid status
     * Fixed overdue detection (Requirement 4.3)
     * @param {string} dueDate - Due date string (YYYY-MM-DD)
     * @param {boolean} isPaid - Whether payment is marked as paid
     * @returns {Object} Status object with class and text
     */
    getPaymentStatus(dueDate, isPaid) {
        // If paid, always return paid status regardless of date (Requirement 4.3)
        if (isPaid) return { class: 'text-green-500 bg-primary/10', text: 'Paid', isOverdue: false };
        
        const days = this.getDaysRemaining(dueDate);
        
        // Payment is overdue if: dueDate < currentDate AND isPaid === false (Requirement 4.3)
        if (days < 0) return { class: 'text-red-500 bg-red-500/20 animate-pulse', text: `${Math.abs(days)}d overdue`, isOverdue: true };
        if (days === 0) return { class: 'text-red-500 bg-red-500/10', text: 'Due today', isOverdue: false };
        if (days <= 3) return { class: 'text-amber-500 bg-amber-500/10', text: `Due in ${days}d`, isOverdue: false };
        return { class: 'text-gray-400', text: `Due in ${days}d`, isOverdue: false };
    },
    /**
     * Check if a payment is overdue (Requirement 4.3)
     * @param {string} dueDate - Due date string (YYYY-MM-DD)
     * @param {boolean} isPaid - Whether payment is marked as paid
     * @returns {boolean} True if payment is overdue
     */
    isPaymentOverdue(dueDate, isPaid) {
        // Payment is overdue if and only if: dueDate < currentDate AND isPaid === false
        if (isPaid) return false;
        return this.getDaysRemaining(dueDate) < 0;
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

    showLoading(show, message = 'Loading...') {
        let loader = document.getElementById('loadingOverlay');
        if (show && !loader) {
            loader = document.createElement('div');
            loader.id = 'loadingOverlay';
            loader.className = 'fixed inset-0 bg-white/80 flex items-center justify-center z-50';
            loader.innerHTML = `<div class="text-center"><i class="fas fa-spinner fa-spin text-4xl text-sky-500 mb-4"></i><p class="text-slate-600">${message}</p></div>`;
            document.body.appendChild(loader);
            
            // Set timeout to handle long operations (Requirement 9.5)
            this.loadingTimeout = setTimeout(() => {
                this.updateLoadingMessage('This is taking longer than expected...');
            }, 5000);
            
            // Set maximum timeout
            this.maxLoadingTimeout = setTimeout(() => {
                this.showLoading(false);
                this.showToast('Operation timed out. Please try again.', 'error');
            }, 30000);
            
        } else if (!show && loader) {
            // Clear timeouts
            if (this.loadingTimeout) {
                clearTimeout(this.loadingTimeout);
                this.loadingTimeout = null;
            }
            if (this.maxLoadingTimeout) {
                clearTimeout(this.maxLoadingTimeout);
                this.maxLoadingTimeout = null;
            }
            loader.remove();
        }
    },

    /**
     * Update loading message while operation is in progress
     * @param {string} message - New message to display
     */
    updateLoadingMessage(message) {
        const loader = document.getElementById('loadingOverlay');
        if (loader) {
            const messageEl = loader.querySelector('p');
            if (messageEl) {
                messageEl.textContent = message;
            }
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

    /**
     * Validate payment form data (Requirements 9.2, 9.3)
     * @param {Object} data - Payment data to validate
     * @returns {Object} Validation result with isValid and errors array
     */
    validatePaymentData(data) {
        const errors = [];
        
        // Validate vendor name
        if (!data.vendorName || data.vendorName.trim() === '') {
            errors.push('Vendor/Payee name is required');
        }
        
        // Validate amount - reject negative or zero values (Requirement 9.2)
        if (!FinancialCalculator.isValidPositiveAmount(data.amount)) {
            errors.push('Payment amount must be a positive number greater than zero');
        }
        
        // Validate due date
        if (!data.dueDate) {
            errors.push('Due date is required');
        }
        
        // Validate paid date if marked as paid
        if (data.isPaid && !data.paidDate) {
            errors.push('Paid date is required when marking payment as paid');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    },

    /**
     * Show validation error message to user (Requirement 9.1)
     * @param {string[]} errors - Array of error messages
     */
    showValidationErrors(errors) {
        const message = errors.join('\n• ');
        this.showToast(`Validation Error:\n• ${message}`, 'error');
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('paymentId').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const projectId = document.getElementById('paymentProject').value || null;
        const isPaid = document.getElementById('isPaid').checked;
        
        const data = {
            vendorName: document.getElementById('vendorName').value.trim(),
            type: document.getElementById('paymentType').value,
            projectId: projectId,
            amount: FinancialCalculator.parseAmount(amount),
            dueDate: document.getElementById('dueDate').value,
            description: document.getElementById('paymentDesc').value.trim(),
            isPaid: isPaid,
            paidDate: isPaid ? document.getElementById('paidDate').value : null
        };

        // Validate payment data (Requirements 9.2, 9.3)
        const validation = this.validatePaymentData(data);
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }

        this.showLoading(true);
        
        try {
            if (id) {
                // Get existing payment to check for changes
                const payments = await Storage.payments.getAll();
                const existingPayment = payments.find(p => p.id === id);
                
                await Storage.payments.update(id, data);
                
                // Sync wallet if payment status changed to paid and has a project (Requirement 4.1)
                if (data.isPaid && !existingPayment?.isPaid && projectId) {
                    await this.syncPaymentToWallet(projectId, data.amount, 'add');
                }
                // If payment was unpaid (reversed), restore wallet
                else if (!data.isPaid && existingPayment?.isPaid && existingPayment?.projectId) {
                    await this.syncPaymentToWallet(existingPayment.projectId, existingPayment.amount, 'subtract');
                }
            } else {
                const newPayment = await Storage.payments.add(data);
                
                // Sync wallet if new payment is marked as paid and has a project (Requirement 4.1)
                if (data.isPaid && projectId) {
                    await this.syncPaymentToWallet(projectId, data.amount, 'add');
                }
            }

            this.closeModal();
            await this.render();
            await this.updateMetrics();
            this.showToast('Payment saved', 'success');
        } catch (error) {
            console.error('Error saving payment:', error);
            this.showToast('Error saving payment', 'error');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Sync payment amount with project wallet (Requirement 4.1)
     * @param {string} projectId - Project ID to update wallet for
     * @param {number} amount - Payment amount
     * @param {string} operation - 'add' to increase balance, 'subtract' to decrease
     */
    async syncPaymentToWallet(projectId, amount, operation) {
        try {
            const fundMgmt = await loadFundManagement();
            if (!fundMgmt) {
                console.warn('FundManagement not available for wallet sync');
                return;
            }

            const parsedAmount = FinancialCalculator.parseAmount(amount);
            const wallet = await fundMgmt.initializeProjectWallet(projectId);
            
            if (operation === 'add') {
                // After client payment, update project wallet balance (Requirement 4.1)
                await fundMgmt.updateProjectWallet(projectId, {
                    virtualBalance: FinancialCalculator.add(wallet.virtualBalance || 0, parsedAmount),
                    advanceReceived: FinancialCalculator.add(wallet.advanceReceived || 0, parsedAmount)
                });
            } else if (operation === 'subtract') {
                // Reverse wallet update when payment is deleted/unpaid
                await fundMgmt.updateProjectWallet(projectId, {
                    virtualBalance: FinancialCalculator.subtract(wallet.virtualBalance || 0, parsedAmount),
                    advanceReceived: FinancialCalculator.subtract(wallet.advanceReceived || 0, parsedAmount)
                });
            }
        } catch (error) {
            console.error('Error syncing payment to wallet:', error);
            // Don't throw - wallet sync failure shouldn't block payment save
        }
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
        try {
            // Get payment details before marking as paid
            const payments = await Storage.payments.getAll();
            const payment = payments.find(p => p.id === id);
            
            await Storage.payments.update(id, { isPaid: true, paidDate: new Date().toISOString().split('T')[0] });
            
            // Sync wallet if payment has a project (Requirement 4.1)
            if (payment && payment.projectId) {
                await this.syncPaymentToWallet(payment.projectId, payment.amount, 'add');
            }
            
            await this.render();
            await this.updateMetrics();
            this.showToast('Marked as paid', 'success');
        } catch (error) {
            console.error('Error marking payment as paid:', error);
            this.showToast('Error marking payment as paid', 'error');
        } finally {
            this.showLoading(false);
        }
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
        
        // Use FinancialCalculator for precise arithmetic (Requirement 1.1, 1.2)
        const total = FinancialCalculator.sum(payments.map(p => p.amount));
        const pending = FinancialCalculator.sum(
            payments.filter(p => !p.isPaid).map(p => p.amount)
        );
        const paid = FinancialCalculator.sum(
            payments.filter(p => p.isPaid).map(p => p.amount)
        );
        // Use fixed overdue detection (Requirement 4.3)
        const overdue = FinancialCalculator.sum(
            payments.filter(p => Utils.isPaymentOverdue(p.dueDate, p.isPaid)).map(p => p.amount)
        );

        document.getElementById('totalPayable').textContent = `₹${FinancialCalculator.formatCurrency(total)}`;
        document.getElementById('totalPending').textContent = `₹${FinancialCalculator.formatCurrency(pending)}`;
        document.getElementById('totalPaid').textContent = `₹${FinancialCalculator.formatCurrency(paid)}`;
        document.getElementById('totalOverdue').textContent = `₹${FinancialCalculator.formatCurrency(overdue)}`;
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
            try {
                // Get payment details before deletion
                const payments = await Storage.payments.getAll();
                const payment = payments.find(p => p.id === this.deleteTargetId);
                
                // Reverse wallet balance if payment was paid and had a project (Requirement 4.2)
                if (payment && payment.isPaid && payment.projectId) {
                    await this.syncPaymentToWallet(payment.projectId, payment.amount, 'subtract');
                }
                
                // Remove associated fund allocations (Requirement 4.2)
                await this.removePaymentAllocations(this.deleteTargetId);
                
                // Delete the payment
                await Storage.payments.delete(this.deleteTargetId);
                
                await this.render();
                await this.updateMetrics();
                this.showToast('Payment deleted', 'success');
            } catch (error) {
                console.error('Error deleting payment:', error);
                this.showToast('Error deleting payment', 'error');
            } finally {
                this.showLoading(false);
            }
        }
        this.closeDeleteModal();
    },

    /**
     * Remove all fund allocations associated with a payment (Requirement 4.2)
     * Restores wallet balances for each allocation
     * @param {string} paymentId - Payment ID to remove allocations for
     */
    async removePaymentAllocations(paymentId) {
        try {
            // Get all allocations for this payment
            const allocations = await Storage.paymentAllocations.getByPayment(paymentId);
            
            if (!allocations || allocations.length === 0) {
                return; // No allocations to remove
            }
            
            const fundMgmt = await loadFundManagement();
            
            // Reverse each allocation
            for (const allocation of allocations) {
                const allocAmount = FinancialCalculator.parseAmount(allocation.amount);
                
                // Restore wallet balance if FundManagement is available
                if (fundMgmt && allocation.projectId) {
                    try {
                        const wallet = await fundMgmt.initializeProjectWallet(allocation.projectId);
                        await fundMgmt.updateProjectWallet(allocation.projectId, {
                            virtualBalance: FinancialCalculator.subtract(wallet.virtualBalance || 0, allocAmount),
                            advanceReceived: FinancialCalculator.subtract(wallet.advanceReceived || 0, allocAmount)
                        });
                    } catch (walletError) {
                        console.error('Error restoring wallet for allocation:', walletError);
                    }
                }
                
                // Delete the allocation record
                await Storage.paymentAllocations.delete(allocation.id);
            }
        } catch (error) {
            console.error('Error removing payment allocations:', error);
            // Don't throw - allocation removal failure shouldn't block payment deletion
        }
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
