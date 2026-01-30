/**
 * B&B Premium System
 * Handles premium status checking, expiry, and UI updates
 */

import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Premium status constants
export const PREMIUM_STATUS = {
    FREE: 'FREE',
    PREMIUM: 'PREMIUM',
    EXPIRED: 'EXPIRED'
};

/**
 * Check if user has active premium subscription
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{isPremium: boolean, status: string, endDate: Date|null, daysLeft: number}>}
 */
export async function checkPremiumStatus(userId) {
    try {
        // Check for special users first
        const user = auth.currentUser;
        
        // Admin has full premium
        if (user?.email === 'sulaimaansong6297@gmail.com') {
            return { isPremium: true, status: PREMIUM_STATUS.PREMIUM, endDate: null, daysLeft: 9999 };
        }
        
        // Saqlain has eternal premium (for UI/features) but still pays project fee
        if (user?.email === 'saqlainmohammed1122@gmail.com') {
            return { isPremium: true, status: PREMIUM_STATUS.PREMIUM, endDate: null, daysLeft: 9999, projectFeeRequired: true };
        }
        
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (!userDoc.exists()) {
            return { isPremium: false, status: PREMIUM_STATUS.FREE, endDate: null, daysLeft: 0 };
        }
        
        const userData = userDoc.data();
        
        // Check if user has premium status
        if (userData.premiumStatus !== PREMIUM_STATUS.PREMIUM) {
            return { isPremium: false, status: PREMIUM_STATUS.FREE, endDate: null, daysLeft: 0 };
        }
        
        // Check if premium has expired
        if (userData.premiumEnd) {
            const endDate = userData.premiumEnd.toDate ? userData.premiumEnd.toDate() : new Date(userData.premiumEnd);
            const now = new Date();
            
            if (endDate <= now) {
                // Premium expired - update status
                await updateDoc(doc(db, 'users', userId), {
                    premiumStatus: PREMIUM_STATUS.FREE
                });
                return { isPremium: false, status: PREMIUM_STATUS.EXPIRED, endDate: endDate, daysLeft: 0 };
            }
            
            // Calculate days left
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            
            return { 
                isPremium: true, 
                status: PREMIUM_STATUS.PREMIUM, 
                endDate: endDate, 
                daysLeft: daysLeft 
            };
        }
        
        return { isPremium: false, status: PREMIUM_STATUS.FREE, endDate: null, daysLeft: 0 };
    } catch (error) {
        console.error('Error checking premium status:', error);
        return { isPremium: false, status: PREMIUM_STATUS.FREE, endDate: null, daysLeft: 0 };
    }
}

/**
 * Show premium badge in UI
 * @param {HTMLElement} container - Container element to add badge to
 * @param {object} premiumInfo - Premium status info
 */
export function showPremiumBadge(container, premiumInfo) {
    if (!container) return;
    
    // Remove existing badge
    const existingBadge = container.querySelector('.premium-badge-indicator');
    if (existingBadge) existingBadge.remove();
    
    if (premiumInfo.isPremium) {
        const badge = document.createElement('div');
        badge.className = 'premium-badge-indicator';
        badge.innerHTML = `
            <span style="
                display: inline-flex;
                align-items: center;
                gap: 0.375rem;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #5D4E00;
                padding: 0.25rem 0.75rem;
                border-radius: 50px;
                font-size: 0.6875rem;
                font-weight: 800;
            ">
                <i class="fas fa-crown"></i> PREMIUM
                ${premiumInfo.daysLeft <= 7 ? `<span style="color: #D84315;">(${premiumInfo.daysLeft}d left)</span>` : ''}
            </span>
        `;
        container.appendChild(badge);
    }
}

/**
 * Show renewal reminder if premium is expiring soon
 * @param {object} premiumInfo - Premium status info
 */
