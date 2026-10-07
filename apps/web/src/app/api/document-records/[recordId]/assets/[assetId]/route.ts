import {auth} from "@clerk/nextjs/server";
import {getDocumentRecordIntake} from "@/lib/document-records/service";
import {documentApiErrorResponse, privateNoStoreHeaders} from "@/lib/document-records/http";
import {getPrivateBlobAsset} from "@/lib/documents/blob-storage";

export async function GET(
  _request: Request,
  {params}: {params: Promise<{recordId: string; assetId: string}>}
): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return documentApiErrorResponse("UNAUTHORIZED", 401);
  const {recordId, assetId} = await params;

  try {
    const reference = await getDocumentRecordIntake().getPrivateAsset(userId, recordId, assetId);
    if (!reference) return documentApiErrorResponse("ASSET_NOT_FOUND", 404);
    const storedAsset = await getPrivateBlobAsset(reference.pathname);
    if (!storedAsset || storedAsset.contentType !== reference.contentType || storedAsset.sizeBytes !== reference.sizeBytes) {
      return documentApiErrorResponse("ASSET_NOT_FOUND", 404);
    }
    return new Response(storedAsset.body, {
      headers: {
        ...privateNoStoreHeaders,
        "cache-control": "private, no-store",
        "content-type": reference.contentType,
        "content-length": String(reference.sizeBytes),
        "content-disposition": "inline",
        "content-security-policy": "sandbox; default-src 'none'",
        "referrer-policy": "no-referrer"
      }
    });
  } catch {
    return documentApiErrorResponse("DOCUMENT_ASSET_UNAVAILABLE", 503);
  }
}
