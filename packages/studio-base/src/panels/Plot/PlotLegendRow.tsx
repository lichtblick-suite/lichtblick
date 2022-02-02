// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme as useFluentUITheme } from "@fluentui/react";
import { Close as CloseIcon, Error as ErrorIcon, Remove as RemoveIcon } from "@mui/icons-material";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { ComponentProps, useCallback, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import TimestampMethodDropdown from "@foxglove/studio-base/components/TimestampMethodDropdown";
import { useHoverValue } from "@foxglove/studio-base/context/HoverValueContext";
import { lineColors } from "@foxglove/studio-base/util/plotColors";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import { PlotPath, isReferenceLinePlotPathType } from "./internalTypes";
import { plotableRosTypes, PlotConfig, PlotXAxisVal } from "./types";

type PlotLegendRowProps = {
  index: number;
  xAxisVal: PlotXAxisVal;
  path: PlotPath;
  paths: PlotPath[];
  hasMismatchedDataLength: boolean;
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  currentTime?: number;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  showPlotValuesInLegend: boolean;
};

export default function PlotLegendRow({
  index,
  xAxisVal,
  path,
  paths,
  hasMismatchedDataLength,
  datasets,
  currentTime,
  saveConfig,
  showPlotValuesInLegend,
}: PlotLegendRowProps): JSX.Element {
  const correspondingData = useMemo(
    () => datasets.find((set) => set.label === path.value)?.data ?? [],
    [datasets, path.value],
  );

  const [hoverComponentId] = useState<string>(() => uuidv4());
  const hoverValue = useHoverValue({
    componentId: hoverComponentId,
    isTimestampScale: true,
  });

  const fluentUITheme = useFluentUITheme();
  const currentDisplay = useMemo(() => {
    const timeToCompare = hoverValue?.value ?? currentTime;

    let value;
    for (const pt of correspondingData) {
      if (timeToCompare == undefined || pt == undefined || pt.x > timeToCompare) {
        break;
      }
      value = pt.y;
    }
    return {
      value,
      color: hoverValue?.value != undefined ? fluentUITheme.palette.yellowDark : "inherit",
    };
  }, [hoverValue, correspondingData, currentTime, fluentUITheme]);

  const isReferenceLinePlotPath = isReferenceLinePlotPathType(path);
  let timestampMethod;
  // Only allow chosing the timestamp method if it is applicable (not a reference line) and there is at least
  // one character typed.
  if (!isReferenceLinePlotPath && path.value.length > 0) {
    timestampMethod = path.timestampMethod;
  }

  const onInputChange = useCallback(
    (value: string, idx?: number) => {
      if (idx == undefined) {
        throw new Error("index not set");
      }
      const newPaths = paths.slice();
      const newPath = newPaths[idx];
      if (newPath) {
        newPaths[idx] = { ...newPath, value: value.trim() };
      }
      saveConfig({ paths: newPaths });
    },
    [paths, saveConfig],
  );

  const onInputTimestampMethodChange = useCallback(
    (value: TimestampMethod) => {
      const newPaths = paths.slice();
      const newPath = newPaths[index];
      if (newPath) {
        newPaths[index] = { ...newPath, timestampMethod: value };
      }
      saveConfig({ paths: newPaths });
    },
    [paths, index, saveConfig],
  );

  return (
    <Box
      display="contents"
      sx={{
        "&:hover, &:focus-within": {
          "& .MuiIconButton-root": {
            bgcolor: "action.hover",
          },
          "& > *:last-child": {
            opacity: 1,
          },
          "& > *": {
            bgcolor: "action.hover",
          },
        },
      }}
    >
      <Box
        sx={({ palette }) => ({
          padding: 0.25,
          position: "sticky",
          left: 0,
          // creates an opaque background for the sticky element
          backgroundImage: `linear-gradient(${palette.background.paper}, ${palette.background.paper})`,
          backgroundBlendMode: "overlay",
        })}
      >
        <IconButton
          centerRipple={false}
          size="small"
          sx={{
            padding: 0.125,
            marginLeft: 0.25,
          }}
          title="Toggle visibility"
          onClick={() => {
            const newPaths = paths.slice();
            const newPath = newPaths[index];
            if (newPath) {
              newPaths[index] = { ...newPath, enabled: !newPath.enabled };
            }
            saveConfig({ paths: newPaths });
          }}
        >
          <RemoveIcon
            sx={{ color: path.enabled ? lineColors[index % lineColors.length] : "#777" }}
          />
        </IconButton>
      </Box>
      <Box
        display="flex"
        alignItems="center"
        padding={0.25}
        sx={{
          input: {
            textDecoration: !path.enabled ? "line-through" : "none",
          },
        }}
      >
        <MessagePathInput
          supportsMathModifiers
          path={path.value}
          onChange={onInputChange}
          validTypes={plotableRosTypes}
          placeholder="Enter a topic name or a number"
          index={index}
          autoSize
          disableAutocomplete={isReferenceLinePlotPath}
          {...(xAxisVal === "timestamp" ? { timestampMethod } : undefined)}
        />
        {hasMismatchedDataLength && (
          <Tooltip
            placement="top"
            title="Mismatch in the number of elements in x-axis and y-axis messages"
          >
            <ErrorIcon fontSize="small" sx={{ color: "error.main" }} />
          </Tooltip>
        )}
      </Box>
      {currentDisplay.value != undefined && showPlotValuesInLegend && (
        <Box display="flex" alignItems="center" padding={0.25}>
          <Typography
            component="div"
            variant="body2"
            align="right"
            sx={{ color: currentDisplay.color, width: 150 }}
          >
            {currentDisplay.value}
          </Typography>
        </Box>
      )}

      <Stack
        direction="row"
        alignItems="center"
        padding={0.25}
        spacing={0.25}
        position="sticky"
        right={0}
        sx={({ palette }) => ({
          opacity: 0,
          // creates an opaque background for the sticky element
          backgroundImage: `linear-gradient(${palette.background.paper}, ${palette.background.paper})`,
          backgroundBlendMode: "overlay",

          "&:hover": {
            opacity: 1,
          },
        })}
      >
        <TimestampMethodDropdown
          path={path.value}
          onTimestampMethodChange={onInputTimestampMethodChange}
          index={index}
          iconButtonProps={{ disabled: !path.value }}
          timestampMethod={xAxisVal === "timestamp" ? timestampMethod : undefined}
        />
        <IconButton
          size="small"
          title={`Remove ${path.value}`}
          sx={{ padding: 0.25, color: "text.secondary", "&:hover": { color: "text.primary" } }}
          onClick={() => {
            const newPaths = paths.slice();
            newPaths.splice(index, 1);
            saveConfig({ paths: newPaths });
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}
