'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '../../lib/supabase/client'
import styles from './role-access.module.css'

export default function RoleAccessNotice({ message }: { message: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false)

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

      setIsSignOutDialogOpen(false)
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
        <button
          disabled={isSigningOut}
          onClick={() => setIsSignOutDialogOpen(true)}
          type="button"
        >
          Cerrar sesión
        </button>
      </section>
      <Dialog
        onOpenChange={(open) => {
          if (!isSigningOut) setIsSignOutDialogOpen(open)
        }}
        open={isSignOutDialogOpen}
      >
        <DialogContent showCloseButton={!isSigningOut}>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Se cerrará tu sesión y volverás a la pantalla de inicio de sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isSigningOut}
              onClick={() => setIsSignOutDialogOpen(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              variant="destructive"
            >
              {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
