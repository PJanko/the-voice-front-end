module.exports = function(deployer) {
  deployer.deploy(Competition);
  deployer.autolink();
  deployer.deploy(CompetitionFactory);
<<<<<<< HEAD
  //deployer.deploy(Test);
=======
  deployer.deploy(Test);
>>>>>>> 67c9b79d3065369d57bc402727562cec049e1957
};