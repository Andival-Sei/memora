// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {listDocumentTypeDefinitions} from "@memora/domain";
import {afterEach, describe, expect, it, vi} from "vitest";
import {DocumentTypeCatalog} from "./document-type-catalog";

describe("home document type catalog", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("shows all registered types even when saved-record lookup is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<DocumentTypeCatalog definitions={listDocumentTypeDefinitions()} locale="ru" copy={{
      title: "Документы", hint: "Выберите тип", recordsLabel: "записей", fieldCount: "полей",
      needsReview: "на проверке", unavailable: "Записи недоступны"
    }} />);
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("link", {name: /Паспорт РФ/})).toHaveAttribute("href", "/ru/documents?type=ru-passport");
    expect(await screen.findByRole("status")).toHaveTextContent("Записи недоступны");
  });
});
