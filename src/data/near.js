import * as nearAPI from "near-api-js";
import { singletonHook } from "react-singleton-hook";
import Big from "big.js";
import { OneNear } from "./utils";
import { refreshAllowanceObj } from "../App";

export const TGas = Big(10).pow(12);
export const MaxGasPerTransaction = TGas.mul(300);
export const MaxGasPerTransaction2FA = TGas.mul(220);
export const StorageCostPerByte = Big(10).pow(19);
export const TokenStorageDeposit = StorageCostPerByte.mul(125);
export const BridgeTokenStorageDeposit = StorageCostPerByte.mul(1250);
export const SkywardRegisterStorageDeposit = StorageCostPerByte.mul(2000);
export const SubscribeDeposit = StorageCostPerByte.mul(2000);
export const CreateSaleDeposit = OneNear.mul(10).add(
  StorageCostPerByte.mul(5000)
);
export const MinUsdValue = Big(0.001);

export const randomPublicKey = nearAPI.utils.PublicKey.from(
  "ed25519:8fWHD35Rjd78yeowShh9GwhRudRtLLsGCRjZtgPjAtw9"
);

const defaultCodeHash = "11111111111111111111111111111111";

const isLocalhost = window.location.hostname === "localhost";
export const noInternetMode = isLocalhost;

export const IsMainnet =
  isLocalhost || !!window.location.hostname.match(/app\d?\.skyward\.finance/);
// const TestnetContract = "dev-1624326477618-30908433776884";
const TestnetContract = "skyward.testnet";
const TestNearConfig = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  archivalNodeUrl: "https://rpc.testnet.internal.near.org",
  contractName: TestnetContract,
  lockupAccountIds: [],
  // [...Array(5).keys()].map(
  //   (i) => `lockup${i}.${TestnetContract}`
  // ),
  wrapNearAccountId: "wrap.testnet",
  skywardTokenAccountId: `token.${TestnetContract}`,
  tokenSwapAccountId: "token-swap.skyward.testnet",
  walletUrl: "https://wallet.testnet.near.org",
  storageCostPerByte: StorageCostPerByte,
  refContractName: "ref-finance.testnet",
};
const MainnetContract = "skyward.near";
export const MainNearConfig = {
  networkId: "mainnet",
  nodeUrl: "https://rpc.mainnet.near.org",
  // archivalNodeUrl: "https://rpc.mainnet.internal.near.org",
  archivalNodeUrl: "https://archival-rpc.mainnet.near.org",
  contractName: MainnetContract,
  lockupAccountIds: [...Array(4).keys()].map(
    (i) => `lockup${i}.${MainnetContract}`
  ),
  wrapNearAccountId: "wrap.near",
  skywardTokenAccountId: `token.${MainnetContract}`,
  walletUrl: "https://wallet.near.org",
  storageCostPerByte: StorageCostPerByte,
  refContractName: "v2.ref-finance.near",
  oldRefFinanceToken: "token.ref-finance.near",
};

export const NearConfig = IsMainnet ? MainNearConfig : TestNearConfig;
export const LsKey = NearConfig.contractName + ":v01:";

function wrapContract(account, contractId, options) {
  const nearContract = new nearAPI.Contract(account, contractId, options);
  const { viewMethods = [], changeMethods = [] } = options;
  const contract = {
    account,
    contractId,
  };
  viewMethods.forEach((methodName) => {
    contract[methodName] = nearContract[methodName];
  });
  changeMethods.forEach((methodName) => {
    contract[methodName] = async (...args) => {
      try {
        return await nearContract[methodName](...args);
      } catch (e) {
        const msg = e.toString();
        if (msg.indexOf("does not have enough balance") !== -1) {
          return await refreshAllowanceObj.refreshAllowance();
        }
        throw e;
      }
    };
  });
  return contract;
}

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

  _near.contract = wrapContract(_near.account, NearConfig.contractName, {
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
  });

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

  _near.sendTransactions = async (items, callbackUrl) => {
    let [nonce, blockHash, accountState] = await Promise.all([
      _near.fetchNextNonce(),
      _near.fetchBlockHash(),
      _near.account.state(),
    ]);

    const maxGasPerTransaction =
      accountState.code_hash === defaultCodeHash
        ? MaxGasPerTransaction
        : MaxGasPerTransaction2FA;

    const transactions = [];
    let actions = [];
    let currentReceiverId = null;
    let currentTotalGas = Big(0);
    items.push([null, null]);
    items.forEach(([receiverId, action]) => {
      const actionGas =
        action && action.functionCall ? Big(action.functionCall.gas) : Big(0);
      const newTotalGas = currentTotalGas.add(actionGas);
      if (
        receiverId !== currentReceiverId ||
        newTotalGas.gt(maxGasPerTransaction)
      ) {
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
        currentTotalGas = actionGas;
        currentReceiverId = receiverId;
      } else {
        currentTotalGas = newTotalGas;
      }
      actions.push(action);
    });
    return await _near.walletConnection.requestSignTransactions(
      transactions,
      callbackUrl
    );
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
