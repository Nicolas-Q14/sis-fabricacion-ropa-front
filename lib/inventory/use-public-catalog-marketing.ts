"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type PublicCatalogBannerData = {
  image_path: string | null
  image_url: string | null
  alt_text: string
}

export type PublicCatalogSlide = {
  id: string
  image_path: string
  image_url: string
  alt_text: string
  title: string | null
  subtitle: string | null
  sort_order: number
  is_active: boolean
}

export type PublicCatalogFooterData = {
  background_path: string | null
  background_url: string | null
  title: string
  description: string
  whatsapp_phone: string
  whatsapp_label: string
  qr_path: string | null
  qr_url: string | null
  qr_alt: string
}

export function usePublicCatalogMarketing(checkSuperadmin = true) {
  const [banner, setBanner] = useState<PublicCatalogBannerData | null>(null)
  const [slides, setSlides] = useState<PublicCatalogSlide[]>([])
  const [footer, setFooter] = useState<PublicCatalogFooterData | null>(null)
  const [hasSession, setHasSession] = useState(false)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(() => Promise.resolve().then(async () => {
    const supabase = createClient()
    setError("")
    setIsLoading(true)
    let canManage = false

    try {
      if (checkSuperadmin) {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw new Error(`No se pudo verificar la sesión: ${userError.message}`)
        setHasSession(Boolean(user))

        if (user && user.app_metadata?.is_active !== false
          && user.app_metadata?.must_change_password !== true) {
          const { data: role, error: roleError } = await supabase
            .from("user_roles")
            .select("id")
            .eq("user_id", user.id)
            .eq("role", "superadmin")
            .is("company_id", null)
            .maybeSingle()
          if (roleError) throw new Error(`No se pudieron verificar los permisos: ${roleError.message}`)
          canManage = Boolean(role)
        } else {
          setHasSession(false)
        }
      }

      const [bannerResult, slidesResult, footerResult] = await Promise.all([
        supabase
          .from("public_catalog_banner")
          .select("image_path,image_url,alt_text")
          .eq("id", true)
          .maybeSingle(),
        supabase
          .from("public_catalog_carousel")
          .select("id,image_path,image_url,alt_text,title,subtitle,sort_order,is_active")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("public_catalog_footer")
          .select("background_path,background_url,title,description,whatsapp_phone,whatsapp_label,qr_path,qr_url,qr_alt")
          .eq("id", true)
          .maybeSingle(),
      ])
      if (bannerResult.error) throw new Error(`No se pudo cargar el banner: ${bannerResult.error.message}`)
      if (slidesResult.error) throw new Error(`No se pudo cargar el carrusel: ${slidesResult.error.message}`)
      if (footerResult.error) throw new Error(`No se pudo cargar el footer: ${footerResult.error.message}`)
      setBanner(bannerResult.data as PublicCatalogBannerData | null)
      setSlides((slidesResult.data ?? []) as PublicCatalogSlide[])
      setFooter(footerResult.data as PublicCatalogFooterData | null)
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "No se pudo cargar el contenido promocional del catálogo.")
    } finally {
      setIsSuperadmin(canManage)
      setIsLoading(false)
    }
  }), [checkSuperadmin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { banner, slides, footer, hasSession, isSuperadmin, error, isLoading, refresh }
}
