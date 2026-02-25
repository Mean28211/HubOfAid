// HubOfAid - app.js
(function(){
  // --- Helpers ---
  function qs(sel, ctx=document){ return ctx.querySelector(sel); }
  function qsa(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }
  function showView(id){ qsa('.view').forEach(v=> v.classList.add('hidden')); const el = qs('#'+id); if(el) el.classList.remove('hidden'); }

  // --- Navigation ---
  function initNav(){
    qsa('.nav-link').forEach(a=>{
      a.addEventListener('click', e=>{
        e.preventDefault();
        const href = a.getAttribute('href').replace('#','');
        history.pushState({},'', '#'+href);
        showView(href);
      });
    });
    const hash = location.hash.replace('#','') || 'map';
    showView(hash);
    window.addEventListener('popstate', ()=>{ showView(location.hash.replace('#','')||'map'); });
  }

  // --- Map (Leaflet + MarkerCluster) ---
  let map, markerClusterGroup = null, features = [];

  function loadLeaflet(cb){
    if(window.L && window.L.MarkerCluster) return cb();
    // Leaflet CSS + JS
    const css = document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const lc = document.createElement('link'); lc.rel='stylesheet'; lc.href='https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'; document.head.appendChild(lc);
    const lc2 = document.createElement('link'); lc2.rel='stylesheet'; lc2.href='https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'; document.head.appendChild(lc2);
    const s = document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = ()=>{
      const s2 = document.createElement('script'); s2.src='https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'; s2.onload = cb; document.body.appendChild(s2);
    }; document.body.appendChild(s);
  }

  function initMap(){
    loadLeaflet(()=>{
      map = L.map('map-container', {attributionControl:true}).setView([52.52,13.4], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
      markerClusterGroup = L.markerClusterGroup(); map.addLayer(markerClusterGroup);
      // Try to center on user; then fetch OSM features for bounds
      tryCenterToUser().then(()=>{
        fetchOverpassForCurrentBounds();
      }).catch(()=>{
        fetchOverpassForCurrentBounds();
      });
      // reload on idle/moveend with debounce
      map.on('moveend', debounce(()=> fetchOverpassForCurrentBounds(), 800));
      addLocateControl();
    });
  }

  // Center map on user if permission granted; resolves after attempt
  function tryCenterToUser(){
    return new Promise((resolve, reject)=>{
      if(!navigator.geolocation){ reject(new Error('Geolocation not supported')); return; }
      const onSuccess = (pos)=>{
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        try{ map.setView([lat, lon], 15); const m = L.marker([lat, lon]).addTo(map).bindPopup('Ihr Standort').openPopup(); setTimeout(()=>{ map.removeLayer(m); }, 5000); }catch(e){}
        resolve();
      };
      const onErr = (err)=>{ console.warn('Geolocation failed', err); reject(err); };
      // small timeout in case user doesn't respond
      navigator.geolocation.getCurrentPosition(onSuccess, onErr, {enableHighAccuracy:true, timeout:8000, maximumAge:0});
    });
  }

  // --- Overpass integration ---
  function bboxForBounds(bounds){
    const sw = bounds.getSouthWest(); const ne = bounds.getNorthEast();
    return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`; // s,w,n,e
  }

  async function fetchOverpass(bbox){
    const query = `[
out:json][timeout:25];
(
  node["emergency"="defibrillator"](${bbox});
  node["emergency"="first_aid"](${bbox});
  node["amenity"="defibrillator"](${bbox});
  way["emergency"="defibrillator"](${bbox});
  relation["emergency"="defibrillator"](${bbox});
);
out center;`;
    try{
      const resp = await fetch('https://overpass-api.de/api/interpreter', {method:'POST', body: query});
      if(!resp.ok) throw new Error('Overpass error '+resp.status);
      const data = await resp.json();
      return data.elements || [];
    }catch(e){ console.warn('Overpass fetch failed', e); return []; }
  }

  function classifyElement(el){
    const tags = el.tags || {};
    if(tags.emergency === 'defibrillator' || tags.amenity === 'defibrillator') return 'aed';
    if(tags.emergency === 'first_aid' || tags.healthcare === 'first_aid') return 'verbandkasten';
    // fallback: try name
    return 'other';
  }

  function elementLatLng(el){
    if(el.type === 'node') return [el.lat, el.lon];
    if(el.center) return [el.center.lat, el.center.lon];
    return null;
  }

  async function fetchOverpassForCurrentBounds(){
    if(!map) return;
    const b = map.getBounds(); const bbox = bboxForBounds(b);
    // show loading state
    // fetch
    const elements = await fetchOverpass(bbox);
    features = elements.map(el=>{
      const ll = elementLatLng(el); if(!ll) return null;
      return { id: el.id, lat: ll[0], lng: ll[1], tags: el.tags || {}, type: classifyElement(el) };
    }).filter(Boolean);
    renderMarkers();
  }

  function renderMarkers(){
    if(!markerClusterGroup) return;
    markerClusterGroup.clearLayers();
    const active = qsa('.btn-filter.active').map(b=> b.dataset.filter);
    features.forEach(f=>{
      if(active.length && !active.includes(f.type)) return;
      const m = L.marker([f.lat, f.lng]);
      const title = f.tags.name || (f.type==='aed' ? 'AED' : (f.type==='verbandkasten'?'Verbandkasten':'Objekt'));
      m.bindPopup(`<strong>${title}</strong><div>Typ: ${f.type}</div>`);
      m.__hubType = f.type;
      markerClusterGroup.addLayer(m);
    });
  }

  // --- Filters ---
  function applyFilters(){ renderMarkers(); }
  function initFilters(){
    qsa('.btn-filter').forEach(b=>{
      b.addEventListener('click', ()=>{ b.classList.toggle('active'); applyFilters(); });
    });
  }

  // --- Locate control ---
  function addLocateControl(){
    if(!map) return;
    const LocateControl = L.Control.extend({
      onAdd: function(map){
        const btn = L.DomUtil.create('button','btn-primary'); btn.title='Standort zentrieren'; btn.innerHTML='📍';
        L.DomEvent.on(btn,'click', function(e){ L.DomEvent.stopPropagation(e); L.DomEvent.preventDefault(e); map.locate({setView:true, maxZoom:16}); });
        return btn;
      }, onRemove: function(map){}
    });
    map.addControl(new LocateControl({position:'topleft'}));
    map.on('locationfound', function(e){
      const circle = L.circle(e.latlng, {radius: e.accuracy/2, color:'#06b6d4', fill:false});
      const marker = L.marker(e.latlng).bindPopup('Ihr Standort').addTo(map);
      setTimeout(()=>{ map.removeLayer(marker); map.removeLayer(circle); }, 6000);
    });
  }

  // --- Utils ---
  function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,arguments), wait); }; }

  // --- Scanner (unchanged) ---
  let scannerStream = null, scannerInterval = null;
  function stopScanner(){ if(scannerInterval) { clearInterval(scannerInterval); scannerInterval=null; } if(scannerStream){ scannerStream.getTracks().forEach(t=>t.stop()); scannerStream=null; qs('#scanner-video').classList.add('hidden'); }}

  async function startScanner(){
    const container = qs('#scanner-video'); const resultEl = qs('#scan-result'); const scanText = qs('#scan-text');
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      scannerStream = stream;
      container.classList.remove('hidden'); container.innerHTML = '';
      const video = document.createElement('video'); video.autoplay = true; video.playsInline = true; video.srcObject = stream; container.appendChild(video);
      await video.play();
      if(window.BarcodeDetector && BarcodeDetector.getSupportedFormats){
        const formats = await BarcodeDetector.getSupportedFormats().catch(()=>[]);
        const detector = new BarcodeDetector({formats: formats.includes('qr_code')?['qr_code']:formats});
        const canvas = document.createElement('canvas');
        scannerInterval = setInterval(async ()=>{
          try{
            canvas.width = video.videoWidth; canvas.height = video.videoHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(video,0,0);
            const results = await detector.detect(canvas);
            if(results && results.length){ stopScanner(); scanText.textContent = results[0].rawValue || JSON.stringify(results[0]); resultEl.classList.remove('hidden'); }
          }catch(e){ }
        },300);
      } else {
        scanText.textContent = 'BarcodeDetector nicht verfügbar. Zeige Kamera. Scanne mit externem Tool oder Browser mit BarcodeDetector.';
        resultEl.classList.remove('hidden');
      }
    }catch(e){ alert('Kamera nicht verfügbar: '+ (e.message||e)); }
  }

  function initScannerHandlers(){
    qs('#start-scanner').addEventListener('click', ()=>{ const isRunning = !!scannerStream; if(isRunning) stopScanner(); else startScanner(); });
    window.addEventListener('hashchange', ()=> stopScanner());
  }

  // --- Inventory (unchanged) ---
  const INVENTORY_KEY = 'hubofaid_inventory_v1';
  const defaultInventory = [ {id:'itm-aed', name:'AED Elektroden', qty:4, min:2}, {id:'itm-vk', name:'Verbandkasten Standard', qty:2, min:1}, ];
  function loadInventory(){ try{ const raw = localStorage.getItem(INVENTORY_KEY); return raw? JSON.parse(raw): defaultInventory.slice(); }catch(e){ return defaultInventory.slice(); } }
  function saveInventory(data){ localStorage.setItem(INVENTORY_KEY, JSON.stringify(data)); }
  function renderInventory(){ const list = qs('#inventory-list'); list.innerHTML=''; const inv = loadInventory(); inv.forEach(item=>{ const el = document.createElement('div'); el.className='inventory-item'; el.innerHTML = `<div class="row"><div><strong>${item.name}</strong></div><div class="qty">${item.qty}</div></div>`; const row = document.createElement('div'); row.className='row'; const dec = document.createElement('button'); dec.textContent='-'; dec.className='btn-filter'; const inc = document.createElement('button'); inc.textContent='+'; inc.className='btn-filter'; row.appendChild(dec); row.appendChild(inc); el.appendChild(row); if(item.qty <= item.min) el.querySelector('.qty').classList.add('progress-low'); dec.addEventListener('click', ()=>{ item.qty = Math.max(0, item.qty-1); saveInventory(inv); renderInventory(); }); inc.addEventListener('click', ()=>{ item.qty = item.qty+1; saveInventory(inv); renderInventory(); }); list.appendChild(el); }); }

  // --- Profile ---
  const USER_KEY = 'hubofaid_user_v1';
  function loadProfile(){ try{ const raw = localStorage.getItem(USER_KEY); return raw? JSON.parse(raw): {name:'Benutzer', role:'Nutzer'} }catch(e){ return {name:'Benutzer', role:'Nutzer'}; } }
  function renderProfile(){ const p = loadProfile(); qs('#user-name').textContent = p.name; qs('#user-role').textContent = p.role; }
  function initProfile(){ qs('#logout-btn').addEventListener('click', ()=>{ localStorage.removeItem(USER_KEY); alert('Abgemeldet'); location.reload(); }); }

  // --- Init all ---
  document.addEventListener('DOMContentLoaded', ()=>{
    initNav(); initFilters(); initScannerHandlers(); renderInventory(); initProfile(); renderProfile(); initMap();
  });

})();
