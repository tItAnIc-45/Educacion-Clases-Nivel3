"use strict";
/* Almacén del panel: solicitudes de inscripción, matriculados, asistencia y reportes.
   Guarda todo en localStorage del navegador (sin backend). Si el navegador bloquea el
   almacenamiento, trabaja en memoria durante la sesión. Contiene solo lógica, sin DOM. */
window.TP_Almacen = (() => {
  const CLAVE = "tp_panel_v1";
  const CLAVE_DEMO = "tp_panel_demo";
  const ESTADOS = ["pendiente", "aprobada", "rechazada"];
  const MARCAS = ["presente", "tarde", "falta"];
  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  let memoria = null;
  const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
  const escribir = txt => { try { localStorage.setItem(CLAVE, txt); return true; } catch { return false; } };

  const norm = c => String(c || "").trim().toLowerCase();
  const pad = n => String(n).padStart(2, "0");
  const aISO = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const hoy = () => aISO(new Date());
  const fechaValida = f => /^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(new Date(f + "T12:00:00"));

  /* ---------- Datos de ejemplo ---------- */
  function sembrar() {
    const ahora = new Date();
    const hace = (dias, h = 10, m = 0) => {
      const d = new Date(ahora); d.setDate(d.getDate() - dias); d.setHours(h, m, 0, 0); return d.toISOString();
    };
    const filas = [
      ["Carlos Mendoza", "carlos.mendoza@ejemplo.com", "web", "pendiente", 0, 9, 20],
      ["Ana Gómez", "ana.gomez@ejemplo.com", "diseno", "aprobada", 1, 16, 5],
      ["Luis Rojas", "luis.rojas@ejemplo.com", "web", "pendiente", 1, 11, 40],
      ["Sofía Castro", "sofia.castro@ejemplo.com", "web", "aprobada", 3, 14, 15],
      ["Ana Gómez", "ana.gomez@ejemplo.com", "web", "aprobada", 4, 9, 50],
      ["Marcos Vidal", "marcos.vidal@ejemplo.com", "web", "aprobada", 5, 18, 30],
      ["Valentina Ríos", "valentina.rios@ejemplo.com", "web", "aprobada", 6, 12, 10],
      ["Diego Paredes", "diego.paredes@ejemplo.com", "datos", "aprobada", 7, 10, 25],
      ["Camila Torres", "camila.torres@ejemplo.com", "marketing", "rechazada", 8, 15, 0],
      ["Jorge Salas", "jorge.salas@ejemplo.com", "video", "pendiente", 9, 17, 45],
      ["Renzo Alva", "renzo.alva@ejemplo.com", "diseno", "aprobada", 10, 13, 5],
      ["Paola Guzmán", "paola.guzman@ejemplo.com", "datos", "pendiente", 11, 8, 55]
    ];
    const solicitudes = filas.map((f, i) => ({
      id: "SOL-DEMO-" + pad(i + 1), tipo: "matricula", nombre: f[0], correo: f[1], programa: f[2],
      estado: f[3], fecha: hace(f[4], f[5], f[6]), origen: "demo", demo: true, envio: "ok",
      historial: f[3] === "pendiente" ? [] : [{ estado: f[3], fecha: hace(Math.max(f[4] - 1, 0), 9, 0), por: "Administración" }]
    }));

    // Clases anteriores: los últimos días hábiles, con un patrón fijo para que los porcentajes sean estables.
    const dias = [];
    for (let k = 1; dias.length < 8; k++) {
      const d = new Date(ahora); d.setDate(d.getDate() - k);
      if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(aISO(d));
    }
    const patron = {
      "sofia.castro@ejemplo.com": "PPPPPTPP",
      "ana.gomez@ejemplo.com": "PPTPFPTP",
      "marcos.vidal@ejemplo.com": "PTFPFPFT",
      "valentina.rios@ejemplo.com": "PPPPPPPP",
      "renzo.alva@ejemplo.com": "PPPTPPFP",
      "diego.paredes@ejemplo.com": "PPFPPTPP"
    };
    const cursoDe = { "sofia.castro@ejemplo.com": ["web"], "marcos.vidal@ejemplo.com": ["web"], "valentina.rios@ejemplo.com": ["web"],
      "ana.gomez@ejemplo.com": ["web", "diseno"], "renzo.alva@ejemplo.com": ["diseno"], "diego.paredes@ejemplo.com": ["datos"] };
    const mapa = { P: "presente", T: "tarde", F: "falta" };
    const asistencia = {};
    for (const [correo, cursos] of Object.entries(cursoDe)) {
      for (const curso of cursos) {
        dias.forEach((fecha, i) => {
          ((asistencia[curso] ||= {})[fecha] ||= {})[correo] = mapa[patron[correo][i]];
        });
      }
    }
    const reportes = [{
      id: "REP-DEMO-1", curso: "web", fecha: dias[0], por: "Lucía Paredes", demo: true,
      enviado: hace(1, 19, 10), resumen: { presente: 3, tarde: 1, falta: 0 }, total: 4
    }];
    return { version: 1, solicitudes, asistencia, reportes };
  }

  function valido(db) {
    return db && db.version === 1 && Array.isArray(db.solicitudes) && Array.isArray(db.reportes) &&
      db.asistencia && typeof db.asistencia === "object";
  }

  function db() {
    if (memoria) return memoria;
    let datos = null;
    const txt = leer();
    if (txt) { try { datos = JSON.parse(txt); } catch { datos = null; } }
    if (!valido(datos)) { datos = demoActivo() ? sembrar() : { version: 1, solicitudes: [], asistencia: {}, reportes: [] }; }
    memoria = datos;
    persistir();
    return memoria;
  }
  function persistir() { escribir(JSON.stringify(memoria)); }
  /* Si otra pestaña modificó los datos (por ejemplo, llegó una solicitud nueva), recargamos. */
  function recargar() { memoria = null; return db(); }

  /* ---------- Modo demostración del panel ---------- */
  let demoMemoria = null;
  function demoActivo() {
    try { const v = localStorage.getItem(CLAVE_DEMO); if (v !== null) return v === "1"; } catch { /* usa memoria */ }
    return demoMemoria === null ? true : demoMemoria;
  }
  function setDemo(v) {
    try { localStorage.setItem(CLAVE_DEMO, v ? "1" : "0"); } catch { /* sin almacenamiento */ }
    demoMemoria = !!v;
    if (v && !db().solicitudes.some(x => x.demo)) restablecerDemo();
  }
  const visible = s => demoActivo() || !s.demo;

  /* ---------- Solicitudes ---------- */
  function registrar({ tipo, nombre, correo, programa, codigo }) {
    const d = db();
    const c = norm(correo);
    if (!nombre || !correoOk.test(c) || !programa) return null;
    const existente = codigo && d.solicitudes.find(s => s.id === codigo);
    if (existente) return existente;
    const s = {
      id: codigo || "SOL-" + new Date().getFullYear() + "-" + Math.random().toString(16).slice(2, 14).toUpperCase(),
      tipo: tipo === "contacto" || tipo === "consulta" ? "consulta" : "matricula",
      nombre: String(nombre).trim().slice(0, 100), correo: c, programa, estado: "pendiente",
      fecha: new Date().toISOString(), origen: "web", demo: false, envio: "ok", historial: []
    };
    d.solicitudes.push(s);
    persistir();
    return s;
  }
  function listar({ estado = "", q = "", programa = "", tipo = "" } = {}) {
    const txt = String(q).trim().toLowerCase();
    return db().solicitudes.filter(visible)
      .filter(s => (!estado || s.estado === estado) && (!programa || s.programa === programa) && (!tipo || s.tipo === tipo))
      .filter(s => !txt || (s.nombre + " " + s.correo + " " + s.id).toLowerCase().includes(txt))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  function conteos() {
    const r = { total: 0, pendiente: 0, aprobada: 0, rechazada: 0 };
    for (const s of db().solicitudes.filter(visible)) { r.total++; r[s.estado]++; }
    return r;
  }
  function cambiarEstado(id, estado, por = "Administración") {
    if (!ESTADOS.includes(estado)) return null;
    const s = db().solicitudes.find(x => x.id === id);
    if (!s) return null;
    if (s.estado === estado) return s;
    s.estado = estado;
    (s.historial ||= []).push({ estado, fecha: new Date().toISOString(), por });
    persistir();
    return s;
  }
  const obtener = id => db().solicitudes.find(s => s.id === id) || null;

  /* ---------- Matriculados: una solicitud aprobada matricula a la persona en el programa ---------- */
  function matriculados(curso) {
    const vistos = new Map();
    for (const s of db().solicitudes.filter(visible)) {
      if (s.estado !== "aprobada" || s.programa !== curso || vistos.has(s.correo)) continue;
      vistos.set(s.correo, { correo: s.correo, nombre: s.nombre, solicitud: s.id, desde: s.fecha });
    }
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  const cursosDe = correo => [...new Set(db().solicitudes.filter(visible)
    .filter(s => s.correo === norm(correo) && s.estado === "aprobada").map(s => s.programa))];
  const solicitudesDe = correo => db().solicitudes.filter(visible)
    .filter(s => s.correo === norm(correo)).sort((a, b) => b.fecha.localeCompare(a.fecha));

  /* ---------- Asistencia ---------- */
  const dia = (curso, fecha) => ({ ...(db().asistencia[curso]?.[fecha] || {}) });
  function guardarAsistencia(curso, fecha, marcas) {
    if (!fechaValida(fecha)) return null;
    const permitidos = new Set(matriculados(curso).map(a => a.correo));
    const limpio = {};
    for (const [correo, m] of Object.entries(marcas || {})) {
      if (permitidos.has(correo) && MARCAS.includes(m)) limpio[correo] = m;
    }
    const d = db();
    ((d.asistencia[curso] ||= {})[fecha] = limpio);
    persistir();
    return resumenDia(curso, fecha);
  }
  function resumenDia(curso, fecha) {
    const marcas = dia(curso, fecha), vigentes = matriculados(curso), total = vigentes.length;
    const r = { presente: 0, tarde: 0, falta: 0 };
    for (const a of vigentes) if (marcas[a.correo]) r[marcas[a.correo]]++; // ignora marcas de quien ya no está matriculado
    return { ...r, marcados: r.presente + r.tarde + r.falta, total };
  }
  /* La asistencia cuenta "presente" y "tarde" como clase asistida. */
  function porAlumno(curso, correo) {
    const r = { presente: 0, tarde: 0, falta: 0, total: 0, pct: null, ultimas: [] };
    const dias = Object.keys(db().asistencia[curso] || {}).sort();
    for (const f of dias) {
      const m = db().asistencia[curso][f][correo];
      if (!m) continue;
      r[m]++; r.total++; r.ultimas.push({ fecha: f, marca: m });
    }
    r.pct = r.total ? Math.round((r.presente + r.tarde) / r.total * 100) : null;
    r.ultimas = r.ultimas.slice(-8);
    return r;
  }
  function historial(curso, limite = 6) {
    return Object.keys(db().asistencia[curso] || {}).sort().reverse().slice(0, limite).map(f => ({ fecha: f, ...resumenDia(curso, f) }))
      .filter(h => h.marcados > 0);
  }
  function promedioCurso(curso) {
    const lista = matriculados(curso).map(a => porAlumno(curso, a.correo).pct).filter(p => p !== null);
    return lista.length ? Math.round(lista.reduce((a, b) => a + b, 0) / lista.length) : null;
  }

  /* ---------- Reportes enviados por los docentes ---------- */
  function enviarReporte(curso, fecha, por) {
    const r = resumenDia(curso, fecha);
    if (!r.marcados) return null; // no hay asistencia guardada para ese día
    const d = db();
    const previo = d.reportes.find(x => x.curso === curso && x.fecha === fecha && x.por === por);
    const rep = previo || { id: "REP-" + Date.now().toString(36).toUpperCase(), curso, fecha, por, demo: false };
    rep.enviado = new Date().toISOString();
    rep.resumen = { presente: r.presente, tarde: r.tarde, falta: r.falta };
    rep.total = r.total;
    if (!previo) d.reportes.push(rep);
    persistir();
    return rep;
  }
  const reportes = (limite = 6) => db().reportes.filter(visible).sort((a, b) => b.enviado.localeCompare(a.enviado)).slice(0, limite);

  /* ---------- Mantenimiento ---------- */
  function restablecerDemo() {
    const d = db();
    const demoCorreos = new Set(d.solicitudes.filter(s => s.demo).map(s => s.correo));
    const realCorreos = new Set(d.solicitudes.filter(s => !s.demo).map(s => s.correo));
    const nuevo = sembrar();
    d.solicitudes = d.solicitudes.filter(s => !s.demo).concat(nuevo.solicitudes);
    d.reportes = d.reportes.filter(r => !r.demo).concat(nuevo.reportes);
    for (const curso of Object.keys(d.asistencia)) {
      for (const f of Object.keys(d.asistencia[curso])) {
        for (const c of Object.keys(d.asistencia[curso][f])) if (demoCorreos.has(c) && !realCorreos.has(c)) delete d.asistencia[curso][f][c];
      }
    }
    for (const [curso, fechas] of Object.entries(nuevo.asistencia)) {
      for (const [f, marcas] of Object.entries(fechas)) Object.assign(((d.asistencia[curso] ||= {})[f] ||= {}), marcas);
    }
    persistir();
  }
  function vaciarTodo() {
    memoria = { version: 1, solicitudes: [], asistencia: {}, reportes: [] };
    persistir();
  }
  function csvSolicitudes(lista) {
    const celda = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const filas = [["Código", "Tipo", "Nombre", "Correo", "Programa", "Estado", "Fecha"]];
    for (const s of lista) filas.push([s.id, s.tipo, s.nombre, s.correo, (window.TP?.curso(s.programa)?.t) || s.programa, s.estado, s.fecha]);
    return "\ufeff" + filas.map(f => f.map(celda).join(",")).join("\r\n");
  }

  return {
    CLAVE, ESTADOS, MARCAS, hoy, fechaValida, recargar, demoActivo, setDemo,
    registrar, listar, conteos, cambiarEstado, obtener,
    matriculados, cursosDe, solicitudesDe,
    dia, guardarAsistencia, resumenDia, porAlumno, historial, promedioCurso,
    enviarReporte, reportes, restablecerDemo, vaciarTodo, csvSolicitudes
  };
})();
