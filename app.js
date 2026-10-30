// ===== Constantes del caso =====
const USUARIO_VALIDO = 'CVC';
const CLAVE_VALIDA = 'Lluvias';
const CLAVE_SEGURIDAD = 'CLIMA';
const ESTANDAR_CALI = 14;      // mm
const AJUSTE = 0.053;          // 5,3 %
const AJUSTE_DESDE = 15 * 60;  // 3:00 p.m. en minutos
const AJUSTE_HASTA = 18 * 60;  // 6:00 p.m. en minutos
const ESPERA_RELOJ_MS = 2000;

// Registros en memoria (se pierden al recargar)
const registros = [];
let fotoActual = '';

const $ = id => document.getElementById(id);
const mostrar = el => el.classList.remove('oculto');
const ocultar = el => el.classList.add('oculto');
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aMinutos = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const fmtDuracion = min => { const h = Math.floor(min / 60), m = min % 60; return (h ? h + ' h ' : '') + (m || !h ? m + ' min' : '').trim(); };
const fmtNum = n => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

// ===== Sesión =====
function irAlLogin() {
  ocultar($('vista-panel')); mostrar($('vista-login'));
  $('form-login').reset(); ocultar($('error-login'));
}

$('form-login').addEventListener('submit', e => {
  e.preventDefault();
  if ($('usuario').value.trim() === USUARIO_VALIDO && $('clave').value === CLAVE_VALIDA) {
    ocultar($('vista-login')); mostrar($('vista-panel'));
    pintarGrafica();
  } else {
    mostrar($('error-login'));
  }
});
$('btn-salir').addEventListener('click', irAlLogin);

// ===== Foto =====
$('foto').addEventListener('change', e => {
  const archivo = e.target.files[0];
  fotoActual = '';
  ocultar($('vista-foto'));
  $('texto-foto').textContent = archivo ? archivo.name : 'Tomar o elegir una foto';
  if (!archivo) return;
  if (!archivo.type.startsWith('image/')) { error('Selecciona un archivo de imagen.'); e.target.value = ''; return; }
  const lector = new FileReader();
  lector.onload = () => { fotoActual = lector.result; $('vista-foto').src = fotoActual; mostrar($('vista-foto')); };
  lector.readAsDataURL(archivo);
});

// ===== Formulario =====
function error(texto) { $('msg-registro').textContent = texto; mostrar($('msg-registro')); }

function limpiarCampos() {
  $('form-registro').reset(); fotoActual = '';
  $('texto-foto').textContent = 'Tomar o elegir una foto';
  ocultar($('vista-foto')); ocultar($('msg-registro'));
}
$('btn-limpiar').addEventListener('click', limpiarCampos);

$('form-registro').addEventListener('submit', e => {
  e.preventDefault();
  ocultar($('msg-registro'));
  const direccion = $('direccion').value.trim();
  const inicio = $('inicio').value, fin = $('fin').value;
  const precipTxt = $('precip').value;
  const registrador = $('registrador').value.trim();

  if (!direccion || !inicio || !fin || precipTxt === '' || !registrador)
    return error('Completa todos los campos: dirección, horas, precipitación y usuario.');
  const precip = parseFloat(precipTxt);
  if (isNaN(precip) || precip < 0) return error('La precipitación debe ser un número mayor o igual a 0.');

  const duracion = aMinutos(fin) - aMinutos(inicio);
  if (duracion <= 0) return error('Revisa la hora de inicio y la hora de fin de la lluvia.');

  const fecha = new Date().toLocaleDateString('es-CO');
  const repetido = registros.some(r => r.direccion.toLowerCase() === direccion.toLowerCase() &&
    r.fecha === fecha && r.inicio === inicio && r.fin === fin);
  if (repetido) return error('Este registro ya existe (misma zona, fecha y horario).');

  // Cálculo del caso: precipitación * estándar * tiempo total (en horas)
  const horas = duracion / 60;
  const base = precip * ESTANDAR_CALI * horas;
  const ini = aMinutos(inicio);
  const ajustado = ini >= AJUSTE_DESDE && ini < AJUSTE_HASTA;
  const indice = ajustado ? base * (1 + AJUSTE) : base;

  const registro = { fecha, direccion, inicio, fin, duracion, precip, registrador, foto: fotoActual, base, indice, ajustado };

  // Efecto reloj antes de cargar el dato
  mostrar($('reloj')); $('resultado').innerHTML = '';
  $('form-registro').querySelector('.primario').disabled = true;
  setTimeout(() => {
    ocultar($('reloj'));
    $('form-registro').querySelector('.primario').disabled = false;
    registros.push(registro);
    pintarResultado(registro);
    pintarTabla();
    pintarGrafica();
    // Clave de seguridad (ventana de diálogo) tras terminar el registro
    setTimeout(pedirClave, 150);
  }, ESPERA_RELOJ_MS);
});

function pedirClave() {
  const dato = prompt('Registro guardado. Escribe la clave de seguridad para registrar otra zona:');
  if (dato === CLAVE_SEGURIDAD) {
    limpiarCampos();
  } else {
    alert('Clave incorrecta. Se cerrará la sesión.');
    irAlLogin();
  }
}

