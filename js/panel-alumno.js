"use strict";
/* Portal del estudiante: datos solo lectura recibidos de /api/alumno/resumen.
   No acepta ID ni correo como parámetro: el servidor identifica al alumno por la sesión. */
(async()=>{
 const sesion=TP_Auth.sesion();if(!sesion)return;
 TP_Panel.cabecera(sesion);
 const $=s=>document.querySelector(s);
 const limpiar=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dias={1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo'};
 const estadoTexto={pendiente:'Pendiente de revisión',aprobada:'Aprobada',rechazada:'No aprobada'};
 const estadoClase={pendiente:'pendiente',aprobada:'aprobada',rechazada:'rechazada'};
 $('#saludo').textContent=`¡Hola, ${sesion.nombre.split(' ')[0]}! 👋`;
 function estadoVista(matriculas){
  const x=matriculas.find(m=>m.estado==='aprobada')||matriculas[0];
  if(!x)return '<div class="ea-estado"><span>Estado de matrícula</span><strong>Sin solicitudes registradas</strong></div>';
  return `<div class="ea-estado"><span>Estado de matrícula: <b>${limpiar(estadoTexto[x.estado])}</b></span>
   <span class="ea-chip ${estadoClase[x.estado]}">${x.estado==='aprobada'?'✓ Activa':limpiar(estadoTexto[x.estado])}</span>
   <small>Curso: ${limpiar(x.titulo)} · Solicitud ${limpiar(x.codigo)}</small></div>`;
 }
 function pintar(datos){
  $('#estado-matricula').innerHTML=estadoVista(datos.matriculas);
  const horarios=datos.matriculas.filter(m=>m.estado==='aprobada').flatMap(m=>m.horarios.map(h=>({...h,curso:m.titulo})));
  horarios.sort((a,b)=>a.dia-b.dia||a.inicio.localeCompare(b.inicio));
  $('#horarios').innerHTML=horarios.length?horarios.map(h=>`<li><strong>${dias[h.dia]}</strong><span>${limpiar(h.inicio)}–${limpiar(h.fin)} · ${limpiar(h.detalle)}</span><small>${limpiar(h.curso)}</small></li>`).join(''):'<li>No tienes clases asignadas todavía.</li>';
  const a=datos.asistencia,p=a.porcentaje;
  $('#porcentaje').textContent=p===null?'—':`${p}%`;
  $('#grafico-asistencia').style.background=`conic-gradient(#4dbd93 0% ${(p||0)*.65}%,var(--dorado) ${(p||0)*.65}% ${p||0}%,var(--pn-btn) ${p||0}% 100%)`;
  $('#resumen-asistencia').textContent=p===null?'Sin registros de asistencia':`${a.asistencias} asistencias · ${a.faltas} faltas · ${a.total} clases registradas`;
  $('#mis-cursos').innerHTML=datos.matriculas.length?datos.matriculas.map(m=>`<li class="ea-curso"><div><strong>${limpiar(m.titulo)}</strong><small>Docente: ${limpiar(m.docente)} · Solicitud ${limpiar(m.codigo)}</small></div><span class="ea-chip ${estadoClase[m.estado]}">${limpiar(estadoTexto[m.estado])}</span></li>`).join(''):'<li class="ea-curso">No hay matrículas registradas en tu cuenta.</li>';
  $('#actualizado').textContent='Información actualizada';
 }
 try{
  const r=await fetch('/api/alumno/resumen',{credentials:'same-origin',cache:'no-store'});
  if(r.status===401){location.replace('login.html?motivo=sesion');return;}
  if(r.status===403){$('#actualizado').textContent='403 Forbidden: no tienes permiso para consultar esta información.';return;}
  if(!r.ok)throw Error('No fue posible consultar el servidor.');
  pintar(await r.json());
 }catch(e){$('#actualizado').textContent='No pudimos cargar tus datos. Revisa la conexión y actualiza la página.';}
})();
