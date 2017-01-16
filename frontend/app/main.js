'use strict'

var app = angular.module('HubApp', ['ngTouch', 'pageslide-directive', 'angular-duration-format']);

app.constant('config', {
	baseUrl: "https://staging-internal-api.loopd.com/api/v1",
	authToken: '2lWYeQ1Bq3QOqzr43Swy6GMKNAX3Z07htTeqkDL4NLhLFeHFoyOYp5mIITZBAhQV'
});

app.config(['$locationProvider', function($locationProvider) {
    $locationProvider.html5Mode({
  		enabled: true,
  		requireBase: false
	});
}]);