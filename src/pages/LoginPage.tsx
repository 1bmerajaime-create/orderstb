import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import logoVerticalUrl from '../assets/logo-vertical.png';

export function LoginPage() {
  const { login, authenticated, cloudEnabled } = useStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (authenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const ok = await login(password);
      if (ok) navigate('/');
      else setError('Contraseña incorrecta');
    } catch {
      setError(
        cloudEnabled
          ? 'No se pudo conectar con la nube. Revisa la configuración de Firebase.'
          : 'Contraseña incorrecta',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-logo">
          <img src={logoVerticalUrl} alt="Tropic Boost — açaí bowls" />
          <p className="eyebrow">Operaciones · Eventos</p>
          <p>Acceso al portal de gestión de pedidos</p>
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Introduce la contraseña"
            value={password}
            disabled={loading}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={loading}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="hint-note">
          Solo el equipo Tropic Boost.
          {cloudEnabled
            ? ' Los datos se sincronizan en tiempo real entre dispositivos.'
            : ' En futuras versiones habrá perfiles (Caja, Cocina, Responsable…).'}
        </p>
      </form>
    </div>
  );
}
