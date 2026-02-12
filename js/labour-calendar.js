// Labour Calendar System - Calendar-Centric Labour Management
// Implements time-based work tracking, payments, and fund integration

import Storage from './firebase-storage.js';

/**
 * Work Entry Data Model
 * @typedef {Object} WorkEntry
 * @property {string} id - Auto-generated ID
 * @property {string} labourId - Reference to worker
 * @property {string} labourName - Denormalized for display
 * @property {string} projectId - Reference to project
 * @property {string} projectName - Denormalized for display
 * @property {string} workType - e.g., "Masonry", "Electrical"
 * @property {string} date - Date of work (YYYY-MM-DD)
 * @property {string} startTime - "09:00"
 * @property {string} endTime - "17:00"
 * @property {number} hoursWorked - Calculated from times
 * @property {number} hourlyRate - Rate for this work type
 * @property {number} earnedAmount - hoursWorked * hourlyRate
 * @property {string} notes
 * @property {boolean} isImmutable - Once created, core fields cannot be modified
 */

/**
 * Labour Payment Data Model
 * @typedef {Object} LabourPayment
 * @property {string} id
 * @property {string} labourId
 * @property {string} labourName
 * @property {string} projectId
 * @property {string} projectName
 * @property {number} amount
 * @property {string} paymentDate - YYYY-MM-DD
 * @property {string} paymentMethod - "Cash", "Bank Transfer", "UPI"
 * @property {string} notes
 */

/**
 * Meeting Data Model
 * @typedef {Object} Meeting
 * @property {string} id
 * @property {string} projectId
 * @property {string} date - YYYY-MM-DD
 * @property {string} startTime
 * @property {string} endTime
 * @property {string[]} attendees - Labour IDs
 * @property {string} purpose
 * @property {string} outcome
 * @property {string[]} linkedWorkEntries - Work entries affected
 */

/**
 * Day Summary Data Model (Computed)
 * @typedef {Object} DaySummary
 * @property {string} date - "YYYY-MM-DD"
 * @property {number} labourCount
 * @property {number} totalHours
 * @property {number} totalEarned
 * @property {number} totalPaid
 * @property {number} totalDue
 * @property {number} fundImpact - Negative = payments made
 * @property {Array} projectBreakdown
 * @property {Array} workTypeBreakdown
 */

// Default work type rates (hourly)
const DEFAULT_WORK_TYPE_RATES = {
    'Mason': 100,
    'Helper': 50,
    'Carpenter': 90,
    'Electrician': 100,
    'Plumber': 95,
    'Painter': 80,
    'Welder': 110,
    'Tile Worker': 100,
    'Plasterer': 85,
    'General': 60
};

