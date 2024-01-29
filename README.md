# Sample Hardhat Project

This project demonstrates how to implement the UMA Prediction market using Hardhat. It adapts for the Foundry exmaple highlighted here: https://docs.uma.xyz/developers/optimistic-oracle-v3/prediction-market

The Test runs within the local hardhat node. To follow along, use the './test/Test.js'.

The test performs the following actions:
1. Deploy all contracts using the Deployment Fixtures.
2. Deploy the Prediction Market.
3. Initialize a New Market:
    - Mint the default currency otherwise known as the Bonding currency (In real life, you already purchased the bonding currency).
    - Approve the Prediction market to be the spender for the Bonding currency.
    - Call the Initialize New Market function with your chosen parameters.
    - Capture the events.
4. Create the outcome tokens, by calling the PredictionMarket.createOutcomeTokens function.
5. Redeem half of the tokens to confirm the redemption works correctly. Then transfer the tokens of the "YES" out come to another wallet. (The creator of the market choses their preferred outcome by holding ONLY the tokens for the outcome they prefer).
6. Assert the assertion using a different wallet called the `Asserter`.
    - The Asserter should have the Bonded Currency and will need to approve the prediction market to spend the minimum bond amount or the bonded amount chosen for the Market.
    - Assertion is done by calling the PredictionMarket.assertMarket(marketId) This wallet affirms that the event indeed happened. 
    - Time jump to the end of the assertion period (7200 seconds | 2 hours);
    - Capture the events.
    - The Asserter calls the OptimisticOracleV3.settleAssertion(assertionId).
    - If the assertion is unchallenged, the Asserter earns a reward including their Bonded Amount
7. Settle the outcomes
    - This is called on the Prediction market for the Specific Market Id.
    - It burns the outcome tokens when called by the partaking wallets, and swaps them for the bonded currency.
    - The losing wallet gets no bonded currency, the winning wallet gets the bonded currency.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```
