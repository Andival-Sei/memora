import {auth} from "@clerk/nextjs/server";
import {DOCUMENT_MAX_BYTES, DocumentServiceError, DocumentValidationError} from "@memora/domain";
import {NextResponse} from "next/server";
import {getDocumentService} from "../../../lib/documents/service";

const noStoreHeaders = {"cache-control": "no-store"};

function errorResponse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({error: {code, message}}, {status, headers: noStoreHeaders});
}

export async function POST(request: Request): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return NextResponse.json({error: "Unauthorized"}, {status: 401, headers: noStoreHeaders});

  let file: File;
  try {
    const formData = await request.formData();
    const value = formData.get("file");
    if (!(value instanceof File)) {
      return errorResponse("DOCUMENT_INVALID_FILENAME", "A PDF file is required.", 400);
    }
    file = value;
  } catch {
    return errorResponse("DOCUMENT_INVALID_FILENAME", "A PDF file is required.", 400);
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    return errorResponse("DOCUMENT_FILE_TOO_LARGE", "The file is too large.", 413);
  }

  try {
    const bytes = await file.arrayBuffer();
    const document = await getDocumentService().upload(userId, {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      bytes
    });
    return NextResponse.json({document}, {status: 201, headers: noStoreHeaders});
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return errorResponse(error.code, error.message, 400);
    }
    if (error instanceof DocumentServiceError) {
      return errorResponse(error.code, error.message, 500);
    }
    return errorResponse("DOCUMENT_UPLOAD_FAILED", "Unable to save the document.", 500);
  }
}

export async function GET(): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return NextResponse.json({error: "Unauthorized"}, {status: 401, headers: noStoreHeaders});

  try {
    const documents = await getDocumentService().list(userId);
    return NextResponse.json({documents}, {headers: noStoreHeaders});
  } catch {
    return errorResponse("DOCUMENT_LIST_FAILED", "Unable to load documents.", 500);
  }
}
