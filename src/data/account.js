import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { NearConfig, noInternetMode, useNear } from "./near";
import Big from "big.js";
import { keysToCamel } from "./utils";

const defaultAccount = {
  loading: true,
  accountId: null,
  state: null,
  balances: {},
  near: null,
};

const mapLockupAccount = (account, lockupAccountId) => {
  account = keysToCamel(account);
  account.startTimestamp *= 1000;
  account.cliffTimestamp *= 1000;
  account.endTimestamp *= 1000;
  account.startDate = new Date(account.startTimestamp);
  account.cliffDate = new Date(account.cliffTimestamp);
  account.endDate = new Date(account.endTimestamp);
  account.balance = Big(account.balance);
  account.claimedBalance = Big(account.claimedBalance);
  account.lockupAccountId = lockupAccountId;

  account.started = () => new Date().getTime() >= account.startTimestamp;
  account.ended = () => new Date().getTime() >= account.endTimestamp;

  account.duration = account.endTimestamp - account.startTimestamp;
  account.passedDuration = () =>
    account.ended()
      ? account.duration
      : account.started()
      ? new Date().getTime() - account.startTimestamp
      : 0;
  account.currentBalance = () =>
    account.ended()
      ? account.balance
      : account.started()
      ? Big(account.passedDuration())
          .mul(account.balance)
          .div(account.duration)
          .round(0, 0)
      : Big(0);

  account.unclaimedBalance = () =>
    account.currentBalance().sub(account.claimedBalance);
  account.remainingBalance = account.balance.sub(account.claimedBalance);

  account.hasBalance = account.remainingBalance.gt(0);

  return account;
};

const getLockupAccount = async (near, lockupAccountId) => {
  const account = await near.account.viewFunction(
    lockupAccountId,
    "get_account",
    {
      account_id: near.accountId,
    }
  );
  return account && mapLockupAccount(account, lockupAccountId);
};

const loadAccount = async (near, setAccount) => {
  const accountId = near.accountId;
  const account = {
    loading: false,
    accountId,
    state: null,
    balances: {},
    lockupAccount: null,
    near,
    refresh: async () => await loadAccount(near, setAccount),
  };
  if (accountId) {
    const promises = await Promise.all([
      near.contract.balances_of({
        account_id: accountId,
      }),
      near.account.state(),
      ...NearConfig.lockupAccountIds.map((lockupAccountId) =>
        getLockupAccount(near, lockupAccountId)
      ),
    ]);
    const rawBalances = promises[0];
    const state = promises[1];
    promises.slice(2).forEach((lockupAccount) => {
      if (lockupAccount) {
        account.lockupAccount = lockupAccount;
      }
    });

    rawBalances.forEach(([tokenAccountId, rawBalance]) => {
      account.balances[tokenAccountId] = Big(rawBalance);
    });
    account.state = state;
  }

  setAccount(account);
};

export const useAccount = singletonHook(defaultAccount, () => {
  const [account, setAccount] = useState(defaultAccount);
  const _near = useNear();

  useEffect(() => {
    _near.then(async (near) => {
      try {
        await loadAccount(near, setAccount);
      } catch (e) {
        if (noInternetMode) {
          setAccount({
            loading: false,
            near,
            accountId: "test.testnet",
            balances: {},
          });
        }
      }
    });
  }, [_near]);

  return account;
});
