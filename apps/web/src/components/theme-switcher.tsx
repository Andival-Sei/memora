"use client";

import {useTranslations} from "next-intl";
import {useTheme} from "next-themes";
import {useEffect, useState} from "react";

const choices = ["light", "dark", "system"] as const;

export function ThemeSwitcher() {
  const t = useTranslations("Theme");
  const {theme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return <div className="segmented" aria-label={t("label")} data-ready={mounted}>
    {choices.map((choice) => <button aria-pressed={mounted && theme === choice} className="segmented__button" key={choice} onClick={() => setTheme(choice)} type="button"><span aria-hidden="true">{choice === "light" ? "☼" : choice === "dark" ? "◐" : "◒"}</span><span className="sr-only">{t(choice)}</span></button>)}
  </div>;
}
