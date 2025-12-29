# Firebase Setup Guide

## Firebase Console Configuration

### 1. Enable Email/Password Authentication

1. Go to Firebase Console → Authentication
2. Click "Get Started"
3. Click "Sign-in method" tab
4. Enable "Email/Password" sign-in method
5. Toggle "Enable"
6. Save

### 2. Enable Firestore Database

1. Go to Firestore Database
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your region
5. Click "Enable"

### 3. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // All collections require authentication and user ownership
    match /{collection}/{document} {
      allow read, write: if isAuthenticated() && 
                           resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated();
    }
  }
}
```

### 4. Deploy the Application

Upload all files to your hosting (Vercel, Firebase Hosting, etc.)

## Testing Locally

1. Start local server:
   ```bash
   python3 -m http.server 8000
   ```

2. Open: http://localhost:8000/login.html

3. Create an account or login

## Features

✅ **Email/Password Authentication**
- Sign up with email and password
- Login with existing account
- Password reset via email
- Secure authentication

✅ **No SMS Required**
- No phone number needed
- No SMS costs
- Works everywhere

✅ **Password Reset**
- Forgot password feature
- Reset link sent to email
- Secure password recovery

## Testing

1. Open `login.html`
2. Click "Sign Up" tab
3. Enter email and password
4. Create account
5. Login with credentials

## Migration

Use `migrate.html` to transfer data from localStorage to Firebase.
