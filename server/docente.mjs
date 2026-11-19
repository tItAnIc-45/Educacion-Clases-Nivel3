/* Operaciones del Nivel 3 asignadas al módulo docente.
   Las solicitudes aceptadas por Formspree y la asistencia se guardan en SQLite.
   Ninguna consulta confía en el curso/rol indicado por el navegador. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORMAT_CODE = /^SOL-\d{4}-[A-F0-9]{12}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ESTADOS = new Set(['pendiente', 'aprobada', 'rechazada']);
const MARCAS = new Set(['presente', 'tarde', 'falta']);
const pendientes = new Map();
const limites = new Map();
function limitarEnvios(req) {
 const ip = req.socket.remoteAddress || 'local';
 const ahora = Date.now();
 const dato = limites.get(ip) || { desde: ahora, cantidad: 0 };
 if (ahora - dato.desde > 10*60*1000) { dato.desde=ahora;dato.cantidad=0; }
 dato.cantidad++;
 limites.set(ip,dato);
 if (dato.cantidad > 15) throw error(429, 'Demasiados intentos de matrícula. Intenta más tarde.');
 if (limites.size > 2000) for (const [clave, valor] of limites) if (ahora-valor.desde>10*60*1000) limites.delete(clave);
}
const fechaHoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); // Lima (UTC-5)
const enviar = (res, codigo, obj) => {
 res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
 res.end(JSON.stringify(obj));
};
function cuerpoJSON(req, maximo = 32768) {
 return new Promise((resolve, reject) => {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
   reject(Object.assign(new Error('Se requiere JSON.'), { status: 415 })); return;
  }
  let total = 0, chunks = [], terminado = false;
  req.on('data', b => {
   if (terminado) return;
   total += b.length;
   if (total > maximo) {
    terminado = true;
    reject(Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 }));
   } else chunks.push(b);
  });
  req.on('end', () => {
   if (terminado) return;
   try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
   catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
  });
  req.on('error', reject);
 });
}
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { status: estado });
function transaccion(fn) {
 db.exec('BEGIN IMMEDIATE');
 try { const resultado = fn(); db.exec('COMMIT'); return resultado; }
 catch (e) { db.exec('ROLLBACK'); throw e; }
}
function cursoAsignado(docente, curso) {
 if (typeof curso !== 'string' || curso.length > 80) throw error(400, 'Curso inválido.');
 const c = db.prepare('SELECT id, titulo FROM cursos WHERE id=? AND docente_id=?').get(curso, docente.id);
 if (!c) throw error(403, 'No tienes autorización para consultar este curso.');
 return c;
}
function cursosDocente(id) {
 return db.prepare('SELECT id,titulo FROM cursos WHERE docente_id=? ORDER BY titulo').all(id);
}
function destinoFormspree() {
 // Permite reutilizar la URL pública que el equipo YA configuró en Nivel 2.
 // No se solicitan contraseñas, API keys ni endpoints elegidos por el visitante.
 const config = fs.readFileSync(path.join(raiz, 'js', 'formularios-config.js'), 'utf8');
 const match = config.match(/\bmatricula\s*:\s*["'](https:\/\/formspree\.io\/f\/[A-Za-z0-9]+)["']/);
 if (!match) throw error(503, 'El canal de matrícula no está configurado.');
 return match[1];
}
function confirmarSolicitud(x) {
 const nombre = String(x.nombre ?? '').trim();
 const correo = String(x.email ?? '').trim().toLowerCase();
 const curso = String(x.programa_id ?? '');
 const codigo = String(x.codigo_solicitud ?? '');
 if (nombre.length < 3 || nombre.length > 100 || correo.length > 254 || !CORREO.test(correo) ||
     !FORMAT_CODE.test(codigo) || x.tipo_solicitud !== 'solicitud_matricula' || x.aceptacion !== 'Autorizó envío de datos para gestionar esta solicitud') {
  throw error(422, 'Revisa los datos de la solicitud.');
 }
 const c = db.prepare('SELECT id, titulo FROM cursos WHERE id=?').get(curso);
 if (!c) throw error(422, 'Selecciona un programa válido.');
 return { nombre, correo, curso, codigo, titulo: c.titulo };
}
async function matriculaPublica(req, res) {
 // Protección elemental contra abuso de la demostración (por IP) y reintentos
 // idempotentes por el mismo código. La API pública no concede ninguna cuenta.
 const x = await cuerpoJSON(req, 8192);
 const s = confirmarSolicitud(x);
 const previo = db.prepare('SELECT nombre,correo,curso_id FROM solicitudes_web WHERE codigo=?').get(s.codigo);
 if (previo) {
  if (previo.nombre !== s.nombre || previo.correo !== s.correo || previo.curso_id !== s.curso) throw error(409, 'El código corresponde a otra solicitud.');
  return enviar(res, 200, { ok: true, codigo: s.codigo, registro: 'ya_recibido' });
 }
 if (!pendientes.has(s.codigo)) {
  const operacion = (async () => {
   const url = destinoFormspree();
   const datos = new FormData();
   for (const [k, v] of Object.entries({
    nombre: s.nombre, email: s.correo, programa: s.titulo, programa_id: s.curso,
    tipo_solicitud: 'solicitud_matricula', codigo_solicitud: s.codigo,
    aceptacion: 'Autorizó envío de datos para gestionar esta solicitud',
    alcance: 'Solicitud recibida; matrícula/cupo pendiente de confirmación',
    _subject: `Solicitud de matrícula ${s.codigo}`
   })) datos.set(k, v);
   const abortar = new AbortController();
   const reloj = setTimeout(() => abortar.abort(), 13000);
   let respuesta;
   try { respuesta = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' }, body: datos, signal: abortar.signal }); }
   catch { throw error(502, 'No se pudo confirmar la entrega a Formspree. Comprueba el código antes de reintentar.'); }
   finally { clearTimeout(reloj); }
   let json = null;
   try { json = await respuesta.json(); } catch { /* respuesta de origen no verificable */ }
   if (!respuesta.ok || json?.ok !== true) throw error(respuesta.status >= 400 && respuesta.status < 500 ? 502 : 503, 'Formspree no confirmó la recepción de esta matrícula.');
   try {
    db.prepare(`INSERT OR IGNORE INTO solicitudes_web(codigo,nombre,correo,curso_id,estado,origen)
       VALUES (?,?,?,?, 'pendiente', 'formspree')`).run(s.codigo, s.nombre, s.correo, s.curso);
   } catch (e) {
    console.error('Formspree recibió la solicitud, pero falló el registro local:', e);
    throw error(503, `Formspree recibió el envío ${s.codigo}, pero no pudo registrarse en la bandeja local. Contacta al equipo.`);
   }
   return { ok: true, codigo: s.codigo, registro: 'recibido' };
  })();
  pendientes.set(s.codigo, operacion);
  void operacion.finally(() => pendientes.delete(s.codigo)).catch(() => {});
 }
 const resultado = await pendientes.get(s.codigo);
 return enviar(res, 200, resultado);
}
function bandeja(docente) {
 return db.prepare(`SELECT s.codigo,s.nombre,s.correo,s.curso_id cursoId,c.titulo curso,s.estado,s.creado,
     s.revisado,s.revisado_por
   FROM solicitudes_web s JOIN cursos c ON c.id=s.curso_id
   WHERE c.docente_id=? ORDER BY s.creado DESC,s.codigo DESC`).all(docente.id);
}
function actualizarEstado(docente, x) {
 const codigo = String(x.codigo || '');
 const estado = String(x.estado || '');
 if (!FORMAT_CODE.test(codigo) || !ESTADOS.has(estado)) throw error(422, 'Estado o solicitud inválidos.');
 return transaccion(() => {
  const s = db.prepare(`SELECT s.*, c.docente_id FROM solicitudes_web s
    JOIN cursos c ON c.id=s.curso_id WHERE s.codigo=?`).get(codigo);
  if (!s) throw error(404, 'No se encontró la solicitud.');
  if (s.docente_id !== docente.id) throw error(403, 'Solo puedes gestionar solicitudes de tus cursos.');
  if (s.estado === estado) return { codigo, estado, vinculado: false, sinCambios: true };
  db.prepare(`UPDATE solicitudes_web SET estado=?,revisado=CURRENT_TIMESTAMP,revisado_por=? WHERE codigo=?`)
    .run(estado,docente.id,codigo);
  // Se enlaza automáticamente solo si existe previamente una CUENTA de alumno
  // con ese correo. Nunca se crean claves ni cuentas públicas en silencio.
  const usuario = db.prepare(`SELECT u.id FROM usuarios u JOIN roles r ON r.id=u.rol_id
    WHERE u.correo=? AND r.codigo='alumno' AND u.activo=1`).get(s.correo);
  let vinculado = false;
  if (usuario) {
   const previa = db.prepare('SELECT id,codigo,estado FROM matriculas WHERE usuario_id=? AND curso_id=?')
     .get(usuario.id,s.curso_id);
   if (!previa && estado === 'aprobada') {
    db.prepare('INSERT INTO matriculas(usuario_id,curso_id,estado,codigo) VALUES (?,?,?,?)')
      .run(usuario.id,s.curso_id,'aprobada',codigo);
    vinculado=true;
   } else if (previa && previa.codigo === codigo) {
    db.prepare('UPDATE matriculas SET estado=? WHERE id=?').run(estado,previa.id);
    vinculado=true;
   } else if (previa?.estado === 'pendiente' && estado === 'aprobada') {
    // Matrícula anterior pendiente de la misma persona/curso, sin eliminar sus registros.
    db.prepare('UPDATE matriculas SET estado=?,codigo=? WHERE id=?')
      .run(estado,codigo,previa.id);
    vinculado=true;
   }
  }
  return { codigo, estado, vinculado, requiereCuenta: estado === 'aprobada' && !vinculado };
 });
}
function aula(docente, curso, fecha) {
 const c = cursoAsignado(docente,curso);
 const validaFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha+'T12:00:00Z'));
 if (!validaFecha || new Date(fecha+'T12:00:00Z').toISOString().slice(0,10)!==fecha || fecha > fechaHoy()) throw error(422, 'Fecha inválida.');
 const alumnos = db.prepare(`SELECT m.id matriculaId,u.nombre,u.correo,m.codigo,
   (SELECT estado FROM asistencia a WHERE a.matricula_id=m.id AND a.fecha=?) marca
   FROM matriculas m JOIN usuarios u ON u.id=m.usuario_id
   WHERE m.curso_id=? AND m.estado='aprobada' AND u.activo=1 ORDER BY u.nombre`).all(fecha,curso);
 const resumenAlumno = db.prepare(`SELECT COUNT(*) total,
   COALESCE(SUM(CASE WHEN estado='presente' THEN 1 ELSE 0 END),0) presente,
   COALESCE(SUM(CASE WHEN estado='tarde' THEN 1 ELSE 0 END),0) tarde,
   COALESCE(SUM(CASE WHEN estado='falta' THEN 1 ELSE 0 END),0) falta
   FROM asistencia WHERE matricula_id=?`);
 const detallados = alumnos.map(a => {
  const r = resumenAlumno.get(a.matriculaId);
  return { ...a, asistencia: { ...r, porcentaje: r.total ? Math.round((r.presente+r.tarde)*100/r.total):null } };
 });
 const historial = db.prepare(`SELECT a.fecha,
   SUM(CASE WHEN a.estado='presente' THEN 1 ELSE 0 END) presente,
   SUM(CASE WHEN a.estado='tarde' THEN 1 ELSE 0 END) tarde,
   SUM(CASE WHEN a.estado='falta' THEN 1 ELSE 0 END) falta
   FROM asistencia a JOIN matriculas m ON m.id=a.matricula_id
   WHERE m.curso_id=? AND m.estado='aprobada'
   GROUP BY a.fecha ORDER BY a.fecha DESC LIMIT 6`).all(curso);
 const porcentajes = detallados.map(x=>x.asistencia.porcentaje).filter(x=>x!==null);
 return { curso: c, fecha, alumnos: detallados, historial,
  promedio: porcentajes.length ? Math.round(porcentajes.reduce((a,b)=>a+b,0)/porcentajes.length):null };
}
function guardarAsistencia(docente, x) {
 const curso = String(x.curso || ''), fecha = String(x.fecha || '');
 // Centralizamos la comprobación de la fecha/permiso sin confiar en un alumnoId del cliente.
 const aulaActual = aula(docente,curso,fecha);
 const marcas = x.marcas;
 if (!Array.isArray(marcas) || marcas.length > 200) throw error(422, 'Listado de asistencia inválido.');
 const permitidos = new Set(aulaActual.alumnos.map(a=>a.matriculaId));
 const vistos = new Set();
 for (const m of marcas) {
  if (!Number.isInteger(m.matriculaId) || !permitidos.has(m.matriculaId) || vistos.has(m.matriculaId) || !MARCAS.has(m.estado))
   throw error(422, 'Una marca no corresponde a un alumno matriculado en tu curso.');
  vistos.add(m.matriculaId);
 }
 return transaccion(() => {
  db.prepare(`DELETE FROM asistencia WHERE fecha=? AND matricula_id IN
    (SELECT id FROM matriculas WHERE curso_id=? AND estado='aprobada')`).run(fecha,curso);
  const ins = db.prepare(`INSERT INTO asistencia(matricula_id,fecha,estado) VALUES(?,?,?)`);
  for (const m of marcas) ins.run(m.matriculaId,fecha,m.estado);
  return { ok: true, fecha, curso, guardadas: marcas.length };
 });
}
function enviarReporte(docente,x) {
 const curso = String(x.curso||''),fecha = String(x.fecha||'');
 const a = aula(docente,curso,fecha);
 const r = db.prepare(`SELECT
    SUM(CASE WHEN estado='presente' THEN 1 ELSE 0 END) presente,
    SUM(CASE WHEN estado='tarde' THEN 1 ELSE 0 END) tarde,
    SUM(CASE WHEN estado='falta' THEN 1 ELSE 0 END) falta
   FROM asistencia WHERE fecha=? AND matricula_id IN
   (SELECT id FROM matriculas WHERE curso_id=? AND estado='aprobada')`).get(fecha,curso);
 const cuenta=(r.presente||0)+(r.tarde||0)+(r.falta||0);
 if (!cuenta) throw error(422, 'Guarda al menos una asistencia antes de enviar el reporte.');
 db.prepare(`INSERT INTO reportes_docente(curso_id,fecha,docente_id,presente,tarde,falta)
   VALUES(?,?,?,?,?,?) ON CONFLICT(curso_id,fecha,docente_id) DO UPDATE SET
   presente=excluded.presente,tarde=excluded.tarde,falta=excluded.falta,creado=CURRENT_TIMESTAMP`)
  .run(curso,fecha,docente.id,r.presente||0,r.tarde||0,r.falta||0);
 return { ok:true,curso:a.curso.titulo,fecha,registrados:cuenta };
}
export async function atenderModulo(req,res,pathname,usuario,url) {
 if (pathname === '/api/public/matricula') {
  if (req.method!=='POST') { enviar(res,405,{error:'Método no permitido.'});return true; }
  try { limitarEnvios(req); await matriculaPublica(req,res); }
  catch(e) { enviar(res,e.status||500,{error:e.status ? e.message : 'Error interno del servidor.'}); if(!e.status) console.error(e); }
  return true;
 }
 const rutas = ['/api/docente/operativo','/api/docente/bandeja','/api/docente/aula','/api/docente/solicitud/estado','/api/docente/asistencia','/api/docente/reporte'];
 if (!rutas.includes(pathname)) return false;
 if (!usuario) { enviar(res,401,{error:'Inicia sesión para continuar.'});return true; }
 if (usuario.rol!=='docente') { enviar(res,403,{error:'403 Forbidden: acceso reservado al docente.'});return true; }
 try {
  if (pathname === '/api/docente/operativo' && req.method==='GET') enviar(res,200,{cursos:cursosDocente(usuario.id)});
  else if (pathname === '/api/docente/bandeja' && req.method==='GET') enviar(res,200,{solicitudes:bandeja(usuario)});
  else if (pathname === '/api/docente/aula' && req.method==='GET') enviar(res,200,aula(usuario,url.searchParams.get('curso')||'',url.searchParams.get('fecha')||fechaHoy()));
  else if (pathname === '/api/docente/solicitud/estado' && req.method==='POST') enviar(res,200,actualizarEstado(usuario,await cuerpoJSON(req)));
  else if (pathname === '/api/docente/asistencia' && req.method==='POST') enviar(res,200,guardarAsistencia(usuario,await cuerpoJSON(req)));
  else if (pathname === '/api/docente/reporte' && req.method==='POST') enviar(res,200,enviarReporte(usuario,await cuerpoJSON(req)));
  else enviar(res,405,{error:'Método no permitido.'});
 } catch(e) { if(!e.status) console.error('Error N3 docente:',e); enviar(res,e.status||500,{error:e.status?e.message:'Error interno del servidor.'}); }
 return true;
}
