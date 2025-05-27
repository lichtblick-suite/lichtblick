# Lichtblick Documentation Project

This README explains the structure and purpose of the Lichtblick documentation.

## Documentation Structure

The Lichtblick documentation is organized as follows:

- `index.md` - Main entry point and overview
- `getting-started.md` - Installation and initial setup
- `architecture.md` - Technical architecture and design
- `features.md` - List of features and capabilities
- `user-guide.md` - Detailed usage instructions
- `developer-guide.md` - Guide for developers and contributors
- `adding-filters.md` - Special guide for the filter feature
- `faq.md` - Frequently asked questions
- `/api/index.md` - API documentation for developers
- `/puml/` - Source files for PlantUML diagrams
- `/images/` - Generated diagrams and screenshots

## Writing Style

The documentation follows these style guidelines:

1. **Clear and concise**: Use simple language and short sentences
2. **Task-oriented**: Focus on helping users accomplish specific tasks
3. **Progressive disclosure**: Start with basic concepts and gradually introduce more complex topics
4. **Consistent terminology**: Use the same terms consistently throughout the documentation

## Diagrams

Diagrams are created using PlantUML. The source files are in the `/puml/` directory, and the generated images are in the `/images/` directory.

To update a diagram:

1. Edit the `.puml` file in the `/puml/` directory
2. Generate the image using PlantUML: `plantuml -tpng docs/puml/diagram.puml -o ../docs/images`
3. Reference the image in the relevant Markdown file

## Screenshots

Screenshots are stored in the `/images/` directory. When adding screenshots:

1. Capture the relevant part of the UI
2. Use a consistent resolution and aspect ratio
3. Annotate if necessary to highlight important features
4. Compress images to reduce file size

## API Documentation

The API documentation is generated from code comments and manually written content in the `/api/` directory. It follows these principles:

1. Document all public APIs
2. Include examples for common use cases
3. Describe parameters, return values, and error conditions
4. Provide context for how the API fits into the larger system

## Contributing to Documentation

To contribute to the documentation:

1. Follow the existing structure and style
2. Test any provided examples or instructions
3. Submit updates through the normal GitHub pull request process
4. Ensure links to other documentation sections are correct

## Publishing

The documentation is published on GitHub Pages through the repository. Updates to the documentation are automatically published when merged into the main branch.
