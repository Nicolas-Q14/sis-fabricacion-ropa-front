"use client"

import Image from "next/image"
import Link from "next/link"
import type { FormEventHandler } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type LoginFormProps = {
  email: string
  password: string
  rememberMe: boolean
  showPassword: boolean
  status: string
  isSubmitting: boolean
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onRememberMeChange: (rememberMe: boolean) => void
  onTogglePassword: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function LoginForm({
  email,
  password,
  rememberMe,
  showPassword,
  status,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onTogglePassword,
  onSubmit,
}: LoginFormProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 font-sans">
      <Card className="overflow-hidden p-0 shadow-sm">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={onSubmit}>
            <FieldGroup className="gap-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Bienvenido a Frenesi Sport
                </h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Inicia sesión para continuar a tu espacio de trabajo.
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  autoComplete="username"
                  id="email"
                  name="email"
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  type="email"
                  value={email}
                />
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  <a
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                    href="mailto:soporte@frenesi.com?subject=Recuperar%20acceso"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    autoComplete="current-password"
                    className="pr-10"
                    id="password"
                    name="password"
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <Button
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
                    onClick={onTogglePassword}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    {showPassword
                      ? <EyeOff aria-hidden="true" />
                      : <Eye aria-hidden="true" />}
                  </Button>
                </div>
              </Field>

              <Field orientation="horizontal" className="items-center gap-2">
                <Checkbox
                  checked={rememberMe}
                  id="remember-me"
                  onCheckedChange={onRememberMeChange}
                />
                <FieldLabel className="font-normal" htmlFor="remember-me">
                  Recordarme
                </FieldLabel>
              </Field>

              {status && (
                <FieldDescription className="text-destructive" role="alert">
                  {status}
                </FieldDescription>
              )}

              <Field>
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
                </Button>
              </Field>

              <Button
                className="w-full"
                nativeButton={false}
                render={<Link href="/inventario" />}
                variant="outline"
              >
                Consultar inventario actual
              </Button>

              <FieldDescription className="text-center">
                Acceso exclusivo para el equipo de trabajo.
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="relative hidden min-h-96 overflow-hidden bg-[#e30613] md:block">
            <Image
              alt="Frenesi Sport"
              className="object-contain"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 0px"
              src="/frenesi-sport-logo.png"
            />
          </div>
        </CardContent>
      </Card>

      <p className="px-6 text-center text-xs text-muted-foreground">
        <Link className="underline-offset-4 hover:underline" href="/">
          Volver al inicio
        </Link>
      </p>
    </div>
  )
}
