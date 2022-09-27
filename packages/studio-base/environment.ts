// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

function serverURLsForBackend(backend: string): { api: string; console: string } {
  if (backend === "local") {
    return {
      api: "http://localhost:3000/api",
      console: "http://localhost:3000",
    };
  }

  if (backend === "development") {
    return {
      api: "https://api-dev.foxglove.dev",
      console: "https://console-dev.foxglove.dev",
    };
  }

  return {
    api: process.env.FOXGLOVE_API_URL ?? "https://api.foxglove.dev",
    console: process.env.FOXGLOVE_CONSOLE_URL ?? "https://console.foxglove.dev",
  };
}

export function buildEnvironmentDefaults(
  backend: string = "production",
  // eslint-disable-next-line no-restricted-syntax
): Record<string, string | null> {
  const serverURLs = serverURLsForBackend(backend);
  return {
    AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY ?? null, // eslint-disable-line no-restricted-syntax
    FOXGLOVE_API_URL: serverURLs.api,
    FOXGLOVE_ACCOUNT_DASHBOARD_URL:
      process.env.FOXGLOVE_ACCOUNT_DASHBOARD_URL ?? serverURLs.console + "/dashboard",
    FOXGLOVE_CONSOLE_URL: serverURLs.console,
    FOXGLOVE_DISABLE_SIGN_IN: process.env.FOXGLOVE_DISABLE_SIGN_IN ?? null, // eslint-disable-line no-restricted-syntax
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID ?? "oSJGEAQm16LNF09FSVTMYJO5aArQzq8o",
    SENTRY_DSN: process.env.SENTRY_DSN ?? null, // eslint-disable-line no-restricted-syntax
    SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? null, // eslint-disable-line no-restricted-syntax
    SIGNUP_API_URL: "https://foxglove.dev/api/signup",
    SLACK_INVITE_URL: "https://foxglove.dev/join-slack",
    FOXGLOVE_ENABLE_DIALOG_AUTH: process.env.FOXGLOVE_ENABLE_DIALOG_AUTH ?? null, // eslint-disable-line no-restricted-syntax
  };
}
