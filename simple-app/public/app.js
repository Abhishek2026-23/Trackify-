const API = 'http://localhost:5000';
let currentUser=null, map=null, socket=null;
let isOnline=false, demoMode=false, locationInterval=null, demoInterval=null;
let myPosition=null, myMarker=null, radiusCircle=null;
let selectedRole='passenger';
let driverMarkers={}, passengerMarkers={};
let nearbyDriversCache=[];

const haversine=(lat1,lon1,lat2,lon2)=>{
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

// ── Auth UI ───────────────────────────────────────────────────────
function switchTab(t){
  document.getElementById('login-form').style.display=t==='login'?'block':'none';
  document.getElementById('register-form').style.display=t==='register'?'block':'none';
  document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('active',(i===0)===(t==='login')));
  showMsg('');
}
function selectRole(r){
  selectedRole=r;
  document.getElementById('opt-passenger').classList.toggle('active',r==='passenger');
  document.getElementById('opt-driver').classList.toggle('active',r==='driver');
  document.getElementById('driver-extra').style.display=r==='driver'?'block':'none';
}
function showMsg(msg,type='error'){
  const el=document.getElementById('auth-msg');
  el.className='msg '+(msg?type:''); el.textContent=msg;
}
function fillDemo(){
  document.getElementById('l-phone').value='9999999999';
  document.getElementById('l-pass').value='admin123';
}

// ── Password show/hide ────────────────────────────────────────────
function togglePw(id, btn){
  const inp=document.getElementById(id);
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.textContent=show?'🙈':'👁';
}

// ── Auto-fill last login ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{
  const saved=localStorage.getItem('lastLogin');
  if(saved){
    try{
      const {phone}=JSON.parse(saved);
      if(phone) document.getElementById('l-phone').value=phone;
    }catch(e){}
  }
});

