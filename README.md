# Tropic Boost · Portal de Operaciones

Herramienta de gestión de eventos y pedidos para stands de açaí bowls en competiciones.

Basada en la identidad visual de [tropicboost.com](https://www.tropicboost.com/#hero).

## Arranque

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` e introduce la contraseña:

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
