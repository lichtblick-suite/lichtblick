// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable } from "@lichtblick/suite";
import { getAlertKey } from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";
import { NOTIFICATION_SEVERITY_PRIORITY } from "@lichtblick/suite-base/util/sendNotification";

import { GroupedAlert, ListAlert } from "./AlertsList";

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

type SessionAlertInput = Immutable<PlayerAlert & { tag: string }>;

function collectCombinedAlerts(
  sessionAlerts: readonly SessionAlertInput[],
  playerAlerts: readonly PlayerAlert[],
  dismissedPlayerAlertKeys: ReadonlySet<string>,
): ListAlert[] {
  const combined: ListAlert[] = [];
  for (const alert of sessionAlerts) {
    combined.push({
      key: `session:${alert.tag}`,
      severity: alert.severity,
      message: alert.message,
      error: alert.error,
      tip: alert.tip,
      tag: alert.tag,
    });
  }
  for (const alert of playerAlerts) {
    const playerAlertKey = getAlertKey(alert);
    if (!dismissedPlayerAlertKeys.has(playerAlertKey)) {
      combined.push({
        key: `player:${playerAlertKey}`,
        severity: alert.severity,
        message: alert.message,
        error: alert.error,
        tip: alert.tip,
        playerAlertKey,
      });
    }
  }
  return combined;
}

function addToGroup(groups: Map<string, GroupedAlert>, alert: ListAlert): void {
  const contentKey = getAlertKey(alert);
  const existing = groups.get(contentKey);
  if (existing) {
    existing.count += 1;
    if (alert.tag != undefined) {
      existing.tags.push(alert.tag);
    }
    if (
      alert.playerAlertKey != undefined &&
      !existing.playerAlertKeys.includes(alert.playerAlertKey)
    ) {
      existing.playerAlertKeys.push(alert.playerAlertKey);
    }
  } else {
    groups.set(contentKey, {
      ...alert,
      key: contentKey,
      count: 1,
      tags: alert.tag != undefined ? [alert.tag] : [],
      playerAlertKeys: alert.playerAlertKey != undefined ? [alert.playerAlertKey] : [],
    });
  }
}

export function buildGroupedAlerts(
  sessionAlerts: readonly SessionAlertInput[],
  playerAlerts: readonly PlayerAlert[],
  dismissedPlayerAlertKeys: ReadonlySet<string>,
): GroupedAlert[] {
  const combined = collectCombinedAlerts(sessionAlerts, playerAlerts, dismissedPlayerAlertKeys);

  const groups = new Map<string, GroupedAlert>();
  for (const alert of combined) {
    addToGroup(groups, alert);
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      NOTIFICATION_SEVERITY_PRIORITY[b.severity] - NOTIFICATION_SEVERITY_PRIORITY[a.severity],
  );
}
