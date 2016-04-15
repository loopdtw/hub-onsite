angular.module('HubApp')
    .controller('searchController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, config, $location) {

        /*----------  VAR DECLARATIONS  ----------*/

        var existingBadges = [];
        var lightBadges = [];
        var allCheckIns = [];
        var alert = new Audio('/audio/alert.mp3');

        /*----------  SCOPE VAR DECLARATIONS  ----------*/

        $scope.currentEvent = null;
        $scope.rssiThreshold = "...";
        $scope.currentAttendee = null;
        $scope.currentSyncedCheckIn = null;
        $scope.currentlySyncing = false;
        $scope.currentlyUnsyncing = false;

        //search
        var searchResults = null;
        $scope.searchTerm = null;
        $scope.currentlySearching = false;
        $scope.syncedSearchResults = [];
        $scope.unsyncedSearchResults = [];

        //checkin arrays
        $scope.unsyncedCheckins = [];
        $scope.syncedCheckins = [];
        $scope.seenSyncedCheckins = [];

        //counts
        $scope.allocatedBadgesCount = 0;

        //menu
        $scope.checked = false;

        //allocation
        $scope.isAllocating = false;

        //url location
        $scope.location = $location;
        console.log($location.search());
        $scope.$watch('location.search()', function() {
            $scope.currentEvent = ($location.search()).currentEvent;
            $scope.currentWorker = ($location.search()).currentWorker;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('currentEvent', name);
            $location.search('currentWorker', name);
        }

        /*----------  FUNC DECLARATIONS  ----------*/

        var setCurrentAttendee = function(attendee) {
            if (!$scope.currentlySyncing) {
                if ($scope.currentAttendee) {
                    if ($scope.currentAttendee.id == attendee.id) {
                        $scope.currentAttendee = null;
                    } else {
                        $scope.currentAttendee = attendee;
                    }
                } else {
                    $scope.currentAttendee = attendee;
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
            allCheckIns.forEach(function(checkIn) {
                if (checkIn.id == checkInTemp.id) {
                    checkIn.badge = null;
                }
            });
        }

        var addBadgeForCheckIn = function(checkInTemp, badge) {
            allCheckIns.forEach(function(checkIn) {
                if (checkIn.id == checkInTemp.id) {
                    checkIn.badge = badge;
                }
            });
        }

        var search = function() {
            if (search && search !== "") {
                $scope.currentlySearching = true;
                attendeeService.searchBoomsetCheckIns($scope.currentEvent, $scope.searchTerm)
                    .then(function(data) {
                        $scope.currentlySearching = false;
                        searchResults = data.data;
                        sortSearchResults();
                    });
            }
        }

        var sortSearchResults = function() {
            $scope.syncedSearchResults = [];
            $scope.unsyncedSearchResults = [];
            
            searchResults.forEach(function(result) {
                console.log(result);
                if(result.badge) {
                    $scope.syncedSearchResults.push(result);
                } else {
                    $scope.unsyncedSearchResults.push(result);
                }
            });

            $scope.$apply();
        }

        $scope.toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        $scope.attendeeBadgeWaitingToLight = function(attendee) {
            if (attendee.badgeIdentity) {
                return (lightBadges.indexOf(attendee.badgeIdentity) > -1);
            } else {
                return false;
            }
        }

        $scope.sendCommand = function(command) {
            if ($scope.currentSyncedCheckIn.badge) {
                badgeService.sendCommand($scope.currentSyncedCheckIn.badge, command);
            }
        }

        $scope.syncSearched = function() {
            if ($scope.currentAttendee && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentAttendee);
            }
        }

        $scope.unsyncSearched = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedCheckIn && $scope.currentSyncedCheckIn.badge) {
                $scope.currentlyUnsyncing = true;
                console.log($scope.currentlyUnsyncing);
                badgeService.unsyncBadge($scope.currentSyncedCheckIn.eventAttendee, $scope.currentSyncedCheckIn.badge)
                    .then(function() {
                        removeBadgeForCheckIn($scope.currentSyncedCheckIn);
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
                sortSearchResults();
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

        $scope.$on('badgeNotFound', function() {
            $scope.$apply($scope.currentAttendee = null);
            $scope.$apply($scope.currentlySyncing = false);
        });

        $scope.$on('currentBadges', function() {
            $scope.$apply($scope.currentBadgesCount = badgeService.currentBadges.length);
            $scope.$apply($scope.currentAvailableBadgesCount = badgeService.currentAvailableBadges.length);
            $scope.$apply($scope.allocatedPeripheralsCount = badgeService.allocatedPeripheralsCount);
            $scope.$apply($scope.availablePeripheralsCount = badgeService.availablePeripheralsCount);
        });

        $scope.$on('badgeLookup', function(event, args) {
            if(!currentlyLooking[args.identity]) {
                currentlyLooking[args.identity] = 1;

                attendeeService.getAttendeeForBadge($scope.currentEvent, args.identity)
                    .then(function(attendee) {
                        console.log(attendee);
                        delete currentlyLooking[args.identity];
                        if(attendee) {
                            $scope.lookedupAttendees[args.identity] = attendee;
                        } else {
                            alert('No attendee found for badge!');
                        }
                    });
            }
        });

        /*----------  EXPORT DECLARATIONS  ----------*/
        $scope.search = search;
        $scope.setCurrentAttendee = setCurrentAttendee;
        $scope.setCurrentSyncedCheckIn = setCurrentSyncedCheckIn;
    });