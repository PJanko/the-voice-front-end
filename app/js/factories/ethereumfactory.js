
var db = {
	singers : [
		{
			'name': 'Sam Smith',
			'video-id' : 'nCkpzqqog4k',
			'id': '1231'
		},{
			'name': 'Max Boulbil',
			'video-id' : 'l6F2HU4JAIU',
			'id': '1232'
		},{
			'name': 'Didier Super',
			'video-id' : 'CfUseBtyZTY',
			'id': '1233'
		},{
			'name': 'Fatal Bazouka',
			'video-id' : 'x-biTuOrYkk',
			'id': '1234'
		},{
			'name': 'Sam Smith',
			'video-id' : 'nCkpzqqog4k',
			'id': '1235'
		},{
			'name': 'Max Boulbil',
			'video-id' : 'l6F2HU4JAIU',
			'id': '1236'
		},{
			'name': 'Didier Super',
			'video-id' : 'CfUseBtyZTY',
			'id': '1237'
		},{
			'name': 'Fatal Bazouka',
			'video-id' : 'x-biTuOrYkk',
			'id': '1238'
		},{
			'name': 'Sam Smith',
			'video-id' : 'nCkpzqqog4k',
			'id': '1239'
		},{
			'name': 'Max Boulbil',
			'video-id' : 'l6F2HU4JAIU',
			'id': '1240'
		},{
			'name': 'Didier Super',
			'video-id' : 'CfUseBtyZTY',
			'id': '1241'
		},{
			'name': 'Fatal Bazouka',
			'video-id' : 'x-biTuOrYkk',
			'id': '1242'
		},

	]
}


