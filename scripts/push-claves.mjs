// Genera las claves VAPID de las notificaciones push y las deja en .push-claves.json
// (ignorado por git) para subirlas como secretos a los dos Workers con `wrangler secret bulk`:
//
//   npm run push:claves
//   npx wrangler secret bulk .push-claves.json
//   npx wrangler secret bulk .push-claves.json -c wrangler.movil.jsonc
//
// Después se puede borrar el archivo. Si algún día se cambian las claves, cada dispositivo tiene
// que volver a activar los avisos en Perfil.
import { webcrypto as crypto } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const FILE = ".push-claves.json";
if (existsSync(FILE)) {
  console.error(`Ya existe ${FILE}. Bórralo primero si de verdad quieres claves nuevas.`);
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", pair.publicKey)).toString("base64url");
const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);

writeFileSync(FILE, JSON.stringify({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: d }, null, 2) + "\n", { mode: 0o600 });
console.log(`Listo: claves guardadas en ${FILE} (no se sube a git).`);
console.log("Ahora súbelas a los dos Workers:");
console.log(`  npx wrangler secret bulk ${FILE}`);
console.log(`  npx wrangler secret bulk ${FILE} -c wrangler.movil.jsonc`);
