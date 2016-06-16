angular.module('HubApp')
    .controller('signupController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, $location, $window) {

        /*----------  SCOPE VAR DECLARATIONS  ----------*/
        $scope.eventId = null;
        $scope.checkInWorker = null;
        $scope.currentlyLoading = false;

        //menu
        $scope.checked = false;

        //url location
        $scope.location = $location;
        $scope.$watch('location.search()', function() {
            $scope.eventId = ($location.search()).eventId;
            $scope.checkInWorker = ($location.search()).checkInWorker;

            $scope.currentAttendee = {
                firstname: null,
                lastname: null,
                email: null,
                line: null,
                title: null,
                organization: null,
                provider: 'loopd',
                providerAttendeeId: $scope.checkInWorker + new Date().valueOf(),
                checkInWorker: $scope.checkInWorker
            }

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

        var signup = function() {
            $scope.currentlyLoading = true;
            console.log('onsite controller', $scope.currentAttendee);
            attendeeService.signupAttendee($scope.eventId, $scope.currentAttendee)
                .then(function(data) {
                    $scope.currentlyLoading = false;
                });
        }

        /*----------  INIT FUNCTION DECLARATIONS  ----------*/


        /*----------  EXPORT DECLARATIONS  ----------*/
        $scope.signup = signup;
        $scope.toggleMenu = toggleMenu;
        $scope.goToSignup = goToSignup;
        $scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
        $scope.goToLookup = goToLookup;
        $scope.goToSignup = goToSignup;
    });