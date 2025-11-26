document.addEventListener("DOMContentLoaded", function() {
    
    // 1. LOGIN LOGIC
    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // FASTAPI INTEGRATION: 
            // const formData = new FormData(loginForm);
            // fetch('YOUR_FASTAPI_URL/token', { method: 'POST', body: formData }).then(...)
            
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'flex';
            renderCharts();
        });
    }

    // 2. SIDEBAR TOGGLE
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 300);
        });
    }

    // 3. LIVE CAMERA SUBMENU DROPDOWN
    const cameraLink = document.getElementById('cameraDropdownLink');
    const cameraSubMenu = document.getElementById('cameraSubMenu');
    if(cameraLink && cameraSubMenu) {
        cameraLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (sidebar.classList.contains('collapsed')) return;
            cameraSubMenu.classList.toggle('open');
            cameraLink.classList.toggle('open');
        });
    }

    // 4. PROFILE DROPDOWN
    const userAvatar = document.getElementById('userAvatar');
    const userDropdown = document.getElementById('userDropdown');
    if (userAvatar && userDropdown) {
        userAvatar.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        document.addEventListener('click', function(e) {
            if (!userDropdown.contains(e.target) && !userAvatar.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
    }

    // 5. LOGOUT LOGIC
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // FASTAPI INTEGRATION: Clear token
            userDropdown.classList.remove('show');
            document.getElementById('dashboard-section').style.display = 'none';
            document.getElementById('login-section').style.display = 'flex';
            sidebar.classList.remove('collapsed');
        });
    }

    // 6. CHARTS CONFIGURATION
    function renderCharts() {
        const ctxMonths = document.getElementById('chartMonths');
        if (ctxMonths) {
            if (window.chartMonthsInstance) window.chartMonthsInstance.destroy();
            window.chartMonthsInstance = new Chart(ctxMonths.getContext('2d'), {
                type: 'bar',
                data: { labels: ['', '', '', 'October 2025', '', '', ''], datasets: [{ label: 'Violations', data: [0, 0, 0, 221, 0, 0, 0], backgroundColor: '#7b1fa2', barThickness: 80, borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 250 } } }
            });
        }
        const ctxWeeks = document.getElementById('chartWeeks');
        if (ctxWeeks) {
            if (window.chartWeeksInstance) window.chartWeeksInstance.destroy();
            window.chartWeeksInstance = new Chart(ctxWeeks.getContext('2d'), {
                data: { labels: ['Week: 41', '', '', '', '', '', 'Week: 43'], datasets: [{ type: 'bar', label: 'Violations', data: [218, 0, 0, 0, 0, 0, 5], backgroundColor: '#7b1fa2', barThickness: 60, order: 2 }, { type: 'line', label: 'Trend', data: [218, 180, 145, 110, 75, 40, 5], borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 2, tension: 0, pointRadius: 3, order: 1 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } }, scales: { y: { beginAtZero: true, max: 250 } } }
            });
        }
        const ctxSummary = document.getElementById('chartSummary');
        if (ctxSummary) {
            if (window.chartSummaryInstance) window.chartSummaryInstance.destroy();
            window.chartSummaryInstance = new Chart(ctxSummary.getContext('2d'), {
                type: 'line', data: { labels: ['0', '1', '2', '3', '4', '5'], datasets: [] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 5 }, x: { grid: { display: false } } } }
            });
        }
    }
});

// 7. GLOBAL FUNCTIONS FOR HTML ONCLICK

function showDashboard() {
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('camera-view').style.display = 'none';
    // Reset active class
    document.querySelectorAll('.nav-item a').forEach(el => el.classList.remove('active'));
    // Set dashboard active
    document.querySelector('.nav-item a[onclick="showDashboard()"]').classList.add('active');
}

function loadCamera(cameraId) {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('camera-view').style.display = 'block';

    document.getElementById('cameraTitle').innerText = `Live Stream: Camera 0${cameraId}`;
    document.getElementById('camIp').innerText = `192.168.1.10${cameraId}`;
    
    // FASTAPI INTEGRATION:
    // document.getElementById('liveVideoFeed').src = `/api/video_feed/${cameraId}`;
    
    console.log(`Switching to Camera ${cameraId}`);
}