// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as THREE from "three";
import { RenderableLineAnnotation } from "./RenderableLineAnnotation";
import { RenderablePointsAnnotation } from "./RenderablePointsAnnotation";
import { RenderableTextAnnotation } from "./RenderableTextAnnotation";
/**
 * Holds renderables for all the 2D image annotations on a single topic.
 */
export class RenderableTopicAnnotations extends THREE.Object3D {
    #labelPool;
    #points = [];
    #lines = [];
    #texts = [];
    #scale = 0;
    #canvasWidth = 0;
    #canvasHeight = 0;
    #pixelRatio = 0;
    #scaleNeedsUpdate = false;
    #annotations = [];
    #annotationsNeedsUpdate = false;
    #cameraModel;
    #cameraModelNeedsUpdate = false;
    #originalMessage;
    #topicName;
    constructor(topicName, labelPool) {
        super();
        this.#labelPool = labelPool;
        this.#topicName = topicName;
    }
    dispose() {
        for (const points of this.#points) {
            points.dispose();
        }
        for (const lineList of this.#lines) {
            lineList.dispose();
        }
    }
    setScale(scale, canvasWidth, canvasHeight, pixelRatio) {
        this.#scaleNeedsUpdate ||= this.#scale !== scale;
        this.#scale = scale;
        this.#canvasWidth = canvasWidth;
        this.#canvasHeight = canvasHeight;
        this.#pixelRatio = pixelRatio;
    }
    setOriginalMessage(originalMessage) {
        this.#originalMessage = originalMessage;
    }
    setCameraModel(cameraModel) {
        this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
        this.#cameraModel = cameraModel;
    }
    setAnnotations(annotations) {
        this.#annotationsNeedsUpdate ||= this.#annotations !== annotations;
        this.#annotations = annotations;
    }
    update() {
        if (this.#scaleNeedsUpdate) {
            this.#scaleNeedsUpdate = false;
            for (const points of this.#points) {
                points.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
            }
            for (const lineList of this.#lines) {
                lineList.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
            }
            for (const text of this.#texts) {
                text.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
            }
        }
        if (this.#cameraModelNeedsUpdate) {
            this.#cameraModelNeedsUpdate = false;
            for (const points of this.#points) {
                points.setCameraModel(this.#cameraModel);
            }
            for (const lineList of this.#lines) {
                lineList.setCameraModel(this.#cameraModel);
            }
            for (const text of this.#texts) {
                text.setCameraModel(this.#cameraModel);
            }
        }
        const updateRenderables = () => {
            for (const points of this.#points) {
                points.update();
            }
            for (const lineList of this.#lines) {
                lineList.update();
            }
            for (const text of this.#texts) {
                text.update();
            }
        };
        if (!this.#annotationsNeedsUpdate) {
            updateRenderables();
            return;
        }
        this.#annotationsNeedsUpdate = false;
        // Reverse arrays so renderables are more likely to be reused for similarly-structured
        // annotations when using pop() below.
        const unusedPoints = this.#points.reverse();
        this.#points = [];
        const unusedLines = this.#lines.reverse();
        this.#lines = [];
        const unusedTexts = this.#texts.reverse();
        this.#texts = [];
        for (const annotation of this.#annotations) {
            switch (annotation.type) {
                case "circle": {
                    let line = unusedLines.pop();
                    if (!line) {
                        line = new RenderableLineAnnotation(this.#topicName);
                        line.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
                        line.setCameraModel(this.#cameraModel);
                        this.add(line);
                    }
                    this.#lines.push(line);
                    line.setAnnotationFromCircle(annotation, this.#originalMessage);
                    break;
                }
                case "points":
                    switch (annotation.style) {
                        case "points": {
                            let points = unusedPoints.pop();
                            if (!points) {
                                points = new RenderablePointsAnnotation(this.#topicName);
                                points.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
                                points.setCameraModel(this.#cameraModel);
                                this.add(points);
                            }
                            this.#points.push(points);
                            points.setAnnotation(annotation, this.#originalMessage);
                            break;
                        }
                        case "polygon":
                        case "line_strip":
                        case "line_list": {
                            let line = unusedLines.pop();
                            if (!line) {
                                line = new RenderableLineAnnotation(this.#topicName);
                                line.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
                                line.setCameraModel(this.#cameraModel);
                                this.add(line);
                            }
                            this.#lines.push(line);
                            line.setAnnotation(annotation, this.#originalMessage);
                            break;
                        }
                    }
                    break;
                case "text": {
                    let text = unusedTexts.pop();
                    if (!text) {
                        text = new RenderableTextAnnotation(this.#topicName, this.#labelPool);
                        text.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
                        text.setCameraModel(this.#cameraModel);
                        this.add(text);
                    }
                    this.#texts.push(text);
                    text.setAnnotation(annotation, this.#originalMessage);
                    break;
                }
            }
        }
        updateRenderables();
        for (const points of unusedPoints) {
            points.removeFromParent();
            points.dispose();
        }
        for (const lineList of unusedLines) {
            lineList.removeFromParent();
            lineList.dispose();
        }
        for (const text of unusedTexts) {
            text.removeFromParent();
            text.dispose();
        }
    }
}
