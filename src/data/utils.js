import Big from "big.js";
import { LsKey, NearConfig } from "./near";
import React from "react";
import ls from "local-storage";

const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const AccountSafetyMargin = Big(10).pow(24).div(2);

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

export const bigToString = (b, p, len) => {
  if (b === null) {
    return "???";
  }
  let s = b.toFixed();
  const pos = s.indexOf(".");
  p = p || 6;
  len = len || 7;
  if (pos > 0) {
    p = Math.min(p, Math.max(len - pos, 1));
    if (pos + p + 1 < s.length) {
      s = s.substring(0, pos + p + 1);
    }
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
  return !token || token.invalidAccount || token.notFound
    ? balance
    : balance.div(Big(10).pow(token.metadata.decimals));
};

export const toTokenBalance = (token, balance) => {
  return !token || token.invalidAccount || token.notFound
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
