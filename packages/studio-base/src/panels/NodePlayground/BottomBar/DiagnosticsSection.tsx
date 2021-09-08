// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import AlertCircleIcon from "@mdi/svg/svg/alert-circle.svg";
import AlertIcon from "@mdi/svg/svg/alert.svg";
import HelpCircleIcon from "@mdi/svg/svg/help-circle.svg";
import InformationIcon from "@mdi/svg/svg/information.svg";
import { invert } from "lodash";
import { ReactElement } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import { Diagnostic, DiagnosticSeverity } from "@foxglove/studio-base/players/UserNodePlayer/types";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const severityColors = {
  Hint: colors.YELLOWL1,
  Info: colors.BLUEL1,
  Warning: colors.ORANGEL1,
  Error: colors.REDL1,
};

const severityIcons = {
  Hint: <HelpCircleIcon />,
  Info: <InformationIcon />,
  Warning: <AlertIcon />,
  Error: <AlertCircleIcon />,
};

type Props = {
  diagnostics: readonly Diagnostic[];
};

const DiagnosticsSection = ({ diagnostics }: Props): ReactElement => {
  return diagnostics.length > 0 ? (
    <ul>
      {diagnostics.map(({ severity, message, source, startColumn, startLineNumber }, i) => {
        const severityLabel =
          (invert(DiagnosticSeverity) as Record<string, keyof typeof DiagnosticSeverity>)[
            severity
          ] ?? "Error";
        const errorLoc =
          startLineNumber != undefined && startColumn != undefined
            ? `[${startLineNumber + 1},${startColumn + 1}]`
            : undefined;
        return (
          <li key={`${message}_${i}`}>
            <Icon
              tooltip="Severity"
              size="small"
              style={{ color: severityColors[severityLabel] }}
              active
            >
              {severityIcons[severityLabel]}
            </Icon>
            <span style={{ padding: "5px" }}>{message}</span>
            <span style={{ color: colors.GRAY }}>
              {source} {errorLoc}
            </span>
          </li>
        );
      })}
    </ul>
  ) : (
    <p>No problems to display.</p>
  );
};

export default DiagnosticsSection;
