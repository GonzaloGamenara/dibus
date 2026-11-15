# Dibus ✏️ — ¿Quién dibuja mejor?

PWA para iPhone (y cualquier celular): sortea personajes al azar, cronometra y lleva el puntaje. Gana el que mejor dibuja.
Sin build ni dependencias: es HTML/CSS/JS estático.

## Cómo se juega
1. Sumá jugadores (o jugá libre sin jugadores).
2. Elegí cuántos personajes, el tiempo para dibujar y la pausa entre personajes.
3. Cada uno dibuja en su hoja. Al terminar el tiempo se muestran los dibus y se vota (cada ronda o al final).

## Deploy en Vercel
Importá el repo en Vercel y listo: `vercel.json` ya apunta a `public/` y no hay build.
Después, en el iPhone: Safari → Compartir → **Agregar a pantalla de inicio**.

## Editar el catálogo
`public/data.js`: una línea por personaje, `Nombre|Origen` (el origen es opcional).
También se pueden crear categorías propias desde la app (pestaña Categorías).

## Notas
- Si cambiás archivos de `public/`, subí `VERSION` en `public/sw.js` para que los celulares actualicen el caché.
- Para regenerar los íconos: `node tools/make-icons.js` (requiere Playwright).
