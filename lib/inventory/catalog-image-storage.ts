import { createClient } from "@/lib/supabase/client"

const bucketName = "catalog-images"
const maxImageSize = 5 * 1024 * 1024
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const fileExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

export async function uploadCatalogImage(
  file: File,
  taxonomy: { year: number; family: string; subcategory: string },
) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("La imagen debe ser JPG, PNG, WebP o AVIF.")
  }
  if (file.size > maxImageSize) {
    throw new Error("La imagen no puede superar los 5 MB.")
  }

  const path = [
    "catalog",
    String(taxonomy.year),
    normalizeFolder(taxonomy.family),
    normalizeFolder(taxonomy.subcategory),
    `${crypto.randomUUID()}.${fileExtensions[file.type]}`,
  ].join("/")
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`No se pudo subir la imagen del catálogo: ${error.message}`)

  return {
    path,
    publicUrl: supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl,
  }
}

export async function removeCatalogImage(path: string) {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucketName).remove([path])
  if (error) throw new Error(`No se pudo eliminar la imagen no asociada: ${error.message}`)
}

function normalizeFolder(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}
