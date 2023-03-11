// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  AddCircle24Regular,
  BoardSplit24Regular,
  PanelLeft24Filled,
  PanelLeft24Regular,
  PanelRight24Filled,
  PanelRight24Regular,
  QuestionCircle24Regular,
  Settings24Regular,
} from "@fluentui/react-icons";
import { AppBar as MuiAppBar, Button, IconButton } from "@mui/material";
import { useCallback, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

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
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

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
      button: {
        marginInline: theme.spacing(1),
        backgroundColor: APP_BAR_PRIMARY_COLOR,

        "&:hover": {
          backgroundColor: theme.palette.augmentColor({
            color: { main: APP_BAR_PRIMARY_COLOR },
          }).dark,
        },
      },
      keyEquivalent: {
        fontFamily: fonts.MONOSPACE,
        background: theme.palette.augmentColor({ color: { main: APP_BAR_FOREGROUND_COLOR } }).dark,
        padding: theme.spacing(0, 0.5),
        aspectRatio: 1,
        borderRadius: theme.shape.borderRadius,
        marginLeft: theme.spacing(1),
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
  prefsDialogOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setPrefsDialogOpen: (open: boolean) => void;
  layoutMenuOpen: boolean;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setLayoutMenuOpen: (open: boolean) => void;
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
    prefsDialogOpen,
    setPrefsDialogOpen,
    layoutMenuOpen,
    setLayoutMenuOpen,
  } = props;
  const { classes, cx } = useStyles({ leftInset, debugDragRegion });
  const currentUserType = useCurrentUserType();
  const analytics = useAnalytics();
  const [enableMemoryUseIndicator = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_MEMORY_USE_INDICATOR,
  );

  const selectedLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
  const supportsAccountSettings = signIn != undefined;

  const { leftSidebarOpen, setLeftSidebarOpen, rightSidebarOpen, setRightSidebarOpen } =
    useWorkspace();

  const [helpAnchorEl, setHelpAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [userAnchorEl, setUserAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const [panelAnchorEl, setPanelAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const layoutButtonRef = useRef<HTMLButtonElement>(ReactNull);
  const layoutAnchorEl = layoutMenuOpen ? layoutButtonRef.current : undefined;

  const helpMenuOpen = Boolean(helpAnchorEl);
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
                className={cx({ "Mui-selected": layoutMenuOpen })}
                ref={layoutButtonRef}
                color="inherit"
                id="layout-button"
                title="Layouts"
                aria-controls={layoutMenuOpen ? "layout-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={layoutMenuOpen ? "true" : undefined}
                onClick={() => {
                  setLayoutMenuOpen(true);
                }}
              >
                <BoardSplit24Regular />
              </AppBarIconButton>
              <AppBarIconButton
                className={cx({ "Mui-selected": panelMenuOpen })}
                color="inherit"
                disabled={selectedLayoutId == undefined}
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
              <Stack direction="row" alignItems="center" paddingX={1.5}>
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
              <AppBarIconButton
                className={cx({ "Mui-selected": helpMenuOpen })}
                id="help-button"
                title="Help"
                aria-controls={helpMenuOpen ? "help-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={helpMenuOpen ? "true" : undefined}
                onClick={(event) => {
                  void analytics.logEvent(AppEvent.APP_BAR_CLICK_CTA, {
                    user: currentUserType,
                    cta: "help-menu",
                  });
                  setHelpAnchorEl(event.currentTarget);
                }}
              >
                <QuestionCircle24Regular />
              </AppBarIconButton>
              <AppBarIconButton
                id="preferences-button"
                title="Preferences"
                aria-controls={prefsDialogOpen ? "preferences-dialog" : undefined}
                aria-haspopup="true"
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
              </AppBarIconButton>
              {!disableSignIn &&
                supportsAccountSettings &&
                (currentUser ? (
                  <UserIconButton
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
                ))}
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
        anchorEl={layoutAnchorEl ?? undefined}
        open={layoutMenuOpen}
        handleClose={() => setLayoutMenuOpen(false)}
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
