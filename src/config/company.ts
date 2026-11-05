export function validCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  let base = digits.slice(0, 12);
  for (const weights of [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  ]) {
    const remainder =
      [...base].reduce((sum, digit, i) => sum + Number(digit) * weights[i]!, 0) % 11;
    base += remainder < 2 ? "0" : String(11 - remainder);
  }
  return base === digits;
}
export const termitWebsiteUrl: string | null = null;
export function externalWebsite(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
const address = {
  street: "Avenida Imirim, 4446",
  neighborhood: "Vila Nova Cachoeirinha",
  city: "São Paulo",
  state: "SP",
  postalCode: "02464-700",
};
const formattedAddress = `${address.street} — ${address.neighborhood}, ${address.city} — ${address.state}, CEP ${address.postalCode}`;
export const company = {
  name: "MUGUI",
  logo: "/logomg.png",
  address,
  formattedAddress,
  phone: "(11) 96571-0464",
  telephoneUrl: "tel:+5511965710464",
  whatsappUrl: "https://wa.me/5511965710464",
  instagram: "@muguitoxicologico",
  instagramUrl: "https://www.instagram.com/muguitoxicologico",
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`,
  cnpj: "69.648.594/0001-48",
} as const;
export const companyStructuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: company.name,
  telephone: "+5511965710464",
  sameAs: [company.instagramUrl],
  address: {
    "@type": "PostalAddress",
    streetAddress: `${address.street} — ${address.neighborhood}`,
    addressLocality: address.city,
    addressRegion: address.state,
    postalCode: address.postalCode,
    addressCountry: "BR",
  },
  ...(validCnpj(company.cnpj) ? { taxID: company.cnpj } : {}),
};
