// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Side-effect module: must be the first import of the entry point so the hook exists before react-dom loads.
import { install } from "./reactRenderStats";

if (new URL(window.location.href).searchParams.get("renderStats") === "1") {
  install();
}
