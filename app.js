var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var async = require('async');
var path = require('path');
var Common = require('./lib/common');
var request = require('request');
var logger = require('loopd-logger').logger;
var cors = require('cors');
var bodyParser = require('body-parser');
var routes = require('./routes/routes');
var config = module.exports.config = require('nodejs-config')(
    __dirname, // an absolute path to your applications `config` directory
    function() {
        return process.env.NODE_ENV;
    }
);

app.use(cors());
app.use(routes);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, './frontend/_public')));
app.use(express.static(path.join(__dirname, './frontend/html')));
app.disable('view cache');

var server = app.listen(3000, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('Listening at http://%s:%s', host, port);
    logger.info('Connecting to', config.get('app.url'));
});

module.exports = app;