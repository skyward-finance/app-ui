import React, { useState } from "react";
import { useAccount } from "../data/account";
import TokenSelect from "./TokenSelect";
import { AccountBalance, BalanceType } from "./AccountBalance";
import AvailableInput from "./AvailableInput";
import { useToken } from "../data/token";
import Big from "big.js";
import {
  fromTokenBalance,
  isoDate,
  Loading,
  skywardUrl,
  tokenStorageDeposit,
  toTokenBalance,
} from "../data/utils";
import SalePreview from "./SalePreview";
import { addSaleMethods, useSales } from "../data/sales";
import DatePicker from "react-datepicker";
import "./CreateSale.scss";

import "react-datepicker/dist/react-datepicker.css";
import {
  CreateSaleDeposit,
  NearConfig,
  SkywardRegisterStorageDeposit,
  TGas,
} from "../data/near";
import * as nearAPI from "near-api-js";

const OneDay = 24 * 60 * 60 * 1000;
const OneWeek = 7 * OneDay;

export default function CreatSale(props) {
  const account = useAccount();
  const sales = useSales();
  const [loading, setLoading] = useState(false);
  const [inTokenAccountId, setInTokenAccountId] = useState(null);
  const [outputTokenId, setOutputTokenId] = useState(null);

  const [outAmountHuman, setOutAmountHuman] = useState(null);
  const [fetchedBalances, setFetchedBalances] = useState(null);

  const [saleTitle, setSaleTitle] = useState("");
  const [referralBpt, setReferralBpt] = useState(100);

  const outToken = useToken(outputTokenId);

  let availableOutBalance = Big(0);
  if (fetchedBalances) {
    Object.values(fetchedBalances).forEach((balance) => {
      if (balance) {
        availableOutBalance = availableOutBalance.add(balance);
      }
    });
  }
  const availableOutBalanceHuman = fromTokenBalance(
    outToken,
    availableOutBalance
  );

  let outAmount = toTokenBalance(outToken, outAmountHuman || Big(0));
  if (outAmount.gt(availableOutBalance)) {
    outAmount = availableOutBalance;
  }

  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  const minDate = new Date(
    Math.trunc(new Date().getTime() / OneDay + 8) * OneDay
  );

  const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000;

  const toLocalTimezone = (d) =>
    d ? new Date(d.getTime() + timezoneOffset) : null;
  const toUTCTimezone = (d) =>
    d ? new Date(d.getTime() - timezoneOffset) : null;

  const startTime = startDate ? startDate.getTime() : minDate.getTime();
  const duration =
    endDate && startDate
      ? endDate.getTime() - startDate.getTime() + OneDay
      : OneWeek;
  const numDays = Math.trunc(duration / OneDay);
  const endTime = startTime + duration;

  const sale = addSaleMethods({
    saleId: -1,
    title: saleTitle,
    inTokenAccountId,
    outTokens: [
      {
        tokenAccountId: outputTokenId,
        remaining: outAmount,
        distributed: Big(0),
        referralBpt,
      },
    ],
    inTokenRemaining: Big(0),
    inTokenPaidUnclaimed: Big(0),
    inTokenPaid: Big(0),
    totalShares: Big(0),
    startTime,
    startDate: new Date(startTime),
    duration,
    endTime,
    endDate: new Date(endTime),
    remainingDuration: endTime - new Date().getTime(),
    currentDate: new Date(),
  });

  const createSale = async (e) => {
    e.preventDefault();
    setLoading(true);

    let amount = outAmount;
    const balanceInternal = fetchedBalances[BalanceType.Internal] || Big(0);
    const amountFromToken = balanceInternal.gte(amount)
      ? Big(0)
      : amount.sub(balanceInternal);

    const actions = [];
    if (!(outputTokenId in account.balances)) {
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "register_token",
          {
            token_account_id: outputTokenId,
          },
          TGas.mul(10).toFixed(0),
          SkywardRegisterStorageDeposit.toFixed(0)
        ),
      ]);
    }

    if (outputTokenId === NearConfig.wrapNearAccountId) {
      if (!(await outToken.contract.isRegistered(account, account.accountId))) {
        actions.push([
          outputTokenId,
          nearAPI.transactions.functionCall(
            "storage_deposit",
            {
              account_id: account.accountId,
              registration_only: true,
            },
            TGas.mul(5).toFixed(0),
            (await tokenStorageDeposit(outputTokenId)).toFixed(0)
          ),
        ]);
      }
      // wrap NEAR
      const balanceToken = fetchedBalances[BalanceType.Wallet] || Big(0);
      if (amountFromToken.gt(balanceToken)) {
        const amountFromAccount = amountFromToken.sub(balanceToken);
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

    if (
      !(await outToken.contract.isRegistered(account, NearConfig.contractName))
    ) {
      actions.push([
        outputTokenId,
        nearAPI.transactions.functionCall(
          "storage_deposit",
          {
            account_id: NearConfig.contractName,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          (await tokenStorageDeposit(outputTokenId)).toFixed(0)
        ),
      ]);
    }

    if (amountFromToken.gt(0)) {
      actions.push([
        outputTokenId,
        nearAPI.transactions.functionCall(
          "ft_transfer_call",
          {
            receiver_id: NearConfig.contractName,
            amount: amountFromToken.toFixed(0),
            memo: `Deposit to create a Skyward Finance sale`,
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
        "sale_create",
        {
          sale: {
            title: saleTitle,
            out_tokens: [
              {
                token_account_id: outputTokenId,
                balance: outAmount.toFixed(0),
                referral_bpt: referralBpt,
              },
            ],
            in_token_account_id: inTokenAccountId,
            start_time: Big(startTime).mul(1000000).toFixed(0),
            duration: Big(duration).mul(1000000).toFixed(0),
          },
        },
        TGas.mul(200).toFixed(0),
        CreateSaleDeposit.toFixed(0)
      ),
    ]);

    const expectedSaleId = sales.sales.length;

    await account.near.sendTransactions(
      actions,
      skywardUrl() + `/sale/${expectedSaleId}`
    );
  };

  return (
    <>
      <div className="card mb-2">
        <div className="card-body">
          <h2 className="primary-header">Create a new Listing</h2>
          <div className="mb-3">
            <label htmlFor="sale-title-input">Listing title</label>
            <input
              id="sale-title-input"
              className="form-control"
              value={saleTitle}
              onChange={(e) => setSaleTitle(e.target.value)}
              placeholder="$NEW token sale"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="input-token-select">
              Input token{" "}
              <span className="text-muted">(a token you want to receive)</span>
            </label>
            <TokenSelect
              id="input-token-select"
              tokenFilter={(tokenAccountId) => tokenAccountId !== outputTokenId}
              onSelectTokenId={setInTokenAccountId}
            />
          </div>
          {inTokenAccountId && (
            <div className="mb-3">
              <label htmlFor="output-token-select">
                Output token{" "}
                <span className="text-muted">(a token you want to offer)</span>
              </label>
              <TokenSelect
                id="output-token-select"
                tokenFilter={(tokenAccountId) =>
                  tokenAccountId !== inTokenAccountId
                }
                onSelectTokenId={setOutputTokenId}
              />
            </div>
          )}
          {outputTokenId && (
            <div className="mb-3">
              <label htmlFor="output-token-amount">Output token amount</label>
              <AccountBalance
                tokenAccountId={outputTokenId}
                onFetchedBalances={setFetchedBalances}
              />
              <AvailableInput
                htmlFor="output-token-amount"
                value={outAmountHuman}
                setValue={(v) => setOutAmountHuman(v)}
                limit={availableOutBalanceHuman}
              />
            </div>
          )}
          {outAmount.gt(0) && (
            <>
              <div className="mb-3">
                <label htmlFor="referral-fee-range" className="form-label">
                  Referral fee <b>{referralBpt / 100}%</b>{" "}
                  <span className="text-muted">
                    (the referral fee will come from the output amount)
                  </span>
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="500"
                  step="1"
                  id="referral-fee-range"
                  value={referralBpt}
                  onChange={(e) => setReferralBpt(parseInt(e.target.value))}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="sale-dates-picker" className="mb-2">
                  Sale starts on <b>{isoDate(startTime)}</b>{" "}
                  <span className="text-muted">at 00:00 UTC</span> and ends on{" "}
                  <b>{isoDate(endTime)}</b>{" "}
                  <span className="text-muted">at 00:00 UTC</span> for the
                  duration of{" "}
                  <b>
                    {numDays} day
                    {numDays > 1 ? "s " : " "}
                  </b>
                </label>
                <DatePicker
                  id="sale-dates-picker"
                  selectsRange={true}
                  minDate={toLocalTimezone(minDate)}
                  startDate={toLocalTimezone(startDate)}
                  endDate={toLocalTimezone(endDate)}
                  onChange={([startDate, endDate]) =>
                    setDateRange([
                      toUTCTimezone(startDate),
                      toUTCTimezone(endDate),
                    ])
                  }
                  inline
                />
              </div>
            </>
          )}
          {startDate && endDate && (
            <div className="mb-3">
              <button
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#createSaleModal"
              >
                Preview Listing
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        className="modal fade"
        id="createSaleModal"
        tabIndex="-1"
        data-bs-backdrop="static"
        data-bs-keyboard="false"
        aria-labelledby="createSaleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered preview-sale-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="createSaleModalLabel">
                Create a listing for 10 NEAR
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
              <SalePreview sale={sale} />
            </div>
            <div
              className="modal-footer"
              style={{ justifyContent: "space-between" }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={createSale}
              >
                {loading && Loading}
                Create a listing
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
      <h2 className="primary-header">Listing preview</h2>
      <div className="row justify-content-md-center">
        <SalePreview sale={sale} />
      </div>
    </>
  );
}
