# CECFA — Sitio web

Sitio institucional de la **Coordinadora de Estudiantes de Ciencias Físicas y Astronómicas**,
organización nacional de estudiantes de pregrado en Chile que organiza congresos, workshops y
conversatorios de divulgación científica.

> 🚧 **En desarrollo.** La estructura y el diseño están terminados, pero **el sitio todavía no
> está publicado**: faltan contenidos reales sobre integrantes, reseñas y documentos. El
> repositorio incluye un [verificador de pendientes](#antes-de-publicar) que los detecta.

---

## Estructura

Sitio estático, sin frameworks ni proceso de compilación: HTML, CSS y JavaScript sin
dependencias. Se sirve tal cual desde cualquier alojamiento estático.

| Página | Contenido |
|---|---|
| `index.html` | Portada: presentación, estadísticas, historia de los congresos, reseñas e inscripciones |
| `nosotros.html` | Qué es la organización y cómo funciona |
| `miembros.html` | Directiva, comisión de ética, representantes, colaborantes y seniors |
| `universidades.html` | Casas de estudio participantes |
| `noticias.html` | Novedades internas y de divulgación científica |
| `contacto.html` | Vías de contacto y documentos |
| `404.html` | Página de error |

```
css/styles.css      Hoja de estilos completa, con temas día y noche
js/main.js          Toda la interactividad del sitio
img/                Recursos gráficos
scripts/            Herramientas de mantenimiento
```

---

## Interactividad

Todo está implementado a mano en [`js/main.js`](./js/main.js), sin librerías externas:

| Función | Descripción |
|---|---|
| **Campo de estrellas** | Canvas con estrellas en coordenadas de *página*, no de pantalla: al hacer scroll se recorre el cielo. Cada estrella tiene su propio parpadeo y deriva. |
| **Phi orbital** | Logo SVG con dos órbitas que giran a velocidad crucero y aceleran suavemente al pasar el cursor, con el símbolo meciéndose sobre su base. |
| **Scroll suave** | Implementado con `requestAnimationFrame` y una curva de suavizado cúbica, descontando la altura de la barra de navegación. |
| **Revelado al scroll** | `IntersectionObserver` que muestra cada sección al entrar en pantalla. |
| **Contadores animados** | Las cifras de la portada suben desde cero al hacerse visibles. |
| **Cuenta regresiva** | Lee la fecha del atributo `data-deadline` y se actualiza cada segundo. |
| **Tema día / noche** | Preferencia guardada en `localStorage` y aplicada antes del primer pintado, para que no haya parpadeo al cargar. |

### Accesibilidad

El sitio respeta `prefers-reduced-motion`. Cuando el sistema operativo pide reducir el
movimiento, las estrellas se dibujan estáticas —sin parpadeo ni deriva, redibujándose solo al
hacer scroll—, las secciones aparecen ya visibles y los contadores muestran su valor final de
inmediato. La cuenta regresiva se mantiene, por tratarse de información y no de decoración.

---

## Ver el sitio localmente

No requiere instalación. Basta servir la carpeta con cualquier servidor estático:

```bash
python -m http.server 8080
```

Y abrir [http://localhost:8080](http://localhost:8080).

> Abrir los archivos con doble clic (`file://`) también funciona en su mayor parte, pero es
> preferible un servidor local para que las rutas se comporten igual que en producción.

---

## Antes de publicar

El repositorio incluye un verificador que recorre el HTML en busca de contenido de relleno que
no debe llegar al sitio público:

```bash
node scripts/revisar-pendientes.js
```

Revisa cinco categorías —reseñas ficticias, personas sin datos, fotografías pendientes,
documentos no subidos y enlaces sin destino— e informa archivo y línea de cada caso. Devuelve
código de salida distinto de cero si encuentra algo, de modo que puede encadenarse como paso
previo al despliegue.

**Estado actual: 42 elementos pendientes.**

| Categoría | Cantidad | Qué falta |
|---|---|---|
| Fotografías | 15 | Retratos de integrantes, o quitar la etiqueta `<img>` |
| Personas sin datos | 12 | Nombre, rol y universidad de comisión de ética, colaborantes y seniors |
| Documentos | 6 | El PDF de los estatutos, enlazado desde el pie de todas las páginas |
| Reseñas | 5 | Testimonios reales de asistentes a congresos y workshops |
| Enlaces de noticias | 4 | Destino de cada novedad |

---

## Tecnologías

HTML5 · CSS3 · JavaScript sin dependencias · Canvas API · IntersectionObserver
