// ===================================================================
// 🔐 FIREBASE CONFIGURATION
// ===================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBzE7HH4XCQy_oySR-69MNH1KqmWsgMo6Q",
    authDomain: "attendance-tracker-c8d71.firebaseapp.com",
    databaseURL: "https://attendance-tracker-c8d71-default-rtdb.firebaseio.com",
    projectId: "attendance-tracker-c8d71",
    storageBucket: "attendance-tracker-c8d71.firebasestorage.app",
    messagingSenderId: "844159493317",
    appId: "1:844159493317:web:7250f6dc4d7540e0be3cac"
};

// ===================================================================
// 🚀 FIREBASE STATE
// ===================================================================
let db = null;
let auth = null;
let firebaseLoaded = false;
let firebaseLoadPromise = null;

// ===================================================================
// 🚀 LAZY FIREBASE INITIALIZATION
// ===================================================================
async function initializeFirebase() {
    if (firebaseLoaded && db) {
        return db;
    }

    if (firebaseLoadPromise) {
        return firebaseLoadPromise;
    }

    firebaseLoadPromise = (async () => {
        try {
            console.log('⏳ Loading Firebase SDK...');

            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js');

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            auth = firebase.auth();
            firebaseLoaded = true;
            console.log('✅ Firebase initialized successfully');
            return db;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            firebaseLoadPromise = null;
            throw error;
        }
    })();

    return firebaseLoadPromise;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

// ===================================================================
// 💾 CACHE LAYER
// ===================================================================
let studentsCache = null;
let subjectsCache = null;
let groupsCache = null;
let studentsCacheTime = 0;
let subjectsCacheTime = 0;
let groupsCacheTime = 0;
const CACHE_TTL = 300000;

function invalidateCache() {
    studentsCache = null;
    subjectsCache = null;
    groupsCache = null;
    studentsCacheTime = 0;
    subjectsCacheTime = 0;
    groupsCacheTime = 0;
}

// ===================================================================
// 💾 STORAGE MODE
// ===================================================================
let storageMode = localStorage.getItem('storageMode') || 'localStorage';
let firebaseAuthenticated = localStorage.getItem('firebaseAuthenticated') === 'true';
let currentUser = null;

// ===================================================================
// 🔐 FIREBASE AUTHENTICATION & STORAGE MODE SWITCHING
// ===================================================================
async function showFirebaseAuthPrompt() {
    const email = prompt('Enter your email:');
    if (!email) {
        updateStorageModeUI();
        return;
    }

    const password = prompt('Enter your password:');
    if (!password) {
        updateStorageModeUI();
        return;
    }

    try {
        await initializeFirebase();
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;

        console.log('✅ Authenticated as:', currentUser.email);
        console.log('🆔 UID:', currentUser.uid);

        if (currentUser.uid !== '8VzKT6ZxuAMHVMK6e8UaPjI4Iho2') {
            await auth.signOut();
            currentUser = null;
            alert('❌ You are not authorized to edit this database.');
            updateStorageModeUI();
            return;
        }

        firebaseAuthenticated = true;
        localStorage.setItem('firebaseAuthenticated', 'true');
        switchStorageMode('firebase');
    } catch (error) {
        console.error('Authentication failed:', error);
        alert(`❌ Login failed: ${error.message}`);
        updateStorageModeUI();
    }
}

async function switchStorageMode(mode) {
    if (mode === 'firebase' && !firebaseAuthenticated && storageMode !== 'firebase') {
        return;
    }

    if (mode === 'firebase') {
        if (!currentUser) {
            try {
                await initializeFirebase();
                currentUser = auth.currentUser;
                if (currentUser) {
                    console.log('✅ Session restored:', currentUser.email);
                }
            } catch (error) {
                console.log('No previous session found');
            }
        }
        firebaseAuthenticated = true;
        localStorage.setItem('firebaseAuthenticated', 'true');
    } else if (mode === 'localStorage') {
        firebaseAuthenticated = false;
        localStorage.removeItem('firebaseAuthenticated');
    }

    const oldMode = storageMode;
    storageMode = mode;
    localStorage.setItem('storageMode', mode);

    updateStorageModeUI();

    if (oldMode !== mode) {
        const migrate = confirm(`✅ Storage mode changed to ${mode === 'firebase' ? 'Firebase Cloud' : 'Local Storage'}.

Would you like to copy your current data to the new storage?`);
        if (migrate) {
            await migrateData(oldMode, mode);
        }
    }

    alert(`✅ Now using ${mode === 'firebase' ? 'Firebase Cloud ☁️' : 'Local Storage 💾'}`);
    location.reload();
}

async function migrateData(fromMode, toMode) {
    try {
        const tempMode = storageMode;
        storageMode = fromMode;

        const students = await getStudents();
        const subjects = await getSubjects();
        const groups = await getGroups();
        const attendance = await getAttendance();
        const enrollments = await getEnrollments();

        storageMode = toMode;

        await setStudents(students);
        await setSubjects(subjects);
        await setGroups(groups);
        await setAttendance(attendance);
        await setEnrollments(enrollments);

        storageMode = tempMode;

        alert('✅ Data migrated successfully!');
    } catch (error) {
        console.error('Migration error:', error);
        alert('⚠️ Error migrating data. Please try again.');
    }
}

function updateStorageModeUI() {
    const radios = document.getElementsByName('storage-mode');
    radios.forEach(radio => {
        radio.checked = radio.value === storageMode;
    });
    document.getElementById('current-storage-mode').textContent =
        storageMode === 'firebase' ? '☁️ Firebase Cloud' : '💾 Local Storage';
}

// ===================================================================
// 📥 DATA ACCESS FUNCTIONS
// ===================================================================
async function getStudents() {
    const now = Date.now();
    if (studentsCache && (now - studentsCacheTime < CACHE_TTL)) {
        return studentsCache;
    }

    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            const snapshot = await db.ref('students').once('value');
            studentsCache = snapshot.val() || [];
            studentsCacheTime = now;
            return studentsCache;
        } catch (error) {
            console.error('Error fetching students from Firebase:', error);
            throw error;
        }
    } else {
        studentsCache = JSON.parse(localStorage.getItem('students') || '[]');
        studentsCacheTime = now;
        return studentsCache;
    }
}

