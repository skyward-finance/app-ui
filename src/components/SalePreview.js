import "./Sale.scss";
import "./SalePreview.scss";
import React from "react";
import { Link } from "react-router-dom";
import RemainingDuration from "./RemainingDuration";
import SaleInputOutputs from "./SaleInputOutputs";
import SaleRate from "./SaleRate";

export default function SalePreview(props) {
  const sale = props.sale;
  return (
    <div className="sale-preview card m-2">
      <div className="card-body">
        <Link to={`/sale/${sale.saleId}`} className="sale-title-link">
          <h5 className="primary-header">{sale.title || "Noname sale"}</h5>
        </Link>
        <hr />
        <SaleInputOutputs sale={sale} />
        <SaleRate sale={sale} />
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
