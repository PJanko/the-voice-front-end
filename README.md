# Pour lancer le projet	

## lancement de testrpc avec une augmentation de la limite de GAS
	testrpc -l 0x10000000000

## Réinitialisation avec truffle

	truffle compile
	truffle migrate -reset
	truffle serve


## deployed()


La fonction ```CompetitionFactory.deployed()``` récupère uniquement le contrat déployé lors de ```truffle migrate```

Sur la page Administration, quand on créer une nouvelle Factory, on ne peut pas encore interagir avec puisqu'elle n'est pas déployée avec ```truffle migrate```