// ===== Salidas =====
function pintarResultado(r) {
  const dif = r.precip - ESTANDAR_CALI;
  const comp = dif > 0 ? `<span class="sobre">${fmtNum(dif)} mm por encima del estándar</span>`
    : dif < 0 ? `<span class="bajo">${fmtNum(-dif)} mm por debajo del estándar</span>` : 'Igual al estándar';
  $('resultado').innerHTML = `
    <div class="metricas">
      <div class="metrica"><small>Duración de la lluvia</small><b>${fmtDuracion(r.duracion)}</b></div>
      <div class="metrica"><small>Precipitación registrada</small><b>${fmtNum(r.precip)} mm</b></div>
      <div class="metrica"><small>Estándar de Cali</small><b>${ESTANDAR_CALI} mm</b></div>
      <div class="metrica dest"><small>Resultado del cálculo</small><b>${fmtNum(r.indice)}</b></div>
    </div>
    <div class="nota">${comp}. Cálculo: ${fmtNum(r.precip)} × ${ESTANDAR_CALI} × ${fmtNum(r.duracion / 60)} h = ${fmtNum(r.base)}.</div>
    ${r.ajustado ? `<div class="nota ajuste">Ajuste horario del 5,3 % aplicado: la lluvia inició entre las 3:00 p.m. y las 6:00 p.m. (${fmtNum(r.base)} → ${fmtNum(r.indice)}).</div>` : ''}
    <p class="sub">${esc(r.direccion)} · ${r.fecha} · Registrado por ${esc(r.registrador)}</p>`;
}

function pintarTabla() {
  $('tabla').innerHTML = registros.map(r => {
    const dif = r.precip - ESTANDAR_CALI;
    const comp = dif > 0 ? `<span class="chip sobre">+${fmtNum(dif)} mm</span>` : dif < 0 ? `<span class="chip bajo">${fmtNum(dif)} mm</span>` : '<span class="chip igual">= estándar</span>';
    return `<tr><td>${r.fecha}</td><td>${esc(r.direccion)}</td><td>${r.inicio}</td><td>${r.fin}</td>
      <td>${fmtDuracion(r.duracion)}</td><td>${fmtNum(r.precip)}</td><td>${comp}</td><td>${esc(r.registrador)}</td>
      <td>${r.foto ? `<img src="${r.foto}" alt="Foto de ${esc(r.direccion)}">` : '—'}</td></tr>`;
  }).join('');
  $('vacio-tabla').classList.toggle('oculto', registros.length > 0);
}

function pintarKpis() {
  const total = registros.reduce((s, r) => s + r.precip, 0);
  $('kpi-total').textContent = registros.length;
  $('kpi-acum').textContent = fmtNum(total) + ' mm';
  $('kpi-prom').textContent = registros.length ? fmtNum(total / registros.length) + ' mm' : '—';
  $('kpi-sobre').textContent = registros.filter(r => r.precip > ESTANDAR_CALI).length;
}

// Gráfica de barras dibujada en canvas (una barra por registro)
function pintarGrafica() {
  pintarKpis();
  const c = $('grafica'), g = c.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim();
  const W = c.width, H = c.height, m = { t: 20, r: 20, b: 50, l: 50 };
  g.clearRect(0, 0, W, H);
  g.font = '13px system-ui, sans-serif';
  const max = Math.max(ESTANDAR_CALI * 1.25, ...registros.map(r => r.precip)) * 1.1;
  const y = v => H - m.b - (v / max) * (H - m.t - m.b);

  g.strokeStyle = col('--linea'); g.fillStyle = col('--suave'); g.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4;
    g.beginPath(); g.moveTo(m.l, y(v)); g.lineTo(W - m.r, y(v)); g.stroke();
    g.fillText(Math.round(v), m.l - 8, y(v) + 4);
  }
  // Línea del estándar
  g.setLineDash([6, 4]); g.strokeStyle = col('--ambar'); g.beginPath();
  g.moveTo(m.l, y(ESTANDAR_CALI)); g.lineTo(W - m.r, y(ESTANDAR_CALI)); g.stroke(); g.setLineDash([]);
  g.fillStyle = col('--ambar'); g.textAlign = 'left';
  g.fillText('Estándar ' + ESTANDAR_CALI + ' mm', m.l + 6, y(ESTANDAR_CALI) - 6);

  if (!registros.length) {
    g.fillStyle = col('--suave'); g.textAlign = 'center';
    g.fillText('Sin datos todavía', W / 2, H / 2);
    $('acumulado').textContent = '';
    return;
  }
  const ancho = (W - m.l - m.r) / registros.length;
  const bw = Math.min(70, ancho * 0.6);
  registros.forEach((r, i) => {
    const x = m.l + ancho * i + (ancho - bw) / 2;
    g.fillStyle = col('--lluvia'); g.fillRect(x, y(r.precip), bw, H - m.b - y(r.precip));
    g.fillStyle = col('--tinta'); g.textAlign = 'center';
    g.fillText(fmtNum(r.precip), x + bw / 2, y(r.precip) - 6);
    g.fillStyle = col('--suave');
    g.fillText(r.fecha.slice(0, 5) + ' #' + (i + 1), x + bw / 2, H - m.b + 18);
  });
  const total = registros.reduce((s, r) => s + r.precip, 0);
  $('acumulado').textContent = `${registros.length} registro(s) · Precipitación acumulada: ${fmtNum(total)} mm`;
}

window.addEventListener('resize', pintarGrafica);
pintarTabla();
