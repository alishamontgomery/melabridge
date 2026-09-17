import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  countPortfolioPhotos,
  mergeVendorPhotoSources,
  portfolioUrlsForSave,
} from "./vendor-photo-compat";

const builderSource = readFileSync(
  new URL("../routes/_authenticated/vendor-profile-builder.tsx", import.meta.url),
  "utf8",
);
const policySource = readFileSync(
  new URL("../../supabase/migrations/20260917232500_vendor_portfolio_storage.sql", import.meta.url),
  "utf8",
);

describe("vendor portfolio storage contract", () => {
  it("preserves legacy portfolio URLs beside labeled cover and backdrop photos", () => {
    const legacyUrls = ["https://example.com/legacy-one.jpg", "https://example.com/legacy-two.jpg"];
    const merged = mergeVendorPhotoSources(
      [
        { url: "https://example.com/cover.jpg", type: "cover" as const },
        { url: "https://example.com/backdrop.jpg", type: "backdrop" as const },
      ],
      legacyUrls,
    );

    expect(merged.map((photo) => photo.url)).toEqual([
      "https://example.com/cover.jpg",
      "https://example.com/backdrop.jpg",
      ...legacyUrls,
    ]);
    expect(portfolioUrlsForSave(merged, legacyUrls)).toEqual(legacyUrls);
    expect(countPortfolioPhotos(merged, legacyUrls)).toBe(2);
  });

  it("deduplicates mixed legacy and labeled portfolio URLs during round trips", () => {
    const sharedUrl = "https://example.com/shared.jpg";
    const merged = mergeVendorPhotoSources(
      [{ url: sharedUrl, type: "portfolio" as const }],
      [sharedUrl],
    );

    expect(merged).toHaveLength(1);
    expect(portfolioUrlsForSave(merged, [sharedUrl])).toEqual([sharedUrl]);
    expect(countPortfolioPhotos(merged, [sharedUrl])).toBe(1);
  });

  it("counts legacy portfolio photos when labeled media contains only cover or backdrop entries", () => {
    expect(
      countPortfolioPhotos(
        [{ url: "https://example.com/cover.jpg", type: "cover" }],
        [
          "https://example.com/portfolio-1.jpg",
          "https://example.com/portfolio-2.jpg",
          "https://example.com/portfolio-3.jpg",
        ],
      ),
    ).toBe(3);
  });

  it("keeps uploads under the owner-scoped portfolio prefix", () => {
    expect(builderSource).toContain("`portfolio/${user.id}/");
    expect(policySource).toContain("(storage.foldername(objects.name))[1] = 'portfolio'");
    expect(policySource).toContain(
      "(storage.foldername(objects.name))[2] = (auth.jwt() ->> 'sub')",
    );
  });

  it("keeps one shared file input mounted for every wizard step", () => {
    const renderMarker = 'return (\n    <AppShell active="/vendor-profile-builder">';
    const renderParts = builderSource.split(renderMarker);
    const reachableRender = renderParts.length >= 2 ? renderParts[1] : "";
    const sharedInputPosition = reachableRender.indexOf('aria-label="Choose portfolio photos"');
    const firstConditionalStepPosition = reachableRender.indexOf("{step === 1 &&");

    expect(sharedInputPosition).toBeGreaterThan(-1);
    expect(sharedInputPosition).toBeLessThan(firstConditionalStepPosition);
    expect(reachableRender.match(/ref=\{portfolioInputRef\}/g)).toHaveLength(1);
    expect(reachableRender.match(/portfolioInputRef\.current\?\.click\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("authorizes portfolio insert, update, and delete operations", () => {
    expect(policySource).toContain("ON storage.objects FOR INSERT");
    expect(policySource).toContain("ON storage.objects FOR UPDATE");
    expect(policySource).toContain("ON storage.objects FOR DELETE");
  });
});