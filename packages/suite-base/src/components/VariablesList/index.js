import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Button } from "@mui/material";
import * as _ from "lodash-es";
import { useMemo, useRef, useState, useEffect } from "react";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import Variable from "./Variable";
const ANIMATION_RESET_DELAY_MS = 1500;
export default function VariablesList() {
    const { globalVariables, setGlobalVariables } = useGlobalVariables();
    const globalVariableNames = useMemo(() => Object.keys(globalVariables), [globalVariables]);
    // Don't run the animation when the sidebar first renders
    const skipAnimation = useRef(true);
    const analytics = useAnalytics();
    useEffect(() => {
        const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
        return () => {
            clearTimeout(timeoutId);
        };
    }, []);
    const previousGlobalVariablesRef = useRef(globalVariables);
    const [changedVariables, setChangedVariables] = useState([]);
    useEffect(() => {
        if (skipAnimation.current) {
            previousGlobalVariablesRef.current = globalVariables;
            return;
        }
        const newChangedVariables = _.union(Object.keys(globalVariables), Object.keys(previousGlobalVariablesRef.current ?? {})).filter((name) => {
            const previousValue = previousGlobalVariablesRef.current?.[name];
            return previousValue !== globalVariables[name];
        });
        setChangedVariables(newChangedVariables);
        previousGlobalVariablesRef.current = globalVariables;
        const timerId = setTimeout(() => {
            setChangedVariables([]);
        }, ANIMATION_RESET_DELAY_MS);
        return () => {
            clearTimeout(timerId);
        };
    }, [globalVariables, skipAnimation]);
    return (_jsxs(Stack, { flex: "auto", fullWidth: true, overflowX: "auto", children: [globalVariableNames.map((name, idx) => (_jsx(Variable, { name: name, selected: !skipAnimation.current && changedVariables.includes(name), index: idx }, name))), _jsx(Stack, { direction: "row", padding: 1, children: _jsx(Button, { color: "inherit", fullWidth: true, "data-testid": "add-variable-button", variant: "contained", disabled: globalVariables[""] != undefined, onClick: () => {
                        setGlobalVariables({ "": '""' });
                        void analytics.logEvent(AppEvent.VARIABLE_ADD);
                    }, children: "Add variable" }, "add-global-variable") })] }));
}
