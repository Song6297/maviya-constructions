/**
 * Economics Guide Overlay — Persistent formula annotation system
 * 
 * NOT a step-by-step tour. This is a toggle-based overlay that:
 * - Adds clickable ƒ badges next to every metric when activated
 * - Shows rich popovers with formula, data source, algorithm, and business context
 * - Non-blocking — users can still interact with all page elements
 * - Persists active state within session
 * 
 * Usage:
 *   FormulaGuideOverlay.toggle()  — Toggle overlay on/off
 *   FormulaGuideOverlay.isActive  — Check current state
 */

const FormulaGuideOverlay = {

    isActive: false,
    badges: [],
    activePopover: null,

    // ===== FORMULA REGISTRY =====
    // Maps metric IDs to their formulas, sources, and context

    formulas: {
        // === HERO SECTION ===
        'heroValuation': {
            title: 'Estimated Business Value',
            formula: 'Blended Valuation = (Revenue Multiple × 0.6) + (Cash Flow Multiple × 0.4) × Growth Adjustment',
            breakdown: [
                'Revenue Multiple = Annual Revenue × 3.25 (industry standard: 2.5x–4x)',
                'Cash Flow Multiple = Annual Cash Flow × 6.5 (range: 5x–8x)',
                'Growth Adj = 1 + (Growth Rate / 10) × 0.2 (capped at 0.5x–2x)'
            ],
            dataSource: 'All client payments (revenue) and all expenses + labour payments (costs) from Firebase',
            algorithm: 'Annualized revenue extrapolated from data date range, then blended valuation with growth premium/discount',
            context: 'Construction industry standard multiples. Higher margins and growth rates increase the premium.',
            icon: 'fa-gem'
        },
        'healthScoreValue': {
            title: 'Business Health Score',
            formula: 'Health = 50 (base) + Margin Points (0–30) + Runway Points (0–20) − Issue Penalty (0–10)',
            breakdown: [
                'Margin ≥30% → +30pts | ≥20% → +20pts | ≥10% → +10pts | >0% → +5pts',
                'Runway ≥12mo → +20pts | ≥6mo → +15pts | ≥3mo → +10pts | >0 → +5pts',
                'Optimization issues ≥5 → −10pts | ≥3 → −5pts'
            ],
            dataSource: 'Gross margin %, cash runway months, and count of optimization suggestions',
            algorithm: 'Weighted additive scoring model with floor at 0 and ceiling at 100',
            context: 'A score above 75 indicates strong financial health. Below 50 signals areas needing immediate attention.',
            icon: 'fa-heartbeat'
        },
        'heroRevenue': {
            title: 'Total Revenue',
            formula: 'Total Revenue = Σ (All Client Payment Amounts)',
            breakdown: [
                'Sum of every payment.amount across all projects'
            ],
            dataSource: 'clientPayments collection in Firebase, aggregated across all projects',
            algorithm: 'Direct summation using FinancialCalculator.sum() for 2-decimal precision',
            context: 'Represents all money received from clients. Does not include projected or pending amounts.',
            icon: 'fa-coins'
        },
        'heroMargin': {
            title: 'Gross Margin',
            formula: 'Gross Margin = ((Revenue − Operating Costs) / Revenue) × 100%',
            breakdown: [
                'Revenue = Σ client payments',
                'Operating Costs = Σ expenses + Σ labour payments',
                'Profit = Revenue − Operating Costs'
            ],
            dataSource: 'Payments, expenses, and labour data from all projects',
            algorithm: 'Revenue and costs summed separately, then margin calculated. Division by zero returns 0%.',
            context: 'Industry benchmark: 15–25% is typical for construction. Above 25% is excellent.',
            icon: 'fa-percentage'
        },
        'heroRunway': {
            title: 'Cash Runway',
            formula: 'Runway (months) = Available Funds / Monthly Burn Rate',
            breakdown: [
                'Available Funds = Total Revenue − Total Operating Costs',
                'Burn Rate = (Last 3 months total costs) / 3'
            ],
            dataSource: 'Recent expenses and labour payments from last 3 months',
            algorithm: 'Rolling 3-month average burn rate. Returns 999 if burn rate is 0 (infinite runway).',
            context: 'Healthy businesses maintain ≥6 months runway. Below 3 months is critical.',
            icon: 'fa-hourglass-half'
        },

        // === OVERVIEW TAB ===
        'metric-totalRevenue': {
            title: 'Total Revenue',
            formula: 'Total Revenue = Σ paymentᵢ.amount  ∀ projects',
            breakdown: ['Iterates all projects → fetches clientPayments → sums all .amount fields'],
            dataSource: 'clientPayments collection per project in Firebase',
            algorithm: 'FinancialCalculator.sum() with null/undefined handling and 2-decimal rounding',
            context: 'This is the top-line number. All other metrics derive from this.',
            icon: 'fa-money-bill-wave'
        },
        'metric-operatingCosts': {
            title: 'Operating Costs',
            formula: 'Operating Costs = Σ expenses.amount + Σ labour.amountPaid',
            breakdown: [
                'Material/service expenses from expense records',
                'Labour costs from attendance/payment records'
            ],
            dataSource: 'Expenses collection + labour/attendance data per project',
            algorithm: 'Separate summation of expenses and labour, then added together',
            context: 'Includes all direct costs. Does not include estimated overhead (added separately in net margin).',
            icon: 'fa-receipt'
        },
        'metric-grossProfit': {
            title: 'Gross Profit',
            formula: 'Gross Profit = Total Revenue − Operating Costs',
            breakdown: [
                'Simple subtraction with 2-decimal precision',
                'Can be negative if costs exceed revenue'
            ],
            dataSource: 'Derived from Total Revenue and Operating Costs calculations',
            algorithm: 'FinancialCalculator.subtract(revenue, costs)',
            context: 'Profit before overhead. Negative profit means the business is losing money on operations.',
            icon: 'fa-chart-line'
        },
        'metric-burnRate': {
            title: 'Monthly Burn Rate',
            formula: 'Burn Rate = Σ (Costs in last 3 months) / 3',
            breakdown: [
                'Filters expenses where date ≥ 3 months ago',
                'Filters labour where date ≥ 3 months ago',
                'Sums both, divides by 3'
            ],
            dataSource: 'Time-filtered expenses and labour records from last 90 days',
            algorithm: 'Rolling window filter on dates, then arithmetic mean',
            context: 'Shows how fast you\'re spending. Rising burn rate with flat revenue is a warning sign.',
            icon: 'fa-fire'
        },
        'metric-cashRunway': {
            title: 'Cash Runway',
            formula: 'Runway = (Revenue − Costs) / Monthly Burn Rate',
            breakdown: [
                'Available Funds = Total Revenue − Total Costs',
                'Monthly Burn = 3-month rolling average',
                'Result rounded to nearest month'
            ],
            dataSource: 'Combined revenue, cost, and burn rate calculations',
            algorithm: 'Division with zero-check (returns 999 if burn rate is 0)',
            context: '≥12 months = healthy, 6–12 = monitor, <6 = take action, <3 = critical.',
            icon: 'fa-clock'
        },

        // === UNIT ECONOMICS ===
        'metric-costPerProject': {
            title: 'Cost per Project',
            formula: 'Cost/Project = Total Operating Costs / Number of Projects',
            breakdown: ['Average across all projects, including those with no expenses'],
            dataSource: 'Operating costs total divided by project count',
            algorithm: 'FinancialCalculator.multiply(totalCosts, 1/projectCount)',
            context: 'Lower is better. Compare against Revenue/Project to ensure each project is profitable.',
            icon: 'fa-building'
        },
        'metric-revenuePerProject': {
            title: 'Revenue per Project',
            formula: 'Revenue/Project = Total Revenue / Number of Projects',
            breakdown: ['Average revenue generated per project'],
            dataSource: 'Total client payments divided by project count',
            algorithm: 'Simple division with precision handling',
            context: 'Must exceed Cost/Project for profitability. Gap = Profit/Project.',
            icon: 'fa-hand-holding-usd'
        },
        'metric-profitPerProject': {
            title: 'Profit per Project',
            formula: 'Profit/Project = Revenue/Project − Cost/Project',
            breakdown: ['Derived metric showing average net contribution per project'],
            dataSource: 'Derived from Revenue/Project and Cost/Project',
            algorithm: 'FinancialCalculator.subtract(revenuePerProject, costPerProject)',
            context: 'Positive = healthy operations. Negative = rethink project pricing strategy.',
            icon: 'fa-balance-scale'
        },
        'metric-costPerLabourHour': {
            title: 'Cost per Labour Hour',
            formula: 'Cost/Hour = Σ labour.amountPaid / Σ labour.hours',
            breakdown: [
                'Total labour payments divided by total recorded hours',
                'Default 8 hours per entry if hours not specified'
            ],
            dataSource: 'Labour attendance records (amountPaid and hours fields)',
            algorithm: 'Aggregation with fallback default for missing hours',
            context: 'Benchmark against local market rates. Too high = overpaying, too low = quality risk.',
            icon: 'fa-user-clock'
        },
        'metric-revenuePerLabourHour': {
            title: 'Revenue per Labour Hour',
            formula: 'Revenue/Hour = Total Revenue / Total Labour Hours',
            breakdown: ['Efficiency metric: how much each hour of work generates in revenue'],
            dataSource: 'Total revenue and total labour hours across all projects',
            algorithm: 'Division with zero-hour protection',
            context: 'Higher = more efficient workforce. Compare over time to track productivity gains.',
            icon: 'fa-tachometer-alt'
        },

        // === VALUATION ===
        'valuation-conservative': {
            title: 'Conservative Valuation',
            formula: 'Value = Annualized Revenue × 2.5',
            breakdown: [
                'Annualized Revenue = (Total Revenue / Months of Data) × 12',
                'Multiple 2.5x = bottom of construction industry range'
            ],
            dataSource: 'Client payment dates and amounts',
            algorithm: 'Revenue annualization from first to last payment date, then revenue multiple applied',
            context: 'Safe, low-risk estimate. Use for minimum expected sale value.',
            icon: 'fa-shield-alt'
        },
        'valuation-base': {
            title: 'Base Valuation',
            formula: 'Value = Annualized Revenue × 3.25 (blended, growth-adjusted)',
            breakdown: [
                'Blended = 60% Revenue Multiple + 40% Cash Flow Multiple',
                'Cash Flow Multiple = Annual Profit × 6.5',
                'Growth Adjustment = 1 + (GrowthRate/10) × 0.2'
            ],
            dataSource: 'Revenue, profit, and month-over-month growth rate',
            algorithm: 'Dual-method blending with growth premium/discount',
            context: 'Most realistic estimate of current market value.',
            icon: 'fa-star'
        },
        'valuation-aggressive': {
            title: 'Aggressive Valuation',
            formula: 'Value = Annualized Revenue × 4.0',
            breakdown: [
                'Multiple 4.0x = top of construction industry range',
                'Assumes strong growth trajectory and market conditions'
            ],
            dataSource: 'Same as base, with higher multiple',
            algorithm: 'Revenue multiple with growth adjustment',
            context: 'Optimistic exit value. Achievable with demonstrated high growth.',
            icon: 'fa-rocket'
        },

        // === SCENARIOS ===
        'scenario-costReduction': {
            title: 'Cost Reduction Simulation',
            formula: 'New Costs = Current Costs × (1 − Reduction%/100)',
            breakdown: [
                'New Profit = Revenue − New Costs',
                'New Margin = New Profit / Revenue × 100',
                'Valuation Impact = Current Valuation × Reduction% × 1.5'
            ],
            dataSource: 'Current operating costs and revenue',
            algorithm: 'Linear simulation assuming proportional cost reduction across all categories',
            context: 'Shows impact of operational efficiency. Even 5% reduction significantly boosts valuation.',
            icon: 'fa-cut'
        },
        'scenario-revenueGrowth': {
            title: 'Revenue Growth Simulation',
            formula: 'New Revenue = Current Revenue × (1 + Growth%/100)',
            breakdown: [
                'Additional Costs = Current Costs × Growth% × 0.3 (variable cost ratio)',
                'Net Profit Increase = Revenue Increase − Additional Costs',
                'Valuation Impact = Current Valuation × Growth% × 1.8'
            ],
            dataSource: 'Current revenue and cost structure',
            algorithm: 'Growth simulation with variable cost scaling (30% of growth requires cost increase)',
            context: 'Revenue growth has 1.8x multiplier on valuation vs 1.5x for cost reduction.',
            icon: 'fa-chart-line'
        },

        // === ML PREDICTIONS ===
        'ml-revenue': {
            title: 'Revenue Prediction Model',
            formula: 'ŷ = 0.7 × (β₀ + β₁x) + 0.3 × WMA',
            breakdown: [
                'Linear Regression: y = β₀ + β₁x',
                'β₁ = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)²  (OLS slope)',
                'WMA = Σ(wᵢ × yᵢ) / Σwᵢ  (3-month weighted average)',
                'Blend: 70% regression + 30% WMA for stability'
            ],
            dataSource: 'Monthly aggregated client payments',
            algorithm: 'Blended forecast: OLS linear regression for trend + WMA for recency. Holdout validation on last 20% of data.',
            context: 'R² > 0.5 indicates reliable forecasting. Watch for MAPE < 30% for practical accuracy.',
            icon: 'fa-brain'
        },
        'ml-costs': {
            title: 'Cost Prediction Model',
            formula: 'ŷ = 0.7 × (β₀ + β₁x) + 0.3 × WMA',
            breakdown: [
                'Same blended model applied to monthly cost data',
                'Confidence Intervals: ŷ ± z × SE',
                '80% CI: z = 1.282  |  95% CI: z = 1.960',
                'SE = √(Σresiduals² / (n−2))'
            ],
            dataSource: 'Monthly aggregated expenses + labour payments',
            algorithm: 'Same blended approach. Cost models tend to have lower variance than revenue.',
            context: 'If costs are predicted to grow faster than revenue, margin erosion is likely.',
            icon: 'fa-brain'
        },
        'ml-margins': {
            title: 'Margin Prediction Model',
            formula: 'Predicted Margin = Blended Forecast (clamped to 0–100%)',
            breakdown: [
                'Derived from independent revenue and cost predictions',
                'Additional direct regression on historical margin values',
                'Predictions clamped to valid percentage range'
            ],
            dataSource: 'Monthly margin trend (revenue−cost)/revenue per month',
            algorithm: 'Blended forecast with boundary constraints for percentage values',
            context: 'Margin predictions are the most volatile. Use confidence bands for planning.',
            icon: 'fa-brain'
        },
        'ml-accuracy': {
            title: 'Model Accuracy Metrics',
            formula: 'R² = 1 − (SSres / SStot)  |  MAE = Σ|yᵢ−ŷᵢ|/n  |  MAPE = Σ(|yᵢ−ŷᵢ|/|yᵢ|)/n × 100',
            breakdown: [
                'R² (coefficient of determination): 0–1, higher = better fit',
                'MAE (mean absolute error): average prediction error in ₹',
                'MAPE (mean absolute % error): average error as %',
                'Validation uses holdout: train on 80%, test on 20%'
            ],
            dataSource: 'Historical data split into training (80%) and test (20%) sets',
            algorithm: 'Holdout cross-validation with separate train/test evaluation',
            context: 'R² > 0.5 = useful model. MAPE < 20% = good for business planning. More historical months = better accuracy.',
            icon: 'fa-bullseye'
        }
    },

    // ===== TOGGLE OVERLAY =====

    toggle() {
        this.isActive = !this.isActive;
        const btn = document.getElementById('formulaGuideBtn');

        if (this.isActive) {
            this.activate();
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-flask"></i> <span>Hide Formulas</span>';
            }
        } else {
            this.deactivate();
            if (btn) {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-flask"></i> <span>Formula Guide</span>';
            }
        }
    },

    // ===== ACTIVATE OVERLAY =====

    activate() {
        this._injectStyles();
        this._createBadges();
        document.body.classList.add('formula-overlay-active');
    },

    // ===== DEACTIVATE OVERLAY =====

    deactivate() {
        this.badges.forEach(b => b.remove());
        this.badges = [];
        this._closePopover();
        document.body.classList.remove('formula-overlay-active');
    },

    // ===== CREATE FORMULA BADGES =====

    _createBadges() {
        // Remove existing badges first
        this.badges.forEach(b => b.remove());
        this.badges = [];

        // Scan for elements with data-formula-id
        const elements = document.querySelectorAll('[data-formula-id]');
        elements.forEach(el => {
            const formulaId = el.getAttribute('data-formula-id');
            const formula = this.formulas[formulaId];
            if (!formula) return;

            const badge = document.createElement('button');
            badge.className = 'formula-badge';
            badge.innerHTML = '<span>ƒ</span>';
            badge.title = formula.title;
            badge.setAttribute('data-for', formulaId);

            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                this._showPopover(formulaId, badge);
            });

            // Position badge relative to element
            el.style.position = el.style.position || 'relative';
            el.appendChild(badge);
            this.badges.push(badge);
        });
    },

    // ===== POPOVER SYSTEM =====

    _showPopover(formulaId, anchorEl) {
        this._closePopover();

        const formula = this.formulas[formulaId];
        if (!formula) return;

        const popover = document.createElement('div');
        popover.className = 'formula-popover';
        popover.innerHTML = `
            <div class="formula-popover-header">
                <div class="formula-popover-title">
                    <i class="fas ${formula.icon}"></i>
                    <span>${formula.title}</span>
                </div>
                <button class="formula-popover-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="formula-popover-body">
                <div class="formula-section">
                    <div class="formula-section-label"><i class="fas fa-superscript"></i> Formula</div>
                    <code class="formula-expression">${formula.formula}</code>
                </div>
                ${formula.breakdown.length > 0 ? `
                <div class="formula-section">
                    <div class="formula-section-label"><i class="fas fa-list-ol"></i> Breakdown</div>
                    <ul class="formula-breakdown">
                        ${formula.breakdown.map(b => `<li>${b}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                <div class="formula-section">
                    <div class="formula-section-label"><i class="fas fa-database"></i> Data Source</div>
                    <p class="formula-detail">${formula.dataSource}</p>
                </div>
                <div class="formula-section">
                    <div class="formula-section-label"><i class="fas fa-cogs"></i> Algorithm</div>
                    <p class="formula-detail">${formula.algorithm}</p>
                </div>
                <div class="formula-section">
                    <div class="formula-section-label"><i class="fas fa-lightbulb"></i> Why It Matters</div>
                    <p class="formula-context">${formula.context}</p>
                </div>
            </div>
        `;

        // Close button
        popover.querySelector('.formula-popover-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this._closePopover();
        });

        // Position popover
        document.body.appendChild(popover);
        this.activePopover = popover;

        // Smart positioning
        requestAnimationFrame(() => {
            const anchorRect = anchorEl.getBoundingClientRect();
            const popRect = popover.getBoundingClientRect();
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;

            let top = anchorRect.bottom + 8;
            let left = anchorRect.left - popRect.width / 2 + anchorRect.width / 2;

            // Clamp to viewport
            if (left < 12) left = 12;
            if (left + popRect.width > viewportW - 12) left = viewportW - popRect.width - 12;
            if (top + popRect.height > viewportH - 12) {
                top = anchorRect.top - popRect.height - 8;
            }
            if (top < 12) top = 12;

            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
            popover.classList.add('visible');
        });

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !anchorEl.contains(e.target)) {
                    this._closePopover();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
            popover._closeHandler = closeHandler;
        }, 50);
    },

    _closePopover() {
        if (this.activePopover) {
            if (this.activePopover._closeHandler) {
                document.removeEventListener('click', this.activePopover._closeHandler);
            }
            this.activePopover.remove();
            this.activePopover = null;
        }
    },

    // ===== INJECT STYLES =====

    _injectStyles() {
        if (document.getElementById('formula-overlay-styles')) return;

        const style = document.createElement('style');
        style.id = 'formula-overlay-styles';
        style.textContent = `
            /* Formula Badge — uses app theme variables */
            .formula-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: var(--primary);
                color: var(--accent, #1A1A1A);
                border: 2px solid var(--white);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                font-family: 'Georgia', serif;
                font-style: italic;
                z-index: 50;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 2px 8px rgba(247, 181, 0, 0.35);
                animation: formulaBadgePulse 2s infinite;
            }

            .formula-badge:hover {
                transform: scale(1.2);
                background: var(--primary-dark);
                box-shadow: 0 4px 16px rgba(247, 181, 0, 0.5);
                animation: none;
            }

            @keyframes formulaBadgePulse {
                0%, 100% { box-shadow: 0 2px 8px rgba(247, 181, 0, 0.35); }
                50% { box-shadow: 0 2px 12px rgba(247, 181, 0, 0.55); }
            }

            /* Formula Popover — themed */
            .formula-popover {
                position: fixed;
                z-index: 10000;
                width: 380px;
                max-width: calc(100vw - 24px);
                max-height: 80vh;
                background: var(--white);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border);
                opacity: 0;
                transform: translateY(8px) scale(0.96);
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: var(--font-family, 'Inter', sans-serif);
            }

            .formula-popover.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            .formula-popover-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.25rem;
                background: var(--primary);
                color: var(--accent, #1A1A1A);
            }

            .formula-popover-title {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 700;
                font-size: 0.9375rem;
            }

            .formula-popover-title i {
                font-size: 1rem;
                opacity: 0.85;
            }

            .formula-popover-close {
                background: rgba(0,0,0,0.15);
                border: none;
                color: var(--accent, #1A1A1A);
                width: 28px;
                height: 28px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
                font-size: 0.75rem;
            }

            .formula-popover-close:hover {
                background: rgba(0,0,0,0.25);
            }

            .formula-popover-body {
                padding: 1rem 1.25rem 1.25rem;
                overflow-y: auto;
                max-height: calc(80vh - 60px);
                background: var(--white);
            }

            .formula-section {
                margin-bottom: 1rem;
            }

            .formula-section:last-child {
                margin-bottom: 0;
            }

            .formula-section-label {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                font-size: 0.6875rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: var(--primary-dark);
                margin-bottom: 0.5rem;
            }

            .formula-section-label i {
                font-size: 0.625rem;
            }

            .formula-expression {
                display: block;
                background: var(--bg-light);
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 0.75rem 1rem;
                font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
                font-size: 0.8125rem;
                color: var(--dark);
                line-height: 1.5;
                word-break: break-word;
            }

            .formula-breakdown {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .formula-breakdown li {
                position: relative;
                padding: 0.375rem 0 0.375rem 1.25rem;
                font-size: 0.8125rem;
                color: var(--gray-dark);
                line-height: 1.4;
                border-left: 2px solid var(--primary);
            }

            .formula-breakdown li::before {
                content: '→';
                position: absolute;
                left: 0.25rem;
                color: var(--primary);
                font-weight: 700;
            }

            .formula-detail {
                font-size: 0.8125rem;
                color: var(--gray);
                line-height: 1.5;
                margin: 0;
            }

            .formula-context {
                font-size: 0.8125rem;
                color: var(--primary-dark);
                line-height: 1.5;
                margin: 0;
                padding: 0.625rem 0.875rem;
                background: var(--primary-muted);
                border-radius: 8px;
                border-left: 3px solid var(--primary);
            }

            /* Overlay active state */
            body.formula-overlay-active [data-formula-id] {
                outline: 2px dashed rgba(247, 181, 0, 0.35);
                outline-offset: 4px;
                border-radius: 8px;
            }

            /* Toggle button active state */
            #formulaGuideBtn.active {
                background: var(--primary) !important;
                color: var(--accent, #1A1A1A) !important;
                border-color: transparent !important;
                box-shadow: 0 0 16px rgba(247, 181, 0, 0.4);
                animation: guideBtnGlow 2s infinite;
            }

            @keyframes guideBtnGlow {
                0%, 100% { box-shadow: 0 0 16px rgba(247, 181, 0, 0.4); }
                50% { box-shadow: 0 0 24px rgba(247, 181, 0, 0.55); }
            }

            /* Responsive */
            @media (max-width: 768px) {
                .formula-popover {
                    width: calc(100vw - 24px);
                    left: 12px !important;
                }
            }

            /* Scrollbar for popover */
            .formula-popover-body::-webkit-scrollbar {
                width: 4px;
            }
            .formula-popover-body::-webkit-scrollbar-track {
                background: transparent;
            }
            .formula-popover-body::-webkit-scrollbar-thumb {
                background: var(--primary);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }
};

// Make globally accessible
if (typeof window !== 'undefined') {
    window.FormulaGuideOverlay = FormulaGuideOverlay;
}

export default FormulaGuideOverlay;
