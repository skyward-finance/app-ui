import React, { useState } from "react";
import { useToken } from "../data/token";
import { bigToString, fromTokenBalance } from "../data/utils";
import { useRefFinance } from "../data/ref_finance";
import { NearConfig } from "../data/near";

export default function TokenBalance(props) {
  const [showUsd, setShowUsd] = useState(false);
  const tokenAccountId = props.tokenAccountId;
  const balance = props.balance;
  const token = useToken(tokenAccountId);
  const refFinance = useRefFinance();
  const usdBalance =
    refFinance &&
    !refFinance.loading &&
    tokenAccountId === NearConfig.wrapNearAccountId
      ? balance.mul(refFinance.nearPrice)
      : false;

  const clickable = props.clickable && usdBalance;

  return (
    <span
      className={`font-monospace ${clickable ? "pointer" : ""}`}
      onClick={() => clickable && setShowUsd(!showUsd)}
    >
      {showUsd
        ? `~$${bigToString(fromTokenBalance(token, usdBalance))}`
        : bigToString(fromTokenBalance(token, balance))}
    </span>
  );
}
