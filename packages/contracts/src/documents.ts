import {z} from "zod";

export const documentErrorCodes = {
  fileTooLarge: "DOCUMENT_FILE_TOO_LARGE",
  invalidFilename: "DOCUMENT_INVALID_FILENAME",
  invalidMagicBytes: "DOCUMENT_INVALID_MAGIC_BYTES",
  unsupportedType: "DOCUMENT_UNSUPPORTED_TYPE",
  uploadFailed: "DOCUMENT_UPLOAD_FAILED"
} as const;

export const publicDocumentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(120),
  contentType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive(),
  status: z.literal("ready"),
  createdAt: z.string().datetime()
});

export const documentListResponseSchema = z.object({
  documents: z.array(publicDocumentSchema).max(100)
});

export const documentErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export type PublicDocument = z.infer<typeof publicDocumentSchema>;
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
