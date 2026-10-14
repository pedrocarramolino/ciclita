# Ciclita · Registro menstrual

Aplicación web progresiva (PWA) para registrar el ciclo menstrual de forma rápida y privada: calendario, registro diario, predicciones, estadísticas y recordatorios. Se instala en el móvil como una app más y funciona sin conexión.

> **Aviso:** esta app no es un método anticonceptivo ni sustituye el consejo médico. Las predicciones son estimaciones.

## Funcionalidades

- **Inicio**: "Tu periodo empieza en X días" / "Día X de tu periodo" y botones grandes de *Ha empezado* / *Ha terminado mi periodo*, que se pueden deshacer durante unos segundos.
- **Calendario** mensual con días de periodo, periodos previstos, ventana fértil y ovulación estimadas, con leyenda. Si los ciclos varían, también se marcan los días en que el periodo o la ventana fértil podrían adelantarse o retrasarse.
  - **Editar periodos**: tocando el primer y el último día se marca un periodo pasado entero (hasta 14 días); tocar un día marcado lo quita. Se puede deshacer. El aviso "¿Se te olvidó registrar un periodo?" abre el calendario directamente en este modo.
- **Registro diario** (todo opcional): flujo, síntomas, estado de ánimo, dolor 0–10, medicación y notas.
  - **Síntomas por categorías**: catálogo de unos 30 síntomas (dolor, digestión, piel y pelo, energía y sueño, apetito, otros), con los más usados arriba y los personalizados aparte.
  - **Fertilidad y peso** (se activan en *Ajustes → Qué registras*): temperatura basal, moco cervical, relaciones sexuales con o sin protección y peso.
  - **Píldora anticonceptiva** (también en *Qué registras*): según el envase (21 + 7, 24 + 4 o 28 seguidas), el inicio muestra "Píldora de hoy" para marcarla con un toque, y la notificación lleva un botón "Ya la he tomado" (Android y ordenador); el aviso de periodo lleva "Ha empezado" para marcar el inicio sin abrir la app; los días sin marcar aparecen en el calendario y en el informe. El recordatorio no suena en los días de descanso, y el último día de descanso avisa de que al día siguiente empieza un envase nuevo.
- **Predicciones**: mediana de los últimos 6 ciclos (28/5 días por defecto; un ciclo aislado raro no la desplaza), próximos 3 periodos y ventana fértil, con un **margen** (±días) calculado a partir de lo que varían tus ciclos.
  - Previsión automática (por defecto) o manual: en *Ajustes → Tu ciclo* se puede fijar la duración del ciclo y del periodo para que las fechas se calculen siempre con ella, sin margen.
  - Si un ciclo dura 1,7 veces lo habitual o más, se aparta del cálculo y el inicio pregunta si se olvidó registrar un periodo (con acceso al calendario en ese mes, o "No, fue un ciclo largo").
  - Si un periodo sigue "en curso" 2 días más de lo habitual, el inicio pregunta si ya terminó.
  - El inicio muestra una sola de estas preguntas a la vez (fin de periodo → periodo olvidado → copia de seguridad).
  - Con una semana o más de retraso, sugiere un test de embarazo y permite pasar a modo embarazo.
