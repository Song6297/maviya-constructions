# B&B - Bricks & Bits | Smart Construction Management

A comprehensive web-based construction project management application designed for contractors and construction companies to manage projects, materials, labour, expenses, and client payments efficiently.

## 🚀 Features

### Project Management
- **Multi-Project Dashboard**: Manage multiple construction projects from a single interface
- **Project Status Tracking**: Planning, In Progress, On Hold, Completed
- **Timeline Management**: Track project start/end dates with deadline alerts
- **Progress Monitoring**: Automatic progress calculation based on timeline
- **Project Lock/Unlock**: Lock completed projects to prevent accidental changes
- **Phase Management**: Break projects into phases with checklists and progress tracking

### Financial Management
- **Budget Tracking**: Set and monitor project budgets with real-time alerts
- **Budget Transfers**: Transfer funds between projects with full audit trail
- **Expense Tracking**: Record and categorize all project expenses
- **Payment Tracking**: Track payments for materials, labour, and client receipts
- **Balance Calculation**: Automatic calculation of paid amounts and outstanding balances
- **Financial Calculator**: Advanced calculations for project finances
- **Fund Management**: Centralized fund pool with multi-project allocation (Premium)

### Material Management
- **Material Inventory**: Track materials with quantity, unit, rate, and supplier details
- **Material Status**: Mark materials as "Used" or "Recovered"
- **Payment Tracking**: Record paid amounts and track balances for each material
- **Category Organization**: Organize materials by Structural, Finishing, Electrical, Plumbing, Hardware, etc.
- **Real-time Calculation**: Automatic total and balance calculation in material forms

### Labour Calendar System
- **Calendar View**: Visual calendar for tracking daily work entries
- **Attendance Marking**: Mark Present/Half-Day/Absent for multiple workers at once
- **Work Entry Tracking**: Record daily work with automatic earnings calculation
- **Payment Management**: Track labour payments with FIFO-based date tracking
- **Paid/Unpaid Dates**: See exactly which dates are paid vs unpaid per worker
- **Meeting Scheduler**: Schedule and track site meetings
- **Work Type Rates**: Configure rates for different work types
- **Project Integration**: View labour summary with date details in project view

### Vendor Management
- **Vendor Services**: Track vendors providing services to projects
- **Service Categories**: Electrical, Plumbing, Painting, Carpentry, etc.
- **Payment Tracking**: Monitor vendor payments and balances
- **Contact Management**: Store vendor contact information

### Client Payment Management
- **Payment Receipts**: Record all client payments with complete details
- **Payment Methods**: Cash, Bank Transfer, Cheque, UPI, Other
- **Receipt Details**: Track who received payment and from whom
- **Payment Summary**: View total budget, received amount, and pending balance

### Document Management
- **File Upload**: Upload and store project documents (images, PDFs, Word, Excel)
- **Document Categories**: Agreement, Drawing, Bill, BOQ, Invoice, Receipt, Photo, Other
- **Document Date**: Track when documents were created
- **Preview**: View images and PDFs directly in the app
- **Notes**: Add notes to each document

### Company Branding
- **Company Logo**: Upload and display company logo across the app
- **Logo on Banners**: Logo appears on Hub, Dashboard, and Labour Calendar
- **Auto-Compression**: Images automatically compressed to fit storage limits
- **Profile Picture**: Custom profile picture with initials fallback

### Reporting & Export
- **PDF Reports**: Generate comprehensive project reports with all data
- **Invoice Generation**: Create professional invoices for materials, labour, expenses, and client payments
- **CSV Export**: Export materials, labour, and expenses data to CSV
- **WhatsApp Sharing**: Share project data directly via WhatsApp
- **Auto-dated Reports**: All exports include current date and time

### Daily Site Logs
- **Work Description**: Record daily work completed
- **Issues & Delays**: Track problems and delays
- **Notes**: Add additional observations
- **Date-based Organization**: Logs sorted by date

### Analytics & Visualization
- **Budget Health Meter**: Visual indicator of budget utilization
- **Expense Breakdown Chart**: Pie chart showing materials, labour, and expenses distribution
- **Budget vs Spent Chart**: Bar chart comparing budget and actual spending
- **Financial Overview**: Quick view of budget, spent, remaining, and client payments

### Alerts & Notifications
- **Budget Alerts**: Warnings at 80%, 90%, and 100%+ budget usage
- **Deadline Alerts**: Notifications for approaching and overdue deadlines
- **Toast Notifications**: Real-time feedback for all actions
- **Image Compression Alerts**: Notifications when images are compressed

