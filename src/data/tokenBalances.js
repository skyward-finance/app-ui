import useSWR from "swr";
import { useAccount } from "./account";
import { NearConfig } from "./near";
import { availableNearBalance } from "./utils";
import { BalanceType } from "../components/account/AccountBalance";
import { useToken } from "./token";
import { useRefFinance } from "./refFinance";
import { useEffect, useState } from "react";

export const getTokenBalancesFetcher = async (
  _key,
  tokenAccountId,
  tokenBalance,
  account,
  refFinance
) => {
  const fetchedBalances = {};
  if (account && !account.loading) {
    if (tokenAccountId in account.balances) {
      const balance = account.balances[tokenAccountId];
      fetchedBalances[BalanceType.Internal] = balance;
    }
    if (tokenBalance) {
      fetchedBalances[BalanceType.Wallet] = tokenBalance;
    }
    if (account.accountId && tokenAccountId === NearConfig.wrapNearAccountId) {
      let nativeNearBalance = availableNearBalance(account);
      fetchedBalances[BalanceType.NEAR] = nativeNearBalance;
    }
    if (refFinance && tokenAccountId in refFinance.balances) {
      const balance = refFinance.balances[tokenAccountId];
      fetchedBalances[BalanceType.Ref] = balance;
    }
  }
  return fetchedBalances;
};

export const useTokenBalances = (tokenAccountId) => {
  const account = useAccount();
  const token = useToken(tokenAccountId);
  const [currentTokenAccountId, setCurrentTokenAccountId] = useState(
    tokenAccountId
  );
  const [tokenBalance, setTokenBalance] = useState(null);
  if (currentTokenAccountId !== tokenAccountId) {
    setCurrentTokenAccountId(tokenAccountId);
    setTokenBalance(null);
  }

  useEffect(() => {
    if (account.accountId && token && token.metadata && tokenBalance === null) {
      token.contract
        .balanceOf(account, account.accountId)
        .then(setTokenBalance)
        .catch(() => setTokenBalance(false));
    }
  }, [account, tokenBalance, token]);

  const { data: tokenBalances } = useSWR(
    ["token_balances", tokenAccountId, tokenBalance, account, useRefFinance()],
    getTokenBalancesFetcher
  );
  return {
    tokenBalances,
    resetTokenBalance: () => {
      setTokenBalance(null);
    },
  };
};
