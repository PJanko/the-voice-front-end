///////////////////////////////////////////////////////////////////////////////
// Home Controller
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").controller("AdminController", ["$scope", "$rootScope", "EthereumFactory", "ToolFactory",
	function($scope,$rootScope, EthereumFactory, ToolFactory){

	console.log("Entered AdminController");

	///////////////////////////////////////////////////////////////////////
	// Initialisation Code for Form Controller
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

	refreshDetails();

	$scope.createFactory = function() {
		if(!$scope.adminSelected) return alert("Vous devez choisir l'administrateur de la Factory");
		EthereumFactory.createFactory($scope.adminSelected, function() {
			
		});
	}

	$scope.createCompetition = function() {
		if(!$scope.adminSelected) return alert("Vous devez choisir l'administrateur de la Factory");
		var inscrire = convertDateToTimestamp($('#inscrire').val());
		var vote = convertDateToTimestamp($('#vote').val());
		var cloture = convertDateToTimestamp($('#cloture').val());

		if( ! (inscrire && vote && cloture) ) return alert("Vous devez renseigner toutes les dates");
		
		EthereumFactory.createCompetition($scope.adminSelected, inscrire, vote, cloture, function(err, instance) {
			refreshDetails();
		});
	}

	$scope.refresh = function() {
	    refreshDetails();
	}

	function convertDateToTimestamp(date) {
		if(!date) return false;
		date=date.split("-");
		var newDate=date[1]+"/"+date[2]+"/"+date[0];
		return new Date(newDate).getTime()/1000;
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
