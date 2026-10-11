// Lógica del sistema · la configuración (webhook e ID de la hoja) está en config.js
const { WEBHOOK_URL, SHEET_ID, HOJA_AGENDA, HOJA_CITAS } = window.CONFIG;

// ---- Utilidades de fecha (zona local, formato AAAA-MM-DD) ----
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = () => iso(new Date());
const manana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); };
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fechaLarga = f => { const [a, m, d] = f.split("-").map(Number); const dt = new Date(a, m - 1, d); return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]} de ${a}`; };
const fechaCorta = f => { const [, m, d] = f.split("-").map(Number); return `${d} ${MESES[m - 1].slice(0, 3)}`; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---- Navegación (carga automática al abrir cada vista) ----
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("activo", x === b));
  document.querySelectorAll(".vista").forEach(v => v.classList.toggle("activa", v.id === b.dataset.vista));
  if (b.dataset.vista === "agenda") cargarAgenda(true);
  if (b.dataset.vista === "franjas") cargarFranjas(true);
});

// ---- Casos de prueba del enunciado ----
const CASOS = {
  C1: {mascota:"Luna",  especie:"perro", servicio:"Consulta general", fecha:"2026-10-14", hora:"08:00"},
  C2: {mascota:"Michi", especie:"gato",  servicio:"Vacunación",       fecha:"2026-10-14", hora:"10:00"},
  C3: {mascota:"Rocky", especie:"perro", servicio:"Baño",             fecha:"2026-10-14", hora:"11:00"},
  C4: {mascota:"Pelusa",especie:"gato",  servicio:"Consulta general", fecha:"2026-10-20", hora:"08:00"},
  C5: {mascota:"Luna",  especie:"perro", servicio:"Baño",             fecha:"2026-10-14", hora:"09:00"},
};
Object.entries(CASOS).forEach(([k, c]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = `${k} · ${c.mascota} ${c.hora}`;
  b.onclick = () => {
    for (const [campo, valor] of Object.entries(c)) document.getElementById(campo).value = valor;
    if (!document.getElementById("propietario").value) document.getElementById("propietario").value = "Cristian Marin";
    if (!document.getElementById("correo").value) document.getElementById("correo").value = "cm6562141@gmail.com";
  };
  document.getElementById("casos").appendChild(b);
});

// ---- Agendar: dispara el webhook del escenario 1 ----
const TITULOS = {
  CONFIRMADA: "✔ Cita confirmada",
  CONFIRMADA_ALERTA: "⚠ Cita confirmada con alerta",
  RECHAZADA: "✖ Cita rechazada",
  RESPALDO: "↪ Ruta de respaldo",
  ERROR: "Error"
};
document.getElementById("form").onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btnAgendar");
  const caja = document.getElementById("resultado");
  btn.disabled = true; btn.textContent = "Procesando…";
  const datos = new URLSearchParams(new FormData(e.target)); // form-urlencoded: sin preflight CORS
  let r;
  try {
    const resp = await fetch(WEBHOOK_URL, { method: "POST", body: datos });
    const texto = await resp.text();
    try { r = JSON.parse(texto); }
    catch { r = { resultado: "ERROR", mensaje: `Respuesta inesperada del proceso: «${texto}». ¿El escenario está activo?` }; }
  } catch (err) {
    r = { resultado: "ERROR", mensaje: "No se pudo contactar el proceso: " + err.message };
  }
  caja.className = "resultado r-" + (r.resultado || "ERROR");
  caja.style.display = "block";
  caja.innerHTML = `<h3>${TITULOS[r.resultado] || esc(r.resultado)}</h3><p>${esc(r.mensaje)}</p>` +
    (r.libres !== undefined && r.libres !== null ? `<small>Cupos libres en la franja: ${esc(r.libres)}</small>` : "") +
    (r.id_cita ? `<small>Código: ${esc(r.id_cita)}</small>` : "");
  btn.disabled = false; btn.textContent = "Agendar";
  // Lo agendado cambia la agenda y las franjas: se vuelven a leer al abrir esas vistas.
  cache.citas = cache.agenda = null;
  const fechaForm = document.getElementById("fecha").value;
  if (fechaForm) { document.getElementById("fechaAgenda").value = fechaForm; document.getElementById("fechaFranja").value = fechaForm; }
};

// ---- Lectura de la hoja de Google (compartida como «Cualquier persona con el enlace · Lector») ----
// Se usa JSONP de Google Visualization: una etiqueta <script> en lugar de fetch, así no depende de CORS
// y funciona igual publicada en GitHub Pages que abriendo el archivo localmente.
let jsonpSeq = 0;
function gvizJSONP(hoja) {
  return new Promise((resolve, reject) => {
    const cb = `__gviz_${Date.now()}_${jsonpSeq++}`;
    const s = document.createElement("script");
    const limpiar = () => { delete window[cb]; s.remove(); clearTimeout(t); };
    const t = setTimeout(() => { limpiar(); reject(new Error("La hoja no respondió. Verifica la conexión y que esté compartida como «Cualquier persona con el enlace · Lector».")); }, 15000);
    window[cb] = (resp) => { limpiar(); resp && resp.status !== "error" ? resolve(resp) : reject(new Error("Google respondió con error al leer la hoja «" + hoja + "».")); };
    s.onerror = () => { limpiar(); reject(new Error("No se pudo leer la hoja. Verifica que esté compartida como «Cualquier persona con el enlace · Lector».")); };
    s.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?headers=1&sheet=${encodeURIComponent(hoja)}&tqx=out:json;responseHandler:${cb}&_=${Date.now()}`;
    document.head.appendChild(s);
  });
}
// Convierte una celda de Google Visualization a texto (fechas AAAA-MM-DD, horas HH:MM).
function celda(c, tipo) {
  if (!c || c.v === null || c.v === undefined) return "";
  const v = c.v, dos = n => String(n).padStart(2, "0");
  if ((tipo === "date" || tipo === "datetime") && typeof v === "string" && v.startsWith("Date(")) {
    const [a, m, d, h = 0, mi = 0] = v.slice(5, -1).split(",").map(Number);
    return tipo === "date" ? `${a}-${dos(m + 1)}-${dos(d)}` : `${a}-${dos(m + 1)}-${dos(d)} ${dos(h)}:${dos(mi)}`;
  }
  if (tipo === "timeofday" && Array.isArray(v)) return `${dos(v[0])}:${dos(v[1])}`;
  if (typeof v === "number") return String(v);
  return String(v).trim();
}
function tablaAObjetos(resp) {
  const t = resp.table || { cols: [], rows: [] };
  let nombres = t.cols.map(c => (c.label || "").trim());
  let filas = t.rows.map(r => t.cols.map((col, i) => celda((r.c || [])[i], col.type)));
  if (nombres.every(n => !n) && filas.length) { nombres = filas[0]; filas = filas.slice(1); } // por si Google no detecta encabezados
  return filas.filter(f => f.some(x => x)).map(f => Object.fromEntries(nombres.map((n, i) => [n, f[i] || ""])));
}
const cache = { citas: null, agenda: null };
async function leerHoja(nombre, forzar) {
  if (cache[nombre] && !forzar) return cache[nombre];
  const hoja = nombre === "agenda" ? HOJA_AGENDA : HOJA_CITAS;
  cache[nombre] = tablaAObjetos(await gvizJSONP(hoja));
  return cache[nombre];
}
const horaAhora = () => new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
const COLORES = {CONFIRMADA:"var(--ok)", CONFIRMADA_ALERTA:"var(--alerta)", AGENDADA:"var(--verde)", ATENDIDA:"var(--ok)", NO_ASISTIO:"var(--rech)", CANCELADA:"var(--resp)", SI:"var(--ok)", NO:"var(--resp)"};
const ETIQUETAS = {CONFIRMADA_ALERTA:"CON ALERTA", NO_ASISTIO:"NO ASISTIÓ"};
const chip = (v, color) => `<span class="chip" style="background:${color || COLORES[v] || "var(--resp)"}">${esc(ETIQUETAS[v] || v || "—")}</span>`;
function pintarChipsDias(contId, fechas, conteo, seleccion, alElegir) {
  const cont = document.getElementById(contId);
  cont.innerHTML = fechas.length ? "" : '<span class="nota">Todavía no hay datos.</span>';
  fechas.forEach(f => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = f === seleccion ? "sel" : "";
    b.textContent = `${fechaCorta(f)} (${conteo[f]})`;
    b.onclick = () => alElegir(f);
    cont.appendChild(b);
  });
}

