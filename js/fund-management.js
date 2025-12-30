// Multi-Project Fund Management System
import Storage from './firebase-storage.js';

const FundManagement = {
    
    // ===== VIRTUAL WALLET MANAGEMENT =====
    
    // Initialize project wallet if doesn't exist
    async initializeProjectWallet(projectId) {
        let wallet = await Storage.projectWallets.getByProject(projectId);
        if (!wallet) {
            wallet = await Storage.projectWallets.add({
                projectId,
                virtualBalance: 0,
                advanceReceived: 0,
                pendingDues: 0,
                totalLoansGiven: 0,
                totalLoansReceived: 0,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
        }
        return wallet;
    },

    // Get current virtual balance for a project
    async getProjectBalance(projectId) {
        const wallet = await this.initializeProjectWallet(projectId);
        return {
            virtualBalance: wallet.virtualBalance || 0,
            advanceReceived: wallet.advanceReceived || 0,
            pendingDues: wallet.pendingDues || 0,
            totalLoansGiven: wallet.totalLoansGiven || 0,
            totalLoansReceived: wallet.totalLoansReceived || 0,
            netBalance: (wallet.virtualBalance || 0) - (wallet.totalLoansReceived || 0) + (wallet.totalLoansGiven || 0)
        };
    },

    // Update project wallet balance
    async updateProjectWallet(projectId, updates) {
        const wallet = await this.initializeProjectWallet(projectId);
        const updatedData = {
            ...updates,
            lastUpdated: new Date().toISOString()
        };
        await Storage.projectWallets.update(wallet.id, updatedData);
        return await Storage.projectWallets.getByProject(projectId);
    },

    // ===== PAYMENT ALLOCATION SYSTEM =====
    
    // Allocate client payment to projects
    async allocatePayment(paymentData) {
        const { totalAmount, allocations, paymentDate, receivedBy, from, method, notes } = paymentData;
        
        // Validate allocations
        const totalAllocated = allocations.reduce((sum, alloc) => sum + parseFloat(alloc.amount), 0);
        if (Math.abs(totalAllocated - totalAmount) > 0.01) {
            throw new Error(`Total allocated (₹${totalAllocated}) doesn't match payment amount (₹${totalAmount})`);
        }

        // Create payment record
        const paymentRecord = await Storage.clientPayments.add({
            projectId: 'MULTI_PROJECT', // Special marker for multi-project payments
            amount: totalAmount,
            date: paymentDate,
            receivedBy,
            from,
            method,
            notes: notes || 'Multi-project allocation',
            isMultiProject: true
        });

        // Create allocation records and update wallets
        for (const allocation of allocations) {
            // Create allocation record
            await Storage.paymentAllocations.add({
                paymentId: paymentRecord.id,
                projectId: allocation.projectId,
                amount: parseFloat(allocation.amount),
                description: allocation.description || 'Client payment allocation',
                date: paymentDate
            });

            // Update project wallet
            const wallet = await this.initializeProjectWallet(allocation.projectId);
            await this.updateProjectWallet(allocation.projectId, {
                virtualBalance: (wallet.virtualBalance || 0) + parseFloat(allocation.amount),
                advanceReceived: (wallet.advanceReceived || 0) + parseFloat(allocation.amount)
            });
        }

        return paymentRecord;
    },

    // Allocate existing client payment to fund management (for auto-allocation)
    async allocateExistingPayment(totalAmount, paymentDate, from, receivedBy, method, allocations, notes, existingPaymentId) {
        // Validate allocations
        const totalAllocated = allocations.reduce((sum, alloc) => sum + parseFloat(alloc.amount), 0);
        if (Math.abs(totalAllocated - totalAmount) > 0.01) {
            throw new Error(`Total allocated (₹${totalAllocated}) doesn't match payment amount (₹${totalAmount})`);
        }

        // Update existing payment record to mark as allocated
        await Storage.clientPayments.update(existingPaymentId, {
            isAllocated: true,
            allocationDate: new Date().toISOString(),
            allocationNotes: notes
        });

        // Create allocation records and update wallets
        for (const allocation of allocations) {
            // Create allocation record
            await Storage.paymentAllocations.add({
                paymentId: existingPaymentId,
                projectId: allocation.projectId,
                amount: parseFloat(allocation.amount),
                description: allocation.description || 'Auto-allocated client payment',
                date: paymentDate
            });

            // Update project wallet
            const wallet = await this.initializeProjectWallet(allocation.projectId);
            await this.updateProjectWallet(allocation.projectId, {
                virtualBalance: (wallet.virtualBalance || 0) + parseFloat(allocation.amount),
                advanceReceived: (wallet.advanceReceived || 0) + parseFloat(allocation.amount)
            });
        }

        return existingPaymentId;
    },

    // Convenience function for single-project auto-allocation (called from project.js)
    async allocateClientPayment(totalAmount, paymentDate, from, receivedBy, method, allocations, notes, existingPaymentId) {
        return await this.allocateExistingPayment(totalAmount, paymentDate, from, receivedBy, method, allocations, notes, existingPaymentId);
    },

    // ===== CROSS-PROJECT EXPENSE SYSTEM =====
    
    // Record expense paid by one project for another
    async recordCrossProjectExpense(expenseData) {
        const { 
            beneficiaryProjectId,  // Project that benefits from expense
            paymentSources,        // Array of {projectId, amount} who paid
            expenseDetails,        // {description, category, totalAmount, date}
            expenseType           // 'material', 'labour', 'expense'
        } = expenseData;

        // Validate payment sources
        const totalPaid = paymentSources.reduce((sum, source) => sum + parseFloat(source.amount), 0);
        if (Math.abs(totalPaid - expenseDetails.totalAmount) > 0.01) {
            throw new Error(`Total paid (₹${totalPaid}) doesn't match expense amount (₹${expenseDetails.totalAmount})`);
        }

        // Record the actual expense in beneficiary project
        let expenseRecord;
        if (expenseType === 'material') {
            expenseRecord = await Storage.materials.add({
                projectId: beneficiaryProjectId,
                ...expenseDetails,
                paidViaCrossProject: true,
                paymentSources: paymentSources
            });
        } else if (expenseType === 'labour') {
            expenseRecord = await Storage.labour.add({
                projectId: beneficiaryProjectId,
                ...expenseDetails,
                paidViaCrossProject: true,
                paymentSources: paymentSources
            });
        } else {
            expenseRecord = await Storage.expenses.add({
                projectId: beneficiaryProjectId,
                ...expenseDetails,
                paidViaCrossProject: true,
                paymentSources: paymentSources
            });
        }

        // Create cross-project transaction records for each payment source
        const transactionRecords = [];
        for (const source of paymentSources) {
            if (source.projectId !== beneficiaryProjectId) {
                // Create loan record
                const transaction = await Storage.crossProjectTransactions.add({
                    lenderProjectId: source.projectId,
                    borrowerProjectId: beneficiaryProjectId,
                    amount: parseFloat(source.amount),
                    expenseId: expenseRecord.id,
                    expenseType: expenseType,
                    description: `${expenseDetails.description} - Cross-project payment`,
                    date: expenseDetails.date,
                    status: 'active', // active, settled
                    settlementAmount: 0
                });
                transactionRecords.push(transaction);

                // Update lender wallet (reduce balance, increase loans given)
                const lenderWallet = await this.initializeProjectWallet(source.projectId);
                await this.updateProjectWallet(source.projectId, {
                    virtualBalance: (lenderWallet.virtualBalance || 0) - parseFloat(source.amount),
                    totalLoansGiven: (lenderWallet.totalLoansGiven || 0) + parseFloat(source.amount)
                });

                // Update borrower wallet (increase loans received)
                const borrowerWallet = await this.initializeProjectWallet(beneficiaryProjectId);
                await this.updateProjectWallet(beneficiaryProjectId, {
                    totalLoansReceived: (borrowerWallet.totalLoansReceived || 0) + parseFloat(source.amount)
                });
            }
        }

        return {
            expenseRecord,
            transactionRecords
        };
    },

    // ===== AUTO-SETTLEMENT SYSTEM =====
    
    // Auto-settle loans when borrower receives payment
    async autoSettleLoans(borrowerProjectId, availableAmount) {
        // Get all active loans for this project
        const activeLoans = await Storage.crossProjectTransactions.getByBorrower(borrowerProjectId);
        const unsettledLoans = activeLoans.filter(loan => loan.status === 'active');
        
        if (!unsettledLoans.length) return { settledLoans: [], remainingAmount: availableAmount };

        // Sort by date (oldest first) for FIFO settlement
        unsettledLoans.sort((a, b) => new Date(a.date) - new Date(b.date));

        let remainingAmount = availableAmount;
        const settledLoans = [];

        for (const loan of unsettledLoans) {
            const loanBalance = loan.amount - (loan.settlementAmount || 0);
            
            if (remainingAmount >= loanBalance) {
                // Full settlement
                const settlementAmount = loanBalance;
                remainingAmount -= settlementAmount;

                // Create settlement record
                await Storage.settlementRecords.add({
                    transactionId: loan.id,
                    lenderProjectId: loan.lenderProjectId,
                    borrowerProjectId: loan.borrowerProjectId,
                    settlementAmount,
                    settlementDate: new Date().toISOString(),
                    settlementType: 'auto'
                });

                // Update transaction status
                await Storage.crossProjectTransactions.update(loan.id, {
                    status: 'settled',
                    settlementAmount: loan.amount,
                    settledDate: new Date().toISOString()
                });

                // Update lender wallet (increase balance, decrease loans given)
                const lenderWallet = await this.initializeProjectWallet(loan.lenderProjectId);
                await this.updateProjectWallet(loan.lenderProjectId, {
                    virtualBalance: (lenderWallet.virtualBalance || 0) + settlementAmount,
                    totalLoansGiven: (lenderWallet.totalLoansGiven || 0) - settlementAmount
                });

                // Update borrower wallet (decrease loans received)
                const borrowerWallet = await this.initializeProjectWallet(loan.borrowerProjectId);
                await this.updateProjectWallet(loan.borrowerProjectId, {
                    totalLoansReceived: (borrowerWallet.totalLoansReceived || 0) - settlementAmount
                });

                settledLoans.push({ ...loan, settlementAmount });

            } else if (remainingAmount > 0) {
                // Partial settlement
                const settlementAmount = remainingAmount;
                remainingAmount = 0;

                // Create settlement record
                await Storage.settlementRecords.add({
                    transactionId: loan.id,
                    lenderProjectId: loan.lenderProjectId,
                    borrowerProjectId: loan.borrowerProjectId,
                    settlementAmount,
                    settlementDate: new Date().toISOString(),
                    settlementType: 'auto_partial'
                });

                // Update transaction with partial settlement
                await Storage.crossProjectTransactions.update(loan.id, {
                    settlementAmount: (loan.settlementAmount || 0) + settlementAmount,
                    lastSettlementDate: new Date().toISOString()
                });

                // Update lender wallet
                const lenderWallet = await this.initializeProjectWallet(loan.lenderProjectId);
                await this.updateProjectWallet(loan.lenderProjectId, {
                    virtualBalance: (lenderWallet.virtualBalance || 0) + settlementAmount,
                    totalLoansGiven: (lenderWallet.totalLoansGiven || 0) - settlementAmount
                });

                // Update borrower wallet
                const borrowerWallet = await this.initializeProjectWallet(loan.borrowerProjectId);
                await this.updateProjectWallet(loan.borrowerProjectId, {
                    totalLoansReceived: (borrowerWallet.totalLoansReceived || 0) - settlementAmount
                });

                settledLoans.push({ ...loan, settlementAmount });
                break; // No more money to settle
            }
        }

        return { settledLoans, remainingAmount };
    },

    // Manual settlement of cross-project transaction
    async settleCrossProjectTransaction(transactionId, settlementAmount, settlementType = 'manual', additionalData = {}) {
        try {
            // Get the transaction
            const transaction = await Storage.crossProjectTransactions.getById(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            // Validate settlement amount
            const currentBalance = transaction.amount - (transaction.settlementAmount || 0);
            if (settlementAmount > currentBalance) {
                throw new Error('Settlement amount cannot exceed outstanding balance');
            }

            const newSettlementAmount = (transaction.settlementAmount || 0) + settlementAmount;
            const isFullySettled = newSettlementAmount >= transaction.amount;

            // Create settlement record
            await Storage.settlementRecords.add({
                transactionId: transaction.id,
                lenderProjectId: transaction.lenderProjectId,
                borrowerProjectId: transaction.borrowerProjectId,
                settlementAmount,
                settlementDate: new Date().toISOString(),
                settlementType,
                originalTransactionId: transaction.id,
                ...additionalData
            });

            // Update transaction
            const updateData = {
                settlementAmount: newSettlementAmount,
                lastSettlementDate: new Date().toISOString()
            };

            if (isFullySettled) {
                updateData.status = 'settled';
                updateData.settledDate = new Date().toISOString();
            }

            await Storage.crossProjectTransactions.update(transactionId, updateData);

            // Update project wallets
            // Lender gets money back
            const lenderWallet = await this.initializeProjectWallet(transaction.lenderProjectId);
            await this.updateProjectWallet(transaction.lenderProjectId, {
                virtualBalance: (lenderWallet.virtualBalance || 0) + settlementAmount,
                totalLoansGiven: (lenderWallet.totalLoansGiven || 0) - settlementAmount
            });

            // Borrower reduces debt
            const borrowerWallet = await this.initializeProjectWallet(transaction.borrowerProjectId);
            await this.updateProjectWallet(transaction.borrowerProjectId, {
                totalLoansReceived: (borrowerWallet.totalLoansReceived || 0) - settlementAmount
            });

            return {
                success: true,
                settlementAmount,
                remainingBalance: transaction.amount - newSettlementAmount,
                fullySettled: isFullySettled
            };

        } catch (error) {
            console.error('Error settling cross-project transaction:', error);
            throw error;
        }
    },

    // ===== REPORTING & ANALYTICS =====
    
    // Get comprehensive project financial summary
    async getProjectFinancialSummary(projectId) {
        const balance = await this.getProjectBalance(projectId);
        const loansGiven = await Storage.crossProjectTransactions.getByLender(projectId);
        const loansReceived = await Storage.crossProjectTransactions.getByBorrower(projectId);
        const paymentAllocations = await Storage.paymentAllocations.getByProject(projectId);
        
        // Calculate active loans
        const activeLoansGiven = loansGiven.filter(l => l.status === 'active');
        const activeLoansReceived = loansReceived.filter(l => l.status === 'active');
        
        const totalActiveLoansGiven = activeLoansGiven.reduce((sum, l) => sum + (l.amount - (l.settlementAmount || 0)), 0);
        const totalActiveLoansReceived = activeLoansReceived.reduce((sum, l) => sum + (l.amount - (l.settlementAmount || 0)), 0);

        return {
            projectId,
            virtualBalance: balance.virtualBalance,
            advanceReceived: balance.advanceReceived,
            pendingDues: balance.pendingDues,
            activeLoansGiven: totalActiveLoansGiven,
            activeLoansReceived: totalActiveLoansReceived,
            netAvailableBalance: balance.virtualBalance - totalActiveLoansReceived,
            totalPaymentsReceived: paymentAllocations.reduce((sum, p) => sum + p.amount, 0),
            loanDetails: {
                given: activeLoansGiven,
                received: activeLoansReceived
            }
        };
    },

    // Get overall fund status across all projects
    async getOverallFundStatus() {
        const allWallets = await Storage.projectWallets.getAll();
        const allProjects = await Storage.projects.getAll();
        
        let totalVirtualBalance = 0;
        let totalLoansGiven = 0;
        let totalLoansReceived = 0;
        
        const projectSummaries = [];
        
        for (const project of allProjects) {
            const summary = await this.getProjectFinancialSummary(project.id);
            projectSummaries.push({
                projectId: project.id,
                projectName: project.name,
                ...summary
            });
            
            totalVirtualBalance += summary.virtualBalance;
            totalLoansGiven += summary.activeLoansGiven;
            totalLoansReceived += summary.activeLoansReceived;
        }
        
        return {
            totalVirtualBalance,
            totalActiveLoans: totalLoansGiven, // Should equal totalLoansReceived
            netBankBalance: totalVirtualBalance, // Virtual balances should sum to actual bank balance
            projectSummaries,
            isBalanced: Math.abs(totalLoansGiven - totalLoansReceived) < 0.01
        };
    }
};

// Make it globally accessible
window.FundManagement = FundManagement;

export default FundManagement;