- **Buscar** (lupa del calendario): en notas, síntomas y medicación, sin distinguir tildes ni mayúsculas. Al buscar un síntoma muestra en cuántos días se registró y cuándo fue el último; cada resultado abre ese día.
- **Estadísticas**: gráfica de temperatura basal por ciclo (con detección de la subida por la regla "3 sobre 6": línea de base y ovulación probable), gráfica de los últimos ciclos, medias, ciclo más corto y más largo, síntomas frecuentes por fase y en qué días del ciclo suelen aparecer (p. ej. "entre 1 y 2 días antes del periodo"; también en el informe) y aviso suave si los ciclos varían más de 7 días.
- **Informe para el médico** (los ciclos con un posible periodo sin registrar se marcan y no cuentan en el resumen): resumen de 3, 6 o 12 meses (o todo) con ciclos, flujo, dolor, píldora, síntomas, medicación, fertilidad y, si quieres, notas. Se genera en el dispositivo como **PDF** (con pdf-lib), que se puede compartir (WhatsApp, correo, Archivos…), descargar o imprimir.
- **Modos de la app** (se elige en la bienvenida y se cambia en *Ajustes → Modo de la app*):
  - **Ciclo menstrual** (por defecto).
  - **Embarazo**: semanas y días, trimestre y fecha probable de parto (a partir de la última regla o de la fecha de parto). Se pausan las previsiones y los avisos del ciclo.
  - **Perimenopausia**: días desde el último periodo, periodos en los últimos 12 meses, aviso al llegar a 12 meses sin periodo y síntomas propios de esta etapa. Sin previsiones.
- **Recordatorios** por notificación push, aunque la app esté cerrada:
  - antes del próximo periodo, registro diario y píldora anticonceptiva;
  - ventana fértil (el día antes) y autoexploración de mama (una vez al mes);
  - anticonceptivos con pauta: anillo vaginal, parche o inyección trimestral.
- **Privacidad**: PIN de 4 dígitos, desbloqueo con **Face ID, Touch ID o huella** (opcional), cifrado opcional de los datos con el PIN, exportar/importar (JSON, JSON cifrado con contraseña y CSV) y borrado total con doble confirmación.
- **Móvil nuevo**: en la bienvenida, "¿Ya usabas Ciclita? Importar una copia" (también cifrada) lleva directo al inicio.
- **Idiomas**: español (por defecto) e inglés. Se elige en la bienvenida o en *Ajustes → Idioma*. El nombre de la app instalada y sus atajos también se traducen (`pwa-manifests.ts`: un manifiesto por idioma).
- Tema claro / oscuro / automático, animación de apertura, diseño pensado para móvil y accesible (WCAG AA).

## Privacidad: qué se guarda y dónde

| Dato | Dónde |
| --- | --- |
| Periodos, registros diarios, síntomas, notas, ajustes, PIN (hash PBKDF2) | **Solo en el dispositivo** (IndexedDB) |
| Idioma elegido | En el dispositivo (localStorage), sin cifrar, para mostrar la pantalla del PIN en ese idioma |
| Suscripción push del navegador, zona horaria, hora y texto de cada recordatorio activo y, para los avisos de periodo, ventana fértil, autoexploración y anticonceptivos, las fechas en que deben sonar; para la píldora, el tipo de envase y su primer día (para no avisar en los días de descanso) | Servidor (Upstash Redis + QStash), **solo si se activa algún recordatorio** |

- Sin cuentas, sin analítica ni rastreadores. La fuente tipográfica está incluida en la app (no se carga de Google Fonts).
- Cada dispositivo se identifica en el servidor con un id aleatorio y un secreto (en Redis solo se guarda su hash). Los registros caducan a los 90 días sin actividad.
- Al desactivar todos los recordatorios o al borrar los datos, se elimina también lo guardado en el servidor.
- Con **Notificaciones discretas** (activado por defecto) los textos enviados al servidor y mostrados en la pantalla de bloqueo son neutros.
- **Cifrado opcional con el PIN** (*Ajustes → Privacidad y seguridad → Cifrar mis datos*): todos los datos (periodos, registros, síntomas, notas y ajustes) se guardan en el dispositivo cifrados con AES-256-GCM, con una clave derivada del PIN (PBKDF2-SHA256, 600.000 iteraciones, sal aleatoria). En claro solo queda el tema de color, para pintar la pantalla de desbloqueo. Al desbloquear, los datos se descifran a una copia en memoria que desaparece al bloquear o cerrar la app; cada cambio se vuelve a cifrar al momento.
  - Si se olvida el PIN, los datos cifrados **no se pueden recuperar**: conviene exportar una copia de seguridad (las copias exportadas no van cifradas).
  - Un PIN de 4 dígitos protege frente a miradas y frente a quien copie los datos del navegador, pero con acceso técnico al dispositivo se podrían probar las 10.000 combinaciones. No sustituye el bloqueo del teléfono.
