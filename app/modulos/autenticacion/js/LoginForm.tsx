'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm as LoginFormView } from '../../../../components/login-form';
import { createClient } from '../../../../lib/supabase/client';

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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus('No pudimos validar tus datos. Revisa tu correo y contraseña.');
        return;
      }

      if (data.user?.app_metadata?.is_active === false) {
        await supabase.auth.signOut();
        setStatus('Tu cuenta está desactivada. Contacta al superadmin.');
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
    <main className="flex min-h-svh items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#f4f5f7_55%,_#e9ebef_100%)] p-4 sm:p-6 md:p-10">
      <section className="w-full max-w-6xl" aria-label="Iniciar sesión">
        <LoginFormView
          email={email}
          isSubmitting={isSubmitting}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onRememberMeChange={setRememberMe}
          onSubmit={handleSubmit}
          onTogglePassword={() => setShowPassword((visible) => !visible)}
          password={password}
          rememberMe={rememberMe}
          showPassword={showPassword}
          status={status}
        />
      </section>
    </main>
  );
}