// Aplica el tema antes de que el navegador dibuje la página, para que no se
// vea el parpadeo al pasar de noche a día.
//
// La regla es: si la persona ya eligió un tema con el interruptor, se respeta
// esa elección. Si nunca ha elegido, se sigue lo que tenga configurado su
// navegador o su sistema operativo.
//
// Este archivo se carga en el <head> SIN defer ni async, a propósito: tiene
// que ejecutarse antes de que se pinte el body. Está separado del HTML para
// poder prohibir los scripts inline en la política de seguridad.
document.documentElement.classList.add('preload');
try {
  var elegido = localStorage.getItem('cecfa-theme');
  var esDia = elegido
    ? elegido === 'day'
    : window.matchMedia('(prefers-color-scheme: light)').matches;
  if (esDia) {
    document.documentElement.classList.add('day-preload');
  }
} catch (e) {}
