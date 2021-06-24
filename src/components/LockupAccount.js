import React, { useState } from "react";
import { dateToString, Loading } from "../data/utils";
import Timer from "react-compound-timer";
import TokenBalance from "./TokenBalance";
import {
  NearConfig,
  SkywardRegisterStorageDeposit,
  TGas,
  TokenStorageDeposit,
} from "../data/near";
import TokenSymbol from "./TokenSymbol";
import * as nearAPI from "near-api-js";
import { useToken } from "../data/token";

export default function LockupAccount(props) {
  const [loading, setLoading] = useState(false);
  const account = props.account;
  const lockupAccount = account.lockupAccount;
  const time = new Date().getTime();

  const progress = lockupAccount.started()
    ? (lockupAccount.passedDuration() / lockupAccount.duration) * 100
    : ((lockupAccount.startTimestamp - time) /
        (lockupAccount.endTimestamp - time)) *
      100;

  const remainingDuration = lockupAccount.started()
    ? lockupAccount.duration - lockupAccount.passedDuration()
    : lockupAccount.startDate - time;

  const unclaimedBalance = lockupAccount.unclaimedBalance();
  const remainingBalance = lockupAccount.remainingBalance;

  const skywardToken = useToken(NearConfig.skywardTokenAccountId);

  const claimLocked = async (e) => {
    e.preventDefault();
    setLoading(true);

    const actions = [];

    if (!(NearConfig.skywardTokenAccountId in account.balances)) {
      actions.push([
        NearConfig.contractName,
        nearAPI.transactions.functionCall(
          "register_token",
          {
            token_account_id: NearConfig.skywardTokenAccountId,
          },
          TGas.mul(10).toFixed(0),
          SkywardRegisterStorageDeposit.toFixed(0)
        ),
      ]);
    }

    if (!(await skywardToken.contract.isRegistered(account.accountId))) {
      actions.push([
        NearConfig.skywardTokenAccountId,
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
      lockupAccount.lockupAccountId,
      nearAPI.transactions.functionCall(
        "claim",
        {},
        TGas.mul(60).toFixed(0),
        0
      ),
    ]);

    await account.near.sendTransactions(actions);
  };

  return (
    <div>
      <div className="duration-date-wrapper">
        <div
          className="duration-date"
          style={{
            left: lockupAccount.started()
              ? 0
              : `min(100% - 12em, ${progress}%)`,
          }}
        >
          {dateToString(lockupAccount.startDate)}
        </div>
        <div className="duration-date" style={{ right: 0 }}>
          {dateToString(lockupAccount.endDate)}
        </div>
      </div>
      <div className="progress">
        {lockupAccount.started() ? (
          <div
            className="progress-bar bg-simple-gradient"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ minWidth: `${progress}%` }}
          >
            {lockupAccount.started() && (
              <div>{Math.trunc(progress * 10) / 10}%</div>
            )}
          </div>
        ) : (
          <>
            <div
              className="progress-bar bg-transparent text-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${progress}%` }}
            >
              Locked
            </div>
            <div
              className="progress-bar bg-simple-gradient-light"
              role="progressbar"
              aria-valuenow={100 - progress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${100 - progress}%` }}
            >
              Release 0%
            </div>
          </>
        )}
      </div>
      <div className="text-center">
        {lockupAccount.ended() ? (
          "Fully unlocked"
        ) : (
          <div>
            {lockupAccount.started()
              ? "Remaining duration"
              : "Unlock starts in"}{" "}
            <Timer
              key={`${remainingDuration}`}
              initialTime={remainingDuration}
              direction="backward"
              timeToUpdate={100}
              lastUnit="d"
            >
              {() => (
                <React.Fragment>
                  <Timer.Days
                    formatValue={(v) =>
                      v > 1 ? `${v} days ` : v ? `1 day ` : ""
                    }
                  />
                  <Timer.Hours />:
                  <Timer.Minutes formatValue={(v) => `${v}`.padStart(2, "0")} />
                  :
                  <Timer.Seconds formatValue={(v) => `${v}`.padStart(2, "0")} />
                </React.Fragment>
              )}
            </Timer>
          </div>
        )}
      </div>
      {remainingBalance.gt(0) && (
        <div>
          <div>
            Remaining locked balance:{" "}
            <TokenBalance
              tokenAccountId={NearConfig.skywardTokenAccountId}
              balance={remainingBalance}
            />
          </div>
          <div>
            <button
              className="btn btn-primary m-1"
              disabled={unclaimedBalance.eq(0) || loading}
              onClick={(e) => claimLocked(e)}
            >
              {loading && Loading}
              Claim{" "}
              <TokenBalance
                tokenAccountId={NearConfig.skywardTokenAccountId}
                balance={unclaimedBalance}
              />{" "}
              <TokenSymbol tokenAccountId={NearConfig.skywardTokenAccountId} />{" "}
              to wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
