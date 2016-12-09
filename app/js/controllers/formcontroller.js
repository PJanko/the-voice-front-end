///////////////////////////////////////////////////////////////////////////////
// Home Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("FormController", ["$scope", "$rootScope", "EthereumFactory", "ToolFactory",
	function($scope,$rootScope, EthereumFactory, ToolFactory){

	console.log("Entered FormController");

	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Form Controller
	///////////////////////////////////////////////////////////////////////

  $scope.register = function() {
    var id = ToolFactory.getYoutubeID($scope.url);
    EthereumFactory.createNewSinger($scope.username, id, $scope.description);
  } 


}]);
