# Foxglove Studio Benchmarking

The benchmark runner is a customized build of Studio that runs a pre-configured workload while taking timing measurements to provide summary statistics from a repeatable process. Currently, a hardcoded layout is loaded and the user is expected to open a specific MCAP file from their local disk to start the benchmark. Playback automatically starts, and summary results are printed to the developer console when playback has completed. This process can be repeated several times to average the results and measure variance.

## Instructions

`yarn benchmark:serve` to start the benchmark app

See benchmarks.txt for a list of available benchmarks
