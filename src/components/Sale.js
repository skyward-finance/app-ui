import "./Sale.scss";
import "./SalePreview.scss";
import React from "react";
import RemainingDuration from "./RemainingDuration";
import SaleInputOutputs from "./SaleInputOutputs";
import Subscription from "./Subscription";
import ReferralLink from "./ReferralLink";
import PriceHistory from "./PriceHistory";
import SaleRate from "./SaleRate";
import SaleStats from "./SaleStats";
import { IsMainnet } from "../data/near";

export default function Sale(props) {
  const sale = props.sale;

  return (
    <>
      <div className="card mb-2">
        <div className="card-body">
          <h2 className="sale-title primary-header">
            {sale.title || "Noname sale"}
          </h2>
          <hr />
          <SaleInputOutputs sale={sale} detailed />
          <SaleRate sale={sale} />
          {IsMainnet && <SaleStats sale={sale} />}
          <hr />
          <RemainingDuration sale={sale} />
        </div>
      </div>
      <Subscription sale={sale} />
      {!sale.farAhead() && <PriceHistory sale={sale} />}
      <ReferralLink sale={sale} />
    </>
  );
}
