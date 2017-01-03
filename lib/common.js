var exec = require('child_process').exec;
var request = require('request');
var logger = require('loopd-logger').logger;

/*----------  INFORMATION METHODS  ----------*/

exports.getHostName = function(callback) {
	exec("hostname", function(error, stdout, stderror) {
		hostname = stdout.trim();
		console.log("hostname! " + hostname);
		callback(hostname, stderror);
	});
};

exports.getVersion = function(callback) {
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
};

exports.getIpAddress = function(callback) {
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
};

exports.getSerialNumber = function(callback) {
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
};

exports.getCpuTemp = function(callback) {
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
};

exports.getMetaData = function(serialNo, callback) {
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
};

/*----------  ARRAY METHODS  ----------*/

exports.arrayContains = function(needle, arrhaystack) {
	return (arrhaystack.indexOf(needle) > -1);
};

exports.removeFromArray = function(needle, arrhaystack) {
	var index = arrhaystack.map(function(x) {
		return needle;
	}).indexOf(needle);
	arrhaystack.splice(index, 1);
};

exports.emoveIndexFromArray = function(index, arrhaystack) {
	arrhaystack.splice(index, 1);
};

exports.objectExistsInArray: function(prop, value, arrhaystack) {
	arrhaystack.forEach(function(object) {
		if (object[prop] === value) {
			return true;
		}
	});

	return false;
};

exports.findObjectInArray = function(prop, value, arrhaystack) {
	arrhaystack.forEach(function(object, index) {
		if (object[prop] === value) {
			return index;
		}
	});

	return -1;
};

exports.findIndexByIdentityAndMac = function(identity, macAddress, arrayhaystack) {
	for (var i = 0; i < arrayhaystack.length; i += 1) {
		if (arrayhaystack[i]['macAddress'] === macAddress && arrayhaystack[i]['identity'] === identity) {
			return i;
		}
	}

	return -1;
};

/*----------  OBJECT BOOLEANS  ----------*/

exports.isEmptyObject = function(obj) {
	return !Object.keys(obj).length;
};

exports.isJson = function(jsonString) {
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
};

/*----------  BITMATH  ----------*/

exports.convertBase = function(num) {
	return {
		from: function(baseFrom) {
			return {
				to: function(baseTo) {
					return parseInt(num, baseFrom).toString(baseTo);
				}
			}
		}
	}
};

exports.hex2bin = function(num) {
	return this.convertBase(num).from(16).to(2);
};

exports.isEmptyObject = function(obj) {
	for (var prop in obj) {
		if (obj.hasOwnProperty(prop))
			return false;
	}

	return true;
};

/*----------  ERROR HANLDING  ----------*/

exports.errorFormatter = function(errorString, httpCode, errorCode) {
    var error = new Error(errorString);
    if(errorCode > 0) error.errorCode = errorCode;
    error.statusCode = (typeof statusCode === 'number') ? statusCode : 400;
    return error;
};
