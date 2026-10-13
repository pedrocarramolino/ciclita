# Ciclita · Registro menstrual

Aplicación web progresiva (PWA) para registrar el ciclo menstrual de forma rápida y privada: calendario, registro diario, predicciones, estadísticas y recordatorios. Se instala en el móvil como una app más y funciona sin conexión.

> **Aviso:** esta app no es un método anticonceptivo ni sustituye el consejo médico. Las predicciones son estimaciones.

## Funcionalidades

- **Inicio**: "Tu periodo empieza en X días" / "Día X de tu periodo" y botones grandes de *Ha empezado* / *Ha terminado mi periodo*.
- **Calendario** mensual con días de periodo, periodos previstos, ventana fértil y ovulación estimadas, con leyenda.
- **Registro diario** (todo opcional): flujo, síntomas (también personalizados), estado de ánimo, dolor 0–10, medicación y notas.
- **Predicciones**: medias de los últimos 6 ciclos (28/5 días por defecto), próximos 3 periodos y ventana fértil.
- **Estadísticas**: gráfica de los últimos ciclos, medias, ciclo más corto y más largo, síntomas frecuentes por fase y aviso suave si los ciclos varían más de 7 días.
- **Recordatorios** por notificación push: antes del próximo periodo, registro diario y píldora anticonceptiva.
- **Privacidad**: PIN de 4 dígitos, exportar/importar (JSON y CSV) y borrado total con doble confirmación.
- Tema claro / oscuro / automático, diseño pensado para móvil y accesible (WCAG AA).

## Privacidad: qué se guarda y dónde

| Dato | Dónde |
| --- | --- |
| Periodos, registros diarios, síntomas, notas, ajustes, PIN (hash PBKDF2) | **Solo en el dispositivo** (IndexedDB) |
| Suscripción push del navegador, zona horaria, hora y texto de cada recordatorio activo y, para el aviso de periodo, las fechas en que debe sonar | Servidor (Upstash Redis + QStash), **solo si se activa algún recordatorio** |

- Sin cuentas, sin analítica ni rastreadores. La fuente tipográfica está incluida en la app (no se carga de Google Fonts).
- Cada dispositivo se identifica en el servidor con un id aleatorio y un secreto (en Redis solo se guarda su hash). Los registros caducan a los 90 días sin actividad.
- Al desactivar todos los recordatorios o al borrar los datos, se elimina también lo guardado en el servidor.
- Con **Notificaciones discretas** (activado por defecto) los textos enviados al servidor y mostrados en la pantalla de bloqueo son neutros.
- El PIN evita miradas indiscretas, pero los datos de IndexedDB no van cifrados: no sustituye el bloqueo del teléfono.

## Tecnología

- React 19 + TypeScript + Vite, Tailwind CSS v4
- IndexedDB con Dexie
- Recharts (gráficas, cargadas bajo demanda)
- vite-plugin-pwa (service worker propio con Workbox, manifest)
- Funciones serverless de Vercel (`/api`) + Upstash Redis, Upstash QStash y Web Push (`web-push`)
- Vitest para los tests

## Estructura

```
api/                 Funciones de Vercel: vapid, subscription (alta/baja), deliver (llamada por QStash)
server/              Lógica del servidor de avisos (testeable, sin dependencias de red)
public/icons/        Iconos de Ciclita (PWA, maskable, iPhone, favicon) e icono de notificaciones
scripts/             Generación del icono monocromo de notificaciones
src/
  domain/            Lógica pura: predicciones, periodos, estadísticas, copias de seguridad, fechas
  db/                Esquema Dexie, ajustes, repositorios, exportar/importar
  features/          Pantallas: onboarding, inicio, calendario, registro, estadísticas, ajustes, bloqueo
  components/        Componentes reutilizables (botones, chips, PIN, diálogos…)
  push/              Suscripción push y sincronización de recordatorios con el servidor
  security/          Hash y verificación del PIN
  i18n/es.ts         Textos (español)
  sw.ts              Service worker: modo offline y notificaciones
```

