/* ===============================================
   INFOCAM - AI CCTV Surveillance Dashboard
   Frontend JavaScript with Backend Integration Points
   =============================================== */

// ================= CONFIGURATION =================
const API_BASE_URL = 'http://localhost:8000'; // BACKEND: Update with your FastAPI server URL
let authToken = null;
let ws = null;
let currentCameraId = null;
let currentView = 'dashboard';
let fpsInterval = null;
let frameCount = 0;
let chartInstances = {};

// ================= DOM LOADED =================
document.addEventListener("DOMContentLoaded", function() {
    
    // Check if already logged in
    authToken = localStorage.getItem('access_token');
    if (authToken) {
        // BACKEND: Verify token validity with /users/me endpoint
        verifyTokenAndLogin();
    }

    // Password Toggle
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const passwordField = this.previousElementSibling;
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
            this.classList.toggle('fa-eye');
        });
    }

    // Login Form Submit
    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleLogin(e);
        });
    }

    // Sidebar Toggle
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            setTimeout(() => { 
                window.dispatchEvent(new Event('resize')); 
                resizeCanvas();
            }, 300);
        });
    }

    // Live Camera Submenu Dropdown
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

    // Profile Dropdown
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

    // Logout Button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }

    // Camera Controls
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
        recordBtn.addEventListener('click', toggleRecording);
    }

    const snapshotBtn = document.getElementById('snapshotBtn');
    if (snapshotBtn) {
        snapshotBtn.addEventListener('click', takeSnapshot);
    }

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Window Resize
    window.addEventListener('resize', resizeCanvas);

    // Notification Icon Click
    const notificationIcon = document.getElementById('notificationIcon');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', function() {
            showNotification('Notifications', 'No new notifications', 'info');
        });
    }
});

// ================= AUTHENTICATION =================

async function handleLogin(e) {
    /* BACKEND INTEGRATION POINT
     * POST /token
     * Body: FormData with username and password (OAuth2PasswordRequestForm)
     * Response: { access_token: string, token_type: "bearer" }
     */
    
    const formData = new FormData(e.target);
    
    try {
        showLoading('Signing in...');
        
        // BACKEND: Uncomment this when FastAPI is ready
        /*
        const response = await fetch(`${API_BASE_URL}/token`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Invalid credentials');
        }
        
        const data = await response.json();
        authToken = data.access_token;
        */
        
        // TEMPORARY: Mock login for frontend testing
        await new Promise(resolve => setTimeout(resolve, 1000));
        authToken = 'mock-token-' + Date.now();
        
        localStorage.setItem('access_token', authToken);
        
        hideLoading();
        
        // Show dashboard
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'flex';
        
        // Load initial data
        await loadUserData();
        await loadCameraList();
        await loadDashboardData();
        renderCharts();
        initializeApp();
        
        showNotification('Welcome Back!', 'Login successful', 'success');
        
    } catch (error) {
        hideLoading();
        showNotification('Login Failed', error.message, 'error');
        console.error('Login error:', error);
    }
}

async function verifyTokenAndLogin() {
    /* BACKEND INTEGRATION POINT
     * GET /users/me
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: { username: string, email: string, role: string }
     */
    
    try {
        // BACKEND: Uncomment when ready
        /*
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Token expired');
        }
        */
        
        // If token is valid, show dashboard
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'flex';
        
        await loadUserData();
        await loadCameraList();
        await loadDashboardData();
        renderCharts();
        initializeApp();
        
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('access_token');
        authToken = null;
    }
}

function logout() {
    /* BACKEND INTEGRATION POINT
     * Optional: POST /logout to invalidate token on server
     */
    
    authToken = null;
    localStorage.removeItem('access_token');
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    if (fpsInterval) {
        clearInterval(fpsInterval);
        fpsInterval = null;
    }
    
    stopVideoStream();
    
    document.querySelector('.user-dropdown').classList.remove('show');
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('sidebar').classList.remove('collapsed');
    
    showNotification('Logged Out', 'You have been logged out successfully', 'success');
}

