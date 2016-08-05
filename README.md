Command Line Interface for Correl8.me
=====================================

A CLI Interface to run Correl8 adapters.

Usage
-----

Install this package:

    npm install correl8-cgi

Install the adapters you want, e.g.

    npm install correl8-nordpool-adapter

Run app.js with the `--adapter` flag specifying the adapter. For example,

    node app.js --adapter correl8-nordpool-adapter --configure
    node app.js --adapter correl8-nordpool-adapter --initialize
    node app.js --adapter correl8-nordpool-adapter --from 2014-01-01
    node app.js --adapter correl8-nordpool-adapter