- Sin cifrado, el PIN solo evita miradas indiscretas: los datos de IndexedDB quedan en claro.
- **Face ID, Touch ID o huella** (*Ajustes → Privacidad y seguridad*, tras activar el PIN): crea una llave de acceso (passkey, WebAuthn) del dispositivo para el dominio de la app, sin servidor. Al abrir la app se pide la cara o la huella; el PIN sigue sirviendo.
  - Con el cifrado activado usa la extensión PRF de WebAuthn (iPhone con iOS 18 o posterior, Android y navegadores recientes): la llave da un secreto con el que se guarda el PIN cifrado junto a la bóveda, y así la cara o la huella también descifran los datos. Si el dispositivo no tiene PRF, en ese modo no se puede activar.
  - Al cambiar el PIN con el cifrado activado, al cifrar los datos o al quitar el PIN, hay que volver a activarlo. Al desactivarlo o borrar todo, se pide al sistema que olvide la llave (si no sabe, se puede borrar a mano en Contraseñas).

## Tecnología

- React 19 + TypeScript + Vite, Tailwind CSS v4
- IndexedDB con Dexie
- Gráfica de barras propia en SVG (sin librerías de gráficas)
- pdf-lib para el informe en PDF (se carga solo al abrir el informe)
- vite-plugin-pwa (service worker propio con Workbox, manifest)
- Funciones serverless de Vercel (`/api`) + Upstash Redis, Upstash QStash y Web Push (`web-push`)
- Vitest para los tests; las pantallas se prueban con Testing Library en jsdom (`src/test/ui.ts`)

## Estructura

```
api/                 Funciones de Vercel: vapid, subscription (alta/baja), deliver (llamada por QStash)
server/              Lógica del servidor de avisos (testeable, sin dependencias de red)
public/icons/        Iconos de Ciclita (PWA, maskable, iPhone, favicon) e icono de notificaciones
scripts/             Generación del icono monocromo de notificaciones
src/
  domain/            Lógica pura: predicciones, periodos, estadísticas, informe, modos, síntomas,
                     avisos con fecha, copias de seguridad, fechas
  db/                Esquema Dexie, ajustes, repositorios, exportar/importar
  features/          Pantallas: onboarding, inicio, calendario, registro, búsqueda, estadísticas, informe, ajustes, bloqueo
  components/        Componentes reutilizables (botones, chips, PIN, diálogos…)
  push/              Suscripción push y sincronización de recordatorios con el servidor
  security/          Hash y verificación del PIN, cifrado y Face ID / huella (WebAuthn)
  i18n/              Textos: es.ts (español, por defecto) y en.ts (inglés, misma estructura comprobada por TypeScript)
  db/vault.ts        Cifrado de los datos con el PIN
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
| `npm test` | Tests (Vitest): lógica pura, pantallas (Testing Library sobre jsdom, con IndexedDB simulada) y revisión de accesibilidad de todas las pantallas con axe-core (`src/a11y.test.tsx`) |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build (con las mismas cabeceras de seguridad que Vercel) para probar la PWA y el modo offline |
| `npm run lint` | Linter (oxlint) |
| `npm run icons` | Regenera el icono monocromo de notificaciones (`public/icons/badge-96.png`) |

## Desplegar en Vercel con Upstash

1. **Sube el repositorio** a GitHub/GitLab e impórtalo en Vercel (detecta Vite solo; las funciones de `api/` se despliegan automáticamente).
2. **Crea en Upstash**:
   - una base de datos **Redis** → copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (o conéctala desde Vercel → *Storage*, que crea `KV_REST_API_URL`/`KV_REST_API_TOKEN`; la app acepta ambos nombres);
   - en **QStash** → copia `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` y, si tu cuenta está en una región concreta, `QSTASH_URL`. Puedes reutilizar el mismo QStash de otro proyecto: Ciclita no usa *schedules*, solo mensajes diferidos.
3. **Genera las claves VAPID** (una sola vez; si las cambias, las suscripciones existentes dejan de valer):
   ```bash
   npx web-push generate-vapid-keys
   ```
4. En Vercel → *Project → Settings → Environment Variables*, añade las variables de [`.env.example`](.env.example): las cinco de Upstash, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:tu-correo`). `APP_URL` solo hace falta si usas un dominio propio.
5. **Despliega** (o vuelve a desplegar tras añadir las variables).
6. Comprueba: `https://tu-app.vercel.app/api/vapid` debe devolver `{"key": "..."}`. Después activa un recordatorio en *Ajustes* y pulsa *Probar notificación*; en la consola de QStash (*Messages*) verás el mensaje pendiente para la hora del recordatorio.

