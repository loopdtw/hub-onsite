angular.module('HubApp')
    .directive("hamburgerMenu", function() {
        return {
            restrict: "E",
            template: '<div></div><div></div><div></div>',
            scope: true,
            link: function($scope, elem) {
                elem.bind('click', function() {
                    $scope.$apply($scope.checked = !$scope.checked);
                });
            }
        };
    });