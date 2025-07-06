import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import MinusIcon from "@mui/icons-material/IndeterminateCheckBoxOutlined";
import { IconButton } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { sanitizeAccessorPath } from "./sanitizeAccessorPath";
const useStyles = makeStyles()((theme) => ({
    objectCell: {
        fontStyle: "italic",
        cursor: "pointer",
    },
    iconButton: {
        marginTop: theme.spacing(-0.5),
        marginLeft: theme.spacing(-0.5),
        "&:hover": {
            backgroundColor: "transparent",
        },
    },
}));
export default function TableCell({ row, accessorPath, children, }) {
    const { classes } = useStyles();
    const [isExpanded, setIsExpanded] = React.useState(false);
    const toggleIsExpanded = React.useCallback(() => {
        setIsExpanded((expanded) => !expanded);
    }, []);
    if (row.getIsExpanded() || isExpanded) {
        return (_jsxs("div", { children: [isExpanded && (_jsx(IconButton, { size: "small", onClick: toggleIsExpanded, className: classes.iconButton, children: _jsx(MinusIcon, { fontSize: "small" }) })), children] }));
    }
    return (_jsx("span", { className: classes.objectCell, "data-testid": `expand-cell-${sanitizeAccessorPath(accessorPath)}-${row.index}`, onClick: toggleIsExpanded, children: "Object" }));
}