// ---- Vista: Agenda del día ----
const fechaAgenda = document.getElementById("fechaAgenda");
fechaAgenda.value = hoy();
fechaAgenda.onchange = () => cargarAgenda();
document.getElementById("agHoy").onclick = () => { fechaAgenda.value = hoy(); cargarAgenda(); };
document.getElementById("agManana").onclick = () => { fechaAgenda.value = manana(); cargarAgenda(); };
document.getElementById("agRecargar").onclick = () => cargarAgenda(true);

let agPrimera = false;
async function cargarAgenda(forzar) {
  const f = fechaAgenda.value;
  const caja = document.getElementById("tablaAgenda");
  const kpis = document.getElementById("agKpis");
  caja.innerHTML = '<p class="vacio">Cargando…</p>';
  try {
    const todas = await leerHoja("citas", forzar);
    document.getElementById("agActualizado").textContent = "Actualizado " + horaAhora();
    const conteo = {};
    todas.forEach(c => { if (c.fecha) conteo[c.fecha] = (conteo[c.fecha] || 0) + 1; });
    pintarChipsDias("agDias", Object.keys(conteo).sort(), conteo, f, d => { fechaAgenda.value = d; cargarAgenda(); });

    if (!agPrimera) { agPrimera = true;
      const prox = Object.keys(conteo).sort().find(d => d >= f);
      if (prox && !conteo[f]) { fechaAgenda.value = prox; return cargarAgenda(); } }
    const citas = todas.filter(c => c.fecha === f).sort((a, b) => a.hora.localeCompare(b.hora));
    const n = citas.length;
    kpis.innerHTML = [
      [n, "citas del día"],
      [citas.filter(c => c.resultado === "CONFIRMADA").length, "confirmadas"],
      [citas.filter(c => c.resultado === "CONFIRMADA_ALERTA").length, "con alerta de cupo"],
      [citas.filter(c => c.recordatorio_enviado === "SI").length, "recordatorios enviados"],
    ].map(([v, t]) => `<div class="kpi"><b>${v}</b><span>${t}</span></div>`).join("");

    caja.innerHTML = `<h3 class="titulo-dia">${fechaLarga(f)}</h3>` + (n === 0
      ? `<p class="vacio">No hay citas agendadas para este día. Elige otra fecha o uno de los días de arriba.</p>`
      : `<div class="tabla-scroll"><table><thead><tr><th>Hora</th><th>Mascota</th><th>Servicio</th><th>Propietario</th><th>Resultado</th><th>Estado</th><th>Recordatorio</th></tr></thead><tbody>` +
        citas.map(c => `<tr><td><b>${esc(c.hora)}</b></td><td>${esc(c.mascota)} <span class="nota">(${esc(c.especie)})</span></td><td>${esc(c.servicio)}</td><td>${esc(c.propietario)}<br><span class="nota">${esc(c.correo)}</span></td><td>${chip(c.resultado)}</td><td>${chip(c.estado)}</td><td>${chip(c.recordatorio_enviado === "SI" ? "SI" : "NO", null)}</td></tr>` +
          (c.observacion && c.observacion !== "Sin novedad" ? `<tr><td></td><td colspan="6" class="nota">↳ ${esc(c.observacion)} · código ${esc(c.id_cita)}</td></tr>` : "")).join("") +
        `</tbody></table></div>`);
  } catch (e) { kpis.innerHTML = ""; caja.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; }
}

