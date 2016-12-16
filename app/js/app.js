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

/*

    factory.AddCompetition(1,10,15,{ from: accounts[3],gas:500000 }).then(function(a) {
      console.log("1");
      refreshBalance();
      console.log(a);
      console.log("-----------------");*/
      /*
      filter = web3.eth.filter('latest');
        filter.watch(function(error, result) {
            // XXX this should be made asynchronous as well.  time
            // to get the async library out...
            var receipt = web3.eth.getTransactionReceipt(a);
            // XXX should probably only wait max 2 events before failing XXX 
            if (receipt && receipt.transactionHash == a) {
                factory.getCompetition(0,{ from: accounts[0],gas:500000 }, function(e, res) {
                  console.log(res)
                  console.log('the transactionally incremented data was: ' + res.toString(10));
                  filter.stopWatching();
                });
                
                
            }
        });*/

/*
      factory.getCompetition(0,{ from: accounts[0],gas:500000 }).then(function(b) {
        console.log("2");
        console.log(b);
        console.log("-----------------");
        factory.getCompetition(0,{ from: accounts[0],gas:500000 }).then(function(c) {
          console.log("3");
          console.log(c);
          console.log("-----------------");
          factory.testcomp.call({ from: accounts[0],gas:500000 }).then(function(value) {
            console.log("4");
            console.log(value);
            console.log(value.valueOf());
            console.log("-----------------");
          }).catch(function(e) {
            console.log(e);
          });
        }).catch(function(e) {
          console.log(e);
        });
      }).catch(function(e) {
        console.log(e);
      });*/
/*
    }).catch(function(e) {
      console.log(e);
    });*/

/*
    comp= Competition.deployed();

    comp.AddArtist("1","1","1",{ from: accounts[0],gas:500000 }).then(function(a) {
      console.log("X");
      console.log(a);
      console.log("-----------------");
      comp.AddArtist("2","2","2",{ from: accounts[0],gas:500000 }).then(function(a) {
        console.log("XX");
        console.log(a);
        console.log("-----------------"); 
        comp.getNumberArtists.call({ from: accounts[0],gas:500000 }).then(function(a) {
          console.log("XXX");
          console.log(a);
          console.log(a.valueOf());
          console.log("-----------------");        
        }).catch(function(e) {
          console.log("e");
        });       
      }).catch(function(e) {
        console.log("e");
      });
    }).catch(function(e) {
      console.log("e");
    });
*/



    /*
    factory.testcomp.call({ from: accounts[0],gas:500000 }).then(function(value) {
      console.log("good");
      console.log(value);
    }).catch(function(e) {
      console.log("e");
    });

    factory.test.call({ from: accounts[0],gas:500000 }).then(function(value) {
      console.log("good");
      console.log(value);
    }).catch(function(e) {
      console.log("e");
    });
    */




  /*factory.AddCompetition.call(1,1,1,{ from: accounts[0] }).then(function() {
    console.log("compet ajoutée");
  }).catch(function(e) {
    console.log(e);
  });*/

    //console.log(meta);


    //var temp = meta.AddCompetition.call(1,1,1,{ from: accounts[0] }).then(function() {


  /*  meta2.AddArtist.call("lol","lol","lol",{ from: accounts[0],gas:500000 }).then(function() {
      console.log("added");
      meta2.getNumberArtists.call({ from: accounts[0],gas:500000 }).then(function(nb) {
        console.log(nb.valueOf());
      }).catch(function(e) {
        console.log(e);
      });
    }).catch(function(e) {
      console.log(e);
    });*/


      /*var lol = meta.test.call({from: accounts[0]}).then(function(value) {
        console.log("brut " + value);
        console.log(value);
        var temp =  value.valueOf();
        console.log("valueOf " +temp);

      }).catch(function(e) {
        console.log(e);
      });*/

      /*meta.getCompetition.call(0,{ from: accounts[0],gas:50000 }).then(function(comp) {
        comp.getNumberArtists.call({ from: accounts[0],gas:50000 }).then(function(nb) {
          console.log(nb.valueOf());
        }).catch(function(e) {
        console.log(e);
      });
      }).catch(function(e) {
        console.log("fail get comp");
      });*/


      //var comp = meta.getCompetition.call(0,{ from: accounts[0],gas:50000 }).then(function() {
      //var lol = meta.test.call({ from: accounts[0],gas:50000 }).then(function() {



    //1console.log(meta.test());
    //var meta2 = Test.new({ from: accounts[0] });

    //var result = meta.test();

