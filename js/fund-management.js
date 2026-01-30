// Multi-Project Fund Management System
import Storage from './firebase-storage.js';
import FinancialCalculator from './financial-calculator.js';

/**
 * Error logging utility for debugging (Requirement 9.6)
 * @param {string} operation - Name of the operation that failed
 * @param {Error} error - The error object
 * @param {Object} context - Additional context for debugging
 */
function logError(operation, error, context = {}) {
    console.error(`[FundManagement] ${operation} failed:`, {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create a user-friendly error message (Requirement 9.1)
 * @param {string} operation - Name of the operation
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
function createUserFriendlyError(operation, error) {
    // Map common errors to user-friendly messages
    const errorMessages = {
        'PERMISSION_DENIED': 'You don\'t have permission to perform this action',
        'UNAVAILABLE': 'Service temporarily unavailable. Please try again.',
        'NETWORK_ERROR': 'Network error. Please check your connection.',
        'NOT_FOUND': 'The requested record was not found',
        'INVALID_ARGUMENT': 'Invalid data provided'
    };
    
    // Check for known error codes
    for (const [code, message] of Object.entries(errorMessages)) {
        if (error.message?.includes(code) || error.code === code) {
            return message;
        }
    }
    
    // Return generic message for unknown errors
    return `Failed to ${operation}. Please try again.`;
}

/**
 * Transaction wrapper for safe operations (Requirement 9.4)
 * Prevents partial updates by tracking operations and rolling back on failure
 */
class TransactionContext {
    constructor() {
        this.operations = [];
        this.rollbackActions = [];
    }
    
    /**
     * Add an operation with its rollback action
     * @param {string} name - Operation name for logging
     * @param {Function} operation - Async function to execute
     * @param {Function} rollback - Async function to rollback on failure
     */
    addOperation(name, operation, rollback) {
        this.operations.push({ name, operation, rollback });
    }
    
    /**
     * Execute all operations with rollback on failure
     * @returns {Object} Result with success status and any error
     */
    async execute() {
        const completedOps = [];
        
        try {
            for (const op of this.operations) {
                await op.operation();
                completedOps.push(op);
            }
            return { success: true };
        } catch (error) {
            // Rollback completed operations in reverse order
            console.warn('[FundManagement] Transaction failed, rolling back...');
            for (let i = completedOps.length - 1; i >= 0; i--) {
                const op = completedOps[i];
                if (op.rollback) {
                    try {
                        await op.rollback();
                        console.log(`[FundManagement] Rolled back: ${op.name}`);
                    } catch (rollbackError) {
                        console.error(`[FundManagement] Rollback failed for ${op.name}:`, rollbackError);
                    }
                }
            }
            return { success: false, error };
        }
    }
}

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
        const virtualBalance = FinancialCalculator.parseAmount(wallet.virtualBalance);
        const advanceReceived = FinancialCalculator.parseAmount(wallet.advanceReceived);
        const pendingDues = FinancialCalculator.parseAmount(wallet.pendingDues);
        const totalLoansGiven = FinancialCalculator.parseAmount(wallet.totalLoansGiven);
        const totalLoansReceived = FinancialCalculator.parseAmount(wallet.totalLoansReceived);
        
        // Net balance formula: virtualBalance - loansReceived (Requirements 1.4, 8.4)
        const netBalance = FinancialCalculator.subtract(virtualBalance, totalLoansReceived);
        
        return {
            virtualBalance,
            advanceReceived,
            pendingDues,
            totalLoansGiven,
            totalLoansReceived,
            netBalance
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
    
    // Allocate client payment to projects (with transaction safety - Requirement 9.4)
    async allocatePayment(paymentData) {
        const { totalAmount, allocations, paymentDate, receivedBy, from, method, notes } = paymentData;
        
        // Validate allocations using FinancialCalculator
        const validation = FinancialCalculator.getAllocationValidation(totalAmount, allocations);
        if (!validation.isValid) {
            throw new Error(validation.message);
        }

        const transaction = new TransactionContext();
        let paymentRecord = null;
        const createdAllocations = [];
        const walletUpdates = [];

        try {
            // Create payment record
            paymentRecord = await Storage.clientPayments.add({
                projectId: 'MULTI_PROJECT', // Special marker for multi-project payments
                amount: FinancialCalculator.parseAmount(totalAmount),
                date: paymentDate,
                receivedBy,
                from,
                method,
                notes: notes || 'Multi-project allocation',
                isMultiProject: true
            });

            // Create allocation records and update wallets
            for (const allocation of allocations) {
                const allocAmount = FinancialCalculator.parseAmount(allocation.amount);
                
                // Create allocation record
                const allocationRecord = await Storage.paymentAllocations.add({
                    paymentId: paymentRecord.id,
                    projectId: allocation.projectId,
                    amount: allocAmount,
                    description: allocation.description || 'Client payment allocation',
                    date: paymentDate
                });
                createdAllocations.push(allocationRecord);

                // Update project wallet using FinancialCalculator
                const wallet = await this.initializeProjectWallet(allocation.projectId);
                const previousBalance = wallet.virtualBalance || 0;
                const previousAdvance = wallet.advanceReceived || 0;
                
                await this.updateProjectWallet(allocation.projectId, {
                    virtualBalance: FinancialCalculator.add(previousBalance, allocAmount),
                    advanceReceived: FinancialCalculator.add(previousAdvance, allocAmount)
                });
                
                walletUpdates.push({
                    projectId: allocation.projectId,
                    previousBalance,
                    previousAdvance
                });
            }

            return paymentRecord;
            
        } catch (error) {
            // Rollback on failure (Requirement 9.4)
            logError('allocatePayment', error, { totalAmount, allocations });
            
            // Rollback wallet updates
            for (const update of walletUpdates) {
                try {
                    await this.updateProjectWallet(update.projectId, {
                        virtualBalance: update.previousBalance,
                        advanceReceived: update.previousAdvance
                    });
                } catch (rollbackError) {
                    logError('allocatePayment rollback wallet', rollbackError, update);
                }
            }
            
            // Delete created allocations
            for (const alloc of createdAllocations) {
                try {
                    await Storage.paymentAllocations.delete(alloc.id);
                } catch (rollbackError) {
                    logError('allocatePayment rollback allocation', rollbackError, alloc);
                }
            }
            
            // Delete payment record
            if (paymentRecord) {
                try {
                    await Storage.clientPayments.delete(paymentRecord.id);
                } catch (rollbackError) {
                    logError('allocatePayment rollback payment', rollbackError, paymentRecord);
                }
            }
            
            throw new Error(createUserFriendlyError('allocate payment', error));
        }
    },

    // Allocate existing client payment to fund management (for auto-allocation)
    async allocateExistingPayment(totalAmount, paymentDate, from, receivedBy, method, allocations, notes, existingPaymentId) {
        // Validate allocations using FinancialCalculator
        const validation = FinancialCalculator.getAllocationValidation(totalAmount, allocations);
        if (!validation.isValid) {
            throw new Error(validation.message);
        }

        // Update existing payment record to mark as allocated
        await Storage.clientPayments.update(existingPaymentId, {
            isAllocated: true,
            allocationDate: new Date().toISOString(),
            allocationNotes: notes
        });

        // Create allocation records and update wallets
        for (const allocation of allocations) {
            const allocAmount = FinancialCalculator.parseAmount(allocation.amount);
            
            // Create allocation record
            await Storage.paymentAllocations.add({
                paymentId: existingPaymentId,
                projectId: allocation.projectId,
                amount: allocAmount,
                description: allocation.description || 'Auto-allocated client payment',
                date: paymentDate
            });

            // Update project wallet using FinancialCalculator
            const wallet = await this.initializeProjectWallet(allocation.projectId);
            await this.updateProjectWallet(allocation.projectId, {
                virtualBalance: FinancialCalculator.add(wallet.virtualBalance || 0, allocAmount),
                advanceReceived: FinancialCalculator.add(wallet.advanceReceived || 0, allocAmount)
            });
        }

        return existingPaymentId;
    },

    // Convenience function for single-project auto-allocation (called from project.js)
    async allocateClientPayment(totalAmount, paymentDate, from, receivedBy, method, allocations, notes, existingPaymentId) {
        return await this.allocateExistingPayment(totalAmount, paymentDate, from, receivedBy, method, allocations, notes, existingPaymentId);
    },

    // ===== CROSS-PROJECT EXPENSE SYSTEM =====
    
    // Record expense paid by one project for another (with transaction safety - Requirement 9.4)
    async recordCrossProjectExpense(expenseData) {
        const { 
            beneficiaryProjectId,  // Project that benefits from expense
            paymentSources,        // Array of {projectId, amount} who paid
            expenseDetails,        // {description, category, totalAmount, date}
            expenseType           // 'material', 'labour', 'expense'
        } = expenseData;

        // Validate payment sources using FinancialCalculator
        const totalPaid = FinancialCalculator.sum(paymentSources.map(source => source.amount));
        const expenseAmount = FinancialCalculator.parseAmount(expenseDetails.totalAmount);
        
        if (Math.abs(totalPaid - expenseAmount) > 0.01) {
            throw new Error(`Total paid (₹${FinancialCalculator.formatCurrency(totalPaid)}) doesn't match expense amount (₹${FinancialCalculator.formatCurrency(expenseAmount)})`);
        }

        let expenseRecord = null;
        const transactionRecords = [];
        const walletUpdates = [];

        try {
            // Record the actual expense in beneficiary project
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
            for (const source of paymentSources) {
                if (source.projectId !== beneficiaryProjectId) {
                    const sourceAmount = FinancialCalculator.parseAmount(source.amount);
                    
                    // Create loan record
                    const transaction = await Storage.crossProjectTransactions.add({
                        lenderProjectId: source.projectId,
                        borrowerProjectId: beneficiaryProjectId,
                        amount: sourceAmount,
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
                    const lenderPrevBalance = lenderWallet.virtualBalance || 0;
                    const lenderPrevLoansGiven = lenderWallet.totalLoansGiven || 0;
                    
                    await this.updateProjectWallet(source.projectId, {
                        virtualBalance: FinancialCalculator.subtract(lenderPrevBalance, sourceAmount),
                        totalLoansGiven: FinancialCalculator.add(lenderPrevLoansGiven, sourceAmount)
                    });
                    
                    walletUpdates.push({
                        projectId: source.projectId,
                        type: 'lender',
                        previousBalance: lenderPrevBalance,
                        previousLoansGiven: lenderPrevLoansGiven
                    });

                    // Update borrower wallet (increase loans received)
                    const borrowerWallet = await this.initializeProjectWallet(beneficiaryProjectId);
                    const borrowerPrevLoansReceived = borrowerWallet.totalLoansReceived || 0;
                    
                    await this.updateProjectWallet(beneficiaryProjectId, {
                        totalLoansReceived: FinancialCalculator.add(borrowerPrevLoansReceived, sourceAmount)
                    });
                    
                    walletUpdates.push({
                        projectId: beneficiaryProjectId,
                        type: 'borrower',
                        previousLoansReceived: borrowerPrevLoansReceived,
                        amount: sourceAmount
                    });
                }
            }

            return {
                expenseRecord,
                transactionRecords
            };
            
        } catch (error) {
            // Rollback on failure (Requirement 9.4)
            logError('recordCrossProjectExpense', error, { beneficiaryProjectId, expenseType, expenseAmount });
            
            // Rollback wallet updates
            for (const update of walletUpdates) {
                try {
                    if (update.type === 'lender') {
                        await this.updateProjectWallet(update.projectId, {
                            virtualBalance: update.previousBalance,
                            totalLoansGiven: update.previousLoansGiven
                        });
                    } else if (update.type === 'borrower') {
                        const wallet = await this.initializeProjectWallet(update.projectId);
                        await this.updateProjectWallet(update.projectId, {
                            totalLoansReceived: FinancialCalculator.subtract(
                                wallet.totalLoansReceived || 0, 
                                update.amount
                            )
                        });
                    }
                } catch (rollbackError) {
                    logError('recordCrossProjectExpense rollback wallet', rollbackError, update);
                }
            }
            
            // Delete transaction records
            for (const txn of transactionRecords) {
                try {
                    await Storage.crossProjectTransactions.delete(txn.id);
                } catch (rollbackError) {
                    logError('recordCrossProjectExpense rollback transaction', rollbackError, txn);
                }
            }
            
            // Delete expense record
            if (expenseRecord) {
                try {
                    if (expenseType === 'material') {
                        await Storage.materials.delete(expenseRecord.id);
                    } else if (expenseType === 'labour') {
                        await Storage.labour.delete(expenseRecord.id);
                    } else {
                        await Storage.expenses.delete(expenseRecord.id);
                    }
                } catch (rollbackError) {
                    logError('recordCrossProjectExpense rollback expense', rollbackError, expenseRecord);
                }
            }
            
            throw new Error(createUserFriendlyError('record cross-project expense', error));
        }
    },

    // ===== AUTO-SETTLEMENT SYSTEM =====
    
    // Auto-settle loans when borrower receives payment (FIFO ordering - Requirements 2.3, 3.2)
    async autoSettleLoans(borrowerProjectId, availableAmount) {
        // Get all active loans for this project
        const activeLoans = await Storage.crossProjectTransactions.getByBorrower(borrowerProjectId);
        const unsettledLoans = (activeLoans || []).filter(loan => loan && loan.status === 'active');
        
        if (!unsettledLoans.length) {
            return { settledLoans: [], remainingAmount: FinancialCalculator.parseAmount(availableAmount) };
        }

        // Sort by date (oldest first) for FIFO settlement (Requirements 2.3, 3.2)
        unsettledLoans.sort((a, b) => new Date(a.date) - new Date(b.date));

        let remainingAmount = FinancialCalculator.parseAmount(availableAmount);
        const settledLoans = [];

        for (const loan of unsettledLoans) {
            if (remainingAmount <= 0) break;
            
            // Calculate outstanding balance using FinancialCalculator
            const loanBalance = FinancialCalculator.calculateOutstandingBalance(
                loan.amount, 
                loan.settlementAmount || 0
            );
            
            if (loanBalance <= 0) continue; // Skip already settled loans
            
            if (remainingAmount >= loanBalance) {
                // Full settlement
                const settlementAmount = loanBalance;
                remainingAmount = FinancialCalculator.subtract(remainingAmount, settlementAmount);

                // Create settlement record
                await Storage.settlementRecords.add({
                    transactionId: loan.id,
                    lenderProjectId: loan.lenderProjectId,
                    borrowerProjectId: loan.borrowerProjectId,
                    settlementAmount,
                    settlementDate: new Date().toISOString(),
                    settlementType: 'auto'
                });

                // Update transaction status to settled
                await Storage.crossProjectTransactions.update(loan.id, {
                    status: 'settled',
                    settlementAmount: FinancialCalculator.parseAmount(loan.amount),
                    settledDate: new Date().toISOString()
                });

                // Update lender wallet (increase balance, decrease loans given)
                const lenderWallet = await this.initializeProjectWallet(loan.lenderProjectId);
                await this.updateProjectWallet(loan.lenderProjectId, {
                    virtualBalance: FinancialCalculator.add(lenderWallet.virtualBalance || 0, settlementAmount),
                    totalLoansGiven: FinancialCalculator.subtract(lenderWallet.totalLoansGiven || 0, settlementAmount)
                });

                // Update borrower wallet (decrease loans received)
                const borrowerWallet = await this.initializeProjectWallet(loan.borrowerProjectId);
                await this.updateProjectWallet(loan.borrowerProjectId, {
                    totalLoansReceived: FinancialCalculator.subtract(borrowerWallet.totalLoansReceived || 0, settlementAmount)
                });

                settledLoans.push({ ...loan, settlementAmount, fullySettled: true });

            } else {
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
                const newSettlementAmount = FinancialCalculator.add(loan.settlementAmount || 0, settlementAmount);
                await Storage.crossProjectTransactions.update(loan.id, {
                    settlementAmount: newSettlementAmount,
                    lastSettlementDate: new Date().toISOString()
                });

                // Update lender wallet
                const lenderWallet = await this.initializeProjectWallet(loan.lenderProjectId);
                await this.updateProjectWallet(loan.lenderProjectId, {
                    virtualBalance: FinancialCalculator.add(lenderWallet.virtualBalance || 0, settlementAmount),
                    totalLoansGiven: FinancialCalculator.subtract(lenderWallet.totalLoansGiven || 0, settlementAmount)
                });

                // Update borrower wallet
                const borrowerWallet = await this.initializeProjectWallet(loan.borrowerProjectId);
                await this.updateProjectWallet(loan.borrowerProjectId, {
                    totalLoansReceived: FinancialCalculator.subtract(borrowerWallet.totalLoansReceived || 0, settlementAmount)
                });

                settledLoans.push({ ...loan, settlementAmount, fullySettled: false });
                break; // No more money to settle
            }
        }

        return { settledLoans, remainingAmount };
    },

    // Manual settlement of cross-project transaction (Requirements 3.3, 3.4, 3.6, 9.4)
    async settleCrossProjectTransaction(transactionId, settlementAmount, settlementType = 'manual', additionalData = {}) {
        let settlementRecord = null;
        let previousTransactionState = null;
        let lenderWalletPrev = null;
        let borrowerWalletPrev = null;
        
        try {
            // Get the transaction
            const transaction = await Storage.crossProjectTransactions.getById(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }
            
            // Store previous state for rollback
            previousTransactionState = { ...transaction };

            const parsedSettlementAmount = FinancialCalculator.parseAmount(settlementAmount);
            
            // Calculate current outstanding balance
            const currentBalance = FinancialCalculator.calculateOutstandingBalance(
                transaction.amount,
                transaction.settlementAmount || 0
            );
            
            // Validate settlement amount - prevent exceeding original amount (Requirement 3.6)
            if (parsedSettlementAmount > currentBalance) {
                throw new Error(`Settlement amount (₹${FinancialCalculator.formatCurrency(parsedSettlementAmount)}) cannot exceed outstanding balance (₹${FinancialCalculator.formatCurrency(currentBalance)})`);
            }

            // Calculate new settlement amount
            const newSettlementAmount = FinancialCalculator.add(
                transaction.settlementAmount || 0, 
                parsedSettlementAmount
            );
            
            // Determine if fully settled (Requirement 3.4)
            const isFullySettled = newSettlementAmount >= FinancialCalculator.parseAmount(transaction.amount);

            // Create settlement record
            settlementRecord = await Storage.settlementRecords.add({
                transactionId: transaction.id,
                lenderProjectId: transaction.lenderProjectId,
                borrowerProjectId: transaction.borrowerProjectId,
                settlementAmount: parsedSettlementAmount,
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

            // Update project wallets using FinancialCalculator
            // Lender gets money back
            const lenderWallet = await this.initializeProjectWallet(transaction.lenderProjectId);
            lenderWalletPrev = {
                virtualBalance: lenderWallet.virtualBalance || 0,
                totalLoansGiven: lenderWallet.totalLoansGiven || 0
            };
            
            await this.updateProjectWallet(transaction.lenderProjectId, {
                virtualBalance: FinancialCalculator.add(lenderWalletPrev.virtualBalance, parsedSettlementAmount),
                totalLoansGiven: FinancialCalculator.subtract(lenderWalletPrev.totalLoansGiven, parsedSettlementAmount)
            });

            // Borrower reduces debt
            const borrowerWallet = await this.initializeProjectWallet(transaction.borrowerProjectId);
            borrowerWalletPrev = {
                totalLoansReceived: borrowerWallet.totalLoansReceived || 0
            };
            
            await this.updateProjectWallet(transaction.borrowerProjectId, {
                totalLoansReceived: FinancialCalculator.subtract(borrowerWalletPrev.totalLoansReceived, parsedSettlementAmount)
            });

            // Calculate remaining balance (Requirement 3.3)
            const remainingBalance = FinancialCalculator.calculateOutstandingBalance(
                transaction.amount,
                newSettlementAmount
            );

            return {
                success: true,
                settlementAmount: parsedSettlementAmount,
                remainingBalance,
                fullySettled: isFullySettled
            };

        } catch (error) {
            // Rollback on failure (Requirement 9.4)
            logError('settleCrossProjectTransaction', error, { transactionId, settlementAmount });
            
            // Rollback borrower wallet
            if (borrowerWalletPrev) {
                try {
                    await this.updateProjectWallet(previousTransactionState.borrowerProjectId, {
                        totalLoansReceived: borrowerWalletPrev.totalLoansReceived
                    });
                } catch (rollbackError) {
                    logError('settleCrossProjectTransaction rollback borrower', rollbackError);
                }
            }
            
            // Rollback lender wallet
            if (lenderWalletPrev) {
                try {
                    await this.updateProjectWallet(previousTransactionState.lenderProjectId, {
                        virtualBalance: lenderWalletPrev.virtualBalance,
                        totalLoansGiven: lenderWalletPrev.totalLoansGiven
                    });
                } catch (rollbackError) {
                    logError('settleCrossProjectTransaction rollback lender', rollbackError);
                }
            }
            
            // Rollback transaction update
            if (previousTransactionState) {
                try {
                    await Storage.crossProjectTransactions.update(transactionId, {
                        settlementAmount: previousTransactionState.settlementAmount || 0,
                        status: previousTransactionState.status,
                        lastSettlementDate: previousTransactionState.lastSettlementDate,
                        settledDate: previousTransactionState.settledDate
                    });
                } catch (rollbackError) {
                    logError('settleCrossProjectTransaction rollback transaction', rollbackError);
                }
            }
            
            // Delete settlement record
            if (settlementRecord) {
                try {
                    await Storage.settlementRecords.delete(settlementRecord.id);
                } catch (rollbackError) {
                    logError('settleCrossProjectTransaction rollback settlement', rollbackError);
                }
            }
            
            throw new Error(createUserFriendlyError('settle transaction', error));
        }
    },

    // ===== WALLET RECALCULATION =====
    
    /**
     * Recalculate project wallet balance based on actual client payments received
     * This fixes any discrepancies where virtualBalance was incorrectly set
     * Virtual Balance = Sum of all client payments for this project
     * 
     * NOTE: We ONLY count from client_payments collection to avoid double-counting.
     * Payment allocations are just records of how payments were distributed, not additional money.
     */
    async recalculateProjectWallet(projectId) {
        try {
            // Get all client payments for this project - this is the ONLY source of truth
            const clientPayments = await Storage.clientPayments.getByProject(projectId).catch(() => []);
            
            // Calculate total from client payments
            const validPayments = (clientPayments || []).filter(p => {
                return p && p.amount && p.projectId === projectId;
            });
            
            const totalReceived = validPayments.reduce((sum, p) => {
                return FinancialCalculator.add(sum, FinancialCalculator.parseAmount(p.amount));
            }, 0);
            
            // Get all cross-project transactions
            const loansGiven = await Storage.crossProjectTransactions.getByLender(projectId).catch(() => []);
            const loansReceived = await Storage.crossProjectTransactions.getByBorrower(projectId).catch(() => []);
            
            // Calculate active loans
            const activeLoansGiven = (loansGiven || []).filter(l => l && l.status === 'active');
            const activeLoansReceived = (loansReceived || []).filter(l => l && l.status === 'active');
            
            const totalLoansGiven = activeLoansGiven.reduce((sum, l) => {
                const outstanding = FinancialCalculator.calculateOutstandingBalance(l.amount, l.settlementAmount || 0);
                return FinancialCalculator.add(sum, outstanding);
            }, 0);
            
            const totalLoansReceived = activeLoansReceived.reduce((sum, l) => {
                const outstanding = FinancialCalculator.calculateOutstandingBalance(l.amount, l.settlementAmount || 0);
                return FinancialCalculator.add(sum, outstanding);
            }, 0);
            
            // Update wallet with recalculated values
            const wallet = await this.initializeProjectWallet(projectId);
            await this.updateProjectWallet(projectId, {
                virtualBalance: totalReceived,
                advanceReceived: totalReceived,
                totalLoansGiven: totalLoansGiven,
                totalLoansReceived: totalLoansReceived
            });
            
            console.log(`[FundManagement] Recalculated wallet for project ${projectId}:`, {
                virtualBalance: totalReceived,
                paymentsCount: validPayments.length,
                totalLoansGiven,
                totalLoansReceived
            });
            
            return {
                success: true,
                virtualBalance: totalReceived,
                paymentsCount: validPayments.length,
                totalLoansGiven,
                totalLoansReceived
            };
        } catch (error) {
            logError('recalculateProjectWallet', error, { projectId });
            throw new Error(createUserFriendlyError('recalculate wallet', error));
        }
    },

    /**
     * Recalculate all project wallets - useful for fixing data inconsistencies
     */
    async recalculateAllWallets() {
        try {
            const projects = await Storage.projects.getAll();
            const results = [];
            
            for (const project of (projects || [])) {
                try {
                    const result = await this.recalculateProjectWallet(project.id);
                    results.push({ projectId: project.id, projectName: project.name, ...result });
                } catch (error) {
                    results.push({ projectId: project.id, projectName: project.name, success: false, error: error.message });
                }
            }
            
            return { success: true, results };
        } catch (error) {
            logError('recalculateAllWallets', error);
            throw new Error(createUserFriendlyError('recalculate all wallets', error));
        }
    },

    // ===== REPORTING & ANALYTICS =====
    
    // Get comprehensive project financial summary (Requirements 1.4, 2.4, 8.4)
    async getProjectFinancialSummary(projectId) {
        // Fetch all data in parallel for efficiency (Requirement 2.4)
        const [clientPayments, loansGiven, loansReceived, paymentAllocations] = await Promise.all([
            Storage.clientPayments.getByProject(projectId).catch(() => []),
            Storage.crossProjectTransactions.getByLender(projectId).catch(() => []),
            Storage.crossProjectTransactions.getByBorrower(projectId).catch(() => []),
            Storage.paymentAllocations.getByProject(projectId).catch(() => [])
        ]);
        
        // Calculate virtualBalance directly from client_payments - SINGLE SOURCE OF TRUTH
        const validPayments = (clientPayments || []).filter(p => {
            return p && p.amount && p.projectId === projectId;
        });
        
        console.log('[FundManagement] getProjectFinancialSummary - clientPayments:', clientPayments?.length, 'validPayments:', validPayments?.length);
        
        const virtualBalance = validPayments.reduce((sum, p) => {
            const amount = FinancialCalculator.parseAmount(p.amount);
            console.log('[FundManagement] Payment:', p.id, 'amount:', p.amount, 'parsed:', amount);
            return FinancialCalculator.add(sum, amount);
        }, 0);
        
        console.log('[FundManagement] Calculated virtualBalance from client_payments:', virtualBalance);
        
        // Calculate active loans using FinancialCalculator (handle null/undefined arrays)
        const activeLoansGiven = (loansGiven || []).filter(l => l && l.status === 'active');
        const activeLoansReceived = (loansReceived || []).filter(l => l && l.status === 'active');
        
        // Calculate outstanding balances for active loans
        const totalActiveLoansGiven = activeLoansGiven.reduce((sum, l) => {
            const outstanding = FinancialCalculator.calculateOutstandingBalance(l.amount, l.settlementAmount || 0);
            return FinancialCalculator.add(sum, outstanding);
        }, 0);
        
        const totalActiveLoansReceived = activeLoansReceived.reduce((sum, l) => {
            const outstanding = FinancialCalculator.calculateOutstandingBalance(l.amount, l.settlementAmount || 0);
            return FinancialCalculator.add(sum, outstanding);
        }, 0);
        
        const totalPayments = FinancialCalculator.sum((paymentAllocations || []).map(p => p.amount));

        // Net available balance formula: virtualBalance - loansReceived (Requirements 1.4, 8.4)
        const netAvailableBalance = FinancialCalculator.calculateNetBalance(virtualBalance, totalActiveLoansReceived);

        return {
            projectId,
            virtualBalance,
            advanceReceived: virtualBalance,
            pendingDues: 0,
            activeLoansGiven: totalActiveLoansGiven,
            activeLoansReceived: totalActiveLoansReceived,
            netAvailableBalance,
            totalPaymentsReceived: totalPayments,
            loanDetails: {
                given: activeLoansGiven,
                received: activeLoansReceived
            }
        };
    },

    // Get overall fund status across all projects
    async getOverallFundStatus() {
        const [allWallets, allProjects, allMaterials, allLabour, allExpenses, allVendorPayments, allWorkerPayments] = await Promise.all([
            Storage.projectWallets.getAll(),
            Storage.projects.getAll(),
            Storage.materials.getAll().catch(() => []),
            Storage.labour.getAll().catch(() => []),
            Storage.expenses.getAll().catch(() => []),
            Storage.vendorPayments.getAll().catch(() => []),
            Storage.workerPayments.getAll().catch(() => [])
        ]);
        
        // Calculate total spent across ALL projects
        let totalSpent = 0;
        
        // Materials spent (paid amounts)
        for (const m of (allMaterials || [])) {
            totalSpent = FinancialCalculator.add(totalSpent, FinancialCalculator.parseAmount(m.paidAmount || 0));
        }
        
        // Labour/Worker payments
        for (const wp of (allWorkerPayments || [])) {
            totalSpent = FinancialCalculator.add(totalSpent, FinancialCalculator.parseAmount(wp.amount || 0));
        }
        
        // Vendor payments
        for (const vp of (allVendorPayments || [])) {
            totalSpent = FinancialCalculator.add(totalSpent, FinancialCalculator.parseAmount(vp.amount || 0));
        }
        
        // Other expenses
        for (const e of (allExpenses || [])) {
            totalSpent = FinancialCalculator.add(totalSpent, FinancialCalculator.parseAmount(e.amount || 0));
        }
        
        // Fetch all project summaries in parallel for efficiency (Requirement 2.4)
        const projectSummaries = await Promise.all(
            (allProjects || []).map(async (project) => {
                const summary = await this.getProjectFinancialSummary(project.id);
                return {
                    projectId: project.id,
                    projectName: project.name,
                    ...summary
                };
            })
        );
        
        // Aggregate totals using FinancialCalculator
        let totalVirtualBalance = 0;
        let totalLoansGiven = 0;
        let totalLoansReceived = 0;
        
        for (const summary of projectSummaries) {
            totalVirtualBalance = FinancialCalculator.add(totalVirtualBalance, summary.virtualBalance);
            totalLoansGiven = FinancialCalculator.add(totalLoansGiven, summary.activeLoansGiven);
            totalLoansReceived = FinancialCalculator.add(totalLoansReceived, summary.activeLoansReceived);
        }
        
        // Check if loans are balanced (Requirement 2.6)
        const isBalanced = Math.abs(totalLoansGiven - totalLoansReceived) < 0.01;
        
        // Net available = Total received - Total spent
        const netAvailable = FinancialCalculator.subtract(totalVirtualBalance, totalSpent);
        
        return {
            totalVirtualBalance,
            totalSpent,
            netAvailable,
            totalActiveLoans: totalLoansGiven,
            netBankBalance: netAvailable,
            projectSummaries,
            isBalanced
        };
    },

    // ===== RECONCILIATION SYSTEM (Requirements 2.6, 10.1) =====
    
    // Reconcile all projects to verify loans balance
    async reconcileAllProjects() {
        const projects = await Storage.projects.getAll();
        
        let totalLoansGiven = 0;
        let totalLoansReceived = 0;
        const projectDetails = [];
        const discrepancies = [];
        
        // Fetch all project summaries in parallel
        const summaries = await Promise.all(
            (projects || []).map(async (project) => {
                const summary = await this.getProjectFinancialSummary(project.id);
                return { project, summary };
            })
        );
        
        for (const { project, summary } of summaries) {
            totalLoansGiven = FinancialCalculator.add(totalLoansGiven, summary.activeLoansGiven);
            totalLoansReceived = FinancialCalculator.add(totalLoansReceived, summary.activeLoansReceived);
            
            projectDetails.push({
                projectId: project.id,
                projectName: project.name,
                loansGiven: summary.activeLoansGiven,
                loansReceived: summary.activeLoansReceived,
                netLoanPosition: FinancialCalculator.subtract(summary.activeLoansGiven, summary.activeLoansReceived)
            });
        }
        
        // Calculate discrepancy
        const discrepancy = FinancialCalculator.subtract(totalLoansGiven, totalLoansReceived);
        const isBalanced = Math.abs(discrepancy) < 0.01;
        
        // Check for orphaned allocations
        const allAllocations = await Storage.paymentAllocations.getAll().catch(() => []);
        const allPayments = await Storage.clientPayments.getAll().catch(() => []);
        const paymentIds = new Set((allPayments || []).map(p => p.id));
        
        const orphanedAllocations = (allAllocations || []).filter(a => !paymentIds.has(a.paymentId));
        if (orphanedAllocations.length > 0) {
            discrepancies.push({
                type: 'orphaned_allocations',
                count: orphanedAllocations.length,
                items: orphanedAllocations
            });
        }
        
        return {
            isBalanced,
            totalLoansGiven,
            totalLoansReceived,
            discrepancy,
            projectDetails,
            discrepancies,
            reconciliationDate: new Date().toISOString()
        };
    }
};

// Make it globally accessible
window.FundManagement = FundManagement;

export default FundManagement;