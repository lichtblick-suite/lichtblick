// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Static browser script of the interim HTML viewer (`htmlReport.ts`; its CSS is in
// `htmlReport.style.ts`). The script runs in the generated page (plain ES2017, no modules): it
// reads the embedded JSON block, registers a tiny phase-marker plugin on the inlined Chart.js UMD
// global and creates a run's charts the first time its <details> section is opened (the first one
// is open on load).

export const REPORT_CLIENT_JS = `
(function () {
  "use strict";
  var data = JSON.parse(document.getElementById("report-data").textContent);
  if (typeof Chart === "undefined") {
    document.querySelectorAll(".charts").forEach(function (el) {
      el.innerHTML = '<p class="error">Chart.js failed to load.</p>';
    });
    return;
  }
  var style = getComputedStyle(document.documentElement);
  function cssVar(name, fallback) {
    var value = style.getPropertyValue(name).trim();
    return value || fallback;
  }
  var PALETTE = [
    [31, 119, 180], [255, 127, 14], [44, 160, 44], [214, 39, 40], [148, 103, 189],
    [140, 86, 75], [227, 119, 194], [127, 127, 127], [188, 189, 34], [23, 190, 207]
  ];
  function color(index, alpha) {
    var rgb = PALETTE[index % PALETTE.length];
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
  }
  Chart.defaults.color = cssVar("--fg", "#1f2328");
  Chart.defaults.borderColor = cssVar("--grid", "rgba(110,118,129,0.2)");
  Chart.defaults.animation = false;
  var markerColor = cssVar("--marker", "#8250df");
  var failureColor = cssVar("--bad-fg", "#a40e26");

  // Vertical dashed lines with a rotated label for the run's phase events. Markers closer than
  // MARKER_GAP_PX share one label ("first (+n)"); the full list is printed under the charts.
  var MARKER_GAP_PX = 12;
  Chart.register({
    id: "phaseMarkers",
    afterDatasetsDraw: function (chart, _args, options) {
      var markers = (options && options.markers) || [];
      var x = chart.scales.x;
      var area = chart.chartArea;
      var ctx = chart.ctx;
      var visible = [];
      for (var i = 0; i < markers.length; i++) {
        var px = x.getPixelForValue(markers[i].x);
        if (isFinite(px) && px >= area.left && px <= area.right) {
          visible.push({ marker: markers[i], px: px });
        }
      }
      ctx.save();
      ctx.font = "10px sans-serif";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      var j = 0;
      while (j < visible.length) {
        var start = visible[j];
        var end = j + 1;
        while (end < visible.length && visible[end].px - start.px < MARKER_GAP_PX) {
          end++;
        }
        var failure = false;
        for (var k = j; k < end; k++) {
          var stroke = visible[k].marker.kind === "failure" ? failureColor : markerColor;
          failure = failure || visible[k].marker.kind === "failure";
          ctx.strokeStyle = stroke;
          ctx.beginPath();
          ctx.moveTo(visible[k].px, area.top);
          ctx.lineTo(visible[k].px, area.bottom);
          ctx.stroke();
        }
        var label = start.marker.label + (end - j > 1 ? " (+" + (end - j - 1) + ")" : "");
        ctx.save();
        ctx.fillStyle = failure ? failureColor : markerColor;
        ctx.translate(start.px + 3, area.top + 3);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
        j = end;
      }
      ctx.restore();
    }
  });

  function chartConfig(run, spec) {
    var hasSecondary = spec.datasets.some(function (d) { return d.secondary; });
    var stackIndex = 0;
    var datasets = spec.datasets.map(function (d, index) {
      var stacked = Boolean(d.stacked);
      var entry = {
        label: d.label,
        data: d.data,
        borderColor: color(index, 1),
        backgroundColor: color(index, stacked ? 0.35 : 0.8),
        borderWidth: 1.5,
        borderDash: d.dashed ? [6, 4] : [],
        pointRadius: d.data.length <= 60 ? 2 : 0,
        tension: 0,
        fill: stacked ? (stackIndex === 0 ? "origin" : "-1") : false,
        stack: stacked ? "stacked" : "line-" + index,
        yAxisID: d.secondary ? "y2" : "y"
      };
      if (stacked) {
        stackIndex++;
      }
      return entry;
    });
    var scales = {
      x: {
        type: "linear",
        min: run.chart.xMin,
        max: run.chart.xMax,
        title: { display: true, text: "s from " + run.chart.originLabel }
      },
      y: {
        stacked: Boolean(spec.stacked),
        beginAtZero: true,
        title: { display: true, text: spec.yLabel }
      }
    };
    if (hasSecondary) {
      scales.y2 = {
        position: "right",
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: spec.y2Label || "" }
      };
    }
    return {
      type: "line",
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        scales: scales,
        plugins: {
          title: { display: true, text: spec.title },
          legend: { position: "bottom", labels: { boxWidth: 12 } },
          phaseMarkers: { markers: run.chart.markers }
        }
      }
    };
  }

  var created = {};
  function createCharts(runIndex) {
    if (created[runIndex]) {
      return;
    }
    created[runIndex] = true;
    var run = data.runs[runIndex];
    var container = document.getElementById("charts-" + runIndex);
    if (!run || !container) {
      return;
    }
    if (run.chart.charts.length === 0) {
      container.innerHTML = '<p class="muted">No time series in this run.</p>';
      return;
    }
    run.chart.charts.forEach(function (spec) {
      var box = document.createElement("div");
      box.className = "chart";
      var canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", spec.title);
      box.appendChild(canvas);
      container.appendChild(box);
      new Chart(canvas, chartConfig(run, spec));
    });
  }

  document.querySelectorAll("details.run").forEach(function (details) {
    var runIndex = Number(details.getAttribute("data-run"));
    if (details.open) {
      createCharts(runIndex);
    }
    details.addEventListener("toggle", function () {
      if (details.open) {
        createCharts(runIndex);
      }
    });
  });

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id ? document.getElementById(id) : null;
    if (target && target.tagName === "DETAILS" && !target.open) {
      target.open = true;
      target.scrollIntoView();
    }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
`;
