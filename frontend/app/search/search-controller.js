angular.module('HubApp')
    .controller('searchController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, $location, $window) {

        /*----------  VAR DECLARATIONS  ----------*/
        var alert = new Audio('/audio/alert.mp3');
        var syncTimeout = null;

        /*----------  SCOPE VAR DECLARATIONS  ----------*/
        $scope.eventId = null;
        $scope.checkInWorker = null;
        $scope.currentAttendee = null;
        $scope.currentSyncedAttendee = null;
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
            $scope.eventId = ($location.search()).eventId;
            $scope.checkInWorker = ($location.search()).checkInWorker;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('eventId', name);
            $location.search('checkInWorker', name);
        }

        /*----------  MENU  ----------*/
        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        var goToCheckIn = function() {
            $window.location.href = '/?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        var goToSearch = function() {
            $window.location.href = '/search?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        var goToLookup = function() {
            $window.location.href = '/lookup?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        var goToSignup = function() {
            $window.location.href = '/signup?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        /*----------  FUNC DECLARATIONS  ----------*/

        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
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

        var setCurrentSyncedAttendee = function(attendee) {
            if (!$scope.currentlyUnsyncing) {
                if ($scope.currentSyncedAttendee) {
                    if ($scope.currentSyncedAttendee.id == attendee.id) {
                        $scope.currentSyncedAttendee = null;
                    } else {
                        $scope.currentSyncedAttendee = attendee;
                    }
                } else {
                    $scope.currentSyncedAttendee = attendee;
                }
            }
        }

        var removeBadgeForAttendee = function(attendeeTemp) {
            searchResults.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    attendee.badge = null;
                }
            });
        }

        var addBadgeForAttendee = function(attendeeTemp, badge) {
            searchResults.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    attendee.badge = badge;
                }
            });
        }

        var search = function() {
            if (search && search !== "") {
                $scope.currentlySearching = true;
                attendeeService.searchAttendees($scope.eventId, $scope.searchTerm)
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
                if (result.badge) {
                    $scope.syncedSearchResults.push(result);
                } else {
                    $scope.unsyncedSearchResults.push(result);
                }
            });
        }

        var sendCommand = function(command) {
            if ($scope.currentSyncedAttendee.badge) {
                badgeService.sendCommand($scope.currentSyncedAttendee.badge, command);
            }
        }

        var sync = function() {
            if ($scope.currentAttendee && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                var attendeeEmail = $scope.currentAttendee.email;
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentAttendee);
                setSyncTimeout(attendeeEmail);
            }
        }

        var setSyncTimeout = function(attendeeEmail) {
            syncTimeout = $timeout(function() {
                console.log('timed out, looking for record!');
                attendeeService.getAttendeeByEmail($scope.eventId, attendeeEmail)
                    .then(function(attendees) {
                        var attendee = attendees[0];
                        if (attendee.badge) {
                            completeSync(attendee, attendee.badge);
                        } else {
                            setSyncTimeout();
                        }
                    });
            }, 3 * 1000);
        }

        var unsync = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedAttendee && $scope.currentSyncedAttendee.badge) {
                $scope.currentlyUnsyncing = true;
                var existingAttendeeBadges = {};
                badgeService.unsyncBadge($scope.currentSyncedAttendee, $scope.currentSyncedAttendee.badge)
                    .then(function() {
                        removeBadgeForAttendee($scope.currentSyncedAttendee);
                        processSearchResults();

                        var existingAttendeeBadges = {};
                        searchResults.forEach(function(attendee) {
                            if (attendee.badge) {
                                var uniqueId = attendee.badge.identity + attendee.badge.macAddress;
                                existingAttendeeBadges[uniqueId] = attendee.badge;
                            }
                        });
                        badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);

                        $scope.currentSyncedAttendee = null;
                        $scope.currentlyUnsyncing = false;
                    });
            }
        }

        var completeSync = function(attendee, badge) {
            addBadgeForAttendee(attendee, badge);
            processSearchResults();
            $scope.currentlySyncing = false;
        }

        /*----------  EVENT LISTENERS  ----------*/

        $scope.$on('badgeSynced', function(event, args) {
            if (syncTimeout) {
                $timeout.cancel(syncTimeout);
            }

            completeSync(args.attendee, args.badge);

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
        $scope.setCurrentAttendee = setCurrentAttendee;
        $scope.setCurrentSyncedAttendee = setCurrentSyncedAttendee;
        $scope.sendCommand = sendCommand;
        $scope.sync = sync;
        $scope.unsync = unsync;
        $scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
        $scope.goToLookup = goToLookup;
        $scope.goToSignup = goToSignup;
    });