// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MouseEvent, useCallback, useMemo } from "react";

import Logger from "@lichtblick/log";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

const log = Logger.getLogger(__filename);

// Matches simple HTML attribute names (e.g. "data-testid"). Anything else could produce an
// invalid or unintended CSS selector when interpolated into `target.closest()`.
const SAFE_ATTRIBUTE_NAME = /^[a-z][a-z0-9_-]*$/i;

export type InteractionCaptureOptions = {
  /**
   * DOM attribute used to identify the clicked element. Defaults to "data-testid".
   * Callers with dynamic/high-cardinality test IDs should pass a dedicated static attribute instead.
   */
  attribute?: string;
  /** Optional static attributes merged into every logged event's data payload. */
  data?: Record<string, unknown>;
};

/**
 * Returns a click-capture handler for a container element's `onClickCapture` prop that
 * generically logs a bounded `AppEvent` for interactions inside that subtree, without
 * hand-writing a `logEvent()` call at every individual click handler.
 *
 * When a click occurs anywhere inside the container, the handler walks up the DOM from
 * the click target to the nearest ancestor carrying `attribute` (default: `data-testid`)
 * and logs `event` with the discovered identifier as `data.id`, merged with any static
 * `options.data`. If no matching ancestor is found (e.g. a click on padding/whitespace
 * with no identifiable element), nothing is logged — this avoids emitting noisy,
 * un-attributable events.
 */
export function useInteractionCapture(
  event: AppEvent,
  options: InteractionCaptureOptions = {},
): (domEvent: MouseEvent) => void {
  const analytics = useAnalytics();
  const requestedAttribute = options.attribute ?? "data-testid";
  const { data } = options;

  // Validate once per distinct attribute name: an invalid value could otherwise produce a
  // malformed CSS selector (or unintended selector syntax) when interpolated into
  // `target.closest()`
  const attribute = useMemo(() => {
    if (!SAFE_ATTRIBUTE_NAME.test(requestedAttribute)) {
      log.warn(
        `useInteractionCapture: ignoring invalid attribute name "${requestedAttribute}"; ` +
          "interaction capture will be disabled for this handler.",
      );
      return undefined;
    }
    return requestedAttribute;
  }, [requestedAttribute]);

  return useCallback(
    (domEvent: MouseEvent) => {
      if (attribute == undefined) {
        return;
      }

      const target = domEvent.target;
      if (!(target instanceof Element)) {
        return;
      }

      const matched = target.closest(`[${attribute}]`);
      if (matched == undefined) {
        return;
      }

      const id = matched.getAttribute(attribute);
      if (id == undefined || id === "") {
        return;
      }

      analytics.logEvent(event, { ...data, id });
    },
    [analytics, attribute, data, event],
  );
}
