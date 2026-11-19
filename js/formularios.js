"use strict";
/* Validación, entrega real y estado accesible para las consultas y matrículas. */
window.TP_Formularios = (() => {
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const endpointPermitido = url => typeof url === "string" && /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(url.trim());

  function iniciar(tipo) {
    const form = document.getElementById("formulario");
    if (!form || form.dataset.tipo !== tipo) return;
    const campos = ["nombre", "correo", "programa", ...(tipo === "matricula" ? ["acepta"] : [])].map(id => document.getElementById(id));
    const programa = document.getElementById("programa");
    const boton = form.querySelector('button[type="submit"]');
    // Reutilizamos el estilo de aviso flotante de la plantilla, sin ocupar espacio bajo el formulario.
    // Se crea solo en las páginas con formularios, dejando intactos los demás avisos del sitio.
    const notificacion = document.createElement("div");
    notificacion.id = "toast-formulario";
    notificacion.className = "notificacion-formulario";
    notificacion.hidden = true;
    notificacion.setAttribute("role", "status");
    notificacion.setAttribute("aria-live", "polite");
    notificacion.setAttribute("aria-atomic", "true");

    const textoNotificacion = document.createElement("span");
    textoNotificacion.className = "notificacion-texto";
    const reintentar = document.createElement("button");
    reintentar.type = "button";
    reintentar.className = "notificacion-reintentar";
    reintentar.textContent = "Reintentar";
    reintentar.hidden = true;
    const cerrarNotificacion = document.createElement("button");
    cerrarNotificacion.type = "button";
    cerrarNotificacion.className = "notificacion-cerrar";
    cerrarNotificacion.textContent = "×";
    cerrarNotificacion.setAttribute("aria-label", "Cerrar notificación");
    notificacion.append(textoNotificacion, reintentar, cerrarNotificacion);
    document.body.append(notificacion);
    const textoOriginal = boton.textContent;
    let enviando = false;
    let codigoPendiente = "";
    let firmaPendiente = "";
    let temporizadorNotificacion;

    programa.insertAdjacentHTML("beforeend", TP.CURSOS.map(c => `<option value="${esc(c.id)}">${esc(c.t)}</option>`).join(""));
    const elegido = TP.curso(params.get("programa"));
    if (elegido) programa.value = elegido.id;

    function mensajeCampo(c) {
      const valor = c.value.trim();
      switch(c.id) {
        case "nombre":
          return !valor ? "Escribe tu nombre completo." : valor.length < 3 ? "El nombre debe tener al menos 3 caracteres." : "";
        case "correo":
          return !valor ? "Escribe tu correo electrónico." : !correoValido.test(valor) || valor.length > 254 ? "Escribe un correo válido, por ejemplo nombre@correo.com." : "";
        case "programa": return !TP.curso(valor) ? "Elige un programa." : "";
        case "acepta": return !c.checked ? "Debes autorizar el envío de tu solicitud." : "";
        default: return "";
      }
    }
    function validar(c) {
      const mensaje = mensajeCampo(c);
      document.getElementById("error-" + c.id).textContent = mensaje;
      if (mensaje) c.setAttribute("aria-invalid", "true"); else c.removeAttribute("aria-invalid");
      return mensaje === "";
    }
    function validarTodo() {
      const r = campos.map(validar); // todos los errores, no solo el primero
      const primero = r.indexOf(false);
      if (primero !== -1) campos[primero].focus();
      return primero === -1;
    }
    function limpiarEstado() {
      clearTimeout(temporizadorNotificacion);
      notificacion.hidden = true;
      notificacion.classList.remove("visible");
      notificacion.removeAttribute("data-estado");
      textoNotificacion.textContent = "";
      reintentar.hidden = true;
    }
    function mostrarEstado(texto, variante, retry = false) {
      clearTimeout(temporizadorNotificacion);
      textoNotificacion.textContent = texto;
      notificacion.dataset.estado = variante;
      notificacion.setAttribute("role", variante === "error" ? "alert" : "status");
      notificacion.setAttribute("aria-live", variante === "error" ? "assertive" : "polite");
      reintentar.hidden = !retry;
      notificacion.hidden = false;
      notificacion.classList.add("visible");
      // Los fallos permanecen visibles para permitir el reintento.
      // Una confirmación con código se muestra durante más tiempo que un aviso normal.
      if (variante === "exito") temporizadorNotificacion = setTimeout(limpiarEstado, 14000);
      if (retry) reintentar.focus({ preventScroll: true });
    }
    cerrarNotificacion.addEventListener("click", () => {
      limpiarEstado();
      boton.focus({ preventScroll: true });
    });
    function huella() {
      return JSON.stringify({
        nombre: campos[0].value.trim(), correo: campos[1].value.trim(),
        programa: programa.value,
        acepta: tipo !== "matricula" || document.getElementById("acepta").checked
      });
    }
    function codigoNuevo() {
      if (!window.crypto?.getRandomValues) throw Error("No disponible");
      const bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      return (tipo === "matricula" ? "SOL" : "CON") + "-" + new Date().getFullYear() + "-" +
        Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("").toUpperCase();
    }
    function bloquear(estado) {
      enviando = estado;
      form.setAttribute("aria-busy", String(estado));
      campos.forEach(c => { c.disabled = estado; });
      boton.disabled = estado;
      reintentar.disabled = estado;
      boton.textContent = estado ? "Enviando…" : textoOriginal;
    }
    async function enviar() {
      if (enviando) return;
      limpiarEstado();
      if (!validarTodo()) return;
      const config = window.TP_FORMULARIOS_CONFIG || {};
      const endpoint = config[tipo];
      if (!endpointPermitido(endpoint)) {
        mostrarEstado("El formulario no está disponible en este momento. Intenta más tarde.", "error");
        return;
      }
      const firma = huella();
      if (!codigoPendiente || firmaPendiente !== firma) {
        try { codigoPendiente = codigoNuevo(); }
        catch { mostrarEstado("No se pudo preparar el envío. Prueba con un navegador actualizado.", "error"); return; }
        firmaPendiente = firma;
      }
      const datos = new FormData();
      datos.set("nombre", campos[0].value.trim());
      datos.set("email", campos[1].value.trim());
      datos.set("programa", TP.curso(programa.value).t);
      datos.set("programa_id", programa.value);
      datos.set("tipo_solicitud", tipo === "matricula" ? "solicitud_matricula" : "consulta_informacion");
      datos.set("codigo_solicitud", codigoPendiente);
      datos.set("_subject", (tipo === "matricula" ? "Solicitud de matrícula " : "Consulta de programa ") + codigoPendiente);
      if (tipo === "matricula") {
        datos.set("aceptacion", "Autorizó envío de datos para gestionar esta solicitud");
        datos.set("alcance", "Solicitud recibida; matrícula/cupo pendiente de confirmación");
      }

      const cancelador = new AbortController();
      const timeout = setTimeout(() => cancelador.abort(), 15000);
      bloquear(true);
      // La espera se indica en el botón, sin añadir avisos debajo del formulario.
      try {
        // Con el servidor N3, Matrícula se entrega a Formspree a través
        // del servidor y se guarda en SQLite SOLO después de su confirmación.
        // En una vista estática N2 se conserva el envío directo original.
        const entregaIntegrada = tipo === "matricula" && window.TP_N3_SERVER === true;
        const res = await fetch(entregaIntegrada ? "/api/public/matricula" : endpoint.trim(), entregaIntegrada ? {
          method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(datos.entries())), signal: cancelador.signal
        } : {
          method: "POST", body: datos, headers: { Accept: "application/json" }, signal: cancelador.signal
        });
        let respuesta = null;
        try { respuesta = await res.json(); } catch { /* respuesta inválida = sin confirmación */ }
        if (!res.ok || respuesta?.ok !== true) {
          const status = res.status;
          const esConfig = [401,403,404].includes(status);
          const msg = status === 429 ? "Hay demasiadas solicitudes. Intenta más tarde." :
            esConfig ? "El formulario no está disponible temporalmente. Contacta al equipo." :
            status === 400 || status === 422 ? "El servicio rechazó la solicitud. Revisa tus datos." :
            "No se pudo confirmar la recepción del formulario.";
          mostrarEstado(msg, "error", !esConfig);
          return;
        }
        // Copia interna para el panel de administración (opcional: si el almacén no está cargado, se omite).
        try { window.TP_Almacen?.registrar?.({ tipo, nombre: datos.get("nombre"), correo: datos.get("email"), programa: programa.value, codigo: codigoPendiente }); } catch { /* el panel es complementario */ }
        const final = tipo === "matricula"
          ? `Recibimos tu solicitud de matrícula. Código: ${codigoPendiente}. Tu cupo aún no está confirmado.`
          : `Recibimos tu consulta. Código de solicitud: ${codigoPendiente}.`;
        form.reset();
        // El formulario solo se limpia tras una recepción confirmada.
        campos.forEach(c => { document.getElementById("error-" + c.id).textContent=""; c.removeAttribute("aria-invalid"); });
        mostrarEstado(final, "exito");
        codigoPendiente = "";
        firmaPendiente = "";
        if (typeof volar === "function") volar();
      } catch (e) {
        const agotado = e?.name === "AbortError";
        const msg = agotado ? "El envío tardó demasiado." : "No hay conexión con el servicio.";
        mostrarEstado(`${msg} Código: ${codigoPendiente}. Comprueba si llegó antes de reintentar.`, "error", true);
      } finally {
        clearTimeout(timeout);
        bloquear(false);
      }
    }
    campos.forEach(c => {
      c.addEventListener("blur", () => validar(c));
      c.addEventListener(c.type === "checkbox" || c.tagName === "SELECT" ? "change" : "input", () => {
        if (c.getAttribute("aria-invalid") === "true") validar(c);
        if (!notificacion.hidden) limpiarEstado();
        codigoPendiente = ""; firmaPendiente = "";
      });
    });
    form.addEventListener("submit", e => { e.preventDefault(); void enviar(); });
    reintentar.addEventListener("click", () => { void enviar(); });
  }
  return { iniciar };
})();
