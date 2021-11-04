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
import { useTheme } from "@fluentui/react";
import AlertCircleIcon from "@mdi/svg/svg/alert-circle.svg";
import AlertIcon from "@mdi/svg/svg/alert.svg";
import HelpCircleIcon from "@mdi/svg/svg/help-circle.svg";
import InformationIcon from "@mdi/svg/svg/information.svg";
import { invert } from "lodash";
import { ReactElement } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import { Diagnostic, DiagnosticSeverity } from "@foxglove/studio-base/players/UserNodePlayer/types";

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
  const theme = useTheme();
  const severityColors = {
    Hint: theme.palette.yellowLight,
    Info: theme.palette.blueLight,
    Warning: theme.semanticColors.warningBackground,
    Error: theme.semanticColors.errorBackground,
  };

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
            <span style={{ color: theme.palette.neutralLight }}>
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
