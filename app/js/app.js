
var factory;
var competition;
var accounts;

///////////////////////////////////////////////////////////////////////////////////////////
// Angular Module Declaration For the application
///////////////////////////////////////////////////////////////////////////////////////////
// Dependencies
// NgRoute to support client side navigational routing
///////////////////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice", ["ngRoute", "ngYoutubeEmbed"]);

///////////////////////////////////////////////////////////////////////////////////////////
// Client Side Routing Configuration of Route Provider
// Identifies the controller and template for each route
// Sets Home as the Unconfigured default Route
///////////////////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").config(["$routeProvider", function($routeProvider) {

    $routeProvider.
      when("/", {
        templateUrl : "home.html",
        controller  : "HomeController"
      })
      .when("/form", {
        templateUrl : "form.html",
        controller  : "FormController"
      })
      .when("/singers/:id", {
        templateUrl : "singer.html",
        controller  : "SingerController"
      })
      .when("/admin", {
        templateUrl : "admin.html",
        controller  : "AdminController" 
      })

      .otherwise({
        redirectTo: "/"
      });

}]);

angular.module('TheVoice').run(function($rootScope) {
  if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
  } else {
    // set the provider you want from Web3.providers
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }
});

function asyncLoop(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
}
/*
function test(){
  /*var factory = CompetitionFactory.deployed();
  factory.testcomp.call({ from: accounts[0],gas:500000 }).then(function(o) {
    console.log("good");
    console.log(o.valueOf());
    }).catch(function(e) {
    console.log(e);
  });
  var comp1 = Competition.at(competition);
};

function refreshBalance() {
  var factory = CompetitionFactory.deployed();

  factory.getCompetition(0,{ from: accounts[3],gas:500000 }).then(function(value) {
    console.log(value.valueOf());
    competition = value.valueOf();
    test();
  }).catch(function(e) {
    console.log(e);
  });
};
*/
