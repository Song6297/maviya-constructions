# Troubleshooting Guide

## Browser Console Warnings (Can be Ignored)

### ⚠️ "The message port closed before a response was received"
**What it is:** Browser extension warnings (not your code)
**Solution:** Ignore these - they're harmless

### ⚠️ "EXTENSION BaseContentPage init"
**What it is:** Browser extension messages
**Solution:** Ignore these - they're harmless

---

## Firebase Authentication Issues

### ❌ "auth/unauthorized-domain"
**Problem:** Domain not authorized in Firebase
**Solution:**
1. Go to Firebase Console → Authentication → Settings
2. Click "Authorized domains"
3. Add `localhost` or `localhost:8000`
4. Save and try again

### ❌ "auth/quota-exceeded"
**Problem:** Too many SMS sent (Firebase free tier limit)
**Solution:**
1. Wait 24 hours for quota reset
2. Or upgrade to Firebase Blaze plan
3. Or use test mode: `login-test.html`

### ❌ "auth/invalid-phone-number"
**Problem:** Phone number format incorrect
**Solution:**
- Use format: +91 followed by 10 digits
- Example: +91 9876543210
- Don't include spaces or dashes

### ❌ reCAPTCHA not showing
**Problem:** Domain not configured
**Solution:**
1. Check Firebase Console → Authentication → Sign-in method
2. Ensure Phone is enabled
3. Add your domain to authorized domains

---

## Development Issues

### ❌ CORS Error / Module Loading Failed
**Problem:** Opening HTML file directly (file://)
**Solution:** MUST use a local server:
```bash
python3 -m http.server 8000
```
Then open: http://localhost:8000/login.html

### ❌ Port 8000 already in use
**Solution:** Use different port:
```bash
python3 -m http.server 8080
```

### ❌ Firebase not initialized
**Problem:** Firebase config missing or incorrect
**Solution:**
1. Check `js/firebase-config.js` has correct config
2. Ensure all Firebase CDN links are loading
3. Check browser console for specific errors

---

## Testing Without Firebase

If you want to test the app without setting up Firebase:

1. Open: `login-test.html`
2. Click "Enter Test Mode"
3. This uses localStorage instead of Firebase

**Note:** Test mode is for development only!

---

## Quick Checks

✅ **Is server running?**
```bash
# Should see: Serving HTTP on :: port 8000
```

✅ **Is Firebase configured?**
- Authentication enabled?
- Phone provider enabled?
- Domain authorized?
- Firestore database created?

✅ **Browser console clear?**
- Open DevTools (F12)
- Check Console tab
- Look for red errors (ignore extension warnings)

---

## Still Having Issues?

1. **Clear browser cache:** Ctrl+Shift+Delete
2. **Try incognito mode:** Ctrl+Shift+N
3. **Check Firebase Console:** Look for error logs
4. **Use test mode:** Open `login-test.html`

---

## Common Firebase Console Steps

### Enable Phone Authentication:
1. Firebase Console → Authentication
2. Sign-in method tab
3. Click "Phone"
4. Toggle "Enable"
5. Save

### Add Authorized Domain:
1. Firebase Console → Authentication
2. Settings tab
3. Authorized domains section
4. Click "Add domain"
5. Enter: `localhost` or your domain
6. Save

### Create Firestore Database:
1. Firebase Console → Firestore Database
2. Click "Create database"
3. Choose "Start in production mode"
4. Select region
5. Click "Enable"

---

## Debug Mode

Add this to see detailed logs:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

Then refresh the page and check console for detailed logs.
