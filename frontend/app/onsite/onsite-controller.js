angular.module('HubApp')
    .controller('onsiteController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, config, $location) {

        /*----------  VAR DECLARATIONS  ----------*/

        var existingBadges = [];
        var lightBadges = [];
        var allCheckIns = [];
        var alert = new Audio('/audio/alert.mp3');

        /*----------  SCOPE VAR DECLARATIONS  ----------*/

        $scope.currentEvent = null;
        $scope.currentWorker = null;
        $scope.rssiThreshold = "...";
        $scope.currentAttendee = null;
        $scope.currentSyncedCheckIn = null;
        $scope.badgeConnected = false;
        $scope.attendees = [];
        $scope.syncingAttendee = null;
        $scope.lightingAttendee = null;
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
        $scope.currentBadgesCount = 0;
        $scope.currentAvailableBadgesCount = 0;
        $scope.allocatedBadgesCount = 0;
        $scope.availablePeripheralsCount = 0;
        $scope.allocatedPeripheralsCount = 0;

        //for sorting
        $scope.unsyncedReverse = false;
        $scope.syncedReverse = true;

        //menu
        $scope.checked = false;

        //allocation
        $scope.isAllocating = false;

        //lookups
        $scope.lookedupAttendees = {};
        var currentlyLooking = {};
        
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

        var reset = function() {
            badgeService.reset()
                .then(function() {
                    $scope.lookedupAttendees = {};
                    $scope.availablePeripheralsCount = badgeService.availablePeripheralsCount;
                    $scope.allocatedPeripheralsCount = badgeService.allocatedPeripheralsCount;
                    $scope.$apply();
                });
        }

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

        var sortCheckIns = function() {
            $scope.unsyncedCheckins = [];
            $scope.syncedCheckins = [];

            var allUnsyncedCheckins = [];
            var allSyncedCheckins = [];

            allCheckIns.forEach(function(checkIn) {
                if (!checkIn.badge) {
                    allUnsyncedCheckins.push(checkIn);
                } else {
                    allSyncedCheckins.push(checkIn);
                }
            });

            $scope.unsyncedCheckins = (allUnsyncedCheckins.length > 3)?allUnsyncedCheckins.slice(allUnsyncedCheckins.length-3):allUnsyncedCheckins;
            $scope.syncedCheckins = (allSyncedCheckins.length > 3)?allSyncedCheckins.slice(allSyncedCheckins.length-3):allSyncedCheckins;
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

        var updateSeenSyncedCheckIns = function(badges) {
            $scope.seenSyncedCheckins = [];
            $scope.seenSyncedCheckins = allCheckIns.filter(function(checkIn) {
                if (checkIn.badge) {
                    var matches = false;
                    badges.forEach(function(badge) {
                        if (checkIn.badge.identity == badge.identity &&
                            checkIn.badge.macAddress == badge.macAddress) {
                            matches = true;
                        }
                    });

                    return matches;
                }
            });
        }

        var allocate = function() {
            console.log($scope.availablePeripheralsCount < 1);
            if ($scope.availablePeripheralsCount > 0) {
                if (!$scope.isAllocating) {
                    $scope.isAllocating = true;
                    badgeService.allocate();
                    $timeout(function() {
                        $scope.isAllocating = false;
                    }, 5 * 1000);
                }
            } else {
                alert('You don\'t have any available badges to allocate!');
            }
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
            searchResults.forEach(function(result) {
                console.log(result);
                if(result.badge) {
                    $scope.syncedSearchResults.push(result);
                } else {
                    $scope.unsyncedSearchResults.push(result);
                }
            });
        }

        var scanForInterval = function() {
            if (!$scope.isScanning) {
                $scope.isScanning = true;
                badgeService.scanForInterval(3, false)
                    .then(function() {
                        $scope.isScanning = false;
                    });
            }
        }

        $scope.toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        $scope.orderUnsynced = function(predicate) {
            $scope.unsyncedReverse = ($scope.unsyncedPredicate === predicate) ? !$scope.unsyncedReverse : false;
            $scope.unsyncedPredicate = predicate;
            console.log($scope.unsyncedReverse);
        }

        $scope.orderSynced = function(predicate) {
            console.log('order synced!');
            $scope.syncedReverse = ($scope.syncedPredicate === predicate) ? !$scope.syncedReverse : false;
            $scope.syncedPredicate = predicate;
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

        $scope.syncBadge = function() {
            if ($scope.currentAttendee && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentAttendee);
            }
        }

        $scope.unsync = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedCheckIn && $scope.currentSyncedCheckIn.badge) {
                $scope.currentlyUnsyncing = true;
                console.log($scope.currentlyUnsyncing);
                badgeService.unsyncBadge($scope.currentSyncedCheckIn.eventAttendee, $scope.currentSyncedCheckIn.badge)
                    .then(function() {
                        removeBadgeForCheckIn($scope.currentSyncedCheckIn);
                        sortCheckIns();

                        var existingAttendeeBadges = {};
                        allCheckIns.forEach(function(checkIn) {
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
                        sortCheckIns();

                        var existingAttendeeBadges = {};
                        allCheckIns.forEach(function(checkIn) {
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

        $scope.unsyncAttendee = function() {
            $scope.currentAttendee.eventId = $scope.currentEvent;
            if (!$scope.currentlyUnsyncing && $scope.currentAttendee) {
                $scope.currentlyUnsyncing = true;
                badgeService.unsyncBadge($scope.currentAttendee, $scope.currentAttendee.badges[0])
                    .then(function() {
                        $scope.lookedupAttendees = [];
                        $scope.currentlyUnsyncing = false;
                    });
            }
        }

        $scope.setRSSI = function() {
            badgeService.setRssiThreshold($scope.rssiThreshold);
        }

        /*----------  INIT FUNCTION DECLARATIONS  ----------*/

        var getInitialData = function() {
            var deferred = $q.defer();
            $http({
                    method: 'GET',
                    url: '/initial-data'
                })
                .then(function(res) {
                    // $scope.currentEvent = parseInt(res.data.currentEvent);
                    // $scope.currentWorker = parseInt(res.data.currentWorker);
                    $scope.currentVersion = res.data.currentVersion;
                    $scope.allocationEnabled = res.data.allocationEnabled;
                    deferred.resolve();
                })
                .catch(function(err) {
                    deferred.reject(err);
                });

            return deferred.promise;
        }

        var init = function() {
            $scope.eventLoading = true;
            getInitialData()
                .then(function() {
                    return attendeeService.getBoomsetCheckIns($scope.currentEvent, $scope.currentWorker, "")
                })
                .then(function(checkIns) {
                    console.log(checkIns.length);
                    allCheckIns = checkIns;
                    sortCheckIns();
                })
                .finally(function() {
                    var existingAttendeeBadges = {};
                    allCheckIns.forEach(function(checkIn) {
                        if (checkIn.badge) {
                            var uniqueId = checkIn.badge.identity + checkIn.badge.macAddress;
                            existingAttendeeBadges[uniqueId] = checkIn.badge;
                        }
                    });
                    badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);
                    $scope.currentStatus = badgeService.currentStatus;
                    if($scope.lookup) {
                        badgeService.triggerLookup();
                    }
                });

            $timeout(function() {
                init();
            }, 1 * 1000);
        }

        init();

        /*----------  EVENT LISTENERS  ----------*/

        $scope.$on('badgeSynced', function(event, args) {
            var checkIn = attendeeService.findCheckInForAttendee(args.attendee, allCheckIns);

            if (checkIn) {
                addBadgeForCheckIn(checkIn, args.badge);
                sortCheckIns();
            }

            $scope.currentlySyncing = false;
            if ($scope.unsyncedCheckins.length > 0) {
                $scope.currentAttendee = $scope.unsyncedCheckins[0].eventAttendee;
            } else {
                $scope.currentAttendee = null;
            }

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

            updateSeenSyncedCheckIns(badgeService.currentBadges);
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
        $scope.allocate = allocate;
        $scope.scanForInterval = scanForInterval;
        $scope.reset = reset;
    });