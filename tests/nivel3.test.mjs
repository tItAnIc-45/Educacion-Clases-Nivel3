import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const temporal=fs.mkdtempSync(path.join(os.tmpdir(),'tupluseduca-n3-'));
process.env.TP_DATA_DIR=temporal;
const {db,prepararDatos,hashClave}=await import('../server/db.mjs');
const nuevas=prepararDatos();
// Las claves previas están solo representadas por sus hashes en el proyecto
// original. Para probar la API se usan contraseñas de prueba aisladas.
const claves={admin:'PRUEBA-admin-2026',docente:'PRUEBA-docente-2026',alumno:'PRUEBA-alumno-2026',alumna2:nuevas.alumna2};
const guardarClave=(usuario,clave)=>{
 const {sal,hash}=hashClave(clave);
 db.prepare("UPDATE usuarios SET sal=?,clave_hash=?,hash_alg='scrypt' WHERE usuario=?").run(sal,hash,usuario);
};
const cuenta=(usuario)=>db.prepare('SELECT id,usuario,nombre,correo,sal,clave_hash,hash_alg FROM usuarios WHERE usuario=?').get(usuario);
const cuentasIniciales=['admin','docente','alumno','alumna2'].map(cuenta);
// Un hash SHA-256 de prueba prueba el cambio al iniciar sesión con el esquema
// anterior, sin necesitar conocer ni publicar las contraseñas originales.
const claveDocenteLegacy=claves.docente;
const salLegacy='ab01cd02ef03ab04';
const hashLegacy=createHash('sha256').update(salLegacy+':'+claveDocenteLegacy).digest('hex');
db.prepare('UPDATE usuarios SET sal=?,clave_hash=?,hash_alg=? WHERE usuario=?')
 .run(salLegacy,hashLegacy,'sha256_legacy','docente');
guardarClave('admin',claves.admin);
guardarClave('alumno',claves.alumno);
const {iniciarServidor}=await import('../server/app.mjs');
const servidor=await iniciarServidor({puerto:0});
const base=`http://127.0.0.1:${servidor.address().port}`;
test.after(async()=>{await new Promise(resolve=>servidor.close(resolve));db.close();fs.rmSync(temporal,{recursive:true,force:true});});
const login=async(usuario,rol,clave=claves[usuario])=>{
 const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,clave,rol})});
 return {r,cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};
};
const get=(ruta,cookie)=>fetch(base+ruta,{headers:cookie?{Cookie:cookie}:{},redirect:'manual'});

