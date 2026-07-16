// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ListAlert } from "./AlertsList";

export function getAlertCopyText(alert: ListAlert): string {
  const parts = [`[${alert.severity}] ${alert.message}`];
  if (alert.tip != undefined && alert.tip !== "") {
    parts.push(alert.tip);
  }
  if (alert.error instanceof Error) {
    parts.push(alert.error.stack ?? alert.error.message);
  } else if (typeof alert.error === "string" && alert.error !== "") {
    parts.push(alert.error);
  }
  return parts.join("\n\n");
}
