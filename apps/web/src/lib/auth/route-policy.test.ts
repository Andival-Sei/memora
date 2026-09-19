import {describe, expect, it} from "vitest";
import {getSignInPath, isPublicPath} from "./route-policy";

describe("auth route policy", () => {
  it("keeps only localized auth pages and health public", () => {
    expect(isPublicPath("/ru/sign-in")).toBe(true);
    expect(isPublicPath("/en/sign-up/verify")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/fr/sign-in")).toBe(false);
    expect(isPublicPath("/api/health/details")).toBe(false);
    expect(isPublicPath("/ru/documents")).toBe(false);
  });

  it("selects a safe localized sign-in path", () => {
    expect(getSignInPath("/en/documents")).toBe("/en/sign-in");
    expect(getSignInPath("/ru")).toBe("/ru/sign-in");
    expect(getSignInPath("/unknown/documents")).toBe("/ru/sign-in");
  });
});
