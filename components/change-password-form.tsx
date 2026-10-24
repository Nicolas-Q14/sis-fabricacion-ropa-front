'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function ChangePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result: { error?: string } = await response.json()

      if (!response.ok) {
        setError(result.error ?? 'No se pudo cambiar la contraseña.')
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cambia tu contraseña</CardTitle>
          <CardDescription>
            Por seguridad, debes reemplazar la contraseña temporal antes de continuar.
            Usa al menos 12 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium" htmlFor="new-password">
              Nueva contraseña
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="pr-10"
                  id="new-password"
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <Button
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {showPassword
                    ? <EyeOff aria-hidden="true" />
                    : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="confirm-password">
              Confirmar contraseña
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="pr-10"
                  id="confirm-password"
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type={showConfirmation ? 'text' : 'password'}
                  value={confirmation}
                />
                <Button
                  aria-label={showConfirmation ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {showConfirmation
                    ? <EyeOff aria-hidden="true" />
                    : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </label>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Actualizando…' : 'Guardar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
