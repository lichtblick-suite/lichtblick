// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export interface HttpRequestOptions extends RequestInit {
  timeout?: number;
}

export interface HttpResponse<T> {
  data: T;
  timestamp: string;
  path: string;
}
