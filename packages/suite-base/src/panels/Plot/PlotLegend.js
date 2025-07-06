import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { ChevronDown16Regular, ChevronUp16Regular, ChevronLeft16Regular, ChevronRight16Regular, TextBulletListLtr20Filled, ArrowMinimize20Filled, } from "@fluentui/react-icons";
import { IconButton } from "@mui/material";
import * as _ from "lodash-es";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";
import { DEFAULT_PLOT_PATH } from "@lichtblick/suite-base/panels/Plot/constants";
import { PlotLegendRow, ROW_HEIGHT } from "./PlotLegendRow";
const minLegendWidth = 25;
const maxLegendWidth = 800;
const useStyles = makeStyles()(({ palette, shadows, shape, spacing }, _params, classes) => ({
    root: {
        display: "flex",
        overflow: "hidden",
    },
    rootFloating: {
        pointerEvents: "none",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        position: "absolute",
        inset: "0 0 0 0",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        zIndex: 1000,
        gap: spacing(0.75),
        padding: spacing(1.5, 3.75, 4, 4.5),
        [`.${classes.grid}`]: {
            pointerEvents: "auto",
            flex: "0 1 auto",
            width: "max-content",
            maxHeight: "100%",
            borderRadius: shape.borderRadius,
            gridTemplateColumns: "auto repeat(2, minmax(max-content, auto)) auto",
            backgroundImage: `linear-gradient(${[
                "0deg",
                tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
                tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
            ].join(" ,")})`,
            backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
            backdropFilter: "blur(3px)",
            boxShadow: shadows[3],
        },
    },
    rootLeft: {
        alignItems: "flex-start",
        maxWidth: "80%",
        [`.${classes.toggleButton}`]: {
            padding: spacing(0.25),
            height: "100%",
            borderRadius: 0,
            borderTop: "none",
            borderBottom: "none",
        },
        [`.${classes.grid}`]: {
            overflow: "auto",
            height: "100%",
            alignContent: "flex-start",
        },
    },
    rootTop: {
        flexDirection: "column",
        maxHeight: "80%",
        [`.${classes.toggleButton}`]: {
            padding: spacing(0.25),
            borderRadius: 0,
            borderRight: "none",
            borderLeft: "none",
        },
    },
    grid: {
        alignItems: "center",
        display: "grid",
        gridTemplateColumns: "auto repeat(2, minmax(max-content, 1fr)) auto",
        gridAutoRows: ROW_HEIGHT,
        width: "100%",
        columnGap: 1,
        overflow: "auto",
        justifyItems: "flex-start",
    },
    dragHandle: {
        userSelect: "none",
        border: `0px solid ${palette.action.hover}`,
        "&:hover": {
            borderColor: palette.action.selected,
        },
    },
    toggleButton: {},
    toggleButtonFloating: {
        backdropFilter: "blur(3px)",
        pointerEvents: "auto",
        backgroundImage: `linear-gradient(${[
            "0deg",
            tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
            tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
        ].join(" ,")})`,
        backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
        boxShadow: shadows[3],
        "&:hover": {
            backgroundColor: palette.background.paper,
            backgroundImage: `linear-gradient(0deg, ${palette.action.hover}, ${palette.action.hover})`,
        },
    },
}));
const emptyPaths = [];
function PlotLegendComponent(props) {
    const { coordinator, legendDisplay, onClickPath, paths, saveConfig, showLegend, sidebarDimension, showValues, hoveredValuesBySeriesIndex, } = props;
    const { classes, cx } = useStyles();
    const dragStart = useRef({ x: 0, y: 0, sidebarDimension: 0 });
    const toggleLegend = useCallback(() => {
        saveConfig({ showLegend: !showLegend });
    }, [showLegend, saveConfig]);
    const legendIcon = useMemo(() => {
        switch (legendDisplay) {
            case "floating":
                return showLegend ? _jsx(ArrowMinimize20Filled, {}) : _jsx(TextBulletListLtr20Filled, {});
            case "left":
                return showLegend ? _jsx(ChevronLeft16Regular, {}) : _jsx(ChevronRight16Regular, {});
            case "top":
                return showLegend ? _jsx(ChevronUp16Regular, {}) : _jsx(ChevronDown16Regular, {});
        }
    }, [showLegend, legendDisplay]);
    const handlePointerMove = useCallback((event) => {
        if (legendDisplay === "floating" || event.buttons !== 1) {
            return;
        }
        const delta = legendDisplay === "left"
            ? event.clientX - dragStart.current.x
            : event.clientY - dragStart.current.y;
        const newDimension = _.clamp(dragStart.current.sidebarDimension + delta, minLegendWidth, maxLegendWidth);
        saveConfig({ sidebarDimension: newDimension });
    }, [legendDisplay, saveConfig]);
    const handlePointerDown = useCallback((event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = { x: event.clientX, y: event.clientY, sidebarDimension };
    }, [sidebarDimension]);
    const handlePointerUp = useCallback((event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);
    const savePaths = useCallback((newPaths) => {
        saveConfig({ paths: newPaths });
    }, [saveConfig]);
    const [pathsWithMismatchedDataLengths, setPathsWithMismatchedDataLengths] = useState(emptyPaths);
    useEffect(() => {
        if (!coordinator) {
            return;
        }
        const handler = (newPaths) => {
            setPathsWithMismatchedDataLengths(newPaths.slice());
        };
        coordinator.on("pathsWithMismatchedDataLengthsChanged", handler);
        return () => {
            coordinator.off("pathsWithMismatchedDataLengthsChanged", handler);
            setPathsWithMismatchedDataLengths(emptyPaths);
        };
    }, [coordinator]);
    const [currentValuesBySeriesIndex, setCurrentValuesBySeriesIndex] = useState();
    useEffect(() => {
        if (!coordinator || !showValues) {
            return;
        }
        const handler = (values) => {
            setCurrentValuesBySeriesIndex(values.slice());
        };
        coordinator.on("currentValuesChanged", handler);
        return () => {
            coordinator.off("currentValuesChanged", handler);
            setCurrentValuesBySeriesIndex(undefined);
        };
    }, [coordinator, showValues]);
    const valuesBySeriesIndex = hoveredValuesBySeriesIndex ?? currentValuesBySeriesIndex;
    const valueSource = hoveredValuesBySeriesIndex ? "hover" : "current";
    return (_jsxs("div", { className: cx(classes.root, {
            [classes.rootFloating]: legendDisplay === "floating",
            [classes.rootLeft]: legendDisplay === "left",
            [classes.rootTop]: legendDisplay === "top",
        }), children: [_jsx(IconButton, { size: "small", onClick: toggleLegend, className: cx(classes.toggleButton, {
                    [classes.toggleButtonFloating]: legendDisplay === "floating",
                }), children: legendIcon }), showLegend && (_jsx("div", { className: classes.grid, style: {
                    height: legendDisplay === "top" ? Math.round(sidebarDimension) : undefined,
                    width: legendDisplay === "left" ? Math.round(sidebarDimension) : undefined,
                }, children: (paths.length === 0 ? [DEFAULT_PLOT_PATH] : paths).map((path, index) => (_jsx(PlotLegendRow, { hasMismatchedDataLength: pathsWithMismatchedDataLengths.includes(path.value), index: index, onClickPath: () => {
                        onClickPath(index);
                    }, path: path, paths: paths, savePaths: savePaths, value: valuesBySeriesIndex?.[index], valueSource: valueSource }, index))) })), legendDisplay !== "floating" && (_jsx("div", { className: classes.dragHandle, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, style: legendDisplay === "left"
                    ? {
                        marginLeft: -6,
                        cursor: "ew-resize",
                        borderRightWidth: 2,
                        height: "100%",
                        width: 4,
                    }
                    : {
                        marginTop: -6,
                        cursor: "ns-resize",
                        borderBottomWidth: 2,
                        width: "100%",
                        height: 4,
                    } }))] }));
}
export const PlotLegend = React.memo(PlotLegendComponent);
