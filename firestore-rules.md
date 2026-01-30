# Firebase Firestore Security Rules

Copy the rules below and paste them into Firebase Console → Firestore Database → Rules → Publish

**Last Updated:** January 14, 2026

---

## Complete Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // =============================================
    // HELPER FUNCTIONS
    // =============================================
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'sulaimaansong6297@gmail.com';
    }
    
    function isOwner() {
      return request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    function isCreatingOwn() {
      return request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // =============================================
    // USERS COLLECTION
    // =============================================
    
    match /users/{userId} {
      allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
      
      // Notifications subcollection - Admin can send to any user
      match /notifications/{notificationId} {
        allow read: if isAuthenticated() && request.auth.uid == userId;
        allow create: if isAdmin();
        allow update: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
        allow delete: if isAdmin();
      }
    }
    
    // =============================================
    // USER PREFERENCES
    // =============================================
    
    match /user_preferences/{docId} {
      allow read, write: if isAuthenticated() && (resource == null || resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
    }
    
    // =============================================
    // FLAT COLLECTIONS WITH userId FIELD
    // =============================================
    
    match /projects/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /materials/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /material_stock/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /labour/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /expenses/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /logs/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /documents/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /attendance/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /client_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /workers/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /worker_attendance/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /worker_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /worker_assignments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /vendors/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /vendor_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /project_wallets/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /payment_allocations/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /cross_project_transactions/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /settlement_records/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /unallocated_funds/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    // =============================================
    // PHASE MANAGEMENT COLLECTIONS
    // =============================================
    
    match /phases/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /phase_checklists/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /phase_workers/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    // =============================================
    // LABOUR CALENDAR COLLECTIONS
    // =============================================
    
    match /work_entries/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /labour_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /meetings/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    match /work_type_rates/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && isCreatingOwn();
      allow update, delete: if isAuthenticated() && (isOwner() || isAdmin());
    }
    
    // =============================================
    // PREMIUM & PROJECT FEE PAYMENTS
    // =============================================
    
    match /premiumPayments/{docId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow update, delete: if isAdmin();
    }
    
    match /projectFeePayments/{docId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow update, delete: if isAdmin();
    }
    
    // =============================================
    // GLOBAL/SHARED COLLECTIONS
    // =============================================
    
    match /materials_stock/{docId} {
      allow read, write: if isAuthenticated();
    }
    
    // =============================================
    // ADMIN-ONLY COLLECTIONS
    // =============================================
    
    match /admin_logs/{docId} {
      allow read, write: if isAdmin();
    }
    
    match /system_settings/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    match /broadcasts/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // =============================================
    // NOTIFICATIONS COLLECTION (Global)
    // =============================================
    
    match /notifications/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAuthenticated() && (isAdmin() || resource.data.recipientId == request.auth.uid);
      allow delete: if isAdmin();
    }
    
    // =============================================
    // USER NOTIFICATIONS (Alternative path)
    // =============================================
    
    match /user_notifications/{userId}/{notificationId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAdmin();
      allow update: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}
```

---

## Collections Summary

| Collection | Purpose |
|------------|---------|
| `users` | User profiles and settings |
| `user_preferences` | User UI preferences |
| `projects` | Construction projects |
| `materials` | Project materials |
| `material_stock` | Material inventory |
| `labour` | Legacy labour records |
| `expenses` | Project expenses |
| `logs` | Daily logs |
| `documents` | Project documents |
| `payments` | General payments |
| `attendance` | Legacy attendance |
| `client_payments` | Client payment records |
| `workers` | Worker master database |
| `worker_attendance` | Legacy worker attendance |
| `worker_payments` | Legacy worker payments |
| `worker_assignments` | Worker-project assignments |
| `vendors` | Vendor records |
| `vendor_payments` | Vendor payment records |
| `project_wallets` | Project fund wallets |
| `payment_allocations` | Payment distribution |
| `cross_project_transactions` | Inter-project loans |
| `settlement_records` | Loan settlements |
| `unallocated_funds` | Pending allocations |
| `phases` | Project phases |
| `phase_checklists` | Phase checklist items |
| `phase_workers` | Phase worker assignments |
| `work_entries` | Labour Calendar - work entries |
| `labour_payments` | Labour Calendar - payments |
| `meetings` | Labour Calendar - meetings |
| `work_type_rates` | Hourly rates by work type |
| `premiumPayments` | Premium subscription payments |
| `projectFeePayments` | Project fee payments |
| `materials_stock` | Global material stock |
| `admin_logs` | Admin activity logs |
| `system_settings` | System configuration |
| `broadcasts` | Admin broadcasts |
| `notifications` | Global notifications |
| `user_notifications` | User-specific notifications |

---

## How to Update

1. Open Firebase Console
2. Go to Firestore Database → Rules
3. Copy the rules from the "Complete Rules" section above
4. Click "Publish"
5. Wait for deployment (usually 1-2 minutes)
