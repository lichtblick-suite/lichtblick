// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  AddCircle24Regular,
  PanelLeft24Filled,
  PanelLeft24Regular,
  PanelRight24Filled,
  PanelRight24Regular,
} from "@fluentui/react-icons";
import PersonIcon from "@mui/icons-material/Person";
import { Avatar, Button, IconButton, Tooltip, AppBar as MuiAppBar } from "@mui/material";
import { useCallback, useState } from "react";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";
import { shallow } from "zustand/shallow";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { AppBarIconButton } from "@foxglove/studio-base/components/AppBar/AppBarIconButton";
import {
  CustomWindowControls,
  CustomWindowControlsProps,
} from "@foxglove/studio-base/components/AppBar/CustomWindowControls";
import { FoxgloveLogo } from "@foxglove/studio-base/components/FoxgloveLogo";
import { MemoryUseIndicator } from "@foxglove/studio-base/components/MemoryUseIndicator";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import {
  useWorkspaceActions,
  useWorkspaceStore,
  WorkspaceContextStore,
} from "@foxglove/studio-base/context/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { AddPanelMenu } from "./AddPanelMenu";
import { DataSource } from "./DataSource";
import { UserMenu } from "./UserMenu";
import {
  APP_BAR_BACKGROUND_COLOR,
  APP_BAR_FOREGROUND_COLOR,
  APP_BAR_HEIGHT,
  APP_BAR_PRIMARY_COLOR,
} from "./constants";

const useStyles = makeStyles<{ leftInset?: number; debugDragRegion?: boolean }, "avatar">()(
  (theme, { leftInset, debugDragRegion = false }, classes) => {
    const DRAGGABLE_STYLE: Record<string, string> = { WebkitAppRegion: "drag" };
    const NOT_DRAGGABLE_STYLE: Record<string, string> = { WebkitAppRegion: "no-drag" };
    if (debugDragRegion) {
      DRAGGABLE_STYLE.backgroundColor = "green";
      NOT_DRAGGABLE_STYLE.backgroundColor = "red";
    }
    return {
      appBar: {
        gridArea: "appbar",
        boxShadow: "none",
        backgroundColor: APP_BAR_BACKGROUND_COLOR[theme.palette.mode],
        borderBottom: "none",
        color: APP_BAR_FOREGROUND_COLOR,
        height: APP_BAR_HEIGHT,

        // Leave space for system window controls on the right on Windows.
        // Use hard-coded padding for Mac because it looks better than env(titlebar-area-x).
        paddingLeft: leftInset,
        paddingRight: "calc(100% - env(titlebar-area-x) - env(titlebar-area-width))",
        ...DRAGGABLE_STYLE, // make custom window title bar draggable for desktop app
      },
      toolbar: {
        display: "grid",
        width: "100%",
        gridTemplateAreas: `"start middle end"`,
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
      },
      logo: {
        padding: theme.spacing(0.5),
        fontSize: "2.125rem",
        color: APP_BAR_PRIMARY_COLOR,
      },
      start: {
        gridArea: "start",
        display: "flex",
        flex: 1,
        alignItems: "center",
      },
      startInner: {
        display: "flex",
        alignItems: "center",
        ...NOT_DRAGGABLE_STYLE, // make buttons clickable for desktop app
      },
      middle: {
        gridArea: "middle",
        justifySelf: "center",
        overflow: "hidden",
        maxWidth: "100%",
        ...NOT_DRAGGABLE_STYLE, // make buttons clickable for desktop app
      },
      end: {
        gridArea: "end",
        flex: 1,
        display: "flex",
        justifyContent: "flex-end",
      },
      endInner: {
        display: "flex",
        alignItems: "center",
        ...NOT_DRAGGABLE_STYLE, // make buttons clickable for desktop app
      },
      keyEquivalent: {
        fontFamily: fonts.MONOSPACE,
        background: tc(APP_BAR_FOREGROUND_COLOR).darken(45).toString(),
        padding: theme.spacing(0, 0.5),
        aspectRatio: 1,
        borderRadius: theme.shape.borderRadius,
        marginLeft: theme.spacing(1),
      },
      tooltip: {
        marginTop: `${theme.spacing(0.5)} !important`,
      },
      avatar: {
        color: APP_BAR_FOREGROUND_COLOR,
        backgroundColor: tc(APP_BAR_BACKGROUND_COLOR[theme.palette.mode]).lighten().toString(),
        height: theme.spacing(3.5),
        width: theme.spacing(3.5),
        transition: theme.transitions.create("background-color", {
          duration: theme.transitions.duration.shortest,
        }),
      },
      iconButton: {
        padding: theme.spacing(1),
        borderRadius: 0,
        transition: theme.transitions.create("background-color", {
          duration: theme.transitions.duration.shortest,
        }),
        "&:hover": {
          backgroundColor: tc(APP_BAR_FOREGROUND_COLOR).setAlpha(0.08).toString(),

          [`.${classes.avatar}`]: {
            backgroundColor: tc(APP_BAR_BACKGROUND_COLOR[theme.palette.mode])
              .lighten(20)
              .toString(),
          },
        },
        "&.Mui-selected": {
          backgroundColor: tc(APP_BAR_FOREGROUND_COLOR).setAlpha(0.08).toString(),

          [`.${classes.avatar}`]: {
            backgroundColor: APP_BAR_PRIMARY_COLOR,
          },
        },
      },
      userIconImage: {
        objectFit: "cover",
        width: "100%",
      },
      button: {
        marginInline: theme.spacing(1),
        backgroundColor: APP_BAR_PRIMARY_COLOR,

        "&:hover": {
          backgroundColor: theme.palette.augmentColor({ color: { main: APP_BAR_PRIMARY_COLOR } })
            .dark,
        },
      },
    };
  },
);

