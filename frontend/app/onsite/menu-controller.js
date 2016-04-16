angular.module('HubApp')
    .controller('menuController', function($scope, config, $location, $window) {

    	//url location
        $scope.$watch('location.search()', function() {
            $scope.currentEvent = ($location.search()).currentEvent;
            $scope.currentWorker = ($location.search()).currentWorker;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('currentEvent', name);
            $location.search('currentWorker', name);
        }

    	var goToCheckIn = function() {
    		$window.location.href = '/onsite?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
    	}

    	var goToSearch = function() {
    		$window.location.href = '/onsite/search?currentEvent='+$scope.currentEvent+'&currentWorker='+$scope.currentWorker
    	}

    	$scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
});