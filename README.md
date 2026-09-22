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
| CNAME | `www` | `1bmerajaime-create.github.io` | 600 |

Si GoDaddy tiene **Forwarding** o un A a `Parked`, desactívalo.

### 2. Dominio en GitHub

Repo → **Settings** → **Pages**:
- Source: **GitHub Actions**
- Custom domain: `pedidostropicboost.com`
- Cuando el DNS esté verde, activa **Enforce HTTPS**

La web queda en `https://pedidostropicboost.com` (y `www` si lo apuntaste).

## Sincronización en tiempo real (Firebase · gratis)

Sin Firebase, cada dispositivo guarda datos solo en su navegador (`localStorage`).
Con Firebase, caja y cocina ven los mismos pedidos al instante.

### 1. Crear proyecto Firebase

1. Entra en [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. Activa **Authentication** → Sign-in method → **Anonymous** → Enable
3. Activa **Firestore Database** → Create database → modo **production**
4. En Firestore → **Rules**, pega el contenido de `firestore.rules` del repo → Publish
5. Project settings → **Your apps** → Web (`</>`) → registra la app y copia la config

### 2. Variables locales

```bash
cp .env.example .env
```

Rellena `.env` con los valores de Firebase (`apiKey`, `authDomain`, etc.).

### 3. Variables en GitHub (para el deploy)

Repo → **Settings** → **Secrets and variables** → **Actions** → crea:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Tras el siguiente push/deploy, todos los dispositivos compartirán la misma nube.

## Qué incluye

- **Login** con contraseña única
- **Dashboard principal**: eventos, productos, materia prima, promociones
- **Dashboard del evento**: KPIs, ventas por hora, top productos
- **TPV de pedidos**: nuevo pedido → en curso → listo → entregado
- **Histórico** con filtros
- **Sync en tiempo real** entre dispositivos (Firebase Firestore) o `localStorage` si no hay config

## Stack

Vite · React · TypeScript · React Router · Recharts · Firebase
