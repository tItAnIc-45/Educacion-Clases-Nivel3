"use strict";
/* Pruebas de la gestión de cursos y de la bitácora de auditoría. Node.js >=18, sin navegador. */
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); console.log("✓", m); n++; };
const leer = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");

function entorno() {
  const mem = {};
  const mk = o => ({ getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } });
  const ctx = {
    window: {}, localStorage: mk(mem), sessionStorage: mk({}), location: { pathname: "/" },
    TextEncoder, DataView, Uint8Array, Uint32Array, Date, Math, JSON, Intl, console
  };
  ctx.window.TP = ctx.TP = { curso: id => ({ id, t: id }) };
  vm.createContext(ctx);
  for (const f of ["almacen.js", "auditoria.js", "gestion-cursos.js"]) vm.runInContext(leer(f), ctx, { filename: f });
  return { A: ctx.window.TP_Almacen, Au: ctx.window.TP_Auditoria, G: ctx.window.TP_GestionCursos, mem };
}

// ---- Gestión de cursos y docentes ----
let { A, Au, G } = entorno();
ok(G.listar().length === 6 && G.ids().length === 6, "Carga seis cursos base activos");
ok(G.nombre("web") === "Desarrollo web", "El curso base conserva el identificador del catálogo");
ok(G.docentes().length === 6, "Registra los docentes de los cursos base");

ok(!G.crear({ nombre: "AB", docente: "Ana Torres", dias: "Lun", hora: "19:00" }).ok, "Rechaza nombres demasiado cortos");
ok(!G.crear({ nombre: "Curso válido", docente: "Ana Torres", dias: "Lun", hora: "25:00" }).ok, "Rechaza horas fuera de rango");
ok(!G.crear({ nombre: "Desarrollo web", docente: "Ana Torres", dias: "Lun", hora: "19:00" }).ok, "Rechaza nombres duplicados");

const nuevo = G.crear({ nombre: "JavaScript Avanzado", docente: "Diego Salazar", dias: "Lun/Mié", hora: "20:00", aula: "Aula 4" });
ok(nuevo.ok && G.listar().length === 7 && nuevo.curso.id === "javascript-avanzado", "Crea un curso nuevo con identificador estable");
ok(G.docentes().some(d => d.nombre === "Diego Salazar"), "Da de alta al docente indicado en el curso");

const editado = G.actualizar("javascript-avanzado", { hora: "21:00" });
ok(editado.ok && editado.previo.hora === "20:00" && editado.curso.hora === "21:00", "Edita el horario y conserva el valor anterior");
ok(!G.actualizar("no-existe", { hora: "10:00" }).ok, "No edita un curso inexistente");
ok(!G.actualizar("javascript-avanzado", { nombre: "Desarrollo web" }).ok, "No permite renombrar a un curso existente");

const doc = G.crearDocente({ nombre: "Ana Torres", especialidad: "Diseño UX/UI", correo: "ana.torres@ejemplo.com" });
ok(doc.ok && G.docentes().some(d => d.nombre === "Ana Torres"), "Registra un docente con especialidad y correo");
ok(!G.crearDocente({ nombre: "Ana Torres" }).ok, "Evita docentes duplicados");
ok(!G.crearDocente({ nombre: "Pedro Ruiz", correo: "correo-mal" }).ok, "Valida el correo del docente");

// ---- Auditoría ----
ok(Au.listar().length === 6, "La bitácora arranca con seis movimientos de ejemplo");
const antes = Au.listar().length;
const e = Au.registrar({ usuario: "admin", accion: "Modificó horario JavaScript Avanzado", detalle: "20:00 → 21:00" });
ok(e && e.demo === false && Au.listar().length === antes + 1, "Registra una acción real con sello de tiempo");
ok(Au.registrar({ usuario: "", accion: "x" }) === null && Au.registrar({ usuario: "admin", accion: "" }) === null, "Rechaza registros sin usuario o acción");
ok(Au.listar(1)[0].accion === "Modificó horario JavaScript Avanzado", "Devuelve primero el movimiento más reciente");

A.setDemo(false);
ok(Au.listar().length === 1 && Au.listar()[0].demo === false, "El modo sin demostración oculta las entradas de ejemplo");
A.setDemo(true);
ok(Au.listar().length === antes + 1, "El modo demostración vuelve a mostrar los ejemplos");

Au.restablecerDemo();
ok(Au.listar().some(x => x.demo) && Au.listar().some(x => x.accion === "Modificó horario JavaScript Avanzado"), "Restablecer demo conserva las acciones reales");

console.log("\nTOTAL " + n + " pruebas correctas");
