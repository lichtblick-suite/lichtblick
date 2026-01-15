// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { sharedI18nObject } from "@lichtblick/suite-base/i18n";
import { HttpStatus } from "@lichtblick/suite-base/services/http/types";

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

  /**
   * Returns a user-friendly error message based on the HTTP status code.
   * This is used to display appropriate messages in UI notifications.
   * Messages are localized using i18next.
   */
  public getUserFriendlyErrorMessage(): string {
    const t = sharedI18nObject.t;

    if (this.status === 0) {
      return t("httpErrors:networkError");
    }

    switch (this.status) {
      case HttpStatus.BAD_REQUEST:
        return t("httpErrors:badRequest");
      case HttpStatus.UNAUTHORIZED:
        return t("httpErrors:unauthorized");
      case HttpStatus.FORBIDDEN:
        return t("httpErrors:forbidden");
      case HttpStatus.NOT_FOUND:
        return t("httpErrors:notFound");
      case HttpStatus.CONFLICT:
        return t("httpErrors:conflict");
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return t("httpErrors:internalServerError");
      default:
        if (this.status >= 400 && this.status < 500) {
          return t("httpErrors:clientError");
        }
        if (this.status >= 500) {
          return t("httpErrors:serverError");
        }
        return this.message;
    }
  }
}
