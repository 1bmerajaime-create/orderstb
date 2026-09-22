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

function Protected({ children }: { children: React.ReactNode }) {
  const { authenticated, cloudEnabled, syncReady, syncError } = useStore();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (cloudEnabled && !syncReady && !syncError) {
    return (
      <div className="app-shell">
        <main className="page" style={{ paddingTop: '3rem' }}>
          <p className="muted">Sincronizando datos…</p>
        </main>
      </div>
    );
  }
  return (
    <>
      {cloudEnabled && syncError && (
        <div className="sync-banner sync-banner-error">
          Error de sincronización: {syncError}
        </div>
      )}
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
