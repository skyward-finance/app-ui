import "./Rate.scss";
import React from "react";
import TokenSymbol from "./TokenSymbol";
import Big from "big.js";
import { bigToString, fromTokenBalance } from "../data/utils";
import { useToken } from "../data/token";

export default function Rate(props) {
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

  return (
    <div className="clearfix">
      {props.title || "Rate"}
      {price ? (
        <div className="float-end text-muted">
          <div>
            1 <TokenSymbol tokenAccountId={inTokenAccountId} /> ={" "}
            <span className="rate">{bigToString(price)}</span>{" "}
            <TokenSymbol tokenAccountId={out.tokenAccountId} />
          </div>
          <div>
            1 <TokenSymbol tokenAccountId={out.tokenAccountId} /> ={" "}
            <span className="rate">{bigToString(inversePrice)}</span>{" "}
            <TokenSymbol tokenAccountId={inTokenAccountId} />
          </div>
        </div>
      ) : (
        <div className="float-end text-muted">???</div>
      )}
    </div>
  );
}