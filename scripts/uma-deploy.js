// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
// const { BigNumber } = require('et')

async function main() {
  const [deployer, alice, bob, charlie] = await hre.ethers.getSigners();
  const finder = await hre.ethers.deployContract("Finder", deployer);
  await finder.waitForDeployment();
  console.log("Finder Address is: ", await finder.getAddress());

  //deploy library artifacts
  const fp = await hre.ethers.deployContract("Getter");
  //   const FixedPoint = await fp.deploy();
  await fp.waitForDeployment();
  //   await FixedPoint.deployed();
  console.log("\nGetter address is at: ", await fp.getAddress());

  const VAL = await fp.getFixedPointvalue(0);

  const store = await hre.ethers.deployContract("Store", [
    [...VAL], //create new object type of val
    [...VAL],
    hre.ethers.ZeroAddress,
  ]);
  await store.waitForDeployment();
  console.log("\nStore Address is: ", await store.getAddress());

  const addressWhitelist = await hre.ethers.deployContract(
    "AddressWhitelist",
    deployer
  );
  await addressWhitelist.waitForDeployment();
  console.log(
    "\nAddress whitelist contract is: ",
    await addressWhitelist.getAddress()
  );

  const identifierWhitelist = await hre.ethers.deployContract(
    "IdentifierWhitelist",
    deployer
  );
  await identifierWhitelist.waitForDeployment();
  console.log(
    "\nIdentifier whitelist contract is: ",
    await identifierWhitelist.getAddress()
  );

  const mockOracle = await hre.ethers.deployContract("MockOracleAncillary", [
    await finder.getAddress(),
    hre.ethers.ZeroAddress,
  ]);
  await mockOracle.waitForDeployment();
  console.log("\nMock Oracle contract is: ", await mockOracle.getAddress());

  const bondToken = await hre.ethers.deployContract("TestnetERC20", [
    "Default Bond Token",
    "DBT",
  ]);
  await bondToken.waitForDeployment();
  console.log("\nBond Token contract is: ", await bondToken.getAddress());

  const OracleInterfaces = await hre.ethers.deployContract("OracleInterfaces");
  await OracleInterfaces.waitForDeployment();
  console.log("\nOracle Interfaces is at: ", await OracleInterfaces.getAddress());

  //   console.log("Check value for Oracle store at Oracle Library is: ", await fp.getOracleStoreValue());

  ///SETUP
  await finder.changeImplementationAddress(
    await fp.getOracleStoreValue(),
    await store.getAddress()
  );
  console.log('\nSet store address on finder!');
  await finder.changeImplementationAddress(
    await fp.getCollateralWhitelistValue(),
    await addressWhitelist.getAddress()
  );
  console.log('\nSet Address whitelist address on finder!');
  await finder.changeImplementationAddress(
    await fp.getIdentifierWhitelistValue(),
    await identifierWhitelist.getAddress()
  );
  console.log('\nSet identifier whitelist address on finder!');
  await finder.changeImplementationAddress(
    await fp.getOracleValue(),
    await mockOracle.getAddress()
  );
  console.log('\nSet Mock Oracle address on finder!');

  await addressWhitelist.addToWhitelist(await bondToken.getAddress());
  await identifierWhitelist.addSupportedIdentifier(await fp.assertTruth());
  const bondValue = await fp.getBondValue();
  await store.setFinalFee(await bondToken.getAddress(), [...bondValue]);

  // Deploy Optimistic Oracle V3 and register it in the Finder.
  const optimisticOracle = await hre.ethers.deployContract("OptimisticOracleV3", [await finder.getAddress(),await bondToken.getAddress(), await fp.defaultLiveness()]);
  await optimisticOracle.waitForDeployment();
  console.log("\nOptimistic Oracle Address is: ", await optimisticOracle.getAddress());

  await finder.changeImplementationAddress(await fp.getOptimisticOracleValueV3(), await optimisticOracle.getAddress());

  console.log(`\ndone!`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
