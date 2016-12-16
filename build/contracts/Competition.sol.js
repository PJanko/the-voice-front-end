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
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x6060604052604051606080610f5583395060c06040525160805160a05160008054600160a060020a0319166c0100000000000000000000000033810204178155600393909355600191909155600255610ef890819061005d90396000f3606060405236156100a35760e060020a600035046312065fe081146100a85780632f93c5e8146100b75780633f24ec89146101935780634d6bb2f7146101ac578063531e9236146101c15780637103c401146101cf578063811dd0e21461027a5780638da5889714610310578063c079d5c61461031e578063c3c2d1ae1461032c578063ca392d9a14610350578063cb1e644c1461035e578063dffa25971461036e575b610002565b34610002576103856004545b90565b34610002576103976004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f8101839004830284018301909452838352979998604498929750919091019450909250829150840183828082843750506040805160209735808a0135601f81018a90048a0283018a019093528282529698976064979196506024919091019450909250829150840183828082843750949650505050505050600154421115610407576104e7565b3461000257610397600254600090421015610871575b50565b610397600435600354421015610a71576101a9565b346100025761038560045481565b34610002576103976004808035906020019082018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843750506040805160208835808b0135601f81018390048302840183019094528383529799986044989297509190910194509092508291508401838280828437509496505050505050506000600060006000600160005054421015610b51575b505050505050565b346100025761039960043560408051602081019091526000808252600c805490919081101561000257600091825260209182902060016006909202018101805460408051600294831615610100026000190190921693909304601f810185900485028201850190935282815292909190830182828015610d8d5780601f10610d6257610100808354040283529160200191610d8d565b346100025761038560035481565b346100025761038560025481565b346100025761039760075460009081908190819060ff161515610d99575b50505050565b346100025761038560015481565b3461000257610385600c546100b4565b346100025761039760075460ff161515610e83575b565b60408051918252519081900360200190f35b005b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156103f95780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b600354421115610416576104e7565b600160a060020a03331660009081526008602052604090205460ff16156104ec57610002565b505060808201516004828101805460ff1990811660f860020a9485029490940493909317905560a09093015160059092019190915533600160a060020a031660009081526008602090815260408083208054909416600117909355600c54925188516000199490940195506009948994919384938681019392839286928492879291601f850104600302600f01f1509050019150509081526020016040518091039020600050819055505b505050565b600c805460018101808355828183801582901161052257600602816006028360005260206000209182019101610522919061060f565b505050600092835260208084206040805160c081018252338082528185018b9052918101899052606081018890526080810187905260a081018790526006909502909101805473ffffffffffffffffffffffffffffffffffffffff19166c010000000000000000000000009283029290920491909117815587516001808301805481895297859020959793959094600261010093861615939093026000190190941691909104601f9081018490048201938b019083901061072357805160ff19168380011785555b506107539291506106cf565b505060048101805460ff19169055600060058201556006015b808211156106e357805473ffffffffffffffffffffffffffffffffffffffff1916815560018082018054600080835592600260001991831615610100029190910190911604601f8190106106b557505b5060028201600050805460018160011615610100020316600290046000825580601f106106e757505b5060038201600050805460018160011615610100020316600290046000825580601f1061070557506105f6565b601f01602090049060005260206000209081019061065f91905b808211156106e357600081556001016106cf565b5090565b601f01602090049060005260206000209081019061068891906106cf565b601f0160209004906000526020600020908101906105f691906106cf565b828001600101855582156105ea579182015b828111156105ea578251826000505591602001919060010190610735565b50506040820151816002016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106107b257805160ff19168380011785555b506107e29291506106cf565b828001600101855582156107a6579182015b828111156107a65782518260005055916020019190600101906107c4565b50506060820151816003016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061084157805160ff19168380011785555b5061043c9291506106cf565b82800160010185558215610835579182015b82811115610835578251826000505591602001919060010190610853565b60075460ff16151560011415610886576101a9565b506007805460ff1916600117905560008054600160a060020a039081168252600b602052604080832060646002308516310204905582549091168252812054600480549190910390555b600c548110156101a9576006548114156109a957600654600c8054606492908110156100025790600052602060002090600602016000506005015460620281156100025704600b6000506000600c6000506006600050548154811015610002576000918252602080832060069283020154600160a060020a03168452830193909352604090910181209290925554600c8054600b93929081101561000257906000526020600020906006020160005054600160a060020a0316815260208101919091526040016000205460048054919091039055610a69565b6064600c6000508281548110156100025790600052602060002090600602016000506005015460080281156100025704600b6000506000600c60005084815481101561000257906000526020600020906006020160005054600160a060020a031681526020810191909152604001600090812091909155600c8054600b929190849081101561000257906000526020600020906006020160005054600160a060020a03168152602081019190915260400160002054600480549190910390555b6001016108d0565b600154421115610a80576101a9565b600160a060020a0333166000908152600a602052604090208054600181018083558281838015829011610af557600402816004028360005260206000209182019101610af591905b808211156106e35760008082556001820181905560028201805460ff191690556003820155600401610ac8565b505050600092835250602080832060408051608081018252868152349381018490529081018590526060018490526004928302019384556001840181905560028401805460ff1916905560039093019190915580549091019055565b600254421115610b6057610272565b8585604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f1509050019250505060405180910390209350600a600050600033600160a060020a031681526020019081526020016000206000509250600960005085604051808280519060200190808383829060006004602084601f0104600302600f01f1509050019150509081526020016040518091039020600050549150600090505b825481101561027257836000191683828154811015610002579060005260206000209060040201600050541415610d5a578281815481101561000257906000526020600020906004020160005060010154600c805484908110156100025790600052602060002090600602016000506005018054909101905582546001908490839081101561000257906000526020600020906004020160005060020160006101000a81548160ff021916908360f860020a908102040217905550818382815481101561000257906000526020600020906004020160005060030155600554600c80548490811015610002579060005260206000209060060201600050600501541115610d5a576006829055600c8054839081101561000257906000526020600020906006020160005060059081015490555b600101610c27565b820191906000526020600020905b815481529060010190602001808311610d7057829003601f168201915b50505050509050919050565b600160a060020a0333166000908152600a60205260408120945092505b835483101561034a5760066000505484848154811015610002579060005260206000209060040201600050600301541415610e785783838154811015610002579060005260206000209060040201600050600101546004546005548654929450909186908690811015610002579060005260206000209060040201600050600101548115610002570402905033600160a060020a03166108fc829081150290604051809050600060405180830381858888f193505050501515610e7857610002565b600190920191610db6565b600654600c80549091908110156100025790600052602060002090600602016000505433600160a060020a03908116911614610ebe57610002565b600160a060020a0333166000818152600b602052604080822054905181156108fc0292818181858888f1935050505015156103835761000256",
    "events": {},
    "updated_at": 1481572933385,
    "links": {}
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
