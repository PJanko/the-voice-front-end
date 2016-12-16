
var factory;
var competition;

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

      .otherwise({
        redirectTo: "/"
      });

}]);

function test(){
  /*var factory = CompetitionFactory.deployed();
  factory.testcomp.call({ from: accounts[0],gas:500000 }).then(function(o) {
    console.log("good");
    console.log(o.valueOf());
    }).catch(function(e) {
    console.log(e);
  });*/
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

window.onload = function() {

  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      console.log(err);
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    accounts = accs;
    account = accounts[1];

    var factory = CompetitionFactory.deployed();
    var test_result = 2;
    factory.AddCompetition(1,10,15,{ from: accounts[0],gas:5000000}).then(function(a) {
      console.log("1");
      console.log(a);
      console.log("-----------------");
    }).catch(function(e){
        console.log(e);
    });

  });
}

