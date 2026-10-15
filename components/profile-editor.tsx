'use client'

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, CameraIcon, UserRoundIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const maxPhotoSize = 5 * 1024 * 1024
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp']

export function ProfileEditor({
  avatarUrl,
  email,
  fullName,
  userId,
}: {
  avatarUrl: string | null
  email: string
  fullName: string
  userId: string
}) {
  const router = useRouter()
  const photoInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(fullName)
  const [currentEmail] = useState(email)
  const [newEmail, setNewEmail] = useState(email)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState(avatarUrl)
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isRequestingEmail, setIsRequestingEmail] = useState(false)

  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join('').toUpperCase() || 'U'

  function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!allowedPhotoTypes.includes(file.type)) {
      toast.error('La foto debe estar en formato JPG, PNG o WebP.')
      event.target.value = ''
      return
    }

    if (file.size > maxPhotoSize) {
      toast.error('La foto no puede superar los 5 MB.')
      event.target.value = ''
      return
    }

    setSelectedPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)

    try {
      const supabase = createClient()
      let nextAvatarUrl = avatarUrl

      if (selectedPhoto) {
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(`${userId}/avatar`, selectedPhoto, {
            cacheControl: '0',
            contentType: selectedPhoto.type,
            upsert: true,
          })

        if (uploadError) {
          toast.error(`No se pudo subir la foto: ${uploadError.message}`)
          return
        }

        const { data } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(`${userId}/avatar`)
        nextAvatarUrl = `${data.publicUrl}?updated=${Date.now()}`
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
          avatar_url: nextAvatarUrl,
        },
      })

      if (updateError) {
        toast.error(`No se pudo guardar el perfil: ${updateError.message}`)
        return
      }

      setPhotoUrl(nextAvatarUrl)
      setSelectedPhoto(null)
      if (photoInput.current) photoInput.current.value = ''
      toast.success('Perfil actualizado.')
      router.refresh()
    } catch {
      toast.error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleRequestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = newEmail.trim().toLowerCase()
    if (normalizedEmail === currentEmail.toLowerCase()) {
      toast.error('Ingresa un correo distinto al actual.')
      return
    }

    setIsRequestingEmail(true)
    try {
      const { error } = await createClient().auth.updateUser({ email: normalizedEmail })
      if (error) {
        toast.error(`No se pudo solicitar el cambio de correo: ${error.message}`)
        return
      }

      toast.success(
        'Solicitud enviada. Revisa el correo nuevo para confirmar el cambio y el anterior para la notificación de seguridad.',
        { duration: 8000 },
      )
      setPendingEmail(normalizedEmail)
    } catch {
      toast.error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setIsRequestingEmail(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-5 bg-muted/40 p-4 md:justify-center md:p-8">
      <Button className="w-fit" render={<Link href="/dashboard" />} variant="ghost">
        <ArrowLeftIcon />
        Volver al dashboard
      </Button>

      <div>
        <p className="text-sm text-muted-foreground">Cuenta</p>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información personal</CardTitle>
          <CardDescription>Actualiza tu nombre y foto de perfil.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSaveProfile}>
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                {photoUrl && <AvatarImage alt="" src={photoUrl} />}
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid gap-2">
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handlePhotoSelected}
                  ref={photoInput}
                  type="file"
                />
                <Button onClick={() => photoInput.current?.click()} type="button" variant="outline">
                  <CameraIcon />
                  Elegir foto
                </Button>
                <span className="text-xs text-muted-foreground">JPG, PNG o WebP; máximo 5 MB.</span>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-medium" htmlFor="profile-name">
              Nombre
              <Input
                autoComplete="name"
                id="profile-name"
                maxLength={100}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>

            <Button disabled={isSavingProfile} type="submit">
              <UserRoundIcon />
              {isSavingProfile ? 'Guardando…' : 'Guardar perfil'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Correo electrónico</CardTitle>
          <CardDescription>
            Correo actual: <span className="font-medium text-foreground">{currentEmail}</span>
            {pendingEmail && (
              <span className="mt-1 block">
                Cambio pendiente de confirmación para {pendingEmail}.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleRequestEmailChange}>
            <label className="grid gap-2 text-sm font-medium" htmlFor="profile-email">
              Nuevo correo electrónico
              <Input
                autoComplete="email"
                id="profile-email"
                onChange={(event) => setNewEmail(event.target.value)}
                required
                type="email"
                value={newEmail}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Supabase enviará la verificación al nuevo correo. La notificación de seguridad al
              correo actual debe estar habilitada en la configuración de Auth del proyecto.
            </p>
            <Button disabled={isRequestingEmail} type="submit" variant="outline">
              {isRequestingEmail ? 'Enviando solicitud…' : 'Solicitar cambio de correo'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
