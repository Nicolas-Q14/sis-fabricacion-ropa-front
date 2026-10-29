"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowDownToLineIcon, RefreshCwIcon, Share2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import {
  convertSupabaseQuotationToOrder,
  loadSupabaseQuotations,
  type QuotationItem,
} from "@/lib/orders/supabase-quotations"

type LoadedQuotation = Awaited<ReturnType<typeof loadSupabaseQuotations>>[number]

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)
}

function quoteDescription(quotation: LoadedQuotation) {
  const itemLines = quotation.items.map((item) =>
    `• ${item.garment} ${item.fit}, ${item.color}, talla ${item.size}${item.name ? ` · ${item.name}` : ""}${item.number ? ` · N.º ${item.number}` : ""}: ${money(item.netPrice)}`,
  )
  return [
    `Cotización ${quotation.quote_number}`,
    `Cliente: ${quotation.customer_name}`,
    `Entrega: ${formatDate(quotation.delivery_date)}`,
    "",
    ...itemLines,
    "",
    `Total: ${money(Number(quotation.grand_total))}`,
    ...quotation.images.map((image, index) => `Imagen de referencia ${index + 1}: ${image.signedUrl}`),
  ].join("\n")
}

function printableRows(items: QuotationItem[]) {
  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item.garment)} · ${escapeHtml(item.fit)} · ${escapeHtml(item.color)} · Talla ${escapeHtml(item.size)}${item.name ? `<br>Nombre: ${escapeHtml(item.name)}` : ""}${item.number ? `<br>Número: ${escapeHtml(item.number)}` : ""}</td>
      <td class="number">${escapeHtml(money(item.netPrice))}</td>
    </tr>`,
  ).join("")
}

function printQuotation(quotation: LoadedQuotation) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    toast.error("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.")
    return
  }

  const references = quotation.images.map((image, index) => `
    <figure>
      <img src="${escapeHtml(image.signedUrl)}" alt="Referencia ${index + 1}">
      <figcaption>Imagen de referencia ${index + 1}</figcaption>
    </figure>`,
  ).join("")
  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(quotation.quote_number)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { color: #172033; font: 14px/1.5 Arial, sans-serif; margin: 0 auto; max-width: 760px; }
    header { border-bottom: 2px solid #172033; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 28px 0 10px; }
    .muted { color: #667085; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #d9dee8; padding: 9px 6px; text-align: left; vertical-align: top; }
    th { background: #f3f5f8; }
    .number { text-align: right; white-space: nowrap; }
    .total { border-top: 2px solid #172033; font-size: 18px; font-weight: 700; margin: 16px 0 0 auto; max-width: 300px; padding-top: 10px; text-align: right; }
    .references { display: grid; gap: 16px; grid-template-columns: repeat(2, 1fr); }
    figure { margin: 0; page-break-inside: avoid; }
    figure img { max-height: 320px; object-fit: contain; width: 100%; }
    figcaption { color: #667085; font-size: 12px; }
    footer { border-top: 1px solid #d9dee8; margin-top: 36px; padding-top: 12px; }
    .print-button { background: #172033; border: 0; border-radius: 6px; color: white; cursor: pointer; margin: 20px 0; padding: 12px 18px; }
    @media print { .print-button { display: none; } }
  </style>
</head>
<body>
  <button class="print-button" id="print-quotation">Descargar o imprimir como PDF</button>
  <header>
    <h1>Cotización ${escapeHtml(quotation.quote_number)}</h1>
    <div class="muted">${escapeHtml(new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date()))}</div>
  </header>
  <section>
    <p><strong>Cliente:</strong> ${escapeHtml(quotation.customer_name)}</p>
    <p><strong>Vendedor:</strong> ${escapeHtml(quotation.salesperson)}</p>
    <p><strong>Fecha de ingreso:</strong> ${escapeHtml(formatDate(quotation.entry_date))}</p>
    <p><strong>Entrega pactada:</strong> ${escapeHtml(formatDate(quotation.delivery_date))}</p>
    <p><strong>Cantidad:</strong> ${quotation.quantity} prendas</p>
    ${quotation.note ? `<p><strong>Nota:</strong> ${escapeHtml(quotation.note)}</p>` : ""}
  </section>
  <h2>Detalle de prendas</h2>
  <table>
    <thead><tr><th>Prenda</th><th class="number">Valor por unidad</th></tr></thead>
    <tbody>${printableRows(quotation.items)}</tbody>
  </table>
  <p class="total">Total: ${escapeHtml(money(Number(quotation.grand_total)))}</p>
  ${references ? `<h2>Imágenes de referencia</h2><section class="references">${references}</section>` : ""}
  <footer class="muted">Cotización ${escapeHtml(quotation.quote_number)} · No constituye un pedido confirmado.</footer>
</body>
</html>`)
  printWindow.document.close()
  printWindow.document.getElementById("print-quotation")?.addEventListener("click", () => {
    printWindow.print()
  })
  let hasPrinted = false
  const printOnce = () => {
    if (hasPrinted) return
    hasPrinted = true
    printWindow.focus()
    printWindow.print()
  }
  const imagesLoaded = Promise.all(Array.from(printWindow.document.images).map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true })
      image.addEventListener("error", () => resolve(), { once: true })
    })
  }))
  void imagesLoaded.then(() => window.setTimeout(printOnce, 100))
  window.setTimeout(printOnce, 5000)
}

