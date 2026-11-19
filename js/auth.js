"use strict";
/* Seguridad real: el backend valida cookies HttpOnly y permisos antes de servir paneles y datos.
   El navegador solo recibe el perfil público del usuario de su sesión actual. */
window.TP_Auth = (() => {
 const PANELES = {admin:'pages/panel-admin.html',docente:'pages/panel-docente.html',alumno:'pages/panel-alumno.html'};
 const ETIQUETAS = {admin:'Administrador',docente:'Docente',alumno:'Estudiante'};
 const sesion = () => window.TP_SERVER_SESSION || null;
 const panelDe = rol => PANELES[rol];
 const docenteDe = curso => (window.TP?.DET?.[curso]?.doc?.[0]?.n || 'Por asignar');
 const raizDe = () => document.body?.dataset.raiz || (location.pathname.includes('/pages/')?'../':'');
 // Defensa secundaria de interfaz. El control de permisos verdadero está en el servidor HTTP.
 const exigir = rol => sesion()?.rol === rol ? sesion() : null;
 async function salir() {
  try { await fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'}); }
  finally { window.TP_SERVER_SESSION=null; }
 }
 return {sesion,panelDe,docenteDe,raizDe,exigir,salir,ETIQUETAS,PANELES};
})();
