import Rate from "./Rate";
import React from "react";

export default function SaleRate(props) {
  const sale = props.sale;
  return sale.farAhead() ? null : sale.ended() ? (
    <Rate
      title="Average Rate"
      inTokenAccountId={sale.inTokenAccountId}
      inTokenRemaining={sale.inTokenPaid}
      outTokens={[
        {
          remaining: sale.outTokens[0].distributed,
          tokenAccountId: sale.outTokens[0].tokenAccountId,
        },
      ]}
    />
  ) : (
    <Rate
      title={sale.started() ? "Current Rate" : "Expected Rate"}
      sale={sale}
    />
  );
}
