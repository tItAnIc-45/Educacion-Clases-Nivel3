"use strict";
/* Dashboard del administrador: métricas globales, gestión de cursos y docentes,
   bitácora de auditoría en vivo y exportación de reportes CSV/Excel. */
window.TP_Dashboard = (() => {
  const num = new Intl.NumberFormat("es-PE");
  const pad = n => String(n).padStart(2, "0");
  const aFecha = iso => new Date(iso);
  const fechaCorta = iso => {
    const d = aFecha(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  const fechaCompleta = iso => {
    const d = aFecha(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  const selloArchivo = () => {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  function hace(iso) {
    const ms = Date.now() - aFecha(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "ahora";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "hace unos segundos";
    if (min < 60) return "hace " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "hace " + h + " h";
    const d = Math.floor(h / 24);
    return d === 1 ? "ayer" : "hace " + d + " d";
  }

  const ICONOS = {
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    cursos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    asistencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>',
    aprobacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
    descargar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>'
  };

  let sesion = null;
  let raizMetricas, raizGestion, raizAuditoria, reloj = null;

  const usuarioAuditoria = () => (sesion && (sesion.usuario || sesion.nombre)) || "admin";
  const registrar = (accion, detalle = "") => {
    if (window.TP_Auditoria) TP_Auditoria.registrar({ usuario: usuarioAuditoria(), accion, detalle });
  };

  /* ---------- Métricas ---------- */
  function metricas() {
    const c = TP_Almacen.conteos();
    const aprobadas = TP_Almacen.listar({ estado: "aprobada" });
    const estudiantes = new Set(aprobadas.map(s => s.correo)).size;
    const cursos = TP_GestionCursos.listar();
    const activos = cursos.filter(x => x.activo).length;
    const promedios = cursos.map(x => TP_Almacen.promedioCurso(x.id)).filter(p => p !== null);
    const asistencia = promedios.length ? Math.round(promedios.reduce((a, b) => a + b, 0) / promedios.length) : null;
    const resueltas = c.aprobada + c.rechazada;
    const aprobacion = resueltas ? Math.round(c.aprobada / resueltas * 100) : null;
    return { estudiantes, cursos: activos, totalCursos: cursos.length, asistencia, cursosConDatos: promedios.length, aprobacion, resueltas, resueltasAprobadas: c.aprobada, pendientes: c.pendiente, totalSolicitudes: c.total };
  }

  /* Serie acumulada de matrículas aprobadas en los últimos días (para la minigráfica). */
  function serieAprobaciones(dias = 10) {
    const lista = TP_Almacen.listar({ estado: "aprobada" });
    const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
    const serie = [];
    for (let i = dias - 1; i >= 0; i--) {
      const corte = new Date(hoy); corte.setDate(corte.getDate() - i);
      serie.push(lista.filter(s => aFecha(s.fecha) <= corte).length);
    }
    return serie;
  }

  function chispa(valores) {
    const w = 78, h = 32, margen = 4;
    const max = Math.max(...valores, 1), min = Math.min(...valores, 0);
    const rango = max - min || 1;
    const puntos = valores.map((v, i) => {
      const x = margen + i * (w - margen * 2) / Math.max(valores.length - 1, 1);
      const y = h - margen - (v - min) / rango * (h - margen * 2);
      return [x, y];
    });
    const d = puntos.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const fin = puntos[puntos.length - 1] || [w - margen, h / 2];
    return `<svg class="pn-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/><circle cx="${fin[0].toFixed(1)}" cy="${fin[1].toFixed(1)}" r="2.4"/></svg>`;
  }

  function anillo(pct) {
    if (pct === null) return "";
    const c = 2 * Math.PI * 18;
    const largo = c * Math.max(0, Math.min(100, pct)) / 100;
    return `<svg class="pn-ring" viewBox="0 0 44 44" aria-hidden="true"><circle class="pn-ring-fondo" cx="22" cy="22" r="18"/><circle class="pn-ring-valor" cx="22" cy="22" r="18" stroke-dasharray="${largo.toFixed(1)} ${c.toFixed(1)}"/></svg>`;
  }

  function renderMetricas() {
    if (!raizMetricas) return;
    const m = metricas();
    const tarjetas = [
      {
        etiqueta: "Total Estudiantes", icono: ICONOS.usuarios, valor: num.format(m.estudiantes), sufijo: "",
        pie: "Matriculados vigentes en todos los programas", visual: chispa(serieAprobaciones())
      },
      {
        etiqueta: "Cursos Activos", icono: ICONOS.cursos, valor: num.format(m.cursos), sufijo: "",
        pie: `${m.totalCursos} programas registrados en la plataforma`, visual: `<span class="pn-metrica-glifo">${ICONOS.cursos}</span>`
      },
      {
        etiqueta: "Asistencia Promedio", icono: ICONOS.asistencia, valor: m.asistencia === null ? "—" : num.format(m.asistencia), sufijo: m.asistencia === null ? "" : "%",
        pie: m.cursosConDatos ? `Promedio de ${m.cursosConDatos} cursos con clases registradas` : "Aún no hay clases registradas", visual: anillo(m.asistencia)
      },
      {
        etiqueta: "Tasa de Aprobación", icono: ICONOS.aprobacion, valor: m.aprobacion === null ? "—" : num.format(m.aprobacion), sufijo: m.aprobacion === null ? "" : "%",
        pie: m.resueltas ? `Sobre ${m.resueltas} solicitudes resueltas` : "Sin solicitudes resueltas", visual: `<span class="pn-metrica-flecha">${ICONOS.aprobacion}</span>`
      }
    ];
    raizMetricas.innerHTML = tarjetas.map(t => `
<article class="pn-metrica" aria-label="${esc(t.etiqueta)}: ${esc(t.valor + t.sufijo)}">
  <div class="pn-metrica-cab"><span class="pn-metrica-ico">${t.icono}</span><span>${esc(t.etiqueta)}</span></div>
  <div class="pn-metrica-cuerpo"><strong>${esc(t.valor)}${t.sufijo ? `<small>${t.sufijo}</small>` : ""}</strong>${t.visual}</div>
  <p class="pn-metrica-pie">${esc(t.pie)}</p>
</article>`).join("");
  }

  /* ---------- Gestión de cursos ---------- */
  function renderGestion() {
    if (!raizGestion) return;
    const cursos = TP_GestionCursos.listar();
    const activos = cursos.filter(c => c.activo).length;
    const docentes = TP_GestionCursos.docentes().length;
    raizGestion.innerHTML = `
<header class="pn-gc-cab">
  <div>
    <h2 class="pn-card-t" id="gc-t">Gestión de Cursos y Docentes</h2>
    <p class="pn-card-s">${activos} cursos activos · ${docentes} docentes registrados</p>
  </div>
</header>
<div class="pn-gc-acciones" role="group" aria-label="Acciones de gestión académica">
  <button type="button" class="pn-btn principal" data-accion="nuevo">+ Crear Curso</button>
  <button type="button" class="pn-btn" data-accion="horarios">Asignar Horarios</button>
  <button type="button" class="pn-btn" data-accion="docente">+ Docente</button>
</div>
${cursos.length ? `<ul class="pn-gc-lista" aria-label="Cursos, docentes y horarios">
${cursos.map(c => `<li class="pn-gc-item">
  <div class="pn-gc-curso">
    <b>${esc(c.nombre)}${c.activo ? "" : ' <span class="pn-gc-off">Pausado</span>'}</b>
    <small>Docente: ${esc(c.docente)}</small>
  </div>
  <div class="pn-gc-hor">
    <small>Horario</small>
    <b>${esc(c.dias)} ${esc(c.hora)}</b>
  </div>
  <button type="button" class="pn-btn peque" data-editar="${esc(c.id)}" aria-label="Editar ${esc(c.nombre)}">Editar</button>
</li>`).join("")}
</ul>` : `<div class="pn-vacio"><b>Todavía no hay cursos</b>Crea el primer programa formativo con el botón «Crear Curso».</div>`}`;
  }

  /* La asistencia debe conocer los cursos nuevos sin recargar la página. */
  function sincronizarAsistencia() {
    const sel = $("#as-curso");
    if (!sel) return;
    const opciones = [...sel.options];
    for (const c of TP_GestionCursos.listar({ soloActivos: true })) {
      const op = opciones.find(o => o.value === c.id);
      if (!op) sel.append(new Option(c.nombre, c.id));
      else if (op.textContent !== c.nombre) op.textContent = c.nombre;
    }
  }

  /* ---------- Auditoría ---------- */
  function renderAuditoria() {
    if (!raizAuditoria) return;
    const todas = TP_Auditoria.listar();
    const lista = todas.slice(0, 6);
    raizAuditoria.innerHTML = `
<header class="pn-aud-cab">
  <h2 class="pn-card-t" id="aud-t">Registro de Auditoría</h2>
  <div class="pn-aud-estado"><span class="pn-live"><i aria-hidden="true"></i>En vivo</span><small id="aud-hace"></small></div>
</header>
<p class="pn-card-s pn-aud-s">Quién ejecutó cada acción y a qué hora, sin datos sensibles.</p>
${lista.length ? `<div class="pn-tabla-cont" tabindex="0" role="region" aria-label="Últimos movimientos de auditoría">
  <table class="pn-tabla pn-tabla-aud">
    <thead><tr><th scope="col">Usuario</th><th scope="col">Acción</th><th scope="col">Fecha/Hora</th></tr></thead>
    <tbody>${lista.map(e => `<tr>
      <td><span class="pn-aud-user">${esc(e.usuario)}</span></td>
      <td><div class="pn-aud-accion"><b>${esc(e.accion)}</b>${e.detalle ? `<small>${esc(e.detalle)}</small>` : ""}</div></td>
      <td>${fechaCorta(e.fecha)}</td>
    </tr>`).join("")}</tbody>
  </table>
</div>
<footer class="pn-aud-pie">
  <button type="button" class="pn-link" data-accion="ver-auditoria">Ver bitácora completa</button>
  <span>${todas.length} ${todas.length === 1 ? "movimiento" : "movimientos"} · últimos 6 en pantalla</span>
</footer>` : `<div class="pn-vacio"><b>Sin movimientos registrados</b>Las acciones del panel aparecerán aquí con sello de tiempo.</div>`}`;
    actualizarSello();
  }

  function actualizarSello() {
    const nodo = $("#aud-hace");
    if (!nodo) return;
    const u = TP_Auditoria.ultima();
    nodo.textContent = u ? "Actualizado " + hace(u.fecha) : "Sin movimientos";
  }

  function abrirAuditoriaCompleta() {
    const dlg = TP_Panel.dialogo("pn-aud-dlg");
    const lista = TP_Auditoria.listar();
    dlg.setAttribute("aria-labelledby", "aud-dlg-t");
    dlg.innerHTML = `<div class="pn-dialogo-c">
  <header><div><h3 id="aud-dlg-t">Bitácora de auditoría</h3><small>${lista.length} ${lista.length === 1 ? "movimiento registrado" : "movimientos registrados"} · trazabilidad del panel</small></div></header>
  ${lista.length ? `<div class="pn-tabla-cont pn-aud-scroll" tabindex="0" role="region" aria-label="Bitácora completa">
    <table class="pn-tabla pn-tabla-aud">
      <thead><tr><th scope="col">Fecha/Hora</th><th scope="col">Usuario</th><th scope="col">Acción</th></tr></thead>
      <tbody>${lista.map(e => `<tr>
        <td>${fechaCorta(e.fecha)}</td>
        <td><span class="pn-aud-user">${esc(e.usuario)}</span></td>
        <td><div class="pn-aud-accion"><b>${esc(e.accion)}</b>${e.detalle ? `<small>${esc(e.detalle)}</small>` : ""}</div></td>
      </tr>`).join("")}</tbody>
    </table>
  </div>` : `<div class="pn-vacio"><b>Sin movimientos</b>La bitácora está vacía.</div>`}
  <div class="pn-dialogo-pie">
    <button type="button" class="pn-btn" data-csv>Descargar bitácora (CSV)</button>
    <button type="button" class="pn-btn" data-cerrar>Cerrar</button>
  </div>
</div>`;
    dlg.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.cerrar !== undefined) dlg.close();
      else if (b.dataset.csv !== undefined) descargarBitacora();
    };
    if (!dlg.open) dlg.showModal();
  }

  function descargarBitacora() {
    const lista = TP_Auditoria.listar();
    if (!lista.length) return aviso("No hay movimientos para exportar.");
    const filas = [["Fecha", "Hora", "Usuario", "Acción", "Detalle"]];
    for (const e of lista) {
      const f = fechaCompleta(e.fecha);
      filas.push([f.slice(0, 10), f.slice(11), e.usuario, e.accion, e.detalle]);
    }
    descargar("bitacora-auditoria-" + selloArchivo() + ".csv", "\ufeff" + filas.map(f => f.map(celda).join(",")).join("\r\n"), "text/csv;charset=utf-8");
    aviso("Bitácora exportada en CSV.");
  }

  /* ---------- Formularios de gestión ---------- */
  function abrirCurso(curso = null) {
    const dlg = TP_Panel.dialogo("pn-dlg-curso");
    const editando = !!curso;
    const docentes = TP_GestionCursos.docentes();
    dlg.setAttribute("aria-labelledby", "pn-curso-t");
    dlg.innerHTML = `<form class="pn-form" novalidate>
  <header><h3 id="pn-curso-t">${editando ? "Editar curso" : "Crear curso"}</h3><p>${editando ? "Actualiza el programa, el docente a cargo o su horario." : "Da de alta un programa formativo con su docente y horario."}</p></header>
  <label class="pn-field"><span>Nombre del programa</span><input name="nombre" maxlength="90" required value="${esc(curso?.nombre || "")}" placeholder="Ej. Desarrollo frontend"></label>
  <label class="pn-field"><span>Docente a cargo</span><input name="docente" maxlength="70" required list="pn-docentes-lista" value="${esc(curso?.docente || "")}" placeholder="Nombre del docente">
    <datalist id="pn-docentes-lista">${docentes.map(d => `<option value="${esc(d.nombre)}"></option>`).join("")}</datalist>
  </label>
  <div class="pn-form-fila">
    <label class="pn-field"><span>Días de clase</span><input name="dias" maxlength="40" required value="${esc(curso?.dias || "")}" placeholder="Lun/Mié/Vie"></label>
    <label class="pn-field"><span>Hora</span><input type="time" name="hora" required value="${esc(curso?.hora || "19:00")}"></label>
  </div>
  <label class="pn-field"><span>Aula o modalidad (opcional)</span><input name="aula" maxlength="60" value="${esc(curso?.aula || "")}" placeholder="Aula virtual 1"></label>
  <label class="pn-check"><input type="checkbox" name="activo" ${!curso || curso.activo ? "checked" : ""}> Curso activo</label>
  <p class="pn-form-msg" id="pn-curso-msg" role="alert"></p>
  <div class="pn-form-acciones"><button type="button" class="pn-btn" data-cancelar>Cancelar</button><button type="submit" class="pn-btn principal">${editando ? "Guardar cambios" : "Crear curso"}</button></div>
</form>`;
    const form = dlg.querySelector("form");
    const msg = form.querySelector(".pn-form-msg");
    form.addEventListener("submit", e => {
      e.preventDefault();
      const datos = {
        nombre: form.elements.nombre.value, docente: form.elements.docente.value,
        dias: form.elements.dias.value, hora: form.elements.hora.value,
        aula: form.elements.aula.value, activo: form.elements.activo.checked
      };
      const r = editando ? TP_GestionCursos.actualizar(curso.id, datos) : TP_GestionCursos.crear(datos);
      if (!r.ok) { msg.textContent = r.error; return; }
      if (editando) auditarCambios(r.previo, r.curso);
      else registrar("Creó curso " + r.curso.nombre, `${r.curso.docente} · ${r.curso.dias} ${r.curso.hora}`);
      aviso(editando ? "Curso actualizado." : `Curso «${r.curso.nombre}» creado.`);
      dlg.close();
      renderGestion(); renderMetricas(); sincronizarAsistencia();
    });
    dlg.onclick = e => {
      const b = e.target.closest("button");
      if (b && b.dataset.cancelar !== undefined) dlg.close();
    };
    if (!dlg.open) dlg.showModal();
    form.elements.nombre.focus();
  }

  function auditarCambios(previo, curso) {
    if (previo.nombre !== curso.nombre) registrar(`Renombró el curso ${previo.nombre} a ${curso.nombre}`);
    if (previo.docente !== curso.docente) registrar(`Asignó a ${curso.docente} como docente de ${curso.nombre}`, `Antes: ${previo.docente}`);
    if (previo.dias !== curso.dias || previo.hora !== curso.hora) registrar(`Modificó horario ${curso.nombre}`, `${previo.dias} ${previo.hora} → ${curso.dias} ${curso.hora}`);
    if (previo.aula !== curso.aula) registrar(`Cambió el aula de ${curso.nombre}`, `${previo.aula || "Sin aula"} → ${curso.aula || "Sin aula"}`);
    if (previo.activo !== curso.activo) registrar(`${curso.activo ? "Activó" : "Desactivó"} el curso ${curso.nombre}`);
  }

  function abrirHorarios() {
    const dlg = TP_Panel.dialogo("pn-dlg-horario");
    const cursos = TP_GestionCursos.listar();
    const primero = cursos[0];
    if (!primero) return aviso("Primero crea un curso.");
    dlg.setAttribute("aria-labelledby", "pn-horario-t");
    dlg.innerHTML = `<form class="pn-form" novalidate>
  <header><h3 id="pn-horario-t">Asignar horario</h3><p>Elige un curso y fija sus días y hora de clase.</p></header>
  <label class="pn-field"><span>Curso</span><select name="curso">${cursos.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</select></label>
  <div class="pn-form-fila">
    <label class="pn-field"><span>Días de clase</span><input name="dias" maxlength="40" required value="${esc(primero.dias)}"></label>
    <label class="pn-field"><span>Hora</span><input type="time" name="hora" required value="${esc(primero.hora)}"></label>
  </div>
  <p class="pn-form-msg" id="pn-horario-msg" role="alert"></p>
  <div class="pn-form-acciones"><button type="button" class="pn-btn" data-cancelar>Cancelar</button><button type="submit" class="pn-btn principal">Guardar horario</button></div>
</form>`;
    const form = dlg.querySelector("form");
    const msg = form.querySelector(".pn-form-msg");
    form.elements.curso.addEventListener("change", () => {
      const c = TP_GestionCursos.obtener(form.elements.curso.value);
      if (!c) return;
      form.elements.dias.value = c.dias;
      form.elements.hora.value = c.hora;
      msg.textContent = "";
    });
    form.addEventListener("submit", e => {
      e.preventDefault();
      const c = TP_GestionCursos.obtener(form.elements.curso.value);
      if (!c) { msg.textContent = "El curso ya no existe."; return; }
      const dias = form.elements.dias.value, hora = form.elements.hora.value;
      if (dias === c.dias && hora === c.hora) { msg.textContent = "El horario no cambió."; return; }
      const r = TP_GestionCursos.actualizar(c.id, { dias, hora });
      if (!r.ok) { msg.textContent = r.error; return; }
      registrar(`Modificó horario ${r.curso.nombre}`, `${r.previo.dias} ${r.previo.hora} → ${r.curso.dias} ${r.curso.hora}`);
      aviso("Horario actualizado y registrado en auditoría.");
      dlg.close();
      renderGestion(); renderMetricas(); sincronizarAsistencia();
    });
    dlg.onclick = e => {
      const b = e.target.closest("button");
      if (b && b.dataset.cancelar !== undefined) dlg.close();
    };
    if (!dlg.open) dlg.showModal();
  }

  function abrirDocente() {
    const dlg = TP_Panel.dialogo("pn-dlg-docente");
    dlg.setAttribute("aria-labelledby", "pn-docente-t");
    dlg.innerHTML = `<form class="pn-form" novalidate>
  <header><h3 id="pn-docente-t">Registrar docente</h3><p>Da de alta al docente para asignarlo después a un curso.</p></header>
  <label class="pn-field"><span>Nombre completo</span><input name="nombre" maxlength="70" required placeholder="Ej. Ana Torres"></label>
  <label class="pn-field"><span>Especialidad (opcional)</span><input name="especialidad" maxlength="80" placeholder="Ej. Diseño UX/UI"></label>
  <label class="pn-field"><span>Correo (opcional)</span><input type="email" name="correo" maxlength="90" placeholder="docente@ejemplo.com"></label>
  <p class="pn-form-msg" id="pn-docente-msg" role="alert"></p>
  <div class="pn-form-acciones"><button type="button" class="pn-btn" data-cancelar>Cancelar</button><button type="submit" class="pn-btn principal">Registrar docente</button></div>
</form>`;
    const form = dlg.querySelector("form");
    const msg = form.querySelector(".pn-form-msg");
    form.addEventListener("submit", e => {
      e.preventDefault();
      const r = TP_GestionCursos.crearDocente({
        nombre: form.elements.nombre.value,
        especialidad: form.elements.especialidad.value,
        correo: form.elements.correo.value
      });
      if (!r.ok) { msg.textContent = r.error; return; }
      registrar("Registró al docente " + r.docente.nombre, r.docente.especialidad);
      aviso(`Docente «${r.docente.nombre}» registrado.`);
      dlg.close();
      renderGestion();
    });
    dlg.onclick = e => {
      const b = e.target.closest("button");
      if (b && b.dataset.cancelar !== undefined) dlg.close();
    };
    if (!dlg.open) dlg.showModal();
    form.elements.nombre.focus();
  }

  /* ---------- Exportación ---------- */
  const celda = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const filaXls = (vals, estilo = "") => `<Row>${vals.map(v => `<Cell${estilo ? ` ss:StyleID="${estilo}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`).join("")}</Row>`;
  const hojaXls = (nombre, filas) => `<Worksheet ss:Name="${esc(nombre)}"><Table>${filas.map((f, i) => filaXls(f, i === 0 ? "cab" : "")).join("")}</Table></Worksheet>`;

  function filasReporte() {
    const m = metricas();
    const cursos = TP_GestionCursos.listar();
    const auditoria = TP_Auditoria.listar();
    const solicitudes = TP_Almacen.listar();
    return { m, cursos, auditoria, solicitudes };
  }

  function exportarCSV() {
    const { m, cursos, auditoria, solicitudes } = filasReporte();
    const filas = [];
    const push = (...cols) => filas.push(cols.map(celda).join(","));
    push("REPORTE ACADÉMICO TUPLUSEDUCA");
    push("Generado", fechaCompleta(new Date().toISOString()), "Por", sesion?.nombre || "Administración");
    push("");
    push("MÉTRICAS");
    push("Indicador", "Valor");
    push("Total estudiantes", m.estudiantes);
    push("Cursos activos", m.cursos);
    push("Programas registrados", m.totalCursos);
    push("Asistencia promedio", m.asistencia === null ? "Sin datos" : m.asistencia + "%");
    push("Tasa de aprobación", m.aprobacion === null ? "Sin datos" : m.aprobacion + "%");
    push("Solicitudes pendientes", m.pendientes);
    push("Solicitudes totales", m.totalSolicitudes);
    push("");
    push("CURSOS, DOCENTES Y HORARIOS");
    push("Programa", "Docente", "Días", "Hora", "Aula", "Estado");
    for (const c of cursos) push(c.nombre, c.docente, c.dias, c.hora, c.aula || "", c.activo ? "Activo" : "Pausado");
    push("");
    push("REGISTRO DE AUDITORÍA");
    push("Fecha", "Usuario", "Acción", "Detalle");
    for (const e of auditoria) push(fechaCompleta(e.fecha), e.usuario, e.accion, e.detalle);
    push("");
    push("SOLICITUDES DE INSCRIPCIÓN");
    push("Código", "Tipo", "Nombre", "Correo", "Programa", "Estado", "Fecha");
    for (const s of solicitudes) push(s.id, s.tipo, s.nombre, s.correo, TP_Panel.nombreCurso(s.programa), s.estado, fechaCompleta(s.fecha));
    descargar("reporte-academico-" + selloArchivo() + ".csv", "\ufeff" + filas.join("\r\n"), "text/csv;charset=utf-8");
  }

  function exportarExcel() {
    const { m, cursos, auditoria, solicitudes } = filasReporte();
    const portada = [
      ["REPORTE ACADÉMICO TUPLUSEDUCA"],
      ["Generado", fechaCompleta(new Date().toISOString())],
      ["Usuario", sesion?.nombre || "Administración"],
      ["Modo", TP_Almacen.demoActivo() ? "Demostración" : "Solo datos reales"]
    ];
    const met = [
      ["Indicador", "Valor"],
      ["Total estudiantes", String(m.estudiantes)],
      ["Cursos activos", String(m.cursos)],
      ["Programas registrados", String(m.totalCursos)],
      ["Asistencia promedio", m.asistencia === null ? "Sin datos" : m.asistencia + "%"],
      ["Tasa de aprobación", m.aprobacion === null ? "Sin datos" : m.aprobacion + "%"],
      ["Solicitudes pendientes", String(m.pendientes)],
      ["Solicitudes totales", String(m.totalSolicitudes)]
    ];
    const cur = [["Programa", "Docente", "Días", "Hora", "Aula", "Estado"], ...cursos.map(c => [c.nombre, c.docente, c.dias, c.hora, c.aula || "", c.activo ? "Activo" : "Pausado"])];
    const aud = [["Fecha", "Usuario", "Acción", "Detalle"], ...auditoria.map(e => [fechaCompleta(e.fecha), e.usuario, e.accion, e.detalle])];
    const sol = [["Código", "Tipo", "Nombre", "Correo", "Programa", "Estado", "Fecha"], ...solicitudes.map(s => [s.id, s.tipo, s.nombre, s.correo, TP_Panel.nombreCurso(s.programa), s.estado, fechaCompleta(s.fecha)])];
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="cab"><Font ss:Bold="1" ss:Color="#101820"/><Interior ss:Color="#D4AF37" ss:Pattern="Solid"/></Style></Styles>
${hojaXls("Portada", portada)}
${hojaXls("Métricas", met)}
${hojaXls("Cursos", cur)}
${hojaXls("Auditoría", aud)}
${hojaXls("Solicitudes", sol)}
</Workbook>`;
    descargar("reporte-academico-" + selloArchivo() + ".xls", xml, "application/vnd.ms-excel;charset=utf-8");
  }

  function abrirExportar() {
    const dlg = TP_Panel.dialogo("pn-dlg-exportar");
    const m = metricas();
    dlg.setAttribute("aria-labelledby", "pn-exportar-t");
    dlg.innerHTML = `<div class="pn-dialogo-c">
  <header><div><h3 id="pn-exportar-t">Exportar reporte</h3><small>${m.cursos} cursos · ${m.estudiantes} estudiantes · ${TP_Auditoria.listar().length} movimientos de auditoría</small></div></header>
  <p class="pn-exportar-s">El archivo incluye métricas, cursos con docentes y horarios, la bitácora completa y las solicitudes de inscripción.</p>
  <div class="pn-export-opciones">
    <button type="button" class="pn-export-opcion" data-formato="csv"><span class="pn-export-ico">${ICONOS.descargar}</span><b>Descargar CSV</b><small>Texto separado por comas, compatible con cualquier planilla.</small></button>
    <button type="button" class="pn-export-opcion" data-formato="xls"><span class="pn-export-ico">${ICONOS.descargar}</span><b>Descargar Excel</b><small>Libro .xls con hojas de métricas, cursos, auditoría y solicitudes.</small></button>
  </div>
  <div class="pn-dialogo-pie"><span class="pn-export-nota">No incluye contraseñas ni credenciales.</span><button type="button" class="pn-btn" data-cerrar>Cerrar</button></div>
</div>`;
    dlg.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.cerrar !== undefined) { dlg.close(); return; }
      const formato = b.dataset.formato;
      if (!formato) return;
      if (formato === "csv") exportarCSV(); else exportarExcel();
      registrar("Exportó reporte académico (" + formato.toUpperCase() + ")");
      dlg.close();
      renderAuditoria();
      aviso("Reporte " + formato.toUpperCase() + " descargado.");
    };
    if (!dlg.open) dlg.showModal();
  }

  /* ---------- Montaje e interacción ---------- */
  function renderTodo() {
    renderMetricas();
    renderGestion();
    renderAuditoria();
    sincronizarAsistencia();
  }

  function montar(opciones = {}) {
    sesion = opciones.sesion || TP_Auth.sesion();
    raizMetricas = $("#metricas");
    raizGestion = $("#cursos");
    raizAuditoria = $("#auditoria");
    if (!raizMetricas || !raizGestion || !raizAuditoria) return null;

    renderTodo();

    raizGestion.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.editar) {
        const curso = TP_GestionCursos.obtener(b.dataset.editar);
        if (curso) abrirCurso(curso);
      } else if (b.dataset.accion === "nuevo") abrirCurso();
      else if (b.dataset.accion === "horarios") abrirHorarios();
      else if (b.dataset.accion === "docente") abrirDocente();
    };
    raizAuditoria.onclick = e => {
      const b = e.target.closest("button");
      if (b && b.dataset.accion === "ver-auditoria") abrirAuditoriaCompleta();
    };
    $("#exportar-reporte")?.addEventListener("click", abrirExportar);
    document.addEventListener("tp-datos", () => { renderMetricas(); renderGestion(); renderAuditoria(); sincronizarAsistencia(); });
    document.addEventListener("tp-auditoria", renderAuditoria);
    reloj = setInterval(actualizarSello, 30000);
    return { metricas };
  }

  return { montar, metricas };
})();
