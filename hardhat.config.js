// const { version } = require("hardhat");

require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      { version: "0.8.20" },
      { version: "0.8.19" },
      { version: "0.8.9" },
      { version: "0.8.16" }
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 20,
        
      },
    },
    
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    }
  }
};
