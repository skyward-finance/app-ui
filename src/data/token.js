import Big from "big.js";
import ls from "local-storage";
import { isValidAccountId, keysToCamel } from "./utils";
import useSWR from "swr";
import { useAccount } from "./account";
import { LsKey } from "./near";

const TokenExpirationDuration = 7 * 24 * 60 * 60 * 1000;
const NotFoundExpiration = 24 * 60 * 60 * 1000;

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
    isRegistered: async (accountId) => {
      return !!(await account.near.account.viewFunction(
        tokenAccountId,
        "storage_balance_of",
        {
          account_id: accountId,
        }
      ));
    },
  };

  if (localToken && localToken.expires > time) {
    return Object.assign(
      {
        contract,
      },
      localToken.data
    );
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
    data: token,
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
