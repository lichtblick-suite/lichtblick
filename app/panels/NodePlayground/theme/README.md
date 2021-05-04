# MonacoEditor Themes

If you want to tweak the existing `vs-studio` theme, go to this [url](https://tmtheme-editor.herokuapp.com/#!/editor/theme/Monokai), and upload the `vs-studio.thmTheme` file.

From there, you will be able to apply various colors. After you're done editing, execute the following steps before opening a PR:

1. Download the `.tmTheme` file.
2. Overwrite the existing `.tmTheme` file in the Studio code base.
3. Go to this [site](https://bitwiser.in/monaco-themes/) and upload the `.tmFile`. It will convert it into the vs-code json definition of a theme.
4. Save the new json into the Studio code base.
5. Navigate to NodePlayground, profit.
