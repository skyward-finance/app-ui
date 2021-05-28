import React, { useState } from "react";
import uuid from "react-uuid";
import TokenAndBalance from "./TokenAndBalance";
import { useTreasury } from "../data/treasury";
import { NearConfig } from "../data/near";

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
    <div>
      {treasury.loading ? (
        <div>Loading...</div>
      ) : (
        <div className="card">
          <div className="card-body">
            <h5>Treasury</h5>
            <hr />
            <div>
              Skyward Total Supply
              <TokenAndBalance
                tokenAccountId={NearConfig.skywardTokenAccountId}
                balances={[["", treasury.skywardTotalSupply]]}
              />
            </div>
            <div>Treasury Balances</div>
            <div>{balances}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Account;
