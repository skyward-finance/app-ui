import TokenSymbol from "./TokenSymbol";
import TokenBalance from "./TokenBalance";
import React from "react";

export default function TokenAndBalance(props) {
  return (
    <div className={`alert sale-token ${props.className}`}>
      <TokenSymbol
        className="badge token-symbol font-monospace"
        tokenAccountId={props.tokenAccountId}
      />{" "}
      <div className="float-end">
        <TokenBalance
          tokenAccountId={props.tokenAccountId}
          balance={props.balance}
        />
      </div>
    </div>
  );
}
