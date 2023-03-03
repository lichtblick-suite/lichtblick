// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  QuestionCircle24Regular,
  PanelRight24Filled,
  PanelRight24Regular,
  Settings24Regular,
  SlideAdd24Regular,
} from "@fluentui/react-icons";
import { AppBar as MuiAppBar, Button, IconButton } from "@mui/material";
import { useCallback, useState } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import PanelLayoutIcon from "@foxglove/studio-base/assets/panel-layout.svg";
import {
  CustomWindowControls,
  CustomWindowControlsProps,
} from "@foxglove/studio-base/components/AppBar/CustomWindowControls";
import { FoxgloveLogo } from "@foxglove/studio-base/components/FoxgloveLogo";
import { MemoryUseIndicator } from "@foxglove/studio-base/components/MemoryUseIndicator";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  CurrentUser,
  useCurrentUserType,
  User,
} from "@foxglove/studio-base/context/CurrentUserContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import useNativeAppMenuEvent from "@foxglove/studio-base/hooks/useNativeAppMenuEvent";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import { AddPanelMenu } from "./AddPanelMenu";
import { DataSource } from "./DataSource";
import { HelpMenu } from "./HelpMenu";
import { LayoutMenu } from "./LayoutMenu";
import { PreferencesDialog } from "./Preferences";
import { UserIconButton, UserMenu } from "./User";
import {
  APP_BAR_BACKGROUND_COLOR,
  APP_BAR_FOREGROUND_COLOR,
  APP_BAR_HEIGHT,
  APP_BAR_PRIMARY_COLOR,
} from "./constants";

const useStyles = makeStyles<{ leftInset?: number; debugDragRegion?: boolean }>()(
  (theme, { leftInset, debugDragRegion = false }) => {
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
      iconButton: {
        borderRadius: 0,
        fontSize: 20,

        svg: {
          fontSize: "1em !important",
        },
        "&:hover": {
          backgroundColor: tinycolor(APP_BAR_FOREGROUND_COLOR).setAlpha(0.08).toRgbString(),
        },
        "&.Mui-selected": {
          backgroundColor: APP_BAR_PRIMARY_COLOR,
        },
      },
      button: {
        backgroundColor: APP_BAR_PRIMARY_COLOR,

        "&:hover": {
          backgroundColor: theme.palette.augmentColor({
            color: { main: APP_BAR_PRIMARY_COLOR },
          }).dark,
        },
      },
    };
  },
);

type AppBarProps = CustomWindowControlsProps & {
  currentUser?: User;
  signIn?: CurrentUser["signIn"];
  leftInset?: number;
  onDoubleClick?: () => void;
  debugDragRegion?: boolean;
  disableSignIn?: boolean;
  onSelectDataSourceAction: () => void;
};

const selectedLayoutIdSelector = (state: LayoutState) => state.selectedLayout?.id;

