// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MathNumericType, atan2, eigs, isNumber } from "mathjs";

import {
  NavSatFixMsg,
  NavSatFixPositionCovarianceType,
} from "@foxglove/studio-base/panels/Map/types";

type NumericPair = [MathNumericType, MathNumericType];

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
        const eigen = eigs(Klatlon) as {
          vectors: [NumericPair, NumericPair];
          values: NumericPair;
        };

        // Eigenvectors are returned in columns
        const eigenvector = [eigen.vectors[0][1], eigen.vectors[1][1]];
        const eigenvalues = eigen.values;

        if (
          !isNumber(eigenvector[0]) ||
          !isNumber(eigenvector[1]) ||
          !isNumber(eigenvalues[0]) ||
          !isNumber(eigenvalues[1])
        ) {
          return undefined;
        }

        // Ellipse `tilt` is defined as number of degrees from the negative x axis
        const theta = (atan2(eigenvector[1], eigenvector[0]) * 180) / Math.PI;
        const tilt = -1 * theta;

        const primaryRadius = Math.sqrt(eigenvalues[1]);
        const secondaryRadius = Math.sqrt(eigenvalues[0]);

        if (isNaN(tilt) || isNaN(primaryRadius) || isNaN(secondaryRadius)) {
          return undefined;
        }

        return {
          radii: [primaryRadius, secondaryRadius],
          tilt,
        };
      } catch (err) {
        return undefined;
      }
    }
  }
}
