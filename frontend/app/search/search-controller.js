angular.module('HubApp')
    .controller('searchController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, $location, $window) {

        /*----------  VAR DECLARATIONS  ----------*/
        var alert = new Audio('/audio/alert.mp3');

        /*----------  SCOPE VAR DECLARATIONS  ----------*/
        $scope.currentEvent = null;
        $scope.currentCheckIn = null;
        $scope.currentSyncedCheckIn = null;
        $scope.currentlySyncing = false;
        $scope.currentlyUnsyncing = false;

        //search
        $scope.searchTerm = null;

        var searchResults = [];
        $scope.currentlySearching = false;
        $scope.syncedSearchResults = [];
        $scope.unsyncedSearchResults = [];

        //counts
        $scope.allocatedBadgesCount = 0;

        //menu
        $scope.checked = false;

        //url location
        $scope.location = $location;
        $scope.$watch('location.search()', function() {
            $scope.currentEvent = ($location.search()).currentEvent;
            $scope.currentWorker = ($location.search()).currentWorker;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('currentEvent', name);
            $location.search('currentWorker', name);
        }

        /*----------  MENU  ----------*/
        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        var goToCheckIn = function() {
            $window.location.href = '/onsite?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
        }

        var goToSearch = function() {
            $window.location.href = '/onsite/search?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
        }

        var goToLookup = function() {
            $window.location.href = '/lookup?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
        }

        /*----------  FUNC DECLARATIONS  ----------*/

        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        var setCurrentCheckIn = function(checkIn) {
            if (!$scope.currentlySyncing) {
                if ($scope.currentCheckIn) {
                    if ($scope.currentCheckIn.id == checkIn.id) {
                        $scope.currentCheckIn = null;
                    } else {
                        $scope.currentCheckIn = checkIn;
                    }
                } else {
                    $scope.currentCheckIn = checkIn;
                }
            }
        }

        var setCurrentSyncedCheckIn = function(checkIn) {
            if (!$scope.currentlyUnsyncing) {
                if ($scope.currentSyncedCheckIn) {
                    if ($scope.currentSyncedCheckIn.id == checkIn.id) {
                        $scope.currentSyncedCheckIn = null;
                    } else {
                        $scope.currentSyncedCheckIn = checkIn;
                    }
                } else {
                    $scope.currentSyncedCheckIn = checkIn;
                }
            }
        }

        var removeBadgeForCheckIn = function(checkInTemp) {
            searchResults.forEach(function(checkIn) {
                if (checkIn.id == checkInTemp.id) {
                    checkIn.badge = null;
                }
            });
        }

        var addBadgeForCheckIn = function(checkInTemp, badge) {
            searchResults.forEach(function(checkIn) {
                if (checkIn.id == checkInTemp.id) {
                    checkIn.badge = badge;
                }
            });
        }

        var search = function() {
            if (search && search !== "") {
                $scope.currentlySearching = true;
                attendeeService.searchCheckIns($scope.currentEvent, $scope.searchTerm)
                    .then(function(data) {
                        $scope.currentlySearching = false;
                        searchResults = data.data;
                        processSearchResults();
                    });
            }
        }

        var processSearchResults = function() {
            $scope.syncedSearchResults = [];
            $scope.unsyncedSearchResults = [];
            
            searchResults.forEach(function(result) {
                if(result.badge) {
                    $scope.syncedSearchResults.push(result);
                } else {
                    $scope.unsyncedSearchResults.push(result);
                }
            });
        }

        var sendCommand = function(command) {
            if ($scope.currentSyncedCheckIn.badge) {
                badgeService.sendCommand($scope.currentSyncedCheckIn.badge, command);
            }
        }

        var sync = function() {
            if ($scope.currentCheckIn && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentCheckIn.eventAttendee);
            }
        }

        var unsync = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedCheckIn && $scope.currentSyncedCheckIn.badge) {
                $scope.currentlyUnsyncing = true;
                var existingAttendeeBadges = {};
                badgeService.unsyncBadge($scope.currentSyncedCheckIn.eventAttendee, $scope.currentSyncedCheckIn.badge)
                    .then(function() {
                        removeBadgeForCheckIn($scope.currentSyncedCheckIn);
                        processSearchResults();

                        var existingAttendeeBadges = {};
                        searchResults.forEach(function(checkIn) {
                            if (checkIn.badge) {
                                var uniqueId = checkIn.badge.identity + checkIn.badge.macAddress;
                                existingAttendeeBadges[uniqueId] = checkIn.badge;
                            }
                        });
                        badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);

                        $scope.currentSyncedCheckIn = null;
                        $scope.currentlyUnsyncing = false;
                    });
            }
        }

        /*----------  EVENT LISTENERS  ----------*/

        $scope.$on('badgeSynced', function(event, args) {
            var checkIn = attendeeService.findCheckInForAttendee(args.attendee, $scope.unsyncedSearchResults);
            if (checkIn) {
                addBadgeForCheckIn(checkIn, args.badge);
                console.log('check', checkIn);
                processSearchResults();
            }

            $scope.currentlySyncing = false;
            alert.play();
            $scope.$apply();
        });

        $scope.$on('badgeDisconnect', function() {
            $scope.currentlySyncing = false;
            $scope.$apply();
        });

        $scope.$on('currentStatus', function() {
            $scope.currentStatus = badgeService.currentStatus;
            $scope.$apply();
        });

        $scope.$on('currentBadges', function() {
            $scope.$apply($scope.allocatedPeripheralsCount = badgeService.allocatedPeripheralsCount);
        });

        /*----------  EXPORT DECLARATIONS  ----------*/
        $scope.search = search;
        $scope.toggleMenu = toggleMenu;
        $scope.setCurrentCheckIn = setCurrentCheckIn;
        $scope.setCurrentSyncedCheckIn = setCurrentSyncedCheckIn;
        $scope.sendCommand = sendCommand;
        $scope.sync = sync;
        $scope.unsync = unsync;
        $scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
        $scope.goToLookup = goToLookup;
    });