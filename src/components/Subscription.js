import "./Sale.scss";
import "./SalePreview.scss";
import React, { useState } from "react";
import SaleInputOutputs from "./SaleInputOutputs";
import Rate from "./Rate";
import Big from "big.js";
import TokenSymbol from "./TokenSymbol";
import {
  availableNearBalance,
  bigToString,
  fromTokenBalance,
  Loading,
  toTokenBalance,
} from "../data/utils";
import { isTokenRegistered, useToken } from "../data/token";
import { useAccount } from "../data/account";
import {
  LsKey,
  NearConfig,
  SkywardRegisterStorageDeposit,
  SubscribeDeposit,
  TGas,
  TokenStorageDeposit,
} from "../data/near";
import * as nearAPI from "near-api-js";
import AvailableInput from "./AvailableInput";
import ls from "local-storage";
import TokenBalance from "./TokenBalance";
import { useSales } from "../data/sales";

const DepositMode = "Deposit";
const WithdrawMode = "Withdrawal";

export default function Subscription(props) {
  const withdrawToWalletLsKey = LsKey + "withdrawToWallet";

  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extraDeposit, setExtraDeposit] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState(null);
  const [withdrawToWallet, setWithdrawToWallet] = useState(
    ls.get(withdrawToWalletLsKey) || false
  );
  const [inBalance, setInBalance] = useState(null);
  const sale = props.sale;
  const sales = useSales();

  const account = useAccount();
  const inToken = useToken(sale.inTokenAccountId);

  const subscription = sale.subscription || {
    claimedOutBalance: sale.outTokens.map(() => Big(0)),
    spentInBalance: Big(0),
    remainingInBalance: Big(0),
    unclaimedOutBalances: sale.outTokens.map(() => Big(0)),
    shares: Big(0),
  };

  let availableInToken = Big(0);
  let nativeNearBalance = availableNearBalance(account);

  if (account && !account.loading && account.accountId) {
    if (sale.inTokenAccountId in account.balances) {
      availableInToken = availableInToken.add(
        account.balances[sale.inTokenAccountId]
      );
    }
    if (inToken) {
      if (inBalance !== null) {
        availableInToken = availableInToken.add(inBalance);
      } else {
        inToken.contract
          .balanceOf(account.accountId)
          .then((v) => setInBalance(v));
      }
    }
    if (sale.inTokenAccountId === NearConfig.wrapNearAccountId) {
      availableInToken = availableInToken.add(nativeNearBalance);
    }
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

  const subInExtraShares = sale.totalShares.eq(0)
    ? extraDepositBalance
    : sale.totalShares
        .mul(extraDepositBalance.sub(withdrawAmountBalance))
        .div(sale.inTokenRemaining);

  const subInTotalShares = subscription.shares.add(subInExtraShares);

  const subOutTokens = sale.outTokens.map((o, i) => {
    return {
      tokenAccountId: o.tokenAccountId,
      remainingLabel: "EXPECTED: ",
      distributedLabel: "RECEIVED: ",
      remaining: sale.totalShares.gt(0)
        ? subInTotalShares
            .mul(o.remaining)
            .div(sale.totalShares.add(subInExtraShares))
        : subInToken.gt(0)
        ? Big(o.remaining)
        : Big(0),
      distributed: subscription.claimedOutBalance[i].add(
        subscription.unclaimedOutBalances[i]
      ),
    };
  });

  const subscribeToSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    const amount = toTokenBalance(inToken, extraDeposit);
    const actions = [];

    const skywardBalance =
      sale.inTokenAccountId in account.balances
        ? account.balances[sale.inTokenAccountId]
        : Big(0);

    const fromInToken = amount.gt(skywardBalance)
      ? amount.sub(skywardBalance)
      : Big(0);

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

    if (sale.inTokenAccountId === NearConfig.wrapNearAccountId) {
      if (!(await inToken.contract.isRegistered(account.accountId))) {
        actions.push([
          sale.inTokenAccountId,
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            TokenStorageDeposit.toFixed(0)
          ),
        ]);
      }
      // wrap NEAR
      if (fromInToken.gt(inBalance)) {
        const amountFromAccount = fromInToken.sub(inBalance);
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

    if (!(await inToken.contract.isRegistered(NearConfig.contractName))) {
      actions.push([
        sale.inTokenAccountId,
        nearAPI.transactions.functionCall(
          "storage_deposit",
          {
            account_id: NearConfig.contractName,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          TokenStorageDeposit.toFixed(0)
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
          // TODO: referral
        },
        TGas.mul(15).toFixed(0),
        SubscribeDeposit.toFixed(0)
      ),
    ]);

    await account.near.sendTransactions(actions);
  };

  const withdrawFromSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    const maxWithdraw = withdrawAmount.eq(subRemainingInBalanceHuman);
    let amount = withdrawAmountBalance;
    const actions = [];

    const freshSale = await sales.fetchSale(sale.saleId);
    const freshRemainingIn = freshSale.subscription.remainingInBalance;
    const maxReceiveAmount = freshRemainingIn
      .mul(
        Big((freshSale.remainingDuration - 60e3) / freshSale.remainingDuration)
      )
      .round();
    if (maxWithdraw) {
      amount = maxReceiveAmount;
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "sale_withdraw_in_token",
          {
            sale_id: sale.saleId,
          },
          TGas.mul(15).toFixed(0),
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
          TGas.mul(15).toFixed(0),
          1
        ),
      ]);
    }

    if (withdrawToWallet) {
      if (!(await inToken.contract.isRegistered(account.accountId))) {
        actions.push([
          sale.inTokenAccountId,
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            TokenStorageDeposit.toFixed(0)
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
      TGas.mul(20).toFixed(0)
    );
    const actions = [];
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
            TokenStorageDeposit.toFixed(0)
          ),
        ]);
      }
    }
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
    <div className={"card m-2"}>
      <div className="card-body">
        <SaleInputOutputs
          inputLabel="You Deposited"
          inTokenAccountId={sale.inTokenAccountId}
          inTokenRemaining={subInToken}
          inTokenPaid={subscription.spentInBalance}
          outputLabel="You Receiving"
          outTokens={subOutTokens}
          detailed
        />
        <Rate
          title="Expected Rate"
          inTokenAccountId={sale.inTokenAccountId}
          inTokenRemaining={subInToken}
          outputLabel="Expecting to Receive"
          outTokens={subOutTokens}
        />
        <hr />
        {!mode ? (
          <div className="flex-buttons">
            <button
              className="btn btn-primary m-1"
              disabled={loading}
              onClick={() => setMode(DepositMode)}
            >
              Deposit <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
            </button>
            <button
              className="btn btn-primary m-1"
              disabled={loading}
              onClick={() => setMode(WithdrawMode)}
            >
              Withdraw <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
            </button>
            <button
              className="btn btn-success m-1"
              disabled={loading}
              onClick={(e) => claimOut(e)}
            >
              {loading && Loading}
              Claim{" "}
              <TokenBalance
                tokenAccountId={sale.outTokens[0].tokenAccountId}
                balance={subscription.unclaimedOutBalances[0]}
              />{" "}
              <TokenSymbol tokenAccountId={sale.outTokens[0].tokenAccountId} />
            </button>
          </div>
        ) : mode === DepositMode ? (
          <div>
            <h5>
              Deposit{" "}
              <TokenSymbol
                tokenAccountId={sale.inTokenAccountId}
                className="font-monospace"
              />{" "}
              to receive{" "}
              <TokenSymbol
                tokenAccountId={sale.outTokens[0].tokenAccountId}
                balance={subscription.unclaimedOutBalances[0]}
                className="font-monospace"
              />
            </h5>
            <AvailableInput
              value={extraDeposit}
              setValue={(v) => setExtraDeposit(v)}
              limit={availableInTokenHuman}
            />
            <div className="clearfix">
              <button
                className="btn btn-success"
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
                <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
              </button>
              <button
                className="btn btn-secondary float-end"
                type="button"
                onClick={() => {
                  setExtraDeposit(null);
                  setMode(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : mode === WithdrawMode ? (
          <div>
            <h5>
              Withdraw{" "}
              <TokenSymbol
                tokenAccountId={sale.inTokenAccountId}
                className="font-monospace"
              />{" "}
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
                className="btn btn-secondary float-end"
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
  ) : (
    <div className="alert alert-warning">Sign in to subscribe to this sale</div>
  );
}