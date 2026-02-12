// Phase Management Module
// Handles project phases, checklists, and worker assignments

import { db, auth, onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from './firebase-config.js';

// Data Structures
const PhaseStatus = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ON_HOLD: 'on_hold'
};

const ChecklistCategory = {
    FEATURES: 'features',
    SAFETY: 'safety',
    QUALITY: 'quality',
    MATERIALS: 'materials',
    APPROVAL: 'approval',
    CUSTOM: 'custom'
};

// Phase object structure
// {
//   id: string,
//   projectId: string,
//   name: string,
//   description: string,
//   order: number,
//   status: PhaseStatus,
//   plannedStartDate: timestamp,
//   plannedEndDate: timestamp,
//   actualStartDate: timestamp,
//   actualEndDate: timestamp,
//   completionPercentage: number,
//   createdAt: timestamp,
//   updatedAt: timestamp
// }

// Checklist Item structure
// {
//   id: string,
//   phaseId: string,
//   projectId: string,
//   category: ChecklistCategory,
//   name: string,
//   isCompleted: boolean,
//   isRequired: boolean,
//   completedAt: timestamp,
//   completedBy: string,
//   order: number
// }

// Worker Assignment structure
// {
//   id: string,
//   phaseId: string,
//   projectId: string,
//   workerId: string,
//   workerName: string,
//   workType: string,
//   startDate: timestamp,
//   endDate: timestamp,
//   hoursWorked: number,
//   notes: string
// }

// Collection names
const COLLECTIONS = {
    PHASES: 'phases',
    PHASE_CHECKLISTS: 'phase_checklists',
    PHASE_WORKERS: 'phase_workers'
};

// Auth state tracking
let currentUserId = null;
let authReady = false;
let authReadyResolve = null;
const authReadyPromise = new Promise(resolve => { authReadyResolve = resolve; });

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    currentUserId = user ? user.uid : null;
    if (!authReady) {
        authReady = true;
        authReadyResolve();
    }
});

