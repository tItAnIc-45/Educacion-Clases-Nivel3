"use strict";
/* Entrada y salida unificadas entre todas las páginas HTML del proyecto.
   El enlace navega una sola vez; no se bloquea la navegación con movimiento reducido. */
(() => {
 const REDUCIDO=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const LLAVE='tp-trans', TIEMPO=640, EASE='cubic-bezier(.65,0,.35,1)';
 let navegando=false;
 const guardar=()=>{try{sessionStorage.setItem(LLAVE,'1');}catch{}};
 const consumir=()=>{try{const r=sessionStorage.getItem(LLAVE)==='1';sessionStorage.removeItem(LLAVE);return r;}catch{return false;}};
 function crear(salida) {
  const c=document.createElement('div');c.className='cortina'+(salida?' sale':'');c.setAttribute('aria-hidden','true');
  const ave=document.createElement('div');ave.className='ave';
  const inAve=document.createElement('div');inAve.className='ave-in';
  const img=document.createElement('img');img.className='colibri';img.alt='';
  img.src=(document.body.dataset.raiz||'')+'assets/colibri.png';
  inAve.append(img);ave.append(inAve);c.append(ave);document.body.append(c);return c;
 }
 function ir(destino) {
  if(navegando)return;
  navegando=true;
  const u=new URL(destino,location.href);
  if(REDUCIDO){location.assign(u.href);return;}
  guardar();
  const c=crear(false);
  let terminado=false;
  const terminar=()=>{if(terminado)return;terminado=true;location.assign(u.href);};
  try {c.animate([{transform:'translateX(-101%)'},{transform:'translateX(0)'}],{duration:TIEMPO,easing:EASE,fill:'forwards'}).onfinish=terminar;}
  catch{terminar();}
  setTimeout(terminar,TIEMPO+500);
 }
 if(window.TP)window.TP.ir=ir;
 window.TP_Navegar=ir;
 function llegada(){
  const flag=consumir(),html=document.documentElement;
  if(!flag){html.classList.remove('llega');return;}
  if(REDUCIDO){html.classList.remove('llega');return;}
  const c=crear(true);c.style.transform='translateX(0)';
  let borrado=false;const terminar=()=>{if(borrado)return;borrado=true;c.remove();html.classList.remove('llega');};
  requestAnimationFrame(()=>{
   // El pseudo-elemento oscuro evita mostrar la página antes de arrancar la transición.
   html.classList.remove('llega');
   try {c.animate([{transform:'translateX(0)'},{transform:'translateX(101%)'}],{duration:TIEMPO,delay:90,easing:EASE,fill:'forwards'}).onfinish=terminar;}
   catch{terminar();}
  });
  setTimeout(terminar,TIEMPO+1000);
 }
 llegada();
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');
  if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.hasAttribute('download')||a.target&&a.target!=='_self')return;
  const u=new URL(a.href,location.href);
  if(u.origin!==location.origin||!/\.html?$|\/$/.test(u.pathname))return;
  if(u.pathname===location.pathname&&u.search===location.search)return;
  e.preventDefault();ir(u.href);
 });
 addEventListener('pageshow',e=>{if(e.persisted){navegando=false;document.querySelectorAll('.cortina').forEach(n=>n.remove());document.documentElement.classList.remove('llega');consumir();}});
})();
