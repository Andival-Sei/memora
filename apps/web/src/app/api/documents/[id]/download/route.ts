import {auth} from "@clerk/nextjs/server";
import {getDocumentService} from "../../../../../lib/documents/service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "document.pdf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  context: {params: Promise<{id: string}>}
): Promise<Response> {
  const {userId} = await auth();
  if (!userId) return Response.json({error: "Unauthorized"}, {status: 401, headers: noStoreHeaders});

  const {id} = await context.params;
  if (!UUID_PATTERN.test(id)) return new Response(null, {status: 404, headers: noStoreHeaders});

  try {
    const document = await getDocumentService().download(userId, id);
    if (!document) return new Response(null, {status: 404, headers: noStoreHeaders});
    return new Response(document.body, {
      status: 200,
      headers: {
        ...noStoreHeaders,
        "content-disposition": contentDisposition(document.filename),
        "content-length": String(document.sizeBytes),
        "content-type": document.contentType
      }
    });
  } catch {
    return Response.json(
      {error: {code: "DOCUMENT_DOWNLOAD_FAILED", message: "Unable to download the document."}},
      {status: 500, headers: noStoreHeaders}
    );
  }
}
