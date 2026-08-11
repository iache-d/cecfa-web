#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
buscar-noticias.py — busca material reciente de física y astronomía.

Cómo se usa
-----------
    python tools/buscar-noticias.py

Deja dos archivos en tools/:

    candidatos.json  → los resultados en crudo (para procesar con código)
    candidatos.md    → los mismos resultados en texto, listos para pegárselos
                       a Claude y pedirle que redacte los resúmenes en español

Después, con los resúmenes redactados, se editan a mano las entradas de
data/noticias.js y la página de Noticias se actualiza sola.

Opciones
--------
    --dias 14        cuántos días hacia atrás mirar (por defecto 14)
    --por-fuente 4   cuántas noticias tomar de cada fuente (por defecto 4)

Usa solo la biblioteca estándar. La única excepción: si Python se queja de
certificados HTTPS (le pasa al Python de MSYS2), hay que correr una vez
`pip install certifi` y listo.
"""

import argparse
import json
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

AQUI = Path(__file__).resolve().parent

USER_AGENT = "CECFA-web/1.0 (script de noticias de una organizacion estudiantil)"
TIMEOUT = 20

# ---------------------------------------------------------------------------
# Fuentes
# ---------------------------------------------------------------------------

# Medios de divulgación (RSS). Si alguno se cae o cambia de dirección,
# el script lo salta y avisa, sin romperse.
FEEDS = [
    ("ESO (Chile)",     "Astronomía",  "https://www.eso.org/public/chile/news/feed/"),
    ("NASA",            "Astronomía",  "https://www.nasa.gov/news-release/feed/"),
    ("Phys.org · Space","Astronomía",  "https://phys.org/rss-feed/space-news/"),
    ("Phys.org · Física","Física",     "https://phys.org/rss-feed/physics-news/"),
    ("CERN",            "Partículas",  "https://home.cern/api/news/news/feed.rss"),
    ("APS Physics",     "Física",      "https://physics.aps.org/feeds/rss/news.xml"),
]

# Artículos nuevos en arXiv, por área.
ARXIV = [
    ("Astronomía",       "astro-ph.GA OR astro-ph.SR OR astro-ph.EP"),
    ("Cosmología",       "astro-ph.CO"),
    ("Altas energías",   "hep-ph OR hep-ex"),
    ("Gravitación",      "gr-qc"),
    ("Materia condensada", "cond-mat.mes-hall OR cond-mat.supr-con"),
    ("Cuántica y óptica", "quant-ph OR physics.optics"),
]

ARXIV_API = (
    "http://export.arxiv.org/api/query"
    "?search_query=cat:({cats})"
    "&sortBy=submittedDate&sortOrder=descending&max_results={n}"
)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def contexto_ssl():
    """
    El Python de MSYS2 viene sin certificados, así que la verificación de
    HTTPS falla con todo. Si está instalado certifi lo usamos; si no,
    avisamos con la instrucción exacta para arreglarlo.
    """
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats().get("x509_ca", 0) > 0:
        return ctx
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        print("Tu instalación de Python no tiene certificados para verificar HTTPS.")
        print("Se arregla una sola vez con:\n")
        print("    pip install certifi\n")
        sys.exit(1)


def bajar(url, ctx):
    pedido = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(pedido, timeout=TIMEOUT, context=ctx) as r:
        return r.read()


def limpiar(texto, largo=420):
    """Quita etiquetas HTML y espacios de más."""
    if not texto:
        return ""
    texto = re.sub(r"<[^>]+>", " ", texto)
    texto = (texto.replace("&nbsp;", " ").replace("&amp;", "&")
                  .replace("&lt;", "<").replace("&gt;", ">")
                  .replace("&quot;", '"').replace("&#39;", "'"))
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto[:largo] + ("…" if len(texto) > largo else "")


def fecha_rss(texto):
    if not texto:
        return None
    try:
        f = parsedate_to_datetime(texto)
    except (TypeError, ValueError):
        try:
            f = datetime.fromisoformat(texto.replace("Z", "+00:00"))
        except ValueError:
            return None
    if f.tzinfo is None:
        f = f.replace(tzinfo=timezone.utc)
    return f


# ---------------------------------------------------------------------------
# Lectores
# ---------------------------------------------------------------------------

def leer_rss(nombre, area, url, desde, tope, ctx):
    datos = bajar(url, ctx)
    raiz = ET.fromstring(datos)
    salida = []

    # RSS 2.0 (<item>) y Atom (<entry>) en el mismo saco
    items = raiz.iter("item")
    for item in items:
        titulo = (item.findtext("title") or "").strip()
        enlace = (item.findtext("link") or "").strip()
        resumen = item.findtext("description") or ""
        fecha = fecha_rss(item.findtext("pubDate"))
        if not titulo or not enlace:
            continue
        if fecha and fecha < desde:
            continue
        salida.append({
            "titulo": limpiar(titulo, 200),
            "enlace": enlace,
            "resumen_original": limpiar(resumen),
            "fecha": fecha.date().isoformat() if fecha else "",
            "fuente": nombre,
            "area": area,
        })
        if len(salida) >= tope:
            break
    return salida


def leer_arxiv(area, categorias, desde, tope, ctx):
    ns = {"a": "http://www.w3.org/2005/Atom"}
    url = ARXIV_API.format(cats=urllib.parse.quote(categorias), n=tope * 2)
    raiz = ET.fromstring(bajar(url, ctx))
    salida = []

    for entrada in raiz.findall("a:entry", ns):
        titulo = (entrada.findtext("a:title", "", ns) or "").strip()
        enlace = (entrada.findtext("a:id", "", ns) or "").strip()
        resumen = entrada.findtext("a:summary", "", ns) or ""
        fecha = fecha_rss(entrada.findtext("a:published", "", ns))
        autores = [a.findtext("a:name", "", ns) for a in entrada.findall("a:author", ns)]

        if not titulo or (fecha and fecha < desde):
            continue
        salida.append({
            "titulo": limpiar(titulo, 200),
            "enlace": enlace,
            "resumen_original": limpiar(resumen),
            "fecha": fecha.date().isoformat() if fecha else "",
            "fuente": "arXiv",
            "area": area,
            "autores": ", ".join(autores[:3]) + (" et al." if len(autores) > 3 else ""),
        })
        if len(salida) >= tope:
            break
    return salida


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------

PLANTILLA_MD = """# Candidatos a noticia — {hoy}

