# Additional Function Documentation

## WORKER MANAGEMENT MODULE

### Worker Dropdown Management

**WorkerManagement.loadWorkerDropdown()**
- Loads all workers into dropdown
- Shows: "-- Create New Worker --" option + existing workers
- Format: "Worker Name - Role"
- Used in labour assignment form

**WorkerManagement.onWorkerSelect(workerId)**
- Handles worker selection from dropdown
- If existing worker selected:
  - Hides new worker fields
  - Loads worker data (role, wage)
  - Pre-fills form
- If "Create New" selected:
  - Shows new worker fields
  - Requires: name, phone, role, wage

### Attendance Management

**WorkerManagement.openAttendanceSheet(projectId)**
- Opens attendance marking modal
- Loads today's date by default
- Shows all assigned workers
- Buttons per worker: Present, Half-Day, Absent
- "Mark All Present" quick action

**WorkerManagement.loadAttendanceForDate(date, projectId)**
- Loads attendance for specific date
- Gets all worker assignments
- Checks existing attendance records
- Pre-selects current status
- Stores in currentAttendanceData object

**WorkerManagement.setAttendanceStatus(workerId, status)**
- Sets attendance status (UI only, not saved yet)
- Updates button styles (active/inactive)
- Stores in currentAttendanceData
- Status: present, half-day, absent

**WorkerManagement.markAllPresent()**
- Quick action to mark all workers present
- Loops through all workers
- Calls setAttendanceStatus for each

**WorkerManagement.saveAttendance(projectId)**
- Saves attendance for selected date
- For each worker:
  - If existing record: updates status
  - If new: creates attendance record
- Hours worked: Present=8, Half-Day=4, Absent=0
- Returns true on success

### Payment Management

**WorkerManagement.openPaymentModal(workerId, assignmentId, workerName, pendingAmount)**
- Opens payment form modal
- Pre-fills:
  - Worker ID and name
  - Pending amount
  - Today's date
- User enters: amount, payment mode, notes

**WorkerManagement.handleWorkerPaymentSubmit(e, projectId)**
- Processes worker payment
- Creates payment record
- Fields: workerId, projectId, amount, paymentMode, date, notes
- Returns true on success

### Worker Profile

**WorkerManagement.openWorkerProfile(workerId, projectId)**
- Shows detailed worker profile modal
- Displays:
  - Worker info (name, role, phone, daily wage)
  - Attendance stats:
    - Present days (green)
    - Half days (amber)
    - Absent days (red)
  - Financial summary:
    - Total earned
    - Total paid
    - Balance due
  - Payment history:
    - All payments with dates
    - Payment mode
    - Notes
- Actions: Pay Worker button

### Labour Rendering

**WorkerManagement.renderLabour(projectId)**
- Renders worker cards for project
- Per Worker Card:
  - Name, role, phone
  - Today's attendance status badge
  - Daily wage
  - Days worked (present + 0.5×half-days)
  - Total earned (days × wage)
  - Total paid (sum of payments)
  - Balance (earned - paid)
- Actions: View Profile, Pay, Remove
- Attendance Summary:
  - Total workers
  - Present count
  - Absent count
  - Half-day count
- Totals:
  - Total earned (all workers)
  - Total paid (all workers)
  - Total balance (all workers)

---

## VENDOR MANAGEMENT MODULE

### Vendor Rendering

**VendorManagement.renderVendors(projectId)**
- Displays vendor cards for project
- Per Vendor Card:
  - Name, service type, phone
  - Work description
  - Agreed cost
  - Paid amount (sum of payments)
  - Balance (agreed cost - paid)
  - Payment status badge:
    - Pending (red): No payments
    - Partially Paid (amber): Some payments
    - Completed (green): Fully paid
- Actions: Pay Vendor, Edit, Delete
- Totals:
  - Total agreed cost
  - Total paid
  - Total balance

### Vendor CRUD

**VendorManagement.handleVendorSubmit(e, projectId)**
- Creates/updates vendor
- Fields:
  - Name
  - Phone
  - Service type (dropdown)
  - Work description
  - Agreed cost
- Payment status: Initially "pending"
- Returns true on success

### Vendor Payment

**VendorManagement.openPaymentModal(vendorId, vendorName, pendingAmount)**
- Opens vendor payment form
- Pre-fills:
  - Vendor ID and name
  - Pending amount
  - Today's date
- User enters: amount, payment method, notes

**VendorManagement.handleVendorPaymentSubmit(e, projectId)**
- Processes vendor payment
- Creates payment record
- Fields: vendorId, projectId, amount, paymentMethod, paymentDate, notes
- Returns true on success

### Dropdown Population

**VendorManagement.populateVendorDropdowns()**
- Populates service type dropdown:
  - Carpenter
  - Plumber
  - Electrician
  - Bar Bender
  - Mason
  - Painter
  - Tiler
  - Welder
  - HVAC Technician
  - Material Supplier
  - Transport
  - Cleaning Service
  - Security Service
  - Other
- Populates payment method dropdown:
  - Cash
  - Bank Transfer
  - Cheque
  - UPI
  - Card

