"use client"

import { jsPDF } from "jspdf"
import { toast } from "sonner"
import type { OrderGarment, DemoOrder } from "@/lib/orders/demo-data"
import { createClient } from "@/lib/supabase/client"

const pdfShareBucket = "order-pdf-shares"
const signedUrlExpirationSeconds = 60 * 60 * 24 * 7

type PdfItem = Pick<OrderGarment, "garment" | "fit" | "size" | "name" | "number" | "notes"> & {
  color?: string
  unitPrice?: number
  netPrice?: number
}

type QuotationPdfData = {
  quoteNumber: string
  customer: string
  salesperson: string
  note: string
  entryDate: string
  dueDate: string
  quantity: number
  total: number
  items: PdfItem[]
  referenceImageUrls?: string[]
}

type PdfDocument = {
  type: "Pedido" | "Cotización"
  id: string
  customer: string
  salesperson: string
  note: string
  entryDate?: string
  dueDate: string
  quantity: number
  total: number
  paid?: number
  items: PdfItem[]
  referenceImageUrls?: string[]
}

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
    : new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(date)
}

function orderPdfData(order: DemoOrder): PdfDocument {
  return {
    type: "Pedido",
    id: order.id,
    customer: order.customer,
    salesperson: order.salesperson,
    note: order.note,
    entryDate: order.entryDate,
    dueDate: order.dueDate,
    quantity: order.quantity,
    total: order.total,
    paid: order.paid,
    items: order.items,
  }
}

function quotationPdfData(quotation: QuotationPdfData): PdfDocument {
  return {
    type: "Cotización",
    id: quotation.quoteNumber,
    customer: quotation.customer,
    salesperson: quotation.salesperson,
    note: quotation.note,
    entryDate: quotation.entryDate,
    dueDate: quotation.dueDate,
    quantity: quotation.quantity,
    total: quotation.total,
    items: quotation.items,
    referenceImageUrls: quotation.referenceImageUrls,
  }
}

function createPdfFile(data: PdfDocument) {
  const pdf = new jsPDF({ format: "a4", unit: "mm" })
  const left = 18
  const right = 192
  const width = right - left
  const bottom = 274
  let y = 24

  const ensureSpace = (height: number) => {
    if (y + height > bottom) {
      pdf.addPage()
      y = 20
    }
  }

  const addText = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => {
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal")
    pdf.setFontSize(options?.size ?? 10)
    const lines = pdf.splitTextToSize(text, width) as string[]
    const lineHeight = (options?.size ?? 10) * 0.48
    ensureSpace(lines.length * lineHeight + (options?.gap ?? 2))
    pdf.text(lines, left, y)
    y += lines.length * lineHeight + (options?.gap ?? 2)
  }

  pdf.setTextColor(23, 32, 51)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(18)
  pdf.text(`${data.type} ${data.id}`, left, y)
  y += 8
  pdf.setDrawColor(23, 32, 51)
  pdf.setLineWidth(0.7)
  pdf.line(left, y, right, y)
  y += 9

  addText(`Cliente: ${data.customer}`)
  addText(`Vendedor: ${data.salesperson}`)
  if (data.entryDate) addText(`Fecha de ingreso: ${formatDate(data.entryDate)}`)
  addText(`Entrega pactada: ${formatDate(data.dueDate)}`)
  addText(`Cantidad: ${data.quantity} prendas`)
  if (data.note) addText(`Nota: ${data.note}`)

  y += 4
  addText("Detalle de prendas", { bold: true, size: 13, gap: 4 })
  for (const [index, item] of data.items.entries()) {
    const description = [
      `${index + 1}. ${item.garment} - ${item.fit}`,
      item.color,
      `Talla ${item.size}`,
      item.name ? `Nombre: ${item.name}` : "",
      item.number ? `Número: ${item.number}` : "",
    ].filter(Boolean).join(" · ")
    const price = item.netPrice ?? item.unitPrice
    const lines = pdf.splitTextToSize(description, width) as string[]
    const lineHeight = 5
    const noteLines = item.notes
      ? pdf.splitTextToSize(`Observación: ${item.notes}`, width) as string[]
      : []
    ensureSpace((lines.length + noteLines.length) * lineHeight + 10)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.text(lines, left, y)
    if (price !== undefined) {
      pdf.setFont("helvetica", "bold")
      pdf.text(money(price), right, y, { align: "right" })
    }
    y += lines.length * lineHeight
    if (noteLines.length > 0) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.text(noteLines, left + 4, y)
      y += noteLines.length * 4.5
    }
    y += 5
  }

  ensureSpace(22)
  pdf.setDrawColor(217, 222, 232)
  pdf.line(left, y, right, y)
  y += 8
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(13)
  pdf.text(`Total: ${money(data.total)}`, right, y, { align: "right" })
  y += 8
  if (data.paid !== undefined) {
    addText(`Abonado: ${money(data.paid)}`)
    addText(`Saldo pendiente: ${money(Math.max(0, data.total - data.paid))}`)
  }

  if (data.referenceImageUrls?.length) {
    y += 3
    addText("Imágenes de referencia", { bold: true, size: 12, gap: 3 })
    data.referenceImageUrls.forEach((url, index) => {
      addText(`Referencia ${index + 1}: ${url}`, { size: 8, gap: 1 })
    })
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(102, 112, 133)
    pdf.text(`${data.type} ${data.id} · ${page} / ${pageCount}`, right, 287, { align: "right" })
  }

  const safeId = data.id.replace(/[^a-zA-Z0-9_-]/g, "_")
  const filePrefix = data.type === "Cotización" ? "cotizacion" : "pedido"
  return new File([pdf.output("blob")], `${filePrefix}-${safeId}.pdf`, {
    type: "application/pdf",
  })
}

