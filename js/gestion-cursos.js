"use strict";
/* Gestión académica del panel: programas, docentes y horarios.
   Los cursos base enlazan con los identificadores del catálogo (web, diseno…),
   así la asistencia y las matrículas siguen funcionando. Los cursos nuevos se
   guardan solo en este navegador y quedan disponibles para el panel.
   Contiene solo lógica, sin DOM. */
window.TP_GestionCursos = (() => {
  const CLAVE = "tp_gestion_v1";

  const BASE = [
    { id: "web", nombre: "Desarrollo web", docente: "Lucía Paredes", dias: "Lun/Mié/Vie", hora: "19:00", aula: "Aula virtual 1", activo: true },
    { id: "datos", nombre: "Excel y análisis de datos", docente: "Andrea Quispe", dias: "Lun/Mié", hora: "20:00", aula: "Aula virtual 2", activo: true },
    { id: "diseno", nombre: "Diseño gráfico", docente: "Camila Rojas", dias: "Mar/Jue", hora: "19:00", aula: "Aula virtual 1", activo: true },
    { id: "video", nombre: "Edición de video", docente: "Sebastián Ortega", dias: "Mar/Jue", hora: "18:00", aula: "Aula virtual 3", activo: true },
    { id: "marketing", nombre: "Marketing digital", docente: "Gabriela Linares", dias: "Sáb", hora: "09:00", aula: "Aula virtual 2", activo: true },
    { id: "emprende", nombre: "Emprendimiento", docente: "Patricia Núñez", dias: "Sáb", hora: "11:00", aula: "Aula virtual 3", activo: true }
  ];

  let memoria = null;
  const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
  const escribir = txt => { try { localStorage.setItem(CLAVE, txt); return true; } catch { return false; } };
  const normal = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const limpio = s => String(s || "").replace(/\s+/g, " ").trim();

  function docentesIniciales() {
    const vistos = new Set();
    const lista = [];
    for (const c of BASE) {
      if (vistos.has(normal(c.docente))) continue;
      vistos.add(normal(c.docente));
      lista.push({ id: "DOC-" + (lista.length + 1), nombre: c.docente, especialidad: "", correo: "" });
    }
    return lista;
  }

  function sembrar() {
    return { version: 1, cursos: BASE.map(c => ({ ...c, demo: true })), docentes: docentesIniciales() };
  }
  const valido = db => db && db.version === 1 && Array.isArray(db.cursos) && Array.isArray(db.docentes);

  function db() {
    if (memoria) return memoria;
    let datos = null;
    const txt = leer();
    if (txt) { try { datos = JSON.parse(txt); } catch { datos = null; } }
    if (!valido(datos)) datos = sembrar();
    memoria = datos;
    persistir();
    return memoria;
  }
  function persistir() { escribir(JSON.stringify(memoria)); }
  function recargar() { memoria = null; return db(); }

  const listar = ({ soloActivos = false } = {}) => db().cursos.filter(c => !soloActivos || c.activo);
  const obtener = id => db().cursos.find(c => c.id === id) || null;
  const nombre = id => {
    const c = obtener(id);
    if (c) return c.nombre;
    return (window.TP && TP.curso && TP.curso(id)?.t) || id;
  };
  const ids = () => listar({ soloActivos: true }).map(c => c.id);
  const docentes = () => db().docentes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  function horaValida(h) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h || "")); }
  function diasValidos(d) {
    const t = limpio(d);
    return t.length >= 2 && t.length <= 40 && /^[a-záéíóúüñ0-9\s/\-,.]+$/i.test(t);
  }
  const correoOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validar({ nombre: n, docente, dias, hora }, id = "") {
    const nombreC = limpio(n), docenteC = limpio(docente);
    if (nombreC.length < 3 || nombreC.length > 90) return "El nombre del programa debe tener entre 3 y 90 caracteres.";
    if (docenteC.length < 3 || docenteC.length > 70) return "Indica el docente a cargo (entre 3 y 70 caracteres).";
    if (!diasValidos(dias)) return "Indica los días de clase, por ejemplo Lun/Mié/Vie.";
    if (!horaValida(hora)) return "Indica una hora válida en formato HH:MM.";
    const repetido = db().cursos.find(c => c.id !== id && normal(c.nombre) === normal(nombreC));
    if (repetido) return "Ya existe un curso con ese nombre.";
    return "";
  }

  function asegurarDocente(nombreDocente, especialidad = "", correo = "") {
    const d = db();
    const n = limpio(nombreDocente);
    if (!n) return null;
    let doc = d.docentes.find(x => normal(x.nombre) === normal(n));
    if (!doc) {
      doc = { id: "DOC-" + Date.now().toString(36).toUpperCase(), nombre: n, especialidad: limpio(especialidad), correo: normal(correo) };
      d.docentes.push(doc);
    } else if (especialidad && !doc.especialidad) doc.especialidad = limpio(especialidad);
    return doc;
  }

  function crear({ nombre: n, docente, dias, hora, aula = "", activo = true } = {}) {
    const error = validar({ nombre: n, docente, dias, hora });
    if (error) return { ok: false, error };
    const d = db();
    const base = normal(limpio(n)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "curso";
    let id = base, i = 2;
    while (d.cursos.some(c => c.id === id)) id = base + "-" + i++;
    const curso = {
      id, nombre: limpio(n), docente: limpio(docente), dias: limpio(dias), hora: String(hora),
      aula: limpio(aula), activo: !!activo, demo: false
    };
    d.cursos.push(curso);
    asegurarDocente(curso.docente);
    persistir();
    return { ok: true, curso };
  }

  function actualizar(id, cambios = {}) {
    const d = db();
    const curso = d.cursos.find(c => c.id === id);
    if (!curso) return { ok: false, error: "El curso ya no existe." };
    const previo = { ...curso };
    const siguiente = {
      ...curso,
      nombre: cambios.nombre !== undefined ? limpio(cambios.nombre) : curso.nombre,
      docente: cambios.docente !== undefined ? limpio(cambios.docente) : curso.docente,
      dias: cambios.dias !== undefined ? limpio(cambios.dias) : curso.dias,
      hora: cambios.hora !== undefined ? String(cambios.hora) : curso.hora,
      aula: cambios.aula !== undefined ? limpio(cambios.aula) : curso.aula,
      activo: cambios.activo !== undefined ? !!cambios.activo : curso.activo
    };
    const error = validar(siguiente, id);
    if (error) return { ok: false, error };
    Object.assign(curso, siguiente, { demo: curso.demo });
    asegurarDocente(curso.docente);
    persistir();
    return { ok: true, curso, previo };
  }

  function crearDocente({ nombre: n, especialidad = "", correo = "" } = {}) {
    const nombreDocente = limpio(n);
    if (nombreDocente.length < 3 || nombreDocente.length > 70) return { ok: false, error: "El nombre del docente debe tener entre 3 y 70 caracteres." };
    const c = normal(correo);
    if (c && !correoOk.test(c)) return { ok: false, error: "El correo del docente no tiene un formato válido." };
    const d = db();
    if (d.docentes.some(x => normal(x.nombre) === normal(nombreDocente))) return { ok: false, error: "Ese docente ya está registrado." };
    const docente = { id: "DOC-" + Date.now().toString(36).toUpperCase(), nombre: nombreDocente, especialidad: limpio(especialidad), correo: c };
    d.docentes.push(docente);
    persistir();
    return { ok: true, docente };
  }

  return { CLAVE, BASE, listar, obtener, nombre, ids, docentes, crear, actualizar, crearDocente, recargar, horaValida, diasValidos };
})();
