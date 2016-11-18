angular.module('HubApp')
    .controller('onsiteController', function($scope, $http, $timeout, $q, utilService, badgeService, attendeeService, $location, $window) {

        /*----------  VAR DECLARATIONS  ----------*/

        var existingBadges = [];
        var allAttendees = [];
        var alert = new Audio('/audio/alert.mp3');

        var syncTimeout = null;
        var getAttendeesTimeout = null;

        //we track the last user update time, giving an initial value of page load time
        var lastUserUpdateTime = new Date();

        /*----------  SCOPE VAR DECLARATIONS  ----------*/

        $scope.eventId = null;
        $scope.checkInWorker = null;
        $scope.currentAttendee = null;
        $scope.currentSyncedAttendee = null;
        $scope.currentlySyncing = false;
        $scope.currentlyUnsyncing = false;

        //checkin arrays
        $scope.unsyncedAttendees = [];
        $scope.syncedAttendees = [];

        //counts
        $scope.allocatedPeripheralsCount = 0;

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

        var goToSearch = function() {
            if ($scope.checkInWorker) {
                $window.location.href = '/search?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker;
            } else {
                $window.location.href = '/search?eventId=' + $scope.eventId;
            }
        }

        var goToSignup = function() {
            if ($scope.checkInWorker) {
                $window.location.href = '/signup?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker;
            } else {
                $window.location.href = '/signup?eventId=' + $scope.eventId;
            }
        }

        var goToCheckIn = function() {
            if ($scope.checkInWorker) {
                $window.location.href = '/?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
            } else {
                $window.location.href = '/?eventId=' + $scope.eventId;
            }
        }

        var goToLookup = function() {
            if ($scope.checkInWorker) {
                $window.location.href = '/lookup?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker;
            } else {
                $window.location.href = '/lookup?eventId=' + $scope.eventId;
            }
        }

        /*----------  FUNC DECLARATIONS  ----------*/
        var compare = function(a, b) {
            if (a.checkIn.created < b.checkIn.created)
                return -1;
            else if (a.checkIn.created > b.checkIn.created)
                return 1;
            else
                return 0;
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

        var processAttendees = function() {
            $scope.unsyncedAttendees = [];
            $scope.syncedAttendees = [];

            allAttendees.forEach(function(attendee) {
                if (attendee.badge && !attendee.badge.isReturned) {
                    $scope.syncedAttendees.push(attendee);
                } else {
                    $scope.unsyncedAttendees.push(attendee);
                }
            });
        }

        var removeBadgeForCheckIn = function(attendeeTemp) {
            allAttendees.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    attendee.badge = null;
                }
            });
        }

        var addBadgeForCheckIn = function(attendeeTemp, badge) {
            allAttendees.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    attendee.badge = badge;
                }
            });
        }

        var sendCommand = function(command) {
            if ($scope.currentSyncedAttendee.badge) {
                badgeService.sendCommand($scope.currentSyncedAttendee.badge, command);
            }
        }

        var sync = function() {
            var attendeeEmail = $scope.currentAttendee.email;

            if ($scope.currentAttendee && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentAttendee);
            }

            setSyncTimeout(attendeeEmail);
        }

        var unsync = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedAttendee && $scope.currentSyncedAttendee.badge) {
                $scope.currentlyUnsyncing = true;
                badgeService.unsyncBadge($scope.currentSyncedAttendee, $scope.currentSyncedAttendee.badge)
                    .then(function() {
                        removeBadgeForCheckIn($scope.currentSyncedAttendee);
                        processAttendees();

                        var existingAttendeeBadges = {};
                        allAttendees.forEach(function(attendee) {
                            if (attendee.badge) {
                                var uniqueId = attendee.badge.identity + attendee.badge.macAddress;
                                existingAttendeeBadges[uniqueId] = attendee.badge;
                            }
                        });
                        badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);

                        $scope.currentSyncedAttendee = null;
                        $scope.currentlyUnsyncing = false;
                        lastUserUpdateTime = new Date();
                    });
            }
        }

        //we have sync timeout here to force the sync button to go back if we don't get a socket message that our badge has been synced
        var setSyncTimeout = function(attendeeEmail) {
            syncTimeout = $timeout(function() {
                console.log('timed out, looking for record!', $scope.eventId, attendeeEmail);
                attendeeService.getAttendeeByEmail($scope.eventId, attendeeEmail)
                    .then(function(attendees) {
                        var attendee = attendees[0];
                        if (attendee.badge) {
                            completeSync(attendee, attendee.badge);
                        } else {
                            setSyncTimeout(attendeeEmail);
                        }
                    });
            }, 3 * 1000);
        }

        var completeSync = function(attendeeTemp, badge) {
            $scope.unsyncedAttendees.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    addBadgeForCheckIn(attendee, badge);
                    processAttendees();
                }
            });

            if ($scope.unsyncedAttendees.length > 0) {
                $scope.currentAttendee = $scope.unsyncedAttendees[0];
            } else {
                $scope.currentAttendee = null;
            }
            $scope.currentlySyncing = false;

            lastUserUpdateTime = new Date();
            alert.play();
        }

        /*----------  INIT FUNCTION DECLARATIONS  ----------*/

        var getAttendeeCheckIns = function() {
            attendeeService.getCheckIns($scope.eventId, $scope.checkInWorker, "").then(function(result) {
                    if ($scope.checkInWorker) {
                        allAttendees = result.attendees.sort(function(a, b) {
                            return (a.checkIn.created < b.checkIn.created) ? 1 : ((b.checkIn.created < a.checkIn.created) ? -1 : 0);
                        });
                    } else {
                        allAttendees = result.attendees;
                    }

                    //here we make sure that the polling time is
                    if (result.requestTime > lastUserUpdateTime) {
                        processAttendees();
                    } else {
                        console.log('request too old to update ui!');
                    }
                }).finally(function() {
                    var existingAttendeeBadges = {};
                    allAttendees.forEach(function(attendee) {
                        if (attendee.badge && !attendee.badge.isReturned) {
                            var uniqueId = attendee.badge.identity + attendee.badge.macAddress;
                            existingAttendeeBadges[uniqueId] = attendee.badge;
                        }
                    });
                    $scope.currentStatus = badgeService.currentStatus;
                });

            getAttendeesTimeout = $timeout(function() {
                getAttendeeCheckIns();
            }, 2 * 1000);
        }

        getAttendeeCheckIns();

        /*----------  EVENT LISTENERS  ----------*/

        $scope.$on('badgeSynced', function(event, args) {
            if (syncTimeout) {
                $timeout.cancel(syncTimeout);
            }

            completeSync(args.attendee, args.badge);
        });

        $scope.$on('badgeSyncError', function(event, args) {
            $scope.currentlySyncing = false;
            if (syncTimeout) {
                $timeout.cancel(syncTimeout);
            }
            $scope.$apply();
        });

        $scope.$on('badgeDisconnect', function() {
            $scope.currentlySyncing = false;
            if (syncTimeout) {
                $timeout.cancel(syncTimeout);
            }
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
        $scope.setCurrentAttendee = setCurrentAttendee;
        $scope.setCurrentSyncedAttendee = setCurrentSyncedAttendee;
        $scope.sendCommand = sendCommand;
        $scope.toggleMenu = toggleMenu;
        $scope.sync = sync;
        $scope.unsync = unsync;
        $scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
        $scope.goToLookup = goToLookup;
        $scope.goToSignup = goToSignup;
    });