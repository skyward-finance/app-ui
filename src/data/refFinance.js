import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { NearConfig } from "./near";
import Big from "big.js";
import * as nearAPI from "near-api-js";
import { OneNear } from "./utils";
import { useAccount } from "./account";

const SimplePool = "SIMPLE_POOL";

export const defaultWhitelistedTokens = new Set([
  "wrap.near",
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near",
  "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near",
  "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near",
  "111111111117dc0aa78b770fa6a738034120c302.factory.bridge.near",
  "c944e90c64b2c07662a292be6244bdf05cda44a7.factory.bridge.near",
  "token.skyward.near",
  "berryclub.ek.near",
  "farm.berryclub.ek.near",
  "6f259637dcd74c767781e37bc6133cd6a68aa161.factory.bridge.near",
  "de30da39c46104798bb5aa3fe8b9e0e1f348163f.factory.bridge.near",
  "1f9840a85d5af5bf1d1762f925bdaddc4201f984.factory.bridge.near",
  "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near",
  "514910771af9ca656af840dff83e8264ecf986ca.factory.bridge.near",
  "f5cfbc74057c610c8ef151a439252680ac68c6dc.factory.bridge.near",
  "token.v2.ref-finance.near",
]);

const defaultRefFinance = {
  loading: true,
  pools: {},
  poolsByToken: {},
  poolsByPair: {},
  prices: {},
  balances: {},
  nearPrice: Big(0),
  refContract: null,
  whitelistedTokens: defaultWhitelistedTokens,
};

const usdTokens = {
  "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near": Big(10).pow(
    18
  ),
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": Big(10).pow(
    6
  ),
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": Big(10).pow(
    6
  ),
};

export function getRefReturn(pool, tokenIn, amountIn) {
  if (!amountIn || amountIn.eq(0)) {
    return Big(0);
  }
  const tokenOut = pool.ot[tokenIn];
  if (!tokenOut) {
    return null;
  }
  const balanceIn = pool.tokens[tokenIn];
  const balanceOut = pool.tokens[tokenOut];
  let amountWithFee = Big(amountIn).mul(Big(10000 - pool.fee));
  return amountWithFee
    .mul(balanceOut)
    .div(Big(10000).mul(balanceIn).add(amountWithFee))
    .round(0, 0);
}

export function getRefInverseReturn(pool, tokenOut, amountOut) {
  if (!amountOut || amountOut.eq(0)) {
    return Big(0);
  }
  const tokenIn = pool.ot[tokenOut];
  if (!tokenIn) {
    return null;
  }
  const balanceIn = pool.tokens[tokenIn];
  const balanceOut = pool.tokens[tokenOut];
  if (amountOut.gte(balanceOut)) {
    return null;
  }
  return Big(10000)
    .mul(balanceIn)
    .mul(amountOut)
    .div(Big(10000 - pool.fee).mul(balanceOut.sub(amountOut)))
    .round(0, 3);
}

const fetchRefData = async (account) => {
  const near = account.near;
  const refContract = new nearAPI.Contract(
    near.account,
    NearConfig.refContractName,
    {
      viewMethods: [
        "get_number_of_pools",
        "get_pools",
        "get_pool",
        "get_return",
        "get_deposits",
        "get_whitelisted_tokens",
      ],
      changeMethods: [],
    }
  );

  const balances = {};
  const whitelistedTokens = new Set(await refContract.get_whitelisted_tokens());

  if (account.accountId) {
    const rawBalances = await refContract.get_deposits({
      account_id: account.accountId,
    });
    Object.entries(rawBalances).forEach(([key, value]) => {
      balances[key] = Big(value);
    });
  }

  const limit = 250;
  // Limit pools for now until we need other prices.
  const numPools = Math.min(10000, await refContract.get_number_of_pools());
  const promises = [];
  for (let i = 0; i < numPools; i += limit) {
    promises.push(refContract.get_pools({ from_index: i, limit }));
  }
  const rawPools = (await Promise.all(promises)).flat();

  const poolsByToken = {};
  const poolsByPair = {};

  const addPools = (token, pool) => {
    let ps = poolsByToken[token] || [];
    ps.push(pool);
    poolsByToken[token] = ps;

    const pair = `${token}:${pool.ot[token]}`;
    ps = poolsByPair[pair] || [];
    ps.push(pool);
    poolsByPair[pair] = ps;
  };

  const pools = {};
  rawPools.forEach((pool, i) => {
    if (pool.pool_kind === SimplePool) {
      const tt = pool.token_account_ids;
      const p = {
        index: i,
        tt,
        tokens: tt.reduce((acc, token, tokenIndex) => {
          acc[token] = Big(pool.amounts[tokenIndex]);
          return acc;
        }, {}),
        ot: tt.reduce((acc, token, tokenIndex) => {
          acc[token] = tt[1 - tokenIndex];
          return acc;
        }, {}),
        fee: pool.total_fee,
        shares: Big(pool.shares_total_supply),
      };
      if (p.shares.gt(0)) {
        pools[p.index] = p;
        addPools(p.tt[0], p);
        addPools(p.tt[1], p);
      }
    }
  });

  const wNEAR = NearConfig.wrapNearAccountId;
  const prices = {};

  Object.values(pools).forEach((pool) => {
    if (wNEAR in pool.tokens) {
      pool.otherToken = pool.ot[wNEAR];
      const p = prices[pool.otherToken] || {
        totalNear: Big(0),
        totalOther: Big(0),
      };
      p.totalNear = p.totalNear.add(pool.tokens[wNEAR]);
      p.totalOther = p.totalOther.add(pool.tokens[pool.otherToken]);
      if (p.totalNear.gt(0)) {
        prices[pool.otherToken] = p;
      }
    }
  });

  let totalNearInUsdPools = Big(0);
  let totalUsdInUsdPools = Big(0);

  Object.entries(usdTokens).forEach(([tokenId, one]) => {
    if (tokenId in prices) {
      const p = prices[tokenId];
      totalNearInUsdPools = totalNearInUsdPools.add(p.totalNear);
      totalUsdInUsdPools = totalUsdInUsdPools.add(
        p.totalOther.mul(OneNear).div(one)
      );
    }
  });

  const nearPrice = totalNearInUsdPools.gt(0)
    ? totalUsdInUsdPools.div(totalNearInUsdPools)
    : Big(0);

  return {
    loading: false,
    pools,
    poolsByToken,
    poolsByPair,
    nearPrice,
    refContract,
    prices,
    balances,
    whitelistedTokens,
  };
};

export const useRefFinance = singletonHook(defaultRefFinance, () => {
  const [refFinance, setRefFinance] = useState(defaultRefFinance);
  const account = useAccount();

  useEffect(() => {
    if (account && !account.loading) {
      fetchRefData(account).then(setRefFinance).catch(console.error);
    }
  }, [account]);

  return refFinance;
});
