"use strict";
/* Inicio de sesión real: la contraseña se verifica en el servidor; nunca se guarda en el navegador. */
(() => {
 const form = document.querySelector('#form-login');
 const usuario = document.querySelector('#usuario'), clave = document.querySelector('#clave');
 const msg = document.querySelector('#msg'), boton=document.querySelector('#entrar');
 const params=new URLSearchParams(location.search);
 let rol='alumno', enCurso=false;
 const mostrar=(texto,tipo='')=>{msg.textContent=texto;msg.className='lg-msg '+tipo;};
 if(params.get('motivo')==='sesion')mostrar('Inicia sesión para entrar al panel.');
 if(params.get('motivo')==='salida')mostrar('Cerraste sesión correctamente.','ok');
 const opciones=[...document.querySelectorAll('.lg-rol')];
 const seleccionar=b=>{
  rol=b.dataset.rol;
  opciones.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  mostrar('');
 };
 opciones.forEach(b=>b.addEventListener('click',()=>{seleccionar(b);usuario.focus();}));
 seleccionar(opciones.find(b=>b.dataset.rol==='alumno')||opciones[0]);
 document.querySelector('#ver').addEventListener('click',e=>{
  const visible=clave.type==='password';clave.type=visible?'text':'password';
  e.currentTarget.textContent=visible?'Ocultar':'Mostrar';e.currentTarget.setAttribute('aria-pressed',String(visible));
 });
 // Si el usuario ya inició sesión, evita pedir otra vez la contraseña.
 fetch('/api/me',{credentials:'same-origin',cache:'no-store'}).then(async r=>{
  if(r.ok&&params.get('motivo')!=='salida'){
   const s=await r.json(); location.replace(s.destino);
  }
 }).catch(()=>{});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(enCurso)return;
  usuario.removeAttribute('aria-invalid');clave.removeAttribute('aria-invalid');
  if(!usuario.value.trim()){usuario.setAttribute('aria-invalid','true');mostrar('Escribe tu usuario.','error');return usuario.focus();}
  if(!clave.value){clave.setAttribute('aria-invalid','true');mostrar('Escribe tu contraseña.','error');return clave.focus();}
  enCurso=true;boton.disabled=true;mostrar('Verificando acceso…');
  try {
   const respuesta=await fetch('/api/login',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({usuario:usuario.value.trim(),clave:clave.value,rol})
   });
   const resultado=await respuesta.json();
   if(!respuesta.ok){
    mostrar(resultado.error||'No fue posible iniciar sesión.','error');clave.value='';clave.focus();return;
   }
   mostrar('Acceso concedido. Ingresando…','ok');clave.value='';
   if(window.TP?.ir)window.TP.ir(resultado.destino);else location.assign(resultado.destino);
  }catch{mostrar('No hay conexión con el servidor. Verifica que ejecutaste npm start.','error');}
  finally{enCurso=false;boton.disabled=false;}
 });
 const tema=document.querySelector('#tema'),doc=document.documentElement;
 const pintar=()=>{const claro=doc.dataset.tema==='claro';tema.textContent=claro?'☀':'☾';tema.setAttribute('aria-label',claro?'Cambiar a modo oscuro':'Cambiar a modo claro');};
 tema.addEventListener('click',()=>{doc.dataset.tema=doc.dataset.tema==='claro'?'oscuro':'claro';try{localStorage.setItem('tema',doc.dataset.tema);}catch{}pintar();});pintar();
})();
