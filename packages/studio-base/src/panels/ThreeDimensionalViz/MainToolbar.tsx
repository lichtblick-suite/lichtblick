// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RulerIcon from "@mdi/svg/svg/ruler.svg";
import Video3dIcon from "@mdi/svg/svg/video-3d.svg";
import { Settings } from "@mui/icons-material";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckIcon from "@mui/icons-material/Check";
import {
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  SvgIcon,
  Typography,
} from "@mui/material";
import { ReactElement, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { useLongPress } from "react-use";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import {
  InteractionState,
  InteractionStateDispatch,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/InteractionState";
import { PublishClickType } from "@foxglove/studio-base/panels/ThreeDimensionalViz/PublishClickTool";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";

type Props = {
  debug: boolean;
  interactionState: InteractionState;
  interactionStateDispatch: InteractionStateDispatch;
  onToggleCameraMode: () => void;
  onToggleDebug: () => void;
  perspective: boolean;
};

const PublishClickIcons: Record<PublishClickType, ReactNode> = {
  goal: (
    <SvgIcon viewBox="0 0 24 24">
      <g>
        <circle cx="12.03" cy="18.5" r="2" />
        <path d="M13.28,13.15V5H17L12,0,7.08,5h3.7v8.2a5.5,5.5,0,1,0,2.5,0ZM12,22a3.5,3.5,0,1,1,3.5-3.5A3.5,3.5,0,0,1,12,22Z" />
      </g>
    </SvgIcon>
  ),
  point: (
    <SvgIcon viewBox="0 0 24 24">
      <g>
        <circle cx="12" cy="12" r="2" />
        <path d="M12,17.5A5.5,5.5,0,1,1,17.5,12,5.51,5.51,0,0,1,12,17.5Zm0-9A3.5,3.5,0,1,0,15.5,12,3.5,3.5,0,0,0,12,8.5Z" />
      </g>
    </SvgIcon>
  ),
  pose_estimate: (
    <SvgIcon viewBox="0 0 24 24">
      <g>
        <path
          d="M.23,8.71l7.85,7.41L12,13.29l4,2.83,7.85-7.41S20.8,4,12,4,.23,8.71.23,8.71Z"
          opacity="0.2"
        />
        <circle cx="12.03" cy="18.5" r="2" />
        <path d="M13.28,13.15V5H17L12,0,7.08,5h3.7v8.2a5.5,5.5,0,1,0,2.5,0ZM12,22a3.5,3.5,0,1,1,3.5-3.5A3.5,3.5,0,0,1,12,22Z" />
        <path d="M16,16.12,14.6,14.67l1.46-1.37,1.37,1.45Zm2.18-2.06-1.37-1.45,1.45-1.37,1.37,1.45ZM20.34,12,19,10.55l1.45-1.37,1.38,1.45ZM22.52,10,21.15,8.49l1.31-1.24,1.37,1.46Z" />
        <path d="M8.08,16.12,6.63,14.75,8,13.3l1.46,1.37ZM5.9,14.06,4.45,12.69l1.37-1.45,1.45,1.37ZM3.72,12,2.27,10.63,3.64,9.18l1.45,1.37ZM1.54,10,.23,8.71,1.6,7.25,2.91,8.49Z" />
      </g>
    </SvgIcon>
  ),
};

const canPublishSelector = (context: MessagePipelineContext) =>
  context.playerState.capabilities.includes(PlayerCapabilities.advertise);

const IconStyle = {
  "& svg, & svg:not(.MuiSvgIcon-root)": {
    fontSize: "1rem",
  },
};

function ClickToExpandIndicator({ perspective }: { perspective: boolean }): ReactElement {
  return (
    <Box
      sx={(theme) => ({
        content: perspective ? "none" : "''",
        borderBottom: `6px solid ${
          perspective ? theme.palette.text.disabled : theme.palette.text.primary
        }`,
        borderRight: "6px solid transparent",
        bottom: 0,
        left: 0,
        height: 0,
        width: 0,
        margin: 0.25,
        position: "absolute",
      })}
    />
  );
}

function PopupMenuItemLabel({ text }: { text: string }): ReactElement {
  return (
    <ListItemText
      primary={text}
      primaryTypographyProps={{ variant: "body2" }}
      sx={{ marginX: 1 }}
    />
  );
}

function PopupMenuItemCheckbox({ checked }: { checked: boolean }): ReactElement {
  return <CheckIcon sx={{ visibility: checked ? "visible" : "hidden" }} />;
}

function MainToolbar({
  debug,
  interactionState,
  interactionStateDispatch: dispatch,
  onToggleCameraMode,
  onToggleDebug,
  perspective = false,
}: Props) {
  const canPublish = useMessagePipeline(canPublishSelector);

  const [clickMenuExpanded, setClickMenuExpanded] = useState(false);
  const [activePublishClickType, setActivePublishClickType] = useState<PublishClickType>("point");
  const publickClickButtonRef = useRef<HTMLElement>(ReactNull);
  const { setSelectedPanelIds } = useSelectedPanels();

  const panelContext = useContext(PanelContext);

  const onLongPress = useCallback(() => {
    setClickMenuExpanded(true);
  }, []);
  const longPressEvent = useLongPress(onLongPress);

  const selectedPublishClickIcon = PublishClickIcons[activePublishClickType];

  const selectPublishClickToolType = (type: PublishClickType) => {
    setActivePublishClickType(type);
    setClickMenuExpanded(false);
    dispatch({ action: "select-tool", tool: "publish-click", type });
  };

  const selectPublishClickTool = () => {
    if (!clickMenuExpanded) {
      dispatch({ action: "select-tool", tool: "publish-click", type: activePublishClickType });
    }
  };

  const { openPanelSettings } = useWorkspace();
  const openSettings = useCallback(() => {
    if (panelContext?.id != undefined) {
      setSelectedPanelIds([panelContext.id]);
      openPanelSettings();
      setClickMenuExpanded(false);
    }
  }, [setSelectedPanelIds, openPanelSettings, panelContext?.id]);

  return (
    <Paper square={false} elevation={4} sx={{ pointerEvents: "auto" }}>
      <Stack alignItems="flex-end" flexGrow={0} flexShrink={0}>
        <IconButton
          title={perspective ? "Switch to 2D camera" : "Switch to 3D camera"}
          data-text="MainToolbar-toggleCameraMode"
          sx={{ ...IconStyle, color: perspective ? "info.main" : "inherit" }}
          onClick={onToggleCameraMode}
        >
          <Video3dIcon />
        </IconButton>
        <IconButton
          title={
            perspective
              ? "Switch to 2D camera to measure distance"
              : interactionState.tool === "measure"
              ? "Cancel measuring"
              : "Measure distance"
          }
          disabled={perspective}
          onClick={() => dispatch({ action: "select-tool", tool: "measure" })}
          sx={{
            ...IconStyle,
            color: !perspective && interactionState.tool === "measure" ? "info.main" : "inherit",
            position: "relative",
          }}
        >
          {interactionState.measure?.state === "finish" && (
            <Typography
              sx={{
                color: "white",
                left: -6,
                fontSize: 12,
                position: "absolute",
                top: "50%",
                transform: "translate(-100%, -50%)",
              }}
            >
              {interactionState.measure.distance.toFixed(2)}m
            </Typography>
          )}
          <RulerIcon />
        </IconButton>

        {canPublish && (
          <Stack direction="row" position="relative">
            <IconButton
              {...longPressEvent}
              title={
                interactionState.tool === "publish-click" ? "Click to cancel" : "Click to publish"
              }
              ref={(r) => (publickClickButtonRef.current = r)}
              onClick={selectPublishClickTool}
              id="publish-button"
              aria-controls={clickMenuExpanded ? "publish-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={clickMenuExpanded ? "true" : undefined}
              disabled={perspective}
              sx={{
                ...IconStyle,
                position: "relative",
                color:
                  !perspective && interactionState.tool === "publish-click"
                    ? "info.main"
                    : "inherit",
              }}
            >
              {selectedPublishClickIcon}
              <ClickToExpandIndicator perspective={perspective} />
            </IconButton>
            <Menu
              id="publish-menu"
              anchorEl={publickClickButtonRef.current}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              sx={{ transform: "translateY(-8px) translateX(-4px)" }}
              open={clickMenuExpanded}
              onClose={() => setClickMenuExpanded(false)}
              MenuListProps={{
                "aria-labelledby": "publish-button",
              }}
            >
              <MenuItem
                selected={activePublishClickType === "pose_estimate"}
                onClick={() => selectPublishClickToolType("pose_estimate")}
              >
                {PublishClickIcons.pose_estimate}
                <PopupMenuItemLabel text="Publish pose estimate" />
                <PopupMenuItemCheckbox checked={activePublishClickType === "pose_estimate"} />
              </MenuItem>
              <MenuItem
                selected={activePublishClickType === "goal"}
                onClick={() => selectPublishClickToolType("goal")}
              >
                {PublishClickIcons["goal"]}
                <PopupMenuItemLabel text="Publish pose" />
                <PopupMenuItemCheckbox checked={activePublishClickType === "goal"} />
              </MenuItem>
              <MenuItem
                selected={activePublishClickType === "point"}
                onClick={() => selectPublishClickToolType("point")}
              >
                {PublishClickIcons["point"]}
                <PopupMenuItemLabel text="Publish point" />
                <PopupMenuItemCheckbox checked={activePublishClickType === "point"} />
              </MenuItem>
              <MenuItem onClick={openSettings}>
                <Settings />
                <PopupMenuItemLabel text="Edit settings…" />
              </MenuItem>
            </Menu>
          </Stack>
        )}

        {process.env.NODE_ENV === "development" && (
          <IconButton
            title={debug ? "Disable debug" : "Enable debug"}
            sx={{ ...IconStyle, color: debug ? "info.main" : "inherit" }}
            onClick={onToggleDebug}
          >
            <BugReportIcon />
          </IconButton>
        )}
      </Stack>
    </Paper>
  );
}

export default React.memo<Props>(MainToolbar);
