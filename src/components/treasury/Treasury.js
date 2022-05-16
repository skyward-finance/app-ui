import React, { useEffect, useState } from "react";
import uuid from "react-uuid";
import TokenAndBalance from "../token/TokenAndBalance";
import { useTreasury } from "../../data/treasury";
import {
  MinUsdValue,
  NearConfig,
  SkywardRegisterStorageDeposit,
  TGas,
} from "../../data/near";
import {
  bigMin,
  bigToString,
  computeUsdBalance,
  fromTokenBalance,
  Loading,
  OneSkyward,
  toTokenBalance,
} from "../../data/utils";
import TokenSymbol from "../token/TokenSymbol";
import AvailableInput from "../common/AvailableInput";
import { useAccount } from "../../data/account";
import Big from "big.js";
import {isTokenRegistered, tokenStorageDeposit, useToken, WrappedTokens} from "../../data/token";
import TokenBalance from "../token/TokenBalance";
import * as nearAPI from "near-api-js";
import { defaultWhitelistedTokens, useRefFinance } from "../../data/refFinance";
import MutedDecimals from "../common/MutedDecimals";

const DefaultMode = "DefaultMode";
const RedeemMode = "RedeemMode";

const SkywardVestingSchedule = [
  {
    startTimestamp: 1627776000000,
    endTimestamp: 1630454400000,
    amount: Big("10000000000000000000000"),
  },
  {
    startTimestamp: 1640995200000,
    endTimestamp: 1656633600000,
    amount: Big("90000000000000000000000"),
  },
  {
    startTimestamp: 1625097600000,
    endTimestamp: 162509760000 + 604800000,
    amount: Big("250000000000000000000000"),
  },
  {
    startTimestamp: 1627776000000,
    endTimestamp: 1627776000000 + 604800000,
    amount: Big("200000000000000000000000"),
  },
  {
    startTimestamp: 1630454400000,
    endTimestamp: 1630454400000 + 604800000,
    amount: Big("150000000000000000000000"),
  },
  {
    startTimestamp: 1633046400000,
    endTimestamp: 1633046400000 + 604800000,
    amount: Big("100000000000000000000000"),
  },
  {
    startTimestamp: 1635724800000,
    endTimestamp: 1635724800000 + 604800000,
    amount: Big("100000000000000000000000"),
  },
  {
    startTimestamp: 1638316800000,
    endTimestamp: 1638316800000 + 604800000,
    amount: Big("100000000000000000000000"),
  },
];

