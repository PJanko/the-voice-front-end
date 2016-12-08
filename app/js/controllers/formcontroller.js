///////////////////////////////////////////////////////////////////////////////
// Home Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("FormController", ["$scope", "$rootScope", "EthereumFactory", "ToolFactory",
	function($scope,$rootScope, EthereumFactory, ToolFactory){

	console.log("Entered FormController");

	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Form Controller
	///////////////////////////////////////////////////////////////////////
  $scope.username = username;
  $scope.url = url;
  $scope.description = description;

  console.log($scope.username);
  console.log($scope.url);
  console.log($scope.description);



}]);
