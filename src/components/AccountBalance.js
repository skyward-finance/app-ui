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

export default function AccountBalance(props) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const tokenAccountId = props.tokenAccountId;
  const account = useAccount();

  const token = useToken(tokenAccountId);

  const [balances, setBalances] = useState([]);
  const [tokenBalance, setTokenBalance] = useState(null);

  useEffect(() => {
    const balances = [];
    if (account && !account.loading) {
      if (tokenAccountId in account.balances) {
        balances.push(["BALANCE: ", account.balances[tokenAccountId]]);
      }
      if (tokenBalance !== null) {
        balances.push(["WALLET: ", tokenBalance]);
      } else {
        if (account.accountId && token && token.metadata) {
          token.contract.balanceOf(account, account.accountId).then((b) => {
            setTokenBalance(b);
          });
        }
      }
      if (
        account.accountId &&
        tokenAccountId === NearConfig.wrapNearAccountId
      ) {
        let nativeNearBalance = availableNearBalance(account);
        balances.push(["NEAR: ", nativeNearBalance]);
      }
      setBalances([...balances]);
    }
  }, [account, token, tokenAccountId, tokenBalance]);

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
      <div className="account-balance" onClick={() => setExpanded(!expanded)}>
        <TokenAndBalance tokenAccountId={tokenAccountId} balances={balances} />
      </div>
      {expanded && (
        <div className="mb-2">
          <button
            className="btn btn-primary m-1"
            disabled={balances.length === 0 || balances[0][1].eq(0) || loading}
            onClick={(e) => withdraw(e)}
          >
            {loading && Loading}
            Withdraw{" "}
            <TokenBalance
              tokenAccountId={tokenAccountId}
              balance={balances[0][1]}
            />{" "}
            <TokenSymbol tokenAccountId={tokenAccountId} /> to wallet
          </button>
        </div>
      )}
    </div>
  );
}