// ================= DATA LOADING =================

async function loadUserData() {
    /* BACKEND INTEGRATION POINT
     * GET /users/me
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: { username: string, email: string, role: string, avatar?: string }
     */
    
    try {
        // BACKEND: Uncomment when ready
        /*
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            
            // Update all user info elements
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('userRole').textContent = user.role;
            document.getElementById('dropdownUserEmail').textContent = user.email;
            document.getElementById('dropdownUserRole').textContent = user.role;
        }
        */
        
        // TEMPORARY: Mock data for frontend testing
        const mockUser = {
            email: 'admin@DemoCompany.io',
            role: 'CompanyAdmin'
        };
        
        document.getElementById('userEmail').textContent = mockUser.email;
        document.getElementById('userRole').textContent = mockUser.role;
        document.getElementById('dropdownUserEmail').textContent = mockUser.email;
        document.getElementById('dropdownUserRole').textContent = mockUser.role;
        
    } catch (error) {
        console.error('Failed to load user data:', error);
    }
}

async function loadCameraList() {
    /* BACKEND INTEGRATION POINT
     * GET /cameras
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: [{ id: number, name: string, ip: string, status: string, ... }]
     */
    
    try {
        // BACKEND: Uncomment when ready
        /*
        const response = await fetch(`${API_BASE_URL}/cameras`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const cameras = await response.json();
            
            const cameraSubMenu = document.getElementById('cameraSubMenu');
            cameraSubMenu.innerHTML = '';
            
            cameras.forEach(camera => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" onclick="loadCamera(${camera.id}, '${camera.name}')">${camera.name}</a>`;
                cameraSubMenu.appendChild(li);
            });
        }
        */
        
        // TEMPORARY: Mock data already in HTML
        console.log('Camera list loaded (using static HTML for now)');
        
    } catch (error) {
        console.error('Failed to load cameras:', error);
    }
}

