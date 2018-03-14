// Canonical path provides a consistent path (i.e. always forward slashes) across different OSes
var path = require('canonical-path');
var del = require('del');
var Dgeni = require('dgeni');
var _ = require('lodash');
var globby = require('globby');
var ignoreDirs = ['**/node_modules/**', '**/dist/**', '**/build/packages/**', '**/build/test/**', '**/build/web/**', '**/.*/**'];

var _getLogLevel = function (options) { return options.logLevel || 'info'; }

var shred = function (shredOptions) {
  try {
    var pkg = createShredExamplePackage(shredOptions);
    var dgeni = new Dgeni([pkg]);
    return dgeni.generate();
  } catch (err) {
    console.log(err);
    console.log(err.stack);
    throw err;
  }
}

var shredSingleExampleDir = function (shredOptions, fileDir) {
  shredOptions = resolveShredOptions(shredOptions);
  var relativePath = path.relative(shredOptions.examplesDir, fileDir);
  var examplesDir = path.join(shredOptions.examplesDir, relativePath);
  var fragmentsDir = path.join(shredOptions.fragmentsDir, relativePath);
  var options = {
    includeSubdirs: true,
    examplesDir: examplesDir,
    fragmentsDir: fragmentsDir,
    logLevel: _getLogLevel(shredOptions)
  }
  var cleanPath = path.join(fragmentsDir, '*.*')
  return del([cleanPath, '!**/*.ovr.*']).then(function (paths) {
    // console.log('Deleted files/folders:\n', paths.join('\n'));
    return shred(options);
  });
}

var shredSingleDir = function (shredOptions, filePath) {
  shredOptions = resolveShredOptions(shredOptions);
  var fileDir = path.dirname(filePath);
  var relativePath = path.relative(shredOptions.examplesDir, fileDir);
  var examplesDir = path.join(shredOptions.examplesDir, relativePath);
  var fragmentsDir = path.join(shredOptions.fragmentsDir, relativePath);
  var options = {
    includeSubdirs: false,
    examplesDir: examplesDir,
    fragmentsDir: fragmentsDir,
    logLevel: _getLogLevel(shredOptions)
  }
  var cleanPath = path.join(fragmentsDir, '*.*')
  return del([cleanPath, '!**/*.ovr.*']).then(function (paths) {
    // console.log('Deleted files/folders:\n', paths.join('\n'));
    return shred(options);
  });
}

module.exports = {
  shred: shred,
  shredSingleExampleDir: shredSingleExampleDir,
  shredSingleDir: shredSingleDir,
};

function createShredExamplePackage(shredOptions) {
  var pkg = new Dgeni.Package('code-excerpter', [
    // require('dgeni-packages/base') - doesn't work
  ]);
  var options = resolveShredOptions(shredOptions);

  initializePackage(pkg)
    .factory(require('./regionFileReader'))
    .processor(require('./renderAsTextProcessor'))
    .config(function (readFilesProcessor, regionFileReader) {
      readFilesProcessor.fileReaders = [regionFileReader];
    })
    // default configs - may be overridden
    .config(function (log, readFilesProcessor) {
      log.level = _getLogLevel(shredOptions);
      // Specify the base path used when resolving relative paths to source and output files
      readFilesProcessor.basePath = "/";

      // Specify collections of source files that should contain the documentation to extract
      var extns = ['*.ts', '*.html', '*.js', '*.css', '*.json', '*.dart', '*.yaml', '*.yml', '*.es6'];
      var includeFiles = extns.map(function (extn) {
        if (options.includeSubdirs) {
          return path.join(options.examplesDir, '**', extn);
        } else {
          return path.join(options.examplesDir, extn);
        }
      });

      // HACK ( next two lines) because the glob function that dgeni uses internally isn't good at removing 'node_modules' early
      // this just uses globby to 'preglob' the include files ( and  exclude the node_modules).
      var includeFiles = globby.sync(includeFiles, { ignore: ignoreDirs });

      log.info(`Shredding ${includeFiles.length} files inside ${shredOptions.examplesDir}`);

      readFilesProcessor.sourceFiles = [{
        // Process all candidate files in `src` and its subfolders ...
        include: includeFiles,
        exclude: ['**/node_modules/**', '**/dist/**', '**/build/web/**', '**/.*/**'],
        // When calculating the relative path to these files use this as the base path.
        // So `src/foo/bar.js` will have relative path of `foo/bar.js`
        basePath: options.examplesDir
      }];
    })
    .config(function (writeFilesProcessor) {
      // Specify where the writeFilesProcessor will write our generated doc files
      writeFilesProcessor.outputFolder = path.resolve(options.fragmentsDir);
    });
  return pkg;
}

function resolveShredOptions(shredOptions) {
  var DOCS_FOLDER = '../../public/docs';
  var so = _.defaults({}, shredOptions, {
    // read files from any subdir under here
    examplesDir: path.join(DOCS_FOLDER, "_examples"),
    // shredded files get copied here with same subdir structure.
    fragmentsDir: path.join(DOCS_FOLDER, "_fragments"),
    // whether to include subdirectories when shredding.
    includeSubdirs: true
  });

  so.examplesDir = path.resolve(so.examplesDir);
  so.fragmentsDir = path.resolve(so.fragmentsDir);
  return so;
}

function resolveMapOptions(mapOptions) {
  var so = _.defaults({}, mapOptions, {
    includeSubdirs: true
  });
  so.jadeDir = path.resolve(so.jadeDir);
  so.devguideExamplesDir = path.resolve(so.devguideExamplesDir);
  so.apiExamplesDir = path.resolve(so.apiExamplesDir);
  so.fragmentsDir = path.resolve(so.fragmentsDir);
  return so;
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
