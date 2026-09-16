// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const COMPASS_SIZE = 34;

type MapRotationOverlayProps = {
  /** Map rotation in degrees clockwise from north. */
  heading: number;
};

/**
 * Compass rose for a heading-up map.
 *
 * Once the tiles no longer point north this is the only cue to which way north is, so it
 * sits outside the rotated container and turns by the same angle as the tiles.
 */
export function MapRotationOverlay({ heading }: MapRotationOverlayProps): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: COMPASS_SIZE,
        height: COMPASS_SIZE,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.85)",
        boxShadow: "0 0 2px rgba(0,0,0,0.5)",
        pointerEvents: "none",
        zIndex: 1000,
        // The container is turned by -heading, so north ends up at the same angle on screen.
        transform: `rotate(${-heading}deg)`,
      }}
      title={`Heading ${heading.toFixed(0)} degrees`}
    >
      <svg viewBox="0 0 34 34" width={COMPASS_SIZE} height={COMPASS_SIZE} aria-hidden="true">
        <polygon points="17,4 21,18 17,15 13,18" fill="#d32f2f" />
        <polygon points="17,30 21,16 17,19 13,16" fill="#555555" />
        <text x="17" y="12" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ffffff">
          N
        </text>
      </svg>
    </div>
  );
}
