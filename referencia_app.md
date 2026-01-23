# Referencia de la app HalteroAI

## Alcance
- `index.html`: app principal (Coach IA, Trayectoria y Comparador). Incluye UI, logica de camara y analisis.
- `ayuda.html`: guia de grabacion con tabla de contenidos y acceso de vuelta a `index.html`.

## Versionado
- La version vive en `index.html` (linea del menu principal).
- Por cada cambio menor, subir +0.1 (ej. 5.6 -> 5.7).
- Para cambios drasticos, subir +1.0 (ej. 5.6 -> 6.6).

## Changelog
- 5.7 (2026-01-23)
  - Ajustes de Coach IA: mejoras en alineacion de esqueleto con video.
  - Gestos configurables con confirmacion sonora/flash.
  - Boton para cambiar camara (frontal/trasera).

Formato sugerido:
- X.Y (YYYY-MM-DD)
  - Cambio 1
  - Cambio 2

## Mapa de codigo (index.html)

### Head y dependencias
- Meta tags PWA + safe-area.
- Tailwind, Font Awesome, Google Fonts (Roboto).
- MediaPipe Pose: `pose.js`, `camera_utils.js`, `drawing_utils.js`.

### UI / Layout (estructura principal)
- `#mainMenu`: menu con 4 modos (Coach IA, Trayectoria, Lado a Lado, Guia).
- `#workspaceHeader`: barra superior con titulo y selector de ejercicio.
- `#cameraWorkspace`: video/canvas + overlays + HUD + controles de reproduccion.
- `#compareWorkspace`: comparador de dos videos con controles de zoom/flip/seek.
- `#aiModal`: modal de resultados del analisis (score + observaciones).

### Estado y datos (JS)
- `isMobile`: deteccion de dispositivo.
- `DBHelper`: IndexedDB local (guardar resultados en movil).
- `app` (estado principal):
  - flags: `mode`, `isCameraActive`, `isRecording`, `isProcessing`, `isAppVisible`.
  - video/pose: `targetFps`, `stream`, `pose`, `frameData`, `barPath`.
  - UI comparador: `zoomLevels`, `flipStates`, `panOffsets`, `layoutMode`, `dragState`.
  - refs DOM: `video`, `canvas`, `ctx`.

### Ciclo de vida
- `init()`: inicializa DB, configura Pose, listeners de video/visibilidad, pan/drag y seek.
- `setMode(mode)`: resetea estado/DOM y muestra workspace correspondiente.
- `goHome()`: limpia recursos y recarga.
- `openHelp()`: navega a `ayuda.html`.

### Camara / Video
- `getCameraConstraints(useLow)`: define resolucion segun dispositivo.
- `startCamera()`: abre camara y prepara HUD.
- `handleFileUpload(input)`: carga video local y habilita controles.
- `resetInput()`: limpia video/estado y vuelve a overlay inicial.
- `toggleMainVideoPlay()` / `onSeekMain(val)`.
- `stopCamera()`, `cleanupMedia()`, `revokeMainObjectUrl()`.

### Procesamiento Pose
- `configurePose(mode)`: ajusta complejidad y confidencias.
- `startProcessing()` / `stopProcessing()` / `processFrame()`.
- `onPoseResults(results)`: enruta a `renderAI` o `renderPath`.

### Analisis AI
- `renderAI(lm)`: dibuja esqueleto y calcula angulos (rodilla, cadera, codo).
- `toggleRecording()`: inicia/parar captura de frames.
- `analyzeLift()`: reglas heuristicas + score + listado de fallos.
- `calculateAngle(a,b,c)`: angulo en grados.

### Trayectoria
- `renderPath(lm)`: traza camino promedio de munecas.
- `clearPath()`.

### Comparador
- `loadCompareVideo(side, input)`.
- `updateSeekUI(id)` / `onSeekInput(id, val)`.
- `toggleZoom(id)` / `toggleFlip(id)` / `applyTransform(id)`.
- `setupPanEvents(wrapperId, id)`.
- `toggleComparePlay()` / `toggleSinglePlay(id)` / `seekSingle(id, seconds)`.
- `toggleMaximize(targetId)` / `toggleLayout()` / `setSpeed(val)` / `seekCompare(seconds)`.

### Persistencia
- `DBHelper.saveLift({date,type,score,data})` (solo en movil).

### Flujos clave
- **Coach IA (AI)**: menu -> camara o video -> `processFrame` -> `renderAI` -> grabar -> `analyzeLift` -> modal.
- **Trayectoria (PATH)**: menu -> camara o video -> `renderPath` -> trazado de barra.
- **Comparador (COMPARE)**: cargar 2 videos -> controles de reproduccion/zoom/flip.

## Mapa de codigo (ayuda.html)
- Header con marca y descripcion.
- Tabla de contenidos (links internos).
- Secciones: guia general, sentadillas, clean, snatch, push/press, tirones.
- Tarjetas con pasos, mensajes correctos/incorrectos y consejos.
- Boton flotante de vuelta a `index.html`.

## Propuesta de mejoras (backlog inicial)

### 1) Analisis biomecanico (prioridad alta)
- Deteccion de fases (inicio, recepcion, salida) para reglas por fase.
- Separar reglas por ejercicio (no solo por keywords): thresholds especificos.
- Validacion de perfil (orientacion del cuerpo) y cuerpo completo en cuadro.
- Angulos adicionales: rodilla/torso, cadera/torso, tobillo, estabilidad de rodillas.
- Suavizado temporal (filtro) para evitar picos de ruido.
- Deteccion de reps y multiples intentos en un solo video.
- Medicion de velocidad (tiempo de fase) y control de estabilidad.

### 2) UX/UI (prioridad alta)
- Onboarding rapido con checklist (perfil, luz, cuerpo completo, distancia).
- Indicador de encuadre con overlay guia (rectangulo de cuerpo).
- Mensajes mas claros cuando no hay deteccion (causa + accion).
- Resultados con recomendaciones accionables por ejercicio.
- Mejor feedback en vivo (ej. profundidad, bloqueo, inclinacion).

### 3) Rendimiento y estabilidad (prioridad media)
- Usar `requestVideoFrameCallback` si esta disponible (mejor sincronizacion).
- Evitar resetear `canvas.width/height` en cada frame si no cambia el video.
- Cachear selecciones DOM usadas en loops frecuentes.
- Ajustar `targetFps` dinamico por carga/dispositivo.

### 4) Arquitectura y mantenimiento (prioridad media)
- Extraer configuracion a un objeto `rules/thresholds` por ejercicio.
- Separar JS y CSS en archivos dedicados para mantenimiento.
- Normalizar textos y evitar codificacion incorrecta (UTF-8 consistente).

### 5) Funciones nuevas (prioridad baja)
- Historial local de sesiones con comparacion de scores.
- Exportar datos (CSV/JSON) desde IndexedDB.
- Modo entrenamiento: metas y recordatorios.

## Observacion
- En el HTML aparecen textos con mojibake (ej. "AN?LISIS").
  Recomendado: guardar archivos como UTF-8 real y revisar el editor.