La lógica de predicción está en [`src/domain/prediction.ts`](src/domain/prediction.ts), comentada y con tests en `prediction.test.ts`.

## Requisitos

- Node.js 20 o superior (desarrollado con Node 24) y npm
- Para los recordatorios: una cuenta de [Upstash](https://upstash.com) (Redis + QStash) y una cuenta de [Vercel](https://vercel.com)

## Instalar y ejecutar en local

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173. Todo funciona en local salvo los recordatorios, que necesitan las funciones de `/api`. Para probarlos también en local, usa la CLI de Vercel con un archivo `.env` (ver más abajo):

```bash
npx vercel dev
```

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm test` | Tests unitarios (Vitest) |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build (con las mismas cabeceras de seguridad que Vercel) para probar la PWA y el modo offline |
| `npm run lint` | Linter (oxlint) |
| `npm run icons` | Regenera el icono monocromo de notificaciones (`public/icons/badge-96.png`) |

## Desplegar en Vercel con Upstash

1. **Sube el repositorio** a GitHub/GitLab e impórtalo en Vercel (detecta Vite solo; las funciones de `api/` se despliegan automáticamente).
2. **Crea en Upstash**:
   - una base de datos **Redis** → copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`;
   - en **QStash** → copia `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY`.
3. **Genera las claves VAPID** (una sola vez; si las cambias, las suscripciones existentes dejan de valer):
   ```bash
   npx web-push generate-vapid-keys
   ```
4. En Vercel → *Project → Settings → Environment Variables*, añade las variables de [`.env.example`](.env.example): las cinco de Upstash, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:tu-correo`). `APP_URL` solo hace falta si usas un dominio propio.
5. **Despliega** (o vuelve a desplegar tras añadir las variables).
6. Comprueba: `https://tu-app.vercel.app/api/vapid` debe devolver `{"key": "..."}`. Después activa un recordatorio en *Ajustes* y pulsa *Probar notificación*; en la consola de QStash verás las programaciones (`ciclo-<id>-daily`, etc.).

**Cómo funcionan los avisos:** al activar un recordatorio, la app registra el dispositivo en `PUT /api/subscription`; el servidor guarda los datos en Redis y crea una programación cron en QStash por recordatorio, en la zona horaria del dispositivo (el aviso de periodo se comprueba cada día a las 9:00 y se envía una sola vez). A su hora, QStash llama a `/api/deliver` (que solo acepta peticiones firmadas por QStash) y este envía el Web Push.

Ten en cuenta los límites de tu plan de QStash: cada recordatorio activo es una programación por dispositivo y, como mucho, 3 mensajes al día por dispositivo.

La app también puede desplegarse en cualquier hosting estático (`dist/`), pero entonces los recordatorios no funcionarán.

## Instalar la app en el móvil

La app debe servirse por **HTTPS** (Vercel ya lo hace).

**Android (Chrome, Edge, Samsung Internet)**
1. Abre la URL de la app.
2. Pulsa *Instalar* en el aviso del navegador, o ve a *Ajustes → Instalar la app*, o al menú ⋮ → *Instalar app* / *Añadir a pantalla de inicio*.

**iPhone / iPad (Safari, iOS 16.4 o posterior para las notificaciones)**
1. Abre la URL en **Safari**.
2. Toca *Compartir* (cuadrado con flecha) → *Añadir a pantalla de inicio* → *Añadir*.
3. Abre la app desde el icono y activa los recordatorios en *Ajustes* (en iOS las notificaciones solo funcionan con la app instalada).

Una vez instalada, la app funciona sin conexión. Cuando haya una versión nueva, aparecerá un aviso para actualizarla.

## Copias de seguridad

En *Ajustes → Tus datos*:
- **JSON**: copia completa (periodos, registros, síntomas personalizados y ajustes; nunca el PIN ni las credenciales del servidor de avisos).
- **CSV**: un día por fila, separado por `;` (se abre directamente en Excel en español).
- **Importar** acepta ambos formatos y **reemplaza** los datos actuales.

Como los datos solo viven en el dispositivo, si se borran los datos del navegador o se desinstala la app se pierden: haz copias de vez en cuando.
