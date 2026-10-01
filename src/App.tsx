import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { EventDashboardPage } from './pages/EventDashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { HistoryPage } from './pages/HistoryPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function SyncBanners() {
  const { cloudEnabled, syncError, online, retrySync } = useStore();
  if (!cloudEnabled) return null;
  return (
    <>
      {!online && (
        <div className="sync-banner sync-banner-offline">
          Sin conexión — los cambios se guardan en este dispositivo y se
          sincronizarán al recuperar red.
        </div>
      )}
      {syncError && (
        <div className="sync-banner sync-banner-error">
          Error de sincronización: {syncError}{' '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={retrySync}
            style={{ marginLeft: '0.5rem' }}
          >
            Reintentar
          </button>
        </div>
      )}
    </>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { authenticated, cloudEnabled, syncReady, syncError, retrySync } =
    useStore();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (cloudEnabled && !syncReady && !syncError) {
    return (
      <div className="app-shell">
        <main className="page" style={{ paddingTop: '3rem' }}>
          <p className="muted">Sincronizando datos…</p>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Conectando con todos los dispositivos…
          </p>
        </main>
      </div>
    );
  }
  if (cloudEnabled && !syncReady && syncError) {
    return (
      <div className="app-shell">
        <SyncBanners />
        <main className="page" style={{ paddingTop: '3rem' }}>
          <p className="muted">No se pudo cargar la sincronización.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={retrySync}
            style={{ marginTop: '1rem' }}
          >
            Reintentar
          </button>
        </main>
      </div>
    );
  }
  return (
    <>
      <SyncBanners />
      {children}
    </>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <HomePage />
            </Protected>
          }
        />
        <Route
          path="/evento/:eventId"
          element={
            <Protected>
              <EventDashboardPage />
            </Protected>
          }
        />
        <Route
          path="/evento/:eventId/pedidos"
          element={
            <Protected>
              <OrdersPage />
            </Protected>
          }
        />
        <Route
          path="/evento/:eventId/nuevo-pedido"
          element={
            <Protected>
              <NewOrderPage />
            </Protected>
          }
        />
        <Route
          path="/evento/:eventId/historico"
          element={
            <Protected>
              <HistoryPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
