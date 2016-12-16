module.exports = function(deployer) {
  deployer.deploy(Competition);
  deployer.autolink();
  deployer.deploy(CompetitionFactory);
  deployer.deploy(Test);
};