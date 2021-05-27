import React from "react";
import { useToken } from "../data/token";
import { bigToString, fromTokenBalance } from "../data/utils";

function TokenBalance(props) {
  const tokenAccountId = props.tokenAccountId;
  const balance = props.balance;
  const token = useToken(tokenAccountId);
  return (
    <span className="font-monospace">
      {bigToString(fromTokenBalance(token, balance))}
    </span>
  );
}

export default TokenBalance;
