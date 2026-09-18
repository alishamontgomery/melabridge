import { expect, test } from "@playwright/test";
import { resetOnboarding, signIn, signOut, smokeConfig } from "./support/config";

const smoke = smokeConfig();
test.describe.configure({ mode: "serial" });

test("sign-in, callback, protected reload, and logout work for every supported role", async ({ page }) => {
  for (const role of ["host", "planner", "vendor", "admin"] as const) {
    const account = smoke.accounts[role];
    if (role !== "admin") await resetOnboarding(role);
    await signIn(page, account);
    if (role === "host" || role === "planner") {
      await expect(page).toHaveURL(new RegExp(`/onboarding\\?type=${role}$`));
    } else {
      await expect(page).toHaveURL(new RegExp(`${account.initialPath.replace(/[?]/g, "\\?")}$`));
    }
    await page.reload();
    await expect(page).not.toHaveURL(/\/auth(?:\/callback)?/);
    await signOut(page);
  }
});

test("host onboarding persists and lands on the host dashboard", async ({ page }) => {
  const account = smoke.accounts.host;
  await resetOnboarding("host");
  await signIn(page, account);
  await expect(page).toHaveURL(/\/onboarding\?type=host$/);
  await page.getByRole("button", { name: /organizing my own event/i }).click();
  await page.getByRole("button", { name: /create my first event/i }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  await signOut(page);
  await signIn(page, account);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("planner onboarding persists and opens the created event workspace", async ({ page }) => {
  const account = smoke.accounts.planner;
  await resetOnboarding("planner");
  await signIn(page, account);
  await expect(page).toHaveURL(/\/onboarding\?type=planner$/);
  await page.getByRole("button", { name: /professional event planner/i }).click();
  await page.locator("#ev-name").fill("E2E Planner Launch Event");
  await page.getByRole("button", { name: /^next$/i }).click();
  await expect(page).toHaveURL(/\/events\/[^/]+$/);
  await signOut(page);
  await signIn(page, account);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("vendor onboarding persists and lands on the vendor dashboard", async ({ page }) => {
  const account = smoke.accounts.vendor;
  await resetOnboarding("vendor");
  await signIn(page, account);
  await page.goto("/onboarding?type=vendor");
  await expect(page).toHaveURL(/\/onboarding\?type=vendor$/);
  await page.locator("#biz-name").fill("E2E Launch Vendor");
  await page.getByRole("button", { name: /photography/i }).first().click();
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText(/launch my profile/i)).toBeVisible({ timeout: 45_000 });
  await page.getByText(/accept MelaBridge's vendor terms/i).click();
  await page.getByRole("button", { name: /launch my profile/i }).click();
  await expect(page).toHaveURL(/\/vendor$/);
  await signOut(page);
  await signIn(page, account);
  await expect(page).toHaveURL(/\/vendor$/);
});

async function claimFreeTicket(
  page: Parameters<typeof signIn>[0],
  buyerName: string,
  buyerEmail: string,
): Promise<string> {
  await page.goto(`/t/${smoke.ticketEventId}`);
  await expect(page.getByRole("heading", { name: "E2E Launch Gate" })).toBeVisible();
  await page.getByText("Free Admission", { exact: true }).click();
  await page.locator("#buyer-name").fill(buyerName);
  await page.locator("#buyer-email").fill(buyerEmail);
  await page.getByText(/I agree to the Ticketing Terms/i).click();
  await page.getByRole("button", { name: /claim tickets/i }).click();
  await expect(page).toHaveURL(new RegExp(`/t/${smoke.ticketEventId}/confirm\\?`));
  const ticketLink = page.getByRole("link", { name: /view/i }).first();
  const href = await ticketLink.getAttribute("href");
  if (!href) throw new Error("[e2e] Free claim did not return a ticket link.");
  return href;
}

test("free ticket claim shows the confirmation QR", async ({ page }, testInfo) => {
  const buyerName = `E2E Buyer ${testInfo.project.name}`;
  const buyerEmail = `e2e-${testInfo.project.name}@example.test`;
  const href = await claimFreeTicket(page, buyerName, buyerEmail);
  await expect(page.getByText("Your tickets", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /view/i }).first()).toHaveAttribute("href", /\/ticket\/[a-f0-9]{32}/i);
  await page.goto(href);
  await expect(page).toHaveURL(/\/ticket\/[a-f0-9]{32}/i);
  await expect(page.getByText(buyerName)).toBeVisible();
});

test("paid checkout return finalizes the sandbox order", async ({ page }) => {
  await page.goto(
    `/t/${smoke.ticketEventId}/confirm?session_id=${encodeURIComponent(smoke.paidSessionId)}&access_token=${encodeURIComponent(smoke.paidAccessToken)}`,
  );
  await expect(page).toHaveURL(new RegExp(`/t/${smoke.ticketEventId}/confirm\\?`));
  await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("link", { name: /view/i }).first()).toHaveAttribute(
    "href",
    /\/ticket\//,
  );
});

test("scanner accepts a ticket once and reports duplicate scans", async ({ page }, testInfo) => {
  const href = await claimFreeTicket(
    page,
    `E2E Scanner Buyer ${testInfo.project.name}`,
    `e2e-scanner-${testInfo.project.name}@example.test`,
  );
  const qrCode = href.split("/ticket/")[1];
  if (!qrCode) throw new Error("[e2e] Could not extract the claimed ticket QR code.");
  await page.addInitScript((rawValue) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => 4,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: async () => undefined,
    });
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        return [{ rawValue }];
      }
    };
  }, `https://example.test/ticket/${qrCode}`);
  await resetOnboarding("planner");
  await signIn(page, smoke.accounts.planner);
  await page.goto(`/checkin/${smoke.ticketEventId}`);
  await expect(page.getByRole("heading", { name: /check-in scanner/i })).toBeVisible();
  await expect(page.getByText("Check-in successful")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Dismiss scan result" }).click();
  await page.waitForTimeout(3_200);
  await expect(page.getByText("Already checked in")).toBeVisible({ timeout: 30_000 });
});