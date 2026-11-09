# Ingresos 💸

PWA para organizar **gastos e ingresos personales**. Se instala como app en el celular, funciona **sin internet** y guarda todo **solo en tu dispositivo** (IndexedDB). Sin cuentas, sin servidor.

Hecha con React + Vite + TypeScript, Dexie (IndexedDB), vite-plugin-pwa y lucide-react. Estilo *liquid glass* en beige, negro suave y verde bosque, con modo oscuro.

## Funciones

- **Resumen**: selector de mes, balance, ingresos y gastos; “Dónde gasto más” (dona + ranking con % por categoría); top 5 de lugares; ingresos por categoría; últimos movimientos.
- **Movimientos**: lista del mes agrupada por día, filtro Todos / Gastos / Ingresos. Toca uno para editarlo o borrarlo.
- **Categorías**: edita nombre y emoji, crea nuevas o borra cualquiera (incluso las base). Al borrar una categoría con movimientos, estos pasan a **“Sin categoría”** (nunca se pierden).
- **Botón +**: hoja deslizable para registrar rápido monto (teclado numérico), categoría, lugar (con sugerencias de lugares usados antes) y fecha.
- **Ajustes** (ícono arriba a la derecha): tema Claro / Oscuro / Auto, **cuenta y sincronización** (Supabase) y **exportar / importar** respaldo en JSON.

## Cuentas y sincronización (Supabase)

Cada persona tiene **su cuenta** (correo + contraseña) y sus datos viven en Supabase, en las tablas `categories` y `transactions` del proyecto **Ingresos**. Así ves lo mismo en el celular, en el navegador, en el navegador de otra app o en la compu.

- **Local primero:** la app lee y escribe en el dispositivo (IndexedDB), así que abre al instante y funciona sin internet.
- **Sincronización:** cada cambio se sube unos segundos después. Al abrir la app, al volver a ella, al recuperar internet y cada minuto, se descargan los cambios hechos en otros dispositivos.
- **Conflictos:** si editas lo mismo en dos lugares, gana el cambio más reciente. El servidor también lo exige: un cambio viejo nunca pisa uno nuevo.
- **Borrados:** se guardan como `deleted = true` para que lleguen a todos los dispositivos.
- **Sin cuenta:** se puede usar sin cuenta (solo en ese dispositivo). Al crear la cuenta o entrar, lo que ya había se sube y se mezcla con la cuenta.
- **Cerrar sesión:** sube lo pendiente y borra los datos de ese dispositivo (siguen en la cuenta).
- **Seguridad:** RLS en ambas tablas, cada usuario solo ve y modifica sus filas. La clave publicable del código es pública por diseño; nunca uses la `service_role` en la app.

### Esquema

| Tabla | Columnas principales |
|---|---|
| `categories` | `user_id`, `id`, `name`, `emoji`, `type` (expense/income), `sort_order`, `created_at`, `updated_at`, `deleted`, `synced_at` |
| `transactions` | `user_id`, `id`, `type`, `amount_cents`, `category_id`, `place`, `date`, `created_at`, `updated_at`, `deleted`, `synced_at` |

Llave primaria `(user_id, id)`. `updated_at` es la hora del cambio en el dispositivo y `synced_at` la hora del servidor (la app la usa para descargar solo lo nuevo). Las categorías base tienen ids fijos (`base-comida`, `base-sueldo`, …) para no duplicarse entre dispositivos.

Las migraciones están en `supabase/migrations/` y se aplican solas con la integración GitHub ↔ Supabase al hacer push.

### Configuración de Auth en Supabase

En *Authentication → URL Configuration* pon como **Site URL** la dirección de Vercel (y agrégala en *Redirect URLs*), para que el enlace de confirmación del correo abra la app. Si prefieres que las cuentas no necesiten confirmar el correo, desactiva *Confirm email* en *Authentication → Sign In / Providers → Email*.

## Estructura

```
├── index.html               # meta tags iOS, viewport-fit=cover, tema inicial
├── vite.config.ts           # vite-plugin-pwa (autoUpdate + manifest + workbox)
├── vercel.json / netlify.toml
├── public/icons/            # 192, 512, maskable 512, apple-touch-icon, favicon
├── supabase/migrations/     # tablas categories y transactions + RLS
└── src/
    ├── main.tsx             # entrada
    ├── App.tsx              # pestañas, barra inferior, botón +, hojas
    ├── styles.css           # sistema visual liquid glass + modo oscuro
    ├── lib/
    │   ├── db.ts            # Dexie: esquema, categorías base, CRUD
    │   ├── backup.ts        # exportar / validar / importar JSON
    │   ├── supabase.ts      # cliente Supabase
    │   ├── sync.ts          # sincronización IndexedDB ↔ Supabase
    │   ├── account.tsx      # sesión, cuenta y sincronización automática
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

- **Sin cuenta, los datos viven solo en ese navegador.** Si los borras o desinstalas la app, se pierden. Con cuenta quedan en Supabase y se recuperan al volver a entrar.
- La vibración al guardar funciona en Android; iOS no permite vibrar desde la web.
- Importar un respaldo **reemplaza** todos los datos actuales (pide confirmación).
