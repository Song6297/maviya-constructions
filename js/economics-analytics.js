/**
 * Economics Analytics Module - Company-level financial analytics and valuation
 * 
 * Provides comprehensive business metrics, unit economics, valuation estimates,
 * and optimization insights using algorithmic techniques.
 */

import Storage from './firebase-storage.js';
import FinancialCalculator from './financial-calculator.js';

const EconomicsAnalytics = {

    // Cache for performance
    _cache: {
        projects: [],
        expenses: [],
        payments: [],
        labourData: [],
        lastFetch: null
    },

    // Cache validity in milliseconds (5 minutes)
    CACHE_TTL: 5 * 60 * 1000,

    // ===== DATA FETCHING =====

    /**
     * Fetch all required data for economics calculations
     * Uses caching to avoid repeated Firebase calls
     */
    async fetchAllData(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this._cache.lastFetch && (now - this._cache.lastFetch) < this.CACHE_TTL) {
            return this._cache;
        }

        try {
            const [projects, allExpenses, allPayments, labourData] = await Promise.all([
                Storage.projects.getAll(),
                this._getAllExpenses(),
                this._getAllPayments(),
                this._getAllLabourData()
            ]);

            this._cache = {
                projects: projects || [],
                expenses: allExpenses || [],
                payments: allPayments || [],
                labourData: labourData || [],
                lastFetch: now
            };

            return this._cache;
        } catch (error) {
            console.error('[EconomicsAnalytics] Error fetching data:', error);
            // Ensure cache doesn't have nulls even on error
            if (!this._cache.projects) this._cache.projects = [];
            if (!this._cache.expenses) this._cache.expenses = [];
            if (!this._cache.payments) this._cache.payments = [];
            if (!this._cache.labourData) this._cache.labourData = [];
            return this._cache;
        }
    },

    async _getAllExpenses() {
        const projects = await Storage.projects.getAll();
        const allExpenses = [];

        for (const project of projects) {
            const expenses = await Storage.expenses.getByProject(project.id);
            expenses.forEach(e => {
                allExpenses.push({
                    ...e,
                    projectId: project.id,
                    projectName: project.name
                });
            });
        }

        return allExpenses;
    },

    async _getAllPayments() {
        const projects = await Storage.projects.getAll();
        const allPayments = [];

        for (const project of projects) {
            const payments = await Storage.clientPayments.getByProject(project.id);
            payments.forEach(p => {
                allPayments.push({
                    ...p,
                    projectId: project.id,
                    projectName: project.name
                });
            });
        }

        return allPayments;
    },

    async _getAllLabourData() {
        const projects = await Storage.projects.getAll();
        const allLabour = [];

        for (const project of projects) {
            try {
                const labour = await Storage.labour.getByProject(project.id);
                labour.forEach(l => {
                    allLabour.push({
                        ...l,
                        projectId: project.id,
                        projectName: project.name
                    });
                });
            } catch (e) {
                // Labour might not exist for all projects
            }
        }

        return allLabour;
    },

    // ===== COMPANY OVERVIEW =====

    /**
     * Calculate total revenue across all projects
     * Revenue = Sum of all client payments received
     */
    async calculateTotalRevenue() {
        const data = await this.fetchAllData();
        if (!data || !data.payments) return 0;
        return FinancialCalculator.sum(data.payments.map(p => p.amount || 0));
    },

    /**
     * Calculate total operating costs across all projects
     * Costs = Expenses + Labour payments
     */
    async calculateOperatingCosts() {
        const data = await this.fetchAllData();
        if (!data) return 0;

        const expenseCosts = FinancialCalculator.sum((data.expenses || []).map(e => e.amount || 0));
        const labourCosts = FinancialCalculator.sum((data.labourData || []).map(l => l.amountPaid || 0));

        return FinancialCalculator.add(expenseCosts, labourCosts);
    },

    /**
     * Calculate gross profit (Revenue - Direct Costs)
     */
    async calculateGrossProfit() {
        const revenue = await this.calculateTotalRevenue();
        const costs = await this.calculateOperatingCosts();
        return FinancialCalculator.subtract(revenue, costs);
    },

    /**
     * Calculate gross margin percentage
     */
    async calculateGrossMargin() {
        const revenue = await this.calculateTotalRevenue();
        const grossProfit = await this.calculateGrossProfit();

        if (revenue <= 0) return 0;
        return FinancialCalculator.multiply(grossProfit / revenue, 100);
    },

    /**
     * Calculate net margin (accounting for overhead estimate)
     * Net Margin = Gross Margin - Overhead (estimated at 10% of revenue)
     */
    async calculateNetMargin() {
        const grossMargin = await this.calculateGrossMargin();
        const overheadEstimate = 10; // 10% estimated overhead
        return Math.max(0, FinancialCalculator.subtract(grossMargin, overheadEstimate));
    },

    /**
     * Calculate monthly burn rate
     * Uses last 3 months of expense data
     */
    async calculateBurnRate() {
        const data = await this.fetchAllData();
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

        // Filter expenses from last 3 months
        const recentExpenses = data.expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate >= threeMonthsAgo;
        });

        const recentLabour = data.labourData.filter(l => {
            const labourDate = new Date(l.date);
            return labourDate >= threeMonthsAgo;
        });

        const totalRecentCosts = FinancialCalculator.add(
            FinancialCalculator.sum(recentExpenses.map(e => e.amount || 0)),
            FinancialCalculator.sum(recentLabour.map(l => l.amountPaid || 0))
        );

        // Monthly average
        return FinancialCalculator.multiply(totalRecentCosts, 1 / 3);
    },

    /**
     * Calculate cash runway in months
     * Runway = Available Funds / Monthly Burn Rate
     */
    async calculateCashRunway() {
        const data = await this.fetchAllData();
        const burnRate = await this.calculateBurnRate();

        if (burnRate <= 0) return 999; // Infinite runway if no burn

        // Calculate available funds (total received - total spent)
        const totalReceived = await this.calculateTotalRevenue();
        const totalSpent = await this.calculateOperatingCosts();
        const availableFunds = FinancialCalculator.subtract(totalReceived, totalSpent);

        if (availableFunds <= 0) return 0;

        return Math.round(availableFunds / burnRate);
    },

    // ===== UNIT ECONOMICS =====

    /**
     * Calculate average cost per project
     */
    async getCostPerProject() {
        const data = await this.fetchAllData();
        const totalCosts = await this.calculateOperatingCosts();
        const projectCount = data.projects.length || 1;

        return FinancialCalculator.multiply(totalCosts, 1 / projectCount);
    },

    /**
     * Calculate average revenue per project
     */
    async getRevenuePerProject() {
        const data = await this.fetchAllData();
        const totalRevenue = await this.calculateTotalRevenue();
        const projectCount = data.projects.length || 1;

        return FinancialCalculator.multiply(totalRevenue, 1 / projectCount);
    },

    /**
     * Calculate average profit per project
     */
    async getProfitPerProject() {
        const revenuePerProject = await this.getRevenuePerProject();
        const costPerProject = await this.getCostPerProject();

        return FinancialCalculator.subtract(revenuePerProject, costPerProject);
    },

    /**
     * Calculate cost per labour hour
     */
    async getCostPerLabourHour() {
        const data = await this.fetchAllData();
        const labourCosts = FinancialCalculator.sum(data.labourData.map(l => l.amountPaid || 0));
        const totalHours = FinancialCalculator.sum(data.labourData.map(l => l.hours || 8)); // Default 8 hours per entry

        if (totalHours <= 0) return 0;
        return FinancialCalculator.multiply(labourCosts, 1 / totalHours);
    },

    /**
     * Calculate revenue per labour hour
     */
    async getRevenuePerLabourHour() {
        const data = await this.fetchAllData();
        const totalRevenue = await this.calculateTotalRevenue();
        const totalHours = FinancialCalculator.sum(data.labourData.map(l => l.hours || 8));

        if (totalHours <= 0) return 0;
        return FinancialCalculator.multiply(totalRevenue, 1 / totalHours);
    },

    /**
     * Get detailed unit economics breakdown
     */
    async getUnitEconomicsBreakdown() {
        return {
            costPerProject: await this.getCostPerProject(),
            revenuePerProject: await this.getRevenuePerProject(),
            profitPerProject: await this.getProfitPerProject(),
            costPerLabourHour: await this.getCostPerLabourHour(),
            revenuePerLabourHour: await this.getRevenuePerLabourHour()
        };
    },

    // ===== PHASE & PROJECT ECONOMICS (Divide-and-Conquer) =====

    /**
     * Get phase-wise cost distribution using divide-and-conquer
     * Breaks down costs by construction phase
     */
    async getPhaseWiseCostDistribution() {
        const data = await this.fetchAllData();
        const phaseCosts = {};

        // Standard construction phases
        const phases = ['Foundation', 'Structure', 'Roofing', 'Electrical', 'Plumbing', 'Finishing', 'Other'];
        phases.forEach(p => phaseCosts[p] = { cost: 0, count: 0 });

        // Categorize expenses by phase
        data.expenses.forEach(expense => {
            const phase = this._categorizeExpenseToPhase(expense.category || expense.description);
            phaseCosts[phase].cost = FinancialCalculator.add(phaseCosts[phase].cost, expense.amount || 0);
            phaseCosts[phase].count++;
        });

        const totalCost = await this.calculateOperatingCosts();

        // Calculate percentages
        return Object.entries(phaseCosts).map(([phase, data]) => ({
            phase,
            cost: data.cost,
            count: data.count,
            percentage: totalCost > 0 ? FinancialCalculator.multiply(data.cost / totalCost, 100) : 0
        })).sort((a, b) => b.cost - a.cost);
    },

    _categorizeExpenseToPhase(category) {
        if (!category) return 'Other';
        const lower = category.toLowerCase();

        if (lower.includes('foundation') || lower.includes('excavation') || lower.includes('concrete')) return 'Foundation';
        if (lower.includes('structure') || lower.includes('steel') || lower.includes('beam') || lower.includes('column')) return 'Structure';
        if (lower.includes('roof') || lower.includes('ceiling')) return 'Roofing';
        if (lower.includes('electric') || lower.includes('wiring') || lower.includes('switch')) return 'Electrical';
        if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('sanitary')) return 'Plumbing';
        if (lower.includes('paint') || lower.includes('tile') || lower.includes('finish') || lower.includes('door') || lower.includes('window')) return 'Finishing';

        return 'Other';
    },

    /**
     * Get phase-wise profitability analysis
     */
    async getPhaseWiseProfitability() {
        const data = await this.fetchAllData();
        const projectProfits = [];

        for (const project of data.projects) {
            const projectPayments = data.payments.filter(p => p.projectId === project.id);
            const projectExpenses = data.expenses.filter(e => e.projectId === project.id);
            const projectLabour = data.labourData.filter(l => l.projectId === project.id);

            const revenue = FinancialCalculator.sum(projectPayments.map(p => p.amount || 0));
            const costs = FinancialCalculator.add(
                FinancialCalculator.sum(projectExpenses.map(e => e.amount || 0)),
                FinancialCalculator.sum(projectLabour.map(l => l.amountPaid || 0))
            );
            const profit = FinancialCalculator.subtract(revenue, costs);
            const margin = revenue > 0 ? FinancialCalculator.multiply(profit / revenue, 100) : 0;

            projectProfits.push({
                projectId: project.id,
                projectName: project.name,
                revenue,
                costs,
                profit,
                margin,
                status: project.status
            });
        }

        return projectProfits.sort((a, b) => b.margin - a.margin);
    },

    /**
     * Highlight inefficient phases (>20% cost variance from average)
     */
    async highlightInefficientPhases() {
        const distribution = await this.getPhaseWiseCostDistribution();
        const avgPercentage = 100 / distribution.length;

        return distribution.filter(phase =>
            phase.percentage > avgPercentage * 1.5 && phase.cost > 0
        ).map(phase => ({
            ...phase,
            inefficiencyRatio: FinancialCalculator.multiply(phase.percentage / avgPercentage, 1),
            recommendation: `${phase.phase} costs are ${Math.round(phase.percentage / avgPercentage * 100)}% of average. Consider optimization.`
        }));
    },

    // ===== VALUATION ENGINE =====

    /**
     * Calculate valuation based on revenue multiples
     * Construction industry: 2.5x - 4x annual revenue
     */
    async calculateRevenueMultipleValuation() {
        const annualRevenue = await this.getAnnualizedRevenue();

        return {
            conservative: FinancialCalculator.multiply(annualRevenue, 2.5),
            base: FinancialCalculator.multiply(annualRevenue, 3.25),
            aggressive: FinancialCalculator.multiply(annualRevenue, 4)
        };
    },

    /**
     * Get annualized revenue (based on existing data extrapolated)
     */
    async getAnnualizedRevenue() {
        const data = await this.fetchAllData();
        const totalRevenue = await this.calculateTotalRevenue();

        // Find date range of payments
        if (!data || !data.payments || data.payments.length === 0) return 0;

        const dates = data.payments.map(p => new Date(p.date)).sort((a, b) => a - b);
        const firstPayment = dates[0];
        const lastPayment = dates[dates.length - 1];

        const monthsOfData = Math.max(1, (lastPayment - firstPayment) / (30 * 24 * 60 * 60 * 1000));

        // Annualize
        return FinancialCalculator.multiply(totalRevenue, 12 / monthsOfData);
    },

    /**
     * Calculate valuation based on cash flow (DCF-simplified)
     * Uses 5-8x annual cash flow
     */
    async calculateCashFlowValuation() {
        const grossProfit = await this.calculateGrossProfit();
        const data = await this.fetchAllData();

        if (!data || !data.payments || data.payments.length === 0) return { conservative: 0, base: 0, aggressive: 0 };

        // Find months of data
        const dates = data.payments.map(p => new Date(p.date)).sort((a, b) => a - b);
        const monthsOfData = Math.max(1, (dates[dates.length - 1] - dates[0]) / (30 * 24 * 60 * 60 * 1000));

        // Annualize cash flow
        const annualCashFlow = FinancialCalculator.multiply(grossProfit, 12 / monthsOfData);

        return {
            conservative: FinancialCalculator.multiply(annualCashFlow, 5),
            base: FinancialCalculator.multiply(annualCashFlow, 6.5),
            aggressive: FinancialCalculator.multiply(annualCashFlow, 8)
        };
    },

    /**
     * Adjust valuation based on growth trends
     * Positive growth adds premium, negative growth discounts
     */
    async adjustForGrowthTrends(baseValuation) {
        const growthRate = await this.calculateRevenueGrowthRate();

        // Growth premium: +20% for each 10% growth, -15% for each 10% decline
        let adjustment = 1;
        if (growthRate > 0) {
            adjustment = 1 + (growthRate / 10) * 0.2;
        } else {
            adjustment = 1 + (growthRate / 10) * 0.15;
        }

        adjustment = Math.max(0.5, Math.min(2, adjustment)); // Cap at 50% - 200%

        return FinancialCalculator.multiply(baseValuation, adjustment);
    },

    /**
     * Get all valuation scenarios with growth adjustments
     */
    async getValuationScenarios() {
        const revenueValuation = await this.calculateRevenueMultipleValuation();
        const cashFlowValuation = await this.calculateCashFlowValuation();
        const growthRate = await this.calculateRevenueGrowthRate();

        // Blend both methods (60% revenue, 40% cash flow)
        const blended = {
            conservative: FinancialCalculator.add(
                FinancialCalculator.multiply(revenueValuation.conservative, 0.6),
                FinancialCalculator.multiply(cashFlowValuation.conservative, 0.4)
            ),
            base: FinancialCalculator.add(
                FinancialCalculator.multiply(revenueValuation.base, 0.6),
                FinancialCalculator.multiply(cashFlowValuation.base, 0.4)
            ),
            aggressive: FinancialCalculator.add(
                FinancialCalculator.multiply(revenueValuation.aggressive, 0.6),
                FinancialCalculator.multiply(cashFlowValuation.aggressive, 0.4)
            )
        };

        // Apply growth adjustment
        const adjusted = {
            conservative: await this.adjustForGrowthTrends(blended.conservative),
            base: await this.adjustForGrowthTrends(blended.base),
            aggressive: await this.adjustForGrowthTrends(blended.aggressive)
        };

        return {
            revenueMethod: revenueValuation,
            cashFlowMethod: cashFlowValuation,
            blended: adjusted,
            growthRate,
            methodology: 'Blended (60% Revenue Multiple + 40% Cash Flow) with Growth Adjustment'
        };
    },

    // ===== TREND ANALYSIS (Decrease-and-Conquer) =====

    /**
     * Calculate revenue growth rate (month-over-month)
     */
    async calculateRevenueGrowthRate() {
        const monthlyRevenue = await this.getMonthlyRevenueTrend();

        if (monthlyRevenue.length < 2) return 0;

        const recent = monthlyRevenue.slice(-3); // Last 3 months
        const previous = monthlyRevenue.slice(-6, -3); // Previous 3 months

        const recentAvg = FinancialCalculator.sum(recent.map(m => m.revenue)) / recent.length;
        const previousAvg = FinancialCalculator.sum(previous.map(m => m.revenue)) / Math.max(1, previous.length);

        if (previousAvg <= 0) return recentAvg > 0 ? 100 : 0;

        return FinancialCalculator.multiply((recentAvg - previousAvg) / previousAvg, 100);
    },

    /**
     * Get monthly revenue trend
     */
    async getMonthlyRevenueTrend() {
        const data = await this.fetchAllData();
        const monthlyData = {};

        if (!data || !data.payments) return [];

        data.payments.forEach(payment => {
            const date = new Date(payment.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[key]) {
                monthlyData[key] = { month: key, revenue: 0, count: 0 };
            }
            monthlyData[key].revenue = FinancialCalculator.add(monthlyData[key].revenue, payment.amount || 0);
            monthlyData[key].count++;
        });

        return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    },

    /**
     * Get monthly cost trend
     */
    async getMonthlyCostTrend() {
        const data = await this.fetchAllData();
        const monthlyData = {};

        if (!data) return [];

        // Add expenses
        (data.expenses || []).forEach(expense => {
            const date = new Date(expense.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[key]) {
                monthlyData[key] = { month: key, cost: 0, expenseCount: 0, labourCount: 0 };
            }
            monthlyData[key].cost = FinancialCalculator.add(monthlyData[key].cost, expense.amount || 0);
            monthlyData[key].expenseCount++;
        });

        // Add labour
        data.labourData.forEach(labour => {
            const date = new Date(labour.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[key]) {
                monthlyData[key] = { month: key, cost: 0, expenseCount: 0, labourCount: 0 };
            }
            monthlyData[key].cost = FinancialCalculator.add(monthlyData[key].cost, labour.amountPaid || 0);
            monthlyData[key].labourCount++;
        });

        return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    },

    /**
     * Get monthly margin trend
     */
    async getMarginTrend() {
        const revenueTrend = await this.getMonthlyRevenueTrend();
        const costTrend = await this.getMonthlyCostTrend();

        const marginTrend = [];
        const months = new Set([...revenueTrend.map(r => r.month), ...costTrend.map(c => c.month)]);

        Array.from(months).sort().forEach(month => {
            const revenue = revenueTrend.find(r => r.month === month)?.revenue || 0;
            const cost = costTrend.find(c => c.month === month)?.cost || 0;
            const profit = FinancialCalculator.subtract(revenue, cost);
            const margin = revenue > 0 ? FinancialCalculator.multiply(profit / revenue, 100) : 0;

            marginTrend.push({ month, revenue, cost, profit, margin });
        });

        return marginTrend;
    },

    // ===== OPTIMIZATION INSIGHTS (Greedy Algorithm) =====

    /**
     * Rank projects by profitability (greedy: most profitable first)
     */
    async rankProfitableProjects() {
        const profitability = await this.getPhaseWiseProfitability();
        return profitability.filter(p => p.revenue > 0).sort((a, b) => b.margin - a.margin);
    },

    /**
     * Identify cost-heavy projects
     */
    async identifyCostHeavyProjects() {
        const profitability = await this.getPhaseWiseProfitability();
        const avgCostPerProject = await this.getCostPerProject();

        return profitability
            .filter(p => p.costs > avgCostPerProject * 1.3) // 30% above average
            .sort((a, b) => b.costs - a.costs)
            .map(p => ({
                ...p,
                excess: FinancialCalculator.subtract(p.costs, avgCostPerProject),
                excessPercentage: FinancialCalculator.multiply((p.costs - avgCostPerProject) / avgCostPerProject, 100)
            }));
    },

    /**
     * Get labour efficiency trends
     */
    async getLabourEfficiencyTrends() {
        const data = await this.fetchAllData();
        const projectEfficiency = [];

        if (!data || !data.projects) return [];

        for (const project of data.projects) {
            const projectLabour = (data.labourData || []).filter(l => l.projectId === project.id);
            const projectPayments = (data.payments || []).filter(p => p.projectId === project.id);

            const totalHours = FinancialCalculator.sum(projectLabour.map(l => l.hours || 8));
            const labourCost = FinancialCalculator.sum(projectLabour.map(l => l.amountPaid || 0));
            const revenue = FinancialCalculator.sum(projectPayments.map(p => p.amount || 0));

            if (totalHours > 0) {
                projectEfficiency.push({
                    projectId: project.id,
                    projectName: project.name,
                    totalHours,
                    labourCost,
                    costPerHour: FinancialCalculator.multiply(labourCost, 1 / totalHours),
                    revenuePerHour: revenue > 0 ? FinancialCalculator.multiply(revenue, 1 / totalHours) : 0,
                    efficiency: revenue > 0 && labourCost > 0 ? FinancialCalculator.multiply(revenue / labourCost, 1) : 0
                });
            }
        }

        return projectEfficiency.sort((a, b) => b.efficiency - a.efficiency);
    },

    /**
     * Suggest optimization opportunities (greedy ranking by impact)
     */
    async suggestOptimizations() {
        const suggestions = [];

        // Check for cost-heavy projects
        const costHeavy = await this.identifyCostHeavyProjects();
        costHeavy.slice(0, 3).forEach(p => {
            suggestions.push({
                type: 'cost_reduction',
                priority: 'high',
                impact: p.excess,
                title: `Reduce costs on ${p.projectName}`,
                description: `This project is ${Math.round(p.excessPercentage)}% over average cost. Review expense categories.`,
                projectId: p.projectId
            });
        });

        // Check for inefficient phases
        const inefficient = await this.highlightInefficientPhases();
        inefficient.forEach(phase => {
            suggestions.push({
                type: 'phase_optimization',
                priority: 'medium',
                impact: phase.cost * 0.2, // Assume 20% potential savings
                title: `Optimize ${phase.phase} phase`,
                description: phase.recommendation,
                phase: phase.phase
            });
        });

        // Check for labour efficiency
        const labourEfficiency = await this.getLabourEfficiencyTrends();
        const avgEfficiency = FinancialCalculator.sum(labourEfficiency.map(l => l.efficiency)) / labourEfficiency.length;

        labourEfficiency.filter(l => l.efficiency < avgEfficiency * 0.7).slice(0, 2).forEach(l => {
            suggestions.push({
                type: 'labour_efficiency',
                priority: 'medium',
                impact: l.labourCost * 0.15,
                title: `Improve labour efficiency on ${l.projectName}`,
                description: `Labour efficiency is ${Math.round((1 - l.efficiency / avgEfficiency) * 100)}% below average.`,
                projectId: l.projectId
            });
        });

        // Sort by impact (greedy)
        return suggestions.sort((a, b) => b.impact - a.impact);
    },

    // ===== SCENARIO ANALYSIS =====

    /**
     * Simulate cost reduction scenario
     * @param {number} reductionPercent - Percentage to reduce costs
     */
    async simulateCostReduction(reductionPercent) {
        const currentCosts = await this.calculateOperatingCosts();
        const currentRevenue = await this.calculateTotalRevenue();
        const currentGrossProfit = await this.calculateGrossProfit();

        const reducedCosts = FinancialCalculator.multiply(currentCosts, (100 - reductionPercent) / 100);
        const newGrossProfit = FinancialCalculator.subtract(currentRevenue, reducedCosts);
        const newMargin = currentRevenue > 0 ? FinancialCalculator.multiply(newGrossProfit / currentRevenue, 100) : 0;

        const currentValuation = await this.getValuationScenarios();
        const valuationIncrease = FinancialCalculator.multiply(currentValuation.blended.base, reductionPercent / 100 * 1.5);

        return {
            reductionPercent,
            currentCosts,
            reducedCosts,
            savings: FinancialCalculator.subtract(currentCosts, reducedCosts),
            currentGrossProfit,
            newGrossProfit,
            profitIncrease: FinancialCalculator.subtract(newGrossProfit, currentGrossProfit),
            currentMargin: await this.calculateGrossMargin(),
            newMargin,
            currentValuation: currentValuation.blended.base,
            newValuation: FinancialCalculator.add(currentValuation.blended.base, valuationIncrease),
            valuationIncrease
        };
    },

    /**
     * Simulate revenue growth scenario
     * @param {number} growthPercent - Percentage to grow revenue
     */
    async simulateRevenueGrowth(growthPercent) {
        const currentRevenue = await this.calculateTotalRevenue();
        const currentCosts = await this.calculateOperatingCosts();
        const currentGrossProfit = await this.calculateGrossProfit();

        // Assume 30% of revenue growth requires 20% cost increase (variable costs)
        const grownRevenue = FinancialCalculator.multiply(currentRevenue, (100 + growthPercent) / 100);
        const additionalCosts = FinancialCalculator.multiply(currentCosts, growthPercent / 100 * 0.3);
        const newCosts = FinancialCalculator.add(currentCosts, additionalCosts);
        const newGrossProfit = FinancialCalculator.subtract(grownRevenue, newCosts);
        const newMargin = grownRevenue > 0 ? FinancialCalculator.multiply(newGrossProfit / grownRevenue, 100) : 0;

        const currentValuation = await this.getValuationScenarios();
        // Revenue growth typically gets 1.5-2x multiple on valuation
        const valuationIncrease = FinancialCalculator.multiply(currentValuation.blended.base, growthPercent / 100 * 1.8);

        return {
            growthPercent,
            currentRevenue,
            grownRevenue,
            revenueIncrease: FinancialCalculator.subtract(grownRevenue, currentRevenue),
            currentCosts,
            newCosts,
            currentGrossProfit,
            newGrossProfit,
            profitIncrease: FinancialCalculator.subtract(newGrossProfit, currentGrossProfit),
            currentMargin: await this.calculateGrossMargin(),
            newMargin,
            currentValuation: currentValuation.blended.base,
            newValuation: FinancialCalculator.add(currentValuation.blended.base, valuationIncrease),
            valuationIncrease
        };
    },

    // ===== COMPREHENSIVE ANALYTICS SUMMARY =====

    /**
     * Get complete economics summary for dashboard
     */
    async getComprehensiveSummary() {
        const [
            totalRevenue,
            operatingCosts,
            grossProfit,
            grossMargin,
            netMargin,
            burnRate,
            cashRunway,
            unitEconomics,
            valuationScenarios,
            optimizations
        ] = await Promise.all([
            this.calculateTotalRevenue(),
            this.calculateOperatingCosts(),
            this.calculateGrossProfit(),
            this.calculateGrossMargin(),
            this.calculateNetMargin(),
            this.calculateBurnRate(),
            this.calculateCashRunway(),
            this.getUnitEconomicsBreakdown(),
            this.getValuationScenarios(),
            this.suggestOptimizations()
        ]);

        const data = await this.fetchAllData();

        return {
            overview: {
                totalRevenue,
                operatingCosts,
                grossProfit,
                grossMargin,
                netMargin,
                burnRate,
                cashRunway,
                projectCount: data.projects.length,
                activeProjects: data.projects.filter(p => p.status === 'In Progress').length
            },
            unitEconomics,
            valuation: valuationScenarios,
            optimizations: optimizations.slice(0, 5),
            healthScore: this._calculateHealthScore({
                grossMargin,
                cashRunway,
                optimizations: optimizations.length
            })
        };
    },

    _calculateHealthScore({ grossMargin, cashRunway, optimizations }) {
        let score = 50; // Base score

        // Gross margin contribution (0-30 points)
        if (grossMargin >= 30) score += 30;
        else if (grossMargin >= 20) score += 20;
        else if (grossMargin >= 10) score += 10;
        else if (grossMargin > 0) score += 5;

        // Cash runway contribution (0-20 points)
        if (cashRunway >= 12) score += 20;
        else if (cashRunway >= 6) score += 15;
        else if (cashRunway >= 3) score += 10;
        else if (cashRunway > 0) score += 5;

        // Fewer optimization issues = better (-10 to 0 points)
        if (optimizations >= 5) score -= 10;
        else if (optimizations >= 3) score -= 5;

        return Math.max(0, Math.min(100, score));
    }
};

// Make it globally accessible
if (typeof window !== 'undefined') {
    window.EconomicsAnalytics = EconomicsAnalytics;
}

export default EconomicsAnalytics;
