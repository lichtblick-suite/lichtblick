# Foxglove Apt Repository

These are scripts to manage our apt repository (hosted at https://apt.foxglove.dev).

## How it works

- GitHub Actions runs [Aptly](https://www.aptly.info/) on every release.
- The generated repos are published to [foxglove/apt.foxglove.dev](https://github.com/foxglove/apt.foxglove.dev) and served by Github Pages at https://apt.foxglove.dev.
