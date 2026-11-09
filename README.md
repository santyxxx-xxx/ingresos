# Ingresos 💸

Web para organizar **gastos e ingresos personales** con cuenta propia: entras con tu correo desde cualquier dispositivo y ves tus datos. Interfaz en español, moneda USD, pensada primero para celular.

Hecha con React + Vite + TypeScript y Supabase (Auth + Postgres). Estilo *liquid glass* claro y tranquilo (marfil, salvia y terracota) con Lora para títulos y cifras.

## Funciones

- **Cuentas:** correo y contraseña o **Google**. Al entrar por primera vez pide tu nombre y te saluda: “Bienvenido, …”. Cada persona ve solo sus datos (RLS).
- **Secciones** (Casa, Personal, Hijo, Esposa, Negocio…): cada gasto o ingreso dice a quién o a qué pertenece. Sirve igual para una persona o para una familia.
- **Resumen** (vista **Total** o por sección):
  - Balance del mes, ingresos y gastos con su variación frente al mes anterior.
  - Promedio diario, proyección de fin de mes y el gasto más grande.
  - **Presupuestos** (en la vista Total): cuánto llevas de cada límite mensual, con aviso al 80 % y al pasarte.
  - Dónde gasto más (dona + ranking por categoría, toca para ver subcategorías).
  - **Mes a mes:** gráfico de los últimos 6 meses y las categorías que más cambiaron.
  - **Fijos del mes:** recurrentes registrados y por venir.
  - Dónde compro más (top 5 lugares), de dónde entra el dinero y últimos movimientos.
- **Movimientos:** lista del mes por día, filtro por sección y por tipo, y acceso a **Recurrentes**.
- **Recurrentes:** arriendo, suscripciones, sueldo… se registran solos el día elegido de cada mes (se pueden pausar). También desde el formulario con “Repetir cada mes”.
- **Categorías → subcategorías:** p. ej. Comida › Supermercado. Cada categoría puede tener presupuesto mensual. Se pueden crear desde la pestaña Categorías **o directamente al registrar un movimiento** (igual que las secciones).
- **Ajustes:** nombre, cerrar sesión y copia en JSON (exportar / importar).

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
| `categories` | `user_id`, `id`, `name`, `emoji`, `type`, `parent_id` (subcategoría), `group_id`, `monthly_budget_cents`, `sort_order` |
| `transactions` | `user_id`, `id`, `type`, `amount_cents`, `category_id`, `place`, `date` |
| `category_usage` (vista) | cantidad de movimientos por categoría |
| `place_usage` (vista) | lugares usados, para sugerencias |
| `category_groups` | secciones (Casa, Personal, Hijo…); `transactions.section_id` y `recurring.section_id` apuntan aquí |
| `recurring` | movimientos que se repiten cada mes; `generate_recurring(fecha)` los crea sin duplicar |

- Llave primaria `(user_id, id)`; los montos se guardan en centavos.
- Subcategorías de un solo nivel y del mismo tipo que su categoría (lo valida la base de datos).
- Cada usuario nuevo recibe las categorías base automáticamente (trigger en `auth.users`).

### Auth

- *Authentication → URL Configuration*: **Site URL** = dominio de producción de Vercel; en **Redirect URLs** agrega ese dominio con `/**`.
- Correo: desactiva **Confirm email** si no quieres confirmar cuentas (*Authentication → Sign In / Providers → Email*).
- Google (opcional, gratis): crea un cliente OAuth (tipo “Aplicación web”) en Google Cloud con la URI de redirección `https://qebcqxfkwbxvezdqffwq.supabase.co/auth/v1/callback`, y pega el Client ID y Secret en *Authentication → Sign In / Providers → Google*. Luego agrega en Vercel la variable `VITE_ENABLE_GOOGLE=true` y redespliega para mostrar el botón.

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
