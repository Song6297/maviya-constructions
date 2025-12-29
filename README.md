# Maviya Constructions - Construction Management System

A comprehensive web-based construction project management application designed for contractors and construction companies to manage projects, materials, labour, expenses, and client payments efficiently.

## 🚀 Features

### Project Management
- **Multi-Project Dashboard**: Manage multiple construction projects from a single interface
- **Project Status Tracking**: Planning, In Progress, On Hold, Completed
- **Timeline Management**: Track project start/end dates with deadline alerts
- **Progress Monitoring**: Automatic progress calculation based on timeline
- **Project Lock/Unlock**: Lock completed projects to prevent accidental changes

### Financial Management
- **Budget Tracking**: Set and monitor project budgets with real-time alerts
- **Budget Transfers**: Transfer funds between projects with full audit trail
- **Expense Tracking**: Record and categorize all project expenses
- **Payment Tracking**: Track payments for materials, labour, and client receipts
- **Balance Calculation**: Automatic calculation of paid amounts and outstanding balances

### Material Management
- **Material Inventory**: Track materials with quantity, unit, rate, and supplier details
- **Material Status**: Mark materials as "Used" or "Recovered"
- **Payment Tracking**: Record paid amounts and track balances for each material
- **Category Organization**: Organize materials by Structural, Finishing, Electrical, Plumbing, Hardware, etc.
- **Real-time Calculation**: Automatic total and balance calculation in material forms

### Labour Management
- **Worker Records**: Maintain detailed worker information with roles and wages
- **Attendance Tracking**: Mark daily attendance (Present/Absent)
- **Payment Tracking**: Track total wages, paid amounts, and outstanding balances
- **Role Management**: Foreman, Mason, Carpenter, Electrician, Plumber, Painter, Helper, etc.
- **Period Tracking**: Record start and end dates for each worker

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

## 🎨 Design

- **Modern UI**: Clean, professional interface with blue/teal theme
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Light Theme**: Easy on the eyes with sky-blue accent colors (#0EA5E9, #0284C7)
- **Intuitive Navigation**: Tab-based interface for easy access to all features
- **Visual Feedback**: Color-coded status indicators and progress bars

## 💾 Technology Stack

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **Backend**: Firebase (Authentication & Firestore Database)
- **Authentication**: Email/Password via Firebase Auth
- **Database**: Cloud Firestore (real-time NoSQL database)
- **Charts**: Chart.js for data visualization
- **PDF Generation**: jsPDF with autoTable plugin
- **Icons**: Font Awesome 6.4.0
- **Deployment**: Vercel (static hosting)

## 🔐 Authentication

The application uses Firebase Authentication with email/password:

1. **Sign Up**: Create a new account with email and password
2. **Login**: Access your account with credentials
3. **Password Reset**: Reset password via email
4. **Logout**: Securely sign out from the dashboard

All data is stored per-user in Firebase Firestore, ensuring data privacy and security.

## 📦 Installation

### Local Development

1. Clone or download the repository
2. Start a local HTTP server (required for ES6 modules):
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Or using Node.js
   npx serve
   ```
3. Open `http://localhost:8000` in your browser
4. Create an account or login to start using the app

**Note**: The app requires an HTTP server due to ES6 module imports. Opening `index.html` directly will not work.

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
├── index.html              # Main dashboard (requires auth)
├── login.html              # Login/Signup page
├── project.html            # Project detail page
├── materials.html          # Material stock management
├── payments.html           # Payment tracking
├── compare.html            # Project comparison
├── migrate.html            # Data migration tool
├── vercel.json            # Vercel configuration
├── css/
│   └── styles.css         # Custom styles
├── js/
│   ├── app.js             # Dashboard logic (Firebase)
│   ├── project.js         # Project detail logic (Firebase)
│   ├── storage.js         # localStorage utilities (legacy)
│   ├── firebase-config.js # Firebase configuration
│   ├── firebase-storage.js# Firebase Firestore adapter
│   ├── auth.js            # Authentication logic
│   ├── auth-header.js     # Auth header component
│   ├── materials-stock.js # Material stock logic (Firebase)
│   ├── payments.js        # Payment tracking logic (Firebase)
│   └── compare.js         # Comparison logic (Firebase)
└── README.md              # This file
```

## 🔧 Configuration

### Currency
The application uses Indian Rupees (₹) by default. To change currency:
1. Edit `js/storage.js` - Update `Utils.formatNumber()` function
2. Replace ₹ symbol throughout the codebase

### Material Categories
Edit `MATERIAL_CATEGORIES` array in `js/storage.js`:
```javascript
const MATERIAL_CATEGORIES = ['Structural', 'Finishing', 'Electrical', 'Plumbing', 'Hardware', 'Other'];
```

### Material Units
Edit `MATERIAL_UNITS` array in `js/storage.js`:
```javascript
const MATERIAL_UNITS = [
    { value: 'bags', label: 'Bags' },
    { value: 'kg', label: 'Kilograms' },
    // Add more units...
];
```

### Document Categories
Edit `DOC_CATEGORIES` array in `js/storage.js`:
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
1. Click "Export" dropdown in project header
2. Choose report type:
   - **Full Report**: Complete PDF with all project data
   - **Materials CSV**: Export materials data
   - **Labour CSV**: Export labour records
   - **Expenses CSV**: Export expenses
3. Or generate specific invoices from each tab

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
1. Update storage schema in `js/storage.js`
2. Add UI elements in respective HTML files
3. Implement logic in corresponding JS files
4. Test thoroughly before deployment

## 🤝 Support

For issues, questions, or feature requests, please contact the development team.

## 📈 Version History

### v1.0.0 (Current)
- Initial release
- Complete project management system
- Material, labour, and expense tracking
- Client payment management
- Document management
- PDF and CSV export
- Invoice generation
- Budget tracking and alerts
- Daily site logs
- Multi-project comparison

---

**Built with ❤️ for Maviya Constructions**
