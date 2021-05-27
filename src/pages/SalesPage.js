import React, { useState } from "react";
import { useSales } from "../data/sales";
import uuid from "react-uuid";
import SalePreview from "../components/SalePreview";

function SalesPage(props) {
  const [gkey] = useState(uuid());
  const sales = useSales();

  const saleCards = sales.sales.map((sale) => {
    const key = `${gkey}-${sale.saleId}`;
    return <SalePreview key={key} sale={sale} />;
  });

  return (
    <div>
      <div className="container">
        <div className="row justify-content-md-center mb-3">
          {sales.loading ? "Loading" : <div>{saleCards}</div>}
        </div>
      </div>
    </div>
  );
}

export default SalesPage;
