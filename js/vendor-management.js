// Vendor Management System - Project-specific vendor services
import Storage from './firebase-storage.js';

// Constants
const VENDOR_CATEGORIES = [
    'Carpenter', 'Plumber', 'Electrician', 'Bar Bender', 'Mason', 'Painter',
    'Tiler', 'Welder', 'HVAC Technician', 'Material Supplier', 'Transport',
    'Cleaning Service', 'Security Service', 'Other'
];

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'upi', label: 'UPI' },
    { value: 'card', label: 'Card' }
];

const Utils = window.Utils || {
    formatNumber(num) { 
        if (num === null || num === undefined || isNaN(num)) return '0';
        return new Intl.NumberFormat('en-IN').format(num); 
    },
    formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); },
    escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
};

const VendorManagement = {
    
    // Render vendor cards for project
    async renderVendors(projectId) {
        const vendors = await Storage.vendors.getByProject(projectId);
        const container = document.getElementById('vendorCardsContainer');
        const empty = document.getElementById('vendorEmpty');
        const totalRow = document.getElementById('vendorTotalRow');

        // Add null checks
        if (!container) {
            console.warn('vendorCardsContainer not found');
            return;
        }

        if (!vendors.length) {
            container.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            if (totalRow) totalRow.classList.add('hidden');
            return;
        }

        if (empty) empty.classList.add('hidden');
        if (totalRow) totalRow.classList.remove('hidden');

        let totalCost = 0, totalPaid = 0;

        const cards = await Promise.all(vendors.map(async (vendor) => {
            // Get payments for this vendor
            const payments = await Storage.vendorPayments.getByVendorAndProject(vendor.id, projectId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const balance = Math.max(0, vendor.agreedCost - paidAmount);
            
            // Update totals
            totalCost += vendor.agreedCost;
            totalPaid += paidAmount;

            // Determine payment status
            let paymentStatus = 'pending';
            let statusClass = 'bg-rose-100 text-rose-700';
            if (paidAmount >= vendor.agreedCost) {
                paymentStatus = 'completed';
                statusClass = 'bg-emerald-100 text-emerald-700';
            } else if (paidAmount > 0) {
                paymentStatus = 'partially_paid';
                statusClass = 'bg-amber-100 text-amber-700';
            }

            return `<div class="card p-4 hover:shadow-lg transition">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">${Utils.escapeHtml(vendor.name)}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="inline-block px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs">${vendor.serviceType}</span>
                            <span class="px-2 py-1 ${statusClass} rounded text-xs">${paymentStatus.replace('_', ' ')}</span>
                        </div>
                        ${vendor.phone ? `<p class="text-xs text-slate-500 mt-1"><i class="fas fa-phone mr-1"></i>${vendor.phone}</p>` : ''}
                        <p class="text-sm text-slate-600 mt-1">${Utils.escapeHtml(vendor.workDescription)}</p>
                    </div>
                    <div class="flex gap-1">
                        <button type="button" class="action-btn" onclick="VendorManagement.openPaymentModal('${vendor.id}', '${Utils.escapeHtml(vendor.name)}', ${balance})" title="Pay Vendor">
                            <i class="fas fa-money-bill-wave text-xs"></i>
                        </button>
                        <button type="button" class="action-btn" onclick="ProjectApp.openModal('vendor','${vendor.id}')" title="Edit Vendor">
                            <i class="fas fa-pen text-xs"></i>
                        </button>
                        <button type="button" class="action-btn delete" onclick="ProjectApp.openDeleteModal('vendor','${vendor.id}')" title="Remove Vendor">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="space-y-2 mb-3">
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Agreed Cost</span>
                        <span class="font-semibold text-slate-800">₹${Utils.formatNumber(vendor.agreedCost)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Paid</span>
                        <span class="font-semibold text-emerald-600">₹${Utils.formatNumber(paidAmount)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Balance</span>
                        <span class="font-semibold ${balance > 0 ? 'text-rose-600' : 'text-slate-500'}">₹${Utils.formatNumber(balance)}</span>
                    </div>
                </div>
            </div>`;
        }));

        container.innerHTML = cards.join('');

        // Update totals with null checks
        const totalBalance = Math.max(0, totalCost - totalPaid);
        const vendorTotalAmountEl = document.getElementById('vendorTotalAmount');
        const vendorTotalPaidEl = document.getElementById('vendorTotalPaid');
        const vendorTotalBalanceEl = document.getElementById('vendorTotalBalance');
        
        if (vendorTotalAmountEl) vendorTotalAmountEl.textContent = `₹${Utils.formatNumber(totalCost)}`;
        if (vendorTotalPaidEl) vendorTotalPaidEl.textContent = `₹${Utils.formatNumber(totalPaid)}`;
        if (vendorTotalBalanceEl) vendorTotalBalanceEl.textContent = `₹${Utils.formatNumber(totalBalance)}`;
    },

    // Handle vendor form submission
    async handleVendorSubmit(e, projectId) {
        e.preventDefault();
        
        const id = document.getElementById('vendorId').value;
        const vendorData = {
            projectId,
            name: document.getElementById('vendorName').value.trim(),
            phone: document.getElementById('vendorPhone').value.trim(),
            serviceType: document.getElementById('vendorServiceType').value,
            workDescription: document.getElementById('vendorWorkDescription').value.trim(),
            agreedCost: parseFloat(document.getElementById('vendorAgreedCost').value),
            paymentStatus: 'pending'
        };

        if (id) {
            await Storage.vendors.update(id, vendorData);
        } else {
            await Storage.vendors.add(vendorData);
        }
        
        return true;
    },

    // Open payment modal
    openPaymentModal(vendorId, vendorName, pendingAmount) {
        const vendorIdInput = document.getElementById('vendorPaymentVendorId');
        const vendorNameEl = document.getElementById('vendorPaymentVendorName');
        const pendingAmountEl = document.getElementById('vendorPaymentPendingAmount');
        const amountInput = document.getElementById('vendorPaymentAmount');
        const dateInput = document.getElementById('vendorPaymentDate');
        const modal = document.getElementById('vendorPaymentModal');
        
        if (!modal) {
            console.warn('vendorPaymentModal not found');
            return;
        }
        
        if (vendorIdInput) vendorIdInput.value = vendorId;
        if (vendorNameEl) vendorNameEl.textContent = vendorName;
        if (pendingAmountEl) pendingAmountEl.textContent = `₹${Utils.formatNumber(pendingAmount)}`;
        if (amountInput) amountInput.value = pendingAmount > 0 ? pendingAmount : '';
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        
        modal.classList.remove('hidden');
        modal.classList.add('active');
    },

    // Handle vendor payment submission
    async handleVendorPaymentSubmit(e, projectId) {
        e.preventDefault();
        
        const paymentData = {
            vendorId: document.getElementById('vendorPaymentVendorId').value,
            projectId,
            amount: parseFloat(document.getElementById('vendorPaymentAmount').value),
            paymentMethod: document.getElementById('vendorPaymentMethod').value,
            paymentDate: document.getElementById('vendorPaymentDate').value,
            notes: document.getElementById('vendorPaymentNotes').value.trim()
        };

        await Storage.vendorPayments.add(paymentData);
        return true;
    },

    // Populate vendor dropdowns
    populateVendorDropdowns() {
        const serviceTypeSelect = document.getElementById('vendorServiceType');
        if (serviceTypeSelect) {
            serviceTypeSelect.innerHTML = VENDOR_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        }

        const paymentMethodSelect = document.getElementById('vendorPaymentMethod');
        if (paymentMethodSelect) {
            paymentMethodSelect.innerHTML = PAYMENT_METHODS.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
        }
    }
};

// Make it globally accessible
window.VendorManagement = VendorManagement;

export default VendorManagement;