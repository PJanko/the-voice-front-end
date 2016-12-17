///////////////////////////////////////////////////////////////////////////////
// Home Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("HomeController", ["$scope", "$rootScope", "EthereumFactory", "ToolFactory",
	function($scope,$rootScope, EthereumFactory, ToolFactory){

	console.log("Entered HomeController");

	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Home Controller
	///////////////////////////////////////////////////////////////////////

	$scope.singers = EthereumFactory.getSingers();

	$scope.singers.forEach(function(singer) {
		singer.thumbnail = ToolFactory.getYoutubeThumbnail(singer['video-id']);
	});

	$scope.addCompetition = EthereumFactory.createCompetition;

}]);
