// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {render, screen} from "@testing-library/react";
import axe from "axe-core";
import {NextIntlClientProvider} from "next-intl";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AppShell} from "./app-shell";

vi.mock("next-themes", () => ({useTheme: () => ({theme: "system", setTheme: vi.fn()})}));

const nav = {home: "Главная", documents: "Документы", finance: "Финансы", assistant: "Ассистент", settings: "Настройки"};
const home = {eyebrow: "Личная система", hello: "Привет", lead: "Всё важное рядом", capture: "Добавить", ask: "Спросить", balance: "Баланс", month: "за месяц", documents: "Документы", protected: "защищены", events: "События", empty: "Событий пока нет", stream: "Поток памяти", streamHint: "Здесь будут связи", private: "Приватно", navigation: "Основная навигация"};

afterEach(() => document.body.replaceChildren());

describe("app shell", () => {
  it("renders localized navigation and named primary actions", () => {
    render(<NextIntlClientProvider locale="ru" messages={{Theme: {label: "Тема", light: "Светлая", dark: "Тёмная", system: "Системная"}}}><AppShell copy={{nav, home}} locale="ru" /></NextIntlClientProvider>);
    expect(screen.getByRole("heading", {name: home.lead})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: home.capture})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: home.ask})).toBeInTheDocument();
    expect(screen.getAllByText(nav.documents).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", {name: "EN"})).toHaveAttribute("href", "/en");
  });

  it("has no automated accessibility violations", async () => {
    const {container} = render(<NextIntlClientProvider locale="ru" messages={{Theme: {label: "Тема", light: "Светлая", dark: "Тёмная", system: "Системная"}}}><AppShell copy={{nav, home}} locale="ru" /></NextIntlClientProvider>);
    const results = await axe.run(container, {rules: {"color-contrast": {enabled: false}}});
    expect(results.violations).toEqual([]);
  });
});
