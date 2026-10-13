// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Matches simple HTML attribute names (e.g. "data-testid"). Anything else could produce an
// invalid or unintended CSS selector when interpolated into `target.closest()`.
export const SAFE_ATTRIBUTE_NAME = /^[a-z][a-z0-9_-]*$/i;
