# Huellas del Valle · Sistema de agendamiento de citas

Parcial de **Seminario de Actualización (UNIAJC, 2026-2)** · Cristian Marin

Sistema web propio para la Clínica Veterinaria Huellas del Valle S.A.S. (Cali). Agenda citas de perros y gatos validando el cupo de la franja en tiempo real y deja a Make la automatización de recordatorios.

## Vistas

| Vista | Qué hace |
|---|---|
| **Agendar cita** | Formulario (propietario, correo, mascota, especie, servicio, fecha, hora). Al enviar dispara el webhook del **Escenario 1** de Make y muestra lo que respondió el proceso: confirmada, con alerta, rechazada o ruta de respaldo. |
| **Agenda del día** | Citas de la fecha elegida con su resultado, estado y si ya se envió el recordatorio. |
| **Franjas y cupos** | Cupo, ocupados y libres de cada franja (`libres = cupo − ocupados`). |

## Arquitectura

```
Navegador (index.html)
   │  POST form-urlencoded
   ▼
Make · Escenario 1 (webhook instantáneo)
   consulta franja → calcula libres → router (confirmada / alerta / rechazada / respaldo) → Webhook response
   │
   ▼
Google Sheets: agenda · citas · incidencias  ◄── lectura pública (solo lector) desde las vistas
   ▲
Make · Escenario 2 (programado 7:00 a. m.)
   citas de mañana → recordatorio por correo a cada dueño → agregador → un solo resumen a la administración
```

- No hay backend propio: los datos viven en la misma hoja que usa Make.
- La página es un solo archivo HTML, sin dependencias ni compilación.

## Cómo ejecutarlo

Abrir `index.html` en el navegador, o visitar la versión publicada en GitHub Pages.

## Seguridad

El repositorio **no contiene tokens, claves ni contraseñas**. La URL del webhook es un punto de entrada público por diseño (cualquier formulario web la expone) y la hoja de cálculo se comparte solo en modo lectura.