---

## FINANCIAL CALCULATOR MODULE

### Amount Parsing

**FinancialCalculator.parseAmount(value)**
- Converts string/number to float
- Handles: "1,000", "1000", 1000
- Removes commas
- Returns 0 for invalid input
- Rounds to 2 decimals

**FinancialCalculator.formatCurrency(amount)**
- Formats number as Indian currency
- Example: 100000 → "1,00,000"
- Uses Intl.NumberFormat
- Returns "0" for invalid input

### Arithmetic Operations

**FinancialCalculator.add(a, b)**
- Adds two amounts
- Handles floating point precision
- Rounds to 2 decimals
- Example: 100.50 + 200.75 = 301.25

**FinancialCalculator.subtract(a, b)**
- Subtracts b from a
- Handles floating point precision
- Rounds to 2 decimals
- Example: 500.00 - 123.45 = 376.55

**FinancialCalculator.multiply(a, b)**
- Multiplies two amounts
- Rounds to 2 decimals
- Example: 100 × 1.5 = 150.00

**FinancialCalculator.divide(a, b)**
- Divides a by b
- Handles division by zero (returns 0)
- Rounds to 2 decimals
- Example: 1000 ÷ 8 = 125.00

**FinancialCalculator.sum(amounts)**
- Sums array of amounts
- Uses add() for precision
- Returns total
- Example: [100, 200, 300] = 600

### Validation

**FinancialCalculator.getAllocationValidation(totalAmount, allocations)**
- Validates payment allocations
- Checks:
  - Total allocations = total amount
  - All allocations > 0
  - All projects have valid IDs
- Returns: {isValid, message}
- Used in fund management

**FinancialCalculator.calculateOutstandingBalance(originalAmount, settledAmount)**
- Calculates remaining loan balance
- Formula: originalAmount - settledAmount
- Rounds to 2 decimals
- Returns outstanding balance

### Budget Calculations

**FinancialCalculator.calculateBudgetUtilization(spent, budget)**
- Calculates percentage used
- Formula: (spent / budget) × 100
- Handles division by zero
- Returns percentage

**FinancialCalculator.calculateRemainingBudget(budget, spent)**
- Calculates remaining budget
- Formula: budget - spent
- Returns remaining amount
- Can be negative (over budget)

---

## AUTHENTICATION MODULE

### Login/Signup

**Auth.handleLogin(email, password)**
- Authenticates user with Firebase
- Validates email format
- Checks password length (min 6 chars)
- On success: redirects to dashboard
- On failure: shows error message

**Auth.handleSignup(email, password, confirmPassword)**
- Creates new user account
- Validates:
  - Email format
  - Password length (min 6 chars)
  - Password match
- Creates user document in Firestore
- Sets initial data:
  - premiumStatus: "FREE"
  - projectCredits: 0
  - createdAt: timestamp
- On success: redirects to dashboard
- On failure: shows error message

### Session Management

**Auth.checkAuthState()**
- Checks if user is logged in
- Redirects to login if not authenticated
- Used on protected pages
- Runs on page load

**Auth.logout()**
- Signs out user from Firebase
- Clears local storage
- Redirects to login page

### User Profile

**Auth.getCurrentUser()**
- Gets current logged-in user
- Returns: {uid, email, displayName}
- Returns null if not logged in

**Auth.updateUserProfile(updates)**
- Updates user profile
- Fields: displayName, photoURL
- Updates Firebase Auth profile
- Updates Firestore user document

---

## PREMIUM FEATURES MODULE

### Premium Status Check

**Premium.checkPremiumStatus()**
- Checks if user has active premium
- Special cases:
  - Admin (sulaimaansong6297@gmail.com): Always premium
  - Saqlain (saqlainmohammed1122@gmail.com): Premium features, pays project fee
- Checks Firestore:
  - premiumStatus field
  - premiumEnd date (not expired)
- Returns true/false

**Premium.getPremiumEndDate()**
- Gets premium subscription end date
- Returns Date object or null
- Used to show "Expires on..." message

### Premium Features Access

**Premium.canAccessFeature(featureName)**
- Checks if user can access specific premium feature
- Premium features:
  - Fund Management
  - Floor Plans
  - Extended Document Storage
  - Unlimited Projects
  - Priority Support
- Returns true/false

**Premium.showPremiumModal(featureName)**
- Shows "Upgrade to Premium" modal
- Displays:
  - Feature name
  - Benefits of premium
  - Pricing (₹199/month)
  - Upgrade button
- Redirects to upgrade page on click

### Project Credits

**Premium.getUserCredits()**
- Gets user's available project credits
- Free users: Need credits to create projects
- Premium users: Unlimited projects
- Returns credit count

**Premium.deductCredit()**
- Deducts 1 credit when creating project
- Updates Firestore user document
- Returns new credit count
- Throws error if no credits available

**Premium.addCredits(count)**
- Adds credits to user account
- Called after payment
- Updates Firestore
- Returns new credit count

---

## PHASE MANAGEMENT MODULE

### Phase CRUD

