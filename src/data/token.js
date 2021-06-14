import Big from "big.js";
import ls from "local-storage";
import { isValidAccountId, keysToCamel } from "./utils";
import useSWR from "swr";
import { useAccount } from "./account";
import { LsKey } from "./near";

const TokenExpirationDuration = 30 * 60 * 1000;
const NotFoundExpiration = 60 * 1000;

export const isTokenRegistered = async (account, tokenAccountId, accountId) => {
  const storageBalance = await account.near.account.viewFunction(
    tokenAccountId,
    "storage_balance_of",
    {
      account_id: accountId,
    }
  );
  return storageBalance && storageBalance.total !== "0";
};

// const tokenBalances = {};

export const getTokenFetcher = async (_key, tokenAccountId, account) => {
  if (!isValidAccountId(tokenAccountId)) {
    return {
      invalidAccount: true,
    };
  }
  const lsKey = LsKey + "tokens:" + tokenAccountId;
  const localToken = ls.get(lsKey);
  const time = new Date().getTime();

  const contract = {
    balanceOf: async (accountId) => {
      /*
      const balances = tokenBalances[tokenAccountId] || {};
      tokenBalances[tokenAccountId] = balances;
      if (!fresh && accountId in balances) {
        return balances[accountId];
      }
      (balances[accountId] =
       */

      return Big(
        await account.near.account.viewFunction(
          tokenAccountId,
          "ft_balance_of",
          {
            account_id: accountId,
          }
        )
      );
    },
    isRegistered: async (accountId) =>
      isTokenRegistered(account, tokenAccountId, accountId),
  };

  if (localToken && localToken.expires > time) {
    const token = Object.assign({}, localToken.data, { contract });
    token.totalSupply = Big(token.totalSupply);
    return token;
  }
  if (!account) {
    return null;
  }
  let expiration = TokenExpirationDuration;
  let token = false;
  try {
    let [metadata, totalSupply] = await Promise.all([
      account.near.account.viewFunction(tokenAccountId, "ft_metadata"),
      account.near.account.viewFunction(tokenAccountId, "ft_total_supply"),
    ]);
    token = {
      contract,
      metadata: keysToCamel(metadata),
      totalSupply: Big(totalSupply),
    };
  } catch (e) {
    const errString = e.message.toString();
    if (errString.indexOf("does not exist while viewing") < 0) {
      console.error(e);
      return false;
    }
    token = {
      notFound: true,
    };
    expiration = NotFoundExpiration;
  }
  ls.set(lsKey, {
    expires: time + expiration,
    data: Object.assign({}, token, {
      totalSupply: token.totalSupply.toFixed(0),
    }),
  });
  return token;
};

export const useToken = (tokenAccountId) => {
  const { data: token } = useSWR(
    ["token_account_id", tokenAccountId, useAccount()],
    getTokenFetcher
  );
  return token;
};
