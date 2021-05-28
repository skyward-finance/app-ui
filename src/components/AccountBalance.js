import "./AccountBalance.scss";
import React, { useState } from "react";
import TokenAndBalance from "./TokenAndBalance";
import { useAccount } from "../data/account";
import TokenSymbol from "./TokenSymbol";

export default function AccountBalance(props) {
  const [expanded, setExpanded] = useState(false);

  const tokenAccountId = props.tokenAccountId;
  const account = useAccount();
  const balances = [];
  if (account && !account.loading) {
    if (tokenAccountId in account.balances) {
      balances.push(["INTERNAL: ", account.balances[tokenAccountId]]);
    }
  }

  return (
    <div>
      <div className="account-balance" onClick={() => setExpanded(!expanded)}>
        <TokenAndBalance tokenAccountId={tokenAccountId} balances={balances} />
      </div>
      {expanded && (
        <div>
          <button className="btn btn-primary m-1">
            Deposit <TokenSymbol tokenAccountId={tokenAccountId} />
          </button>
          <button className="btn btn-outline-primary m-1">
            Withdraw <TokenSymbol tokenAccountId={tokenAccountId} />
          </button>
        </div>
      )}
    </div>
  );
}
