// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PointScan20Regular } from "@fluentui/react-icons";

import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import ToolbarIconButton from "@lichtblick/suite-base/components/PanelToolbar/ToolbarIconButton";

export type MeasureModeToolbarButtonProps = {
  active: boolean;
  onToggle: () => void;
  title: string;
  testId: string;
};

// Shared by Plot and StateTransitions so their delta measure mode toggle stays in sync.
// eslint-disable-next-line @typescript-eslint/no-shadow
export const MeasureModeToolbarButton = React.memo(function MeasureModeToolbarButton(
  props: MeasureModeToolbarButtonProps,
): React.JSX.Element {
  const { active, onToggle, title, testId } = props;

  return (
    <PanelToolbar
      additionalIcons={
        <ToolbarIconButton
          title={title}
          aria-label={title}
          aria-pressed={active}
          color={active ? "primary" : "default"}
          onClick={onToggle}
          data-testid={testId}
        >
          <PointScan20Regular />
        </ToolbarIconButton>
      }
    />
  );
});
