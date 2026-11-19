import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const carpeta=fs.mkdtempSync(path.join(os.tmpdir(),'tp-steven-'));
process.env.TP_DATA_DIR=carpeta;
const {db,prepararDatos,hashClave}=await import('../server/db.mjs');
prepararDatos();
const secret={admin:'EXAM-admin-2026',docente:'EXAM-docente-2026',alumno:'EXAM-alumno-2026',alumna2:'EXAM-carlos-2026'};
for(const [name,pass] of Object.entries(secret)){
 const {sal,hash}=hashClave(pass);
 db.prepare("UPDATE usuarios SET sal=?,clave_hash=?,hash_alg='scrypt' WHERE usuario=?").run(sal,hash,name);
}
const nativeFetch=globalThis.fetch;
let rsp=200, calls=0;
globalThis.fetch=(entrada,opciones)=>{
 if (String(entrada).startsWith('https://formspree.io/f/')) {
  calls++;
  assert.equal(opciones.method,'POST');
  assert.equal(opciones.body.get('tipo_solicitud'),'solicitud_matricula');
  return Promise.resolve(new Response(JSON.stringify(rsp===200?{ok:true}:{error:'Rechazado por Formspree'}),{status:rsp,headers:{'Content-Type':'application/json'}}));
 }
 return nativeFetch(entrada,opciones);
};
const {iniciarServidor}=await import('../server/app.mjs');
const server=await iniciarServidor({puerto:0});
const host=`http://127.0.0.1:${server.address().port}`;
test.after(async()=>{await new Promise(done=>server.close(done));globalThis.fetch=nativeFetch;db.close();fs.rmSync(carpeta,{recursive:true,force:true});});
async function login(usuario,rol){
 const r=await fetch(host+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,clave:secret[usuario],rol})});
 assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
}
const alumno=await login('alumno','alumno'),carlos=await login('alumna2','alumno'),docente=await login('docente','docente'),admin=await login('admin','admin');
async function llamar(url,{cookie,metodo='GET',datos}={}){
 const r=await fetch(host+url,{method:metodo,headers:{...(cookie?{Cookie:cookie}:{}),...(datos?{'Content-Type':'application/json'}:{})},...(datos?{body:JSON.stringify(datos)}:{})});
 return {status:r.status,body:await r.json()};
}
const codigo='SOL-2026-A1B2C3D4E5F6';
function solicitud(code=codigo,correo='ana.gomez@ejemplo.com',curso='web') {
 return {nombre:correo.startsWith('ana')?'Ana Gómez':'Juan Prueba',email:correo,programa_id:curso,codigo_solicitud:code,
  tipo_solicitud:'solicitud_matricula',aceptacion:'Autorizó envío de datos para gestionar esta solicitud'};
}

