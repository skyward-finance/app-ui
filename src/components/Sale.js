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
        <h2>{sale.title || "Noname sale"}</h2>
        <div className="price-history card m-2">
          <div className="card-body">
            Price history
            <br />
            <span className="text-muted">Coming soon</span>
          </div>
        </div>
        <div className="sale-preview card m-2">
          <div className="card-body">
            <SaleInputOutputs sale={sale} />
            <Rate title="Current Rate" sale={sale} />
          </div>
        </div>
        <div className="card m-2">
          <div className="card-body">
            <RemainingDuration sale={sale} />
          </div>
        </div>
      </div>
      <Subscription sale={sale} />
    </div>
  );
}
