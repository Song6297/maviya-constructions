# How to Run Maviya Constructions

## ⚠️ Important: You MUST use a local server

ES6 modules (import/export) don't work with `file://` protocol. You need to run a local web server.

## 🚀 Quick Start (3 Methods)

### Method 1: Using the Start Script (Easiest)

```bash
./start-server.sh
```

Then open: **http://localhost:8000/login.html**

### Method 2: Using Python Directly

```bash
python3 -m http.server 8000
```

Then open: **http://localhost:8000/login.html**

### Method 3: Using npm (if you have Node.js)

```bash
npm start
```

Then open: **http://localhost:8000/login.html**

## 📱 Testing on Mobile

1. Find your computer's IP address:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. Open on mobile: **http://YOUR_IP:8000/login.html**

## 🔥 Firebase Setup Required

Before testing, make sure you've:

1. ✅ Enabled Phone Authentication in Firebase Console
2. ✅ Created Firestore Database
3. ✅ Added `localhost:8000` to authorized domains
4. ✅ Applied Firestore security rules

See `FIREBASE_SETUP.md` for detailed instructions.

## 🌐 For Production Deployment

Deploy to:
- **Vercel** (Recommended): `vercel deploy`
- **Firebase Hosting**: `firebase deploy`
- **Netlify**: Drag & drop the folder

## 🛑 To Stop the Server

Press `Ctrl + C` in the terminal

## 📝 Pages to Test

- Login: http://localhost:8000/login.html
- Dashboard: http://localhost:8000/index.html
- Migration: http://localhost:8000/migrate.html

## ❓ Troubleshooting

**Problem**: Port 8000 already in use
**Solution**: Use a different port:
```bash
python3 -m http.server 8080
```

**Problem**: Firebase errors
**Solution**: Check Firebase Console configuration

**Problem**: reCAPTCHA not showing
**Solution**: Add localhost to authorized domains in Firebase
