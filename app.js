var async = require('async');
var path = require('path');
var Common = require('./lib/common');
var request = require('request');
var logger = require('loopd-logger').logger;
var cors = require('cors');
var bodyParser = require('body-parser');
// var MongoManager = require('./lib/mongo-manager');
// current supported checkIn provider
var CheckInProviders = ['boomset'];

var config = module.exports.config = require('nodejs-config')(
    __dirname, // an absolute path to your applications `config` directory
    function() {
        return process.env.NODE_ENV;
    }
);

var htmlPath = "./frontend/html/"
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var routes = require('./routes/routes');
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, './frontend/_public')));
app.use(express.static(path.join(__dirname, './frontend/html')));
app.disable('view cache');

app.get('/status', function(req,res) {
    res.send(200);
});

app.get('/', function(req, res) {
    res.sendFile('onsite/onsite.html', {"root": htmlPath});
});

app.get('/lookup', function(req, res) {
    res.sendFile('onsite/lookup.html', {"root": htmlPath});
});

app.get('/search', function(req, res) {
    res.sendFile('onsite/search.html', {"root": htmlPath});
});

var server = app.listen(3000, function() {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('Listening at http://%s:%s', host, port);
    logger.info('Connecting to', config.get('app.url'));
});

module.exports = app;
module.exports.server = server;
// module.exports.MongoManager = MongoManager;
module.exports.config = config;
require('./lib/sync-manager.js');