import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, prepararDatos } from './db.mjs';
import { atenderModulo } from './docente.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 8192, VIDA = 8*60*60*1000;
const ROLES_PANEL = { '/pages/panel-admin.html':'admin', '/pages/panel-docente.html':'docente', '/pages/panel-alumno.html':'alumno' };
const RUTA_ROL = { admin:'/pages/panel-admin.html', docente:'/pages/panel-docente.html', alumno:'/pages/panel-alumno.html' };
const bloqueos = new Map();
const tipos = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp'};
const hToken = t=>createHash('sha256').update(t).digest('hex');
const salida = (res,estado,obj,extra={})=>{res.writeHead(estado,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(obj));};
function usuarioSesion(req) {
 const cookie = req.headers.cookie || '';
 const t = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('tp_sid='))?.slice(7);
 if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
 return db.prepare(`SELECT u.id,u.usuario,u.nombre,u.correo,r.codigo rol
 FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id JOIN roles r ON r.id=u.rol_id
 WHERE s.token_hash=? AND s.expira>? AND u.activo=1`).get(hToken(t), Date.now()) || null;
}
function cookieSesion(token,edad=28800) {
 const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
 return `tp_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${edad}${secure}`;
}
function lecturaJSON(req) {
 return new Promise((resolve,reject)=>{
  if (!String(req.headers['content-type']||'').startsWith('application/json')) return reject(Object.assign(new Error('Tipo de contenido inválido'),{status:415}));
  let contenido='',excede=false;
  req.on('data',b=>{contenido+=b;if(contenido.length>MAX_BODY){excede=true;reject(Object.assign(new Error('Solicitud demasiado grande'),{status:413}));req.destroy();}});
  req.on('end',()=>{if(excede)return;try{resolve(JSON.parse(contenido));}catch{reject(Object.assign(new Error('JSON inválido'),{status:400}));}});
  req.on('error',reject);
 });
}
function errorAcceso(res,rol,usuario) {
 if (!usuario) return salida(res,401,{error:'Inicia sesión para continuar.'});
 if (rol && usuario.rol!==rol) return salida(res,403,{error:'403 Forbidden: acceso denegado para este rol.'});
 return false;
}
function resumenAlumno(id) {
 const m = db.prepare(`SELECT m.id,m.estado,m.codigo,m.creado,c.id curso_id,c.titulo,doc.nombre docente
 FROM matriculas m JOIN cursos c ON c.id=m.curso_id LEFT JOIN usuarios doc ON doc.id=c.docente_id
 WHERE m.usuario_id=? ORDER BY m.creado DESC,m.id DESC`).all(id);
 const cursos = m.map(x=>{
  const cont = db.prepare(`SELECT COUNT(*) total,
    COALESCE(SUM(CASE WHEN estado='presente' THEN 1 ELSE 0 END),0) presentes,
    COALESCE(SUM(CASE WHEN estado='tarde' THEN 1 ELSE 0 END),0) tardanzas,
    COALESCE(SUM(CASE WHEN estado='falta' THEN 1 ELSE 0 END),0) faltas
    FROM asistencia WHERE matricula_id=?`).get(x.id);
  return {cursoId:x.curso_id,titulo:x.titulo,docente:x.docente||'Por asignar',estado:x.estado,codigo:x.codigo,
   creado:x.creado,asistencia:{...cont,porcentaje:cont.total?Math.round((cont.presentes+cont.tardanzas)*100/cont.total):null},
   horarios:x.estado==='aprobada'?db.prepare('SELECT dia,inicio,fin,detalle FROM horarios WHERE curso_id=? ORDER BY dia,inicio').all(x.curso_id):[]};
 });
 const aprobados=cursos.filter(c=>c.estado==='aprobada');
 const asistencias=aprobados.reduce((s,c)=>s+c.asistencia.presentes+c.asistencia.tardanzas,0);
 const total=aprobados.reduce((s,c)=>s+c.asistencia.total,0);
 return {matriculas:cursos,asistencia:{total,asistencias,faltas:total-asistencias,porcentaje:total?Math.round(asistencias*100/total):null}};
}
async function api(req,res,pathname) {
 const u=usuarioSesion(req);
 if (await atenderModulo(req,res,pathname,u,new URL(req.url,`http://${req.headers.host||'localhost'}`))) return;
 if (pathname==='/api/login' && req.method==='POST') {
  const ip=req.socket.remoteAddress||'local';
  const b=bloqueos.get(ip)||{intentos:0,hasta:0};
  if(b.hasta>Date.now())return salida(res,429,{error:'Demasiados intentos. Inténtalo después.',segundos:Math.ceil((b.hasta-Date.now())/1000)});
  const x=await lecturaJSON(req);
  const usuario=String(x.usuario||'').trim().toLowerCase(), clave=String(x.clave||''), rol=String(x.rol||'');
  if(!usuario||!clave||usuario.length>80||clave.length>256||!['admin','docente','alumno'].includes(rol))return salida(res,400,{error:'Completa el perfil, usuario y contraseña.'});
  const fila=db.prepare(`SELECT u.id,u.usuario,u.nombre,u.correo,u.sal,u.clave_hash,u.hash_alg,r.codigo rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.usuario=? AND u.activo=1`).get(usuario);
  // Soporte de migración: las tres cuentas originales conservan sus claves.
  // Tras el primer acceso correcto, se sustituyen sus hashes SHA-256 por scrypt.
  let correcto=false;
  if(fila?.hash_alg==='sha256_legacy') {
   const calculado=createHash('sha256').update(fila.sal+':'+clave).digest();
   correcto=timingSafeEqual(calculado,Buffer.from(fila.clave_hash,'hex'));
  }else {
   const sal=fila?.sal||'00000000000000000000000000000000';
   const intento=scryptSync(clave,Buffer.from(sal,'hex'),64);
   correcto=Boolean(fila)&&timingSafeEqual(intento,Buffer.from(fila.clave_hash,'hex'));
  }
  correcto=correcto&&fila.rol===rol;
  if(!correcto) {
   b.intentos++;
   if(b.intentos>=5){b.hasta=Date.now()+30000;b.intentos=0;}
   bloqueos.set(ip,b);
   return salida(res,401,{error:'Credenciales o perfil incorrectos.',...(b.hasta>Date.now()?{segundos:30}:{})});
  }
  bloqueos.delete(ip);
  if(fila.hash_alg==='sha256_legacy') {
   const sal=randomBytes(16).toString('hex');
   const nuevo=scryptSync(clave,Buffer.from(sal,'hex'),64).toString('hex');
   db.prepare('UPDATE usuarios SET sal=?,clave_hash=?,hash_alg=? WHERE id=?')
    .run(sal,nuevo,'scrypt',fila.id);
  }
  if(req.headers.cookie?.includes('tp_sid=')) {const anterior=req.headers.cookie.match(/(?:^|;\s*)tp_sid=([a-f0-9]{64})/);if(anterior)db.prepare('DELETE FROM sesiones WHERE token_hash=?').run(hToken(anterior[1]));}
  db.prepare('DELETE FROM sesiones WHERE expira<=?').run(Date.now());
  const token=randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sesiones(token_hash,usuario_id,expira) VALUES (?,?,?)').run(hToken(token),fila.id,Date.now()+VIDA);
  return salida(res,200,{ok:true,rol:fila.rol,destino:RUTA_ROL[fila.rol]},{'Set-Cookie':cookieSesion(token)});
 }
 if(pathname==='/api/logout'&&req.method==='POST') {
  const t=(req.headers.cookie||'').match(/(?:^|;\s*)tp_sid=([a-f0-9]{64})/);
  if(t)db.prepare('DELETE FROM sesiones WHERE token_hash=?').run(hToken(t[1]));
  return salida(res,200,{ok:true},{'Set-Cookie':cookieSesion('',0)});
 }
 if(pathname==='/api/me'&&req.method==='GET')return u?salida(res,200,{usuario:u.usuario,nombre:u.nombre,rol:u.rol,correo:u.correo,destino:RUTA_ROL[u.rol]}):errorAcceso(res,null,u);
 if(pathname==='/api/alumno/resumen'&&req.method==='GET') {
  if(!u||u.rol!=='alumno')return errorAcceso(res,'alumno',u);
  return salida(res,200,{nombre:u.nombre,correo:u.correo,...resumenAlumno(u.id)});
 }
 if(pathname==='/api/admin/comprobacion'&&req.method==='GET'){
  if(!u||u.rol!=='admin')return errorAcceso(res,'admin',u);
  return salida(res,200,{usuarios:db.prepare('SELECT COUNT(*) n FROM usuarios').get().n,cursos:db.prepare('SELECT COUNT(*) n FROM cursos').get().n,matriculas:db.prepare('SELECT COUNT(*) n FROM matriculas').get().n});
 }
 if(pathname==='/api/docente/comprobacion'&&req.method==='GET'){
  if(!u||u.rol!=='docente')return errorAcceso(res,'docente',u);
  return salida(res,200,{cursos:db.prepare('SELECT id,titulo FROM cursos WHERE docente_id=?').all(u.id)});
 }
 return salida(res,404,{error:'Ruta API no disponible.'});
}
function estatico(req,res,pathname){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 // Alias solicitados por el equipo para las pantallas principales N3.
 // Se comprueban permisos ANTES de redirigir: /admin.html devuelve 403 a alumnos/docentes.
 const alias={ '/admin.html':'admin','/docente.html':'docente','/portal-alumno.html':'alumno' };
 if(pathname==='/login.html'){
  res.writeHead(302,{Location:'/pages/login.html','Cache-Control':'no-store'});return res.end();
 }
 if(alias[pathname]){
  const s=usuarioSesion(req);
  if(!s){res.writeHead(302,{Location:'/pages/login.html?motivo=sesion','Cache-Control':'no-store'});return res.end();}
  if(s.rol!==alias[pathname]){res.writeHead(403,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>403 Forbidden</title><h1>403 Forbidden</h1><p>No tienes autorización para esta sección.</p></html>');}
  res.writeHead(302,{Location:RUTA_ROL[s.rol],'Cache-Control':'no-store'});return res.end();
 }
 const base=pathname==='/'?'/index.html':pathname;
 if(!(/^\/(index|404)\.html$/.test(base)||/^\/(assets|public|css|js)\/[\w.\/-]+$/.test(base)||/^\/pages\/[a-z0-9-]+\.html$/.test(base))||base.includes('..')){res.writeHead(404);return res.end('No encontrado');}
 const archivo=path.resolve(ROOT,'.'+base);
 if(!archivo.startsWith(ROOT+path.sep)||!fs.existsSync(archivo)||!fs.statSync(archivo).isFile()){res.writeHead(404);return res.end('No encontrado');}
 const rol=ROLES_PANEL[base];
 const u=rol?usuarioSesion(req):null;
 if(rol&&!u){res.writeHead(302,{Location:'/pages/login.html?motivo=sesion','Cache-Control':'no-store'});return res.end();}
 if(rol&&u.rol!==rol){res.writeHead(403,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>403 Forbidden</title><h1>403 Forbidden</h1><p>No tienes autorización para esta sección.</p><a href="/pages/login.html">Volver</a></html>');}
 let data=fs.readFileSync(archivo);
 if (base === '/pages/matricula.html') {
  data=Buffer.from(data.toString().replace('<!--TP_SERVER_RUNTIME-->', '<script>window.TP_N3_SERVER=true;</script>'));
 }
 if(rol){
  const sesion={usuario:u.usuario,rol:u.rol,nombre:u.nombre,correo:u.correo};
  const js=JSON.stringify(sesion).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  data=Buffer.from(data.toString().replace('<!--TP_SESSION_BOOTSTRAP-->',`<script>window.TP_SERVER_SESSION=${js};</script>`));
 }
 res.writeHead(200,{'Content-Type':tipos[path.extname(archivo)]||'application/octet-stream', 'Cache-Control':rol?'no-store':'public, max-age=60','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});
 if(req.method==='HEAD')return res.end();res.end(data);
}
export function iniciarServidor({puerto=Number(process.env.PORT||5500),host='127.0.0.1'}={}) {
 const cred=prepararDatos();
 if(cred){console.log('\nCUENTAS ORIGINALES RESTAURADAS: admin, docente y alumno (Ana Gómez).');console.log('Sus contraseñas son las de la plantilla original y se migran a scrypt al iniciar sesión.');console.log('NUEVA CONTRASEÑA DEL ESTUDIANTE ADICIONAL (solo aparece en esta inicialización/migración):');for(const [u,p] of Object.entries(cred))console.log(`${u.padEnd(9)}  ${p}`);console.log('Guárdala en privado. La base está en data/ (ignorada por Git).\n');}
 const servidor=http.createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,`http://${req.headers.host||'localhost'}`), pathname=decodeURIComponent(url.pathname);
   // Las peticiones de escritura deben originarse en el mismo sitio.
   if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.headers.origin){
    const o=new URL(req.headers.origin);if(o.host!==req.headers.host||!['http:','https:'].includes(o.protocol))return salida(res,403,{error:'Origen no autorizado.'});
   }
   if(pathname.startsWith('/api/'))await api(req,res,pathname);
   else estatico(req,res,pathname);
  } catch(e){const status=e.status||500; if(status>=500)console.error('Error del servidor:',e);if(!res.headersSent)salida(res,status,{error:status===500?'Error interno del servidor.':e.message});else res.end();}
 });
 return new Promise(resolve=>servidor.listen(puerto,host,()=>{console.log(`TUPLUSEDUCA Nivel 3: http://${host}:${servidor.address().port}`);resolve(servidor);}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await iniciarServidor();
