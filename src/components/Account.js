import React, { useState } from "react";
import { useAccount } from "../data/account";
import AccountRegisterToken from "./AccountRegisterToken";
import uuid from "react-uuid";
import TokenAndBalance from "./TokenAndBalance";

function Account(props) {
  const [gkey] = useState(uuid());
  const account = useAccount();

  const balances =
    account && !account.loading
      ? Object.entries(account.balances).map(([tokenAccountId, balance]) => {
          const key = `${gkey}-${tokenAccountId}`;
          return (
            <TokenAndBalance
              key={key}
              tokenAccountId={tokenAccountId}
              balance={balance}
            />
          );
        })
      : [];

  return (
    <div>
      {account.loading ? (
        <div>Loading...</div>
      ) : account.accountId ? (
        <div>
          <div>{account.accountId}</div>
          <div>Balances</div>
          <div>{balances}</div>
          <div>
            <AccountRegisterToken />
          </div>
        </div>
      ) : (
        <div>Sign in please</div>
      )}
    </div>
  );
}

export default Account;
