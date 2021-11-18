import "./Sale.scss";
import "./SalePreview.scss";
import React, { useState } from "react";
import SaleInputOutputs from "./SaleInputOutputs";
import Rate from "../common/Rate";
import Big from "big.js";
import TokenSymbol from "../token/TokenSymbol";
import {
  bigMin,
  bigToString,
  fromTokenBalance,
  getCurrentReferralId,
  isBridgeToken,
  isLowValueSale,
  isSaleWhitelisted,
  Loading,
  tokenStorageDeposit,
  toTokenBalance,
} from "../../data/utils";
import { isTokenRegistered, useToken } from "../../data/token";
import { useAccount } from "../../data/account";
import {
  IsMainnet,
  LsKey,
  NearConfig,
  SkywardRegisterStorageDeposit,
  SubscribeDeposit,
  TGas,
} from "../../data/near";
import * as nearAPI from "near-api-js";
import AvailableInput from "../common/AvailableInput";
import ls from "local-storage";
import TokenBalance from "../token/TokenBalance";
import { useSales } from "../../data/sales";
import { useTokenBalances } from "../../data/tokenBalances";
import { BalanceType } from "../account/AccountBalance";
import { useRefFinance } from "../../data/refFinance";
import { useSalePermission } from "../../data/salePermission";

const DepositMode = "Deposit";
const WithdrawMode = "Withdrawal";

