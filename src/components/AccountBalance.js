import "./AccountBalance.scss";
import React, { useEffect, useState } from "react";
import TokenAndBalance from "./TokenAndBalance";
import { useAccount } from "../data/account";
import TokenSymbol from "./TokenSymbol";
import { useToken } from "../data/token";
import { NearConfig, TGas } from "../data/near";
import { Loading, tokenStorageDeposit } from "../data/utils";
import * as nearAPI from "near-api-js";
import TokenBalance from "./TokenBalance";
import Big from "big.js";
import { useTokenBalances } from "../data/tokenBalances";

export const BalanceType = {
  Internal: "INTERNAL",
  Wallet: "WALLET",
  NEAR: "NEAR",
  Ref: "REF FINANCE",
};

export function AccountBalance(props) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [balances, setBalances] = useState([]);

  const tokenAccountId = props.tokenAccountId;
  const account = useAccount();
  const token = useToken(tokenAccountId);

  const onFetchedBalances = props.onFetchedBalances;

  const { tokenBalances, resetTokenBalance } = useTokenBalances(tokenAccountId);
  useEffect(() => {
    if (tokenBalances) {
      const balances = [];
      Object.entries(tokenBalances).forEach(([key, balance]) => {
        if (balance && balance.gt(0)) {
          balances.push([`${key}: `, balance]);
        }
      });
      setBalances(balances);
      if (onFetchedBalances) {
        onFetchedBalances(tokenBalances);
      }
    }
  }, [tokenBalances, onFetchedBalances]);

  const internalBalance =
    (tokenBalances && tokenBalances[BalanceType.Internal]) || Big(0);
  const refBalance =
    (tokenBalances && tokenBalances[BalanceType.Ref]) || Big(0);
  const tokenBalance =
    (tokenBalances && tokenBalances[BalanceType.Wallet]) || Big(0);

  const canUnwrap =
    tokenAccountId === NearConfig.wrapNearAccountId && tokenBalance.gt(0);

  const clickable =
    props.clickable && (internalBalance.gt(0) || refBalance.gt(0) || canUnwrap);

  const registerAction = async (actions) => {
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
          (await tokenStorageDeposit(tokenAccountId)).toFixed(0)
        ),
      ]);
    }
  };

  const unwrapNearAction = async (actions, balance) => {
    if (tokenAccountId === NearConfig.wrapNearAccountId) {
      const tokenBalance = await token.contract.balanceOf(
        account,
        account.accountId
      );
      actions.push([
        NearConfig.wrapNearAccountId,
        nearAPI.transactions.functionCall(
          "near_withdraw",
          {
            amount: tokenBalance.add(balance).toFixed(0),
          },
          TGas.mul(10).toFixed(0),
          1
        ),
      ]);
    }
  };

  const withdrawInternal = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];
    await registerAction(actions);

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

    await unwrapNearAction(actions, internalBalance);

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
      return;
    }
    await account.refresh();
    resetTokenBalance();
    setLoading(false);
  };

  const withdrawFromRef = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];
    await registerAction(actions);

    actions.push([
      NearConfig.refContractName,
      nearAPI.transactions.functionCall(
        "withdraw",
        {
          token_id: tokenAccountId,
          amount: refBalance.toFixed(0),
          unregister: false,
        },
        TGas.mul(50).toFixed(0),
        1
      ),
    ]);

    await unwrapNearAction(actions, refBalance);
    await account.near.sendTransactions(actions);
  };

  const unwrapNear = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];
    await registerAction(actions);

    await unwrapNearAction(actions, Big(0));
    await account.near.sendTransactions(actions);
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
        <div className="mb-2 flex-buttons">
          {internalBalance.gt(0) && (
            <button
              className="btn btn-primary m-1"
              disabled={internalBalance.eq(0) || loading}
              onClick={(e) => withdrawInternal(e)}
            >
              {loading && Loading}
              Withdraw{" "}
              <TokenBalance
                tokenAccountId={tokenAccountId}
                balance={internalBalance}
              />{" "}
              <TokenSymbol tokenAccountId={tokenAccountId} /> to wallet
            </button>
          )}
          {refBalance.gt(0) && (
            <button
              className="btn btn-primary m-1"
              disabled={refBalance.eq(0) || loading}
              onClick={(e) => withdrawFromRef(e)}
            >
              {loading && Loading}
              Withdraw{" "}
              <TokenBalance
                tokenAccountId={tokenAccountId}
                balance={refBalance}
              />{" "}
              <TokenSymbol tokenAccountId={tokenAccountId} /> from REF Finance
              to wallet
            </button>
          )}
          {canUnwrap && (
            <button
              className="btn btn-primary m-1"
              disabled={!canUnwrap || loading}
              onClick={(e) => unwrapNear(e)}
            >
              {loading && Loading}
              Unwrap{" "}
              <TokenBalance
                tokenAccountId={tokenAccountId}
                balance={tokenBalance}
              />{" "}
              <TokenSymbol tokenAccountId={tokenAccountId} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
