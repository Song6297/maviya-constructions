// Worker Management System - New Labour Management
import Storage from './firebase-storage.js';

const WorkerManagement = {
    currentAttendanceData: {},
    
    // Load all workers into dropdown
    async loadWorkerDropdown() {
        const workers = await Storage.workers.getAll();
        const select = document.getElementById('workerSelect');
        if (!select) {
            console.warn('workerSelect element not found');
            return;
        }
        select.innerHTML = '<option value="">-- Create New Worker --</option>' + 
            workers.map(w => `<option value="${w.id}">${w.name} - ${w.role}</option>`).join('');
    },

    // When worker is selected from dropdown
    onWorkerSelect(workerId) {
        const newWorkerFields = document.getElementById('newWorkerFields');
        const workerNameInput = document.getElementById('workerName');
        const workerIdInput = document.getElementById('workerId');
        
        if (!newWorkerFields || !workerNameInput || !workerIdInput) {
            console.warn('Worker form elements not found');
            return;
        }
        
        if (workerId) {
            // Existing worker selected - hide new worker fields
            newWorkerFields.style.display = 'none';
            workerNameInput.required = false;
            workerIdInput.value = workerId;
            
            // Load worker data
            Storage.workers.getById(workerId).then(worker => {
                if (worker) {
                    const roleSelect = document.getElementById('workerRole');
                    const wageInput = document.getElementById('dailyWage');
                    if (roleSelect) roleSelect.value = worker.role;
                    if (wageInput) wageInput.value = worker.dailyWage || '';
                }
            });
        } else {
            // Create new worker
            newWorkerFields.style.display = 'block';
            workerNameInput.required = true;
            workerIdInput.value = '';
            workerNameInput.value = '';
            const phoneInput = document.getElementById('workerPhone');
            if (phoneInput) phoneInput.value = '';
        }
    },

    // Render worker cards with attendance
    async renderLabour(projectId) {
        const assignments = await Storage.workerAssignments.getByProject(projectId);
        const container = document.getElementById('labourCardsContainer');
        const empty = document.getElementById('labourEmpty');
        const totalRow = document.getElementById('labourTotalRow');
        const attendanceSummary = document.getElementById('attendanceSummary');

        if (!assignments.length) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
            totalRow.classList.add('hidden');
            attendanceSummary.classList.add('hidden');
            return;
        }

        empty.classList.add('hidden');
        totalRow.classList.remove('hidden');
        attendanceSummary.classList.remove('hidden');

        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('attendanceDate').textContent = new Date().toLocaleDateString('en-IN', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });

        let totalEarned = 0, totalPaid = 0;
        let presentCount = 0, absentCount = 0, halfDayCount = 0;

        const cards = await Promise.all(assignments.map(async (assignment) => {
            const worker = await Storage.workers.getById(assignment.workerId);
            if (!worker) return '';

            // Get attendance records
            const attendanceRecords = await Storage.workerAttendance.getByWorkerAndProject(worker.id, projectId);
            const todayAttendance = attendanceRecords.find(a => a.date === today);
            
            // Calculate earnings
            const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
            const halfDays = attendanceRecords.filter(a => a.status === 'half-day').length;
            const totalDays = presentDays + (halfDays * 0.5);
            const earned = totalDays * assignment.dailyWage;

            // Get payments
            const payments = await Storage.workerPayments.getByWorkerAndProject(worker.id, projectId);
            const paid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const balance = earned - paid;

            totalEarned += earned;
            totalPaid += paid;

            // Count today's attendance
            if (todayAttendance) {
                if (todayAttendance.status === 'present') presentCount++;
                else if (todayAttendance.status === 'absent') absentCount++;
                else if (todayAttendance.status === 'half-day') halfDayCount++;
            }

            const statusBadge = todayAttendance ? 
                (todayAttendance.status === 'present' ? '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">Present</span>' :
                 todayAttendance.status === 'half-day' ? '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">Half Day</span>' :
                 '<span class="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs">Absent</span>') :
                '<span class="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">Not Marked</span>';

            return `<div class="card p-4 hover:shadow-lg transition">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">${worker.name}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="inline-block px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs">${assignment.role}</span>
                            ${statusBadge}
                        </div>
                        ${worker.phone ? `<p class="text-xs text-slate-500 mt-1"><i class="fas fa-phone mr-1"></i>${worker.phone}</p>` : ''}
                    </div>
                    <div class="flex gap-1">
                        <button type="button" class="action-btn" onclick="WorkerManagement.openWorkerProfile('${worker.id}', '${projectId}')" title="View Profile">
                            <i class="fas fa-user text-xs"></i>
                        </button>
                        <button type="button" class="action-btn" onclick="WorkerManagement.openPaymentModal('${worker.id}', '${assignment.id}', '${worker.name}', ${balance})" title="Pay Worker">
                            <i class="fas fa-money-bill-wave text-xs"></i>
                        </button>
                        <button type="button" class="action-btn delete" onclick="ProjectApp.openDeleteModal('workerAssignment','${assignment.id}')" title="Remove from Project">
                            <i class="fas fa-user-minus text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="space-y-2 mb-3">
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Daily Wage</span>
                        <span class="font-semibold text-slate-800">₹${assignment.dailyWage.toLocaleString('en-IN')}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Days Worked</span>
                        <span class="font-semibold text-slate-800">${totalDays.toFixed(1)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Total Earned</span>
                        <span class="font-bold text-sky-600">₹${earned.toLocaleString('en-IN')}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Paid</span>
                        <span class="font-semibold text-emerald-600">₹${paid.toLocaleString('en-IN')}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Balance</span>
                        <span class="font-semibold ${balance > 0 ? 'text-rose-600' : 'text-slate-500'}">₹${balance.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>`;
        }));

        container.innerHTML = cards.join('');

        // Update totals
        const totalBalance = totalEarned - totalPaid;
        document.getElementById('labourTotalAmount').textContent = `₹${totalEarned.toLocaleString('en-IN')}`;
        document.getElementById('labourTotalPaid').textContent = `₹${totalPaid.toLocaleString('en-IN')}`;
        document.getElementById('labourTotalBalance').textContent = `₹${Math.max(0, totalBalance).toLocaleString('en-IN')}`;

        // Update attendance summary
        document.getElementById('totalWorkers').textContent = assignments.length;
        document.getElementById('presentWorkers').textContent = presentCount;
        document.getElementById('absentWorkers').textContent = absentCount;
        document.getElementById('halfDayWorkers').textContent = halfDayCount;
    },

    // Handle worker assignment form submit
    async handleLabourSubmit(e, projectId) {
        e.preventDefault();
        
        const workerSelectValue = document.getElementById('workerSelect').value;
        let workerId = document.getElementById('workerId').value;

        // Create new worker if needed
        if (!workerSelectValue && !workerId) {
            const workerData = {
                name: document.getElementById('workerName').value.trim(),
                phone: document.getElementById('workerPhone').value.trim(),
                role: document.getElementById('workerRole').value,
                dailyWage: parseFloat(document.getElementById('dailyWage').value),
                status: 'active',
                joiningDate: new Date().toISOString().split('T')[0]
            };
            const newWorker = await Storage.workers.add(workerData);
            workerId = newWorker.id;
        } else if (workerSelectValue) {
            workerId = workerSelectValue;
        }

        // Create assignment
        const assignmentData = {
            workerId,
            projectId,
            role: document.getElementById('workerRole').value,
            dailyWage: parseFloat(document.getElementById('dailyWage').value),
            overtimeRate: parseFloat(document.getElementById('overtimeRate').value) || 0,
            startDate: document.getElementById('labourStartDate').value,
            endDate: document.getElementById('labourEndDate').value || null,
            status: 'active'
        };

        await Storage.workerAssignments.add(assignmentData);
        return true;
    },

    // Open attendance sheet modal
    async openAttendanceSheet(projectId) {
        console.log('WorkerManagement.openAttendanceSheet called with projectId:', projectId);
        const modal = document.getElementById('attendanceModal');
        const dateInput = document.getElementById('attendanceDateInput');
        console.log('attendanceModal found:', !!modal, 'dateInput found:', !!dateInput);
        if (!modal || !dateInput) {
            console.error('Attendance modal elements not found');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        await this.loadAttendanceForDate(today, projectId);
        modal.classList.remove('hidden');
        modal.classList.add('active');
        console.log('Attendance modal should now be visible');
    },

    // Load attendance for specific date
    async loadAttendanceForDate(date, projectId) {
        const assignments = await Storage.workerAssignments.getByProject(projectId);
        const attendanceList = document.getElementById('attendanceList');
        
        this.currentAttendanceData = {};

        const rows = await Promise.all(assignments.map(async (assignment) => {
            const worker = await Storage.workers.getById(assignment.workerId);
            if (!worker) return '';

            const existingAttendance = await Storage.workerAttendance.getByWorkerAndProject(worker.id, projectId);
            const todayRecord = existingAttendance.find(a => a.date === date);
            const status = todayRecord ? todayRecord.status : 'present';
            const attendanceId = todayRecord ? todayRecord.id : null;

            this.currentAttendanceData[worker.id] = { status, attendanceId, assignmentId: assignment.id };

            return `<div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                    <p class="font-semibold text-slate-800">${worker.name}</p>
                    <p class="text-xs text-slate-500">${assignment.role} • ₹${assignment.dailyWage}/day</p>
                </div>
                <div class="flex gap-2">
                    <button type="button" onclick="WorkerManagement.setAttendanceStatus('${worker.id}', 'present')" 
                        class="attendance-btn ${status === 'present' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600'}" 
                        id="btn-${worker.id}-present">
                        <i class="fas fa-check mr-1"></i>Present
                    </button>
                    <button type="button" onclick="WorkerManagement.setAttendanceStatus('${worker.id}', 'half-day')" 
                        class="attendance-btn ${status === 'half-day' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600'}" 
                        id="btn-${worker.id}-half-day">
                        <i class="fas fa-adjust mr-1"></i>Half
                    </button>
                    <button type="button" onclick="WorkerManagement.setAttendanceStatus('${worker.id}', 'absent')" 
                        class="attendance-btn ${status === 'absent' ? 'bg-rose-500 text-white' : 'bg-white text-slate-600'}" 
                        id="btn-${worker.id}-absent">
                        <i class="fas fa-times mr-1"></i>Absent
                    </button>
                </div>
            </div>`;
        }));

        attendanceList.innerHTML = rows.join('');
    },

    // Set attendance status (UI only, not saved yet)
    setAttendanceStatus(workerId, status) {
        this.currentAttendanceData[workerId].status = status;
        
        // Update button styles
        ['present', 'half-day', 'absent'].forEach(s => {
            const btn = document.getElementById(`btn-${workerId}-${s}`);
            if (s === status) {
                btn.className = 'attendance-btn ' + (s === 'present' ? 'bg-emerald-500' : s === 'half-day' ? 'bg-amber-500' : 'bg-rose-500') + ' text-white';
            } else {
                btn.className = 'attendance-btn bg-white text-slate-600';
            }
        });
    },

    // Mark all present
    markAllPresent() {
        Object.keys(this.currentAttendanceData).forEach(workerId => {
            this.setAttendanceStatus(workerId, 'present');
        });
    },

    // Save attendance
    async saveAttendance(projectId) {
        const date = document.getElementById('attendanceDateInput').value;
        
        for (const [workerId, data] of Object.entries(this.currentAttendanceData)) {
            if (data.attendanceId) {
                // Update existing
                await Storage.workerAttendance.update(data.attendanceId, { status: data.status });
            } else {
                // Create new
                await Storage.workerAttendance.add({
                    workerId,
                    projectId,
                    date,
                    status: data.status,
                    hoursWorked: data.status === 'half-day' ? 4 : data.status === 'present' ? 8 : 0
                });
            }
        }
        
        return true;
    },

    // Open payment modal
    openPaymentModal(workerId, assignmentId, workerName, pendingAmount) {
        document.getElementById('paymentWorkerId').value = workerId;
        document.getElementById('paymentAssignmentId').value = assignmentId;
        document.getElementById('paymentWorkerName').textContent = workerName;
        document.getElementById('paymentPendingAmount').textContent = `₹${pendingAmount.toLocaleString('en-IN')}`;
        document.getElementById('paymentAmount').value = pendingAmount > 0 ? pendingAmount : '';
        document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
        const modal = document.getElementById('workerPaymentModal');
        modal.classList.remove('hidden');
        modal.classList.add('active');
    },

    // Handle worker payment
    async handleWorkerPaymentSubmit(e, projectId) {
        e.preventDefault();
        
        const paymentData = {
            workerId: document.getElementById('paymentWorkerId').value,
            projectId,
            amount: parseFloat(document.getElementById('paymentAmount').value),
            paymentMode: document.getElementById('paymentMode').value,
            date: document.getElementById('paymentDate').value,
            notes: document.getElementById('paymentNotes').value.trim()
        };

        await Storage.workerPayments.add(paymentData);
        return true;
    },

    // Open worker profile modal
    async openWorkerProfile(workerId, projectId) {
        const worker = await Storage.workers.getById(workerId);
        const attendance = await Storage.workerAttendance.getByWorkerAndProject(workerId, projectId);
        const payments = await Storage.workerPayments.getByWorkerAndProject(workerId, projectId);
        const assignment = (await Storage.workerAssignments.getByProject(projectId)).find(a => a.workerId === workerId);

        if (!worker || !assignment) return;

        const presentDays = attendance.filter(a => a.status === 'present').length;
        const halfDays = attendance.filter(a => a.status === 'half-day').length;
        const absentDays = attendance.filter(a => a.status === 'absent').length;
        const totalDays = presentDays + (halfDays * 0.5);
        const totalEarned = totalDays * assignment.dailyWage;
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        const content = `
            <div class="space-y-6">
                <div class="flex items-start justify-between">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">${worker.name}</h2>
                        <p class="text-slate-600">${assignment.role}</p>
                        ${worker.phone ? `<p class="text-sm text-slate-500 mt-1"><i class="fas fa-phone mr-1"></i>${worker.phone}</p>` : ''}
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-slate-600">Daily Wage</p>
                        <p class="text-2xl font-bold text-sky-600">₹${assignment.dailyWage.toLocaleString('en-IN')}</p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-emerald-50 p-4 rounded-lg text-center">
                        <p class="text-3xl font-bold text-emerald-600">${presentDays}</p>
                        <p class="text-sm text-slate-600">Present Days</p>
                    </div>
                    <div class="bg-amber-50 p-4 rounded-lg text-center">
                        <p class="text-3xl font-bold text-amber-600">${halfDays}</p>
                        <p class="text-sm text-slate-600">Half Days</p>
                    </div>
                    <div class="bg-rose-50 p-4 rounded-lg text-center">
                        <p class="text-3xl font-bold text-rose-600">${absentDays}</p>
                        <p class="text-sm text-slate-600">Absent Days</p>
                    </div>
                </div>

                <div class="bg-slate-50 p-4 rounded-lg">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-slate-600">Total Earned</p>
                            <p class="text-xl font-bold text-sky-600">₹${totalEarned.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-600">Total Paid</p>
                            <p class="text-xl font-bold text-emerald-600">₹${totalPaid.toLocaleString('en-IN')}</p>
                        </div>
                        <div class="col-span-2">
                            <p class="text-sm text-slate-600">Balance Due</p>
                            <p class="text-2xl font-bold text-rose-600">₹${(totalEarned - totalPaid).toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 class="font-bold text-slate-800 mb-3">Payment History</h3>
                    ${payments.length ? `
                        <div class="space-y-2 max-h-48 overflow-y-auto">
                            ${payments.map(p => `
                                <div class="flex justify-between items-center p-3 bg-slate-50 rounded">
                                    <div>
                                        <p class="font-semibold text-slate-800">₹${parseFloat(p.amount).toLocaleString('en-IN')}</p>
                                        <p class="text-xs text-slate-500">${new Date(p.date).toLocaleDateString('en-IN')} • ${p.paymentMode}</p>
                                    </div>
                                    ${p.notes ? `<p class="text-xs text-slate-600">${p.notes}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-slate-500 text-sm">No payments recorded yet</p>'}
                </div>

                <div class="flex gap-3">
                    <button onclick="WorkerManagement.openPaymentModal('${workerId}', '${assignment.id}', '${worker.name}', ${totalEarned - totalPaid}); document.getElementById('workerProfileModal').classList.add('hidden'); document.getElementById('workerProfileModal').classList.remove('active');" class="flex-1 btn-primary">
                        <i class="fas fa-money-bill-wave mr-2"></i>Pay Worker
                    </button>
                    <button onclick="document.getElementById('workerProfileModal').classList.add('hidden'); document.getElementById('workerProfileModal').classList.remove('active');" class="flex-1 btn-secondary">Close</button>
                </div>
            </div>
        `;

        document.getElementById('workerProfileContent').innerHTML = content;
        const modal = document.getElementById('workerProfileModal');
        modal.classList.remove('hidden');
        modal.classList.add('active');
    }
};

// Make it globally accessible
window.WorkerManagement = WorkerManagement;

export default WorkerManagement;