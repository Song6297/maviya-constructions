# B&B - Bricks & Bits: Complete Function Documentation

## Table of Contents
1. [Firebase Storage Module](#firebase-storage)
2. [Labour Calendar Module](#labour-calendar)
3. [Dashboard Module](#dashboard)
4. [Project Detail Module](#project-detail)
5. [Worker Management Module](#worker-management)
6. [Vendor Management Module](#vendor-management)
7. [Fund Management Module](#fund-management)
8. [Financial Calculator Module](#financial-calculator)
9. [Authentication Module](#authentication)
10. [Premium Features Module](#premium)

---

## FIREBASE STORAGE MODULE

### Core Database Operations

**FirebaseStorage.generateId()**
- Creates unique IDs using timestamp + random string
- Format: `Date.now().toString(36) + Math.random().toString(36)`
- Used for all new database records

**FirebaseStorage.waitForAuth()**
- Ensures Firebase authentication is ready
- Prevents "user not authenticated" errors
- Returns promise that resolves when auth initialized

**FirebaseStorage.getUserId()**
- Gets current logged-in user's ID
- Falls back to localStorage if Firebase auth fails
- Throws error if no user found

**FirebaseStorage.getAll(collectionName)**
- Fetches all documents from Firestore collection
- Filters by userId for data isolation
- Returns array of documents with IDs

**FirebaseStorage.getById(collectionName, id)**
- Fetches single document by ID
- Validates ID is string
- Returns document object or null

**FirebaseStorage.add(collectionName, item)**
- Creates new document in Firestore
- Auto-generates ID
- Adds userId, createdAt, updatedAt timestamps
- Returns created document with ID

**FirebaseStorage.update(collectionName, id, updates)**
- Updates existing document
- Adds updatedAt timestamp
- Returns updated data

**FirebaseStorage.delete(collectionName, id)**
- Deletes document from Firestore
- Validates ID
- Logs deletion for debugging
- Returns true/false

**FirebaseStorage.getByProject(collectionName, projectId)**
- Fetches all documents for specific project
- Filters by both userId and projectId
- Used for project-specific data

**FirebaseStorage.deleteByProject(collectionName, projectId)**
- Deletes all documents associated with project
- Used when deleting entire project
- Batch operation

---

## LABOUR CALENDAR MODULE

### Time Calculation Functions

**LabourCalendar.calculateHoursWorked(startTime, endTime)**
- Calculates hours from time strings ("09:00", "17:00")
- Handles overnight shifts
- Returns decimal hours (e.g., 8.5)
- Example: "09:00" to "17:00" = 8 hours

**LabourCalendar.calculateEarnings(hoursWorked, hourlyRate)**
- Multiplies hours × rate
- Rounds to 2 decimals
- Returns earned amount
- Example: 8 hours × ₹100/hr = ₹800

**LabourCalendar.getHourlyRate(workType)**
- Gets rate for work type (Mason, Electrician, etc.)
- Checks stored rates first, then defaults
- Caches rates for performance
- Default rates:
  - Mason: ₹100/hr
  - Helper: ₹50/hr
  - Carpenter: ₹90/hr
  - Electrician: ₹100/hr
  - Plumber: ₹95/hr
  - Painter: ₹80/hr
  - Welder: ₹110/hr
  - Tile Worker: ₹100/hr
  - Plasterer: ₹85/hr
  - General: ₹60/hr

### Work Entry Operations

**LabourCalendar.createWorkEntry(entry)**
- Creates immutable work record
- Required: labourId, projectId, workType, date, startTime, endTime
- Auto-calculates: hours worked, earned amount
- Validates: end time must be after start time
- Denormalizes: stores worker name, project name
- Returns created work entry
- IMMUTABLE: Cannot be edited after creation (audit trail)

**LabourCalendar.getWorkEntriesByDate(date)**
- Gets all work entries for specific date
- Sorts by start time
- Used for daily calendar view
- Returns array of work entries

**LabourCalendar.getWorkEntriesByLabour(labourId, dateRange)**
- Gets worker's work history
- Optional date range filter {start, end}
- Sorts by date, then time
- Used for worker profile
- Returns array of work entries

**LabourCalendar.getWorkEntriesByProject(projectId, dateRange)**
- Gets all work for project
- Optional date range filter
- Used for project labour summary
- Returns array of work entries

### Payment Operations

**LabourCalendar.recordPayment(payment)**
- Records payment to worker
- Required: labourId, projectId, amount
- Checks for overpayment
- IMMUTABLE: Cannot be modified after creation
- Returns payment record

**LabourCalendar.getPaymentsByLabour(labourId)**
- Gets all payments to worker
- Used for payment history
- Returns array of payments

**LabourCalendar.getPaymentsByDate(date)**
- Gets all payments made on date
- Used for daily summary
- Returns array of payments

**LabourCalendar.getLabourDue(labourId, projectId)**
- Calculates what worker is owed
- Formula: Total Earned - Total Paid
- Can calculate across all projects or single project
- Returns: {earned, paid, due}

### Fund Integration

**LabourCalendar.processPaymentWithFundUpdate(payment)**
- Records payment AND updates project fund balance
- Checks: warns if payment exceeds available funds
- Updates: deducts payment from project wallet
- Returns: {payment, newFundBalance, warning}

**LabourCalendar.checkFundBalance(projectId, amount)**
- Checks if project has enough funds
- Returns: {sufficient, currentBalance, shortfall}
- Used before making payments

### Budget Integration

**LabourCalendar.updateProjectBudgetOnPayment(projectId, paymentAmount)**
- Updates project's labour spending
- Tracks cumulative labour costs
- Returns: {remainingBudget}

**LabourCalendar.getProjectBudgetStatus(projectId)**
- Gets labour cost vs budget
- Status: healthy, low, critical, exhausted
- Returns: {totalLabourCost, remainingBudget, status}

### Day Summary Calculations

**LabourCalendar.getDaySummary(date)**
- Comprehensive summary for a date
- Calculates:
  - Labour count (unique workers)
  - Total hours worked
  - Total earned
  - Total paid
  - Total due
  - Fund impact (negative = payments made)
- Breakdowns:
  - By project (which projects had work)
  - By work type (masonry, electrical, etc.)
- Includes: meeting count
- Returns: {date, labourCount, totalHours, totalEarned, totalPaid, totalDue, fundImpact, projectBreakdown, workTypeBreakdown, meetingCount, hasActivity}

**LabourCalendar.getMonthSummary(year, month)**
- Summary for entire month
- Returns array of 30/31 day summaries
- Used for calendar month view
- Shows: labour count, hours, earnings per day
- Returns array of day summaries

### Meeting Operations

**LabourCalendar.createMeeting(meeting)**
- Schedules site meeting
- Required: projectId, date
- Stores: attendees (worker IDs), purpose, outcome
- Can link to work entries
- Returns meeting record

**LabourCalendar.getMeetingsByDate(date)**
- Gets meetings on specific date
- Returns array of meetings

**LabourCalendar.getMeetingsByProject(projectId)**
- Gets all project meetings
- Returns array of meetings

### Work Type Rate Management

**LabourCalendar.getWorkTypeRates()**
- Gets all hourly rates
- Initializes defaults if empty
- Returns array of rate objects

**LabourCalendar.initializeDefaultRates()**
- Sets up default hourly rates
- Creates rate records in database
- Clears cache

**LabourCalendar.updateWorkTypeRate(workType, newRate)**
- Updates hourly rate for work type
- Clears cache
- Effective from current date

### Audit Trail

**LabourCalendar.getDateActivities(date)**
- Gets ALL activities for a date
- Combines: work entries, payments, meetings
- Sorts by time
- Returns: {date, activities, summary}
- Used for audit/timeline view

**LabourCalendar.getLabourTimeline(date)**
- Timeline grouped by worker
- Shows each worker's schedule for the day
- Includes: work blocks, meetings
- Returns array: {labourId, labourName, timeBlocks, totalHours, totalEarned}

### Data Migration

**LabourCalendar.needsMigration()**
- Checks if old attendance data needs migration
- Compares old vs new collections
- Returns true if migration needed

**LabourCalendar.migrateOldData()**
- Migrates old worker_attendance → work_entries
- Migrates old worker_payments → labour_payments
- Conversion:
  - Present day → 8-hour work entry
  - Half-day → 4-hour work entry
  - Absent → no entry
- Preserves original IDs for tracking
- Returns: {attendanceMigrated, paymentsMigrated, errors}

### Project Labour Summary

**LabourCalendar.getProjectLabourSummary(projectId)**
- Comprehensive labour summary for project
- Per Worker:
  - Total hours worked
  - Total earned
  - Total paid
  - Balance due
  - Days worked
  - Date details: which dates paid vs unpaid (FIFO)
- Totals: total workers, earned, paid, due
- FIFO Payment Tracking: Shows exactly which work dates are paid/unpaid
- Returns: {workers, totals}

**LabourCalendar.getWorkerProjects(labourId)**
- All projects a worker has worked on
- Auto-detects from work entries
- Per Project: hours, earned, paid, due, last work date
- Sorts by most recent work
- Returns: {projects, totalProjects, activeProjects, totalEarned, totalPaid, totalDue}

**LabourCalendar.getWorkerFullSummary(labourId)**
- Complete worker profile
- Combines: worker info, project list, dues
- Used for worker profile modal
- Returns comprehensive worker data

---

## DASHBOARD MODULE

### Utility Functions

**Utils.formatNumber(num)**
- Formats numbers with Indian locale (₹1,00,000)
- Handles null/undefined/NaN
- Returns "0" for invalid input

**Utils.formatDate(dateStr)**
- Formats date as "5 Feb 2026"
- Uses Indian locale

**Utils.escapeHtml(text)**
- Prevents XSS attacks
- Escapes HTML special characters

**Utils.getDaysRemaining(endDate)**
- Calculates days until deadline
- Negative = overdue
- Zero = due today

**Utils.getBudgetHealth(spent, budget)**
- Calculates budget utilization percentage
- Status levels:
  - OK: < 80%
  - Warning: 80-90%
  - Critical: 90-100%
  - Over: > 100%
- Returns: {percent, status, color}

**Utils.getDeadlineStatus(endDate, status)**
- Deadline urgency indicator
- Priority levels:
  - 4: Overdue (red, pulsing)
  - 3: Due today (red)
  - 2: 1-3 days left (amber)
  - 1: 4-7 days left (amber)
  - 0: > 7 days or completed (green)
- Returns: {class, text, priority}

**Utils.shareToWhatsApp(text)**
- Opens WhatsApp with pre-filled message
- Used for sharing reports

**Utils.exportToCSV(data, filename)**
- Converts array of objects to CSV
- Downloads file
- Handles special characters

### App Core Functions

**App.init()**
- Initializes dashboard
- Sequence:
  1. Show loading overlay
  2. Bind event listeners
  3. Generate alerts
  4. Render alerts panel
  5. Render project cards
  6. Update metrics
  7. Hide loading

**App.showLoading(show)**
- Shows/hides loading overlay
- Spinner with "Loading..." text

**App.generateAlerts()**
- Scans all projects for issues
- Alert types:
  - Deadline alerts: Overdue, due today, due soon
  - Budget alerts: Over budget, 90%+ used, 80%+ used
  - High spending: Today's expenses > 1.5× daily average
  - Payment alerts: Overdue payments, due soon
  - Attendance reminder: Mark today's attendance
- Stores in App.alerts array

**App.renderAlerts()**
- Displays alert panel
- Clickable alerts navigate to project
- Icons: clock, exclamation-triangle, chart-line, rupee-sign, wallet, user-clock

**App.getProjectSpent(projectId)**
- Calculates total project spending
- Formula:
  - Materials (used) - Materials (recovered)
  - + Labour (total amount or wage × days)
  - + Expenses
- Returns total spent amount

**App.getTodayExpenses(projectId)**
- Calculates today's spending
- Materials + Expenses for current date
- Used for high spending alerts

### Project Rendering

**App.renderProjects()**
- Renders all project cards
- Applies status filter
- Sorts by last updated
- Shows empty state if no projects

**App.createProjectCard(project)**
- Creates HTML for single project card
- Displays:
  - Status badge
  - Project name, client, location
  - Timeline (start → end dates)
  - Progress bar (auto-calculated)
  - Budget health meter
  - Budget vs Spent
  - Deadline alert (if urgent)
- Actions: Edit, Delete buttons
- Clickable card navigates to project detail

### Metrics Dashboard

**App.updateMetrics()**
- Updates dashboard metrics cards
- Metrics:
  - Total Projects
  - Active Projects (In Progress)
  - Completed Projects
  - Delayed Projects (overdue)
  - Pending Payments (sum of unpaid)
  - Available Credits (for free users)

**App.loadUserCredits()**
- Loads user's project credits
- Shows/hides credits card based on premium status
- Logic:
  - Premium users (except Saqlain): Hide credits
  - Free users + Saqlain: Show credits
  - Admin: Full premium, no credits needed

### Project CRUD Operations

**App.openModal(projectId)**
- Opens project create/edit modal
- If projectId: loads project data (edit mode)
- If no projectId: blank form (create mode)
- Sets today as default start date

**App.handleSubmit(e)**
- Handles project form submission
- Validation: End date must be after start date
- Premium check: For new projects
  - Premium: Creates project directly
  - Free: Redirects to project fee payment (₹5)
- Actions: Create or Update
- Refreshes dashboard after save

**App.checkUserPremiumStatus()**
- Checks if user has active premium subscription
- Special cases:
  - Admin: Full premium
  - Saqlain: Premium features but pays project fee
  - Others: Check Firestore for premium status + expiry
- Returns true/false

**App.confirmDelete()**
- Deletes project and ALL related data
- Cascading delete:
  - Materials, Labour, Expenses
  - Logs, Documents, Payments
  - Attendance, Client Payments
  - Vendors, Vendor Payments
- Refreshes dashboard

---

## PROJECT DETAIL MODULE

### Initialization

**ProjectApp.init()**
- Gets project ID from URL
- Loads project data
- Populates dropdowns
- Renders header
- Checks project lock status
- Checks budget alerts
- Renders overview section
- Binds all event listeners
- Renders all tabs

**ProjectApp.checkProjectLock()**
- If project status = "Completed":
  - Disables all add/edit buttons
  - Shows "Re-open" button
  - Shows lock notification
- If not completed:
  - Enables all buttons

**ProjectApp.reopenProject()**
- Changes status from "Completed" to "In Progress"
- Unlocks project for editing
- Reloads page

### Materials Management

**ProjectApp.renderMaterials()**
- Displays materials table
- Applies status filter (all, used, recovered)
- Columns: Name, Category, Quantity, Unit, Rate, Total, Paid, Balance, Status, Date
- Totals row: Sum of all materials
- Actions: Edit, Delete

**ProjectApp.handleMaterialSubmit(e)**
- Creates/updates material
- Auto-calculates: Total = Quantity × Rate
- Auto-calculates: Balance = Total - Paid Amount
- Real-time calculation as user types
- Status: used (adds to cost), recovered (subtracts)

### Labour Management

**ProjectApp.renderLabour()**
- Displays worker cards
- Per Worker Card:
  - Name, role, phone
  - Today's attendance status
  - Daily wage
  - Days worked
  - Total earned, paid, balance
- Actions: View Profile, Pay Worker, Remove
- Attendance Summary: Total, present, absent, half-day
- Totals: Total earned, paid, balance

**ProjectApp.handleLabourSubmit(e)**
- Adds worker to project
- Two modes:
  1. Select existing worker
  2. Create new worker
- Creates worker assignment
- Stores: role, daily wage, overtime rate, dates

### Vendor Management

**ProjectApp.renderVendors()**
- Displays vendor cards
- Per Vendor:
  - Name, service type, phone
  - Work description
  - Agreed cost, paid, balance
  - Payment status
- Actions: Pay, Edit, Delete
- Totals: Total cost, paid, balance

### Summary & Reports

**ProjectApp.renderSummary()**
- Comprehensive project summary
- Sections:
  1. Financial Overview (budget, spent, remaining)
  2. Expense Breakdown Chart (pie chart)
  3. Budget vs Spent Chart (bar chart)
  4. Client Payments (history + totals)
  5. Export Options (PDF, CSV, WhatsApp)

**ProjectApp.generatePDFReport()**
- Creates comprehensive PDF report
- Includes: project details, materials, labour, expenses, logs, client payments
- Auto-dated filename
- Downloads automatically

---

## FUND MANAGEMENT MODULE

### Wallet Operations

**FundManagement.initializeProjectWallet(projectId)**
- Creates wallet if doesn't exist
- Initializes: virtualBalance, advanceReceived, loans
- Returns wallet object

**FundManagement.getProjectBalance(projectId)**
- Gets current virtual balance
- Calculates net balance: virtualBalance - loansReceived
- Returns: {virtualBalance, advanceReceived, pendingDues, totalLoansGiven, totalLoansReceived, netBalance}

**FundManagement.updateProjectWallet(projectId, updates)**
- Updates wallet fields
- Adds lastUpdated timestamp
- Returns updated wallet

### Payment Allocation

**FundManagement.allocatePayment(paymentData)**
- Splits client payment across multiple projects
- Validation: Total allocations must equal payment
- Updates: Each project's virtual balance
- Creates: Payment allocation records
- Transaction-safe: Rolls back on failure
- Returns payment record

### Cross-Project Expenses

**FundManagement.recordCrossProjectExpense(expenseData)**
- Records expense paid by Project A for Project B
- Creates: Expense in beneficiary project
- Creates: Cross-project transaction (loan)
- Updates: Lender's balance ↓, Borrower's debt ↑
- Transaction-safe: Rolls back on failure
- Returns: {expenseRecord, transactionRecords}

### Auto-Settlement

**FundManagement.autoSettleLoans(borrowerProjectId, availableAmount)**
- Auto-settles loans when borrower receives payment
- FIFO ordering: Oldest loans settled first
- Partial settlement: If not enough to pay full loan
- Updates: Lender gets money back, Borrower's debt reduces
- Returns: {settledLoans, remainingAmount}

**FundManagement.settleCrossProjectTransaction(transactionId, settlementAmount)**
- Manual loan settlement
- Validation: Cannot exceed outstanding balance
- Updates: Transaction status, wallet balances
- Creates: Settlement record
- Transaction-safe: Rolls back on failure
- Returns: {success, settlementAmount, remainingBalance, fullySettled}

---

This documentation covers the core functions. Each module has many more helper functions for UI rendering, validation, and data transformation. The system uses Firebase for real-time data sync, implements transaction safety for financial operations, and maintains audit trails for labour tracking.
