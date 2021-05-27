import "./Sale.scss";
import "./SalePreview.scss";
import React from "react";
import { Link } from "react-router-dom";
import RemainingDuration from "./RemainingDuration";
import SaleInputOutputs from "./SaleInputOutputs";
import Rate from "./Rate";

export default function SalePreview(props) {
  const sale = props.sale;

  return (
    <div className="sale-preview card m-2">
      <Link to={`/sale/${sale.saleId}`}>
        <h5 className="card-header">{sale.title || "Noname sale"}</h5>
      </Link>
      <div className="card-body">
        <SaleInputOutputs sale={sale} />
        <Rate sale={sale} />
        <hr />
        <RemainingDuration sale={sale} />
      </div>
      {sale.subscription && <div className="card-footer">"Sub"</div>}
    </div>
  );
}
