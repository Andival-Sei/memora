import {auth} from "@clerk/nextjs/server";
import {
  documentRecordUploadTicketRequestSchema,
  documentRecordUploadTicketResponseSchema
} from "@memora/contracts";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return documentApiErrorResponse("INVALID_ASSET", 400);
  }
  const input = documentRecordUploadTicketRequestSchema.safeParse(body);
  if (!input.success) return documentApiErrorResponse("INVALID_ASSET", 400);
  const {recordId} = await params;

  try {
    const ticket = await getDocumentRecordIntake().createUploadTicket(userId, recordId, input.data.contentType);
    const payload = documentRecordUploadTicketResponseSchema.parse({ticket});
    return NextResponse.json(payload, {headers: privateNoStoreHeaders});
  } catch (error) {
    return documentRecordErrorResponse(error);
  }
}