const LabourCalendar = {
    // Cache for work type rates
    _workTypeRates: null,
    _storageReady: false,

    /**
     * Ensure Storage is ready before using
     */
    async ensureReady() {
        if (!this._storageReady) {
            await Storage.waitForAuth();
            this._storageReady = true;
        }
    },

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Calculate hours worked from start and end time strings
     * @param {string} startTime - "HH:MM" format
     * @param {string} endTime - "HH:MM" format
     * @returns {number} Hours worked (decimal)
     */
    calculateHoursWorked(startTime, endTime) {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        // Handle overnight shifts
        let diffMinutes = endMinutes - startMinutes;
        if (diffMinutes < 0) {
            diffMinutes += 24 * 60; // Add 24 hours
        }

        return Math.round((diffMinutes / 60) * 100) / 100; // Round to 2 decimals
    },

    /**
     * Calculate earnings from hours and rate
     * @param {number} hoursWorked
     * @param {number} hourlyRate
     * @returns {number} Earned amount
     */
    calculateEarnings(hoursWorked, hourlyRate) {
        return Math.round(hoursWorked * hourlyRate * 100) / 100;
    },

    /**
     * Get hourly rate for a work type
     * @param {string} workType
     * @returns {Promise<number>}
     */
    async getHourlyRate(workType) {
        await this.ensureReady();
        // Try to get from stored rates first
        if (!this._workTypeRates) {
            const rates = await Storage.workTypeRates.getAll();
            this._workTypeRates = {};
            rates.forEach(r => {
                this._workTypeRates[r.workType] = r.hourlyRate;
            });
        }

        return this._workTypeRates[workType] || DEFAULT_WORK_TYPE_RATES[workType] || DEFAULT_WORK_TYPE_RATES['General'];
    },

    /**
     * Format date to YYYY-MM-DD
     * @param {Date|string} date
     * @returns {string}
     */
    formatDate(date) {
        if (typeof date === 'string') return date;
        return date.toISOString().split('T')[0];
    },

    // ==================== WORK ENTRY OPERATIONS ====================

    /**
     * Create a new work entry (Task 2.1)
     * @param {Object} entry - Work entry data
     * @returns {Promise<WorkEntry>}
     */
    async createWorkEntry(entry) {
        await this.ensureReady();
        // Validate required fields
        if (!entry.labourId || !entry.projectId || !entry.workType || !entry.date || !entry.startTime || !entry.endTime) {
            throw new Error('Missing required fields: labourId, projectId, workType, date, startTime, endTime');
        }

        // Validate time range
        const hoursWorked = this.calculateHoursWorked(entry.startTime, entry.endTime);
        if (hoursWorked <= 0) {
            throw new Error('End time must be after start time');
        }

        // Get hourly rate
        const hourlyRate = entry.hourlyRate || await this.getHourlyRate(entry.workType);

        // Calculate earnings
        const earnedAmount = this.calculateEarnings(hoursWorked, hourlyRate);

        // Get worker and project names for denormalization
        const worker = await Storage.workers.getById(entry.labourId);
        const project = await Storage.projects.getById(entry.projectId);

        const workEntry = {
            labourId: entry.labourId,
            labourName: worker?.name || entry.labourName || 'Unknown',
            projectId: entry.projectId,
            projectName: project?.name || entry.projectName || 'Unknown',
            workType: entry.workType,
            date: this.formatDate(entry.date),
            startTime: entry.startTime,
            endTime: entry.endTime,
            hoursWorked,
            hourlyRate,
            earnedAmount,
            notes: entry.notes || '',
            isImmutable: true // Mark as immutable once created
        };

        return await Storage.workEntries.add(workEntry);
    },

    /**
     * Get work entries by date (Task 2.2)
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<WorkEntry[]>}
     */
    async getWorkEntriesByDate(date) {
        await this.ensureReady();
        const entries = await Storage.workEntries.getByDate(date);
        // Sort by start time
        return entries.sort((a, b) => a.startTime.localeCompare(b.startTime));
    },

    /**
     * Get work entries by labour and optional date range (Task 2.3)
     * @param {string} labourId
     * @param {Object} dateRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     * @returns {Promise<WorkEntry[]>}
     */
    async getWorkEntriesByLabour(labourId, dateRange = null) {
        await this.ensureReady();
        let entries = await Storage.workEntries.getByLabour(labourId);

        if (dateRange) {
            entries = entries.filter(e => {
                return e.date >= dateRange.start && e.date <= dateRange.end;
            });
        }

        return entries.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });
    },

    /**
     * Get work entries by project and optional date range
     * @param {string} projectId
     * @param {Object} dateRange - { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     * @returns {Promise<WorkEntry[]>}
     */
    async getWorkEntriesByProject(projectId, dateRange = null) {
        await this.ensureReady();
        let entries = await Storage.workEntries.getByProject(projectId);

        if (dateRange) {
            entries = entries.filter(e => {
                return e.date >= dateRange.start && e.date <= dateRange.end;
            });
        }

        return entries.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });
    },

    // ==================== PAYMENT OPERATIONS ====================

    /**
     * Record a payment to a labourer (Task 3.1)
     * @param {Object} payment - Payment data
     * @returns {Promise<LabourPayment>}
     */
    async recordPayment(payment) {
        await this.ensureReady();
        if (!payment.labourId || !payment.projectId || !payment.amount) {
            throw new Error('Missing required fields: labourId, projectId, amount');
        }

        // Get worker and project names
        const worker = await Storage.workers.getById(payment.labourId);
        const project = await Storage.projects.getById(payment.projectId);

        // Check for overpayment
        const dueInfo = await this.getLabourDue(payment.labourId, payment.projectId);
        const isOverpayment = payment.amount > dueInfo.due;

        const paymentRecord = {
            labourId: payment.labourId,
            labourName: worker?.name || payment.labourName || 'Unknown',
            projectId: payment.projectId,
            projectName: project?.name || payment.projectName || 'Unknown',
            amount: parseFloat(payment.amount),
            paymentDate: payment.paymentDate || this.formatDate(new Date()),
            paymentMethod: payment.paymentMethod || 'Cash',
            notes: payment.notes || '',
            isOverpayment
        };

        return await Storage.labourPayments.add(paymentRecord);
    },

    /**
     * Get payments by labour (Task 3.2)
     * @param {string} labourId
     * @returns {Promise<LabourPayment[]>}
     */
    async getPaymentsByLabour(labourId) {
        await this.ensureReady();
        return await Storage.labourPayments.getByLabour(labourId);
    },

    /**
     * Get payments by date
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<LabourPayment[]>}
     */
    async getPaymentsByDate(date) {
        await this.ensureReady();
        return await Storage.labourPayments.getByDate(date);
    },

    /**
     * Calculate labour due amount (Task 3.3)
     * @param {string} labourId
     * @param {string} projectId - Optional, if not provided calculates across all projects
     * @returns {Promise<{earned: number, paid: number, due: number}>}
     */
    async getLabourDue(labourId, projectId = null) {
        await this.ensureReady();
        // Get all work entries for this labour
        let entries = await Storage.workEntries.getByLabour(labourId);
        if (projectId) {
            entries = entries.filter(e => e.projectId === projectId);
        }

        const earned = entries.reduce((sum, e) => sum + (e.earnedAmount || 0), 0);

        // Get all payments for this labour
        let payments = await Storage.labourPayments.getByLabour(labourId);
        if (projectId) {
            payments = payments.filter(p => p.projectId === projectId);
        }

        const paid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            earned: Math.round(earned * 100) / 100,
            paid: Math.round(paid * 100) / 100,
            due: Math.round((earned - paid) * 100) / 100
        };
    },

    // ==================== FUND AUTO-UPDATE (Task 4) ====================

    /**
     * Process payment with automatic fund balance update (Task 4.1)
     * @param {Object} payment - Payment data
     * @returns {Promise<{payment: LabourPayment, newFundBalance: number, warning: string|null}>}
     */
    async processPaymentWithFundUpdate(payment) {
        await this.ensureReady();
        // Get current fund balance
        const wallet = await Storage.projectWallets.getByProject(payment.projectId);
        const currentBalance = wallet?.balance || 0;

        // Check if payment would make balance negative (Task 4.2)
        let warning = null;
        if (payment.amount > currentBalance) {
            warning = `Payment of ₹${payment.amount} exceeds available fund balance of ₹${currentBalance}`;
        }

        // Record the payment
        const paymentRecord = await this.recordPayment(payment);

        // Update fund balance (deduct payment amount)
        let newBalance = currentBalance - payment.amount;

        if (wallet) {
            await Storage.projectWallets.update(wallet.id, {
                balance: newBalance,
                lastUpdated: new Date().toISOString()
            });
        }

        return {
            payment: paymentRecord,
            newFundBalance: newBalance,
            warning
        };
    },

    /**
     * Check if fund balance is sufficient for payment (Task 4.2)
     * @param {string} projectId
     * @param {number} amount
     * @returns {Promise<{sufficient: boolean, currentBalance: number, shortfall: number}>}
     */
    async checkFundBalance(projectId, amount) {
        await this.ensureReady();
        const wallet = await Storage.projectWallets.getByProject(projectId);
        const currentBalance = wallet?.balance || 0;

        return {
            sufficient: currentBalance >= amount,
            currentBalance,
            shortfall: Math.max(0, amount - currentBalance)
        };
    },

    // ==================== PROJECT BUDGET AUTO-UPDATE (Task 5) ====================

    /**
     * Update project budget after labour payment (Task 5.1)
     * @param {string} projectId
     * @param {number} paymentAmount
     * @returns {Promise<{remainingBudget: number}>}
     */
    async updateProjectBudgetOnPayment(projectId, paymentAmount) {
        await this.ensureReady();
        const project = await Storage.projects.getById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        const currentLabourSpent = project.labourSpent || 0;
        const newLabourSpent = currentLabourSpent + paymentAmount;

        await Storage.projects.update(projectId, {
            labourSpent: newLabourSpent
        });

        const budget = project.budget || 0;
        const remainingBudget = budget - newLabourSpent;

        return { remainingBudget };
    },

    /**
     * Get project budget status (Task 5.2)
     * @param {string} projectId
     * @returns {Promise<{totalLabourCost: number, remainingBudget: number, status: string}>}
     */
    async getProjectBudgetStatus(projectId) {
        await this.ensureReady();
        const project = await Storage.projects.getById(projectId);
        if (!project) {
            return { totalLabourCost: 0, remainingBudget: 0, status: 'unknown' };
        }

        const payments = await Storage.labourPayments.getByProject(projectId);
        const totalLabourCost = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const budget = project.budget || 0;
        const remainingBudget = budget - totalLabourCost;

        // Determine status
        let status = 'healthy';
        if (remainingBudget <= 0) {
            status = 'exhausted';
        } else if (remainingBudget < budget * 0.1) {
            status = 'critical';
        } else if (remainingBudget < budget * 0.25) {
            status = 'low';
        }

        return {
            totalLabourCost: Math.round(totalLabourCost * 100) / 100,
            remainingBudget: Math.round(remainingBudget * 100) / 100,
            status
        };
    },

    // ==================== DAY SUMMARY CALCULATIONS (Task 6) ====================

    /**
     * Get summary for a specific date (Task 6.1)
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<DaySummary>}
     */
    async getDaySummary(date) {
        await this.ensureReady();
        const workEntries = await this.getWorkEntriesByDate(date);
        const payments = await this.getPaymentsByDate(date);
        const meetings = await this.getMeetingsByDate(date);

        // Calculate totals
        const uniqueLabourIds = [...new Set(workEntries.map(e => e.labourId))];
        const labourCount = uniqueLabourIds.length;
        const totalHours = workEntries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
        const totalEarned = workEntries.reduce((sum, e) => sum + (e.earnedAmount || 0), 0);
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalDue = totalEarned - totalPaid;
        const fundImpact = -totalPaid; // Negative because payments reduce fund

        // Project breakdown (Task 6.3)
        const projectMap = new Map();
        workEntries.forEach(entry => {
            if (!projectMap.has(entry.projectId)) {
                projectMap.set(entry.projectId, {
                    projectId: entry.projectId,
                    projectName: entry.projectName,
                    labourIds: new Set(),
                    hours: 0,
                    earned: 0
                });
            }
            const proj = projectMap.get(entry.projectId);
            proj.labourIds.add(entry.labourId);
            proj.hours += entry.hoursWorked || 0;
            proj.earned += entry.earnedAmount || 0;
        });

        const projectBreakdown = Array.from(projectMap.values()).map(p => ({
            projectId: p.projectId,
            projectName: p.projectName,
            labourCount: p.labourIds.size,
            hours: Math.round(p.hours * 100) / 100,
            earned: Math.round(p.earned * 100) / 100
        }));

        // Work type breakdown
        const workTypeMap = new Map();
        workEntries.forEach(entry => {
            if (!workTypeMap.has(entry.workType)) {
                workTypeMap.set(entry.workType, { workType: entry.workType, hours: 0, earned: 0 });
            }
            const wt = workTypeMap.get(entry.workType);
            wt.hours += entry.hoursWorked || 0;
            wt.earned += entry.earnedAmount || 0;
        });

        const workTypeBreakdown = Array.from(workTypeMap.values()).map(wt => ({
            workType: wt.workType,
            hours: Math.round(wt.hours * 100) / 100,
            earned: Math.round(wt.earned * 100) / 100
        }));

        return {
            date,
            labourCount,
            totalHours: Math.round(totalHours * 100) / 100,
            totalEarned: Math.round(totalEarned * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalDue: Math.round(totalDue * 100) / 100,
            fundImpact: Math.round(fundImpact * 100) / 100,
            projectBreakdown,
            workTypeBreakdown,
            meetingCount: meetings.length,
            hasActivity: workEntries.length > 0 || payments.length > 0 || meetings.length > 0
        };
    },

    /**
     * Get month summary for calendar rendering (Task 6.2)
     * @param {number} year
     * @param {number} month - 1-12
     * @returns {Promise<DaySummary[]>}
     */
    async getMonthSummary(year, month) {
        await this.ensureReady();
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Get all work entries and payments for the month
        const allEntries = await Storage.workEntries.getAll();
        const allPayments = await Storage.labourPayments.getAll();
        const allMeetings = await Storage.meetings.getAll();

        // Filter to this month
        const monthEntries = allEntries.filter(e => e.date >= startDate && e.date <= endDate);
        const monthPayments = allPayments.filter(p => p.paymentDate >= startDate && p.paymentDate <= endDate);
        const monthMeetings = allMeetings.filter(m => m.date >= startDate && m.date <= endDate);

        // Group by date
        const summaries = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const dayEntries = monthEntries.filter(e => e.date === date);
            const dayPayments = monthPayments.filter(p => p.paymentDate === date);
            const dayMeetings = monthMeetings.filter(m => m.date === date);

            const uniqueLabourIds = [...new Set(dayEntries.map(e => e.labourId))];
            const totalHours = dayEntries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
            const totalEarned = dayEntries.reduce((sum, e) => sum + (e.earnedAmount || 0), 0);
            const totalPaid = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

            // Get unique work types for icons
            const workTypes = [...new Set(dayEntries.map(e => e.workType))];

            summaries.push({
                date,
                day,
                labourCount: uniqueLabourIds.length,
                totalHours: Math.round(totalHours * 100) / 100,
                totalEarned: Math.round(totalEarned * 100) / 100,
                totalPaid: Math.round(totalPaid * 100) / 100,
                totalDue: Math.round((totalEarned - totalPaid) * 100) / 100,
                workTypes,
                meetingCount: dayMeetings.length,
                hasActivity: dayEntries.length > 0 || dayPayments.length > 0 || dayMeetings.length > 0
            });
        }

        return summaries;
    },

    // ==================== MEETING OPERATIONS (Task 13) ====================

    /**
     * Create a meeting record
     * @param {Object} meeting - Meeting data
     * @returns {Promise<Meeting>}
     */
    async createMeeting(meeting) {
        await this.ensureReady();
        if (!meeting.projectId || !meeting.date) {
            throw new Error('Missing required fields: projectId, date');
        }

        const project = await Storage.projects.getById(meeting.projectId);

        const meetingRecord = {
            projectId: meeting.projectId,
            projectName: project?.name || 'Unknown',
            date: this.formatDate(meeting.date),
            startTime: meeting.startTime || '09:00',
            endTime: meeting.endTime || '10:00',
            attendees: meeting.attendees || [],
            purpose: meeting.purpose || '',
            outcome: meeting.outcome || '',
            linkedWorkEntries: meeting.linkedWorkEntries || []
        };

        return await Storage.meetings.add(meetingRecord);
    },

    /**
     * Get meetings by date
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<Meeting[]>}
     */
    async getMeetingsByDate(date) {
        await this.ensureReady();
        return await Storage.meetings.getByDate(date);
    },

    /**
     * Get meetings by project
     * @param {string} projectId
     * @returns {Promise<Meeting[]>}
     */
    async getMeetingsByProject(projectId) {
        await this.ensureReady();
        return await Storage.meetings.getByProject(projectId);
    },

    // ==================== WORK TYPE RATES MANAGEMENT ====================

    /**
     * Get all work type rates
     * @returns {Promise<Object[]>}
     */
    async getWorkTypeRates() {
        await this.ensureReady();
        const rates = await Storage.workTypeRates.getAll();
        if (rates.length === 0) {
            // Initialize with defaults
            await this.initializeDefaultRates();
            return await Storage.workTypeRates.getAll();
        }
        return rates;
    },

    /**
     * Initialize default work type rates (Task 1.3)
     */
    async initializeDefaultRates() {
        await this.ensureReady();
        for (const [workType, hourlyRate] of Object.entries(DEFAULT_WORK_TYPE_RATES)) {
            await Storage.workTypeRates.add({
                workType,
                hourlyRate,
                effectiveFrom: new Date().toISOString().split('T')[0]
            });
        }
        // Clear cache
        this._workTypeRates = null;
    },

    /**
     * Update work type rate
     * @param {string} workType
     * @param {number} newRate
     */
    async updateWorkTypeRate(workType, newRate) {
        await this.ensureReady();
        const rates = await Storage.workTypeRates.getAll();
        const existing = rates.find(r => r.workType === workType);

        if (existing) {
            await Storage.workTypeRates.update(existing.id, {
                hourlyRate: newRate,
                effectiveFrom: new Date().toISOString().split('T')[0]
            });
        } else {
            await Storage.workTypeRates.add({
                workType,
                hourlyRate: newRate,
                effectiveFrom: new Date().toISOString().split('T')[0]
            });
        }

        // Clear cache
        this._workTypeRates = null;
    },

    // ==================== AUDIT TRAIL (Task 14) ====================

    /**
     * Get all activities for a date (Task 14.3)
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<Object>}
     */
    async getDateActivities(date) {
        await this.ensureReady();
        const workEntries = await this.getWorkEntriesByDate(date);
        const payments = await this.getPaymentsByDate(date);
        const meetings = await this.getMeetingsByDate(date);

        // Combine and sort by time
        const activities = [
            ...workEntries.map(e => ({
                type: 'work',
                time: e.startTime,
                endTime: e.endTime,
                data: e
            })),
            ...payments.map(p => ({
                type: 'payment',
                time: '00:00', // Payments don't have specific times
                data: p
            })),
            ...meetings.map(m => ({
                type: 'meeting',
                time: m.startTime,
                endTime: m.endTime,
                data: m
            }))
        ].sort((a, b) => a.time.localeCompare(b.time));

        return {
            date,
            activities,
            summary: await this.getDaySummary(date)
        };
    },

    // ==================== LABOUR TIMELINE (Task 4 in design) ====================

    /**
     * Get labour timeline for a date (grouped by labour)
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<Object[]>}
     */
    async getLabourTimeline(date) {
        await this.ensureReady();
        const workEntries = await this.getWorkEntriesByDate(date);
        const meetings = await this.getMeetingsByDate(date);

        // Group by labour
        const labourMap = new Map();

        workEntries.forEach(entry => {
            if (!labourMap.has(entry.labourId)) {
                labourMap.set(entry.labourId, {
                    labourId: entry.labourId,
                    labourName: entry.labourName,
                    timeBlocks: [],
                    totalHours: 0,
                    totalEarned: 0
                });
            }
            const labour = labourMap.get(entry.labourId);
            labour.timeBlocks.push({
                type: 'work',
                startTime: entry.startTime,
                endTime: entry.endTime,
                projectName: entry.projectName,
                workType: entry.workType,
                hours: entry.hoursWorked,
                earned: entry.earnedAmount
            });
            labour.totalHours += entry.hoursWorked || 0;
            labour.totalEarned += entry.earnedAmount || 0;
        });

        // Add meetings to relevant labourers
        meetings.forEach(meeting => {
            meeting.attendees?.forEach(labourId => {
                if (labourMap.has(labourId)) {
                    labourMap.get(labourId).timeBlocks.push({
                        type: 'meeting',
                        startTime: meeting.startTime,
                        endTime: meeting.endTime,
                        purpose: meeting.purpose,
                        outcome: meeting.outcome
                    });
                }
            });
        });

        // Sort time blocks and return
        return Array.from(labourMap.values()).map(labour => ({
            ...labour,
            timeBlocks: labour.timeBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)),
            totalHours: Math.round(labour.totalHours * 100) / 100,
            totalEarned: Math.round(labour.totalEarned * 100) / 100
        }));
    },

    // ==================== DATA MIGRATION ====================

    /**
     * Check if migration is needed
     * @returns {Promise<boolean>}
     */
    async needsMigration() {
        await this.ensureReady();

        // Check if there's old data to migrate
        const oldAttendance = await Storage.workerAttendance.getAll();
        const oldPayments = await Storage.workerPayments.getAll();

        // Check if new collections have data
        const newWorkEntries = await Storage.workEntries.getAll();
        const newPayments = await Storage.labourPayments.getAll();

        // If old data exists and new collections are empty, migration is needed
        const hasOldData = oldAttendance.length > 0 || oldPayments.length > 0;
        const hasNewData = newWorkEntries.length > 0 || newPayments.length > 0;

        console.log(`[Migration Check] Old attendance: ${oldAttendance.length}, Old payments: ${oldPayments.length}`);
        console.log(`[Migration Check] New work entries: ${newWorkEntries.length}, New labour payments: ${newPayments.length}`);

        // Need migration if old data exists and hasn't been migrated yet
        if (hasOldData && !hasNewData) {
            return true;
        }

        // Also check localStorage flag for partial migrations
        const migrationFlag = localStorage.getItem('labour_data_migrated');
        if (migrationFlag === 'true' && hasNewData) {
            return false;
        }

        return hasOldData;
    },

    /**
     * Force run migration (ignores localStorage flag)
     * @returns {Promise<Object>}
     */
    async forceMigration() {
        localStorage.removeItem('labour_data_migrated');
        localStorage.removeItem('labour_migration_date');
        return await this.migrateOldData();
    },

    /**
     * Migrate old worker attendance data to new work_entries format
     * Old format: { workerId, projectId, date, status (present/half-day/absent), hoursWorked }
     * New format: { labourId, projectId, date, startTime, endTime, workType, hoursWorked, earnedAmount }
     */
    async migrateOldData() {
        await this.ensureReady();
        console.log('[Migration] Starting labour data migration...');

        const results = {
            attendanceMigrated: 0,
            paymentsMigrated: 0,
            errors: []
        };

        try {
            // Get all old data
            const oldAttendance = await Storage.workerAttendance.getAll();
            const oldPayments = await Storage.workerPayments.getAll();
            const assignments = await Storage.workerAssignments.getAll();
            const workers = await Storage.workers.getAll();
            const projects = await Storage.projects.getAll();

            // Create lookup maps
            const workerMap = new Map(workers.map(w => [w.id, w]));
            const projectMap = new Map(projects.map(p => [p.id, p]));
            const assignmentMap = new Map();
            assignments.forEach(a => {
                const key = `${a.workerId}_${a.projectId}`;
                assignmentMap.set(key, a);
            });

            // Migrate attendance records to work entries
            console.log(`[Migration] Migrating ${oldAttendance.length} attendance records...`);
            for (const attendance of oldAttendance) {
                try {
                    // Skip absent days - no work entry needed
                    if (attendance.status === 'absent') continue;

                    const worker = workerMap.get(attendance.workerId);
                    const project = projectMap.get(attendance.projectId);
                    const assignment = assignmentMap.get(`${attendance.workerId}_${attendance.projectId}`);

                    if (!worker || !project) {
                        console.warn(`[Migration] Skipping attendance - missing worker or project:`, attendance);
                        continue;
                    }

                    // Calculate hours based on status
                    let hoursWorked = attendance.hoursWorked || 8;
                    if (attendance.status === 'half-day') {
                        hoursWorked = 4;
                    }

                    // Get daily wage from assignment or worker
                    const dailyWage = assignment?.dailyWage || worker.dailyWage || 500;
                    const hourlyRate = dailyWage / 8;
                    const earnedAmount = hoursWorked * hourlyRate;

                    // Determine work type from worker role
                    const workType = worker.role || assignment?.role || 'General';

                    // Create work entry
                    const workEntry = {
                        labourId: attendance.workerId,
                        labourName: worker.name,
                        projectId: attendance.projectId,
                        projectName: project.name,
                        workType: workType,
                        date: attendance.date,
                        startTime: '09:00',
                        endTime: attendance.status === 'half-day' ? '13:00' : '17:00',
                        hoursWorked: hoursWorked,
                        hourlyRate: hourlyRate,
                        earnedAmount: earnedAmount,
                        notes: `Migrated from old attendance (${attendance.status})`,
                        isImmutable: true,
                        migratedFrom: 'worker_attendance',
                        originalId: attendance.id
                    };

                    // Check if already migrated
                    const existing = await Storage.workEntries.getAll();
                    const alreadyMigrated = existing.some(e =>
                        e.migratedFrom === 'worker_attendance' && e.originalId === attendance.id
                    );

                    if (!alreadyMigrated) {
                        await Storage.workEntries.add(workEntry);
                        results.attendanceMigrated++;
                    }
                } catch (err) {
                    console.error('[Migration] Error migrating attendance:', err);
                    results.errors.push({ type: 'attendance', id: attendance.id, error: err.message });
                }
            }

            // Migrate old payments to new labour_payments format
            console.log(`[Migration] Migrating ${oldPayments.length} payment records...`);
            for (const payment of oldPayments) {
                try {
                    const worker = workerMap.get(payment.workerId);
                    const project = projectMap.get(payment.projectId);

                    if (!worker || !project) {
                        console.warn(`[Migration] Skipping payment - missing worker or project:`, payment);
                        continue;
                    }

                    const paymentRecord = {
                        labourId: payment.workerId,
                        labourName: worker.name,
                        projectId: payment.projectId,
                        projectName: project.name,
                        amount: parseFloat(payment.amount) || 0,
                        paymentDate: payment.date || payment.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                        paymentMethod: payment.paymentMode || payment.paymentMethod || 'Cash',
                        notes: payment.notes || `Migrated from old payment system`,
                        migratedFrom: 'worker_payments',
                        originalId: payment.id
                    };

                    // Check if already migrated
                    const existing = await Storage.labourPayments.getAll();
                    const alreadyMigrated = existing.some(p =>
                        p.migratedFrom === 'worker_payments' && p.originalId === payment.id
                    );

                    if (!alreadyMigrated) {
                        await Storage.labourPayments.add(paymentRecord);
                        results.paymentsMigrated++;
                    }
                } catch (err) {
                    console.error('[Migration] Error migrating payment:', err);
                    results.errors.push({ type: 'payment', id: payment.id, error: err.message });
                }
            }

            // Mark migration as complete
            localStorage.setItem('labour_data_migrated', 'true');
            localStorage.setItem('labour_migration_date', new Date().toISOString());

            console.log('[Migration] Migration complete:', results);
            return results;

        } catch (error) {
            console.error('[Migration] Migration failed:', error);
            throw error;
        }
    },

    /**
     * Get combined labour summary for a project (includes both old and new data)
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    async getProjectLabourSummary(projectId) {
        await this.ensureReady();

        try {
            // Get work entries for this project
            const workEntries = await Storage.workEntries.getByProject(projectId) || [];
            const payments = await Storage.labourPayments.getByProject(projectId) || [];

            // Group by worker
            const workerMap = new Map();

            workEntries.forEach(entry => {
                if (!entry || !entry.labourId) return;

                if (!workerMap.has(entry.labourId)) {
                    workerMap.set(entry.labourId, {
                        labourId: entry.labourId,
                        labourName: entry.labourName || 'Unknown',
                        workType: entry.workType || 'General',
                        totalHours: 0,
                        totalEarned: 0,
                        totalPaid: 0,
                        daysWorked: new Set(),
                        // Track work entries by date with earnings
                        workDates: new Map() // date -> { earned, hours, workType }
                    });
                }
                const worker = workerMap.get(entry.labourId);
                worker.totalHours += entry.hoursWorked || 0;
                worker.totalEarned += entry.earnedAmount || 0;
                if (entry.date) worker.daysWorked.add(entry.date);

                // Track earnings per date
                if (entry.date) {
                    if (!worker.workDates.has(entry.date)) {
                        worker.workDates.set(entry.date, {
                            date: entry.date,
                            earned: 0,
                            hours: 0,
                            workType: entry.workType || 'General',
                            paid: 0
                        });
                    }
                    const dateEntry = worker.workDates.get(entry.date);
                    dateEntry.earned += entry.earnedAmount || 0;
                    dateEntry.hours += entry.hoursWorked || 0;
                }
            });

            // Add payments to workers
            payments.forEach(payment => {
                if (!payment || !payment.labourId) return;

                if (workerMap.has(payment.labourId)) {
                    const worker = workerMap.get(payment.labourId);
                    worker.totalPaid += payment.amount || 0;
                }
            });

            // Convert to array and calculate dues with date details
            const workers = Array.from(workerMap.values()).map(w => {
                // Convert workDates map to array and sort by date
                const workDatesArray = Array.from(w.workDates.values()).sort((a, b) =>
                    (a.date || '').localeCompare(b.date || '')
                );

                // Calculate which dates are paid/unpaid based on cumulative earnings vs payments
                let remainingPayment = w.totalPaid || 0;
                const paidDates = [];
                const unpaidDates = [];

                workDatesArray.forEach(dateEntry => {
                    const earned = dateEntry.earned || 0;

                    if (remainingPayment >= earned) {
                        // This date is fully paid
                        remainingPayment -= earned;
                        paidDates.push({
                            date: dateEntry.date,
                            earned: earned,
                            hours: dateEntry.hours || 0,
                            workType: dateEntry.workType || 'General',
                            status: 'paid'
                        });
                    } else if (remainingPayment > 0) {
                        // Partially paid
                        const paidAmount = remainingPayment;
                        const unpaidAmount = earned - remainingPayment;
                        remainingPayment = 0;
                        unpaidDates.push({
                            date: dateEntry.date,
                            earned: earned,
                            hours: dateEntry.hours || 0,
                            workType: dateEntry.workType || 'General',
                            paidAmount: paidAmount,
                            unpaidAmount: unpaidAmount,
                            status: 'partial'
                        });
                    } else {
                        // Fully unpaid
                        unpaidDates.push({
                            date: dateEntry.date,
                            earned: earned,
                            hours: dateEntry.hours || 0,
                            workType: dateEntry.workType || 'General',
                            unpaidAmount: earned,
                            status: 'unpaid'
                        });
                    }
                });

                return {
                    labourId: w.labourId,
                    labourName: w.labourName || 'Unknown',
                    workType: w.workType || 'General',
                    totalHours: w.totalHours || 0,
                    totalEarned: w.totalEarned || 0,
                    totalPaid: w.totalPaid || 0,
                    daysWorked: w.daysWorked.size,
                    totalDue: Math.round(((w.totalEarned || 0) - (w.totalPaid || 0)) * 100) / 100,
                    status: (w.totalEarned || 0) <= (w.totalPaid || 0) ? 'paid' : 'unpaid',
                    // Date details
                    allDates: workDatesArray,
                    paidDates: paidDates,
                    unpaidDates: unpaidDates,
                    paidDaysCount: paidDates.length,
                    unpaidDaysCount: unpaidDates.length
                };
            });

            // Calculate totals
            const totals = {
                totalWorkers: workers.length,
                totalEarned: workers.reduce((sum, w) => sum + (w.totalEarned || 0), 0),
                totalPaid: workers.reduce((sum, w) => sum + (w.totalPaid || 0), 0),
                totalDue: workers.reduce((sum, w) => sum + (w.totalDue || 0), 0)
            };

            return { workers, totals };
        } catch (error) {
            console.error('[LabourCalendar] Error in getProjectLabourSummary:', error);
            // Return empty result instead of throwing
            return {
                workers: [],
                totals: { totalWorkers: 0, totalEarned: 0, totalPaid: 0, totalDue: 0 }
            };
        }
    },

    /**
     * Get all projects a worker has worked on (auto-detect from work entries)
     * @param {string} labourId
     * @returns {Promise<Object>} - { projects: Array, totalProjects: number, activeProjects: number }
     */
    async getWorkerProjects(labourId) {
        await this.ensureReady();

        // Get all work entries for this worker
        const workEntries = await Storage.workEntries.getByLabour(labourId);
        const payments = await Storage.labourPayments.getByLabour(labourId);

        // Also check worker assignments (for assigned but not yet worked)
        const assignments = await Storage.workerAssignments.getByWorker(labourId);

        // Group by project
        const projectMap = new Map();

        // Add projects from work entries
        workEntries.forEach(entry => {
            if (!projectMap.has(entry.projectId)) {
                projectMap.set(entry.projectId, {
                    projectId: entry.projectId,
                    projectName: entry.projectName,
                    totalHours: 0,
                    totalEarned: 0,
                    totalPaid: 0,
                    daysWorked: new Set(),
                    lastWorkDate: null,
                    source: 'work_entry'
                });
            }
            const proj = projectMap.get(entry.projectId);
            proj.totalHours += entry.hoursWorked || 0;
            proj.totalEarned += entry.earnedAmount || 0;
            proj.daysWorked.add(entry.date);
            if (!proj.lastWorkDate || entry.date > proj.lastWorkDate) {
                proj.lastWorkDate = entry.date;
            }
        });

        // Add payments to projects
        payments.forEach(payment => {
            if (projectMap.has(payment.projectId)) {
                projectMap.get(payment.projectId).totalPaid += payment.amount || 0;
            } else {
                // Payment exists but no work entry (edge case)
                projectMap.set(payment.projectId, {
                    projectId: payment.projectId,
                    projectName: payment.projectName,
                    totalHours: 0,
                    totalEarned: 0,
                    totalPaid: payment.amount || 0,
                    daysWorked: new Set(),
                    lastWorkDate: null,
                    source: 'payment_only'
                });
            }
        });

        // Add assigned projects (even if no work yet)
        for (const assignment of assignments) {
            if (!projectMap.has(assignment.projectId)) {
                const project = await Storage.projects.getById(assignment.projectId);
                projectMap.set(assignment.projectId, {
                    projectId: assignment.projectId,
                    projectName: project?.name || 'Unknown Project',
                    totalHours: 0,
                    totalEarned: 0,
                    totalPaid: 0,
                    daysWorked: new Set(),
                    lastWorkDate: null,
                    source: 'assignment',
                    role: assignment.role,
                    dailyWage: assignment.dailyWage
                });
            }
        }

        // Convert to array and calculate dues
        const projects = Array.from(projectMap.values()).map(p => ({
            ...p,
            daysWorked: p.daysWorked.size,
            totalDue: Math.round((p.totalEarned - p.totalPaid) * 100) / 100,
            status: p.totalEarned <= p.totalPaid ? 'paid' : (p.totalPaid > 0 ? 'partial' : 'unpaid')
        }));

        // Sort by last work date (most recent first)
        projects.sort((a, b) => {
            if (!a.lastWorkDate && !b.lastWorkDate) return 0;
            if (!a.lastWorkDate) return 1;
            if (!b.lastWorkDate) return -1;
            return b.lastWorkDate.localeCompare(a.lastWorkDate);
        });

        // Count active projects (with unpaid dues)
        const activeProjects = projects.filter(p => p.totalDue > 0).length;

        return {
            projects,
            totalProjects: projects.length,
            activeProjects,
            totalEarned: projects.reduce((sum, p) => sum + p.totalEarned, 0),
            totalPaid: projects.reduce((sum, p) => sum + p.totalPaid, 0),
            totalDue: projects.reduce((sum, p) => sum + p.totalDue, 0)
        };
    },

    /**
     * Get worker summary with all project details
     * @param {string} labourId
     * @returns {Promise<Object>}
     */
    async getWorkerFullSummary(labourId) {
        await this.ensureReady();

        const worker = await Storage.workers.getById(labourId);
        if (!worker) return null;

        const projectsData = await this.getWorkerProjects(labourId);
        const dueInfo = await this.getLabourDue(labourId);

        return {
            worker,
            ...projectsData,
            ...dueInfo
        };
    },

    // ==================== SCHEDULING & CONFLICT DETECTION ====================

    /**
     * Detect scheduling conflicts for a date (workers assigned to multiple overlapping time slots)
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<array>} - Array of conflict objects
     */
    async detectSchedulingConflicts(date) {
        await this.ensureReady();

        try {
            const workEntries = await this.getWorkEntriesByDate(date);
            const conflicts = [];

            // Group entries by worker
            const byWorker = new Map();
            workEntries.forEach(entry => {
                if (!byWorker.has(entry.labourId)) {
                    byWorker.set(entry.labourId, []);
                }
                byWorker.get(entry.labourId).push(entry);
            });

            // Check each worker for overlapping time slots
            byWorker.forEach((entries, labourId) => {
                if (entries.length < 2) return;

                // Sort by start time
                entries.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

                for (let i = 0; i < entries.length - 1; i++) {
                    for (let j = i + 1; j < entries.length; j++) {
                        const a = entries[i];
                        const b = entries[j];

                        // Check time overlap
                        if (a.endTime > b.startTime && a.startTime < b.endTime) {
                            conflicts.push({
                                labourId,
                                labourName: a.labourName,
                                date,
                                entries: [
                                    { id: a.id, project: a.projectName, time: `${a.startTime}-${a.endTime}` },
                                    { id: b.id, project: b.projectName, time: `${b.startTime}-${b.endTime}` }
                                ],
                                severity: a.projectId === b.projectId ? 'warning' : 'critical'
                            });
                        }
                    }
                }
            });

            return conflicts;
        } catch (error) {
            console.error('[LabourCalendar] Error detecting conflicts:', error);
            return [];
        }
    },

    /**
     * Suggest available workers for a date (not already scheduled)
     * @param {string} date - YYYY-MM-DD
     * @param {string} projectId - Optional project filter
     * @param {string} workType - Optional work type filter
     * @returns {Promise<array>} - Array of available workers with scores
     */
    async suggestWorkersForDate(date, projectId = null, workType = null) {
        await this.ensureReady();

        try {
            const [allWorkers, dayEntries] = await Promise.all([
                Storage.workers.getAll(),
                this.getWorkEntriesByDate(date)
            ]);

            const busyWorkerIds = new Set(dayEntries.map(e => e.labourId));

            const suggestions = [];
            for (const worker of allWorkers) {
                if (busyWorkerIds.has(worker.id)) continue;

                // Filter by work type if specified
                if (workType && worker.role !== workType && worker.workType !== workType) continue;

                // Get recent activity to score relevance
                const recentEntries = await Storage.workEntries.getByLabour(worker.id);
                const lastWork = recentEntries.length > 0
                    ? recentEntries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].date
                    : null;

                // Score: prefer workers who have worked recently and on this project
                let score = 50;
                if (lastWork) {
                    const daysSinceWork = Math.floor((new Date(date) - new Date(lastWork)) / 86400000);
                    score += Math.max(0, 30 - daysSinceWork); // Recency bonus
                }
                if (projectId) {
                    const projectEntries = recentEntries.filter(e => e.projectId === projectId);
                    score += Math.min(20, projectEntries.length * 2); // Project familiarity bonus
                }

                suggestions.push({
                    workerId: worker.id,
                    workerName: worker.name,
                    role: worker.role || worker.workType || 'General',
                    dailyWage: worker.dailyWage || 0,
                    lastWorkDate: lastWork,
                    score,
                    available: true
                });
            }

            // Sort by score (highest first)
            suggestions.sort((a, b) => b.score - a.score);
            return suggestions;
        } catch (error) {
            console.error('[LabourCalendar] Error suggesting workers:', error);
            return [];
        }
    },

    // ==================== PRODUCTIVITY ANALYTICS ====================

    /**
     * Get worker productivity analytics over a period
     * @param {string} labourId - Worker ID
     * @param {number} days - Number of days to analyze (default 30)
     * @returns {Promise<object>}
     */
    async getWorkerProductivityAnalytics(labourId, days = 30) {
        await this.ensureReady();

        try {
            const entries = await Storage.workEntries.getByLabour(labourId);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoff = cutoffDate.toISOString().split('T')[0];

            const recentEntries = entries.filter(e => e.date >= cutoff);
            const olderEntries = entries.filter(e => e.date < cutoff);

            const totalHours = recentEntries.reduce((s, e) => s + (e.hoursWorked || 0), 0);
            const totalEarned = recentEntries.reduce((s, e) => s + (e.earnedAmount || 0), 0);
            const uniqueDays = new Set(recentEntries.map(e => e.date)).size;

            const avgHoursPerDay = uniqueDays > 0 ? Math.round(totalHours / uniqueDays * 10) / 10 : 0;
            const avgEarningsPerDay = uniqueDays > 0 ? Math.round(totalEarned / uniqueDays) : 0;

            // Previous period comparison
            const prevHours = olderEntries.slice(-recentEntries.length).reduce((s, e) => s + (e.hoursWorked || 0), 0);
            const hoursTrend = prevHours > 0 ? Math.round(((totalHours - prevHours) / prevHours) * 100) : 0;

            // Daily breakdown for trend chart
            const dailyData = {};
            recentEntries.forEach(e => {
                if (!dailyData[e.date]) dailyData[e.date] = { hours: 0, earned: 0 };
                dailyData[e.date].hours += e.hoursWorked || 0;
                dailyData[e.date].earned += e.earnedAmount || 0;
            });

            return {
                labourId,
                period: `Last ${days} days`,
                totalHours: Math.round(totalHours * 10) / 10,
                totalEarned: Math.round(totalEarned),
                daysWorked: uniqueDays,
                avgHoursPerDay,
                avgEarningsPerDay,
                hoursTrend, // percentage change vs previous period
                dailyBreakdown: Object.entries(dailyData)
                    .map(([date, data]) => ({ date, ...data }))
                    .sort((a, b) => a.date.localeCompare(b.date))
            };
        } catch (error) {
            console.error('[LabourCalendar] Error getting productivity analytics:', error);
            return { labourId, totalHours: 0, totalEarned: 0, daysWorked: 0, avgHoursPerDay: 0, avgEarningsPerDay: 0, hoursTrend: 0, dailyBreakdown: [] };
        }
    },

    // ==================== BULK OPERATIONS ====================

    /**
     * Bulk mark attendance for multiple workers on a date
     * @param {string} projectId
     * @param {string} date - YYYY-MM-DD
     * @param {array} workerEntries - [{ labourId, labourName, workType, startTime, endTime }]
     * @returns {Promise<object>} - { created: number, errors: number }
     */
    async bulkMarkAttendance(projectId, date, workerEntries) {
        await this.ensureReady();

        const results = { created: 0, errors: 0 };
        const project = await Storage.projects.getById(projectId);

        for (const entry of workerEntries) {
            try {
                await this.createWorkEntry({
                    labourId: entry.labourId,
                    labourName: entry.labourName,
                    projectId,
                    projectName: project?.name || 'Unknown',
                    workType: entry.workType || 'General',
                    date,
                    startTime: entry.startTime || '09:00',
                    endTime: entry.endTime || '17:00'
                });
                results.created++;
            } catch (e) {
                console.error(`[LabourCalendar] Bulk attendance error for ${entry.labourId}:`, e);
                results.errors++;
            }
        }

        return results;
    },

    // ==================== WEEK VIEW ====================

    /**
     * Get a week summary (7 days starting from a date)
     * @param {string} startDate - YYYY-MM-DD (start of the week)
     * @returns {Promise<array>} - Array of 7 day summaries
     */
    async getWeekSummary(startDate) {
        await this.ensureReady();

        const summaries = [];
        const start = new Date(startDate);

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            try {
                const summary = await this.getDaySummary(dateStr);
                summaries.push({
                    ...summary,
                    dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
                    isToday: dateStr === new Date().toISOString().split('T')[0]
                });
            } catch (e) {
                summaries.push({
                    date: dateStr,
                    dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
                    hasActivity: false,
                    labourCount: 0,
                    totalHours: 0,
                    isToday: dateStr === new Date().toISOString().split('T')[0]
                });
            }
        }

        return summaries;
    }
};

// Make globally accessible
window.LabourCalendar = LabourCalendar;

export default LabourCalendar;
