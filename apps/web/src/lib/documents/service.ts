import {randomUUID} from "node:crypto";
import {createDocumentRepository} from "@memora/db";
import {createDocumentService} from "@memora/domain";
import type {DocumentService} from "@memora/domain";
import {createPrivateBlobStore} from "./blob-storage";

export function getDocumentService(): DocumentService {
  return createDocumentService({
    repository: createDocumentRepository(),
    blobStore: createPrivateBlobStore(),
    createId: randomUUID
  });
}
