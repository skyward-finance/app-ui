import React, { useState } from "react";
import { useSales } from "../data/sales";
import { useParams } from "react-router";
import Sale from "../components/Sale";
import { useLocation, useHistory } from "react-router-dom";
import ls from "local-storage";
import { getCurrentReferralId, referralLsKey } from "../data/utils";
import { useAccount } from "../data/account";

function SalePage(props) {
  let { saleId } = useParams();

  const sales = useSales();

  saleId = parseInt(saleId);
  const sale = sales.sales[saleId];

  const currentReferralId = getCurrentReferralId(saleId);
  const [referralId, setReferralId] = useState(currentReferralId);

  const location = useLocation();
  const history = useHistory();
  const account = useAccount();

  const locationSearch = location.search;
  const query = new URLSearchParams(locationSearch);
  const r = query.get("r");
  if (r) {
    setReferralId(r);
    query.delete("r");
    location.search = query.toString();
    history.replace(location);
  }

  if (account && !account.loading && referralId !== currentReferralId) {
    if (!account.accountId || account.accountId !== referralId) {
      console.log("New referral", referralId);
      ls.set(referralLsKey(saleId), {
        referralId,
        expires: new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
      });
    }
  }

  return (
    <div>
      <div className="container">
        <div className="row justify-content-md-center mb-3">
          {sales.loading ? (
            "Loading"
          ) : sale ? (
            <Sale sale={sale} />
          ) : (
            "Sale not found"
          )}
        </div>
      </div>
    </div>
  );
}

export default SalePage;
