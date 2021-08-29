import "./Rate.scss";
import React, { useState } from "react";
import TokenSymbol from "../token/TokenSymbol";
import Big from "big.js";
import {
  bigToString,
  computeUsdBalance,
  fromTokenBalance,
  toTokenBalance,
} from "../../data/utils";
import { useToken } from "../../data/token";
import { useRefFinance } from "../../data/refFinance";
import MutedDecimals from "./MutedDecimals";

const View = {
  Regular: "Regular",
  USD: "USD",
  Inverse: "Inverse",
};

export default function Rate(props) {
  const [view, setView] = useState(0);
  const sale = props.sale || {};
  const outTokens = sale.outTokens || props.outTokens;
  const out = outTokens[0];
  const inTokenAccountId = sale.inTokenAccountId || props.inTokenAccountId;
  const inTokenRemaining = sale.inTokenRemaining || props.inTokenRemaining;
  const inToken = useToken(inTokenAccountId);
  const outToken = useToken(out.tokenAccountId);

  const inAmount = fromTokenBalance(inToken, inTokenRemaining);
  const outAmount = fromTokenBalance(outToken, out.remaining);

  const price = inAmount.gt(0) ? outAmount.div(inAmount) : null;
  const inversePrice = price && price.gt(0) ? Big(1).div(price) : null;

  const refFinance = useRefFinance();
  const usdBalance = computeUsdBalance(
    refFinance,
    inTokenAccountId,
    toTokenBalance(inToken, inversePrice)
  );

  const views = [View.Regular];
  if (usdBalance) {
    views.push(View.USD);
  }
  if (!props.hideInverse) {
    views.push(View.Inverse);
  }

  const numViews = views.length;

  return (
    <div className="left-right">
      <div className="rate-title">{props.title || "Rate"}</div>
      {price ? (
        <div
          className="rate-body text-muted"
          onClick={() => setView((view + 1) % numViews)}
        >
          {views[view] === View.Inverse ? (
            <div>
              1 <TokenSymbol tokenAccountId={inTokenAccountId} /> ={" "}
              <span className="rate-value">
                <MutedDecimals value={bigToString(price)} />
              </span>{" "}
              <TokenSymbol tokenAccountId={out.tokenAccountId} />
            </div>
          ) : views[view] === View.Regular ? (
            <div>
              1 <TokenSymbol tokenAccountId={out.tokenAccountId} /> ={" "}
              <span className="rate-value">
                <MutedDecimals value={bigToString(inversePrice)} />
              </span>{" "}
              <TokenSymbol tokenAccountId={inTokenAccountId} />
            </div>
          ) : (
            <div>
              1 <TokenSymbol tokenAccountId={out.tokenAccountId} /> = ~
              <span className="rate-value">
                <MutedDecimals value={bigToString(usdBalance)} />
              </span>{" "}
              USD
            </div>
          )}
        </div>
      ) : (
        <div className="float-end text-muted">???</div>
      )}
    </div>
  );
}
