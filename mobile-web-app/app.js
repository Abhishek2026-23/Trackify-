// ── Config ────────────────────────────────────────────────────────
const API = 'http://localhost:5000';
let state = { user: null, role: null, isAvailable: false, map: null,
              markers: {}, locationTimer: null, selectedDriver: null,
              drivers: [], filter: 'all' };

// ── Persist session ───────────────────────────────────────────────
const save  = () => localStorage.setItem('bt_user', JSON.stringify(state.user));
const load  = () => { try { return JSON.parse(localStorage.getItem('bt_user')); } catch { return null; } };
const clear = () => localStorage.removeItem('bt_user');

// ── Router ────────────────────────────────────────────────────────
const show = (id) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
};

// ── Toast ─────────────────────────────────────────────────────────
const toast = (msg) => {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
};

// ── API helpers ───────────────────────────────────────────────────
const post = async (path, body) => {
  const r = await fetch(API + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
};
const get = async (path) => { const r = await fetch(API + path); return r.json(); };

// ── Socket ────────────────────────────────────────────────────────
let socket;
const connectSocket = () => {
  socket = io(API, { transports: ['websocket', 'polling'] });
  socket.on('driver_location_update', (data) => {
    const idx = state.drivers.findIndex(d => d.driverId === data.driverId);
    if (idx >= 0) Object.assign(state.drivers[idx], data);
    else state.drivers.push(data);
    updateMapMarkers();
    if (document.getElementById('nearby-list').classList.contains('active')) renderDriverList();
  });
};

// ── GPS ───────────────────────────────────────────────────────────
const startGPS = () => {
  if (!navigator.geolocation) return toast('GPS not supported');
  state.locationTimer = setInterval(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      post('/location/update', {
        driverId: state.user.driverId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speed: (pos.coords.speed || 0) * 3.6,
        isAvailable: state.isAvailable
      });
      document.getElementById('d-lat').textContent = pos.coords.latitude.toFixed(5);
      document.getElementById('d-lng').textContent = pos.coords.longitude.toFixed(5);
      document.getElementById('d-spd').textContent =
        ((pos.coords.speed || 0) * 3.6).toFixed(1) + ' km/h';
    });
  }, 5000);
};
const stopGPS = () => { clearInterval(state.locationTimer); state.locationTimer = null; };

