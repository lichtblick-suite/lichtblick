// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { APP_CONFIG } from "@lichtblick/suite-base/constants";
import { HttpError } from "@lichtblick/suite-base/services/http/HttpError";
import { HttpRequestOptions } from "@lichtblick/suite-base/services/http/types";

/**
 * HttpService is a lightweight HTTP client that wraps the Fetch API to provide
 * a simple and consistent interface for making HTTP requests. It supports
 * common HTTP methods (GET, POST, PUT, DELETE) and includes features such as
 * default headers, error handling, and request timeouts.
 *
 * This service acts as a proxy to facilitate code reuse across the application.
 * By centralizing HTTP request logic here, it allows for easy modifications,
 * such as switching from Fetch to another library like Axios, without needing
 * to change the rest of the codebase. It also helps standardize headers,
 * error handling, and other request configurations.
 **/
export class HttpService {
  private readonly baseURL?: string;
  private readonly defaultOptions: RequestInit;

  public constructor() {
    this.baseURL = APP_CONFIG.apiUrl;
    this.defaultOptions = {
      headers: {
        "Content-Type": "application/json",
        "Api-Version": "1.0",
      },
    };
  }

  private async request<T>(endpoint: string, options: HttpRequestOptions = {}): Promise<T> {
    const { timeout, ...fetchOptions } = options;
    const url = this.baseURL ? `${this.baseURL}/${endpoint}` : endpoint;

    const requestOptions: RequestInit = {
      ...this.defaultOptions,
      ...fetchOptions,
      headers: {
        ...(this.defaultOptions.headers as Record<string, string>),
        ...(fetchOptions.headers as Record<string, string>),
      },
    };

    let response: Response;

    try {
      if (timeout != undefined) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        try {
          response = await fetch(url, {
            ...requestOptions,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        response = await fetch(url, requestOptions);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpError(`Network error: ${error.message}`, 0, "Network Error");
      }
      throw error;
    }

    if (!response.ok) {
      let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;

      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      } catch {
        // Ignore error parsing response body
      }

      throw new HttpError(errorMessage, response.status, response.statusText, response);
    }

    try {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json") === true) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch {
      throw new HttpError(
        "Failed to parse response",
        response.status,
        response.statusText,
        response,
      );
    }
  }

  public async get<T>(
    endpoint: string,
    params: Record<string, string> = {},
    options: HttpRequestOptions = {},
  ): Promise<T> {
    const queryString = new URLSearchParams(params);
    return await this.request<T>(`${endpoint}?${queryString.toString()}`, {
      method: "GET",
      ...options,
    });
  }

  public async post<T>(
    endpoint: string,
    data?: unknown,
    options: HttpRequestOptions = {},
  ): Promise<T> {
    return await this.request<T>(endpoint, {
      method: "POST",
      body: data != undefined ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  public async put<T>(
    endpoint: string,
    data?: unknown,
    options: HttpRequestOptions = {},
  ): Promise<T> {
    return await this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data != undefined ? JSON.stringify(data) : undefined,
    });
  }

  public async delete<T>(endpoint: string, options: HttpRequestOptions = {}): Promise<T> {
    return await this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }
}

export default new HttpService();
