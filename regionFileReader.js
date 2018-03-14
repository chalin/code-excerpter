var regionExtractor = require('./regionExtractor');
var buildRegionDocs = regionExtractor.buildRegionDocs;

module.exports = function regionFileReader(log) {
  return {
    name: 'regionFileReader',

    getDocs: function (fileInfo) {
      // log.info("processing: " + fileInfo.relativePath);
      var docs = buildRegionDocs(fileInfo.content, fileInfo.extension);
      var wasProcessed = docs.some(function(doc) {
        return doc.regionName != null;
      });
      if (wasProcessed) {
        log.info("read file: " + fileInfo.relativePath);
      }
      return docs;
    }
  }
}

