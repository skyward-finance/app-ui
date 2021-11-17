import "./AccountBalance.scss";
import React, { useEffect, useState } from "react";
import TokenAndBalance from "../token/TokenAndBalance";
import { useAccount } from "../../data/account";
import TokenSymbol from "../token/TokenSymbol";
import {
  tokenRegisterStorageAction,
  useToken,
  WrappedTokens,
  WrappedTokenType,
} from "../../data/token";
import { NearConfig, TGas } from "../../data/near";
import { keysToCamel, Loading } from "../../data/utils";
import * as nearAPI from "near-api-js";
import TokenBalance from "../token/TokenBalance";
import Big from "big.js";
import { useTokenBalances } from "../../data/tokenBalances";

export const BalanceType = {
  Internal: "INTERNAL",
  Wallet: "WALLET",
  NEAR: "NEAR",
  Ref: "REF FINANCE",
};

export function AccountBalance(props) {
  const tokenAccountId = props.tokenAccountId;

  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState([]);

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

  const [isUnlocked, setIsUnlocked] = useState(null);

  useEffect(() => {
    if (isUnlocked === null && token && account.near) {
      if (token.contract.isWrappedToken) {
        token.contract.isUnlocked(account).then(setIsUnlocked);
      } else {
        setIsUnlocked(false);
      }
    }
  }, [isUnlocked, token, account]);

  const canUnwrap = tokenBalance.gt(0) && isUnlocked;

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(canUnwrap);
  }, [canUnwrap]);

  const clickable =
    props.clickable && (internalBalance.gt(0) || refBalance.gt(0) || canUnwrap);

  const registerAction = (actions) =>
    tokenRegisterStorageAction(account, tokenAccountId, actions);

  const unwrapTokenAction = async (actions, balance) => {
    if (canUnwrap) {
      if (WrappedTokens[tokenAccountId] === WrappedTokenType.WrappedNEAR) {
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
      } else if (WrappedTokens[tokenAccountId] === WrappedTokenType.WrappedFT) {
        const info = keysToCamel(
          await account.near.account.viewFunction(tokenAccountId, "get_info")
        );
        const lockedTokenAccountId = info.lockedTokenAccountId;
        await tokenRegisterStorageAction(
          account,
          lockedTokenAccountId,
          actions
        );
        actions.push([
          tokenAccountId,
          nearAPI.transactions.functionCall(
            "unwrap",
            {},
            TGas.mul(50).toFixed(0),
            1
          ),
        ]);
      }
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

    await unwrapTokenAction(actions, internalBalance);

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
        TGas.mul(70).toFixed(0),
        1
      ),
    ]);

    await unwrapTokenAction(actions, refBalance);
    await account.near.sendTransactions(actions);
  };

  const unwrapToken = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];
    await registerAction(actions);

    await unwrapTokenAction(actions, Big(0));
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
              onClick={(e) => unwrapToken(e)}
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
