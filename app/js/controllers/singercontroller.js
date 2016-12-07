///////////////////////////////////////////////////////////////////////////////
// Home Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("SingerController", ["$scope", "$rootScope", "$routeParams", "EthereumFactory", "ToolFactory", 
	function($scope,$rootScope, $routeParams, EthereumFactory, ToolFactory){

	console.log("Entered SingerController");

	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Home Controller
	///////////////////////////////////////////////////////////////////////
	$scope.singer = EthereumFactory.getSinger($routeParams.id);
	$scope.singer.url = ToolFactory.getYoutubeURL($scope.singer['video-id']);
	
	$scope.height = 360*window.innerWidth/640;
	$scope.width = window.innerWidth;

	$scope.vote = function() {
		if($scope.amount == null || $scope.secret == null) throw new Error('Impossible de voter - Montant et/ou Secret vide');
		
		EthereumFactory.voteForSinger($scope.singer, $scope.amount, $scope.secret);

	}


}]);