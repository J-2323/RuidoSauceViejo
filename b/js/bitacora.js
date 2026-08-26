const Bitacora = {
  STORAGE_KEY: 'bitacora_ruido',
  data: {}, // { 'YYYY-MM-DD': { hours: {0: 'B', 1: 'M', ...}, notes: '' } }
  currentPeriod: 'day',
  currentDate: new Date(),
  selectedHour: null,

  init() {
    this.loadData();
    this.setupDate();
    this.setupPeriodButtons();
    this.setupHourGrid();
    this.setupLevelModal();
    this.setupActions();
    this.render();
  },

  loadData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      this.data = {};
    }
  },

  saveData() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  },

  setupDate() {
    const picker = document.getElementById('datePicker');
    picker.value = this.toISO(this.currentDate);
    picker.addEventListener('change', (e) => {
      this.currentDate = new Date(e.target.value + 'T00:00:00');
      this.render();
    });
  },

  setupPeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPeriod = btn.dataset.period;
        document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
        document.getElementById('view' + this.capitalize(this.currentPeriod)).style.display = 'block';
        this.render();
      });
    });
  },

  setupHourGrid() {
    const grid = document.getElementById('hourGrid');
    grid.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('div');
      cell.className = 'hour-cell';
      cell.dataset.hour = h;
      cell.innerHTML = `
        <div class="hour-label">${h.toString().padStart(2, '0')}:00</div>
        <div class="noise-level" id="level-${h}">—</div>
      `;
      cell.addEventListener('click', () => this.openLevelModal(h));
      grid.appendChild(cell);
    }
  },

  setupLevelModal() {
    document.querySelectorAll('#levelModal .source-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setHourLevel(this.selectedHour, btn.dataset.level);
        document.getElementById('levelModal').classList.remove('active');
      });
    });
    document.getElementById('cancelLevel').addEventListener('click', () => {
      document.getElementById('levelModal').classList.remove('active');
    });
  },

  openLevelModal(hour) {
    this.selectedHour = hour;
    document.getElementById('selectedHour').textContent = hour.toString().padStart(2, '0');
    document.getElementById('levelModal').classList.add('active');
  },

  setHourLevel(hour, level) {
    const dateKey = this.toISO(this.currentDate);
    if (!this.data[dateKey]) {
      this.data[dateKey] = { hours: {}, notes: '' };
    }
    // Toggle: si ya está el mismo nivel, lo borra
    if (this.data[dateKey].hours[hour] === level) {
      delete this.data[dateKey].hours[hour];
    } else {
      this.data[dateKey].hours[hour] = level;
    }
    this.saveData();
    this.render();
  },

  setupActions() {
    document.getElementById('saveDay').addEventListener('click', () => {
      const dateKey = this.toISO(this.currentDate);
      if (!this.data[dateKey]) this.data[dateKey] = { hours: {}, notes: '' };
      this.data[dateKey].notes = document.getElementById('dayNotes').value;
      this.saveData();
      Auth.showToast('💾 Día guardado', 'success');
    });

    document.getElementById('clearDay').addEventListener('click', () => {
      Auth.requireAuth(() => {
        if (!confirm('¿Borrar los datos de este día?')) return;
        const dateKey = this.toISO(this.currentDate);
        delete this.data[dateKey];
        this.saveData();
        this.render();
        Auth.showToast('🗑️ Día borrado', 'success');
      });
    });

    document.getElementById('btnExportJson').addEventListener('click', (e) => {
      e.preventDefault();
      this.exportJSON();
    });
    document.getElementById('btnImportJson').addEventListener('click', (e) => {
      e.preventDefault();
      this.importJSON();
    });
    document.getElementById('btnExportPdf').addEventListener('click', (e) => {
      e.preventDefault();
      this.exportPDF();
    });
  },

  render() {
    if (this.currentPeriod === 'day') this.renderDay();
    else if (this.currentPeriod === 'week') this.renderWeek();
    else if (this.currentPeriod === 'month') this.renderMonth();
    else if (this.currentPeriod === 'year') this.renderYear();
  },

  renderDay() {
    const dateKey = this.toISO(this.currentDate);
    const dayData = this.data[dateKey] || { hours: {}, notes: '' };
    document.getElementById('dayTitle').textContent = this.currentDate.toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('dayNotes').value = dayData.notes || '';

    for (let h = 0; h < 24; h++) {
      const level = dayData.hours[h];
      const el = document.getElementById('level-' + h);
      const cell = el.parentElement;
      el.textContent = level || '—';
      el.className = 'noise-level' + (level ? ' noise-' + level.toLowerCase() : '');
      cell.style.borderColor = level ? this.getLevelColor(level) : 'var(--border)';
    }
  },

  renderWeek() {
    const container = document.getElementById('weekView');
    const start = new Date(this.currentDate);
    start.setDate(start.getDate() - start.getDay() + 1);
    let html = '<div style="display: grid; gap: 0.5rem;">';
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = this.toISO(d);
      const dayData = this.data[key] || { hours: {} };
      const avg = this.getDayAverage(dayData.hours);
      const color = avg ? this.getLevelColorFromDb(avg) : 'var(--text-secondary)';
      html += `
        <div class="card" style="padding: 1rem; cursor: pointer;" onclick="Bitacora.goToDate('${key}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">${Object.keys(dayData.hours).length} registros</div>
            </div>
            <div style="font-size: 1.5rem; font-weight: 700; color: ${color};">${avg ? avg.toFixed(0) + ' dB' : '—'}</div>
          </div>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;
  },

  renderMonth() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    document.getElementById('monthTitle').textContent = this.currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    // Encabezados de días
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(d => {
      const h = document.createElement('div');
      h.style.textAlign = 'center';
      h.style.fontSize = '0.75rem';
      h.style.color = 'var(--text-secondary)';
      h.style.fontWeight = '600';
      h.textContent = d;
      grid.appendChild(h);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;

    for (let i = 0; i < startOffset; i++) {
      grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const key = this.toISO(date);
      const dayData = this.data[key] || { hours: {} };
      const avg = this.getDayAverage(dayData.hours);
      const cell = document.createElement('div');
      cell.className = 'calendar-day' + (avg ? ' has-data' : '');
      if (avg) {
        cell.style.background = this.getLevelColorFromDb(avg);
        cell.style.color = 'white';
      }
      cell.innerHTML = `<div>${d}</div>${avg ? `<div class="db-indicator">${avg.toFixed(0)}dB</div>` : ''}`;
      cell.addEventListener('click', () => this.goToDate(key));
      grid.appendChild(cell);
    }
  },

  renderYear() {
    const year = this.currentDate.getFullYear();
    const container = document.getElementById('yearView');
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">';
    for (let m = 0; m < 12; m++) {
      const monthData = this.getMonthData(year, m);
      html += `
        <div class="card" style="padding: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">${new Date(year, m).toLocaleDateString('es-AR', { month: 'long' })}</h4>
          <div style="font-size: 2rem; font-weight: 700; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            ${monthData.avg ? monthData.avg.toFixed(0) : '—'} <small style="font-size: 0.8rem;">dB</small>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${monthData.days} días registrados</div>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;
  },

  goToDate(key) {
    this.currentDate = new Date(key + 'T00:00:00');
    document.getElementById('datePicker').value = key;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-period="day"]').classList.add('active');
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    document.getElementById('viewDay').style.display = 'block';
    this.currentPeriod = 'day';
    this.render();
  },

  getDayAverage(hours) {
    const values = Object.values(hours);
    if (values.length === 0) return null;
    const sum = values.reduce((s, v) => s + this.levelToDb(v), 0);
    return sum / values.length;
  },

  getMonthData(year, month) {
    let total = 0, count = 0;
    const days = new Set();
    Object.keys(this.data).forEach(key => {
      const d = new Date(key + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        const avg = this.getDayAverage(this.data[key].hours);
        if (avg) {
          total += avg;
          count++;
          days.add(key);
        }
      }
    });
    return { avg: count ? total / count : null, days: days.size };
  },

  levelToDb(level) {
    const map = { 'NP': 20, 'B': 40, 'M': 60, 'A': 80, 'MA': 100 };
    return map[level] || 0;
  },

  getLevelColor(level) {
    const map = {
      'NP': 'var(--text-secondary)',
      'B': 'var(--success)',
      'M': 'var(--accent)',
      'A': 'var(--warning)',
      'MA': 'var(--danger)'
    };
    return map[level] || 'var(--border)';
  },

  getLevelColorFromDb(db) {
    if (db < 40) return 'var(--success)';
    if (db < 60) return 'var(--accent)';
    if (db < 75) return 'var(--warning)';
    return 'var(--danger)';
  },

  toISO(date) {
    return date.toISOString().split('T')[0];
  },

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  exportJSON() {
    const data = JSON.stringify(this.data, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Auth.showToast('📤 Bitácora exportada', 'success');
    document.getElementById('adminMenu').classList.remove('active');
  },

  importJSON() {
    Auth.requireAuth(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (confirm('¿Reemplazar los datos actuales con los importados?')) {
              this.data = imported;
              this.saveData();
              this.render();
              Auth.showToast('✅ Bitácora restaurada', 'success');
            }
          } catch (err) {
            Auth.showToast('❌ Archivo inválido', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
      document.getElementById('adminMenu').classList.remove('active');
    });
  },

  clearAll() {
    Auth.requireAuth(() => {
      if (!confirm('⚠️ ¿Borrar TODA la bitácora? Esta acción no se puede deshacer.')) return;
      if (!confirm('🔴 Confirmá nuevamente: se perderán todos los datos.')) return;
      this.data = {};
      this.saveData();
      this.render();
      document.getElementById('adminMenu').classList.remove('active');
      Auth.showToast('🗑️ Bitácora borrada', 'success');
    });
  },

  exportPDF() {
    Auth.showToast('📄 Generando PDF... (usá Ctrl+P en el navegador)', 'info');
    setTimeout(() => window.print(), 500);
  }
};

document.addEventListener('DOMContentLoaded', () => Bitacora.init());