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
      throw new Error("Competition error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Competition error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Competition contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Competition: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Competition.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Competition not deployed or address not set.");
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
        "constant": true,
        "inputs": [],
        "name": "getBalance",
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
        "constant": true,
        "inputs": [],
        "name": "artist_gagnant",
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
            "name": "_secret",
            "type": "string"
          },
          {
            "name": "nom_artist",
            "type": "string"
          }
        ],
        "name": "getHash",
        "outputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_nom",
            "type": "string"
          },
          {
            "name": "_description",
            "type": "string"
          },
          {
            "name": "_url",
            "type": "string"
          }
        ],
        "name": "AddArtist",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getTabCompte",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
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
        "name": "CloseCompetition",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_hash",
            "type": "bytes32"
          }
        ],
        "name": "Parier",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "balance_total",
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
        "constant": true,
        "inputs": [],
        "name": "balance_max",
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
        "constant": true,
        "inputs": [],
        "name": "getAmountWinner",
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
            "name": "_secret",
            "type": "string"
          },
          {
            "name": "nom_artist",
            "type": "string"
          }
        ],
        "name": "DecrypteVote",
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
        "name": "getArtist",
        "outputs": [
          {
            "name": "",
            "type": "string"
          },
          {
            "name": "",
            "type": "string"
          },
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "starttime",
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
        "constant": true,
        "inputs": [],
        "name": "getaddr",
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
        "inputs": [],
        "name": "deadline_secret",
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
        "name": "TakeRewardParieur",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "deadline_parier",
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
        "constant": true,
        "inputs": [],
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
        "inputs": [],
        "name": "TakeRewardArtist",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
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
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x606060405260405160608061134883395060c06040525160805160a05160008054600160a060020a0319166c01000000000000000000000000338102041781556003939093556001919091556002556112eb90819061005d90396000f3606060405236156100e55760e060020a600035046312065fe081146100ea5780631ef02bf71461010157806327cf399a1461010f5780632f93c5e8146101fe5780633c2c2198146102f15780633f24ec89146103575780634d6bb2f714610449578063531e9236146104d55780636278c418146104e3578063693521d5146104f15780637103c40114610544578063811dd0e2146107db5780638da58897146108945780638fb4aabf146108a2578063c079d5c6146108b0578063c3c2d1ae146108be578063ca392d9a14610a0f578063cb1e644c14610a1d578063dffa259714610a2d575b610002565b3461000257610a92600160a060020a033016315b90565b3461000257610a9260065481565b3461000257610a926004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f810183900483028401830190945283835297999860449892975091909101945090925082915084018382808284375094965050505050505060008282604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f150905001925050506040518091039020905092915050565b3461000257610aa46004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f8101839004830284018301909452838352979998604498929750919091019450909250829150840183828082843750506040805160209735808a0135601f81018a90048a0283018a019093528282529698976064979196506024919091019450909250829150840183828082843750949650505050505050600160a060020a03331660009081526008602052604090205460ff1615610c0757610002565b3461000257610aa6600654600c80546000928392600b928492908110156100025760009182526020808320600690920290910154600160a060020a03908116845283820194909452604092830182205482549094168252600b9052205490939092509050565b34610002576007805460ff1916600117905560008054600160a060020a039081168252600b60205260408083206064600230851631020490558254909116825281205460048054919091039055610aa490805b600c5481101561103b5760065481141561103f57600654600c80546064929081101561000257906000526020600020906006020160005060050154606202811561000257049150815081600b6000506000600c600050600660005054815481101561000257906000526020600020906006020160005054600160a060020a031681526020810191909152604001600020556004805483900390556110c0565b610aa4600435600160a060020a0333166000908152600a6020526040902080546001810180835582818380158290116110c8576005028160050283600052602060002091820191016110c891905b80821115610dfe5760008082556001820181905560028201805460ff1990811690915560038301919091556004820180549091169055600501610497565b3461000257610a9260045481565b3461000257610a9260055481565b3461000257600654600c8054610a9292600092600b9284929081101561000257906000526020600020906006020160005054600160a060020a0316815260208101919091526040016000205490506100fe565b3461000257610aa46004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f810183900483028401830190945283835297999860449892975091909101945090925082915084018382808284375094965050505050505060006000600060008585604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f1509050019250505060405180910390209350600a600050600033600160a060020a031681526020019081526020016000206000509250600960005085604051808280519060200190808383829060006004602084601f0104600302600f01f1509050019150509081526020016040518091039020600050549150600090505b825481101561113a578360001916838281548110156100025790600052602060002090600502016000505414156107d3578281815481101561000257906000526020600020906005020160005060010154600c805484908110156100025790600052602060002090600602016000506005018054909101905582546001908490839081101561000257906000526020600020906005020160005060020160006101000a81548160ff021916908360f860020a908102040217905550818382815481101561000257906000526020600020906005020160005060030155600554600c805484908110156100025790600052602060002090600602016000506005015411156107d3576006829055600c8054839081101561000257906000526020600020906006020160005060059081015490555b6001016106a0565b3461000257610abf60043560408051602081810183526000808352835180830185528181528451928301909452808252600c8054939493869081101561000257600091825260209182902060016006909202018181018054604080516002958316156101000260001901909216859004601f81018790048702830187019091528082529295509093928501926003860192859183018282801561116d5780601f106111425761010080835404028352916020019161116d565b3461000257610a9260035481565b3461000257610beb306100fe565b3461000257610a9260025481565b3461000257610aa4600160a060020a0333166000908152600a602052604081209080805b835483101561129e57600660005054848481548110156100025790600052602060002090600502016000506003015414801561093e5750838381548110156100025790600052602060002090600502016000506004015460ff16155b156112a45760018484815481101561000257906000526020600020906005020160005060040160006101000a81548160ff021916908360f860020a90810204021790555083838154811015610002579060005260206000209060050201600050600101546004546005548654929450909186908690811015610002579060005260206000209060050201600050600101548115610002570402905033600160a060020a03166108fc829081150290604051809050600060405180830381858888f1935050505015156112a457610002565b3461000257610a9260015481565b3461000257610a92600c546100fe565b3461000257600654600c8054610aa492908110156100025790600052602060002090600602016000505433600160a060020a039081169116141580610a885750600160a060020a0333166000908152600b6020526040902054155b156112af57610002565b60408051918252519081900360200190f35b005b6040805192835260208301919091528051918290030190f35b604051808060200180602001806020018481038452878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015610b275780820380516001836020036101000a031916815260200191505b508481038352868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015610b805780820380516001836020036101000a031916815260200191505b508481038252858181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015610bd95780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390f35b60408051600160a060020a039092168252519081900360200190f35b600c8054600181018083558281838015829011610c3d57600602816006028360005260206000209182019101610c3d9190610d2a565b505050600092835260208084206040805160c081018252338082528185018b9052918101899052606081018890526080810187905260a081018790526006909502909101805473ffffffffffffffffffffffffffffffffffffffff19166c010000000000000000000000009283029290920491909117815587516001808301805481895297859020959793959094600261010093861615939093026000190190941691909104601f9081018490048201938b0190839010610e3e57805160ff19168380011785555b50610e6e929150610dea565b505060048101805460ff19169055600060058201556006015b80821115610dfe57805473ffffffffffffffffffffffffffffffffffffffff1916815560018082018054600080835592600260001991831615610100029190910190911604601f819010610dd057505b5060028201600050805460018160011615610100020316600290046000825580601f10610e0257505b5060038201600050805460018160011615610100020316600290046000825580601f10610e205750610d11565b601f016020900490600052602060002090810190610d7a91905b80821115610dfe5760008155600101610dea565b5090565b601f016020900490600052602060002090810190610da39190610dea565b601f016020900490600052602060002090810190610d119190610dea565b82800160010185558215610d05579182015b82811115610d05578251826000505591602001919060010190610e50565b50506040820151816002016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610ecd57805160ff19168380011785555b50610efd929150610dea565b82800160010185558215610ec1579182015b82811115610ec1578251826000505591602001919060010190610edf565b50506060820151816003016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610f5c57805160ff19168380011785555b50610f8c929150610dea565b82800160010185558215610f50579182015b82811115610f50578251826000505591602001919060010190610f6e565b505060808201516004828101805460ff1990811660f860020a9485029490940493909317905560a09093015160059092019190915533600160a060020a031660009081526008602090815260408083208054909416600117909355600c54925188516000199490940195506009948994919384938681019392839286928492879291601f850104600302600f01f150905001915050908152602001604051809103902060005081905550505050565b5050565b6064600c60005082815481101561000257906000526020600020906006020160005060050154600802811561000257049150815081600b6000506000600c60005084815481101561000257906000526020600020906006020160005054600160a060020a031681526020810191909152604001600020556004805483900390555b6001016103aa565b50505060009283525060208083206040805160a081018252868152349381018490529081018590526060810185905260800184905260059092029091019283556001830181905560028301805460ff199081169091556003840192909255600492830180549092169091558154019055565b505050505050565b820191906000526020600020905b81548152906001019060200180831161115057829003601f168201915b5050855460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152959850879450925084019050828280156111fb5780601f106111d0576101008083540402835291602001916111fb565b820191906000526020600020905b8154815290600101906020018083116111de57829003601f168201915b5050845460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152959750869450925084019050828280156112895780601f1061125e57610100808354040283529160200191611289565b820191906000526020600020905b81548152906001019060200180831161126c57829003601f168201915b50505050509050935093509350509193909250565b50505050565b6001909201916108e2565b600160a060020a0333166000818152600b6020526040808220829055516108fc919081818181818888f1935050505015156112e957610002565b56",
    "events": {},
    "updated_at": 1481996686249,
    "links": {},
    "address": "0x624aba0d13082829e72a59a7ca6119cb0ccd7710"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Competition";
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
    window.Competition = Contract;
  }
})();
