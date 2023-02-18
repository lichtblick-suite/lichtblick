// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { enPreferences, enGeneral } from "./en";
import { zhPreferences, zhGeneral } from "./zh";

export const translations = {
  en: {
    preferences: enPreferences,
    general: enGeneral,
  },
  zh: {
    preferences: zhPreferences,
    general: zhGeneral,
  },
};

export type Language = keyof typeof translations;

export const defaultNS = "general";

export async function initI18n(): Promise<void> {
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: translations,
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
      },
      fallbackLng: "en",
      defaultNS,
    });
}
