import { createClient } from "@/lib/supabase/client"

export type QuotationItem = {
  garment: string
  fit: string
  color: string
  size: string
  name: string
  number: string
  notes: string
  unitPrice: number
  adjustment: {
    type: "surcharge" | "discount"
    mode: "fixed" | "percent"
    value: number
    note: string
    enabled: boolean
  }
  netPrice: number
}

export type Quotation = {
  id: string
  company_id: string
  quote_number: string
  customer_name: string
  salesperson: string
  note: string
  entry_date: string
  delivery_date: string
  quantity: number
  subtotal: number
  surcharges: number
  discounts: number
  grand_total: number
  items: QuotationItem[]
  reference_images: string[]
  created_at: string
}

export type QuotationImage = {
  path: string
  signedUrl: string
}

export type NewQuotation = Omit<
  Quotation,
  "id" | "company_id" | "quote_number" | "reference_images" | "created_at"
>

const quotationImageBucket = "quotation-references"
const imageUrlExpirationSeconds = 60 * 60 * 24 * 7
const maxQuotationImageSize = 5 * 1024 * 1024
const allowedQuotationImageTypes = ["image/jpeg", "image/png", "image/webp"]

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function signQuotationImages(paths: string[]): Promise<QuotationImage[]> {
  const supabase = createClient()
  return Promise.all(paths.map(async (path) => {
    const { data, error } = await supabase.storage
      .from(quotationImageBucket)
      .createSignedUrl(path, imageUrlExpirationSeconds)
    throwOnError(error)
    if (!data?.signedUrl) throw new Error("No se pudo generar el enlace de una imagen de referencia.")
    return { path, signedUrl: data.signedUrl }
  }))
}

export async function createSupabaseQuotation(
  companyId: string,
  quotation: NewQuotation,
  images: File[],
) {
  if (images.length > 10) {
    throw new Error("Puedes adjuntar hasta 10 imágenes por cotización.")
  }
  for (const image of images) {
    if (!allowedQuotationImageTypes.includes(image.type)) {
      throw new Error("Las imágenes deben estar en formato JPG, PNG o WebP.")
    }
    if (image.size > maxQuotationImageSize) {
      throw new Error("Cada imagen de referencia puede pesar hasta 5 MB.")
    }
  }

  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  throwOnError(userError)
  if (!user) throw new Error("Debes iniciar sesión para guardar una cotización.")

  const quoteNumber = `COT-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { data: row, error: insertError } = await supabase
    .from("quotations")
    .insert({
      company_id: companyId,
      created_by: user.id,
      quote_number: quoteNumber,
      customer_name: quotation.customer_name,
      salesperson: quotation.salesperson,
      note: quotation.note,
      entry_date: quotation.entry_date,
      delivery_date: quotation.delivery_date,
      quantity: quotation.quantity,
      subtotal: quotation.subtotal,
      surcharges: quotation.surcharges,
      discounts: quotation.discounts,
      grand_total: quotation.grand_total,
      items: quotation.items,
      reference_images: [],
    })
    .select("id, quote_number")
    .single()
  throwOnError(insertError)
  if (!row) throw new Error("No se pudo crear el registro de la cotización.")

  const uploadedPaths: string[] = []
  try {
    for (const image of images) {
      const extension = image.type === "image/jpeg" ? "jpg" : image.type.split("/")[1]
      const path = `${companyId}/${row.id}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage
        .from(quotationImageBucket)
        .upload(path, image, {
          cacheControl: "3600",
          contentType: image.type,
          upsert: false,
        })
      throwOnError(error)
      uploadedPaths.push(path)
    }

    if (uploadedPaths.length > 0) {
      const { error } = await supabase
        .from("quotations")
        .update({ reference_images: uploadedPaths })
        .eq("company_id", companyId)
        .eq("id", row.id)
        .select("id")
        .single()
      throwOnError(error)
    }

    const signedImages = await signQuotationImages(uploadedPaths)
    return { id: row.id as string, quoteNumber: row.quote_number as string, images: signedImages }
  } catch (error) {
    const cleanupErrors: string[] = []
    if (uploadedPaths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from(quotationImageBucket)
        .remove(uploadedPaths)
      if (removeError) cleanupErrors.push(removeError.message)
    }
    const { error: deleteError } = await supabase
      .from("quotations")
      .delete()
      .eq("company_id", companyId)
      .eq("id", row.id)
    if (deleteError) cleanupErrors.push(deleteError.message)

    const message = error instanceof Error ? error.message : "Error inesperado al guardar la cotización."
    throw new Error(cleanupErrors.length > 0
      ? `${message} Además, no se pudo completar la limpieza: ${cleanupErrors.join("; ")}`
      : message)
  }
}

export async function loadSupabaseQuotations(companyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  throwOnError(error)

  const quotations = (data ?? []) as Quotation[]
  const images = await Promise.all(quotations.map((quotation) =>
    signQuotationImages(quotation.reference_images ?? []),
  ))
  return quotations.map((quotation, index) => ({
    ...quotation,
    images: images[index],
  }))
}
