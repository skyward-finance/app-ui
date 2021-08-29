import "./SalesPage.scss";
import React, { useState } from "react";
import { useSales } from "../data/sales";
import uuid from "react-uuid";
import SalePreview from "../components/sale/SalePreview";
import { isSaleWhitelisted, Loading } from "../data/utils";
import { useRefFinance } from "../data/refFinance";

function SalesPage(props) {
  const [gkey] = useState(uuid());
  const sales = useSales();

  const [whitelistedOnly, setWhitelistedOnly] = useState(true);

  const refFinance = useRefFinance();
  let sortedSales = [...sales.sales];
  if (refFinance && refFinance.whitelistedTokens && whitelistedOnly) {
    sortedSales = sortedSales.filter((sale) =>
      isSaleWhitelisted(sale, refFinance)
    );
  }
  sortedSales.sort((a, b) => a.endDate - b.endDate);

  const allUpcomingSales = sortedSales.filter(
    (sale) => !sale.ended() && !sale.started()
  );
  const currentSalesAndSoon = sortedSales.filter(
    (sale) => !sale.ended() && (sale.started() || !sale.farAhead())
  );
  const upcomingSales = allUpcomingSales.filter((sale) => sale.farAhead());
  // Reverse sort, but keep order stable for same time
  sortedSales.sort((a, b) => b.endDate - a.endDate);
  const endedSales = sortedSales.filter((sale) => sale.ended());

  const saleList = (sale) => {
    const key = `${gkey}-sale-${sale.saleId}`;
    return <SalePreview key={key} sale={sale} />;
  };

  const allSales = [
    ["Ongoing listings or starting soon", currentSalesAndSoon],
    ["Upcoming listings", upcomingSales],
    ["Completed listings", endedSales],
  ];

  return (
    <div>
      <div className="container">
        {sales.loading || !refFinance ? (
          <div className="row justify-content-md-evenly mb-3 sales-page">
            <h2 className="primary-header">Loading {Loading}</h2>
          </div>
        ) : (
          <>
            <div className="row mb-3">
              <div className="card">
                <div className="card-body">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="whitelistedOnly"
                      checked={whitelistedOnly}
                      onChange={(e) => {
                        setWhitelistedOnly(e.target.checked);
                      }}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="whitelistedOnly"
                    >
                      Display only whitelisted listings
                      <span className="text-muted">
                        {" "}
                        (if checked, only listings with tokens whitelisted by
                        Ref Finance will be displayed)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            {allSales.map(([title, sales], i) => {
              return (
                sales.length > 0 && (
                  <div
                    className="row justify-content-md-evenly mb-3 sales-page"
                    key={`${gkey}-list-${i}`}
                  >
                    <h2 className="primary-header">{title}</h2>
                    {sales.map(saleList)}
                  </div>
                )
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export default SalesPage;
