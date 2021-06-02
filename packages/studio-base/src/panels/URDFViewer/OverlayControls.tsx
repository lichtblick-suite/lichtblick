// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  useTheme,
  DefaultButton,
  Dropdown,
  Stack,
  Slider,
  IDropdownOption,
  IDropdownProps,
  ISliderProps,
} from "@fluentui/react";

type Props = {
  assetOptions: IDropdownOption[];
  selectedAssetId: string | undefined;
  onSelectAsset: IDropdownProps["onChange"];
  opacity: number | undefined;
  onChangeOpacity: ISliderProps["onChange"];
  cameraCentered: boolean;
  onCenterCamera: () => void;
};

export default function OverlayControls({
  assetOptions,
  selectedAssetId,
  onSelectAsset,
  opacity,
  onChangeOpacity,
  cameraCentered,
  onCenterCamera,
}: Props): JSX.Element {
  const theme = useTheme();
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: theme.spacing.s1,
          left: theme.spacing.s1,
        }}
      >
        <Dropdown options={assetOptions} selectedKey={selectedAssetId} onChange={onSelectAsset} />
      </div>
      <Stack
        horizontal
        horizontalAlign="space-between"
        wrap
        style={{
          position: "absolute",
          bottom: theme.spacing.s1,
          left: theme.spacing.s1,
          right: theme.spacing.s1,
        }}
      >
        <Stack.Item grow style={{ minWidth: 120, maxWidth: 300 }}>
          <Slider
            ariaLabel="Opacity"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            valueFormat={(value) => `${(value * 100).toFixed(0)}%`}
            onChange={onChangeOpacity}
          />
        </Stack.Item>
        {!cameraCentered && <DefaultButton text="Re-center" onClick={onCenterCamera} />}
      </Stack>
    </>
  );
}
