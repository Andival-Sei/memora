import {auth} from "@clerk/nextjs/server";
import {
  documentRecordCreateInputSchema,
  documentRecordCreateResponseSchema,
  documentRecordListResponseSchema
} from "@memora/contracts";
import {NextResponse} from "next/server";
import {isSameOriginRequest} from "@/lib/auth/route-policy";
import {documentApiErrorResponse, documentRecordErrorResponse, privateNoStoreHeaders} from "@/lib/document-records/http";
import {getDocumentRecordIntake} from "@/lib/document-records/service";

export async function GET(): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return documentApiErrorResponse("UNAUTHORIZED", 401);

  try {
    const payload = documentRecordListResponseSchema.parse({records: await getDocumentRecordIntake().list(userId)});
    return NextResponse.json(payload, {headers: privateNoStoreHeaders});
  } catch (error) {
    return documentRecordErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return documentApiErrorResponse("UNAUTHORIZED", 401);
  if (!isSameOriginRequest(request)) return documentApiErrorResponse("ORIGIN_REJECTED", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return documentApiErrorResponse("INVALID_DOCUMENT_RECORD", 400);
  }
  const input = documentRecordCreateInputSchema.safeParse(body);
  if (!input.success) return documentApiErrorResponse("INVALID_DOCUMENT_RECORD", 400);

  try {
    const createInput = {
      documentType: input.data.documentType,
      ...(input.data.title ? {title: input.data.title} : {})
    };
    const payload = documentRecordCreateResponseSchema.parse({record: await getDocumentRecordIntake().create(userId, createInput)});
    return NextResponse.json(payload, {status: 201, headers: privateNoStoreHeaders});
  } catch (error) {
    return documentRecordErrorResponse(error);
  }
}
