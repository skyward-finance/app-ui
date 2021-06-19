import "./SaleInputOutputs.scss";
import TokenAndBalance from "./TokenAndBalance";
import React, { useState } from "react";
import uuid from "react-uuid";

export default function SaleInputOutputs(props) {
  const [gkey] = useState(uuid());
  const sale = props.sale || {};
  const saleEnded = props.sale && props.sale.ended();

  const inputBalances = saleEnded
    ? [["", sale.inTokenPaid || props.inTokenPaid]]
    : props.detailed
    ? [
        ["PAID: ", sale.inTokenPaid || props.inTokenPaid],
        ["REMAINING: ", sale.inTokenRemaining || props.inTokenRemaining],
      ]
    : [["", sale.inTokenRemaining || props.inTokenRemaining]];

  const outputBalances = (o) =>
    saleEnded
      ? [["", o.distributed]]
      : props.detailed
      ? [
          [o.distributedLabel || "DISTRIBUTED: ", o.distributed],
          [o.remainingLabel || "REMAINING: ", o.remaining],
        ]
      : [["", o.remaining]];

  return (
    <div>
      <label className="text-muted">{props.inputLabel || "Total Paying"}</label>
      <TokenAndBalance
        className="sale-token-input"
        tokenAccountId={sale.inTokenAccountId || props.inTokenAccountId}
        balances={inputBalances}
      />
      <div className="text-center" style={{ position: "relative" }}>
        <label
          className="text-muted"
          style={{ position: "absolute", left: 0, bottom: 0 }}
        >
          {props.outputLabel || "Total Receiving"}
        </label>
        <i className="bi bi-arrow-down fs-3" />
      </div>
      {(sale.outTokens || props.outTokens).map((o, i) => {
        const key = `${gkey}-out-token-${i}`;
        return (
          <TokenAndBalance
            key={key}
            className="sale-token-output"
            tokenAccountId={o.tokenAccountId}
            balances={outputBalances(o)}
          />
        );
      })}
    </div>
  );
}
