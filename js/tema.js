// Aplica el tema guardado antes de que el navegador dibuje la página,
// para que no se vea el parpadeo al pasar de noche a día.
//
// Este archivo se carga en el <head> SIN defer ni async, a propósito:
// tiene que ejecutarse antes de que se pinte el body. Antes era un
// <script> escrito dentro del HTML, pero se sacó a un archivo aparte
// para poder prohibir los scripts inline en la política de seguridad.
document.documentElement.classList.add('preload');
try {
  if (localStorage.getItem('cecfa-theme') === 'day') {
    document.documentElement.classList.add('day-preload');
  }
} catch (e) {}
