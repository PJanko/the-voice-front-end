pragma solidity ^0.4.2;


import "./Competition.sol";
contract CompetitionFactory {
    address admin;
    Competition[] competitions;

    modifier isAdmin(){
        //if (msg.sender!=admin) return;
        _;
    }       
    
    function CompetitionFactory() {
        admin = msg.sender;
    }
    
    function AddCompetition(uint _starttime,uint _deadline_parier, uint _deadline_secret) isAdmin{
        competitions.push(new Competition(_starttime,_deadline_parier,_deadline_secret));
    }
    
    function getNumberArtists(uint _index) constant returns(uint) {
        return competitions[_index].getNumberArtists();
    }
    function getCurrentBalance(uint _index) constant returns(uint) { 
        return competitions[_index].getBalance();
    }
    
    function getCompetition(uint _index) constant returns(address){
        return competitions[_index];
    }

    function getCompetitionsLength() returns(uint){
        return competitions.length;
    }    
}
    