test('restaura admin, docente y Ana como alumno; conserva Carlos como alumna2',()=>{
 assert.deepEqual(cuentasIniciales.map(c=>[c.usuario,c.nombre]),[
  ['admin','Administración'],['docente','Lucía Paredes'],['alumno','Ana Gómez'],['alumna2','Carlos Mendoza']
 ]);
 for(const user of cuentasIniciales.slice(0,3))assert.equal(user.hash_alg,'sha256_legacy');
 assert.deepEqual(cuentasIniciales.slice(0,3).map(x=>x.clave_hash),[
  '2d7ea31fa26cad87e10178836d2fb07f598ab7d0ecb117c47634368d4fb283f3',
  '755841f90c118db4afc17d2fd16caa89afa15f4c76e0aa17622958a9a8e51918',
  'e0fe5b8b47f325abff8f83a115ef952c44450bf8d80c5286a698bdfe4dedae1d'
 ]);
 assert.equal(cuentasIniciales[3].hash_alg,'scrypt');
 assert.equal(cuentasIniciales[2].correo,'ana.gomez@ejemplo.com');
 const ana=db.prepare("SELECT m.codigo FROM matriculas m JOIN usuarios u ON u.id=m.usuario_id WHERE u.usuario='alumno'").all();
 const carlos=db.prepare("SELECT m.codigo FROM matriculas m JOIN usuarios u ON u.id=m.usuario_id WHERE u.usuario='alumna2'").all();
 assert.deepEqual(ana.map(x=>x.codigo),['SOL-DEMO-ANA']);
 assert.deepEqual(carlos.map(x=>x.codigo).sort(),['SOL-DEMO-CARLOS','SOL-DEMO-PENDIENTE']);
});
test('el primer ingreso heredado valida SHA-256 y lo reemplaza por scrypt',async()=>{
 assert.equal(cuenta('docente').hash_alg,'sha256_legacy');
 const x=await login('docente','docente',claveDocenteLegacy);
 assert.equal(x.r.status,200);
 assert.equal(cuenta('docente').hash_alg,'scrypt');
 assert.equal(cuenta('docente').clave_hash.length,128);
 assert.notEqual(cuenta('docente').clave_hash,hashLegacy);
 const y=await login('docente','docente',claveDocenteLegacy);
 assert.equal(y.r.status,200,'Debe seguir entrando tras la migración de hash');
});
test('usuario sin sesión no puede ver un panel ni datos privados',async()=>{
 assert.equal((await get('/pages/panel-alumno.html')).status,302);
 assert.equal((await get('/api/alumno/resumen')).status,401);
 assert.equal((await get('/api/admin/comprobacion')).status,401);
});
test('contraseña errónea, usuario o rol falso rechazan autenticación',async()=>{
 assert.equal((await login('alumno','admin')).r.status,401);
 assert.equal((await login('alumno','alumno','wrong')).r.status,401);
 assert.equal((await login('nadie','alumno','foo')).r.status,401);
});
test('Ana solo accede a su portal y la API respeta su rol (403)',async()=>{
 const {r,cookie}=await login('alumno','alumno');assert.equal(r.status,200);
 assert.equal((await get('/pages/panel-alumno.html',cookie)).status,200);
 assert.equal((await get('/portal-alumno.html',cookie)).status,302);
 assert.equal((await get('/pages/panel-admin.html',cookie)).status,403);
 assert.equal((await get('/admin.html',cookie)).status,403);
 assert.equal((await get('/pages/panel-docente.html',cookie)).status,403);
 assert.equal((await get('/api/admin/comprobacion',cookie)).status,403);
 assert.equal((await get('/api/docente/comprobacion',cookie)).status,403);
});
test('Ana y Carlos solo consultan sus propias matrículas, horarios y asistencias',async()=>{
 const ana=await login('alumno','alumno');
 const a=await (await get('/api/alumno/resumen?usuario_id=4&correo=carlos.mendoza@example.com',ana.cookie)).json();
 assert.equal(a.nombre,'Ana Gómez');assert.equal(a.asistencia.porcentaje,80);
 assert.ok(a.matriculas.some(x=>x.estado==='aprobada'&&x.horarios.length===2));
 assert.ok(a.matriculas.every(x=>!x.codigo.includes('CARLOS')));
 const carlos=await login('alumna2','alumno');
 const b=await (await get('/api/alumno/resumen?usuario_id=3',carlos.cookie)).json();
 assert.equal(b.nombre,'Carlos Mendoza');assert.equal(b.asistencia.porcentaje,92);
 assert.ok(b.matriculas.some(x=>x.estado==='aprobada'&&x.horarios.length===3));
 assert.ok(b.matriculas.some(x=>x.estado==='pendiente'&&x.horarios.length===0));
 assert.ok(b.matriculas.every(x=>!x.codigo.includes('ANA')));
});
test('cambios en base de datos se reflejan dinámicamente en el portal',async()=>{
 const x=await login('alumna2','alumno');
 db.prepare('UPDATE horarios SET inicio=? WHERE curso_id=? AND dia=?').run('18:30','web',1);
 const a=await (await get('/api/alumno/resumen',x.cookie)).json();
 assert.ok(a.matriculas.find(c=>c.cursoId==='web').horarios.some(h=>h.inicio==='18:30'));
});
test('docente/admin acceden a sus comprobaciones sin ver datos privados de alumno',async()=>{
 const d=await login('docente','docente'),a=await login('admin','admin');
 assert.equal((await get('/pages/panel-docente.html',d.cookie)).status,200);
 assert.equal((await get('/api/docente/comprobacion',d.cookie)).status,200);
 assert.equal((await get('/api/alumno/resumen',d.cookie)).status,403);
 assert.equal((await get('/api/admin/comprobacion',a.cookie)).status,200);
 assert.equal((await get('/pages/panel-docente.html',a.cookie)).status,403);
});
test('cerrar sesión revoca cookie inmediatamente',async()=>{
 const x=await login('alumno','alumno');
 assert.equal((await get('/api/alumno/resumen',x.cookie)).status,200);
 const r=await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:x.cookie,'Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,200);
 assert.equal((await get('/api/alumno/resumen',x.cookie)).status,401);
});
test('no expone la base de datos ni las fuentes del servidor',async()=>{
 for(const p of ['/data/tupluseduca.sqlite','/server/db.mjs','/.env','/.git/config','/../../server/app.mjs'])assert.equal((await get(p)).status,404,p);
});
test('rechaza origen no autorizado en solicitudes POST',async()=>{
 const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:'https://malicioso.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,403);
});
test('migra una base SQLite N3 anterior sin perder relaciones ni intercambiar alumnos',async()=>{
 const anterior=fs.mkdtempSync(path.join(os.tmpdir(),'tp-n3-anterior-'));
 const archivo=path.join(anterior,'tupluseduca.sqlite');
 const dbVieja=new DatabaseSync(archivo);
 // Esquema de usuarios de la versión anterior (sin hash_alg).
 dbVieja.exec(`CREATE TABLE roles (id INTEGER PRIMARY KEY,codigo TEXT NOT NULL UNIQUE);
  CREATE TABLE usuarios (id INTEGER PRIMARY KEY,usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL,correo TEXT NOT NULL UNIQUE COLLATE NOCASE,rol_id INTEGER NOT NULL REFERENCES roles(id),
  sal TEXT NOT NULL,clave_hash TEXT NOT NULL,activo INTEGER NOT NULL DEFAULT 1);`);
 dbVieja.prepare('INSERT INTO roles(id,codigo) VALUES (?,?)').run(1,'admin');
 dbVieja.prepare('INSERT INTO roles(id,codigo) VALUES (?,?)').run(2,'docente');
 dbVieja.prepare('INSERT INTO roles(id,codigo) VALUES (?,?)').run(3,'alumno');
 const ins=dbVieja.prepare('INSERT INTO usuarios(id,usuario,nombre,correo,rol_id,sal,clave_hash) VALUES (?,?,?,?,?,?,?)');
 for(const [id,usuario,nombre,correo,rol] of [
  [1,'admin','Administración','admin@example.com',1],
  [2,'docente','Lucía Paredes','docente@example.com',2],
  [3,'alumno','Carlos Mendoza','carlos.mendoza@example.com',3],
  [4,'alumna2','Ana Gómez','ana.gomez@example.com',3]
 ]){const {sal,hash}=hashClave(`vieja-${usuario}`);ins.run(id,usuario,nombre,correo,rol,sal,hash);}
 dbVieja.close();
 const rutaAnterior=process.env.TP_DATA_DIR;
 process.env.TP_DATA_DIR=anterior;
 try {
  const {db:restaurada,prepararDatos:restaurar}=await import('../server/db.mjs?simular_db_anterior=1');
  try {
   restaurada.prepare('INSERT INTO cursos(id,titulo,docente_id) VALUES (?,?,?)').run('web','Desarrollo web',2);
   restaurada.prepare('INSERT INTO cursos(id,titulo,docente_id) VALUES (?,?,?)').run('diseno','Diseño gráfico',2);
   restaurada.prepare('INSERT INTO matriculas(usuario_id,curso_id,estado,codigo) VALUES (?,?,?,?)').run(3,'web','aprobada','SOL-CARLOS-PREV');
   restaurada.prepare('INSERT INTO matriculas(usuario_id,curso_id,estado,codigo) VALUES (?,?,?,?)').run(4,'diseno','aprobada','SOL-ANA-PREV');
   restaurada.prepare('INSERT INTO asistencia(matricula_id,fecha,estado) VALUES (?,?,?)').run(1,'2026-10-01','presente');
   restaurada.prepare('INSERT INTO sesiones(token_hash,usuario_id,expira) VALUES (?,?,?)').run('sesionfalsa',3,Date.now()+2000);
   const extra=restaurar();
   assert.ok(extra.alumna2?.length>=12);
   assert.equal(restaurada.prepare("SELECT nombre FROM usuarios WHERE usuario='alumno'").get().nombre,'Ana Gómez');
   assert.equal(restaurada.prepare("SELECT nombre FROM usuarios WHERE usuario='alumna2'").get().nombre,'Carlos Mendoza');
   assert.equal(restaurada.prepare("SELECT clave_hash FROM usuarios WHERE usuario='alumno'").get().clave_hash,
    'e0fe5b8b47f325abff8f83a115ef952c44450bf8d80c5286a698bdfe4dedae1d');
   assert.equal(restaurada.prepare("SELECT hash_alg FROM usuarios WHERE usuario='alumno'").get().hash_alg,'sha256_legacy');
   assert.equal(restaurada.prepare('SELECT COUNT(*) n FROM sesiones').get().n,0);
   assert.equal(restaurada.prepare("SELECT nombre FROM usuarios u JOIN matriculas m ON m.usuario_id=u.id WHERE m.codigo='SOL-CARLOS-PREV'").get().nombre,'Carlos Mendoza');
   assert.equal(restaurada.prepare("SELECT nombre FROM usuarios u JOIN matriculas m ON m.usuario_id=u.id WHERE m.codigo='SOL-ANA-PREV'").get().nombre,'Ana Gómez');
   assert.equal(restaurada.prepare('SELECT COUNT(*) n FROM asistencia').get().n,1);
   assert.equal(restaurar(),null,'Ejecutar de nuevo no debe alterar las cuentas');
   assert.equal(restaurada.prepare('SELECT COUNT(*) n FROM matriculas').get().n,2);
   assert.equal(scryptSync(extra.alumna2,Buffer.from(restaurada.prepare("SELECT sal FROM usuarios WHERE usuario='alumna2'").get().sal,'hex'),64).toString('hex'),
    restaurada.prepare("SELECT clave_hash FROM usuarios WHERE usuario='alumna2'").get().clave_hash);
  }finally{restaurada.close();}
 } finally {process.env.TP_DATA_DIR=rutaAnterior;fs.rmSync(anterior,{recursive:true,force:true});}
});
