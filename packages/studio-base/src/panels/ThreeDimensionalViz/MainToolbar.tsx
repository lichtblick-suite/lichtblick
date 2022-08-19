// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RulerIcon from "@mdi/svg/svg/ruler.svg";
import Video3dIcon from "@mdi/svg/svg/video-3d.svg";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckIcon from "@mui/icons-material/Check";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  MenuItemProps,
  Paper,
  Typography,
} from "@mui/material";
import { ReactNode, useCallback, useContext, useRef, useState } from "react";
import { useLongPress } from "react-use";
import { makeStyles } from "tss-react/mui";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import PublishGoalIcon from "@foxglove/studio-base/components/PublishGoalIcon";
import PublishPointIcon from "@foxglove/studio-base/components/PublishPointIcon";
import PublishPoseEstimateIcon from "@foxglove/studio-base/components/PublishPoseEstimateIcon";
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

const useStyles = makeStyles()((theme) => ({
  root: {
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    flex: "0 0",

    "& > .MuiIconButton-root": {
      "&:not(:last-child)": {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
      "&:not(:first-child)": {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      },
    },
  },
  // row: {
  //   display: "flex",
  //   position: "relative",
  // },
  expandIndicator: {
    content: "''",
    borderBottom: "6px solid currentColor",
    borderRight: "6px solid transparent",
    bottom: 0,
    left: 0,
    height: 0,
    width: 0,
    margin: theme.spacing(0.25),
    position: "absolute",
  },
  icon: {
    position: "relative",
    fontSize: "16px !important",

    "& svg:not(.MuiSvgIcon-root)": {
      fontSize: "16px !important",
    },
  },
  menu: {
    transform: `translateX(${theme.spacing(-0.5)})`,
  },
  menuItem: {
    alignItems: "center",
  },
  menuItemIcon: {
    display: "inline-flex",
    fontSize: "1.25rem",
  },
  menuItemText: {
    margin: theme.spacing(0, 1),
  },
  measureText: {
    color: theme.palette.common.white,
    left: theme.spacing(-0.75),
    position: "absolute",
    top: "50%",
    transform: "translate(-100%, -50%)",
  },
}));

const PublishClickIcons: Record<PublishClickType, ReactNode> = {
  goal: <PublishGoalIcon fontSize="inherit" />,
  point: <PublishPointIcon fontSize="inherit" />,
  pose_estimate: <PublishPoseEstimateIcon fontSize="inherit" />,
};

const canPublishSelector = (context: MessagePipelineContext) =>
  context.playerState.capabilities.includes(PlayerCapabilities.advertise);

type PopupMenuItemProps = {
  icon?: ReactNode;
  text: string;
} & MenuItemProps;

function PopupMenuItem({ icon, text, selected = false, ...rest }: PopupMenuItemProps): JSX.Element {
  const { classes } = useStyles();
  return (
    <MenuItem className={classes.menuItem} selected={selected} {...rest}>
      <div className={classes.menuItemIcon}>{icon != undefined && icon}</div>
      <ListItemText
        className={classes.menuItemText}
        primary={text}
        primaryTypographyProps={{ variant: "body2" }}
      />
      {selected && <CheckIcon />}
    </MenuItem>
  );
}

function MainToolbar({
  debug,
  interactionState,
  interactionStateDispatch: dispatch,
  onToggleCameraMode,
  onToggleDebug,
  perspective = false,
}: Props) {
  const { classes } = useStyles();
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
    <Paper className={classes.root} square={false} elevation={4}>
      <IconButton
        color={perspective ? "info" : "inherit"}
        className={classes.icon}
        title={perspective ? "Switch to 2D camera" : "Switch to 3D camera"}
        data-text="MainToolbar-toggleCameraMode"
        onClick={onToggleCameraMode}
      >
        <Video3dIcon />
      </IconButton>
      <IconButton
        className={classes.icon}
        color={!perspective && interactionState.tool === "measure" ? "info" : "inherit"}
        title={
          perspective
            ? "Switch to 2D camera to measure distance"
            : interactionState.tool === "measure"
            ? "Cancel measuring"
            : "Measure distance"
        }
        disabled={perspective}
        onClick={() => dispatch({ action: "select-tool", tool: "measure" })}
      >
        {interactionState.measure?.state === "finish" && (
          <Typography className={classes.measureText} variant="body2">
            {interactionState.measure.distance.toFixed(2)}m
          </Typography>
        )}
        <RulerIcon />
      </IconButton>

      {canPublish && (
        <>
          <IconButton
            {...longPressEvent}
            color={!perspective && interactionState.tool === "publish-click" ? "info" : "inherit"}
            className={classes.icon}
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
          >
            {selectedPublishClickIcon}
            {!perspective && <div className={classes.expandIndicator} />}
          </IconButton>
          <Menu
            className={classes.menu}
            id="publish-menu"
            anchorEl={publickClickButtonRef.current}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            open={clickMenuExpanded}
            onClose={() => setClickMenuExpanded(false)}
            MenuListProps={{
              "aria-labelledby": "publish-button",
            }}
          >
            <PopupMenuItem
              icon={PublishClickIcons.pose_estimate}
              selected={activePublishClickType === "pose_estimate"}
              onClick={() => selectPublishClickToolType("pose_estimate")}
              text="Publish pose estimate"
            />
            <PopupMenuItem
              icon={PublishClickIcons.goal}
              selected={activePublishClickType === "goal"}
              onClick={() => selectPublishClickToolType("goal")}
              text="Publish pose"
            />
            <PopupMenuItem
              icon={PublishClickIcons.point}
              selected={activePublishClickType === "point"}
              onClick={() => selectPublishClickToolType("point")}
              text="Publish point"
            />
            <PopupMenuItem
              icon={<SettingsIcon fontSize="inherit" />}
              onClick={openSettings}
              text="Edit settings…"
            />
          </Menu>
        </>
      )}

      {process.env.NODE_ENV === "development" && (
        <IconButton
          className={classes.icon}
          color={debug ? "info" : "inherit"}
          title={debug ? "Disable debug" : "Enable debug"}
          onClick={onToggleDebug}
        >
          <BugReportIcon fontSize="inherit" />
        </IconButton>
      )}
    </Paper>
  );
}

export default React.memo<Props>(MainToolbar);
