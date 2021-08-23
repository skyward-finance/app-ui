import React from "react";
import { useAccount } from "../data/account";
import TokenSymbol from "./TokenSymbol";
import { skywardUrl } from "../data/utils";
import ReferralList from "./ReferralList";

export default function ReferralLink(props) {
  const sale = props.sale;
  const account = useAccount();
  if (!(account && account.accountId)) {
    return false;
  }

  const referralLink =
    skywardUrl() + `/sale/${sale.saleId}?r=${account.accountId}`;

  return (
    <div className={"card mb-2"}>
      <div className="card-body">
        <div className="mb-3">
          <label htmlFor="ref-link" className="form-label">
            <b>Your referral link</b>
          </label>
          <input
            type="email"
            className="form-control"
            id="ref-link"
            value={referralLink}
            onChange={(e) => false}
          />
        </div>
        <div className="text-muted">
          Earn 50% commission from the referral pool for you and your invited
          friends. Invite your friends to join the sale through the referral
          link and get rewards when your friends participate in the sale. The
          more <TokenSymbol tokenAccountId={sale.outTokens[0].tokenAccountId} />{" "}
          your friends receive, the more reward you and your friends get.
        </div>
        <ReferralList sale={sale} />
      </div>
    </div>
  );
}
