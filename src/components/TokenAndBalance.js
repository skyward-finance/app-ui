import "./TokenAndBalance.scss";
import TokenBalance from "./TokenBalance";
import React, { useState } from "react";
import TokenBadge from "./TokenBadge";
import uuid from "react-uuid";

export default function TokenAndBalance(props) {
  const [gkey] = useState(uuid());

  return (
    <div className={`alert sale-token ${props.className || ""}`}>
      <TokenBadge tokenAccountId={props.tokenAccountId} />{" "}
      <div className="float-end text-end balances text-nowrap">
        {props.balances.map(([label, balance], i) => (
          <div key={`${gkey}-${i}`}>
            <span className="text-muted">{label}</span>
            <TokenBalance
              tokenAccountId={props.tokenAccountId}
              balance={balance}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
