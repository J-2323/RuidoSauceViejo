const Map = {
  map: null,
  markers: [],
  measurements: [],
  STORAGE_KEY: 'sonic_measurements',
  pendingCoords: null,

  init() {
    // 1. Definir las 2 capas base solicitadas
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
    });

    // 2. Inicializar mapa con OSM por defecto
    this.map = L.map('map', {
      zoomControl: false,
      layers: [osmLayer] // Capa inicial
    }).setView([-31.7413, -60.7289], 14);

    // 3. Controles
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // 4. Selector de capas (Solo Calles y Satélite)
    L.control.layers({
      '🗺️ Calles (OpenStreetMap)': osmLayer,
      '🛰️ Satélite': satelliteLayer
    }, null, { position: 'topright' }).addTo(this.map);

    // Click en mapa para agregar medición
    this.map.on('click', (e) => {
      this.pendingCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
      this.showAddModal();
    });

    // Botón agregar (centro del mapa)
    document.getElementById('addBtn').addEventListener('click', () => {
      const center = this.map.getCenter();
      this.pendingCoords = { lat: center.lat, lng: center.lng };
      this.showAddModal();
    });

    // Save/Cancel
    document.getElementById('saveBtn').addEventListener('click', () => this.saveMeasurement());
    document.getElementById('cancelBtn').addEventListener('click', () => this.hideAddModal());
    document.getElementById('closeList').addEventListener('click', () => {
      document.getElementById('listModal').classList.remove('active');
    });

    // Export
    document.getElementById('exportJson').addEventListener('click', () => this.exportJSON());
    document.getElementById('exportCsv').addEventListener('click', () => this.exportCSV());

    // Cargar datos
    this.loadMeasurements();
    this.updateStats();
  },

  showAddModal() {
    document.getElementById('addModal').classList.add('active');
    document.getElementById('inputDb').focus();
  },

  hideAddModal() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('inputDb').value = '';
    document.getElementById('inputNote').value = '';
    document.getElementById('inputSource').selectedIndex = 0;
    this.pendingCoords = null;
  },

  saveMeasurement() {
    const db = parseFloat(document.getElementById('inputDb').value);
    const source = document.getElementById('inputSource').value;
    const note = document.getElementById('inputNote').value.trim();
    const autoTime = document.getElementById('autoTime').checked;

    if (isNaN(db) || db < 0 || db > 150) {
      Auth.showToast('❌ Ingresá un valor de dB válido (0-150)', 'error');
      return;
    }

    const measurement = {
      id: Date.now(),
      lat: this.pendingCoords.lat,
      lng: this.pendingCoords.lng,
      db: db,
      source: source,
      note: note,
      date: autoTime ? new Date().toISOString() : null
    };

    this.measurements.push(measurement);
    this.saveToStorage();
    this.addMarker(measurement);
    this.updateStats();
    this.hideAddModal();
    Auth.showToast('✅ Medición guardada', 'success');
  },

  addMarker(m) {
    const color = this.getDbColor(m.db);
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 11px;">${m.db}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([m.lat, m.lng], { icon }).addTo(this.map);
    marker.bindPopup(`
      <div style="min-width: 180px; font-family: Inter, sans-serif;">
        <strong style="font-size: 1.2em; color: ${color};">${m.db} dB</strong><br>
        <small style="color: #666;">${m.source}</small><br>
        ${m.note ? `<small><em>"${m.note}"</em></small><br>` : ''}
        ${m.date ? `<small style="color: #999; font-size: 0.8em;">${new Date(m.date).toLocaleString('es-AR')}</small>` : ''}
      </div>
    `);
    marker.measurementId = m.id;
    this.markers.push(marker);
  },

  getDbColor(db) {
    if (db < 40) return '#10b981';
    if (db < 60) return '#00d9ff';
    if (db < 75) return '#f59e0b';
    if (db < 90) return '#ef4444';
    return '#7c3aed';
  },

  loadMeasurements() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        this.measurements = JSON.parse(data);
        this.measurements.forEach(m => this.addMarker(m));
      }
    } catch (e) {
      console.error('Error cargando mediciones:', e);
    }
  },

  saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.measurements));
  },

  updateStats() {
    document.getElementById('statCount').textContent = this.measurements.length;
    if (this.measurements.length > 0) {
      const avg = this.measurements.reduce((s, m) => s + m.db, 0) / this.measurements.length;
      const max = Math.max(...this.measurements.map(m => m.db));
      document.getElementById('statAvg').textContent = avg.toFixed(1) + ' dB';
      document.getElementById('statMax').textContent = max + ' dB';
    } else {
      document.getElementById('statAvg').textContent = '— dB';
      document.getElementById('statMax').textContent = '— dB';
    }
  },

  showList() {
    const tbody = document.getElementById('listBody');
    tbody.innerHTML = '';
    if (this.measurements.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No hay mediciones</td></tr>';
    } else {
      this.measurements.forEach(m => {
        const badgeClass = m.db < 40 ? 'badge-silent' : m.db < 60 ? 'badge-normal' : m.db < 75 ? 'badge-moderate' : 'badge-high';
        tbody.innerHTML += `
          <tr>
            <td>${m.lat.toFixed(5)}</td>
            <td>${m.lng.toFixed(5)}</td>
            <td><span class="badge ${badgeClass}">${m.db} dB</span></td>
            <td>${m.source}</td>
            <td>${m.note || '—'}</td>
            <td>${m.date ? new Date(m.date).toLocaleString('es-AR') : '—'}</td>
            <td><button onclick="Map.deleteMeasurement(${m.id})" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size: 1.2rem;">🗑️</button></td>
          </tr>
        `;
      });
    }
    document.getElementById('listModal').classList.add('active');
    document.getElementById('adminMenu').classList.remove('active');
  },

  deleteMeasurement(id) {
    Auth.requireAuth(() => {
      if (!confirm('¿Eliminar esta medición?')) return;
      this.measurements = this.measurements.filter(m => m.id !== id);
      this.saveToStorage();
      const marker = this.markers.find(mk => mk.measurementId === id);
      if (marker) {
        this.map.removeLayer(marker);
        this.markers = this.markers.filter(mk => mk.measurementId !== id);
      }
      this.updateStats();
      this.showList();
      Auth.showToast('🗑️ Medición eliminada', 'success');
    });
  },

  clearAll() {
    Auth.requireAuth(() => {
      if (!confirm('⚠️ ¿Borrar TODAS las mediciones? Esta acción no se puede deshacer.')) return;
      if (!confirm('🔴 Confirmá nuevamente: se perderán todos los datos.')) return;
      this.measurements = [];
      this.markers.forEach(m => this.map.removeLayer(m));
      this.markers = [];
      this.saveToStorage();
      this.updateStats();
      document.getElementById('adminMenu').classList.remove('active');
      Auth.showToast('🗑️ Todas las mediciones borradas', 'success');
    });
  },

  exportJSON() {
    const data = JSON.stringify(this.measurements, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediciones_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Auth.showToast('📤 JSON exportado', 'success');
  },

  exportCSV() {
    const headers = ['lat', 'lng', 'db', 'source', 'note', 'date'];
    const rows = this.measurements.map(m => headers.map(h => `"${m[h] || ''}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediciones_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Auth.showToast('📊 CSV exportado', 'success');
  },

  exportAll() {
    this.exportJSON();
    document.getElementById('adminMenu').classList.remove('active');
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data)) {
            this.measurements = data;
            this.markers.forEach(m => this.map.removeLayer(m));
            this.markers = [];
            this.measurements.forEach(m => this.addMarker(m));
            this.saveToStorage();
            this.updateStats();
            Auth.showToast('✅ Datos importados', 'success');
          }
        } catch (err) {
          Auth.showToast('❌ Error al importar', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
    document.getElementById('adminMenu').classList.remove('active');
  }
};

document.addEventListener('DOMContentLoaded', () => Map.init());