**Cómo funcionan los avisos:** al activar un recordatorio, la app registra el dispositivo en `PUT /api/subscription`. El servidor guarda los datos en Redis y publica en QStash **un mensaje diferido** para la próxima hora de cada tipo de recordatorio, en la zona horaria del dispositivo. Hay cuatro tipos: diario, píldora, periodo (se comprueba a las 9:00 y se envía una sola vez por periodo; se envían los 3 próximos periodos previstos, así sigue avisando aunque la app no se abra en meses) y avisos con fecha (ventana fértil, autoexploración y anticonceptivos, hasta 30 fechas, a las 9:00 o a la hora elegida). Los textos se generan en la app, en su idioma. A esa hora, QStash llama a `/api/deliver` (que solo acepta peticiones firmadas por QStash), que envía el Web Push y publica el mensaje del día siguiente. Cada programación lleva una versión: al cambiar o desactivar un recordatorio, los mensajes antiguos se cancelan o se ignoran.

No se usan *schedules* de QStash (el plan gratuito solo permite 10 por cuenta), así que el número de dispositivos no está limitado por ellos. Cada tipo de recordatorio activo consume como mucho 1 mensaje al día por dispositivo (4 en total como máximo), dentro del cupo diario de QStash.

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

En iPhone/iPad con la app instalada, iOS no permite descargas ni imprimir desde la app; por eso las copias de seguridad y el informe en PDF se guardan con el menú **Compartir** del sistema (*Guardar en Archivos*, *Imprimir*, enviar…).

## Copias de seguridad

En *Ajustes → Tus datos*:
- **JSON**: copia completa (periodos, registros, síntomas personalizados y ajustes; nunca el PIN ni las credenciales del servidor de avisos).
- **JSON cifrado con contraseña**: la misma copia, cifrada con AES-256-GCM y una clave derivada de la contraseña (PBKDF2-SHA256, 600.000 iteraciones, mínimo 8 caracteres). Sin la contraseña no se puede leer, aunque el archivo acabe en la nube o en un correo; si se olvida, no se puede recuperar. Al importarla, la app la reconoce y pide la contraseña.
- **CSV**: un día por fila, separado por `;` (se abre directamente en Excel en español), con la temperatura, el moco, las relaciones y el peso. La cabecera y los textos van en el idioma de la app.
- **Importar** acepta ambos formatos (y CSV en español o en inglés) y **reemplaza** los datos actuales.

Como los datos solo viven en el dispositivo, si se borran los datos del navegador o se desinstala la app se pierden: haz copias de vez en cuando.

Para reducir ese riesgo:
- La app pide al navegador **almacenamiento persistente**, para que no borre los datos al quedarse sin espacio. El estado se ve en *Ajustes → Tus datos → Protección frente al borrado*.
- *Ajustes → Tus datos* muestra la fecha de la última copia, y el inicio sugiere hacer una si nunca se ha hecho tras un mes de uso o si la última tiene más de 60 días.
- Si la app falla al abrirse, muestra una pantalla con **Exportar mis datos** en lugar de quedarse en blanco.
