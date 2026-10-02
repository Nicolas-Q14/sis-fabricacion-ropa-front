'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/client';
import styles from '../css/login.module.css';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setIsSubmitting(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      let isValidSupabaseUrl = false;

      try {
        const url = new URL(supabaseUrl ?? '');
        isValidSupabaseUrl = url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        isValidSupabaseUrl = false;
      }

      if (!isValidSupabaseUrl || !supabaseKey) {
        setStatus('Configura una URL válida y la clave pública de Supabase en las variables de entorno.');
        return;
      }

      const supabase = createClient(rememberMe);
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus('No pudimos validar tus datos. Revisa tu correo y contraseña.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setStatus('No fue posible conectar con el servidor. Inténtalo de nuevo en unos minutos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.story} aria-label="Sistema de gestión textil">
        <Link className={styles.brand} href="/" aria-label="Hilo, inicio">
          <span className={styles.brandMark} aria-hidden="true">H</span>
          <span>hilo<span className={styles.brandDot}>.</span></span>
        </Link>

        <div className={styles.storyCopy}>
          <span className={styles.eyebrow}>GESTIÓN TEXTIL, EN ORDEN</span>
          <h1>Las buenas ideas también se <em>organizan.</em></h1>
          <p>Producción, inventario y pedidos. Todo el taller, en una sola vista.</p>
        </div>

        <div className={styles.fabricNote}>
          <span className={styles.fabricLine} aria-hidden="true" />
          <span>Hecho para quienes hacen</span>
          <span className={styles.fabricIndex}>01 — 03</span>
        </div>
      </section>

      <section className={styles.formSide}>
        <div className={styles.mobileBrand} aria-hidden="true">
          <span className={styles.brandMark}>H</span><span>hilo<span className={styles.brandDot}>.</span></span>
        </div>
        <div className={styles.formWrap}>
          <div className={styles.formHeading}>
            <span className={styles.eyebrow}>TU ESPACIO DE TRABAJO</span>
            <h2>Qué bueno verte.</h2>
            <p>Ingresa tus datos para continuar.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field} htmlFor="email">
              <span>Correo electrónico</span>
              <input
                autoComplete="username"
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@empresa.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className={styles.field} htmlFor="password">
              <span>Contraseña</span>
              <span className={styles.passwordInput}>
                <input
                  autoComplete="current-password"
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className={styles.visibilityButton}
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>

            <div className={styles.formOptions}>
              <label className={styles.remember}>
                <input
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  type="checkbox"
                />
                <span>Recordarme</span>
              </label>
              <a className={styles.helpLink} href="mailto:soporte@hilo.app?subject=Recuperar%20acceso">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {status && <p className={styles.status} role="status">{status}</p>}

            <button className={styles.submit} disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <p className={styles.footer}>Acceso exclusivo para el equipo de trabajo.</p>
        </div>
      </section>
    </main>
  );
}