///////////////////////////////////////////////////////////////////////////////
// Ethereum Factory
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").factory("EthereumFactory",['$window', function($window){

	var _factory = {

		getDeployedFactory : function(){
			return CompetitionFactory.deployed();
		},

		getAccounts : function(cb) {
			web3.eth.getAccounts(function(err, accs) {
			    if (err != null) {
		      		console.log(err);
		      		alert("There was an error fetching your accounts.");
		      		return cb(undefined);
			    }
			    if (accs.length == 0) {
		      		alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
		      		return cb(undefined);
			    }
			    cb(accs);
			});
		},


		createFactory : function(admin, cb) {
			var promise = CompetitionFactory.new({from: admin, gas:5000000});
			promise.then(function(instance) {
				console.log(instance);
				cb(null, instance);
			}).catch(function(e) {
				console.log(e);
				cb(e);
			});
		},

		createCompetition : function(admin, start, parier, end, cb ) {
			// Récupère le contrat déployé avec truffle migrate
			var factory = CompetitionFactory.deployed();
			
			factory.AddCompetition(start,parier,end,{ from: admin, gas: 5000000 }).then(function(instance) {
			    console.log("compet ajoutée");
			    console.log(instance);
			    cb(null, instance);
			  }).catch(function(e) {
			    console.log(e);
			    cb(e);
			  });
			
		},

		// Créer un résumé avec le nombre de compétitions dans le contrat et l'addresse de la dernière
		getCompetitionsSummary : function(cb) {
			// Récupère le contrat déployé avec truffle migrate
			var factory = CompetitionFactory.deployed();

			var promise = factory.getCompetitionsLength.call();
			promise.then(function(instance) {
				
				var p = factory.getCompetition.call(instance.toNumber()-1);
				p.then(function(inst) {
					console.log('latest : '+inst);
					var res = {address: inst, number: instance.toNumber()};
					cb(null, res);
				}).catch(function(e) {
					console.log(e);
				});

				
			}).catch(function(e) {
				console.log(e);
				cb(e);
			});
		},

		// Récupère l'addresse de la dernière compétition (celle en cours)
		getCurrentCompetitionAddress : function(cb) {
			// Récupère le contrat déployé avec truffle migrate
			var factory = CompetitionFactory.deployed();

			var promise = factory.getCompetitionsLength.call();
			promise.then(function(instance) {
				
				var p = factory.getCompetition.call(instance.toNumber()-1);
				p.then(function(address) {
					cb(null, address);
				}).catch(function(e) {
					console.log(e);
				});

			}).catch(function(e) {
				console.log(e);
				cb(e);
			});
		},

		// Récupère la dernière compétition (celle en cours) 
		getCurrentCompetition : function(cb) {

			_factory.getCurrentCompetitionAddress(function(err, address) {
				if(err) return cb(err);
				var comp = Competition.at(address);
				cb(null, comp);
			});
			
		},


		/*
		 *
		 *		LES FONCTIONS CI-DESSUS SONT LES NOUVELLES 
		 *
		 *	CONTINUER L'IMPLEMENTATION ICI
		 * 		
		 *		LES FONCTIONS CI-DESSOUS SONT LES ANCIENNES
		 *
		 *
		 *
		 */


		getUsers : function(){
			return accounts.slice(1);
		},


		// Récupère tous les Singers pour une campagne
		getSingers : function() {
			return _.map(db.singers, _.clone);//_.extends([], db.singers);
		},

		// Récupère un chanteur dans la blockchain
		getSinger : function(id) {
			var singers = _.map(db.singers, _.clone);
			return singers.find(function(singer) {
				return singer.id == id;
			});
		},

		voteForSinger : function(singer, secret, amount) {

		},
				/*showNewSinger : function() {
					competition.getArtist.call(0,{ from: accounts[0],gas:50000 }).then(function(nb) {
							console.log("artist");
							//console.log(nb);
						}).catch(function(e) {
						console.log(e);
					});
				},*/

		showNewSinger : function() {
			var factory= CompetitionFactory.deployed();

			factory.getCompetition.call(0,{ from: accounts[0] }).then(function(comp) {
         	//factory.testcomp.call({ from: accounts[0],gas:500000 }).then(function(o) {
         	//factory.testreturn.call({ from: accounts[0],gas:500000 }).then(function(o) {
         		//var lol = o.c[0];
	          //  console.log("4");
	            //console.log(lol);

				var comp1 = Competition.at(comp);
   
				comp1.getNumberArtists.call().then(function(o) {
			      console.log("got");
			      console.log(o.valueOf());

			      for (var i = 0; i < o.valueOf(); i++) {
			      	comp1.getArtist.call(i,{ from: accounts[2],gas:500000 }).then(function(o) {
				      //console.log("got");
				      console.log(o);
				    }).catch(function(e) {
				      console.log(e);
				    });	 
			      };
			    }).catch(function(e) {
			      console.log(e);
			    });	           
	        }).catch(function(e) {
	            console.log(e);
	        });

			/*var comp1 = Competition.deployed();

			comp1.getArtist.call(0,{ from: accounts[0],gas:50000 }).then(function(nb) {
					console.log("artist");
					console.log(nb);
					//console.log(nb);
				}).catch(function(e) {
				console.log(e);
			});*/
/*
			factory=CompetitionFactory.deployed();
			  factory.AddCompetition(1,1,1,{ from: accounts[0] }).then(function() {
			    console.log("compet ajoutée");
			  }).catch(function(e) {
			    console.log(e);
			  });*/


		},

		// Créer un nouveau singer dans la blockchain
		createNewSinger : function(nom, id, description) {

    		var factory= CompetitionFactory.deployed();
		    //factory.testadd({ from: accounts[0],gas:500000}).then(function(a) {


		    factory.getCompetition.call(0,{ from: accounts[0],gas:500000 }).then(function(comp){
				console.log("comp");

				console.log(comp);
				//var comp1 = Competition.at(comp);
				var comp1 = Competition.at(comp);
				console.log("comp1");

				console.log(comp1);
				
				console.log("ici");
				//comp1.AddArtist(nom,description,id,{ from: accounts[0],gas:500000 }).then(function(o) {
				Competition.at(comp).AddArtist("tangui","description","id",{ from: accounts[5],gas:500000 }).then(function(o) {
			      console.log("added");
			    }).catch(function(e) {
					console.log("la");
			      	console.log(e);
			    });
			}).catch(function(e) {
		      	console.log("bug 1");

		      	console.log(e);
		    });









			//factory=CompetitionFactory.deployed();

			/*var factory = CompetitionFactory.deployed();
			var competition = Competition.deployed();*/

			/*factory.test.call({ from: accounts[0],gas:500000 }).then(function(comp){
				console.log(comp);
			}).catch(function(e) {
		      	console.log("bug 1");

		      	console.log(e);
		    });*/

			/*factory.testcomp.call({ from: accounts[0],gas:500000 }).then(function(comp){
				console.log("ici :");
				console.log(comp.valueOf());
			}).catch(function(e) {
		      	console.log("bug get");

		      	console.log(e);
		    });*/
/*
			factory.getCompetition.call(0,{ from: accounts[0],gas:500000 }).then(function(comp){
				console.log(comp);
				//console.log("\""+ comp +"\"");
				//var comp1 = Competition.at(comp);
				var comp1 = Competition.deployed();
				console.log(comp1);
				
				comp1.AddArtist(nom,description,id,{ from: accounts[0],gas:500000 }).then(function(o) {
			      console.log("added");
			    }).catch(function(e) {
			      console.log(e);
			    });
			}).catch(function(e) {
		      	console.log("bug 1");

		      	console.log(e);
		    });*/
		},

		/*createCompetition : function() {
			var meta = CompetitionFactory.deployed();

			meta.addCompetition(Date.now(), Date.now());
		},*/

		getAdmin: function() {
			return accounts.slice(0,1);
		}


	}


	return _factory;

}]);
