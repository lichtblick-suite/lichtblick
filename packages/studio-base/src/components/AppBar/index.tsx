// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelRight24Filled, PanelRight24Regular } from "@fluentui/react-icons";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CloseIcon from "@mui/icons-material/Close";
import FilterNoneIcon from "@mui/icons-material/FilterNone";
import MinimizeIcon from "@mui/icons-material/Minimize";
import { AppBar as MuiAppBar, Button, IconButton, Toolbar } from "@mui/material";
import { useCallback, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { FoxgloveLogo } from "@foxglove/studio-base/components/FoxgloveLogo";
import { MemoryUseIndicator } from "@foxglove/studio-base/components/MemoryUseIndicator";
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

import { AddPanelIconButton, AddPanelMenu } from "./AddPanel";
import { DataSource } from "./DataSource";
import { HelpIconButton, HelpMenu } from "./Help";
import { PreferencesDialog, PreferencesIconButton } from "./Preferences";
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
        backgroundColor: APP_BAR_BACKGROUND_COLOR,
        borderBottom: `${theme.palette.divider} 1px solid`,
        color: APP_BAR_FOREGROUND_COLOR,
        height: APP_BAR_HEIGHT + 1 /*border*/,

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
      },
      logo: {
        padding: 0,
        fontSize: "2.125rem",
        color: APP_BAR_PRIMARY_COLOR,
      },
      start: {
        marginInlineStart: theme.spacing(-1),
        gridArea: "start",
        display: "flex",
        flex: 1,
        alignItems: "center",
        gap: theme.spacing(1),

        [theme.breakpoints.up("sm")]: {
          marginInlineStart: theme.spacing(-2),
        },
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
        marginInlineEnd: theme.spacing(-1),

        [theme.breakpoints.up("sm")]: {
          marginInlineEnd: theme.spacing(-2),
        },
      },
      endInner: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        ...NOT_DRAGGABLE_STYLE, // make buttons clickable for desktop app
      },
      button: {
        backgroundColor: APP_BAR_PRIMARY_COLOR,

        "&:hover": {
          backgroundColor: theme.palette.augmentColor({
            color: { main: APP_BAR_PRIMARY_COLOR },
          }).dark,
        },
      },
      iconButton: {
        padding: theme.spacing(0.375),
      },
      noDrag: {
        ...NOT_DRAGGABLE_STYLE, // make buttons clickable for desktop app
      },
      closeButton: {
        ":hover": {
          backgroundColor: theme.palette.error.main,
        },
      },
    };
  },
);

export type CustomWindowControlsProps = {
  showCustomWindowControls?: boolean;
  isMaximized?: boolean;
  onMinimizeWindow?: () => void;
  onMaximizeWindow?: () => void;
  onUnmaximizeWindow?: () => void;
  onCloseWindow?: () => void;
};

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
  const [prefsDialogOpen, setPrefsDialogOpen] = useState(false);

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
        <Toolbar variant="dense" className={classes.toolbar}>
          <div className={classes.start}>
            <IconButton className={cx(classes.logo, classes.noDrag)} size="large" color="inherit">
              <FoxgloveLogo fontSize="inherit" color="inherit" />
            </IconButton>
            {selectedLayoutId != undefined && (
              <AddPanelIconButton
                className={classes.iconButton}
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
              />
            )}
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
              <HelpIconButton
                className={classes.iconButton}
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
              />
              <PreferencesIconButton
                className={classes.iconButton}
                color="inherit"
                id="preferences-button"
                aria-label="Preferences dialog button"
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
              />
              {!disableSignIn &&
                supportsAccountSettings &&
                (currentUser ? (
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
        </Toolbar>
      </MuiAppBar>
      <AddPanelMenu
        anchorEl={panelAnchorEl}
        open={panelMenuOpen}
        handleClose={() => setPanelAnchorEl(undefined)}
      />
      <HelpMenu
        anchorEl={helpAnchorEl}
        open={helpMenuOpen}
        handleClose={() => setHelpAnchorEl(undefined)}
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

function CustomWindowControls({
  isMaximized = false,
  onMinimizeWindow,
  onMaximizeWindow,
  onUnmaximizeWindow,
  onCloseWindow,
}: Omit<CustomWindowControlsProps, "showCustomWindowControls">) {
  const { classes } = useStyles({});
  return (
    <>
      <IconButton
        size="small"
        color="inherit"
        onClick={onMinimizeWindow}
        data-testid="win-minimize"
      >
        <MinimizeIcon fontSize="inherit" color="inherit" />
      </IconButton>

      <IconButton
        size="small"
        color="inherit"
        onClick={isMaximized ? onUnmaximizeWindow : onMaximizeWindow}
        data-testid="win-maximize"
      >
        {isMaximized ? (
          <FilterNoneIcon fontSize="inherit" color="inherit" />
        ) : (
          <CheckBoxOutlineBlankIcon fontSize="inherit" color="inherit" />
        )}
      </IconButton>

      <IconButton
        className={classes.closeButton}
        size="small"
        color="inherit"
        onClick={onCloseWindow}
        data-testid="win-close"
      >
        <CloseIcon fontSize="inherit" color="inherit" />
      </IconButton>
    </>
  );
}
