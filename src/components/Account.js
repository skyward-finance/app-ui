import React from "react";
import { useAccount } from "../data/account";
import AccountRegisterToken from "./AccountRegisterToken";

function Account(props) {
  const account = useAccount();

  return (
    <div>
      {account.loading ? (
        <div>Loading...</div>
      ) : account.accountId ? (
        <div>
          <div>{account.accountId}</div>
          <div>Balances</div>
          <div>
            <pre>{JSON.stringify(account.balances)}</pre>
          </div>
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
