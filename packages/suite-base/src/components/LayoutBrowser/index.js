import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import AddIcon from "@mui/icons-material/Add";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import FileOpenOutlinedIcon from "@mui/icons-material/FileOpenOutlined";
import { CircularProgress, Divider, IconButton, List, ListItem, ListItemButton, ListItemText, } from "@mui/material";
import * as _ from "lodash-es";
import moment from "moment";
import { useSnackbar } from "notistack";
import { useEffect, useLayoutEffect, useMemo } from "react";
import useAsyncFn from "react-use/lib/useAsyncFn";
import { makeStyles } from "tss-react/mui";
import Logger from "@lichtblick/log";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import SignInPrompt from "@lichtblick/suite-base/components/LayoutBrowser/SignInPrompt";
import { SidebarContent } from "@lichtblick/suite-base/components/SidebarContent";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useCurrentLayoutSelector, } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@lichtblick/suite-base/context/CurrentUserContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import { useLayoutActions } from "@lichtblick/suite-base/hooks/useLayoutActions";
import { useLayoutNavigation } from "@lichtblick/suite-base/hooks/useLayoutNavigation";
import { useLayoutTransfer } from "@lichtblick/suite-base/hooks/useLayoutTransfer";
import { usePrompt } from "@lichtblick/suite-base/hooks/usePrompt";
import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import { layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";
import LayoutSection from "./LayoutSection";
const log = Logger.getLogger(__filename);
const selectedLayoutIdSelector = (state) => state.selectedLayout?.id;
const useStyles = makeStyles()((theme) => ({
    actionList: {
        paddingTop: theme.spacing(1),
    },
}));
export default function LayoutBrowser({ currentDateForStorybook, }) {
    const { classes } = useStyles();
    const { signIn } = useCurrentUser();
    const { enqueueSnackbar } = useSnackbar();
    const layoutManager = useLayoutManager();
    const [prompt, promptModal] = usePrompt();
    const analytics = useAnalytics();
    const currentLayoutId = useCurrentLayoutSelector(selectedLayoutIdSelector);
    const { onRenameLayout, onDuplicateLayout, onDeleteLayout, onRevertLayout, onOverwriteLayout, confirmModal, } = useLayoutActions();
    const { importLayout, exportLayout } = useLayoutTransfer();
    const { promptForUnsavedChanges, onSelectLayout, state, dispatch, unsavedChangesPrompt } = useLayoutNavigation();
    const onExportLayout = exportLayout;
    useLayoutEffect(() => {
        const busyListener = () => {
            dispatch({ type: "set-busy", value: layoutManager.isBusy });
        };
        const onlineListener = () => {
            dispatch({ type: "set-online", value: layoutManager.isOnline });
        };
        const errorListener = () => {
            dispatch({ type: "set-error", value: layoutManager.error });
        };
        busyListener();
        onlineListener();
        errorListener();
        layoutManager.on("busychange", busyListener);
        layoutManager.on("onlinechange", onlineListener);
        layoutManager.on("errorchange", errorListener);
        return () => {
            layoutManager.off("busychange", busyListener);
            layoutManager.off("onlinechange", onlineListener);
            layoutManager.off("errorchange", errorListener);
        };
    }, [dispatch, layoutManager]);
    const [layouts, reloadLayouts] = useAsyncFn(async () => {
        const [shared, personal] = _.partition(await layoutManager.getLayouts(), layoutManager.supportsSharing ? layoutIsShared : () => false);
        return {
            personal: personal.sort((a, b) => a.name.localeCompare(b.name)),
            shared: shared.sort((a, b) => a.name.localeCompare(b.name)),
        };
    }, [layoutManager], { loading: true });
    useEffect(() => {
        const processAction = async () => {
            if (!state.multiAction) {
                return;
            }
            const id = state.multiAction.ids[0];
            if (id) {
                try {
                    switch (state.multiAction.action) {
                        case "delete":
                            await layoutManager.deleteLayout({ id: id });
                            dispatch({ type: "shift-multi-action" });
                            break;
                        case "duplicate": {
                            const layout = await layoutManager.getLayout(id);
                            if (layout) {
                                await layoutManager.saveNewLayout({
                                    name: `${layout.name} copy`,
                                    data: layout.working?.data ?? layout.baseline.data,
                                    permission: "CREATOR_WRITE",
                                });
                            }
                            dispatch({ type: "shift-multi-action" });
                            break;
                        }
                        case "revert":
                            await layoutManager.revertLayout({ id: id });
                            dispatch({ type: "shift-multi-action" });
                            break;
                        case "save":
                            await layoutManager.overwriteLayout({ id: id });
                            dispatch({ type: "shift-multi-action" });
                            break;
                    }
                }
                catch (err) {
                    enqueueSnackbar(`Error processing layouts: ${err.message}`, {
                        variant: "error",
                    });
                    dispatch({ type: "clear-multi-action" });
                }
            }
        };
        processAction().catch((err) => {
            log.error(err);
        });
    }, [dispatch, enqueueSnackbar, layoutManager, state.multiAction]);
    useEffect(() => {
        const listener = () => void reloadLayouts();
        layoutManager.on("change", listener);
        return () => {
            layoutManager.off("change", listener);
        };
    }, [layoutManager, reloadLayouts]);
    // Start loading on first mount
    useEffect(() => {
        reloadLayouts().catch((err) => {
            log.error(err);
        });
    }, [reloadLayouts]);
    const createNewLayout = useCallbackWithToast(async () => {
        if (!(await promptForUnsavedChanges())) {
            return;
        }
        const name = `Unnamed layout ${moment(currentDateForStorybook).format("l")} at ${moment(currentDateForStorybook).format("LT")}`;
        const layoutData = {
            configById: {},
            globalVariables: {},
            userNodes: {},
            playbackConfig: defaultPlaybackConfig,
        };
        const newLayout = await layoutManager.saveNewLayout({
            name,
            data: layoutData,
            permission: "CREATOR_WRITE",
        });
        void onSelectLayout(newLayout);
        void analytics.logEvent(AppEvent.LAYOUT_CREATE);
    }, [promptForUnsavedChanges, currentDateForStorybook, layoutManager, onSelectLayout, analytics]);
    const onShareLayout = useCallbackWithToast(async (item) => {
        const name = await prompt({
            title: "Share a copy with your organization",
            subText: "Shared layouts can be used and changed by other members of your organization.",
            initialValue: item.name,
            label: "Layout name",
        });
        if (name != undefined) {
            const newLayout = await layoutManager.saveNewLayout({
                name,
                data: item.working?.data ?? item.baseline.data,
                permission: "ORG_WRITE",
            });
            void analytics.logEvent(AppEvent.LAYOUT_SHARE, { permission: item.permission });
            await onSelectLayout(newLayout);
        }
    }, [analytics, layoutManager, onSelectLayout, prompt]);
    const onMakePersonalCopy = useCallbackWithToast(async (item) => {
        const newLayout = await layoutManager.makePersonalCopy({
            id: item.id,
            name: `${item.name} copy`,
        });
        await onSelectLayout(newLayout);
        void analytics.logEvent(AppEvent.LAYOUT_MAKE_PERSONAL_COPY, {
            permission: item.permission,
            syncStatus: item.syncInfo?.status,
        });
    }, [analytics, layoutManager, onSelectLayout]);
    const [enableNewTopNav = true] = useAppConfigurationValue(AppSetting.ENABLE_NEW_TOPNAV);
    const [hideSignInPrompt = false, setHideSignInPrompt] = useAppConfigurationValue(AppSetting.HIDE_SIGN_IN_PROMPT);
    const showSignInPrompt = signIn != undefined && !layoutManager.supportsSharing && !hideSignInPrompt;
    const pendingMultiAction = state.multiAction?.ids != undefined;
    const anySelectedModifiedLayouts = useMemo(() => {
        return [layouts.value?.personal ?? [], layouts.value?.shared ?? []]
            .flat()
            .some((layout) => layout.working != undefined && state.selectedIds.includes(layout.id));
    }, [layouts, state.selectedIds]);
    return (_jsxs(SidebarContent, { title: "Layouts", disablePadding: true, disableToolbar: enableNewTopNav, trailingItems: [
            (layouts.loading || state.busy || pendingMultiAction) && (_jsx(Stack, { alignItems: "center", justifyContent: "center", padding: 1, children: _jsx(CircularProgress, { size: 18, variant: "indeterminate" }) }, "loading")),
            (!state.online || state.error != undefined) && (_jsx(IconButton, { color: "primary", disabled: true, title: "Offline", children: _jsx(CloudOffIcon, {}) }, "offline")),
            _jsx(IconButton, { color: "primary", onClick: createNewLayout, "aria-label": "Create new layout", "data-testid": "add-layout", title: "Create new layout", children: _jsx(AddIcon, {}) }, "add-layout"),
            _jsx(IconButton, { color: "primary", onClick: importLayout, "aria-label": "Import layout", title: "Import layout", children: _jsx(FileOpenOutlinedIcon, {}) }, "import-layout"),
        ].filter(Boolean), children: [promptModal, confirmModal, unsavedChangesPrompt, _jsxs(Stack, { fullHeight: true, gap: enableNewTopNav ? 1 : 2, style: { pointerEvents: pendingMultiAction ? "none" : "auto" }, children: [enableNewTopNav && (_jsxs(_Fragment, { children: [_jsxs(List, { className: classes.actionList, disablePadding: true, children: [_jsx(ListItem, { disablePadding: true, children: _jsx(ListItemButton, { onClick: createNewLayout, children: _jsx(ListItemText, { disableTypography: true, children: "Create new layout" }) }) }), _jsx(ListItem, { disablePadding: true, children: _jsx(ListItemButton, { onClick: importLayout, children: _jsx(ListItemText, { disableTypography: true, children: "Import from file\u2026" }) }) })] }), _jsx(Divider, { variant: "middle" })] })), _jsx(LayoutSection, { disablePadding: enableNewTopNav, title: layoutManager.supportsSharing ? "Personal" : undefined, emptyText: "Add a new layout to get started with Lichtblick!", items: layouts.value?.personal, anySelectedModifiedLayouts: anySelectedModifiedLayouts, multiSelectedIds: state.selectedIds, selectedId: currentLayoutId, onSelect: onSelectLayout, onRename: onRenameLayout, onDuplicate: onDuplicateLayout, onDelete: onDeleteLayout, onShare: onShareLayout, onExport: onExportLayout, onOverwrite: onOverwriteLayout, onRevert: onRevertLayout, onMakePersonalCopy: onMakePersonalCopy }), layoutManager.supportsSharing && (_jsx(LayoutSection, { disablePadding: enableNewTopNav, title: "Organization", emptyText: "Your organization doesn\u2019t have any shared layouts yet. Share a layout to collaborate with others.", items: layouts.value?.shared, anySelectedModifiedLayouts: anySelectedModifiedLayouts, multiSelectedIds: state.selectedIds, selectedId: currentLayoutId, onSelect: onSelectLayout, onRename: onRenameLayout, onDuplicate: onDuplicateLayout, onDelete: onDeleteLayout, onShare: onShareLayout, onExport: onExportLayout, onOverwrite: onOverwriteLayout, onRevert: onRevertLayout, onMakePersonalCopy: onMakePersonalCopy })), !enableNewTopNav && _jsx(Stack, { flexGrow: 1 }), showSignInPrompt && _jsx(SignInPrompt, { onDismiss: () => void setHideSignInPrompt(true) })] })] }));
}
