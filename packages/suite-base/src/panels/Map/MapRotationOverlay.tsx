// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useStyles } from "@lichtblick/suite-base/panels/Map/MapRotationOverlay.style";
import { COMPASS_SIZE } from "@lichtblick/suite-base/panels/Map/constants";

type MapRotationOverlayProps = {
  /** Map rotation in degrees clockwise from north. */
  heading: number;
};

/**
 * Compass rose for a heading-up map.
 *
 * Once the tiles no longer point north this is the only cue to which way north is, so it
 * sits outside the rotated container and turns by the same angle as the tiles. The angle
 * arrives as a CSS variable so the rule itself stays static.
 */
export function MapRotationOverlay({ heading }: MapRotationOverlayProps): React.JSX.Element {
  const { classes, theme } = useStyles();

  return (
    <div
      className={classes.compass}
      style={{ "--map-heading": `${heading}deg` } as React.CSSProperties}
      title={`Heading ${heading.toFixed(0)} degrees`}
    >
      <svg viewBox="0 0 34 34" width={COMPASS_SIZE} height={COMPASS_SIZE} aria-hidden="true">
        {/* The north needle is red by cartographic convention rather than by theme, so it
            stays recognisable whichever palette is active. */}
        <polygon points="17,4 21,18 17,15 13,18" fill="#d32f2f" />
        <polygon points="17,30 21,16 17,19 13,16" fill={theme.palette.text.secondary} />
        <text
          x="17"
          y="12"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fill={theme.palette.common.white}
        >
          N
        </text>
      </svg>
    </div>
  );
}
