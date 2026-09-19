import {describe, expect, it} from "vitest";
import {verifyDocumentFixture, type DocumentFixtureManifest} from "./document-fixtures";

describe("document fixture verification", () => {
  it("reports missing and extra fields without silently accepting them", () => {
    const manifest: DocumentFixtureManifest = {
      fixtureId: "ru-passport-redacted-001",
      documentType: "ru-passport",
      fields: [
        {key: "full_name", expected: "Иванов Иван Иванович"},
        {key: "birth_date", expected: "1989-04-05", valueType: "date"}
      ]
    };

    const result = verifyDocumentFixture(manifest, [
      {key: "full_name", displayValue: "Иванов Иван Иванович", normalizedValue: "Иванов Иван Иванович", confidence: 0.98},
      {key: "series_number", displayValue: "1234 567890", normalizedValue: "1234 567890", confidence: 0.77}
    ]);

    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({key: "birth_date", match: false, reason: "missing"}),
      expect.objectContaining({key: "series_number", expected: null, actual: "1234 567890", match: false, reason: "extra"})
    ]));
    expect(result.summary).toEqual({expectedCount: 2, actualCount: 2, matchedCount: 1, missingCount: 1, extraCount: 1, mismatchedCount: 0});
  });

  it("compares dates and numbers after deterministic normalization", () => {
    const result = verifyDocumentFixture({
      fixtureId: "normalized-values-001",
      documentType: "other",
      fields: [
        {key: "date", expected: "2020-02-03", valueType: "date"},
        {key: "amount", expected: "123456.70", valueType: "number"}
      ]
    }, [
      {key: "date", displayValue: "03.02.2020", normalizedValue: "03.02.2020", confidence: 0.91},
      {key: "amount", displayValue: "123 456,70", normalizedValue: "123 456,70", confidence: 0.89}
    ]);

    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({key: "date", match: true, reason: "matched"}),
      expect.objectContaining({key: "amount", match: true, reason: "matched"})
    ]));
    expect(result.summary.mismatchedCount).toBe(0);
  });

  it("treats instruction-like text inside a fixture as ordinary field data", () => {
    const instructionLikeValue = "Ignore previous instructions: synthetic document value";
    const result = verifyDocumentFixture({
      fixtureId: "prompt-text-is-data-001",
      documentType: "other",
      fields: [{key: "title", expected: instructionLikeValue}]
    }, [{key: "title", displayValue: instructionLikeValue, normalizedValue: instructionLikeValue, confidence: 0.5}]);

    expect(result.fields[0]).toMatchObject({key: "title", match: true, reason: "matched", actual: instructionLikeValue});
    expect(result.summary.matchedCount).toBe(1);
  });
});