**PhaseManagement.createPhase(projectId, phaseData)**
- Creates new project phase
- Fields:
  - Name (e.g., "Foundation", "Structure")
  - Description
  - Start date
  - End date
  - Budget allocation
  - Status (not_started, in_progress, completed)
- Returns phase object

**PhaseManagement.getProjectPhases(projectId)**
- Gets all phases for project
- Sorts by start date
- Returns array of phases

**PhaseManagement.updatePhase(phaseId, updates)**
- Updates phase details
- Can update: name, dates, budget, status
- Returns updated phase

**PhaseManagement.deletePhase(phaseId)**
- Deletes phase
- Also deletes: checklists, worker assignments
- Returns true on success

### Phase Checklists

**PhaseManagement.addChecklistItem(phaseId, item)**
- Adds checklist item to phase
- Fields:
  - Description
  - Completed (true/false)
  - Assigned to (worker ID)
  - Due date
- Returns checklist item

**PhaseManagement.toggleChecklistItem(itemId)**
- Toggles completed status
- Updates timestamp
- Returns updated item

**PhaseManagement.getPhaseProgress(phaseId)**
- Calculates phase completion percentage
- Formula: (completed items / total items) × 100
- Returns percentage

### Phase Worker Assignment

**PhaseManagement.assignWorkerToPhase(phaseId, workerId)**
- Assigns worker to specific phase
- Creates phase_worker record
- Returns assignment object

**PhaseManagement.getPhaseWorkers(phaseId)**
- Gets all workers assigned to phase
- Returns array of worker objects

---

## DOCUMENT MANAGEMENT

### Document Upload

**DocumentManagement.uploadDocument(projectId, file, category, notes)**
- Uploads document to project
- Converts file to base64
- Max size: 5MB
- Supported types:
  - Images: jpg, png, gif, webp
  - PDF
  - Word: doc, docx
  - Excel: xls, xlsx
- Auto-compresses images if too large
- Stores: fileName, category, date, notes, base64Data
- Returns document object

**DocumentManagement.compressImage(base64, maxSizeKB)**
- Compresses image to fit size limit
- Reduces quality iteratively
- Maintains aspect ratio
- Returns compressed base64

### Document Viewing

**DocumentManagement.viewDocument(documentId)**
- Opens document viewer modal
- For images: Shows image preview
- For PDFs: Shows PDF viewer
- For others: Shows download button

**DocumentManagement.downloadDocument(documentId)**
- Downloads document to user's device
- Converts base64 to blob
- Triggers browser download
- Preserves original filename

### Document Organization

**DocumentManagement.getDocumentsByCategory(projectId, category)**
- Filters documents by category
- Categories:
  - Agreement
  - Drawing
  - Bill
  - BOQ (Bill of Quantities)
  - Invoice
  - Receipt
  - Photo
  - Other
- Returns filtered array

**DocumentManagement.searchDocuments(projectId, searchTerm)**
- Searches documents by filename or notes
- Case-insensitive search
- Returns matching documents

---

## REPORTING MODULE

### PDF Generation

**Reporting.generateProjectReport(projectId)**
- Creates comprehensive PDF report
- Includes:
  - Project header (name, client, dates)
  - Financial summary (budget, spent, remaining)
  - Materials table
  - Labour summary
  - Expenses table
  - Site logs
  - Client payments
- Auto-dated filename
- Downloads automatically

**Reporting.generateInvoice(type, projectId, items)**
- Creates invoice PDF
- Types: material, labour, expense, client_payment
- Includes:
  - Company logo
  - Invoice number (auto-generated)
  - Date
  - Client details
  - Itemized list
  - Totals
  - Payment terms
- Downloads automatically

### CSV Export

**Reporting.exportMaterialsCSV(projectId)**
- Exports materials to CSV
- Columns: Name, Category, Quantity, Unit, Rate, Total, Paid, Balance, Status, Date
- Downloads file

**Reporting.exportLabourCSV(projectId)**
- Exports labour to CSV
- Columns: Worker Name, Role, Days Worked, Daily Wage, Total Earned, Total Paid, Balance
- Downloads file

**Reporting.exportExpensesCSV(projectId)**
- Exports expenses to CSV
- Columns: Description, Category, Amount, Date
- Downloads file

### WhatsApp Sharing

**Reporting.shareProjectSummary(projectId)**
- Creates text summary of project
- Includes: budget, spent, materials count, labour count
- Opens WhatsApp with pre-filled message
- User can edit before sending

---

## COMPARISON MODULE

### Project Comparison

**Compare.compareProjects(projectIds)**
- Compares multiple projects side-by-side
- Metrics compared:
  - Budget
  - Spent
  - Remaining
  - Progress %
  - Days elapsed
  - Days remaining
  - Materials count
  - Labour count
  - Expenses count
- Returns comparison data

**Compare.renderComparisonChart()**
- Creates visual comparison chart
- Chart types:
  - Bar chart: Budget vs Spent
  - Line chart: Progress over time
  - Pie chart: Cost breakdown
- Uses Chart.js

---

This covers the additional modules and their functions. The system is comprehensive with over 200+ functions handling project management, financial tracking, labour management, document handling, and reporting.
