// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { createContext, useContext, useEffect, useState } from "react";
export const RendererContext = createContext(undefined);
/**
 * React hook to retrieve the Renderer instance registered with the
 * RendererContext. This will always return undefined from the ThreeDeeRender()
 * component since the context exists below ThreeDeeRender().
 */
export function useRenderer() {
    const renderer = useContext(RendererContext);
    return renderer ?? undefined;
}
/**
 * React hook that subscribes to Renderer events. The optional
 * `rendererInstance` argument must be passed when calling from the
 * ThreeDeeRender() component which is above the RendererContext.
 * @param eventName Event name to subscribe to
 * @param listener Event callback
 * @param rendererInstance Optional Renderer instance to subscribe to instead of
 *   the reference returned by useRenderer()
 */
export function useRendererEvent(eventName, listener, rendererInstance) {
    const usedRenderer = useRenderer();
    const renderer = rendererInstance ?? usedRenderer;
    useEffect(() => {
        renderer?.addListener(eventName, listener);
        return () => void renderer?.removeListener(eventName, listener);
    }, [listener, eventName, renderer]);
}
/**
 * Returns a property from the Renderer instance. Updates when the event is called
 *
 * @param key - Property key to subscribe to
 * @param event - Event name that should trigger a re-render to read the property again
 * @param fallback - Fallback value to use if the property is not available or undefined
 * @param rendererInstance - Optional Renderer instance to subscribe to instead of the reference returned by useRenderer()
 * @returns - value of renderer property or fallback if undefined
 */
export function useRendererProperty(key, event, fallback, rendererInstance) {
    const usedRenderer = useRenderer();
    const renderer = rendererInstance ?? usedRenderer;
    const [value, setValue] = useState(() => renderer?.[key] ?? fallback());
    useEffect(() => {
        if (!renderer) {
            return;
        }
        const onChange = () => {
            setValue(() => renderer[key]);
        };
        onChange();
        renderer.addListener(event, onChange);
        return () => {
            renderer.removeListener(event, onChange);
        };
    }, [renderer, event, key]);
    return value;
}
