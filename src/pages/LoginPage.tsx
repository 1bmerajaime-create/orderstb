import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import logoVerticalUrl from '../assets/logo-vertical.png';

export function LoginPage() {
  const { login, authenticated } = useStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (authenticated) return <Navigate to="/" replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (login(password)) {
      navigate('/');
    } else {
      setError('Contraseña incorrecta');
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
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block">
          Entrar
        </button>
        <p className="hint-note">
          Solo el equipo Tropic Boost. En futuras versiones habrá perfiles
          (Caja, Cocina, Responsable…).
        </p>
      </form>
    </div>
  );
}
