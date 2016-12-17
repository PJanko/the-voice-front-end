///////////////////////////////////////////////////////////////////////////////
// Reward Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("RewardController", ["$scope", "$rootScope", "EthereumFactory", "ToolFactory",
	function($scope,$rootScope, EthereumFactory, ToolFactory){

	console.log("Entered RewardController");



	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Reward Controller
	///////////////////////////////////////////////////////////////////////
  var fa = EthereumFactory.getDeployedFactory();

	if(fa) {
		$scope.existingAddress = fa.address;
		$scope.exists = true;
	} else {
		$scope.exists = false;
	}

  EthereumFactory.getAccounts(function(accounts) {
		$scope.accounts = accounts;
	});

	EthereumFactory.getCurrentCompetition( function(err, compet) {
		if(err) return alert('Impossible de récupérer la dernière competition');
	});

  refreshDetails();

  $scope.register = function() {
    if(!$scope.adminSelected) return alert("Vous devez choisir l'administrateur de la Factory");

    EthereumFactory.TakeRewardParieur();

  }

  $scope.refresh = function() {
	    refreshDetails();
	}

  function refreshDetails() {
		EthereumFactory.getCompetitionsSummary( function(err, compet) {
			if(err) return alert('Impossible de récupérer le résumé des competitions');
			$scope.details = compet;
		});
		EthereumFactory.getCurrentCompetition( function(err, compet) {
			if(err) return alert('Impossible de récupérer la dernière competition');
			console.log(compet);
		})
	}


}]);
