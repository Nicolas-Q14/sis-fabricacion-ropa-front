"use client"

import { useEffect, useState, type FormEvent } from "react"
import Image from "next/image"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImagePlusIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import {
  removePublicCatalogImage,
  uploadPublicCatalogImage,
} from "@/lib/inventory/catalog-image-storage"
import type {
  PublicCatalogBannerData,
  PublicCatalogFooterData,
  PublicCatalogSlide,
} from "@/lib/inventory/use-public-catalog-marketing"
import { createClient } from "@/lib/supabase/client"

type PublicCatalogBannerProps = {
  banner: PublicCatalogBannerData | null
}

export function PublicCatalogBanner({ banner }: PublicCatalogBannerProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
      {banner?.image_url ? (
        <Image
          alt={banner.alt_text}
          className="object-cover"
          fill
          priority
          sizes="(min-width: 1280px) 1280px, 100vw"
          src={banner.image_url}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_30%,rgba(220,38,38,0.5),transparent_45%),linear-gradient(120deg,#111827,#334155)]" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/75 to-slate-900/30"
      />
      <div className="relative max-w-2xl space-y-5">
        <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
          Inventario Frenesi Sport
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Prendas para cada equipo y cada temporada.
        </h1>
        <p className="max-w-xl text-sm text-slate-200 sm:text-base">
          Explora nuestro catálogo organizado por colección, categoría y tipo de prenda.
          Consulta tallas y existencias actualizadas.
        </p>
        <Button
          className="bg-white text-slate-950 hover:bg-slate-100"
          onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}
        >
          Explorar catálogo
        </Button>
      </div>
    </section>
  )
}

type PublicCatalogCarouselProps = {
  slides: PublicCatalogSlide[]
  showEmptyState?: boolean
}

