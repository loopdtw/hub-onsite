global.Promise = require('bluebird');
global.Config = module.exports.config = require('nodejs-config')(
    // an absolute path to your applications `config` directory
    __dirname,
    function() {
        return process.env.NODE_ENV;
    }
);

var cluster = require('cluster');
var workerManager = require('./lib/worker-manager.js');

if (cluster.isMaster) {
	workerManager.initWorker();
} else {
	require('./server.js');
}
