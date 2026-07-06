// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { atan2, eigs, index, isNumber, subset } from "mathjs";

import {
  NavSatFixMsg,
  NavSatFixPositionCovarianceType,
} from "@lichtblick/suite-base/panels/Map/types";

/**
 * Calculates the accuracy of a NavSatFix message, based on its type, and returns
 * information suitable for display as a leaflet Ellipse.
 *
 * @param msg NavSatFix
 * @returns radii and tilt (degrees from W)
 */
export function getAccuracy(
  msg: NavSatFixMsg,
): { radii: [number, number]; tilt: number } | undefined {
  const covariance = msg.position_covariance;
  if (!covariance) {
    return undefined;
  }

  switch (msg.position_covariance_type) {
    case undefined:
      return undefined;
    case NavSatFixPositionCovarianceType.COVARIANCE_TYPE_UNKNOWN:
      return undefined;
    case NavSatFixPositionCovarianceType.COVARIANCE_TYPE_DIAGONAL_KNOWN: {
      // Tilt is degrees from west
      const eastVariance = covariance[0];
      const northVariance = covariance[4];
      if (!isFinite(eastVariance) || !isFinite(northVariance)) {
        return undefined;
      }
      return { radii: [Math.sqrt(eastVariance), Math.sqrt(northVariance)], tilt: 0 };
    }
    case NavSatFixPositionCovarianceType.COVARIANCE_TYPE_APPROXIMATED:
    case NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN: {
      // Discard altitude
      const K = covariance;
      const Klatlon = [
        [K[0], K[1]],
        [K[3], K[4]],
      ];

      // Compute the eigenvalues & vectors of the covariance matrix. They will
      // be sorted in ascending order, so the largest value is eigenvalues[1]
      // and the corresponding vector is in the rightmost column. Ellipse radii
      // are based on the eigenvalues, and orientation on the vector.
      try {
        const eigen = eigs(Klatlon);

        // Extract the eigenvector corresponding to the largest eigenvalue (index 1, as they're sorted ascending)
        // and the eigenvalues. Both correspond to the major axis of the error elipse.
        const eigenvectorLargest = eigen.eigenvectors[1]!.vector;
        const eigenvalues = [eigen.eigenvectors[0]!.value, eigen.eigenvectors[1]!.value];

        // Extract x and y components from the eigenvector (MathCollection)
        // This is the direction of the major axis of the error ellipse, and is used to calculate the tilt.
        const eigenvectorX = subset(eigenvectorLargest, index(0));
        const eigenvectorY = subset(eigenvectorLargest, index(1));

        if (
          !isNumber(eigenvectorX) ||
          !isNumber(eigenvectorY) ||
          !isNumber(eigenvalues[0]) ||
          !isNumber(eigenvalues[1])
        ) {
          return undefined;
        }

        // Ellipse `tilt` is defined as number of degrees from the negative x axis
        const theta = (atan2(eigenvectorY, eigenvectorX) * 180) / Math.PI;
        const tilt = -1 * theta;

        // Now that we've calculated tilt, we can calculate the ellipse radii, which are based on the eigenvalues. The larger eigenvalue corresponds to the major axis of the error ellipse, and the smaller to the minor axis.
        const primaryRadius = Math.sqrt(eigenvalues[1]);
        const secondaryRadius = Math.sqrt(eigenvalues[0]);

        if (!isFinite(tilt) || !isFinite(primaryRadius) || !isFinite(secondaryRadius)) {
          return undefined;
        }

        return {
          radii: [primaryRadius, secondaryRadius],
          tilt,
        };
      } catch (err: unknown) {
        console.error("Failed to compute eigenvalues", err);
        return undefined;
      }
    }
  }
}
