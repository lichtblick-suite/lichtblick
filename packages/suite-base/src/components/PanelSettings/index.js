import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Divider, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUnmount } from "react-use";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useConfigById } from "@lichtblick/suite-base/PanelAPI";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { ActionMenu } from "@lichtblick/suite-base/components/PanelSettings/ActionMenu";
import { EmptyWrapper } from "@lichtblick/suite-base/components/PanelSettings/EmptyWrapper";
import { buildSettingsTree } from "@lichtblick/suite-base/components/PanelSettings/settingsTree";
import SettingsTreeEditor from "@lichtblick/suite-base/components/SettingsTreeEditor";
import { ShareJsonModal } from "@lichtblick/suite-base/components/ShareJsonModal";
import { SidebarContent } from "@lichtblick/suite-base/components/SidebarContent";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useCurrentLayoutActions, useCurrentLayoutSelector, useSelectedPanels, } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@lichtblick/suite-base/context/PanelCatalogContext";
import { usePanelStateStore, } from "@lichtblick/suite-base/context/PanelStateContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import { TAB_PANEL_TYPE } from "@lichtblick/suite-base/util/globalConstants";
import { getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";
const singlePanelIdSelector = (state) => typeof state.selectedLayout?.data?.layout === "string"
    ? state.selectedLayout.data.layout
    : undefined;
const selectIncrementSequenceNumber = (store) => store.incrementSequenceNumber;
const EMPTY_SETTINGS_TREE = Object.freeze({
    actionHandler: () => undefined,
    nodes: {},
});
export default function PanelSettings({ disableToolbar = false, selectedPanelIdsForTests, }) {
    const { t } = useTranslation("panelSettings");
    const singlePanelId = useCurrentLayoutSelector(singlePanelIdSelector);
    const { selectedPanelIds: originalSelectedPanelIds, setSelectedPanelIds, selectAllPanels, } = useSelectedPanels();
    const selectedPanelIds = selectedPanelIdsForTests ?? originalSelectedPanelIds;
    const [enableNewTopNav = true] = useAppConfigurationValue(AppSetting.ENABLE_NEW_TOPNAV);
    // If no panel is selected and there is only one panel in the layout, select it
    useEffect(() => {
        if (selectedPanelIds.length === 0 && singlePanelId != undefined) {
            selectAllPanels();
        }
    }, [selectAllPanels, selectedPanelIds, singlePanelId]);
    const selectedPanelId = useMemo(() => (selectedPanelIds.length === 1 ? selectedPanelIds[0] : undefined), [selectedPanelIds]);
    // Automatically deselect the panel we were editing when the settings sidebar closes
    useUnmount(() => {
        if (selectedPanelId != undefined) {
            setSelectedPanelIds([]);
        }
    });
    const panelCatalog = usePanelCatalog();
    const { getCurrentLayoutState: getCurrentLayout, savePanelConfigs } = useCurrentLayoutActions();
    const panelType = useMemo(() => (selectedPanelId != undefined ? getPanelTypeFromId(selectedPanelId) : undefined), [selectedPanelId]);
    const panelInfo = useMemo(() => (panelType != undefined ? panelCatalog.getPanelByType(panelType) : undefined), [panelCatalog, panelType]);
    const incrementSequenceNumber = usePanelStateStore(selectIncrementSequenceNumber);
    const [showShareModal, setShowShareModal] = useState(false);
    const shareModal = useMemo(() => {
        const panelConfigById = getCurrentLayout().selectedLayout?.data?.configById;
        if (selectedPanelId == undefined || !showShareModal || !panelConfigById) {
            return ReactNull;
        }
        return (_jsx(ShareJsonModal, { onRequestClose: () => {
                setShowShareModal(false);
            }, initialValue: panelConfigById[selectedPanelId] ?? {}, onChange: (config) => {
                savePanelConfigs({
                    configs: [{ id: selectedPanelId, config: config, override: true }],
                });
                incrementSequenceNumber(selectedPanelId);
            }, title: t("importOrExportSettings") }));
    }, [
        getCurrentLayout,
        selectedPanelId,
        showShareModal,
        savePanelConfigs,
        incrementSequenceNumber,
        t,
    ]);
    const [config, , extensionSettings] = useConfigById(selectedPanelId);
    const messagePipelineState = useMessagePipelineGetter();
    const storedSettingsTrees = usePanelStateStore(({ settingsTrees }) => settingsTrees);
    const settingsTree = useMemo(() => buildSettingsTree({
        config,
        extensionSettings,
        messagePipelineState,
        panelType,
        selectedPanelId,
        settingsTrees: storedSettingsTrees,
    }), [
        config,
        extensionSettings,
        messagePipelineState,
        panelType,
        selectedPanelId,
        /**
         * The core issue is that settingsTrees object in the PanelStateStore is being
         * mutated on each render, leading to unnecessary calls to buildSettingsTree
         * To address this, we need to ensure that settingsTrees remains
         * referentially stable unless its actual content changes.
         */
        storedSettingsTrees,
    ]);
    const resetToDefaults = useCallback(() => {
        if (selectedPanelId) {
            savePanelConfigs({
                configs: [{ id: selectedPanelId, config: {}, override: true }],
            });
            incrementSequenceNumber(selectedPanelId);
        }
    }, [incrementSequenceNumber, savePanelConfigs, selectedPanelId]);
    if (selectedPanelId == undefined) {
        return _jsx(EmptyWrapper, { enableNewTopNav: true, children: t("selectAPanelToEditItsSettings") });
    }
    if (!config) {
        return _jsx(EmptyWrapper, { enableNewTopNav: true, children: t("loadingPanelSettings") });
    }
    const showTitleField = panelInfo != undefined && panelInfo.hasCustomToolbar !== true;
    const title = panelInfo?.title ?? t("unknown");
    const isSettingTreeDefined = settingsTree != undefined;
    return (_jsxs(SidebarContent, { disablePadding: enableNewTopNav || isSettingTreeDefined, disableToolbar: disableToolbar, title: t("currentSettingsPanelName", { title }), trailingItems: [
            _jsx(ActionMenu, { allowShare: panelType !== TAB_PANEL_TYPE, onReset: resetToDefaults, onShare: () => {
                    setShowShareModal(true);
                } }, 1),
        ], children: [shareModal, _jsx(Stack, { gap: 2, justifyContent: "flex-start", flex: "auto", children: _jsxs(Stack, { flex: "auto", children: [settingsTree && enableNewTopNav && (_jsxs(_Fragment, { children: [_jsxs(Stack, { paddingLeft: 0.75, direction: "row", alignItems: "center", justifyContent: "space-between", children: [_jsx(Typography, { variant: "subtitle2", children: t("panelName", { title }) }), _jsx(ActionMenu, { fontSize: "small", allowShare: panelType !== TAB_PANEL_TYPE, onReset: resetToDefaults, onShare: () => {
                                                setShowShareModal(true);
                                            } }, 1)] }), _jsx(Divider, {})] })), settingsTree || showTitleField ? (_jsx(SettingsTreeEditor, { settings: settingsTree ?? EMPTY_SETTINGS_TREE, variant: "panel" }, selectedPanelId)) : (_jsx(Stack, { flex: "auto", alignItems: "center", justifyContent: "center", paddingX: enableNewTopNav ? 1 : 0, children: _jsx(Typography, { variant: "body2", color: "text.secondary", align: "center", children: t("panelDoesNotHaveSettings") }) }))] }) })] }));
}
