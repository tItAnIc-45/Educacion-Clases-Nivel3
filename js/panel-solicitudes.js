"use strict";
/* Tabla interna de solicitudes de inscripción: filtros, búsqueda, paginación,
   botones para cambiar el estado y ficha de detalle. */
window.TP_Solicitudes = (() => {
  const POR_PAGINA = 5;
  const FILTROS = [["", "Todas", "total"], ["pendiente", "Pendientes", "pendiente"], ["aprobada", "Aprobadas", "aprobada"], ["rechazada", "Rechazadas", "rechazada"]];
  const TIPOS = { matricula: "Matrícula", consulta: "Consulta" };

  function montar(raiz, { por = "Administración", auditoriaUsuario = "" } = {}) {
    const est = { estado: "", q: "", pagina: 1 };
    const ficha = TP_Panel.dialogo("pn-ficha");
    let abierta = null;

    /* Botones de estado: el estado actual queda marcado y deshabilitado. */
    function botones(s, chico = true) {
      const b = (estado, texto, clase) => {
        const activo = s.estado === estado;
        return `<button type="button" class="pn-btn ${clase}${chico ? " peque" : ""}" data-id="${esc(s.id)}" data-estado="${estado}" aria-pressed="${activo}" ${activo ? "disabled" : ""}
          aria-label="${texto === "Pendiente" ? "Dejar como pendiente" : texto + " solicitud"} de ${esc(s.nombre)}">${activo ? "✓ " : ""}${texto}</button>`;
      };
      return b("aprobada", "Aprobar", "ok") + b("pendiente", "Pendiente", "pen") + b("rechazada", "Rechazar", "mal");
    }

    function filas(lista) {
      return lista.map(s => `
<tr>
  <td><div class="pn-est">${TP_Panel.avatar(s.nombre)}<div><button type="button" class="pn-link" data-ficha="${esc(s.id)}" aria-label="Ver ficha de ${esc(s.nombre)}" title="Ver ficha">${esc(s.nombre)}</button>
    <small>${TIPOS[s.tipo] || "Solicitud"} · ${TP_Panel.fechaRelativa(s.fecha)}</small></div></div></td>
  <td>${esc(TP_Panel.nombreCurso(s.programa))}</td>
  <td>${TP_Panel.badge(s.estado)}</td>
  <td><div class="pn-acciones">${botones(s)}</div></td>
</tr>`).join("");
    }

    function dibujar() {
      const c = TP_Almacen.conteos();
      const todas = TP_Almacen.listar({ estado: est.estado, q: est.q });
      const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
      est.pagina = Math.min(est.pagina, paginas);
      const ini = (est.pagina - 1) * POR_PAGINA, vista = todas.slice(ini, ini + POR_PAGINA);
      const hayBusqueda = est.q.trim() || est.estado;

      raiz.innerHTML = `
<section class="pn-card" aria-labelledby="sol-t">
  <h3 class="pn-card-t" id="sol-t">Solicitudes de Matrícula Recientes</h3>
  <p class="pn-card-s">Revisa y gestiona las nuevas inscripciones</p>
  <div class="pn-tools">
    <div class="pn-chips" role="group" aria-label="Filtrar por estado">
      ${FILTROS.map(([v, t, k]) => `<button type="button" class="pn-chip" data-filtro="${v}" aria-pressed="${est.estado === v}">${t}<b>${c[k]}</b></button>`).join("")}
    </div>
    <label class="pn-busca"><span class="pn-sr">Buscar solicitud por nombre o correo</span><input type="search" id="sol-q" placeholder="Buscar por nombre o correo" value="${esc(est.q)}" autocomplete="off"></label>
  </div>
  ${vista.length ? `
  <div class="pn-tabla-cont" tabindex="0" role="region" aria-label="Tabla de solicitudes">
    <table class="pn-tabla"><thead><tr><th scope="col">Estudiante</th><th scope="col">Programa</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
    <tbody>${filas(vista)}</tbody></table>
  </div>` : `
  <div class="pn-vacio"><b>${hayBusqueda ? "Ninguna solicitud coincide" : "Todavía no hay solicitudes"}</b>
    ${hayBusqueda ? "Prueba con otro estado o borra la búsqueda." : "Cuando alguien envíe el formulario de matrícula o de contacto del sitio público, aparecerá aquí."}</div>`}
  <div class="pn-tabla-pie">
    <div class="pn-pager">
      <button type="button" class="pn-btn pn-icono" data-pag="-1" aria-label="Página anterior" ${est.pagina <= 1 ? "disabled" : ""}>‹</button>
      <span aria-live="polite">${est.pagina} / ${paginas}</span>
      <button type="button" class="pn-btn pn-icono" data-pag="1" aria-label="Página siguiente" ${est.pagina >= paginas ? "disabled" : ""}>›</button>
    </div>
    <span>Mostrando ${vista.length} de ${todas.length} solicitudes</span>
  </div>
</section>`;
      if (est.foco) { const i = $("#sol-q", raiz); i.focus(); i.setSelectionRange(est.q.length, est.q.length); est.foco = false; }
      if (abierta && ficha.open) pintarFicha(abierta);
    }

    function cambiar(id, estado) {
      const previo = TP_Almacen.obtener(id)?.estado;
      const s = TP_Almacen.cambiarEstado(id, estado, por);
      if (!s) return aviso("No se encontró la solicitud. Recarga la página.");
      const curso = TP_Panel.nombreCurso(s.programa);
      aviso(estado === "aprobada" ? `${s.nombre} quedó matriculado/a en ${curso}.`
        : previo === "aprobada" ? `${s.nombre} ya no figura entre los matriculados de ${curso}.`
        : `Solicitud de ${s.nombre}: ${TP_Panel.etiquetaEstado[estado].toLowerCase()}.`);
      if (previo !== estado && window.TP_Auditoria) {
        const objeto = s.tipo === "matricula" ? "matrícula" : "solicitud";
        const verbo = estado === "aprobada" ? "Aprobó" : estado === "rechazada" ? "Rechazó" : "Dejó pendiente";
        TP_Auditoria.registrar({ usuario: auditoriaUsuario || por, accion: `${verbo} ${objeto} ${s.id}`, detalle: `${s.nombre} · ${curso}`, demo: !!s.demo });
      }
      TP_Panel.avisarCambio(); // vuelve a dibujar esta tabla y los módulos que dependen de los matriculados
    }

    function pintarFicha(id) {
      const s = TP_Almacen.obtener(id);
      if (!s) return;
      abierta = id;
      ficha.setAttribute("aria-labelledby", "ficha-t");
      ficha.innerHTML = `<div class="pn-dialogo-c">
  <header>${TP_Panel.avatar(s.nombre, "grande")}<div><h3 id="ficha-t">${esc(s.nombre)}</h3><small>${TIPOS[s.tipo] || "Solicitud"} recibida ${TP_Panel.fechaHora(s.fecha)}</small></div></header>
  <dl class="pn-dl">
    <dt>Estado</dt><dd>${TP_Panel.badge(s.estado)}</dd>
    <dt>Programa</dt><dd>${esc(TP_Panel.nombreCurso(s.programa))}</dd>
    <dt>Correo</dt><dd><a href="mailto:${esc(s.correo)}">${esc(s.correo)}</a></dd>
    <dt>Código</dt><dd>${esc(s.id)}</dd>
    <dt>Origen</dt><dd>${s.origen === "web" ? "Formulario del sitio público" : "Dato de ejemplo"}</dd>
  </dl>
  <h4>Historial de estados</h4>
  <ul class="pn-hist">${(s.historial || []).length ? s.historial.slice().reverse().map(h => `<li>${TP_Panel.etiquetaEstado[h.estado]} · ${TP_Panel.fechaHora(h.fecha)} · ${esc(h.por)}</li>`).join("") : "<li>Aún sin cambios de estado.</li>"}</ul>
  <div class="pn-dialogo-pie"><div class="pn-acciones">${botones(s, false)}</div><button type="button" class="pn-btn" data-cerrar>Cerrar</button></div>
</div>`;
      if (!ficha.open) ficha.showModal();
    }

    raiz.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.estado) cambiar(b.dataset.id, b.dataset.estado);
      else if (b.dataset.ficha) pintarFicha(b.dataset.ficha);
      else if (b.dataset.filtro !== undefined) { est.estado = b.dataset.filtro; est.pagina = 1; dibujar(); }
      else if (b.dataset.pag) { est.pagina += +b.dataset.pag; dibujar(); }
    });
    let espera;
    raiz.addEventListener("input", e => {
      if (e.target.id !== "sol-q") return;
      clearTimeout(espera);
      espera = setTimeout(() => { est.q = e.target.value; est.pagina = 1; est.foco = true; dibujar(); }, 180);
    });
    ficha.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.cerrar !== undefined) ficha.close();
      else if (b.dataset.estado) cambiar(b.dataset.id, b.dataset.estado);
    });
    ficha.addEventListener("close", () => { abierta = null; });
    document.addEventListener("tp-datos", dibujar);
    dibujar();
    return { dibujar };
  }
  return { montar };
})();
