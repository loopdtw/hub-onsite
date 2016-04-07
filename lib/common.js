var exec = require('child_process').exec;
var request = require('request');
var logger = require('loopd-logger').logger;

// var redis = require('redis');
// var client = redis.createClient(); //creates a new client
// var logger = require('loopd-logger').logger;

// client.on('connect', function() {
// logger.info('redis connected');
// });

module.exports = {

	/*----------  INFORMATION METHODS  ----------*/

	getHostName: function(callback) {
		exec("hostname", function(error, stdout, stderror) {
			hostname = stdout.trim();
			console.log("hostname! " + hostname);
			callback(hostname, stderror);
		});
	},

	getVersion: function(callback) {
		var commandString = "";
		if (process.env.NODE_MACHINE == 'mac') {
			commandString = "uname -r";
		} else if (process.env.NODE_MACHINE == 'edison') {
			commandString = "configure_edison --version";
		}

		exec(commandString, function(error, stdout, stderror) {
			if (!error) {
				firmwareVersion = (stdout.trim() == '') ? 'not rpi' : stdout.trim();
				console.log("firmware! " + firmwareVersion);
				callback(firmwareVersion, stderror);;
			} else {
				callback(error);
			}
		});
	},

	getIpAddress: function(callback) {
		var commandString = "";
		commandString = "/sbin/ifconfig wlan0 | awk '{ print $2}' | grep -E -o \"([0-9]{1,3}[\.]){3}[0-9]{1,3}\"";
		if (process.env.NODE_MACHINE == 'mac') {
			commandString = "ipconfig getifaddr en0";
		}

		exec(commandString, function(error, stdout, stderror) {
			if (!error) {
				ipAddress = (stdout.trim() == '') ? 'no address' : stdout.trim();
				console.log("ipAddress! " + ipAddress);
				callback(ipAddress, stderror);
			} else {
				callback(error);
			}
		});
	},

	getSerialNumber: function(callback) {
		var commandString = "";
		if (process.env.NODE_MACHINE == 'rpi') {
			commandString = "cat /proc/cpuinfo | grep Serial | awk ' {print $3}'";
		} else if (process.env.NODE_MACHINE == 'edison') {
			commandString = "cat /factory/serial_number";
		} else if (process.env.NODE_MACHINE == 'mac') {
			commandString = "ioreg -l | awk '/IOPlatformSerialNumber/ { print $4;}'";
		}

		exec(commandString, function(error, stdout, stderror) {
			if (!error) {
				serialNumber = (stdout.trim() == '') ? 'no serial' : stdout.trim().replace(/\"/g, "");;
				console.log("serialNumber! " + serialNumber);
				callback(serialNumber, stderror);
			} else {
				callback(error);
			}
		});
	},

	getCpuTemp: function(callback) {
		var commandString = "";

		if (process.env.NODE_MACHINE == 'rpi') {
			commandString = "/usr/bin/vcgencmd measure_temp";
		}

		if (process.env.NODE_MACHINE == 'edison') {
			commandString = "cat /sys/class/thermal/thermal_zone3/temp";
		}

		exec(commandString, function(error, stdout, stderror) {
			if (!error) {
				cpuTemp = (stdout.trim() == '') ? 'no temp' : stdout.trim();
				if (process.env.NODE_MACHINE == 'edison') {
					cpuTemp = cpuTemp / 1000;
				}
				console.log("CPU Temp! " + cpuTemp);
				callback(cpuTemp, stderror);
			} else {
				cpuTemp = "N/A";
				console.log(error);
				callback(error);
			}
		});
	},

	getMetaData: function(serialNo, callback) {
		callback({
			hubId: null,
			hubEvent: null,
			hubEventId: null,
			hubInterestPoint: null,
			hubInterestPointId: null,
			hubPartner: null,
			hubPartnerId: null,
			gameObjectives: null
		});
	},

	/*----------  ARRAY METHODS  ----------*/
	arrayContains: function(needle, arrhaystack) {
		return (arrhaystack.indexOf(needle) > -1);
	},

	removeFromArray: function(needle, arrhaystack) {
		var index = arrhaystack.map(function(x) {
			return needle;
		}).indexOf(needle);
		arrhaystack.splice(index, 1);
	},

	removeIndexFromArray: function(index, arrhaystack) {
		arrhaystack.splice(index, 1);
	},

	objectExistsInArray: function(prop, value, arrhaystack) {
		arrhaystack.forEach(function(object) {
			if (object[prop] === value) {
				return true;
			}
		});

		return false;
	},

	findObjectInArray: function(prop, value, arrhaystack) {
		arrhaystack.forEach(function(object, index) {
			if (object[prop] === value) {
				return index;
			}
		});

		return -1;
	},

	findIndexByIdentityAndMac: function(identity, macAddress, arrayhaystack) {
		for (var i = 0; i < arrayhaystack.length; i += 1) {
			if (arrayhaystack[i]['macAddress'] === macAddress && arrayhaystack[i]['identity'] === identity) {
				return i;
			}
		}

		return -1;
	},

	/*----------  OBJECT BOOLEANS  ----------*/

	isEmptyObject: function(obj) {
		return !Object.keys(obj).length;
	},

	isJson: function(jsonString) {
		if (typeof jsonString !== 'undefined') {
			if (/^[\],:{}\s]*$/.test(jsonString.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
				//the json is ok
				return true;
			} else {
				//the json is not ok
				return false;
			}
		}
		return false;
	},

	/*----------  BITMATH  ----------*/

	convertBase: function(num) {
		return {
			from: function(baseFrom) {
				return {
					to: function(baseTo) {
						return parseInt(num, baseFrom).toString(baseTo);
					}
				}
			}
		}
	},

	hex2bin: function(num) {
		return this.convertBase(num).from(16).to(2);
	},

	isEmptyObject: function(obj) {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop))
				return false;
		}

		return true;
	}

	/*----------  Redis  ----------*/
	// saveToRedis: function(attendeeId, badgeId) {
	// 	logger.info("Adding " + "attendeeId:badgeId-" + badgeId);
	// 	client.sadd("attendeeId-" + attendeeId, "badgeId-" + badgeId);
	// },

	// elementExistsInRedis: function(attendeeId, badgeId, callback) {
	// 	client.sismember("attendeeId-" + attendeeId, "badgeId-" + badgeId, function(err, reply) {
	// 		logger.debug("Checking " + "attendeeId-" + attendeeId + ":badgeId-" + badgeId);
	// 		logger.debug(reply);
	// 		if (reply == 1) {
	// 			callback(true);
	// 		} else {
	// 			callback(false);
	// 		}
	// 	});
	// },

	// deleteElementFromRedis: function(attendeeId) {
	// 	client.del("attendeeId-" + attendeeId, function(err, reply) {
	// 		logger.info("Delete: " + reply);
	// 	});
	// },

	// clearRedis: function(attendeeId) {
	// 	logger.info('trying to delete redis');
	// 	client.del('event-' + eventId, function(err, reply) {
	// 		logger.info('Delete Success:' + reply);
	// 	});
	// }

}