import React, { useState } from "react";
import { useSales } from "../data/sales";
import uuid from "react-uuid";
import { useParams } from "react-router";
import Sale from "../components/Sale";

function SalePage(props) {
  let { saleId } = useParams();
  const [gkey] = useState(uuid());
  const sales = useSales();

  saleId = parseInt(saleId);
  const key = `${gkey}-${saleId}`;
  const sale = sales.sales[saleId];

  return (
    <div>
      <div className="container">
        <div className="row justify-content-md-center mb-3">
          {sales.loading ? (
            "Loading"
          ) : sale ? (
            <div>
              <Sale key={key} sale={sale} />
            </div>
          ) : (
            "Sale not found"
          )}
        </div>
      </div>
    </div>
  );
}

export default SalePage;
