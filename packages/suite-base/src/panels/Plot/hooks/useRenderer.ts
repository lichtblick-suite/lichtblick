// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Theme } from "@mui/material";
import { useEffect, useState } from "react";

import { OffscreenCanvasRenderer } from "../OffscreenCanvasRenderer";

const useRenderer = (
  canvasDiv: HTMLDivElement | ReactNull,
  theme: Theme,
): OffscreenCanvasRenderer | undefined => {
  const [renderer, setRenderer] = useState<OffscreenCanvasRenderer | undefined>(undefined);

  useEffect(() => {
    if (!canvasDiv) {
      return;
    }

    const clientRect = canvasDiv.getBoundingClientRect();

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "absolute";
    canvas.width = clientRect.width;
    canvas.height = clientRect.height;

    canvasDiv.appendChild(canvas);

    const offscreenCanvas = canvas.transferControlToOffscreen();

    // Mark canvas as ready after a short delay to improve LCP
    requestAnimationFrame(() => {
      canvas.setAttribute("data-ready", "true");
    });
    const newRenderer = new OffscreenCanvasRenderer(offscreenCanvas, theme);
    setRenderer(newRenderer);

    return () => {
      canvasDiv.removeChild(canvas);
      setRenderer(undefined);
    };
  }, [canvasDiv, theme]);

  return renderer;
};

export default useRenderer;
