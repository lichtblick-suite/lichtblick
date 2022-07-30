# Foxglove Studio Benchmarking

The benchmark runner is a customized build of Studio that runs a pre-configured workload while taking timing measurements to provide summary statistics from a repeatable process. Currently, a hardcoded layout is loaded and the user is expected to open a specific MCAP file from their local disk to start the benchmark. Playback automatically starts, and summary results are printed to the developer console when playback has completed. This process can be repeated several times to average the results and measure variance.

## Instructions

1. Run `yarn benchmark:serve` to start the benchmarking server
2. Open a browser and navigate to http://localhost:8080/
3. Drag and drop `nuScenes-v1.0-mini-scene-0061.mcap` onto Studio. The hardcoded layouts are specifically tailored for each file; testing a new file will require authoring a new layout and recompiling
4. Wait for playback to complete. In the developer console you will see summary statistics printed
5. Repeat steps 3-4 several times to average the results and measure variance

## Usage Notes

- The `benchmark:serve` command builds in development mode by default for iteration speed. If you want to test minified production code, change the command arguments in the root `package.json` file
- Performance numbers are only expected to be stable on a single machine running the same browser version in similar conditions. Benchmarking is not intended to provide stable results over a longer time span, but rather to provide a quick way to test new changes or bisect for performance regressions
- Measuring frame timing is limited by the vertical refresh rate of the target display (vsync). If the test data can be rendered at or near the vsync rate, it is not possible to measure small relative changes. This problem is known as right-censoring
- The benchmarking is tightly coupled with the browser rendering pipeline and GPU+display hardware. Running the benchmark in a headless environment or on an emulated GPU may not produce sensible results
- Resizing the browser window will affect the performance numbers as the canvas render target changes size
- Measuring frame-to-frame timing in JavaScript is only one lens on performance. Interaction response time can still be sluggish, the browser may not repaint at a consistently smooth rate, asynchronously loaded renderables can take longer before appearing on screen, etc