async function loadDashboardData() {
    /* BACKEND INTEGRATION POINT
     * GET /dashboard/stats
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: {
     *   top_violation: string,
     *   violations_count: number,
     *   high_priority: number,
     *   medium_priority: number,
     *   low_priority: number
     * }
     */
    
    try {
        // BACKEND: Uncomment when ready
        /*
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            updateDashboardStats(stats);
        }
        */
        
        // TEMPORARY: Mock data for frontend testing
        const mockStats = {
            top_violation: 'No Helmet',
            violations_count: 156,
            high_priority: 45,
            medium_priority: 78,
            low_priority: 33
        };
        
        updateDashboardStats(mockStats);
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateDashboardStats(stats) {
    if (stats.top_violation) {
        document.getElementById('topViolation').textContent = stats.top_violation;
    }
    if (stats.violations_count !== undefined) {
        document.getElementById('violationsCount').textContent = stats.violations_count;
    }
    if (stats.high_priority !== undefined) {
        document.getElementById('highPriority').textContent = stats.high_priority;
    }
    if (stats.medium_priority !== undefined) {
        document.getElementById('mediumPriority').textContent = stats.medium_priority;
    }
    if (stats.low_priority !== undefined) {
        document.getElementById('lowPriority').textContent = stats.low_priority;
    }
}

async function loadCameraDetails(cameraId) {
    /* BACKEND INTEGRATION POINT
     * GET /cameras/{camera_id}
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: { id: number, name: string, ip: string, host: string, status: string, resolution: string, uptime: string }
     */
    
    try {
        // BACKEND: Uncomment when ready
        /*
        const response = await fetch(`${API_BASE_URL}/cameras/${cameraId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const camera = await response.json();
            
            document.getElementById('camIp').textContent = camera.ip || camera.host || '--';
            document.getElementById('camResolution').textContent = camera.resolution || '1920x1080';
            document.getElementById('camStatus').textContent = camera.status || 'Online';
            document.getElementById('camUptime').textContent = camera.uptime || '--';
            
            // Update status color
            const statusElement = document.getElementById('camStatus');
            statusElement.style.color = camera.status === 'Online' ? '#10b981' : '#ef4444';
        }
        */
        
        // TEMPORARY: Mock data
        const mockCamera = {
            ip: `192.168.1.10${cameraId}`,
            resolution: '1920x1080',
            status: 'Online',
            uptime: '5d 12h 34m'
        };
        
        document.getElementById('camIp').textContent = mockCamera.ip;
        document.getElementById('camResolution').textContent = mockCamera.resolution;
        document.getElementById('camStatus').textContent = mockCamera.status;
        document.getElementById('camStatus').style.color = '#10b981';
        document.getElementById('camUptime').textContent = mockCamera.uptime;
        
    } catch (error) {
        console.error('Failed to load camera details:', error);
        document.getElementById('camIp').textContent = 'N/A';
    }
}

async function loadRecentViolations() {
    /* BACKEND INTEGRATION POINT
     * GET /violations/recent?limit=10
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: [{
     *   id: number,
     *   timestamp: string,
     *   camera_id: number,
     *   camera_name: string,
     *   violation_type: string,
     *   priority: "high" | "medium" | "low",
     *   status: "new" | "reviewed" | "resolved"
     * }]
     */
    
    try {
        // BACKEND: Uncomment when ready
        /*
        const response = await fetch(`${API_BASE_URL}/violations/recent?limit=10`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const violations = await response.json();
            
            const tableBody = document.getElementById('recentViolationsTable');
            tableBody.innerHTML = '';
            
            violations.forEach(violation => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatTimestamp(violation.timestamp)}</td>
                    <td>${violation.camera_name}</td>
                    <td>${violation.violation_type}</td>
                    <td><span class="badge badge-${violation.priority}">${violation.priority}</span></td>
                    <td><span class="badge badge-${violation.status}">${violation.status}</span></td>
                    <td><button class="btn-action" onclick="viewViolation(${violation.id})">View</button></td>
                `;
                tableBody.appendChild(row);
            });
        }
        */
        
        // TEMPORARY: Using static HTML data for now
        console.log('Recent violations loaded (using static HTML for now)');
        
    } catch (error) {
        console.error('Failed to load recent violations:', error);
    }
}

// ================= VIEW SWITCHING =================

function showDashboard() {
    hideAllViews();
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Dashboard';
    currentView = 'dashboard';
    
    if (currentCameraId) {
        stopVideoStream();
    }
    
    setActiveNav('showDashboard()');
    loadDashboardData();
}

function showViolations() {
    hideAllViews();
    document.getElementById('violations-view').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Violations';
    currentView = 'violations';
    
    if (currentCameraId) {
        stopVideoStream();
    }
    
    setActiveNav('showViolations()');
    // BACKEND: Load violations data here
}

function showAnalytics() {
    hideAllViews();
    document.getElementById('analytics-view').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Analytics';
    currentView = 'analytics';
    
    if (currentCameraId) {
        stopVideoStream();
    }
    
    setActiveNav('showAnalytics()');
    // BACKEND: Load analytics data here
}

function showUsers() {
    hideAllViews();
    document.getElementById('users-view').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'User Management';
    currentView = 'users';
    
    if (currentCameraId) {
        stopVideoStream();
    }
    
    setActiveNav('showUsers()');
    // BACKEND: Load users data here
}

function showSettings() {
    hideAllViews();
    document.getElementById('settings-view').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Settings';
    currentView = 'settings';
    
    if (currentCameraId) {
        stopVideoStream();
    }
    
    setActiveNav('showSettings()');
    // BACKEND: Load settings data here
}

function loadCamera(cameraId, cameraName = null) {
    hideAllViews();
    document.getElementById('camera-view').style.display = 'block';
    
    currentCameraId = cameraId;
    currentView = 'camera';
    
    const title = cameraName || `Camera ${cameraId}`;
    document.getElementById('cameraTitle').textContent = `Live Stream: ${title}`;
    document.getElementById('pageTitle').textContent = title;
    
    loadCameraDetails(cameraId);
    startVideoStream(cameraId);
    
    setTimeout(resizeCanvas, 100);
    
    console.log(`Switched to Camera ${cameraId}`);
}

function hideAllViews() {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('camera-view').style.display = 'none';
    document.getElementById('violations-view').style.display = 'none';
    document.getElementById('analytics-view').style.display = 'none';
    document.getElementById('users-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'none';
}

function setActiveNav(onclickValue) {
    document.querySelectorAll('.nav-item a').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-item a[onclick="${onclickValue}"]`);
    if (activeLink) activeLink.classList.add('active');
}

// ================= VIDEO STREAMING =================

function startVideoStream(cameraId) {
    /* BACKEND INTEGRATION POINT
     * GET /video_feed/{camera_id}
     * Headers: { Authorization: `Bearer ${authToken}` }
     * Response: MJPEG stream (multipart/x-mixed-replace; boundary=frame)
     * 
     * Alternative: WebSocket stream
     * WS /ws/video/{camera_id}?token={authToken}
     */
    
    const videoFeed = document.getElementById('liveVideoFeed');
    const streamStatus = document.getElementById('streamStatus');
    const liveIndicator = document.getElementById('liveIndicator');
    
    // BACKEND: Uncomment when video streaming is ready
    /*
    videoFeed.src = `${API_BASE_URL}/video_feed/${cameraId}?token=${authToken}&t=${Date.now()}`;
    */
    
    // TEMPORARY: Use placeholder for testing
    videoFeed.src = `https://via.placeholder.com/1920x1080/1f2937/ffffff?text=Camera+${cameraId}+Stream`;
    
    videoFeed.onload = function() {
        streamStatus.textContent = 'LIVE';
        liveIndicator.style.color = '#22c55e';
        resizeCanvas();
        startFPSCounter();
    };
    
    videoFeed.onerror = function() {
        streamStatus.textContent = 'OFFLINE';
        liveIndicator.style.color = '#ef4444';
        document.getElementById('camStatus').textContent = 'Offline';
        document.getElementById('camStatus').style.color = '#ef4444';
        showNotification('Camera Error', 'Failed to load camera stream', 'error');
    };
}

function stopVideoStream() {
    const videoFeed = document.getElementById('liveVideoFeed');
    videoFeed.src = '';
    currentCameraId = null;
    
    if (fpsInterval) {
        clearInterval(fpsInterval);
        fpsInterval = null;
    }
    
    clearCanvas();
    
    // Reset detection count
    document.getElementById('detectionCount').textContent = '0';
}

// ================= DETECTION OVERLAY =================

function resizeCanvas() {
    const videoFeed = document.getElementById('liveVideoFeed');
    const canvas = document.getElementById('detectionCanvas');
    
    if (!canvas || !videoFeed) return;
    
    // Match canvas size to video display size
    canvas.width = videoFeed.offsetWidth;
    canvas.height = videoFeed.offsetHeight;
}

function clearCanvas() {
    const canvas = document.getElementById('detectionCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawDetections(detections) {
    /* BACKEND INTEGRATION POINT
     * Detections data structure from WebSocket or API:
     * [{
     *   class: string,
     *   confidence: number (0-1),
     *   x: number,
     *   y: number,
     *   width: number,
     *   height: number,
     *   image_width: number,
     *   image_height: number
     * }]
     */
    
    if (!detections || detections.length === 0) {
        clearCanvas();
        document.getElementById('detectionCount').textContent = '0';
        updateDetectionLegend([]);
        return;
    }
    
    const canvas = document.getElementById('detectionCanvas');
    const videoFeed = document.getElementById('liveVideoFeed');
    
    if (!canvas || !videoFeed) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update detection count
    document.getElementById('detectionCount').textContent = detections.length;
    
    // Draw each detection
    detections.forEach(detection => {
        // Scale coordinates to canvas size
        const scaleX = canvas.width / detection.image_width;
        const scaleY = canvas.height / detection.image_height;
        
        const x = detection.x * scaleX;
        const y = detection.y * scaleY;
        const width = detection.width * scaleX;
        const height = detection.height * scaleY;
        
        const color = getColorForClass(detection.class);
        
        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        const label = `${detection.class} ${(detection.confidence * 100).toFixed(0)}%`;
        ctx.font = 'bold 14px Inter';
        const textWidth = ctx.measureText(label).width;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 28, textWidth + 12, 28);
        
        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x + 6, y - 8);
    });
    
    // Update legend
    updateDetectionLegend(detections);
}

function getColorForClass(className) {
    const colors = {
        'person': '#22c55e',
        'car': '#3b82f6',
        'truck': '#f59e0b',
        'motorcycle': '#ef4444',
        'bicycle': '#8b5cf6',
        'bus': '#ec4899',
        'helmet': '#10b981',
        'no_helmet': '#dc2626',
        'default': '#6366f1'
    };
    
    return colors[className.toLowerCase()] || colors.default;
}

function updateDetectionLegend(detections) {
    const legendContainer = document.getElementById('detectionLegend');
    if (!legendContainer) return;
    
    // Count detections by class
    const classCounts = {};
    detections.forEach(det => {
        classCounts[det.class] = (classCounts[det.class] || 0) + 1;
    });
    
    // Build legend HTML
    let html = '';
    for (const [className, count] of Object.entries(classCounts)) {
        const color = getColorForClass(className);
        html += `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <div style="width: 12px; height: 12px; background: ${color}; border-radius: 2px;"></div>
                <span style="font-size: 11px;">${className}: ${count}</span>
            </div>
        `;
    }
    
    legendContainer.innerHTML = html || '<div style="font-size: 11px; opacity: 0.6;">No detections</div>';
}

// ================= FPS COUNTER =================

function startFPSCounter() {
    if (fpsInterval) clearInterval(fpsInterval);
    
    frameCount = 0;
    let lastFrameTime = Date.now();
    
    fpsInterval = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = (currentTime - lastFrameTime) / 1000;
        const fps = Math.round(frameCount / elapsed);
        
        document.getElementById('fpsCounter').textContent = fps;
        
        frameCount = 0;
        lastFrameTime = currentTime;
    }, 1000);
    
    // Increment frame count on image load
    const videoFeed = document.getElementById('liveVideoFeed');
    const frameCounter = () => {
        frameCount++;
    };
    
    videoFeed.removeEventListener('load', frameCounter);
    videoFeed.addEventListener('load', frameCounter);
}

