import { useAccount } from "../../data/account";
import {
  getRefInverseReturn,
  getRefReturn,
  useRefFinance,
} from "../../data/refFinance";
import React, { useEffect, useState } from "react";
import TokenSelect from "../token/TokenSelect";
import AvailableInput from "../common/AvailableInput";
import Big from "big.js";
import { useTokenBalances } from "../../data/tokenBalances";
import {
  bigMin,
  bigToString,
  computeUsdBalance,
  fromTokenBalance,
  Loading,
  toTokenBalance,
} from "../../data/utils";
import { tokenRegisterStorageAction, useToken } from "../../data/token";
import "./Swap.scss";
import { NearConfig, TGas } from "../../data/near";
import Rate from "../common/Rate";
import TokenBalance from "../token/TokenBalance";
import { useHistory } from "react-router-dom";
import MutedDecimals from "../common/MutedDecimals";
import uuid from "react-uuid";
import TokenSymbol from "../token/TokenSymbol";
import * as nearAPI from "near-api-js";
import { BalanceType } from "../account/AccountBalance";

const EditMode = {
  None: "None",
  Input: "Input",
  Output: "Output",
};

const Slippage = [0, 0.001, 0.005, 0.02];

const findBestReturn = (
  refFinance,
  inTokenAccountId,
  outTokenAccountId,
  amountIn
) => {
  let swapInfo = {
    amountIn,
    amountOut: Big(0),
  };
  if (refFinance && !refFinance.loading) {
    // Computing path
    Object.values(refFinance.poolsByToken[inTokenAccountId] || {}).forEach(
      (pool) => {
        // 1 token
        if (outTokenAccountId in pool.tokens) {
          const poolReturn =
            getRefReturn(pool, inTokenAccountId, amountIn, outTokenAccountId) || Big(0);

          if (poolReturn.gt(swapInfo.amountOut)) {
            swapInfo = {
              amountIn,
              amountOut: poolReturn,
              pools: [pool],
              swapPath: [inTokenAccountId, outTokenAccountId]
            };
          }
        } else {
          // 2 tokens
          pool.ots[inTokenAccountId].forEach((middleTokenAccountId) => {
            const pair = `${middleTokenAccountId}:${outTokenAccountId}`;
            let poolReturn = false;
            Object.values(refFinance.poolsByPair[pair] || {}).forEach((pool2) => {
              poolReturn =
                poolReturn === false
                  ? getRefReturn(pool, inTokenAccountId, amountIn, middleTokenAccountId)
                  : poolReturn;
              if (!poolReturn) {
                return;
              }
              const pool2Return =
                getRefReturn(pool2, middleTokenAccountId, poolReturn, outTokenAccountId) || Big(0);
              if (pool2Return.gt(swapInfo.amountOut)) {
                swapInfo = {
                  amountIn,
                  amountOut: pool2Return,
                  pools: [pool, pool2],
                  swapPath: [inTokenAccountId, middleTokenAccountId, outTokenAccountId]
                };
              }
            });
          });
        }
      }
    );
  }
  return Object.assign(swapInfo, {
    inTokenAccountId,
    outTokenAccountId,
    expectedAmountOut: Big(0),
  });
};

