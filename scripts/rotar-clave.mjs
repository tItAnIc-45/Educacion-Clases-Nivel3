/* Solo administración local de la demostración. No exponer vía HTTP ni subir contraseñas. */
import { db, hashClave } from '../server/db.mjs';
import { randomBytes } from 'node:crypto';
const usuario=process.argv[2]?.trim().toLowerCase();
if(!usuario || !/^[a-z0-9_-]{2,40}$/.test(usuario)) {
 console.error('Uso: npm run clave:demo -- alumno');process.exitCode=1;
} else {
 const fila=db.prepare('SELECT id FROM usuarios WHERE usuario=?').get(usuario);
 if(!fila){console.error('Cuenta inexistente. Inicia el servidor primero para crear los datos de ejemplo.');process.exitCode=1;}
 else {
  const clave=randomBytes(12).toString('base64url');
  const {sal,hash}=hashClave(clave);
  db.prepare("UPDATE usuarios SET sal=?,clave_hash=?,hash_alg='scrypt' WHERE id=?").run(sal,hash,fila.id);
  db.prepare('DELETE FROM sesiones WHERE usuario_id=?').run(fila.id);
  console.log(`Nueva clave de ${usuario}: ${clave}\nGuárdala fuera del repositorio. Las sesiones anteriores se cerraron.`);
 }
}
db.close();
