export const companyName = "Frenesi Sport"
export const companyNit = "901524573-6"
export const companyAddress = "Cl. 36 Bis Sur 73B-04, Bogotá D.C."
export const companyEmail = "grupo.erasas@gmail.com"
export const companyPhone = "3124157146"
export const companyLogoPath = "/frenesi-sport-logo.png"

const units = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
]

const twenties = [
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
]

const tens = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
const hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

function underHundred(value: number) {
  if (value < 20) return units[value]
  if (value < 30) return twenties[value - 20]
  const ten = Math.floor(value / 10)
  const unit = value % 10
  return unit === 0 ? tens[ten] : `${tens[ten]} y ${units[unit]}`
}

function underThousand(value: number) {
  if (value === 100) return "cien"
  if (value < 100) return underHundred(value)
  const hundred = Math.floor(value / 100)
  const remainder = value % 100
  return remainder === 0 ? hundreds[hundred] : `${hundreds[hundred]} ${underHundred(remainder)}`
}

function apocopateOne(value: string) {
  if (value.endsWith("veintiuno")) return `${value.slice(0, -9)}veintiún`
  return value.endsWith("uno") ? `${value.slice(0, -3)}un` : value
}

function spellInteger(value: number): string {
  if (value === 0) return "cero"

  const parts: string[] = []
  const billions = Math.floor(value / 1_000_000_000)
  const millions = Math.floor(value / 1_000_000) % 1_000
  const thousands = Math.floor(value / 1_000) % 1_000
  const remainder = value % 1_000

  if (billions > 0) {
    parts.push(billions === 1
      ? "mil millones"
      : `${apocopateOne(underThousand(billions))} mil millones`)
  }
  if (millions > 0) {
    parts.push(millions === 1
      ? "un millón"
      : `${apocopateOne(underThousand(millions))} millones`)
  }
  if (thousands > 0) {
    parts.push(thousands === 1
      ? "mil"
      : `${apocopateOne(underThousand(thousands))} mil`)
  }
  if (remainder > 0) parts.push(underThousand(remainder))
  return parts.join(" ")
}

export function amountInWords(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("No se puede convertir a letras un valor que no sea numérico.")
  }

  const amount = Math.round(Math.abs(value))
  if (amount > 999_999_999_999) {
    throw new RangeError("El valor supera el límite que se puede expresar con seguridad en letras.")
  }

  const words = apocopateOne(spellInteger(amount))
  const currency = amount === 1
    ? "peso colombiano"
    : amount >= 1_000_000 && amount % 1_000_000 === 0
      ? "de pesos colombianos"
      : "pesos colombianos"

  return `${value < 0 ? "menos " : ""}${words} ${currency}`.toLocaleUpperCase("es-CO")
}

export function companyDocumentHeaderMarkup() {
  return `<div class="company-brand">
    <img src="${window.location.origin}${companyLogoPath}" alt="${companyName}">
    <div>
      <strong>${companyName}</strong>
      <span>NIT: ${companyNit}</span>
      <span>${companyAddress}</span>
      <span>Tel. ${companyPhone} · ${companyEmail}</span>
    </div>
  </div>`
}

export function waitForCompanyLogo(image: HTMLImageElement | null) {
  if (!image) return Promise.reject(new Error("No se encontró el logo de la empresa en el comprobante."))
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error("No se pudo cargar el logo de la empresa para imprimir."))
  }

  return new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true })
    image.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar el logo de la empresa para imprimir.")),
      { once: true },
    )
  })
}