export default function Treasury(props) {
  const [mode, setMode] = useState(DefaultMode);
  const [loading, setLoading] = useState(false);
  const [gkey] = useState(uuid());
  const [skywardBurnAmountHuman, setSkywardBurnAmountHuman] = useState(null);
  const [skywardTokenBalance, setSkywardTokenBalance] = useState(null);

  const treasury = useTreasury();
  const account = useAccount();
  const skywardToken = useToken(NearConfig.skywardTokenAccountId);
  const refFinance = useRefFinance();

  let availableSkywardBalance = Big(0);
  let totalVestedAmount = Big(0);
  const currentTimestamp = new Date().getTime();
  SkywardVestingSchedule.forEach(({ startTimestamp, endTimestamp, amount }) => {
    totalVestedAmount = totalVestedAmount.add(
      currentTimestamp <= startTimestamp
        ? Big(0)
        : currentTimestamp >= endTimestamp
        ? amount
        : Big(currentTimestamp - startTimestamp)
            .mul(amount)
            .div(endTimestamp - startTimestamp)
            .round(0, 0)
    );
  });

  if (account && !account.loading && account.accountId) {
    if (NearConfig.skywardTokenAccountId in account.balances) {
      availableSkywardBalance = availableSkywardBalance.add(
        account.balances[NearConfig.skywardTokenAccountId]
      );
    }
    if (skywardToken) {
      if (skywardTokenBalance !== null) {
        availableSkywardBalance = availableSkywardBalance.add(
          skywardTokenBalance
        );
      } else {
        skywardToken.contract
          .balanceOf(account, account.accountId)
          .then((v) => setSkywardTokenBalance(v));
      }
    }
  }
  const availableSkywardBalanceHuman = fromTokenBalance(
    skywardToken,
    availableSkywardBalance
  );

  const skywardBurnAmount = skywardBurnAmountHuman
    ? bigMin(
        toTokenBalance(skywardToken, skywardBurnAmountHuman),
        availableSkywardBalance
      )
    : Big(0);

  const [selectedTokens, setSelectedTokens] = useState(null);

  useEffect(() => {
    if (
      selectedTokens === null &&
      account &&
      account.accountId &&
      !account.loading &&
      treasury.balances &&
      !treasury.loading
    ) {
      const refTokens = [...defaultWhitelistedTokens].reduce((a, v) => {
        a[v] = true;
        return a;
      }, {});

      const selectedTokens = Object.assign(
        {},
        WrappedTokens,
        refTokens,
        account.balances
      );
      Object.keys(selectedTokens).forEach((tokenAccountId) => {
        if (
          !(tokenAccountId in treasury.balances) ||
          treasury.balances[tokenAccountId].eq(0)
        ) {
          delete selectedTokens[tokenAccountId];
        }
      });
      setSelectedTokens(selectedTokens);
    }
  }, [account, selectedTokens, treasury]);

  const receiveBalances = [];

  const balances =
    treasury && !treasury.loading
      ? Object.entries(treasury.balances)
          .map(([tokenAccountId, balance]) => {
            let youReceive = treasury.skywardCirculatingSupply.gt(0)
              ? skywardBurnAmount
                  .mul(balance)
                  .div(treasury.skywardCirculatingSupply)
                  .round(0, 0)
              : Big(0);
            const youReceiveUsd =
              computeUsdBalance(refFinance, tokenAccountId, youReceive) ||
              Big(0);
            if (
              (selectedTokens && tokenAccountId in selectedTokens) ||
              youReceiveUsd.gt(MinUsdValue)
            ) {
              receiveBalances.push([tokenAccountId, youReceive]);
            } else {
              youReceive = Big(0);
            }
            const balances = (skywardBurnAmount.gt(0)
              ? [
                  ["YOU WILL RECEIVE ", youReceive],
                  ["TREASURY ", balance],
                ]
              : [
                  [
                    "PER SKYWARD ",
                    treasury.skywardCirculatingSupply.gt(0)
                      ? balance
                          .mul(OneSkyward)
                          .div(treasury.skywardCirculatingSupply)
                      : Big(0),
                  ],
                  ["TOTAL ", balance],
                ]
            ).filter(([label, balance]) => balance && balance.gt(0));
            const usdValue =
              computeUsdBalance(refFinance, tokenAccountId, balance) || Big(0);
            return {
              tokenAccountId,
              balances,
              balance,
              usdValue,
            };
          })
          .filter(({ balance }) => balance && balance.gt(0))
      : [];

  balances.sort((a, b) => b.usdValue.toNumber() - a.usdValue.toNumber());
  const potentialTokenValueMultiplier = (new Date().getTime() - 1611083139130) / 31536000000;
  const estimatedTreasuryUsdValue = balances.reduce(
    (p, b) => p.add(b.usdValue),
    Big(0)
  ).mul(potentialTokenValueMultiplier);
  const usdPerSkyward = toTokenBalance(
    skywardToken,
    estimatedTreasuryUsdValue.div(treasury.skywardCirculatingSupply || Big(1))
  );

  const renderBalances = (balances) =>
    balances.map(({ tokenAccountId, balances }) => {
      const key = `${gkey}-treasuryBalance-${tokenAccountId}`;
      return (
        <TokenAndBalance
          key={key}
          tokenAccountId={tokenAccountId}
          balances={balances}
        />
      );
    });

  const redeemSkyward = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];
    // Registering all token if needed
    const receivingTokens = receiveBalances.map(
      ([tokenAccountId, balance]) => tokenAccountId
    );
    const missingTokens = [
      NearConfig.skywardTokenAccountId,
      ...receivingTokens,
    ].filter((tokenAccountId) => !(tokenAccountId in account.balances));
    if (missingTokens.length > 0) {
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "register_tokens",
          {
            token_account_ids: missingTokens,
          },
          TGas.mul(200).toFixed(0),
          SkywardRegisterStorageDeposit.mul(missingTokens.length).toFixed(0)
        ),
      ]);
    }

    const innerBalance =
      account.balances[NearConfig.skywardTokenAccountId] || Big(0);
    // Depositing SKYWARD token if needed
    if (skywardBurnAmount.gt(innerBalance)) {
      const amountFromToken = skywardBurnAmount.sub(innerBalance);
      actions.push([
        NearConfig.skywardTokenAccountId,
        nearAPI.transactions.functionCall(
          "ft_transfer_call",
          {
            receiver_id: NearConfig.contractName,
            amount: amountFromToken.toFixed(0),
            memo: `Deposit to redeem from Treasury`,
            msg: '"AccountDeposit"',
          },
          TGas.mul(50).toFixed(0),
          1
        ),
      ]);
    }

    // Redeeming skyward
    actions.push([
      NearConfig.contractName,
      nearAPI.transactions.functionCall(
        "redeem_skyward",
        {
          skyward_amount: skywardBurnAmount.toFixed(0),
          token_account_ids: receivingTokens,
        },
        TGas.mul(200).toFixed(0),
        1
      ),
    ]);

    // Registering for receiving tokens
    for (let i = 0; i < receivingTokens.length; i++) {
      if (
        !(await isTokenRegistered(
          account,
          receivingTokens[i],
          account.accountId
        ))
      ) {
        actions.push([
          receivingTokens[i],
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            (await tokenStorageDeposit(account.near, receivingTokens[i])).toFixed(0)
          ),
        ]);
      }
    }

    // Withdrawing
    receiveBalances.forEach(([tokenAccountId, balance]) => {
      if (tokenAccountId === NearConfig.wrapNearAccountId) {
        actions.push([
          NearConfig.contractName,
          nearAPI.transactions.functionCall(
            "withdraw_token",
            {
              token_account_id: tokenAccountId,
            },
            TGas.mul(40).toFixed(0),
            0
          ),
        ]);
        actions.push([
          tokenAccountId,
          nearAPI.transactions.functionCall(
            "near_withdraw",
            {
              amount: balance.mul(0.9999).round(0, 0).toFixed(0),
            },
            TGas.mul(10).toFixed(0),
            1
          ),
        ]);
      }
    });

    await account.near.sendTransactions(actions);
  };

  const whitelistedBalances = balances.filter((b) =>
    refFinance.whitelistedTokens.has(b.tokenAccountId)
  );
  const otherBalances = balances.filter(
    (b) => !refFinance.whitelistedTokens.has(b.tokenAccountId)
  );
  const skywardBurned =
    treasury && !treasury.loading
      ? totalVestedAmount.sub(treasury.skywardCirculatingSupply)
      : Big(0);
  const skywardTotalSupply = Big(10).pow(24).sub(skywardBurned);

  return (
    <div className="card">
      {treasury.loading ? (
        <div className="card-body">{Loading} loading...</div>
      ) : (
        <div className="card-body">
          <h2 className="primary-header">Treasury</h2>
          <div>
            <TokenAndBalance
              tokenAccountId={NearConfig.skywardTokenAccountId}
              balances={[
                ["CIRCULATING SUPPLY ", treasury.skywardCirculatingSupply],
                ["BURNED ", skywardBurned],
                ["TOTAL SUPPLY ", skywardTotalSupply],
              ]}
            />
          </div>
          {estimatedTreasuryUsdValue.gt(0) && (
            <div>
              <span title="Based on the potential token values">*</span>Treasury total value locked:{" "}
              <span className="font-monospace fw-bold">
                <span className="text-secondary">~$</span>
                <MutedDecimals value={bigToString(estimatedTreasuryUsdValue)} />
              </span>
            </div>
          )}
          {usdPerSkyward.gt(0) && (
            <div>
              <span title="Based on the potential token values">*</span>Per{" "}
              <TokenSymbol tokenAccountId={NearConfig.skywardTokenAccountId} />{" "}
              token:{" "}
              <span className="font-monospace fw-bold">
                <span className="text-secondary">~$</span>
                <MutedDecimals value={bigToString(usdPerSkyward)} />
              </span>
            </div>
          )}
          <div>
            {account && account.accountId && mode === DefaultMode ? (
              <button
                className="btn btn-outline-primary mt-3"
                disabled={loading}
                onClick={() => setMode(RedeemMode)}
              >
                Redeem{" "}
                <TokenSymbol
                  tokenAccountId={NearConfig.skywardTokenAccountId}
                />
              </button>
            ) : (
              mode === RedeemMode && (
                <div className="mt-3">
                  <div
                    className="modal fade"
                    id="confirmRedeemModal"
                    tabIndex="-1"
                    data-bs-backdrop="static"
                    data-bs-keyboard="false"
                    aria-labelledby="confirmRedeemModalLabel"
                    aria-hidden="true"
                  >
                    <div className="modal-dialog modal-dialog-centered">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5
                            className="modal-title"
                            id="confirmRedeemModalLabel"
                          >
                            <i className="bi bi-exclamation-triangle" /> Confirm{" "}
                            <TokenSymbol
                              tokenAccountId={NearConfig.skywardTokenAccountId}
                            />{" "}
                            redeem
                          </h5>
                          <button
                            type="button"
                            className="btn-close"
                            disabled={loading}
                            data-bs-dismiss="modal"
                            aria-label="Close"
                          />
                        </div>
                        <div className="modal-body">
                          <div>
                            You will pay (it will be burned):
                            <li>
                              <TokenBalance
                                tokenAccountId={
                                  NearConfig.skywardTokenAccountId
                                }
                                balance={skywardBurnAmount}
                              />{" "}
                              <TokenSymbol
                                tokenAccountId={
                                  NearConfig.skywardTokenAccountId
                                }
                              />
                            </li>
                          </div>
                          <div>
                            You will receive:
                            {receiveBalances.map(
                              ([tokenAccountId, balance]) => {
                                const key = `${gkey}-receiveKey-${tokenAccountId}`;
                                return (
                                  <li key={key}>
                                    <TokenBalance
                                      tokenAccountId={tokenAccountId}
                                      balance={balance}
                                    />{" "}
                                    <TokenSymbol
                                      tokenAccountId={tokenAccountId}
                                    />
                                  </li>
                                );
                              }
                            )}
                          </div>
                        </div>
                        <div
                          className="modal-footer"
                          style={{ justifyContent: "space-between" }}
                        >
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={loading}
                            onClick={redeemSkyward}
                          >
                            {loading && Loading}
                            Redeem{" "}
                            <TokenBalance
                              tokenAccountId={NearConfig.skywardTokenAccountId}
                              balance={skywardBurnAmount}
                            />{" "}
                            <TokenSymbol
                              tokenAccountId={NearConfig.skywardTokenAccountId}
                            />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary float-end"
                            disabled={loading}
                            data-bs-dismiss="modal"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h5>
                    Redeeming{" "}
                    <TokenSymbol
                      tokenAccountId={NearConfig.skywardTokenAccountId}
                    />
                  </h5>
                  <AvailableInput
                    value={skywardBurnAmountHuman}
                    setValue={(v) => setSkywardBurnAmountHuman(v)}
                    limit={availableSkywardBalanceHuman}
                  />
                  <div className="clearfix">
                    <button
                      className="btn btn-danger"
                      disabled={
                        !skywardBurnAmountHuman ||
                        skywardBurnAmountHuman.gt(
                          availableSkywardBalanceHuman
                        ) ||
                        loading
                      }
                      type="button"
                      data-bs-toggle="modal"
                      data-bs-target="#confirmRedeemModal"
                    >
                      Redeem{" "}
                      {skywardBurnAmountHuman &&
                        bigToString(skywardBurnAmountHuman)}{" "}
                      <TokenSymbol
                        tokenAccountId={NearConfig.skywardTokenAccountId}
                      />
                    </button>
                    <button
                      className="btn btn-secondary float-end"
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setSkywardBurnAmountHuman(null);
                        setMode(DefaultMode);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
          <hr />
          {whitelistedBalances.length > 0 && (
            <>
              <div>Treasury Tokens whitelisted on REF</div>
              <div>{renderBalances(whitelistedBalances)}</div>
              <hr />
            </>
          )}
          <div>Other Treasury Tokens</div>
          <div>{renderBalances(otherBalances)}</div>
        </div>
      )}
    </div>
  );
}
