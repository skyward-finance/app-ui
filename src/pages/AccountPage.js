import React, { useState } from "react";
import Account from "../components/Account";
import { useSales } from "../data/sales";
import SalePreview from "../components/SalePreview";
import uuid from "react-uuid";

export default function AccountPage(props) {
  const [gkey] = useState(uuid());
  const sales = useSales();

  const yourSales = [...sales.sales].filter((sale) => !!sale.subscription);
  yourSales.sort((a, b) => b.endDate - a.endDate);

  return (
    <div>
      <div className="container">
        <div className="row mb-3">
          <Account {...props} />
        </div>
        {yourSales && (
          <div className="row justify-content-md-center mb-3 sales-page">
            <h2 className="primary-header">Your subscriptions</h2>
            {yourSales.map((sale) => {
              const key = `${gkey}-sale-${sale.saleId}`;
              return <SalePreview key={key} sale={sale} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