Buscado en los últimos {dias} días. {total} resultados.

Instrucciones para Claude:

> De esta lista elige las 3 o 4 noticias más interesantes para estudiantes de
> pregrado de física y astronomía en Chile, procurando que no sean todas del
> mismo área. Para cada una redacta en español, en tono divulgativo y sin
> tecnicismos innecesarios: un titular propio de menos de 90 caracteres y un
> resumen de 1 o 2 líneas. Después entrégamelas ya escritas como entradas
> listas para pegar en data/noticias.js.

---

{cuerpo}
"""


def escribir_md(items, dias, destino):
    bloques = []
    for i, it in enumerate(items, 1):
        lineas = [
            f"## {i}. {it['titulo']}",
            "",
            f"- **Área:** {it['area']}",
            f"- **Fuente:** {it['fuente']}",
            f"- **Fecha:** {it['fecha'] or 'sin fecha'}",
            f"- **Enlace:** {it['enlace']}",
        ]
        if it.get("autores"):
            lineas.append(f"- **Autores:** {it['autores']}")
        lineas += ["", it["resumen_original"] or "_(sin resumen)_", ""]
        bloques.append("\n".join(lineas))

    destino.write_text(
        PLANTILLA_MD.format(
            hoy=datetime.now().date().isoformat(),
            dias=dias,
            total=len(items),
            cuerpo="\n".join(bloques),
        ),
        encoding="utf-8",
    )


def main():
    p = argparse.ArgumentParser(description="Busca noticias recientes de física y astronomía.")
    p.add_argument("--dias", type=int, default=14, help="cuántos días hacia atrás mirar")
    p.add_argument("--por-fuente", type=int, default=4, help="cuántas noticias tomar de cada fuente")
    args = p.parse_args()

    desde = datetime.now(timezone.utc) - timedelta(days=args.dias)
    ctx = contexto_ssl()
    todo = []

    print(f"Buscando noticias de los últimos {args.dias} días...\n")

    for nombre, area, url in FEEDS:
        try:
            encontrado = leer_rss(nombre, area, url, desde, args.por_fuente, ctx)
            todo.extend(encontrado)
            print(f"  [ok]    {nombre:<20} {len(encontrado)} noticias")
        except (urllib.error.URLError, urllib.error.HTTPError, ET.ParseError, OSError) as e:
            print(f"  [falló] {nombre:<20} {type(e).__name__}: {e}")

    for area, categorias in ARXIV:
        try:
            encontrado = leer_arxiv(area, categorias, desde, args.por_fuente, ctx)
            todo.extend(encontrado)
            print(f"  [ok]    {'arXiv · ' + area:<20} {len(encontrado)} artículos")
        except (urllib.error.URLError, urllib.error.HTTPError, ET.ParseError, OSError) as e:
            print(f"  [falló] {'arXiv · ' + area:<20} {type(e).__name__}: {e}")

    todo.sort(key=lambda x: x["fecha"], reverse=True)

    (AQUI / "candidatos.json").write_text(
        json.dumps(todo, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    escribir_md(todo, args.dias, AQUI / "candidatos.md")

    print(f"\n{len(todo)} resultados guardados en:")
    print("  tools/candidatos.json")
    print("  tools/candidatos.md   <- este es el que le pasas a Claude")

    if not todo:
        print("\nNo se encontró nada. Prueba con --dias 30.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
