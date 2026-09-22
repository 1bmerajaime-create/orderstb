# Tropic Boost · Portal de Operaciones

Herramienta de gestión de eventos y pedidos para stands de açaí bowls en competiciones.

Basada en la identidad visual de [tropicboost.com](https://www.tropicboost.com/#hero).

## Arranque

### Opción A · Abrir el archivo directamente

```bash
npm install
npm run build
```

Genera `dist/index.html`, un único archivo autocontenido (HTML, CSS, JS e imágenes
incluidos). Ábrelo con doble clic desde el Finder, sin necesidad de servidor.
El atajo `npm run open` compila y lo abre de una vez.

Hay que repetir el `build` cada vez que se cambie el código.

### Opción B · Servidor de desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Recarga en caliente al editar, pero requiere mantener
la terminal abierta.

En ambos casos la contraseña es:

```
tropic.boost
```

## Publicar en pedidostropicboost.com (GitHub Pages + GoDaddy)

Cada push a `main` despliega automáticamente con GitHub Actions.

### 1. DNS en GoDaddy

En el dominio → **DNS** / **Manage DNS**, deja estos registros (borra parking/A viejos de `@` y `www` que choquen):

| Tipo | Nombre | Valor | TTL |
|------|--------|--------|-----|
| A | `@` | `185.199.108.153` | 600 |
| A | `@` | `185.199.109.153` | 600 |
| A | `@` | `185.199.110.153` | 600 |
| A | `@` | `185.199.111.153` | 600 |
| CNAME | `www` | `jaime-aily.github.io` | 600 |

Si GoDaddy tiene **Forwarding** o un A a `Parked`, desactívalo.

### 2. Dominio en GitHub

Repo → **Settings** → **Pages**:
- Source: **GitHub Actions**
- Custom domain: `pedidostropicboost.com`
- Cuando el DNS esté verde, activa **Enforce HTTPS**

La web queda en `https://pedidostropicboost.com` (y `www` si lo apuntaste).

## Qué incluye

- **Login** con contraseña única
- **Dashboard principal**: eventos, productos, materia prima, promociones
- **Dashboard del evento**: KPIs, ventas por hora, top productos
- **TPV de pedidos**: nuevo pedido → en curso → listo → entregado
- **Histórico** con filtros
- Datos persistentes en `localStorage` (catálogo seed con bowls reales: Lotus Boost, PB Crunch, Berry Power, Passion Glow)

## Stack

Vite · React · TypeScript · React Router · Recharts
