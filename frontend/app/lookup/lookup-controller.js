angular.module('HubApp')
	.controller('LookupController', function($scope, $http, $interval, $q, attendeeService, badgeService, $location, $timeout) {
		$scope.currentEvent = null;
		$scope.currentAttendee = null;
		$scope.noAttendeeMessage = null;
		$scope.loading = false;

        //url location
        $scope.location = $location;
        console.log($location.search());
        $scope.$watch('location.search()', function() {
            $scope.currentEvent = ($location.search()).currentEvent;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('currentEvent', name);
        }

        /*----------  MENU  ----------*/
        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        var goToCheckIn = function() {
            $window.location.href = '/?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
        }

        var goToSearch = function() {
            $window.location.href = '/search?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
        }

        var goToLookup = function() {
            $window.location.href = '/lookup?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
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
                attendeeService.getAttendeeForBadge($scope.currentEvent, args.identity)
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
	});