// ---- Vista: Franjas y cupos ----
const fechaFranja = document.getElementById("fechaFranja");
fechaFranja.value = hoy();
fechaFranja.onchange = () => cargarFranjas();
document.getElementById("frHoy").onclick = () => { fechaFranja.value = hoy(); cargarFranjas(); };
document.getElementById("frManana").onclick = () => { fechaFranja.value = manana(); cargarFranjas(); };
document.getElementById("frRecargar").onclick = () => cargarFranjas(true);

let frPrimera = false;
async function cargarFranjas(forzar) {
  const f = fechaFranja.value;
  const caja = document.getElementById("tablaFranjas");
  caja.innerHTML = '<p class="vacio">Cargando…</p>';
  try {
    const agenda = await leerHoja("agenda", forzar);
    document.getElementById("frActualizado").textContent = "Actualizado " + horaAhora();
    const conteo = {};
    agenda.forEach(x => { if (x.fecha) conteo[x.fecha] = (conteo[x.fecha] || 0) + 1; });
    pintarChipsDias("frDias", Object.keys(conteo).sort(), conteo, f, d => { fechaFranja.value = d; cargarFranjas(); });

    if (!frPrimera) { frPrimera = true;
      const prox = Object.keys(conteo).sort().find(d => d >= f);
      if (prox && !conteo[f]) { fechaFranja.value = prox; return cargarFranjas(); } }
    const fr = agenda.filter(x => x.fecha === f).sort((a, b) => a.hora.localeCompare(b.hora));
    if (fr.length === 0) {
      caja.innerHTML = `<h3 class="titulo-dia">${fechaLarga(f)}</h3><p class="vacio">No hay franjas abiertas en la agenda para este día. Una solicitud para esta fecha iría a la ruta de respaldo.</p>`;
      return;
    }
    const totCupo = fr.reduce((s, x) => s + Number(x.cupo), 0);
    const totOcup = fr.reduce((s, x) => s + Number(x.ocupados), 0);
    caja.innerHTML = `<h3 class="titulo-dia">${fechaLarga(f)}</h3>
      <p class="nota" style="margin:-6px 0 14px">Ocupación del día: <b>${totOcup} de ${totCupo}</b> cupos (${Math.round(totOcup / totCupo * 100)} %) · libres = cupo − ocupados</p>
      <div class="franjas-grid">` + fr.map(x => {
        const cupo = Number(x.cupo), ocup = Number(x.ocupados), libres = cupo - ocup;
        const color = libres <= 0 ? "var(--rech)" : libres === 1 ? "var(--alerta)" : "var(--ok)";
        const estado = libres <= 0 ? "LLENA" : libres === 1 ? "1 LIBRE" : `${libres} LIBRES`;
        return `<div class="franja"><h4>${esc(x.hora)}</h4>${chip(estado, color)}
          <div class="barra" style="margin-top:10px"><i style="width:${Math.min(100, ocup / cupo * 100)}%;background:${color}"></i></div>
          <p>${ocup} ocupados de ${cupo} · ${libres <= 0 ? "se rechazan nuevas citas" : libres <= 2 ? "la próxima cita genera alerta" : "disponible"}</p></div>`;
      }).join("") + `</div>`;
  } catch (e) { caja.innerHTML = `<p class="vacio">${esc(e.message)}</p>`; }
}
