"use strict";
/* Pruebas del panel: almacén (solicitudes, matrículas, asistencia, reportes) y acceso por rol. Node.js >=18. */
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); console.log("✓", m); n++; };
const leer = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");

function entorno() {
  const mem = {}, ses = {};
  const mk = o => ({ getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } });
  const ctx = { window: {}, localStorage: mk(mem), sessionStorage: mk(ses), document: {}, location: { pathname: "/" }, TextEncoder, DataView, Uint8Array, Uint32Array, Date, Math, JSON, Intl, console };
  ctx.window.TP = ctx.TP = { curso: id => ({ id, t: id }) };
  vm.createContext(ctx);
  for (const f of ["almacen.js", "auth.js"]) vm.runInContext(leer(f), ctx, { filename: f });
  return { A: ctx.window.TP_Almacen, Au: ctx.window.TP_Auth, mem, ses };
}
/* Para probar los ingresos reales: TP_CRED=ruta/cred.json con { "admin": {"clave": "..."}, "docente": {...}, "alumno": {...} } */
const cred = process.env.TP_CRED && fs.existsSync(process.env.TP_CRED) ? JSON.parse(fs.readFileSync(process.env.TP_CRED)) : null;

// ---- Almacén ----
let { A } = entorno();
ok(A.conteos().total === 12 && A.conteos().pendiente === 4, "Primera carga: 12 solicitudes de ejemplo, 4 pendientes");
const web0 = A.matriculados("web").map(a => a.nombre);
ok(web0.length === 4 && !web0.includes("Carlos Mendoza"), "Solo las solicitudes aprobadas matriculan (Carlos está pendiente)");
const carlos = A.listar({ q: "carlos" })[0];
A.cambiarEstado(carlos.id, "aprobada", "Test");
ok(A.matriculados("web").some(a => a.nombre === "Carlos Mendoza"), "Aprobar matricula al alumno en el curso");
A.cambiarEstado(carlos.id, "rechazada", "Test");
ok(!A.matriculados("web").some(a => a.nombre === "Carlos Mendoza"), "Rechazar lo quita de la lista");
A.cambiarEstado(carlos.id, "pendiente", "Test");
ok(A.obtener(carlos.id).estado === "pendiente" && A.obtener(carlos.id).historial.length === 3, "Volver a Pendiente y registrar historial");
ok(A.cambiarEstado(carlos.id, "inventado") === null, "Rechaza estados inválidos");
ok(A.matriculados("web").filter(a => a.correo === "ana.gomez@ejemplo.com").length === 1, "Sin duplicados por correo");

const nueva = A.registrar({ tipo: "matricula", nombre: "  Rosa Díaz ", correo: " ROSA@Correo.com ", programa: "marketing", codigo: "SOL-2026-AAAA" });
ok(nueva.correo === "rosa@correo.com" && nueva.nombre === "Rosa Díaz" && nueva.estado === "pendiente" && nueva.origen === "web", "Solicitud pública entra como Pendiente con datos normalizados");
ok(A.registrar({ tipo: "matricula", nombre: "Rosa", correo: "otra@x.com", programa: "web", codigo: "SOL-2026-AAAA" }).correo === "rosa@correo.com" && A.conteos().total === 13, "Reintentar con el mismo código no duplica");
ok(A.registrar({ tipo: "contacto", nombre: "Pedro", correo: "p@x.com", programa: "video", codigo: "CON-1" }).tipo === "consulta", "El formulario de contacto se registra como consulta");
ok(A.registrar({ tipo: "matricula", nombre: "", correo: "mal", programa: "web" }) === null, "Datos inválidos no se registran");

// ---- Asistencia ----
const hoy = A.hoy(), web = A.matriculados("web");
const marcas = { [web[0].correo]: "presente", [web[1].correo]: "tarde", [web[2].correo]: "falta", "intruso@x.com": "presente", [web[3].correo]: "invalida" };
const r = A.guardarAsistencia("web", hoy, marcas);
ok(r.presente === 1 && r.tarde === 1 && r.falta === 1 && r.marcados === 3 && r.total === 4, "Guarda marcas válidas e ignora intrusos y valores inválidos");
ok(A.guardarAsistencia("web", "ayer", {}) === null, "Rechaza fechas inválidas");
ok(A.dia("web", hoy)[web[0].correo] === "presente", "Recupera la asistencia del día");
const p = A.porAlumno("web", "ana.gomez@ejemplo.com");
ok(p.total === 9 && p.pct === Math.round((p.presente + p.tarde) / 9 * 100), "Porcentaje: presente y tarde cuentan como asistidas");
ok(A.enviarReporte("diseno", hoy, "Lucía") === null, "No se envía reporte sin asistencia guardada");
const rep = A.enviarReporte("web", hoy, "Lucía");
ok(rep && rep.resumen.falta === 1 && A.reportes()[0].id === rep.id, "El reporte llega a Administración");
A.enviarReporte("web", hoy, "Lucía");
ok(A.reportes(20).filter(x => x.curso === "web" && x.fecha === hoy).length === 1, "Reenviar actualiza el reporte, no lo duplica");

// ---- Modo demostración y mantenimiento ----
A.setDemo(false);
ok(A.conteos().total === 2 && A.matriculados("web").length === 0, "Sin modo demostración solo quedan las solicitudes reales");
A.setDemo(true);
ok(A.conteos().total === 14, "Al reactivarlo vuelven los ejemplos y se conservan las reales");
A.vaciarTodo();
ok(A.conteos().total === 0 && A.listar().length === 0, "Borrar todo deja el panel vacío");
ok(A.csvSolicitudes([nueva]).includes("rosa@correo.com"), "Exporta CSV");

// ---- Persistencia ----
{ const e = entorno(); e.A.registrar({ tipo: "matricula", nombre: "Luz", correo: "luz@x.com", programa: "web", codigo: "SOL-P" });
  const txt = e.mem["tp_panel_v1"]; ok(JSON.parse(txt).solicitudes.some(s => s.id === "SOL-P"), "Los datos se guardan en localStorage");
  e.mem["tp_panel_v1"] = "{roto"; e.A.recargar(); ok(e.A.conteos().total === 12, "Datos corruptos: se recrea el almacén sin romperse"); }

// ---- Autenticación / roles ----
// El acceso real ahora se valida exclusivamente en el servidor Node + SQLite.
// Ejecuta `npm run test:n3` para las pruebas de sesión HttpOnly, 403 y privacidad.
console.log("\nTOTAL " + n + " pruebas del almacén local correctas");
