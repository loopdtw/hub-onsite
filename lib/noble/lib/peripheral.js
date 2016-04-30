/*jshint loopfunc: true */
var debug = require('debug')('peripheral');

var events = require('events');
var util = require('util');

function Peripheral(noble, id, address, addressType, connectable, advertisement, rssi) {
  this._noble = noble;

  this.id = id;
  this.uuid = id; // for legacy
  this.address = address;
  this.addressType = addressType;
  this.connectable = connectable;
  this.advertisement = advertisement;
  this.rssi = rssi;
  this.services = null;
  this.state = 'disconnected';
}

util.inherits(Peripheral, events.EventEmitter);

Peripheral.prototype.toString = function() {
  return JSON.stringify({
    id: this.id,
    address: this.address,
    addressType: this.addressType,
    connectable: this.connectable,
    advertisement: this.advertisement,
    rssi: this.rssi,
    state: this.state
  });
};

Peripheral.prototype.connect = function(callback) {
  if (callback) {
    this.once('connect', function(error) {
      callback(error);
    });
  }

  if (this.state === 'connected') {
    this.emit('connect', new Error('Peripheral already connected'));
  } else {
    this.state = 'connecting';
    this._noble.connect(this.id);
  }
};

Peripheral.prototype.disconnect = function(callback) {
  if (callback) {
    this.once('disconnect', function() {
      callback(null);
    });
  }

  this.state = 'disconnecting';
  this._noble.disconnect(this.id);
};

Peripheral.prototype.updateRssi = function(callback) {
  if (callback) {
    this.once('rssiUpdate', function(rssi) {
      callback(null, rssi);
    });
  }

  this._noble.updateRssi(this.id);
};

Peripheral.prototype.discoverServices = function(uuids, callback) {
  var servicesDiscoverCallback = function(services) {
    this.removeListener('disconnect', disconnectCallback);
    callback(null, services);
  };

  var disconnectCallback = function() {
    this.removeListener('servicesDiscover', servicesDiscoverCallback);
    callback(new Error('peripheral disconnected'));
  }.bind(this);

  if (callback) {
    this.once('disconnect', disconnectCallback);
    this.once('servicesDiscover', servicesDiscoverCallback);
  }

  this._noble.discoverServices(this.id, uuids);
};

Peripheral.prototype.discoverSomeServicesAndCharacteristics = function(serviceUuids, characteristicsUuids, callback) {
  this.discoverServices(serviceUuids, function(err, services) {
    var numDiscovered = 0;
    var allCharacteristics = [];

    for (var i in services) {
      var service = services[i];

      service.discoverCharacteristics(characteristicsUuids, function(error, characteristics) {
        numDiscovered++;

        if (error === null) {
          for (var j in characteristics) {
            var characteristic = characteristics[j];

            allCharacteristics.push(characteristic);
          }
        }

        if (numDiscovered === services.length) {
          if (callback) {
            callback(null, services, allCharacteristics);
          }
        }
      }.bind(this));
    }
  }.bind(this));
};

Peripheral.prototype.discoverAllServicesAndCharacteristics = function(callback) {
  this.discoverSomeServicesAndCharacteristics([], [], callback);
};

Peripheral.prototype.readHandle = function(handle, callback) {
  if (callback) {
    this.once('handleRead' + handle, function(data) {
      callback(null, data);
    });
  }

  this._noble.readHandle(this.id, handle);
};

Peripheral.prototype.writeHandle = function(handle, data, withoutResponse, callback) {
  if (!(data instanceof Buffer)) {
    throw new Error('data must be a Buffer');
  }

  var handlerWriteCallback = function(services) {
    this.removeListener('disconnect', disconnectCallback);
    callback(null);
  };

  var disconnectCallback = function() {
    this.removeListener('handleWrite' + handle, handlerWriteCallback);
    callback(new Error('peripheral disconnected'));
  }.bind(this);

  if (callback) {
    this.once('disconnect', disconnectCallback);
    this.once('handleWrite' + handle, handlerWriteCallback);
  }

  // if (callback) {
  //   console.log('handleWrite' + handle);
  //   this.once('handleWrite' + handle, function() {
  //     callback(null);
  //   });
  // }
  this._noble.writeHandle(this.id, handle, data, withoutResponse);
};

module.exports = Peripheral;