export function AppBar(props: AppBarProps): JSX.Element {
  const {
    currentUser,
    disableSignIn = false,
    signIn,
    leftInset,
    showCustomWindowControls = false,
    onDoubleClick,
    isMaximized,
    onMinimizeWindow,
    onMaximizeWindow,
    onUnmaximizeWindow,
    onCloseWindow,
    onSelectDataSourceAction,
    debugDragRegion,
  } = props;
  const { classes, cx } = useStyles({ leftInset, debugDragRegion });
  const currentUserType = useCurrentUserType();
  const analytics = useAnalytics();
  const [enableMemoryUseIndicator = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_MEMORY_USE_INDICATOR,
  );

  const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const supportsAccountSettings = signIn != undefined;

  const { rightSidebarOpen, setRightSidebarOpen } = useWorkspace();

  const [helpAnchorEl, setHelpAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [userAnchorEl, setUserAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [panelAnchorEl, setPanelAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [layoutAnchorEl, setLayoutAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [prefsDialogOpen, setPrefsDialogOpen] = useState(false);

  const helpMenuOpen = Boolean(helpAnchorEl);
  const userMenuOpen = Boolean(userAnchorEl);
  const panelMenuOpen = Boolean(panelAnchorEl);
  const layoutMenuOpen = Boolean(layoutAnchorEl);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onDoubleClick?.();
    },
    [onDoubleClick],
  );

  useNativeAppMenuEvent(
    "open-preferences",
    useCallback(() => {
      setPrefsDialogOpen((open) => !open);
    }, []),
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
              <IconButton
                className={cx(classes.iconButton, { "Mui-selected": layoutMenuOpen })}
                color="inherit"
                id="layout-button"
                title="Layout browser"
                aria-label="Layout button"
                aria-controls={layoutMenuOpen ? "layout-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={layoutMenuOpen ? "true" : undefined}
                size="large"
                onClick={(event) => {
                  setLayoutAnchorEl(event.currentTarget);
                }}
              >
                <PanelLayoutIcon />
              </IconButton>
              {selectedLayoutId != undefined && (
                <IconButton
                  className={cx(classes.iconButton, { "Mui-selected": panelMenuOpen })}
                  color="inherit"
                  id="add-panel-button"
                  title="Add panel"
                  aria-label="Add panel button"
                  aria-controls={panelMenuOpen ? "add-panel-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={panelMenuOpen ? "true" : undefined}
                  size="large"
                  onClick={(event) => {
                    setPanelAnchorEl(event.currentTarget);
                  }}
                >
                  <SlideAdd24Regular />
                </IconButton>
              )}
            </div>
          </div>

          <div className={classes.middle}>
            <DataSource onSelectDataSourceAction={onSelectDataSourceAction} />
          </div>

          <div className={classes.end}>
            <div className={classes.endInner}>
              {enableMemoryUseIndicator && <MemoryUseIndicator />}
              <IconButton
                className={classes.iconButton}
                color="inherit"
                title={`${rightSidebarOpen ? "Hide" : "Show"} right sidebar`}
                aria-label={`${rightSidebarOpen ? "Hide" : "Show"} right sidebar`}
                size="large"
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              >
                {rightSidebarOpen ? <PanelRight24Filled /> : <PanelRight24Regular />}
              </IconButton>
              <IconButton
                className={cx(classes.iconButton, { "Mui-selected": helpMenuOpen })}
                color="inherit"
                id="help-button"
                aria-label="Help menu button"
                aria-controls={helpMenuOpen ? "help-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={helpMenuOpen ? "true" : undefined}
                size="large"
                onClick={(event) => {
                  void analytics.logEvent(AppEvent.APP_BAR_CLICK_CTA, {
                    user: currentUserType,
                    cta: "help-menu",
                  });
                  setHelpAnchorEl(event.currentTarget);
                }}
              >
                <QuestionCircle24Regular />
              </IconButton>
              <IconButton
                className={cx(classes.iconButton, { "Mui-selected": userMenuOpen })}
                color="inherit"
                id="preferences-button"
                aria-label="Preferences dialog button"
                aria-controls={prefsDialogOpen ? "preferences-dialog" : undefined}
                aria-haspopup="true"
                size="large"
                aria-expanded={prefsDialogOpen ? "true" : undefined}
                onClick={() => {
                  void analytics.logEvent(AppEvent.APP_BAR_CLICK_CTA, {
                    user: currentUserType,
                    cta: "preferences-dialog",
                  });
                  setPrefsDialogOpen(true);
                }}
              >
                <Settings24Regular />
              </IconButton>
              {!disableSignIn && supportsAccountSettings && (
                <Stack direction="row" gap={1} paddingX={1}>
                  {currentUser ? (
                    <UserIconButton
                      className={classes.iconButton}
                      aria-label="User profile menu button"
                      color="inherit"
                      id="user-profile-button"
                      aria-controls={userMenuOpen ? "user-profile-menu" : undefined}
                      aria-haspopup="true"
                      aria-expanded={userMenuOpen ? "true" : undefined}
                      onClick={(event) => setUserAnchorEl(event.currentTarget)}
                      size="small"
                      currentUser={currentUser}
                    />
                  ) : (
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
                </Stack>
              )}
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
      <LayoutMenu
        anchorEl={layoutAnchorEl}
        open={layoutMenuOpen}
        handleClose={() => setLayoutAnchorEl(undefined)}
        supportsSignIn={supportsAccountSettings}
      />
      <HelpMenu
        anchorEl={helpAnchorEl}
        open={helpMenuOpen}
        handleClose={() => setHelpAnchorEl(undefined)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      />
      <UserMenu
        anchorEl={userAnchorEl}
        open={userMenuOpen}
        handleClose={() => setUserAnchorEl(undefined)}
      />
      <PreferencesDialog
        id="preferences-dialog"
        open={prefsDialogOpen}
        onClose={() => setPrefsDialogOpen(false)}
      />
    </>
  );
}
