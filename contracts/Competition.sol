pragma solidity ^0.4.2;

contract Competition {
    address admin;
    
    uint public deadline_parier;
    uint public deadline_secret;
    uint public starttime;
    uint public balance_total;
    uint public balance_max;
    uint public artist_gagnant;
    
    bool closed;
    mapping(address=>bool) address_artists; // Mapping : couple clé valeur 
    mapping(string=>uint) index_artists; // Mapping : couple clé valeur 

    mapping(address=>Vote[]) encrypted_vote; // Mapping : couple clé valeur
    mapping(address=>uint) compte; // Mapping : couple clé valeur 

    //mapping(string=>uint) funded; // Mapping : couple clé valeur 
    Artist[] artists; 

    struct Artist{    
        address owner;
        string nom;
        string description;
        string url;
        bool success;
        uint balance;
    }
    
    
    struct Vote{    
        bytes32 hash_id;
        uint amount;
        bool confirm;
        uint artist_decrypter;
        bool retirer;
    }
    
    
    modifier afterDeadlineParier(){
        //if(now< deadline_parier) return;
        _;
    }
    modifier beforeDeadlineParier(){
        //if(now> deadline_parier) return;
        _;
    }
    modifier afterDeadlineSecret(){
        //if(now< deadline_secret) return;
        _;
    }
    modifier beforeDeadlineSecret(){
        //if(now> deadline_secret) return;
        _;
    }
    modifier isClosed(){
        //if (closed==false) return;
        _;
    }
    modifier isNotClosed(){
        //if (closed==true) return;
        _;
    }
    modifier isStarted(){
        //if (now<starttime) return;
        _;
    }   
    modifier isNotStarted(){
        //if (now>starttime) return;
        _;
    }
    
    
    
    
    
    function Competition(uint _starttime,uint _deadline_parier, uint _deadline_secret) {
        admin = msg.sender;
        starttime=_starttime;
        deadline_parier=_deadline_parier;
        deadline_secret=_deadline_secret;
    }
    
    function AddArtist(string _nom,string _description,string _url) beforeDeadlineParier isNotStarted {
        //if(address_artists[msg.sender]) throw;
        artists.push(Artist(msg.sender,_nom,_description,_url,false,0));
        address_artists[msg.sender] = true;
        index_artists[_nom] = artists.length - 1;
    }
    
    function Parier(bytes32 _hash) payable isStarted beforeDeadlineParier{ // pour le moment hash est l'index de l'artiste
        encrypted_vote[msg.sender].push(Vote(_hash,msg.value,false,0,false));
        balance_total+=msg.value;
    }
    
    // fonction juste pour nos tests
    function getHash(string _secret, string nom_artist) returns(bytes32){
        return(sha3(_secret, nom_artist));
    }
    
    function DecrypteVote(string _secret, string nom_artist) afterDeadlineParier beforeDeadlineSecret{
        bytes32 result = sha3(_secret, nom_artist);  // WARNING cast
        Vote[] votes = encrypted_vote[msg.sender];
        uint index = index_artists[nom_artist];
        for(uint i = 0; i < votes.length; i ++){
            if(votes[i].hash_id == result){
                artists[index].balance += votes[i].amount;
                votes[i].confirm = true;
                votes[i].artist_decrypter = index;
                if(artists[index].balance>balance_max){
                    artist_gagnant=index;
                    balance_max=artists[index].balance;
                }
            }
        }
    }
    
    function CloseCompetition() afterDeadlineSecret isNotClosed{
        closed = true;
        compte[admin]= this.balance*2 /100;
        balance_total -= compte[admin];
        uint temp = 0;
        for(uint i = 0; i < artists.length; i++){
            if(i == artist_gagnant){
                temp = artists[artist_gagnant].balance*98 /100;
                compte[artists[artist_gagnant].owner]=temp;
                balance_total = balance_total - temp;   // balance_total -= compte[artists[artist_gagnant].owner];
            }
            else{
                temp = artists[i].balance*8 /100;
                compte[artists[i].owner] = temp;
                balance_total = balance_total - temp;   // balance_total -= compte[artists[i].owner];
            }
        }
    }
    
    function TakeRewardArtist() isClosed{
        if(msg.sender != artists[artist_gagnant].owner || compte[msg.sender]==0) throw;
        compte[msg.sender]=0;
        if(!msg.sender.send(compte[msg.sender])){
            throw;
        } 
    }
    
    function TakeRewardParieur() isClosed{
        Vote[] votes = encrypted_vote[msg.sender];
        
        for(uint i = 0; i < votes.length; i++){
            if(votes[i].artist_decrypter == artist_gagnant && votes[i].retirer == false) {
                votes[i].retirer = true;
                uint temp = votes[i].amount;
                uint gain = (votes[i].amount/balance_max) * balance_total;
                if(!msg.sender.send(gain)){
                    throw;
                } 
            }
        }
    }
    
    function getArtist (uint _index) constant returns(string,string,string){
        Artist art = artists[_index];
        return(art.nom,art.description,art.url);
    }
    
    function getBalance() constant returns(uint){
        return this.balance;
    }
    
    function getNumberArtists() constant returns(uint){
        return (artists.length);
    }   
    
    function getAmountWinner() constant returns(uint){
        return (compte[artists[artist_gagnant].owner]);
    }
    
    function getTabCompte() constant returns(uint,uint){
        return (compte[artists[artist_gagnant].owner],compte[admin]);
    }

    function getaddr() constant returns (address){
        return(this);
    }
}
    