async function uploadPdf(companyId: string, file: File) {
  const supabase = createClient()
  const path = `${companyId}/${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(pdfShareBucket)
    .upload(path, file, {
      cacheControl: String(signedUrlExpirationSeconds),
      contentType: "application/pdf",
      upsert: false,
    })
  if (uploadError) throw new Error(`No se pudo subir el PDF: ${uploadError.message}`)

  const { data, error: signedUrlError } = await supabase.storage
    .from(pdfShareBucket)
    .createSignedUrl(path, signedUrlExpirationSeconds)
  if (signedUrlError || !data?.signedUrl) {
    const { error: cleanupError } = await supabase.storage.from(pdfShareBucket).remove([path])
    const errorMessage = signedUrlError?.message ?? "No se recibió un enlace para el PDF."
    if (cleanupError) {
      throw new Error(`No se pudo crear el enlace del PDF: ${errorMessage}. Tampoco se pudo limpiar el archivo: ${cleanupError.message}`)
    }
    throw new Error(`No se pudo crear el enlace del PDF: ${errorMessage}`)
  }
  return data.signedUrl
}

async function sharePdf(companyId: string, data: PdfDocument) {
  const whatsappWindow = window.open("about:blank", "_blank")
  if (!whatsappWindow) {
    toast.error("El navegador bloqueó la ventana de WhatsApp. Permite ventanas emergentes e inténtalo de nuevo.")
    return
  }
  whatsappWindow.opener = null

  try {
    const file = createPdfFile(data)
    const pdfUrl = await uploadPdf(companyId, file)
    const message = `Te comparto el PDF de ${data.type.toLocaleLowerCase("es")} ${data.id}: ${pdfUrl}`
    whatsappWindow.location.href = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`
    toast.success("WhatsApp Web está listo. Selecciona la conversación y envía el enlace al PDF.")
  } catch (error) {
    whatsappWindow.close()
    toast.error(error instanceof Error ? error.message : "No se pudo preparar el PDF para WhatsApp.")
  }
}

export function shareOrderPdf(companyId: string, order: DemoOrder) {
  return sharePdf(companyId, orderPdfData(order))
}

export function shareQuotationPdf(companyId: string, quotation: QuotationPdfData) {
  return sharePdf(companyId, quotationPdfData(quotation))
}
