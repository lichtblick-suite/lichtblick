// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export interface HttpRequestOptions extends RequestInit {
  timeout?: number;
  responseType?: "json" | "arraybuffer";
}

export interface HttpResponse<T> extends SuccessResponse<T>, Partial<ErrorResponse> {}

type DetailErrorApiResponse = {
  field: string;
  constraints: Record<string, string>;
};

type ErrorResponse = {
  statusCode: number;
  message: string;
  error: string;
  details: DetailErrorApiResponse[];
};

type SuccessResponse<T> = {
  data: T;
  timestamp: string;
  path: string;
};

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}
