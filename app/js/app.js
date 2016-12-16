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


    var meta = CompetitionFactory.deployed();
    console.log(meta);
    meta.getAdmin().then(function() {
      console.log("good");
    }).catch(function(e) {
      console.log("bad");
      setStatus("Error sending coin; see log.");
    });


    //console.log(accounts);

  });
}