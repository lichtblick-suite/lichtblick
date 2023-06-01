// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { useEffect, useMemo, useRef } from "react";

import { normalizeAnnotations } from "./normalizeAnnotations";
import { renderImage } from "./renderImage";
import { useCompressedImage, cameraInfo, annotations, foxgloveAnnotations } from "../storySupport";

export default {
  title: "panels/Image/renderImage",
  parameters: {
    chromatic: {
      delay: 100,
    },
    colorScheme: "dark",
  },
};

export const MarkersWithHitmap: StoryObj = {
  render: function Story() {
    const imageMessage = useCompressedImage();
    const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
    const hitmapRef = useRef<HTMLCanvasElement>(ReactNull);

    const width = 400;
    const height = 300;

    useEffect(() => {
      if (!canvasRef.current || !hitmapRef.current) {
        return;
      }

      canvasRef.current.width = 2 * width;
      canvasRef.current.height = 2 * height;
      hitmapRef.current.width = 2 * width;
      hitmapRef.current.height = 2 * height;

      void renderImage({
        canvas: canvasRef.current,
        hitmapCanvas: hitmapRef.current,
        geometry: {
          flipHorizontal: false,
          flipVertical: false,
          panZoom: { x: 0, y: 0, scale: 1 },
          rotation: 0,
          viewport: { width, height },
          zoomMode: "fill",
        },
        imageMessage,
        rawMarkerData: {
          markers: annotations,
          cameraInfo,
          transformMarkers: true,
        },
      });
    }, [imageMessage]);

    return (
      <div style={{ backgroundColor: "white", padding: "1rem" }}>
        <canvas ref={canvasRef} style={{ width, height }} />
        <canvas ref={hitmapRef} style={{ width, height }} />
      </div>
    );
  },
};

export const MarkersWithRotations: StoryObj = {
  render: function Story() {
    const width = 300;
    const height = 200;
    const imageMessage = useCompressedImage();
    const canvasRefs = useRef<Array<HTMLCanvasElement | ReactNull>>([]);
    const geometries = useMemo(
      () => [
        { rotation: 0 },
        { rotation: 90 },
        { rotation: 180 },
        { rotation: 270 },
        { flipHorizontal: true },
        { flipVertical: true },
      ],
      [],
    );

    useEffect(() => {
      canvasRefs.current.forEach((canvas, i) => {
        if (!canvas) {
          return;
        }

        canvas.width = 2 * width;
        canvas.height = 2 * height;

        void renderImage({
          canvas,
          hitmapCanvas: undefined,
          geometry: {
            flipHorizontal: false,
            flipVertical: false,
            panZoom: { x: 0, y: 0, scale: 1 },
            rotation: 0,
            viewport: { width, height },
            zoomMode: "fill",
            ...geometries[i],
          },
          imageMessage,
          rawMarkerData: {
            markers: annotations,
            cameraInfo,
            transformMarkers: true,
          },
        });
      });
    }, [geometries, imageMessage]);

    return (
      <div>
        {geometries.map((r, i) => (
          <canvas
            key={JSON.stringify(r)}
            ref={(ref) => (canvasRefs.current[i] = ref)}
            style={{ width, height }}
          />
        ))}
      </div>
    );
  },
};

export const FoxgloveAnnotations: StoryObj = {
  render: function Story() {
    const imageMessage = useCompressedImage();
    const canvasRef = useRef<HTMLCanvasElement>(ReactNull);

    const width = 400;
    const height = 300;

    useEffect(() => {
      if (!canvasRef.current) {
        return;
      }

      canvasRef.current.width = 2 * width;
      canvasRef.current.height = 2 * height;

      void renderImage({
        canvas: canvasRef.current,
        hitmapCanvas: undefined,
        geometry: {
          flipHorizontal: false,
          flipVertical: false,
          panZoom: { x: 0, y: 0, scale: 1 },
          rotation: 0,
          viewport: { width, height },
          zoomMode: "fill",
        },
        imageMessage,
        rawMarkerData: {
          markers: normalizeAnnotations(foxgloveAnnotations, "foxglove.ImageAnnotations"),
          cameraInfo,
          transformMarkers: false,
        },
      });
    }, [imageMessage]);

    return (
      <div style={{ backgroundColor: "white", padding: "1rem" }}>
        <canvas ref={canvasRef} style={{ width, height }} />
      </div>
    );
  },
};
