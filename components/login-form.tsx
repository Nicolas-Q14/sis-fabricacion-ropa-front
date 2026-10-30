"use client"

import Image from "next/image"
import Link from "next/link"
import type { FormEventHandler } from "react"
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react"

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 font-sans">
      <Card className="overflow-hidden rounded-[1.75rem] border-0 bg-white p-0 shadow-[0_32px_80px_-28px_rgba(15,23,42,0.32)] ring-1 ring-slate-900/5">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="flex flex-col justify-center p-7 sm:p-10 lg:p-12"
            onSubmit={onSubmit}
          >
            <FieldGroup className="gap-5">
              <div className="flex flex-col items-start gap-2 text-left">
                <span aria-hidden="true" className="mb-1 h-1 w-9 rounded-full bg-red-600" />
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900">
                  Bienvenido a
                  <span className="block text-red-700">Frenesi Sport</span>
                </h1>
                <p className="text-balance text-sm leading-relaxed text-slate-500">
                  Inicia sesión para continuar a tu espacio de trabajo.
                </p>
              </div>

              <Field>
                <FieldLabel className="text-slate-700" htmlFor="email">
                  Correo electrónico
                </FieldLabel>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    autoComplete="username"
                    className="h-11 rounded-xl border-slate-200 bg-white pl-11 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                    id="email"
                    name="email"
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="nombre@empresa.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel className="text-slate-700" htmlFor="password">
                    Contraseña
                  </FieldLabel>
                  <a
                    className="ml-auto text-xs font-medium text-slate-500 underline-offset-4 transition-colors hover:text-red-700 hover:underline sm:text-sm"
                    href="mailto:soporte@frenesi.com?subject=Recuperar%20acceso"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-slate-200 bg-white pr-11 pl-11 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                    id="password"
                    name="password"
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-500"
                  />
                  <Button
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="absolute top-1/2 right-2 size-8 -translate-y-1/2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
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
                  className="size-5 rounded-md border-slate-300 data-checked:bg-red-600 data-checked:text-white"
                  checked={rememberMe}
                  id="remember-me"
                  onCheckedChange={onRememberMeChange}
                />
                <FieldLabel className="cursor-pointer font-normal text-slate-600" htmlFor="remember-me">
                  Recordarme
                </FieldLabel>
              </Field>

              {status && (
                <FieldDescription className="text-destructive" role="alert">
                  {status}
                </FieldDescription>
              )}

              <Field>
                <Button
                  className="h-12 w-full rounded-xl bg-gradient-to-b from-slate-800 to-black text-sm font-semibold shadow-[0_8px_18px_-8px_rgba(0,0,0,0.65)] transition-all hover:-translate-y-0.5 hover:from-slate-700 hover:to-slate-950 hover:shadow-[0_12px_22px_-10px_rgba(0,0,0,0.7)]"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
                  <ArrowRight aria-hidden="true" className="ml-1 size-5" />
                </Button>
              </Field>

              <Button
                className="h-12 w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-100"
                nativeButton={false}
                render={<Link href="/inventario" />}
                variant="outline"
              >
                <CalendarDays aria-hidden="true" className="size-[18px] text-slate-600" />
                Consultar inventario actual
              </Button>

              <FieldDescription className="mt-1 flex items-center gap-4 text-center text-xs text-slate-400">
                <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
                <span className="shrink-0">Acceso exclusivo para el equipo de trabajo.</span>
                <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="relative min-h-64 overflow-hidden bg-[#e20612] md:min-h-[36rem]">
            <Image
              alt=""
              className="object-cover"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              src="/frenesi-login-background.png"
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-500">
        <Link className="underline-offset-4 transition-colors hover:text-slate-800 hover:underline" href="/">
          Volver al inicio
        </Link>
      </p>
    </div>
  )
}