async function shareQuotation(quotation: LoadedQuotation) {
  const text = quoteDescription(quotation)
  try {
    if (navigator.share) {
      await navigator.share({ title: `Cotización ${quotation.quote_number}`, text })
      toast.success("Cotización compartida.")
      return
    }

    await navigator.clipboard.writeText(text)
    toast.success("Cotización copiada con los enlaces de sus imágenes.")
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
    toast.error("No se pudo compartir la cotización. Intenta copiarla desde un navegador con permisos.")
  }
}

export function QuotationsList() {
  const { companyId } = useOrdersOperator()
  const [quotations, setQuotations] = useState<LoadedQuotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quotationToConfirm, setQuotationToConfirm] = useState<LoadedQuotation | null>(null)
  const [convertingQuotationId, setConvertingQuotationId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadSupabaseQuotations(companyId)
      setQuotations(data)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las cotizaciones.")
    } finally {
      setLoading(false)
    }
  }, [companyId])

  async function confirmOrder() {
    if (!quotationToConfirm) return

    setConvertingQuotationId(quotationToConfirm.id)
    try {
      const order = await convertSupabaseQuotationToOrder(companyId, quotationToConfirm.id)
      await refresh()
      setQuotationToConfirm(null)
      toast.success(`Pedido ${order.code} creado desde la cotización ${quotationToConfirm.quote_number}.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo confirmar el pedido.")
    } finally {
      setConvertingQuotationId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    void loadSupabaseQuotations(companyId).then((data) => {
      if (cancelled) return
      setQuotations(data)
      setError(null)
    }).catch((caught: unknown) => {
      if (cancelled) return
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las cotizaciones.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [companyId])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Cotizaciones guardadas con sus prendas e imágenes de referencia.
          </p>
        </div>
        <Button
          disabled={loading}
          onClick={() => void refresh()}
          type="button"
          variant="outline"
        >
          <RefreshCwIcon data-icon="inline-start" /> Actualizar
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          No se pudieron cargar las cotizaciones: {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando cotizaciones…</p>
      ) : quotations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay cotizaciones guardadas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {quotations.map((quotation) => (
            <Card key={quotation.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{quotation.quote_number}</CardTitle>
                    <CardDescription>
                      {quotation.customer_name} · {quotation.quantity} prendas · Entrega {formatDate(quotation.delivery_date)}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{money(Number(quotation.grand_total))}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p><span className="text-muted-foreground">Vendedor: </span>{quotation.salesperson}</p>
                  <p><span className="text-muted-foreground">Creada: </span>{formatDate(quotation.created_at.slice(0, 10))}</p>
                  <p><span className="text-muted-foreground">Ingreso: </span>{formatDate(quotation.entry_date)}</p>
                </div>
                {quotation.note && <p className="text-sm text-muted-foreground">{quotation.note}</p>}

                <div className="divide-y rounded-md border">
                  {quotation.items.map((item, index) => (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" key={`${quotation.id}-${index}`}>
                      <span>
                        <span className="font-medium">{item.garment}</span>
                        {" · "}{item.fit} · {item.color} · Talla {item.size}
                        {item.name ? ` · ${item.name}` : ""}
                        {item.number ? ` · N.º ${item.number}` : ""}
                      </span>
                      <span className="tabular-nums">{money(item.netPrice)}</span>
                    </div>
                  ))}
                </div>

                {quotation.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Imágenes de referencia ({quotation.images.length})</p>
                    <div className="flex flex-wrap gap-3">
                      {quotation.images.map((image, index) => (
                        <a
                          className="overflow-hidden rounded-md border"
                          href={image.signedUrl}
                          key={image.path}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Image
                            alt={`Referencia ${index + 1} de ${quotation.quote_number}`}
                            className="h-28 w-36 object-cover"
                            height={112}
                            src={image.signedUrl}
                            unoptimized
                            width={144}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => printQuotation(quotation)} type="button">
                    <ArrowDownToLineIcon data-icon="inline-start" /> Descargar / imprimir PDF
                  </Button>
                  <Button onClick={() => void shareQuotation(quotation)} type="button" variant="outline">
                    <Share2Icon data-icon="inline-start" /> Compartir
                  </Button>
                  {quotation.converted_order_id ? (
                    <>
                      <Badge variant="secondary" className="h-9 px-3">
                        Pedido confirmado
                      </Badge>
                      <Button render={<Link href="/dashboard/orders" />} variant="outline">
                        Ver pedidos
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setQuotationToConfirm(quotation)} type="button" variant="outline">
                      Confirmar pedido
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(quotationToConfirm)}
        onOpenChange={(open) => {
          if (!open && !convertingQuotationId) setQuotationToConfirm(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pedido</DialogTitle>
            <DialogDescription>
              {quotationToConfirm
                ? `Se creará un pedido para ${quotationToConfirm.customer_name} desde la cotización ${quotationToConfirm.quote_number}. El pedido quedará pendiente de pago y reservará las prendas en la bodega principal.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={Boolean(convertingQuotationId)}
              onClick={() => setQuotationToConfirm(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={Boolean(convertingQuotationId)}
              onClick={() => void confirmOrder()}
              type="button"
            >
              {convertingQuotationId ? "Creando pedido…" : "Confirmar y crear pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
