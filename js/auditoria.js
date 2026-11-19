"use strict";
/* Bitácora de auditoría del panel: quién hizo qué y cuándo.
   Se guarda en localStorage; no expone correos, contraseñas ni datos íntimos.
   Contiene solo lógica, sin DOM. */
window.TP_Auditoria = (() => {
  const CLAVE = "tp_auditoria_v1";
  const MAX = 300;

  let memoria = null;
  const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
  const escribir = txt => { try { localStorage.setItem(CLAVE, txt); return true; } catch { return false; } };

  /* Cuatro movimientos de ejemplo para que la bitácora no arranque vacía.
     Quedan ocultos al desactivar el Modo Demostración. */
  function semilla() {
    const ahora = Date.now();
    const hace = minutos => new Date(ahora - minutos * 60000).toISOString();
    return [
      { id: "AUD-DEMO-6", fecha: hace(1440), usuario: "sistema_cron", accion: "Copia de seguridad realizada", detalle: "Respaldo automático del panel", demo: true },
      { id: "AUD-DEMO-5", fecha: hace(420), usuario: "admin", accion: "Registró al docente Ana Torres", detalle: "Especialidad: Diseño UX/UI", demo: true },
      { id: "AUD-DEMO-4", fecha: hace(300), usuario: "admin", accion: "Creó curso JavaScript Avanzado", detalle: "Nuevo programa formativo", demo: true },
      { id: "AUD-DEMO-3", fecha: hace(240), usuario: "admin", accion: "Asignó a Camila Rojas como docente de Diseño gráfico", detalle: "Docente ya registrada", demo: true },
      { id: "AUD-DEMO-2", fecha: hace(120), usuario: "admin", accion: "Modificó horario Frontend", detalle: "Lun/Mié 19:00 → Mar/Jue 19:00", demo: true },
      { id: "AUD-DEMO-1", fecha: hace(35), usuario: "admin", accion: "Aprobó matrícula SOL-2026-0842", detalle: "Estudiante admitido en Desarrollo Web", demo: true }
    ];
  }

  const valido = db => db && db.version === 1 && Array.isArray(db.entradas);

  function db() {
    if (memoria) return memoria;
    let datos = null;
    const txt = leer();
    if (txt) { try { datos = JSON.parse(txt); } catch { datos = null; } }
    if (!valido(datos)) datos = { version: 1, entradas: semilla() };
    memoria = datos;
    persistir();
    return memoria;
  }
  function persistir() { escribir(JSON.stringify(memoria)); }
  function recargar() { memoria = null; return db(); }

  /* El Modo Demostración oculta las entradas de ejemplo, nunca las acciones reales. */
  function demoActivo() {
    try { return !window.TP_Almacen || window.TP_Almacen.demoActivo(); } catch { return true; }
  }
  const visible = e => demoActivo() || !e.demo;

  function registrar({ usuario, accion, detalle = "", demo = false } = {}) {
    const u = String(usuario || "").trim().slice(0, 60);
    const a = String(accion || "").trim().slice(0, 160);
    if (!u || !a) return null;
    const e = {
      id: "AUD-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
      fecha: new Date().toISOString(), usuario: u, accion: a,
      detalle: String(detalle || "").trim().slice(0, 220), demo: !!demo
    };
    const d = db();
    d.entradas.push(e);
    if (d.entradas.length > MAX) d.entradas = d.entradas.slice(-MAX);
    persistir();
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("tp-auditoria"));
    return e;
  }

  function listar(limite = 0) {
    const lista = db().entradas.filter(visible).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return limite > 0 ? lista.slice(0, limite) : lista;
  }
  const ultima = () => listar(1)[0] || null;

  /* Restablecer el modo demostración devuelve la bitácora de ejemplo, pero conserva
     las acciones reales registradas en este navegador. */
  function restablecerDemo() {
    const d = db();
    d.entradas = d.entradas.filter(e => !e.demo).concat(semilla());
    persistir();
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("tp-auditoria"));
  }

  return { CLAVE, semilla, registrar, listar, ultima, recargar, restablecerDemo, demoActivo };
})();
