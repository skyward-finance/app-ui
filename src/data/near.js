import * as nearAPI from "near-api-js";
import { singletonHook } from "react-singleton-hook";
import Big from "big.js";

export const TGas = Big(10).pow(12);
export const StorageCostPerByte = Big(10).pow(19);
export const TokenStorageDeposit = StorageCostPerByte.mul(125);
export const SkywardRegisterStorageDeposit = StorageCostPerByte.mul(1000);
export const SubscribeDeposit = StorageCostPerByte.mul(1000);

export const randomPublicKey = nearAPI.utils.PublicKey.from(
  "ed25519:8fWHD35Rjd78yeowShh9GwhRudRtLLsGCRjZtgPjAtw9"
);

const IsMainnet = window.location.hostname === "berry.cards";
const TestNearConfig = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  archivalNodeUrl: "https://rpc.testnet.internal.near.org",
  contractName: "app1.2.skyward-dev.testnet",
  wrapNearAccountId: "wrap_near.2.skyward-dev.testnet",
  walletUrl: "https://wallet.testnet.near.org",
  storageCostPerByte: StorageCostPerByte,
};
const MainNearConfig = {
  networkId: "mainnet",
  nodeUrl: "https://rpc.mainnet.near.org",
  archivalNodeUrl: "https://rpc.mainnet.internal.near.org",
  contractName: "cards.berryclub.ek.near",
  walletUrl: "https://wallet.near.org",
  storageCostPerByte: StorageCostPerByte,
};

export const NearConfig = IsMainnet ? MainNearConfig : TestNearConfig;
export const LsKey = NearConfig.contractName + ":v01:";

async function _initNear() {
  const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
  const nearConnection = await nearAPI.connect(
    Object.assign({ deps: { keyStore } }, NearConfig)
  );
  const _near = {};

  _near.keyStore = keyStore;
  _near.nearConnection = nearConnection;

  _near.walletConnection = new nearAPI.WalletConnection(
    nearConnection,
    NearConfig.contractName
  );
  _near.accountId = _near.walletConnection.getAccountId();
  _near.account = _near.walletConnection.account();

  _near.contract = new nearAPI.Contract(
    _near.account,
    NearConfig.contractName,
    {
      viewMethods: [
        "balance_of",
        "balances_of",
        "get_num_balances",
        "get_subscribed_sales",
        "get_account_sales",
        "get_sale",
        "get_sales",
        "get_treasury_balance",
        "get_treasury_balances",
        "get_treasury_num_balances",
        "get_skyward_token_id",
        "get_skyward_total_supply",
        "get_listing_fee",
      ],
      changeMethods: [
        "register_token",
        "register_tokens",
        "withdraw_token",
        "donate_token_to_treasury",
        "sale_create",
        "sale_deposit_out_token",
        "sale_deposit_in_token",
        "sale_withdraw_in_token",
        "sale_distribute_unclaimed_tokens",
        "sale_claim_out_tokens",
        "redeem_skyward",
      ],
    }
  );

  _near.fetchBlockHash = async () => {
    const block = await nearConnection.connection.provider.block({
      finality: "final",
    });
    return nearAPI.utils.serialize.base_decode(block.header.hash);
  };

  _near.createTransaction = (receiverId, actions, blockHash, offset) =>
    nearAPI.transactions.createTransaction(
      _near.accountId,
      randomPublicKey,
      receiverId,
      new Date().getTime() + (offset || 0),
      actions,
      blockHash
    );
  return _near;
}

const defaultNear = Promise.resolve(_initNear());
export const useNear = singletonHook(defaultNear, () => {
  return defaultNear;
});
