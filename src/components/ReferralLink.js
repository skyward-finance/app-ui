import React from "react";
import { useAccount } from "../data/account";

export default function ReferralLink(props) {
  const sale = props.sale;
  const account = useAccount();
  if (!(account && account.accountId)) {
    return false;
  }

  const referralLink =
    window.location.protocol +
    "//" +
    window.location.host +
    `/sale/${sale.saleId}?r=${account.accountId}`;

  return (
    <div className={"card m-2"}>
      <div className="card-body">
        <div className="mb-3">
          <label htmlFor="ref-link" className="form-label">
            Your referral link
          </label>
          <input
            type="email"
            className="form-control"
            id="ref-link"
            value={referralLink}
            onChange={(e) => false}
          />
        </div>
      </div>
    </div>
  );
}
