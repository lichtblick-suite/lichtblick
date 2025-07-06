import { jsx as _jsx } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { useDrag, useDrop } from "react-dnd";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { TAB_DRAG_TYPE } from "@lichtblick/suite-base/panels/Tab/TabDndContext";
import { ToolbarTab } from "@lichtblick/suite-base/panels/Tab/ToolbarTab";
export function DraggableToolbarTab(props) {
    const { isActive, tabCount, actions, panelId, tabTitle, tabIndex } = props;
    const { moveTab } = useCurrentLayoutActions();
    const [{ isDragging }, connectDragRef] = useDrag({
        type: TAB_DRAG_TYPE,
        item: { panelId, tabIndex },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });
    const [{ highlight }, connectDropRef] = useDrop({
        accept: TAB_DRAG_TYPE,
        collect: (monitor) => ({
            highlight: monitor.isOver()
                ? monitor.getItem().tabIndex < tabIndex
                    ? "after"
                    : "before"
                : undefined,
        }),
        drop: (sourceItem, _monitor) => {
            const source = {
                panelId: sourceItem.panelId,
                tabIndex: sourceItem.tabIndex,
            };
            const target = { tabIndex, panelId };
            moveTab({ source, target });
        },
    });
    const tabProps = {
        tabTitle,
        tabIndex,
        isActive,
        tabCount,
        actions,
        isDragging,
        innerRef: (el) => {
            // hook inner tab ref to drag and drop
            connectDragRef(el);
            connectDropRef(el);
        },
        hidden: isDragging,
        highlight,
    };
    return _jsx(ToolbarTab, { ...tabProps });
}
