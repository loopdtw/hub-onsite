var cluster = require('cluster');

global.Promise = require('bluebird');
global.Config = module.exports.config = require('nodejs-config')(
    // an absolute path to your applications `config` directory
    __dirname,
    function() {
        return process.env.NODE_ENV;
    }
);

if (cluster.isMaster) {
	global.app = require('./server.js');
} else {
    require('./lib/sync-manager.js');
}
