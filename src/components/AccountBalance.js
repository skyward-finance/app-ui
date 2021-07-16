import "./AccountBalance.scss";
import React, { useEffect, useState } from "react";
import TokenAndBalance from "./TokenAndBalance";
import { useAccount } from "../data/account";
import TokenSymbol from "./TokenSymbol";
import { useToken } from "../data/token";
import { NearConfig, TGas, TokenStorageDeposit } from "../data/near";
import { availableNearBalance, Loading } from "../data/utils";
import * as nearAPI from "near-api-js";
import TokenBalance from "./TokenBalance";
import Big from "big.js";

export const BalanceType = {
  Internal: "Internal",
  Wallet: "Wallet",
  NEAR: "NEAR",
};

export function AccountBalance(props) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tokenAccountId = props.tokenAccountId;
  const [currentTokenAccountId, setTokenAccountAccountId] = useState(
    tokenAccountId
  );
  const account = useAccount();

  const token = useToken(tokenAccountId);

  const [balances, setBalances] = useState([]);
  const [tokenBalance, setTokenBalance] = useState(null);
  if (currentTokenAccountId !== tokenAccountId) {
    setTokenAccountAccountId(tokenAccountId);
    setTokenBalance(null);
  }

  const [withdrawableBalance, setWithdrawableBalance] = useState(Big(0));

  const onFetchedBalances = props.onFetchedBalances;

  useEffect(() => {
    const balances = [];
    const fetchedBalances = {};
    if (account && !account.loading) {
      let withdrawableBalance = Big(0);
      if (tokenAccountId in account.balances) {
        balances.push(["INTERNAL: ", account.balances[tokenAccountId]]);
        withdrawableBalance = account.balances[tokenAccountId];
        fetchedBalances[BalanceType.Internal] =
          account.balances[tokenAccountId];
      }
      if (tokenBalance !== null) {
        if (tokenBalance) {
          balances.push(["WALLET: ", tokenBalance]);
          fetchedBalances[BalanceType.Wallet] = tokenBalance;
        }
      } else {
        if (account.accountId && token && token.metadata) {
          token.contract
            .balanceOf(account, account.accountId)
            .then((b) => {
              setTokenBalance(b);
            })
            .catch((e) => setTokenBalance(false));
        }
      }
      if (
        account.accountId &&
        tokenAccountId === NearConfig.wrapNearAccountId
      ) {
        let nativeNearBalance = availableNearBalance(account);
        balances.push(["NEAR: ", nativeNearBalance]);
        fetchedBalances[BalanceType.NEAR] = nativeNearBalance;
      }
      setBalances([...balances]);
      setWithdrawableBalance(withdrawableBalance);
      if (onFetchedBalances) {
        onFetchedBalances(fetchedBalances);
      }
    }
  }, [account, token, tokenAccountId, tokenBalance, onFetchedBalances]);

  const clickable = props.clickable && withdrawableBalance.gt(0);

  const withdraw = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];

    if (!(await token.contract.isRegistered(account, account.accountId))) {
      actions.push([
        tokenAccountId,
        nearAPI.transactions.functionCall(
          "storage_deposit",
          {
            account_id: account.accountId,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          TokenStorageDeposit.toFixed(0)
        ),
      ]);
    }

    actions.push([
      NearConfig.contractName,
      nearAPI.transactions.functionCall(
        "withdraw_token",
        {
          token_account_id: tokenAccountId,
        },
        TGas.mul(40).toFixed(0),
        0
      ),
    ]);

    if (tokenAccountId === NearConfig.wrapNearAccountId) {
      const tokenBalance = await token.contract.balanceOf(
        account,
        account.accountId
      );
      const internalBalance = account.balances[tokenAccountId];
      actions.push([
        NearConfig.wrapNearAccountId,
        nearAPI.transactions.functionCall(
          "near_withdraw",
          {
            amount: tokenBalance.add(internalBalance).toFixed(0),
          },
          TGas.mul(10).toFixed(0),
          1
        ),
      ]);
    }

    if (actions.length === 1) {
      // simple
      await account.near.contract.withdraw_token(
        {
          token_account_id: tokenAccountId,
        },
        TGas.mul(40).toFixed(0),
        0
      );
    } else {
      await account.near.sendTransactions(actions);
    }
    await account.refresh();
    setTokenBalance(null);
    setLoading(false);
  };

  return (
    <div>
      <div
        className={`account-balance ${clickable ? "clickable" : ""}`}
        onClick={() => clickable && setExpanded(!expanded)}
      >
        <TokenAndBalance tokenAccountId={tokenAccountId} balances={balances} />
      </div>
      {expanded && (
        <div className="mb-2">
          <button
            className="btn btn-primary m-1"
            disabled={withdrawableBalance.eq(0) || loading}
            onClick={(e) => withdraw(e)}
          >
            {loading && Loading}
            Withdraw{" "}
            <TokenBalance
              tokenAccountId={tokenAccountId}
              balance={withdrawableBalance}
            />{" "}
            <TokenSymbol tokenAccountId={tokenAccountId} /> to wallet
          </button>
        </div>
      )}
    </div>
  );
}
