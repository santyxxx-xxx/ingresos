# Ingresos 💸

PWA para organizar **gastos e ingresos personales**. Se instala como app en el celular, funciona **sin internet** y guarda todo **solo en tu dispositivo** (IndexedDB). Sin cuentas, sin servidor.

Hecha con React + Vite + TypeScript, Dexie (IndexedDB), vite-plugin-pwa y lucide-react. Estilo *liquid glass* en beige, negro suave y verde bosque, con modo oscuro.

## Funciones

- **Resumen**: selector de mes, balance, ingresos y gastos; “Dónde gasto más” (dona + ranking con % por categoría); top 5 de lugares; ingresos por categoría; últimos movimientos.
- **Movimientos**: lista del mes agrupada por día, filtro Todos / Gastos / Ingresos. Toca uno para editarlo o borrarlo.
- **Categorías**: edita nombre y emoji, crea nuevas o borra cualquiera (incluso las base). Al borrar una categoría con movimientos, estos pasan a **“Sin categoría”** (nunca se pierden).
- **Botón +**: hoja deslizable para registrar rápido monto (teclado numérico), categoría, lugar (con sugerencias de lugares usados antes) y fecha.
- **Ajustes** (ícono arriba a la derecha): tema Claro / Oscuro / Auto, **respaldo en la nube** (Supabase) y **exportar / importar** respaldo en JSON.

## Respaldo en la nube (Supabase)

La app sigue funcionando 100 % en el celular y sin internet. Además, si entras con tu correo:

- Se guarda una **copia privada** de todos tus datos en la tabla `backups` de Supabase (una fila por usuario, protegida con RLS: solo tú la ves).
- **Respaldo automático**: cada vez que agregas, editas o borras algo, se sube la copia unos segundos después. Si no hay internet, se sube cuando vuelve.
- **Celular nuevo o datos borrados**: instala la app, entra con el mismo correo y toca **“Restaurar mi respaldo”**.
- Protección: en un dispositivo nuevo el respaldo automático **no se activa** hasta que restaures o lo actives a mano, para no pisar tu copia de la nube con una app vacía. Además, Supabase guarda la versión anterior (`previous_data`, se rota cada 12 h como máximo).

El inicio de sesión es con un **código de 6 dígitos** que llega al correo (no con enlace), porque en iPhone el enlace abriría Safari y no la app instalada.

### Configuración en Supabase (una sola vez)

1. **Tabla**: la migración está en `supabase/migrations/`. Se aplica con la integración GitHub ↔ Supabase (activa *Deploy to production* en *Project Settings → Integrations → GitHub*) o pegándola en el *SQL Editor*. Es idempotente.
2. **Plantillas de correo** (*Authentication → Emails → Templates*): en **Magic Link** y en **Confirm signup** agrega el código, por ejemplo:
   ```html
   <h2>Tu código para Ingresos</h2>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   ```
3. Variables (opcional): por defecto la app usa el proyecto “Ingresos”. Para otro proyecto, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel (ver `.env.example`). La clave **publicable** es pública por diseño; nunca uses la `service_role` en la app.

> El correo de Supabase por defecto tiene un límite bajo de envíos por hora; para uso personal alcanza. Si necesitas más, configura un SMTP propio en *Authentication → Emails → SMTP*.

## Estructura

```
├── index.html               # meta tags iOS, viewport-fit=cover, tema inicial
├── vite.config.ts           # vite-plugin-pwa (autoUpdate + manifest + workbox)
├── vercel.json / netlify.toml
├── public/icons/            # 192, 512, maskable 512, apple-touch-icon, favicon
├── supabase/migrations/     # tabla backups + RLS
└── src/
    ├── main.tsx             # entrada
    ├── App.tsx              # pestañas, barra inferior, botón +, hojas
    ├── styles.css           # sistema visual liquid glass + modo oscuro
    ├── lib/
    │   ├── db.ts            # Dexie: esquema, categorías base, CRUD
    │   ├── backup.ts        # exportar / validar / importar JSON
    │   ├── supabase.ts      # cliente Supabase
    │   ├── cloud.tsx        # login por código, respaldo automático, restaurar
    │   ├── hooks.ts         # useCategories, useMonthTx, useTheme
    │   ├── types.ts
    │   └── utils.ts         # formato USD, fechas, parseo de montos, vibración
    ├── components/          # Sheet, Segmented, MonthPicker, Donut, TxRow,
    │                        # TransactionSheet, CategorySheet, SettingsSheet, Feedback
    └── screens/             # Dashboard, Movements, Categories
```

Los montos se guardan en **centavos** (enteros) para evitar errores de redondeo.

## Correr en local

Requiere Node 18 o superior.

```bash
npm install
npm run dev        # http://localhost:5173
```

El service worker (modo offline) **solo se activa en el build de producción**:

```bash
npm run build
npm run preview    # http://localhost:4173
```

`npm run typecheck` revisa los tipos de TypeScript.

## Probar en el celular (misma red Wi-Fi)

`npm run dev` y `npm run preview` ya exponen la app en tu red (`--host`). En la terminal verás una dirección tipo `http://192.168.1.25:5173`; ábrela en el navegador del celular.

> Por HTTP en la red local la app funciona, pero **no se puede instalar ni usar offline**: los navegadores exigen HTTPS para el service worker. Para probar la instalación, usa el despliegue en Vercel/Netlify.

## Publicar

### Vercel
1. Importa el repositorio en [vercel.com](https://vercel.com) (o ya está conectado).
2. Vercel detecta Vite: build `npm run build`, carpeta `dist` (ya configurado en `vercel.json`).
3. Cada `git push` a `main` publica una nueva versión. La app se actualiza sola (`registerType: 'autoUpdate'`) la próxima vez que se abra con internet.

### Netlify
1. “Add new site → Import from Git” y elige el repo.
2. `netlify.toml` ya define build `npm run build` y carpeta `dist`.

Ambos sirven con **HTTPS**, que es obligatorio para el modo offline y la instalación.

## Instalar en el celular

**Android (Chrome)**
1. Abre la URL de Vercel/Netlify en Chrome.
2. Toca el aviso **“Instalar app”** o el menú ⋮ → **“Instalar app” / “Agregar a pantalla principal”**.
3. Se abre a pantalla completa desde su ícono, como una app nativa.

**iPhone (Safari)**
1. Abre la URL en **Safari** (no funciona desde Chrome en iOS).
2. Toca el botón **Compartir** (cuadrado con flecha) → **“Agregar a pantalla de inicio”** → **Agregar**.
3. Ábrela desde el ícono: sin barra del navegador y con la barra de estado translúcida.

Después de abrirla una vez con internet, funciona completamente **sin conexión**.

## Notas

- **Tus datos viven en el navegador del dispositivo.** Si borras los datos de Safari/Chrome o desinstalas la app, se pierden: exporta un respaldo de vez en cuando (Ajustes → Exportar). En iPhone, la app instalada y Safari tienen almacenamientos separados.
- La vibración al guardar funciona en Android; iOS no permite vibrar desde la web.
- Importar un respaldo **reemplaza** todos los datos actuales (pide confirmación).
