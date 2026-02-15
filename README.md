# 📚 Attendance Tracker

A minimalist and elegant single-page web application to efficiently track student attendance. This tool is designed for teachers or administrators to manage student and subject data, mark attendance, and generate summaries with advanced features like cloud sync and dark mode.

## ✨ Features

### Core Features
* ✅ **Student & Subject Management**: Add students and subjects with bulk import support
* 📝 **Attendance Marking**: Mark present/absent for specific lectures and dates
* 📊 **Comprehensive Reports**: Student-wise, subject-wise, and custom summaries
* 💾 **Dual Storage**: Local storage (default) or Firebase cloud sync
* 📤 **Backup & Import**: Export/import data as JSON
* 📄 **PDF Export**: Download summaries as PDF files
* 📱 **Mobile Optimized**: Touch-friendly UI for smartphones (Tecno Camon 40 and others)
* 🌙 **Dark Mode**: Toggle themes with auto-save
* 👥 **Subject Enrollments**: Manage which students take which subjects
* 📈 **Analytics Dashboard**: Attendance patterns, trends, and insights
* 🚨 **Smart Alerts**: Identify students with low attendance

## 🚀 Quick Start

### Option 1: Local Storage Only (No Setup Required)

1. Download `index.html`
2. Open in any modern browser
3. Start tracking attendance!
   - Data stays on your device
   - No internet required

### Option 2: Firebase Cloud Sync (Requires Setup)

**⚠️ IMPORTANT: The Firebase credentials in the code are for DEMO purposes only and should NOT be used in production!**

#### Step 1: Create Your Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Follow setup wizard

#### Step 2: Get Your Configuration

1. In Firebase Console → Project Settings → General
2. Scroll to "Your apps" → Click web icon (`</>`)
3. Copy your configuration

#### Step 3: Update index.html

Open `index.html` and find this section (around line 1461):

```javascript
// ===================================================
// 🔐 CONFIGURATION - REPLACE WITH YOUR OWN VALUES
// ===================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Replace with your own Firebase config.

#### Step 4: Set Firebase Security Rules

In Firebase Console → Realtime Database → Rules:

**For testing (open access)**:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**For production (requires auth - recommended)**:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

#### Step 5: Change Storage Mode Password (Optional)

Find this section (around line 1710):

```javascript
// Storage mode authentication credentials
// Change these to your own values!
if (username !== 'YOUR_USERNAME') { // Default: 'mazhar'
    alert('❌ Invalid username');
    return;
}

if (password !== 'YOUR_PASSWORD') { // Default: '101426' or 'mazharodaF1'
    alert('❌ Invalid password');
    return;
}
```

## 🔒 Security Information

### Firebase API Keys Are Public - This Is Normal! ✅

**Don't panic!** Firebase API keys in client-side code are:
- **Meant to be public** - they identify your project
- **Not secret credentials** - they're like a CDN link
- **Safe in public repos** - Firebase's security model expects this

### Real Security Comes From Firebase Rules 🛡️

True security is controlled by Firebase Security Rules, not hiding API keys:

1. **Set up authentication** (email, Google, etc.)
2. **Write security rules** to control access
3. **Monitor usage** in Firebase Console
4. **Set budget alerts** to prevent abuse

See [SECURITY.md](SECURITY.md) for detailed security guidelines.

## 📖 Usage Guide

### 1. Add Students
Go to **Manage** tab → Enter name and roll number → Click "Add Student"
- Or bulk import from Excel/CSV

### 2. Add Subjects  
Go to **Manage** tab → Enter subject details → Click "Add Subject"

### 3. Manage Enrollments (Optional)
- Select a subject in "Manage Enrollments"
- By default, all students are enrolled
- Click "Drop" to exclude specific students from a subject
- Perfect for electives, split sections, etc.

### 4. Take Attendance
Go to **Take** tab:
1. Select subject
2. Choose date
3. Select lecture number (1st, 2nd, etc.)
4. All students preset as Absent
5. Click "Present" for attending students
6. Click "Save Attendance"

### 5. View Reports
- **Track**: View attendance history by subject and date
- **Analytics**: See patterns, trends, and insights
- **Alerts**: Find students with low attendance
- **Reports**: Generate detailed summaries (student-wise, subject-wise)
3. Select a subject
4. Click Enroll/Drop for each student

*Note: If no enrollments are set, all students appear in all subjects (backward compatible)*

**Technologies Used**
* HTML5: Provides the structure of the application
* CSS3: Custom styles with CSS variables for theming (light/dark mode)
* JavaScript (ES6+): Modern async/await patterns for data handling and user interactions
* jsPDF: Client-side library for generating PDF reports
* Firebase SDK (Optional): For real-time cloud storage and sync

**Data Storage Options**

1. **LocalStorage (Default)**: 
   - Works offline
   - No setup required
   - Data stored in browser

2. **Firebase Cloud Storage**:
   - Multi-device sync
   - Automatic cloud backup
   - Real-time updates
   - Requires setup - see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)

**Browser Compatibility**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Known Limitations**
- LocalStorage has ~5-10MB limit (adequate for 1000+ students)
- PDF export works best in Chrome/Edge
- Dark mode respects device settings
