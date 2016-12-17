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
        "inputs": [],
        "name": "getCompetitionsLength",
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
        "constant": true,
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
        "inputs": [],
        "payable": false,
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b60008054600160a060020a0319166c01000000000000000000000000338102041790555b5b6117d18061003d6000396000f3606060405260e060020a600035046309e97bf4811461004a5780631340e430146100695780633459e6bb14610081578063f4036466146100a3578063f7e91a29146100cf575b610000565b34610000576100576100f1565b60408051918252519081900360200190f35b346100005761007f6004356024356044356100f8565b005b34610000576100576004356101b9565b60408051918252519081900360200190f35b34610000576100b360043561023c565b60408051600160a060020a039092168252519081900360200190f35b3461000057610057600435610272565b60408051918252519081900360200190f35b6001545b90565b6001805480600101828181548183558181151161013a5760008381526020902061013a9181019083015b808211156101365760008155600101610122565b5090565b5b505050916000526020600020900160005b8585856040516114dc806102f583390192835260208301919091526040808301919091525190819003606001906000f0801561000057909190916101000a815481600160a060020a0302191690836c01000000000000000000000000908102040217905550505b5b505050565b6000600182815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a0316600160a060020a031663cb1e644c6000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050604051519150505b919050565b6000600182815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a031690505b919050565b6000600182815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a0316600160a060020a03166312065fe06000604051602001526040518160e060020a028152600401809050602060405180830381600087803b156100005760325a03f115610000575050604051519150505b91905056606060405234610000576040516060806114dc8339810160409081528151602083015191909201515b60008054600160a060020a0319166c01000000000000000000000000338102041790556003839055600182905560028190555b5050505b61146f8061006d6000396000f3606060405236156100e55760e060020a600035046312065fe081146100ea5780631ef02bf71461010957806327cf399a146101285780632f93c5e8146101ca5780633c2c2198146102995780633f24ec89146102bf5780634d6bb2f7146102ce578063531e9236146102db5780636278c418146102fa578063693521d5146103195780637103c40114610338578063811dd0e2146103ca5780638da58897146105065780638fb4aabf14610525578063c079d5c61461054e578063c3c2d1ae1461056d578063ca392d9a1461057c578063cb1e644c1461059b578063dffa2597146105ba575b610000565b34610000576100f76105c9565b60408051918252519081900360200190f35b34610000576100f76105d8565b60408051918252519081900360200190f35b34610000576100f7600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b018035918201839004830284018301909452808352979998810197919650918201945092508291508401838280828437509496506105de95505050505050565b60408051918252519081900360200190f35b3461000057610297600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375094965061064195505050505050565b005b34610000576102a6610b0d565b6040805192835260208301919091528051918290030190f35b3461000057610297610b70565b005b610297600435610cd6565b005b34610000576100f7610ddc565b60408051918252519081900360200190f35b34610000576100f7610de2565b60408051918252519081900360200190f35b34610000576100f7610de8565b60408051918252519081900360200190f35b3461000057610297600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b01803591820183900483028401830190945280835297999881019791965091820194509250829150840183828082843750949650610e2f95505050505050565b005b34610000576103da600435611040565b604051808060200180602001806020018481038452878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156104425780820380516001836020036101000a031916815260200191505b508481038352868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f16801561049b5780820380516001836020036101000a031916815260200191505b508481038252858181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156104f45780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390f35b34610000576100f761125c565b60408051918252519081900360200190f35b3461000057610532611262565b60408051600160a060020a039092168252519081900360200190f35b34610000576100f7611267565b60408051918252519081900360200190f35b346100005761029761126d565b005b34610000576100f76113c8565b60408051918252519081900360200190f35b34610000576100f76113ce565b60408051918252519081900360200190f35b34610000576102976113d5565b005b600160a060020a033016315b90565b60065481565b60008282604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f15090500192505050604051809103902090505b92915050565b600160a060020a03331660009081526008602052604090205460ff161561066757610000565b600c80548060010182818154818355818115116107fb576006028160060283600052602060002091820191016107fb91905b8082111561071b57805473ffffffffffffffffffffffffffffffffffffffff1916815560018082018054600080835592600260001991831615610100029190910190911604601f8190106106ed575061071f565b601f01602090049060005260206000209081019061071f91905b8082111561071b5760008155600101610707565b5090565b5b5060028201805460018160011615610100020316600290046000825580601f1061074a575061077c565b601f01602090049060005260206000209081019061077c91905b8082111561071b5760008155600101610707565b5090565b5b5060038201805460018160011615610100020316600290046000825580601f106107a757506107d9565b601f0160209004906000526020600020908101906107d991905b8082111561071b5760008155600101610707565b5090565b5b505060048101805460ff1916905560006005820155600601610699565b5090565b5b505050916000526020600020906006020160005b506040805160c0810182523380825260208083018990529282018790526060820186905260006080830181905260a08301819052845473ffffffffffffffffffffffffffffffffffffffff19166c0100000000000000000000000092830292909204919091178455875160018086018054818552938690209496959094600261010093861615939093026000190190941691909104601f908101829004840193918b01908390106108cc57805160ff19168380011785556108f9565b828001600101855582156108f9579182015b828111156108f95782518255916020019190600101906108de565b5b5061091a9291505b8082111561071b5760008155600101610707565b5090565b50506040820151816002019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061096e57805160ff191683800117855561099b565b8280016001018555821561099b579182015b8281111561099b578251825591602001919060010190610980565b5b506109bc9291505b8082111561071b5760008155600101610707565b5090565b50506060820151816003019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610a1057805160ff1916838001178555610a3d565b82800160010185558215610a3d579182015b82811115610a3d578251825591602001919060010190610a22565b5b50610a5e9291505b8082111561071b5760008155600101610707565b5090565b505060808201516004828101805460ff1990811660f860020a9485029490940493909317905560a09093015160059092019190915533600160a060020a031660009081526008602090815260408083208054909416600117909355600c54925188516000199490940195506009948994919384938681019392839286928492879291601f850104600302600f01f1509050019150509081526020016040518091039020819055505b5b5b505050565b60006000600b6000600c600654815481101561000057906000526020600020906006020160005b5054600160a060020a039081168252602080830193909352604091820160009081205481549092168152600b90935291205490925090505b9091565b6007805460ff1916600117905560008054600160a060020a039081168252600b60205260408083206064600230851631020490558254909116825281205460048054919091039055805b600c54811015610ccf57600654811415610c4e576064600c600654815481101561000057906000526020600020906006020160005b506005015460620281156100005704915081600b6000600c600654815481101561000057906000526020600020906006020160005b5054600160a060020a03168152602081019190915260400160002055600480548390039055610cc6565b6064600c82815481101561000057906000526020600020906006020160005b506005015460080281156100005704915081600b6000600c84815481101561000057906000526020600020906006020160005b5054600160a060020a031681526020810191909152604001600020556004805483900390555b5b600101610bba565b5b5b5b5050565b600160a060020a0333166000908152600a602052604090208054600181018083558281838015829011610d6057600502816005028360005260206000209182019101610d6091905b8082111561071b5760008082556001820181905560028201805460ff1990811690915560038301919091556004820180549091169055600501610d1e565b5090565b5b505050916000526020600020906005020160005b506040805160a081018252848152346020820181905260009282018390526060820183905260809091018290528483556001830181905560028301805460ff199081169091556003840192909255600492830180549092169091558154019055505b5b5b50565b60045481565b60055481565b6000600b6000600c600654815481101561000057906000526020600020906006020160005b5054600160a060020a0316815260208101919091526040016000205490505b90565b60006000600060008585604051808380519060200190808383829060006004602084601f0104600302600f01f1509050018280519060200190808383829060006004602084601f0104600302600f01f1509050019250505060405180910390209350600a600033600160a060020a031681526020019081526020016000209250600985604051808280519060200190808383829060006004602084601f0104600302600f01f1509050019150509081526020016040518091039020549150600090505b82548110156110355783600019168382815481101561000057906000526020600020906005020160005b5054141561102b578281815481101561000057906000526020600020906005020160005b5060010154600c83815481101561000057906000526020600020906006020160005b506005018054909101905582546001908490839081101561000057906000526020600020906005020160005b5060020160006101000a81548160ff021916908360f860020a908102040217905550818382815481101561000057906000526020600020906005020160005b5060030155600554600c8054849081101561000057906000526020600020906006020160005b5060050154111561102b576006829055600c8054839081101561000057906000526020600020906006020160005b5060059081015490555b5b5b600101610ef2565b5b5b5b505050505050565b60408051602081810183526000808352835180830185528181528451928301909452808252600c8054939493869081101561000057906000526020600020906006020160005b509050806001018160020182600301828054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561112a5780601f106110ff5761010080835404028352916020019161112a565b820191906000526020600020905b81548152906001019060200180831161110d57829003601f168201915b5050855460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152959850879450925084019050828280156111b85780601f1061118d576101008083540402835291602001916111b8565b820191906000526020600020905b81548152906001019060200180831161119b57829003601f168201915b5050845460408051602060026001851615610100026000190190941693909304601f8101849004840282018401909252818152959750869450925084019050828280156112465780601f1061121b57610100808354040283529160200191611246565b820191906000526020600020905b81548152906001019060200180831161122957829003601f168201915b505050505090509350935093505b509193909250565b60035481565b305b90565b60025481565b600160a060020a0333166000908152600a602052604081209080805b83548310156113c0576006548484815481101561000057906000526020600020906005020160005b50600301541480156112e457508383815481101561000057906000526020600020906005020160005b506004015460ff16155b156113b35760018484815481101561000057906000526020600020906005020160005b5060040160006101000a81548160ff021916908360f860020a9081020402179055508383815481101561000057906000526020600020906005020160005b506001015491506004546005548585815481101561000057906000526020600020906005020160005b50600101548115610000570402905033600160a060020a03166108fc829081150290604051809050600060405180830381858888f1935050505015156113b357610000565b5b5b600190920191611289565b5b5b50505050565b60015481565b600c545b90565b600c600654815481101561000057906000526020600020906006020160005b505433600160a060020a0390811691161415806114275750600160a060020a0333166000908152600b6020526040902054155b1561143157610000565b600160a060020a0333166000818152600b6020526040808220829055516108fc919081818181818888f19350505050151561146b57610000565b5b5b56",
    "events": {},
    "updated_at": 1482001549087,
    "links": {},
    "address": "0x984d1bf797f90c6b88506c1138676623fc4ef99b"
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