export function showRenewalReminder(premiumInfo) {
    if (!premiumInfo.isPremium) return;
    
    // Show reminder if 3 days or less remaining
    if (premiumInfo.daysLeft <= 3 && premiumInfo.daysLeft > 0) {
        // Check if reminder already shown today
        const lastReminder = localStorage.getItem('premiumReminderDate');
        const today = new Date().toDateString();
        
        if (lastReminder === today) return;
        
        // Show reminder
        const reminder = document.createElement('div');
        reminder.id = 'premiumReminder';
        reminder.innerHTML = `
            <div style="
                position: fixed;
                top: 1rem;
                right: 1rem;
                background: linear-gradient(135deg, #FFF3E0, #FFE0B2);
                border: 3px solid #FFB74D;
                border-radius: 16px;
                padding: 1rem 1.5rem;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 320px;
                animation: slideIn 0.3s ease;
            ">
                <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                    <span style="font-size: 1.5rem;">⏰</span>
                    <div>
                        <h4 style="font-weight: 800; color: #E65100; margin-bottom: 0.25rem;">Premium Expiring Soon!</h4>
                        <p style="color: #F57C00; font-size: 0.875rem; margin-bottom: 0.75rem;">
                            Your premium expires in <strong>${premiumInfo.daysLeft} day${premiumInfo.daysLeft > 1 ? 's' : ''}</strong>. Renew now to continue enjoying premium features.
                        </p>
                        <div style="display: flex; gap: 0.5rem;">
                            <a href="upgrade.html" style="
                                background: #FF8C61;
                                color: white;
                                padding: 0.5rem 1rem;
                                border-radius: 8px;
                                font-weight: 700;
                                font-size: 0.8125rem;
                                text-decoration: none;
                            ">Renew Now</a>
                            <button onclick="document.getElementById('premiumReminder').remove(); localStorage.setItem('premiumReminderDate', new Date().toDateString());" style="
                                background: transparent;
                                border: 2px solid #FFB74D;
                                color: #F57C00;
                                padding: 0.5rem 1rem;
                                border-radius: 8px;
                                font-weight: 700;
                                font-size: 0.8125rem;
                                cursor: pointer;
                            ">Later</button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            </style>
        `;
        document.body.appendChild(reminder);
        
        localStorage.setItem('premiumReminderDate', today);
    }
}

/**
 * Check if feature is available for user's plan
 * @param {string} feature - Feature name
 * @param {boolean} isPremium - Whether user has premium
 * @returns {boolean}
 */
export function isFeatureAvailable(feature, isPremium) {
    // Define premium-only features
    const premiumFeatures = [
        'unlimited_projects',
        'cloud_backup',
        'export_reports',
        'advanced_analytics',
        'team_collaboration',
        'priority_support'
    ];
    
    if (premiumFeatures.includes(feature)) {
        return isPremium;
    }
    
    return true; // Free features available to all
}

/**
 * Show upgrade prompt for premium features
 * @param {string} featureName - Name of the feature
 */
export function showUpgradePrompt(featureName) {
    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            padding: 1rem;
        " onclick="if(event.target === this) this.remove();">
            <div style="
                background: white;
                border-radius: 24px;
                padding: 2rem;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 25px 80px rgba(0,0,0,0.3);
            ">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: #2C3E50; margin-bottom: 0.5rem;">Premium Feature</h3>
                <p style="color: #7F8C8D; margin-bottom: 1.5rem;">
                    <strong>${featureName}</strong> is a premium feature. Upgrade to unlock this and many more powerful features!
                </p>
                <div style="display: flex; gap: 0.75rem; justify-content: center;">
                    <a href="upgrade.html" style="
                        background: linear-gradient(135deg, #FF8C61, #FF7043);
                        color: white;
                        padding: 0.75rem 1.5rem;
                        border-radius: 12px;
                        font-weight: 800;
                        text-decoration: none;
                    ">Upgrade Now</a>
                    <button onclick="document.getElementById('upgradeModal').remove();" style="
                        background: #E8F4F8;
                        color: #5B9BD5;
                        padding: 0.75rem 1.5rem;
                        border-radius: 12px;
                        font-weight: 800;
                        border: none;
                        cursor: pointer;
                    ">Maybe Later</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Export for global use
window.checkPremiumStatus = checkPremiumStatus;
window.showUpgradePrompt = showUpgradePrompt;
