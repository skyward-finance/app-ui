import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import Big from "big.js";
import { useAccount } from "./account";
import { keysToCamel } from "./utils";

const defaultSales = {
  loading: true,
  sales: [],
};

const mapSubscription = (s) => {
  return {
    claimedOutBalance: s.claimedOutBalance.map(Big),
    spentInBalance: Big(s.spentInBalance),
    remainingInBalance: Big(s.remainingInBalance),
    unclaimedOutBalances: s.unclaimedOutBalances.map(Big),
    shares: Big(s.shares),
  };
};

const mapSale = (s) => {
  s = keysToCamel(s);
  s.outTokens.forEach((o) => {
    o.remaining = Big(o.remaining);
    o.distributed = Big(o.remaining);
    if (o.treasuryUnclaimed) {
      o.treasuryUnclaimed = Big(o.treasuryUnclaimed);
    }
  });
  s.inTokenRemaining = Big(s.inTokenRemaining);
  s.inTokenPaidUnclaimed = Big(s.inTokenPaidUnclaimed);
  s.inTokenPaid = Big(s.inTokenPaid);
  s.totalShares = Big(s.totalShares);
  s.startTime = parseFloat(s.startTime) / 1e6;
  s.startDate = new Date(s.startTime);
  s.duration = parseFloat(s.duration) / 1e6;
  s.endDate = new Date(s.startTime + s.duration);
  s.remainingDuration = parseFloat(s.remainingDuration) / 1e6;
  s.currentDate = new Date(s.startTime + s.duration - s.remainingDuration);
  if (s.subscription) {
    s.subscription = mapSubscription(s.subscription);
  }
  return s;
};

export const useSales = singletonHook(defaultSales, () => {
  const [sales, setSales] = useState(defaultSales);
  const account = useAccount();

  useEffect(() => {
    if (!account.near) {
      return;
    }
    const fetchSales = async () => {
      const rawSales = await account.near.contract.get_sales({
        account_id: account.accountId,
      });
      return rawSales.map(mapSale);
    };
    fetchSales().then((sales) => {
      setSales((prev) => {
        return {
          loading: false,
          sales: prev.sales.concat(sales),
        };
      });
    });
  }, [account]);

  return sales;
});
