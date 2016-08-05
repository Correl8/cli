var correl8 = require("correl8");
var fs = require('fs');
var lockFile = require('lockfile');
var nopt = require('nopt');
var noptUsage = require("nopt-usage");
var path = require('path');
var prompt = require('prompt');

var knownOpts = {
  'adapter': [String],
  'settings': Boolean,
  'help': Boolean,
  'initialize': Boolean,
  'clear': Boolean,
  'from': Date,
  'to': Date
},
shortHands = {
  'h': ['--help'],
  'i': ['--initialize'],
  'c': ['--clear'],
  'u': ['--url'],
  'f': ['--from'],
  's': ['--settings'],
  't': ['--to']
},
description = {
  'adapter': ' Name of the adapter to use (required)',
  'settings': ' Configure adapter and exit',
  'help': ' Display this usage text and exit',
  'init': ' Create the index and exit',
  'clear': ' Clear all data in the index',
  'from': ' Start date as YYYY-MM-DD',
  'to': ' End date as YYYY-MM-DD'
},
options = nopt(knownOpts, shortHands, process.argv, 2);
if (!options['adapter']) {
  console.error('Required parameter missing: adapter');
}
var firstDate = options['from'] || null;
var lastDate = options['to'] || null;
var adapter = require(options['adapter']);
var c8 = correl8(adapter.sensorName);
var types = adapter.types;

var lock = '/tmp/correl8-adapter-lock-' + adapter; // make configurable?
lockFile.lock(lock, {}, function(er) {
  if (er) {
    c8.release();
    console.error('Lockfile ' + lock + ' exists!');
    process.exit;
  }
  if (options['help']) {
    console.log('Usage: ');
    console.log(noptUsage(knownOpts, shortHands, description));
  }
  else if (options['settings']) {
    c8.config().then(function(res) {
      var conf = c8.trimResults(res);
      for (prop in adapter.promptProps.properties) {
        if (conf[prop]) {
          adapter.promptProps.properties[prop].default = conf[prop];
        }
      }
      prompt.start();
      prompt.message = '';
      prompt.get(adapter.promptProps, function (err, result) {
        if (err) {
          console.trace(err);
        }
        else {
          // console.log(c8.config);
          adapter.storeConfig(c8, result);
        }
      });
    })
  }
  else if (options['clear']) {
    for (var i=0; i<types.length; i++) {
      c8.type(types[i].name).clear().then(function(res) {
        console.log('Index for type ' + types[i] + ' cleared.');
      }).catch(function(error) {
        console.trace(error);
        c8.release();
      });
    }
  }
  else if (options['initialize']) {
    for (var i=0; i<types.length; i++) {
      var type = types[i];
      var fields = type.fields;
      // console.log('Initializing ' + type.name + ' with ' + JSON.stringify(fields));
      c8.type(type.name).init(fields).then(function(res) {
        // console.log('Index initialized.');
      }).catch(function(error) {
        console.trace(error);
        c8.release();
      });
    }
  }
  else {
    c8.isInitialized().then(function() {
      c8.config().then(function(res) {
        // console.log(res);
        var conf = c8.trimResults(res);
        var opts = {firstDate: firstDate, lastDate: lastDate};
        if (conf) {
          // console.log(adapter);
          adapter.importData(c8, conf, opts).then(function() {
            console.log('Import succesful!');
          }).catch(function(error) {
            console.log('Import unsuccesful!');
            console.trace(error);
          });
        }
        else {
          var msg = 'Configure first! Run\n node ' + process.argv[1] +
            ' --adapter ' + options['adapter'] + ' --settings'
          console.log(msg);
          // console.log('Usage: ');
          // console.log(noptUsage(knownOpts, shortHands, description));
          c8.release();
        }
      });
    }).catch(function(error) {
      console.trace(error);
      c8.release();
    });
  }
  lockFile.unlock(lock, function (er) {
    if (er) {
      console.error('Cannot release lockfile ' + lock + '!');
    }
  })
});