// ── Haversine ─────────────────────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// ── Render ────────────────────────────────────────────────────────
const render = () => {
  document.getElementById('app').innerHTML = `
    <!-- SPLASH -->
    <div id="splash" class="screen grad">
      <div class="emoji">🚌</div>
      <h1>Bus Tracking</h1>
      <p>Real-Time Transport System</p>
      <div class="spinner"></div>
    </div>

    <!-- ROLE SELECTION -->
    <div id="role-select" class="screen grad">
      <div class="role-header">
        <span class="emoji">🚌</span>
        <h1>Welcome</h1>
        <p>Choose your role to continue</p>
      </div>
      <div class="role-card" onclick="goLogin('driver')">
        <span class="icon">🚗</span>
        <div class="info"><h3>I am a Driver</h3><p>Auto / Bus / Taxi operator</p></div>
        <span class="arrow">›</span>
      </div>
      <div class="role-card" onclick="goLogin('passenger')">
        <span class="icon">👤</span>
        <div class="info"><h3>I am a Passenger</h3><p>Find nearby vehicles</p></div>
        <span class="arrow">›</span>
      </div>
      <div class="role-footer">
        <a onclick="goSignup('passenger')">New here? Create an account</a>
      </div>
    </div>

    <!-- LOGIN -->
    <div id="login" class="screen auth-screen">
      <div class="auth-header">
        <button class="back-btn" onclick="show('role-select')">‹</button>
        <h2 id="login-title">Login</h2>
      </div>
      <div class="auth-body">
        <div class="auth-emoji" id="login-emoji">👤</div>
        <div id="login-error" class="error-msg" style="display:none"></div>
        <div id="login-driver-field" class="form-group" style="display:none">
          <label>Driver ID</label>
          <input id="login-driverid" placeholder="e.g. DRV-XXXXXXXX"/>
        </div>
        <div id="login-phone-field" class="form-group">
          <label>Phone Number</label>
          <input id="login-phone" type="tel" placeholder="10-digit phone number"/>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input id="login-pass" type="password" placeholder="Enter password"/>
        </div>
        <button class="btn-primary" onclick="doLogin()">Login</button>
        <div class="auth-switch">
          Don't have an account? <a id="login-signup-link">Sign up</a>
        </div>
      </div>
    </div>

    <!-- SIGNUP -->
    <div id="signup" class="screen auth-screen">
      <div class="auth-header">
        <button class="back-btn" onclick="show('login')">‹</button>
        <h2 id="signup-title">Create Account</h2>
      </div>
      <div class="auth-body">
        <div class="auth-emoji" id="signup-emoji">✨</div>
        <div id="signup-error" class="error-msg" style="display:none"></div>
        <div class="form-group"><label>Full Name</label>
          <input id="su-name" placeholder="Your full name"/></div>
        <div class="form-group"><label>Phone Number</label>
          <input id="su-phone" type="tel" placeholder="10-digit phone"/></div>
        <div class="form-group"><label>Email (optional)</label>
          <input id="su-email" type="email" placeholder="your@email.com"/></div>
        <div id="driver-fields" style="display:none">
          <div class="form-group"><label>Vehicle Type</label>
            <select id="su-vtype">
              <option value="auto">🛺 Auto</option>
              <option value="bus">🚌 Bus</option>
              <option value="taxi">🚕 Taxi</option>
            </select></div>
          <div class="form-group"><label>Vehicle Number</label>
            <input id="su-vnum" placeholder="e.g. PB-01-1234"/></div>
        </div>
        <div class="form-group"><label>Password</label>
          <input id="su-pass" type="password" placeholder="Min 6 characters"/></div>
        <button class="btn-primary" onclick="doSignup()">Create Account</button>
        <div class="auth-switch">Already have an account? <a onclick="show('login')">Login</a></div>
      </div>
    </div>

    <!-- DRIVER DASHBOARD -->
    <div id="driver-dash" class="screen">
      <div class="topbar">
        <h2>Driver Dashboard</h2>
        <button class="logout-btn" onclick="doLogout()">Logout</button>
      </div>
      <div class="dash-body">
        <div class="driver-card">
          <div class="big-emoji">🚗</div>
          <h3 id="d-name">Driver</h3>
          <div class="driver-id" id="d-id"></div>
          <span class="status-badge offline" id="d-status">● Offline</span>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🚌</div>
            <div class="stat-val" id="d-vtype">-</div>
            <div class="stat-lbl">Vehicle</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔢</div>
            <div class="stat-val" id="d-vnum">-</div>
            <div class="stat-lbl">Number</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚡</div>
            <div class="stat-val" id="d-spd">0 km/h</div>
            <div class="stat-lbl">Speed</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📍</div>
            <div class="stat-val" id="d-gps">Waiting</div>
            <div class="stat-lbl">GPS</div>
          </div>
        </div>
        <div class="stat-card" style="margin-bottom:16px;padding:14px">
          <div style="font-size:13px;color:#888;margin-bottom:4px">📍 Location</div>
          <div style="font-size:13px">Lat: <span id="d-lat">-</span></div>
          <div style="font-size:13px">Lng: <span id="d-lng">-</span></div>
        </div>
        <button class="toggle-btn go" id="toggle-btn" onclick="toggleAvailability()">
          ▶ Go Available
        </button>
        <div class="live-indicator" id="live-ind" style="display:none">
          📡 Sending live location every 5 seconds...
        </div>
      </div>
    </div>

    <!-- PASSENGER MAP -->
    <div id="passenger-map" class="screen">
      <div class="map-topbar">
        <h2>Nearby Drivers</h2>
        <div style="display:flex;gap:8px">
          <button class="icon-btn" onclick="show('nearby-list');renderDriverList()" title="List view">☰</button>
          <button class="icon-btn" onclick="doLogout()" title="Logout">⏻</button>
        </div>
      </div>
      <div class="filter-bar" id="map-filter-bar"></div>
      <div id="map-container" style="flex:1;position:relative">
        <div id="map" style="width:100%;height:100%;min-height:400px"></div>
        <button class="fab" onclick="refreshDrivers()" title="Refresh">↻</button>
        <div class="driver-popup" id="driver-popup" style="display:none">
          <div class="popup-header">
            <span class="popup-icon" id="pp-icon">🚗</span>
            <div><div class="popup-name" id="pp-name"></div>
              <div class="popup-sub" id="pp-sub"></div></div>
            <button class="popup-close" onclick="closePopup()">✕</button>
          </div>
          <div class="popup-stats">
            <div class="popup-stat"><div class="val" id="pp-dist">-</div><div class="lbl">Distance</div></div>
            <div class="popup-stat"><div class="val" id="pp-eta">-</div><div class="lbl">ETA</div></div>
            <div class="popup-stat"><div class="val" id="pp-spd">-</div><div class="lbl">Speed</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- NEARBY LIST -->
    <div id="nearby-list" class="screen">
      <div class="topbar">
        <h2>Nearby Drivers</h2>
        <button class="logout-btn" onclick="show('passenger-map')">Map ›</button>
      </div>
      <div class="filter-bar" id="list-filter-bar"></div>
      <div class="list-body" id="driver-list-body"></div>
    </div>
  `;
};

