///////////////////////////////////////////////////////////////////////////////
// Home Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("FormController", ["$scope", "$rootScope", "EthereumFactory", "ToolFactory",
	function($scope,$rootScope, EthereumFactory, ToolFactory){

	console.log("Entered FormController");

	EthereumFactory.getAccounts(function(accounts) {
		$scope.accounts = accounts;
	});

	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Form Controller
	///////////////////////////////////////////////////////////////////////

  $scope.register = function() {
  	if(!$scope.adminSelected) return alert("Vous devez choisir l'adresse du chanteur");

    var id = ToolFactory.getYoutubeID($scope.url);
    EthereumFactory.createNewSinger($scope.adminSelected,$scope.username, id, $scope.description);


  }
	$scope.show = function() {

    EthereumFactory.showNewSinger();

  }
}]);
