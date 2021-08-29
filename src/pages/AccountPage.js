import React, { useState } from "react";
import Account from "../components/account/Account";
import { useSales } from "../data/sales";
import SalePreview from "../components/sale/SalePreview";
import uuid from "react-uuid";
import AllReferrals from "../components/account/AllReferrals";

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
        {yourSales.length > 0 && (
          <div className="row justify-content-md-evenly mb-3 sales-page">
            <h2 className="primary-header">Your subscriptions</h2>
            {yourSales.map((sale) => {
              const key = `${gkey}-sale-${sale.saleId}`;
              return <SalePreview key={key} sale={sale} />;
            })}
          </div>
        )}
        <AllReferrals />
      </div>
    </div>
  );
}