// ── Navigation helpers ────────────────────────────────────────────
window.goLogin = (role) => {
  state.role = role;
  document.getElementById('login-title').textContent = role === 'driver' ? 'Driver Login' : 'Passenger Login';
  document.getElementById('login-emoji').textContent = role === 'driver' ? '🚗' : '👤';
  document.getElementById('login-driver-field').style.display = role === 'driver' ? 'block' : 'none';
  document.getElementById('login-phone-field').style.display  = role === 'driver' ? 'none'  : 'block';
  document.getElementById('login-signup-link').onclick = () => goSignup(role);
  show('login');
};

window.goSignup = (role) => {
  state.role = role;
  document.getElementById('signup-title').textContent = role === 'driver' ? 'Driver Sign Up' : 'Passenger Sign Up';
  document.getElementById('signup-emoji').textContent = role === 'driver' ? '🚗' : '👤';
  document.getElementById('driver-fields').style.display = role === 'driver' ? 'block' : 'none';
  show('signup');
};

// ── Auth actions ──────────────────────────────────────────────────
window.doLogin = async () => {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  const body = state.role === 'driver'
    ? { driverId: document.getElementById('login-driverid').value.trim(),
        password: document.getElementById('login-pass').value }
    : { phone: document.getElementById('login-phone').value.trim(),
        password: document.getElementById('login-pass').value };

  try {
    const res = await post('/auth/login', body);
    if (res.error) { errEl.textContent = res.error; errEl.style.display = 'block'; return; }
    state.user = res.user;
    save();
    connectSocket();
    state.user.isDriver ? openDriverDash() : openPassengerMap();
  } catch { errEl.textContent = 'Cannot connect to server. Is it running?'; errEl.style.display = 'block'; }
};

