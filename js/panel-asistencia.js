"use strict";
/* Pase de lista diario: elegir curso y fecha, marcar Presente / Tarde / Falta, guardar y reportar.
   Lo usan el panel del administrador y el del docente. */
window.TP_Asistencia = (() => {
  const MARCAS = [["presente", "Presente"], ["tarde", "Tarde"], ["falta", "Falta"]];
  const RIESGO = 75; // porcentaje mínimo antes de avisar "en riesgo"

  /* opciones: { cursos: [ids], curso, modo: "docente" | "admin", por: "Nombre", alCambiarCurso(id) } */
  function montar(raiz, opciones) {
    const est = { curso: opciones.curso || opciones.cursos[0], fecha: TP_Almacen.hoy(), borradores: new Map(), guardado: null };
    const clave = () => est.curso + "|" + est.fecha;
    const alumnos = () => TP_Almacen.matriculados(est.curso);

    /* El borrador parte de lo guardado y conserva los cambios al cambiar de curso o fecha. */
    function borrador() {
      if (!est.borradores.has(clave())) est.borradores.set(clave(), TP_Almacen.dia(est.curso, est.fecha));
      const b = est.borradores.get(clave());
      const vigentes = new Set(alumnos().map(a => a.correo));
      for (const c of Object.keys(b)) if (!vigentes.has(c)) delete b[c]; // alguien dejó de estar matriculado
      return b;
    }
    const ordenar = o => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    const guardadoVigente = () => {
      const g = TP_Almacen.dia(est.curso, est.fecha), vigentes = new Set(alumnos().map(a => a.correo));
      for (const c of Object.keys(g)) if (!vigentes.has(c)) delete g[c];
      return g;
    };
    const sinGuardar = () => ordenar(borrador()) !== ordenar(guardadoVigente());

    function conteo(b, total) {
      const r = { presente: 0, tarde: 0, falta: 0 };
      for (const m of Object.values(b)) r[m]++;
      return { ...r, sin: total - r.presente - r.tarde - r.falta };
    }

    function dibujar() {
      const lista = alumnos(), b = borrador(), c = conteo(b, lista.length), sucio = sinGuardar();
      const admin = opciones.modo === "admin";
      const filas = lista.map(a => {
        const p = TP_Almacen.porAlumno(est.curso, a.correo);
        const info = p.pct === null ? "Sin clases registradas" : `Asistencia ${p.pct}% · ${p.total} ${p.total === 1 ? "clase" : "clases"}`;
        return `<li class="pn-fila">
  <div class="pn-est">${TP_Panel.avatar(a.nombre)}<div><b>${esc(a.nombre)}</b><small class="pn-pct${p.pct !== null && p.pct < RIESGO ? " riesgo" : ""}">${info}${p.pct !== null && p.pct < RIESGO ? " · En riesgo" : ""}</small></div></div>
  <div class="pn-marcas" role="group" aria-label="Asistencia de ${esc(a.nombre)}">
    ${MARCAS.map(([v, t]) => `<button type="button" class="pn-marca ${v}" data-correo="${esc(a.correo)}" data-marca="${v}" aria-pressed="${b[a.correo] === v}">${t}</button>`).join("")}
  </div>
</li>`;
      }).join("");

      raiz.innerHTML = `
<section class="pn-card" aria-labelledby="as-t">
  <h3 class="pn-card-t" id="as-t">Pase de Asistencia y Seguimiento</h3>
  <p class="pn-card-s">${esc(TP_Panel.fechaLarga(est.fecha))}${est.fecha === TP_Almacen.hoy() ? " (hoy)" : ""}</p>
  <div class="pn-filtro">
    <label class="pn-select"><span>Curso:</span>
      <select id="as-curso">${opciones.cursos.map(id => `<option value="${id}"${id === est.curso ? " selected" : ""}>${esc(TP_Panel.nombreCurso(id))}</option>`).join("")}</select></label>
    <label class="pn-campo pn-fecha"><span class="pn-sr">Fecha de la clase</span><input type="date" id="as-fecha" value="${est.fecha}" max="${TP_Almacen.hoy()}"></label>
  </div>
  ${lista.length ? `
  <div class="pn-resumen">
    <div class="pn-conteo" aria-live="polite"><span><b>${c.presente}</b> presentes</span><span><b>${c.tarde}</b> tarde</span><span><b>${c.falta}</b> faltas</span><span><b>${c.sin}</b> sin marcar</span></div>
    <button type="button" class="pn-btn peque" data-todos ${c.presente === lista.length ? "disabled" : ""}>Marcar todos presentes</button>
  </div>
  <ul class="pn-lista${lista.length > 6 ? " scroll" : ""}">${filas}</ul>
  <div class="pn-pie">
    <button type="button" class="pn-btn principal" data-guardar ${sucio ? "" : "disabled"}>Guardar Asistencia</button>
    <button type="button" class="pn-btn grande" data-reporte>${admin ? "Descargar Reporte" : "Enviar Reporte"}</button>
  </div>
  <p class="pn-nota${sucio ? " sucio" : ""}" role="status">${sucio ? "Hay cambios sin guardar." : est.guardado === clave() ? "Asistencia guardada." : TP_Almacen.resumenDia(est.curso, est.fecha).marcados ? "Asistencia de este día guardada." : "Marca la asistencia de cada alumno y guarda."}</p>` : `
  <div class="pn-vacio"><b>Este curso aún no tiene alumnos matriculados</b>${admin ? "Aprueba solicitudes de este programa en la tabla de la izquierda." : "Cuando administración apruebe solicitudes, tus alumnos aparecerán aquí."}</div>`}
</section>`;
    }

    function guardar() {
      const r = TP_Almacen.guardarAsistencia(est.curso, est.fecha, borrador());
      if (!r) return false;
      est.borradores.delete(clave());
      est.guardado = clave();
      aviso(`Asistencia guardada: ${r.presente} presentes, ${r.tarde} tarde, ${r.falta} faltas` + (r.total - r.marcados ? ` (${r.total - r.marcados} sin marcar).` : "."));
      dibujar();
      return true;
    }

    function reporte() {
      if (sinGuardar() && !guardar()) return;
      const r = TP_Almacen.resumenDia(est.curso, est.fecha);
      if (!r.marcados) return aviso("Marca la asistencia de al menos un alumno antes de generar el reporte.");
      if (opciones.modo === "admin") {
        const marcas = TP_Almacen.dia(est.curso, est.fecha), celda = v => '"' + String(v).replace(/"/g, '""') + '"';
        const nombre = { presente: "Presente", tarde: "Tarde", falta: "Falta" };
        const filas = [["Curso", "Fecha", "Alumno", "Correo", "Asistencia"], ...alumnos().map(a => [TP_Panel.nombreCurso(est.curso), est.fecha, a.nombre, a.correo, nombre[marcas[a.correo]] || "Sin marcar"])];
        descargar(`asistencia-${est.curso}-${est.fecha}.csv`, "\ufeff" + filas.map(f => f.map(celda).join(",")).join("\r\n"), "text/csv;charset=utf-8");
        return aviso("Reporte descargado.");
      }
      TP_Almacen.enviarReporte(est.curso, est.fecha, opciones.por);
      aviso(`Reporte enviado a Administración: ${TP_Panel.nombreCurso(est.curso)}, clase ${TP_Panel.claseDe(est.fecha)}.`);
      TP_Panel.avisarCambio();
    }

    raiz.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.marca) {
        const bor = borrador(), c = b.dataset.correo;
        if (bor[c] === b.dataset.marca) delete bor[c]; else bor[c] = b.dataset.marca; // pulsar de nuevo quita la marca
        const foco = `[data-correo="${CSS.escape(c)}"][data-marca="${b.dataset.marca}"]`;
        dibujar(); $(foco, raiz)?.focus();
      } else if (b.dataset.todos !== undefined) {
        const bor = borrador(); alumnos().forEach(a => { bor[a.correo] = "presente"; }); dibujar();
      } else if (b.dataset.guardar !== undefined) guardar();
      else if (b.dataset.reporte !== undefined) reporte();
    });
    raiz.addEventListener("change", e => {
      if (e.target.id === "as-curso") { est.curso = e.target.value; opciones.alCambiarCurso?.(est.curso); dibujar(); $("#as-curso", raiz).focus(); }
      else if (e.target.id === "as-fecha") {
        const f = e.target.value;
        if (!TP_Almacen.fechaValida(f) || f > TP_Almacen.hoy()) { aviso("Elige una fecha válida que no sea futura."); return dibujar(); }
        est.fecha = f; dibujar(); $("#as-fecha", raiz).focus();
      }
    });
    document.addEventListener("tp-datos", dibujar);
    dibujar();
    return { fijarCurso(id) { if (opciones.cursos.includes(id) && id !== est.curso) { est.curso = id; dibujar(); } }, curso: () => est.curso };
  }
  return { montar, RIESGO };
})();