export default function Subscription(props) {
  const withdrawToWalletLsKey = LsKey + "withdrawToWallet";
  const allowDepositFromRefLsKey = LsKey + "allowDepositFromRef";

  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extraDeposit, setExtraDeposit] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState(null);
  const [withdrawToWallet, setWithdrawToWallet] = useState(
    ls.get(withdrawToWalletLsKey) || false
  );
  const [allowDepositFromRef, setAllowDepositFromRef] = useState(
    ls.get(allowDepositFromRefLsKey) || true
  );

  const sale = props.sale;
  const sales = useSales();

  const account = useAccount();
  const inToken = useToken(sale.inTokenAccountId);

  const refFinance = useRefFinance();

  const depositPermission = useSalePermission(sale);

  const subscription = sale.subscription || {
    claimedOutBalance: sale.outTokens.map(() => Big(0)),
    spentInBalance: Big(0),
    remainingInBalance: Big(0),
    unclaimedOutBalances: sale.outTokens.map(() => Big(0)),
    shares: Big(0),
    noSub: true,
  };

  let availableInToken = Big(0);
  const { tokenBalances } = useTokenBalances(sale.inTokenAccountId);

  if (tokenBalances) {
    Object.entries(tokenBalances).forEach(([key, balance]) => {
      if (balance && (allowDepositFromRef || key !== BalanceType.Ref)) {
        availableInToken = availableInToken.add(balance);
      }
    });
  }
  const availableInTokenHuman = fromTokenBalance(inToken, availableInToken);
  const subRemainingInBalanceHuman = fromTokenBalance(
    inToken,
    subscription.remainingInBalance
  );

  let extraDepositBalance = toTokenBalance(inToken, extraDeposit || Big(0));
  if (extraDepositBalance.gt(availableInToken)) {
    extraDepositBalance = availableInToken;
  }
  let withdrawAmountBalance = toTokenBalance(inToken, withdrawAmount || Big(0));
  if (withdrawAmountBalance.gt(subscription.remainingInBalance)) {
    withdrawAmountBalance = subscription.remainingInBalance;
  }

  const subInToken = subscription.remainingInBalance
    .add(extraDepositBalance)
    .sub(withdrawAmountBalance);

  const subInExtraShares =
    sale.totalShares.eq(0) || sale.inTokenRemaining.eq(0)
      ? extraDepositBalance
      : sale.totalShares
          .mul(extraDepositBalance.sub(withdrawAmountBalance))
          .div(sale.inTokenRemaining);

  const subInTotalShares = subscription.shares.add(subInExtraShares);

  const adjustForReferral = (balance, subscription, outToken) => {
    if (!outToken.referralBpt) {
      return balance;
    }
    const referralAmount = balance.mul(outToken.referralBpt).div(10000);
    if (subscription.referralId) {
      return balance.sub(referralAmount.div(2));
    } else {
      return balance.sub(referralAmount);
    }
  };

  const resShares = sale.totalShares.add(subInExtraShares);

  const subOutTokens = sale.outTokens.map((o, i) => {
    return {
      tokenAccountId: o.tokenAccountId,
      remainingLabel: "EXPECTED: ",
      distributedLabel: "RECEIVED: ",
      remaining: resShares.gt(0)
        ? subInTotalShares.mul(o.remaining).div(resShares)
        : subInToken.gt(0)
        ? Big(o.remaining)
        : Big(0),
      distributed: adjustForReferral(
        subscription.claimedOutBalance[i].add(
          subscription.unclaimedOutBalances[i]
        ),
        subscription,
        o
      ),
    };
  });

  let claimBalance = adjustForReferral(
    subscription.unclaimedOutBalances[0],
    subscription,
    sale.outTokens[0]
  );

  const makeOutRegistered = async (actions) => {
    const outTokens = sale.outTokens.map((o) => o.tokenAccountId);
    for (let i = 0; i < outTokens.length; i++) {
      if (
        !(await isTokenRegistered(account, outTokens[i], account.accountId))
      ) {
        actions.push([
          outTokens[i],
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            (await tokenStorageDeposit(outTokens[i])).toFixed(0)
          ),
        ]);
      }
    }
  };

  const subscribeToSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    const amount = extraDepositBalance;
    const actions = [];

    let referralId = getCurrentReferralId(sale.saleId) || undefined;
    if (referralId === account.accountId) {
      referralId = undefined;
    }

    const skywardBalance =
      sale.inTokenAccountId in account.balances
        ? account.balances[sale.inTokenAccountId]
        : Big(0);

    const fromInToken = amount.gt(skywardBalance)
      ? amount.sub(skywardBalance)
      : Big(0);

    await makeOutRegistered(actions);

    if (!(sale.inTokenAccountId in account.balances)) {
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "register_token",
          {
            token_account_id: sale.inTokenAccountId,
          },
          TGas.mul(10).toFixed(0),
          SkywardRegisterStorageDeposit.toFixed(0)
        ),
      ]);
    }
    const inBalance = tokenBalances[BalanceType.Wallet] || Big(0);
    let remainingInBalance = fromInToken.sub(bigMin(fromInToken, inBalance));

    if (!(await inToken.contract.isRegistered(account, account.accountId))) {
      actions.push([
        sale.inTokenAccountId,
        nearAPI.transactions.functionCall(
          "storage_deposit",
          {
            account_id: account.accountId,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          (await tokenStorageDeposit(sale.inTokenAccountId)).toFixed(0)
        ),
      ]);
    }

    if (sale.inTokenAccountId === NearConfig.wrapNearAccountId) {
      // wrap NEAR
      if (remainingInBalance.gt(0)) {
        const availableAccountAmount =
          tokenBalances[BalanceType.NEAR] || Big(0);
        const amountFromAccount = bigMin(
          availableAccountAmount,
          remainingInBalance
        );
        if (amountFromAccount.gt(0)) {
          remainingInBalance = remainingInBalance.sub(amountFromAccount);
          actions.push([
            sale.inTokenAccountId,
            nearAPI.transactions.functionCall(
              "near_deposit",
              {},
              TGas.mul(5).toFixed(0),
              amountFromAccount.toFixed(0)
            ),
          ]);
        }
      }
    }

    // Trying Ref deposit
    const refBalance = tokenBalances[BalanceType.Ref] || Big(0);
    if (allowDepositFromRef && remainingInBalance.gt(0) && refBalance.gt(0)) {
      const amountFromRef = bigMin(remainingInBalance, refBalance);
      remainingInBalance = remainingInBalance.sub(amountFromRef);
      actions.push([
        NearConfig.refContractName,
        nearAPI.transactions.functionCall(
          "withdraw",
          {
            token_id: sale.inTokenAccountId,
            amount: amountFromRef.toFixed(0),
            unregister: false,
          },
          TGas.mul(70).toFixed(0),
          1
        ),
      ]);
    }

    if (remainingInBalance.gt(0)) {
      throw new Error(
        `Remaining balance ${remainingInBalance.toFixed(0)} is greater than 0`
      );
    }

    if (
      !(await inToken.contract.isRegistered(account, NearConfig.contractName))
    ) {
      actions.push([
        sale.inTokenAccountId,
        nearAPI.transactions.functionCall(
          "storage_deposit",
          {
            account_id: NearConfig.contractName,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          (await tokenStorageDeposit(sale.inTokenAccountId)).toFixed(0)
        ),
      ]);
    }

    if (fromInToken.gt(0)) {
      actions.push([
        sale.inTokenAccountId,
        nearAPI.transactions.functionCall(
          "ft_transfer_call",
          {
            receiver_id: NearConfig.contractName,
            amount: fromInToken.toFixed(0),
            memo: `Subscribing to Skyward sale #${sale.saleId}`,
            msg: '"AccountDeposit"',
          },
          TGas.mul(50).toFixed(0),
          1
        ),
      ]);
    }

    actions.push([
      NearConfig.contractName,
      nearAPI.transactions.functionCall(
        "sale_deposit_in_token",
        {
          sale_id: sale.saleId,
          amount: amount.toFixed(0),
          referral_id: referralId,
        },
        TGas.mul(200).toFixed(0),
        SubscribeDeposit.toFixed(0)
      ),
    ]);

    await account.near.sendTransactions(actions);
  };

  const withdrawFromSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    const maxWithdraw = withdrawAmount.gte(
      subRemainingInBalanceHuman.round(6, 0)
    );
    let amount = withdrawAmountBalance;
    const actions = [];

    const freshSale = await sales.fetchSale(sale.saleId);
    const freshRemainingIn = freshSale.subscription.remainingInBalance;
    const maxReceiveAmount = freshRemainingIn
      .mul(
        Big((freshSale.remainingDuration - 60e3) / freshSale.remainingDuration)
      )
      .round();

    await makeOutRegistered(actions);

    if (maxWithdraw) {
      amount = maxReceiveAmount;
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "sale_withdraw_in_token",
          {
            sale_id: sale.saleId,
          },
          TGas.mul(30).toFixed(0),
          1
        ),
      ]);
    } else {
      if (amount.gt(maxReceiveAmount)) {
        throw new Error("Not enough tokens");
      }
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "sale_withdraw_in_token_exact",
          {
            sale_id: sale.saleId,
            amount: amount.toFixed(0),
          },
          TGas.mul(30).toFixed(0),
          1
        ),
      ]);
    }

    if (withdrawToWallet) {
      if (!(await inToken.contract.isRegistered(account, account.accountId))) {
        actions.push([
          sale.inTokenAccountId,
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            (await tokenStorageDeposit(sale.inTokenAccountId)).toFixed(0)
          ),
        ]);
      }

      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "withdraw_token",
          {
            token_account_id: sale.inTokenAccountId,
            amount: amount.toFixed(0),
          },
          TGas.mul(40).toFixed(0),
          0
        ),
      ]);

      if (sale.inTokenAccountId === NearConfig.wrapNearAccountId) {
        actions.push([
          sale.inTokenAccountId,
          nearAPI.transactions.functionCall(
            "near_withdraw",
            {
              amount: amount.toFixed(0),
            },
            TGas.mul(10).toFixed(0),
            1
          ),
        ]);
      }
    }

    await account.near.sendTransactions(actions);
  };

  const claimOut = async (e) => {
    e.preventDefault();
    setLoading(true);
    await account.near.contract.sale_claim_out_tokens(
      {
        sale_id: sale.saleId,
      },
      TGas.mul(60).toFixed(0)
    );
    const actions = [];
    await makeOutRegistered(actions);
    const outTokens = sale.outTokens.map((o) => o.tokenAccountId);
    if (actions.length > 0) {
      outTokens.forEach((tokenAccountId) => {
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
      });

      await account.near.sendTransactions(actions);
    } else {
      for (let i = 0; i < outTokens.length; i++) {
        await account.near.contract.withdraw_token(
          {
            token_account_id: outTokens[i],
          },
          TGas.mul(40).toFixed(0),
          0
        );
      }
      await sales.refreshSale(sale.saleId);
      setLoading(false);
    }
  };

  return account && account.accountId ? (
    (!sale.ended() || !subscription.noSub) && (
      <div className={"card mb-2"}>
        <div className="card-body">
          {!isSaleWhitelisted(sale, refFinance) && (
            <div className="alert alert-danger">
              <b>
                Danger! This listing contains tokens not whitelisted by REF
                Finance.
              </b>
              <br />
              Investing in this sale may result in receiving illiquid tokens
              and/or complete lose of funds.
              <br />
              Please do your own research before you deposit funds into this
              listing.
              <br />
            </div>
          )}
          {sale.farAhead() && (
            <div className="alert alert-warning">
              <b>Warning! This sale will begin in more than one week!</b>
              <br />
              Don't deposit{" "}
              <TokenSymbol tokenAccountId={sale.inTokenAccountId} /> now. There
              will be enough time to deposit before the sale begins.
              <br />
            </div>
          )}
          {isLowValueSale(sale, refFinance) && (
            <div className="alert alert-danger">
              <b>Warning! The value of listed tokens is very low!</b>
              <br />
              Investing in this sale may result in partial lose of funds.
              <br />
              Please do your own research before you deposit funds into this
              listing.
              <br />
            </div>
          )}

          <SaleInputOutputs
            inputLabel="You Deposited"
            inTokenAccountId={sale.inTokenAccountId}
            inTokenRemaining={subInToken}
            inTokenPaid={subscription.spentInBalance}
            outputLabel="You Receiving"
            outTokens={subOutTokens}
            detailed
          />
          {!sale.ended() && (
            <Rate
              title="Expected Rate"
              inTokenAccountId={sale.inTokenAccountId}
              inTokenRemaining={subInToken}
              outputLabel="Expecting to Receive"
              outTokens={subOutTokens}
            />
          )}
          <hr />
          {!mode ? (
            <>
              {!sale.ended() && depositPermission === false && (
                <div className="alert alert-warning">
                  <b>
                    Your account doesn't have permission to participate in this
                    sale
                  </b>
                  <br />
                  Listing URL:{" "}
                  <a target="_blank" rel="noopener noreferrer" href={sale.url}>
                    {sale.url}
                  </a>
                  <br />
                  Permissions contract account ID is:{" "}
                  <b>{sale.permissionsContractId}</b>
                </div>
              )}
              <div className="flex-buttons">
                {!sale.ended() && (
                  <>
                    <button
                      className={`btn ${
                        !sale.farAhead() ? "btn-primary" : "btn-outline-primary"
                      } m-1`}
                      disabled={loading || !depositPermission}
                      onClick={() => setMode(DepositMode)}
                    >
                      Deposit{" "}
                      <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                    </button>

                    <button
                      className={`btn btn-outline-primary m-1`}
                      disabled={
                        loading || subscription.remainingInBalance.eq(0)
                      }
                      onClick={() => setMode(WithdrawMode)}
                    >
                      Withdraw{" "}
                      <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                    </button>
                  </>
                )}
                <button
                  className="btn btn-success m-1"
                  disabled={loading || claimBalance.eq(0)}
                  onClick={(e) => claimOut(e)}
                >
                  {loading && Loading}
                  Claim{" "}
                  <TokenBalance
                    tokenAccountId={sale.outTokens[0].tokenAccountId}
                    balance={claimBalance}
                  />{" "}
                  <TokenSymbol
                    tokenAccountId={sale.outTokens[0].tokenAccountId}
                  />
                </button>
              </div>
            </>
          ) : mode === DepositMode ? (
            <div>
              <h5>
                Deposit{" "}
                <span className="font-monospace">
                  <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                </span>{" "}
                to receive{" "}
                <span className="font-monospace">
                  <TokenSymbol
                    tokenAccountId={sale.outTokens[0].tokenAccountId}
                    balance={subscription.unclaimedOutBalances[0]}
                  />
                </span>{" "}
                <span className="text-muted">
                  (once the sale starts{" "}
                  <span className="font-monospace">
                    <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                  </span>{" "}
                  will be exchanging to{" "}
                  <span className="font-monospace">
                    <TokenSymbol
                      tokenAccountId={sale.outTokens[0].tokenAccountId}
                      balance={subscription.unclaimedOutBalances[0]}
                    />
                  </span>
                  )
                </span>
              </h5>
              <AvailableInput
                value={extraDeposit}
                setValue={(v) => setExtraDeposit(v)}
                limit={availableInTokenHuman}
              />
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="allowDepositFromRef"
                  checked={allowDepositFromRef}
                  onChange={(e) => {
                    ls.set(allowDepositFromRefLsKey, e.target.checked);
                    setAllowDepositFromRef(e.target.checked);
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor="allowDepositFromRef"
                >
                  Use balance from Ref Finance
                  <span className="text-muted">
                    {" "}
                    (if checked, the available balance will display balance from
                    Ref Finance)
                  </span>
                </label>
              </div>
              <div className="clearfix">
                <button
                  className="btn btn-success m-1"
                  disabled={
                    !extraDeposit ||
                    extraDeposit.gt(availableInTokenHuman) ||
                    loading
                  }
                  type="button"
                  onClick={(e) => subscribeToSale(e)}
                >
                  {loading && Loading}
                  Deposit {extraDeposit && bigToString(extraDeposit)}{" "}
                  <TokenSymbol tokenAccountId={sale.inTokenAccountId} /> to
                  exchange for{" "}
                  <TokenSymbol
                    tokenAccountId={sale.outTokens[0].tokenAccountId}
                    balance={subscription.unclaimedOutBalances[0]}
                  />
                </button>
                <button
                  className="btn btn-secondary float-end m-1"
                  type="button"
                  onClick={() => {
                    setExtraDeposit(null);
                    setMode(null);
                  }}
                >
                  Cancel
                </button>
                {IsMainnet &&
                  sale.inTokenAccountId !== NearConfig.wrapNearAccountId && (
                    <a
                      className={`btn btn-outline-primary m-1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://app.ref.finance/#wrap.near|${sale.inTokenAccountId}`}
                    >
                      Buy <TokenSymbol tokenAccountId={sale.inTokenAccountId} />{" "}
                      on Ref Finance
                    </a>
                  )}
                {IsMainnet && isBridgeToken(sale.inTokenAccountId) && (
                  <a
                    className={`btn btn-outline-primary m-1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://ethereum.bridgetonear.org/`}
                  >
                    Bridge{" "}
                    <TokenSymbol tokenAccountId={sale.inTokenAccountId} /> from
                    Ethereum
                  </a>
                )}
              </div>
            </div>
          ) : mode === WithdrawMode ? (
            <div>
              <h5>
                Withdraw{" "}
                <span className="font-monospace">
                  <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                </span>{" "}
                from sale
              </h5>
              <AvailableInput
                value={withdrawAmount}
                setValue={(v) => setWithdrawAmount(v)}
                limit={subRemainingInBalanceHuman}
              />
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="withdrawToWallet"
                  checked={withdrawToWallet}
                  onChange={(e) => {
                    ls.set(withdrawToWalletLsKey, e.target.checked);
                    setWithdrawToWallet(e.target.checked);
                  }}
                />
                <label className="form-check-label" htmlFor="withdrawToWallet">
                  Withdraw to Wallet
                  <span className="text-muted">
                    {" "}
                    (if checked, the token will be also transferred from the
                    internal balance to the wallet)
                  </span>
                </label>
              </div>

              <div className="clearfix">
                <button
                  className="btn btn-warning m-1"
                  disabled={
                    !withdrawAmount ||
                    withdrawAmount.gt(subRemainingInBalanceHuman) ||
                    loading
                  }
                  type="button"
                  onClick={(e) => withdrawFromSale(e)}
                >
                  {loading && Loading}
                  Withdraw {withdrawAmount && bigToString(withdrawAmount)}{" "}
                  <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                </button>
                <button
                  className="btn btn-secondary float-end m-1"
                  type="button"
                  onClick={() => {
                    setWithdrawAmount(null);
                    setMode(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            ""
          )}
        </div>
      </div>
    )
  ) : (
    <div className="alert alert-warning">Sign in to subscribe to this sale</div>
  );
}
