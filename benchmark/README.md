# Foxglove Studio Benchmarking

Benchmarks are specific combinations of layout and synthetic data playback. When a benchmark is opened, playback automatically starts and summary results are printed to the developer console.

## Instructions

Run a dev or prod build and open a benchmark URL from `benchmarks.txt`.

`yarn benchmark:serve` to start the benchmark dev build.

`yarn benchmark:build:prod` followed by `npx serve -p 8080 benchmark/.webpack`.
