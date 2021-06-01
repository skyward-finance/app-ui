import "./SalesPage.scss";
import React, { useState } from "react";
import { useSales } from "../data/sales";
import uuid from "react-uuid";
import SalePreview from "../components/SalePreview";

function SalesPage(props) {
  const [gkey] = useState(uuid());
  const sales = useSales();

  // while (sales && sales.sales.length >= 1 && sales.sales.length < 5) {
  //   sales.sales.push(
  //     Object.assign({}, sales.sales[0], {
  //       saleId: sales.sales.length,
  //       subscription: null,
  //     })
  //   );
  // }

  const saleCards = sales.sales.map((sale) => {
    const key = `${gkey}-${sale.saleId}`;
    return <SalePreview key={key} sale={sale} />;
  });

  return (
    <div>
      <div className="container">
        <div className="row justify-content-md-center mb-3 sales-page">
          {sales.loading ? "Loading" : saleCards}
        </div>
      </div>
    </div>
  );
}

export default SalesPage;
