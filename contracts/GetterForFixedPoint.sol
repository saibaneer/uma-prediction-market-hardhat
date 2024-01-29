// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@uma/core/contracts/common/implementation/FixedPoint.sol";
import "@uma/core/contracts/data-verification-mechanism/implementation/Constants.sol";

contract Getter {


    function getFixedPointvalue(uint256 _val) external pure returns(FixedPoint.Unsigned memory){
        return FixedPoint.fromUnscaledUint(_val);
    }

    function getOracleStoreValue() external pure returns(bytes32){
        return OracleInterfaces.Store;
    }

    function getCollateralWhitelistValue() external pure returns(bytes32){
        return OracleInterfaces.CollateralWhitelist;
    }

    function getIdentifierWhitelistValue() external pure returns(bytes32){
        return OracleInterfaces.IdentifierWhitelist;
    }

    function getOracleValue() external pure returns(bytes32){
        return OracleInterfaces.Oracle;
    }

    function getOptimisticOracleValueV3() external pure returns(bytes32){
        return OracleInterfaces.OptimisticOracleV3;
        
    }

    function assertTruth() external pure returns(bytes32) {
        return bytes32("ASSERT_TRUTH");
    }

    function getBondValue() external pure returns(FixedPoint.Unsigned memory){
        return FixedPoint.fromUnscaledUint(50);
    }

    function defaultLiveness() external pure returns(uint64) {
        return uint64(7200);
    }

}