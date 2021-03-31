// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

/* eslint-disable no-underscore-dangle */
// From https://github.com/chartjs/Chart.js/issues/4895#issuecomment-341874938
export default function installMulticolorLineChart(Chart: any) {
  Chart.defaults.multicolorLine = Chart.defaults.scatter;
  Chart.controllers.multicolorLine = Chart.controllers.scatter.extend({
    draw(ease: any) {
      let startIndex = 0;
      const meta = this.getMeta();
      const points = meta.data || [];
      const colors = this.getDataset().colors;
      const area = this.chart.chartArea;
      const { multicolorLineYOffset } = this.chart.options.plugins || {};
      if (multicolorLineYOffset) {
        meta.dataset._children.forEach((data: any) => {
          if (!data._view.originalY) {
            data._view.originalY = data._view.y;
          }
          data._view.y = (data._view.originalY as number) + (multicolorLineYOffset as number);
        });
      }
      const originalDatasets = meta.dataset._children.filter((data: any) => {
        return !isNaN(data._view.y);
      });

      function setColor(newColor: any, { dataset }: any) {
        dataset._view.borderColor = newColor;
      }

      if (!colors) {
        Chart.controllers.scatter.prototype.draw.call(this, ease);
        return;
      }

      for (let i = 2; i <= colors.length; i++) {
        if (colors[i - 1] !== colors[i]) {
          setColor(colors[i - 1], meta);
          meta.dataset._children = originalDatasets.slice(startIndex, i);
          meta.dataset.draw();
          startIndex = i - 1;
        }
      }

      meta.dataset._children = originalDatasets.slice(startIndex);
      meta.dataset.draw();
      meta.dataset._children = originalDatasets;

      points.forEach((point: any) => {
        point.draw(area);
      });
    },
  });
}
