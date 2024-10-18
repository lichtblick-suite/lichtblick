#!/bin/bash

# Clean and build TypeScript packages
tsc --build --clean packages/**/tsconfig.json

# Define the folders to be removed in an array
folders_to_remove=(
    ".webpack"
    "*/.webpack"
    "dist"
    "storybook-screenshots"
    "storybook-static"
    "coverage"
    "desktop/integration-test/coverage"
    "web/integration-test/coverage"
)

# Remove the folders
for folder in "${folders_to_remove[@]}"; do
    rimraf "$folder"
done

# Display completion message
echo "Build cleaned and folders removed successfully."
