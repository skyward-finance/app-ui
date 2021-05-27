import "./Sale.scss";
import "./SalePreview.scss";
import React, { useState } from "react";
import RemainingDuration from "./RemainingDuration";
import SaleInputOutputs from "./SaleInputOutputs";
import Rate from "./Rate";
import Big from "big.js";
import TokenSymbol from "./TokenSymbol";
import {
  availableNearBalance,
  bigToString,
  fromTokenBalance,
  toTokenBalance,
} from "../data/utils";
import { useToken } from "../data/token";
import { useAccount } from "../data/account";
import {
  NearConfig,
  SkywardRegisterStorageDeposit,
  SubscribeDeposit,
  TGas,
  TokenStorageDeposit,
} from "../data/near";
import * as nearAPI from "near-api-js";

const DepositMode = "Deposit";
const WithdrawMode = "Withdrawal";

export default function Sale(props) {
  const [mode, setMode] = useState(null);
  const [extraDeposit, setExtraDeposit] = useState(null);
  const [inBalance, setInBalance] = useState(null);
  const sale = props.sale;

  const account = useAccount();

  const inToken = useToken(sale.inTokenAccountId);
  const extraDepositBalance = extraDeposit
    ? toTokenBalance(inToken, extraDeposit)
    : Big(0);

  const subInToken = (sale.subscription
    ? sale.subscription.remainingInBalance
    : Big(0)
  ).add(extraDepositBalance);

  const subInExtraShares = sale.totalShares.eq(0)
    ? extraDepositBalance
    : sale.totalShares.mul(extraDepositBalance).div(sale.inTokenRemaining);

  const subOutTokens = sale.outTokens.map((o) => {
    return {
      tokenAccountId: o.tokenAccountId,
      remaining:
        sale.subscription && sale.subscription.shares.gt(0)
          ? sale.subscription.shares
              .add(subInExtraShares)
              .mul(o.remaining)
              .div(sale.totalShares)
          : sale.totalShares.eq(0) && subInToken.gt(0)
          ? Big(o.remaining)
          : Big(0),
    };
  });

  let availableInToken = Big(0);
  let nativeNearBalance = availableNearBalance(account);

  if (account && !account.loading) {
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

  const subscribeToSale = async (e) => {
    e.preventDefault();
    const amount = toTokenBalance(inToken, extraDeposit);
    const transactions = [];

    let nonceOffset = 0;
    const blockHash = await account.near.fetchBlockHash();

    const skywardBalance =
      sale.inTokenAccountId in account.balances
        ? account.balances[sale.inTokenAccountId]
        : Big(0);

    const fromInToken = amount.gt(skywardBalance)
      ? amount.sub(skywardBalance)
      : Big(0);

    if (!(sale.inTokenAccountId in account.balances)) {
      transactions.push(
        account.near.createTransaction(
          NearConfig.contractName,
          [
            nearAPI.transactions.functionCall(
              "register_token",
              {
                token_account_id: sale.inTokenAccountId,
              },
              TGas.mul(10).toFixed(0),
              SkywardRegisterStorageDeposit.toFixed(0)
            ),
          ],
          blockHash,
          nonceOffset++
        )
      );
    }

    const inTokenActions = [];

    if (sale.inTokenAccountId === NearConfig.wrapNearAccountId) {
      if (!(await inToken.contract.isRegistered(account.accountId))) {
        inTokenActions.push(
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            TokenStorageDeposit.toFixed(0)
          )
        );
      }
      // wrap NEAR
      if (fromInToken.gt(inBalance)) {
        const fromAccount = fromInToken.sub(inBalance);
        inTokenActions.push(
          nearAPI.transactions.functionCall(
            "near_deposit",
            {},
            TGas.mul(5).toFixed(0),
            fromAccount.toFixed(0)
          )
        );
      }
    }

    if (!(await inToken.contract.isRegistered(NearConfig.contractName))) {
      inTokenActions.push(
        nearAPI.transactions.functionCall(
          "storage_deposit",
          {
            account_id: NearConfig.contractName,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          TokenStorageDeposit.toFixed(0)
        )
      );
    }

    if (fromInToken.gt(0)) {
      inTokenActions.push(
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
        )
      );
    }

    if (inTokenActions.length > 0) {
      transactions.push(
        account.near.createTransaction(
          sale.inTokenAccountId,
          inTokenActions,
          blockHash,
          nonceOffset++
        )
      );
    }

    transactions.push(
      account.near.createTransaction(
        NearConfig.contractName,
        [
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
        ],
        blockHash,
        nonceOffset++
      )
    );

    await account.near.walletConnection.requestSignTransactions(transactions);
  };

  return (
    <div>
      <div>
        <h2>{sale.title || "Noname sale"}</h2>
        <div className="price-history card m-2">
          <div className="card-body">
            Price history
            <br />
            Coming soon
          </div>
        </div>
        <div className="sale-preview card m-2">
          <div className="card-body">
            <SaleInputOutputs sale={sale} />
            <Rate title="Current Rate" sale={sale} />
          </div>
        </div>
        <div className="card m-2">
          <div className="card-body">
            <RemainingDuration sale={sale} />
          </div>
        </div>
      </div>
      <div>
        <div className="card m-2">
          <h5 className="card-header">Your sale subscription</h5>
          <div className="card-body">
            <SaleInputOutputs
              inputLabel="You are Paying"
              inTokenAccountId={sale.inTokenAccountId}
              inTokenRemaining={subInToken}
              outputLabel="Expecting to Receive"
              outTokens={subOutTokens}
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
              <div>
                <button
                  className="btn btn-primary m-1"
                  onClick={() => setMode(DepositMode)}
                >
                  <i className="bi bi-box-arrow-in-right" /> Deposit{" "}
                  <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                </button>
                <button
                  className="btn btn-outline-primary m-1"
                  onClick={() => setMode(WithdrawMode)}
                >
                  <i className="bi bi-box-arrow-left" /> Withdraw{" "}
                  <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                </button>
              </div>
            ) : mode === DepositMode ? (
              <div>
                <h5>
                  Pay{" "}
                  <TokenSymbol
                    tokenAccountId={sale.inTokenAccountId}
                    className="badge token-symbol font-monospace"
                  />
                </h5>
                <div className="input-group mb-3">
                  <input
                    className="form-control"
                    type="number"
                    placeholder={`Available ${bigToString(
                      availableInTokenHuman
                    )}`}
                    value={extraDeposit || undefined}
                    onChange={(e) => {
                      let v = extraDeposit;
                      try {
                        v = Big(e.target.value);
                        if (v.lt(0)) {
                          v = v.mul(-1);
                        }
                      } catch (e) {}
                      setExtraDeposit(v);
                    }}
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setExtraDeposit(availableInTokenHuman)}
                  >
                    MAX
                  </button>
                </div>
                <div className="clearfix">
                  <button
                    className="btn btn-success"
                    disabled={
                      !extraDeposit || extraDeposit.gt(availableInTokenHuman)
                    }
                    type="button"
                    onClick={(e) => subscribeToSale(e)}
                  >
                    Pay {extraDeposit && bigToString(extraDeposit)}{" "}
                    <TokenSymbol tokenAccountId={sale.inTokenAccountId} />
                  </button>
                  <button
                    className="btn btn-secondary float-end"
                    type="button"
                    onClick={() => setMode(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : mode === WithdrawMode ? (
              <div>withdraw</div>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
