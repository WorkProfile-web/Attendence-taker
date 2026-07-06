// ===================================================================
// 🌐 GLOBAL STATE
// ===================================================================
let selectedLecture = null;
let currentAttendance = {};
let lastSavedAttendance = null;

// ===================================================================
// 🌙 DARK MODE
// ===================================================================
async function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    if (storageMode === 'firebase' && firebaseLoaded && db) {
        try {
            await db.ref('settings/darkMode').set(isDark);
        } catch (error) {
            console.log('Could not save dark mode preference:', error);
        }
    }
    document.getElementById('theme-icon').textContent = isDark ? '☀️' : '🌙';
}

async function loadDarkModePreference() {
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            const snapshot = await db.ref('settings/darkMode').once('value');
            const isDark = snapshot.val();
            if (isDark) {
                document.body.classList.add('dark-mode');
                document.getElementById('theme-icon').textContent = '☀️';
            }
        } catch (error) {
            console.log('Could not load dark mode preference:', error);
        }
    }
}

// ===================================================================
// 📝 ATTENDANCE - BULK ACTIONS
// ===================================================================
async function markAllPresent() {
    const subjectId = document.getElementById('subject-select').value;
    const students = await getEnrolledStudents(subjectId);
    students.forEach(student => {
        currentAttendance[student.roll] = 'present';
    });
    await loadStudentsForAttendance();
}

async function markAllAbsent() {
    const subjectId = document.getElementById('subject-select').value;
    const students = await getEnrolledStudents(subjectId);
    students.forEach(student => {
        currentAttendance[student.roll] = 'absent';
    });
    await loadStudentsForAttendance();
}

// ===================================================================
// ↩️ UNDO ATTENDANCE
// ===================================================================
async function undoLastAttendance() {
    if (!lastSavedAttendance) {
        alert('No recent attendance to undo');
        return;
    }

    if (confirm('Are you sure you want to undo the last saved attendance?')) {
        const attendance = await getAttendance();
        delete attendance[lastSavedAttendance.key];
        await setAttendance(attendance);

        const messageDiv = document.getElementById('attendance-message');
        showMessage(messageDiv, `✅ Attendance undone for ${lastSavedAttendance.subject} - ${lastSavedAttendance.date}`, 'success');
        lastSavedAttendance = null;
    }
}

// ===================================================================
// 📐 COLLAPSIBLE SECTIONS (Manage tab)
// ===================================================================
function toggleSection(sectionId) {
    const content = document.getElementById(sectionId);
    if (!content) return;
    const header = content.previousElementSibling;
    const chevron = header ? header.querySelector('.chevron') : null;

    content.classList.toggle('expanded');
    if (chevron) {
        chevron.classList.toggle('rotated');
    }

    // Store expanded state
    const expandedSections = JSON.parse(sessionStorage.getItem('manageExpanded') || '{}');
    expandedSections[sectionId] = content.classList.contains('expanded');
    sessionStorage.setItem('manageExpanded', JSON.stringify(expandedSections));
}

function restoreSectionStates() {
    try {
        const expandedSections = JSON.parse(sessionStorage.getItem('manageExpanded') || '{}');
        Object.entries(expandedSections).forEach(([id, isExpanded]) => {
            const content = document.getElementById(id);
            if (content && isExpanded) {
                content.classList.add('expanded');
                const header = content.previousElementSibling;
                const chevron = header ? header.querySelector('.chevron') : null;
                if (chevron) chevron.classList.add('rotated');
            }
        });
    } catch (e) { /* ignore */ }
}

