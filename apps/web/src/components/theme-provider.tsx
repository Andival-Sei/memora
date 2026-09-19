"use client";

import {ThemeProvider as Provider} from "next-themes";
import type {ComponentProps} from "react";

export function ThemeProvider(props: ComponentProps<typeof Provider>) {
  return <Provider {...props} />;
}