async function setStudents(students) {
    invalidateCache();
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            await db.ref('students').set(students);
        } catch (error) {
            console.error('Error saving students to Firebase:', error);
            throw error;
        }
    } else {
        localStorage.setItem('students', JSON.stringify(students));
    }
}

async function getSubjects() {
    const now = Date.now();
    if (subjectsCache && (now - subjectsCacheTime < CACHE_TTL)) {
        return subjectsCache;
    }

    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            const snapshot = await db.ref('subjects').once('value');
            subjectsCache = snapshot.val() || [];
            subjectsCacheTime = now;
            return subjectsCache;
        } catch (error) {
            console.error('Error fetching subjects from Firebase:', error);
            throw error;
        }
    } else {
        subjectsCache = JSON.parse(localStorage.getItem('subjects') || '[]');
        subjectsCacheTime = now;
        return subjectsCache;
    }
}

async function setSubjects(subjects) {
    invalidateCache();
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            await db.ref('subjects').set(subjects);
        } catch (error) {
            console.error('Error saving subjects to Firebase:', error);
            throw error;
        }
    } else {
        localStorage.setItem('subjects', JSON.stringify(subjects));
    }
}

async function getAttendance() {
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            const snapshot = await db.ref('attendance').once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error fetching attendance from Firebase:', error);
            throw error;
        }
    } else {
        return JSON.parse(localStorage.getItem('attendance') || '{}');
    }
}

async function setAttendance(attendance) {
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            await db.ref('attendance').set(attendance);
        } catch (error) {
            console.error('Error saving attendance to Firebase:', error);
            throw error;
        }
    } else {
        localStorage.setItem('attendance', JSON.stringify(attendance));
    }
}

async function getGroups() {
    const now = Date.now();
    if (groupsCache && (now - groupsCacheTime < CACHE_TTL)) {
        return groupsCache;
    }

    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            const snapshot = await db.ref('groups').once('value');
            groupsCache = snapshot.val() || [];
            groupsCacheTime = now;
            return groupsCache;
        } catch (error) {
            console.error('Error fetching groups from Firebase:', error);
            throw error;
        }
    } else {
        groupsCache = JSON.parse(localStorage.getItem('groups') || '[]');
        groupsCacheTime = now;
        return groupsCache;
    }
}

async function setGroups(groups) {
    invalidateCache();
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            await db.ref('groups').set(groups);
        } catch (error) {
            console.error('Error saving groups to Firebase:', error);
            throw error;
        }
    } else {
        localStorage.setItem('groups', JSON.stringify(groups));
    }
}

async function getEnrollments() {
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            const snapshot = await db.ref('enrollments').once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Error fetching enrollments from Firebase:', error);
            throw error;
        }
    } else {
        return JSON.parse(localStorage.getItem('enrollments') || '{}');
    }
}

