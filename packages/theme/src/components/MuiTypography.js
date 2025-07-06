// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
export const MuiTypography = {
    defaultProps: {
        // Remap typography variants to be <div> elements to
        // avoid triggering react's validateDOMNesting error
        variantMapping: {
            h1: "div",
            h2: "div",
            h3: "div",
            h4: "div",
            h5: "div",
            h6: "div",
            subtitle1: "div",
            subtitle2: "div",
            body1: "div",
            body2: "div",
            inherit: "div",
        },
    },
};
