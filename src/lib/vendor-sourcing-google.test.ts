import { describe, expect, it } from "vitest";
import {
  googleSearchTerms,
  isGooglePlaceWithinSearchRadius,
  parseGoogleBusinessSearchUrl,
  shouldIncludeGooglePlace,
} from "./vendor-sourcing.functions";

describe("Google Marketplace service relevance", () => {
  it("filters department and home-goods retailers from service searches", () => {
    expect(
      shouldIncludeGooglePlace(
        { name: "Walmart Supercenter", types: ["department_store", "supermarket", "store"] },
        "balloon artist",
      ),
    ).toBe(false);
    expect(
      shouldIncludeGooglePlace(
        { name: "Michaels", types: ["craft_store", "home_goods_store", "store"] },
        "balloon artist",
      ),
    ).toBe(false);
  });

  it("keeps a dedicated balloon service even when Google also labels it as a store", () => {
    expect(
      shouldIncludeGooglePlace(
        { name: "Balloon Artistry", types: ["home_goods_store", "store"] },
        "balloon artist",
      ),
    ).toBe(true);
    expect(
      shouldIncludeGooglePlace(
        { name: "Balloon Store", types: ["home_goods_store", "store"] },
        "balloon artist",
      ),
    ).toBe(false);
  });

  it("does not remove stores when the user explicitly asks for a store", () => {
    expect(
      shouldIncludeGooglePlace(
        { name: "Michaels", types: ["craft_store", "home_goods_store", "store"] },
        "balloon store",
      ),
    ).toBe(true);
  });

  it("keeps an exact multi-word business search ahead of service expansions", () => {
    expect(googleSearchTerms("Capture a Perfect Memory Photo Booth", undefined)).toEqual([
      "Capture a Perfect Memory Photo Booth",
      "photo booth",
      "photobooth",
      "360 photo booth",
      "photo booth rental",
    ]);
  });

  it("keeps URL searches intact for Google Places", () => {
    expect(googleSearchTerms("https://captureaperfectmemory.com", undefined)).toEqual([
      "https://captureaperfectmemory.com",
    ]);
  });

  it("keeps service-area Google businesses without public coordinates", () => {
    expect(isGooglePlaceWithinSearchRadius({ distanceMiles: null }, true, 25)).toBe(true);
    expect(isGooglePlaceWithinSearchRadius({ distanceMiles: 26 }, true, 25)).toBe(false);
  });

  it("extracts an address-free Google Business identity from a listing URL", () => {
    expect(
      parseGoogleBusinessSearchUrl(
        "https://www.google.com/search?kgmid=%2Fg%2F11s1678qqs&q=Capture+a+Perfect+Memory+Photo+Booth",
      ),
    ).toEqual({
      externalId: "/g/11s1678qqs",
      name: "Capture a Perfect Memory Photo Booth",
    });
  });
});