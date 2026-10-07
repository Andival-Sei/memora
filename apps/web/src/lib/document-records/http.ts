import {NextResponse} from "next/server";
import {DocumentRecordError} from "@memora/domain";

export const privateNoStoreHeaders = {
  "cache-control": "private, no-store",
  pragma: "no-cache",
  "x-content-type-options": "nosniff"
};

export function documentApiErrorResponse(code: string, status: number): NextResponse {
  return NextResponse.json({error: {code, message: "The document request could not be completed."}}, {
    status,
    headers: privateNoStoreHeaders
  });
}

export function documentRecordErrorResponse(error: unknown, fallbackCode = "DOCUMENT_RECORDS_UNAVAILABLE"): NextResponse {
  if (error instanceof DocumentRecordError) {
    const status = error.code === "RECORD_NOT_FOUND" ? 404 : error.code === "ASSET_LIMIT_REACHED" ? 409 : 400;
    return documentApiErrorResponse(error.code, status);
  }
  return documentApiErrorResponse(fallbackCode, 503);
}