### Premium Features (₹199/month)
- **Unlimited Projects**: No per-project fees
- **Fund Management**: Centralized fund pool across projects
- **Floor Plans**: View and manage floor plan documents
- **Document Storage**: Extended document storage
- **Priority Support**: Faster response times

## 🎨 Design & Branding (NEW v3.0)

- **Construction Theme**: A bold, high-contrast palette of Construction Yellow (#F7B500) and Deep Black (#1A1A1A).
- **Modern UI**: Clean, card-based professional interface inspired by industrial design.
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices.
- **Interactive Animations**: Smooth transitions, loading animations (Brick & Bits loader), and hover states.
- **Visual Feedback**: Real-time color-coded status indicators and dynamic progress bars.

## 💾 Technology Stack

- **Frontend**: HTML5, CSS3 (Vanilla CSS + Tailwind CSS utilities), JavaScript (ES6+)
- **Backend**: Firebase (Authentication & Firestore Database)
- **Authentication**: Email/Password via Firebase Auth
- **Database**: Cloud Firestore (real-time NoSQL database)
- **Charts**: Chart.js for data visualization
- **PDF Generation**: jsPDF with autoTable plugin
- **Icons**: Font Awesome 6.4.0
- **Deployment**: Vercel (static hosting)

## 📦 Installation

### Local Development

1. Clone or download the repository
2. Start a local HTTP server:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Or using Node.js
   npx serve
   ```
3. Open `http://localhost:8000` in your browser. (The app starts at the landing page, `index.html`)

**Note**: The app requires an HTTP server due to ES6 module imports. 

### Deployment to Vercel

1. Install Vercel CLI (optional):
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Or connect your GitHub repository to Vercel for automatic deployments

## 📁 Project Structure

```
maviya-constructions/
├── index.html              # Main Landing Page (v3.0)
├── dashboard.html          # App Dashboard (requires auth)
├── login.html              # Login/Signup page
├── project.html            # Project detail page
├── materials.html          # Material stock management
├── payments.html           # Payment tracking
├── hub.html                # Workspace Hub
├── css/
│   ├── styles-professional.css # Main Construction Professional Theme
│   ├── styles-construction.css  # Alternate Construction styling
│   └── logo-loader.css    # Custom Brick & Bits loader animation
├── js/
│   ├── app.js             # Dashboard logic
│   ├── project.js         # Project detail logic
│   ├── firebase-config.js # Firebase configuration
│   ├── firebase-storage.js# Firebase Firestore adapter
│   ├── auth.js            # Authentication logic
│   ├── auth-header.js     # Auth header component
│   ├── auth-check.js      # Auth state checker
│   ├── materials-stock.js # Material stock logic (Firebase)
│   ├── payments.js        # Payment tracking logic (Firebase)
│   ├── compare.js         # Comparison logic (Firebase)
│   ├── fund-management.js # Fund management system
│   ├── worker-management.js # Worker management
│   ├── labour-calendar.js # Labour calendar system
│   ├── vendor-management.js # Vendor management
│   ├── phase-management.js # Project phases
│   ├── financial-calculator.js # Financial calculations
│   ├── premium.js         # Premium features
│   ├── sidebar-dropdown.js # Sidebar navigation
│   └── user-preferences.js # User preferences
└── README.md              # This file
```

## 🔧 Configuration

### Currency
The application uses Indian Rupees (₹) by default. To change currency:
1. Edit `js/firebase-storage.js` - Update `Utils.formatNumber()` function
2. Replace ₹ symbol throughout the codebase

### Material Categories
Edit `MATERIAL_CATEGORIES` array in `js/firebase-storage.js`:
```javascript
const MATERIAL_CATEGORIES = ['Structural', 'Finishing', 'Electrical', 'Plumbing', 'Hardware', 'Other'];
```

### Material Units
Edit `MATERIAL_UNITS` array in `js/firebase-storage.js`:
```javascript
const MATERIAL_UNITS = [
    { value: 'bags', label: 'Bags' },
    { value: 'kg', label: 'Kilograms' },
    // Add more units...
];
```

### Document Categories
Edit `DOC_CATEGORIES` array in `js/firebase-storage.js`:
```javascript
const DOC_CATEGORIES = ['Agreement', 'Drawing', 'Bill', 'BOQ', 'Invoice', 'Receipt', 'Photo', 'Other'];
```

## 📱 Usage Guide

### Creating a Project
1. Click "New Project" on the dashboard
2. Fill in project details (name, client, location, budget, dates)
3. Select project status
4. Click "Create Project"

### Adding Materials
1. Open a project
2. Go to "Materials" tab
3. Click "Add Material"
4. Select material, enter quantity, rate, and payment details
5. System automatically calculates total and balance

### Recording Labour
1. Go to "Labour" tab
2. Click "Add Worker"
3. Enter worker details, daily wage, and total amount
4. Record paid amount to track balance
5. Mark attendance daily (Present/Absent)

### Tracking Expenses
1. Go to "Expenses" tab
2. Click "Add Expense"
3. Enter description, category, amount, and date
4. View total expenses at the bottom

### Client Payments
1. Go to "Summary" tab
2. Click "Add Payment" in Client Payments section
3. Enter amount, date, received by, from, and payment method
4. View payment summary with total received and pending

### Generating Reports
11. Click "Export" dropdown in project header
12. Choose report type:
    - **Full Report**: Complete PDF with all project data
    - **Materials CSV**: Export materials data
    - **Labour CSV**: Export labour records
    - **Expenses CSV**: Export expenses
13. Or generate specific invoices from each tab

### Completing a Project
1. Edit project details
2. Change status to "Completed"
3. Project will be locked automatically
4. Click "Re-open" to make changes if needed

## 🔒 Data Storage

- All data is stored in Firebase Firestore (cloud database)
- Data is synced across all devices when logged in
- Each user's data is isolated and secure
- Real-time updates across browser tabs
- Automatic backup in Firebase

### Firebase Security Rules
Make sure to set up proper Firestore security rules in Firebase Console:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## 🌐 Browser Support

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Opera: ✅ Fully supported
- IE11: ❌ Not supported

## 📊 Data Limits

- localStorage limit: ~5-10MB per domain (browser dependent)
- Recommended: Max 50-100 projects for optimal performance
- Document uploads: Max 5MB per file
- Supported file types: Images, PDF, Word, Excel

## 🛠️ Troubleshooting

### Data Not Saving
- Check if localStorage is enabled in browser
- Ensure you're not in private/incognito mode
- Check browser storage quota

### PDF Not Generating
- Ensure jsPDF library is loaded
- Check browser console for errors
- Try refreshing the page

### Images Not Displaying
- Check file size (max 5MB)
- Ensure file format is supported
- Try a different image format

## 🔄 Updates & Maintenance

### Clearing Old Data
```javascript
// Open browser console and run:
localStorage.clear();
```

### Exporting Data (Backup)
```javascript
// Open browser console and run:
const backup = {};
for (let key in localStorage) {
    if (key.startsWith('contractorhub_')) {
        backup[key] = localStorage[key];
    }
}
console.log(JSON.stringify(backup));
// Copy the output and save to a file
```

### Importing Data (Restore)
```javascript
// Open browser console and run:
const backup = /* paste your backup JSON here */;
for (let key in backup) {
    localStorage.setItem(key, backup[key]);
}
location.reload();
```

## 📝 License

This project is proprietary software developed for Maviya Constructions.

## 👨‍💻 Development

### Code Style
- ES6+ JavaScript
- Functional programming approach
- No external dependencies (except UI libraries)
- Modular code organization

### Adding New Features
1. Update storage schema in `js/firebase-storage.js`
2. Add UI elements in respective HTML files
3. Implement logic in corresponding JS files
4. Test thoroughly before deployment

## 🤝 Support

For issues, questions, or feature requests, please contact the development team.

## 📈 Version History

### v3.0.0 (February 2026) - Current Release
**Construction Rebranding & Landing Page**
- **New Brand Identity**: Rebranded as **B&B - Bricks & Bits** with a full Construction Yellow/Black theme.
- **Landing Page Redesign**: Commercially focused `index.html` with hero, features, testimonials, and company info.
- **Structural Update**: `index.html` is now the landing page; the old dashboard is now `dashboard.html`.
- **Green Purge**: Removed all remnants of the previous green theme across HTML, CSS, and JS.
- **UI Consistency**: Standardized cards, loaders, and status indicators globally.

### v2.1.0 (January 2026)
**Labour Calendar System**
- Calendar-centric labour management with daily work tracking.
- Mark attendance (Present/Half-Day/Absent) for multiple workers at once.
- Labour payments with FIFO-based paid/unpaid date tracking.
- Meeting scheduler for site meetings.

### v2.0.0 (2024)
- Firebase migration from localStorage.
- Multi-user authentication.
- Cloud data sync across devices.

### v1.0.0 (Initial)
- Initial release with complete project management system.

---

**Built with ❤️ for Maviya Constructions**
