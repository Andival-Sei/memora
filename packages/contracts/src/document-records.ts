import {z} from "zod";

export const documentRecordTypeSchema = z.enum([
  "ru-passport",
  "international-passport",
  "drivers-license",
  "tax-or-insurance",
  "birth-certificate",
  "medical-policy",
  "contract",
  "other"
]);

export type DocumentRecordType = z.infer<typeof documentRecordTypeSchema>;

export const documentRecordStatusSchema = z.enum([
  "empty",
  "processing",
  "needs_review",
  "confirmed",
  "failed",
  "expired"
]);

export type DocumentRecordStatus = z.infer<typeof documentRecordStatusSchema>;

export const documentAssetContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "application/pdf"
]);

export type DocumentAssetContentType = z.infer<typeof documentAssetContentTypeSchema>;

export const documentAssetQualityStatusSchema = z.enum(["unknown", "usable", "retake_required"]);
export type DocumentAssetQualityStatus = z.infer<typeof documentAssetQualityStatusSchema>;

export const documentFieldDataTypeSchema = z.enum(["text", "date", "number"]);
export const documentFieldSensitivitySchema = z.enum(["personal", "identifier", "public"]);
export const documentFieldNormalizerSchema = z.enum(["trim", "digits", "iso-date", "mrz"]).nullable();
export const documentFieldValidatorSchema = z.enum([
  "non-empty",
  "iso-date",
  "digits",
  "passport-series-number",
  "mrz"
]).nullable();

export const documentFieldDefinitionSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.object({ru: z.string().min(1).max(120), en: z.string().min(1).max(120)}),
  dataType: documentFieldDataTypeSchema,
  required: z.boolean(),
  sensitivity: documentFieldSensitivitySchema,
  normalizer: documentFieldNormalizerSchema,
  validator: documentFieldValidatorSchema
});

export type DocumentFieldDefinition = z.infer<typeof documentFieldDefinitionSchema>;

export const documentTypeDefinitionSchema = z.object({
  id: documentRecordTypeSchema,
  schemaVersion: z.number().int().positive(),
  label: z.object({ru: z.string().min(1).max(120), en: z.string().min(1).max(120)}),
  acceptedContentTypes: z.array(documentAssetContentTypeSchema).min(1).readonly(),
  fields: z.array(documentFieldDefinitionSchema).max(100)
});

export type DocumentTypeDefinition = z.infer<typeof documentTypeDefinitionSchema>;

export const publicDocumentRecordSchema = z.object({
  id: z.string().min(1),
  documentType: documentRecordTypeSchema,
  schemaVersion: z.number().int().positive(),
  status: documentRecordStatusSchema,
  title: z.string().max(200).nullable(),
  issuedAt: z.string().date().nullable(),
  expiresAt: z.string().date().nullable(),
  assetCount: z.number().int().min(0).max(5),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type PublicDocumentRecord = z.infer<typeof publicDocumentRecordSchema>;

export const publicDocumentAssetSchema = z.object({
  id: z.string().min(1),
  pageIndex: z.number().int().min(0).max(4),
  contentType: documentAssetContentTypeSchema,
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  qualityStatus: documentAssetQualityStatusSchema
});

export type PublicDocumentAsset = z.infer<typeof publicDocumentAssetSchema>;

export const publicDocumentRecordWorkspaceSchema = publicDocumentRecordSchema.extend({
  assets: z.array(publicDocumentAssetSchema).max(5)
});

export type PublicDocumentRecordWorkspace = z.infer<typeof publicDocumentRecordWorkspaceSchema>;
