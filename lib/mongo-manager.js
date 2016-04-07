var MongoClient = require('mongodb').MongoClient;
var Promise = require('bluebird');
var logger = require('loopd-logger').logger;

// Connection URL
var url = 'mongodb://158.85.220.72:27017/sighting_records';
var mongoDb = null;

var MongoManager = {
	getMongoDb: function() {
		return new Promise(function(resolve, reject) {
			if (mongoDb) {
				resolve(mongoDb);
			} else {
				// Use connect method to connect to the Server
				MongoClient.connect(url, function(err, db) {
					if (!err) {
						logger.info("Connected correctly to server");
						mongoDb = db;
						resolve(mongoDb);
					} else {
						logger.error(err);
						reject(err);
					}
				});
			}
		});
	}
}

module.exports = MongoManager;