// Wait for auth to be ready
async function waitForAuth() {
    if (!authReady) {
        await authReadyPromise;
    }
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Get current user ID
function getUserId() {
    if (!currentUserId) {
        // Try to get from localStorage as fallback
        const storedId = localStorage.getItem('userId');
        if (storedId) return storedId;
        throw new Error('User not authenticated');
    }
    return currentUserId;
}

const PhaseManager = {
    // ==================== PHASE CRUD ====================

    /**
     * Create a new phase for a project
     * @param {string} projectId - The project ID
     * @param {object} phaseData - Phase data (name, description, dates)
     * @returns {Promise<object>} - Created phase
     */
    async createPhase(projectId, phaseData) {
        try {
            await waitForAuth();
            const userId = getUserId();

            // Get existing phases to calculate order
            const existingPhases = await this.getPhases(projectId);
            const maxOrder = existingPhases.reduce((max, p) => Math.max(max, p.order || 0), -1);

            // Check for duplicate name and append suffix if needed
            let phaseName = phaseData.name || 'New Phase';
            const existingNames = existingPhases.map(p => p.name.toLowerCase());
            if (existingNames.includes(phaseName.toLowerCase())) {
                let suffix = 1;
                while (existingNames.includes(`${phaseName.toLowerCase()} ${suffix}`)) {
                    suffix++;
                }
                phaseName = `${phaseName} ${suffix}`;
            }

            const id = generateId();
            const phase = {
                id,
                projectId,
                userId,
                name: phaseName,
                description: phaseData.description || '',
                order: maxOrder + 1,
                status: PhaseStatus.NOT_STARTED,
                plannedStartDate: phaseData.plannedStartDate || null,
                plannedEndDate: phaseData.plannedEndDate || null,
                actualStartDate: null,
                actualEndDate: null,
                completionPercentage: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = doc(db, COLLECTIONS.PHASES, id);
            await setDoc(docRef, phase);

            console.log('[PhaseManager] Created phase:', phase);
            return phase;
        } catch (error) {
            console.error('[PhaseManager] Error creating phase:', error);
            throw error;
        }
    },

    /**
     * Update an existing phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>} - Updated phase
     */
    async updatePhase(projectId, phaseId, updates) {
        try {
            await waitForAuth();
            const docRef = doc(db, COLLECTIONS.PHASES, phaseId);
            const updateData = {
                ...updates,
                updatedAt: new Date().toISOString()
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) delete updateData[key];
            });

            await updateDoc(docRef, updateData);

            console.log('[PhaseManager] Updated phase:', phaseId, updateData);
            return { id: phaseId, ...updateData };
        } catch (error) {
            console.error('[PhaseManager] Error updating phase:', error);
            throw error;
        }
    },

    /**
     * Delete a phase and all associated data
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<void>}
     */
    async deletePhase(projectId, phaseId) {
        try {
            await waitForAuth();
            // Delete all checklist items for this phase
            const checklists = await this.getChecklistItems(projectId, phaseId);
            for (const item of checklists) {
                await deleteDoc(doc(db, COLLECTIONS.PHASE_CHECKLISTS, item.id));
            }

            // Delete all worker assignments for this phase
            const workers = await this.getPhaseWorkers(projectId, phaseId);
            for (const assignment of workers) {
                await deleteDoc(doc(db, COLLECTIONS.PHASE_WORKERS, assignment.id));
            }

            // Delete the phase itself
            await deleteDoc(doc(db, COLLECTIONS.PHASES, phaseId));

            // Reorder remaining phases
            const remainingPhases = await this.getPhases(projectId);
            await this.normalizePhaseOrder(projectId, remainingPhases.map(p => p.id));

            console.log('[PhaseManager] Deleted phase:', phaseId);
        } catch (error) {
            console.error('[PhaseManager] Error deleting phase:', error);
            throw error;
        }
    },

    /**
     * Get all phases for a project
     * @param {string} projectId - The project ID
     * @returns {Promise<array>} - Array of phases sorted by order
     */
    async getPhases(projectId) {
        try {
            await waitForAuth();
            const userId = getUserId();
            const q = query(
                collection(db, COLLECTIONS.PHASES),
                where('projectId', '==', projectId),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            const phases = [];
            snapshot.forEach(doc => {
                phases.push({ id: doc.id, ...doc.data() });
            });

            // Sort by order
            phases.sort((a, b) => (a.order || 0) - (b.order || 0));

            return phases;
        } catch (error) {
            console.error('[PhaseManager] Error getting phases:', error);
            return [];
        }
    },

    /**
     * Get a single phase by ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<object|null>} - Phase or null
     */
    async getPhaseById(phaseId) {
        try {
            await waitForAuth();
            const docRef = doc(db, COLLECTIONS.PHASES, phaseId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('[PhaseManager] Error getting phase:', error);
            return null;
        }
    },

    /**
     * Reorder phases
     * @param {string} projectId - The project ID
     * @param {array} phaseIds - Array of phase IDs in new order
     * @returns {Promise<void>}
     */
    async reorderPhases(projectId, phaseIds) {
        try {
            await waitForAuth();
            await this.normalizePhaseOrder(projectId, phaseIds);
            console.log('[PhaseManager] Reordered phases:', phaseIds);
        } catch (error) {
            console.error('[PhaseManager] Error reordering phases:', error);
            throw error;
        }
    },

    /**
     * Normalize phase order values to be sequential (0, 1, 2, ...)
     * @param {string} projectId - The project ID
     * @param {array} phaseIds - Array of phase IDs in desired order
     * @returns {Promise<void>}
     */
    async normalizePhaseOrder(projectId, phaseIds) {
        await waitForAuth();
        const updates = phaseIds.map((id, index) => {
            return updateDoc(doc(db, COLLECTIONS.PHASES, id), {
                order: index,
                updatedAt: new Date().toISOString()
            });
        });
        await Promise.all(updates);
    },

    // ==================== CHECKLIST OPERATIONS ====================

    /**
     * Add a checklist item to a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {object} item - Checklist item data
     * @returns {Promise<object>} - Created checklist item
     */
    async addChecklistItem(projectId, phaseId, item) {
        try {
            await waitForAuth();
            const userId = getUserId();

            // Get existing items to calculate order
            const existingItems = await this.getChecklistItems(projectId, phaseId, item.category);
            const maxOrder = existingItems.reduce((max, i) => Math.max(max, i.order || 0), -1);

            const id = generateId();
            const checklistItem = {
                id,
                phaseId,
                projectId,
                userId,
                category: item.category || ChecklistCategory.FEATURES,
                name: item.name,
                isCompleted: false,
                isRequired: item.isRequired || false,
                completedAt: null,
                completedBy: null,
                order: maxOrder + 1,
                // Enhanced task fields
                priority: item.priority || 'normal',      // normal, high, critical
                assignedTo: item.assignedTo || null,        // worker ID
                dueDate: item.dueDate || null,              // YYYY-MM-DD
                dependsOn: item.dependsOn || [],            // array of checklist item IDs
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = doc(db, COLLECTIONS.PHASE_CHECKLISTS, id);
            await setDoc(docRef, checklistItem);

            // Recalculate phase completion
            await this.recalculatePhaseCompletion(projectId, phaseId);

            console.log('[PhaseManager] Added checklist item:', checklistItem);
            return checklistItem;
        } catch (error) {
            console.error('[PhaseManager] Error adding checklist item:', error);
            throw error;
        }
    },

    /**
     * Update a checklist item
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} itemId - The checklist item ID
     * @param {object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateChecklistItem(projectId, phaseId, itemId, updates) {
        try {
            await waitForAuth();
            const docRef = doc(db, COLLECTIONS.PHASE_CHECKLISTS, itemId);
            const updateData = {
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(docRef, updateData);

            // Recalculate phase completion if status changed
            if ('isCompleted' in updates) {
                await this.recalculatePhaseCompletion(projectId, phaseId);
            }

            console.log('[PhaseManager] Updated checklist item:', itemId);
        } catch (error) {
            console.error('[PhaseManager] Error updating checklist item:', error);
            throw error;
        }
    },

    /**
     * Toggle checklist item completion status
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} itemId - The checklist item ID
     * @returns {Promise<boolean>} - New completion status
     */
    async toggleChecklistItem(projectId, phaseId, itemId) {
        try {
            await waitForAuth();
            const docRef = doc(db, COLLECTIONS.PHASE_CHECKLISTS, itemId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error('Checklist item not found');
            }

            const item = docSnap.data();
            const newStatus = !item.isCompleted;
            const userId = getUserId();

            const updateData = {
                isCompleted: newStatus,
                completedAt: newStatus ? new Date().toISOString() : null,
                completedBy: newStatus ? userId : null,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(docRef, updateData);

            // Recalculate phase completion
            await this.recalculatePhaseCompletion(projectId, phaseId);

            console.log('[PhaseManager] Toggled checklist item:', itemId, 'to', newStatus);
            return newStatus;
        } catch (error) {
            console.error('[PhaseManager] Error toggling checklist item:', error);
            throw error;
        }
    },

    /**
     * Delete a checklist item
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} itemId - The checklist item ID
     * @returns {Promise<void>}
     */
    async deleteChecklistItem(projectId, phaseId, itemId) {
        try {
            await waitForAuth();
            await deleteDoc(doc(db, COLLECTIONS.PHASE_CHECKLISTS, itemId));

            // Recalculate phase completion
            await this.recalculatePhaseCompletion(projectId, phaseId);

            console.log('[PhaseManager] Deleted checklist item:', itemId);
        } catch (error) {
            console.error('[PhaseManager] Error deleting checklist item:', error);
            throw error;
        }
    },

    /**
     * Get all checklist items for a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} category - Optional category filter
     * @returns {Promise<array>} - Array of checklist items
     */
    async getChecklistItems(projectId, phaseId, category = null) {
        try {
            await waitForAuth();
            const userId = getUserId();
            let q = query(
                collection(db, COLLECTIONS.PHASE_CHECKLISTS),
                where('phaseId', '==', phaseId),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            let items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });

            // Filter by category if specified
            if (category) {
                items = items.filter(item => item.category === category);
            }

            // Sort by order
            items.sort((a, b) => (a.order || 0) - (b.order || 0));

            return items;
        } catch (error) {
            console.error('[PhaseManager] Error getting checklist items:', error);
            return [];
        }
    },

    // ==================== COMPLETION LOGIC ====================

    /**
     * Calculate completion percentage for a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<number>} - Completion percentage (0-100)
     */
    async calculateCompletion(projectId, phaseId) {
        try {
            const items = await this.getChecklistItems(projectId, phaseId);

            if (items.length === 0) {
                return 0;
            }

            const completedCount = items.filter(item => item.isCompleted).length;
            const percentage = Math.round((completedCount / items.length) * 100);

            return percentage;
        } catch (error) {
            console.error('[PhaseManager] Error calculating completion:', error);
            return 0;
        }
    },

    /**
     * Recalculate and update phase completion percentage
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<number>} - New completion percentage
     */
    async recalculatePhaseCompletion(projectId, phaseId) {
        const percentage = await this.calculateCompletion(projectId, phaseId);
        await this.updatePhase(projectId, phaseId, { completionPercentage: percentage });

        // Auto-trigger project-level progress recalculation
        this.recalculateProjectProgress(projectId).catch(e =>
            console.warn('[PhaseManager] Background project progress update failed:', e)
        );

        return percentage;
    },

    /**
     * Check if a phase can be completed
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<object>} - { canComplete: boolean, blockers: string[] }
     */
    async canCompletePhase(projectId, phaseId) {
        try {
            const items = await this.getChecklistItems(projectId, phaseId);
            const requiredItems = items.filter(item => item.isRequired);
            const incompleteRequired = requiredItems.filter(item => !item.isCompleted);

            if (incompleteRequired.length > 0) {
                return {
                    canComplete: false,
                    blockers: incompleteRequired.map(item => item.name)
                };
            }

            return { canComplete: true, blockers: [] };
        } catch (error) {
            console.error('[PhaseManager] Error checking phase completion:', error);
            return { canComplete: false, blockers: ['Error checking completion status'] };
        }
    },

    /**
     * Complete a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} reason - Optional reason for manual completion
     * @returns {Promise<void>}
     */
    async completePhase(projectId, phaseId, reason = null) {
        try {
            const { canComplete, blockers } = await this.canCompletePhase(projectId, phaseId);

            if (!canComplete && !reason) {
                throw new Error(`Cannot complete phase. Blockers: ${blockers.join(', ')}`);
            }

            const updateData = {
                status: PhaseStatus.COMPLETED,
                actualEndDate: new Date().toISOString(),
                completionPercentage: 100
            };

            if (reason) {
                updateData.manualCompletionReason = reason;
            }

            await this.updatePhase(projectId, phaseId, updateData);

            console.log('[PhaseManager] Completed phase:', phaseId);
        } catch (error) {
            console.error('[PhaseManager] Error completing phase:', error);
            throw error;
        }
    },

    /**
     * Start a phase (set to in progress)
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<void>}
     */
    async startPhase(projectId, phaseId) {
        try {
            await this.updatePhase(projectId, phaseId, {
                status: PhaseStatus.IN_PROGRESS,
                actualStartDate: new Date().toISOString()
            });

            console.log('[PhaseManager] Started phase:', phaseId);
        } catch (error) {
            console.error('[PhaseManager] Error starting phase:', error);
            throw error;
        }
    },

    /**
     * Put a phase on hold
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<void>}
     */
    async holdPhase(projectId, phaseId) {
        try {
            await this.updatePhase(projectId, phaseId, {
                status: PhaseStatus.ON_HOLD
            });

            console.log('[PhaseManager] Put phase on hold:', phaseId);
        } catch (error) {
            console.error('[PhaseManager] Error holding phase:', error);
            throw error;
        }
    },

    // ==================== WORKER ASSIGNMENTS ====================

    /**
     * Assign a worker to a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {object} assignment - Worker assignment data
     * @returns {Promise<object>} - Created assignment
     */
    async assignWorker(projectId, phaseId, assignment) {
        try {
            await waitForAuth();
            const userId = getUserId();

            const id = generateId();
            const workerAssignment = {
                id,
                phaseId,
                projectId,
                userId,
                workerId: assignment.workerId,
                workerName: assignment.workerName,
                workType: assignment.workType,
                startDate: assignment.startDate || null,
                endDate: assignment.endDate || null,
                hoursWorked: assignment.hoursWorked || 0,
                notes: assignment.notes || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = doc(db, COLLECTIONS.PHASE_WORKERS, id);
            await setDoc(docRef, workerAssignment);

            console.log('[PhaseManager] Assigned worker:', workerAssignment);
            return workerAssignment;
        } catch (error) {
            console.error('[PhaseManager] Error assigning worker:', error);
            throw error;
        }
    },

    /**
     * Update a worker assignment
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} assignmentId - The assignment ID
     * @param {object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateWorkerAssignment(projectId, phaseId, assignmentId, updates) {
        try {
            await waitForAuth();
            const docRef = doc(db, COLLECTIONS.PHASE_WORKERS, assignmentId);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });

            console.log('[PhaseManager] Updated worker assignment:', assignmentId);
        } catch (error) {
            console.error('[PhaseManager] Error updating worker assignment:', error);
            throw error;
        }
    },

    /**
     * Remove a worker assignment
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @param {string} assignmentId - The assignment ID
     * @returns {Promise<void>}
     */
    async removeWorkerAssignment(projectId, phaseId, assignmentId) {
        try {
            await waitForAuth();
            await deleteDoc(doc(db, COLLECTIONS.PHASE_WORKERS, assignmentId));
            console.log('[PhaseManager] Removed worker assignment:', assignmentId);
        } catch (error) {
            console.error('[PhaseManager] Error removing worker assignment:', error);
            throw error;
        }
    },

    /**
     * Get all worker assignments for a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<array>} - Array of worker assignments
     */
    async getPhaseWorkers(projectId, phaseId) {
        try {
            await waitForAuth();
            const userId = getUserId();
            const q = query(
                collection(db, COLLECTIONS.PHASE_WORKERS),
                where('phaseId', '==', phaseId),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            const assignments = [];
            snapshot.forEach(doc => {
                assignments.push({ id: doc.id, ...doc.data() });
            });

            return assignments;
        } catch (error) {
            console.error('[PhaseManager] Error getting phase workers:', error);
            return [];
        }
    },

    /**
     * Get labour summary for a phase
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<object>} - Labour summary
     */
    async getPhaseLabourSummary(projectId, phaseId) {
        try {
            const assignments = await this.getPhaseWorkers(projectId, phaseId);

            // Group by worker
            const byWorker = {};
            assignments.forEach(a => {
                if (!byWorker[a.workerId]) {
                    byWorker[a.workerId] = {
                        workerId: a.workerId,
                        workerName: a.workerName,
                        totalHours: 0,
                        workTypes: []
                    };
                }
                byWorker[a.workerId].totalHours += a.hoursWorked || 0;
                if (!byWorker[a.workerId].workTypes.includes(a.workType)) {
                    byWorker[a.workerId].workTypes.push(a.workType);
                }
            });

            // Group by work type
            const byWorkType = {};
            assignments.forEach(a => {
                if (!byWorkType[a.workType]) {
                    byWorkType[a.workType] = {
                        workType: a.workType,
                        totalHours: 0,
                        workerCount: 0
                    };
                }
                byWorkType[a.workType].totalHours += a.hoursWorked || 0;
            });

            // Count unique workers per work type
            Object.keys(byWorkType).forEach(wt => {
                const uniqueWorkers = new Set(
                    assignments.filter(a => a.workType === wt).map(a => a.workerId)
                );
                byWorkType[wt].workerCount = uniqueWorkers.size;
            });

            return {
                totalAssignments: assignments.length,
                totalHours: assignments.reduce((sum, a) => sum + (a.hoursWorked || 0), 0),
                byWorker: Object.values(byWorker),
                byWorkType: Object.values(byWorkType)
            };
        } catch (error) {
            console.error('[PhaseManager] Error getting labour summary:', error);
            return {
                totalAssignments: 0,
                totalHours: 0,
                byWorker: [],
                byWorkType: []
            };
        }
    },

    // ==================== UTILITY METHODS ====================

    /**
     * Get the currently active phase for a project
     * @param {string} projectId - The project ID
     * @returns {Promise<object|null>} - Active phase or null
     */
    async getActivePhase(projectId) {
        try {
            const phases = await this.getPhases(projectId);
            return phases.find(p => p.status === PhaseStatus.IN_PROGRESS) || null;
        } catch (error) {
            console.error('[PhaseManager] Error getting active phase:', error);
            return null;
        }
    },

    /**
     * Get phase by date (which phase was active on a given date)
     * @param {string} projectId - The project ID
     * @param {string} date - Date string (YYYY-MM-DD)
     * @returns {Promise<object|null>} - Phase active on that date or null
     */
    async getPhaseByDate(projectId, date) {
        try {
            const phases = await this.getPhases(projectId);
            const targetDate = new Date(date);

            for (const phase of phases) {
                const startDate = phase.actualStartDate ? new Date(phase.actualStartDate) : null;
                const endDate = phase.actualEndDate ? new Date(phase.actualEndDate) : null;

                if (startDate && targetDate >= startDate) {
                    if (!endDate || targetDate <= endDate) {
                        return phase;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('[PhaseManager] Error getting phase by date:', error);
            return null;
        }
    },

    /**
     * Delete all phases for a project (used when deleting a project)
     * @param {string} projectId - The project ID
     * @returns {Promise<void>}
     */
    async deleteAllPhasesForProject(projectId) {
        try {
            const phases = await this.getPhases(projectId);

            for (const phase of phases) {
                await this.deletePhase(projectId, phase.id);
            }

            console.log('[PhaseManager] Deleted all phases for project:', projectId);
        } catch (error) {
            console.error('[PhaseManager] Error deleting all phases:', error);
            throw error;
        }
    },

    // ==================== AUTO-PROGRESS & ANALYTICS ====================

    /**
     * Recalculate overall project progress from phase completions (weighted)
     * @param {string} projectId - The project ID
     * @returns {Promise<number>} - Overall progress 0-100
     */
    async recalculateProjectProgress(projectId) {
        try {
            const phases = await this.getPhases(projectId);

            if (phases.length === 0) return 0;

            // Each phase has equal weight by default; use 'weight' field if set
            let totalWeight = 0;
            let weightedProgress = 0;

            for (const phase of phases) {
                const weight = parseFloat(phase.weight) || 1;
                totalWeight += weight;
                weightedProgress += (phase.completionPercentage || 0) * weight;
            }

            const progress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

            // Update project progress in Firestore
            try {
                const Storage = (await import('./firebase-storage.js')).default;
                await Storage.projects.update(projectId, {
                    calculatedProgress: progress,
                    lastProgressUpdate: new Date().toISOString()
                });
            } catch (e) {
                console.warn('[PhaseManager] Could not update project progress:', e);
            }

            console.log(`[PhaseManager] Project ${projectId} progress: ${progress}%`);
            return progress;
        } catch (error) {
            console.error('[PhaseManager] Error calculating project progress:', error);
            return 0;
        }
    },

    /**
     * Get overdue phases for a project
     * @param {string} projectId - The project ID
     * @returns {Promise<array>} - Array of overdue phases
     */
    async getOverduePhases(projectId) {
        try {
            const phases = await this.getPhases(projectId);
            const today = new Date().toISOString().split('T')[0];

            return phases.filter(phase => {
                if (phase.status === PhaseStatus.COMPLETED) return false;
                if (!phase.plannedEndDate) return false;
                return phase.plannedEndDate < today && (phase.completionPercentage || 0) < 100;
            });
        } catch (error) {
            console.error('[PhaseManager] Error getting overdue phases:', error);
            return [];
        }
    },

    /**
     * Get overdue tasks across all phases in a project
     * @param {string} projectId - The project ID
     * @returns {Promise<array>} - Array of overdue checklist items with phase info
     */
    async getOverdueTasks(projectId) {
        try {
            const phases = await this.getPhases(projectId);
            const today = new Date().toISOString().split('T')[0];
            const overdue = [];

            for (const phase of phases) {
                const items = await this.getChecklistItems(projectId, phase.id);
                items.forEach(item => {
                    if (!item.isCompleted && item.dueDate && item.dueDate < today) {
                        overdue.push({
                            ...item,
                            phaseName: phase.name,
                            phaseId: phase.id
                        });
                    }
                });
            }

            return overdue;
        } catch (error) {
            console.error('[PhaseManager] Error getting overdue tasks:', error);
            return [];
        }
    },

    /**
     * Get blocked checklist items (items whose dependencies aren't met)
     * @param {string} projectId - The project ID
     * @param {string} phaseId - The phase ID
     * @returns {Promise<array>} - Array of blocked items
     */
    async getBlockedItems(projectId, phaseId) {
        try {
            const items = await this.getChecklistItems(projectId, phaseId);
            const completedIds = new Set(items.filter(i => i.isCompleted).map(i => i.id));

            return items.filter(item => {
                if (item.isCompleted) return false;
                if (!item.dependsOn || item.dependsOn.length === 0) return false;
                return item.dependsOn.some(depId => !completedIds.has(depId));
            });
        } catch (error) {
            console.error('[PhaseManager] Error getting blocked items:', error);
            return [];
        }
    },

    /**
     * Get comprehensive project health summary from phases
     * @param {string} projectId - The project ID
     * @returns {Promise<object>}
     */
    async getProjectHealthSummary(projectId) {
        try {
            const phases = await this.getPhases(projectId);
            const overduePhases = await this.getOverduePhases(projectId);
            const overdueTasks = await this.getOverdueTasks(projectId);

            let totalItems = 0;
            let completedItems = 0;
            let criticalPending = 0;
            let blockedItems = [];

            for (const phase of phases) {
                const items = await this.getChecklistItems(projectId, phase.id);
                totalItems += items.length;
                completedItems += items.filter(i => i.isCompleted).length;
                criticalPending += items.filter(i => i.priority === 'critical' && !i.isCompleted).length;

                const blocked = await this.getBlockedItems(projectId, phase.id);
                blockedItems.push(...blocked);
            }

            // Calculate Score
            let score = 100;
            const risks = [];

            // 1. Overdue Phases (-15 each)
            if (overduePhases.length > 0) {
                const deduction = overduePhases.length * 15;
                score -= deduction;
                risks.push({ type: 'overdue_phase', count: overduePhases.length, deduction, message: `${overduePhases.length} phase(s) overdue` });
            }

            // 2. Critical Pending (-10 each)
            if (criticalPending > 0) {
                const deduction = criticalPending * 10;
                score -= deduction;
                risks.push({ type: 'critical_task', count: criticalPending, deduction, message: `${criticalPending} critical task(s) pending` });
            }

            // 3. Overdue Tasks (-5 each)
            if (overdueTasks.length > 0) {
                const deduction = overdueTasks.length * 5;
                score -= deduction;
                risks.push({ type: 'overdue_task', count: overdueTasks.length, deduction, message: `${overdueTasks.length} task(s) overdue` });
            }

            // 4. Blocked Tasks (-5 each)
            if (blockedItems.length > 0) {
                const deduction = blockedItems.length * 5;
                score -= deduction;
                risks.push({ type: 'blocked_task', count: blockedItems.length, deduction, message: `${blockedItems.length} task(s) blocked` });
            }

            score = Math.max(0, score);

            return {
                totalPhases: phases.length,
                completedPhases: phases.filter(p => p.status === PhaseStatus.COMPLETED).length,
                inProgressPhases: phases.filter(p => p.status === PhaseStatus.IN_PROGRESS).length,
                overduePhases: overduePhases.length,
                totalTasks: totalItems,
                completedTasks: completedItems,
                criticalPending: criticalPending,
                blockedTasks: blockedItems.length,
                overallProgress: await this.recalculateProjectProgress(projectId),
                healthScore: score,
                risks: risks
            };
        } catch (error) {
            console.error('[PhaseManager] Error getting health summary:', error);
            return {
                totalPhases: 0, completedPhases: 0, inProgressPhases: 0, overduePhases: 0,
                totalTasks: 0, completedTasks: 0, criticalPending: 0, blockedTasks: 0,
                overallProgress: 0, healthScore: 100, risks: []
            };
        }
    },

    // Export constants
    PhaseStatus,
    ChecklistCategory
};

// Export for use in other modules
export default PhaseManager;
export { PhaseStatus, ChecklistCategory };
