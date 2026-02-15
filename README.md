# 📚 Attendance Tracker

A minimalist, elegant single-page web application for efficiently tracking student attendance. Designed for teachers and administrators to manage students, subjects, and attendance records with cloud sync capabilities.

## ✨ Features

* 👥 **Student & Subject Management** - Add, edit, and manage students with roll numbers
* 📝 **Smart Attendance Marking** - Mark attendance by lecture with preset absent mode for quick entry
* 📊 **Comprehensive Reports** - Generate student-wise, subject-wise, and roll-based summaries
* 💾 **Dual Storage Options** - Local storage (offline) or Firebase cloud sync (multi-device)
* 📤 **Data Portability** - Export/import attendance data as JSON backups
* 📄 **PDF Export** - Download attendance reports as PDF files
* 📱 **Mobile Optimized** - Touch-friendly interface designed for smartphones
* 🌙 **Dark Mode** - Auto-save theme preferences
* 👥 **Subject Enrollments** - Manage which students are enrolled in specific subjects
* 📈 **Analytics Dashboard** - View attendance patterns, trends, and insights
* 🔐 **Firebase Authentication** - Secure read/write access control with Firebase Auth

## 🛠️ Technologies Used

* **HTML5** - Application structure
* **CSS3** - Responsive styling with CSS variables for theming
* **JavaScript (ES6+)** - Async/await patterns, lazy loading, data caching
* **Firebase SDK** - Real-time database, authentication (lazy loaded for performance)
* **jsPDF** - Client-side PDF generation

## 🚀 Quick Start

### **Option 1: Local Storage (No Setup)**
1. Download `index.html`
2. Open in any modern browser
3. Start tracking attendance - data stays on your device

### **Option 2: Firebase Cloud Sync (Requires Setup)**
See [SETUP.md](SETUP.md) for complete Firebase configuration instructions.

## 📖 Usage

1. **Add Students** - Go to Manage tab → Enter name and roll number
2. **Add Subjects** - Go to Manage tab → Enter subject details
3. **Take Attendance** - Go to Take tab → Select subject, date, lecture → Mark present
4. **View Reports** - Go to Reports tab → Generate summaries and export PDFs

## 🌐 Browser Compatibility

* Chrome/Edge 90+
* Firefox 88+
* Safari 14+
* Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 License

Free to use for educational purposes.
