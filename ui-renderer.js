// ===================================================================
// 🎨 UI RENDERING FUNCTIONS
// ===================================================================

// ⏳ Loading overlay helpers
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-message');
    if (overlay && msgEl) {
        msgEl.textContent = message;
        overlay.classList.add('active');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function showMessage(element, message, type = 'error') {
    element.textContent = message;
    element.className = `message ${type}`;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('class-date').value = today;
}

async function loadSubjects(selectId) {
    const select = document.getElementById(selectId);
    const subjects = await getSubjects();

    select.innerHTML = '<option value="">Choose a subject...</option>';
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = subject.name;
        select.appendChild(option);
    });
}

function getOrdinalSuffix(num) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}

function sanitizeText(text) {
    return String(text).replace(/[^\x00-\x7F]/g, "");
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function showAutoBackups() {
    const backups = await listAutoBackups();
    const container = document.getElementById('auto-backup-list');

    if (backups.length === 0) {
        log.info('Backup', 'No auto-backups available');
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No auto-backups available yet. First backup will be created in 15 minutes.</p>';
        return;
    }

    log.info('Backup', 'Displaying ' + backups.length + ' auto-backups');

    let html = '<h4 style="margin-bottom: 15px; color: var(--text-primary);">📦 Available Auto-Backups</h4>';
    html += '<p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 15px;">Auto-backups are created every 15 minutes. Last ' + AUTO_BACKUP_KEEP + ' snapshots are kept.</p>';

    backups.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    backups.forEach((backup, index) => {
        const date = new Date(backup.ts);
        const isRecent = (new Date() - date) < 60 * 60 * 1000;
        const data = backup.data || {};
        const studentCount = Array.isArray(data.students) ? data.students.length : 0;
        const subjectCount = Array.isArray(data.subjects) ? data.subjects.length : 0;
        const attendanceCount = data.attendance ? Object.keys(data.attendance).length : 0;

        html += `
            <div class="student-item" style="background: ${isRecent ? 'var(--primary-light)' : 'var(--surface-color)'};">
                <div class="student-info">
                    <div class="student-name">
                        ${isRecent ? '🔵 ' : ''}${date.toLocaleString()}
                        ${index === 0 ? '<span style="background: var(--accent-color); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7em; margin-left: 8px;">Latest</span>' : ''}
                    </div>
                    <div class="student-roll" style="font-size: 0.85em;">
                        ${studentCount} students • ${subjectCount} subjects • ${attendanceCount} records
                    </div>
                </div>
                <div>
                    <button class="btn btn-success" style="padding: 6px 12px; font-size: 0.8em; margin-right: 5px;" onclick="restoreAutoBackup('${backup.ts}')">
                        ↩️ Restore
                    </button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8em;" onclick="deleteAutoBackup('${backup.ts}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function loadStudentsForAttendance() {
    const subjectSelect = document.getElementById('subject-select');
    const selectedSubjectId = subjectSelect.value;
    const date = document.getElementById('class-date').value;
    const studentAttendanceDiv = document.getElementById('student-attendance');
    const bulkActionsDiv = document.getElementById('bulk-actions');

    if (!selectedSubjectId || !selectedLecture || !date) {
        studentAttendanceDiv.classList.add('hidden');
        bulkActionsDiv.classList.add('hidden');
        return;
    }

    log.info('Attendance', 'Loading students for subject=' + selectedSubjectId + ' date=' + date + ' lecture=' + selectedLecture);

    let students = await getEnrolledStudents(selectedSubjectId);

    // Apply group filter if selected
    const groupFilter = document.getElementById('attendance-group-filter');
    if (groupFilter && groupFilter.value) {
        const selectedGroupId = groupFilter.value;
        students = students.filter(s => s.groups && s.groups.includes(selectedGroupId));
        log.info('Attendance', 'Group filter active: ' + groupFilter.options[groupFilter.selectedIndex].text + ' (' + students.length + ' students)');
    }

    studentAttendanceDiv.classList.remove('hidden');
    bulkActionsDiv.classList.remove('hidden');

    const attendance = await getAttendance();
    const key = `${date}_${selectedSubjectId}_${selectedLecture}`;
    const existingRecord = attendance[key];
    currentAttendance = {};
    students.forEach(student => {
        if (existingRecord && existingRecord.records && existingRecord.records[student.roll]) {
            currentAttendance[student.roll] = existingRecord.records[student.roll];
        } else {
            currentAttendance[student.roll] = 'absent';
        }
    });

    let html = '<h3 style="margin-bottom: 15px; color: var(--text-primary);">Mark Attendance</h3>';
    if (existingRecord) {
        html += '<p style="margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid var(--accent-color); font-size: 14px; color: var(--text-primary);">✏️ <strong>Edit Mode:</strong> Existing attendance loaded for this subject/date/lecture. Update any student and click <strong>Save Attendance</strong>.</p>';
    } else {
        html += '<p style="margin-bottom: 15px; padding: 10px; background: #fff3e0; border-radius: 8px; border-left: 4px solid var(--warning-color); font-size: 14px; color: var(--text-primary);">📝 <strong>Quick Mode:</strong> All students are preset as <strong>Absent</strong>. Click "Present" for students who attended.</p>';
    }

    students.forEach(student => {
        const status = currentAttendance[student.roll] || 'absent';
        const isPresent = status === 'present';

        html += `
            <div class="student-item" data-roll="${student.roll}">
                <div class="student-info">
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-roll">Roll: ${escapeHtml(student.roll)}</div>
                </div>
                <div>
                    <button class="attendance-btn btn-present" onclick="markAttendance('${student.roll}', '${isPresent ? 'absent' : 'present'}', this)" style="${isPresent ? 'opacity: 1; background: var(--accent-color); box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);' : ''}">
                        ✓ Present
                    </button>
                    <span class="attendance-status ${isPresent ? 'present-status' : 'absent-status'}" style="${isPresent ? 'color: var(--accent-color); font-weight: bold;' : ''}">
                        ${isPresent ? '✓ Present' : '✗ Absent'}
                    </span>
                </div>
            </div>
        `;
    });

    studentAttendanceDiv.innerHTML = html;
    log.success('Attendance', 'Loaded ' + students.length + ' students for attendance' + (existingRecord ? ' (edit mode)' : ''));
}

async function showLectureSequence(subjectId, date) {
    const attendance = await getAttendance();
    const subjectAttendance = Object.values(attendance).filter(record => record.subjectId == subjectId);

    log.info('Attendance', 'Lecture sequence for subject=' + subjectId + ' — ' + subjectAttendance.length + ' records');

    if (subjectAttendance.length > 0) {
        const dateGroups = {};
        subjectAttendance.forEach(record => {
            if (!dateGroups[record.date]) {
                dateGroups[record.date] = [];
            }
            dateGroups[record.date].push(record.lectureNumber);
        });

        const lectureInfoDiv = document.getElementById('lecture-info');
        const currentInfo = lectureInfoDiv.textContent;

        const recentDates = Object.keys(dateGroups).sort().slice(-3);
        if (recentDates.length > 0) {
            const patternInfo = recentDates.map(d => {
                const lectures = dateGroups[d].sort().join(', ');
                return `${new Date(d).toLocaleDateString()}: L${lectures}`;
            }).join(' | ');

            lectureInfoDiv.innerHTML = `${currentInfo}<br><small style="color: var(--text-secondary);">Recent: ${patternInfo}</small>`;
        }
    }
}

async function updateLectureInfo(subjectId, date, lectureNumber) {
    const subjects = await getSubjects();
    const subject = subjects.find(s => s.id == subjectId);
    const subjectName = subject ? subject.name : 'Unknown Subject';

    const attendance = await getAttendance();
    const key = `${date}_${subjectId}_${lectureNumber}`;

    if (attendance[key]) {
        const totalStudents = Object.keys(attendance[key].records).length;
        const presentStudents = Object.values(attendance[key].records).filter(status => status === 'present').length;
        document.getElementById('lecture-info').textContent =
            `${lectureNumber}${getOrdinalSuffix(lectureNumber)} lecture - ${subjectName} (${presentStudents}/${totalStudents} present)`;
        log.info('Attendance', 'Lecture info updated: ' + subjectName + ' L' + lectureNumber + ' — ' + presentStudents + '/' + totalStudents + ' present');
    } else {
        document.getElementById('lecture-info').textContent =
            `${lectureNumber}${getOrdinalSuffix(lectureNumber)} lecture - ${subjectName} (Not taken yet)`;
        log.info('Attendance', 'Lecture info updated: ' + subjectName + ' L' + lectureNumber + ' — not taken yet');
    }
}

function selectSummaryType(type) {
    document.querySelectorAll('.summary-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.summary-section').forEach(section => section.classList.remove('active'));

    const btnMap = {
        'student-wise': '.summary-type-btn:nth-child(1)',
        'subject-wise': '.summary-type-btn:nth-child(2)',
        'roll-search': '.summary-type-btn:nth-child(3)'
    };

    const sectionMap = {
        'student-wise': 'student-wise-section',
        'subject-wise': 'subject-wise-section',
        'roll-search': 'roll-search-section'
    };

    document.querySelector(btnMap[type]).classList.add('active');
    document.getElementById(sectionMap[type]).classList.add('active');
}

async function showAttendanceSummary() {
    const subjectSelect = document.getElementById('track-subject');
    const selectedSubjectId = subjectSelect.value;
    const summaryDiv = document.getElementById('attendance-summary');
    const dateFrom = document.getElementById('track-date-from').value;
    const dateTo = document.getElementById('track-date-to').value;
    const groupFilter = document.getElementById('track-group-filter');
    const selectedGroupId = groupFilter ? groupFilter.value : '';

    if (!selectedSubjectId) {
        summaryDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Please select a subject to view attendance summary.</p>';
        return;
    }

    log.info('Track', 'Showing attendance summary for subject=' + selectedSubjectId + (dateFrom ? ' from=' + dateFrom : '') + (dateTo ? ' to=' + dateTo : '') + (selectedGroupId ? ' group=' + selectedGroupId : ''));

    const attendance = await getAttendance();
    let allStudents = await getStudents();

    // Apply group filter
    if (selectedGroupId) {
        allStudents = allStudents.filter(s => s.groups && s.groups.includes(selectedGroupId));
    }

    let subjectAttendance = Object.values(attendance).filter(record => record.subjectId == selectedSubjectId);

    if (dateFrom || dateTo) {
        subjectAttendance = subjectAttendance.filter(record => {
            const recordDate = new Date(record.date);
            const fromDate = dateFrom ? new Date(dateFrom) : null;
            const toDate = dateTo ? new Date(dateTo) : null;

            if (fromDate && recordDate < fromDate) return false;
            if (toDate && recordDate > toDate) return false;
            return true;
        });
    }

    if (subjectAttendance.length === 0) {
        const filterMsg = (dateFrom || dateTo) ? ' for the selected date range' : '';
        summaryDiv.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No attendance records found for this subject${filterMsg}.</p>`;
        return;
    }

    let filterInfo = '';
    if (dateFrom || dateTo) {
        filterInfo = `<div style="background: var(--primary-light); padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; border-left: 4px solid var(--primary-color);">
            📅 Showing records ${dateFrom ? 'from ' + new Date(dateFrom).toLocaleDateString() : ''} ${dateTo ? 'to ' + new Date(dateTo).toLocaleDateString() : ''}
            <span style="margin-left: 10px; color: var(--text-secondary);">(${subjectAttendance.length} classes)</span>
        </div>`;
    }

    subjectAttendance.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare === 0) {
            return b.lectureNumber - a.lectureNumber;
        }
        return dateCompare;
    });

    let html = filterInfo;
    subjectAttendance.forEach(record => {
        const totalStudents = Object.keys(record.records || record.attendance || {}).length;
        const attendanceRecords = record.records || record.attendance || {};
        const presentStudents = Object.values(attendanceRecords).filter(status => status === 'present').length;
        const absentStudents = totalStudents - presentStudents;
        const percentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : 0;

        const absentList = [];
        Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
            if (status === 'absent') {
                absentList.push(rollNumber);
            }
        });

        const lectureInfo = record.lectureNumber ? ` - ${record.lectureNumber}${getOrdinalSuffix(record.lectureNumber)} Lecture` : '';
        const editButton = record.lectureNumber
            ? `<button class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px;" onclick="editAttendanceRecord('${escapeHtml(record.subjectId)}', '${escapeHtml(record.date)}', ${record.lectureNumber})">✏️ Edit</button>`
            : '';

        html += `
            <div class="summary-card">
                <div class="summary-header">
                    <div class="summary-title">${escapeHtml(record.subject)}${lectureInfo}</div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="summary-percentage">${percentage}%</div>
                        ${editButton}
                    </div>
                </div>
                <div class="summary-stats">
                    <div class="stat-item">
                        <div class="stat-value">${presentStudents}</div>
                        <div class="stat-label">Present</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${absentStudents}</div>
                        <div class="stat-label">Absent</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${new Date(record.date).toLocaleDateString()}</div>
                        <div class="stat-label">Date</div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                ${absentList.length > 0 ? `
                    <div style="margin-top: 15px; padding: 12px; background: #fff3e0; border-radius: 8px; border-left: 4px solid var(--secondary-color);">
                        <h4 style="color: var(--secondary-dark); margin-bottom: 10px;">🚫 Absent Students (${absentList.length})</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px;">
                            ${absentList.map(roll => {
                const student = allStudents.find(s => s.roll === roll);
                const studentName = student ? student.name.split(' ')[0] : roll;
                return `<div style="background: var(--secondary-color); color: white; padding: 6px 8px; border-radius: 12px; font-size: 0.8em; text-align: center;">
                                            <div style="font-weight: bold;">${escapeHtml(roll)}</div>
                                            <div style="font-size: 0.7em; opacity: 0.9;">${escapeHtml(studentName)}</div>
                                        </div>`;
            }).join('')}
                        </div>
                        <div style="margin-top: 10px; font-size: 0.8em; color: var(--text-secondary);">
                            📧 Click roll numbers to view student's complete absence history
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });

    summaryDiv.innerHTML = html;
    log.success('Track', 'Attendance summary rendered with ' + subjectAttendance.length + ' records');
}

