// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import i18n from "i18next";
import LanguageDetector, { DetectorOptions } from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import * as en from "./en";
import { SESSION_STORAGE_I18N_LANGUAGE } from "../constants/browserStorageKeys";

export const translations = { en };

export type Language = keyof typeof translations;

export const defaultNS = "general";

const browserContextOptions: DetectorOptions = {
  order: ["localStorage", "navigator"],
  caches: ["localStorage"],
  lookupLocalStorage: SESSION_STORAGE_I18N_LANGUAGE,
  lookupSessionStorage: SESSION_STORAGE_I18N_LANGUAGE,
};

export async function initI18n(options?: { context?: "browser" | "electron-main" }): Promise<void> {
  const { context = "browser" } = options ?? {};
  if (context === "browser") {
    i18n.use(initReactI18next);
    i18n.use(LanguageDetector);
  }
  await i18n.init({
    resources: translations,
    detection: context === "browser" ? browserContextOptions : undefined,
    fallbackLng: "en",
    defaultNS,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });
}

// ts-unused-exports:disable-next-line
export const sharedI18nObject = i18n;
