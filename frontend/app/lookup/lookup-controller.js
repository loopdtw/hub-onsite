angular.module('HubApp')
	.controller('LookupController', function($scope, $http, $interval, $q, attendeeService, badgeService, $location, $timeout, $window) {
		$scope.eventId = null;
		$scope.currentAttendee = null;
		$scope.noAttendeeMessage = null;
		$scope.loading = false;

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
            $window.location.href = '/?eventId='+$scope.eventId+'&checkInWorker='+$scope.checkInWorker
        }

        var goToSearch = function() {
            $window.location.href = '/search?eventId='+$scope.eventId+'&checkInWorker='+$scope.checkInWorker
        }

        var goToLookup = function() {
            $window.location.href = '/lookup?eventId='+$scope.eventId+'&checkInWorker='+$scope.checkInWorker
        }

        /*----------  METHODS  ----------*/
		var close = function() {
			$('.badgeInfo').css('display', 'none');
			$scope.currentAttendee = null;
			$scope.noAttendeeMessage = null;
		}

		$scope.$on('badgeLookup', function(event, args) {
            if(!$scope.currentAttendee) {
            	$('.badgeInfo').css('display', 'block');
            	$scope.loading = true;
                attendeeService.getAttendeeForBadge($scope.eventId, args.identity)
                    .then(function(attendee) {
                    	$scope.loading = false;
                        if(attendee) {
                            $scope.currentAttendee = attendee;
                        } else {
                            $scope.noAttendeeMessage = "No information found!"
                        }

                        $timeout(function() {
                            $('.badgeInfo').css('display', 'none');
                            $scope.currentAttendee = null;
                            $scope.noAttendeeMessage = null;
                        }, 3000);
                    });
            }
        });

        var init = function() {
    		badgeService.enableLookup();
        }

        init();

        /*----------  EXPORT DECLARATIONS  ----------*/
        $scope.close = close;
        $scope.goToLookup = goToLookup;
        $scope.toggleMenu = toggleMenu;
        $scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
        $scope.goToLookup = goToLookup;
	});