type AppBarProps = CustomWindowControlsProps & {
  leftInset?: number;
  onDoubleClick?: () => void;
  debugDragRegion?: boolean;
  disableSignIn?: boolean;
  onSelectDataSourceAction: () => void;
};

const selectCurrentLayoutId = ({ selectedLayout }: LayoutState) => selectedLayout?.id;
const selectWorkspace = (store: WorkspaceContextStore) => store;

export function AppBar(props: AppBarProps): JSX.Element {
  const {
    debugDragRegion,
    disableSignIn = false,
    isMaximized,
    leftInset,
    onCloseWindow,
    onDoubleClick,
    onMaximizeWindow,
    onMinimizeWindow,
    onSelectDataSourceAction,
    onUnmaximizeWindow,
    showCustomWindowControls = false,
  } = props;
  const { classes, cx } = useStyles({ leftInset, debugDragRegion });
  const { currentUser, signIn } = useCurrentUser();

  const { appBarLayoutButton } = useAppContext();

  const analytics = useAnalytics();
  const [enableMemoryUseIndicator = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_MEMORY_USE_INDICATOR,
  );

  const currentLayoutId = useCurrentLayoutSelector(selectCurrentLayoutId);

  const { leftSidebarOpen, rightSidebarOpen } = useWorkspaceStore(selectWorkspace, shallow);
  const { setRightSidebarOpen, setLeftSidebarOpen } = useWorkspaceActions();

  const [userAnchorEl, setUserAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [panelAnchorEl, setPanelAnchorEl] = useState<undefined | HTMLElement>(undefined);

  const userMenuOpen = Boolean(userAnchorEl);
  const panelMenuOpen = Boolean(panelAnchorEl);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onDoubleClick?.();
    },
    [onDoubleClick],
  );

  return (
    <>
      <MuiAppBar
        className={classes.appBar}
        position="relative"
        color="inherit"
        elevation={0}
        onDoubleClick={handleDoubleClick}
      >
        <div className={classes.toolbar}>
          <div className={classes.start}>
            <div className={classes.startInner}>
              <IconButton className={classes.logo} size="large" color="inherit">
                <FoxgloveLogo fontSize="inherit" color="inherit" />
              </IconButton>
              <AppBarIconButton
                className={cx({ "Mui-selected": panelMenuOpen })}
                color="inherit"
                disabled={currentLayoutId == undefined}
                id="add-panel-button"
                title="Add panel"
                aria-label="Add panel button"
                aria-controls={panelMenuOpen ? "add-panel-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={panelMenuOpen ? "true" : undefined}
                onClick={(event) => {
                  setPanelAnchorEl(event.currentTarget);
                }}
              >
                <AddCircle24Regular />
              </AppBarIconButton>
            </div>
          </div>

          <div className={classes.middle}>
            <DataSource onSelectDataSourceAction={onSelectDataSourceAction} />
          </div>

          <div className={classes.end}>
            <div className={classes.endInner}>
              {enableMemoryUseIndicator && <MemoryUseIndicator />}
              {appBarLayoutButton}
              <Stack direction="row" alignItems="center">
                <AppBarIconButton
                  title={
                    <>
                      {leftSidebarOpen ? "Hide" : "Show"} left sidebar{" "}
                      <kbd className={classes.keyEquivalent}>[</kbd>
                    </>
                  }
                  aria-label={`${leftSidebarOpen ? "Hide" : "Show"} left sidebar`}
                  onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                >
                  {leftSidebarOpen ? <PanelLeft24Filled /> : <PanelLeft24Regular />}
                </AppBarIconButton>
                <AppBarIconButton
                  title={
                    <>
                      {rightSidebarOpen ? "Hide" : "Show"} right sidebar{" "}
                      <kbd className={classes.keyEquivalent}>]</kbd>
                    </>
                  }
                  aria-label={`${rightSidebarOpen ? "Hide" : "Show"} right sidebar`}
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                >
                  {rightSidebarOpen ? <PanelRight24Filled /> : <PanelRight24Regular />}
                </AppBarIconButton>
              </Stack>
              {!disableSignIn && !currentUser && signIn != undefined && (
                <Button
                  variant="contained"
                  color="primary"
                  className={classes.button}
                  size="small"
                  onClick={() => {
                    signIn();
                    void analytics.logEvent(AppEvent.APP_BAR_CLICK_CTA, {
                      user: "unauthenticated",
                      cta: "sign-in",
                    });
                  }}
                >
                  Sign in
                </Button>
              )}
              <Tooltip
                classes={{ tooltip: classes.tooltip }}
                title={currentUser?.email ?? "Profile"}
                arrow={false}
              >
                <IconButton
                  className={cx(classes.iconButton, { "Mui-selected": userMenuOpen })}
                  aria-label="User profile menu button"
                  color="inherit"
                  id="user-profile-button"
                  aria-controls={userMenuOpen ? "user-profile-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen ? "true" : undefined}
                  onClick={(event) => setUserAnchorEl(event.currentTarget)}
                  data-testid="user-button"
                >
                  <Avatar className={classes.avatar} variant="rounded">
                    {currentUser?.avatarImageUrl ? (
                      <img
                        src={currentUser.avatarImageUrl}
                        referrerPolicy="same-origin"
                        className={classes.userIconImage}
                      />
                    ) : (
                      <PersonIcon />
                    )}
                  </Avatar>
                </IconButton>
              </Tooltip>
              {showCustomWindowControls && (
                <CustomWindowControls
                  onMinimizeWindow={onMinimizeWindow}
                  isMaximized={isMaximized}
                  onUnmaximizeWindow={onUnmaximizeWindow}
                  onMaximizeWindow={onMaximizeWindow}
                  onCloseWindow={onCloseWindow}
                />
              )}
            </div>
          </div>
        </div>
      </MuiAppBar>
      <AddPanelMenu
        anchorEl={panelAnchorEl}
        open={panelMenuOpen}
        handleClose={() => setPanelAnchorEl(undefined)}
      />
      <UserMenu
        anchorEl={userAnchorEl}
        open={userMenuOpen}
        handleClose={() => setUserAnchorEl(undefined)}
      />
    </>
  );
}
