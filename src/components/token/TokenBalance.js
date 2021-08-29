import React, { useState } from "react";
import { useToken } from "../../data/token";
import {
  bigToString,
  computeUsdBalance,
  fromTokenBalance,
} from "../../data/utils";
import { useRefFinance } from "../../data/refFinance";
import MutedDecimals from "../common/MutedDecimals";

export default function TokenBalance(props) {
  const [showUsd, setShowUsd] = useState(props.showUsd);
  const tokenAccountId = props.tokenAccountId;
  const balance = props.balance;
  const token = useToken(tokenAccountId);
  const refFinance = useRefFinance();
  const usdBalance = computeUsdBalance(refFinance, tokenAccountId, balance);

  const clickable = props.clickable && usdBalance;

  return (
    <span
      className={`font-monospace ${clickable ? "pointer" : ""} ${
        props.className || "fw-bold"
      }`}
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          setShowUsd(!showUsd);
        }
      }}
    >
      {showUsd && <span className="text-secondary">~$</span>}
      <MutedDecimals
        value={
          showUsd
            ? bigToString(usdBalance)
            : bigToString(fromTokenBalance(token, balance))
        }
      />
    </span>
  );
}