const findBestInverseReturn = (
  refFinance,
  inTokenAccountId,
  outTokenAccountId,
  availableInToken,
  outAmount
) => {
  let swapInfo = {
    amountIn: availableInToken,
    amountOut: Big(0),
  };
  if (refFinance && !refFinance.loading) {
    // Computing path
    Object.values(refFinance.poolsByToken[outTokenAccountId] || {}).forEach(
      (pool) => {
        // 1 token
        if (inTokenAccountId in pool.tokens) {
          const amountIn = getRefInverseReturn(
            pool,
            outTokenAccountId,
            outAmount,
            inTokenAccountId
          );
          if (!amountIn) {
            return;
          }

          if (amountIn.lt(swapInfo.amountIn)) {
            swapInfo = {
              amountIn,
              amountOut: outAmount,
              pools: [pool],
              swapPath: [inTokenAccountId, outTokenAccountId]
            };
          }
        } else {
          // 2 tokens
          pool.ots[outTokenAccountId].forEach((middleTokenAccountId) => {
            const pair = `${middleTokenAccountId}:${inTokenAccountId}`;
            let middleAmountIn = false;
            Object.values(refFinance.poolsByPair[pair] || {}).forEach((pool2) => {
              middleAmountIn =
                middleAmountIn === false
                  ? getRefInverseReturn(pool, outTokenAccountId, outAmount, middleTokenAccountId)
                  : middleAmountIn;
              if (!middleAmountIn) {
                return;
              }
              const amountIn = getRefInverseReturn(
                pool2,
                middleTokenAccountId,
                middleAmountIn,
                inTokenAccountId
              );
              if (!amountIn) {
                return;
              }
              if (amountIn.lt(swapInfo.amountIn)) {
                swapInfo = {
                  amountIn,
                  amountOut: outAmount,
                  pools: [pool2, pool],
                  swapPath: [inTokenAccountId, middleTokenAccountId, outTokenAccountId]
                };
              }
            });
          });
        }
      }
    );
  }
  return Object.assign(swapInfo, {
    inTokenAccountId,
    outTokenAccountId,
    expectedAmountOut: outAmount,
  });
};

const updateUrl = (history, inTokenAccountId, outTokenAccountId) => {
  history.replace(`/swap/${inTokenAccountId}/${outTokenAccountId}`);
};

