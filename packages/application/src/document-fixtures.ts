import type {DocumentType} from "./document-agent";

export type DocumentFixtureValueType = "text" | "date" | "number";

export interface DocumentFixtureFieldExpectation {
  key: string;
  expected: string | null;
  valueType?: DocumentFixtureValueType;
}

export interface DocumentFixtureManifest {
  fixtureId: string;
  documentType: DocumentType;
  fields: readonly DocumentFixtureFieldExpectation[];
}

export interface DocumentFixtureActualField {
  key: string;
  displayValue: string | null;
  normalizedValue: string | null;
  confidence: number | null;
}

export interface DocumentFixtureVerificationRequest {
  manifest: DocumentFixtureManifest;
  actualFields: readonly DocumentFixtureActualField[];
}

export type DocumentFixtureFieldReason = "matched" | "missing" | "extra" | "mismatch";

export interface DocumentFixtureFieldResult {
  key: string;
  expected: string | null;
  actual: string | null;
  normalizedExpected: string | null;
  normalizedActual: string | null;
  match: boolean;
  confidence: number | null;
  reason: DocumentFixtureFieldReason;
}

export interface DocumentFixtureVerificationSummary {
  expectedCount: number;
  actualCount: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  mismatchedCount: number;
}

export interface DocumentFixtureVerificationResult {
  fixtureId: string;
  documentType: DocumentType;
  fields: DocumentFixtureFieldResult[];
  summary: DocumentFixtureVerificationSummary;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDate(value: string): string {
  const trimmed = normalizeText(value);
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(trimmed);
  if (iso && iso[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const localized = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
  if (localized && localized[1] && localized[2] && localized[3]) {
    return `${localized[3]}-${localized[2].padStart(2, "0")}-${localized[1].padStart(2, "0")}`;
  }
  return trimmed;
}

function normalizeNumber(value: string): string {
  const compact = normalizeText(value).replace(/[\s\u00a0]/g, "").replace(",", ".");
  const parsed = Number(compact);
  return Number.isFinite(parsed) ? String(parsed) : compact;
}

function comparable(value: string | null, valueType: DocumentFixtureValueType): string | null {
  if (value === null) return null;
  if (valueType === "date") return normalizeDate(value);
  if (valueType === "number") return normalizeNumber(value);
  return normalizeText(value);
}

export function verifyDocumentFixture(
  manifest: DocumentFixtureManifest,
  actualFields: readonly DocumentFixtureActualField[]
): DocumentFixtureVerificationResult {
  const actualByKey = new Map(actualFields.map((field) => [field.key, field]));
  const expectedKeys = new Set(manifest.fields.map((field) => field.key));
  const fields: DocumentFixtureFieldResult[] = manifest.fields.map((expectedField) => {
    const actual = actualByKey.get(expectedField.key);
    if (!actual) {
      return {
        key: expectedField.key,
        expected: expectedField.expected,
        actual: null,
        normalizedExpected: comparable(expectedField.expected, expectedField.valueType ?? "text"),
        normalizedActual: null,
        match: false,
        confidence: null,
        reason: "missing"
      };
    }
    const valueType = expectedField.valueType ?? "text";
    const normalizedExpected = comparable(expectedField.expected, valueType);
    const normalizedActual = comparable(actual.normalizedValue ?? actual.displayValue, valueType);
    const match = normalizedExpected === normalizedActual;
    return {
      key: expectedField.key,
      expected: expectedField.expected,
      actual: actual.displayValue ?? actual.normalizedValue,
      normalizedExpected,
      normalizedActual,
      match,
      confidence: actual.confidence,
      reason: match ? "matched" : "mismatch"
    };
  });

  for (const actual of actualFields) {
    if (expectedKeys.has(actual.key)) continue;
    fields.push({
      key: actual.key,
      expected: null,
      actual: actual.displayValue ?? actual.normalizedValue,
      normalizedExpected: null,
      normalizedActual: normalizeText(actual.normalizedValue ?? actual.displayValue ?? ""),
      match: false,
      confidence: actual.confidence,
      reason: "extra"
    });
  }

  const summary: DocumentFixtureVerificationSummary = {
    expectedCount: manifest.fields.length,
    actualCount: actualFields.length,
    matchedCount: fields.filter((field) => field.match).length,
    missingCount: fields.filter((field) => field.reason === "missing").length,
    extraCount: fields.filter((field) => field.reason === "extra").length,
    mismatchedCount: fields.filter((field) => field.reason === "mismatch").length
  };
  return {fixtureId: manifest.fixtureId, documentType: manifest.documentType, fields, summary};
}
