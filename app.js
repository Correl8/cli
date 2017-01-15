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
var c8 = correl8(adapter.types[0].name);
var types = adapter.types;

var lock = '/tmp/correl8-adapter-lock-' + adapter.sensorName; // make configurable?
lockFile.lock(lock, {}, function(er) {
  if (er) {
    console.error('Lockfile ' + lock + ' exists!');
      process.exit();
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
    var c8array = [];
    for (let i=0; i<types.length; i++) {
      c8array[i] = new correl8(type);
      c8array[i].type(types[i].name).clear().then(function(res) {
        console.log('Index for type ' + types[i].name + ' cleared.');
      }).catch(function(error) {
        console.trace(error);
      });
    }
  }
  else if (options['initialize']) {
    var c8array = [];
    for (let i=0; i<types.length; i++) {
      let type = types[i].name;
      let fields = types[i].fields;
      // console.log('Initializing ' + type + ' with ' + JSON.stringify(fields));
      // new c8 instance for each type for parallel async execution
      c8array[i] = new correl8(type);
      c8array[i].init(fields).then(function(res) {
        console.log('Index ' + type + ' initialized.');
      }).then(function(res) {
        // c8array[i].release();
      }).catch(function(error) {
        console.trace(error);
      });
    }
  }
  else {
    c8.isInitialized().then(function(result) {
      var initStatus = result;
      if (!result) {
        var msg = 'Initialize first! Run\n node ' + process.argv[1] +
          ' --adapter ' + options['adapter'] + ' --initialize'
        console.log(msg);
        // console.log('Usage: ');
        // console.log(noptUsage(knownOpts, shortHands, description));
        c8.release();
        process.exit();
      }
      return c8.config().then(function(res) {
        // console.log(res);
        var conf = c8.trimResults(res);
        var opts = {firstDate: firstDate, lastDate: lastDate};
        if (conf) {
          // console.log(adapter);
          var result = adapter.importData(c8, conf, opts);
          // we don't know if a promise is returned... :-(
          if (result && result.then && result.catch) {
            result.then(function() {
              console.log('Import succesful!');
            }).catch(function(error) {
              console.log('Import unsuccesful!');
              console.trace(error);
            });
          }
        }
        else {
          var msg = 'Configure first! Run\n node ' + process.argv[1] +
            ' --adapter ' + options['adapter'] + ' --settings';
          console.log(msg);
          // console.log('Usage: ');
          // console.log(noptUsage(knownOpts, shortHands, description));
          return c8.release();
        }
      });
    }).catch(function(error) {
      console.trace(error);
      return c8.release();
    });
  }
  lockFile.unlock(lock, function (er) {
    if (er) {
      console.error('Cannot release lockfile ' + lock + '!');
    }
  })
});
