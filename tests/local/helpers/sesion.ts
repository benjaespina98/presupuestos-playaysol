import { expect, type Page } from "@playwright/test";

/**
 * Inicia sesión en el portal local. Espera a que la página termine de cargar y comprueba que los campos
 * quedaron con lo escrito: en WebKit, un campo lleno antes de que React termine de hidratar se vaciaba.
 */
export async function iniciarSesion(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const campoEmail = page.getByPlaceholder("tu@email.com");
  const campoClave = page.getByPlaceholder("••••••••");
  await expect(async () => {
    await campoEmail.fill(email);
    await campoClave.fill(password);
    await expect(campoEmail).toHaveValue(email);
    await expect(campoClave).toHaveValue(password);
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}
