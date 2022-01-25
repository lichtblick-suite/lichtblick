// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DefaultButton,
  Dropdown,
  Slider,
  IDropdownOption,
  IDropdownProps,
  ISliderProps,
} from "@fluentui/react";
import { Box, Stack } from "@mui/material";

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
  return (
    <>
      <Box position="absolute" top={0} left={0} margin={1}>
        <Dropdown options={assetOptions} selectedKey={selectedAssetId} onChange={onSelectAsset} />
      </Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        flexWrap="wrap"
        margin={1}
        position="absolute"
        bottom={0}
        left={0}
        right={0}
      >
        <Box flexGrow={1} minWidth={120} maxWidth={300}>
          <Slider
            ariaLabel="Opacity"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            valueFormat={(value) => `${(value * 100).toFixed(0)}%`}
            onChange={onChangeOpacity}
          />
        </Box>
        {!cameraCentered && <DefaultButton text="Re-center" onClick={onCenterCamera} />}
      </Stack>
    </>
  );
}
