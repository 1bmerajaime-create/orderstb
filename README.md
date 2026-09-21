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

## Qué incluye

- **Login** con contraseña única
- **Dashboard principal**: eventos, productos, materia prima, promociones
- **Dashboard del evento**: KPIs, ventas por hora, top productos
- **TPV de pedidos**: nuevo pedido → en curso → listo → entregado
- **Histórico** con filtros
- Datos persistentes en `localStorage` (catálogo seed con bowls reales: Lotus Boost, PB Crunch, Berry Power, Passion Glow)

## Stack

Vite · React · TypeScript · React Router · Recharts
