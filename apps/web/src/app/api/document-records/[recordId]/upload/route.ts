import {auth} from "@clerk/nextjs/server";
import {handleUpload, type HandleUploadBody} from "@vercel/blob/client";
import {documentRecordUploadTicketRequestSchema} from "@memora/contracts";
import {NextResponse} from "next/server";
import {isSameOriginRequest} from "@/lib/auth/route-policy";
import {documentApiErrorResponse, documentRecordErrorResponse, privateNoStoreHeaders} from "@/lib/document-records/http";
import {getDocumentRecordIntake} from "@/lib/document-records/service";

export async function POST(
  request: Request,
  {params}: {params: Promise<{recordId: string}>}
): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return documentApiErrorResponse("UNAUTHORIZED", 401);
  if (!isSameOriginRequest(request)) return documentApiErrorResponse("ORIGIN_REJECTED", 403);

  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return documentApiErrorResponse("INVALID_ASSET", 400);
  }
  const {recordId} = await params;

  try {
    const payload = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) throw new Error("Missing upload metadata");
        let parsedClientPayload: unknown;
        try {
          parsedClientPayload = JSON.parse(clientPayload);
        } catch {
          throw new Error("Invalid upload metadata");
        }
        const input = documentRecordUploadTicketRequestSchema.safeParse(parsedClientPayload);
        if (!input.success) throw new Error("Invalid upload metadata");
        await getDocumentRecordIntake().authorizeUpload(userId, recordId, pathname, input.data.contentType);
        return {
          allowedContentTypes: [input.data.contentType],
          maximumSizeInBytes: 10 * 1024 * 1024,
          validUntil: Date.now() + 5 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 0
        };
      }
    });
    return NextResponse.json(payload, {headers: privateNoStoreHeaders});
  } catch (error) {
    return documentRecordErrorResponse(error, "DOCUMENT_UPLOAD_FAILED");
  }
}