export default function Swap(props) {
  const [gkey] = useState(uuid());

  const account = useAccount();
  const refFinance = useRefFinance();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [maxSlippage, setMaxSlippage] = useState(0.005);
  const [editMode, setEditMode] = useState(EditMode.None);

  const [inTokenAccountId, setInTokenAccountId] = useState(
    props.inputTokenId || NearConfig.wrapNearAccountId
  );
  const [inTokenAmountHuman, setInTokenAmountHuman] = useState(null);
  const inToken = useToken(inTokenAccountId);
  const { tokenBalances } = useTokenBalances(inTokenAccountId);

  const [availableInToken, setAvailableInToken] = useState(null);
  useEffect(() => {
    if (tokenBalances) {
      setAvailableInToken(
        (tokenBalances[BalanceType.Wallet] || Big(0)).add(
          tokenBalances[BalanceType.NEAR] || Big(0)
        )
      );
    }
  }, [tokenBalances]);

  const availableInTokenHuman = fromTokenBalance(inToken, availableInToken);

  const [outTokenAccountId, setOutTokenAccountId] = useState(
    props.outputTokenId || NearConfig.skywardTokenAccountId
  );
  const outToken = useToken(outTokenAccountId);
  const [outTokenAmountHuman, setOutTokenAmountHuman] = useState(null);

  const [availableOutToken, setAvailableOutToken] = useState(Big(0));
  const [needRecompute, setNeedRecompute] = useState(true);

  useEffect(() => {
    if (refFinance && !refFinance.loading) {
      refFinance.scheduleRefresh(true);
      setNeedRecompute(true);
    }
  }, [refFinance]);

  useEffect(() => {
    const swapInfo = findBestReturn(
      refFinance,
      inTokenAccountId,
      outTokenAccountId,
      availableInToken
    );
    setAvailableOutToken(swapInfo.amountOut);
  }, [availableInToken, refFinance, inTokenAccountId, outTokenAccountId]);

  const availableOutTokenHuman = fromTokenBalance(outToken, availableOutToken);

  const [inTokenAmount, setInTokenAmount] = useState(null);
  const [outTokenAmount, setOutTokenAmount] = useState(null);
  const [swapInfo, setSwapInfo] = useState(null);

  useEffect(() => {
    if (editMode === EditMode.Input) {
      setInTokenAmount(
        bigMin(
          availableInToken,
          toTokenBalance(inToken, inTokenAmountHuman || Big(0))
        )
      );
    }
  }, [editMode, availableInToken, inToken, inTokenAmountHuman]);

  useEffect(() => {
    if (editMode === EditMode.Output) {
      setOutTokenAmount(
        bigMin(
          availableOutToken,
          toTokenBalance(outToken, outTokenAmountHuman || Big(0))
        )
      );
    }
  }, [editMode, availableOutToken, outToken, outTokenAmountHuman]);

  useEffect(() => {
    const willRecompute =
      needRecompute ||
      swapInfo === null ||
      (editMode === EditMode.Input &&
        !swapInfo.amountIn.eq(inTokenAmount || Big(0))) ||
      (editMode === EditMode.Output &&
        !swapInfo.expectedAmountOut.eq(outTokenAmount || Big(0))) ||
      swapInfo.inTokenAccountId !== inTokenAccountId ||
      swapInfo.outTokenAccountId !== outTokenAccountId;
    setNeedRecompute(false);
    if (editMode === EditMode.Input && inTokenAmount && willRecompute) {
      const swapInfo = findBestReturn(
        refFinance,
        inTokenAccountId,
        outTokenAccountId,
        inTokenAmount
      );
      setOutTokenAmount(swapInfo.amountOut);
      setSwapInfo(swapInfo);

      setOutTokenAmountHuman(
        fromTokenBalance(outToken, swapInfo.amountOut).round(6, 0)
      );
    } else if (
      editMode === EditMode.Output &&
      outTokenAmount &&
      willRecompute
    ) {
      const swapInfo = findBestInverseReturn(
        refFinance,
        inTokenAccountId,
        outTokenAccountId,
        availableInToken,
        outTokenAmount
      );
      setSwapInfo(swapInfo);
      setInTokenAmount(swapInfo.amountIn);

      setInTokenAmountHuman(
        fromTokenBalance(inToken, swapInfo.amountIn).round(6, 0)
      );
    }
  }, [
    editMode,
    needRecompute,
    swapInfo,
    refFinance,
    inTokenAccountId,
    inToken,
    inTokenAmount,
    inTokenAmountHuman,
    availableInToken,
    outTokenAccountId,
    outToken,
    outTokenAmount,
    outTokenAmountHuman,
  ]);

  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    setTokens(
      [
        ...new Set([
          ...Object.keys(
            Object.assign(
              {},
              account && !account.loading ? account.balances : {},
              refFinance ? refFinance.balances : {}
            )
          ),
          ...(refFinance ? refFinance.whitelistedTokens : []),
        ]),
      ].filter(
        (tokenId) =>
          tokenId === NearConfig.wrapNearAccountId ||
          (refFinance && tokenId in refFinance.prices)
      )
    );
  }, [refFinance, account]);

  const reverseDirection = (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }
    setInTokenAccountId(outTokenAccountId);
    setInTokenAmountHuman(outTokenAmountHuman);
    setInTokenAmount(outTokenAmount);
    setOutTokenAccountId(inTokenAccountId);
    setOutTokenAmountHuman(inTokenAmountHuman);
    setOutTokenAmount(inTokenAmount);
    if (editMode === EditMode.Input) {
      setEditMode(EditMode.Output);
    } else if (editMode === EditMode.Output) {
      setEditMode(EditMode.Input);
    }
    setNeedRecompute(true);
    updateUrl(history, outTokenAccountId, inTokenAccountId);
  };

  let priceImpact = Big(0);
  let priceImpactDiff = Big(0);
  if (refFinance && swapInfo && swapInfo.pools) {
    const inputUsdValue = computeUsdBalance(
      refFinance,
      swapInfo.inTokenAccountId,
      swapInfo.amountIn
    );
    const outputUsdValue = computeUsdBalance(
      refFinance,
      swapInfo.outTokenAccountId,
      swapInfo.amountOut
    );

    priceImpact =
      inputUsdValue && inputUsdValue.gt(0)
        ? outputUsdValue.div(inputUsdValue).sub(1)
        : Big(0);

    priceImpactDiff = outputUsdValue.sub(inputUsdValue);
  }

  const swap = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];
    await tokenRegisterStorageAction(
      account,
      swapInfo.outTokenAccountId,
      actions
    );

    if (swapInfo.inTokenAccountId === NearConfig.wrapNearAccountId) {
      await tokenRegisterStorageAction(
        account,
        swapInfo.inTokenAccountId,
        actions
      );

      const wNearBalance = tokenBalances[BalanceType.Wallet] || Big(0);

      if (wNearBalance.lt(swapInfo.amountIn)) {
        actions.push([
          NearConfig.wrapNearAccountId,
          nearAPI.transactions.functionCall(
            "near_deposit",
            {},
            TGas.mul(5).toFixed(0),
            swapInfo.amountIn.sub(wNearBalance).toFixed(0)
          ),
        ]);
      }
    }

    let tokenId = swapInfo.inTokenAccountId;

    actions.push([
      swapInfo.inTokenAccountId,
      nearAPI.transactions.functionCall(
        "ft_transfer_call",
        {
          receiver_id: NearConfig.refContractName,
          amount: swapInfo.amountIn.toFixed(0),
          msg: JSON.stringify({
            referral_id: NearConfig.referralId,
            actions: swapInfo.pools.map((pool, idx) => {
              const tokenIn = tokenId;
              tokenId = swapInfo.swapPath[idx + 1];
              return {
                pool_id: pool.index,
                token_in: tokenIn,
                token_out: tokenId,
                min_amount_out:
                  tokenId === swapInfo.outTokenAccountId
                    ? swapInfo.amountOut
                        .mul(1.0 - maxSlippage)
                        .round(0, 0)
                        .toFixed(0)
                    : "0",
              };
            }),
          }),
        },
        TGas.mul(250).toFixed(0),
        1
      ),
    ]);

    await account.near.sendTransactions(actions);
  };

  return (
    <>
      <div className="alert alert-warning">
        <b>
          Warning! The swap feature is still in development. It may contain bugs
          and may result in partial loss of funds.
        </b>
        <br />
        This UI allows to swap any two tokens and also finds the best available
        execution path to maximize return.
        <br />
        The trades are executed on REF Finance contract using Instant swap
        feature.
        <br />
        Please report any issues to{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://t.me/skywardfinance"
        >
          Skyward Flight
        </a>{" "}
        telegram.
      </div>
      <div className="card mb-2 swap-card">
        <div className="card-body">
          <h2 className="primary-header">[BETA] Swap</h2>
          <div className="mb-3">
            <TokenSelect
              id="input-token-select"
              className="token-select"
              disabled={loading}
              value={inTokenAccountId}
              tokens={[...tokens]}
              tokenFilter={(tokenAccountId) =>
                tokenAccountId !== outTokenAccountId
              }
              onSelectTokenId={(v) => {
                setNeedRecompute(true);
                updateUrl(history, v, outTokenAccountId);
                setInTokenAccountId(v);
              }}
            />

            <AvailableInput
              className="mt-1"
              disabled={loading}
              large
              autoFocus
              value={inTokenAmountHuman}
              setValue={(v) => {
                setEditMode(EditMode.Input);
                setInTokenAmountHuman(v);
              }}
              limit={availableInTokenHuman}
              extraLabel={
                <span className="text-secondary">
                  {" ("}
                  <TokenBalance
                    className="text-secondary"
                    tokenAccountId={inTokenAccountId}
                    showUsd
                    balance={availableInToken}
                  />
                  )
                </span>
              }
              extraLabelRight={
                inTokenAmount &&
                inTokenAmountHuman && (
                  <TokenBalance
                    className="text-secondary"
                    tokenAccountId={inTokenAccountId}
                    showUsd
                    balance={inTokenAmount}
                  />
                )
              }
            />
          </div>
          <div className="text-center mb-2" style={{ position: "relative" }}>
            <i
              className="bi bi-arrow-down fs-3 pointer rotate-arrow"
              onClick={reverseDirection}
            />
          </div>
          <div className="mb-3">
            <TokenSelect
              id="output-token-select"
              disabled={loading}
              className="token-select"
              value={outTokenAccountId}
              tokens={[...tokens]}
              tokenFilter={(tokenAccountId) =>
                tokenAccountId !== inTokenAccountId
              }
              onSelectTokenId={(v) => {
                setNeedRecompute(true);
                updateUrl(history, inTokenAccountId, v);
                setOutTokenAccountId(v);
              }}
            />

            <AvailableInput
              className="input-group-lg mt-1"
              value={outTokenAmountHuman}
              disabled={loading}
              label="Max"
              large
              setValue={(v) => {
                setNeedRecompute(true);
                setEditMode(EditMode.Output);
                setOutTokenAmountHuman(v);
              }}
              limit={availableOutTokenHuman}
              extraLabel={
                <span className="text-secondary">
                  {" ("}
                  <TokenBalance
                    className="text-secondary"
                    tokenAccountId={outTokenAccountId}
                    showUsd
                    balance={availableOutToken}
                  />
                  )
                </span>
              }
              extraLabelRight={
                outTokenAmount &&
                outTokenAmountHuman && (
                  <TokenBalance
                    className="text-secondary"
                    tokenAccountId={outTokenAccountId}
                    showUsd
                    balance={outTokenAmount}
                  />
                )
              }
            />
          </div>
          <div className="mb-3">
            <label>Max slippage</label>
            <div className="row">
              <div
                className="btn-group"
                role="group"
                aria-label="Slippage toggle"
              >
                {Slippage.map((slippage) => {
                  let key = `${gkey}-slippage-${slippage}`;
                  return (
                    <React.Fragment key={key}>
                      <input
                        type="radio"
                        className="btn-check"
                        name="btnradio"
                        id={key}
                        disabled={loading}
                        autoComplete="off"
                        checked={slippage === maxSlippage}
                        onChange={() => setMaxSlippage(slippage)}
                      />
                      <label
                        className="btn btn-outline-primary"
                        htmlFor={key}
                      >{`${slippage * 100}%`}</label>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
          {swapInfo && swapInfo.pools && (
            <div className="mt-3">
              <h5>Swap details</h5>
              <Rate
                title="Rate"
                hideInverse
                inTokenAccountId={swapInfo.inTokenAccountId}
                inTokenRemaining={swapInfo.amountIn}
                outTokens={[
                  {
                    remaining: swapInfo.amountOut,
                    tokenAccountId: swapInfo.outTokenAccountId,
                  },
                ]}
              />
              <Rate
                title="Inverse Rate"
                hideInverse
                inTokenAccountId={swapInfo.outTokenAccountId}
                inTokenRemaining={swapInfo.amountOut}
                outTokens={[
                  {
                    remaining: swapInfo.amountIn,
                    tokenAccountId: swapInfo.inTokenAccountId,
                  },
                ]}
              />
              <div className="left-right">
                <div>Price Impact</div>
                <div className="font-monospace">
                  <span className="fw-bold">
                    <MutedDecimals value={bigToString(priceImpactDiff, 2)} />
                    {"$ "}
                  </span>
                  <span
                    className={
                      "text-secondary " +
                      (priceImpact.lt(-0.02)
                        ? "fw-bold text-danger"
                        : priceImpact.lt(-0.005)
                        ? "fw-bold text-warning"
                        : priceImpact.gt(0.01)
                        ? "fw-bold text-success"
                        : "")
                    }
                  >
                    ({bigToString(priceImpact.mul(100), 2)}%)
                  </span>
                </div>
              </div>
              <div className="left-right">
                <div>Path</div>
                <div>
                  {swapInfo.swapPath.map((tokenAccountId, i) => (
                    <React.Fragment key={`${gkey}-path-${i}`}>
                      {i ? <> &#8594; </> : ""}
                      <TokenSymbol tokenAccountId={tokenAccountId} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="mt-1 d-grid">
                <button
                  className={`btn btn-${
                    priceImpact.lt(-0.02) ? "danger" : "primary"
                  }`}
                  disabled={loading}
                  onClick={swap}
                >
                  {loading && Loading}
                  Swap{priceImpact.lt(-0.02) ? " (high price impact)" : ""}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
