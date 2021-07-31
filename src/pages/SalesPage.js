import "./SalesPage.scss";
import React, { useState } from "react";
import { useSales } from "../data/sales";
import uuid from "react-uuid";
import SalePreview from "../components/SalePreview";
import { Loading } from "../data/utils";

function SalesPage(props) {
  const [gkey] = useState(uuid());
  const sales = useSales();

  const sortedSales = [...sales.sales];
  sortedSales.sort((a, b) => a.endDate - b.endDate);

  const allUpcomingSales = sortedSales.filter(
    (sale) => !sale.ended() && !sale.started()
  );
  const currentSalesAndSoon = sortedSales.filter(
    (sale) => !sale.ended() && (sale.started() || !sale.farAhead())
  );
  const upcomingSales = allUpcomingSales.filter((sale) => sale.farAhead());
  const endedSales = sortedSales.filter((sale) => sale.ended());

  const saleList = (sale) => {
    const key = `${gkey}-sale-${sale.saleId}`;
    return <SalePreview key={key} sale={sale} />;
  };

  const allSales = [
    ["Current sales or starting soon", currentSalesAndSoon],
    ["Upcoming sales", upcomingSales],
    ["Ended sales", endedSales],
  ];

  return (
    <div>
      <div className="container">
        {sales.loading ? (
          <div className="row justify-content-md-center mb-3 sales-page">
            <h2 className="primary-header">Loading {Loading}</h2>
          </div>
        ) : (
          allSales.map(([title, sales], i) => {
            return (
              sales.length > 0 && (
                <div
                  className="row justify-content-md-center mb-3 sales-page"
                  key={`${gkey}-list-${i}`}
                >
                  <h2 className="primary-header">{title}</h2>
                  {sales.map(saleList)}
                </div>
              )
            );
          })
        )}
      </div>
    </div>
  );
}

export default SalesPage;
