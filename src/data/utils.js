import Big from "big.js";
import {
  BridgeTokenStorageDeposit,
  LsKey,
  NearConfig,
  TokenStorageDeposit,
} from "./near";
import React from "react";
import ls from "local-storage";

const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
export const OneNear = Big(10).pow(24);
export const OneSkyward = Big(10).pow(18);
const AccountSafetyMargin = OneNear.div(2);

const LowUsdValue = Big(10000);

export const skywardUrl = () =>
  window.location.protocol + "//" + window.location.host;

export const hardcodedWhitelist = {
  50: true,
};

export const Loading = (
  <span
    className="spinner-grow spinner-grow-sm me-1"
    role="status"
    aria-hidden="true"
  />
);

export function isValidAccountId(accountId) {
  return (
    accountId &&
    accountId.length >= MinAccountIdLen &&
    accountId.length <= MaxAccountIdLen &&
    accountId.match(ValidAccountRe)
  );
}

const toCamel = (s) => {
  return s.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace("-", "").replace("_", "");
  });
};

const isArray = function (a) {
  return Array.isArray(a);
};

const isObject = function (o) {
  return o === Object(o) && !isArray(o) && typeof o !== "function";
};

export const keysToCamel = function (o) {
  if (isObject(o)) {
    const n = {};

    Object.keys(o).forEach((k) => {
      n[toCamel(k)] = keysToCamel(o[k]);
    });

    return n;
  } else if (isArray(o)) {
    return o.map((i) => {
      return keysToCamel(i);
    });
  }

  return o;
};

export const bigMin = (a, b) => {
  if (a && b) {
    return a.lt(b) ? a : b;
  }
  return a || b;
};

export const bigToString = (b, p, len) => {
  if (b === null) {
    return "???";
  }
  let s = b.abs().toFixed();
  let pos = s.indexOf(".");
  p = p || 6;
  len = len || 7;
  if (pos > 0) {
    let ap = Math.min(p, Math.max(len - pos, 0));
    if (ap > 0) {
      ap += 1;
    }
    if (pos + ap < s.length) {
      s = s.substring(0, pos + ap);
    }
  } else {
    pos = s.length;
  }
  for (let i = pos - 4; i >= 0; i -= 3) {
    s = s.slice(0, i + 1) + "," + s.slice(i + 1);
  }

  if (s === "0.000000" && p === 6 && len === 7) {
    return "<0.000001";
  }

  if (b.lt(0)) {
    s = "-" + s;
  }

  return s;
};

export const dateToString = (d) => {
  return d.toLocaleString("en-us", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const fromTokenBalance = (token, balance) => {
  return !token || token.invalidAccount || token.notFound || !balance
    ? balance
    : balance.div(Big(10).pow(token.metadata.decimals));
};

export const toTokenBalance = (token, balance) => {
  return !token || token.invalidAccount || token.notFound || !balance
    ? balance
    : balance.mul(Big(10).pow(token.metadata.decimals));
};

export const availableNearBalance = (account) => {
  if (account && !account.loading && account.state) {
    let balance = Big(account.state.amount).sub(
      Big(account.state.storage_usage).mul(Big(NearConfig.storageCostPerByte))
    );
    if (balance.gt(AccountSafetyMargin)) {
      return balance.sub(AccountSafetyMargin);
    }
  }
  return Big(0);
};

export const referralLsKey = (saleId) => {
  return LsKey + "referral:" + saleId;
};

export const getCurrentReferralId = (saleId) => {
  const refLsKey = referralLsKey(saleId);
  const ref = ls.get(refLsKey);
  if (ref && ref.expires > new Date().getTime()) {
    return ref.referralId;
  }
  return null;
};

export const computeUsdBalance = (refFinance, tokenAccountId, balance) => {
  if (refFinance && !refFinance.loading && balance) {
    if (tokenAccountId === NearConfig.wrapNearAccountId) {
      return balance.div(OneNear).mul(refFinance.nearPrice);
    } else if (
      tokenAccountId in refFinance.prices &&
      refFinance.nearPrice.gt(0)
    ) {
      const p = refFinance.prices[tokenAccountId];
      return balance
        .mul(p.totalNear)
        .div(p.totalOther)
        .div(OneNear)
        .mul(refFinance.nearPrice);
    }
  }
  return null;
};

export const isBridgeToken = (tokenAccountId) => {
  return tokenAccountId.endsWith(".bridge.near");
};

export const tokenStorageDeposit = async (tokenAccountId) => {
  return isBridgeToken(tokenAccountId)
    ? BridgeTokenStorageDeposit
    : TokenStorageDeposit;
};

export const isoDate = (d) =>
  d ? new Date(d).toISOString().substring(0, 10) : "";

export const isSaleWhitelisted = (sale, refFinance) => {
  if (sale.saleId in hardcodedWhitelist) {
    return true;
  }
  if (refFinance && refFinance.whitelistedTokens) {
    if (!refFinance.whitelistedTokens.has(sale.inTokenAccountId)) {
      return false;
    }
    if (
      sale.outTokens.some(
        (outToken) => !refFinance.whitelistedTokens.has(outToken.tokenAccountId)
      )
    ) {
      return false;
    }
    return true;
  }
  return false;
};

export const isLowValueSale = (sale, refFinance) => {
  if (!isSaleWhitelisted(sale, refFinance)) {
    return false;
  }
  if (refFinance) {
    let sum = Big(0);
    sale.outTokens.forEach((outToken) => {
      const usdBalance = computeUsdBalance(
        refFinance,
        outToken.tokenAccountId,
        outToken.distributed.add(outToken.remaining)
      );
      if (sum && usdBalance) {
        sum = sum.add(usdBalance);
      } else {
        sum = null;
      }
    });

    if (sum && sum.lte(LowUsdValue)) {
      return true;
    }
  }
  return false;
};
