import "./Sale.scss";
import "./SalePreview.scss";
import React from "react";
import { Link } from "react-router-dom";
import RemainingDuration from "./RemainingDuration";
import SaleInputOutputs from "./SaleInputOutputs";
import Rate from "./Rate";

export default function SalePreview(props) {
  const sale = props.sale;
  /*
  const subscription = sale.subscription || {
    claimedOutBalance: sale.outTokens.map(() => Big(0)),
    spentInBalance: Big(0),
    remainingInBalance: Big(0),
    unclaimedOutBalances: sale.outTokens.map(() => Big(0)),
    shares: Big(0),
  };
  const subOutTokens = sale.outTokens.map((o, i) => {
    return {
      tokenAccountId: o.tokenAccountId,
      remainingLabel: "EXPECTED: ",
      distributedLabel: "RECEIVED: ",
      remaining: sale.totalShares.gt(0)
        ? ((sale.subscription && sale.subscription.shares) || Big(0))
            .mul(o.remaining)
            .div(sale.totalShares)
        : Big(0),
      distributed: subscription.claimedOutBalance[i].add(
        subscription.unclaimedOutBalances[i]
      ),
    };
  });
  <div>
            <hr />
            <SaleInputOutputs
              inputLabel="You are Paying"
              inTokenAccountId={sale.inTokenAccountId}
              inTokenRemaining={subscription.remainingInBalance}
              inTokenPaid={subscription.spentInBalance}
              outputLabel="Expecting to Receive"
              outTokens={subOutTokens}
            />
          </div>
   */

  return (
    <div className="sale-preview card m-2">
      <div className="card-body">
        <Link to={`/sale/${sale.saleId}`} className="sale-title">
          <h5>{sale.title || "Noname sale"}</h5>
        </Link>
        <hr />
        <SaleInputOutputs sale={sale} />
        <Rate sale={sale} />
        <hr />
        <RemainingDuration sale={sale} />
        <div className="d-grid gap-2">
          <Link
            to={`/sale/${sale.saleId}`}
            className={`btn mt-2 ${
              sale.subscription ? "btn-primary" : "btn-outline-primary"
            }`}
          >
            {sale.subscription ? "Your subscription" : "Details"}
          </Link>
        </div>
      </div>
    </div>
  );
}
