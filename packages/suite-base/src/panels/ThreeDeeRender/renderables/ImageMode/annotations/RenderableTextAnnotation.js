// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { ANNOTATION_RENDER_ORDER } from "./annotationRenderOrder";
import { getAnnotationAtPath } from "./normalizeAnnotations";
import { Renderable } from "../../../Renderable";
import { SRGBToLinear, getLuminance } from "../../../color";
/**
 * Handles rendering of 2D text annotations.
 */
export class RenderableTextAnnotation extends Renderable {
    #labelPool;
    #label;
    #scale = 0;
    #scaleNeedsUpdate = false;
    #originalMessage;
    #annotation;
    #annotationNeedsUpdate = false;
    #cameraModel;
    #cameraModelNeedsUpdate = false;
    constructor(topicName, labelPool) {
        super(topicName, undefined, {
            receiveTime: 0n,
            messageTime: 0n,
            frameId: "",
            pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
            settingsPath: [],
            settings: { visible: true },
            topic: topicName,
        });
        this.#labelPool = labelPool;
        this.#label = labelPool.acquire();
        this.#label.mesh.renderOrder = ANNOTATION_RENDER_ORDER.TEXT;
        this.#label.setAnchorPoint(0, 0);
        this.#label.setBillboard(true);
        this.#label.setSizeAttenuation(false);
        this.add(this.#label);
    }
    dispose() {
        // reset render order back for label pool
        this.#label.mesh.renderOrder = 0;
        this.#labelPool.release(this.#label);
        super.dispose();
    }
    details() {
        if (this.#originalMessage && this.#annotation) {
            return {
                annotation: getAnnotationAtPath(this.#originalMessage, this.#annotation.messagePath),
                originalMessage: this.#originalMessage,
            };
        }
        return {};
    }
    setScale(scale, _canvasWidth, _canvasHeight, _pixelRatio) {
        this.#scaleNeedsUpdate ||= scale !== this.#scale;
        this.#scale = scale;
    }
    setCameraModel(cameraModel) {
        this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
        this.#cameraModel = cameraModel;
    }
    setAnnotation(annotation, originalMessage) {
        this.#annotationNeedsUpdate ||= this.#annotation !== annotation;
        this.#originalMessage = originalMessage;
        this.#annotation = annotation;
    }
    update() {
        if (!this.#annotation || !this.#cameraModel) {
            this.visible = false;
            return;
        }
        this.visible = true;
        const { position, text, textColor, backgroundColor, fontSize } = this.#annotation;
        // Update line width if thickness or scale has changed
        if (this.#annotationNeedsUpdate || this.#scaleNeedsUpdate) {
            this.#label.setLineHeight(fontSize * this.#scale);
            this.#scaleNeedsUpdate = false;
        }
        if (this.#annotationNeedsUpdate) {
            this.#label.setText(text);
            this.#label.setColor(SRGBToLinear(textColor.r), SRGBToLinear(textColor.g), SRGBToLinear(textColor.b), textColor.a);
            if (backgroundColor) {
                this.#label.setBackgroundColor(SRGBToLinear(backgroundColor.r), SRGBToLinear(backgroundColor.g), SRGBToLinear(backgroundColor.b), backgroundColor.a);
            }
            else {
                const foregroundIsDark = getLuminance(textColor.r, textColor.g, textColor.b) < 0.5;
                if (foregroundIsDark) {
                    this.#label.setBackgroundColor(1, 1, 1);
                }
                else {
                    this.#label.setBackgroundColor(0, 0, 0);
                }
            }
        }
        if (this.#annotationNeedsUpdate || this.#cameraModelNeedsUpdate) {
            this.#cameraModel.projectPixelTo3dPlane(this.#label.position, position);
        }
        this.#annotationNeedsUpdate = false;
        this.#cameraModelNeedsUpdate = false;
    }
}
