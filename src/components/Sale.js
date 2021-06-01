import "./Sale.scss";
import "./SalePreview.scss";
import React from "react";
import RemainingDuration from "./RemainingDuration";
import SaleInputOutputs from "./SaleInputOutputs";
import Rate from "./Rate";
import Subscription from "./Subscription";

export default function Sale(props) {
  const sale = props.sale;

  return (
    <div>
      <div>
        <div className="card m-2">
          <div className="card-body">
            <h2>{sale.title || "Noname sale"}</h2>
            <hr />
            <SaleInputOutputs sale={sale} detailed />
            <Rate title="Current Rate" sale={sale} />
            <hr />
            <RemainingDuration sale={sale} />
          </div>
        </div>
        <div className="card m-2">
          <div className="card-body">
            Price history
            <br />
            <span className="text-muted">Coming soon</span>
          </div>
        </div>
      </div>
      <Subscription sale={sale} />
    </div>
  );
}
