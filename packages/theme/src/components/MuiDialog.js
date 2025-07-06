// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
export const MuiDialog = {
    defaultProps: {
        PaperProps: {
            elevation: 4,
        },
    },
    styleOverrides: {
        paper: ({ theme }) => ({
            // Prevent dialog from going underneath window title bar controls on Windows
            maxHeight: `calc(100% - 2 * (env(titlebar-area-height, ${theme.spacing(2)}) + ${theme.spacing(2)}))`,
        }),
    },
};
