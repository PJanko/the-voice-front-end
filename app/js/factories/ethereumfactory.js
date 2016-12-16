
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
angular.module("TheVoice").factory("EthereumFactory", function(){

	var _factory = {

		getCampaign : function(){

		},

		getUsers : function(){

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
				showNewSinger : function() {
					competition.getArtist.call(0,{ from: accounts[0],gas:50000 }).then(function(nb) {
							console.log("artist");
							//console.log(nb);
						}).catch(function(e) {
						console.log(e);
					});
				},

		// Créer un nouveau singer dans la blockchain
		createNewSinger : function(nom, id, description) {
			    /*var factory = CompetitionFactory.deployed();
			    var competition = Competition.deployed();*/

					competition.AddArtist.call(nom,description,id,{ from: accounts[0],gas:500000 }).then(function(o) {
			      console.log("added");
				/*	competition.getArtist.call(0,{ from: accounts[0],gas:50000 }).then(function(nb) {
							console.log("artist");
							console.log(nb);
						}).catch(function(e) {
						console.log(e);
					});*/
			    }).catch(function(e) {
			      console.log(e);
			    });
		},

		createCompetition : function() {

		},

		createFactory: function() {

		}

	}


	return _factory;

});