// ── Auth ──────────────────────────────────────────────────────────
async function doLogin(){
  const phone=document.getElementById('l-phone').value.trim();
  const password=document.getElementById('l-pass').value;
  if(!phone||!password) return showMsg('Please fill all fields');
  const btn=document.getElementById('login-btn');
  btn.disabled=true; btn.textContent='Signing in...';
  try{
    const res=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})});
    const data=await res.json();
    if(!res.ok) return showMsg(data.error||'Login failed');
    localStorage.setItem('lastLogin', JSON.stringify({phone}));
    startApp(data.user);
  }catch(e){showMsg('Cannot connect to server. Make sure it is running on port 5000.');}
  finally{btn.disabled=false;btn.textContent='Sign In';}
}
async function doRegister(){
  const name=document.getElementById('r-name').value.trim();
  const phone=document.getElementById('r-phone').value.trim();
  const password=document.getElementById('r-pass').value;
  if(!name||!phone||!password) return showMsg('Please fill all fields');
  const body={name,phone,password,role:selectedRole};
  if(selectedRole==='driver'){
    body.vehicleType=document.getElementById('r-vtype').value;
    body.vehicleNumber=document.getElementById('r-vnum').value.trim();
    if(!body.vehicleNumber) return showMsg('Enter vehicle number');
  }
  const btn=document.getElementById('reg-btn');
  btn.disabled=true; btn.textContent='Creating...';
  try{
    const res=await fetch(`${API}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json();
    if(!res.ok) return showMsg(data.error||'Registration failed');
    const extra=selectedRole==='driver'?` Driver ID: ${data.user.driverId}`:'';
    showMsg('Account created!'+extra,'success');
    setTimeout(()=>switchTab('login'),2500);
  }catch(e){showMsg('Cannot connect to server.');}
  finally{btn.disabled=false;btn.textContent='Create Account';}
}
function logout(){
  document.getElementById('logout-modal').style.display='flex';
}

function confirmLogout(yes){
  document.getElementById('logout-modal').style.display='none';
  if(!yes) return;
  if(currentUser && currentUser.role==='driver' && currentUser.driverId){
    fetch(`${API}/location/offline`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({driverId:currentUser.driverId})}).catch(()=>{});
  }
  if(currentUser && currentUser.role==='passenger' && currentUser.id){
    fetch(`${API}/location/passenger/offline`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:currentUser.id})}).catch(()=>{});
  }
  stopDemo(); goOffline();
  if(socket) socket.disconnect();
  currentUser=null; map=null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('l-pass').value='';
  showMsg('');
}

// ── App start ─────────────────────────────────────────────────────
function startApp(user){
  currentUser=user;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='flex';
  const isDriver=user.role==='driver';
  document.getElementById('portal-label').textContent=isDriver?'— Driver Portal':'— Passenger Portal';
  document.getElementById('top-user').textContent=user.name+(isDriver?' · '+user.driverId:'');
  document.getElementById('top-dot').className='dot offline';
  document.getElementById('sidebar-title').textContent=isDriver?'Driver Dashboard':'Nearby Buses';
  document.getElementById('sidebar-sub').textContent=isDriver?'Your status & live passengers':'Buses within 1 km of you';
  document.getElementById('driver-panel').style.display=isDriver?'block':'none';
  document.getElementById('passenger-panel').style.display=isDriver?'none':'block';
  document.getElementById('radius-banner').style.display=isDriver?'none':'block';
  // Update demo mode subtitle based on role
  document.querySelector('.demo-toggle small').textContent=isDriver?'Simulate passengers waiting nearby':'Simulate buses moving around you';
  initMap(); initSocket();
}

// ── Map ───────────────────────────────────────────────────────────
function initMap(){
  if(map){map.remove();map=null;}
  driverMarkers={}; passengerMarkers={}; myMarker=null; radiusCircle=null;
  map=L.map('map',{zoomControl:true}).setView([DEFAULT_LAT, DEFAULT_LNG],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
}

const ICONS={
  bus: L.divIcon({html:'<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">🚌</div>',className:'',iconSize:[32,32],iconAnchor:[16,16]}),
  passenger: L.divIcon({html:'<div style="font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🧍</div>',className:'',iconSize:[28,28],iconAnchor:[14,14]}),
};

function makeHereIcon(label){
  return L.divIcon({
    html:`<div style="text-align:center"><div style="font-size:26px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))">📍</div><div style="background:#1a73e8;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-top:2px;white-space:nowrap">${label}</div></div>`,
    className:'',iconSize:[70,44],iconAnchor:[35,44]
  });
}
function makeBusDriverIcon(vehicleNumber){
  return L.divIcon({
    html:`<div style="text-align:center"><div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚌</div><div style="background:#1a73e8;color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px;white-space:nowrap">${vehicleNumber||'BUS'}</div></div>`,
    className:'',iconSize:[60,48],iconAnchor:[30,48]
  });
}

// ── Socket ────────────────────────────────────────────────────────
function initSocket(){
  socket=io(API,{transports:['websocket','polling']});
  const isDriver=currentUser.role==='driver';
  // Passengers see buses only
  socket.on('driver_location_update',(data)=>{
    if(isDriver||!isOnline||!myPosition||demoMode) return;
    const dist=haversine(myPosition.lat,myPosition.lng,data.latitude,data.longitude);
    if(dist<=1.0&&data.isAvailable) placeDriverMarker(data,dist);
    else removeMarker(driverMarkers,data.driverId);
    refreshPassengerSidebar();
  });
  // Drivers see passengers only
  socket.on('passenger_location_update',(data)=>{
    if(!isDriver||!isOnline) return;
    if(data.userId!==currentUser.id) placePassengerMarker(data);
    document.getElementById('stat-passengers').textContent=Object.keys(passengerMarkers).length;
  });
  // Remove passenger marker when they go offline
  socket.on('passenger_offline',(data)=>{
    if(!isDriver) return;
    removeMarker(passengerMarkers, data.userId);
    document.getElementById('stat-passengers').textContent=Object.keys(passengerMarkers).length;
  });
}

// ── Online toggle ─────────────────────────────────────────────────
function toggleOnline(){isOnline?goOffline():goOnline();}

function goOnline(){
  isOnline=true; setOnlineUI(true);
  const isDriver=currentUser.role==='driver';
  // Use map center immediately — no GPS wait
  const c=map.getCenter();
  myPosition={lat:c.lat,lng:c.lng};

  if(isDriver){
    if(myMarker) myMarker.setLatLng([myPosition.lat,myPosition.lng]);
    else myMarker=L.marker([myPosition.lat,myPosition.lng],{icon:makeBusDriverIcon(currentUser.vehicleNumber||currentUser.driverId),zIndexOffset:1000})
      .addTo(map).bindPopup(`<div class="popup-inner"><h4>🚌 ${currentUser.name}</h4><div class="row"><span>Vehicle</span>${currentUser.vehicleNumber||'—'}</div><div class="row"><span>ID</span>${currentUser.driverId}</div><div class="row"><span>Status</span>Online</div></div>`).openPopup();
    if(radiusCircle) radiusCircle.setLatLng([myPosition.lat,myPosition.lng]);
    else radiusCircle=L.circle([myPosition.lat,myPosition.lng],{radius:1000,color:'#0f9d58',weight:2,fillColor:'#0f9d58',fillOpacity:0.06,dashArray:'6,4'}).addTo(map);
    document.getElementById('driver-stats').style.display='grid';
    showEmptyState('No passengers nearby right now');
    fetchLivePassengers();
    if(!locationInterval) locationInterval=setInterval(()=>{
      sendMyLocation(); fetchLivePassengers();
    },5000);
  }else{
    if(myMarker) myMarker.setLatLng([myPosition.lat,myPosition.lng]);
    else myMarker=L.marker([myPosition.lat,myPosition.lng],{icon:makeHereIcon('You are here'),zIndexOffset:1000})
      .addTo(map).bindPopup(`<div class="popup-inner"><h4>📍 ${currentUser.name}</h4><div class="row"><span>Status</span>Online — Sharing Location</div></div>`).openPopup();
    if(radiusCircle) radiusCircle.setLatLng([myPosition.lat,myPosition.lng]);
    else radiusCircle=L.circle([myPosition.lat,myPosition.lng],{radius:1000,color:'#1a73e8',weight:2,fillColor:'#1a73e8',fillOpacity:0.06,dashArray:'6,4'}).addTo(map);
    map.setView([myPosition.lat,myPosition.lng],15);
    fetchNearbyDrivers();
  }
  sendMyLocation();
  // Try to refine with real GPS in background (non-blocking)
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      let lat=pos.coords.latitude, lng=pos.coords.longitude;
      if(lat>29&&lat<32&&lng>75&&lng<78){lat=DEFAULT_LAT;lng=DEFAULT_LNG;}
      myPosition={lat,lng};
      if(myMarker) myMarker.setLatLng([lat,lng]);
      if(radiusCircle) radiusCircle.setLatLng([lat,lng]);
      map.flyTo([lat,lng],15,{duration:1});
      sendMyLocation();
    },()=>{},{timeout:4000,maximumAge:30000});
  }
  if(!isDriver) startLocationSharing();
}

function goOffline(){
  if(currentUser && currentUser.role==='driver' && currentUser.driverId){
    fetch(`${API}/location/offline`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({driverId:currentUser.driverId})}).catch(()=>{});
  }
  if(currentUser && currentUser.role==='passenger' && currentUser.id){
    fetch(`${API}/location/passenger/offline`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:currentUser.id})}).catch(()=>{});
  }
  isOnline=false; setOnlineUI(false);
  if(locationInterval){clearInterval(locationInterval);locationInterval=null;}
  if(map){
    if(myMarker){map.removeLayer(myMarker);myMarker=null;}
    if(radiusCircle){map.removeLayer(radiusCircle);radiusCircle=null;}
    Object.keys(driverMarkers).forEach(id=>removeMarker(driverMarkers,id));
    Object.keys(passengerMarkers).forEach(id=>removeMarker(passengerMarkers,id));
  }
  document.getElementById('driver-stats').style.display='none';
  const isDriver=currentUser&&currentUser.role==='driver';
  showEmptyState(isDriver?'Go online or enable Demo Mode to see passengers':'Go online or enable Demo Mode to see live buses');
}

function setOnlineUI(online){
  const isDriver=currentUser&&currentUser.role==='driver';
  // Driver badge
  const badge=document.getElementById('status-badge');
  if(badge){ badge.className='status-badge '+(online?'online':'offline'); }
  const st=document.getElementById('status-text');
  if(st) st.textContent=online?'Online — Broadcasting':'Offline';
  const btn=document.getElementById('toggle-btn');
  if(btn){ btn.className='btn-toggle '+(online?'go-offline':'go-online'); btn.textContent=online?'🔴 Go Offline':'🟢 Go Online'; }
  // Passenger badge
  const pbadge=document.getElementById('pass-status-badge');
  if(pbadge){ pbadge.className='status-badge '+(online?'online':'offline'); }
  const pst=document.getElementById('pass-status-text');
  if(pst) pst.textContent=online?'Online — Sharing Location':'Offline';
  const pbtn=document.getElementById('pass-toggle-btn');
  if(pbtn){ pbtn.className='btn-toggle '+(online?'go-offline':'go-online'); pbtn.textContent=online?'🔴 Stop Sharing Location':'🟢 Go Online — Share My Location'; }
  // Top dot
  document.getElementById('top-dot').className='dot'+(online?'':' offline');
}

// ── Location sharing ──────────────────────────────────────────────
function startLocationSharing(){
  sendMyLocation();
  if(currentUser.role==='passenger' && !locationInterval){
    locationInterval=setInterval(()=>{
      sendMyLocation();
      fetchNearbyDrivers();
    },5000);
  }
}
async function sendMyLocation(){
  if(!myPosition) return;
  const isDriver=currentUser.role==='driver';
  const url=isDriver?`${API}/location/update`:`${API}/location/passenger`;
  const body=isDriver
    ?{driverId:currentUser.driverId,latitude:myPosition.lat,longitude:myPosition.lng,speed:0,isAvailable:true}
    :{userId:currentUser.id,latitude:myPosition.lat,longitude:myPosition.lng};
  await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});
}

// ── Fetch ─────────────────────────────────────────────────────────
async function fetchNearbyDrivers(){
  if(!myPosition||demoMode) return;
  try{
    const res=await fetch(`${API}/drivers/nearby?lat=${myPosition.lat}&lng=${myPosition.lng}&radius=1`);
    const data=await res.json();
    nearbyDriversCache=data.drivers||[];
    const ids=new Set(nearbyDriversCache.map(d=>d.driverId));
    Object.keys(driverMarkers).forEach(id=>{if(!ids.has(id)) removeMarker(driverMarkers,id);});
    nearbyDriversCache.forEach(d=>placeDriverMarker(d,d.distanceKm));
    refreshPassengerSidebar();
  }catch(e){}
}
async function fetchLivePassengers(){
  try{
    const res=await fetch(`${API}/passengers/live`);
    const data=await res.json();
    const passengers=data.passengers||[];
    passengers.forEach(p=>{if(p.userId!==currentUser.id) placePassengerMarker(p);});
    // Update passenger count stat
    document.getElementById('stat-passengers').textContent=Object.keys(passengerMarkers).length;
    // Update driver sidebar
    if(passengers.length===0){
      showEmptyState('No passengers nearby right now');
    } else {
      const list=document.getElementById('sidebar-list');
      list.innerHTML=passengers.filter(p=>p.userId!==currentUser.id).map(p=>`
        <div class="driver-card" onclick="focusPassenger('${p.userId}')">
          <div class="dc-top">
            <div class="avatar bus">🧍</div>
            <div><div class="dc-name">Passenger</div><div class="dc-id">Live — Waiting</div></div>
            <span class="vtype-badge bus">LIVE</span>
          </div>
        </div>`).join('');
    }
  }catch(e){}
}

// ── Markers ───────────────────────────────────────────────────────
function placeDriverMarker(data,dist){
  const speed=data.speed||0;
  const eta=dist>0&&speed>0?(dist/speed*60).toFixed(0):'?';
  const popup=`<div class="popup-inner"><h4>🚌 ${data.driverName}</h4><div class="row"><span>Vehicle</span>${data.vehicleNumber}</div><div class="row"><span>Speed</span>${speed.toFixed(0)} km/h</div><div class="row"><span>Distance</span>${typeof dist==='number'?dist.toFixed(2):dist} km</div><div class="eta-tag">🕐 Arriving in ~${eta} min</div></div>`;
  if(driverMarkers[data.driverId]){
    animateMarker(driverMarkers[data.driverId],[data.latitude,data.longitude]);
    driverMarkers[data.driverId].setPopupContent(popup);
  }else{
    driverMarkers[data.driverId]=L.marker([data.latitude,data.longitude],{icon:ICONS.bus}).addTo(map).bindPopup(popup);
  }
}
function placePassengerMarker(data){
  if(data.userId===currentUser.id) return;
  const popup=`<div class="popup-inner"><h4>🧍 Passenger</h4><div class="row"><span>Status</span>Live</div></div>`;
  if(passengerMarkers[data.userId]){
    animateMarker(passengerMarkers[data.userId],[data.latitude,data.longitude]);
  }else{
    passengerMarkers[data.userId]=L.marker([data.latitude,data.longitude],{icon:ICONS.passenger}).addTo(map).bindPopup(popup);
  }
}
function removeMarker(store,id){if(store[id]){map.removeLayer(store[id]);delete store[id];}}
function animateMarker(marker,[lat,lng]){
  const start=marker.getLatLng(),steps=20;let i=0;
  const iv=setInterval(()=>{i++;marker.setLatLng([start.lat+(lat-start.lat)*(i/steps),start.lng+(lng-start.lng)*(i/steps)]);if(i>=steps)clearInterval(iv);},50);
}

// ── Sidebar ───────────────────────────────────────────────────────
function refreshPassengerSidebar(){
  const list=document.getElementById('sidebar-list');
  if(!nearbyDriversCache.length){showEmptyState('No buses within 1 km right now');return;}
  list.innerHTML=nearbyDriversCache.map((d,i)=>{
    const speed=d.speed||0;
    const eta=d.distanceKm>0&&speed>0?(d.distanceKm/speed*60).toFixed(0):'?';
    return `<div class="driver-card ${i===0?'nearest':''}" onclick="focusDriver('${d.driverId}')">
      ${i===0?'<div class="nearest-tag">⭐ Nearest Bus</div>':''}
      <div class="dc-top">
        <div class="avatar bus">🚌</div>
        <div><div class="dc-name">${d.driverName}</div><div class="dc-id">${d.vehicleNumber}</div></div>
        <span class="vtype-badge bus">BUS</span>
      </div>
      <div class="dc-stats">
        <div class="dc-stat"><div class="v">${d.distanceKm} km</div><div class="l">Distance</div></div>
        <div class="dc-stat"><div class="v">${speed.toFixed(0)}</div><div class="l">km/h</div></div>
        <div class="dc-stat"><div class="v">~${eta} min</div><div class="l">ETA</div></div>
      </div>
    </div>`;
  }).join('');
}
function showEmptyState(msg){
  const isDriver=currentUser&&currentUser.role==='driver';
  const defaultMsg=isDriver?'No passengers nearby right now':'Go online or share location to see live buses';
  document.getElementById('sidebar-list').innerHTML=`<div class="empty-state"><div class="icon">📡</div><p>${msg||defaultMsg}</p></div>`;
}
function showToast(msg, type='info', duration=3500){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast '+(type==='warning'?'warning':type==='success'?'success':'');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), duration);
}

function focusDriver(id){const m=driverMarkers[id];if(m){map.flyTo(m.getLatLng(),16,{duration:1});m.openPopup();}}
const DEMO_BUSES=[
  {driverId:'DEMO-001',driverName:'Ramesh Verma',vehicleType:'bus',vehicleNumber:'UP-78-1234',dlat:0.0003,dlng:0.0002},
  {driverId:'DEMO-002',driverName:'Suresh Yadav',vehicleType:'bus',vehicleNumber:'UP-78-5678',dlat:-0.0002,dlng:0.0003},
  {driverId:'DEMO-003',driverName:'Dinesh Kumar',vehicleType:'bus',vehicleNumber:'UP-78-9012',dlat:0.0001,dlng:-0.0003},
  {driverId:'DEMO-004',driverName:'Rajesh Gupta',vehicleType:'bus',vehicleNumber:'UP-78-3456',dlat:-0.0003,dlng:-0.0001},
  {driverId:'DEMO-005',driverName:'Mahesh Singh',vehicleType:'bus',vehicleNumber:'UP-78-7890',dlat:0.0002,dlng:0.0002},
];
const DEMO_PASSENGERS=[
  {userId:'PASS-001',name:'Rahul Verma'},
  {userId:'PASS-002',name:'Sneha Gupta'},
  {userId:'PASS-003',name:'Arjun Singh'},
];

function getBaseLocation(){
  return myPosition || { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

// Default location: Maharana Pratap Group of Institutions, Kothi Mandhna, Kanpur
const DEFAULT_LAT = 26.5824;
const DEFAULT_LNG = 80.1856;

function toggleDemo(on){
  demoMode=on;
  if(!on){stopDemo();return;}
  // Always use current map center so demo spawns where user is looking
  const c=map.getCenter();
  myPosition={lat:c.lat,lng:c.lng};
  startDemo();
}

function startDemo(){
  if(!map) return;
  // Always use current map center as base so buses appear where user is looking
  const center = map.getCenter();
  const base = { lat: center.lat, lng: center.lng };
  // Sync myPosition to map center for demo
  if(!myPosition) myPosition = base;
  const isDriver=currentUser&&currentUser.role==='driver';

  map.flyTo([base.lat,base.lng],15,{duration:1.5});

  if(!isDriver){
    // Show passenger's own "You are here" marker
    if(!myMarker){
      myMarker=L.marker([base.lat,base.lng],{icon:makeHereIcon('You are here'),zIndexOffset:1000})
        .addTo(map).bindPopup(`<div class="popup-inner"><h4>📍 ${currentUser.name}</h4><div class="row"><span>Role</span>Passenger</div></div>`).openPopup();
    } else {
      myMarker.setLatLng([base.lat,base.lng]);
    }
    if(!radiusCircle){
      radiusCircle=L.circle([base.lat,base.lng],{radius:1000,color:'#1a73e8',weight:2,fillColor:'#1a73e8',fillOpacity:0.06,dashArray:'6,4'}).addTo(map);
    } else {
      radiusCircle.setLatLng([base.lat,base.lng]);
    }
    // Scatter buses around passenger
    DEMO_BUSES.forEach((d,i)=>{
      const angle=(i/DEMO_BUSES.length)*2*Math.PI;
      const r=0.003+Math.random()*0.004;
      d.lat=base.lat+r*Math.cos(angle);
      d.lng=base.lng+r*Math.sin(angle);
      d.speed=20+Math.random()*20;
      placeDriverMarker({...d,latitude:d.lat,longitude:d.lng,isAvailable:true},haversine(base.lat,base.lng,d.lat,d.lng));
    });
    _refreshDemoSidebar(base);
  }else{
    // Driver demo: show bus marker + green 1km circle
    if(!myMarker){
      myMarker=L.marker([base.lat,base.lng],{icon:makeBusDriverIcon(currentUser.vehicleNumber||currentUser.driverId),zIndexOffset:1000})
        .addTo(map).bindPopup(`<div class="popup-inner"><h4>🚌 ${currentUser.name}</h4><div class="row"><span>Status</span>Demo Mode</div></div>`).openPopup();
    }
    if(!radiusCircle){
      radiusCircle=L.circle([base.lat,base.lng],{radius:1000,color:'#0f9d58',weight:2,fillColor:'#0f9d58',fillOpacity:0.06,dashArray:'6,4'}).addTo(map);
    }
    // Driver demo: show simulated passengers
    DEMO_PASSENGERS.forEach((p,i)=>{
      const angle=(i/DEMO_PASSENGERS.length)*2*Math.PI;
      const r=0.002+Math.random()*0.003;
      p.lat=base.lat+r*Math.cos(angle);
      p.lng=base.lng+r*Math.sin(angle);
      placePassengerMarker({userId:p.userId,latitude:p.lat,longitude:p.lng});
    });
    document.getElementById('stat-passengers').textContent=DEMO_PASSENGERS.length;
    _refreshDriverDemoSidebar();
  }

  demoInterval=setInterval(()=>{
    const b=getBaseLocation();
    if(isDriver){
      DEMO_PASSENGERS.forEach(p=>{
        p.lat+=(Math.random()-0.5)*0.0004; p.lng+=(Math.random()-0.5)*0.0004;
        placePassengerMarker({userId:p.userId,latitude:p.lat,longitude:p.lng});
      });
      _refreshDriverDemoSidebar();
    }else{
      DEMO_BUSES.forEach(d=>{
        d.lat+=(Math.random()-0.5)*0.0006+d.dlat*0.2;
        d.lng+=(Math.random()-0.5)*0.0006+d.dlng*0.2;
        d.speed=Math.max(5,Math.min(60,d.speed+(Math.random()-0.5)*4));
        placeDriverMarker({...d,latitude:d.lat,longitude:d.lng,isAvailable:true},haversine(b.lat,b.lng,d.lat,d.lng));
      });
      _refreshDemoSidebar(b);
    }
  },3000);
}

function _refreshDemoSidebar(base){
  nearbyDriversCache=DEMO_BUSES.map(d=>({
    ...d,latitude:d.lat,longitude:d.lng,isAvailable:true,
    distanceKm:parseFloat(haversine(base.lat,base.lng,d.lat,d.lng).toFixed(2)),
    etaMinutes:parseFloat((d.speed>0?haversine(base.lat,base.lng,d.lat,d.lng)/d.speed*60:3).toFixed(1))
  })).sort((a,b)=>a.distanceKm-b.distanceKm);
  refreshPassengerSidebar();
}

function _refreshDriverDemoSidebar(){
  const list=document.getElementById('sidebar-list');
  list.innerHTML=DEMO_PASSENGERS.map(p=>`
    <div class="driver-card" onclick="focusPassenger('${p.userId}')">
      <div class="dc-top">
        <div class="avatar bus">🧍</div>
        <div><div class="dc-name">${p.name}</div><div class="dc-id">Waiting for bus</div></div>
        <span class="vtype-badge bus">LIVE</span>
      </div>
    </div>`).join('');
}

function focusPassenger(id){const m=passengerMarkers[id];if(m){map.flyTo(m.getLatLng(),16,{duration:1});m.openPopup();}}

function stopDemo(){
  if(demoInterval){clearInterval(demoInterval);demoInterval=null;}
  DEMO_BUSES.forEach(d=>removeMarker(driverMarkers,d.driverId));
  DEMO_PASSENGERS.forEach(p=>removeMarker(passengerMarkers,p.userId));
  nearbyDriversCache=[];

  const isDriver=currentUser&&currentUser.role==='driver';

  if(isDriver){
    // Driver: show "no passengers" notification
    showToast('⚠️ No passengers waiting in your area','warning',4000);
    showEmptyState('No passengers nearby right now');
    if(!isOnline){
      document.getElementById('stat-passengers').textContent='0';
    }
  } else {
    // Passenger: keep "You are here" marker + radius circle, show no buses toast
    if(!isOnline){
      showEmptyState('No buses within 1 km of your location');
      showToast('⚠️ No buses present within 1 km of your location','warning',4000);
    } else {
      showToast('⚠️ No buses present within 1 km of your location','warning',4000);
      showEmptyState('No buses within 1 km right now');
    }
  }
}

// ── Remove location on tab/browser close ─────────────────────────
window.addEventListener('beforeunload', () => {
  if(!currentUser || !isOnline) return;
  if(currentUser.role==='driver' && currentUser.driverId){
    navigator.sendBeacon(`${API}/location/offline`, JSON.stringify({driverId:currentUser.driverId}));
  }
  if(currentUser.role==='passenger' && currentUser.id){
    navigator.sendBeacon(`${API}/location/passenger/offline`, JSON.stringify({userId:currentUser.id}));
  }
});
