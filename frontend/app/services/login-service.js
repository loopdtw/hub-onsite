'use strict';
angular.module('HubApp')
    .factory('loginService', function($http) {
        return {
            loginAsync: function(username, password) {
                return $http.post('/api/v1/login', {
                    username: username,
                    password: password
                }).success(function(data, status) {
                    return data;
                }).error(function(data, status) {
                    console.log('fail to login with response:', data);
                });
            }
        };
    });
