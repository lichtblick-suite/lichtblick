// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const MAX_FZF_MATCHES = 200;

// Above this number of items we fall back to the faster fuzzy find algorithm.
export const FAST_FIND_ITEM_CUTOFF = 1_000;

export const EMPTY_SET = new Set<number>();