// ================= WEBSOCKET =================

function connectWebSocket() {
    /* BACKEND INTEGRATION POINT
     * WebSocket endpoint: WS /ws?token={authToken}
     * 
     * Message types to handle:
     * 1. Detection updates: { type: "detection", camera_id: number, detections: [...] }
     * 2. Violation alerts: { type: "violation", camera_id: number, violation_type: string, priority: string }
     * 3. Stats updates: { type: "stats", stats: {...} }
     * 4. Camera status: { type: "camera_status", camera_id: number, status: string }
     */
    
    if (ws) return;
    
    // BACKEND: Uncomment when WebSocket is ready
    /*
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    ws = new WebSocket(`${wsUrl}/ws?token=${authToken}`);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
        showNotification('Connected', 'Real-time updates enabled', 'success');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'violation':
                handleNewViolation(data);
                break;
                
            case 'detection':
                if (data.camera_id == currentCameraId) {
                    handleDetection(data);
                }
                break;
                
            case 'stats':
                updateDashboardStats(data.stats);
                break;
                
            case 'camera_status':
                handleCameraStatusUpdate(data);
                break;
                
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        showNotification('Connection Error', 'Real-time updates unavailable', 'warning');
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected. Reconnecting...');
        ws = null;
        setTimeout(connectWebSocket, 3000);
    };
    */
    
    // TEMPORARY: Mock WebSocket for testing
    console.log('WebSocket initialization skipped (backend not ready)');
    
    // Simulate detection updates every 2 seconds (for testing overlay)
    /*
    setInterval(() => {
        if (currentCameraId) {
            const mockDetections = [
                {
                    class: 'person',
                    confidence: 0.95,
                    x: 100,
                    y: 150,
                    width: 200,
                    height: 400,
                    image_width: 1920,
                    image_height: 1080
                },
                {
                    class: 'car',
                    confidence: 0.88,
                    x: 800,
                    y: 500,
                    width: 300,
                    height: 200,
                    image_width: 1920,
                    image_height: 1080
                }
            ];
            drawDetections(mockDetections);
        }
    }, 2000);
    */
}