async function setEnrollments(enrollments) {
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            await db.ref('enrollments').set(enrollments);
        } catch (error) {
            console.error('Error saving enrollments to Firebase:', error);
            throw error;
        }
    } else {
        localStorage.setItem('enrollments', JSON.stringify(enrollments));
    }
}

// ===================================================================
// 👥 ENROLLMENT MANAGEMENT
// ===================================================================
async function getEnrolledStudents(subjectId) {
    const enrollments = await getEnrollments();
    const allStudents = await getStudents();

    if (!enrollments[subjectId]) {
        return allStudents;
    }

    if (enrollments[subjectId].dropList) {
        return allStudents.filter(student =>
            !enrollments[subjectId].dropList.includes(student.roll)
        );
    }

    if (enrollments[subjectId].enrollList) {
        return allStudents.filter(student =>
            enrollments[subjectId].enrollList.includes(student.roll)
        );
    }

    return allStudents;
}

async function dropStudent(subjectId, studentRoll) {
    const enrollments = await getEnrollments();
    if (!enrollments[subjectId]) {
        enrollments[subjectId] = { dropList: [] };
    }
    if (!enrollments[subjectId].dropList) {
        enrollments[subjectId].dropList = [];
    }
    if (!enrollments[subjectId].dropList.includes(studentRoll)) {
        enrollments[subjectId].dropList.push(studentRoll);
        await setEnrollments(enrollments);
    }
}

async function enrollStudent(subjectId, studentRoll) {
    const enrollments = await getEnrollments();
    if (!enrollments[subjectId] || !enrollments[subjectId].dropList) {
        return;
    }
    enrollments[subjectId].dropList = enrollments[subjectId].dropList.filter(
        roll => roll !== studentRoll
    );
    if (enrollments[subjectId].dropList.length === 0) {
        delete enrollments[subjectId];
    }
    await setEnrollments(enrollments);
}

async function toggleEnrollment(subjectId, studentRoll) {
    const enrollments = await getEnrollments();
    const dropList = (enrollments[subjectId] && enrollments[subjectId].dropList) || [];
    const isDropped = dropList.includes(studentRoll);

    if (isDropped) {
        await enrollStudent(subjectId, studentRoll);
    } else {
        await dropStudent(subjectId, studentRoll);
    }
    await loadEnrollments();
}

// ===================================================================
// 💾 AUTO-BACKUP SYSTEM
// ===================================================================
const AUTO_BACKUP_INTERVAL_MS = 15 * 60 * 1000;
const AUTO_BACKUP_KEEP = 7;
let autoBackupTimer = null;

async function makeSnapshot() {
    return {
        ts: new Date().toISOString(),
        data: {
            students: await getStudents(),
            subjects: await getSubjects(),
            groups: await getGroups(),
            attendance: await getAttendance(),
            enrollments: await getEnrollments()
        }
    };
}

async function saveAutoBackup() {
    try {
        await initializeFirebase();
        const snapshot = await db.ref('autoBackups').once('value');
        const arr = snapshot.val() || [];
        arr.push(await makeSnapshot());

        while (arr.length > AUTO_BACKUP_KEEP) {
            arr.shift();
        }

        await db.ref('autoBackups').set(arr);
        console.log('✅ Auto-backup saved:', new Date().toLocaleString());
    } catch (e) {
        console.error('❌ Auto-backup failed:', e);
    }
}

function startAutoBackup() {
    if (autoBackupTimer) clearInterval(autoBackupTimer);
    saveAutoBackup();
    autoBackupTimer = setInterval(saveAutoBackup, AUTO_BACKUP_INTERVAL_MS);
    console.log(`🔄 Auto-backup enabled: Every ${AUTO_BACKUP_INTERVAL_MS / 60000} minutes, keeping last ${AUTO_BACKUP_KEEP} snapshots`);
}

async function listAutoBackups() {
    try {
        await initializeFirebase();
        const snapshot = await db.ref('autoBackups').once('value');
        return snapshot.val() || [];
    } catch (e) {
        return [];
    }
}

