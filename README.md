# GreenPulse v1.0

Versión enfocada en flujo y animaciones.

## Archivos

- `index.html`
- `style.css`
- `script.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icons/`

## Configuración

Abre `script.js` y reemplaza:

```js
const flowURL = "PEGA_AQUI_TU_URL_DE_POWER_AUTOMATE";
```

por tu URL real de Power Automate.

## Instalación como app

Para instalarla como PWA necesitas servirla desde HTTPS o localhost.

Opciones rápidas:
- VS Code + Live Server
- IIS interno con HTTPS
- SharePoint
- GitHub Pages
- Azure Static Web Apps


## Corrección v1.0.1

Se ajustó el envío a Power Automate usando `mode: "no-cors"` y `Content-Type: text/plain`.
Esto evita falsos errores cuando Power Automate recibe el POST, pero el navegador no deja leer la respuesta por CORS.

Si tu flujo usa `triggerBody()` en Power Automate, puede recibir el JSON como texto.
En ese caso agrega un paso `Parse JSON` usando el body recibido.


## Corrección v1.1 - Envío estable

Esta versión cambia la estrategia de envío:

1. Las respuestas NO se mandan mientras cambia cada pregunta.
2. Se guardan en memoria durante la encuesta.
3. Al finalizar, se envían todas a Power Automate, una por una, con una pequeña pausa entre llamadas.

Esto evita que Power Automate pierda respuestas por llamadas rápidas.

IMPORTANTE:
- Esta versión usa `Content-Type: application/json`.
- Tu flujo debe poder leer `triggerBody().questionNumber`, `triggerBody().question`, `triggerBody().answer`, `triggerBody().timestamp`, `triggerBody().comment`.
- Si Power Automate devuelve error CORS, agrega al final del flujo una acción "Response" con Status Code 200.
