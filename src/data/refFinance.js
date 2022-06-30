import { singletonHook } from "react-singleton-hook";
import { useEffect, useState } from "react";
import { NearConfig } from "./near";
import Big from "big.js";
import * as nearAPI from "near-api-js";
import { OneNear } from "./utils";
import { useAccount } from "./account";

const SimplePool = "SIMPLE_POOL";
const StablePool = "STABLE_SWAP";
const RatedPool = "RATED_SWAP";

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
  "d9c2d319cd7e6177336b0a9c93c21cb48d84fb54.factory.bridge.near",
  "token.paras.near",
  "a4ef4b0b23c1fc81d3f9ecf93510e64f58a4a016.factory.bridge.near",
  "marmaj.tkn.near",
  "meta-pool.near",
  "token.cheddar.near",
  "52a047ee205701895ee06a375492490ec9c597ce.factory.bridge.near",
  "aurora",
  "pixeltoken.near",
  "dbio.near",
  "meta-token.near",
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

const usdTokensDecimals = {
  "6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near": 18,
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": 6,
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": 6,
  usn: 18,
  "cusd.token.a11bd.near": 24,
};
const tokenDecimals = Object.assign(
  {
    "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near": 8,
    "0316eb71485b0ab14103307bf65a021042c6d380.factory.bridge.near": 18,
    "meta-pool.near": 24,
    "linear-protocol.near": 24,
    "wrap.near": 24,
  },
  usdTokensDecimals
);

const usdTokens = Object.entries(usdTokensDecimals).reduce(
  (acc, [key, value]) => {
    acc[key] = Big(10).pow(value);
    return acc;
  },
  {}
);

function stablePoolGetReturn(pool, tokenIn, amountIn, tokenOut) {
  let tokenInIndex = pool.tt.indexOf(tokenIn);
  let tokenOutIndex = pool.tt.indexOf(tokenOut);
  // Sub 1
  const cAmountIn = amountIn
    .sub(1)
    .mul(Big(10).pow(18 - tokenDecimals[tokenIn]))
    .mul(pool.rates[tokenInIndex])
    .div(OneNear);

  let y = stablePoolComputeY(
    pool,
    cAmountIn.add(pool.cAmounts[tokenInIndex]),
    tokenInIndex,
    tokenOutIndex
  );

  let dy = pool.cAmounts[tokenOutIndex].sub(y);
  let tradeFee = dy.mul(pool.fee).div(10000).round(0, 0);
  let amountSwapped = dy.sub(tradeFee);

  return amountSwapped
    .div(Big(10).pow(18 - tokenDecimals[tokenOut]))
    .mul(OneNear)
    .div(pool.rates[tokenOutIndex])
    .round(0, 0);
}

function stablePoolGetInverseReturn(pool, tokenOut, amountOut, tokenIn) {
  let tokenInIndex = pool.tt.indexOf(tokenIn);
  let tokenOutIndex = pool.tt.indexOf(tokenOut);

  const amountOutWithFee = amountOut
    .mul(10000)
    .div(10000 - pool.fee)
    .round(0, 0);
  const cAmountOut = amountOutWithFee
    .mul(Big(10).pow(18 - tokenDecimals[tokenOut]))
    .mul(pool.rates[tokenOutIndex])
    .div(OneNear);

  let y = stablePoolComputeY(
    pool,
    pool.cAmounts[tokenOutIndex].sub(cAmountOut),
    tokenOutIndex,
    tokenInIndex
  );

  let cAmountIn = y.sub(pool.cAmounts[tokenInIndex]);

  // Adding 1 for internal pool rounding
  return cAmountIn
    .div(Big(10).pow(18 - tokenDecimals[tokenIn]))
    .mul(OneNear)
    .div(pool.rates[tokenInIndex])
    .add(1)
    .round(0, 0);
}

