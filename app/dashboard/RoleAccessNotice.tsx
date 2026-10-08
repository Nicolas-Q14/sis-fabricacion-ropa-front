'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './role-access.module.css'

export default function RoleAccessNotice({ message }: { message: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    setError('')

    try {
      const { error: signOutError } = await createClient().auth.signOut()

      if (signOutError) {
        setError('No se pudo cerrar sesión. Inténtalo de nuevo.')
        setIsSigningOut(false)
        return
      }

      router.push('/login')
    } catch {
      setError('No se pudo cerrar sesión. Inténtalo de nuevo.')
      setIsSigningOut(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="access-title">
        <span className={styles.mark} aria-hidden="true">F</span>
        <h1 id="access-title">Acceso no disponible</h1>
        <p>{message}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button disabled={isSigningOut} onClick={handleSignOut} type="button">
          {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </section>
    </main>
  )
}
