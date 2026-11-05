import { describe, expect, it } from "vitest";
import { company, companyStructuredData, externalWebsite, validCnpj } from "@/config/company";
describe("Dados institucionais", () => {
  it("valida os dígitos do CNPJ informado sem simular consulta cadastral", () => {
    expect(validCnpj(company.cnpj)).toBe(true);
    expect(validCnpj("69.648.594/0001-49")).toBe(false);
    expect(validCnpj("11.111.111/1111-11")).toBe(false);
    expect(companyStructuredData.taxID).toBe(company.cnpj);
  });
  it("não cria links fictícios ou URLs executáveis para a Termit", () => {
    expect(externalWebsite(null)).toBeNull();
    expect(externalWebsite("javascript:alert(1)")).toBeNull();
    expect(externalWebsite("https://example.invalid")).toBe("https://example.invalid/");
  });
  it("gera links de contato e Maps com o endereço sem coordenadas inventadas", () => {
    expect(company.telephoneUrl).toBe("tel:+5511965710464");
    expect(new URL(company.mapsUrl).searchParams.get("query")).toBe(company.formattedAddress);
    expect(companyStructuredData).not.toHaveProperty("geo");
    expect(companyStructuredData).not.toHaveProperty("openingHours");
  });
});
