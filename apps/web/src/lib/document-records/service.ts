import {randomUUID} from "node:crypto";
import {createDocumentRecordIntake} from "@memora/application";
import {createDocumentRecordRepository, createDocumentRepository} from "@memora/db";
import {createDocumentRecordService} from "@memora/domain";

export function getDocumentRecordIntake() {
  const identities = createDocumentRepository();
  return createDocumentRecordIntake({
    records: createDocumentRecordService({
      repository: createDocumentRecordRepository(),
      createId: () => randomUUID()
    }),
    personalVaults: identities,
    createId: () => randomUUID()
  });
}
