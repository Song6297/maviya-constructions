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
      
      // Notifications subcollection
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
      allow read, write: if isAuthenticated();
    }
    
    // =============================================
    // ALL DATA COLLECTIONS
    // Reads: any authenticated user
    // Writes: authenticated + admin
    // =============================================
    
    match /projects/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /materials/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /material_stock/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /material_transactions/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /labour/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /expenses/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /logs/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /documents/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /attendance/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /client_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /workers/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /worker_attendance/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /worker_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /worker_assignments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /vendors/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /vendor_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /project_wallets/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /payment_allocations/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /cross_project_transactions/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /settlement_records/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /unallocated_funds/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    // =============================================
    // BID ESTIMATOR
    // =============================================
    
    match /bid_analyses/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    // =============================================
    // PHASE MANAGEMENT COLLECTIONS
    // =============================================
    
    match /phases/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /phase_checklists/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /phase_workers/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    // =============================================
    // LABOUR CALENDAR COLLECTIONS
    // =============================================
    
    match /work_entries/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /labour_payments/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /meetings/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    match /work_type_rates/{docId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    
    // =============================================
    // PREMIUM & PROJECT FEE PAYMENTS
    // =============================================
    
    match /premiumPayments/{docId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated();
      allow update, delete: if isAdmin();
    }
    
    match /projectFeePayments/{docId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated();
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
    // NOTIFICATIONS
    // =============================================
    
    match /notifications/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAuthenticated();
      allow delete: if isAdmin();
    }
    
    match /user_notifications/{userId}/{notificationId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAdmin();
      allow update: if isAuthenticated() && request.auth.uid == userId;
    }
  }
}