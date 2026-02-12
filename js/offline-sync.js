// Offline Sync Module — IndexedDB queue + connectivity management
// Queues write operations when offline and replays them when back online

const DB_NAME = 'bb_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_operations';

const OfflineSync = {
    _db: null,
    _isOnline: navigator.onLine,
    _syncInProgress: false,
    _statusCallbacks: new Set(),
    _retryTimeout: null,

    // ==================== INITIALIZATION ====================

    async init() {
        // Open IndexedDB
        this._db = await this._openDB();

        // Listen for connectivity changes
        window.addEventListener('online', () => {
            this._isOnline = true;
            this._updateStatus('syncing');
            this._replayQueue();
        });

        window.addEventListener('offline', () => {
            this._isOnline = false;
            this._updateStatus('offline');
        });

        // Listen for SW sync message
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SYNC_REQUESTED') {
                    this._replayQueue();
                }
            });
        }

        // Check for pending operations on init
        const pendingCount = await this.getPendingCount();
        if (pendingCount > 0 && this._isOnline) {
            this._replayQueue();
        } else {
            this._updateStatus(this._isOnline ? 'synced' : 'offline');
        }

        // Inject status indicator into the page
        this._injectStatusBadge();

        return this;
    },

    // ==================== INDEXEDDB MANAGEMENT ====================

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'queueId', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('collection', 'collection', { unique: false });
                }
            };

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                console.error('[OfflineSync] Failed to open IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    // ==================== QUEUE OPERATIONS ====================

    // Add an operation to the offline queue
    async queueOperation(operation) {
        if (!this._db) return;

        const entry = {
            ...operation,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending'
        };

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.add(entry);
            request.onsuccess = () => {
                this._updateStatus('pending');
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Get all pending operations
    async getPendingOperations() {
        if (!this._db) return [];

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            const request = index.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    // Get count of pending operations
    async getPendingCount() {
        if (!this._db) return 0;

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Remove completed operation from queue
    async _removeFromQueue(queueId) {
        if (!this._db) return;

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(queueId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ==================== REPLAY QUEUE ====================

    async _replayQueue() {
        if (this._syncInProgress || !this._isOnline) return;
        this._syncInProgress = true;
        this._updateStatus('syncing');

        try {
            const operations = await this.getPendingOperations();

            if (operations.length === 0) {
                this._updateStatus('synced');
                this._syncInProgress = false;
                return;
            }

            console.log(`[OfflineSync] Replaying ${operations.length} queued operations...`);

            let successCount = 0;
            let failCount = 0;

            for (const op of operations) {
                try {
                    // Dynamic import to avoid circular dependency
                    const { default: Storage } = await import('./firebase-storage.js');

                    switch (op.type) {
                        case 'add':
                            await Storage.add(op.collection, op.data);
                            break;
                        case 'update':
                            await Storage.update(op.collection, op.id, op.data);
                            break;
                        case 'delete':
                            await Storage.delete(op.collection, op.id);
                            break;
                        default:
                            console.warn('[OfflineSync] Unknown operation type:', op.type);
                    }

                    await this._removeFromQueue(op.queueId);
                    successCount++;
                } catch (error) {
                    console.error(`[OfflineSync] Failed to replay operation:`, op, error);
                    failCount++;

                    // If max retries exceeded, remove it
                    if (op.retryCount >= 3) {
                        console.warn(`[OfflineSync] Max retries exceeded, removing:`, op);
                        await this._removeFromQueue(op.queueId);
                    }
                }
            }

            console.log(`[OfflineSync] Replay complete: ${successCount} success, ${failCount} failed`);

            const remaining = await this.getPendingCount();
            this._updateStatus(remaining > 0 ? 'pending' : 'synced');

            // Retry failed operations after a delay
            if (failCount > 0 && remaining > 0) {
                this._retryTimeout = setTimeout(() => this._replayQueue(), 10000);
            }
        } catch (error) {
            console.error('[OfflineSync] Replay error:', error);
            this._updateStatus('error');
        } finally {
            this._syncInProgress = false;
        }
    },

    // ==================== STATUS MANAGEMENT ====================

    // Subscribe to status changes
    onStatusChange(callback) {
        this._statusCallbacks.add(callback);
        // Immediately call with current status
        callback(this._isOnline ? 'synced' : 'offline');
        return () => this._statusCallbacks.delete(callback);
    },

    _updateStatus(status) {
        this._statusCallbacks.forEach(cb => {
            try { cb(status); } catch (e) { /* ignore */ }
        });
        this._updateBadge(status);
    },

    // ==================== UI STATUS BADGE ====================

    _injectStatusBadge() {
        // Don't inject if already exists or on login page
        if (document.getElementById('offlineSyncBadge') || window.location.pathname.includes('login')) return;

        const badge = document.createElement('div');
        badge.id = 'offlineSyncBadge';
        badge.setAttribute('role', 'status');
        badge.setAttribute('aria-live', 'polite');
        badge.innerHTML = `
            <style>
                #offlineSyncBadge {
                    position: fixed;
                    bottom: 1rem;
                    left: 1rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 2rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    cursor: pointer;
                    opacity: 0;
                    transform: translateY(10px);
                    pointer-events: none;
                }
                #offlineSyncBadge.visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                #offlineSyncBadge.synced { background: #059669; color: white; }
                #offlineSyncBadge.offline { background: #DC2626; color: white; }
                #offlineSyncBadge.syncing { background: #F59E0B; color: #78350F; }
                #offlineSyncBadge.pending { background: #F97316; color: white; }
                #offlineSyncBadge.error { background: #7C3AED; color: white; }
                #offlineSyncBadge .sync-icon { font-size: 0.875rem; }
                #offlineSyncBadge.syncing .sync-icon { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            </style>
            <span class="sync-icon"></span>
            <span class="sync-text"></span>
        `;
        document.body.appendChild(badge);

        // Click to show queue details
        badge.addEventListener('click', async () => {
            const count = await this.getPendingCount();
            if (count > 0) {
                alert(`${count} operation(s) pending sync.\n\nThey will be automatically synced when you're back online.`);
            }
        });
    },

    _updateBadge(status) {
        const badge = document.getElementById('offlineSyncBadge');
        if (!badge) return;

        const icon = badge.querySelector('.sync-icon');
        const text = badge.querySelector('.sync-text');

        const states = {
            synced: { icon: '✓', text: 'Synced', show: false },
            offline: { icon: '✕', text: 'Offline', show: true },
            syncing: { icon: '⟳', text: 'Syncing...', show: true },
            pending: { icon: '⏳', text: 'Pending sync', show: true },
            error: { icon: '!', text: 'Sync error', show: true }
        };

        const state = states[status] || states.synced;
        icon.textContent = state.icon;
        text.textContent = state.text;

        badge.className = '';
        badge.classList.add(status);
        if (state.show) {
            badge.classList.add('visible');
        } else {
            // Show briefly then hide for "synced"
            badge.classList.add('visible');
            setTimeout(() => badge.classList.remove('visible'), 2000);
        }
    },

    // ==================== STATUS HELPERS ====================

    get isOnline() {
        return this._isOnline;
    },

    get isSyncing() {
        return this._syncInProgress;
    }
};

// Auto-initialize when imported
let _initPromise = null;
function getOfflineSync() {
    if (!_initPromise) {
        _initPromise = OfflineSync.init();
    }
    return _initPromise;
}

export { OfflineSync, getOfflineSync };
export default OfflineSync;
