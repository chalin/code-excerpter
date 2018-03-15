# code-excerpter

A line-based utility for extracting code regions.

## Command line usage

`code-excerpter <examples-dir-base> <fragment-dir> [path-to-dir-or-file-to-excerpt-from]`

## API

```js
  var excerpter = require('code-excerpter');
  var options = { /* see below, but at a minimum: */
    examplesDir: 'path to base of folder from which excerpts are generated',
    fragmentsDir: 'path to base of folder where fragment files will be placed',
  };
  var fileOrDirToExcerptFrom = /* path to file or directory */;

  excerpter.excerpt(options, fileOrDirToExcerptFrom)
```

## Options and default values

```
    // Whether old fragments should be deleted before new ones are generated:
    clean: false,

    // Path to base directory containing files from which excerpts will be created:
    examplesDir: "_examples",

    // Array of string, of glob patterns of files to search for code excerpt markers:
    extns: ['*.css', '*.dart', '*.html', '*.js', '*.json', '*.scss', '*.ts', '*.yaml', '*.yml',],

    // Excerpts get copied here with same subdir structure:
    fragmentsDir: "_fragments",

    // String, or array of string, of glob patterns of files to ignor:
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/packages/**', '**/build/test/**', '**/build/web/**', '**/.*/**'],

    // Whether to process subdirectories under examplesDir:
    recursive: true,

    // Log level, one of 'debug', 'info', 'warn', or 'error':
    logLevel: 'warn',
```