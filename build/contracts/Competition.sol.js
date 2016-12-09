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
        "constant": false,
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
        "payable": false,
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x6060604052346100005760405160608061108d8339810160409081528151602083015191909201515b60008054600160a060020a0319166c01000000000000000000000000338102041790556003839055600182905560028190555b5050505b6110208061006d6000396000f3606060405236156100a35760e060020a600035046312065fe081146100a85780632f93c5e8146100c75780633f24ec89146101965780634d6bb2f7146101a5578063531e9236146101b25780637103c401146101d1578063811dd0e2146102635780638da58897146102e1578063c079d5c614610300578063c3c2d1ae1461031f578063ca392d9a1461032e578063cb1e644c1461034d578063dffa25971461036c575b610000565b34610000576100b561037b565b60408051918252519081900360200190f35b3461000057610194600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375094965061038295505050505050565b005b346100005761019461086c565b005b610194600435610a7c565b005b34610000576100b5610b7a565b60408051918252519081900360200190f35b3461000057610194600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b01803591820183900483028401830190945280835297999881019791965091820194509250829150840183828082843750949650610b8095505050505050565b005b3461000057610273600435610daf565b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156102d35780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100b5610e76565b60408051918252519081900360200190f35b34610000576100b5610e7c565b60408051918252519081900360200190f35b3461000057610194610e82565b005b34610000576100b5610f8b565b60408051918252519081900360200190f35b34610000576100b5610f91565b60408051918252519081900360200190f35b3461000057610194610f98565b005b6004545b90565b60015442111561039157610865565b6003544211156103a057610865565b600160a060020a03331660009081526008602052604090205460ff16156103c657610000565b600c805480600101828181548183558181151161055a5760060281600602836000526020600020918201910161055a91905b8082111561047a57805473ffffffffffffffffffffffffffffffffffffffff1916815560018082018054600080835592600260001991831615610100029190910190911604601f81901061044c575061047e565b601f01602090049060005260206000209081019061047e91905b8082111561047a5760008155600101610466565b5090565b5b5060028201805460018160011615610100020316600290046000825580601f106104a957506104db565b601f0160209004906000526020600020908101906104db91905b8082111561047a5760008155600101610466565b5090565b5b5060038201805460018160011615610100020316600290046000825580601f106105065750610538565b601f01602090049060005260206000209081019061053891905b8082111561047a5760008155600101610466565b5090565b5b505060048101805460ff19169055600060058201556006016103f8565b5090565b5b505050916000526020600020906006020160005b506040805160c0810182523380825260208083018990529282018790526060820186905260006080830181905260a08301819052845473ffffffffffffffffffffffffffffffffffffffff19166c0100000000000000000000000092830292909204919091178455875160018086018054818552938690209496959094600261010093861615939093026000190190941691909104601f908101829004840193918b019083901061062b57805160ff1916838001178555610658565b82800160010185558215610658579182015b8281111561065857825182559160200191906001019061063d565b5b506106799291505b8082111561047a5760008155600101610466565b5090565b50506040820151816002019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106106cd57805160ff19168380011785556106fa565b828001600101855582156106fa579182015b828111156106fa5782518255916020019190600101906106df565b5b5061071b9291505b8082111561047a5760008155600101610466565b5090565b50506060820151816003019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061076f57805160ff191683800117855561079c565b8280016001018555821561079c579182015b8281111561079c578251825591602001919060010190610781565b5b506107bd9291505b8082111561047a5760008155600101610466565b5090565b505060808201516004828101805460ff1990811660f860020a9485029490940493909317905560a09093015160059092019190915533600160a060020a031660009081526008602090815260408083208054909416600117909355600c54925188516000199490940195506009948994919384938681019392839286928492879291601f850104600302600f01f1509050019150509081526020016040518091039020819055505b5b5b505050565b600060025442101561087d57610a76565b60075460ff1615156001141561089257610a76565b506007805460ff1916600117905560008054600160a060020a039081168252600b602052604080832060646002308516310204905582549091168252812054600480549190910390555b600c54811015610a76576006548114156109b3576064600c600654815481101561000057906000526020600020906006020160005b506005015460620281156100005704600b6000600c600654815481101561000057906000526020600020906006020160005b5054600160a060020a031681526020810191909152604001600090812091909155600654600c8054600b93929081101561000057906000526020600020906006020160005b5054600160a060020a0316815260208101919091526040016000205460048054919091039055610a6d565b6064600c82815481101561000057906000526020600020906006020160005b506005015460080281156100005704600b6000600c84815481101561000057906000526020600020906006020160005b5054600160a060020a031681526020810191909152604001600090812091909155600c8054600b929190849081101561000057906000526020600020906006020160005b5054600160a060020a03168152602081019190915260400160002054600480549190910390555b5b6001016108dc565b5b5b5b50565b600354421015610a8b57610a76565b600154421115610a9a57610a76565b600160a060020a0333166000908152600a602052604090208054600181018083558281838015829011610b1357600402816004028360005260206000209182019101610b1391905b8082111561047a5760008082556001820181905560028201805460ff191690556003820155600401610ae2565b5090565b5b505050916000526020600020906004020160005b50604080516080810182528481523460208201819052600092820183905260609091018290528483556001830181905560028301805460ff19169055600390920155600480549091019055505b5b5b50565b60045481565b6000600060006000600154421015610b9757610da4565b600254421115610ba657610da4565b8585604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f1509050019250505060405180910390209350600a600033600160a060020a031681526020019081526020016000209250600985604051808280519060200190808383829060006004602084601f0104600302600f01f1509050019150509081526020016040518091039020549150600090505b8254811015610da45783600019168382815481101561000057906000526020600020906004020160005b50541415610d9a578281815481101561000057906000526020600020906004020160005b5060010154600c83815481101561000057906000526020600020906006020160005b506005018054909101905582546001908490839081101561000057906000526020600020906004020160005b5060020160006101000a81548160ff021916908360f860020a908102040217905550818382815481101561000057906000526020600020906004020160005b5060030155600554600c8054849081101561000057906000526020600020906006020160005b50600501541115610d9a576006829055600c8054839081101561000057906000526020600020906006020160005b5060059081015490555b5b5b600101610c61565b5b5b5b505050505050565b6020604051908101604052806000815260200150600c6000815481101561000057906000526020600020906006020160005b5060019081018054604080516020600295841615610100026000190190931694909404601f810183900483028501830190915280845290830182828015610e695780601f10610e3e57610100808354040283529160200191610e69565b820191906000526020600020905b815481529060010190602001808311610e4c57829003601f168201915b505050505090505b919050565b60035481565b60025481565b60075460009081908190819060ff161515610e9c57610f83565b600160a060020a0333166000908152600a60205260408120945092505b8354831015610f83576006548484815481101561000057906000526020600020906004020160005b50600301541415610f76578383815481101561000057906000526020600020906004020160005b506001015491506004546005548585815481101561000057906000526020600020906004020160005b50600101548115610000570402905033600160a060020a03166108fc829081150290604051809050600060405180830381858888f193505050501515610f7657610000565b5b5b600190920191610eb9565b5b5b50505050565b60015481565b600c545b90565b60075460ff161515610fa95761101c565b600c600654815481101561000057906000526020600020906006020160005b505433600160a060020a03908116911614610fe257610000565b600160a060020a0333166000818152600b602052604080822054905181156108fc0292818181858888f19350505050151561101c57610000565b5b5b56",
    "events": {},
    "updated_at": 1481283002375
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