function handleNewViolation(data) {
    // Reload dashboard stats
    loadDashboardData();
    
    // Show notification
    showNotification(
        'New Violation Detected',
        `${data.violation_type} at Camera ${data.camera_id} - Priority: ${data.priority}`,
        'warning'
    );
    
    // Update notification badge
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        const current = parseInt(badge.textContent) || 0;
        badge.textContent = current + 1;
    }
}

function handleDetection(data) {
    if (data.detections && currentView === 'camera') {
        drawDetections(data.detections);
    }
}

function handleCameraStatusUpdate(data) {
    // BACKEND: Update camera status in UI
    console.log(`Camera ${data.camera_id} status: ${data.status}`);
}

// ================= CAMERA CONTROLS =================

let isRecording = false;

function toggleRecording() {
    /* BACKEND INTEGRATION POINT
     * POST /cameras/{camera_id}/record
     * Body: { action: "start" | "stop" }
     */
    
    const recordBtn = document.getElementById('recordBtn');
    
    isRecording = !isRecording;
    
    if (isRecording) {
        recordBtn.style.color = '#ef4444';
        recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
        showNotification('Recording Started', `Camera ${currentCameraId} is now recording`, 'info');
        
        // BACKEND: Start recording
        /*
        fetch(`${API_BASE_URL}/cameras/${currentCameraId}/record`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'start' })
        });
        */
    } else {
        recordBtn.style.color = '';
        recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
        showNotification('Recording Stopped', `Camera ${currentCameraId} recording stopped`, 'info');
        
        // BACKEND: Stop recording
        /*
        fetch(`${API_BASE_URL}/cameras/${currentCameraId}/record`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'stop' })
        });
        */
    }
}

