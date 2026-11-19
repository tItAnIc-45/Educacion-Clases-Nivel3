"use strict";
/* Nivel 3: bandeja de matrícula y asistencia reales, con controles por rol en servidor.
   No modifica la gestión del administrador (módulo separado de Diego). */
(async () => {
  const sesion = TP_Auth.sesion();
  if (!sesion) return;
  TP_Panel.cabecera(sesion);
  $("#saludo").textContent = `Hola, ${sesion.nombre.split(" ")[0]}. Consulta las solicitudes, tus alumnos y pasa lista.`;
  const $cursos = $("#cursos"), $bandeja = $("#bandeja"), $asist = $("#asist");
  const $alumnos = $("#alumnos"), $sesiones = $("#sesiones");
  const hoy = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); };
  const estado = { cursos: [], curso: "", fecha: hoy(), aula: null, solicitudes: [], borradores: new Map(), ocupado: false };
  const clave = () => estado.curso + "|" + estado.fecha;
  const toast = msg => aviso(msg);
  const numero = n => Number.isFinite(n) ? String(n) : "—";
  async function pedir(ruta, opciones) {
    let r;
    try { r = await fetch(ruta, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json", ...(opciones ? { "Content-Type": "application/json" } : {}) }, ...(opciones || {}) }); }
    catch { throw Error("No hay conexión. Inténtalo nuevamente."); }
    let contenido;
    try { contenido = await r.json(); } catch { throw Error("El servidor respondió con un formato inesperado."); }
    if (!r.ok) throw Error(contenido.error || `Error ${r.status}.`);
    return contenido;
  }
  const peticion = (ruta, datos) => pedir(ruta, { method: "POST", body: JSON.stringify(datos) });
  const obtenerAula = () => pedir(`/api/docente/aula?curso=${encodeURIComponent(estado.curso)}&fecha=${encodeURIComponent(estado.fecha)}`);
  const pedirBandeja = () => pedir("/api/docente/bandeja");
  function mensajeError(zona, msg) { zona.innerHTML = `<div class="pn-vacio" role="alert"><b>No se pudo cargar esta sección</b>${esc(msg)} <button type="button" class="pn-btn" data-actualizar>Volver a intentar</button></div>`; }
  function nombreCurso(id) { return estado.cursos.find(c=>c.id === id)?.titulo || TP_Panel.nombreCurso(id); }
  function listaAlumnos() { return estado.aula?.alumnos || []; }
  function borrador() {
    if (!estado.borradores.has(clave())) {
      estado.borradores.set(clave(), Object.fromEntries(listaAlumnos().filter(a=>a.marca).map(a=>[a.matriculaId,a.marca])));
    }
    const borrador = estado.borradores.get(clave());
    const activos = new Set(listaAlumnos().map(a=>String(a.matriculaId)));
    for (const id of Object.keys(borrador)) if (!activos.has(id)) delete borrador[id];
    return borrador;
  }
  function hayCambios() {
    const guardadas = Object.fromEntries(listaAlumnos().filter(a=>a.marca).map(a=>[a.matriculaId,a.marca]));
    const ordenado = x => JSON.stringify(Object.entries(x).sort(([a],[b])=>Number(a)-Number(b)));
    return ordenado(guardadas)!==ordenado(borrador());
  }
  function dibujarCursos() {
    $cursos.innerHTML = estado.cursos.map(c => {
      const datos=TP.curso(c.id), colores=datos?.g || ["#11243f","#1c3354"];
      const conteo = estado.curso===c.id ? listaAlumnos().length : null;
      return `<button type="button" class="pn-curso" data-curso="${esc(c.id)}" style="--g1:${colores[0]};--g2:${colores[1]}" aria-pressed="${estado.curso===c.id}">
<b>${estado.curso===c.id?"✓ ":""}${esc(c.titulo)}</b><small>${conteo===null?"Seleccionar curso":`${conteo} ${conteo===1?"alumno matriculado":"alumnos matriculados"}`}</small></button>`;
    }).join("");
  }
  function dibujarBandeja() {
    const lista = estado.solicitudes;
    const pendientes=lista.filter(s=>s.estado==='pendiente').length;
    const botones = s => s.estado==='pendiente' ? `<div class="pn-acciones">
<button type="button" class="pn-btn peque ok" data-codigo="${esc(s.codigo)}" data-estado="aprobada" aria-label="Aprobar solicitud de ${esc(s.nombre)}">Aprobar</button>
<button type="button" class="pn-btn peque mal" data-codigo="${esc(s.codigo)}" data-estado="rechazada" aria-label="Rechazar solicitud de ${esc(s.nombre)}">Rechazar</button></div>` : `<span class="pn-tipo">Revisada</span>`;
    $bandeja.innerHTML = `<section class="pn-card" aria-labelledby="bandeja-t">
<h3 class="pn-card-t" id="bandeja-t">Solicitudes de Matrícula Recientes</h3>
<p class="pn-card-s">${pendientes} solicitudes pendientes</p>
${lista.length ? `<div class="pn-tabla-cont" role="region" tabindex="0" aria-label="Solicitudes de matrícula"><table class="pn-tabla"><thead><tr><th>Estudiante</th><th>Programa</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
${lista.slice(0,20).map(s => `<tr><td><div class="pn-est">${TP_Panel.avatar(s.nombre)}<div><b>${esc(s.nombre)}</b><small>${esc(s.codigo)}</small></div></div></td><td>${esc(s.curso)}</td><td>${TP_Panel.badge(s.estado)}</td><td>${botones(s)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="pn-vacio"><b>Aún no hay solicitudes de tus cursos</b>No tienes solicitudes nuevas por revisar.</div>`}
<p class="pn-nota">${lista.length>20 ? `Mostrando 20 de ${lista.length} solicitudes.` : `Mostrando ${lista.length} solicitudes.`}</p></section>`;
  }
  function dibujarAlumnos() {
    const lista=listaAlumnos(), pro=estado.aula?.promedio;
    $alumnos.innerHTML = `<h3 class="pn-card-t">Alumnos matriculados</h3><p class="pn-card-s">${esc(nombreCurso(estado.curso))}</p>
<div class="pn-stats"><div class="pn-stat"><b>${lista.length}</b><span>Matriculados</span></div>
<div class="pn-stat"><b>${pro===null?"—":pro+"%"}</b><span>Asistencia media</span></div>
<div class="pn-stat"><b>${estado.aula?.historial.length||0}</b><span>Clases recientes</span></div></div>
${lista.length ? `<div class="pn-tabla-cont" tabindex="0" role="region" aria-label="Alumnos matriculados">
<table class="pn-tabla compacta"><thead><tr><th>Alumno</th><th>Asistencia</th><th>Faltas</th></tr></thead><tbody>${lista.map(a=>`<tr><td><div class="pn-est">${TP_Panel.avatar(a.nombre)}<div><b>${esc(a.nombre)}</b><small>${esc(a.correo)}</small></div></div></td>
<td>${a.asistencia.porcentaje===null?"Sin registro":`${a.asistencia.porcentaje}%`}</td><td>${a.asistencia.falta}</td></tr>`).join("")}</tbody></table></div>` : `<div class="pn-vacio"><b>Sin alumnos matriculados todavía</b>No hay alumnos inscritos en este curso.</div>`}`;
  }
  function dibujarAsistencia() {
    const lista=listaAlumnos(), marcas=borrador(), sucio=hayCambios(), r={presente:0,tarde:0,falta:0};
    for (const v of Object.values(marcas)) if (v in r) r[v]++;
    const fechaLarga=TP_Panel.fechaLarga(estado.fecha);
    $asist.innerHTML = `<section class="pn-card" aria-labelledby="as-t"><h3 class="pn-card-t" id="as-t">Pase de Asistencia y Seguimiento</h3>
<p class="pn-card-s">${esc(fechaLarga)}</p><div class="pn-filtro"><label class="pn-select"><span>Curso:</span><select id="as-curso">${estado.cursos.map(c=>`<option value="${esc(c.id)}"${c.id===estado.curso?" selected":""}>${esc(c.titulo)}</option>`).join("")}</select></label>
<label class="pn-campo pn-fecha"><span class="pn-sr">Fecha de la clase</span><input id="as-fecha" type="date" value="${estado.fecha}" max="${hoy()}"></label></div>
${lista.length ? `<div class="pn-resumen"><div class="pn-conteo" aria-live="polite"><span><b>${r.presente}</b> presentes</span><span><b>${r.tarde}</b> tarde</span><span><b>${r.falta}</b> faltas</span><span><b>${lista.length-r.presente-r.tarde-r.falta}</b> sin marcar</span></div>
<button type="button" class="pn-btn peque" data-todos>Marcar todos presentes</button></div>
<ul class="pn-lista${lista.length>6?" scroll":""}">${lista.map(a=>`<li class="pn-fila"><div class="pn-est">${TP_Panel.avatar(a.nombre)}<div><b>${esc(a.nombre)}</b><small class="pn-pct">${a.asistencia.porcentaje===null?"Sin registro":`${a.asistencia.porcentaje}% de asistencia`}</small></div></div>
<div class="pn-marcas" role="group" aria-label="Asistencia de ${esc(a.nombre)}">${["presente","tarde","falta"].map(v=>`<button type="button" class="pn-marca ${v}" data-alumno="${a.matriculaId}" data-marca="${v}" aria-pressed="${marcas[a.matriculaId]===v}">${v==="presente"?"Presente":v==="tarde"?"Tarde":"Falta"}</button>`).join("")}</div></li>`).join("")}</ul>
<div class="pn-pie"><button type="button" class="pn-btn principal" data-guardar ${sucio?"":"disabled"}>Guardar Asistencia</button>
<button type="button" class="pn-btn grande" data-reporte>Enviar Reporte</button></div>
<p class="pn-nota${sucio?" sucio":""}" role="status">${sucio?"Hay cambios sin guardar.":"Asistencia al día."}</p>`:
`<div class="pn-vacio"><b>Este curso aún no tiene alumnos matriculados</b>Las solicitudes aprobadas de estudiantes con cuenta aparecerán aquí.</div>`}</section>`;
  }
  function dibujarSesiones() {
    const lista=estado.aula?.historial||[];
    $sesiones.innerHTML = `<h3 class="pn-card-t">Últimas clases</h3><p class="pn-card-s">Historial de asistencia</p>
${lista.length?`<table class="pn-sesiones"><thead><tr><th>Fecha</th><th>Presentes</th><th>Tarde</th><th>Faltas</th></tr></thead><tbody>${lista.map(x=>`<tr><td>${esc(TP_Panel.fechaLarga(x.fecha))}</td><td>${x.presente}</td><td>${x.tarde}</td><td>${x.falta}</td></tr>`).join("")}</tbody></table>`:
`<div class="pn-vacio"><b>Aún no hay clases registradas</b>Guarda la asistencia de una clase para iniciar el seguimiento.</div>`}`;
  }
  function pintarTodo() { dibujarCursos(); dibujarBandeja(); dibujarAlumnos(); dibujarAsistencia(); dibujarSesiones(); }
  async function cargarAula() {
    estado.aula = await obtenerAula();
    pintarTodo();
  }
  async function cambiarCurso(id) {
    if (!estado.cursos.some(c=>c.id===id) || estado.ocupado) return;
    estado.curso=id;
    try { await cargarAula(); }
    catch(e) { mensajeError($asist,e.message); mensajeError($alumnos,e.message); }
  }
  async function cargarBandeja() {
    const datos=await pedirBandeja();
    estado.solicitudes=datos.solicitudes;
    dibujarBandeja();
  }
  async function actualizarEstado(codigo, nuevo) {
    if(estado.ocupado)return;
    estado.ocupado=true;
    try {
      const r=await peticion('/api/docente/solicitud/estado',{codigo,estado:nuevo});
      await Promise.all([cargarBandeja(),cargarAula()]);
      toast(r.requiereCuenta?`Solicitud ${codigo}: ${nuevo}. Pendiente de vincular a una cuenta de estudiante.`:
        `Solicitud ${codigo}: ${nuevo}. Solicitud actualizada correctamente.`);
    }catch(e){toast(`No se pudo actualizar la solicitud: ${e.message}`);}
    finally{estado.ocupado=false;}
  }
  async function guardar() {
    if(estado.ocupado)return false;
    estado.ocupado=true;
    const k=clave(), marcas=Object.entries(borrador()).map(([id,estado])=>({matriculaId:Number(id),estado}));
    try {
      const resultado=await peticion('/api/docente/asistencia',{curso:estado.curso,fecha:estado.fecha,marcas});
      estado.borradores.delete(k);
      await cargarAula();
      toast(`Asistencia guardada correctamente (${resultado.guardadas} registros).`);
      return true;
    }catch(e){toast(`No se pudo guardar la asistencia: ${e.message}`);return false;}
    finally{estado.ocupado=false;}
  }
  async function reporte() {
    if (hayCambios() && !(await guardar())) return;
    if(estado.ocupado)return;
    estado.ocupado=true;
    try {await peticion('/api/docente/reporte',{curso:estado.curso,fecha:estado.fecha}); toast('Reporte enviado correctamente.');}
    catch(e){toast(`No se pudo enviar el reporte: ${e.message}`);}
    finally{estado.ocupado=false;}
  }
  $cursos.addEventListener('click',e=>{const b=e.target.closest('[data-curso]');if(b)void cambiarCurso(b.dataset.curso);});
  $bandeja.addEventListener('click',e=>{const b=e.target.closest('[data-codigo]');if(b)void actualizarEstado(b.dataset.codigo,b.dataset.estado);});
  $asist.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.alumno){const marcas=borrador(),id=b.dataset.alumno,v=b.dataset.marca;
      if(marcas[id]===v)delete marcas[id];else marcas[id]=v;
      dibujarAsistencia();
      $asist.querySelector(`[data-alumno="${id}"][data-marca="${v}"]`)?.focus();
    }else if(b.hasAttribute('data-todos')) {listaAlumnos().forEach(a=>borrador()[a.matriculaId]='presente');dibujarAsistencia();}
    else if(b.hasAttribute('data-guardar'))void guardar();
    else if(b.hasAttribute('data-reporte'))void reporte();
  });
  $asist.addEventListener('change',e=>{
    if(e.target.id==='as-curso')void cambiarCurso(e.target.value);
    else if(e.target.id==='as-fecha'){
      const f=e.target.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(f)||f>hoy()){toast('Selecciona una fecha válida que no sea futura.');dibujarAsistencia();return;}
      estado.fecha=f;
      void cargarAula().catch(err=>mensajeError($asist,err.message));
    }
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-actualizar]');if(b)void Promise.all([cargarBandeja(),cargarAula()]).catch(err=>toast(err.message));
  });
  $cursos.innerHTML='<p class="pn-card-s" role="status">Cargando tus cursos…</p>';
  $bandeja.innerHTML='<p class="pn-card-s" role="status">Cargando solicitudes…</p>';
  try {
    const r=await pedir('/api/docente/operativo');
    estado.cursos=r.cursos;
    if(!estado.cursos.length){$cursos.innerHTML='<p class="pn-card-s">Todavía no tienes cursos asignados.</p>';
      $bandeja.innerHTML='';$asist.innerHTML='';$alumnos.innerHTML='';$sesiones.innerHTML='';return;}
    estado.curso=estado.cursos[0].id;
    await Promise.all([cargarBandeja(),cargarAula()]);
  }catch(e){mensajeError($cursos,e.message);mensajeError($bandeja,e.message);}
})();
