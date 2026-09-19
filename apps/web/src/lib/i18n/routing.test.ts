import {describe, expect, it} from "vitest";
import {defaultLocale, isLocale, locales} from "./routing";

describe("locale routing contract", () => {
  it("supports exactly Russian and English with Russian as default", () => {
    expect(locales).toEqual(["ru", "en"]);
    expect(defaultLocale).toBe("ru");
  });

  it("rejects untrusted locale segments", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale("../ru")).toBe(false);
  });
});