function takeSnapshot() {
    /* BACKEND INTEGRATION POINT
     * POST /cameras/{camera_id}/snapshot
     * Response: { url: string, filename: string }
     */
    
    const videoFeed = document.getElementById('liveVideoFeed');
    const canvas = document.createElement('canvas');
    canvas.width = videoFeed.naturalWidth || videoFeed.width;
    canvas.height = videoFeed.naturalHeight || videoFeed.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoFeed, 0, 0);
    
    // Download snapshot
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snapshot_camera${currentCameraId}_${Date.now()}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Snapshot Saved', 'Image saved to downloads', 'success');
    }, 'image/jpeg', 0.95);
    
    // BACKEND: Also save to server
    /*
    canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append('file', blob, `snapshot_${Date.now()}.jpg`);
        
        fetch(`${API_BASE_URL}/cameras/${currentCameraId}/snapshot`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
    }, 'image/jpeg');
    */
}

function toggleFullscreen() {
    const videoContainer = document.getElementById('videoContainerWrapper');
    
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error('Fullscreen error:', err);
        });
        document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        document.exitFullscreen();
        document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-expand"></i>';
    }
}

// ================= CHARTS =================

function renderCharts() {
    /* BACKEND INTEGRATION POINT
     * GET /dashboard/charts
     * Response: {
     *   violation_types: { labels: [...], data: [...] },
     *   camera_activity: { labels: [...], data: [...] },
     *   monthly: { labels: [...], data: [...] },
     *   weekly: { labels: [...], data: [...], trend: [...] },
     *   timeline: { labels: [...], data: [...] }
     * }
     */
    
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartInstances = {};
    
    // Chart 1: Violation Types (Doughnut)
    const ctxViolationTypes = document.getElementById('chartViolationTypes');
    if (ctxViolationTypes) {
        chartInstances.violationTypes = new Chart(ctxViolationTypes.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['No Helmet', 'Restricted Area', 'Loitering', 'Speeding', 'Wrong Way'],
                datasets: [{
                    data: [45, 28, 15, 12, 8],
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }
    
    // Chart 2: Camera Activity (Bar)
    const ctxCameraActivity = document.getElementById('chartCameraActivity');
    if (ctxCameraActivity) {
        chartInstances.cameraActivity = new Chart(ctxCameraActivity.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Camera 01', 'Camera 02', 'Camera 03', 'Camera 04', 'Camera 05'],
                datasets: [{
                    label: 'Detections',
                    data: [245, 189, 156, 132, 98],
                    backgroundColor: '#2563eb',
                    borderRadius: 6,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    // Chart 3: Monthly (Bar)
    const ctxMonths = document.getElementById('chartMonths');
    if (ctxMonths) {
        chartInstances.months = new Chart(ctxMonths.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['May', 'June', 'July', 'August', 'September', 'October', 'November'],
                datasets: [{
                    label: 'Violations',
                    data: [45, 78, 123, 89, 156, 221, 189],
                    backgroundColor: '#7b1fa2',
                    borderRadius: 6,
                    barThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 250,
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    // Chart 4: Weekly (Bar + Line)
    const ctxWeeks = document.getElementById('chartWeeks');
    if (ctxWeeks) {
        chartInstances.weeks = new Chart(ctxWeeks.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Week 41', 'Week 42', 'Week 43', 'Week 44', 'Week 45', 'Week 46', 'Week 47'],
                datasets: [
                    {
                        type: 'bar',
                        label: 'Violations',
                        data: [218, 145, 98, 134, 178, 205, 189],
                        backgroundColor: '#7b1fa2',
                        borderRadius: 6,
                        barThickness: 40,
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Trend',
                        data: [218, 180, 145, 122, 150, 180, 189],
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#ef4444',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 250,
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    // Chart 5: Timeline (Line)
    const ctxTimeline = document.getElementById('chartTimeline');
    if (ctxTimeline) {
        chartInstances.timeline = new Chart(ctxTimeline.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '23:59'],
                datasets: [{
                    label: 'Violations',
                    data: [2, 1, 3, 8, 15, 22, 28, 18, 5],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

// ================= NOTIFICATIONS =================

function showNotification(title, message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.notification-toast').forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showLoading(message = 'Loading...') {
    // Remove existing loading
    hideLoading();
    
    const loading = document.createElement('div');
    loading.id = 'loadingOverlay';
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="loading-text">${message}</p>
    `;
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.remove();
}

// ================= UTILITY FUNCTIONS =================

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    }
    
    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // Default format
    return date.toLocaleString();
}

function viewViolation(violationId) {
    /* BACKEND INTEGRATION POINT
     * GET /violations/{violation_id}
     * Show violation details in modal or navigate to violations page
     */
    
    console.log('View violation:', violationId);
    showNotification('Violation Details', `Loading violation #${violationId}...`, 'info');
    
    // TODO: Implement violation detail modal
}

// ================= APP INITIALIZATION =================

function initializeApp() {
    // Connect WebSocket for real-time updates
    connectWebSocket();
    
    // Refresh dashboard stats every 30 seconds
    setInterval(() => {
        if (currentView === 'dashboard') {
            loadDashboardData();
        }
    }, 30000);
    
    // Load recent violations
    if (currentView === 'dashboard') {
        loadRecentViolations();
    }
    
    console.log('INFOCAM initialized successfully');
}

// ================= GLOBAL ERROR HANDLER =================

window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('Error', 'An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('Error', 'An unexpected error occurred', 'error');
});