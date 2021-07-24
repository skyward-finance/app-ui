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
  const [withdrawableBalance, setWithdrawableBalance] = useState(Big(0));

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
      setWithdrawableBalance(
        (tokenBalances[BalanceType.Internal] || Big(0)).add(
          tokenBalances[BalanceType.Ref] || Big(0)
        )
      );
      if (onFetchedBalances) {
        onFetchedBalances(tokenBalances);
      }
    }
  }, [tokenBalances, onFetchedBalances]);

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
          (await tokenStorageDeposit(tokenAccountId)).toFixed(0)
        ),
      ]);
    }

    let isInternal = false;
    if (
      BalanceType.Internal in tokenBalances &&
      tokenBalances[BalanceType.Internal].gt(0)
    ) {
      isInternal = true;
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
    }

    if (
      BalanceType.Ref in tokenBalances &&
      tokenBalances[BalanceType.Ref].gt(0)
    ) {
      actions.push([
        NearConfig.refContractName,
        nearAPI.transactions.functionCall(
          "withdraw",
          {
            token_id: tokenAccountId,
            amount: tokenBalances[BalanceType.Ref].toFixed(0),
            unregister: false,
          },
          TGas.mul(50).toFixed(0),
          1
        ),
      ]);
    }

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
            amount: tokenBalance.add(withdrawableBalance).toFixed(0),
          },
          TGas.mul(10).toFixed(0),
          1
        ),
      ]);
    }

    if (actions.length === 1 && isInternal) {
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
