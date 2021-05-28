import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { useNear } from "./near";
import Big from "big.js";

const defaultAccount = {
  loading: true,
  accountId: null,
  state: null,
  balances: {},
  near: null,
};

export const useAccount = singletonHook(defaultAccount, () => {
  const [account, setAccount] = useState(defaultAccount);
  const _near = useNear();

  useEffect(() => {
    _near.then(async (near) => {
      const accountId = near.accountId;
      const account = {
        loading: false,
        accountId,
        state: null,
        balances: {},
        near,
      };
      if (accountId) {
        const [rawBalances, state] = await Promise.all([
          near.contract.balances_of({
            account_id: accountId,
          }),
          near.account.state(),
        ]);
        rawBalances.forEach(([tokenAccountId, rawBalance]) => {
          account.balances[tokenAccountId] = Big(rawBalance);
        });
        account.state = state;
      }

      setAccount(account);
    });
  }, [_near]);

  return account;
});
