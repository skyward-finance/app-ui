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

export const noInternetMode = window.location.hostname === "localhost";

export const IsMainnet =
  false && !!window.location.hostname.match(/app\d?\.skyward\.finance/);
const TestnetContract = "skyward.testnet";
const TestNearConfig = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  archivalNodeUrl: "https://rpc.testnet.internal.near.org",
  contractName: TestnetContract,
  wrapNearAccountId: `wrap.testnet`,
  skywardTokenAccountId: `token.${TestnetContract}`,
  tokenSwapAccountId: "token-swap.skyward.testnet",
  walletUrl: "https://wallet.testnet.near.org",
  storageCostPerByte: StorageCostPerByte,
};
const MainnetContract = "skyward.near";
export const MainNearConfig = {
  networkId: "mainnet",
  nodeUrl: "https://rpc.mainnet.near.org",
  archivalNodeUrl: "https://rpc.mainnet.internal.near.org",
  contractName: MainnetContract,
  wrapNearAccountId: `wrap.near`,
  skywardTokenAccountId: `token.${MainnetContract}`,
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

  _near.nearArchivalConnection = nearAPI.Connection.fromConfig({
    networkId: NearConfig.networkId,
    provider: {
      type: "JsonRpcProvider",
      args: { url: NearConfig.archivalNodeUrl },
    },
    signer: { type: "InMemorySigner", keyStore },
  });

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
        "get_skyward_circulating_supply",
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

  _near.fetchBlockHeight = async () => {
    const block = await nearConnection.connection.provider.block({
      finality: "final",
    });
    return block.header.height;
  };

  _near.fetchNextNonce = async () => {
    const accessKeys = await _near.account.getAccessKeys();
    return accessKeys.reduce(
      (nonce, accessKey) => Math.max(nonce, accessKey.access_key.nonce + 1),
      1
    );
  };

  _near.sendTransactions = async (items) => {
    let [nonce, blockHash] = await Promise.all([
      _near.fetchNextNonce(),
      _near.fetchBlockHash(),
    ]);

    const transactions = [];
    let actions = [];
    let currentReceiverId = null;
    items.push([null, null]);
    items.forEach(([receiverId, action]) => {
      if (receiverId !== currentReceiverId) {
        if (currentReceiverId !== null) {
          transactions.push(
            nearAPI.transactions.createTransaction(
              _near.accountId,
              randomPublicKey,
              currentReceiverId,
              nonce++,
              actions,
              blockHash
            )
          );
          actions = [];
        }
        currentReceiverId = receiverId;
      }
      actions.push(action);
    });
    return await _near.walletConnection.requestSignTransactions(transactions);
  };

  _near.archivalViewCall = async (blockId, contractId, methodName, args) => {
    args = args || {};
    const result = await _near.nearArchivalConnection.provider.query({
      request_type: "call_function",
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      block_id: blockId,
    });

    return (
      result.result &&
      result.result.length > 0 &&
      JSON.parse(Buffer.from(result.result).toString())
    );
  };

  return _near;
}

const defaultNear = Promise.resolve(_initNear());
export const useNear = singletonHook(defaultNear, () => {
  return defaultNear;
});
