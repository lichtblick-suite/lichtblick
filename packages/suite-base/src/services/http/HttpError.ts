// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Custom HTTP error class to represent HTTP errors.
 * Includes status code and status text.
 *
 * This class is used in the HttpService to throw errors for non-2xx responses, and it's useful
 * for error handling in applications using the HttpService.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly response?: Response;

  public constructor(message: string, status: number, statusText: string, response?: Response) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.response = response;
  }
}
