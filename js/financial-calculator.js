/**
 * FinancialCalculator - Utility module for precise financial calculations
 * 
 * This module provides accurate decimal arithmetic, currency formatting,
 * and validation functions for the B&B financial management system.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

const FinancialCalculator = {
    
    // ===== PRECISE ARITHMETIC OPERATIONS =====
    
    /**
     * Add two numbers with 2-decimal precision
     * Avoids floating-point errors by rounding to 2 decimal places
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @returns {number} Sum rounded to 2 decimal places
     */
    add(a, b) {
        const numA = parseFloat(a) || 0;
        const numB = parseFloat(b) || 0;
        return Math.round((numA + numB) * 100) / 100;
    },

    /**
     * Subtract two numbers with 2-decimal precision
     * @param {number} a - Minuend
     * @param {number} b - Subtrahend
     * @returns {number} Difference rounded to 2 decimal places
     */
    subtract(a, b) {
        const numA = parseFloat(a) || 0;
        const numB = parseFloat(b) || 0;
        return Math.round((numA - numB) * 100) / 100;
    },

    /**
     * Multiply two numbers with 2-decimal precision
     * @param {number} a - First factor
     * @param {number} b - Second factor
     * @returns {number} Product rounded to 2 decimal places
     */
    multiply(a, b) {
        const numA = parseFloat(a) || 0;
        const numB = parseFloat(b) || 0;
        return Math.round((numA * numB) * 100) / 100;
    },

    // ===== ARRAY AGGREGATION =====

    /**
     * Sum an array of values with null/undefined handling
     * Rounds only at the final result to maintain precision during aggregation
     * @param {Array<number|string|null|undefined>} values - Array of values to sum
     * @returns {number} Sum rounded to 2 decimal places
     */
    sum(values) {
        if (!Array.isArray(values)) {
            return 0;
        }
        
        const total = values.reduce((acc, val) => {
            const num = parseFloat(val);
            return acc + (isNaN(num) ? 0 : num);
        }, 0);
        
        return Math.round(total * 100) / 100;
    },

    // ===== CURRENCY FORMATTING =====

    /**
     * Format amount for display using Indian number formatting (lakhs, crores)
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        const rounded = Math.round(num * 100) / 100;
        
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(rounded);
    },

    /**
     * Format amount with currency symbol (₹)
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency string with symbol
     */
    formatCurrencyWithSymbol(amount) {
        return `₹${this.formatCurrency(amount)}`;
    },

    // ===== VALIDATION FUNCTIONS =====

    /**
     * Validate that allocation amounts equal the total payment amount
     * Uses 0.01 tolerance for floating-point comparison
     * @param {number} totalAmount - Total payment amount
     * @param {Array<{amount: number}>} allocations - Array of allocation objects
     * @returns {boolean} True if allocations match total amount
     */
    validateAllocation(totalAmount, allocations) {
        if (!Array.isArray(allocations)) {
            return false;
        }
        
        const total = parseFloat(totalAmount) || 0;
        const allocated = this.sum(allocations.map(a => a?.amount));
        
        // Use 0.01 tolerance for floating-point comparison
        return Math.abs(allocated - total) < 0.01;
    },

    /**
     * Get allocation validation details
     * @param {number} totalAmount - Total payment amount
     * @param {Array<{amount: number}>} allocations - Array of allocation objects
     * @returns {Object} Validation result with details
     */
    getAllocationValidation(totalAmount, allocations) {
        const total = parseFloat(totalAmount) || 0;
        const allocated = this.sum(allocations?.map(a => a?.amount) || []);
        const difference = this.subtract(allocated, total);
        const isValid = Math.abs(difference) < 0.01;
        
        return {
            isValid,
            totalAmount: total,
            allocatedAmount: allocated,
            difference,
            message: isValid 
                ? 'Allocation is valid' 
                : `Total allocated (₹${this.formatCurrency(allocated)}) doesn't match payment (₹${this.formatCurrency(total)})`
        };
    },

    // ===== BUDGET HEALTH CALCULATION =====

    /**
     * Calculate budget health status based on spent vs budget
     * @param {number} spent - Amount spent
     * @param {number} budget - Total budget
     * @returns {Object} Budget health with percent and status
     */
    getBudgetHealth(spent, budget) {
        const spentAmount = parseFloat(spent) || 0;
        const budgetAmount = parseFloat(budget) || 0;
        
        // Handle edge case: zero or negative budget
        if (budgetAmount <= 0) {
            return { 
                percent: 0, 
                status: 'ok',
                remaining: 0,
                isOverBudget: false
            };
        }
        
        const percent = Math.round((spentAmount / budgetAmount) * 10000) / 100; // 2 decimal precision
        const remaining = this.subtract(budgetAmount, spentAmount);
        const isOverBudget = percent >= 100;
        
        let status;
        if (percent >= 100) {
            status = 'over';
        } else if (percent >= 90) {
            status = 'critical';
        } else if (percent >= 80) {
            status = 'warning';
        } else {
            status = 'ok';
        }
        
        return {
            percent,
            status,
            remaining,
            isOverBudget
        };
    },

    // ===== UTILITY FUNCTIONS =====

    /**
     * Check if a value is a valid positive number
     * @param {*} value - Value to check
     * @returns {boolean} True if valid positive number
     */
    isValidPositiveAmount(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
    },

    /**
     * Check if a value is a valid non-negative number
     * @param {*} value - Value to check
     * @returns {boolean} True if valid non-negative number
     */
    isValidNonNegativeAmount(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
    },

    /**
     * Parse a value to a number, returning 0 for invalid inputs
     * @param {*} value - Value to parse
     * @returns {number} Parsed number or 0
     */
    parseAmount(value) {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    },

    /**
     * Calculate net balance: virtualBalance - loansReceived
     * @param {number} virtualBalance - Current virtual balance
     * @param {number} loansReceived - Total active loans received
     * @returns {number} Net available balance
     */
    calculateNetBalance(virtualBalance, loansReceived) {
        return this.subtract(
            parseFloat(virtualBalance) || 0,
            parseFloat(loansReceived) || 0
        );
    },

    /**
     * Calculate outstanding loan balance
     * @param {number} originalAmount - Original loan amount
     * @param {number} settlementAmount - Amount already settled
     * @returns {number} Outstanding balance
     */
    calculateOutstandingBalance(originalAmount, settlementAmount) {
        return this.subtract(
            parseFloat(originalAmount) || 0,
            parseFloat(settlementAmount) || 0
        );
    },

    // ===== INPUT VALIDATION (Requirements 9.2, 9.3) =====

    /**
     * Validate payment amount - reject negative or zero values
     * @param {*} amount - Amount to validate
     * @returns {Object} Validation result with isValid and message
     */
    validatePaymentAmount(amount) {
        const num = parseFloat(amount);
        
        if (isNaN(num)) {
            return {
                isValid: false,
                message: 'Payment amount must be a valid number'
            };
        }
        
        if (num <= 0) {
            return {
                isValid: false,
                message: 'Payment amount must be greater than zero'
            };
        }
        
        return {
            isValid: true,
            message: 'Valid amount'
        };
    },

    /**
     * Validate allocation data for payment forms (Requirement 9.3)
     * @param {number} totalAmount - Total payment amount
     * @param {Array<{projectId: string, amount: number}>} allocations - Allocation array
     * @returns {Object} Validation result with isValid, errors array, and details
     */
    validateAllocations(totalAmount, allocations) {
        const errors = [];
        const total = parseFloat(totalAmount) || 0;
        
        // Validate total amount
        if (total <= 0) {
            errors.push('Total payment amount must be greater than zero');
        }
        
        // Validate allocations array
        if (!Array.isArray(allocations) || allocations.length === 0) {
            errors.push('At least one allocation is required');
            return {
                isValid: false,
                errors,
                allocatedAmount: 0,
                difference: total
            };
        }
        
        // Validate each allocation
        let allocatedAmount = 0;
        allocations.forEach((alloc, index) => {
            if (!alloc.projectId) {
                errors.push(`Allocation ${index + 1}: Project selection is required`);
            }
            
            const allocAmount = parseFloat(alloc.amount) || 0;
            if (allocAmount <= 0) {
                errors.push(`Allocation ${index + 1}: Amount must be greater than zero`);
            }
            
            allocatedAmount = this.add(allocatedAmount, allocAmount);
        });
        
        // Validate total allocation matches payment amount (Requirement 9.3)
        const difference = this.subtract(allocatedAmount, total);
        if (Math.abs(difference) > 0.01) {
            errors.push(`Total allocated (₹${this.formatCurrency(allocatedAmount)}) doesn't match payment amount (₹${this.formatCurrency(total)})`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            allocatedAmount,
            difference
        };
    },

    /**
     * Validate expense data for cross-project expenses
     * @param {Object} expenseData - Expense data to validate
     * @returns {Object} Validation result with isValid and errors array
     */
    validateExpenseData(expenseData) {
        const errors = [];
        
        if (!expenseData.beneficiaryProjectId) {
            errors.push('Beneficiary project is required');
        }
        
        if (!expenseData.description || expenseData.description.trim() === '') {
            errors.push('Expense description is required');
        }
        
        const amount = parseFloat(expenseData.totalAmount) || 0;
        if (amount <= 0) {
            errors.push('Expense amount must be greater than zero');
        }
        
        if (!expenseData.date) {
            errors.push('Expense date is required');
        }
        
        // Validate payment sources
        if (!Array.isArray(expenseData.paymentSources) || expenseData.paymentSources.length === 0) {
            errors.push('At least one payment source is required');
        } else {
            let totalPaid = 0;
            expenseData.paymentSources.forEach((source, index) => {
                if (!source.projectId) {
                    errors.push(`Payment source ${index + 1}: Project selection is required`);
                }
                const sourceAmount = parseFloat(source.amount) || 0;
                if (sourceAmount <= 0) {
                    errors.push(`Payment source ${index + 1}: Amount must be greater than zero`);
                }
                totalPaid = this.add(totalPaid, sourceAmount);
            });
            
            // Validate total paid matches expense amount
            if (Math.abs(totalPaid - amount) > 0.01) {
                errors.push(`Total paid (₹${this.formatCurrency(totalPaid)}) doesn't match expense amount (₹${this.formatCurrency(amount)})`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
};

// Make it globally accessible for browser usage
if (typeof window !== 'undefined') {
    window.FinancialCalculator = FinancialCalculator;
}

// Export for module usage
export default FinancialCalculator;
