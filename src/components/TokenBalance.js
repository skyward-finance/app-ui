import React, { useState } from "react";
import { useToken } from "../data/token";
import {
  bigToString,
  computeUsdBalance,
  fromTokenBalance,
} from "../data/utils";
import { useRefFinance } from "../data/refFinance";
import MutedDecimals from "./MutedDecimals";

export default function TokenBalance(props) {
  const [showUsd, setShowUsd] = useState(false);
  const tokenAccountId = props.tokenAccountId;
  const balance = props.balance;
  const token = useToken(tokenAccountId);
  const refFinance = useRefFinance();
  const usdBalance = computeUsdBalance(refFinance, tokenAccountId, balance);

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
            ? bigToString(usdBalance)
            : bigToString(fromTokenBalance(token, balance))
        }
      />
    </span>
  );
}
