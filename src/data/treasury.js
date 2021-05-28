import { singletonHook } from "react-singleton-hook";
import { useState } from "react";
import { useNear } from "./near";
import Big from "big.js";

const defaultTreasury = {
  loading: true,
  balances: {},
};

export const useTreasury = singletonHook(defaultTreasury, () => {
  const [treasury, setTreasury] = useState(defaultTreasury);
  const _near = useNear();

  _near.then(async (near) => {
    let [rawBalances, skywardTotalSupply, listingFee] = await Promise.all([
      near.contract.get_treasury_balances(),
      near.contract.get_skyward_total_supply(),
      near.contract.get_listing_fee(),
    ]);
    skywardTotalSupply = Big(skywardTotalSupply);
    listingFee = Big(listingFee);
    const balances = {};
    rawBalances.forEach(([tokenAccountId, rawBalance]) => {
      balances[tokenAccountId] = Big(rawBalance);
    });

    setTreasury({
      loading: false,
      balances,
      skywardTotalSupply,
      listingFee,
    });
  });

  return treasury;
});
