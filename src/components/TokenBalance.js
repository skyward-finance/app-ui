import React, { useState } from "react";
import { useToken } from "../data/token";
import { bigToString, fromTokenBalance } from "../data/utils";
import { useRefFinance } from "../data/ref_finance";
import { NearConfig } from "../data/near";
import MutedDecimals from "./MutedDecimals";

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
      className={`font-monospace fw-bold ${clickable ? "pointer" : ""}`}
      onClick={() => clickable && setShowUsd(!showUsd)}
    >
      {showUsd && <span className="text-secondary">~$</span>}
      <MutedDecimals
        value={
          showUsd
            ? bigToString(fromTokenBalance(token, usdBalance))
            : bigToString(fromTokenBalance(token, balance))
        }
      />
    </span>
  );
}
