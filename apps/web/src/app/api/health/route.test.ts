import {describe, expect, it} from "vitest";
import {GET} from "./route";

describe("health route", () => {
  it("returns a minimal non-sensitive readiness payload", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status: "ok"});
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
