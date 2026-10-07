import {describe, expect, it} from "vitest";
import {getSignInPath, isPublicPath, isSameOriginRequest} from "./route-policy";

describe("auth route policy", () => {
  it("keeps only localized auth pages and health public", () => {
    expect(isPublicPath("/ru/sign-in")).toBe(true);
    expect(isPublicPath("/en/sign-up/verify")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/fr/sign-in")).toBe(false);
    expect(isPublicPath("/api/health/details")).toBe(false);
    expect(isPublicPath("/ru/documents")).toBe(false);
  });

  it("keeps every typed-document API protected by the auth proxy", () => {
    const recordId = "11111111-1111-4111-8111-111111111111";
    expect(isPublicPath(`/api/document-records/${recordId}/upload`)).toBe(false);
    expect(isPublicPath(`/api/document-records/${recordId}/upload/extra`)).toBe(false);
    expect(isPublicPath(`/api/document-records/${recordId}/assets`)).toBe(false);
    expect(isPublicPath("/api/document-records/not-a-uuid/upload")).toBe(false);
  });

  it("accepts write requests only when the browser origin matches the request origin", () => {
    const sameOrigin = new Request("https://memora.example/api/document-records", {
      method: "POST",
      headers: {origin: "https://memora.example"}
    });
    const crossOrigin = new Request("https://memora.example/api/document-records", {
      method: "POST",
      headers: {origin: "https://attacker.example"}
    });

    expect(isSameOriginRequest(sameOrigin)).toBe(true);
    expect(isSameOriginRequest(crossOrigin)).toBe(false);
  });

  it("selects a safe localized sign-in path", () => {
    expect(getSignInPath("/en/documents")).toBe("/en/sign-in");
    expect(getSignInPath("/ru")).toBe("/ru/sign-in");
    expect(getSignInPath("/unknown/documents")).toBe("/ru/sign-in");
  });
});