function editAttendanceRecord(subjectId, date, lectureNumber) {
    switchTab('attendance');
    document.getElementById('subject-select').value = subjectId;
    document.getElementById('class-date').value = date;
    selectedLecture = lectureNumber;
    document.querySelectorAll('.lecture-btn').forEach(btn => btn.classList.remove('selected'));
    const lectureBtns = document.querySelectorAll('.lecture-btn');
    if (lectureBtns[lectureNumber - 1]) {
        lectureBtns[lectureNumber - 1].classList.add('selected');
    }
    loadStudentsForAttendance();
}

function clearDateFilter(tab) {
    const fromMap = {
        'track': 'track-date-from',
        'student-wise': 'student-wise-date-from',
        'subject-wise': 'subject-wise-date-from',
        'roll-search': 'roll-search-date-from'
    };
    const toMap = {
        'track': 'track-date-to',
        'student-wise': 'student-wise-date-to',
        'subject-wise': 'subject-wise-date-to',
        'roll-search': 'roll-search-date-to'
    };

    document.getElementById(fromMap[tab]).value = '';
    document.getElementById(toMap[tab]).value = '';

    if (tab === 'track') {
        showAttendanceSummary();
    }
}

async function showAnalytics() {
    const analyticsDiv = document.getElementById('analytics-content');
    const subjectId = document.getElementById('analytics-subject').value;
    const groupFilter = document.getElementById('analytics-group-filter');
    const selectedGroupId = groupFilter ? groupFilter.value : '';

    log.info('Analytics', 'Loading analytics' + (subjectId ? ' subject=' + subjectId : ' all subjects') + (selectedGroupId ? ' group=' + selectedGroupId : ''));

    let students = await getStudents();

    // Apply group filter
    if (selectedGroupId) {
        students = students.filter(s => s.groups && s.groups.includes(selectedGroupId));
    }

    const attendance = await getAttendance();
    const subjects = await getSubjects();

    if (students.length === 0 || Object.keys(attendance).length === 0) {
        log.warn('Analytics', 'No data available' + (selectedGroupId ? ' for selected group' : ''));
        analyticsDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">' + (selectedGroupId ? 'No data available for the selected group.' : 'No data available.') + '</p>';
        return;
    }

    let filteredAttendance = Object.values(attendance);
    if (subjectId) {
        filteredAttendance = filteredAttendance.filter(record => record.subjectId == subjectId);
    }

    const totalClasses = filteredAttendance.length;
    let totalPresent = 0;
    let totalAbsent = 0;

    filteredAttendance.forEach(record => {
        const attendanceRecords = record.records || record.attendance || {};
        totalPresent += Object.values(attendanceRecords).filter(s => s === 'present').length;
        totalAbsent += Object.values(attendanceRecords).filter(s => s === 'absent').length;
    });

    const overallPercentage = totalPresent + totalAbsent > 0 ? ((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(1) : 0;

    const subjectStats = {};
    Object.values(attendance).forEach(record => {
        const subjectName = record.subject || 'Unknown';
        if (!subjectStats[subjectName]) {
            subjectStats[subjectName] = { present: 0, absent: 0, classes: 0 };
        }
        subjectStats[subjectName].classes++;
        const attendanceRecords = record.records || record.attendance || {};
        subjectStats[subjectName].present += Object.values(attendanceRecords).filter(s => s === 'present').length;
        subjectStats[subjectName].absent += Object.values(attendanceRecords).filter(s => s === 'absent').length;
    });

    const dateStats = {};
    filteredAttendance.forEach(record => {
        const date = record.date;
        if (!dateStats[date]) {
            dateStats[date] = { present: 0, total: 0 };
        }
        const attendanceRecords = record.records || record.attendance || {};
        dateStats[date].present += Object.values(attendanceRecords).filter(s => s === 'present').length;
        dateStats[date].total += Object.keys(attendanceRecords).length;
    });

    const absenceDays = [];
    Object.entries(dateStats).forEach(([date, stats]) => {
        const absent = stats.total - stats.present;
        const percentage = stats.total > 0 ? ((stats.present / stats.total) * 100) : 0;
        absenceDays.push({ date, absent, percentage: percentage.toFixed(1), total: stats.total });
    });
    absenceDays.sort((a, b) => b.absent - a.absent);

    const studentStats = {};
    students.forEach(student => {
        studentStats[student.roll] = {
            name: student.name,
            present: 0,
            absent: 0
        };
    });

    filteredAttendance.forEach(record => {
        const attendanceRecords = record.records || record.attendance || {};
        Object.entries(attendanceRecords).forEach(([roll, status]) => {
            if (studentStats[roll]) {
                if (status === 'present') {
                    studentStats[roll].present++;
                } else {
                    studentStats[roll].absent++;
                }
            }
        });
    });

    const studentList = Object.entries(studentStats)
        .map(([roll, stats]) => ({
            roll,
            name: stats.name,
            total: stats.present + stats.absent,
            percentage: stats.present + stats.absent > 0 ? ((stats.present / (stats.present + stats.absent)) * 100).toFixed(1) : 0
        }))
        .filter(s => s.total > 0)
        .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

    let html = `
        <div class="enhanced-summary-card">
            <h4 style="color: var(--primary-color); margin-bottom: 15px; text-align: center;">📊 Overall Statistics</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
                <div style="text-align: center; padding: 15px; background: var(--primary-light); border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: var(--primary-color);">${totalClasses}</div>
                    <div style="color: var(--text-secondary); margin-top: 5px;">Total Classes</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: var(--accent-color);">${totalPresent}</div>
                    <div style="color: var(--text-secondary); margin-top: 5px;">Total Present</div>
                </div>
                <div style="text-align: center; padding: 15px; background: #ffeaea; border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: var(--error-color);">${totalAbsent}</div>
                    <div style="color: var(--text-secondary); margin-top: 5px;">Total Absent</div>
                </div>
                <div style="text-align: center; padding: 15px; background: var(--surface-dark); border-radius: 8px;">
                    <div style="font-size: 2em; font-weight: bold; color: var(--text-primary);">${overallPercentage}%</div>
                    <div style="color: var(--text-secondary); margin-top: 5px;">Avg Attendance</div>
                </div>
            </div>
        </div>

        <div class="enhanced-summary-card">
            <h4 style="color: var(--primary-color); margin-bottom: 15px;">📚 Subject-wise Comparison</h4>
            ${Object.entries(subjectStats).map(([subjectName, stats]) => {
                const total = stats.present + stats.absent;
                const percentage = total > 0 ? ((stats.present / total) * 100).toFixed(1) : 0;
                const barColor = percentage >= 75 ? 'var(--accent-color)' : 'var(--error-color)';
                return `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <strong style="color: var(--text-primary);">${escapeHtml(subjectName)}</strong>
                            <span style="color: ${barColor}; font-weight: bold;">${percentage}%</span>
                        </div>
                        <div style="background: var(--divider-color); height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="background: ${barColor}; width: ${percentage}%; height: 100%; transition: width 0.3s;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.85em; color: var(--text-secondary);">
                            <span>${stats.classes} classes</span>
                            <span>${stats.present} present / ${stats.absent} absent</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="enhanced-summary-card">
            <h4 style="color: var(--error-color); margin-bottom: 15px;">📉 Days with Highest Absences</h4>
            ${absenceDays.slice(0, 5).map((day, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: ${index === 0 ? '#ffeaea' : 'var(--surface-dark)'}; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid ${index === 0 ? 'var(--error-color)' : 'var(--divider-color)'};">
                    <div>
                        <div style="font-weight: bold; color: var(--text-primary);">${new Date(day.date).toLocaleDateString()}</div>
                        <div style="font-size: 0.85em; color: var(--text-secondary);">${day.absent} absent out of ${day.total}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.2em; font-weight: bold; color: ${day.percentage >= 75 ? 'var(--accent-color)' : 'var(--error-color)'};">${day.percentage}%</div>
                        <div style="font-size: 0.8em; color: var(--text-secondary);">attendance</div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="analytics-grid-2col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="enhanced-summary-card" style="border-left-color: var(--accent-color);">
                <h4 style="color: var(--accent-color); margin-bottom: 15px;">🏆 Top Performers</h4>
                ${studentList.slice(0, 5).map((student, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: ${index === 0 ? '#e8f5e8' : 'var(--surface-dark)'}; border-radius: 6px; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: bold; font-size: 0.9em;">${escapeHtml(student.name)}</div>
                            <div style="font-size: 0.75em; color: var(--text-secondary);">${escapeHtml(student.roll)}</div>
                        </div>
                        <div style="font-weight: bold; color: var(--accent-color);">${student.percentage}%</div>
                    </div>
                `).join('')}
            </div>

            <div class="enhanced-summary-card" style="border-left-color: var(--error-color);">
                <h4 style="color: var(--error-color); margin-bottom: 15px;">⚠️ Need Attention</h4>
                ${studentList.slice(-5).reverse().map((student, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: ${index === 0 ? '#ffeaea' : 'var(--surface-dark)'}; border-radius: 6px; margin-bottom: 6px;">
                        <div>
                            <div style="font-weight: bold; font-size: 0.9em;">${escapeHtml(student.name)}</div>
                            <div style="font-size: 0.75em; color: var(--text-secondary);">${escapeHtml(student.roll)}</div>
                        </div>
                        <div style="font-weight: bold; color: var(--error-color);">${student.percentage}%</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="enhanced-summary-card" style="background: linear-gradient(135deg, var(--primary-light), #f8f9fa);">
            <h4 style="color: var(--primary-color); margin-bottom: 15px;">💡 Insights & Recommendations</h4>
            <div style="display: grid; gap: 10px;">
                ${overallPercentage < 75 ? `
                    <div style="padding: 10px; background: #fff3e0; border-left: 4px solid var(--warning-color); border-radius: 6px;">
                        <strong>⚠️ Low Overall Attendance:</strong> Average attendance is ${overallPercentage}%. Consider implementing attendance improvement strategies.
                    </div>
                ` : `
                    <div style="padding: 10px; background: #e8f5e8; border-left: 4px solid var(--accent-color); border-radius: 6px;">
                        <strong>✅ Good Overall Attendance:</strong> Average attendance is ${overallPercentage}%. Keep up the good work!
                    </div>
                `}
                ${absenceDays.length > 0 && parseFloat(absenceDays[0].percentage) < 50 ? `
                    <div style="padding: 10px; background: #ffeaea; border-left: 4px solid var(--error-color); border-radius: 6px;">
                        <strong>🔴 Critical Day:</strong> ${new Date(absenceDays[0].date).toLocaleDateString()} had the lowest attendance (${absenceDays[0].percentage}%). Consider follow-up actions.
                    </div>
                ` : ''}
                ${studentList.length > 0 && parseFloat(studentList[studentList.length - 1].percentage) < 60 ? `
                    <div style="padding: 10px; background: #fff3e0; border-left: 4px solid var(--warning-color); border-radius: 6px;">
                        <strong>⚠️ At-Risk Students:</strong> ${studentList[studentList.length - 1].name} has ${studentList[studentList.length - 1].percentage}% attendance. Consider counseling.
                    </div>
                ` : ''}
                ${studentList.length > 0 ? `
                    <div style="padding: 10px; background: var(--surface-color); border: 1px solid var(--divider-color); border-radius: 6px;">
                        <strong>📊 Class Size:</strong> ${students.length} students, ${totalClasses} total classes, average class attendance of ${((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(1)}%.
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    analyticsDiv.innerHTML = html;
    log.success('Analytics', 'Dashboard rendered — ' + totalClasses + ' classes, ' + totalPresent + ' present, ' + totalAbsent + ' absent, ' + overallPercentage + '% avg');
}

async function generateStudentWiseSummary() {
    const summaryDiv = document.getElementById('summary-content');
    const groupFilter = document.getElementById('student-wise-group-filter');
    const selectedGroupId = groupFilter ? groupFilter.value : '';

    log.info('Reports', 'Generating student-wise summary' + (selectedGroupId ? ' group=' + selectedGroupId : '') + (document.getElementById('student-wise-date-from').value ? ' with date filter' : ''));

    let students = await getStudents();

    // Apply group filter
    if (selectedGroupId) {
        students = students.filter(s => s.groups && s.groups.includes(selectedGroupId));
    }

    const attendance = await getAttendance();
    const subjects = await getSubjects();
    const dateFrom = document.getElementById('student-wise-date-from').value;
    const dateTo = document.getElementById('student-wise-date-to').value;

    if (students.length === 0) {
        log.warn('Reports', 'No students found for student-wise summary');
        summaryDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">' + (selectedGroupId ? 'No students found in the selected group.' : 'No students found.') + '</p>';
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
        if (dateFrom && record.date < dateFrom) return;
        if (dateTo && record.date > dateTo) return;

        const attendanceRecords = record.records || record.attendance || {};
        Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
            if (attendanceByStudent[rollNumber]) {
                const subjectName = record.subject || 'Unknown Subject';
                if (!attendanceByStudent[rollNumber].subjects[subjectName]) {
                    attendanceByStudent[rollNumber].subjects[subjectName] = {
                        present: 0,
                        absent: 0,
                        absentDates: []
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

    let html = '<h3 style="margin-bottom: 20px; color: var(--text-primary);">👥 Student Wise Summary</h3>';

    if (dateFrom || dateTo) {
        html += '<div style="background: var(--primary-light); padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center;">';
        html += '<strong>📅 Filtered Data:</strong> ';
        if (dateFrom && dateTo) {
            html += `${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`;
        } else if (dateFrom) {
            html += `From ${new Date(dateFrom).toLocaleDateString()} onwards`;
        } else {
            html += `Up to ${new Date(dateTo).toLocaleDateString()}`;
        }
        html += '</div>';
    }

    Object.values(attendanceByStudent).forEach(student => {
        if (Object.keys(student.subjects).length === 0) return;

        const hasLowAttendance = Object.values(student.subjects).some(subjectData => {
            const total = subjectData.present + subjectData.absent;
            const percentage = total > 0 ? ((subjectData.present / total) * 100) : 0;
            return percentage < 75;
        });

        html += `
            <div class="enhanced-summary-card">
                <h4 style="color: var(--primary-color); margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${escapeHtml(student.name)} (${escapeHtml(student.roll)})</span>
                    ${hasLowAttendance ? '<span style="background: var(--error-color); color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.8em; animation: pulse 2s infinite;">⚠️ Low Attendance</span>' : ''}
                </h4>
        `;

        Object.entries(student.subjects).forEach(([subjectName, subjectData]) => {
            const total = subjectData.present + subjectData.absent;
            const percentage = total > 0 ? ((subjectData.present / total) * 100).toFixed(1) : 0;
            const isLowAttendance = percentage < 75;

            html += `
                <div style="margin-bottom: 15px; padding: 12px; background: ${isLowAttendance ? '#ffeaea' : '#f8f9fa'}; border-radius: 8px; border-left: 4px solid ${isLowAttendance ? 'var(--error-color)' : 'var(--accent-color)'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: var(--text-primary);">${escapeHtml(subjectName)}</strong>
                        <span style="color: ${isLowAttendance ? 'var(--error-color)' : 'var(--accent-color)'}; font-weight: bold;">${percentage}%</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px;">
                        <div style="text-align: center; font-size: 0.9em;">
                            <div style="color: var(--accent-color); font-weight: bold;">${subjectData.present}</div>
                            <div style="color: var(--text-secondary);">Present</div>
                        </div>
                        <div style="text-align: center; font-size: 0.9em;">
                            <div style="color: var(--error-color); font-weight: bold;">${subjectData.absent}</div>
                            <div style="color: var(--text-secondary);">Absent</div>
                        </div>
                        <div style="text-align: center; font-size: 0.9em;">
                            <div style="color: var(--text-primary); font-weight: bold;">${total}</div>
                            <div style="color: var(--text-secondary);">Total</div>
                        </div>
                    </div>
                    ${subjectData.absentDates.length > 0 ? `
                        <div style="margin-top: 10px;">
                            <strong style="color: var(--error-color); font-size: 0.9em;">Absent Dates:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;">
                                ${subjectData.absentDates.map(date => `
                                    <span style="background: var(--error-color); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.75em;">${date}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<div style="color: var(--accent-color); font-size: 0.9em; margin-top: 8px;">✅ Perfect Attendance!</div>'}
                </div>
            `;
        });

        html += '</div>';
    });

    summaryDiv.innerHTML = html;
    log.success('Reports', 'Student-wise summary rendered for ' + students.length + ' students');
}

async function generateSubjectWiseSummary() {
    const subjectId = document.getElementById('subject-wise-select').value;
    const summaryDiv = document.getElementById('summary-content');
    const dateFrom = document.getElementById('subject-wise-date-from').value;
    const dateTo = document.getElementById('subject-wise-date-to').value;

    if (!subjectId) {
        log.warn('Reports', 'Subject-wise summary attempted without selecting a subject');
        summaryDiv.innerHTML = '<p style="color: var(--error-color); text-align: center; padding: 20px;">Please select a subject first.</p>';
        return;
    }

    log.info('Reports', 'Generating subject-wise summary for subject=' + subjectId + (dateFrom ? ' from=' + dateFrom : '') + (dateTo ? ' to=' + dateTo : ''));

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
        summaryDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No attendance records found for this subject' + (dateFrom || dateTo ? ' in the selected date range.' : '.') + '</p>';
        return;
    }

    subjectAttendance.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare === 0) {
            return (a.lectureNumber || 1) - (b.lectureNumber || 1);
        }
        return dateCompare;
    });

    let html = `<h3 style="margin-bottom: 20px; color: var(--text-primary);">📚 Subject Wise Summary - ${escapeHtml(subjectName)}</h3>`;

    if (dateFrom || dateTo) {
        html += '<div style="background: var(--primary-light); padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center;">';
        html += '<strong>📅 Filtered Data:</strong> ';
        if (dateFrom && dateTo) {
            html += `${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`;
        } else if (dateFrom) {
            html += `From ${new Date(dateFrom).toLocaleDateString()} onwards`;
        } else {
            html += `Up to ${new Date(dateTo).toLocaleDateString()}`;
        }
        html += '</div>';
    }

    subjectAttendance.forEach(record => {
        const attendanceRecords = record.records || record.attendance || {};
        const totalStudents = Object.keys(attendanceRecords).length;
        const presentStudents = Object.values(attendanceRecords).filter(status => status === 'present').length;
        const absentStudents = totalStudents - presentStudents;
        const percentage = totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) : 0;

        const absentList = [];
        Object.entries(attendanceRecords).forEach(([rollNumber, status]) => {
            if (status === 'absent') {
                const student = students.find(s => s.roll === rollNumber);
                absentList.push({
                    roll: rollNumber,
                    name: student ? student.name : 'Unknown'
                });
            }
        });

        const lectureInfo = record.lectureNumber ? ` - ${record.lectureNumber}${getOrdinalSuffix(record.lectureNumber)} Lecture` : '';

        html += `
            <div class="enhanced-summary-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="color: var(--primary-color); margin: 0;">
                        📅 ${new Date(record.date).toLocaleDateString()}${lectureInfo}
                    </h4>
                    <span style="background: ${percentage >= 75 ? 'var(--accent-color)' : 'var(--error-color)'}; color: white; padding: 4px 12px; border-radius: 15px; font-weight: bold;">
                        ${percentage}%
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 15px;">
                    <div style="text-align: center; padding: 10px; background: var(--surface-dark); border-radius: 8px;">
                        <div style="color: var(--accent-color); font-size: 1.2em; font-weight: bold;">${presentStudents}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9em;">Present</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: var(--surface-dark); border-radius: 8px;">
                        <div style="color: var(--error-color); font-size: 1.2em; font-weight: bold;">${absentStudents}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9em;">Absent</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: var(--surface-dark); border-radius: 8px;">
                        <div style="color: var(--text-primary); font-size: 1.2em; font-weight: bold;">${totalStudents}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9em;">Total</div>
                    </div>
                </div>

                ${absentList.length > 0 ? `
                    <div style="background: #fff3e0; border: 1px solid var(--warning-color); border-radius: 8px; padding: 12px;">
                        <h5 style="color: var(--warning-color); margin-bottom: 10px;">🚫 Absent Students (${absentList.length})</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                            ${absentList.map(student => `
                                <div style="background: white; border: 1px solid var(--divider-color); border-radius: 6px; padding: 8px; display: flex; justify-content: space-between;">
                                    <strong style="color: var(--text-primary);">${escapeHtml(student.name)}</strong>
                                    <span style="color: var(--text-secondary); font-size: 0.9em;">${escapeHtml(student.roll)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div style="background: #e8f5e8; border: 1px solid var(--accent-color); border-radius: 8px; padding: 12px; text-align: center;">
                        <span style="color: var(--accent-color); font-weight: bold;">✅ Perfect Attendance - No Absentees!</span>
                    </div>
                `}
            </div>
        `;
    });

    summaryDiv.innerHTML = html;
    log.success('Reports', 'Subject-wise summary rendered for ' + subjectAttendance.length + ' records');
}

async function generateRollSearchSummary() {
    const searchTerm = document.getElementById('roll-search-input').value.trim();
    const summaryDiv = document.getElementById('summary-content');
    const dateFrom = document.getElementById('roll-search-date-from').value;
    const dateTo = document.getElementById('roll-search-date-to').value;
    const groupFilter = document.getElementById('roll-search-group-filter');
    const selectedGroupId = groupFilter ? groupFilter.value : '';

    if (!searchTerm) {
        log.warn('Reports', 'Roll search attempted without search term');
        summaryDiv.innerHTML = '<p style="color: var(--error-color); text-align: center; padding: 20px;">Please enter a roll number to search.</p>';
        return;
    }

    log.info('Reports', 'Roll search for "' + searchTerm + '"' + (selectedGroupId ? ' group=' + selectedGroupId : '') + (dateFrom ? ' from=' + dateFrom : '') + (dateTo ? ' to=' + dateTo : ''));

    let students = await getStudents();

    // Apply group filter
    if (selectedGroupId) {
        students = students.filter(s => s.groups && s.groups.includes(selectedGroupId));
    }

    const matchingStudents = students.filter(student =>
        student.roll.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matchingStudents.length === 0) {
        summaryDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No students found matching the search term.</p>';
        return;
    }

    const attendance = await getAttendance();
    const subjects = await getSubjects();

    let html = `<h3 style="margin-bottom: 20px; color: var(--text-primary);">🔍 Roll Search Results for "${searchTerm}"</h3>`;

    if (dateFrom || dateTo) {
        html += '<div style="background: var(--primary-light); padding: 10px; border-radius: 6px; margin-bottom: 15px; text-align: center;">';
        html += '<strong>📅 Filtered Data:</strong> ';
        if (dateFrom && dateTo) {
            html += `${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`;
        } else if (dateFrom) {
            html += `From ${new Date(dateFrom).toLocaleDateString()} onwards`;
        } else {
            html += `Up to ${new Date(dateTo).toLocaleDateString()}`;
        }
        html += '</div>';
    }

    matchingStudents.forEach(student => {
        html += `
            <div class="enhanced-summary-card">
                <h4 style="color: var(--primary-color); margin-bottom: 20px;">
                    ${escapeHtml(student.name)} (${escapeHtml(student.roll)})
                </h4>
        `;

        const studentSubjects = {};

        Object.values(attendance).forEach(record => {
            if (dateFrom && record.date < dateFrom) return;
            if (dateTo && record.date > dateTo) return;

            const attendanceRecords = record.records || record.attendance || {};
            if (attendanceRecords[student.roll]) {
                const subjectName = record.subject || 'Unknown Subject';
                if (!studentSubjects[subjectName]) {
                    studentSubjects[subjectName] = {
                        present: 0,
                        absent: 0,
                        absentDates: []
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
            html += '<p style="color: var(--text-secondary);">No attendance records found for this student.</p>';
        } else {
            Object.entries(studentSubjects).forEach(([subjectName, subjectData]) => {
                const total = subjectData.present + subjectData.absent;
                const percentage = total > 0 ? ((subjectData.present / total) * 100).toFixed(1) : 0;

                html += `
                    <div style="margin-bottom: 15px; padding: 15px; background: var(--surface-dark); border-radius: 8px; border-left: 4px solid var(--primary-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h5 style="color: var(--text-primary); margin: 0;">📚 ${escapeHtml(subjectName)}</h5>
                            <span style="background: ${percentage >= 75 ? 'var(--accent-color)' : 'var(--error-color)'}; color: white; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.9em;">
                                ${percentage}%
                            </span>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px;">
                                <div style="color: var(--accent-color); font-weight: bold; font-size: 1.1em;">${subjectData.present}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8em;">Present</div>
                            </div>
                            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px;">
                                <div style="color: var(--error-color); font-weight: bold; font-size: 1.1em;">${subjectData.absent}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8em;">Absent</div>
                            </div>
                            <div style="text-align: center; background: white; padding: 8px; border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold; font-size: 1.1em;">${total}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8em;">Total</div>
                            </div>
                        </div>

                        ${subjectData.absentDates.length > 0 ? `
                            <div style="background: #fff3e0; border-radius: 6px; padding: 10px;">
                                <strong style="color: var(--warning-color); font-size: 0.9em;">📅 Absent Dates (${subjectData.absentDates.length}):</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                                    ${subjectData.absentDates.map(date => `
                                        <span style="background: var(--warning-color); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em;">${date}</span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : `
                            <div style="background: #e8f5e8; border-radius: 6px; padding: 8px; text-align: center;">
                                <span style="color: var(--accent-color); font-weight: bold; font-size: 0.9em;">✅ Perfect Attendance!</span>
                            </div>
                        `}
                    </div>
                `;
            });
        }

        html += '</div>';
    });

    summaryDiv.innerHTML = html;
    log.success('Reports', 'Roll search found ' + matchingStudents.length + ' matching students');
}

async function loadCurrentStudents(groupId) {
    let students = await getStudents();
    const container = document.getElementById('current-students');
    const groups = await getGroups();

    let filterLabel = '';
    if (groupId) {
        const group = groups.find(g => g.id === groupId);
        if (group) {
            filterLabel = ` in <strong>${escapeHtml(group.name)}</strong>`;
            students = students.filter(s => s.groups && s.groups.includes(groupId));
        }
    }

    if (students.length === 0) {
        const msg = groupId ? 'No students found in this group.' : 'No students added yet.';
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">${msg}</p>`;
        return;
    }

    let html = `<h4 style="margin-bottom: 15px; color: var(--text-primary);">Current Students${filterLabel} (${students.length})</h4>`;
    students.forEach((student, index) => {
        const studentGroups = (student.groups || []).map(gId => groups.find(g => g.id === gId)).filter(Boolean);
        html += `
            <div class="student-item">
                <div class="student-info">
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-roll">Roll: ${escapeHtml(student.roll)}</div>
                    ${studentGroups.length > 0 ? `<div style="margin-top: 4px;">${studentGroups.map(g => `<span style="display: inline-block; background: ${g.color || '#2196F3'}; color: white; padding: 1px 6px; border-radius: 8px; font-size: 0.7em; margin: 1px 2px 0 0;">${escapeHtml(g.name)}</span>`).join('')}</div>` : ''}
                </div>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8em;" onclick="removeStudent('${escapeHtml(student.roll)}')">
                    🗑️ Remove
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function filterStudentsByGroup() {
    const select = document.getElementById('manage-group-filter');
    if (!select) return;
    loadCurrentStudents(select.value || null);
}

function clearGroupFilter() {
    const select = document.getElementById('manage-group-filter');
    if (select) select.value = '';
    loadCurrentStudents();
}

async function loadCurrentSubjects() {
    const subjects = await getSubjects();
    const container = document.getElementById('current-subjects');

    if (subjects.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No subjects added yet.</p>';
        return;
    }

    let html = '<h4 style="margin-bottom: 15px; color: var(--text-primary);">Current Subjects</h4>';
    subjects.forEach((subject, index) => {
        html += `
            <div class="student-item">
                <div class="student-info">
                    <div class="student-name">${escapeHtml(subject.name)}</div>
                </div>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8em;" onclick="removeSubject(${index})">
                    🗑️ Remove
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ===================================================================
// 👥 GROUP MANAGEMENT UI
// ===================================================================
async function loadGroups(selectId, includeAllOption = true) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const groups = await getGroups();

    select.innerHTML = '';
    if (includeAllOption) {
        const allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'All Groups';
        select.appendChild(allOpt);
    }
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        select.appendChild(option);
    });

    // Refresh the custom dropdown widget if initialized
    if (typeof refreshCustomDropdown === 'function') {
        refreshCustomDropdown(selectId);
    }
}

function getStudentGroupsMarkup(studentGroups, allGroups) {
    if (!studentGroups || studentGroups.length === 0) {
        return '<span style="color: var(--text-secondary); font-size: 0.8em;">No groups</span>';
    }
    return studentGroups.map(gId => {
        const g = allGroups.find(gr => gr.id === gId);
        if (!g) return null;
        return `<span style="display: inline-block; background: ${g.color || '#2196F3'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em; margin: 2px 2px 0 0;">${escapeHtml(g.name)}</span>`;
    }).filter(Boolean).join(' ');
}

async function showGroupManagement() {
    const groups = await getGroups();
    const container = document.getElementById('group-list');

    if (groups.length === 0) {
        log.info('Groups', 'No groups to display');
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No groups created yet.</p>';
        return;
    }

    log.info('Groups', 'Displaying ' + groups.length + ' groups');

    let html = '';
    groups.forEach(group => {
        html += `
            <div class="student-item">
                <div class="student-info">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${group.color || '#2196F3'}; border-radius: 50%;"></span>
                        <div class="student-name">${escapeHtml(group.name)}</div>
                    </div>
                </div>
                <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8em;" onclick="removeGroup('${group.id}')">
                    🗑️ Remove
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

const ASSIGNMENT_PAGE_SIZE = 20;

async function showStudentGroupAssignment() {
    const students = await getStudents();
    const groups = await getGroups();
    const container = document.getElementById('student-group-assignment');

    if (students.length === 0) {
        log.info('Groups', 'No students to assign to groups');
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No students found. Add students first.</p>';
        return;
    }

    if (groups.length === 0) {
        log.info('Groups', 'No groups available for assignment');
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No groups found. Create groups first.</p>';
        return;
    }

    log.info('Groups', 'Showing group assignment for ' + students.length + ' students and ' + groups.length + ' groups');

    // Get or set pagination render limit
    let renderLimit = parseInt(container.dataset.renderLimit) || ASSIGNMENT_PAGE_SIZE;
    const totalStudents = students.length;
    const showing = Math.min(renderLimit, totalStudents);

    let html = '';
    const batch = students.slice(0, showing);
    batch.forEach(student => {
        const studentGroupIds = student.groups || [];
        const assignedGroups = studentGroupIds.map(gId => groups.find(g => g.id === gId)).filter(Boolean);
        const availableGroups = groups.filter(g => !studentGroupIds.includes(g.id));

        html += `
            <div class="student-item" style="flex-wrap: wrap;" data-name="${escapeHtml(student.name).toLowerCase()}" data-roll="${escapeHtml(student.roll).toLowerCase()}">
                <div class="student-info" style="min-width: 150px;">
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-roll">${escapeHtml(student.roll)}</div>
                </div>
                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 4px; flex: 1; justify-content: flex-end;">
                    ${assignedGroups.map(g => `
                        <span style="display: inline-flex; align-items: center; gap: 4px; background: ${g.color || '#2196F3'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em;">
                            ${escapeHtml(g.name)}
                            <span onclick="unassignGroupFromStudent('${student.roll}', '${g.id}')" style="cursor: pointer; font-weight: bold; opacity: 0.8;">&times;</span>
                        </span>
                    `).join(' ')}
                    ${availableGroups.length > 0 ? `
                        <select style="width: auto; min-width: 90px; padding: 4px 6px; font-size: 11px; margin-left: 4px;" onchange="assignGroupToStudent('${student.roll}', this.value); this.value='';">
                            <option value="">+ Add</option>
                            ${availableGroups.map(g => `
                                <option value="${g.id}">${escapeHtml(g.name)}</option>
                            `).join('')}
                        </select>
                    ` : ''}
                </div>
            </div>
        `;
    });

    // Add pagination footer with count and Show More button
    if (totalStudents > ASSIGNMENT_PAGE_SIZE) {
        const remaining = totalStudents - showing;
        html += `
            <div class="assignment-pagination-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; margin-top: 8px; border-top: 1px solid var(--divider-color);">
                <span style="font-size: 12px; color: var(--text-secondary);">Showing ${showing} of ${totalStudents} students</span>
                ${remaining > 0 ? `<button class="btn" onclick="loadMoreAssignments()" style="font-size: 12px; padding: 6px 14px;">📥 Show More (${remaining} left)</button>` : ''}
            </div>
        `;
    }

    container.innerHTML = html;

    // Re-apply search filter if there's an active query
    filterStudentAssignment();
}

function loadMoreAssignments() {
    const container = document.getElementById('student-group-assignment');
    if (!container) return;
    const currentLimit = parseInt(container.dataset.renderLimit) || ASSIGNMENT_PAGE_SIZE;
    container.dataset.renderLimit = currentLimit + ASSIGNMENT_PAGE_SIZE;
    showStudentGroupAssignment();
}

function filterStudentAssignment() {
    const searchInput = document.getElementById('student-group-search');
    const container = document.getElementById('student-group-assignment');
    if (!searchInput || !container) return;

    const query = searchInput.value.trim().toLowerCase();
    const items = container.querySelectorAll('.student-item');
    let visibleCount = 0;

    items.forEach(item => {
        const name = item.dataset.name || '';
        const roll = item.dataset.roll || '';
        const matches = !query || name.includes(query) || roll.includes(query);
        item.style.display = matches ? 'flex' : 'none';
        if (matches) visibleCount++;
    });

    // Update pagination footer with filtered count when search is active
    const footer = container.querySelector('.assignment-pagination-footer');
    if (footer) {
        const countSpan = footer.querySelector('span');
        if (countSpan && query) {
            const totalItems = items.length;
            countSpan.textContent = `Showing ${visibleCount} of ${totalItems} students (filtered)`;
        }
    }

    // Show/hide no-results message
    let noResults = container.querySelector('.no-filter-results');
    if (visibleCount === 0 && items.length > 0) {
        if (!noResults) {
            noResults = document.createElement('p');
            noResults.className = 'no-filter-results';
            noResults.style.cssText = 'color: var(--text-secondary); text-align: center; padding: 20px;';
            container.appendChild(noResults);
        }
        noResults.textContent = `No students matching "${searchInput.value}"`;
        noResults.style.display = 'block';
    } else if (noResults) {
        noResults.style.display = 'none';
    }
}

// Reset pagination only for new search input changes (manual typing)
let _searchTimeout = null;
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('student-group-search');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearTimeout(_searchTimeout);
            _searchTimeout = setTimeout(() => {
                const container = document.getElementById('student-group-assignment');
                if (container && this.value.trim()) {
                    // When searching, lift pagination to show all matches
                    container.dataset.renderLimit = '99999';
                    showStudentGroupAssignment();
                } else if (container && !this.value.trim()) {
                    // When clearing search, reset pagination
                    container.dataset.renderLimit = String(ASSIGNMENT_PAGE_SIZE);
                    showStudentGroupAssignment();
                }
            }, 300);
        });
    }
});

async function loadEnrollments() {
    const subjectId = document.getElementById('enrollment-subject').value;
    const enrollmentDiv = document.getElementById('enrollment-management');

    if (!subjectId) {
        enrollmentDiv.style.display = 'none';
        return;
    }

    log.info('Enrollments', 'Loading enrollments for subject=' + subjectId);

    enrollmentDiv.style.display = 'block';
    const allStudents = await getStudents();
    const enrollments = await getEnrollments();
    const dropList = (enrollments[subjectId] && enrollments[subjectId].dropList) || [];

    if (allStudents.length === 0) {
        enrollmentDiv.innerHTML = '<p style="color: var(--text-secondary); padding: 10px;">No students found. Please add students first.</p>';
        return;
    }

    let html = '<h5 style="margin-bottom: 12px; color: var(--primary-color);">Student Enrollments</h5>';
    html += '<p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">💡 <strong>All students are enrolled by default.</strong> Click "Drop" to exclude specific students from this subject.</p>';

    allStudents.forEach(student => {
        const isDropped = dropList.includes(student.roll);
        const isEnrolled = !isDropped;
        html += `
            <div class="student-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--divider-color);">
                <div class="student-info">
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-roll">Roll: ${escapeHtml(student.roll)}</div>
                </div>
                <button class="btn ${isEnrolled ? 'btn-danger' : 'btn-success'}" 
                        onclick="toggleEnrollment('${subjectId}', '${student.roll}')"
                        style="padding: 8px 16px; font-size: 13px;">
                    ${isEnrolled ? '➖ Drop' : '➕ Re-enroll'}
                </button>
            </div>
        `;
    });

    const enrolledCount = allStudents.length - dropList.length;
    const statusColor = dropList.length > 0 ? 'var(--warning-color)' : 'var(--accent-color)';
    html = `<div style="background: var(--primary-light); padding: 10px; border-radius: 8px; margin-bottom: 12px; text-align: center; border-left: 4px solid ${statusColor};">
                <strong>${enrolledCount} of ${allStudents.length}</strong> students enrolled
                ${dropList.length > 0 ? `<br><small style="color: var(--text-secondary);">${dropList.length} student(s) dropped</small>` : ''}
            </div>` + html;

    enrollmentDiv.innerHTML = html;
}
