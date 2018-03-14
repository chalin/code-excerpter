// Canonical path provides a consistent path (i.e. always forward slashes) across different OSes
var path = require('canonical-path');
var del = require('del');
var Dgeni = require('dgeni');
var fs = require('fs');
var _ = require('lodash');
var globby = require('globby');

module.exports = {
  _excerpt: _excerpt,
  excerpt: excerpt,
};

// Excerpt from all examples in exampleDir.
function _excerpt(options) {
  try {
    var pkg = createDgeniPackage(options);
    var dgeni = new Dgeni([pkg]);
    return dgeni.generate();
  } catch (err) {
    console.log(err);
    console.log(err.stack);
    throw err;
  }
}

function excerpt(options, fileDir) {
  if (!fileDir) return _excerpt(options);

  options = resolveOptions(options);
  var relativePath = path.relative(options.examplesDir, fileDir);
  options.examplesDir = path.resolve(options.examplesDir, relativePath);
  options.fragmentsDir = path.resolve(options.fragmentsDir, relativePath);
  // Should this package be attempting to clean out the fragments dir?
  return del(path.join(options.fragmentsDir, '**'))
    .then(function (paths) { return _excerpt(options); });
}

function createDgeniPackage(options) {
  var pkg = new Dgeni.Package('code-excerpter', [
    // require('dgeni-packages/base') - doesn't work
  ]);
  var options = resolveOptions(options);

  initializePackage(pkg)
    .factory(require('./regionFileReader'))
    .processor(require('./renderAsTextProcessor'))
    .config(function (readFilesProcessor, regionFileReader) {
      readFilesProcessor.fileReaders = [regionFileReader];
    })
    // default configs - may be overridden
    .config(function (log, readFilesProcessor) {
      log.level = options.logLevel;
      // Specify the base path used when resolving relative paths to source and output files
      readFilesProcessor.basePath = "/";

      // Specify collections of source files that should contain the documentation to extract
      var include;
      if (fs.lstatSync(options.examplesDir).isFile()) {
        include = options.examplesDir;
        log.info(`Excerpter: processing ${options.examplesDir}`);
      } else {
        include = options.extns.map(function (extn) {
          return options.includeSubdirs
            ? path.join(options.examplesDir, '**', extn)
            : path.join(options.examplesDir, extn);
        });

        // HACK ( next two lines) because the glob function that dgeni uses internally isn't good at removing 'node_modules' early
        // this just uses globby to 'preglob' the include files ( and  exclude the node_modules).
        include = globby.sync(include, { ignore: options.ignore });

        log.info(`Excerpter: processing ${options.examplesDir} (${include.length} files inside)`);
      }
      readFilesProcessor.sourceFiles = [{
        include: include,
        exclude: options.ignore,
        basePath: options.examplesDir
      }];
    })
    .config(function (writeFilesProcessor) {
      // Specify where the writeFilesProcessor will write our generated doc files
      writeFilesProcessor.outputFolder = path.resolve(options.fragmentsDir);
    });
  return pkg;
}

function resolveOptions(options) {
  options = _.defaults({}, options, {
    // read files from any subdir under here
    examplesDir: "_examples",

    // Array of string, of glob patterns of files to search for code excerpt markers
    extns: ['*.css', '*.dart', '*.html', '*.js', '*.json', '*.scss', '*.ts', '*.yaml', '*.yml',],

    // Excerpts get copied here with same subdir structure.
    fragmentsDir: "_fragments",

    // String, or array of string, of glob patterns of files to ignore
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/packages/**', '**/build/test/**', '**/build/web/**', '**/.*/**'],

    // Whether to process subdirectories
    includeSubdirs: true,

    logLevel: 'warn',
  });
  options.examplesDir = path.resolve(options.examplesDir);
  options.fragmentsDir = path.resolve(options.fragmentsDir);
  return options;
}

function initializePackage(pkg) {
  return pkg
    .processor(require('dgeni-packages/base/processors/read-files'))
    .processor(require('dgeni-packages/base/processors/write-files'))
    .factory(require('dgeni-packages/base/services/writeFile'))

    // Ugh... Boilerplate that dgeni needs to sequence operations
    .processor({ name: 'reading-files' })
    .processor({ name: 'files-read', $runAfter: ['reading-files'] })
    .processor({ name: 'processing-docs', $runAfter: ['files-read'] })
    .processor({ name: 'docs-processed', $runAfter: ['processing-docs'] })
    .processor({ name: 'adding-extra-docs', $runAfter: ['docs-processed'] })
    .processor({ name: 'extra-docs-added', $runAfter: ['adding-extra-docs'] })
    .processor({ name: 'computing-ids', $runAfter: ['extra-docs-added'] })
    .processor({ name: 'ids-computed', $runAfter: ['computing-ids'] })
    .processor({ name: 'computing-paths', $runAfter: ['ids-computed'] })
    .processor({ name: 'paths-computed', $runAfter: ['computing-paths'] })
    .processor({ name: 'rendering-docs', $runAfter: ['paths-computed'] })
    .processor({ name: 'docs-rendered', $runAfter: ['rendering-docs'] })
    .processor({ name: 'writing-files', $runAfter: ['docs-rendered'] })
    .processor({ name: 'files-written', $runAfter: ['writing-files'] })
}
