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
  );;

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
  };
};

describe("Test Market prediction Features", async function () {
  
  it("should test that a Market can be initialized", async () => {
    const description =
      "The Glacial Storms beat the Electric Titans on March 8, 2023 at 3:00 PM UTC, \
	which is equivalent to the Unix timestamp 1686258000 seconds";

    const {
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
    } = await loadFixture(deployAndSetup);

    predictionMarket = await ethers.deployContract("PredictionMarket", [
      await finder.getAddress(),
      await bondToken.getAddress(),
      await optimisticOracle.getAddress(),
    ]);
    await predictionMarket.waitForDeployment();
    const predictionMarketAddress = await predictionMarket.getAddress();
    console.log("Prediction market is deployed at: ", predictionMarketAddress);
    const bondAmount = ethers.parseEther("5000");

    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), bondAmount);
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, bondAmount);

    let tx = await predictionMarket.initializeMarket(
      "yes",
      "no",
      description,
      ethers.parseEther("100"),
      ethers.parseEther("5000")
    );
    const eventFilter = predictionMarket.filters.MarketInitialized();
    const events = await predictionMarket.queryFilter(eventFilter, "latest");
    // console.log(events[0].args);
    expect(events[0].args.outcome1).to.equal("yes");
    expect(events[0].args.outcome2).to.equal("no");
    expect(events[0].args.requiredBond).to.equal(bondAmount);
  });

  it("should create outcome tokens", async function () {
    const description =
      "The Glacial Storms beat the Electric Titans on March 8, 2023 at 3:00 PM UTC, \
	which is equivalent to the Unix timestamp 1686258000 seconds";

    const {
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
    } = await loadFixture(deployAndSetup);

    predictionMarket = await ethers.deployContract("PredictionMarket", [
      await finder.getAddress(),
      await bondToken.getAddress(),
      await optimisticOracle.getAddress(),
    ]);
    await predictionMarket.waitForDeployment();
    const predictionMarketAddress = await predictionMarket.getAddress();
    console.log("Prediction market is deployed at: ", predictionMarketAddress);
    const bondAmount = ethers.parseEther("5000");

    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), bondAmount);
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, bondAmount);

    let tx = await predictionMarket.initializeMarket(
      "yes",
      "no",
      description,
      ethers.parseEther("100"),
      ethers.parseEther("5000")
    );
    let eventFilter = predictionMarket.filters.MarketInitialized();
    let events = await predictionMarket.queryFilter(eventFilter, "latest");
    // console.log(events[0].args);
    expect(events[0].args.outcome1).to.equal("yes");
    expect(events[0].args.outcome2).to.equal("no");
    expect(events[0].args.requiredBond).to.equal(bondAmount);

    //Mint more bonding tokens
    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), ethers.parseEther("10000"));
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, ethers.parseEther("10000"));

    //create outcome tokens
    await predictionMarket.createOutcomeTokens(
      events[0].args.marketId,
      ethers.parseEther("10000")
    );
    const tokenInterface1 = await ethers.getContractAt(
      "IERC20",
      events[0].args.outcome1Token
    );
    const tokenInterface2 = await ethers.getContractAt(
      "IERC20",
      events[0].args.outcome2Token
    );

    eventFilter = predictionMarket.filters.TokensCreated();
    events = await predictionMarket.queryFilter(eventFilter, "latest");
    console.log(events[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));
  });

  it("should redeem outcome tokens", async function () {
    const description =
      "The Glacial Storms beat the Electric Titans on March 8, 2023 at 3:00 PM UTC, \
	which is equivalent to the Unix timestamp 1686258000 seconds";

    const {
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
    } = await loadFixture(deployAndSetup);

    predictionMarket = await ethers.deployContract("PredictionMarket", [
      await finder.getAddress(),
      await bondToken.getAddress(),
      await optimisticOracle.getAddress(),
    ]);
    await predictionMarket.waitForDeployment();
    const predictionMarketAddress = await predictionMarket.getAddress();
    console.log("Prediction market is deployed at: ", predictionMarketAddress);
    const bondAmount = ethers.parseEther("5000");

    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), bondAmount);
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, bondAmount);

    let tx = await predictionMarket.initializeMarket(
      "yes",
      "no",
      description,
      ethers.parseEther("100"),
      ethers.parseEther("5000")
    );
    let eventFilter = predictionMarket.filters.MarketInitialized();
    let events = await predictionMarket.queryFilter(eventFilter, "latest");
    // console.log(events[0].args);
    expect(events[0].args.outcome1).to.equal("yes");
    expect(events[0].args.outcome2).to.equal("no");
    expect(events[0].args.requiredBond).to.equal(bondAmount);

    //Mint more bonding tokens
    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), ethers.parseEther("10000"));
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, ethers.parseEther("10000"));

    //create outcome tokens
    await predictionMarket.createOutcomeTokens(
      events[0].args.marketId,
      ethers.parseEther("10000")
    );
    const tokenInterface1 = await ethers.getContractAt(
      "IERC20",
      events[0].args.outcome1Token
    );
    const tokenInterface2 = await ethers.getContractAt(
      "IERC20",
      events[0].args.outcome2Token
    );

    eventFilter = predictionMarket.filters.TokensCreated();
    events = await predictionMarket.queryFilter(eventFilter, "latest");
    console.log(events[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    //Redeem Outcome tokens
    await predictionMarket.redeemOutcomeTokens(
      events[0].args.marketId,
      ethers.parseEther("5000")
    );
    eventFilter = predictionMarket.filters.TokensRedeemed();
    events = await predictionMarket.queryFilter(eventFilter, "latest");
    console.log(events[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("5000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("5000"));
  });

  it("should assert the 'YES' position", async function () {
    const description =
      "The Glacial Storms beat the Electric Titans on March 8, 2023 at 3:00 PM UTC, \
	which is equivalent to the Unix timestamp 1686258000 seconds";

    const {
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
    } = await loadFixture(deployAndSetup);

    predictionMarket = await ethers.deployContract("PredictionMarket", [
      await finder.getAddress(),
      await bondToken.getAddress(),
      await optimisticOracle.getAddress(),
    ]);
    await predictionMarket.waitForDeployment();
    const predictionMarketAddress = await predictionMarket.getAddress();
    console.log("Prediction market is deployed at: ", predictionMarketAddress);
    const bondAmount = ethers.parseEther("5000");

    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), bondAmount);
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, bondAmount);

    let tx = await predictionMarket.initializeMarket(
      "yes",
      "no",
      description,
      ethers.parseEther("100"),
      ethers.parseEther("5000")
    );
    let eventFilter = predictionMarket.filters.MarketInitialized();
    let events = await predictionMarket.queryFilter(eventFilter, "latest");
    // console.log(events[0].args);
    expect(events[0].args.outcome1).to.equal("yes");
    expect(events[0].args.outcome2).to.equal("no");
    expect(events[0].args.requiredBond).to.equal(bondAmount);

    //Mint more bonding tokens
    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), ethers.parseEther("10000"));
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, ethers.parseEther("10000"));

    //create outcome tokens
    await predictionMarket.createOutcomeTokens(
      events[0].args.marketId,
      ethers.parseEther("10000")
    );
    const tokenInterface1 = await ethers.getContractAt(
      "IERC20",
      events[0].args.outcome1Token
    );
    const tokenInterface2 = await ethers.getContractAt(
      "IERC20",
      events[0].args.outcome2Token
    );

    eventFilter = predictionMarket.filters.TokensCreated();
    events = await predictionMarket.queryFilter(eventFilter, "latest");
    console.log(events[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    //Redeem Outcome tokens
    await predictionMarket.redeemOutcomeTokens(
      events[0].args.marketId,
      ethers.parseEther("5000")
    );
    eventFilter = predictionMarket.filters.TokensRedeemed();
    events = await predictionMarket.queryFilter(eventFilter, "latest");
    console.log(events[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("5000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("5000"));

    await tokenInterface1.transfer(
      await alice.getAddress(),
      ethers.parseEther("5000")
    );

    //Asserter pays bond and chooses "YES"
    await bondToken
      .connect(deployer)
      .allocateTo(await asserter.getAddress(), ethers.parseEther("5000"));
    await bondToken
      .connect(asserter)
      .approve(predictionMarketAddress, ethers.parseEther("5000"));
    await predictionMarket
      .connect(asserter)
      .assertMarket(events[0].args.marketId, "yes");

    eventFilter = predictionMarket.filters.MarketAsserted();
    events = await predictionMarket.queryFilter(eventFilter, "latest");
    console.log(events[0].args);
  });

  it("should assert the 'YES' position & settle assertion & should settle outcomes", async function () {
    const description =
      "The Glacial Storms beat the Electric Titans on March 8, 2023 at 3:00 PM UTC, \
	which is equivalent to the Unix timestamp 1686258000 seconds";

    const {
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
    } = await loadFixture(deployAndSetup);

    predictionMarket = await ethers.deployContract("PredictionMarket", [
      await finder.getAddress(),
      await bondToken.getAddress(),
      await optimisticOracle.getAddress(),
    ]);
    await predictionMarket.waitForDeployment();
    const predictionMarketAddress = await predictionMarket.getAddress();
    console.log("Prediction market is deployed at: ", predictionMarketAddress);
    const bondAmount = ethers.parseEther("5000");

    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), bondAmount);
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, bondAmount);

    let tx = await predictionMarket.initializeMarket(
      "yes",
      "no",
      description,
      ethers.parseEther("100"),
      ethers.parseEther("5000")
    );
    let eventFilter = predictionMarket.filters.MarketInitialized();
    let marketInitializedEvent = await predictionMarket.queryFilter(
      eventFilter,
      "latest"
    );
    console.log("Market Initialized Event: ", marketInitializedEvent[0].args);
    expect(marketInitializedEvent[0].args.outcome1).to.equal("yes");
    expect(marketInitializedEvent[0].args.outcome2).to.equal("no");
    expect(marketInitializedEvent[0].args.requiredBond).to.equal(bondAmount);

    //Mint more bonding tokens
    await bondToken
      .connect(deployer)
      .allocateTo(await deployer.getAddress(), ethers.parseEther("10000"));
    await bondToken
      .connect(deployer)
      .approve(predictionMarketAddress, ethers.parseEther("10000"));

    //create outcome tokens
    await predictionMarket.createOutcomeTokens(
      marketInitializedEvent[0].args.marketId,
      ethers.parseEther("10000")
    );
    const tokenInterface1 = await ethers.getContractAt(
      "IERC20",
      marketInitializedEvent[0].args.outcome1Token
    );
    const tokenInterface2 = await ethers.getContractAt(
      "IERC20",
      marketInitializedEvent[0].args.outcome2Token
    );

    eventFilter = predictionMarket.filters.TokensCreated();
    let tokensCreatedEvent = await predictionMarket.queryFilter(
      eventFilter,
      "latest"
    );
    console.log("TokensCreated Event: ", tokensCreatedEvent[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("10000"));

    //Redeem Outcome tokens
    await predictionMarket.redeemOutcomeTokens(
      tokensCreatedEvent[0].args.marketId,
      ethers.parseEther("5000")
    );
    eventFilter = predictionMarket.filters.TokensRedeemed();
    let tokensRedeemedEvents = await predictionMarket.queryFilter(
      eventFilter,
      "latest"
    );
    console.log("TokenRedeemed Event", tokensRedeemedEvents[0].args);

    expect(
      await tokenInterface1.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("5000"));

    expect(
      await tokenInterface2.balanceOf(await deployer.getAddress())
    ).to.equal(ethers.parseEther("5000"));

    await tokenInterface1.connect(deployer).transfer(
      await alice.getAddress(),
      ethers.parseEther("5000")
    );

    expect(await bondToken.balanceOf(alice)).to.equal(0);

    //Asserter pays bond and chooses "YES"
    await bondToken
      .connect(deployer)
      .allocateTo(await asserter.getAddress(), ethers.parseEther("5000"));
    await bondToken
      .connect(asserter)
      .approve(predictionMarketAddress, ethers.parseEther("5000"));
    await predictionMarket
      .connect(asserter)
      .assertMarket(tokensRedeemedEvents[0].args.marketId, "yes");

    eventFilter = predictionMarket.filters.MarketAsserted();
    let marketAssertedEvents = await predictionMarket.queryFilter(
      eventFilter,
      "latest"
    );
    console.log("MarketAsserted Event", marketAssertedEvents[0].args);

    await network.provider.send("evm_increaseTime", [7200]); // Increase by 7200 seconds
    await network.provider.send("evm_mine");

    //Settle Assertion using Optimistic Oracle
    await optimisticOracle.settleAssertion(
      marketAssertedEvents[0].args.assertionId
    );
    // AssertionSettled
    eventFilter = optimisticOracle.filters.AssertionSettled();
    let assertionSettledEvents = await optimisticOracle.queryFilter(
      eventFilter,
      "latest"
    );
    console.log("✅ Assertion settled!", assertionSettledEvents[0].args);

    expect(await bondToken.balanceOf(
        await asserter.getAddress()
      )).to.equal(ethers.parseEther("5100")); // Bond + Reward.

    await predictionMarket.connect(deployer).settleOutcomeTokens(tokensCreatedEvent[0].args.marketId);
    await predictionMarket.connect(alice).settleOutcomeTokens(tokensCreatedEvent[0].args.marketId);
    expect(await bondToken.balanceOf(alice)).to.equal(ethers.parseEther('5000'));
    expect(await tokenInterface1.balanceOf(alice)).to.equal(ethers.parseEther('0'));
  });
});
