import Rate from "./components/Rate";
import React from "react";

export default function SaleRate(props) {
  const sale = props.sale;
  return sale.ended() ? (
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
    <Rate title="Current Rate" sale={sale} />
  );
}
