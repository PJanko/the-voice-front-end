
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

		// Créer un nouveau singer dans la blockchain
		createNewSinger : function(nom, id, description) {
			var compet = Competition.deployed();

			//compet.AddArti
		},

		createCompetition : function() {

		},

		createFactory: function() {

		}

	}


	return _factory;

});
