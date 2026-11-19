"use strict";
/* Estructura común de los paneles: cabecera según el rol, tema, modo demostración y utilidades de interfaz. */
window.TP_Panel = (() => {
  const NAV = {
    admin: { etiqueta: "Panel Admin", url: "pages/panel-admin.html" },
    docente: { etiqueta: "Panel Docente", url: "pages/panel-docente.html" },
    alumno: { etiqueta: "Mi Espacio", url: "pages/panel-alumno.html" }
  };
  const mesCorto = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" });
  const hora = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  const largo = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" });

  const iniciales = n => String(n).trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const tono = n => { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const avatar = (nombre, extra = "") => `<span class="pn-av ${extra}" style="--h:${tono(nombre)}" aria-hidden="true">${esc(iniciales(nombre))}</span>`;

  const aFecha = iso => new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  function fechaRelativa(iso) {
    const d = aFecha(iso), h = new Date();
    const dias = Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : mesCorto.format(d);
  }
  /* «de hoy», «de ayer» o «del 5 nov» */
  const claseDe = iso => { const r = fechaRelativa(iso); return r === "Hoy" || r === "Ayer" ? "de " + r.toLowerCase() : "del " + r; };
  const fechaHora = iso => mesCorto.format(aFecha(iso)) + ", " + hora.format(aFecha(iso));
  const fechaLarga = iso => { const t = largo.format(aFecha(iso)); return t[0].toUpperCase() + t.slice(1); };
  const nombreCurso = id => (window.TP_GestionCursos && TP_GestionCursos.nombre(id)) || (TP.curso(id) || { t: id }).t;
  const etiquetaEstado = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" };
  const badge = e => `<span class="pn-badge ${e}">${etiquetaEstado[e]}</span>`;

  function cabecera(sesion) {
    const nav = NAV[sesion.rol];
    const enlaces = [
      ["Inicio", "index.html", false], ["Programas", "pages/programas.html", false]
    ];
    if (sesion.rol === "admin") enlaces.push(["Métricas", "#metricas", false], ["Auditoría", "#auditoria", false]);
    else enlaces.push(["Test", "pages/test.html", false]);
    enlaces.push([nav.etiqueta, nav.url, true]);
    const menuHTML = enlaces
      .map(([t, u, act]) => `<a href="${u.startsWith("#") ? u : ruta(u)}"${act ? ' class="activo" aria-current="page"' : ""}>${t}</a>`).join("");
    document.body.insertAdjacentHTML("afterbegin", `
<header class="header" id="header">
  <a href="${ruta("index.html")}" class="logo"><img class="colibri" src="${ruta("assets/colibri-mini.png")}" alt="" aria-hidden="true">TUPLUS<b>EDUCA</b></a>
  <nav id="menu" aria-label="Principal">${menuHTML}</nav>
  <div class="acciones">
    <div class="pn-usuario">${avatar(sesion.nombre)}<div><b>${esc(sesion.nombre)}</b><small>${TP_Auth.ETIQUETAS[sesion.rol]}</small></div></div>
    <button type="button" class="pn-salir" id="salir">Cerrar Sesión</button>
    ${sesion.rol === "admin" ? `<button type="button" class="demo-pill" id="demo" aria-pressed="false" title="Muestra u oculta los datos de ejemplo del panel"><i aria-hidden="true"></i><span>Modo Demostración</span></button>` : ""}
    <button id="tema" class="icono" aria-label="Cambiar tema">☾</button>
    <button id="hamburguesa" class="icono" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu">☰</button>
  </div>
</header>`);

    const raizDoc = document.documentElement, btnTema = $("#tema");
    const pintarTema = () => {
      const claro = raizDoc.dataset.tema === "claro";
      btnTema.textContent = claro ? "☀" : "☾";
      btnTema.setAttribute("aria-label", claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
    };
    btnTema.addEventListener("click", () => {
      raizDoc.dataset.tema = raizDoc.dataset.tema === "claro" ? "oscuro" : "claro";
      seguro(() => localStorage.setItem("tema", raizDoc.dataset.tema));
      pintarTema();
    });
    pintarTema();
    const color = seguro(() => localStorage.getItem("acento"));
    if (color) { const p = { "#35b8a0": "#7fe0cc", "#e0749b": "#f5a3bf", "#6fa8ff": "#a9ccff" }[color]; if (p) { raizDoc.style.setProperty("--dorado", color); raizDoc.style.setProperty("--dorado2", p); } }

    const menu = $("#menu"), ham = $("#hamburguesa");
    const abrir = v => { menu.classList.toggle("abierto", v); ham.setAttribute("aria-expanded", v); ham.textContent = v ? "✕" : "☰"; };
    ham.addEventListener("click", () => abrir(!menu.classList.contains("abierto")));
    document.addEventListener("keydown", e => { if (e.key === "Escape") abrir(false); });

    $("#salir").addEventListener("click", async () => { const b=$("#salir"); b.disabled=true; try { await TP_Auth.salir(); if(window.TP?.ir) TP.ir(ruta("pages/login.html?motivo=salida")); else location.href=ruta("pages/login.html?motivo=salida"); } catch { b.disabled=false; aviso("No se pudo cerrar la sesión. Intenta nuevamente."); } });

    const demo = $("#demo");
    if (!demo || !window.TP_Almacen) return;
    demo.setAttribute("aria-pressed", TP_Almacen.demoActivo());
    demo.addEventListener("click", () => {
      const v = !TP_Almacen.demoActivo();
      TP_Almacen.setDemo(v);
      demo.setAttribute("aria-pressed", v);
      aviso(v ? "Modo demostración activado: se muestran los datos de ejemplo." : "Modo demostración desactivado: solo verás solicitudes reales.");
      avisarCambio();
    });
  }

  /* Los módulos se vuelven a dibujar cuando cambian los datos (aquí o en otra pestaña). */
  function avisarCambio() { document.dispatchEvent(new CustomEvent("tp-datos")); }
  window.addEventListener("storage", e => {
    if (window.TP_Almacen && (e.key === TP_Almacen.CLAVE || e.key === "tp_panel_demo")) { TP_Almacen.recargar(); avisarCambio(); $("#demo")?.setAttribute("aria-pressed", TP_Almacen.demoActivo()); }
    if (window.TP_Auditoria && e.key === TP_Auditoria.CLAVE) {
      TP_Auditoria.recargar();
      document.dispatchEvent(new CustomEvent("tp-auditoria"));
    }
    if (window.TP_GestionCursos && e.key === TP_GestionCursos.CLAVE) {
      TP_GestionCursos.recargar();
      avisarCambio();
    }
  });

  /* Ventana modal reutilizable (<dialog>). */
  function dialogo(id) {
    let d = document.getElementById(id);
    if (!d) {
      d = document.createElement("dialog");
      d.id = id; d.className = "pn-dialogo";
      d.addEventListener("click", e => { if (e.target === d) d.close(); });
      document.body.append(d);
    }
    return d;
  }

  return { cabecera, avatar, fechaRelativa, claseDe, fechaHora, fechaLarga, nombreCurso, badge, etiquetaEstado, avisarCambio, dialogo, aFecha };
})();
