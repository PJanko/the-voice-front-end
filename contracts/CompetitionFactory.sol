pragma solidity ^0.4.2;


import "./Competition.sol";
contract CompetitionFactory {
    address admin;
    Competition[] competitions;
    uint temp;


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
    
    function getCompetition(uint _index) returns(Competition){
        return competitions[_index];
    }

    function test() returns(uint){
        return 1;
    }


    function testcomp() returns(uint){
        return competitions.length;
    }    

    function testadd() {
        temp = temp + 2;
    }         

    function testreturn() returns(uint){
        return (42);
    }
}
    
