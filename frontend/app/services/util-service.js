angular.module('HubApp')
	.factory('utilService', function() {
		var util = {};

		/*----------  ARRAY METHODS  ----------*/
		var arrayContains = function(needle, arrhaystack) {
			return (arrhaystack.indexOf(needle) > -1);
		}

		var removeFromArray = function(needle, arrhaystack) {
			var index = arrhaystack.map(function(x) {
				return needle;
			}).indexOf(needle);
			arrhaystack.splice(index, 1);
		}

		var objectExistsInArray = function(prop, value, arrhaystack) {
			arrhaystack.forEach(function(object) {
				if (object[prop] === value) {
					return true;
				}
			});

			return false;
		}

		var findObjectInArray = function(prop, value, arrhaystack) {
			arrhaystack.forEach(function(object, index) {
				if (object[prop] === value) {
					return index;
				}
			});

			return -1;
		}

		var findIndexByIdentityAndMac = function(identity, macAddress, arrayhaystack) {
			for (var i = 0; i < arrayhaystack.length; i += 1) {
				if (arrayhaystack[i]['macAddress'] === macAddress && arrayhaystack[i]['identity'] === identity) {
					return i;
				}
			}

			return -1;
		}

		var getSortedArrayFromObject = function(property, object, reverse) {
			return Object.keys(object).sort(function(a, b) {
				var aProp = (typeof object[a][property] === 'undefined' || object[a][property] === null) ? 0 : object[a][property];
				var bProp = (typeof object[b][property] === 'undefined' || object[b][property] === null) ? 0 : object[b][property];

				if (reverse) {
					return bProp - aProp;
				} else {
					return aProp - bProp;
				}
			});
		}

		util.arrayContains = arrayContains;
		util.removeFromArray = removeFromArray;
		util.objectExistsInArray = objectExistsInArray;
		util.findObjectInArray = findObjectInArray;
		util.findIndexByIdentityAndMac = findIndexByIdentityAndMac;
		util.getSortedArrayFromObject = getSortedArrayFromObject;

		return util;
	});