test('rutas docentes protegidas por sesión y rol; alumnos no pueden leer bandeja',async()=>{
 assert.equal((await llamar('/api/docente/operativo')).status,401);
 assert.equal((await llamar('/api/docente/bandeja',{cookie:alumno})).status,403);
 assert.equal((await llamar('/api/docente/bandeja',{cookie:admin})).status,403);
 const panel=await llamar('/api/docente/operativo',{cookie:docente});
 assert.equal(panel.status,200);
 assert.deepEqual(panel.body.cursos.map(x=>x.id).sort(),['diseno','web']);
 assert.equal((await llamar('/api/docente/aula?curso=datos&fecha=2026-10-11',{cookie:docente})).status,403);
 assert.equal((await llamar('/api/docente/aula?curso=web&fecha=2999-01-01',{cookie:docente})).status,422);
});
test('la web N3 inyecta el modo servidor únicamente en Matrícula',async()=>{
 const r=await nativeFetch(host+'/pages/matricula.html');
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/window\.TP_N3_SERVER=true/);
 assert.doesNotMatch(html,/<!--TP_SERVER_RUNTIME-->/);
});
test('si Formspree rechaza un envío no hay falso éxito ni registro local',async()=>{
 rsp=403;
 const r=await llamar('/api/public/matricula',{metodo:'POST',datos:solicitud()});
 assert.equal(r.status,502);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM solicitudes_web').get().n,0);
 rsp=200;
});
test('Formspree acepta, SQLite registra la solicitud y el docente la ve en su bandeja',async()=>{
 const r=await llamar('/api/public/matricula',{metodo:'POST',datos:solicitud()});
 assert.equal(r.status,200);assert.equal(r.body.ok,true);
 const f=db.prepare('SELECT nombre,correo,estado,origen FROM solicitudes_web WHERE codigo=?').get(codigo);
 assert.equal(f.estado,'pendiente');assert.equal(f.origen,'formspree');
 const b=await llamar('/api/docente/bandeja',{cookie:docente});
 assert.equal(b.status,200);assert.ok(b.body.solicitudes.some(s=>s.codigo===codigo&&s.cursoId==='web'));
 const anterior=calls;
 const duplicada=await llamar('/api/public/matricula',{metodo:'POST',datos:solicitud()});
 assert.equal(duplicada.status,200);assert.equal(duplicada.body.registro,'ya_recibido');
 assert.equal(calls,anterior,'un reintento no vuelve a enviar a Formspree');
 assert.equal((await llamar('/api/public/matricula',{metodo:'POST',datos:solicitud(codigo,'otra@example.com')})).status,409);
});
test('el docente solo ve solicitudes de sus cursos y la recepción no crea cuentas',async()=>{
 const otro='SOL-2026-AABBCCDDEEFF';
 assert.equal((await llamar('/api/public/matricula',{metodo:'POST',datos:solicitud(otro,'externo@example.com','datos')})).status,200);
 const b=await llamar('/api/docente/bandeja',{cookie:docente});
 assert.ok(!b.body.solicitudes.some(s=>s.codigo===otro));
 assert.equal((await llamar('/api/docente/solicitud/estado',{cookie:docente,metodo:'POST',datos:{codigo:otro,estado:'aprobada'}})).status,403);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM usuarios WHERE correo='externo@example.com'").get().n,0);
});
test('aprobar matrícula vincula cuenta existente y cambia el portal del estudiante',async()=>{
 let r=await llamar('/api/docente/solicitud/estado',{cookie:docente,metodo:'POST',datos:{codigo,estado:'aprobada'}});
 assert.equal(r.status,200);assert.equal(r.body.vinculado,true);
 const matr=await llamar('/api/alumno/resumen',{cookie:alumno});
 assert.ok(matr.body.matriculas.some(m=>m.codigo===codigo&&m.estado==='aprobada'));
 const anaAula=await llamar('/api/docente/aula?curso=web&fecha=2026-11-12',{cookie:docente});
 assert.ok(anaAula.body.alumnos.some(x=>x.nombre==='Ana Gómez'));
 const carlosResumen=await llamar('/api/alumno/resumen',{cookie:carlos});
 assert.ok(carlosResumen.body.matriculas.every(x=>x.codigo!==codigo));
 r=await llamar('/api/docente/solicitud/estado',{cookie:alumno,metodo:'POST',datos:{codigo,estado:'rechazada'}});
 assert.equal(r.status,403);
});
test('solicitud de externo aprobada requiere creación de cuenta, sin contraseña automática',async()=>{
 const codigoExterno='SOL-2026-123456ABCDEF';
 assert.equal((await llamar('/api/public/matricula',{metodo:'POST',datos:solicitud(codigoExterno,'persona@example.com','web')})).status,200);
 const r=await llamar('/api/docente/solicitud/estado',{cookie:docente,metodo:'POST',datos:{codigo:codigoExterno,estado:'aprobada'}});
 assert.equal(r.status,200);assert.equal(r.body.requiereCuenta,true);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM usuarios WHERE correo=?').get('persona@example.com').n,0);
});
test('pase de lista se almacena en SQLite, se recupera tras F5 y actualiza el portal',async()=>{
 const fecha='2026-11-12';
 const aulaAntes=(await llamar(`/api/docente/aula?curso=web&fecha=${fecha}`,{cookie:docente})).body;
 const anaWeb=aulaAntes.alumnos.find(x=>x.nombre==='Ana Gómez');
 const carlosWeb=aulaAntes.alumnos.find(x=>x.nombre==='Carlos Mendoza');
 assert.ok(anaWeb&&carlosWeb);
 const g=await llamar('/api/docente/asistencia',{cookie:docente,metodo:'POST',datos:{curso:'web',fecha,marcas:[
  {matriculaId:anaWeb.matriculaId,estado:'presente'},
  {matriculaId:carlosWeb.matriculaId,estado:'tarde'}
 ]}});
 assert.equal(g.status,200);assert.equal(g.body.guardadas,2);
 const aulaDespues=(await llamar(`/api/docente/aula?curso=web&fecha=${fecha}`,{cookie:docente})).body;
 assert.equal(aulaDespues.alumnos.find(x=>x.nombre==='Ana Gómez').marca,'presente');
 assert.equal(aulaDespues.alumnos.find(x=>x.nombre==='Carlos Mendoza').marca,'tarde');
 const vistaAna=(await llamar('/api/alumno/resumen',{cookie:alumno})).body;
 assert.ok(vistaAna.matriculas.some(x=>x.cursoId==='web'&&x.asistencia.total>=1));
 assert.equal((await llamar('/api/docente/asistencia',{cookie:alumno,metodo:'POST',datos:{curso:'web',fecha,marcas:[]}})).status,403);
 assert.equal((await llamar('/api/docente/asistencia',{cookie:docente,metodo:'POST',datos:{curso:'datos',fecha,marcas:[]}})).status,403);
 assert.equal((await llamar('/api/docente/asistencia',{cookie:docente,metodo:'POST',datos:{curso:'web',fecha,marcas:[{matriculaId:99999,estado:'presente'}]}})).status,422);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM asistencia WHERE fecha=?').get('2026-11-12').n,2);
});
test('un reporte de asistencia queda guardado en SQLite',async()=>{
 const r=await llamar('/api/docente/reporte',{cookie:docente,metodo:'POST',datos:{curso:'web',fecha:'2026-11-12'}});
 assert.equal(r.status,200);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM reportes_docente WHERE curso_id='web' AND fecha='2026-11-12'").get().n,1);
});
