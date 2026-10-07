import {auth} from "@clerk/nextjs/server";
import {
  documentRecordFinalizeAssetRequestSchema,
  documentRecordWorkspaceResponseSchema
} from "@memora/contracts";
import {NextResponse} from "next/server";
import {isSameOriginRequest} from "@/lib/auth/route-policy";
import {documentApiErrorResponse, documentRecordErrorResponse, privateNoStoreHeaders} from "@/lib/document-records/http";
import {getDocumentRecordIntake} from "@/lib/document-records/service";
import {DocumentAssetVerificationError, verifyDocumentAsset} from "@/lib/document-records/asset-verification";
import {createPrivateBlobStore, getPrivateBlobAsset} from "@/lib/documents/blob-storage";

export async function POST(
  request: Request,
  {params}: {params: Promise<{recordId: string}>}
): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return documentApiErrorResponse("UNAUTHORIZED", 401);
  if (!isSameOriginRequest(request)) return documentApiErrorResponse("ORIGIN_REJECTED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return documentApiErrorResponse("INVALID_ASSET", 400);
  }
  const input = documentRecordFinalizeAssetRequestSchema.safeParse(body);
  if (!input.success) return documentApiErrorResponse("INVALID_ASSET", 400);
  const {recordId} = await params;
  const intake = getDocumentRecordIntake();

  try {
    await intake.authorizeUpload(userId, recordId, input.data.pathname, input.data.contentType);
    const storedAsset = await getPrivateBlobAsset(input.data.pathname);
    if (!storedAsset) return documentApiErrorResponse("ASSET_NOT_FOUND", 404);
    const verified = await verifyDocumentAsset({
      body: storedAsset.body,
      contentType: input.data.contentType,
      actualContentType: storedAsset.contentType,
      actualSizeBytes: storedAsset.sizeBytes
    });
    const completed = await intake.completeUpload(userId, recordId, {
      blobPath: input.data.pathname,
      contentType: input.data.contentType,
      sizeBytes: verified.sizeBytes,
      sha256: verified.sha256
    });
    if (completed.duplicate && !completed.retainedPath) {
      try {
        await createPrivateBlobStore().delete(input.data.pathname);
      } catch {
        // A duplicate remains private; cleanup can be retried without changing the record.
      }
    }
    const payload = documentRecordWorkspaceResponseSchema.parse({workspace: completed.workspace});
    return NextResponse.json(payload, {headers: privateNoStoreHeaders});
  } catch (error) {
    if (error instanceof DocumentAssetVerificationError) {
      return documentApiErrorResponse("INVALID_ASSET", 400);
    }
    return documentRecordErrorResponse(error, "DOCUMENT_UPLOAD_FAILED");
  }
}
