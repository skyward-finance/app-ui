import React, { useState } from "react";
import { useAccount } from "../data/account";
import uuid from "react-uuid";
import AccountBalance from "./AccountBalance";
import { Loading } from "../data/utils";
import LockupAccount from "./LockupAccount";

export default function Account(props) {
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
    <>
      {account.lockupAccount && (
        <div className="card mb-2">
          <div className="card-body">
            <h2 className="primary-header">$SKYWARD Lockup</h2>
            <LockupAccount account={account} />
          </div>
        </div>
      )}
      <div className="card mb-2">
        {account.loading ? (
          <div className="card-body">{Loading} loading...</div>
        ) : (
          <div className="card-body">
            <h2 className="primary-header">Account {account.accountId}</h2>
            <hr />

            <div>Balances</div>
            <div>{balances}</div>
            {/*<div>*/}
            {/*  <AccountRegisterToken />*/}
            {/*</div>*/}
          </div>
        )}
      </div>
    </>
  );
}
