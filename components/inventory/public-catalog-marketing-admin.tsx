"use client"

import { Card, CardContent } from "@/components/ui/card"
import { PublicCatalogMarketingEditor } from "@/components/inventory/public-catalog-marketing"
import { usePublicCatalogMarketing } from "@/lib/inventory/use-public-catalog-marketing"

export function PublicCatalogMarketingAdmin() {
  const { banner, slides, footer, hasSession, isSuperadmin, error, refresh } =
    usePublicCatalogMarketing()

  if (!isSuperadmin && !hasSession && !error) return null

  if (!isSuperadmin && error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-4 text-sm text-destructive" role="alert">
          No se pudo cargar la administración del catálogo público: {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <PublicCatalogMarketingEditor
      banner={banner}
      error={error}
      footer={footer}
      isSuperadmin={isSuperadmin}
      onRefresh={refresh}
      slides={slides}
    />
  )
}
