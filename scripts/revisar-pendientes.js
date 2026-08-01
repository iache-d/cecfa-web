#!/usr/bin/env node
/**
 * Revisor de contenido pendiente — CECFA
 *
 * Recorre los archivos .html del sitio buscando marcadores de relleno que no deben
 * llegar a producción: nombres de ejemplo, reseñas ficticias, enlaces vacíos y
 * documentos aún no subidos.
 *
 * Uso:   node scripts/revisar-pendientes.js
 *
 * Devuelve código de salida 1 si encuentra pendientes, de modo que puede usarse
 * como paso previo al despliegue.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

const REGLAS = [
  {
    grupo: 'Reseñas de relleno',
    patron: /Persona Inventada|Alguien Pendiente|Nadie Todavía|Universidad de la Luna|Universidad de Marte|Vacío Cuántico|CAMBIAR ANTES DE PUBLICAR|reseña (?:de mentira|falsa)/i,
    detalle: 'Reemplazar por testimonios reales de asistentes.',
  },
  {
    grupo: 'Personas sin datos',
    patron: /Nombre Apellido|Universidad — Carrera|Rol \(período\)/,
    detalle: 'Completar con el nombre, rol y universidad de cada integrante.',
  },
  {
    grupo: 'Fotografías pendientes',
    patron: /placeholder-avatar\.svg/,
    detalle: 'Sustituir por la foto de la persona, o borrar la etiqueta <img>.',
  },
  {
    grupo: 'Documentos no subidos',
    patron: /pagina-que-no-existe\.html/,
    detalle: 'Enlazar el PDF real (por ejemplo, los estatutos).',
  },
  {
    grupo: 'Enlaces sin destino',
    patron: /href="#"/,
    detalle: 'Apuntar a la noticia o recurso correspondiente.',
  },
  {
    grupo: 'Títulos de ejemplo',
    patron: /Título de otra noticia|Título de noticia científica|Otra noticia astro-física/i,
    detalle: 'Escribir el titular real de la noticia.',
  },
];

function archivosHtml(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entrada) => {
      if (entrada.isDirectory()) {
        if (['.git', 'node_modules', 'scripts'].includes(entrada.name)) return [];
        return archivosHtml(path.join(dir, entrada.name));
      }
      return entrada.name.endsWith('.html') ? [path.join(dir, entrada.name)] : [];
    });
}

const hallazgos = new Map();
let total = 0;

for (const archivo of archivosHtml(RAIZ)) {
  const lineas = fs.readFileSync(archivo, 'utf8').split(/\r?\n/);
  lineas.forEach((linea, i) => {
    for (const regla of REGLAS) {
      if (regla.patron.test(linea)) {
        if (!hallazgos.has(regla.grupo)) hallazgos.set(regla.grupo, { detalle: regla.detalle, items: [] });
        hallazgos.get(regla.grupo).items.push({
          archivo: path.relative(RAIZ, archivo),
          linea: i + 1,
          texto: linea.trim().slice(0, 90),
        });
        total++;
        break;
      }
    }
  });
}

if (total === 0) {
  console.log('Sin contenido pendiente. El sitio puede publicarse.');
  process.exit(0);
}

console.log(`\nSe encontraron ${total} elementos pendientes:\n`);

for (const [grupo, { detalle, items }] of hallazgos) {
  console.log(`  ${grupo}  (${items.length})`);
  console.log(`  ${'-'.repeat(grupo.length + 6)}`);
  console.log(`  ${detalle}\n`);

  const porArchivo = new Map();
  for (const it of items) {
    if (!porArchivo.has(it.archivo)) porArchivo.set(it.archivo, []);
    porArchivo.get(it.archivo).push(it);
  }
  for (const [archivo, lista] of porArchivo) {
    const lineas = lista.map((l) => l.linea).join(', ');
    console.log(`    ${archivo}  →  línea${lista.length > 1 ? 's' : ''} ${lineas}`);
  }
  console.log();
}

console.log('Revisa cada punto antes de publicar el sitio.\n');
process.exit(1);
