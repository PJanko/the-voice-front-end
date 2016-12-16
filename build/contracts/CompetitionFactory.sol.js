var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("CompetitionFactory error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("CompetitionFactory error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("CompetitionFactory contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of CompetitionFactory: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to CompetitionFactory.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: CompetitionFactory not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "_starttime",
            "type": "uint256"
          },
          {
            "name": "_deadline_parier",
            "type": "uint256"
          },
          {
            "name": "_deadline_secret",
            "type": "uint256"
          }
        ],
        "name": "AddCompetition",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_index",
            "type": "uint256"
          }
        ],
        "name": "getNumberArtists",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_index",
            "type": "uint256"
          }
        ],
        "name": "getCompetition",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_index",
            "type": "uint256"
          }
        ],
        "name": "getCurrentBalance",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "test",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x6060604052600080546c0100000000000000000000000033810204600160a060020a03199091161790556115db806100376000396000f3606060405260e060020a60003504631340e430811461004a5780633459e6bb14610076578063f403646614610106578063f7e91a291461013f578063f8a8fd6d146101cf575b610002565b34610002576101e960043560243560443560005433600160a060020a03908116911614610207576102bf565b34610002576101d76004356000600160005082815481101561000257906000526020600020900160009054906101000a9004600160a060020a0316600160a060020a031663cb1e644c6000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100025760325a03f11561000257505060405151915061013a9050565b34610002576101eb6004356000600160005082815481101561000257600091825260209091200154600160a060020a031690505b919050565b34610002576101d76004356000600160005082815481101561000257906000526020600020900160009054906101000a9004600160a060020a0316600160a060020a03166312065fe06000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100025760325a03f11561000257505060405151915061013a9050565b346100025760015b60408051918252519081900360200190f35b005b60408051600160a060020a039092168252519081900360200190f35b600180548082018083558281838015829011610244576000838152602090206102449181019083015b808211156102c45760008155600101610230565b505050919090600052602060002090016000858585604051611313806102c8833901808481526020018381526020018281526020019350505050604051809103906000f0801561000257909190916101000a815481600160a060020a0302191690836c01000000000000000000000000908102040217905550505b505050565b509056606060405260405160608061131383395060c06040525160805160a05160008054600160a060020a0319166c01000000000000000000000000338102041781556003939093556001919091556002556112b690819061005d90396000f3606060405236156100da5760e060020a600035046312065fe081146100df5780631ef02bf7146100f657806327cf399a146101045780632f93c5e8146101f35780633c2c2198146102e65780633f24ec891461034c5780634d6bb2f71461043e578063531e9236146104ca5780636278c418146104d8578063693521d5146104e65780637103c40114610539578063811dd0e2146107d05780638da5889714610889578063c079d5c614610897578063c3c2d1ae146108a5578063ca392d9a146109f6578063cb1e644c14610a04578063dffa259714610a14575b610002565b3461000257610a79600160a060020a033016315b90565b3461000257610a7960065481565b3461000257610a796004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f810183900483028401830190945283835297999860449892975091909101945090925082915084018382808284375094965050505050505060008282604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f150905001925050506040518091039020905092915050565b3461000257610a8b6004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f8101839004830284018301909452838352979998604498929750919091019450909250829150840183828082843750506040805160209735808a0135601f81018a90048a0283018a019093528282529698976064979196506024919091019450909250829150840183828082843750949650505050505050600160a060020a03331660009081526008602052604090205460ff1615610bd257610002565b3461000257610a8d600654600c80546000928392600b928492908110156100025760009182526020808320600690920290910154600160a060020a03908116845283820194909452604092830182205482549094168252600b9052205490939092509050565b34610002576007805460ff1916600117905560008054600160a060020a039081168252600b60205260408083206064600230851631020490558254909116825281205460048054919091039055610a8b90805b600c548110156110065760065481141561100a57600654600c80546064929081101561000257906000526020600020906006020160005060050154606202811561000257049150815081600b6000506000600c600050600660005054815481101561000257906000526020600020906006020160005054600160a060020a0316815260208101919091526040016000205560048054839003905561108b565b610a8b600435600160a060020a0333166000908152600a6020526040902080546001810180835582818380158290116110935760050281600502836000526020600020918201910161109391905b80821115610dc95760008082556001820181905560028201805460ff199081169091556003830191909155600482018054909116905560050161048c565b3461000257610a7960045481565b3461000257610a7960055481565b3461000257600654600c8054610a7992600092600b9284929081101561000257906000526020600020906006020160005054600160a060020a0316815260208101919091526040016000205490506100f3565b3461000257610a8b6004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f810183900483028401830190945283835297999860449892975091909101945090925082915084018382808284375094965050505050505060006000600060008585604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f1509050019250505060405180910390209350600a600050600033600160a060020a031681526020019081526020016000206000509250600960005085604051808280519060200190808383829060006004602084601f0104600302600f01f1509050019150509081526020016040518091039020600050549150600090505b8254811015611105578360001916838281548110156100025790600052602060002090600502016000505414156107c8578281815481101561000257906000526020600020906005020160005060010154600c805484908110156100025790600052602060002090600602016000506005018054909101905582546001908490839081101561000257906000526020600020906005020160005060020160006101000a81548160ff021916908360f860020a908102040217905550818382815481101561000257906000526020600020906005020160005060030155600554600c805484908110156100025790600052602060002090600602016000506005015411156107c8576006829055600c8054839081101561000257906000526020600020906006020160005060059081015490555b600101610695565b3461000257610aa660043560408051602081810183526000808352835180830185528181528451928301909452808252600c8054939493869081101561000257600091825260209182902060016006909202018181018054604080516002958316156101000260001901909216859004601f8101879004870283018701909152808252929550909392850192600386019285918301828280156111385780601f1061110d57610100808354040283529160200191611138565b3461000257610a7960035481565b3461000257610a7960025481565b3461000257610a8b600160a060020a0333166000908152600a602052604081209080805b83548310156112695760066000505484848154811015610002579060005260206000209060050201600050600301541480156109255750838381548110156100025790600052602060002090600502016000506004015460ff16155b1561126f5760018484815481101561000257906000526020600020906005020160005060040160006101000a81548160ff021916908360f860020a90810204021790555083838154811015610002579060005260206000209060050201600050600101546004546005548654929450909186908690811015610002579060005260206000209060050201600050600101548115610002570402905033600160a060020a03166108fc829081150290604051809050600060405180830381858888f19350505050151561126f57610002565b3461000257610a7960015481565b3461000257610a79600c546100f3565b3461000257600654600c8054610a8b92908110156100025790600052602060002090600602016000505433600160a060020a039081169116141580610a6f5750600160a060020a0333166000908152600b6020526040902054155b1561127a57610002565b60408051918252519081900360200190f35b005b6040805192835260208301919091528051918290030190f35b604051808060200180602001806020018481038452878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015610b0e5780820380516001836020036101000a031916815260200191505b508481038352868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015610b675780820380516001836020036101000a031916815260200191505b508481038252858181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015610bc05780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390f35b600c8054600181018083558281838015829011610c0857600602816006028360005260206000209182019101610c089190610cf5565b505050600092835260208084206040805160c081018252338082528185018b9052918101899052606081018890526080810187905260a081018790526006909502909101805473ffffffffffffffffffffffffffffffffffffffff19166c010000000000000000000000009283029290920491909117815587516001808301805481895297859020959793959094600261010093861615939093026000190190941691909104601f9081018490048201938b0190839010610e0957805160ff19168380011785555b50610e39929150610db5565b505060048101805460ff19169055600060058201556006015b80821115610dc957805473ffffffffffffffffffffffffffffffffffffffff1916815560018082018054600080835592600260001991831615610100029190910190911604601f819010610d9b57505b5060028201600050805460018160011615610100020316600290046000825580601f10610dcd57505b5060038201600050805460018160011615610100020316600290046000825580601f10610deb5750610cdc565b601f016020900490600052602060002090810190610d4591905b80821115610dc95760008155600101610db5565b5090565b601f016020900490600052602060002090810190610d6e9190610db5565b601f016020900490600052602060002090810190610cdc9190610db5565b82800160010185558215610cd0579182015b82811115610cd0578251826000505591602001919060010190610e1b565b50506040820151816002016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610e9857805160ff19168380011785555b50610ec8929150610db5565b82800160010185558215610e8c579182015b82811115610e8c578251826000505591602001919060010190610eaa565b50506060820151816003016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610f2757805160ff19168380011785555b50610f57929150610db5565b82800160010185558215610f1b579182015b82811115610f1b578251826000505591602001919060010190610f39565b505060808201516004828101805460ff1990811660f860020a9485029490940493909317905560a09093015160059092019190915533600160a060020a031660009081526008602090815260408083208054909416600117909355600c54925188516000199490940195506009948994919384938681019392839286928492879291601f850104600302600f01f150905001915050908152602001604051809103902060005081905550505050565b5050565b6064600c60005082815481101561000257906000526020600020906006020160005060050154600802811561000257049150815081600b6000506000600c60005084815481101561000257906000526020600020906006020160005054600160a060020a031681526020810191909152604001600020556004805483900390555b60010161039f565b50505060009283525060208083206040805160a081018252868152349381018490529081018590526060810185905260800184905260059092029091019283556001830181905560028301805460ff199081169091556003840192909255600492830180549092169091558154019055565b505050505050565b820191906000526020600020905b81548152906001019060200180831161111b57829003601f168201915b5050855460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152959850879450925084019050828280156111c65780601f1061119b576101008083540402835291602001916111c6565b820191906000526020600020905b8154815290600101906020018083116111a957829003601f168201915b5050845460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152959750869450925084019050828280156112545780601f1061122957610100808354040283529160200191611254565b820191906000526020600020905b81548152906001019060200180831161123757829003601f168201915b50505050509050935093509350509193909250565b50505050565b6001909201916108c9565b600160a060020a0333166000818152600b6020526040808220829055516108fc919081818181818888f1935050505015156112b457610002565b56",
    "events": {},
    "updated_at": 1481819027535,
    "links": {},
    "address": "0x9525f5ffdb489ece2351d92950c26b8899f756ab"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "CompetitionFactory";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.CompetitionFactory = Contract;
  }
})();
