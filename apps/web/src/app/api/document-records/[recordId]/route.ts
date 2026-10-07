import {auth} from "@clerk/nextjs/server";
import {documentRecordWorkspaceResponseSchema} from "@memora/contracts";
import {NextResponse} from "next/server";
import {documentApiErrorResponse, documentRecordErrorResponse, privateNoStoreHeaders} from "@/lib/document-records/http";
import {getDocumentRecordIntake} from "@/lib/document-records/service";

export async function GET(
  _request: Request,
  {params}: {params: Promise<{recordId: string}>}
): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return documentApiErrorResponse("UNAUTHORIZED", 401);
  const {recordId} = await params;

  try {
    const workspace = await getDocumentRecordIntake().getWorkspace(userId, recordId);
    if (!workspace) return documentApiErrorResponse("RECORD_NOT_FOUND", 404);
    return NextResponse.json(documentRecordWorkspaceResponseSchema.parse({workspace}), {headers: privateNoStoreHeaders});
  } catch (error) {
    return documentRecordErrorResponse(error);
  }
}
