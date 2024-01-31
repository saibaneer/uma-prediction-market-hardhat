const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
let predictionMarket;

const deployAndSetup = async () => {
  const [deployer, alice, asserter, charlie] = await hre.ethers.getSigners();
  const finder = await hre.ethers.deployContract("Finder", deployer);
  await finder.waitForDeployment();
  console.log("Finder Address is: ", await finder.getAddress());

  //deploy library wrapper
  const fp = await hre.ethers.deployContract("Getter");
  await fp.waitForDeployment();
  console.log("\nGetter address is at: ", await fp.getAddress());

  //Get unsigned fixed point value;
  const VAL = await fp.getFixedPointvalue(0);
  const store = await hre.ethers.deployContract("Store", [
    [...VAL], //create new object type of fixed point value
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
  console.log(
    "\nOracle Interfaces is at: ",
    await OracleInterfaces.getAddress()
  );

  ///SETUP
  await finder.changeImplementationAddress(
    await fp.getOracleStoreValue(),
    await store.getAddress()
  );
  console.log("\nSet store address on finder!");

  await finder.changeImplementationAddress(
    await fp.getCollateralWhitelistValue(),
    await addressWhitelist.getAddress()
  );
  console.log("\nSet Address whitelist address on finder!");

  await finder.changeImplementationAddress(
    await fp.getIdentifierWhitelistValue(),
    await identifierWhitelist.getAddress()
  );
  console.log("\nSet identifier whitelist address on finder!");

  await finder.changeImplementationAddress(
    await fp.getOracleValue(),
    await mockOracle.getAddress()
  );
  console.log("\nSet Mock Oracle address on finder!");

  await addressWhitelist.addToWhitelist(await bondToken.getAddress());
  await identifierWhitelist.addSupportedIdentifier(await fp.assertTruth());
  const bondValue = await fp.getBondValue();
  await store.setFinalFee(await bondToken.getAddress(), [...bondValue]);

  // Deploy Optimistic Oracle V3 and register it in the Finder.
  const optimisticOracle = await hre.ethers.deployContract(
    "OptimisticOracleV3",
    [
      await finder.getAddress(),
      await bondToken.getAddress(),
      await fp.defaultLiveness(),
    ]
  );
  await optimisticOracle.waitForDeployment();
  console.log(
    "\nOptimistic Oracle Address is: ",
    await optimisticOracle.getAddress()
  );

  await finder.changeImplementationAddress(
    await fp.getOptimisticOracleValueV3(),
    await optimisticOracle.getAddress()
  );

  const insurance = await ethers.deployContract("Insurance", [
    await bondToken.getAddress(),
    await optimisticOracle.getAddress(),
  ]);
  await insurance.waitForDeployment();
  console.log(
    "Insurance contract is deployed at: ",
    await insurance.getAddress()
  );

  console.log(`\ndone!`);

  return {
    finder,
    fp,
    store,
    addressWhitelist,
    identifierWhitelist,
    mockOracle,
    bondToken,
    OracleInterfaces,
    optimisticOracle,
    deployer,
    alice,
    asserter,
    insurance,
  };
};

describe("Test Market prediction Features", async function () {
  it("should test that insurance can be issues", async () => {
    //Handle case for when bondAmount is zero
    const {
      fp,
      bondToken,
      optimisticOracle,
      deployer,
      insurance,
      alice
    } = await loadFixture(deployAndSetup);
    const bondAmount = ethers.parseEther("5000");
    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), bondAmount);
    await bondToken
      .connect(deployer)
      .approve(await insurance.getAddress(), bondAmount);

    const policyStringToBytes = await fp.stringToBytes("Bad things have happened");

    await insurance.connect(deployer).issueInsurance(bondAmount, await alice.getAddress(), policyStringToBytes);

    const eventFilter = insurance.filters.InsuranceIssued();
    const events = await insurance.queryFilter(eventFilter, "latest");
    console.log(events[0].args);
    expect(events[0].args.insuranceAmount).to.equal(bondAmount);
    expect(events[0].args.payoutAddress).to.equal(await alice.getAddress());
  });

  it("should submit insurance claim | request payout", async function () {
    const {
        fp,
        bondToken,
        optimisticOracle,
        deployer,
        insurance,
        alice
      } = await loadFixture(deployAndSetup);
      const bondAmount = ethers.parseEther("5000");
      await bondToken
        .connect(deployer)
        .allocateTo(await deployer.getAddress(), bondAmount);
      await bondToken
        .connect(deployer)
        .approve(await insurance.getAddress(), bondAmount);
  
      const policyStringToBytes = await fp.stringToBytes("Bad things have happened");
  
      await insurance.connect(deployer).issueInsurance(bondAmount, await alice.getAddress(), policyStringToBytes);
  
      const insuranceIssuedEventFilter = insurance.filters.InsuranceIssued();
      let events = await insurance.queryFilter(insuranceIssuedEventFilter, "latest");
    //   console.log(events[0].args);
      expect(events[0].args.insuranceAmount).to.equal(bondAmount);
      expect(events[0].args.payoutAddress).to.equal(await alice.getAddress());

      let minimumBond = await optimisticOracle.getMinimumBond(await bondToken.getAddress());

      await bondToken
        .connect(deployer)
        .allocateTo(await deployer.getAddress(), minimumBond);
      await bondToken
        .connect(deployer)
        .approve(await insurance.getAddress(), minimumBond);

      expect(await insurance.connect(deployer).requestPayout(events[0].args.policyId)).to.emit(insurance, "InsurancePayoutRequested");
      const requestPayoutEventFilter = insurance.filters.InsurancePayoutRequested();
      events = await insurance.queryFilter(requestPayoutEventFilter, "latest");
      console.log(events[0].args);
  });


});
