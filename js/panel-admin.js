"use strict";
/* Panel del administrador: solicitudes de inscripción y supervisión de asistencia. */
(() => {
  const sesion = TP_Auth.sesion();
  if (!sesion) return;
  TP_Panel.cabecera(sesion);

  TP_Solicitudes.montar($("#sol"), { por: sesion.nombre, auditoriaUsuario: sesion.usuario });
  TP_Asistencia.montar($("#asist"), { cursos: TP_GestionCursos.ids(), modo: "admin", por: sesion.nombre });
  TP_Dashboard.montar({ sesion });

  /* Reportes que envían los docentes */
  const caja = $("#reportes");
  function reportes() {
    const lista = TP_Almacen.reportes(5);
    caja.innerHTML = `<h3 class="pn-card-t">Reportes de asistencia recibidos</h3>
<p class="pn-card-s">Los docentes los envían desde su panel.</p>
${lista.length ? `<ul class="pn-reportes">${lista.map(r => `<li><span><b>${esc(TP_Panel.nombreCurso(r.curso))}</b><small>${esc(r.por)} · clase ${TP_Panel.claseDe(r.fecha)} · enviado ${TP_Panel.fechaHora(r.enviado)}</small></span>
<span class="pn-tipo">${r.resumen.presente} pres. · ${r.resumen.tarde} tarde · ${r.resumen.falta} falta${r.resumen.falta === 1 ? "" : "s"}</span></li>`).join("")}</ul>`
      : `<div class="pn-vacio"><b>Aún no hay reportes</b>Aparecerán cuando un docente use «Enviar Reporte».</div>`}`;
  }
  document.addEventListener("tp-datos", reportes);
  reportes();

  /* Mantenimiento de datos */
  $("#exportar").addEventListener("click", () => {
    const lista = TP_Almacen.listar();
    if (!lista.length) return aviso("No hay solicitudes para exportar.");
    descargar("solicitudes-tupluseduca.csv", TP_Almacen.csvSolicitudes(lista), "text/csv;charset=utf-8");
    aviso(`Se exportaron ${lista.length} solicitudes.`);
  });
  $("#restablecer").addEventListener("click", () => {
    if (!confirm("Se restaurarán los datos de ejemplo. Las solicitudes reales del sitio no se tocan. ¿Continuar?")) return;
    TP_Almacen.setDemo(true);
    TP_Almacen.restablecerDemo();
    TP_Auditoria.restablecerDemo();
    $("#demo")?.setAttribute("aria-pressed", "true");
    aviso("Datos de ejemplo restablecidos.");
    TP_Panel.avisarCambio();
  });
  $("#vaciar").addEventListener("click", () => {
    if (!confirm("Se borrarán TODAS las solicitudes, asistencias y reportes guardados en este navegador. Esta acción no se puede deshacer. ¿Continuar?")) return;
    TP_Almacen.vaciarTodo();
    aviso("Se borraron todas las solicitudes.");
    TP_Panel.avisarCambio();
  });
})();