// ===================================================================
// 📐 TAB SWITCHING
// ===================================================================
async function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab:nth-child(${getTabIndex(tabName)})`).classList.add('active');

    if (tabName === 'attendance') {
        await loadSubjects('subject-select');
        setTodayDate();
        selectedLecture = null;
        document.querySelectorAll('.lecture-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('lecture-info').textContent = 'Select lecture number first';
        await loadGroups('attendance-group-filter');
    } else if (tabName === 'track') {
        await loadSubjects('track-subject');
        await loadGroups('track-group-filter');
    } else if (tabName === 'analytics') {
        await loadSubjects('analytics-subject');
        await loadGroups('analytics-group-filter');
        await showAnalytics();
    } else if (tabName === 'summary') {
        await loadSubjects('subject-wise-select');
        await loadGroups('student-wise-group-filter');
        await loadGroups('roll-search-group-filter');
        selectSummaryType('student-wise');
    } else if (tabName === 'manage') {
        await loadCurrentStudents();
        await loadCurrentSubjects();
        await loadSubjects('enrollment-subject');
        await showAutoBackups();
        await showGroupManagement();
        await showStudentGroupAssignment();
        await loadGroups('attendance-group-filter');
        await loadGroups('bulk-group-select', false);
    }
}

function getTabIndex(tabName) {
    const tabs = ['attendance', 'track', 'analytics', 'summary', 'manage'];
    return tabs.indexOf(tabName) + 1;
}

// ===================================================================
// 🎯 LECTURE SELECTION
// ===================================================================
async function selectLecture(lectureNumber, event) {
    selectedLecture = lectureNumber;

    document.querySelectorAll('.lecture-btn').forEach(btn => btn.classList.remove('selected'));
    if (event && event.target) {
        event.target.classList.add('selected');
    }

    const subjectId = document.getElementById('subject-select').value;
    const date = document.getElementById('class-date').value;

    if (subjectId && date) {
        await updateLectureInfo(subjectId, date, lectureNumber);
    } else {
        document.getElementById('lecture-info').textContent = `${lectureNumber}${getOrdinalSuffix(lectureNumber)} lecture selected`;
    }

    await loadStudentsForAttendance();

    if (subjectId) {
        await showLectureSequence(subjectId, date);
    }
}

// ===================================================================
// 👤 MARK INDIVIDUAL ATTENDANCE
// ===================================================================
function markAttendance(rollNumber, status, clickedButton) {
    currentAttendance[rollNumber] = status;

    const studentItem = clickedButton.closest('.student-item');
    const presentBtn = studentItem.querySelector('.btn-present');
    const statusSpan = studentItem.querySelector('.attendance-status');

    if (status === 'present') {
        presentBtn.style.opacity = '1';
        presentBtn.style.background = 'var(--accent-color)';
        presentBtn.style.transform = 'scale(1)';
        presentBtn.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.3)';
        presentBtn.textContent = '✓ Present';

        statusSpan.textContent = '✓ Present';
        statusSpan.className = 'attendance-status present-status';
        statusSpan.style.color = 'var(--accent-color)';
        statusSpan.style.fontWeight = 'bold';

        presentBtn.onclick = () => markAttendance(rollNumber, 'absent', presentBtn);
    } else {
        presentBtn.style.opacity = '1';
        presentBtn.style.background = 'linear-gradient(135deg, var(--accent-color), var(--accent-dark))';
        presentBtn.style.transform = 'scale(1)';
        presentBtn.style.boxShadow = 'var(--shadow-light)';
        presentBtn.textContent = '✓ Present';

        statusSpan.textContent = '✗ Absent';
        statusSpan.className = 'attendance-status absent-status';
        statusSpan.style.color = 'var(--error-color)';
        statusSpan.style.fontWeight = 'normal';

        presentBtn.onclick = () => markAttendance(rollNumber, 'present', presentBtn);
    }
}

// ===================================================================
// 💾 SAVE ATTENDANCE
// ===================================================================
async function saveAttendance() {
    const subjectSelect = document.getElementById('subject-select');
    const selectedSubjectId = subjectSelect.value;
    const date = document.getElementById('class-date').value;
    const messageDiv = document.getElementById('attendance-message');

    if (!selectedSubjectId || !date) {
        showMessage(messageDiv, 'Please select subject and date', 'error');
        return;
    }

    if (!selectedLecture) {
        showMessage(messageDiv, 'Please select lecture number', 'error');
        return;
    }

    if (Object.keys(currentAttendance).length === 0) {
        showMessage(messageDiv, 'Please mark attendance for at least one student', 'error');
        return;
    }

    try {
        const subjects = await getSubjects();
        const selectedSubject = subjects.find(s => s.id == selectedSubjectId);
        const subjectName = selectedSubject ? selectedSubject.name : 'Unknown Subject';

        const presentCount = Object.values(currentAttendance).filter(status => status === 'present').length;
        const totalCount = Object.keys(currentAttendance).length;
        const absentCount = totalCount - presentCount;

        const attendance = await getAttendance();
        const key = `${date}_${selectedSubjectId}_${selectedLecture}`;

        if (attendance[key]) {
            if (!confirm(`Attendance already exists for ${selectedLecture}${getOrdinalSuffix(selectedLecture)} lecture of this subject on this date. Do you want to overwrite it?`)) {
                return;
            }
        }

        attendance[key] = {
            subjectId: selectedSubjectId,
            subject: subjectName,
            date: date,
            lectureNumber: selectedLecture,
            records: currentAttendance,
            timestamp: new Date().toISOString()
        };

        await setAttendance(attendance);

        lastSavedAttendance = {
            key: key,
            subject: subjectName,
            date: date,
            lectureNumber: selectedLecture
        };

        let successMessage = `✅ Attendance saved! ${presentCount} present, ${absentCount} absent out of ${totalCount} students for ${subjectName} - ${selectedLecture}${getOrdinalSuffix(selectedLecture)} lecture on ${date}`;
        successMessage += '<br><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8em; margin-top: 8px;" onclick="undoLastAttendance()">↩️ Undo</button>';

        showMessage(messageDiv, successMessage, 'success');
    } catch (error) {
        console.error('Error saving attendance:', error);
        showMessage(messageDiv, '❌ Failed to save attendance: ' + error.message, 'error');
    }
}

// ===================================================================
// 👥 GROUP MANAGEMENT
// ===================================================================
async function addGroup() {
    const name = document.getElementById('group-name').value.trim();
    const color = document.getElementById('group-color').value || '#2196F3';
    const messageDiv = document.getElementById('manage-message');

    if (!name) {
        showMessage(messageDiv, 'Please enter a group name', 'error');
        return;
    }

    const groups = await getGroups();

    if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
        showMessage(messageDiv, 'Group name already exists', 'error');
        return;
    }

    const newGroup = {
        id: 'g_' + Date.now(),
        name: name,
        color: color
    };

    groups.push(newGroup);
    await setGroups(groups);

    document.getElementById('group-name').value = '';

    showMessage(messageDiv, `Group "${name}" created successfully`, 'success');
    showGroupManagement();
    loadGroups('attendance-group-filter');
}

async function removeGroup(groupId) {
    if (!confirm('Are you sure you want to remove this group? Students will not be deleted.')) {
        return;
    }

    const groups = await getGroups();
    const updatedGroups = groups.filter(g => g.id !== groupId);
    await setGroups(updatedGroups);

    // Remove group from all students
    const students = await getStudents();
    let modified = false;
    students.forEach(student => {
        if (student.groups && student.groups.includes(groupId)) {
            student.groups = student.groups.filter(gId => gId !== groupId);
            modified = true;
        }
    });
    if (modified) {
        await setStudents(students);
    }

    showMessage(document.getElementById('manage-message'), 'Group removed', 'success');
    showGroupManagement();
    showStudentGroupAssignment();
    loadGroups('attendance-group-filter');
}

async function assignGroupToStudent(studentRoll, groupId) {
    if (!groupId) return;

    const students = await getStudents();
    const student = students.find(s => s.roll === studentRoll);
    if (!student) return;

    if (!student.groups) {
        student.groups = [];
    }
    if (!student.groups.includes(groupId)) {
        student.groups.push(groupId);
        await setStudents(students);
    }

    showStudentGroupAssignment();
}

async function bulkAddToGroup() {
    const groupId = document.getElementById('bulk-group-select').value;
    const input = document.getElementById('bulk-group-rolls').value.trim();
    const messageDiv = document.getElementById('manage-message');

    if (!groupId) {
        showMessage(messageDiv, '⚠️ Please select a group first', 'error');
        return;
    }

    if (!input) {
        showMessage(messageDiv, '⚠️ Please enter roll numbers', 'error');
        return;
    }

    // Parse roll numbers: split by comma, space, tab, or newline, then trim and remove empties
    const rawRolls = input.split(/[,\s\n\t]+/).map(r => r.trim()).filter(Boolean);

    if (rawRolls.length === 0) {
        showMessage(messageDiv, '⚠️ No valid roll numbers found', 'error');
        return;
    }

    const groups = await getGroups();
    const selectedGroup = groups.find(g => g.id === groupId);
    if (!selectedGroup) {
        showMessage(messageDiv, '⚠️ Selected group not found', 'error');
        return;
    }

    const students = await getStudents();
    let addedCount = 0;
    let notFound = [];
    let alreadyInGroup = [];

    rawRolls.forEach(roll => {
        const student = students.find(s => s.roll.toLowerCase() === roll.toLowerCase());
        if (!student) {
            notFound.push(roll);
            return;
        }

        if (!student.groups) {
            student.groups = [];
        }

        if (student.groups.includes(groupId)) {
            alreadyInGroup.push(roll);
            return;
        }

        student.groups.push(groupId);
        addedCount++;
    });

    if (addedCount > 0) {
        await setStudents(students);
    }

    // Build result message
    let message = `✅ ${addedCount} of ${rawRolls.length} added to "${selectedGroup.name}"`;

    if (alreadyInGroup.length > 0) {
        message += `. ${alreadyInGroup.length} already in group`;
    }

    if (notFound.length > 0) {
        const showRolls = notFound.slice(0, 3).join(', ');
        message += `. ${notFound.length} not found${notFound.length > 3 ? ' (e.g. ' + showRolls + '...)' : ' (' + showRolls + ')'}`;
    }

    showMessage(messageDiv, message, addedCount > 0 ? 'success' : 'error');

    // Refresh UI
    document.getElementById('bulk-group-rolls').value = '';
    showStudentGroupAssignment();
}

async function unassignGroupFromStudent(studentRoll, groupId) {
    const students = await getStudents();
    const student = students.find(s => s.roll === studentRoll);
    if (!student || !student.groups) return;

    student.groups = student.groups.filter(gId => gId !== groupId);
    await setStudents(students);

    showStudentGroupAssignment();
}

// ===================================================================
// 👥 MANAGE STUDENTS & SUBJECTS
// ===================================================================
async function addStudent() {
    const name = document.getElementById('student-name').value.trim();
    const roll = normalizeRollNumber(document.getElementById('student-roll').value);
    const messageDiv = document.getElementById('manage-message');

    if (!name || !roll) {
        showMessage(messageDiv, 'Please enter both name and roll number', 'error');
        return;
    }

    const students = await getStudents();

    if (students.some(student => student.roll === roll)) {
        showMessage(messageDiv, 'Roll number already exists', 'error');
        return;
    }

    const newStudent = {
        id: Date.now(),
        roll: roll,
        name: name,
        groups: []
    };

    students.push(newStudent);
    await setStudents(students);

    document.getElementById('student-name').value = '';
    document.getElementById('student-roll').value = '';

    showMessage(messageDiv, `Student ${name} added successfully`, 'success');
    loadCurrentStudents();
    showStudentGroupAssignment();
}

async function bulkImportStudents() {
    const bulkText = document.getElementById('bulk-import-text').value.trim();
    const messageDiv = document.getElementById('manage-message');

    if (!bulkText) {
        showMessage(messageDiv, 'Please paste student data', 'error');
        return;
    }

    const lines = bulkText.split('\n').filter(line => line.trim());
    const students = await getStudents();
    const newStudents = [];
    const errors = [];
    const duplicates = [];

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        let parts;
        if (line.includes('\t')) {
            parts = line.split('\t').map(part => part.trim());
        } else if (line.includes(',')) {
            parts = line.split(',').map(part => part.trim());
        } else {
            errors.push(`Line ${lineNum}: Invalid format (missing comma or tab)`);
            return;
        }

        if (parts.length < 2) {
            errors.push(`Line ${lineNum}: Missing roll number or name`);
            return;
        }

        const roll = normalizeRollNumber(parts[0]);
        const name = parts[1].trim();

        if (!roll || !name) {
            errors.push(`Line ${lineNum}: Empty roll number or name`);
            return;
        }

        if (students.some(student => student.roll === roll)) {
            duplicates.push(`${roll} (${name})`);
            return;
        }

        if (newStudents.some(student => student.roll === roll)) {
            errors.push(`Line ${lineNum}: Duplicate roll number ${roll} in import data`);
            return;
        }

        newStudents.push({
            id: Date.now() + index,
            roll: roll,
            name: name,
            groups: []
        });
    });

    let message = '';
    if (newStudents.length > 0) {
        students.push(...newStudents);
        await setStudents(students);
        message += `Successfully imported ${newStudents.length} students. `;
        loadCurrentStudents();
    }

    if (duplicates.length > 0) {
        message += `${duplicates.length} duplicates skipped: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}. `;
    }

    if (errors.length > 0) {
        message += `${errors.length} errors: ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '...' : ''}. `;
    }

    const messageType = newStudents.length > 0 ? 'success' : (errors.length > 0 ? 'error' : 'error');
    showMessage(messageDiv, message || 'No valid data found', messageType);
}

async function addSubject() {
    const subjectName = document.getElementById('subject-name').value.trim();
    const messageDiv = document.getElementById('manage-message');

    if (!subjectName) {
        showMessage(messageDiv, 'Please enter subject name', 'error');
        return;
    }

    const subjects = await getSubjects();

    if (subjects.some(subject => subject.name === subjectName)) {
        showMessage(messageDiv, 'Subject already exists', 'error');
        return;
    }

    const newSubject = {
        id: Date.now(),
        name: subjectName
    };

    subjects.push(newSubject);
    await setSubjects(subjects);

    document.getElementById('subject-name').value = '';

    showMessage(messageDiv, `Subject ${subjectName} added successfully`, 'success');
    loadCurrentSubjects();
    loadSubjects('enrollment-subject');
}

async function removeStudent(index) {
    if (confirm('Are you sure you want to remove this student?')) {
        const students = await getStudents();
        students.splice(index, 1);
        await setStudents(students);
        loadCurrentStudents();
        showMessage(document.getElementById('manage-message'), 'Student removed successfully', 'success');
    }
}

async function removeSubject(index) {
    if (confirm('Are you sure you want to remove this subject? This will also remove all attendance records for this subject.')) {
        const subjects = await getSubjects();
        const subjectToRemove = subjects[index];
        subjects.splice(index, 1);
        await setSubjects(subjects);

        const attendance = await getAttendance();
        Object.keys(attendance).forEach(key => {
            if (attendance[key].subjectId == subjectToRemove.id) {
                delete attendance[key];
            }
        });
        await setAttendance(attendance);

        loadCurrentSubjects();
        loadSubjects('enrollment-subject');
        showMessage(document.getElementById('manage-message'), 'Subject and related attendance records removed successfully', 'success');
    }
}

// ===================================================================
// 🗑️ DANGER ZONE - CLEAR ALL
// ===================================================================
async function clearAllAttendance() {
    if (confirm('Are you sure you want to clear all attendance records? This cannot be undone.')) {
        await setAttendance({});
        showMessage(document.getElementById('manage-message'), 'All attendance records cleared', 'success');
    }
}

async function clearAllStudents() {
    if (confirm('Are you sure you want to clear all students? This will also clear all attendance records.')) {
        await setStudents([]);
        await setAttendance({});
        await setEnrollments({});
        showMessage(document.getElementById('manage-message'), 'All students and attendance records cleared', 'success');
        loadCurrentStudents();
    }
}

async function clearAllSubjects() {
    if (confirm('Are you sure you want to clear all subjects? This will also clear all attendance records.')) {
        await setSubjects([]);
        await setAttendance({});
        await setEnrollments({});
        showMessage(document.getElementById('manage-message'), 'All subjects and attendance records cleared', 'success');
        loadCurrentSubjects();
        loadSubjects('enrollment-subject');
    }
}

// ===================================================================
// 📤 SHARE & EXPORT FUNCTIONS
// ===================================================================
async function shareViaWhatsApp(summaryType) {
    let message = '';

    if (summaryType === 'student-wise') {
        const students = await getStudents();
        const attendance = await getAttendance();

        if (students.length === 0) {
            alert('No students found to share.');
            return;
        }

        const attendanceByStudent = {};
        students.forEach(student => {
            attendanceByStudent[student.roll] = {
                name: student.name,
                roll: student.roll,
                subjects: {}
            };
        });

        Object.values(attendance).forEach(record => {
            const attendanceRecords = record.records || record.attendance || {};
            Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
                if (attendanceByStudent[rollNumber]) {
                    const subjectName = record.subject || 'Unknown Subject';
                    if (!attendanceByStudent[rollNumber].subjects[subjectName]) {
                        attendanceByStudent[rollNumber].subjects[subjectName] = { present: 0, absent: 0 };
                    }
                    if (status === 'present') {
                        attendanceByStudent[rollNumber].subjects[subjectName].present++;
                    } else {
                        attendanceByStudent[rollNumber].subjects[subjectName].absent++;
                    }
                }
            });
        });

        message = `📊 *STUDENT WISE ATTENDANCE REPORT*\n`;
        message += `📅 Generated: ${new Date().toLocaleDateString()}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        Object.values(attendanceByStudent).forEach(student => {
            if (Object.keys(student.subjects).length === 0) return;

            message += `👤 *${student.name}* (${student.roll})\n`;
            Object.entries(student.subjects).forEach(([subjectName, subjectData]) => {
                const total = subjectData.present + subjectData.absent;
                const percentage = total > 0 ? ((subjectData.present / total) * 100).toFixed(1) : 0;
                const emoji = percentage >= 75 ? '✅' : '⚠️';
                message += `  ${emoji} ${subjectName}: ${percentage}% (${subjectData.present}/${total})\n`;
            });
            message += `\n`;
        });

    } else if (summaryType === 'subject-wise') {
        const subjectId = document.getElementById('subject-wise-select').value;
        if (!subjectId) {
            alert('Please select a subject first.');
            return;
        }

        const subjects = await getSubjects();
        const selectedSubject = subjects.find(s => s.id == subjectId);
        const subjectName = selectedSubject ? selectedSubject.name : 'Unknown Subject';
        const attendance = await getAttendance();
        const students = await getStudents();
        const subjectAttendance = Object.values(attendance).filter(record => record.subjectId == subjectId);

        if (subjectAttendance.length === 0) {
            alert('No attendance records found for this subject.');
            return;
        }

        subjectAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

        message = `📚 *SUBJECT WISE ATTENDANCE REPORT*\n`;
        message += `Subject: *${subjectName}*\n`;
        message += `📅 Generated: ${new Date().toLocaleDateString()}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        subjectAttendance.forEach(record => {
            const attendanceRecords = record.records || record.attendance || {};
            const totalStudents = Object.keys(attendanceRecords).length;
            const presentStudents = Object.values(attendanceRecords).filter(status => status === 'present').length;
            const percentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : 0;
            const lectureInfo = record.lectureNumber ? ` - Lecture ${record.lectureNumber}` : '';

            message += `📅 *${new Date(record.date).toLocaleDateString()}*${lectureInfo}\n`;
            message += `Attendance: ${percentage}% (${presentStudents}/${totalStudents})\n`;

            const absentList = [];
            Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
                if (status === 'absent') {
                    const student = students.find(s => s.roll === rollNumber);
                    absentList.push(student ? student.name.split(' ')[0] : rollNumber);
                }
            });

            if (absentList.length > 0) {
                message += `Absent: ${absentList.join(', ')}\n`;
            }
            message += `\n`;
        });
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `Generated by Attendance Tracker 📱`;

    const whatsappURL = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
}

async function exportStudentWisePDF() {
    const students = await getStudents();
    const attendance = await getAttendance();

    if (students.length === 0) {
        alert('No students found to export.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica");

    doc.setFillColor(26, 35, 126);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('STUDENT WISE ATTENDANCE REPORT', 105, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} | All Subjects Overview`, 105, 35, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let yPos = 55;

    const attendanceByStudent = {};
    students.forEach(student => {
        attendanceByStudent[student.roll] = {
            name: student.name,
            roll: student.roll,
            subjects: {}
        };
    });

    Object.values(attendance).forEach(record => {
        const attendanceRecords = record.records || record.attendance || {};
        Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
            if (attendanceByStudent[rollNumber]) {
                const subjectName = record.subject || 'Unknown Subject';
                if (!attendanceByStudent[rollNumber].subjects[subjectName]) {
                    attendanceByStudent[rollNumber].subjects[subjectName] = {
                        present: 0, absent: 0, absentDates: []
                    };
                }

                if (status === 'present') {
                    attendanceByStudent[rollNumber].subjects[subjectName].present++;
                } else {
                    attendanceByStudent[rollNumber].subjects[subjectName].absent++;
                    const lectureInfo = record.lectureNumber ? ` (L${record.lectureNumber})` : '';
                    attendanceByStudent[rollNumber].subjects[subjectName].absentDates.push(
                        `${new Date(record.date).toLocaleDateString()}${lectureInfo}`
                    );
                }
            }
        });
    });

    Object.values(attendanceByStudent).forEach(student => {
        if (Object.keys(student.subjects).length === 0) return;

        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(240, 248, 255);
        doc.rect(15, yPos, 180, 15, 'F');
        doc.setDrawColor(33, 150, 243);
        doc.rect(15, yPos, 180, 15, 'S');

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text(`${sanitizeText(student.name)} (${sanitizeText(student.roll)})`, 20, yPos + 10);

        yPos += 20;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        Object.entries(student.subjects).forEach(([subjectName, subjectData]) => {
            const total = subjectData.present + subjectData.absent;
            const percentage = total > 0 ? ((subjectData.present / total) * 100).toFixed(1) : 0;

            doc.setFont(undefined, 'bold');
            doc.text(`Subject: ${sanitizeText(subjectName)}`, 20, yPos);
            doc.text(`${percentage}%`, 170, yPos);
            yPos += 8;

            doc.setFont(undefined, 'normal');
            doc.text(`Present: ${subjectData.present} | Absent: ${subjectData.absent} | Total: ${total}`, 25, yPos);
            yPos += 6;

            if (subjectData.absentDates.length > 0) {
                doc.setFontSize(8);
                doc.text('Absent Dates:', 25, yPos);
                yPos += 4;

                let datesText = subjectData.absentDates.join(', ');
                const lines = doc.splitTextToSize(datesText, 160);
                lines.forEach(line => {
                    doc.text(line, 35, yPos);
                    yPos += 4;
                });
            }

            doc.setFontSize(10);
            yPos += 4;
        });

        yPos += 10;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount} | Student Wise Report | Generated by Attendance Tracker`, 105, 290, { align: 'center' });
    }

    doc.save('Student_Wise_Attendance_Report.pdf');
}

async function exportSubjectWisePDF() {
    const subjectId = document.getElementById('subject-wise-select').value;

    if (!subjectId) {
        alert('Please select a subject first.');
        return;
    }

    const subjects = await getSubjects();
    const selectedSubject = subjects.find(s => s.id == subjectId);
    const subjectName = selectedSubject ? selectedSubject.name : 'Unknown Subject';

    const students = await getStudents();
    const attendance = await getAttendance();
    const subjectAttendance = Object.values(attendance).filter(record => record.subjectId == subjectId);

    if (subjectAttendance.length === 0) {
        alert('No attendance records found for this subject.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica");

    doc.setFillColor(76, 175, 80);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('SUBJECT WISE ATTENDANCE REPORT', 105, 25, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(`Subject: ${sanitizeText(subjectName)}`, 105, 35, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let yPos = 55;

    subjectAttendance.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare === 0) {
            return (a.lectureNumber || 1) - (b.lectureNumber || 1);
        }
        return dateCompare;
    });

    subjectAttendance.forEach(record => {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        const attendanceRecords = record.records || record.attendance || {};
        const totalStudents = Object.keys(attendanceRecords).length;
        const presentStudents = Object.values(attendanceRecords).filter(status => status === 'present').length;
        const absentStudents = totalStudents - presentStudents;
        const percentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : 0;

        doc.setFillColor(245, 245, 245);
        doc.rect(15, yPos, 180, 20, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, yPos, 180, 20, 'S');

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const lectureInfo = record.lectureNumber ? ` - ${record.lectureNumber}${getOrdinalSuffix(record.lectureNumber)} Lecture` : '';
        doc.text(`Date: ${new Date(record.date).toLocaleDateString()}${lectureInfo}`, 20, yPos + 8);
        doc.text(`${percentage}% Attendance`, 160, yPos + 8);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Present: ${presentStudents} | Absent: ${absentStudents} | Total: ${totalStudents}`, 20, yPos + 15);

        yPos += 25;

        const absentList = [];
        Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
            if (status === 'absent') {
                const student = students.find(s => s.roll === rollNumber);
                absentList.push(`${student ? student.name : 'Unknown'} (${rollNumber})`);
            }
        });

        if (absentList.length > 0) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text(`Absent Students (${absentList.length}):`, 20, yPos);
            yPos += 6;

            doc.setFont(undefined, 'normal');
            absentList.forEach(student => {
                if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(`• ${student}`, 25, yPos);
                yPos += 5;
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(76, 175, 80);
            doc.text('✅ Perfect Attendance - No Absentees!', 20, yPos);
            doc.setTextColor(0, 0, 0);
            yPos += 8;
        }

        yPos += 15;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount} | ${sanitizeText(subjectName)} Report | Generated by Attendance Tracker`, 105, 290, { align: 'center' });
    }

    doc.save('Subject_Wise_Attendance_Report.pdf');
}

async function exportRollSearchPDF() {
    const searchTerm = document.getElementById('roll-search-input').value.trim();

    if (!searchTerm) {
        alert('Please enter a roll number to search.');
        return;
    }

    const students = await getStudents();
    const matchingStudents = students.filter(student =>
        student.roll.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matchingStudents.length === 0) {
        alert('No students found matching the search term.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica");

    doc.setFillColor(156, 39, 176);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('ROLL NUMBER SEARCH REPORT', 105, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Search Term: "${sanitizeText(searchTerm)}" | Found: ${matchingStudents.length} student(s)`, 105, 35, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let yPos = 55;

    const attendance = await getAttendance();

    matchingStudents.forEach(student => {
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(240, 240, 255);
        doc.rect(15, yPos, 180, 15, 'F');
        doc.setDrawColor(156, 39, 176);
        doc.rect(15, yPos, 180, 15, 'S');

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(156, 39, 176);
        doc.text(`${sanitizeText(student.name)} (${sanitizeText(student.roll)})`, 20, yPos + 10);

        yPos += 20;
        doc.setTextColor(0, 0, 0);

        const studentSubjects = {};
        Object.values(attendance).forEach(record => {
            const attendanceRecords = record.records || record.attendance || {};
            if (attendanceRecords[student.roll]) {
                const subjectName = record.subject || 'Unknown Subject';
                if (!studentSubjects[subjectName]) {
                    studentSubjects[subjectName] = {
                        present: 0, absent: 0, absentDates: []
                    };
                }

                if (attendanceRecords[student.roll] === 'present') {
                    studentSubjects[subjectName].present++;
                } else {
                    studentSubjects[subjectName].absent++;
                    const lectureInfo = record.lectureNumber ? ` (L${record.lectureNumber})` : '';
                    studentSubjects[subjectName].absentDates.push(
                        `${new Date(record.date).toLocaleDateString()}${lectureInfo}`
                    );
                }
            }
        });

        if (Object.keys(studentSubjects).length === 0) {
            doc.setFontSize(10);
            doc.text('No attendance records found for this student.', 20, yPos);
            yPos += 8;
        } else {
            Object.entries(studentSubjects).forEach(([subjectName, subjectData]) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }

                const total = subjectData.present + subjectData.absent;
                const percentage = total > 0 ? ((subjectData.present / total) * 100).toFixed(1) : 0;

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text(`${sanitizeText(subjectName)} - ${percentage}%`, 20, yPos);
                yPos += 6;

                doc.setFont(undefined, 'normal');
                doc.text(`Present: ${subjectData.present} | Absent: ${subjectData.absent} | Total: ${total}`, 25, yPos);
                yPos += 5;

                if (subjectData.absentDates.length > 0) {
                    doc.setFontSize(8);
                    doc.text('Absent Dates:', 25, yPos);
                    yPos += 4;

                    let datesText = subjectData.absentDates.join(', ');
                    const lines = doc.splitTextToSize(datesText, 160);
                    lines.forEach(line => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.text(line, 35, yPos);
                        yPos += 4;
                    });
                }

                doc.setFontSize(10);
                yPos += 4;
            });
        }

        yPos += 10;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount} | Roll Search Report | Generated by Attendance Tracker`, 105, 290, { align: 'center' });
    }

    doc.save('Roll_Search_Attendance_Report.pdf');
}

async function exportSubjectWiseCSV() {
    const subjectId = document.getElementById('subject-wise-select').value;

    if (!subjectId) {
        alert('Please select a subject first.');
        return;
    }

    const dateFrom = document.getElementById('subject-wise-date-from').value;
    const dateTo = document.getElementById('subject-wise-date-to').value;

    const subjects = await getSubjects();
    const selectedSubject = subjects.find(s => s.id == subjectId);
    const subjectName = selectedSubject ? selectedSubject.name : 'Unknown Subject';

    const students = await getStudents();
    const attendance = await getAttendance();
    let subjectAttendance = Object.values(attendance).filter(record => record.subjectId == subjectId);

    if (dateFrom) {
        subjectAttendance = subjectAttendance.filter(record => record.date >= dateFrom);
    }
    if (dateTo) {
        subjectAttendance = subjectAttendance.filter(record => record.date <= dateTo);
    }

    if (subjectAttendance.length === 0) {
        alert('No attendance records found for this subject.' + (dateFrom || dateTo ? ' in the selected date range.' : ''));
        return;
    }

    const escapeCsv = (value) => {
        const str = String(value ?? '');
        if (str.includes('"') || str.includes(',') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const parseRoll = (roll) => {
        const rollText = String(roll ?? '');
        const match = rollText.match(/^(.*?)(\d+)([^\d]*)$/);
        if (!match) {
            return null;
        }

        return {
            prefix: match[1],
            number: parseInt(match[2], 10),
            width: match[2].length,
            suffix: match[3],
            original: rollText
        };
    };

    const formatRoll = (template, number) => {
        const numericPart = String(number).padStart(template.width, '0');
        return `${template.prefix}${numericPart}${template.suffix}`;
    };

    subjectAttendance.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare === 0) {
            return (a.lectureNumber || 1) - (b.lectureNumber || 1);
        }
        return dateCompare;
    });

    const attendanceSessions = subjectAttendance.map(record => {
        const attendanceRecords = record.records || record.attendance || {};
        const totalStudents = Object.keys(attendanceRecords).length;
        const presentStudents = Object.values(attendanceRecords).filter(status => status === 'present').length;
        const absentStudents = totalStudents - presentStudents;
        const percentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : '0.0';

        return {
            record,
            attendanceRecords,
            totalStudents,
            presentStudents,
            absentStudents,
            percentage,
            header: {
                date: record.date,
                lecture: record.lectureNumber || 1,
                subject: subjectName
            }
        };
    });

    const rollMap = new Map();
    students.forEach(student => {
        if (student && student.roll) {
            rollMap.set(String(student.roll), student.name || '');
        }
    });

    const parsedRolls = Array.from(rollMap.keys())
        .map(parseRoll)
        .filter(Boolean)
        .sort((a, b) => a.number - b.number);

    let rosterRows = Array.from(rollMap.entries()).map(([roll, name]) => ({
        roll,
        name,
        notFound: false
    }));

    if (parsedRolls.length > 0) {
        const firstTemplate = parsedRolls[0];
        const uniformTemplate = parsedRolls.every(item => item.prefix === firstTemplate.prefix && item.suffix === firstTemplate.suffix);

        if (uniformTemplate) {
            const existingRolls = new Set(rosterRows.map(row => row.roll));
            const minRoll = parsedRolls[0].number;
            const maxRoll = parsedRolls[parsedRolls.length - 1].number;

            for (let number = minRoll; number <= maxRoll; number++) {
                const generatedRoll = formatRoll(firstTemplate, number);
                if (!existingRolls.has(generatedRoll)) {
                    rosterRows.push({
                        roll: generatedRoll,
                        name: 'Not Found',
                        notFound: true
                    });
                }
            }
        }
    }

    rosterRows.sort((a, b) => {
        const parsedA = parseRoll(a.roll);
        const parsedB = parseRoll(b.roll);

        if (parsedA && parsedB && parsedA.prefix === parsedB.prefix && parsedA.suffix === parsedB.suffix) {
            return parsedA.number - parsedB.number;
        }

        return a.roll.localeCompare(b.roll);
    });

    const csvRows = [];
    const headerRow = ['Roll Number', 'Name'];
    const lectureRow = ['', ''];
    const subjectRow = ['', ''];

    attendanceSessions.forEach(session => {
        const lectureLabel = session.header.lecture ? `${session.header.lecture}${getOrdinalSuffix(session.header.lecture)} Lecture` : 'Lecture';
        headerRow.push(session.header.date);
        lectureRow.push(lectureLabel);
        subjectRow.push(session.header.subject);
    });

    headerRow.push('Absentees Count');
    lectureRow.push('');
    subjectRow.push('');

    csvRows.push(headerRow, lectureRow, subjectRow);

    rosterRows.forEach(row => {
        let absenteeCount = 0;
        const csvRow = [row.roll, row.name];

        attendanceSessions.forEach(session => {
            let status = 'Not Found';

            if (!row.notFound && Object.prototype.hasOwnProperty.call(session.attendanceRecords, row.roll)) {
                status = session.attendanceRecords[row.roll] === 'present' ? 'P' : 'A';
                if (status === 'A') {
                    absenteeCount += 1;
                }
            }

            csvRow.push(status);
        });

        csvRow.push(row.notFound ? '0' : String(absenteeCount));
        csvRows.push(csvRow);
    });

    const totalPresentRow = ['Total Present', ''];
    const totalAbsentRow = ['Total Absent', ''];

    attendanceSessions.forEach(session => {
        totalPresentRow.push(String(session.presentStudents));
        totalAbsentRow.push(String(session.absentStudents));
    });

    totalPresentRow.push('');
    totalAbsentRow.push('');

    csvRows.push(totalPresentRow, totalAbsentRow);

    const csvContent = csvRows
        .map(row => row.map(escapeCsv).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subjectName.replace(/\s+/g, '_')}_Attendance_Report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===================================================================
// 🚀 INITIALIZATION
// ===================================================================
document.addEventListener('DOMContentLoaded', async function () {
    // Initialize Firebase if already in firebase mode
    if (storageMode === 'firebase') {
        try {
            await initializeFirebase();
            console.log('🚀 Firebase pre-loaded for firebase storage mode');
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
        }
    }

    // Load dark mode preference
    await loadDarkModePreference();

    // Initialize storage mode UI
    updateStorageModeUI();

    // Start auto-backup system
    startAutoBackup();

    // Subject selection for attendance
    document.getElementById('subject-select').addEventListener('change', async function () {
        await loadStudentsForAttendance();
        if (selectedLecture) {
            const subjectId = this.value;
            const date = document.getElementById('class-date').value;
            if (subjectId && date) {
                await updateLectureInfo(subjectId, date, selectedLecture);
            }
        }
    });

    // Date change for attendance
    document.getElementById('class-date').addEventListener('change', async function () {
        await loadStudentsForAttendance();
        if (selectedLecture) {
            const subjectId = document.getElementById('subject-select').value;
            const date = this.value;
            if (subjectId && date) {
                await updateLectureInfo(subjectId, date, selectedLecture);
            }
        }
    });

    // Subject selection for tracking
    document.getElementById('track-subject').addEventListener('change', showAttendanceSummary);

    // Date filter change handlers
    document.getElementById('track-date-from').addEventListener('change', showAttendanceSummary);
    document.getElementById('track-date-to').addEventListener('change', showAttendanceSummary);

    // Enter key handlers for forms
    document.getElementById('student-name').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addStudent();
    });

    document.getElementById('student-roll').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addStudent();
    });

    document.getElementById('subject-name').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addSubject();
    });

    // Restore manage section expand/collapse state
    restoreSectionStates();

    // Initialize the app
    switchTab('attendance');
});
