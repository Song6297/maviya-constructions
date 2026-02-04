/**
 * Guided Tour Module - Onboarding tour for new users
 * 
 * Features:
 * - Auto-starts on first login
 * - Step-by-step spotlight highlighting
 * - Next/Back/Skip navigation
 * - LocalStorage persistence
 * - Support for module-specific tours (e.g. Economics)
 */

const GuidedTour = {

    // Tour configuration
    STORAGE_KEY: 'bb_tour_completed',
    currentStep: 0,
    isActive: false,
    activeSteps: null,
    overlay: null,
    tooltip: null,

    // Main onboarding steps
    steps: [
        {
            target: '.main-content',
            title: 'Welcome to B&B! 👋',
            text: 'This is your construction project command center. Let\'s take a quick tour to help you get started.',
            position: 'center'
        },
        {
            target: '.sidebar',
            title: 'Navigation Sidebar',
            text: 'Access all features from here: Dashboard, Payments, Funds, Materials, Calendar, and more. Hover to expand.',
            position: 'right'
        },
        {
            target: '.projects-grid, .project-list, [class*="project"]',
            title: 'Your Projects',
            text: 'All your construction projects appear here. Click any project to see details, expenses, labour, and progress.',
            position: 'bottom'
        },
        {
            target: '[href*="labour-calendar"], .nav-item[title="Labour Calendar"]',
            title: 'Calendar & Timelines',
            text: 'Track work day by day. See who worked, on what phase, and when. Click any date to view activities.',
            position: 'right'
        },
        {
            target: '.phase-overview-card, [class*="phase"]',
            title: 'Project Phases',
            text: 'Break projects into phases: Foundation, Structure, Finishing, etc. Track progress and costs per phase.',
            position: 'bottom'
        },
        {
            target: '[href*="payments"], .nav-item[title="Payments"]',
            title: 'Payments & Labour',
            text: 'Record payments to workers and vendors. See who\'s been paid, pending amounts, and payment history.',
            position: 'right'
        },
        {
            target: '[href*="funds"], .nav-item[title="Funds"]',
            title: 'Funds & Budgets',
            text: 'Manage project funds, track balances, and see budget utilization. Automatic updates on every transaction.',
            position: 'right'
        },
        {
            target: '.economics-widget, [href*="economics"]',
            title: 'Analytics & Valuation',
            text: 'See company economics: margins, burn rate, valuation estimates. Understand how operations affect business value.',
            position: 'left'
        },
        {
            target: '.nav-item[title="Help"], [href*="about"]',
            title: 'You\'re All Set! 🎉',
            text: 'Need help? Click Help anytime. Now go create your first project or explore the dashboard!',
            position: 'right'
        }
    ],

    // Economics specific steps
    economicsSteps: [
        {
            target: '.economics-hero',
            title: 'Business Valuation 📈',
            text: 'We calculate your company value using a blended model (Revenue + Cash Flow Multiples) adjusted for your growth rate.',
            position: 'bottom'
        },
        {
            target: '#valuationCards',
            title: 'Growth Scenarios',
            text: 'See your valuation across Conservative, Base, and Aggressive growth scenarios. Base is your current trajectory.',
            position: 'top'
        },
        {
            target: '#unitMetrics',
            title: 'Unit Economics 🏗️',
            text: 'Understand the efficiency of your business. We track Revenue and Cost per project and per labour hour.',
            position: 'bottom'
        },
        {
            target: '#projectProfitTable',
            title: 'Project Profitability',
            text: 'Compare projects side-by-side to see which ones are the most profitable for your company.',
            position: 'top'
        },
        {
            target: '#phaseCostChart',
            title: 'Phase Analysis',
            text: 'See where the most money is being spent across all projects. This helps identify resource leakage.',
            position: 'top'
        },
        {
            target: '#panel-unit-economics .insights-grid',
            title: 'Financial Insights',
            text: 'Our optimizer identifies specific projects and phases where you can reduce costs to boost valuation.',
            position: 'top'
        },
        {
            target: '.hero-health',
            title: 'Business Health Score',
            text: 'A weighted index of your profitability, growth, sustainability, and efficiency.',
            position: 'right'
        }
    ],

    init() {
        // Check if tour was already completed
        if (this.isCompleted()) {
            console.log('[GuidedTour] Tour already completed');
            return false;
        }

        // Auto-start main tour
        this.start();
        return true;
    },

    /**
     * Check if tour has been completed
     */
    isCompleted() {
        return localStorage.getItem(this.STORAGE_KEY) === 'true';
    },

    /**
     * Mark tour as completed
     */
    markCompleted() {
        localStorage.setItem(this.STORAGE_KEY, 'true');
    },

    /**
     * Reset tour (for manual restart)
     */
    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.currentStep = 0;
    },

    /**
     * Create overlay and tooltip elements
     */
    createOverlay() {
        // Remove existing elements
        const existing = document.getElementById('tour-overlay');
        if (existing) existing.remove();

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'tour-overlay';
        this.overlay.innerHTML = `
            <div class="tour-backdrop"></div>
            <div class="tour-spotlight"></div>
            <div class="tour-tooltip">
                <div class="tour-tooltip-header">
                    <span class="tour-step-badge">Step <span id="tourCurrentStep">1</span> of <span id="tourTotalSteps">${this.activeSteps.length}</span></span>
                    <button class="tour-close-btn" onclick="GuidedTour.skip()"><i class="fas fa-times"></i></button>
                </div>
                <h3 class="tour-tooltip-title" id="tourTitle">Welcome</h3>
                <p class="tour-tooltip-text" id="tourText">Let's get started!</p>
                <div class="tour-tooltip-actions">
                    <button class="tour-btn tour-btn-skip" onclick="GuidedTour.skip()">Skip Tour</button>
                    <div class="tour-btn-group">
                        <button class="tour-btn tour-btn-back" id="tourBackBtn" onclick="GuidedTour.prev()"><i class="fas fa-arrow-left"></i> Back</button>
                        <button class="tour-btn tour-btn-next" id="tourNextBtn" onclick="GuidedTour.next()">Next <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>
                <div class="tour-progress">
                    <div class="tour-progress-bar" id="tourProgressBar" style="width: 0%"></div>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.getElementById('tour-styles') || document.createElement('style');
        styles.id = 'tour-styles';
        styles.textContent = `
            #tour-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; pointer-events: none; }
            #tour-overlay.active { pointer-events: auto; }
            .tour-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.7); transition: opacity 0.3s; }
            .tour-spotlight {
                position: absolute;
                border-radius: 12px;
                box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 30px rgba(74,124,89,0.5);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }
            .tour-tooltip {
                position: absolute;
                background: white;
                border-radius: 16px;
                padding: 1.5rem;
                max-width: 360px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
            }
            .tour-tooltip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
            .tour-step-badge { font-size: 0.6875rem; font-weight: 600; color: #6B7280; background: #F3F4F6; padding: 0.25rem 0.5rem; border-radius: 4px; }
            .tour-close-btn { background: none; border: none; color: #9CA3AF; cursor: pointer; padding: 0.25rem; }
            .tour-close-btn:hover { color: #374151; }
            .tour-tooltip-title { font-size: 1.125rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
            .tour-tooltip-text { font-size: 0.875rem; color: #6B7280; line-height: 1.6; margin-bottom: 1.25rem; }
            .tour-tooltip-actions { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
            .tour-btn-group { display: flex; gap: 0.5rem; }
            .tour-btn {
                padding: 0.5rem 1rem;
                border-radius: 8px;
                font-weight: 600;
                font-size: 0.8125rem;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 0.375rem;
            }
            .tour-btn-skip { background: none; border: none; color: #9CA3AF; }
            .tour-btn-skip:hover { color: #374151; }
            .tour-btn-back { background: #F3F4F6; border: none; color: #374151; }
            .tour-btn-back:hover { background: #E5E7EB; }
            .tour-btn-back:disabled { opacity: 0.5; cursor: not-allowed; }
            .tour-btn-next { background: #F7B500; border: none; color: white; }
            .tour-btn-next:hover { background: #D9A000; }
            .tour-progress { height: 4px; background: #E5E7EB; border-radius: 2px; margin-top: 1rem; overflow: hidden; }
            .tour-progress-bar { height: 100%; background: linear-gradient(90deg, #F7B500, #FFCC33); border-radius: 2px; transition: width 0.3s; }
            
            @keyframes tour-pulse {
                0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 20px rgba(74,124,89,0.5); }
                50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.7), 0 0 30px rgba(74,124,89,0.8); }
            }
            .tour-spotlight { animation: tour-pulse 2s infinite; }
        `;

        if (!document.getElementById('tour-styles')) {
            document.head.appendChild(styles);
        }
        document.body.appendChild(this.overlay);
    },

    /**
     * Start the tour
     */
    start(customSteps = null) {
        this.activeSteps = customSteps || this.steps;
        this.createOverlay();
        this.isActive = true;
        this.currentStep = 0;
        this.overlay.classList.add('active');
        this.showStep(0);
    },

    /**
     * Start the economics specific tour
     */
    startEconomicsTour() {
        this.start(this.economicsSteps);
    },

    /**
     * Go to next step
     */
    next() {
        if (this.currentStep < this.activeSteps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.finish();
        }
    },

    /**
     * Go to previous step
     */
    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    },

    /**
     * Skip the tour
     */
    skip() {
        this.markCompleted();
        this.hide();
    },

    /**
     * Finish the tour
     */
    finish() {
        this.markCompleted();
        this.hide();

        // Show completion toast
        this.showCompletionMessage();
    },

    /**
     * Hide the tour
     */
    hide() {
        this.isActive = false;
        if (this.overlay) {
            this.overlay.classList.remove('active');

            // Remove spotlight and reset
            const spotlight = this.overlay.querySelector('.tour-spotlight');
            const tooltip = this.overlay.querySelector('.tour-tooltip');
            if (spotlight) spotlight.style.opacity = '0';
            if (tooltip) tooltip.style.opacity = '0';

            setTimeout(() => {
                if (this.overlay) this.overlay.remove();
                const styles = document.getElementById('tour-styles');
                if (styles) styles.remove();
            }, 300);
        }
    },

    /**
     * Show a specific step
     */
    showStep(index) {
        const step = this.activeSteps[index];
        if (!step) return;

        // Find target element
        let target = document.querySelector(step.target);

        // Fallback if target not found
        if (!target) {
            target = document.querySelector('.main-content') || document.body;
        }

        const rect = target.getBoundingClientRect();
        const spotlight = this.overlay.querySelector('.tour-spotlight');
        const tooltip = this.overlay.querySelector('.tour-tooltip');

        // Position spotlight
        const padding = 8;
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        spotlight.style.opacity = '1';

        // Update tooltip content
        document.getElementById('tourCurrentStep').textContent = index + 1;
        document.getElementById('tourTotalSteps').textContent = this.activeSteps.length;
        document.getElementById('tourTitle').textContent = step.title;
        document.getElementById('tourText').textContent = step.text;

        // Update progress bar
        const progress = ((index + 1) / this.activeSteps.length) * 100;
        const progressBar = document.getElementById('tourProgressBar');
        if (progressBar) progressBar.style.width = `${progress}%`;

        // Update buttons
        const backBtn = document.getElementById('tourBackBtn');
        const nextBtn = document.getElementById('tourNextBtn');

        if (backBtn) {
            backBtn.disabled = index === 0;
            backBtn.style.opacity = index === 0 ? '0.5' : '1';
        }

        if (nextBtn) {
            if (index === this.activeSteps.length - 1) {
                nextBtn.innerHTML = 'Finish <i class="fas fa-check"></i>';
            } else {
                nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
            }
        }

        // Position tooltip
        this.positionTooltip(rect, step.position, tooltip);
    },

    /**
     * Position tooltip relative to target
     */
    positionTooltip(targetRect, position, tooltip) {
        const padding = 20;
        const tooltipWidth = 360;
        const tooltipHeight = tooltip.offsetHeight || 200;

        let left, top;

        switch (position) {
            case 'right':
                left = targetRect.right + padding;
                top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
                break;
            case 'left':
                left = targetRect.left - tooltipWidth - padding;
                top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
                break;
            case 'top':
                left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
                top = targetRect.top - tooltipHeight - padding;
                break;
            case 'bottom':
                left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
                top = targetRect.bottom + padding;
                break;
            case 'center':
            default:
                left = (window.innerWidth / 2) - (tooltipWidth / 2);
                top = (window.innerHeight / 2) - (tooltipHeight / 2);
                break;
        }

        // Keep tooltip in viewport
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
        top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.opacity = '1';
    },

    /**
     * Show completion message
     */
    showCompletionMessage() {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, #F7B500, #FFCC33);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 1.25rem;"></i>
            <div>
                <div style="font-weight: 700;">Tour Complete!</div>
                <div style="font-size: 0.75rem; opacity: 0.9;">You can restart the tour from Settings anytime.</div>
            </div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);

        // Add animation keyframes if not exists
        if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
    },

    /**
     * Manually restart tour
     */
    restart() {
        this.reset();
        this.start();
    }
};

// Make globally accessible
window.GuidedTour = GuidedTour;

export default GuidedTour;
