(function () {
'use strict';

angular.module('walletcheck', [
    'ui.router',
    'restangular',
    'ngTagsInput',
    'angular-loading-bar',
    'ipCookie'
])

.config(function (RestangularProvider, $stateProvider, $urlRouterProvider,
                  cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;

    $urlRouterProvider.otherwise('/main');

    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'templates/login.html'
        })
        .state('main', {
            url: '/main',
            templateUrl: 'templates/main.html'
        })
        .state('add', {
            url: '/add',
            templateUrl: 'templates/form.html'
        })
        .state('edit', {
            url: '/edit/:entry_id',
            templateUrl: 'templates/form.html'
        })
    ;

    RestangularProvider.setBaseUrl(config.API_BASEPATH);
    RestangularProvider.setRestangularFields({
        id: '_id'
    });
})

.run(function (Restangular, Auth, $state) {
    Restangular.setErrorInterceptor(function (response) {
        if (response.status === 401 || response.status === 403) {
            Auth.clearToken();
            $state.go('login');
        }
        return true;
    });
})

.directive('ripple', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            jQuery.material.ripples(element);
        }
    }
})

.service('Balance', function (Restangular) {
    var balance = null;

    return {
        get: function () {
            if (!balance) {
                this.refresh();
            }
            return balance;
        },
        refresh: function () {
            balance = Restangular.one('total_balance').get().$object;
        }
    };
})

.service('Auth', function (ipCookie, Restangular) {
    return {
        user: null,
        loggedIn: false,
        isLoggedIn: function () {
            var token = this.getToken();
            this.loggedIn = token ? true : false;
            Restangular.setDefaultRequestParams({ token: token });
            return this.loggedIn;
        },
        getToken: function () {
            return ipCookie('token');
        },
        saveToken: function (token) {
            ipCookie('token', token);
            this.loggedIn = true;
        },
        clearToken: function () {
            ipCookie.remove('token');
            this.loggedIn = false;
        }
    };
})

.controller('NavCtrl', function ($scope, $state, Auth, Balance, $timeout) {
    $scope.refresh = function () {
        $state.go('main', {}, { reload: true });
    };

    $scope.balanceClass = function () {
        var balance = $scope.balance.balance;
        if (balance > 500) return 'label-success';
        if (balance > 100) return 'label-warning';
        if (balance <= 0) return 'label-danger';
    }

    function fetchBalance() {
        if (Auth.isLoggedIn()) $scope.balance = Balance.get();
        $timeout(fetchBalance, 5000);
    }
    fetchBalance();
})

.controller('LoginCtrl', function ($scope, $state, Auth, ipCookie, Restangular) {
    $scope.user = '';
    $scope.pass = '';

    if (Auth.isLoggedIn()) return $state.go('main');

    $scope.login = function () {
        if ($scope.working) return;
        Auth.clearToken();
        $scope.error = null;
        $scope.working = true;

        var login = Restangular.one('login');
        login.username = $scope.user;
        login.password = $scope.pass;
        login.post()
        .then(function (resp) {
            $scope.working = false;
            Auth.saveToken(resp.token);
            Restangular.setDefaultRequestParams({ token: resp.token });
            $state.go('main');
        })
        .catch(function (err) {
            console.log(err);
            $scope.working = false;
            $scope.error = err;
        });
    };
})

.controller('MainCtrl', function ($scope, $state, Auth, Restangular, Balance, $timeout) {
    if (!Auth.isLoggedIn()) return $state.go('login');

    var baseEntries = Restangular.all('entries');
    $scope.entries = [];
    $scope.entries = baseEntries.getList().$object;
    Balance.refresh();

    $scope.add = function () {
        $timeout(function () {
            $state.go('add');
        }, 250);
    };

    $scope.edit = function (entry) {
        $timeout(function () {
            $state.go('edit', { entry_id: entry._id });
        }, 250);
    };
})

.controller('FormCtrl', function ($scope, $state, $stateParams, Auth, Restangular) {
    if (!Auth.isLoggedIn()) return $state.go('login');

    if ($stateParams.entry_id) {
        Restangular.one('entries', $stateParams.entry_id).get().then(function (resp) {
            $scope.entry = resp;
        });
    }
    else {
        $scope.entry = Restangular.one('entries');
        $scope.entryType = $stateParams.entry_type || 'expense';
    }

    $scope.save = function (entry) {
        if ($scope.saving) return;
        $scope.saving = true;

        entry.tags = entry.tags.map(function (item) {
            return item.text;
        });

        entry.save()
        .then(function (resp) {
            $scope.saving = false;
            $state.go('main');
        })
        .catch(function (err) {
            console.log(err);
            $scope.saving = false;
        })
    };
})

;

})();
