// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import * as en from "./en";
import * as ja from "./ja";
import * as zh from "./zh";

export const translations = { en, zh, ja };

export type Language = keyof typeof translations;

export const defaultNS = "general";

export async function initI18n(options?: { context?: "browser" | "electron-main" }): Promise<void> {
  const { context = "browser" } = options ?? {};
  if (context === "browser") {
    i18n.use(initReactI18next);
    i18n.use(LanguageDetector);
  }
  await i18n.init({
    resources: translations,
    detection:
      context === "browser"
        ? { order: ["localStorage", "navigator"], caches: ["localStorage"] }
        : undefined,
    fallbackLng: "en",
    defaultNS,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });
}
