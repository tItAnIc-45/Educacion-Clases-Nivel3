import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.TP_DATA_DIR || path.join(process.cwd(), 'data'));
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(path.join(dataDir, 'tupluseduca.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=4000;');
db.exec(`
 CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL, correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  rol_id INTEGER NOT NULL REFERENCES roles(id), sal TEXT NOT NULL, clave_hash TEXT NOT NULL,
  hash_alg TEXT NOT NULL DEFAULT 'scrypt',
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)));
 CREATE TABLE IF NOT EXISTS cursos (
  id TEXT PRIMARY KEY, titulo TEXT NOT NULL, docente_id INTEGER REFERENCES usuarios(id));
 CREATE TABLE IF NOT EXISTS matriculas (
  id INTEGER PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  curso_id TEXT NOT NULL REFERENCES cursos(id), estado TEXT NOT NULL CHECK(estado IN ('pendiente','aprobada','rechazada')),
  codigo TEXT NOT NULL UNIQUE, creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(usuario_id,curso_id));
 CREATE TABLE IF NOT EXISTS horarios (
  id INTEGER PRIMARY KEY, curso_id TEXT NOT NULL REFERENCES cursos(id),
  dia INTEGER NOT NULL CHECK(dia BETWEEN 1 AND 7),
  inicio TEXT NOT NULL, fin TEXT NOT NULL, detalle TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS asistencia (
  id INTEGER PRIMARY KEY, matricula_id INTEGER NOT NULL REFERENCES matriculas(id),
  fecha TEXT NOT NULL, estado TEXT NOT NULL CHECK(estado IN ('presente','tarde','falta')),
  UNIQUE(matricula_id,fecha));
 -- Bandeja central del Nivel 3: solo matrículas CONFIRMADAS por Formspree.
 CREATE TABLE IF NOT EXISTS solicitudes_web (
  codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, correo TEXT NOT NULL,
  curso_id TEXT NOT NULL REFERENCES cursos(id),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada')),
  origen TEXT NOT NULL DEFAULT 'formspree',
  creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revisado TEXT, revisado_por INTEGER REFERENCES usuarios(id));
 CREATE INDEX IF NOT EXISTS idx_solicitudes_curso ON solicitudes_web(curso_id,estado);
 CREATE TABLE IF NOT EXISTS reportes_docente (
  id INTEGER PRIMARY KEY, curso_id TEXT NOT NULL REFERENCES cursos(id),
  fecha TEXT NOT NULL, docente_id INTEGER NOT NULL REFERENCES usuarios(id),
  presente INTEGER NOT NULL, tarde INTEGER NOT NULL, falta INTEGER NOT NULL,
  creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(curso_id,fecha,docente_id));
 CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS migraciones (
  codigo TEXT PRIMARY KEY, aplicada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS idx_matriculas_usuario ON matriculas(usuario_id);
 CREATE INDEX IF NOT EXISTS idx_asistencia_matricula ON asistencia(matricula_id);
 CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones(expira);
`);
// Las bases de la primera entrega N3 no contenían esta columna. No se borra ningún dato.
if (!db.prepare('PRAGMA table_info(usuarios)').all().some(col => col.name === 'hash_alg')) {
 db.exec("ALTER TABLE usuarios ADD COLUMN hash_alg TEXT NOT NULL DEFAULT 'scrypt'");
}

// Estos son hashes (NO contraseñas) tomados del auth.js del proyecto original.
// Solo se usan al recuperar las tres cuentas existentes. Tras el primer acceso
// válido, el servidor reemplaza automáticamente el hash heredado por scrypt.
const CUENTAS_ORIGINALES = Object.freeze({
 admin: {
  nombre: 'Administración', correo: 'admin@example.com', rol: 'admin',
  sal: 'c01c5bfc37327ebb',
  hash: '2d7ea31fa26cad87e10178836d2fb07f598ab7d0ecb117c47634368d4fb283f3'
 },
 docente: {
  nombre: 'Lucía Paredes', correo: 'docente@example.com', rol: 'docente',
  sal: 'cae717af0cc1702d',
  hash: '755841f90c118db4afc17d2fd16caa89afa15f4c76e0aa17622958a9a8e51918'
 },
 alumno: {
  nombre: 'Ana Gómez', correo: 'ana.gomez@ejemplo.com', rol: 'alumno',
  sal: '0526f40fd33e9e17',
  hash: 'e0fe5b8b47f325abff8f83a115ef952c44450bf8d80c5286a698bdfe4dedae1d'
 }
});
const MARCA = 'recuperar_cuentas_originales_n3_v1';
export function hashClave(clave, sal = randomBytes(16).toString('hex')) {
 return { sal, hash: scryptSync(clave, Buffer.from(sal, 'hex'), 64).toString('hex') };
}
function rolesIniciales() {
 const insert = db.prepare('INSERT OR IGNORE INTO roles(codigo) VALUES (?)');
 for (const rol of ['admin', 'docente', 'alumno']) insert.run(rol);
}
function marcarMigracion() {
 db.prepare('INSERT OR IGNORE INTO migraciones(codigo) VALUES (?)').run(MARCA);
}
function datosAcademicosIniciales() {
 const docenteId = db.prepare("SELECT id FROM usuarios WHERE usuario='docente'").get().id;
 const anaId = db.prepare("SELECT id FROM usuarios WHERE usuario='alumno'").get().id;
 const carlosId = db.prepare("SELECT id FROM usuarios WHERE usuario='alumna2'").get().id;
 const cursos = db.prepare('INSERT INTO cursos(id,titulo,docente_id) VALUES (?,?,?)');
 for (const [id,titulo] of [['web','Desarrollo web'],['datos','Excel y análisis de datos'],['diseno','Diseño gráfico'],['video','Edición de video'],['marketing','Marketing digital'],['emprende','Emprendimiento']]) {
  cursos.run(id,titulo,id === 'web' || id === 'diseno' ? docenteId : null);
 }
 const matriculas = db.prepare('INSERT INTO matriculas(usuario_id,curso_id,estado,codigo) VALUES (?,?,?,?)');
 // Se conservan los registros que la primera versión N3 había asignado a cada PERSONA.
 matriculas.run(carlosId,'web','aprobada','SOL-DEMO-CARLOS');
 matriculas.run(carlosId,'datos','pendiente','SOL-DEMO-PENDIENTE');
 matriculas.run(anaId,'diseno','aprobada','SOL-DEMO-ANA');
 const horario = db.prepare('INSERT INTO horarios(curso_id,dia,inicio,fin,detalle) VALUES (?,?,?,?,?)');
 horario.run('web',1,'19:00','21:00','Desarrollo Frontend');
 horario.run('web',3,'19:00','21:00','Desarrollo Frontend');
 horario.run('web',5,'19:00','21:00','Talleres prácticos');
 horario.run('diseno',2,'17:00','19:00','Diseño visual');
 horario.run('diseno',4,'17:00','19:00','Proyecto de diseño');
 const a = db.prepare('INSERT INTO asistencia(matricula_id,fecha,estado) VALUES (?,?,?)');
 const carlosMatricula = db.prepare("SELECT id FROM matriculas WHERE codigo='SOL-DEMO-CARLOS'").get().id;
 const anaMatricula = db.prepare("SELECT id FROM matriculas WHERE codigo='SOL-DEMO-ANA'").get().id;
 for (let i=0;i<13;i++) {
  const d=new Date(Date.UTC(2026,9,2+i));
  a.run(carlosMatricula,d.toISOString().slice(0,10),i===12?'falta':'presente');
 }
 for (let i=0;i<5;i++) a.run(anaMatricula,`2026-10-${String(i+10).padStart(2,'0')}`,i===2?'falta':'presente');
}

function crearDatosIniciales() {
 const credenciales = {};
 db.exec('BEGIN');
 try {
  rolesIniciales();
  const ins = db.prepare('INSERT INTO usuarios(usuario,nombre,correo,rol_id,sal,clave_hash,hash_alg) VALUES (?,?,?,(SELECT id FROM roles WHERE codigo=?),?,?,?)');
  for(const [usuario,datos] of Object.entries(CUENTAS_ORIGINALES)) {
   ins.run(usuario,datos.nombre,datos.correo,datos.rol,datos.sal,datos.hash,'sha256_legacy');
  }
  // La cuarta cuenta fue creada en N3, por eso su contraseña sí es nueva.
  const clave = randomBytes(12).toString('base64url');
  const {sal,hash} = hashClave(clave);
  ins.run('alumna2','Carlos Mendoza','carlos.mendoza@example.com','alumno',sal,hash,'scrypt');
  credenciales.alumna2=clave;
  datosAcademicosIniciales();
  marcarMigracion();
  db.exec('COMMIT');
  return credenciales;
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}

function migrarBaseN3Anterior() {
 if (db.prepare('SELECT 1 FROM migraciones WHERE codigo=?').get(MARCA)) return null;
 // Migración conservadora: únicamente se modifica la distribución EXACTA de
 // las cuatro cuentas demostrativas de la primera versión del Nivel 3.
 const original = db.prepare('SELECT id, usuario, nombre FROM usuarios').all();
 const actual = Object.fromEntries(original.map(x=>[x.usuario,x]));
 if (!(original.length===4 && actual.admin?.nombre==='Administración' &&
       actual.docente?.nombre==='Lucía Paredes' &&
       actual.alumno?.nombre==='Carlos Mendoza' &&
       actual.alumna2?.nombre==='Ana Gómez')) {
  console.warn('Se detectó una base de datos preexistente con cuentas distintas a las de demostración N3. No se alteraron los usuarios; revisa la migración manualmente.');
  return null;
 }
 const credenciales={};
 db.exec('BEGIN');
 try {
  // Intercambiar los nombres de USUARIO, no los IDs: las matrículas siguen
  // asociadas a Carlos y Ana correctamente, aunque cambien sus accesos.
  db.prepare('UPDATE usuarios SET usuario=? WHERE id=?').run('__migracion_carlos',actual.alumno.id);
  db.prepare('UPDATE usuarios SET usuario=? WHERE id=?').run('alumno',actual.alumna2.id);
  db.prepare('UPDATE usuarios SET usuario=? WHERE id=?').run('alumna2',actual.alumno.id);
  const restaurar=db.prepare('UPDATE usuarios SET nombre=?,correo=?,sal=?,clave_hash=?,hash_alg=? WHERE usuario=?');
  for(const [usuario,datos] of Object.entries(CUENTAS_ORIGINALES)) {
   restaurar.run(datos.nombre,datos.correo,datos.sal,datos.hash,'sha256_legacy',usuario);
  }
  // A la cuenta adicional se le entrega una nueva clave en vez de reutilizar
  // inadvertidamente la contraseña que antes pertenecía a 'alumno'.
  const clave=randomBytes(12).toString('base64url');
  const {sal,hash}=hashClave(clave);
  db.prepare('UPDATE usuarios SET nombre=?,correo=?,sal=?,clave_hash=?,hash_alg=? WHERE usuario=?')
   .run('Carlos Mendoza','carlos.mendoza@example.com',sal,hash,'scrypt','alumna2');
  credenciales.alumna2=clave;
  // Invalidar las sesiones de la configuración anterior (roles/datos cambiaron).
  db.prepare('DELETE FROM sesiones').run();
  marcarMigracion();
  db.exec('COMMIT');
  return credenciales;
 }catch(e){db.exec('ROLLBACK');throw e;}
}

export function prepararDatos() {
 if (db.prepare('SELECT COUNT(*) n FROM usuarios').get().n > 0) return migrarBaseN3Anterior();
 return crearDatosIniciales();
}
