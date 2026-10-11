# Huellas del Valle · Sistema de agendamiento de citas

Parcial 1 · Seminario de Actualización (UNIAJC, 2026-2) · **Cristian Marin**

Interfaz propia (HTML, CSS y JavaScript, sin frameworks ni backend) para la Clínica Veterinaria Huellas del Valle S.A.S.
Es el punto de entrada del **Escenario 1** de Make: envía la solicitud al webhook y muestra lo que el proceso respondió.

**Sistema publicado:** https://marin1106.github.io/huellas-del-valle/

## Vistas

| Vista | Qué hace |
|---|---|
| **Agendar cita** | Formulario con los 7 campos de la solicitud (propietario, correo, mascota, especie, servicio, fecha, hora). Dispara el webhook del Escenario 1 y muestra la respuesta: confirmada, confirmada con alerta, rechazada o ruta de respaldo. |
| **Agenda del día** | Citas de la fecha elegida con su hora, mascota, servicio, propietario, resultado, estado y si ya se envió el recordatorio. |
| **Franjas y cupos** (opcional) | Cupo, ocupados y libres de cada franja, con la ocupación del día. |

La página **no decide** si hay cupo: el cálculo `libres = cupo − ocupados` y el enrutamiento viven en el Escenario 1.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de las vistas |
| `styles.css` | Estilos (adaptado a celular) |
| `app.js` | Envío al webhook, lectura de la hoja y pintado de las vistas |
| `config.js` | **Único archivo que se edita:** URL del webhook e ID de la hoja |

## Arquitectura

```
Navegador (index.html + app.js)
   │  POST application/x-www-form-urlencoded (sin preflight CORS)
   ▼
Make · Escenario 1 (webhook instantáneo)
   consulta franja → libres = cupo − ocupados → router (confirmada / alerta / rechazada / respaldo) → Webhook response (JSON)
   │
   ▼
Google Sheets: agenda · citas · incidencias  ◄── las vistas la leen con JSONP de Google Visualization (solo lectura)
   ▲
Make · Escenario 2 (programado 7:00 a. m.)
   citas de mañana → recordatorio a cada dueño → agregador → un solo resumen a la administración
```

**Lo que envía la página:** `propietario, correo, mascota, especie, servicio, fecha (AAAA-MM-DD), hora (HH:MM)`.
**Lo que responde Make:** `{"resultado": "CONFIRMADA | CONFIRMADA_ALERTA | RECHAZADA | RESPALDO", "mensaje": "...", "libres": n, "id_cita": "..."}`.

## Cómo ejecutarlo

Abrir el enlace publicado, o abrir `index.html` en el navegador. No necesita instalar nada.

## Seguridad

El repositorio no contiene tokens, claves ni contraseñas. La URL del webhook es un punto de entrada público por diseño y la hoja de cálculo se comparte solo en modo lectura.
