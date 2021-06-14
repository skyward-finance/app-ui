import React, { useState } from "react";
import uuid from "react-uuid";
import TokenAndBalance from "./TokenAndBalance";
import { useTreasury } from "../data/treasury";
import { NearConfig } from "../data/near";
import { Loading } from "../data/utils";

function Account(props) {
  const [gkey] = useState(uuid());
  const treasury = useTreasury();

  const balances =
    treasury && !treasury.loading
      ? Object.entries(treasury.balances).map(([tokenAccountId, balance]) => {
          const key = `${gkey}-${tokenAccountId}`;
          return (
            <TokenAndBalance
              key={key}
              tokenAccountId={tokenAccountId}
              balances={[["", balance]]}
            />
          );
        })
      : [];

  return (
    <div className="card">
      {treasury.loading ? (
        <div className="card-body">{Loading} loading...</div>
      ) : (
        <div className="card-body">
          <h2 className="primary-header">Treasury</h2>
          <hr />
          <div>
            Skyward Circulating Supply
            <TokenAndBalance
              tokenAccountId={NearConfig.skywardTokenAccountId}
              balances={[["", treasury.skywardCirculatingSupply]]}
            />
          </div>
          <div className={"text-muted"}>Redeeming coming soon...</div>
          <hr />
          <div>Treasury Balances</div>
          <div>{balances}</div>
        </div>
      )}
    </div>
  );
}

export default Account;
