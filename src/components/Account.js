import React, { useState } from "react";
import { useAccount } from "../data/account";
import uuid from "react-uuid";
import AccountBalance from "./AccountBalance";

function Account(props) {
  const [gkey] = useState(uuid());
  const account = useAccount();

  const balances =
    account && !account.loading
      ? Object.entries(account.balances).map(([tokenAccountId, _balance]) => (
          <AccountBalance
            key={`${gkey}-${tokenAccountId}`}
            tokenAccountId={tokenAccountId}
          />
        ))
      : [];

  return (
    <div>
      {account.loading ? (
        <div>Loading...</div>
      ) : account.accountId ? (
        <div className="card">
          <div className="card-body">
            <h5>Account {account.accountId}</h5>
            <hr />
            <div>Balances</div>
            <div>{balances}</div>
            {/*<div>*/}
            {/*  <AccountRegisterToken />*/}
            {/*</div>*/}
          </div>
        </div>
      ) : (
        <div>Sign in please</div>
      )}
    </div>
  );
}

export default Account;
