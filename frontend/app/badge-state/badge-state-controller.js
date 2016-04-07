angular.module('HubApp')
    .controller('BadgeStateController', function($scope, $http, $interval, $q, badgeService, utilService, config) {
        var socket = io.connect();

        /*----------  VAR DECLARATIONS  ----------*/

        var predicate = null;
        var reverse = false;

        /*----------  SCOPE VAR DECLARATIONS  ----------*/
        $scope.scanTime = 5;
        $scope.badgeCommands = {};
        $scope.sortedKeys = [];

        $scope.isScanning = badgeService.isScanning;
        $scope.currentStatus = badgeService.currentStatus;
        $scope.seenBadges = badgeService.seenBadges;
        $scope.seenBadgesCount = badgeService.seenBadgesCount;
        $scope.currentBadgesCount = badgeService.currentBadgesCount;

        $scope.bulkState = "";
        $scope.bulkCommand = "";

        $scope.bulkCommanding = false;

        /*----------  FUNCTION DECLARATIONS  ----------*/

        var order = function(item) {
            predicate = item;
            reverse = ~reverse;
            $scope.sortedKeys = utilService.getSortedArrayFromObject(predicate, badgeService.seenBadges, reverse);
        }

        var reset = function() {
            badgeService.reset();
            $scope.sortedKeys = [];
        }

        var scanForInterval = function() {
            $scope.isScanning = true;
            badgeService.scanForInterval($scope.scanTime, false)
                .then(function(isScanning) {
                    $scope.isScanning = false;
                });
        }

        var sendBadgeCommand = function(badge) {
            badgeService.sendCommand(badge, $scope.badgeCommands[badge.identity + badge.macAddress]);
        }

        var sendBulkCommand = function() {
            $scope.bulkCommanding = true;
            badgeService.sendBulkCommand($scope.bulkState, $scope.bulkCommand);
        }

        var badgeWaitingForCommand = function(badge) {
            var uniqueId = badge.identity + badge.macAddress;
            return badgeService.hasOwnProperty(uniqueId);
        }

        var updateKeys = function(badges) {
            for (var key in badges) {
                console.log(key);
                if (!utilService.arrayContains(key, $scope.sortedKeys)) {
                    $scope.sortedKeys.push(key);
                }
            }
        }

        /*----------  INIT DECLARATIONS  ----------*/

        function getInitialData() {
            var deferred = $q.defer();
            $http({
                    method: 'GET',
                    url: '/initial-data'
                })
                .then(function(res) {
                    $scope.currentVersion = (res.data.currentVersion);
                    deferred.resolve();
                })
                .catch(function(err) {
                    deferred.reject(err);
                });

            return deferred.promise;
        }

        function init() {
            getInitialData()
                .then(function() {
                    console.log('init complete');
                });
        }

        init();

        /*----------  EVENT LISTENTERS  ----------*/
        $scope.$on('seenBadges', function() {
            $scope.$apply($scope.seenBadges = badgeService.seenBadges);
            updateKeys(badgeService.seenBadges);
        });

        $scope.$on('currentStatus', function() {
            console.log('currentStatus!');
            $scope.currentStatus = badgeService.currentStatus;
            $scope.$apply();
        });

        $scope.$on('bulkCommandComplete', function() {
            $scope.bulkCommanding = badgeService.bulkCommanding;
            $scope.$apply();
        });

        $scope.$on('currentBadges', function() {
            $scope.$apply($scope.seenBadges = badgeService.seenBadges);
            $scope.$apply($scope.seenBadgesCount = badgeService.seenBadgesCount);
            $scope.$apply($scope.currentBadgesCount = badgeService.currentBadgesCount);
            updateKeys(badgeService.seenBadges);
        });

        /*----------  EXPORTED FUNCTIONS  ----------*/
        $scope.scanForInterval = scanForInterval;
        $scope.sendBadgeCommand = sendBadgeCommand;
        $scope.sendBulkCommand = sendBulkCommand;
        $scope.badgeWaitingForCommand = badgeWaitingForCommand;
        $scope.order = order;
        $scope.reset = reset;
    });