window.doSignup = async () => {
  const errEl = document.getElementById('signup-error');
  errEl.style.display = 'none';
  const body = {
    name: document.getElementById('su-name').value.trim(),
    phone: document.getElementById('su-phone').value.trim(),
    email: document.getElementById('su-email').value.trim(),
    password: document.getElementById('su-pass').value,
    role: state.role,
    ...(state.role === 'driver' && {
      vehicleType: document.getElementById('su-vtype').value,
      vehicleNumber: document.getElementById('su-vnum').value.trim()
    })
  };
  try {
    const res = await post('/auth/register', body);
    if (res.error) { errEl.textContent = res.error; errEl.style.display = 'block'; return; }
    toast('✅ Registered! Your Driver ID: ' + (res.user.driverId || ''));
    setTimeout(() => goLogin(state.role), 1500);
  } catch { errEl.textContent = 'Cannot connect to server.'; errEl.style.display = 'block'; }
};

window.doLogout = () => {
  stopGPS();
  state.user = null; state.isAvailable = false;
  clear(); show('role-select');
};

// ── Driver Dashboard ──────────────────────────────────────────────
const openDriverDash = () => {
  const u = state.user;
  document.getElementById('d-name').textContent  = u.name;
  document.getElementById('d-id').textContent    = 'ID: ' + u.driverId;
  document.getElementById('d-vtype').textContent = (u.vehicleType || '-').toUpperCase();
  document.getElementById('d-vnum').textContent  = u.vehicleNumber || '-';
  show('driver-dash');
};

window.toggleAvailability = () => {
  state.isAvailable = !state.isAvailable;
  const btn = document.getElementById('toggle-btn');
  const badge = document.getElementById('d-status');
  const ind = document.getElementById('live-ind');
  const gps = document.getElementById('d-gps');

  if (state.isAvailable) {
    btn.textContent = '■ Stop Availability';
    btn.className = 'toggle-btn stop';
    badge.textContent = '● Available'; badge.className = 'status-badge available';
    ind.style.display = 'block'; gps.textContent = 'Active';
    startGPS();
    toast('🟢 You are now available!');
  } else {
    btn.textContent = '▶ Go Available';
    btn.className = 'toggle-btn go';
    badge.textContent = '● Offline'; badge.className = 'status-badge offline';
    ind.style.display = 'none'; gps.textContent = 'Stopped';
    stopGPS();
    toast('🔴 You are now offline');
  }
};

// ── Passenger Map ─────────────────────────────────────────────────
let passengerPos = null;

const openPassengerMap = async () => {
  show('passenger-map');
  renderFilterBars();
  connectSocket();

  await new Promise(res => setTimeout(res, 100)); // wait for DOM

  state.map = L.map('map').setView([30.7333, 76.7794], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(state.map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      passengerPos = pos.coords;
      L.marker([pos.coords.latitude, pos.coords.longitude], {
        icon: L.divIcon({ html: '<div style="background:#667eea;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>', iconSize: [16,16], iconAnchor: [8,8] })
      }).addTo(state.map).bindPopup('📍 You are here');
      state.map.setView([pos.coords.latitude, pos.coords.longitude], 14);
      refreshDrivers();
    }, () => refreshDrivers());
  } else { refreshDrivers(); }
};

window.refreshDrivers = async () => {
  const lat = passengerPos?.latitude  || 30.7333;
  const lng = passengerPos?.longitude || 76.7794;
  const vt  = state.filter === 'all' ? '' : '&vehicleType=' + state.filter;
  try {
    const data = await get(`/drivers/nearby?lat=${lat}&lng=${lng}&radius=5${vt}`);
    state.drivers = data.drivers || [];
    updateMapMarkers();
  } catch { toast('Could not fetch drivers'); }
};

const vehicleIcon = (type) => ({ bus:'🚌', taxi:'🚕', auto:'🛺' }[type] || '🚗');

