# Ingresos 💸

Web para organizar **gastos e ingresos personales** con cuenta propia: entras con tu correo desde cualquier dispositivo y ves tus datos. Interfaz en español, moneda USD, pensada primero para celular.

Hecha con React + Vite + TypeScript y Supabase (Auth + Postgres). Estilo *liquid glass* en beige, negro suave y verde bosque, con modo oscuro.

## Funciones

- **Cuentas:** correo y contraseña (Supabase Auth). Cada persona ve solo sus datos (RLS).
- **Resumen:** selector de mes, balance, ingresos y gastos; “Dónde gasto más” (dona + ranking por categoría; toca una categoría para ver sus subcategorías); top 5 de lugares; ingresos por categoría; últimos movimientos.
- **Movimientos:** lista del mes agrupada por día, filtro Todos / Gastos / Ingresos. Toca uno para editarlo o borrarlo.
- **Categorías y subcategorías:** edita nombre y emoji, crea, borra (incluso las base). Cada categoría puede tener subcategorías (ej. Comida › Supermercado, Comida › Restaurantes).
  - Borrar una **categoría** borra sus subcategorías; sus movimientos pasan a **“Sin categoría”**.
  - Borrar una **subcategoría** mueve sus movimientos a su categoría principal.
- **Botón +:** hoja deslizable con monto (teclado numérico), categoría → subcategoría, lugar (con sugerencias) y fecha.
- **Ajustes:** tema Claro / Oscuro / Auto, cuenta, y copia de seguridad en JSON (exportar / importar).

## Variables de entorno (Vercel)

En Vercel → *Settings → Environment Variables* (Production, Preview y Development):

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://qebcqxfkwbxvezdqffwq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_0pfOccP65EROb48MdMe9cA_gjmPoTqt` |

Después de agregarlas, haz **Redeploy**. La clave publicable es pública por diseño (el acceso lo controla RLS). **Nunca** pongas la `service_role` en la app. Si no defines las variables, la app usa esos mismos valores por defecto.

## Supabase

Proyecto **Ingresos**. Las migraciones están en `supabase/migrations/` y se aplican solas con la integración GitHub ↔ Supabase al hacer push a `main`.

| Tabla / vista | Para qué |
|---|---|
| `categories` | `user_id`, `id`, `name`, `emoji`, `type` (expense/income), `parent_id` (subcategoría), `sort_order` |
| `transactions` | `user_id`, `id`, `type`, `amount_cents`, `category_id`, `place`, `date` |
| `category_usage` (vista) | cantidad de movimientos por categoría |
| `place_usage` (vista) | lugares usados, para sugerencias |

- Llave primaria `(user_id, id)`; los montos se guardan en centavos.
- Subcategorías de un solo nivel y del mismo tipo que su categoría (lo valida la base de datos).
- Cada usuario nuevo recibe las categorías base automáticamente (trigger en `auth.users`).

### Auth

- En *Authentication → URL Configuration* pon tu URL de Vercel como **Site URL** y agrégala en **Redirect URLs** (para el enlace de confirmación del correo).
- O, si no quieres confirmar correos, desactiva **Confirm email** en *Authentication → Sign In / Providers → Email*.

## Estructura

```
├── index.html
├── vite.config.ts           # React + manifest (el service worker viejo se autodestruye)
├── supabase/migrations/     # esquema, RLS, triggers y vistas
└── src/
    ├── App.tsx              # login, pestañas, barra inferior, botón +, hojas
    ├── styles.css           # sistema visual liquid glass + modo oscuro
    ├── lib/
    │   ├── supabase.ts      # cliente y mensajes de error
    │   ├── account.tsx      # sesión: entrar, crear cuenta, salir
    │   ├── data.tsx         # categorías, movimientos del mes, guardar/borrar
    │   ├── backup.ts        # exportar / importar JSON
    │   ├── hooks.ts         # tema
    │   └── utils.ts         # formato USD, fechas, montos, vibración
    ├── components/          # Sheet, Login, AuthForm, TransactionSheet, CategorySheet, ...
    └── screens/             # Dashboard, Movements, Categories
```

## Correr en local

```bash
npm install
npm run dev        # http://localhost:5173 (también visible en tu red local con --host)
npm run build && npm run preview
npm run typecheck
```

## En el celular

Es una web normal: ábrela desde el navegador. Si quieres un acceso directo con ícono, en Android usa ⋮ → **Agregar a pantalla principal**, y en iPhone, Compartir → **Agregar a pantalla de inicio**. Necesita internet.