export function PublicCatalogCarousel({
  slides,
  showEmptyState = false,
}: PublicCatalogCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [paused, setPaused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const sortedSlides = slides
    .filter((slide) => slide.is_active)
    .sort((left, right) => left.sort_order - right.sort_order)

  useEffect(() => {
    if (!api) return
    const updateSelectedIndex = () => setSelectedIndex(api.selectedScrollSnap())
    api.on("select", updateSelectedIndex)
    api.on("reInit", updateSelectedIndex)
    updateSelectedIndex()
    return () => {
      api.off("select", updateSelectedIndex)
      api.off("reInit", updateSelectedIndex)
    }
  }, [api])

  useEffect(() => {
    if (!api || paused || sortedSlides.length < 2) return
    const timer = window.setInterval(() => api.scrollNext(), 6000)
    return () => window.clearInterval(timer)
  }, [api, paused, sortedSlides.length])

  if (sortedSlides.length === 0 && !showEmptyState) return null

  return (
    <section aria-label="Colección destacada" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.2em] text-red-700 uppercase">
            Frenesi Sport
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Colección destacada</h2>
          <p className="text-sm text-muted-foreground">
            Equipos que inspiran. Prendas diseñadas para rendir.
          </p>
        </div>
        {sortedSlides.length > 1 && (
          <div className="flex shrink-0 gap-2">
            <Button
              aria-label="Imagen anterior"
              className="size-9 rounded-full border-slate-200 bg-white"
              onClick={() => api?.scrollPrev()}
              size="icon"
              variant="outline"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              aria-label="Imagen siguiente"
              className="size-9 rounded-full border-slate-200 bg-white"
              onClick={() => api?.scrollNext()}
              size="icon"
              variant="outline"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </div>

      {sortedSlides.length > 0 ? (
        <Carousel
          aria-label="Imágenes promocionales"
          className="group mx-auto max-w-7xl"
          opts={{ align: "center", loop: sortedSlides.length > 1 }}
          onBlurCapture={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
              setPaused(false)
            }
          }}
          onFocusCapture={() => setPaused(true)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          setApi={setApi}
        >
          <CarouselContent className="ml-0">
            {sortedSlides.map((slide) => (
              <CarouselItem className="basis-[94%] pl-3 first:pl-0" key={slide.id}>
                <article className="relative isolate aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900 text-white sm:aspect-[16/4] lg:aspect-[16/3]">
                  <Image
                    alt={slide.alt_text}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1280px) 1280px, 100vw"
                    src={slide.image_url}
                    unoptimized
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"
                  />
                  {(slide.title || slide.subtitle) && (
                    <div className="absolute inset-x-0 bottom-0 max-w-2xl space-y-2 p-6 sm:p-8">
                      {slide.title && (
                        <h3 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                          {slide.title}
                        </h3>
                      )}
                      {slide.subtitle && (
                        <p className="max-w-xl text-sm text-white/85 sm:text-base">
                          {slide.subtitle}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          {sortedSlides.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-1">
              {sortedSlides.map((slide, index) => (
                <button
                  aria-label={`Mostrar imagen ${index + 1}`}
                  aria-current={selectedIndex === index}
                  className={`h-1.5 rounded-full transition-all ${
                    selectedIndex === index ? "w-6 bg-slate-900" : "w-1.5 bg-slate-300"
                  }`}
                  key={slide.id}
                  onClick={() => api?.scrollTo(index)}
                  type="button"
                />
              ))}
            </div>
          )}
        </Carousel>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay imágenes promocionales. Agrega imágenes desde la administración del catálogo.
          </CardContent>
        </Card>
      )}
    </section>
  )
}

type PublicCatalogFooterProps = {
  footer: PublicCatalogFooterData | null
}

export function PublicCatalogFooter({ footer }: PublicCatalogFooterProps) {
  const whatsappUrl = footer?.whatsapp_phone
    ? `https://wa.me/${footer.whatsapp_phone}`
    : null

  return (
    <footer className="relative isolate overflow-hidden rounded-2xl bg-slate-950 text-white">
      {footer?.background_url ? (
        <Image
          alt=""
          className="object-cover"
          fill
          sizes="(min-width: 1280px) 1280px, 100vw"
          src={footer.background_url}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(115deg,#090b10,#20242c_55%,#090b10)]" />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/75" />
      <div className="relative grid gap-7 px-6 py-7 sm:grid-cols-[1fr_1.5fr_auto] sm:items-center sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-600">
            <Image
              alt=""
              className="object-contain p-1.5"
              height={40}
              src="/favicon-32x32.png"
              width={40}
            />
          </span>
          <span className="font-semibold">Frenesi Sport</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{footer?.title || "¿Necesitas ayuda?"}</h2>
          <p className="text-sm text-white/70">
            {footer?.description || "Contáctanos para recibir atención personalizada."}
          </p>
          {whatsappUrl && (
            <a
              className="inline-flex rounded-full border border-white/35 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
              href={whatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              {footer?.whatsapp_label || "Escríbenos por WhatsApp"}
            </a>
          )}
        </div>

        {footer?.qr_url && (
          <div className="flex items-center gap-3 sm:justify-end">
            <Image
              alt={footer.qr_alt}
              className="size-16 rounded-lg bg-white p-1 object-contain"
              height={64}
              src={footer.qr_url}
              width={64}
              unoptimized
            />
            <p className="max-w-24 text-xs text-white/70">
              Escanea el código y escríbenos por WhatsApp.
            </p>
          </div>
        )}
      </div>
    </footer>
  )
}

type PublicCatalogMarketingEditorProps = {
  banner: PublicCatalogBannerData | null
  footer: PublicCatalogFooterData | null
  slides: PublicCatalogSlide[]
  isSuperadmin: boolean
  error: string
  onRefresh: () => Promise<void>
}

export function PublicCatalogMarketingEditor({
  banner,
  footer,
  slides,
  isSuperadmin,
  error,
  onRefresh,
}: PublicCatalogMarketingEditorProps) {
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerAlt, setBannerAlt] = useState(banner?.alt_text ?? "")
  const [footerBackgroundFile, setFooterBackgroundFile] = useState<File | null>(null)
  const [footerQrFile, setFooterQrFile] = useState<File | null>(null)
  const [footerTitle, setFooterTitle] = useState(footer?.title ?? "¿Necesitas ayuda?")
  const [footerDescription, setFooterDescription] = useState(
    footer?.description ?? "Contáctanos para recibir atención personalizada.",
  )
  const [footerPhone, setFooterPhone] = useState(footer?.whatsapp_phone ?? "")
  const [footerWhatsappLabel, setFooterWhatsappLabel] = useState(
    footer?.whatsapp_label ?? "Escríbenos por WhatsApp",
  )
  const [footerQrAlt, setFooterQrAlt] = useState(
    footer?.qr_alt ?? "Código QR para contactar por WhatsApp",
  )
  const [removeFooterBackground, setRemoveFooterBackground] = useState(false)
  const [removeFooterQr, setRemoveFooterQr] = useState(false)
  const [slideFile, setSlideFile] = useState<File | null>(null)
  const [slideAlt, setSlideAlt] = useState("")
  const [slideTitle, setSlideTitle] = useState("")
  const [slideSubtitle, setSlideSubtitle] = useState("")
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [hasError, setHasError] = useState(false)
  const [inputVersion, setInputVersion] = useState(0)

  if (!isSuperadmin && !error) return null

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage("")
    setHasError(false)
    let uploadedPath: string | null = null

    try {
      if ((bannerFile || banner?.image_path) && !bannerAlt.trim()) {
        throw new Error("Escribe un texto alternativo para la imagen del banner.")
      }

      let imagePath = banner?.image_path ?? null
      let imageUrl = banner?.image_url ?? null
      if (bannerFile) {
        const uploaded = await uploadPublicCatalogImage(bannerFile, "banner")
        uploadedPath = uploaded.path
        imagePath = uploaded.path
        imageUrl = uploaded.publicUrl
      }

      const supabase = createClient()
      const { error: updateError } = await supabase
        .from("public_catalog_banner")
        .update({
          image_path: imagePath,
          image_url: imageUrl,
          alt_text: bannerAlt.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)

      if (updateError) {
        if (uploadedPath) {
          try {
            await removePublicCatalogImage(uploadedPath)
          } catch (cleanupError) {
            throw new Error(
              `No se pudo guardar el banner: ${updateError.message}. Tampoco se pudo limpiar la imagen nueva: ${errorMessage(cleanupError)}`,
            )
          }
        }
        throw new Error(`No se pudo guardar el banner: ${updateError.message}`)
      }

      let resultMessage = "El banner se guardó correctamente."
      if (uploadedPath && banner?.image_path && banner.image_path !== uploadedPath) {
        try {
          await removePublicCatalogImage(banner.image_path)
        } catch (cleanupError) {
          resultMessage += ` No se pudo eliminar la imagen anterior: ${errorMessage(cleanupError)}`
        }
      }
      setBannerFile(null)
      setInputVersion((version) => version + 1)
      await onRefresh()
      setMessage(resultMessage)
      setHasError(false)
    } catch (caught) {
      setMessage(errorMessage(caught))
      setHasError(true)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveFooter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setMessage("")
    setHasError(false)
    const uploadedPaths: string[] = []

    try {
      if (!footerTitle.trim() || !footerDescription.trim() || !footerWhatsappLabel.trim()) {
        throw new Error("Completa el título, descripción y texto del botón del footer.")
      }
      if (footerPhone && !/^\d{8,15}$/.test(footerPhone)) {
        throw new Error("El número de WhatsApp debe tener entre 8 y 15 dígitos, incluido el código de país.")
      }
      if ((footerQrFile || (footer?.qr_url && !removeFooterQr)) && !footerQrAlt.trim()) {
        throw new Error("Escribe un texto alternativo para el código QR.")
      }

      let backgroundPath = removeFooterBackground ? null : footer?.background_path ?? null
      let backgroundUrl = removeFooterBackground ? null : footer?.background_url ?? null
      let qrPath = removeFooterQr ? null : footer?.qr_path ?? null
      let qrUrl = removeFooterQr ? null : footer?.qr_url ?? null

      if (footerBackgroundFile) {
        const uploaded = await uploadPublicCatalogImage(footerBackgroundFile, "footer")
        uploadedPaths.push(uploaded.path)
        backgroundPath = uploaded.path
        backgroundUrl = uploaded.publicUrl
      }
      if (footerQrFile) {
        const uploaded = await uploadPublicCatalogImage(footerQrFile, "footer-qr")
        uploadedPaths.push(uploaded.path)
        qrPath = uploaded.path
        qrUrl = uploaded.publicUrl
      }

      const supabase = createClient()
      const { error: saveError } = await supabase.from("public_catalog_footer").upsert({
        id: true,
        background_path: backgroundPath,
        background_url: backgroundUrl,
        title: footerTitle.trim(),
        description: footerDescription.trim(),
        whatsapp_phone: footerPhone.trim(),
        whatsapp_label: footerWhatsappLabel.trim(),
        qr_path: qrPath,
        qr_url: qrUrl,
        qr_alt: footerQrAlt.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })

      if (saveError) {
        const cleanupErrors: string[] = []
        for (const path of uploadedPaths) {
          try {
            await removePublicCatalogImage(path)
          } catch (cleanupError) {
            cleanupErrors.push(errorMessage(cleanupError))
          }
        }
        const cleanupDetails = cleanupErrors.length > 0
          ? ` No se pudieron limpiar las imágenes nuevas: ${cleanupErrors.join("; ")}`
          : ""
        throw new Error(`No se pudo guardar el footer: ${saveError.message}.${cleanupDetails}`)
      }

      const oldPaths = [
        footerBackgroundFile || removeFooterBackground ? footer?.background_path : null,
        footerQrFile || removeFooterQr ? footer?.qr_path : null,
      ].filter((path): path is string => Boolean(path))
      const cleanupErrors: string[] = []
      for (const path of oldPaths) {
        try {
          await removePublicCatalogImage(path)
        } catch (cleanupError) {
          cleanupErrors.push(errorMessage(cleanupError))
        }
      }

      setFooterBackgroundFile(null)
      setFooterQrFile(null)
      setRemoveFooterBackground(false)
      setRemoveFooterQr(false)
      setInputVersion((version) => version + 1)
      await onRefresh()
      setMessage(cleanupErrors.length > 0
        ? `Footer guardado, pero no se pudieron eliminar imágenes anteriores: ${cleanupErrors.join("; ")}`
        : "Footer guardado correctamente.")
      setHasError(false)
    } catch (caught) {
      setMessage(errorMessage(caught))
      setHasError(true)
    } finally {
      setIsSaving(false)
    }
  }

  async function addSlide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slideFile) {
      setMessage("Selecciona una imagen para agregar al carrusel.")
      setHasError(true)
      return
    }
    if (!slideAlt.trim()) {
      setMessage("Escribe un texto alternativo para la imagen.")
      setHasError(true)
      return
    }

    setIsSaving(true)
    setMessage("")
    setHasError(false)
    let uploadedPath: string | null = null

    try {
      const uploaded = await uploadPublicCatalogImage(slideFile, "carousel")
      uploadedPath = uploaded.path
      const supabase = createClient()
      const { error: insertError } = await supabase.from("public_catalog_carousel").insert({
        image_path: uploaded.path,
        image_url: uploaded.publicUrl,
        alt_text: slideAlt.trim(),
        title: slideTitle.trim() || null,
        subtitle: slideSubtitle.trim() || null,
        sort_order: Math.max(-1, ...slides.map((slide) => slide.sort_order)) + 1,
        is_active: true,
      })

      if (insertError) {
        try {
          await removePublicCatalogImage(uploaded.path)
        } catch (cleanupError) {
          throw new Error(
            `No se pudo guardar la imagen en el carrusel: ${insertError.message}. Tampoco se pudo limpiar el archivo: ${errorMessage(cleanupError)}`,
          )
        }
        throw new Error(`No se pudo agregar la imagen al carrusel: ${insertError.message}`)
      }

      setSlideFile(null)
      setSlideAlt("")
      setSlideTitle("")
      setSlideSubtitle("")
      setInputVersion((version) => version + 1)
      await onRefresh()
      setMessage("La imagen se agregó al carrusel.")
    } catch (caught) {
      if (uploadedPath) setSlideFile(null)
      setMessage(errorMessage(caught))
      setHasError(true)
    } finally {
      setIsSaving(false)
    }
  }

  async function updateSlide(slide: PublicCatalogSlide, changes: Partial<PublicCatalogSlide>) {
    setIsSaving(true)
    setMessage("")
    setHasError(false)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from("public_catalog_carousel")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", slide.id)
      if (updateError) throw new Error(`No se pudo actualizar la imagen: ${updateError.message}`)
      await onRefresh()
      if (typeof changes.sort_order === "number") {
        setOrderDrafts((drafts) => ({ ...drafts, [slide.id]: String(changes.sort_order) }))
      }
      setMessage("Cambios guardados.")
    } catch (caught) {
      setMessage(errorMessage(caught))
      setHasError(true)
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteSlide(slide: PublicCatalogSlide) {
    if (!window.confirm("¿Eliminar esta imagen del carrusel?")) return
    setIsSaving(true)
    setMessage("")
    setHasError(false)
    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .from("public_catalog_carousel")
        .delete()
        .eq("id", slide.id)
      if (deleteError) throw new Error(`No se pudo eliminar la imagen: ${deleteError.message}`)

      let resultMessage = "La imagen se eliminó del carrusel."
      try {
        await removePublicCatalogImage(slide.image_path)
      } catch (cleanupError) {
        resultMessage += ` No se pudo limpiar el archivo: ${errorMessage(cleanupError)}`
      }
      await onRefresh()
      setMessage(resultMessage)
      setHasError(false)
    } catch (caught) {
      setMessage(errorMessage(caught))
      setHasError(true)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isSuperadmin) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-4 text-sm text-destructive" role="alert">
          No se pudo cargar la administración del contenido promocional. {error}
        </CardContent>
      </Card>
    )
  }

  const sortedSlides = [...slides].sort((left, right) => left.sort_order - right.sort_order)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contenido promocional del catálogo</CardTitle>
        <CardDescription>
          Actualiza la imagen del banner y administra las imágenes que aparecen después de los productos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            No se pudo actualizar el contenido desde el servidor: {error}
          </p>
        )}
        <form className="space-y-4 rounded-xl border p-4" onSubmit={saveBanner}>
          <div className="space-y-1">
            <h3 className="font-semibold">Banner principal</h3>
            <p className="text-sm text-muted-foreground">
              La imagen se muestra como fondo de la portada del catálogo.
            </p>
          </div>
          {banner?.image_url && (
            <div className="relative aspect-[3/1] overflow-hidden rounded-lg bg-muted">
              <Image
                alt={banner.alt_text}
                className="object-cover"
                fill
                sizes="(min-width: 1280px) 1000px, 100vw"
                src={banner.image_url}
                unoptimized
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Imagen del banner
              <Input
                accept="image/jpeg,image/png,image/webp,image/avif"
                key={`banner-${inputVersion}`}
                onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Texto alternativo
              <Input
                maxLength={200}
                onChange={(event) => setBannerAlt(event.target.value)}
                placeholder="Descripción de la imagen"
                value={bannerAlt}
              />
            </label>
          </div>
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Guardando…" : "Guardar banner"}
          </Button>
        </form>

        <form className="space-y-4 rounded-xl border p-4" onSubmit={saveFooter}>
          <div className="space-y-1">
            <h3 className="font-semibold">Footer de contacto</h3>
            <p className="text-sm text-muted-foreground">
              Personaliza la franja de contacto al final de la landing, incluida la imagen de fondo y el QR.
            </p>
          </div>
          {footer?.background_url && !removeFooterBackground && (
            <div className="relative aspect-[8/1] overflow-hidden rounded-lg bg-muted">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="(min-width: 1280px) 1000px, 100vw"
                src={footer.background_url}
                unoptimized
              />
            </div>
          )}
          {footer?.qr_url && !removeFooterQr && (
            <div className="relative size-24 overflow-hidden rounded-lg bg-white p-2">
              <Image
                alt={footer.qr_alt}
                className="object-contain"
                fill
                sizes="96px"
                src={footer.qr_url}
                unoptimized
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Imagen de fondo
              <Input
                accept="image/jpeg,image/png,image/webp,image/avif"
                key={`footer-background-${inputVersion}`}
                onChange={(event) => setFooterBackgroundFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            {footer?.background_url && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  checked={removeFooterBackground}
                  onChange={(event) => setRemoveFooterBackground(event.target.checked)}
                  type="checkbox"
                />
                Quitar imagen de fondo
              </label>
            )}
            <label className="space-y-1.5 text-sm font-medium">
              Título
              <Input
                maxLength={120}
                onChange={(event) => setFooterTitle(event.target.value)}
                required
                value={footerTitle}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Número de WhatsApp
              <Input
                inputMode="numeric"
                maxLength={15}
                onChange={(event) => setFooterPhone(event.target.value.replace(/\D/g, ""))}
                placeholder="573001234567"
                value={footerPhone}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Descripción
              <Input
                maxLength={240}
                onChange={(event) => setFooterDescription(event.target.value)}
                required
                value={footerDescription}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Texto del botón
              <Input
                maxLength={80}
                onChange={(event) => setFooterWhatsappLabel(event.target.value)}
                required
                value={footerWhatsappLabel}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Imagen del código QR
              <Input
                accept="image/jpeg,image/png,image/webp,image/avif"
                key={`footer-qr-${inputVersion}`}
                onChange={(event) => setFooterQrFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            {footer?.qr_url && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  checked={removeFooterQr}
                  onChange={(event) => setRemoveFooterQr(event.target.checked)}
                  type="checkbox"
                />
                Quitar código QR
              </label>
            )}
            <label className="space-y-1.5 text-sm font-medium">
              Texto alternativo del QR
              <Input
                maxLength={200}
                onChange={(event) => setFooterQrAlt(event.target.value)}
                value={footerQrAlt}
              />
            </label>
          </div>
          <Button disabled={isSaving} type="submit">
            {isSaving ? "Guardando…" : "Guardar footer"}
          </Button>
        </form>

        <form className="space-y-4 rounded-xl border p-4" onSubmit={addSlide}>
          <div className="space-y-1">
            <h3 className="font-semibold">Agregar imagen al carrusel</h3>
            <p className="text-sm text-muted-foreground">
              Sube una imagen promocional para mostrarla después de la lista de productos.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Imagen
              <Input
                accept="image/jpeg,image/png,image/webp,image/avif"
                key={`slide-${inputVersion}`}
                onChange={(event) => setSlideFile(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Texto alternativo
              <Input
                maxLength={200}
                onChange={(event) => setSlideAlt(event.target.value)}
                placeholder="Describe la imagen"
                required
                value={slideAlt}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Título (opcional)
              <Input
                maxLength={120}
                onChange={(event) => setSlideTitle(event.target.value)}
                placeholder="Nueva colección"
                value={slideTitle}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Descripción (opcional)
              <Input
                maxLength={240}
                onChange={(event) => setSlideSubtitle(event.target.value)}
                placeholder="Una frase para acompañar la imagen"
                value={slideSubtitle}
              />
            </label>
          </div>
          <Button disabled={isSaving} type="submit">
            <ImagePlusIcon data-icon="inline-start" />
            Agregar al carrusel
          </Button>
        </form>

        {sortedSlides.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Imágenes del carrusel</h3>
            {sortedSlides.map((slide, index) => (
              <div
                className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[120px_minmax(0,1fr)_auto]"
                key={slide.id}
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <Image
                    alt={slide.alt_text}
                    className="object-cover"
                    fill
                    sizes="120px"
                    src={slide.image_url}
                    unoptimized
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="truncate text-sm font-medium">
                    {slide.title || slide.alt_text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {slide.is_active ? "Visible al público" : "Oculta al público"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={`Orden de ${slide.alt_text}`}
                      className="h-8 w-24"
                      min={0}
                      onChange={(event) => setOrderDrafts((drafts) => ({
                        ...drafts,
                        [slide.id]: event.target.value,
                      }))}
                      type="number"
                      value={orderDrafts[slide.id] ?? String(slide.sort_order)}
                    />
                    <Button
                      disabled={isSaving || Number(orderDrafts[slide.id]) === slide.sort_order}
                      onClick={() => {
                        const order = Number(orderDrafts[slide.id])
                        if (!Number.isInteger(order) || order < 0) {
                          setMessage("El orden debe ser un número entero igual o mayor que cero.")
                          setHasError(true)
                          return
                        }
                        void updateSlide(slide, { sort_order: order })
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Guardar orden
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Button
                    disabled={isSaving}
                    onClick={() => void updateSlide(slide, { is_active: !slide.is_active })}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {slide.is_active ? "Ocultar" : "Publicar"}
                  </Button>
                  <Button
                    aria-label={`Eliminar ${slide.alt_text}`}
                    disabled={isSaving}
                    onClick={() => void deleteSlide(slide)}
                    size="icon-sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon />
                  </Button>
                  <span className="sr-only">Imagen {index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {message && (
          <p
            className={`text-sm ${hasError ? "text-destructive" : "text-muted-foreground"}`}
            role={hasError ? "alert" : "status"}
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado."
}
