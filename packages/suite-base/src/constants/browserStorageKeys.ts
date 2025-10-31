// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { APP_CONFIG } from "./config";

export const KEY_WORKSPACE_PREFIX = APP_CONFIG.devWorkspace ? `${APP_CONFIG.devWorkspace}.` : "";

// Local storage keys
export const LOCAL_STORAGE_STUDIO_LAYOUT_KEY = `${KEY_WORKSPACE_PREFIX}studio.layout`;
export const LOCAL_STORAGE_PROFILE_DATA = `${KEY_WORKSPACE_PREFIX}studio.profile-data`;
export const LOCAL_STORAGE_APP_CONFIGURATION = `${KEY_WORKSPACE_PREFIX}studio.app-configuration.`;
export const LOCAL_STORAGE_PANEL_LOGS_HEIGHT = `${KEY_WORKSPACE_PREFIX}studio.panel-logs-height`;

// Session storage keys
export const SESSION_STORAGE_LOGS_SETTINGS = `${KEY_WORKSPACE_PREFIX}blick.logs-settings`;
export const SESSION_STORAGE_LICHTBLICK_WORKSPACE = `${KEY_WORKSPACE_PREFIX}fox.workspace`;
export const SESSION_STORAGE_I18N_LANGUAGE = `${KEY_WORKSPACE_PREFIX}i18nextLng`;