async function restoreAutoBackup(ts) {
    const backups = await listAutoBackups();
    const snap = backups.find(b => b.ts === ts);

    if (!snap) {
        alert('Backup not found');
        return false;
    }

    if (!confirm(`Restore backup from ${new Date(ts).toLocaleString()}?

This will replace all current data.`)) {
        return false;
    }

    try {
        // Defensive checks for backup data integrity
        const data = snap.data || {};
        if (Array.isArray(data.students)) await setStudents(data.students);
        if (Array.isArray(data.subjects)) await setSubjects(data.subjects);
        if (Array.isArray(data.groups)) await setGroups(data.groups);
        if (data.attendance) await setAttendance(data.attendance);
        if (data.enrollments) await setEnrollments(data.enrollments);

        showMessage(document.getElementById('manage-message'), `✅ Backup restored from ${new Date(ts).toLocaleString()}`, 'success');
        loadCurrentStudents();
        loadCurrentSubjects();
        return true;
    } catch (e) {
        alert('Failed to restore backup: ' + e.message);
        return false;
    }
}

async function deleteAutoBackup(ts) {
    if (!confirm(`Delete backup from ${new Date(ts).toLocaleString()}?`)) {
        return;
    }

    try {
        const backups = await listAutoBackups();
        const filtered = backups.filter(b => b.ts !== ts);
        await initializeFirebase();
        await db.ref('autoBackups').set(filtered);
        showAutoBackups();
        showMessage(document.getElementById('manage-message'), '✅ Backup deleted', 'success');
    } catch (e) {
        alert('Failed to delete backup: ' + e.message);
    }
}

// ===================================================================
// 📤 EXPORT / IMPORT BACKUP
// ===================================================================
async function exportData() {
    showLoading('💾 Exporting backup...');
    try {
        const data = {
            students: await getStudents(),
            subjects: await getSubjects(),
            groups: await getGroups(),
            attendance: await getAttendance(),
            enrollments: await getEnrollments(),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } finally {
        hideLoading();
    }
}

function importData() {
    document.getElementById('import-file').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const messageDiv = document.getElementById('manage-message');

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.students && !data.subjects && !data.attendance) {
                showMessage(messageDiv, '❌ Invalid backup file: No data found', 'error');
                return;
            }

            const preview = `
📊 Backup Preview:
• Students: ${data.students?.length || 0}
• Subjects: ${data.subjects?.length || 0}
• Attendance Records: ${Object.keys(data.attendance || {}).length}
• Enrollments: ${data.enrollments ? 'Yes' : 'No'}
• Export Date: ${data.exportDate ? new Date(data.exportDate).toLocaleString() : 'Unknown'}

⚠️ This will REPLACE all current data!
`;

            if (confirm(preview + '

Do you want to continue?')) {
                showLoading('📁 Importing data...');
                showMessage(messageDiv, '⏳ Importing data to Firebase...', 'success');

                let imported = [];

                if (data.students && Array.isArray(data.students)) {
                    const updatedStudents = data.students.map(s => ({ ...s, groups: s.groups || [] }));
                    await setStudents(updatedStudents);
                    imported.push(`${data.students.length} students`);
                }

                if (data.subjects && Array.isArray(data.subjects)) {
                    await setSubjects(data.subjects);
                    imported.push(`${data.subjects.length} subjects`);
                }

                if (data.groups && Array.isArray(data.groups)) {
                    await setGroups(data.groups);
                    imported.push(`${data.groups.length} groups`);
                }

                if (data.attendance && typeof data.attendance === 'object') {
                    await setAttendance(data.attendance);
                    imported.push(`${Object.keys(data.attendance).length} attendance records`);
                }

                if (data.enrollments && typeof data.enrollments === 'object') {
                    const convertedEnrollments = {};
                    for (const [subjectId, value] of Object.entries(data.enrollments)) {
                        if (Array.isArray(value)) {
                            const allStudents = data.students || [];
                            const enrolledRolls = value;
                            const droppedRolls = allStudents
                                .map(s => s.roll)
                                .filter(roll => !enrolledRolls.includes(roll));
                            if (droppedRolls.length > 0) {
                                convertedEnrollments[subjectId] = { dropList: droppedRolls };
                            }
                        } else if (value.dropList || value.enrollList) {
                            convertedEnrollments[subjectId] = value;
                        }
                    }
                    await setEnrollments(convertedEnrollments);
                    imported.push(`${Object.keys(convertedEnrollments).length} enrollment settings`);
                }

                await loadCurrentStudents();
                await loadCurrentSubjects();
                await loadSubjects('enrollment-subject');

                showMessage(messageDiv,
                    `✅ Successfully imported: ${imported.join(', ')}`,
                    'success'
                );

                hideLoading();
                event.target.value = '';
            }
        } catch (error) {
            hideLoading();
            showMessage(messageDiv, '❌ Invalid JSON file: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ===================================================================
// 🔢 UTILITY
// ===================================================================
function normalizeRollNumber(value) {
    return String(value || '').trim();
}