export function getRefReturn(pool, tokenIn, amountIn, tokenOut) {
  if (!amountIn || amountIn.eq(0)) {
    return Big(0);
  }
  if (
    !(tokenIn in pool.tokens) ||
    !(tokenOut in pool.tokens) ||
    tokenIn === tokenOut
  ) {
    return null;
  }
  if (pool.stable) {
    return stablePoolGetReturn(pool, tokenIn, amountIn, tokenOut);
  }
  const balanceIn = pool.tokens[tokenIn];
  const balanceOut = pool.tokens[tokenOut];
  let amountWithFee = Big(amountIn).mul(Big(10000 - pool.fee));
  return amountWithFee
    .mul(balanceOut)
    .div(Big(10000).mul(balanceIn).add(amountWithFee))
    .round(0, 0);
}

export function getRefInverseReturn(pool, tokenOut, amountOut, tokenIn) {
  if (!amountOut || amountOut.eq(0)) {
    return Big(0);
  }
  if (
    !(tokenIn in pool.tokens) ||
    !(tokenOut in pool.tokens) ||
    tokenIn === tokenOut
  ) {
    return null;
  }
  if (pool.stable) {
    return stablePoolGetInverseReturn(pool, tokenOut, amountOut, tokenIn);
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

function stablePoolComputeD(pool) {
  let sumX = pool.cAmounts.reduce((sum, v) => sum.add(v), Big(0));
  if (sumX.eq(0)) {
    return Big(0);
  } else {
    let d = sumX;
    let dPrev;

    for (let i = 0; i < 256; ++i) {
      let dProd = d;
      for (let j = 0; j < pool.nCoins; ++j) {
        dProd = dProd.mul(d).div(pool.cAmounts[j].mul(pool.nCoins)).round(0, 0);
      }
      dPrev = d;

      let leverage = sumX.mul(pool.ann);
      let numerator = dPrev.mul(dProd.mul(pool.nCoins).add(leverage));
      let denominator = dPrev
        .mul(pool.ann.sub(1))
        .add(dProd.mul(pool.nCoins + 1));
      d = numerator.div(denominator).round(0, 0);

      // Equality with the precision of 1
      if (d.gt(dPrev)) {
        if (d.sub(dPrev).lte(1)) {
          break;
        }
      } else if (dPrev.sub(d).lte(1)) {
        break;
      }
    }
    return d;
  }
}

function stablePoolComputeY(pool, xCAmount, indexX, indexY) {
  // invariant
  let d = pool.d;
  let s = xCAmount;
  let c = d.mul(d).div(xCAmount).round(0, 0);
  pool.cAmounts.forEach((c_amount, idx) => {
    if (idx !== indexX && idx !== indexY) {
      s = s.add(c_amount);
      c = c.mul(d).div(c_amount).round(0, 0);
    }
  });
  c = c.mul(d).div(pool.ann.mul(pool.nn)).round(0, 0);
  let b = d.div(pool.ann).round(0, 0).add(s); // d will be subtracted later

  // Solve for y by approximating: y**2 + b*y = c
  let yPrev;
  let y = d;
  for (let i = 0; i < 256; ++i) {
    yPrev = y;
    // $ y_{k+1} = \frac{y_k^2 + c}{2y_k + b - D} $
    let yNumerator = y.pow(2).add(c);
    let yDenominator = y.mul(2).add(b).sub(d);
    y = yNumerator.div(yDenominator).round(0, 0);
    if (y.gt(yPrev)) {
      if (y.sub(yPrev).lte(1)) {
        break;
      }
    } else if (yPrev.sub(y).lte(1)) {
      break;
    }
  }
  return y;
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
        "list_rated_tokens",
      ],
      changeMethods: [],
    }
  );

  const balances = {};
  const whitelistedTokens = new Set(await refContract.get_whitelisted_tokens());
  const ratedTokens = await refContract.list_rated_tokens();
  Object.values(ratedTokens).forEach((r) => {
    r.rate_price = Big(r.rate_price);
  });
  ratedTokens[NearConfig.wrapNearAccountId] = {
    rate_price: OneNear,
  };

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

    pool.ots[token].forEach((ot) => {
      const pair = `${token}:${ot}`;
      ps = poolsByPair[pair] || [];
      ps.push(pool);
      poolsByPair[pair] = ps;
    });
  };

  const pools = {};
  for (let i = 0; i < rawPools.length; ++i) {
    const pool = rawPools[i];
    if (
      pool.pool_kind === SimplePool ||
      pool.pool_kind === StablePool ||
      pool.pool_kind === RatedPool
    ) {
      const tt = pool.token_account_ids;
      const p = {
        stable: pool.pool_kind === StablePool || pool.pool_kind === RatedPool,
        index: i,
        tt,
        tokens: tt.reduce((acc, token, tokenIndex) => {
          acc[token] = Big(pool.amounts[tokenIndex]);
          return acc;
        }, {}),
        ots: tt.reduce((acc, token) => {
          acc[token] = tt.filter((t) => t !== token);
          return acc;
        }, {}),
        fee: pool.total_fee,
        shares: Big(pool.shares_total_supply),
        amp: pool.amp || 0,
      };
      if (p.stable) {
        let shouldSkip = false;
        p.cAmounts = [...pool.amounts].map((amount, idx) => {
          const tokenId = tt[idx];
          if (!(tokenId in tokenDecimals)) {
            console.log(
              `Missing token decimals for token ${tokenId} for pool #${i}`
            );
            shouldSkip = true;
            return 0;
          }
          let factor = Big(10).pow(18 - tokenDecimals[tokenId]);
          return Big(amount).mul(factor);
        });
        if (shouldSkip) {
          continue;
        }
        p.nCoins = p.cAmounts.length;
        if (pool.pool_kind === RatedPool) {
          p.rates = tt.map((tokenId) => {
            if (!(tokenId in ratedTokens)) {
              console.log(
                `Missing token rate for token ${tokenId} for pool #${i}`
              );
              shouldSkip = true;
            }
            return ratedTokens[tokenId].rate_price;
          });
          if (shouldSkip) {
            continue;
          }
        } else {
          p.rates = new Array(p.nCoins).fill(OneNear);
        }
        p.cAmounts = p.cAmounts.map((cAmount, idx) =>
          cAmount.mul(p.rates[idx]).div(OneNear)
        );
        p.nn = Big(Math.pow(p.nCoins, p.nCoins));
        p.ann = Big(p.amp).mul(p.nn);
        p.d = stablePoolComputeD(p);
      }

      if (p.shares.gt(0)) {
        pools[p.index] = p;
        p.tt.forEach((t) => addPools(t, p));
      }
    }
  }

  const wNEAR = NearConfig.wrapNearAccountId;
  const prices = {};

  Object.values(pools).forEach((pool) => {
    if (wNEAR in pool.tokens && !pool.stable) {
      pool.otherToken = pool.ots[wNEAR][0];
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

let refRefreshTimer = null;

export const useRefFinance = singletonHook(defaultRefFinance, () => {
  const [refFinance, setRefFinance] = useState(defaultRefFinance);
  const account = useAccount();

  useEffect(() => {
    if (account && !account.loading) {
      let scheduleRefresh;
      let refresh;

      const localMapRef = (ref) => {
        ref.scheduleRefresh = scheduleRefresh;
        ref.refresh = refresh;
        return ref;
      };

      refresh = async () => {
        const ref = await fetchRefData(account);
        setRefFinance(localMapRef(ref));
      };

      scheduleRefresh = (fast) => {
        clearTimeout(refRefreshTimer);
        refRefreshTimer = setTimeout(
          async () => {
            if (!document.hidden) {
              await refresh();
            } else {
              scheduleRefresh(fast);
            }
          },
          fast ? 5000 : 30000
        );
      };

      refresh().catch(console.error);
    }
  }, [account]);

  return refFinance;
});
