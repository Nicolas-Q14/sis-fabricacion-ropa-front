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
  deleted_at: string | null
  converted_order_id: string | null
  converted_at: string | null
}

export type QuotationImage = {
  path: string
  signedUrl: string
}

export type NewQuotation = Omit<
  Quotation,
  | "id"
  | "company_id"
  | "quote_number"
  | "reference_images"
  | "created_at"
  | "deleted_at"
  | "converted_order_id"
  | "converted_at"
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

async function purgeExpiredQuotations(companyId: string) {
  const supabase = createClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("quotations")
    .select("id, reference_images, converted_order_id")
    .eq("company_id", companyId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
  throwOnError(error)

  const expired = (data ?? []) as {
    id: string
    reference_images: string[]
    converted_order_id: string | null
  }[]
  const linkedOrderIds = expired
    .map((quotation) => quotation.converted_order_id)
    .filter((id): id is string => id !== null)
  const { data: deletedOrders, error: deletedOrdersError } = linkedOrderIds.length > 0
    ? await supabase
      .from("orders")
      .select("id")
      .eq("company_id", companyId)
      .in("id", linkedOrderIds)
      .not("deleted_at", "is", null)
    : { data: [], error: null }
  throwOnError(deletedOrdersError)
  const deletedOrderIds = new Set((deletedOrders ?? []).map((order) => order.id))
  const deletable = expired.filter((quotation) =>
    quotation.converted_order_id === null
    || deletedOrderIds.has(quotation.converted_order_id),
  )
  const paths = deletable.flatMap((quotation) => quotation.reference_images ?? [])
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(quotationImageBucket)
      .remove(paths)
    throwOnError(storageError)
  }
  if (deletable.length > 0) {
    const { error: deleteError } = await supabase
      .from("quotations")
      .delete()
      .eq("company_id", companyId)
      .in("id", deletable.map((quotation) => quotation.id))
    throwOnError(deleteError)
  }
}

export async function loadSupabaseQuotations(
  companyId: string,
  view: "active" | "trash" = "active",
) {
  await purgeExpiredQuotations(companyId)
  const supabase = createClient()
  let query = supabase
    .from("quotations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  query = view === "trash"
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null)
  const { data, error } = await query
  throwOnError(error)

  const quotations = (data ?? []) as Quotation[]
  const convertedOrderIds = quotations
    .map((quotation) => quotation.converted_order_id)
    .filter((id): id is string => id !== null)
  const [{ data: orderData, error: orderError }, images] = await Promise.all([
    convertedOrderIds.length > 0
      ? supabase
        .from("orders")
        .select("id, deleted_at")
        .eq("company_id", companyId)
        .in("id", convertedOrderIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(quotations.map((quotation) =>
      signQuotationImages(quotation.reference_images ?? []),
    )),
  ])
  throwOnError(orderError)
  const deletedOrderIds = new Set(
    (orderData ?? [])
      .filter((order) => order.deleted_at !== null)
      .map((order) => order.id),
  )
  return quotations.map((quotation, index) => ({
    ...quotation,
    images: images[index],
    convertedOrderDeleted: quotation.converted_order_id !== null
      && deletedOrderIds.has(quotation.converted_order_id),
  }))
}

export async function moveSupabaseQuotationToTrash(companyId: string, quotationId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quotations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("id", quotationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()
  throwOnError(error)
  if (!data) throw new Error("La cotización ya está en la papelera o está vinculada a un pedido activo.")
}

export async function restoreSupabaseQuotation(companyId: string, quotationId: string) {
  const supabase = createClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("quotations")
    .update({ deleted_at: null })
    .eq("company_id", companyId)
    .eq("id", quotationId)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoff)
    .select("id")
    .maybeSingle()
  throwOnError(error)
  if (!data) throw new Error("No se pudo restaurar la cotización; puede haber vencido o estar asociada a un pedido.")
}

export async function permanentlyDeleteSupabaseQuotation(companyId: string, quotationId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quotations")
    .select("reference_images")
    .eq("company_id", companyId)
    .eq("id", quotationId)
    .not("deleted_at", "is", null)
    .maybeSingle()
  throwOnError(error)
  if (!data) throw new Error("No se encontró una cotización eliminable en la papelera o su pedido sigue activo.")

  const paths = (data.reference_images ?? []) as string[]
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(quotationImageBucket)
      .remove(paths)
    throwOnError(storageError)
  }
  const { data: deleted, error: deleteError } = await supabase
    .from("quotations")
    .delete()
    .eq("company_id", companyId)
    .eq("id", quotationId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle()
  throwOnError(deleteError)
  if (!deleted) throw new Error("No se pudo eliminar permanentemente la cotización; verifica si su pedido sigue activo.")
}

export async function convertSupabaseQuotationToOrder(
  companyId: string,
  quotationId: string,
) {
  const supabase = createClient()
  const orderCode = `FS-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const { data: orderId, error: conversionError } = await supabase.rpc(
    "convert_quotation_to_order",
    {
      p_company_id: companyId,
      p_quotation_id: quotationId,
      p_order_code: orderCode,
    },
  )
  throwOnError(conversionError)
  if (!orderId) throw new Error("No se pudo crear el pedido desde la cotización.")

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("code")
    .eq("company_id", companyId)
    .eq("id", orderId)
    .single()
  throwOnError(orderError)
  if (!order) throw new Error("El pedido se creó, pero no se pudo consultar su código.")

  return { id: orderId, code: order.code }
}