const updateMapMarkers = () => {
  if (!state.map) return;
  const filtered = state.filter === 'all'
    ? state.drivers
    : state.drivers.filter(d => d.vehicleType === state.filter);

  // Remove stale markers
  Object.keys(state.markers).forEach(id => {
    if (!filtered.find(d => d.driverId === id)) {
      state.map.removeLayer(state.markers[id]);
      delete state.markers[id];
    }
  });

  filtered.forEach(d => {
    if (!d.isAvailable) return;
    const icon = L.divIcon({
      html: `<div style="background:${state.selectedDriver?.driverId===d.driverId?'#764ba2':'#667eea'};
             width:40px;height:40px;border-radius:50%;display:flex;align-items:center;
             justify-content:center;font-size:20px;border:3px solid #fff;
             box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer">${vehicleIcon(d.vehicleType)}</div>`,
      iconSize: [40,40], iconAnchor: [20,20]
    });

    if (state.markers[d.driverId]) {
      state.markers[d.driverId].setLatLng([d.latitude, d.longitude]);
      state.markers[d.driverId].setIcon(icon);
    } else {
      const m = L.marker([d.latitude, d.longitude], { icon })
        .addTo(state.map)
        .on('click', () => showDriverPopup(d));
      state.markers[d.driverId] = m;
    }
  });
};

window.showDriverPopup = (d) => {
  state.selectedDriver = d;
  document.getElementById('pp-icon').textContent = vehicleIcon(d.vehicleType);
  document.getElementById('pp-name').textContent = d.driverName;
  document.getElementById('pp-sub').textContent  = d.vehicleType.toUpperCase() + ' • ' + d.vehicleNumber;
  document.getElementById('pp-dist').textContent = (d.distanceKm || '?') + ' km';
  document.getElementById('pp-eta').textContent  = (d.etaMinutes || '?') + ' min';
  document.getElementById('pp-spd').textContent  = (d.speed || 0).toFixed(0) + ' km/h';
  document.getElementById('driver-popup').style.display = 'block';
  updateMapMarkers();
};

window.closePopup = () => {
  state.selectedDriver = null;
  document.getElementById('driver-popup').style.display = 'none';
  updateMapMarkers();
};

// ── Filter bars ───────────────────────────────────────────────────
const renderFilterBars = () => {
  const filters = [['all','🔍 All'],['auto','🛺 Auto'],['bus','🚌 Bus'],['taxi','🚕 Taxi']];
  const html = filters.map(([v,l]) =>
    `<button class="filter-chip ${state.filter===v?'active':''}" onclick="setFilter('${v}')">${l}</button>`
  ).join('');
  ['map-filter-bar','list-filter-bar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
};

window.setFilter = (f) => {
  state.filter = f;
  renderFilterBars();
  refreshDrivers();
  if (document.getElementById('nearby-list').classList.contains('active')) renderDriverList();
};

// ── Driver list ───────────────────────────────────────────────────
window.renderDriverList = () => {
  renderFilterBars();
  const filtered = state.filter === 'all'
    ? state.drivers
    : state.drivers.filter(d => d.vehicleType === state.filter);

  const body = document.getElementById('driver-list-body');
  if (!body) return;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="e-icon">😔</div><p>No drivers nearby</p></div>`;
    return;
  }

  body.innerHTML = filtered.map(d => `
    <div class="driver-item">
      <div class="d-icon">${vehicleIcon(d.vehicleType)}</div>
      <div class="d-info">
        <div class="d-name">${d.driverName}</div>
        <div class="d-sub">${d.vehicleType.toUpperCase()} • ${d.vehicleNumber}</div>
        <div class="d-tags">
          <span class="tag dist">📍 ${d.distanceKm ?? '?'} km</span>
          <span class="tag eta">⏱ ${d.etaMinutes ?? '?'} min</span>
          <span class="tag spd">⚡ ${(d.speed||0).toFixed(0)} km/h</span>
        </div>
      </div>
      <div class="avail-dot" style="background:${d.isAvailable?'#4caf50':'#9e9e9e'}"></div>
    </div>
  `).join('');
};

// ── Boot ──────────────────────────────────────────────────────────
render();
show('splash');

setTimeout(() => {
  const saved = load();
  if (saved) {
    state.user = saved;
    connectSocket();
    if (saved.role === 'driver') openDriverDash();
    else openPassengerMap();
  } else {
    show('role-select');
  }
}, 2000);
